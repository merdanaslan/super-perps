import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ExchangeMarketSnapshot, PhoenixMarketDataStoreState } from '@ellipsis-labs/rise';
import { config } from '../config';
import { createPublicPhoenixClient, type PublicPhoenixClient } from '../phoenix/client';
import { normalizeCandles } from '../phoenix/presentation';

export type Market = ExchangeMarketSnapshot;
type MarketContextValue = {
  client?: PublicPhoenixClient;
  markets: Market[];
  data?: PhoenixMarketDataStoreState;
  error: string;
  retry: () => void;
};
const MarketContext = createContext<MarketContextValue | null>(null);
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Phoenix data is unavailable.';

export function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<MarketContextValue, 'retry'>>({ markets: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  useEffect(() => {
    if (!visible) return;
    const client = createPublicPhoenixClient(config.phoenixApiUrl);
    const marketData = client.marketData();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ client, markets: [], error: '' });
    const release = marketData.retain();
    const unsubscribe = marketData.store.subscribe(() => {
      // Batch display updates; receipt timestamps remain the SDK's original values.
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          if (active) setState((previous) => ({ ...previous, data: marketData.store.getState() }));
        }, 150);
    });
    void client.exchange
      .ready()
      .then((snapshot) => {
        if (active) setState((previous) => ({ ...previous, markets: snapshot.markets, error: '' }));
      })
      .catch((error: unknown) => {
        if (active) setState((previous) => ({ ...previous, error: errorMessage(error) }));
      });
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
      release();
      client.dispose();
    };
  }, [attempt, visible]);
  return (
    <MarketContext.Provider value={{ ...state, retry: () => setAttempt((n) => n + 1) }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarkets() {
  const context = useContext(MarketContext);
  if (!context) throw new Error('MarketProvider is required.');
  return context;
}

export interface DisplayBook {
  market: string;
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  receivedAtMs: number;
  serverTimeMs: number;
}

export function useOrderBook(symbol: string) {
  const { client } = useMarkets();
  const [book, setBook] = useState<DisplayBook>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const visible = usePageVisible();
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    setBook(undefined);
    setError('');
    if (!client?.streams || !visible) return;
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const update of client.streams!.l2Book(symbol, controller.signal)) {
          if (controller.signal.aborted) return;
          if (update.market !== symbol) continue;
          setBook({
            market: symbol,
            bids: update.bids,
            asks: update.asks,
            receivedAtMs: Date.now(),
            serverTimeMs: update.ts,
          });
          setError('');
        }
        if (!controller.signal.aborted) setError('Order book disconnected. Reconnect to refresh.');
      } catch (cause) {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      }
    })();
    return () => controller.abort();
  }, [client, symbol, attempt, visible]);
  const current = book?.market === symbol ? book : undefined;
  const stale =
    !visible ||
    !current ||
    now - current.receivedAtMs > 15_000 ||
    now - current.serverTimeMs > 15_000;
  return { book: current, stale, error, retry: () => setAttempt((n) => n + 1) };
}

export const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type Timeframe = (typeof timeframes)[number];

export function useCandles(symbol: string, timeframe: Timeframe) {
  const { client } = useMarkets();
  const [state, setState] = useState<{
    key: string;
    bars: ReturnType<typeof normalizeCandles>;
    error: string;
    loading: boolean;
    updatedAt?: number;
  }>({ key: '', bars: [], error: '', loading: true });
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  const key = `${symbol}:${timeframe}`;
  useEffect(() => {
    setState({ key, bars: [], error: '', loading: true });
    if (!client || !visible) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function read() {
      try {
        const bars = normalizeCandles(
          await client!.api
            .candles()
            .getCandles(symbol, { timeframe, limit: 160, enableExternalSource: false }),
        );
        if (active) setState({ key, bars, error: '', loading: false, updatedAt: Date.now() });
      } catch (cause) {
        if (active)
          setState((previous) => ({ ...previous, loading: false, error: errorMessage(cause) }));
      } finally {
        if (active) timer = setTimeout(() => void read(), 15_000);
      }
    }
    void read();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, key, symbol, timeframe, attempt, visible]);
  return {
    ...(state.key === key ? state : { key, bars: [], loading: true, error: '' }),
    retry: () => setAttempt((n) => n + 1),
  };
}
