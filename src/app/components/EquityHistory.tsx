import {
  equityChartPath,
  equityHistoryView,
  withCurrentEquity,
  type EquityPoint,
} from '../../phoenix/equity-history';
import type { useEquityHistory } from '../useEquityHistory';
import { pnl, usdc } from '../format';
import { Skeleton } from './SessionSkeleton';

export function EquityHistory({
  history,
  currentEquity,
  accountState,
}: {
  history: ReturnType<typeof useEquityHistory>;
  currentEquity?: EquityPoint;
  accountState?: 'loading' | 'unavailable';
}) {
  const end = Date.now();
  const points = withCurrentEquity(history.points, currentEquity, end);
  const view = equityHistoryView(points, end);
  const chart = equityChartPath(points);
  const loading = accountState === 'loading' || history.status === 'loading';
  const unavailable =
    accountState === 'unavailable' ||
    history.status === 'error' ||
    history.status === 'offline' ||
    (view && !view.recent);
  const ready = !unavailable && history.status === 'ready' && view?.recent && chart;
  const label = view && !view.fullDay ? 'Recent equity' : '24h equity';
  const change = view ? `${pnl(String(view.change))} USDC` : '';
  const direction =
    !view || view.change === 0 ? 'neutral' : view.change > 0 ? 'positive' : 'negative';

  return (
    <figure className="equity-history" aria-busy={loading || history.refreshing}>
      <figcaption>{label}</figcaption>
      {loading ? (
        <div role="status" aria-label="Loading equity history">
          <Skeleton className="equity-history-loading" />
        </div>
      ) : ready ? (
        <>
          <svg
            viewBox="0 0 144 52"
            className={direction}
            role="img"
            aria-label={`${label}: ${usdc(view.first.value)} to ${usdc(view.last.value)} USDC. Change ${change}. Includes deposits and withdrawals.${view.gaps ? ' Some snapshots are missing.' : ''}`}
          >
            <title>
              15-minute history with the latest available account equity. Includes deposits and
              withdrawals.
            </title>
            <path d={chart.path} fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx={chart.last.x} cy={chart.last.y} r="2.5" fill="currentColor" />
          </svg>
          <span className={`equity-history-change ${direction}`}>{change}</span>
        </>
      ) : (
        <div className="equity-history-empty">
          <span>
            {history.status === 'offline'
              ? 'Offline'
              : unavailable
                ? 'History unavailable'
                : 'History appears here'}
          </span>
          {unavailable && history.status !== 'idle' && history.status !== 'offline' && (
            <button className="text-button" disabled={history.refreshing} onClick={history.refresh}>
              Retry history
            </button>
          )}
        </div>
      )}
    </figure>
  );
}
