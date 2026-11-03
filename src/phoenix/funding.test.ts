import { expect, it } from 'vitest';
import { fundingRateView } from './funding';

const now = 1_793_301_698_000;
const row = { timestamp: now, currentFundingRate: 0.00120135581585 };
it('displays the API hourly percentage without multiplying by 100 or using the 8h value', () => {
  expect(fundingRateView(row, { health: 'live' }, now)).toEqual({
    label: '+0.001201%',
    direction: 'Longs pay shorts',
  });
  expect(
    fundingRateView({ ...row, currentFundingRate: -0.0012 }, { health: 'live' }, now)?.direction,
  ).toBe('Shorts pay longs');
  expect(fundingRateView({ ...row, currentFundingRate: 0 }, { health: 'live' }, now)?.label).toBe(
    '0.0000%',
  );
});
it('withholds missing, invalid, disconnected or stale rates', () => {
  for (const rate of [NaN, Infinity, null])
    expect(
      fundingRateView({ ...row, currentFundingRate: rate }, { health: 'live' }, now),
    ).toBeUndefined();
  expect(fundingRateView(undefined, { health: 'live' }, now)).toBeUndefined();
  expect(fundingRateView(row, { health: 'recovering' }, now)).toBeUndefined();
  expect(fundingRateView(row, { health: 'live' }, now + 30_001)).toBeUndefined();
  expect(fundingRateView(row, { health: 'live' }, now - 5001)).toBeUndefined();
});
