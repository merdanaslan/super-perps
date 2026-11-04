// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CandleUpdate } from '@ellipsis-labs/rise';
import { MarketProvider, useCandles, type Timeframe } from './market-data';

const mocks = vi.hoisted(() => ({ read: vi.fn(), stream: vi.fn(), dispose: vi.fn() }));
vi.mock('../phoenix/client', () => ({
  PHOENIX_API_URL: 'https://phoenix.example.test',
  createPublicPhoenixClient: () => ({
    api: { candles: () => ({ getCandles: mocks.read }) },
    streams: { candles: mocks.stream },
    exchange: { ready: async () => ({ markets: [] }) },
    marketData: () => ({
      retain: () => () => {},
      store: { subscribe: () => () => {} },
    }),
    dispose: mocks.dispose,
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
const bar = {
  time: 1_793_005_200_000,
  open: 100,
  high: 105,
  low: 98,
  close: 102,
  volume: 2,
  tradeCount: 10,
};
let state: ReturnType<typeof useCandles>;
const feeds: Array<{ signal: AbortSignal; emit: (update: CandleUpdate) => void }> = [];
function ReadCandles({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }) {
  state = useCandles(symbol, timeframe);
  return null;
}
async function render(symbol = 'BTC', timeframe: Timeframe = '1m') {
  await act(() =>
    root.render(
      <MarketProvider>
        <ReadCandles symbol={symbol} timeframe={timeframe} />
      </MarketProvider>,
    ),
  );
}
async function emit(candle = bar, symbol = 'BTC', timeframe = '1m', index = feeds.length - 1) {
  await act(() => feeds[index]!.emit({ candle, symbol, timeframe }));
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  mocks.read.mockResolvedValue([bar]);
  mocks.stream.mockImplementation((_symbol: string, _timeframe: string, signal: AbortSignal) => {
    const queue: CandleUpdate[] = [];
    let wake = () => {};
    const abort = () => wake();
    signal.addEventListener('abort', abort, { once: true });
    feeds.push({
      signal,
      emit: (update) => {
        queue.push(update);
        wake();
      },
    });
    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (!signal.aborted) {
            if (queue.length) yield queue.shift()!;
            else
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
          }
        } finally {
          signal.removeEventListener('abort', abort);
        }
      },
    };
  });
});
afterEach(async () => {
  await act(() => root.render(null));
  feeds.length = 0;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('shows within-candle updates immediately, including before a slower history response', async () => {
  let resolve!: (bars: (typeof bar)[]) => void;
  mocks.read.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render();
  await emit({ ...bar, close: 104, tradeCount: 12 });
  expect(state.bars.at(-1)?.close).toBe(104);
  expect(state.loading).toBe(false);
  await act(() => resolve([{ ...bar, time: bar.time - 60_000 }, bar]));
  expect(state.bars).toHaveLength(2);
  expect(state.bars.at(-1)?.close).toBe(104);
  expect(state.bars.at(-1)?.time).toBe(bar.time / 1000);
  await emit({ ...bar, time: bar.time + 60_000 });
  expect(state.bars).toHaveLength(3);
});
it('aborts the previous feed on timeframe or market changes and ignores mismatched updates', async () => {
  await render();
  await emit({ ...bar, close: 105 }, 'SOL');
  await emit({ ...bar, close: 105 }, 'BTC', '5m');
  expect(state.bars.at(-1)?.close).toBe(102);
  const old = feeds[0]!;
  await render('SOL', '5m');
  expect(old.signal.aborted).toBe(true);
  expect(mocks.stream).toHaveBeenLastCalledWith('SOL', '5m', expect.any(AbortSignal));
  await emit({ ...bar, close: 104 }, 'SOL', '5m');
  expect(state.key).toBe('SOL:5m');
  expect(state.bars.at(-1)?.close).toBe(104);
});
it('keeps REST recovery when the live feed fails, and stops work while hidden', async () => {
  mocks.stream.mockImplementationOnce(() => {
    throw new Error('Disconnected');
  });
  await render();
  mocks.read.mockResolvedValue([{ ...bar, close: 105, tradeCount: 15 }]);
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(state.bars.at(-1)?.close).toBe(105);
  expect(state.error).toBe('');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await act(() => document.dispatchEvent(new Event('visibilitychange')));
  const reads = mocks.read.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(mocks.read).toHaveBeenCalledTimes(reads);
  expect(mocks.dispose).toHaveBeenCalled();
});
