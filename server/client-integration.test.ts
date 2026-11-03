import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { createRelay } from './relay.ts';
import { nodeHandler } from './node.ts';
import { createSocketRelay } from './socket.ts';

const cleanup: (() => void | Promise<void>)[] = [];
const nativeFetch = globalThis.fetch;
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  vi.unstubAllGlobals();
});
async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

it('connects the actual app and Kit transports through authenticated HTTP and WS relays', async () => {
  const upstreamMessages: string[] = [];
  const upstream = createServer((_req, response) => {
    response.end();
  });
  const upstreamUrl = await listen(upstream);
  const wsServer = new WebSocketServer({ server: upstream });
  cleanup.push(() => {
    wsServer.clients.forEach((ws) => ws.terminate());
    wsServer.close();
  });
  wsServer.on('connection', (ws) =>
    ws.on('message', (raw) => {
      const rpc = JSON.parse(raw.toString());
      upstreamMessages.push(rpc.method);
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: rpc.id,
          result: rpc.method === 'accountSubscribe' ? 17 : true,
        }),
      );
      if (rpc.method === 'accountSubscribe')
        setTimeout(
          () =>
            ws.send(
              '{"jsonrpc":"2.0","method":"accountNotification","params":{"subscription":17,"result":{"context":{"slot":1},"value":{"lamports":18446744073709551615,"data":["","base64"],"owner":"11111111111111111111111111111111","executable":false,"rentEpoch":0,"space":0}}}}',
            ),
          20,
        );
    }),
  );
  const send = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
    const rpc = JSON.parse(String(init?.body));
    return new Response(
      `{"jsonrpc":"2.0","id":${JSON.stringify(rpc.id)},"result":${rpc.method === 'getBalance' ? '{"context":{"slot":1},"value":18446744073709551615}' : '42'}}`,
    );
  });
  const origins: string[] = [];
  const relay = createRelay({
    rpcUrl: 'https://provider.example.test/?api-key=EXAMPLE_PROVIDER_KEY',
    wsUrl: upstreamUrl.replace('http:', 'ws:'),
    origins,
    fetch: send,
    verifyToken: async (token) => {
      if (token !== 'fixture-token') throw Error();
      return { sub: 'did:privy:fixture', exp: Date.now() / 1000 + 300 };
    },
  });
  const server = createServer(nodeHandler(relay));
  const sockets = createSocketRelay(relay);
  server.on('upgrade', sockets.upgrade);
  const origin = await listen(server);
  origins.push(origin);
  cleanup.push(sockets.close);
  vi.stubGlobal('location', { origin });
  let cookie = '';
  const browserFetch = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('origin', origin);
    if (cookie) headers.set('cookie', cookie);
    const response = await nativeFetch(new URL(String(input), origin), { ...init, headers });
    const nextCookie = response.headers.get('set-cookie');
    if (nextCookie) cookie = nextCookie.split(';')[0]!;
    return response;
  });
  vi.stubGlobal('fetch', browserFetch);
  class BrowserSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols, { headers: { origin, cookie } });
    }
  }
  vi.stubGlobal('WebSocket', BrowserSocket);
  vi.resetModules();
  const { address } = await import('@solana/kit');
  const { createWalletRpcClients } = await import('../src/wallet/rpc-clients');
  const { createRpcCall } = await import('../src/trading/chain');
  const { clearRpcSession, registerRpcTokenGetter } = await import('../src/wallet/rpc-session');
  registerRpcTokenGetter(async () => 'fixture-token');
  const rpcUrl = origin + '/api/solana';
  const clients = createWalletRpcClients(rpcUrl, rpcUrl.replace('http:', 'ws:'));
  expect(await createRpcCall(rpcUrl)<number>('getSlot')).toBe(42);
  expect(
    (await clients.rpc.getBalance(address('11111111111111111111111111111111')).send()).value,
  ).toBe(18446744073709551615n);
  const abort = new AbortController();
  cleanup.push(() => abort.abort());
  const notifications = await clients.rpcSubscriptions
    .accountNotifications(address('11111111111111111111111111111111'), {
      commitment: 'confirmed',
      encoding: 'base64',
    })
    .subscribe({ abortSignal: abort.signal });
  const next = await notifications[Symbol.asyncIterator]().next();
  expect(next.value.value.lamports).toBe(18446744073709551615n);
  abort.abort();
  expect(upstreamMessages).toContain('accountSubscribe');
  expect(browserFetch.mock.calls.filter(([url]) => url === '/api/rpc-session')).toHaveLength(1);
  await clearRpcSession();
  expect(cookie).toBe('super_perps_rpc=');
  expect(
    (
      await nativeFetch(rpcUrl, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(401);
}, 10_000);
