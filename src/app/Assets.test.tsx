// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PortfolioValueDataPoint } from '@ellipsis-labs/rise';
import { Assets } from './Assets';
import { WalletSessionContext } from '../wallet/session';
import { TradingContext } from '../trading/state';
import type { TradingAccount } from '../trading/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const api = vi.hoisted(() => {
  const read = vi.fn();
  return { read, client: { api: { traders: () => ({ getTraderPortfolioValues: read }) } } };
});
vi.mock('./market-data', () => ({
  useMarkets: () => ({ client: api.client }),
  usePageVisible: () => true,
}));

let container: HTMLDivElement;
let root: Root;
let account: TradingAccount;
const refresh = vi.fn();
const row = (time: number, value: number): PortfolioValueDataPoint => ({
  timestamp: time / 1_000,
  startTime: time / 1_000 - 899,
  endTime: time / 1_000,
  value,
});
function setEquity(value: string) {
  account = {
    ...account,
    receivedAt: Date.now(),
    margin: {
      margin: { portfolioValueQuoteLots: value },
    } as TradingAccount['margin'],
  };
}
const chartLabel = () => container.querySelector('.equity-history svg')?.getAttribute('aria-label');
const refreshButton = () =>
  container.querySelector<HTMLButtonElement>('[aria-label="Refresh balances and equity history"]');
function render({ stale = false, selected = 'wallet-a', loading = false } = {}) {
  root.render(
    <WalletSessionContext.Provider
      value={{
        configured: true,
        ready: true,
        authenticated: true,
        selected,
        login: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <TradingContext.Provider
        value={{
          account,
          loading,
          error: '',
          walletError: '',
          walletStale: stale,
          walletBusy: false,
          busy: false,
          stale,
          refresh,
          review: vi.fn(),
          reviewDeposit: vi.fn(),
          openStatus: vi.fn(),
        }}
      >
        <Assets openFunding={vi.fn()} />
      </TradingContext.Provider>
    </WalletSessionContext.Provider>,
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T18:22:00Z'));
  api.read
    .mockReset()
    .mockResolvedValue([row(Date.now() - 25 * 60_000, 2), row(Date.now() - 10 * 60_000, 0)]);
  refresh.mockReset().mockResolvedValue(undefined);
  account = {
    authority: 'wallet-a',
    traderAddress: 'trader-a',
    registered: true,
    walletUsdc: 0n,
    walletSol: 50_000_000n,
    freeMargin: 1_000_000n,
    receivedAt: Date.now(),
    slot: 1,
    conditionals: [],
    params: { paramsBySymbol: {}, spotCollaterals: [], updatedAt: Date.now(), slot: 1 },
  };
  setEquity('1900000');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

it('updates the chart with fresh account equity without waiting for another history request', async () => {
  await act(() => render());
  expect(chartLabel()).toContain('to 1.90 USDC');
  await act(async () => vi.advanceTimersByTimeAsync(8_000));
  setEquity('1910000');
  await act(() => render());
  expect(chartLabel()).toContain('to 1.91 USDC');
  expect(api.read).toHaveBeenCalledTimes(1);
});

it('refreshes balances and history on demand while keeping the chart visible during the read', async () => {
  await act(() => render());
  let finish!: (rows: PortfolioValueDataPoint[]) => void;
  api.read.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  expect(refreshButton()).not.toBeNull();
  await act(() => refreshButton()!.click());
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(refreshButton()!.disabled).toBe(true);
  expect(chartLabel()).toContain('to 1.90 USDC');
  await act(() => finish([row(Date.now() - 10 * 60_000, 1.95)]));
  expect(refreshButton()!.disabled).toBe(false);
  expect(chartLabel()).toContain('1.95 to 1.90 USDC');
});

it('does not display another wallet or stale account data as the current endpoint', async () => {
  await act(() => render());
  expect(chartLabel()).toContain('to 1.90 USDC');
  await act(() => render({ stale: true }));
  expect(chartLabel()).toBeUndefined();
  await act(() => render({ selected: 'wallet-b' }));
  expect(chartLabel()).toBeUndefined();
});

it('keeps manual history refresh available during an ordinary background balance poll', async () => {
  await act(() => render({ loading: true }));
  expect(refreshButton()).not.toBeNull();
  expect(refreshButton()!.disabled).toBe(false);
});

it.each(['0', '-100000'])('preserves a real current equity of %s quote lots', async (value) => {
  setEquity(value);
  await act(() => render());
  expect(chartLabel()).toContain(`to ${value === '0' ? '0.00' : '-0.10'} USDC`);
  expect(container.querySelector('.asset-value')?.textContent).toContain(
    value === '0' ? '0.00' : '-0.10',
  );
});

it('does not invent a past trend when the history endpoint is empty', async () => {
  api.read.mockResolvedValue([]);
  await act(() => render());
  expect(chartLabel()).toBeUndefined();
  expect(container.textContent).toContain('History appears here');
});
