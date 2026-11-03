import type { PublicPhoenixClient } from './client';
import type { BookQuote } from './orders';

export async function readMarketSnapshot(client: PublicPhoenixClient, symbol: string) {
  const [bookResult, candles] = await Promise.all([
    client.api
      .orderbook()
      .getOrderbook(symbol)
      .then((book) => ({ book, receivedAtMs: Date.now() })),
    client.api
      .candles()
      .getCandles(symbol, { timeframe: '1h', limit: 48, enableExternalSource: false }),
  ]);
  return { ...bookResult, candles };
}

export function quoteFromBook(
  book: { symbol: string; bids: Array<[number, number]>; asks: Array<[number, number]> },
  receivedAtMs: number,
): BookQuote {
  const bid = book.bids[0]?.[0];
  const ask = book.asks[0]?.[0];
  if (
    bid === undefined ||
    ask === undefined ||
    !Number.isFinite(bid) ||
    !Number.isFinite(ask) ||
    bid <= 0 ||
    ask <= 0
  ) {
    throw new Error('Both sides of the order book are required.');
  }
  return { symbol: book.symbol, bid: String(bid), ask: String(ask), receivedAtMs };
}

export async function sampleBookUpdates(
  client: PublicPhoenixClient,
  symbol: string,
  signal?: AbortSignal,
) {
  if (!client.streams) throw new Error('Phoenix streaming is unavailable.');
  const timeout = AbortSignal.timeout(12_000);
  const controller = new AbortController();
  const combined = AbortSignal.any([timeout, controller.signal, ...(signal ? [signal] : [])]);
  combined.throwIfAborted();
  const samples: Array<{
    market: string;
    serverTimeMs: number;
    slot: string;
    receivedAtMs: number;
    bid: number | null;
    ask: number | null;
  }> = [];
  try {
    for await (const update of client.streams.l2Book(symbol, combined)) {
      samples.push({
        market: update.market,
        serverTimeMs: update.ts,
        slot: String(update.slot),
        receivedAtMs: Date.now(),
        bid: update.bids[0]?.[0] ?? null,
        ask: update.asks[0]?.[0] ?? null,
      });
      if (samples.length === 3) return samples;
    }
    throw new Error(
      `Book stream ended after ${samples.length}/3 updates${timeout.aborted ? ' (12s timeout)' : ''}.`,
    );
  } finally {
    controller.abort();
  }
}
