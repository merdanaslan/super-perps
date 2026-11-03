import { describe, expect, it } from 'vitest';
import { crossMarketSupported, normalizeCandles, previewOrderSize } from './presentation';

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
});

describe('indicative order size', () => {
  it('rounds USDC notional down to whole base lots', () => {
    expect(previewOrderSize('100', 'quote', '33', 2)).toEqual({
      baseUnits: '3.03',
      notional: '99.99',
    });
  });
  it('requires exact whole lots when the user enters base units', () => {
    expect(() => previewOrderSize('0.001', 'base', '100', 2)).toThrow('lot');
  });
  it('supports markets whose minimum lot exceeds one unit', () => {
    expect(previewOrderSize('550', 'quote', '2', -1)).toEqual({
      baseUnits: '270',
      notional: '540',
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
