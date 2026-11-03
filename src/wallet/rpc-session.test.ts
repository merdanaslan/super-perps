// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createRpcSession, isRelayUrl } from './rpc-session';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const response = () => Response.json({ expiresAt: Date.now() + 300_000 });

it('recognizes only the same-origin HTTP and WebSocket relay', () => {
  const url = new URL('/api/solana', location.origin);
  expect(isRelayUrl(url.href)).toBe(true);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  expect(isRelayUrl(url.href)).toBe(true);
  expect(isRelayUrl('https://elsewhere.test/api/solana')).toBe(false);
  expect(isRelayUrl('/api/solana?key=example')).toBe(false);
});

it('shares cookie setup between concurrent RPC calls and renews before expiry', async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal('fetch', send);
  const session = createRpcSession(async () => 'user-token');
  await Promise.all([session.ensure(), session.ensure(), session.ensure()]);
  await session.ensure();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]?.[1]).toMatchObject({
    method: 'POST',
    credentials: 'same-origin',
    headers: { authorization: 'Bearer user-token' },
  });
  vi.setSystemTime(Date.now() + 290_000);
  await session.ensure();
  expect(send).toHaveBeenCalledTimes(2);
});

it('never requests a session when logged out', async () => {
  const send = vi.fn();
  vi.stubGlobal('fetch', send);
  await expect(createRpcSession(async () => null).ensure()).rejects.toThrow(/Sign in/);
  expect(send).not.toHaveBeenCalled();
});

it('replaces the cookie when Privy changes tokens', async () => {
  const send = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal('fetch', send);
  let token = 'first';
  const session = createRpcSession(async () => token);
  await session.ensure();
  token = 'second';
  await session.ensure();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1]?.[1].headers.authorization).toBe('Bearer second');
});

it('does not retry failed authentication or expose response details', async () => {
  const send = vi.fn().mockResolvedValue(new Response('private backend detail', { status: 401 }));
  vi.stubGlobal('fetch', send);
  await expect(createRpcSession(async () => 'user-token').ensure()).rejects.toThrow(
    'Sign in again',
  );
  expect(send).toHaveBeenCalledOnce();
});

it('clears a late session cookie on logout and rejects waiting RPC callers', async () => {
  let finish!: (response: Response) => void;
  const send = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', send);
  const session = createRpcSession(async () => 'user-token');
  const pending = session.ensure();
  const failed = expect(pending).rejects.toThrow(/changed/);
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
  const clearing = session.clear();
  finish(response());
  await failed;
  await clearing;
  expect(send.mock.calls[1]?.[1].method).toBe('DELETE');
});
