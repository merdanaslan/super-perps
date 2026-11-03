import type { PortfolioValueDataPoint } from '@ellipsis-labs/rise';

export const EQUITY_INTERVAL_MS = 15 * 60_000;
export const EQUITY_WINDOW_MS = 24 * 60 * 60_000;
export interface EquityPoint {
  time: number;
  value: number;
}

/** Requests use milliseconds; Phoenix's snapshot timestamps use seconds.
 * Values are already USDC amounts, not quote lots. Never zero-fill missing history.
 */
export function normalizeEquityHistory(
  rows: readonly PortfolioValueDataPoint[],
  start: number,
  end: number,
): EquityPoint[] {
  const unique = new Map<number, EquityPoint>();
  for (const row of rows) {
    const intervalStart = row.startTime * 1_000;
    const intervalEnd = row.endTime * 1_000;
    if (
      !Number.isFinite(intervalStart) ||
      !Number.isFinite(intervalEnd) ||
      !Number.isFinite(row.value) ||
      intervalStart > intervalEnd ||
      intervalStart > end ||
      intervalEnd < start
    )
      continue;
    // Phoenix includes the current, unfinished interval. Its endTime is the
    // bucket boundary, not a future observation: retain its value at the read time.
    const time = Math.min(intervalEnd, end);
    unique.set(time, { time, value: row.value });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}

/** Add one fresh account observation; never manufacture or overwrite past history. */
export function withCurrentEquity(
  history: readonly EquityPoint[],
  current: EquityPoint | undefined,
  end: number,
): EquityPoint[] {
  const points = history.filter(
    (point) => point.time >= end - EQUITY_WINDOW_MS && point.time <= end,
  );
  const last = points.at(-1);
  if (
    !current ||
    !Number.isFinite(current.value) ||
    !Number.isFinite(current.time) ||
    current.time > end ||
    current.time < end - EQUITY_WINDOW_MS ||
    (last && current.time < last.time)
  )
    return points;
  if (last?.time === current.time) points.pop();
  return [...points, current];
}

export function equityHistoryView(points: readonly EquityPoint[], end: number) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return undefined;
  const recent = end - last.time <= EQUITY_INTERVAL_MS * 2;
  const fullDay = first.time <= end - EQUITY_WINDOW_MS + EQUITY_INTERVAL_MS;
  const gaps = points.some((point, index) =>
    index > 0 ? point.time - points[index - 1]!.time > EQUITY_INTERVAL_MS * 1.5 : false,
  );
  return { first, last, recent, fullDay, gaps, change: last.value - first.value };
}

/** Linear segments preserve sampled values; gaps stay visible instead of interpolating them. */
export function equityChartPath(points: readonly EquityPoint[], width = 144, height = 52) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2 || last.time <= first.time) return undefined;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const center = (low + high) / 2;
  // A tiny balance movement should not look like a full-height price crash.
  const range = Math.max(high - low, Math.abs(center) * 0.005, 0.01);
  const padding = 4;
  const coords = points.map((point) => ({
    x: padding + ((point.time - first.time) / (last.time - first.time)) * (width - padding * 2),
    y: padding + (0.5 - (point.value - center) / range) * (height - padding * 2),
  }));
  const path = coords
    .map((point, index) => {
      const move =
        index === 0 || points[index]!.time - points[index - 1]!.time > EQUITY_INTERVAL_MS * 1.5;
      return `${move ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(' ');
  return { path, last: coords.at(-1)! };
}
