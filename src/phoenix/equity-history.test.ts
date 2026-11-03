import { describe, expect, it } from 'vitest';
import type { PortfolioValueDataPoint } from '@ellipsis-labs/rise';
import {
  EQUITY_INTERVAL_MS,
  EQUITY_WINDOW_MS,
  equityChartPath,
  equityHistoryView,
  normalizeEquityHistory,
  withCurrentEquity,
} from './equity-history';

const end = 1_800_000_000_000;
const start = end - EQUITY_WINDOW_MS;
const point = (time: number, value: number): PortfolioValueDataPoint => ({
  timestamp: time / 1_000 + 1,
  startTime: time / 1_000 - 899,
  endTime: time / 1_000,
  value,
});

describe('equity history display data', () => {
  it('uses snapshot end seconds, preserves USDC units, orders and deduplicates snapshots', () => {
    expect(
      normalizeEquityHistory([point(end, 1.9), point(start, 2), point(end, 1.95)], start, end),
    ).toEqual([
      { time: start, value: 2 },
      { time: end, value: 1.95 },
    ]);
  });
  it('keeps the in-progress interval at the read time instead of dropping the latest value', () => {
    const now = end + 7 * 60_000;
    const current = point(end + EQUITY_INTERVAL_MS - 1_000, 1.904986);
    expect(normalizeEquityHistory([point(end - 1_000, 0), current], start, now)).toEqual([
      { time: end - 1_000, value: 0 },
      { time: now, value: 1.904986 },
    ]);
  });
  it('excludes invalid or out-of-window values, preserving valid zero and negative equity', () => {
    expect(
      normalizeEquityHistory(
        [
          point(start - 1_000, 7),
          point(end + EQUITY_INTERVAL_MS + 1_000, 9),
          point(start, 0),
          point(end, -0.1),
          point(start + 1_000, NaN),
          point(start + 2_000, Infinity),
          point(NaN, 4),
        ],
        start,
        end,
      ),
    ).toEqual([
      { time: start, value: 0 },
      { time: end, value: -0.1 },
    ]);
  });
  it('does not invent a trend for an empty or single-point history', () => {
    for (const points of [[], [{ time: end, value: 2 }]]) {
      expect(equityHistoryView(points, end)).toBeUndefined();
      expect(equityChartPath(points)).toBeUndefined();
    }
  });
  it('keeps historical zeroes and gaps while adding just one current account observation', () => {
    const history = [
      { time: start, value: 2 },
      { time: end - EQUITY_INTERVAL_MS, value: 0 },
    ];
    const points = withCurrentEquity(history, { time: end, value: 1.9 }, end);
    expect(points).toEqual([...history, { time: end, value: 1.9 }]);
    expect(history).toHaveLength(2);
    expect(equityHistoryView(points, end)?.gaps).toBe(true);
    expect(equityChartPath(points)?.path.match(/M/g)).toHaveLength(2);
  });
  it('never moves the endpoint backwards or adds invalid, expired or future observations', () => {
    const history = [
      { time: end - EQUITY_INTERVAL_MS, value: 2 },
      { time: end, value: 1.9 },
    ];
    for (const current of [
      undefined,
      { time: end - 1_000, value: 99 },
      { time: start - 1_000, value: 99 },
      { time: end + 1_000, value: 99 },
      { time: end, value: NaN },
      { time: NaN, value: 99 },
    ])
      expect(withCurrentEquity(history, current, end)).toEqual(history);
    expect(withCurrentEquity(history, { time: end, value: 2.1 }, end).at(-1)?.value).toBe(2.1);
  });
  it('distinguishes short, stale and gapped histories from a complete current day', () => {
    const points = [
      { time: start, value: 2 },
      { time: end, value: 3 },
    ];
    expect(equityHistoryView(points, end)).toMatchObject({
      fullDay: true,
      recent: true,
      gaps: true,
      change: 1,
    });
    expect(equityHistoryView(points, end + EQUITY_INTERVAL_MS * 3)?.recent).toBe(false);
    expect(
      equityHistoryView([{ time: end - EQUITY_INTERVAL_MS, value: 2 }, points[1]!], end)?.fullDay,
    ).toBe(false);
  });
  it('draws flat and negative data without NaN, and breaks the line across missing intervals', () => {
    const points = [
      { time: start, value: -2 },
      { time: start + EQUITY_INTERVAL_MS, value: -2 },
      { time: start + EQUITY_INTERVAL_MS * 3, value: -2 },
    ];
    const chart = equityChartPath(points)!;
    expect(chart.path.match(/M/g)).toHaveLength(2);
    expect(chart.path).toContain('L');
    expect(chart.path).not.toMatch(/NaN|Infinity/);
    expect(chart.last.y).toBe(26);
  });
});
