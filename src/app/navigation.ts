export type Tab = 'home' | 'markets' | 'trade' | 'assets';
export type Screen = 'app' | 'account' | 'signup' | 'login' | 'search';
export type Route = { tab: Tab; symbol: string; screen: Screen };

export function readRoute(url = new URL(location.href)): Route {
  const tab = url.searchParams.get('tab');
  const screen = url.pathname.slice(1);
  return {
    tab: (['home', 'markets', 'trade', 'assets'].includes(tab ?? '') ? tab : 'home') as Tab,
    // Phoenix has case-sensitive symbols such as kBONK; keep the venue spelling.
    symbol: url.searchParams.get('market')?.trim() || 'SOL',
    screen: (['account', 'signup', 'login', 'search'].includes(screen) ? screen : 'app') as Screen,
  };
}

export function routeUrl(route: Route, current = new URL(location.href)) {
  const url = new URL(current);
  url.pathname = route.screen === 'app' ? '/' : `/${route.screen}`;
  url.searchParams.set('tab', route.tab);
  url.searchParams.set('market', route.symbol);
  return url;
}

/** A localhost QR cannot open this machine from a phone. Never offer one. */
export function phoneUrl(current: URL): string | undefined {
  if (current.protocol !== 'https:') return undefined;
  const host = current.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    /^127\./.test(host)
  )
    return undefined;
  // Only share the public route, never unrelated query parameters or a URL fragment.
  const url = routeUrl(readRoute(current), new URL(current.origin));
  return url.toString();
}
