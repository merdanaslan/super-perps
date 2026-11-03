import { afterEach, expect, it, vi } from 'vitest';
import type { PublicPhoenixClient } from './client';
import { quoteFromBook, readMarketSnapshot } from './data';

afterEach(() => vi.restoreAllMocks());

it('does not make an older book look fresh when candles arrive later', async () => {
  const initial = 1_800_000_000_000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(initial);
  const book = Promise.resolve({ symbol: 'SOL', slot: 123, bids: [[100, 1]], asks: [[101, 1]] });
  let finishCandles!: (value: never[]) => void;
  const candles = new Promise<never[]>((resolve) => {
    finishCandles = resolve;
  });
  const client = {
    api: {
      orderbook: () => ({ getOrderbook: () => book }),
      candles: () => ({ getCandles: () => candles }),
    },
  } as unknown as PublicPhoenixClient;
  const request = readMarketSnapshot(client, 'SOL');
  await book;
  clock.mockReturnValue(initial + 30_000);
  finishCandles([]);
  expect((await request).receivedAtMs).toBe(initial);
});

it.each([0, -1, NaN, Infinity])('rejects an unusable top-of-book price %s', (bid) => {
  expect(() =>
    quoteFromBook({ symbol: 'SOL', bids: [[bid, 1]], asks: [[100, 1]] }, Date.now()),
  ).toThrow(/book/i);
});

it('rejects an empty side of the book', () => {
  expect(() => quoteFromBook({ symbol: 'SOL', bids: [], asks: [[100, 1]] }, Date.now())).toThrow(
    /book/i,
  );
});
