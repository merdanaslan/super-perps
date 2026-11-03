import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { RelayError, type Relay } from './relay.ts';
import { parseRpcRequest, REQUEST_LIMIT, RESPONSE_LIMIT } from './policy.ts';

export function createSocketRelay(relay: Relay) {
  const server = new WebSocketServer({
    noServer: true,
    maxPayload: REQUEST_LIMIT,
    perMessageDeflate: false,
  });
  const clients = new Map<string, number>();
  const closers = new Set<() => void>();
  async function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    // Never put a bearer token or provider URL in the WebSocket query string.
    socket.on('error', () => {});
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== '/api/solana' || url.search)
        throw new RelayError(400, 'Invalid subscription path.');
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers))
        if (typeof value === 'string') headers.set(key, value);
      const identity = await relay.authenticate(new Request(url, { headers }));
      relay.consume(identity);
      if (!relay.options.wsUrl) throw new RelayError(503, 'Subscriptions unavailable.');
      if ((clients.get(identity.sub) ?? 0) >= 2 || closers.size >= 32)
        throw new RelayError(429, 'Subscription limit reached.');
      if (socket.destroyed) return;
      server.handleUpgrade(request, socket, head, (client) => {
        clients.set(identity.sub, (clients.get(identity.sub) ?? 0) + 1);
        const upstream = new WebSocket(relay.options.wsUrl, {
          maxPayload: RESPONSE_LIMIT,
          perMessageDeflate: false,
          followRedirects: false,
          handshakeTimeout: 5000,
        });
        let ended = false;
        let queuedBytes = 0;
        const queued: string[] = [];
        const pending = new Map<string | number, { subscribe: boolean; subscription?: number }>();
        const subscriptions = new Set<number>();
        const stop = (code = 1000, reason = 'Subscription closed.') => {
          if (ended) return;
          ended = true;
          clearTimeout(expiry);
          const count = (clients.get(identity.sub) ?? 1) - 1;
          if (count) clients.set(identity.sub, count);
          else clients.delete(identity.sub);
          closers.delete(close);
          upstream.terminate();
          client.close(code, reason);
          const force = setTimeout(() => client.terminate(), 1000);
          force.unref();
          client.once('close', () => clearTimeout(force));
        };
        const close = () => stop(1001, 'Server closing.');
        closers.add(close);
        // Leave headroom below Vercel's 300-second duration, and never outlive JWT expiry.
        const expiry = setTimeout(
          () => stop(1008, 'Reconnect your wallet subscription.'),
          Math.max(1, Math.min(240_000, identity.exp * 1000 - Date.now())),
        );
        expiry.unref();
        client.on('error', () => stop(1011, 'Subscription unavailable.'));
        client.on('close', () => stop());
        upstream.on('error', () => stop(1011, 'Solana subscription unavailable.'));
        upstream.on('close', () => stop(1011, 'Reconnect your wallet subscription.'));
        upstream.on('open', () => {
          if (ended) return;
          for (const raw of queued) upstream.send(raw);
          queued.length = 0;
          queuedBytes = 0;
        });
        client.on('message', (data, binary) => {
          if (ended) return;
          try {
            relay.consume(identity);
            if (binary) throw new Error('Text messages only');
            const raw = data.toString();
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            // Solana Kit sends this JSON heartbeat; convert it to a transport ping.
            if (
              parsed?.jsonrpc === '2.0' &&
              parsed.method === 'ping' &&
              Object.keys(parsed).every((key) => key === 'jsonrpc' || key === 'method')
            ) {
              if (upstream.readyState === WebSocket.OPEN) upstream.ping();
              return;
            }
            const rpc = parseRpcRequest(raw, true);
            const subscribe = rpc.method.endsWith('Subscribe');
            if (
              pending.has(rpc.id) ||
              pending.size >= 8 ||
              (subscribe && pending.size + subscriptions.size >= 8)
            )
              throw new Error('Subscription limit');
            if (!subscribe && !subscriptions.has(Number(rpc.params[0])))
              throw new Error('Unknown subscription');
            pending.set(rpc.id, {
              subscribe,
              subscription: subscribe ? undefined : Number(rpc.params[0]),
            });
            if (upstream.readyState === WebSocket.OPEN) {
              if (upstream.bufferedAmount > REQUEST_LIMIT * 4) throw new Error('Slow upstream');
              upstream.send(raw);
            } else {
              queuedBytes += Buffer.byteLength(raw);
              if (queuedBytes > REQUEST_LIMIT * 4) throw new Error('Queue limit');
              queued.push(raw);
            }
          } catch {
            stop(1008, 'Subscription request not allowed.');
          }
        });
        upstream.on('message', (data, binary) => {
          if (ended) return;
          try {
            if (binary || client.bufferedAmount > RESPONSE_LIMIT)
              throw new Error('Invalid or slow response');
            const raw = relay.redact(data.toString());
            const message = JSON.parse(raw);
            if (message?.jsonrpc !== '2.0') throw new Error('Invalid response');
            const task = pending.get(message.id);
            if (task) {
              pending.delete(message.id);
              if (task.subscribe && Number.isSafeInteger(message.result))
                subscriptions.add(message.result);
              else if (!task.subscribe && message.result === true)
                subscriptions.delete(task.subscription!);
            } else if (
              !['accountNotification', 'signatureNotification'].includes(message.method) ||
              !subscriptions.has(message.params?.subscription)
            )
              return;
            if (
              message.method === 'signatureNotification' &&
              message.params?.result?.value !== 'receivedSignature'
            )
              subscriptions.delete(message.params.subscription);
            client.send(raw);
          } catch {
            stop(1011, 'Invalid Solana subscription response.');
          }
        });
      });
    } catch (error) {
      const status = error instanceof RelayError ? error.status : 502;
      socket.end(
        `HTTP/1.1 ${status} Request rejected\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n`,
      );
    }
  }
  return {
    upgrade,
    close: () => {
      for (const close of closers) close();
      server.close();
    },
  };
}
