import { useEffect, useRef, useState, type UIEvent } from 'react';

/** Follow scroll direction, with a small dead zone for touch/trackpad jitter. */
export function useCompactNavigation(routeKey: string) {
  const [scroll, setScroll] = useState({ routeKey, compact: false });
  const movement = useRef({
    routeKey,
    target: null as HTMLElement | null,
    top: 0,
    distance: 0,
  });
  const compact = scroll.routeKey === routeKey && scroll.compact;
  useEffect(() => {
    setScroll({ routeKey, compact: false });
    movement.current = { routeKey, target: null, top: 0, distance: 0 };
  }, [routeKey]);
  function expand() {
    movement.current.distance = 0;
    setScroll((current) =>
      current.routeKey === routeKey && !current.compact ? current : { routeKey, compact: false },
    );
  }
  function onScrollCapture(event: UIEvent<HTMLElement>) {
    const target = event.target;
    // Sheets and horizontal category strips have their own scroll behaviour.
    if (!(target instanceof HTMLElement) || !target.matches('.page-scroll, .trade-scroll')) return;
    // Ignore iOS overscroll beyond either end of the content.
    const maxTop = Math.max(0, target.scrollHeight - target.clientHeight);
    const top = Math.max(0, maxTop > 0 ? Math.min(target.scrollTop, maxTop) : target.scrollTop);
    const previous = movement.current;
    if (previous.routeKey !== routeKey || previous.target !== target) {
      movement.current = { routeKey, target, top: 0, distance: 0 };
    }
    const direction = movement.current;
    const delta = top - direction.top;
    if (delta !== 0) {
      direction.distance =
        Math.sign(delta) === Math.sign(direction.distance) ? direction.distance + delta : delta;
    }
    direction.top = top;
    const next =
      top < 32 || direction.distance <= -6
        ? false
        : top > 88 && direction.distance >= 14
          ? true
          : compact;
    if (next !== compact || scroll.routeKey !== routeKey) setScroll({ routeKey, compact: next });
  }
  return { compact, expand, onScrollCapture };
}
