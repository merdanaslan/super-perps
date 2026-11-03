import type { PhoenixMarketDataRow, PhoenixMarketDataStatus } from '@ellipsis-labs/rise';

/** Phoenix currentFundingRate is already a percentage per hour, not a fraction.
 * Use the market-stats timestamp: lastUpdatedMs can also be refreshed by price-only ticks. */
export function fundingRateView(
  row: Pick<PhoenixMarketDataRow, 'currentFundingRate' | 'timestamp'> | undefined,
  status: Pick<PhoenixMarketDataStatus, 'health'> | undefined,
  now = Date.now(),
) {
  const rate = row?.currentFundingRate;
  if (
    rate == null ||
    !Number.isFinite(rate) ||
    !row?.timestamp ||
    status?.health !== 'live' ||
    now - row.timestamp > 30_000 ||
    row.timestamp > now + 5000
  )
    return undefined;
  return {
    label: `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
      signDisplay: 'exceptZero',
    }).format(rate)}%`,
    direction:
      rate > 0
        ? 'Longs pay shorts'
        : rate < 0
          ? 'Shorts pay longs'
          : 'No funding at the current rate',
  };
}
