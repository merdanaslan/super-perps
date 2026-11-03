// @vitest-environment happy-dom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
const close = vi.fn();

function Harness({
  canClose = true,
  fullHeight = false,
  contentKey,
  footer,
}: {
  canClose?: boolean;
  fullHeight?: boolean;
  contentKey?: string;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Choose market</button>
      <Sheet
        open={open}
        title="Select market"
        fullHeight={fullHeight}
        contentKey={contentKey}
        footer={footer}
        onClose={() => {
          close();
          if (canClose) setOpen(false);
        }}
      >
        <button>ETH</button>
        <input aria-label="Example amount" />
      </Sheet>
    </>
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  close.mockClear();
  // Pointer capture is a browser API that happy-dom does not implement.
  vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
  vi.spyOn(Element.prototype, 'releasePointerCapture').mockImplementation(() => {});
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openSheet(canClose = true, fullHeight = false) {
  await act(() => root.render(<Harness canClose={canClose} fullHeight={fullHeight} />));
  await act(() => container.querySelector('button')!.click());
}

it('keeps the review action outside scrolling details and inside the sheet focus trap', async () => {
  await act(() => root.render(<Harness footer={<button>Confirm & sign</button>} />));
  await act(() => container.querySelector('button')!.click());
  const dialog = document.querySelector('[role="dialog"]')!;
  const action = [...dialog.querySelectorAll('button')].find(
    (button) => button.textContent === 'Confirm & sign',
  );
  expect(action).toBeTruthy();
  expect(action!.closest('.sheet-body')).toBeNull();
  expect(action!.closest('[role="dialog"]')).toBe(dialog);
  expect(dialog.querySelector('.sheet-body input')).toBeTruthy();
});
async function nextFrame() {
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

function grip() {
  return document.querySelector<HTMLElement>('.sheet-grip')!;
}
async function pointer(target: Element, type: string, y: number, x = 150) {
  expect(target).toBeTruthy();
  await act(() => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  });
}

it('closes from a downward drag on the grip and can reopen in its original position', async () => {
  await openSheet();
  const handle = grip();
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', 200);
  expect(close).not.toHaveBeenCalled();
  await pointer(handle, 'pointerup', 200);
  expect(close).toHaveBeenCalledOnce();
  await act(() => container.querySelector('button')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  // A tap after reopening must not reuse the previous drag distance.
  await pointer(grip(), 'pointerdown', 100);
  await pointer(grip(), 'pointerup', 100);
  expect(close).toHaveBeenCalledOnce();
});

it.each([
  ['short', 125, 150, 'pointerup'],
  ['upward', 0, 150, 'pointerup'],
  ['mostly horizontal', 200, 400, 'pointerup'],
  ['cancelled', 200, 150, 'pointercancel'],
  ['lost capture', 200, 150, 'lostpointercapture'],
] as const)('keeps the sheet open after a %s gesture', async (_name, y, x, end) => {
  await openSheet();
  const handle = grip();
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', y, x);
  await pointer(handle, end, y, x);
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();
});

it('does not dismiss when scrolling or dragging the market list', async () => {
  await openSheet();
  const body = document.querySelector('.sheet-body')!;
  await pointer(body, 'pointerdown', 100);
  await pointer(body, 'pointermove', 250);
  await pointer(body, 'pointerup', 250);
  expect(close).not.toHaveBeenCalled();
});

it('respects the caller refusing dismissal, as during a transaction', async () => {
  await openSheet(false);
  const handle = grip();
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointerup', 200);
  expect(close).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();
});

it('fits the visible viewport above the keyboard and resets after dismissal', async () => {
  const viewport = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    scale: 1,
  });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const popup = document.querySelector<HTMLElement>('.sheet-viewport')!;
  await act(() => {
    viewport.height = 360;
    viewport.offsetTop = 180;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(popup.style.getPropertyValue('--sheet-viewport-height')).toBe('360px');
  expect(popup.style.getPropertyValue('--sheet-viewport-top')).toBe('180px');
  expect(popup.style.getPropertyValue('--sheet-viewport-inset')).toBe('484px');
  await act(() => {
    viewport.offsetTop = 140;
    viewport.dispatchEvent(new Event('scroll'));
  });
  await nextFrame();
  expect(popup.style.getPropertyValue('--sheet-viewport-top')).toBe('140px');
  await act(() => {
    viewport.height = 844;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(popup.style.getPropertyValue('--sheet-viewport-height')).toBe('844px');
  expect(popup.style.getPropertyValue('--sheet-viewport-top')).toBe('0px');
  expect(popup.style.getPropertyValue('--sheet-viewport-inset')).toBe('0px');
});

it('reveals the focused field by scrolling only the sheet body', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const field = body.querySelector<HTMLInputElement>('input')!;
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 200, 390, 200));
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(20, 700 - body.scrollTop, 300, 32),
  );
  await act(() => field.focus());
  const documentTop = document.documentElement.scrollTop;
  await act(() => {
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(body.scrollTop).toBeGreaterThan(0);
  expect(field.getBoundingClientRect().top).toBeGreaterThanOrEqual(200);
  expect(field.getBoundingClientRect().bottom).toBeLessThanOrEqual(400);
  expect(document.documentElement.scrollTop).toBe(documentTop);
});

it('does not treat deliberate pinch zoom as a keyboard opening', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  await act(() => {
    viewport.height = 422;
    viewport.scale = 2;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  const popup = document.querySelector<HTMLElement>('.sheet-viewport')!;
  expect(popup.style.getPropertyValue('--sheet-viewport-inset')).toBe('');
  expect(popup.style.getPropertyValue('--sheet-viewport-height')).toBe('');
  expect(popup.style.getPropertyValue('--sheet-viewport-top')).toBe('');
});

it('keeps the CSS layout usable when the visual viewport API is unavailable', async () => {
  vi.stubGlobal('visualViewport', undefined);
  await openSheet();
  const popup = document.querySelector<HTMLElement>('.sheet-viewport')!;
  expect(popup).not.toBeNull();
  expect(popup.style.getPropertyValue('--sheet-viewport-height')).toBe('');
  expect(popup.style.getPropertyValue('--sheet-viewport-inset')).toBe('');
});

it('reveals the amount again after a late viewport scroll with unchanged dimensions', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const field = body.querySelector<HTMLInputElement>('input')!;
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 200, 390, 200));
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(20, 700 - body.scrollTop, 300, 32),
  );
  await act(() => field.focus());
  await act(() => {
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(field.getBoundingClientRect().bottom).toBeLessThanOrEqual(400);
  // Native focus panning can finish after the initial resize/reveal. Its final
  // scroll event need not carry a new viewport height or offset.
  body.scrollTop = 0;
  await act(() => viewport.dispatchEvent(new Event('scroll')));
  await nextFrame();
  expect(field.getBoundingClientRect().bottom).toBeLessThanOrEqual(400);
});

it('recognizes the keyboard when innerHeight shrinks along with the visual viewport', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  await act(() => {
    vi.stubGlobal('innerHeight', 420);
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(
    document
      .querySelector<HTMLElement>('.sheet-viewport')!
      .style.getPropertyValue('--sheet-viewport-inset'),
  ).toBe('424px');
});

it('reconciles late native focus scrolling once, then leaves manual body scrolling alone', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const field = body.querySelector<HTMLInputElement>('input')!;
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 200, 390, 200));
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(20, 700 - body.scrollTop, 300, 32),
  );
  await act(() => field.focus());
  await act(() => {
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  body.scrollTop = 0;
  // Some native focus adjustments finish without another viewport event.
  await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(field.getBoundingClientRect().bottom).toBeLessThanOrEqual(400);
  body.scrollTop = 0;
  body.dispatchEvent(new Event('scroll'));
  await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(body.scrollTop).toBe(0);
});

it('reveals the whole amount label and unit when they fit above the keyboard', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const field = body.querySelector<HTMLInputElement>('input')!;
  const label = document.createElement('label');
  field.before(label);
  label.append(field);
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 200, 390, 200));
  vi.spyOn(label, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(20, 650 - body.scrollTop, 300, 98),
  );
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(36, 700 - body.scrollTop, 268, 32),
  );
  await act(() => field.focus());
  await act(() => {
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(label.getBoundingClientRect().top).toBeGreaterThanOrEqual(200);
  expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(388);
  // Restore React's original DOM before unmounting the harness.
  label.before(field);
  label.remove();
});

it('does not chase the focused amount while the keyboard returns the viewport', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const field = body.querySelector<HTMLInputElement>('input')!;
  const bodyRect = vi
    .spyOn(body, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 200, 390, 200));
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(20, 700 - body.scrollTop, 300, 32),
  );
  await act(() => field.focus());
  await act(() => {
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  const scrollWhileEditing = body.scrollTop;
  // The keyboard can dismiss while the input retains focus. During the native
  // return, viewport positioning and field positioning can settle separately.
  bodyRect.mockReturnValue(new DOMRect(0, 450, 390, 350));
  await act(() => {
    viewport.height = 700;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(body.scrollTop).toBe(scrollWhileEditing);
  await act(() => {
    viewport.height = 844;
    viewport.dispatchEvent(new Event('resize'));
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 210)));
  expect(body.scrollTop).toBe(scrollWhileEditing);
  expect(document.activeElement).toBe(field);
});

it('resumes field visibility handling when the keyboard reopens during its return', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet();
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const field = body.querySelector<HTMLInputElement>('input')!;
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 200, 390, 200));
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(20, 700 - body.scrollTop, 300, 32),
  );
  await act(() => field.focus());
  for (const height of [420, 700]) {
    await act(() => {
      viewport.height = height;
      viewport.dispatchEvent(new Event('resize'));
    });
    await nextFrame();
  }
  body.scrollTop = 0;
  await act(() => {
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
  });
  await nextFrame();
  expect(field.getBoundingClientRect().bottom).toBeLessThanOrEqual(400);
  expect(field.getBoundingClientRect().top).toBeGreaterThanOrEqual(200);
});

it('preserves a form scroll position when keyboard dismissal would otherwise clamp it', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  await openSheet(true, true);
  const frame = document.querySelector<HTMLElement>('.sheet-viewport')!;
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const content = document.querySelector<HTMLElement>('.sheet-content')!;
  // happy-dom has no layout: model a browser clamping scrollTop as the available
  // body height grows beyond its 600px of form content.
  vi.spyOn(body, 'clientHeight', 'get').mockImplementation(
    () => parseFloat(frame.style.getPropertyValue('--sheet-viewport-height')) - 100,
  );
  // Actual layout can have a fractional height even though clientHeight is an
  // integer. Rounding down must not start a repeating scroll-clamp feedback loop.
  vi.spyOn(body, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 100, 320, body.clientHeight + 0.4),
  );
  let scrollTop = 0;
  const maxScroll = () =>
    Math.max(
      0,
      Math.max(600, parseFloat(content.style.minHeight) || 0) - body.getBoundingClientRect().height,
    );
  vi.spyOn(body, 'scrollTop', 'get').mockImplementation(() => Math.min(scrollTop, maxScroll()));
  vi.spyOn(body, 'scrollTop', 'set').mockImplementation((value) => {
    scrollTop = Math.min(value, maxScroll());
  });
  viewport.height = 420;
  viewport.dispatchEvent(new Event('resize'));
  await nextFrame();
  body.scrollTop = 200;
  viewport.height = 844;
  viewport.dispatchEvent(new Event('resize'));
  await nextFrame();
  expect(body.scrollTop).toBe(200);
  await act(() => new Promise((resolve) => setTimeout(resolve, 210)));
  expect(body.scrollTop).toBe(200);

  // Returning toward the top releases the space without allowing further
  // scrolling to manufacture an ever-longer empty area.
  body.scrollTop = 50;
  body.dispatchEvent(new Event('scroll'));
  expect(body.scrollTop).toBe(50);
  body.scrollTop = 2_000;
  expect(body.scrollTop).toBeLessThanOrEqual(51);
});

it('resets the form scroll space for a new tab without remounting its controls', async () => {
  await openSheet(true, true);
  const body = document.querySelector<HTMLElement>('.sheet-body')!;
  const content = document.querySelector<HTMLElement>('.sheet-content')!;
  const field = content.querySelector('input');
  content.style.minHeight = '900px';
  body.scrollTop = 200;
  await act(() => root.render(<Harness fullHeight contentKey="deposit" />));
  expect(body.scrollTop).toBe(0);
  expect(content.style.minHeight).toBe('');
  expect(content.querySelector('input')).toBe(field);
});
