import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getCancelConditionalOrderDecoder } from '@ellipsis-labs/rise';
import { TradingService } from './service';
import type { TradingAccount } from './types';
import { PHOENIX_PROGRAM_ID } from '../phoenix/client';

const mocks = vi.hoisted(() => ({ collection: vi.fn(), prepare: vi.fn() }));
const owner = '11111111111111111111111111111112';
vi.mock('@ellipsis-labs/rise', async (original) => ({
  ...(await original<typeof import('@ellipsis-labs/rise')>()),
  fetchConditionalOrderCollection: mocks.collection,
  createPhoenixClient: () => ({
    exchange: {
      marketByAssetId: () => ({ symbol: 'ETH', tickSize: '100', baseLotsDecimals: 3 }),
      market: () => ({ marketPubkey: owner }),
    },
    pda: {
      getTraderAddress: async () => owner,
      getConditionalOrdersAddress: async () => owner,
    },
    dispose() {},
  }),
}));
vi.mock('./chain', async (original) => ({
  ...(await original<typeof import('./chain')>()),
  createRpcCall: () => vi.fn(),
  prepareTransaction: mocks.prepare,
}));
let service: TradingService;
beforeEach(() => {
  service = new TradingService('https://example.invalid', 'https://example.invalid');
  mocks.prepare.mockResolvedValue({ authority: owner, bytes: new Uint8Array() });
  vi.spyOn(TradingService.prototype, 'refreshExchange').mockResolvedValue({
    exchange: {},
  } as never);
  vi.spyOn(TradingService.prototype, 'rpcAccount').mockResolvedValue({
    context: { slot: 100 },
    value: { owner: PHOENIX_PROGRAM_ID, lamports: 1, data: ['', 'base64'] },
  });
});
afterEach(() => {
  service.dispose();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function load(long: boolean, activeTP = true) {
  const tp = { isActive: activeTP, orderKind: 1, triggerPrice: long ? 24000n : 22000n };
  const sl = { isActive: true, orderKind: 0, triggerPrice: long ? 22000n : 24000n };
  mocks.collection.mockResolvedValue({
    header: { traderKey: owner },
    activeOrderIndices: [3],
    orders: [
      null,
      null,
      null,
      {
        assetId: 3,
        sequenceNumber: 9n,
        greaterTriggerOrder: long ? tp : sl,
        lessTriggerOrder: long ? sl : tp,
      },
    ],
  });
  const conditionals = await service.readConditionals(owner);
  vi.spyOn(TradingService.prototype, 'readAccount').mockResolvedValue({
    authority: owner,
    registered: true,
    subaccount: {},
    inputs: {},
    conditionals,
  } as TradingAccount);
  return conditionals;
}

it.each([
  [true, 'TP', true, false],
  [true, 'SL', false, true],
  [false, 'TP', false, true],
  [false, 'SL', true, false],
] as const)(
  'cancels only %s / %s using its decoded trigger slot',
  async (long, leg, first, second) => {
    await load(long);
    const plan = await service.prepare(owner, {
      kind: 'cancelConditional',
      symbol: 'ETH',
      index: 3,
      sequence: '9',
      leg,
    });
    const ix = mocks.prepare.mock.calls[0]![2][0];
    expect(getCancelConditionalOrderDecoder().decode(ix.data)).toEqual({
      conditionalOrderIndex: 3,
      disableFirst: first,
      disableSecond: second,
    });
    expect(plan.title).toBe(`Cancel ETH ${leg === 'TP' ? 'take profit' : 'stop loss'}`);
    expect(plan.details).toContainEqual([
      'Other exit',
      `${leg === 'TP' ? 'Stop loss' : 'Take profit'} stays active`,
    ]);
  },
);
it('does not cancel the sibling when the requested leg has already gone', async () => {
  await load(true, false);
  await expect(
    service.prepare(owner, {
      kind: 'cancelConditional',
      symbol: 'ETH',
      index: 3,
      sequence: '9',
      leg: 'TP',
    }),
  ).rejects.toThrow('has changed');
  expect(mocks.prepare).not.toHaveBeenCalled();
  await service.prepare(owner, {
    kind: 'cancelConditional',
    symbol: 'ETH',
    index: 3,
    sequence: '9',
    leg: 'SL',
  });
  expect(
    getCancelConditionalOrderDecoder().decode(mocks.prepare.mock.calls[0]![2][0].data),
  ).toMatchObject({ disableFirst: false, disableSecond: true });
});
it.each([{ sequence: '10' }, { index: 4 }, { symbol: 'BTC' }])(
  'rejects a changed conditional identity %o',
  async (change) => {
    await load(true);
    await expect(
      service.prepare(owner, {
        kind: 'cancelConditional',
        symbol: 'ETH',
        index: 3,
        sequence: '9',
        leg: 'TP',
        ...change,
      }),
    ).rejects.toThrow('has changed');
    expect(mocks.prepare).not.toHaveBeenCalled();
  },
);
