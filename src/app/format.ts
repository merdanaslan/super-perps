export function price(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  const digits =
    value === 0 ? 2 : Math.max(2, Math.min(20, 4 - Math.floor(Math.log10(Math.abs(value)))));
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

export function quantity(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value);
}

export function usdc(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function pnl(value?: string) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const amount = Number(value);
  return new Intl.NumberFormat('en-US', {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 2,
    maximumFractionDigits: amount !== 0 && Math.abs(amount) < 0.01 ? 6 : 2,
  }).format(amount);
}

export function percent(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/** Short market-list volume, while preserving missing values as unknown. */
export function compactUsd(value?: number | null) {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function shortAddress(value: string) {
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}
