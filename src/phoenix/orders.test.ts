import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderFlags, Side, type PhoenixClient } from '@ellipsis-labs/rise';
import { buildUnsignedMarketOrder, prepareMarketOrder } from './orders';

const now = 1_800_000_000_000;
const market = { symbol: 'SOL', status: 'active', tickSize: 100n, baseLotsDecimals: 2 };
const quote = { symbol: 'SOL', bid: '100.00', ask: '100.00', receivedAtMs: now };
const intent = {
  symbol: 'SOL',
  side: 'long' as const,
  baseUnits: '0.25',
  slippageBps: 100,
  reduceOnly: false,
};
const prepare = (overrides: Partial<typeof intent> = {}) =>
  prepareMarketOrder({ ...intent, ...overrides }, market, quote, now);

afterEach(() => vi.restoreAllMocks());

describe('unsigned market order preparation', () => {
  it('builds a bounded long from decimal strings using Phoenix lot sizes', () => {
    const result = prepare();
    expect(result.packet.side).toBe(Side.Bid);
    expect(result.packet.priceInTicks).toBe(10100n);
    expect(result.packet.numBaseLots).toBe(25n);
    expect(result.packet.minBaseLotsToFill).toBe(25n);
    expect(result.packet.cancelExisting).toBe(false);
    expect(result.priceLimitUsd).toBe('101');
  });

  it('bounds a short at the bid less the selected slippage', () => {
    const result = prepareMarketOrder({ ...intent, side: 'short' }, market, quote, now);
    expect(result.packet.side).toBe(Side.Ask);
    expect(result.packet.priceInTicks).toBe(9900n);
  });

  it('rounds long and short limits toward the protected side of a tick', () => {
    const book = { ...quote, bid: '100.01', ask: '100.02' };
    const long = prepareMarketOrder(intent, market, book, now);
    const short = prepareMarketOrder({ ...intent, side: 'short' }, market, book, now);
    expect(long.packet.priceInTicks).toBe(10102n);
    expect(short.packet.priceInTicks).toBe(9901n);
  });

  it('encodes reduce-only instead of opening opposite exposure when closing', () => {
    expect(prepare({ reduceOnly: true }).packet.orderFlags).toBe(OrderFlags.ReduceOnly);
  });

  it.each(['0', '-1', 'NaN', 'Infinity', '1e3', '0x10', '', ' 1 ', '1.'])(
    'rejects invalid size %s',
    (baseUnits) => {
      expect(() => prepare({ baseUnits })).toThrow(/amount|size/i);
    },
  );

  it('rejects sizes below a whole lot instead of silently rounding', () => {
    expect(() => prepare({ baseUnits: '0.001' })).toThrow(/lot/i);
  });

  it('rejects sizes that overflow the protocol integer', () => {
    expect(() => prepare({ baseUnits: '18446744073709551616' })).toThrow(/size/i);
  });

  it.each([-1, 0, 501, 1.5, NaN])('rejects unsupported slippage %s', (slippageBps) => {
    expect(() => prepare({ slippageBps })).toThrow(/slippage/i);
  });

  it('rejects stale local snapshots', () => {
    expect(() => prepareMarketOrder(intent, market, quote, now + 15_001)).toThrow(/stale/i);
  });

  it('rejects impossible future receipt times', () => {
    expect(() => prepareMarketOrder(intent, market, quote, now - 1)).toThrow(/time/i);
  });

  it('rejects market data for a different instrument', () => {
    expect(() => prepareMarketOrder(intent, market, { ...quote, symbol: 'BTC' }, now)).toThrow(
      /market/i,
    );
  });

  it('rejects unavailable markets', () => {
    expect(() => prepareMarketOrder(intent, { ...market, status: 'paused' }, quote, now)).toThrow(
      /active/i,
    );
  });

  it('rejects a crossed order book', () => {
    expect(() =>
      prepareMarketOrder(intent, market, { ...quote, bid: '101', ask: '100' }, now),
    ).toThrow(/book/i);
  });

  it('handles a market whose minimum lot is larger than one base unit', () => {
    const result = prepareMarketOrder(
      { ...intent, baseUnits: '200' },
      { ...market, baseLotsDecimals: -2 },
      quote,
      now,
    );
    expect(result.packet.numBaseLots).toBe(2n);
  });

  it('rechecks freshness after waiting for exchange metadata', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const build = vi.fn();
    const client = {
      exchange: {
        ready: async () => {
          clock.mockReturnValue(now + 16_000);
        },
        market: () => ({ ...market, marketStatus: 'active', isolatedOnly: false }),
      },
      ixs: { buildPlaceMarketOrder: build },
    } as unknown as PhoenixClient;
    await expect(
      buildUnsignedMarketOrder(
        client,
        'US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx',
        intent,
        quote,
      ),
    ).rejects.toThrow(/stale/i);
    expect(build).not.toHaveBeenCalled();
  });

  it.each([
    { value: undefined, message: /unsupported/i },
    { value: { ...market, marketStatus: 'active', isolatedOnly: true }, message: /cross-account/i },
  ])('does not build for an unsupported account/market combination', async ({ value, message }) => {
    const build = vi.fn();
    const client = {
      exchange: { ready: async () => {}, market: () => value },
      ixs: { buildPlaceMarketOrder: build },
    } as unknown as PhoenixClient;
    await expect(
      buildUnsignedMarketOrder(
        client,
        'US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx',
        intent,
        quote,
      ),
    ).rejects.toThrow(message);
    expect(build).not.toHaveBeenCalled();
  });
});
