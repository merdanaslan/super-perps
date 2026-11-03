import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { createRelay } from './relay.ts';
import { createSocketRelay } from './socket.ts';

const origin = 'https://app.example.test';
const servers: Server[] = [];
const sockets: WebSocket[] = [];
const cleanup: (() => void)[] = [];
async function listen(server: Server) {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `ws://127.0.0.1:${(server.address() as { port: number }).port}`;
}
async function setup(expiresIn = 300) {
  let connections = 0;
  const messages: string[] = [];
  const upstreamServer = createServer();
  const upstream = new WebSocketServer({ server: upstreamServer });
  cleanup.push(() => {
    upstream.clients.forEach((ws) => ws.terminate());
    upstream.close();
  });
  upstream.on('connection', (ws) => {
    connections++;
    ws.on('message', (data) => {
      messages.push(data.toString());
      const request = JSON.parse(data.toString());
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 71 }));
      ws.send(
        '{"jsonrpc":"2.0","method":"accountNotification","params":{"subscription":71,"result":{"value":{"lamports":18446744073709551615}}}}',
      );
    });
  });
  const upstreamUrl = await listen(upstreamServer);
  const relay = createRelay({
    rpcUrl: 'https://rpc.example.test',
    wsUrl: upstreamUrl,
    origins: [origin],
    verifyToken: async (token) => {
      if (token !== 'test-token') throw new Error('bad token');
      return { sub: 'did:privy:test', exp: Date.now() / 1000 + expiresIn };
    },
  });
  const server = createServer();
  const bridge = createSocketRelay(relay);
  cleanup.push(() => bridge.close());
  server.on('upgrade', bridge.upgrade);
  const url = await listen(server);
  function connect(headers: Record<string, string> = {}) {
    const ws = new WebSocket(url + '/api/solana', {
      headers: { origin, cookie: 'super_perps_rpc=test-token', ...headers },
    });
    sockets.push(ws);
    ws.on('error', () => {});
    return ws;
  }
  return { connect, messages, connections: () => connections, upstream };
}
afterEach(async () => {
  sockets.splice(0).forEach((ws) => ws.terminate());
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});
describe('private Solana WebSocket relay', () => {
  it('forwards a subscription and notifications without changing u64 values', async () => {
    const s = await setup();
    const ws = s.connect();
    await once(ws, 'open');
    const received: string[] = [];
    const done = new Promise<void>((resolve) =>
      ws.on('message', (data) => {
        received.push(data.toString());
        if (received.length === 2) resolve();
      }),
    );
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'accountSubscribe',
      params: ['11111111111111111111111111111111'],
    });
    ws.send(request);
    await done;
    expect(s.messages).toEqual([request]);
    expect(received[1]).toContain('18446744073709551615');
  });
  it.each([{ cookie: '' }, { origin: 'https://evil.test' }] as Record<string, string>[])(
    'rejects unauthorized handshakes before opening upstream: %j',
    async (headers) => {
      const s = await setup();
      const ws = s.connect(headers);
      const status = await new Promise<number>((resolve) =>
        ws.on('unexpected-response', (_request, response) => {
          response.resume();
          resolve(response.statusCode!);
        }),
      );
      expect([401, 403]).toContain(status);
      expect(s.connections()).toBe(0);
      ws.terminate();
    },
  );
  it('closes forbidden subscriptions without forwarding them', async () => {
    const s = await setup();
    const ws = s.connect();
    await once(ws, 'open');
    const closed = once(ws, 'close');
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'programSubscribe',
        params: ['11111111111111111111111111111111'],
      }),
    );
    expect((await closed)[0]).toBe(1008);
    expect(s.messages).toEqual([]);
  });
  it('closes at session expiry and releases the upstream connection', async () => {
    const s = await setup(0.2);
    const ws = s.connect();
    await once(ws, 'open');
    expect((await once(ws, 'close'))[0]).toBe(1008);
  });
});
