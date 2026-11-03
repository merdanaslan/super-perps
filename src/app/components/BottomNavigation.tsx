import { ArrowDownUp, ChartNoAxesCombined, House, Wallet } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { Tab } from '../navigation';

const items = [
  { tab: 'home', label: 'Home', Icon: House },
  { tab: 'markets', label: 'Markets', Icon: ChartNoAxesCombined },
  { tab: 'trade', label: 'Trade', Icon: ArrowDownUp },
  { tab: 'assets', label: 'Assets', Icon: Wallet },
] as const;

/** Keep icon layout fixed; CSS translates it independently of the resizing glass. */
export function BottomNavigation({
  tab,
  compact,
  onNavigate,
  onExpand,
}: {
  tab: Tab;
  compact: boolean;
  onNavigate: (tab: Tab) => void;
  onExpand: () => void;
}) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = navigation.current;
    if (!element) return;
    // The dock is outside the page scroller. Cancel single-finger movement here
    // so iOS cannot pull the document into its rubber-band area. A native,
    // non-passive listener can cancel scrolling; React's touch handlers cannot.
    // Leave taps and multi-touch zoom gestures to the browser.
    const preventPageDrag = (event: TouchEvent) => {
      if (event.touches.length === 1 && event.cancelable) event.preventDefault();
    };
    element.addEventListener('touchmove', preventPageDrag, { passive: false });
    return () => element.removeEventListener('touchmove', preventPageDrag);
  }, []);
  return (
    <nav
      ref={navigation}
      className="bottom-navigation"
      data-compact={compact}
      aria-label="Main navigation"
      onClick={onExpand}
      onFocusCapture={(event) => {
        // A pointer tap expands with its click, not earlier when focus arrives.
        // Keyboard focus should still reveal the full dock without navigating.
        if (event.target.matches(':focus-visible')) onExpand();
      }}
    >
      <span
        className="navigation-capsule"
        aria-hidden="true"
        style={
          {
            '--navigation-index': items.findIndex((item) => item.tab === tab),
          } as CSSProperties
        }
      />
      {items.map(({ tab: item, label, Icon }, index) => (
        <button
          type="button"
          key={item}
          aria-label={label}
          title={label}
          aria-current={tab === item ? 'page' : undefined}
          style={{ '--navigation-index': index } as CSSProperties}
          onClick={() => onNavigate(item)}
        >
          <Icon size={27} strokeWidth={tab === item ? 2.5 : 1.9} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
