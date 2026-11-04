import { describe, expect, it } from 'vitest';
import {
  crossMarketSupported,
  mergeCandles,
  normalizeCandles,
  previewOrderSize,
} from './presentation';

describe('cross-only market eligibility', () => {
  it('excludes isolated-only and inactive markets', () => {
    expect(crossMarketSupported({ marketStatus: 'active', isolatedOnly: false })).toBe(true);
    expect(crossMarketSupported({ marketStatus: 'active', isolatedOnly: true })).toBe(false);
    expect(crossMarketSupported({ marketStatus: 'paused', isolatedOnly: false })).toBe(false);
  });
});

describe('Phoenix candle presentation', () => {
  const bar = { time: 1_793_005_200_000, open: 100, high: 105, low: 98, close: 102, volume: 2 };
  it('converts milliseconds, sorts and uses the latest duplicate bar', () => {
    const result = normalizeCandles([
      { ...bar, time: bar.time + 60_000 },
      bar,
      { ...bar, close: 103 },
    ]);
    expect(result.map((item) => item.time)).toEqual([1_793_005_200, 1_793_005_260]);
    expect(result[0]?.close).toBe(103);
  });
  it('does not silently show another venue or impossible prices', () => {
    expect(() => normalizeCandles([{ ...bar, externalSource: 'other-venue' }])).toThrow('Phoenix');
    expect(() => normalizeCandles([{ ...bar, high: 99 }])).toThrow('Invalid');
    expect(() => normalizeCandles([{ ...bar, time: NaN }])).toThrow('Invalid');
  });
  it('merges history with a live candle without rolling back its trades', () => {
    const live = normalizeCandles([{ ...bar, close: 104, tradeCount: 12 }]);
    const olderSnapshot = normalizeCandles([
      { ...bar, time: bar.time - 60_000, tradeCount: 20 },
      { ...bar, close: 102, tradeCount: 10 },
    ]);
    expect(mergeCandles(live, olderSnapshot)).toEqual([olderSnapshot[0], live[0]]);
    const final = normalizeCandles([{ ...bar, close: 105, tradeCount: 14 }]);
    expect(mergeCandles(live, final)).toEqual(final);
  });
  it('keeps the open bucket when REST only contains closed candles and bounds history', () => {
    const history = normalizeCandles(
      Array.from({ length: 160 }, (_, index) => ({ ...bar, time: bar.time + index * 60_000 })),
    );
    const live = normalizeCandles([{ ...bar, time: bar.time + 160 * 60_000 }]);
    const merged = mergeCandles(live, history);
    expect(merged).toHaveLength(160);
    expect(merged[0]).toEqual(history[1]);
    expect(merged.at(-1)).toEqual(live[0]);
  });
});

describe('indicative order size', () => {
  it('explains the BTC budget in whole lots without exceeding the entered value', () => {
    expect(previewOrderSize('10', 'quote', '78400', 4)).toEqual({
      baseUnits: '0.0001',
      notional: '7.84',
      rounded: true,
      lotSize: '0.0001',
    });
    expect(previewOrderSize('15.68', 'quote', '78400', 4)).toMatchObject({
      baseUnits: '0.0002',
      notional: '15.68',
      rounded: false,
    });
    expect(previewOrderSize('0.0001', 'base', '78400', 4)).toMatchObject({
      baseUnits: '0.0001',
      notional: '7.84',
      rounded: false,
    });
  });
  it('rounds USDC notional down to whole base lots', () => {
    expect(previewOrderSize('100', 'quote', '33', 2)).toEqual({
      baseUnits: '3.03',
      notional: '99.99',
      rounded: true,
      lotSize: '0.01',
    });
  });
  it('requires exact whole lots when the user enters base units', () => {
    expect(() => previewOrderSize('0.001', 'base', '100', 2)).toThrow('lot');
  });
  it('supports markets whose minimum lot exceeds one unit', () => {
    expect(previewOrderSize('550', 'quote', '2', -1)).toEqual({
      baseUnits: '270',
      notional: '540',
      rounded: true,
      lotSize: '10',
    });
  });
  it('rejects zero, exponent notation, invalid prices and underflow', () => {
    for (const value of ['0', '-1', '1e6', 'NaN']) {
      expect(() => previewOrderSize(value, 'base', '100', 2)).toThrow();
    }
    expect(() => previewOrderSize('10', 'quote', '0', 2)).toThrow();
    expect(() => previewOrderSize('0.001', 'quote', '100', 2)).toThrow('lot');
  });
  it('rejects amounts outside protocol lot limits', () => {
    expect(() => previewOrderSize('18446744073709551616', 'base', '1', 0)).toThrow('limit');
  });
});
