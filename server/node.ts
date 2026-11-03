import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { errorResponse, type Relay } from './relay.ts';

/** Shared by Vercel and Vite, so the phone preview exercises the same relay. */
export function nodeHandler(relay: Relay) {
  return async (incoming: IncomingMessage, outgoing: ServerResponse) => {
    const abort = new AbortController();
    incoming.on('aborted', () => abort.abort());
    outgoing.on('close', () => {
      if (!outgoing.writableEnded) abort.abort();
    });
    const timeout = setTimeout(() => abort.abort(), 18_000);
    timeout.unref();
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers))
        if (typeof value === 'string') headers.set(key, value);
      const body = ['GET', 'HEAD'].includes(incoming.method ?? 'GET')
        ? undefined
        : Readable.toWeb(incoming);
      const request = new Request(new URL(incoming.url ?? '/', 'http://localhost'), {
        method: incoming.method,
        headers,
        signal: abort.signal,
        ...(body ? { body, duplex: 'half' } : {}),
      } as RequestInit);
      const response = await relay.handle(request);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      const response = errorResponse(error);
      if (!outgoing.headersSent) {
        outgoing.statusCode = response.status;
        response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      }
      outgoing.end(await response.text());
    } finally {
      clearTimeout(timeout);
    }
  };
}
