// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readRoute, type Route } from './navigation';
import { useAppRoute } from './useAppRoute';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
let navigation: ReturnType<typeof useAppRoute>;
function Harness() {
  navigation = useAppRoute();
  return <output>{JSON.stringify(navigation[0])}</output>;
}

beforeEach(() => {
  history.replaceState(null, '', '/?tab=trade&market=SOL');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it('keeps repeated tab and market changes in one history entry', async () => {
  await act(() => root.render(<Harness />));
  const initialLength = history.length;
  const push = vi.spyOn(history, 'pushState');
  const routes: Route[] = [
    { tab: 'assets', symbol: 'SOL', screen: 'app' },
    { tab: 'home', symbol: 'SOL', screen: 'app' },
    { tab: 'markets', symbol: 'SOL', screen: 'app' },
    { tab: 'trade', symbol: 'ETH', screen: 'app' },
    { tab: 'assets', symbol: 'ETH', screen: 'app' },
  ];
  for (const next of routes) {
    await act(() => navigation[1](next));
    expect(history.length).toBe(initialLength);
    expect(readRoute()).toEqual(next);
    expect(JSON.parse(container.textContent!)).toEqual(next);
  }
  expect(push).not.toHaveBeenCalled();
});

it.each(['search', 'account'] as const)(
  'opens and closes %s in place, retaining the underlying tab and market',
  async (screen) => {
    await act(() => root.render(<Harness />));
    const initialLength = history.length;
    const back = vi.spyOn(history, 'back');
    await act(() => navigation[1]({ ...navigation[0], screen }));
    expect(location.pathname).toBe(`/${screen}`);
    await act(() => navigation[1]({ ...navigation[0], screen: 'app' }));
    expect(navigation[0]).toEqual({ tab: 'trade', symbol: 'SOL', screen: 'app' });
    expect(history.length).toBe(initialLength);
    expect(back).not.toHaveBeenCalled();
  },
);

it('restores a direct link and the latest route on remount', async () => {
  history.replaceState(null, '', '/search?tab=home&market=kBONK');
  await act(() => root.render(<Harness />));
  expect(navigation[0]).toEqual({ tab: 'home', symbol: 'kBONK', screen: 'search' });
  const next: Route = { tab: 'trade', symbol: 'kPEPE', screen: 'app' };
  await act(() => navigation[1](next));
  await act(() => root.render(null));
  await act(() => root.render(<Harness />));
  expect(navigation[0]).toEqual(next);
});

it('respects an actual browser history traversal without creating a navigation trap', async () => {
  await act(() => root.render(<Harness />));
  const push = vi.spyOn(history, 'pushState');
  history.replaceState(null, '', '/?tab=markets&market=BTC');
  await act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(navigation[0]).toEqual({ tab: 'markets', symbol: 'BTC', screen: 'app' });
  expect(push).not.toHaveBeenCalled();
});
