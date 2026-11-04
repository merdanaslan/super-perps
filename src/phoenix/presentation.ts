import { Decimal } from 'decimal.js';

const Exact = Decimal.clone({ precision: 80 });

export function crossMarketSupported(market: { marketStatus: string; isolatedOnly: boolean }) {
  return market.marketStatus === 'active' && !market.isolatedOnly;
}

interface CandleInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount?: number;
  externalSource?: string;
}

export function normalizeCandles(bars: CandleInput[]) {
  const byTime = new Map<number, CandleInput>();
  for (const bar of bars) {
    if (bar.externalSource) throw new Error('Only Phoenix exchange candles are supported.');
    if (
      !Number.isSafeInteger(bar.time) ||
      bar.time <= 0 ||
      ![bar.open, bar.high, bar.low, bar.close].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      bar.high < Math.max(bar.open, bar.close, bar.low) ||
      bar.low > Math.min(bar.open, bar.close) ||
      !Number.isFinite(bar.volume) ||
      bar.volume < 0 ||
      (bar.tradeCount !== undefined &&
        (!Number.isSafeInteger(bar.tradeCount) || bar.tradeCount < 0))
    ) {
      throw new Error('Invalid Phoenix candle data.');
    }
    // Phoenix uses milliseconds; the chart renderer expects seconds.
    const time = Math.floor(bar.time / 1_000);
    byTime.set(time, { ...bar, time });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Merge normalized REST history and cumulative WS bars without losing newer trades. */
export function mergeCandles(current: CandleInput[], updates: CandleInput[]) {
  const byTime = new Map(current.map((bar) => [bar.time, bar]));
  for (const bar of updates) {
    const previous = byTime.get(bar.time);
    if (
      previous?.tradeCount !== undefined &&
      bar.tradeCount !== undefined &&
      bar.tradeCount < previous.tradeCount
    )
      continue;
    byTime.set(bar.time, bar);
  }
  // REST can omit the open bucket; preserve it while backfilling closed candles.
  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-160);
}

function positive(value: string) {
  if (value.length > 60 || !/^\d+(\.\d+)?$/.test(value))
    throw new Error('Enter a positive decimal amount.');
  const parsed = new Exact(value);
  if (!parsed.isFinite() || parsed.lte(0))
    throw new Error('Amount and price must be greater than zero.');
  return parsed;
}

/** Indicative display conversion only. Execution must revalidate with a fresh quote. */
export function previewOrderSize(
  amount: string,
  unit: 'base' | 'quote',
  price: string,
  baseLotsDecimals: number,
) {
  if (!Number.isInteger(baseLotsDecimals) || Math.abs(baseLotsDecimals) > 18)
    throw new Error('Unsupported lot precision.');
  const input = positive(amount);
  const reference = positive(price);
  const scale = new Exact(10).pow(baseLotsDecimals);
  let lots = (unit === 'base' ? input : input.div(reference)).mul(scale);
  if (unit === 'base' && !lots.isInteger()) throw new Error('Size must be a whole market lot.');
  lots = lots.floor();
  if (lots.lt(1)) throw new Error('Amount is below the minimum market lot.');
  if (lots.gt('18446744073709551615')) throw new Error('Size exceeds the protocol lot limit.');
  const base = lots.div(scale);
  const notional = base.mul(reference);
  return {
    baseUnits: base.toFixed(),
    notional: notional.toFixed(),
    rounded: unit === 'quote' && notional.lt(input),
    lotSize: new Exact(1).div(scale).toFixed(),
  };
}
