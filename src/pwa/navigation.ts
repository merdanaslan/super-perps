const appPaths = new Set(['/', '/account', '/search', '/signup', '/login']);

export function isAppNavigation(request: Request, origin: string) {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    request.mode === 'navigate' &&
    url.origin === origin &&
    appPaths.has(url.pathname)
  );
}
