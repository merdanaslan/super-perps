import type { BeforeSendEvent } from '@vercel/analytics/react';

/** Basic visits only: never send URL tokens, search text or diagnostic routes. */
export function analyticsBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== 'pageview') return null;
  try {
    const url = new URL(event.url);
    if (!['/', '/account', '/search', '/login', '/signup'].includes(url.pathname)) return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
