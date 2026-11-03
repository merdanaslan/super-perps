/** Public metadata + unsigned builders only. This script cannot sign or submit. */
import {
  address,
  getBase58Decoder,
  getBase64Encoder,
  isOffCurveAddress,
  type Instruction,
} from '@solana/kit';
import {
  buildLimitOrderPacketFromMarketParams,
  buildTakeProfitStopLossTriggerOrders,
  buildReferralActivationTransaction,
  referralActivationExchangeAccountsFromSnapshot,
  buildRegisterTraderIx,
  decodePermission,
  flight,
  OrderFlags,
  Side,
  symbol,
  ticks,
  type Authority,
  type PhoenixProgramAddress,
  type TraderAddress,
} from '@ellipsis-labs/rise';
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import { NEW_TRADER_MAX_POSITIONS, TradingService } from '../src/trading/service';
import { compileInstructions, sameBytes } from '../src/trading/chain';
import { routeBuilderOrders } from '../src/trading/monetization';
import { PHOENIX_PROGRAM_ID } from '../src/phoenix/client';
import { prepareMarketOrder } from '../src/phoenix/orders';
import { assertSourceSlotFresh } from '../src/trading/math';
import { quoteFromBook } from '../src/phoenix/data';
import { withdrawalInstructions } from '../src/trading/withdrawal';

const api = process.env.VITE_PHOENIX_API_URL || 'https://perp-api.phoenix.trade';
const rpc =
  process.env.SOLANA_RPC_URL ||
  process.env.VITE_SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com';
// Random public bytes, no private key. Never fund this probe address.
const authority = address(
  getBase58Decoder().decode(crypto.getRandomValues(new Uint8Array(32))),
) as Authority;
const service = new TradingService(api, rpc);
try {
  const account = await service.readAccount(authority);
  const client = service.client;
  const market = client.exchange.market('BTC')!;
  const book = await client.api.orderbook().getOrderbook('BTC');
  const chainSlot = await service.rpc<number>('getSlot', [{ commitment: 'confirmed' }]);
  assertSourceSlotFresh(book.slot, chainSlot);
  const quote = quoteFromBook(book, Date.now());
  const rules = {
    symbol: 'BTC',
    status: market.marketStatus,
    tickSize: market.tickSize,
    baseLotsDecimals: market.baseLotsDecimals,
  };
  const common = { authority, traderPdaIndex: 0, traderSubaccountIndex: 0 };
  const order = { ...common, symbol: symbol('BTC') };
  const limitPacket = buildLimitOrderPacketFromMarketParams(
    { side: Side.Bid, priceUsd: quote.ask, baseUnits: '0.001', orderFlags: OrderFlags.None },
    rules,
  );
  const marketPacket = prepareMarketOrder(
    { symbol: 'BTC', side: 'long', baseUnits: '0.001', slippageBps: 50, reduceOnly: false },
    rules,
    quote,
    Date.now(),
  ).packet;
  const exits = buildTakeProfitStopLossTriggerOrders({
    primarySide: Side.Bid,
    takeProfitPrice: ticks((BigInt(limitPacket.priceInTicks) * 11n) / 10n),
    stopLossPrice: ticks((BigInt(limitPacket.priceInTicks) * 9n) / 10n),
    slippageBps: 50,
  });
  const actions: Record<string, readonly Instruction[]> = {
    deposit: (await client.ixs.buildDepositIxs({ ...common, amount: 1_000_000n })).instructions,
    withdraw: (await client.ixs.buildWithdrawIxs({ ...common, amount: 1_000_000n })).instructions,
    market: [await client.ixs.buildPlaceMarketOrder({ ...order, orderPacket: marketPacket })],
    limit: [await client.ixs.buildPlaceLimitOrder({ ...order, orderPacket: limitPacket })],
    marketWithNewTpSlAccount: [
      await client.ixs.buildCreateConditionalOrdersAccount({ ...common, capacity: 32 }),
      await client.ixs.buildPlaceMarketOrder({ ...order, orderPacket: marketPacket }),
      await client.ixs.buildPlacePositionConditionalOrder({
        ...order,
        sizeBaseLots: marketPacket.numBaseLots,
        ...exits,
      }),
    ],
    limitWithNewTpSlAccount: [
      await client.ixs.buildCreateConditionalOrdersAccount({ ...common, capacity: 32 }),
      await client.ixs.buildPlaceLimitOrderWithConditionals({
        ...order,
        orderPacket: { __kind: 'Limit', ...limitPacket },
        ...exits,
      }),
    ],
    cancel: [
      await client.ixs.buildCancelOrdersById({
        ...order,
        orders: [{ priceInTicks: String(limitPacket.priceInTicks), orderSequenceNumber: '1' }],
      }),
    ],
  };
  const budget = [
    getSetComputeUnitLimitInstruction({ units: 1_400_000 }),
    getSetComputeUnitPriceInstruction({ microLamports: 1_000n }),
  ];
  let recipient;
  do {
    recipient = address(getBase58Decoder().decode(crypto.getRandomValues(new Uint8Array(32))));
  } while (isOffCurveAddress(recipient));
  actions.withdrawToExternalWallet = await withdrawalInstructions({
    authority,
    recipient,
    amount: 1_000_000n,
    phoenixInstructions: actions.withdraw!,
    rpc: service.rpc,
  });
  const { value: lifetime } = await service.rpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const sizes = Object.fromEntries(
    Object.entries(actions).map(([name, ixs]) => [
      name,
      compileInstructions(authority, lifetime, [...budget, ...ixs]).bytes.length,
    ]),
  );
  // Synthetic Flight routing only: validates real SDK order shapes/size, not registration or fees.
  const syntheticBuilder = {
    authority: address(
      getBase58Decoder().decode(crypto.getRandomValues(new Uint8Array(32))),
    ) as Authority,
    collector: address(
      getBase58Decoder().decode(crypto.getRandomValues(new Uint8Array(32))),
    ) as TraderAddress,
    feeBps: 1n,
  };
  const flightSizes = Object.fromEntries(
    await Promise.all(
      Object.entries(actions).map(async ([name, ixs]) => [
        name,
        compileInstructions(authority, lifetime, [
          ...budget,
          ...(await routeBuilderOrders([...ixs], authority, syntheticBuilder)),
        ]).bytes.length,
      ]),
    ),
  );
  const phoenix = address(PHOENIX_PROGRAM_ID) as PhoenixProgramAddress;
  const flightGlobal = (await service.rpcAccount(await flight.getFlightGlobalStateAddress(phoenix)))
    .value;
  if (!flightGlobal || flightGlobal.owner !== flight.FLIGHT_PROGRAM_ADDRESS)
    throw new Error('Flight global state unavailable');
  const globalState = flight.decodeGlobalState(
    new Uint8Array(getBase64Encoder().encode(flightGlobal.data[0])),
  );
  if (globalState.programId !== phoenix) throw new Error('Unexpected Flight exchange');
  const permission = await client.api.invite().getReferralActivationPermission();
  const permissionRaw = (await service.rpcAccount(permission.permission_account)).value;
  if (!permissionRaw || permissionRaw.owner !== PHOENIX_PROGRAM_ID)
    throw new Error('Invalid referral permission owner');
  const decoded = decodePermission(
    new Uint8Array(getBase64Encoder().encode(permissionRaw.data[0])),
  );
  const expectedPermission = await client.pda.getPermissionAddress({
    permissionAuthority: decoded.permissionAuthority,
    delegatedKey: address(permission.trader_onboarder),
  });
  if (
    decoded.delegatedKey !== permission.trader_onboarder ||
    decoded.permissionAuthority !== permission.risk_authority ||
    expectedPermission !== permission.permission_account
  )
    throw new Error('Referral permission mismatch');
  const snapshot = await client.api.exchange().getSnapshot();
  const referral = await buildReferralActivationTransaction({
    traderAuthority: authority,
    referralCode: 'UNSIGNED_PROBE',
    permission,
    exchangeAccounts: await referralActivationExchangeAccountsFromSnapshot(snapshot.exchange),
    recentBlockhash: lifetime.blockhash,
    lastValidBlockHeight: BigInt(lifetime.lastValidBlockHeight),
    includeRegisterTrader: true,
    registerTraderMaxPositions: BigInt(NEW_TRADER_MAX_POSITIONS),
  });
  const referralIxs = [
    buildRegisterTraderIx({
      payer: authority,
      trader: authority,
      traderAccount: address(account.traderAddress) as TraderAddress,
      maxPositions: BigInt(NEW_TRADER_MAX_POSITIONS),
      ...common,
    }),
    await client.ixs.buildOnboardTraderDelegated({
      ...common,
      authority: address(permission.trader_onboarder) as Authority,
      traderAuthority: authority,
      permissionAccount: expectedPermission,
    }),
  ];
  if (
    !sameBytes(
      compileInstructions(authority, lifetime, referralIxs).bytes,
      referral.unsignedTransactionBytes,
    )
  )
    throw new Error('Referral instructions differ from official SDK activation builder');
  let setupSimulation = '';
  try {
    await service.prepare(authority, { kind: 'setup' });
    setupSimulation =
      'Unexpected success for an unfunded probe; investigate before funded testing.';
    process.exitCode = 1;
  } catch (error) {
    setupSimulation = error instanceof Error ? error.message : String(error);
    if (
      !setupSimulation.includes('Simulation failed') ||
      !setupSimulation.includes('AccountNotFound')
    )
      process.exitCode = 1;
  }
  let referralSimulation = '';
  try {
    await service.prepare(authority, { kind: 'setup', referralCode: 'UNSIGNED_PROBE' });
    referralSimulation = 'Unexpected success for an unfunded probe';
    process.exitCode = 1;
  } catch (error) {
    referralSimulation = error instanceof Error ? error.message : String(error);
    if (
      !referralSimulation.includes('Simulation failed') ||
      !referralSimulation.includes('AccountNotFound')
    )
      process.exitCode = 1;
  }
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        publicData: true,
        orderbookSlot: book.slot,
        chainSlot,
        randomUnfundedAuthority: true,
        signed: false,
        submitted: false,
        marginMarketCount: Object.keys(account.params.paramsBySymbol).length,
        walletSol: String(account.walletSol),
        unsignedTransactionBytes: sizes,
        setupSimulation,
        monetization: {
          syntheticBuilder: true,
          flightUnsignedTransactionBytes: flightSizes,
          flightGlobalVerified: true,
          flightMaxFeeCapBps: String(globalState.maxFeeCapBps),
          referralPermissionVerified: true,
          referralMatchesOfficialSdk: true,
          referralUnsignedBytes: compileInstructions(authority, lifetime, [
            ...budget,
            ...referralIxs,
          ]).bytes.length,
          referralSimulation,
          authenticated: false,
          referralActivated: false,
          builderRegistered: false,
          feesCollected: false,
        },
      },
      null,
      2,
    ),
  );
} finally {
  service.dispose();
}
