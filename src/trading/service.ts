import {
  createPhoenixClient,
  createMarginCalculator,
  computeSubaccountLiquidationPricesFromMargin,
  priceUsdToTicks,
  spotCollateralParamsFromAssets,
  buildSubaccountMarginInputsFromSnapshot,
  computeDraftOrderMarginRequirementFromInputs,
  computeMaxDraftOrderSizeForAvailableMarginFromInputs,
  buildLimitOrderPacketFromMarketParams,
  buildTakeProfitStopLossTriggerOrders,
  buildCancelConditionalOrderIx,
  buildRegisterTraderIx,
  fetchConditionalOrderCollection,
  decodePermission,
  OrderFlags,
  Side,
  baseLots,
  symbol as phoenixSymbol,
  ticks,
  type Authority,
  type MarketAddress,
  type MarginMarketParamsSnapshot,
  type BuildRegisterIxsResponse,
} from '@ellipsis-labs/rise';
import { address, getBase64Encoder, type Instruction } from '@solana/kit';
import { PHOENIX_PROGRAM_ID } from '../phoenix/client';
import { prepareMarketOrder } from '../phoenix/orders';
import { quoteFromBook } from '../phoenix/data';
import { createRpcCall, prepareTransaction, sameBytes, toBase64, type RpcAccount } from './chain';
import {
  assertCloseSize,
  assertSourceSlotFresh,
  Exact,
  fromLots,
  toLots,
  toTicks,
  validateExits,
} from './math';
import {
  readBuilderRoute,
  referralCode,
  routeBuilderOrders,
  type BuilderSettings,
} from './monetization';
import type { Action, OrderRequest, ReviewPlan, TradingAccount, WalletBalances } from './types';
import { readWalletBalances } from './wallet-balances';
import { prepareWalletTransfer } from './wallet-transfers';
import { ReferralAuth } from './referral-auth';
import { USDC_MINT } from './tokens';
import { withdrawalInstructions, withdrawalRecipient } from './withdrawal';

const INDEX = { traderPdaIndex: 0, traderSubaccountIndex: 0 };
// Phoenix supports 32–128 position slots. Start new MVP accounts at the minimum
// so users do not fund rent for 128 simultaneous positions. Existing accounts
// are never resized by this setting.
export const NEW_TRADER_MAX_POSITIONS = 32;
export function assertSameInstructions(
  actual: readonly Instruction[],
  expected: readonly Instruction[],
) {
  if (
    actual.length !== expected.length ||
    actual.some((ix, i) => {
      const other = expected[i]!;
      return (
        ix.programAddress !== other.programAddress ||
        !sameBytes(ix.data ?? new Uint8Array(), other.data ?? new Uint8Array()) ||
        ix.accounts?.length !== other.accounts?.length ||
        ix.accounts?.some(
          (a, j) =>
            a.address !== other.accounts?.[j]?.address || a.role !== other.accounts?.[j]?.role,
        )
      );
    })
  )
    throw new Error('Phoenix returned unexpected onboarding instructions. Nothing was signed.');
}
function registrationInstructions(response: BuildRegisterIxsResponse): Instruction[] {
  return response.instructions.map((ix) => ({
    programAddress: address(ix.programId),
    data: Uint8Array.from(ix.data),
    accounts: ix.keys.map((k) => ({
      address: address(k.pubkey),
      role: (k.isSigner ? 2 : 0) + (k.isWritable ? 1 : 0),
    })),
  }));
}
export function availableOrderSize(
  account: TradingAccount,
  request: Omit<OrderRequest, 'baseUnits'>,
  reference: string,
): string {
  const market = account.params.paramsBySymbol[request.symbol];
  if (!market || !account.inputs) return '0';
  const position = BigInt(
    account.subaccount?.positions.find((p) => p.symbol === request.symbol)?.basePositionLots ?? 0,
  );
  if (request.reduceOnly)
    return position !== 0n && (position > 0n ? request.side === 'short' : request.side === 'long')
      ? fromLots(position < 0n ? -position : position, market.baseLotDecimals)
      : '0';
  const priceTicks = toTicks(reference, market);
  // Reserve 5% of free margin for fees and price movement; final simulation is authoritative.
  const headroom = (account.freeMargin * 95n) / 100n;
  const upper = market.leverageTiers.at(-1)?.upperBoundSize;
  if (!upper) return '0';
  const lots = computeMaxDraftOrderSizeForAvailableMarginFromInputs({
    subaccount: account.inputs,
    markets: Object.values(account.params.paramsBySymbol),
    options: { spotCollateralParams: account.params.spotCollaterals },
    draftOrder: {
      symbol: request.symbol,
      side: request.side === 'long' ? 'bid' : 'ask',
      orderType: request.orderType,
      priceTicks,
    },
    maxSizeBaseLots: upper,
    availableMarginQuoteLots: headroom,
  });
  return fromLots(lots, market.baseLotDecimals);
}
/**
 * Phoenix-specific reads and transaction construction. Preparing an action is unsigned;
 * only TradingProvider's reviewed execution path may call broadcast with verified bytes.
 */
export class TradingService {
  readonly rpc;
  readonly client;
  readonly referralAuth;

  constructor(
    private readonly apiUrl: string,
    private readonly rpcUrl: string,
    private readonly builderSettings: BuilderSettings = {},
  ) {
    this.rpc = createRpcCall(rpcUrl);
    this.referralAuth = new ReferralAuth(apiUrl);
    this.client = createPhoenixClient({
      apiUrl,
      rpcUrl,
      auth: false,
      ws: false,
      timeout: 12_000,
      rateLimitRetry: false,
      exchangeMetadata: { stream: false, rpc: { enabled: false } },
    });
  }
  dispose() {
    this.referralAuth.clear();
    this.client.dispose();
  }
  async rpcAccount(pubkey: string) {
    return this.rpc<{ context: { slot: number }; value: RpcAccount | null }>('getAccountInfo', [
      pubkey,
      { encoding: 'base64', commitment: 'confirmed' },
    ]);
  }
  async refreshExchange() {
    const snapshot = await this.client.api.exchange().getSnapshot();
    if (
      snapshot.exchange.programId !== PHOENIX_PROGRAM_ID ||
      snapshot.exchange.usdcMint !== USDC_MINT
    )
      throw new Error('Unexpected Phoenix program or collateral mint.');

    return snapshot;
  }
  async readMarginParams(): Promise<MarginMarketParamsSnapshot> {
    const [snapshot, prices, collateral] = await Promise.all([
      this.refreshExchange(),
      this.client.api.markets().getLatestMarketsStats(),
      this.client.api.collateral().getAssets(),
    ]);
    const bySymbol = new Map(prices.markets.map((p) => [p.symbol, p]));
    const paramsBySymbol: MarginMarketParamsSnapshot['paramsBySymbol'] = {};
    const bps = (percent: number, explicit?: number) => {
      const value = explicit ?? percent * 100;
      if (!Number.isSafeInteger(value) || value < 0 || value > 10000)
        throw new Error('Invalid Phoenix risk factor.');
      return String(value);
    };
    for (const market of snapshot.markets) {
      const price = bySymbol.get(market.symbol);
      // Missing or old prices are omitted, never valued at zero. Margin math rejects missing held markets.
      if (
        !price ||
        price.mark_price <= 0 ||
        price.oracle_price <= 0 ||
        Math.abs(Date.now() - Number(price.timestamp_ms)) > 30_000
      )
        continue;
      const units = {
        baseLotsDecimals: market.baseLotsDecimals,
        tickSizeInQuoteLotsPerBaseLot: Number(market.tickSize),
      };
      if (!Number.isSafeInteger(units.tickSizeInQuoteLotsPerBaseLot))
        throw new Error('Unsupported tick precision.');
      const risk = market.riskFactors;
      paramsBySymbol[market.symbol] = {
        symbol: market.symbol,
        assetId: market.assetId,
        tickSize: String(market.tickSize),
        baseLotDecimals: market.baseLotsDecimals,
        markPriceTicks: priceUsdToTicks(price.mark_price, units),
        indexPriceTicks: priceUsdToTicks(price.oracle_price, units),
        isolatedOnly: market.isolatedOnly,
        leverageTiers: market.leverageTiers.map((t) => ({
          upperBoundSize: String(t.maxSizeBaseLots),
          maxLeverage: String(t.maxLeverage),
          limitOrderRiskFactorBps: bps(0, t.limitOrderRiskFactor),
        })),
        riskFactors: {
          maintenanceMarginFactorBps: bps(risk.maintenance, risk.maintenanceBps),
          backstopMarginFactorBps: bps(risk.backstop, risk.backstopBps),
          highRiskMarginFactorBps: bps(risk.highRisk, risk.highRiskBps),
        },
        cancelOrderRiskFactorBps: bps(risk.cancelOrder, risk.cancelOrderBps),
        upnlRiskFactor: bps(risk.upnl, risk.upnlBps),
        upnlRiskFactorForWithdrawals: bps(risk.upnlForWithdrawals, risk.upnlForWithdrawalsBps),
      };
    }
    return {
      paramsBySymbol,
      spotCollaterals: spotCollateralParamsFromAssets(
        collateral,
        new Map(snapshot.markets.map((m) => [m.assetId, m.symbol])),
      ),
      updatedAt: Date.now(),
      slot: Number(snapshot.slot),
    };
  }
  readWallet(owner: string) {
    return readWalletBalances(this.rpc, owner);
  }
  async readAccount(
    owner: string,
    walletRequest?: Promise<WalletBalances>,
  ): Promise<TradingAccount> {
    const authority = address(owner) as Authority;
    await this.client.exchange.ready();
    const traderAddress = await this.client.pda.getTraderAddress({
      authority,
      traderPdaIndex: 0,
      subaccountIndex: 0,
    });
    const [trader, balances, params] = await Promise.all([
      this.rpcAccount(traderAddress),
      walletRequest ?? this.readWallet(owner),
      this.readMarginParams(),
    ]);
    if (balances.authority !== owner) throw new Error('Wallet balance belongs to another account.');
    if (trader.value && trader.value.owner !== PHOENIX_PROGRAM_ID)
      throw new Error('Unexpected owner of the Phoenix trading account.');
    const base: TradingAccount = {
      authority: owner,
      traderAddress,
      registered: !!trader.value,
      walletUsdc: balances.walletUsdc,
      walletSol: balances.walletSol,
      params,
      freeMargin: 0n,
      receivedAt: Date.now(),
      slot: trader.context.slot,
      conditionals: [],
    };
    if (!trader.value) return base;
    const state = await this.client.api
      .traders()
      .getTraderStateSnapshot(owner, { traderPdaIndex: 0 });
    if (state.authority !== owner || state.traderPdaIndex !== 0)
      throw new Error('Phoenix returned another account.');
    const subaccount = state.snapshot.subaccounts.find((s) => s.subaccountIndex === 0);
    if (!subaccount) throw new Error('Phoenix account is still synchronizing. Retry shortly.');
    const inputs = buildSubaccountMarginInputsFromSnapshot(subaccount);
    const calculator = createMarginCalculator(
      Object.values(params.paramsBySymbol),
      params.spotCollaterals,
    );
    const margin = calculator.computeSubaccountMarginFromInputs(inputs);
    const liquidationPrices = computeSubaccountLiquidationPricesFromMargin(
      margin,
      calculator.markets,
      inputs,
    ).positions;
    const free =
      BigInt(margin.margin.effectiveCollateralQuoteLots) -
      BigInt(margin.margin.initialMarginQuoteLots);
    const conditionals = await this.readConditionals(owner);
    return {
      ...base,
      state,
      subaccount,
      inputs,
      margin,
      liquidationPrices,
      freeMargin: free > 0n ? free : 0n,
      conditionals,
      receivedAt: Date.now(),
      slot: state.slot,
    };
  }
  async readConditionals(owner: string) {
    const traderAccount = await this.client.pda.getTraderAddress({
      authority: address(owner) as Authority,
      traderPdaIndex: 0,
      subaccountIndex: 0,
    });
    const conditionalAddress = await this.client.pda.getConditionalOrdersAddress({ traderAccount });
    const raw = await this.rpcAccount(conditionalAddress);
    if (!raw.value) return [];
    if (raw.value.owner !== PHOENIX_PROGRAM_ID)
      throw new Error('Unexpected conditional account owner.');
    const collection = await fetchConditionalOrderCollection({
      address: conditionalAddress,
      skipCache: true,
      client: {
        fetchAccount: async () => ({ data: getBase64Encoder().encode(raw.value!.data[0]) }),
        _accountCache: new Map(),
        _cacheEnabled: false,
      },
    });
    if (collection.header.traderKey !== traderAccount)
      throw new Error('Conditional account belongs to another trader.');
    return collection.activeOrderIndices.map((index) => {
      const order = collection.orders[index]!;
      const market = this.client.exchange.marketByAssetId(order.assetId);
      if (!market) throw new Error('Unknown market on a conditional order.');
      const usd = (ticks: bigint) =>
        new Exact(String(ticks))
          .mul(String(market.tickSize))
          .mul(new Exact(10).pow(market.baseLotsDecimals))
          .div(1_000_000)
          .toFixed();
      const greater = order.greaterTriggerOrder,
        less = order.lessTriggerOrder;
      const tp = [greater, less].find((t) => t.isActive && t.orderKind === 1);
      const sl = [greater, less].find((t) => t.isActive && t.orderKind === 0);
      return {
        index,
        symbol: market.symbol,
        sequence: String(order.sequenceNumber),
        takeProfit: tp ? usd(tp.triggerPrice) : undefined,
        stopLoss: sl ? usd(sl.triggerPrice) : undefined,
        takeProfitDirection: tp
          ? tp === greater
            ? ('greater' as const)
            : ('less' as const)
          : undefined,
        stopLossDirection: sl
          ? sl === greater
            ? ('greater' as const)
            : ('less' as const)
          : undefined,
      };
    });
  }
  async prepare(owner: string, action: Action): Promise<ReviewPlan> {
    // Builders resolve metadata once. A fresh client prevents stale account layouts or market rules.
    const freshService = new TradingService(this.apiUrl, this.rpcUrl, this.builderSettings);
    try {
      return await freshService.prepareFresh(owner, action);
    } finally {
      freshService.dispose();
    }
  }
  private async prepareFresh(owner: string, requestedAction: Action): Promise<ReviewPlan> {
    // Wallet funds are independent of Phoenix registration, collateral and venue availability.
    if (requestedAction.kind === 'send')
      return prepareWalletTransfer(this.rpc, owner, requestedAction);
    const action: Action =
      requestedAction.kind === 'setup'
        ? {
            ...requestedAction,
            referralCode: referralCode(requestedAction.referralCode ?? '') || undefined,
          }
        : requestedAction.kind === 'withdraw'
          ? {
              ...requestedAction,
              recipient: withdrawalRecipient(requestedAction.recipient ?? owner),
            }
          : requestedAction;
    const authority = address(owner) as Authority;
    const exchange = await this.refreshExchange();
    const account = await this.readAccount(owner);
    const common = { authority, ...INDEX };
    let instructions: Instruction[] = [];
    let title = '';
    let extraSigner: string | undefined;
    const details: [string, string][] = [];
    if (action.kind === 'setup') {
      const code = referralCode(action.referralCode ?? '');
      const capabilities = account.subaccount?.capabilities ?? account.state?.snapshot.capabilities;
      if (capabilities && capabilities.state !== 'uninitialized')
        throw new Error('Your Phoenix account is already set up.');
      if (code) {
        const permission = await this.client.api.invite().getReferralActivationPermission();
        const raw = (await this.rpcAccount(permission.permission_account)).value;
        if (!raw || raw.owner !== PHOENIX_PROGRAM_ID)
          throw new Error('Invalid Phoenix referral permission account.');
        const decoded = decodePermission(new Uint8Array(getBase64Encoder().encode(raw.data[0])));
        const expectedPermission = await this.client.pda.getPermissionAddress({
          permissionAuthority: decoded.permissionAuthority,
          delegatedKey: address(permission.trader_onboarder),
        });
        if (
          decoded.delegatedKey !== permission.trader_onboarder ||
          decoded.permissionAuthority !== permission.risk_authority ||
          expectedPermission !== permission.permission_account
        )
          throw new Error('Phoenix referral permission does not match its authority.');
        if (!account.registered)
          instructions.push(
            buildRegisterTraderIx({
              payer: authority,
              trader: authority,
              traderAccount: address(account.traderAddress) as Awaited<
                ReturnType<typeof this.client.pda.getTraderAddress>
              >,
              maxPositions: BigInt(NEW_TRADER_MAX_POSITIONS),
              ...INDEX,
            }),
          );
        instructions.push(
          await this.client.ixs.buildOnboardTraderDelegated({
            authority: address(permission.trader_onboarder) as Authority,
            traderAuthority: authority,
            permissionAccount: expectedPermission,
            ...INDEX,
          }),
        );
        extraSigner = permission.trader_onboarder;
        details.push(
          ['Referral code', code],
          ['Referral relationship', 'Permanent once accepted by Phoenix'],
        );
      } else {
        const built = await this.client.api.exchange().buildRegisterIxs({
          traderAuthority: owner,
          txFeePayer: owner,
          maxPositions: NEW_TRADER_MAX_POSITIONS,
        });
        if (
          built.traderPda !== account.traderAddress ||
          built.txFeePayer !== owner ||
          built.maxPositions !== NEW_TRADER_MAX_POSITIONS ||
          built.includeRegisterTrader === account.registered
        )
          throw new Error('Unexpected onboarding account configuration.');
        const expected: Instruction[] = [];
        if (built.includeRegisterTrader)
          expected.push(
            buildRegisterTraderIx({
              payer: authority,
              trader: authority,
              traderAccount: address(account.traderAddress) as Awaited<
                ReturnType<typeof this.client.pda.getTraderAddress>
              >,
              maxPositions: BigInt(NEW_TRADER_MAX_POSITIONS),
              ...INDEX,
            }),
          );
        const permissionAddress = built.instructions.at(-1)?.keys[4]?.pubkey;
        if (!permissionAddress) throw new Error('Missing Phoenix onboarding permission.');
        const permissionRaw = (await this.rpcAccount(permissionAddress)).value;
        if (!permissionRaw || permissionRaw.owner !== PHOENIX_PROGRAM_ID)
          throw new Error('Invalid Phoenix onboarding permission account.');
        const permissionData = decodePermission(
          new Uint8Array(getBase64Encoder().encode(permissionRaw.data[0])),
        );
        const permission = await this.client.pda.getPermissionAddress({
          permissionAuthority: permissionData.permissionAuthority,
          delegatedKey: address(built.traderOnboarder),
        });
        if (
          permissionData.delegatedKey !== built.traderOnboarder ||
          permission !== permissionAddress
        )
          throw new Error('Phoenix onboarding permission does not match its signer.');
        expected.push(
          await this.client.ixs.buildOnboardTraderDelegated({
            authority: address(built.traderOnboarder) as Authority,
            traderAuthority: authority,
            permissionAccount: permission,
            ...INDEX,
          }),
        );
        instructions = registrationInstructions(built);
        assertSameInstructions(instructions, expected);
        extraSigner = built.traderOnboarder;
      }
      title = 'Set up Phoenix account';
      details.push(
        ['Margin', 'Cross · account 0'],
        ['Account capacity', `${NEW_TRADER_MAX_POSITIONS} positions`],
        ['Onboarding', 'Phoenix co-signs account activation'],
      );
    } else {
      if (!account.registered || !account.subaccount || !account.inputs)
        throw new Error('Set up your Phoenix account first.');
      const caps = (account.subaccount.capabilities ?? account.state?.snapshot.capabilities)
        ?.capabilities;
      const requireCapability = (key: keyof NonNullable<typeof caps>) => {
        const access = caps?.[key];
        if (!access || (!access.immediate && !access.viaColdActivation))
          throw new Error(`Phoenix has not enabled ${key} for this account.`);
      };
      if (action.kind === 'deposit' || action.kind === 'withdraw') {
        const amount = toLots(action.amount, 6, 'USDC amount');
        if (action.kind === 'deposit') {
          requireCapability('depositCollateral');
          if (amount > account.walletUsdc) throw new Error('Not enough USDC in your wallet.');
          instructions = [
            ...(await this.client.ixs.buildDepositIxs({ ...common, amount })).instructions,
          ];
        } else {
          requireCapability('withdrawCollateral');
          if (!exchange.exchange.withdrawalsAvailable)
            throw new Error('Phoenix withdrawals are temporarily unavailable.');
          const cooldown = account.subaccount.cooldownStatus;
          if (
            cooldown &&
            (await this.rpc<number>('getSlot', [{ commitment: 'confirmed' }])) <
              cooldown.lastDepositSlot + cooldown.cooldownPeriodInSlots
          )
            throw new Error(
              'The deposit cooldown is still active. Please wait before withdrawing.',
            );
          if (amount > BigInt(account.margin!.margin.withdrawableQuoteCollateralQuoteLots))
            throw new Error('Amount exceeds withdrawable collateral.');
          instructions = await withdrawalInstructions({
            authority: owner,
            recipient: action.recipient!,
            amount,
            phoenixInstructions: (await this.client.ixs.buildWithdrawIxs({ ...common, amount }))
              .instructions,
            rpc: this.rpc,
          });
        }
        title = action.kind === 'deposit' ? 'Deposit to Phoenix' : 'Withdraw to wallet';
        details.push(
          ['Amount', `${action.amount} USDC`],
          ['From', action.kind === 'deposit' ? 'Your Solana wallet' : 'Phoenix cross collateral'],
          ['To', action.kind === 'deposit' ? 'Phoenix cross collateral' : action.recipient!],
        );
        if (action.kind === 'withdraw')
          details.push(['Recipient receives', `${fromLots(amount, 6)} USDC on Solana`]);
      } else if (action.kind === 'cancel') {
        const row = account.subaccount.orders
          .find((g) => g.symbol === action.symbol)
          ?.orders.find(
            (o) =>
              o.orderSequenceNumber === action.sequence &&
              o.priceTicks === action.priceTicks &&
              BigInt(o.sizeRemainingLots) > 0n,
          );
        if (!row) throw new Error('This order is no longer open. Refresh the account.');
        instructions = [
          await this.client.ixs.buildCancelOrdersById({
            ...common,
            symbol: phoenixSymbol(action.symbol),
            orders: [{ priceInTicks: action.priceTicks, orderSequenceNumber: action.sequence }],
          }),
        ];
        title = `Cancel ${action.symbol} order`;
        details.push(['Order', action.sequence], ['Price', `${row.priceUsd} USD`]);
      } else if (action.kind === 'cancelConditional') {
        const conditional = account.conditionals.find(
          (c) =>
            c.index === action.index &&
            c.sequence === action.sequence &&
            c.symbol === action.symbol,
        );
        const trigger = action.leg === 'TP' ? conditional?.takeProfit : conditional?.stopLoss;
        const direction =
          action.leg === 'TP' ? conditional?.takeProfitDirection : conditional?.stopLossDirection;
        if (!conditional || !trigger || !direction || !['TP', 'SL'].includes(action.leg))
          throw new Error('This TP/SL order has changed. Refresh the account.');
        const traderAccount = await this.client.pda.getTraderAddress({
          authority,
          traderPdaIndex: 0,
          subaccountIndex: 0,
        });
        instructions = [
          buildCancelConditionalOrderIx({
            traderAccount,
            traderWallet: authority,
            traderConditionalOrders: await this.client.pda.getConditionalOrdersAddress({
              traderAccount,
            }),
            orderbook: address(
              this.client.exchange.market(action.symbol)!.marketPubkey,
            ) as MarketAddress,
            conditionalOrderIndex: action.index,
            // The first trigger is the greater-price slot, not always TP:
            // on a short position TP is the second (less-price) slot.
            disableFirst: direction === 'greater',
            disableSecond: direction === 'less',
          }),
        ];
        title = `Cancel ${action.symbol} ${action.leg === 'TP' ? 'take profit' : 'stop loss'}`;
        details.push(['Trigger price', `${trigger} USD`]);
        if (action.leg === 'TP' ? conditional.stopLoss : conditional.takeProfit)
          details.push([
            'Other exit',
            `${action.leg === 'TP' ? 'Stop loss' : 'Take profit'} stays active`,
          ]);
      } else {
        if (!exchange.exchange.active) throw new Error('Phoenix trading is currently paused.');
        const market = this.client.exchange.market(action.symbol);
        const params = account.params.paramsBySymbol[action.symbol];
        if (!market || !params || market.isolatedOnly || market.marketStatus !== 'active')
          throw new Error('This market is unavailable for cross-margin trading.');
        requireCapability(action.orderType === 'market' ? 'placeMarketOrder' : 'placeLimitOrder');
        requireCapability(action.reduceOnly ? 'riskReducingTrade' : 'riskIncreasingTrade');
        const lots = toLots(action.baseUnits, market.baseLotsDecimals, 'order size');
        const position = BigInt(
          account.subaccount.positions.find((p) => p.symbol === action.symbol)?.basePositionLots ??
            0,
        );
        if (action.reduceOnly) assertCloseSize(position, action.side, lots);
        const [book, chainSlot] = await Promise.all([
          this.client.api.orderbook().getOrderbook(action.symbol),
          this.rpc<number>('getSlot', [{ commitment: 'confirmed' }]),
        ]);
        assertSourceSlotFresh(book.slot, chainSlot);
        const quote = quoteFromBook(book, Date.now());
        const reference =
          action.orderType === 'limit'
            ? (action.limitPrice ?? '')
            : action.side === 'long'
              ? quote.ask
              : quote.bid;
        const side = action.side === 'long' ? Side.Bid : Side.Ask;
        const marketRules = {
          symbol: market.symbol,
          status: market.marketStatus,
          tickSize: market.tickSize,
          baseLotsDecimals: market.baseLotsDecimals,
        };
        if (action.orderType === 'limit') toTicks(reference, params);
        const packet =
          action.orderType === 'market'
            ? prepareMarketOrder(
                {
                  symbol: action.symbol,
                  side: action.side,
                  baseUnits: action.baseUnits,
                  slippageBps: 50,
                  reduceOnly: action.reduceOnly,
                },
                marketRules,
                quote,
                Date.now(),
              ).packet
            : buildLimitOrderPacketFromMarketParams(
                {
                  side,
                  priceUsd: reference,
                  baseUnits: action.baseUnits,
                  orderFlags: action.reduceOnly ? OrderFlags.ReduceOnly : OrderFlags.None,
                },
                marketRules,
              );
        const priceTicks = packet.priceInTicks!;
        const builder = await readBuilderRoute(this.rpc, this.builderSettings);
        const builderFeeReserve = builder
          ? BigInt(
              new Exact(String(priceTicks))
                .mul(String(market.tickSize))
                .mul(String(lots))
                .mul(String(builder.feeBps))
                .div(10_000)
                .ceil()
                .toFixed(0),
            )
          : 0n;
        const requirement = computeDraftOrderMarginRequirementFromInputs({
          subaccount: account.inputs,
          markets: Object.values(account.params.paramsBySymbol),
          options: { spotCollateralParams: account.params.spotCollaterals },
          draftOrder: {
            symbol: action.symbol,
            side,
            orderType: action.orderType,
            priceTicks,
            sizeBaseLots: lots,
            reduceOnly: action.reduceOnly,
          },
        });
        if (BigInt(requirement.marginRequirementQuoteLots) > account.freeMargin)
          throw new Error('Not enough free margin for this size.');
        if (
          !action.reduceOnly &&
          BigInt(requirement.marginRequirementQuoteLots) + builderFeeReserve > account.freeMargin
        )
          throw new Error('Not enough free margin for this size including the builder fee.');
        if (action.takeProfit || action.stopLoss) {
          if (action.reduceOnly) throw new Error('Attached TP/SL is for opening orders.');
          // Phoenix nets positions. Avoid attaching a new exit to an offsetting order.
          if (position !== 0n && (position > 0n ? action.side === 'short' : action.side === 'long'))
            throw new Error('Close the opposite position before opening with TP/SL.');
          validateExits(action.side, reference, action.takeProfit, action.stopLoss);
          const exits = buildTakeProfitStopLossTriggerOrders({
            primarySide: side,
            takeProfitPrice: action.takeProfit
              ? ticks(toTicks(action.takeProfit, params))
              : undefined,
            stopLossPrice: action.stopLoss ? ticks(toTicks(action.stopLoss, params)) : undefined,
            slippageBps: 50,
          });
          const traderAccount = await this.client.pda.getTraderAddress({
            authority,
            traderPdaIndex: 0,
            subaccountIndex: 0,
          });
          if (
            !(
              await this.rpcAccount(
                await this.client.pda.getConditionalOrdersAddress({ traderAccount }),
              )
            ).value
          )
            instructions.push(
              await this.client.ixs.buildCreateConditionalOrdersAccount({
                ...common,
                capacity: 32,
              }),
            );
          if (action.orderType === 'market') {
            // Phoenix's limit-with-conditionals instruction rejects IOC packets.
            // Fill the exact requested size first, then add exits for that size in
            // the same transaction. A failure in either step rolls back both.
            instructions.push(
              await this.client.ixs.buildPlaceMarketOrder({
                ...common,
                symbol: phoenixSymbol(action.symbol),
                orderPacket: packet as ReturnType<typeof prepareMarketOrder>['packet'],
              }),
              await this.client.ixs.buildPlacePositionConditionalOrder({
                ...common,
                symbol: phoenixSymbol(action.symbol),
                sizeBaseLots: baseLots(lots),
                ...exits,
              }),
            );
          } else
            instructions.push(
              await this.client.ixs.buildPlaceLimitOrderWithConditionals({
                ...common,
                symbol: phoenixSymbol(action.symbol),
                orderPacket: {
                  __kind: 'Limit',
                  ...(packet as ReturnType<typeof buildLimitOrderPacketFromMarketParams>),
                },
                ...exits,
              }),
            );
        } else
          instructions.push(
            action.orderType === 'market'
              ? await this.client.ixs.buildPlaceMarketOrder({
                  ...common,
                  symbol: phoenixSymbol(action.symbol),
                  orderPacket: packet as ReturnType<typeof prepareMarketOrder>['packet'],
                })
              : await this.client.ixs.buildPlaceLimitOrder({
                  ...common,
                  symbol: phoenixSymbol(action.symbol),
                  orderPacket: packet as ReturnType<typeof buildLimitOrderPacketFromMarketParams>,
                }),
          );
        if (builder) {
          // The signed order and its review must use the same verified fee rate.
          instructions = await routeBuilderOrders(instructions, owner, builder);
          if (builder.feeBps === 0n) details.push(['App builder fee', '0% (0 bps)']);
          else
            details.push(
              [
                'App builder fee',
                `${new Exact(String(builder.feeBps)).div(100).toFixed()}% (${builder.feeBps} bps) · taking fills only`,
              ],
              [
                'Builder fee at price limit',
                `${fromLots(builderFeeReserve, 6)} USDC if fully filled as taker`,
              ],
              ['Builder fee recipient', builder.collector],
            );
        } else details.push(['App builder fee', 'None']);
        title = `${action.reduceOnly ? 'Close' : 'Open'} ${action.reduceOnly ? (action.side === 'short' ? 'long' : 'short') : action.side} · ${action.symbol}`;
        details.push(
          [
            'Order',
            `${action.orderType === 'market' ? 'Market · full fill or cancel' : 'Limit · good until cancelled'}`,
          ],
          ['Size', `${action.baseUnits} ${action.symbol}`],
          [
            'Price',
            action.orderType === 'market'
              ? `${new Exact(String(priceTicks)).mul(String(market.tickSize)).mul(new Exact(10).pow(market.baseLotsDecimals)).div(1_000_000).toFixed()} USD ${action.side === 'long' ? 'maximum' : 'minimum'}`
              : `${reference} USD`,
          ],
          ['Margin', `${fromLots(requirement.marginRequirementQuoteLots, 6)} USDC estimated`],
          ['Mode', action.reduceOnly ? 'Cross · reduce only' : 'Cross'],
        );
        details.push([
          'Base trading fees',
          `${new Exact(market.makerFee).mul(100).toFixed()}% maker / ${new Exact(market.takerFee).mul(100).toFixed()}% taker`,
        ]);
        if (action.takeProfit)
          details.push(['Take profit', `${action.takeProfit} USD · limit exit`]);
        if (action.stopLoss)
          details.push(['Stop loss', `${action.stopLoss} USD · 0.5% price limit`]);
      }
    }
    const prepared = await prepareTransaction(
      this.rpc,
      owner,
      instructions,
      action.kind === 'setup',
    );
    return { ...prepared, action, title, details, extraSigner };
  }
  async broadcast(plan: ReviewPlan, signed: { bytes: Uint8Array; signature: string }) {
    if (plan.action.kind === 'setup') {
      if (plan.action.referralCode) {
        const result = await this.referralAuth
          .clientFor(plan.authority)
          .api.invite()
          .activateReferralTx({
            referral_code: plan.action.referralCode,
            trader_authority: plan.authority,
            trader_pda_index: 0,
            trader_subaccount_index: 0,
            recent_blockhash: plan.lifetime.blockhash,
            transaction: toBase64(signed.bytes),
          });
        const trader = await this.client.pda.getTraderAddress({
          authority: address(plan.authority) as Authority,
          traderPdaIndex: 0,
          subaccountIndex: 0,
        });
        if (
          result.signature !== signed.signature ||
          result.trader_pda !== trader ||
          result.referral_code !== plan.action.referralCode ||
          result.status === 'already_activated'
        )
          throw new Error(
            'Referral activation was not confirmed for this transaction. Check its original signature and Phoenix account.',
          );
        return;
      }
      const result = await this.client.api.exchange().sendRegisterIxs({
        transaction: toBase64(signed.bytes),
        traderAuthority: plan.authority,
        txFeePayer: plan.authority,
        maxPositions: NEW_TRADER_MAX_POSITIONS,
        ...INDEX,
      });
      if (result.signature !== signed.signature)
        throw new Error(
          'Phoenix returned a different transaction ID. Check the original transaction.',
        );
    } else {
      const result = await this.rpc<string>('sendTransaction', [
        toBase64(signed.bytes),
        {
          encoding: 'base64',
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 2,
        },
      ]);
      if (result !== signed.signature) throw new Error('RPC returned a different transaction ID.');
    }
  }
}
