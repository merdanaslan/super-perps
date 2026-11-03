// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MarketList } from './MarketList';
import type { Market } from '../market-data';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const state = vi.hoisted(() => ({
  markets: [] as Market[],
  rows: {} as Record<
    string,
    { markPrice?: number; dayVolumeUsd?: number; priceChange24hPercent?: number }
  >,
}));
vi.mock('../market-data', () => ({
  useMarkets: () => ({
    markets: state.markets,
    data: { marketsBySymbol: state.rows, status: { health: 'live' } },
  }),
}));
let container: HTMLDivElement;
let root: Root;
const select = vi.fn();
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  state.markets = ['BTC', 'QQQ', 'SPY', 'TLT'].map(
    (symbol) =>
      ({
        symbol,
        marketStatus: 'active',
        isolatedOnly: false,
        metadata: { name: symbol, coinGeckoId: symbol === 'BTC' ? 'bitcoin' : null },
        leverageTiers: [{ maxLeverage: 20 }],
      }) as Market,
  );
  state.rows = { BTC: { markPrice: 77000, dayVolumeUsd: 2500000, priceChange24hPercent: -1.25 } };
  select.mockClear();
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});
const row = (symbol: string) =>
  container.querySelector<HTMLButtonElement>(`[aria-label="View ${symbol} perpetual"]`)!;

it('displays Phoenix volume, direction and maximum leverage and preserves market selection', async () => {
  await act(() => root.render(<MarketList browse onSelect={select} />));
  expect(row('BTC').textContent).toContain('$2.5M Vol');
  expect(row('BTC').querySelector('.market-change')?.className).toContain('negative');
  expect(row('BTC').querySelector('.market-leverage')?.getAttribute('title')).toBe(
    'Maximum leverage: 20×',
  );
  await act(() => row('BTC').click());
  expect(select).toHaveBeenCalledWith('BTC');
});

it('keeps missing and invalid data unknown while displaying real zeroes', async () => {
  state.rows.QQQ = { markPrice: NaN, dayVolumeUsd: NaN, priceChange24hPercent: NaN };
  state.rows.SPY = { markPrice: 0, dayVolumeUsd: 0, priceChange24hPercent: 0 };
  await act(() => root.render(<MarketList browse onSelect={select} />));
  for (const symbol of ['QQQ', 'TLT']) {
    expect(row(symbol).querySelector('.market-price')?.textContent).toBe('—');
    expect(row(symbol).querySelector('.market-name small')?.textContent).toBe('— Vol');
    expect(row(symbol).querySelector('.market-change')?.textContent).toBe('—');
  }
  expect(row('SPY').textContent).toContain('$0 Vol');
  expect(row('SPY').querySelector('.market-change')?.textContent).toBe('0.00%');
});

it('filters indices and uses the venue-supplied ticker placeholders', async () => {
  for (const market of state.markets) {
    if (market.metadata && market.symbol !== 'BTC')
      market.metadata.logoUri = `https://example.invalid/markets/${market.symbol}.svg`;
  }
  await act(() => root.render(<MarketList browse onSelect={select} />));
  const indices = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.market-category-tabs button'),
  ).find((el) => el.textContent === 'Indices')!;
  await act(() => indices.click());
  expect(container.querySelector('[aria-label="View BTC perpetual"]')).toBeNull();
  for (const symbol of ['QQQ', 'SPY', 'TLT']) {
    expect(row(symbol).querySelector('.asset-icon > img')?.getAttribute('src')).toBe(
      `https://example.invalid/markets/${symbol}.svg`,
    );
    expect(row(symbol).querySelector('.asset-venue img')?.getAttribute('src')).toBe(
      '/brand/phoenix-mark-orange.svg',
    );
  }
});

it('keeps isolated-only markets clearly restricted and omits their cross leverage badge', async () => {
  state.markets[0]!.isolatedOnly = true;
  await act(() => root.render(<MarketList browse onSelect={select} />));
  expect(row('BTC').textContent).toContain('Isolated only');
  expect(row('BTC').querySelector('.market-leverage')).toBeNull();
});
