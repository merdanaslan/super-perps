import { useEffect, useState } from 'react';
import { useMarkets, usePageVisible } from './market-data';
import { useOnline } from '../pwa/connectivity';
import {
  EQUITY_WINDOW_MS,
  normalizeEquityHistory,
  type EquityPoint,
} from '../phoenix/equity-history';

type HistoryState = {
  trader: string;
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  points: EquityPoint[];
};

/** Read-only history, scoped to the active trader and kept only in memory. */
export function useEquityHistory(trader?: string) {
  const { client } = useMarkets();
  const visible = usePageVisible();
  const online = useOnline();
  const [state, setState] = useState<HistoryState>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!trader || !client || !visible || !online) return;
    const currentTrader = trader;
    const api = client.api.traders();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      const end = Date.now();
      setState((previous) =>
        previous?.trader === currentTrader
          ? { ...previous, refreshing: true }
          : { trader: currentTrader, status: 'loading', refreshing: true, points: [] },
      );
      try {
        const rows = await api.getTraderPortfolioValues(currentTrader, {
          resolution: '15m',
          startTime: end - EQUITY_WINDOW_MS,
          endTime: end,
          limit: 100,
        });
        if (active)
          setState({
            trader: currentTrader,
            status: 'ready',
            refreshing: false,
            points: normalizeEquityHistory(rows, end - EQUITY_WINDOW_MS, end),
          });
      } catch {
        if (active)
          setState({ trader: currentTrader, status: 'error', refreshing: false, points: [] });
      } finally {
        // Fifteen-minute snapshots do not need account-refresh-frequency polling.
        if (active) timer = setTimeout(() => void refresh(), 5 * 60_000);
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trader, client, visible, online, attempt]);

  // A slow response from a previous wallet must never be displayed for a new one.
  const current = state?.trader === trader ? state : undefined;
  return {
    status: !trader ? 'idle' : !online ? 'offline' : (current?.status ?? 'loading'),
    points: current?.points ?? [],
    refreshing: !!trader && visible && online && (current?.refreshing ?? true),
    refresh: () => setAttempt((value) => value + 1),
  };
}
