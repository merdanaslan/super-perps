import { describe, expect, it, vi } from 'vitest';
import { createRelay, readLimitedBody } from './relay.ts';

const origin = 'https://app.example.test';
const privateKey = 'EXAMPLE_PROVIDER_CREDENTIAL_ONLY';
const upstream = `https://rpc.example.test/?api-key=${privateKey}`;
const user = { sub: 'did:privy:test-user', exp: Math.floor(Date.now() / 1000) + 3600 };
const options = () => ({
  rpcUrl: upstream,
  wsUrl: upstream.replace('https:', 'wss:'),
  origins: [origin],
  verifyToken: async (token: string) => {
    if (token !== 'test-session-token') throw new Error('Invalid token');
    return user;
  },
});
function req(
  body: unknown = { jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] },
  headers: Record<string, string> = {},
  path = '/api/solana',
) {
  return new Request(origin + path, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      cookie: 'super_perps_rpc=test-session-token',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
const ok = () =>
  new Response('{"jsonrpc":"2.0","id":1,"result":42}', {
    headers: { 'content-type': 'application/json' },
  });

describe('authenticated RPC relay', () => {
  it('stops reading a stalled request when its deadline expires', async () => {
    const abort = new AbortController();
    const canceled = vi.fn();
    const body = new ReadableStream({ cancel: canceled });
    const request = new Request(origin, {
      method: 'POST',
      body,
      signal: abort.signal,
      duplex: 'half',
    } as RequestInit);
    const reading = readLimitedBody(request, 100);
    const rejected = expect(reading).rejects.toThrow();
    abort.abort();
    await rejected;
    expect(canceled).toHaveBeenCalledOnce();
  }, 1000);
  it('forwards only the configured upstream and never forwards browser credentials', async () => {
    const send = vi.fn().mockResolvedValue(ok());
    const relay = createRelay({ ...options(), fetch: send });
    const response = await relay.handle(
      req(undefined, { authorization: 'Bearer user-token', 'x-extra': 'private' }),
    );
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
    const [url, init] = send.mock.calls[0]!;
    expect(url).toBe(upstream);
    expect(new Headers(init.headers).has('cookie')).toBe(false);
    expect(new Headers(init.headers).has('authorization')).toBe(false);
    expect(new Headers(init.headers).has('origin')).toBe(false);
    expect(init.redirect).toBe('error');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    { cookie: '' },
    { cookie: 'super_perps_rpc=wrong' },
    { origin: 'https://evil.test' },
    { origin: '' },
    { 'sec-fetch-site': 'cross-site' },
  ] as Record<string, string>[])(
    'rejects invalid sessions and cross-origin requests before forwarding: %j',
    async (headers) => {
      const send = vi.fn();
      const response = await createRelay({ ...options(), fetch: send }).handle(
        req(undefined, headers),
      );
      expect([401, 403]).toContain(response.status);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('refuses a batch without contacting the provider', async () => {
    const send = vi.fn();
    expect(
      (
        await createRelay({ ...options(), fetch: send }).handle(
          req([{ jsonrpc: '2.0', id: 1, method: 'getSlot' }]),
        )
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('preserves integers above Number.MAX_SAFE_INTEGER in successful responses', async () => {
    const raw = '{"jsonrpc":"2.0","id":1,"result":{"value":18446744073709551615}}';
    const relay = createRelay({
      ...options(),
      fetch: vi.fn().mockResolvedValue(new Response(raw)),
    });
    expect(await (await relay.handle(req())).text()).toBe(raw);
  });

  it('redacts provider credentials while preserving useful simulation diagnostics', async () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: {
        value: {
          err: { InstructionError: [0, 'Custom'] },
          logs: ['Insufficient funds', upstream, privateKey],
        },
      },
    });
    const relay = createRelay({
      ...options(),
      fetch: vi.fn().mockResolvedValue(new Response(raw)),
    });
    const result = await (await relay.handle(req())).text();
    expect(result).not.toContain(privateKey);
    expect(result).not.toContain(upstream);
    expect(JSON.parse(result).result.value.logs[0]).toBe('Insufficient funds');
  });

  it('redacts path credentials even when the provider returns only the key', async () => {
    const key = 'EXAMPLE_PRIVATE_PATH_CREDENTIAL';
    const relay = createRelay({
      ...options(),
      rpcUrl: `https://rpc.example.test/v2/${key}`,
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { message: key } })),
        ),
    });
    const response = await relay.handle(req());
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(key);
  });

  it.each([401, 429, 503])(
    'does not expose upstream error bodies or headers for HTTP %s',
    async (status) => {
      const relay = createRelay({
        ...options(),
        fetch: vi
          .fn()
          .mockResolvedValue(new Response(upstream, { status, headers: { location: upstream } })),
      });
      const response = await relay.handle(req());
      expect(response.status).toBe(status === 429 ? 429 : 502);
      expect(await response.text()).not.toContain(privateKey);
      expect(response.headers.has('location')).toBe(false);
    },
  );

  it('never retries an ambiguous transaction submission', async () => {
    const send = vi.fn().mockRejectedValue(new Error(upstream));
    const response = await createRelay({ ...options(), fetch: send }).handle(
      req({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: ['AQ==', { encoding: 'base64', maxRetries: 0 }],
      }),
    );
    expect(response.status).toBe(502);
    expect(send).toHaveBeenCalledOnce();
    expect(await response.text()).not.toContain(privateKey);
  });

  it('bounds upstream response bytes', async () => {
    const response = await createRelay({
      ...options(),
      fetch: vi.fn().mockResolvedValue(new Response('x'.repeat(1_048_577))),
    }).handle(req());
    expect(response.status).toBe(502);
  });

  it('cancels an oversized upstream body before reading it', async () => {
    const canceled = vi.fn();
    const response = new Response(new ReadableStream({ cancel: canceled }), {
      headers: { 'content-length': '1048577' },
    });
    const relay = createRelay({ ...options(), fetch: vi.fn().mockResolvedValue(response) });
    expect((await relay.handle(req())).status).toBe(502);
    expect(canceled).toHaveBeenCalledOnce();
  });

  it('limits repeated calls per authenticated user', async () => {
    const send = vi.fn().mockImplementation(ok);
    const relay = createRelay({ ...options(), fetch: send, requestsPerMinute: 2 });
    expect((await relay.handle(req())).status).toBe(200);
    expect((await relay.handle(req())).status).toBe(200);
    const denied = await relay.handle(req());
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('exchanges a verified login token for a short HttpOnly cookie, not a URL token', async () => {
    const relay = createRelay(options());
    const response = await relay.handle(
      req({}, { cookie: '', authorization: 'Bearer test-session-token' }, '/api/rpc-session'),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/solana');
    expect(cookie).toContain('Max-Age=300');
    expect(await response.text()).not.toContain('test-session-token');
  });

  it('clears the relay cookie on logout', async () => {
    const response = await createRelay(options()).handle(
      new Request(origin + '/api/rpc-session', { method: 'DELETE', headers: { origin } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('fails closed without provider configuration', async () => {
    expect((await createRelay({ ...options(), rpcUrl: '' }).handle(req())).status).toBe(503);
  });
});
