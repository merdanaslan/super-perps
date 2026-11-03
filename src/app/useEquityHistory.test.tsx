// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PortfolioValueDataPoint } from '@ellipsis-labs/rise';
import { useEquityHistory } from './useEquityHistory';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocked = vi.hoisted(() => {
  const read = vi.fn();
  return {
    read,
    visible: true,
    online: true,
    client: { api: { traders: () => ({ getTraderPortfolioValues: read }) } },
  };
});
vi.mock('./market-data', () => ({
  useMarkets: () => ({ client: mocked.client }),
  usePageVisible: () => mocked.visible,
}));
vi.mock('../pwa/connectivity', () => ({ useOnline: () => mocked.online }));
let container: HTMLDivElement;
let root: Root;
function Harness({ trader }: { trader?: string }) {
  const history = useEquityHistory(trader);
  return <output>{JSON.stringify(history)}</output>;
}
const state = () => JSON.parse(container.textContent!);
const row = (value: number): PortfolioValueDataPoint => ({
  timestamp: Date.now() / 1_000,
  startTime: Date.now() / 1_000 - 900,
  endTime: Date.now() / 1_000,
  value,
});
beforeEach(() => {
  vi.useFakeTimers();
  mocked.read.mockReset();
  mocked.visible = true;
  mocked.online = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

it('does not query without an active account or while hidden/offline', async () => {
  await act(() => root.render(<Harness />));
  expect(state().status).toBe('idle');
  mocked.visible = false;
  await act(() => root.render(<Harness trader="account-a" />));
  mocked.visible = true;
  mocked.online = false;
  await act(() => root.render(<Harness trader="account-a" />));
  expect(state().status).toBe('offline');
  expect(mocked.read).not.toHaveBeenCalled();
});

it('rejects late responses from a previous account and clears data on logout', async () => {
  let finishA!: (rows: PortfolioValueDataPoint[]) => void;
  mocked.read.mockImplementationOnce(
    () => new Promise<PortfolioValueDataPoint[]>((resolve) => (finishA = resolve)),
  );
  mocked.read.mockResolvedValueOnce([row(7)]);
  await act(() => root.render(<Harness trader="account-a" />));
  await act(() => root.render(<Harness trader="account-b" />));
  expect(state().points[0]?.value).toBe(7);
  await act(() => finishA([row(999)]));
  expect(state().points[0]?.value).toBe(7);
  await act(() => root.render(<Harness />));
  expect(state().points).toEqual([]);
  expect(state().status).toBe('idle');
});

it('polls slowly and clears stale values after a failed history refresh', async () => {
  mocked.read.mockResolvedValueOnce([row(4)]).mockRejectedValueOnce(new Error('rate limited'));
  await act(() => root.render(<Harness trader="account-a" />));
  expect(state().status).toBe('ready');
  expect(mocked.read).toHaveBeenCalledWith(
    'account-a',
    expect.objectContaining({ resolution: '15m', limit: 100 }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(299_999));
  expect(mocked.read).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(state().status).toBe('error');
  expect(state().points).toEqual([]);
});

it.each(['visible', 'online'] as const)(
  'refreshes history immediately when %s returns',
  async (key) => {
    mocked.read.mockResolvedValueOnce([row(2)]).mockResolvedValueOnce([row(3)]);
    await act(() => root.render(<Harness trader="account-a" />));
    mocked[key] = false;
    await act(() => root.render(<Harness trader="account-a" />));
    await act(async () => vi.advanceTimersByTimeAsync(6 * 60_000));
    expect(mocked.read).toHaveBeenCalledTimes(1);
    mocked[key] = true;
    await act(() => root.render(<Harness trader="account-a" />));
    expect(state().points[0]?.value).toBe(3);
    expect(mocked.read).toHaveBeenCalledTimes(2);
  },
);
