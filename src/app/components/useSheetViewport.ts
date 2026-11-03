import { useLayoutEffect } from 'react';

function revealFocusedField(viewport: HTMLElement) {
  const field = document.activeElement;
  const body = viewport.querySelector<HTMLElement>('.sheet-body');
  if (
    !(field instanceof HTMLElement) ||
    !body?.contains(field) ||
    !field.matches('input, textarea, select')
  )
    return;

  const visible = body.getBoundingClientRect();
  const label = field.closest('label');
  // Keep the amount's label/unit visible too, unless the keyboard leaves too
  // little room. Scroll only this body: scrollIntoView can also pan the page.
  const target = label && body.contains(label) ? label.getBoundingClientRect() : null;
  const rect =
    target && target.height <= visible.height - 24 ? target : field.getBoundingClientRect();
  const below = rect.bottom - visible.bottom + 12;
  const above = rect.top - visible.top - 12;
  if (below > 1) body.scrollTop += below;
  else if (above < -1) body.scrollTop += above;
}

/** Fit one positioning container to the visible screen; only its body scrolls. */
export function useSheetViewport(
  enabled: boolean,
  container: HTMLElement | null,
  preserveScroll = false,
) {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !container || !viewport) return;

    let fullHeight = Math.max(window.innerHeight, viewport.height);
    let width = window.innerWidth;
    let previousHeight = viewport.height;
    let wasKeyboardOpen = false;
    let keyboardReturning = false;
    let frame = 0;
    let settleTimer = 0;
    const body = preserveScroll ? container.querySelector<HTMLElement>('.sheet-body') : null;
    const content = () => body?.querySelector<HTMLElement>('.sheet-content');
    const scrollFloor = (scrollTop: number) => {
      if (!body) return 0;
      const style = getComputedStyle(body);
      const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      // clientHeight rounds to an integer. Round the actual layout height up so
      // subpixel clamping cannot trigger another scroll/space-release cycle.
      const height = Math.max(body.clientHeight, body.getBoundingClientRect().height);
      return Math.max(0, Math.ceil(height - padding + scrollTop));
    };
    const releaseScrollSpace = () => {
      const inner = content();
      if (!body || !inner) return;
      const floor = scrollFloor(body.scrollTop);
      // Scrolling back up releases the temporary space. Never add space in
      // response to a scroll, so dragging cannot extend the page into emptiness.
      if (floor < parseFloat(inner.style.minHeight)) inner.style.minHeight = `${floor}px`;
    };
    const update = () => {
      const scrollTop = body?.scrollTop ?? 0;
      // Leave deliberate pinch zoom alone, without counter-scaling the app.
      if (Math.abs(viewport.scale - 1) > 0.01 || viewport.height <= 0) {
        container.style.removeProperty('--sheet-viewport-height');
        container.style.removeProperty('--sheet-viewport-top');
        container.style.removeProperty('--sheet-viewport-inset');
        keyboardReturning = false;
        wasKeyboardOpen = false;
        previousHeight = viewport.height;
        content()?.style.removeProperty('min-height');
        return;
      }
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        fullHeight = Math.max(window.innerHeight, viewport.height);
        keyboardReturning = false;
      } else if (viewport.height < previousHeight - 1) {
        // Reopening must fit the keyboard immediately, even mid-return.
        keyboardReturning = false;
      } else if (wasKeyboardOpen && viewport.height > previousHeight + 1) {
        keyboardReturning = true;
      }
      fullHeight = Math.max(fullHeight, window.innerHeight, viewport.height);
      previousHeight = viewport.height;
      wasKeyboardOpen = fullHeight - viewport.height > 120;
      container.style.setProperty('--sheet-viewport-height', `${viewport.height}px`);
      // Follow native keyboard geometry directly. A separate height transition
      // falls behind iOS's keyboard animation and produces a second adjustment.
      container.style.setProperty('--sheet-viewport-top', `${viewport.offsetTop}px`);
      container.style.setProperty(
        '--sheet-viewport-inset',
        `${Math.max(0, fullHeight - viewport.height)}px`,
      );
      const inner = content();
      if (body && inner) {
        // A growing scrollport otherwise clamps scrollTop before the next
        // paint. Preserve just enough content height to keep the field in place
        // as the keyboard closes; changing tabs or closing the sheet resets it.
        inner.style.minHeight = `${scrollFloor(scrollTop)}px`;
        body.scrollTop = scrollTop;
      }
      // The input may retain focus after Done. Do not fight native dismissal
      // with another scroll correction, including the trailing settle pass.
      if (!keyboardReturning) revealFocusedField(container);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const onViewportChange = () => {
      schedule();
      // Native focus scrolling can finish after resize, even with unchanged
      // viewport bounds. Reconcile once after it settles, not on body scrolling.
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(schedule, 160);
    };
    const onFocus = (event: FocusEvent) => {
      // Dialog focus restoration or a button tap is not a new editing session.
      if (
        !(event.target instanceof HTMLElement) ||
        !event.target.matches('input, textarea, select')
      )
        return;
      keyboardReturning = false;
      onViewportChange();
    };
    update();
    viewport.addEventListener('resize', onViewportChange);
    viewport.addEventListener('scroll', onViewportChange);
    viewport.addEventListener('scrollend', onViewportChange);
    window.addEventListener('resize', onViewportChange);
    container.addEventListener('focusin', onFocus);
    body?.addEventListener('scroll', releaseScrollSpace);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      viewport.removeEventListener('resize', onViewportChange);
      viewport.removeEventListener('scroll', onViewportChange);
      viewport.removeEventListener('scrollend', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      container.removeEventListener('focusin', onFocus);
      body?.removeEventListener('scroll', releaseScrollSpace);
      // Retain the last geometry during the sheet's exit transition. The portal
      // removes the container afterward; reopening measures the viewport afresh.
    };
  }, [enabled, container, preserveScroll]);
}
