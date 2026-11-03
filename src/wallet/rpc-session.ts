/** Direct public providers remain supported for static forks and CLI probes. */
export function isRelayUrl(value: string) {
  if (typeof location === 'undefined') return false;
  const url = new URL(value, location.origin);
  url.protocol = url.protocol.replace(/^ws/, 'http');
  return url.origin === location.origin && url.pathname === '/api/solana' && !url.search;
}

export function createRpcSession(getToken: () => Promise<string | null>) {
  let cached: { token: string; expiresAt: number } | undefined;
  let pending: Promise<void> | undefined;
  let clearing: Promise<void> | undefined;
  let generation = 0;
  const changed = () => new Error('Wallet session changed. Please try again.');
  const invalidate = () => {
    cached = undefined;
  };
  async function ensure(): Promise<void> {
    if (clearing) throw changed();
    const current = generation;
    const token = await getToken();
    if (current !== generation) throw changed();
    if (!token) {
      invalidate();
      throw new Error('Sign in again to reconnect your wallet.');
    }
    if (pending) {
      await pending;
      return ensure();
    }
    if (cached?.token === token && cached.expiresAt > Date.now() + 30_000) return;
    pending = (async () => {
      const response = await fetch('/api/rpc-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Sign in again to reconnect your wallet.'
            : 'Wallet connection unavailable. Please retry.',
        );
      const { expiresAt } = (await response.json()) as { expiresAt?: number };
      if (current !== generation) throw changed();
      if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 30_000)
        throw new Error('Wallet session expired. Sign in again.');
      cached = { token, expiresAt };
    })();
    try {
      await pending;
    } finally {
      pending = undefined;
    }
  }
  function clear() {
    if (clearing) return clearing;
    generation++;
    invalidate();
    // A response already in flight can still set a cookie. Clear it after that
    // response settles, and refuse callers from the previous wallet session.
    clearing = (async () => {
      await pending?.catch(() => {});
      await fetch('/api/rpc-session', {
        method: 'DELETE',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(8_000),
      });
    })().finally(() => {
      clearing = undefined;
    });
    return clearing;
  }
  return { ensure, clear, invalidate };
}

let getToken: () => Promise<string | null> = async () => null;
// Registered by the lazy Privy module: public market browsing does not load Privy.
export function registerRpcTokenGetter(getter: typeof getToken) {
  getToken = getter;
}
const session = createRpcSession(() => getToken());
export const ensureRpcSession = (url: string) =>
  isRelayUrl(url) ? session.ensure() : Promise.resolve();
export const invalidateRpcSession = session.invalidate;
export const clearRpcSession = session.clear;
