import { useCallback, useEffect, useState } from 'react';
import { readRoute, routeUrl, type Route } from './navigation';

/** Keep the PWA in one history entry, with a URL that still survives reloads. */
export function useAppRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    // Respect actual browser navigation (including links opened outside the app).
    // Do not trap Back by pushing another entry from a popstate handler.
    const update = () => setRoute(readRoute());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  const replaceRoute = useCallback((next: Route) => {
    // Tabs, market selection and full-page panels are app state, not a browser
    // back stack. In particular, iOS edge swipes must not replay prior tab taps.
    history.replaceState(null, '', routeUrl(next));
    setRoute(next);
  }, []);

  return [route, replaceRoute] as const;
}
