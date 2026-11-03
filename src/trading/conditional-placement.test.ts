import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Side } from '@ellipsis-labs/rise';
import { address } from '@solana/kit';
import { TradingService } from './service';
import type { OrderRequest, TradingAccount } from './types';

const mocks = vi.hoisted(() => ({
  buildCreate: vi.fn(),
  buildMarket: vi.fn(),
  buildLimitAttached: vi.fn(),
  buildPositionExits: vi.fn(),
  prepare: vi.fn(),
  conditionalAccountExists: false,
}));
const owner = '11111111111111111111111111111112';
vi.mock('@ellipsis-labs/rise', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ellipsis-labs/rise')>()),
  computeDraftOrderMarginRequirementFromInputs: () => ({ marginRequirementQuoteLots: '100000' }),
  createPhoenixClient: () => ({
    exchange: {
      market: () => ({
        symbol: 'ETH',
        marketStatus: 'active',
        isolatedOnly: false,
        baseLotsDecimals: 3,
        tickSize: '100',
        makerFee: 0.00005,
        takerFee: 0.00035,
      }),
    },
    api: {
      orderbook: () => ({
        getOrderbook: async () => ({
          symbol: 'ETH',
          slot: 100,
          bids: [[2350, 1]],
          asks: [[2351, 1]],
        }),
      }),
    },
    pda: {
      getTraderAddress: async () => 'trader',
      getConditionalOrdersAddress: async () => 'conditionals',
    },
    ixs: {
      buildCreateConditionalOrdersAccount: mocks.buildCreate,
      buildPlaceMarketOrder: mocks.buildMarket,
      buildPlaceLimitOrderWithConditionals: mocks.buildLimitAttached,
      buildPlacePositionConditionalOrder: mocks.buildPositionExits,
    },
    dispose() {},
  }),
}));
vi.mock('./chain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./chain')>()),
  createRpcCall: () => async (method: string) => {
    if (method === 'getSlot') return 100;
    if (method === 'getAccountInfo') return { value: mocks.conditionalAccountExists ? {} : null };
    throw new Error(`Unexpected test RPC: ${method}`);
  },
  prepareTransaction: mocks.prepare,
}));
const instruction = (id: number) => ({
  programAddress: address(owner),
  data: new Uint8Array([id]),
  accounts: [],
});
let service: TradingService;
beforeEach(() => {
  mocks.conditionalAccountExists = false;
  mocks.buildCreate.mockResolvedValue(instruction(1));
  mocks.buildMarket.mockResolvedValue(instruction(2));
  mocks.buildPositionExits.mockResolvedValue(instruction(3));
  mocks.buildLimitAttached.mockResolvedValue(instruction(4));
  mocks.prepare.mockResolvedValue({
    authority: owner,
    bytes: new Uint8Array(),
    feeLamports: 5000,
    rentLamports: 0,
    preparedAt: 1,
  });
  vi.spyOn(TradingService.prototype, 'refreshExchange').mockResolvedValue({
    exchange: { active: true },
  } as never);
  vi.spyOn(TradingService.prototype, 'readAccount').mockResolvedValue({
    authority: owner,
    registered: true,
    inputs: {},
    freeMargin: 2_000_000n,
    subaccount: {
      positions: [],
      capabilities: {
        capabilities: {
          placeMarketOrder: { immediate: true },
          placeLimitOrder: { immediate: true },
          riskIncreasingTrade: { immediate: true },
        },
      },
    },
    params: {
      paramsBySymbol: { ETH: { tickSize: '100', baseLotDecimals: 3 } },
      spotCollaterals: [],
    },
  } as unknown as TradingAccount);
  service = new TradingService('https://example.invalid', 'https://example.invalid');
});
afterEach(() => {
  service.dispose();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const order = (side: 'long' | 'short'): OrderRequest => ({
  kind: 'order',
  symbol: 'ETH',
  orderType: 'market',
  side,
  baseUnits: '0.001',
  reduceOnly: false,
  takeProfit: side === 'long' ? '2400' : '2300',
  stopLoss: side === 'long' ? '2300' : '2400',
});

it.each(['long', 'short'] as const)(
  'opens %s with exact-size TP/SL after the market fill in one transaction',
  async (side) => {
    await service.prepare(owner, order(side));
    expect(mocks.buildLimitAttached).not.toHaveBeenCalled();
    expect(mocks.buildMarket).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        authority: owner,
        symbol: 'ETH',
        traderPdaIndex: 0,
        traderSubaccountIndex: 0,
        orderPacket: expect.objectContaining({
          side: side === 'long' ? Side.Bid : Side.Ask,
          numBaseLots: 1n,
          minBaseLotsToFill: 1n,
        }),
      }),
    );
    expect(mocks.buildPositionExits).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        authority: owner,
        symbol: 'ETH',
        sizeBaseLots: 1n,
        greaterTriggerOrder: expect.objectContaining({
          tradeSide: side === 'long' ? Side.Ask : Side.Bid,
        }),
        lessTriggerOrder: expect.objectContaining({
          tradeSide: side === 'long' ? Side.Ask : Side.Bid,
        }),
      }),
    );
    expect(mocks.buildPositionExits.mock.calls[0]![0].sizePercent).toBeUndefined();
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(
      expect.any(Function),
      owner,
      [instruction(1), instruction(2), instruction(3)],
      false,
    );
  },
);
it('keeps resting limits on the limit-with-conditionals instruction', async () => {
  await service.prepare(owner, { ...order('long'), orderType: 'limit', limitPrice: '2340' });
  expect(mocks.buildLimitAttached).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ orderPacket: expect.objectContaining({ __kind: 'Limit' }) }),
  );
  expect(mocks.buildMarket).not.toHaveBeenCalled();
  expect(mocks.buildPositionExits).not.toHaveBeenCalled();
  expect(mocks.prepare.mock.calls[0]![2]).toEqual([instruction(1), instruction(4)]);
});
it('refuses the entire market-and-exits review when its combined simulation fails', async () => {
  mocks.prepare.mockRejectedValueOnce(new Error('Simulation failed. Exit rejected.'));
  await expect(service.prepare(owner, order('long'))).rejects.toThrow('Exit rejected');
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(
    expect.any(Function),
    owner,
    [instruction(1), instruction(2), instruction(3)],
    false,
  );
  expect(mocks.buildMarket).toHaveBeenCalledTimes(1);
  expect(mocks.buildPositionExits).toHaveBeenCalledTimes(1);
});
it.each(['takeProfit', 'stopLoss'] as const)(
  'supports only %s and reuses an existing conditional account',
  async (leg) => {
    mocks.conditionalAccountExists = true;
    const request = order('long');
    delete request[leg === 'takeProfit' ? 'stopLoss' : 'takeProfit'];
    await service.prepare(owner, request);
    expect(mocks.buildCreate).not.toHaveBeenCalled();
    const exits = mocks.buildPositionExits.mock.calls[0]?.[0];
    expect(exits).toBeDefined();
    expect(exits[leg === 'takeProfit' ? 'lessTriggerOrder' : 'greaterTriggerOrder']).toBeNull();
    expect(mocks.prepare.mock.calls[0]![2]).toEqual([instruction(2), instruction(3)]);
  },
);
