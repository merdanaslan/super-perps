// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BottomNavigation } from './BottomNavigation';
import { useCompactNavigation } from '../useCompactNavigation';
import type { Tab } from '../navigation';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
const navigate = vi.fn();
function Harness({ tab = 'home' }: { tab?: Tab }) {
  const scroll = useCompactNavigation(tab);
  return (
    <>
      <main onScrollCapture={scroll.onScrollCapture}>
        <div className="page-scroll" />
        <div className="market-category-tabs" />
        <div className="trade-scroll" />
      </main>
      <BottomNavigation
        tab={tab}
        compact={scroll.compact}
        onNavigate={navigate}
        onExpand={scroll.expand}
      />
    </>
  );
}
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  navigate.mockClear();
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});
async function scrollTo(selector: string, top: number) {
  const element = container.querySelector<HTMLElement>(selector)!;
  await act(() => {
    element.scrollTop = top;
    element.dispatchEvent(new Event('scroll'));
  });
}
const compact = () => container.querySelector('nav')!.getAttribute('data-compact');

it('keeps all four destinations labelled and routes immediately', async () => {
  await act(() => root.render(<Harness tab="markets" />));
  expect(
    Array.from(container.querySelectorAll('nav button')).map((el) => el.getAttribute('aria-label')),
  ).toEqual(['Home', 'Markets', 'Trade', 'Assets']);
  expect(container.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe(
    'Markets',
  );
  await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Trade"]')!.click());
  expect(navigate).toHaveBeenCalledWith('trade');
});

it('compacts while scrolling down and expands on upward movement away from the top', async () => {
  await act(() => root.render(<Harness />));
  await scrollTo('.market-category-tabs', 180);
  expect(compact()).toBe('false');
  await scrollTo('.page-scroll', 180);
  expect(compact()).toBe('true');
  await scrollTo('.page-scroll', 177);
  expect(compact()).toBe('true');
  await scrollTo('.page-scroll', 173);
  expect(compact()).toBe('false');
  await scrollTo('.page-scroll', 177);
  expect(compact()).toBe('false');
  await scrollTo('.page-scroll', 190);
  expect(compact()).toBe('true');
  await scrollTo('.page-scroll', 0);
  expect(compact()).toBe('false');
  await scrollTo('.trade-scroll', 150);
  expect(compact()).toBe('true');
});

it('expands on a dock tap or keyboard focus without requiring a different route', async () => {
  await act(() => root.render(<Harness tab="markets" />));
  await scrollTo('.page-scroll', 200);
  const button = container.querySelector<HTMLButtonElement>('[aria-label="Markets"]')!;
  await act(() => button.click());
  expect(compact()).toBe('false');
  expect(navigate).toHaveBeenCalledWith('markets');
  await scrollTo('.page-scroll', 240);
  expect(compact()).toBe('true');
  await act(() => button.focus());
  expect(compact()).toBe('false');
});

it('starts expanded when changing tabs or returning to a previous tab', async () => {
  await act(() => root.render(<Harness tab="markets" />));
  await scrollTo('.page-scroll', 180);
  expect(compact()).toBe('true');
  await act(() => root.render(<Harness tab="home" />));
  expect(compact()).toBe('false');
  await act(() => root.render(<Harness tab="markets" />));
  expect(compact()).toBe('false');
});

it.each([false, true])(
  'blocks dock swipes without blocking page swipes (compact: %s)',
  async (isCompact) => {
    await act(() => root.render(<Harness />));
    if (isCompact) await scrollTo('.page-scroll', 180);

    for (const target of container.querySelectorAll('nav, nav button')) {
      const move = new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [new Touch({ identifier: 1, target })],
      });
      target.dispatchEvent(move);
      expect(move.defaultPrevented).toBe(true);
    }

    const page = container.querySelector('.page-scroll')!;
    const pageMove = new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [new Touch({ identifier: 1, target: page })],
    });
    page.dispatchEvent(pageMove);
    expect(pageMove.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  },
);

it('leaves dock taps and two-finger zoom gestures available', async () => {
  await act(() => root.render(<Harness />));
  const button = container.querySelector<HTMLButtonElement>('[aria-label="Assets"]')!;
  const touch = new Touch({ identifier: 1, target: button });
  const tapStart = new TouchEvent('touchstart', {
    bubbles: true,
    cancelable: true,
    touches: [touch],
  });
  button.dispatchEvent(tapStart);
  expect(tapStart.defaultPrevented).toBe(false);

  const pinch = new TouchEvent('touchmove', {
    bubbles: true,
    cancelable: true,
    touches: [touch, new Touch({ identifier: 2, target: button })],
  });
  button.dispatchEvent(pinch);
  expect(pinch.defaultPrevented).toBe(false);
  await act(() => button.click());
  expect(navigate).toHaveBeenCalledWith('assets');
});
