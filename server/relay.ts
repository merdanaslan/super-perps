import type { RelayIdentity } from './auth.ts';
import { parseRpcRequest, REQUEST_LIMIT, RESPONSE_LIMIT } from './policy.ts';
import { privateRpcStrings } from './rpc-secrets.ts';

export interface RelayOptions {
  rpcUrl: string;
  wsUrl: string;
  origins: string[];
  verifyToken: (token: string) => Promise<RelayIdentity>;
  fetch?: typeof fetch;
  requestsPerMinute?: number;
}
export class RelayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const COOKIE = 'super_perps_rpc';
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
export const errorResponse = (error: unknown) => {
  const status = error instanceof RelayError ? error.status : 502;
  return json(
    {
      error:
        error instanceof RelayError ? error.message : 'Solana provider unavailable. Please retry.',
    },
    status,
    status === 429 ? { 'retry-after': '60' } : {},
  );
};

/** Per-instance burst protection, not a distributed quota. Configure the host's
 * firewall/provider quotas too: serverless instances do not share this memory. */
class Budget {
  private windows = new Map<string, { used: number; until: number }>();
  take(key: string, limit: number) {
    const now = Date.now();
    for (const [name, value] of this.windows) if (value.until <= now) this.windows.delete(name);
    let value = this.windows.get(key);
    if (!value) {
      if (this.windows.size >= 2048)
        throw new RelayError(429, 'RPC request limit reached. Please wait.');
      value = { used: 0, until: now + 60_000 };
      this.windows.set(key, value);
    }
    if (++value.used > limit) throw new RelayError(429, 'RPC request limit reached. Please wait.');
  }
}

export async function readLimitedBody(
  response: Request | Response,
  limit: number,
): Promise<string> {
  if (Number(response.headers.get('content-length')) > limit) {
    // Rejecting headers alone must also stop the provider's response stream.
    if (response instanceof Response) await response.body?.cancel();
    throw new RelayError(413, 'Request or response too large.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const signal = response instanceof Request ? response.signal : undefined;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RelayError(413, 'Request or response too large.');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

export function createRelay(options: RelayOptions) {
  const budget = new Budget();
  const fetchUpstream = options.fetch ?? fetch;
  let activeRequests = 0;
  const secrets = privateRpcStrings([options.rpcUrl, options.wsUrl]);
  const redact = (text: string) => {
    for (const value of secrets) text = text.replaceAll(value, '[redacted]');
    return text;
  };
  const checkOrigin = (request: Request) => {
    const origin = request.headers.get('origin');
    if (
      !origin ||
      !options.origins.includes(origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new RelayError(403, 'This origin is not allowed to use the RPC relay.');
    return origin;
  };
  const authenticate = async (request: Request) => {
    checkOrigin(request);
    if (!options.rpcUrl) throw new RelayError(503, 'The server RPC is not configured.');
    const cookies = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim());
    const token = cookies.find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || token.length > 8192)
      throw new RelayError(401, 'Sign in again to reconnect your wallet.');
    try {
      return await options.verifyToken(token);
    } catch {
      throw new RelayError(401, 'Sign in again to reconnect your wallet.');
    }
  };
  const consume = (identity: RelayIdentity) =>
    budget.take(`rpc:${identity.sub}`, options.requestsPerMinute ?? 240);
  const cookie = (token: string, age: number, secure: boolean) =>
    `${COOKIE}=${token}; Path=/api/solana; Max-Age=${age}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;

  async function handle(request: Request): Promise<Response> {
    try {
      const origin = checkOrigin(request);
      budget.take('total', 1200);
      const path = new URL(request.url).pathname;
      if (path === '/api/rpc-session') {
        const secure = origin.startsWith('https:');
        if (request.method === 'DELETE')
          return new Response(null, {
            status: 204,
            headers: { 'cache-control': 'no-store', 'set-cookie': cookie('', 0, secure) },
          });
        if (request.method !== 'POST') throw new RelayError(405, 'Method not allowed.');
        if (!options.rpcUrl) throw new RelayError(503, 'The server RPC is not configured.');
        budget.take('sessions', 120);
        const token = request.headers
          .get('authorization')
          ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
        if (!token || token.length > 8192)
          throw new RelayError(401, 'Sign in again to reconnect your wallet.');
        let identity: RelayIdentity;
        try {
          identity = await options.verifyToken(token);
        } catch {
          throw new RelayError(401, 'Sign in again to reconnect your wallet.');
        }
        const maxAge = Math.min(300, Math.floor(identity.exp - Date.now() / 1000));
        if (maxAge < 1) throw new RelayError(401, 'Sign in again to reconnect your wallet.');
        return json({ expiresAt: Date.now() + maxAge * 1000 }, 200, {
          'set-cookie': cookie(token, maxAge, secure),
        });
      }
      if (path !== '/api/solana') throw new RelayError(404, 'Not found.');
      if (new URL(request.url).search)
        throw new RelayError(400, 'RPC query parameters are not supported.');
      if (request.method !== 'POST') throw new RelayError(405, 'Method not allowed.');
      if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
        throw new RelayError(415, 'Use application/json.');
      const identity = await authenticate(request);
      consume(identity);
      const raw = await readLimitedBody(request, REQUEST_LIMIT);
      let rpc: ReturnType<typeof parseRpcRequest>;
      try {
        rpc = parseRpcRequest(raw);
      } catch {
        throw new RelayError(400, 'RPC method or parameters not allowed.');
      }
      if (activeRequests >= 16) throw new RelayError(429, 'RPC relay busy. Please wait.');
      activeRequests++;
      try {
        // Never retry here, especially after sendTransaction. The client journal
        // owns ambiguous-submission recovery; the server never signs or edits bytes.
        const response = await fetchUpstream(options.rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: raw,
          redirect: 'error',
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new RelayError(
            response.status === 429 ? 429 : 502,
            'Solana provider unavailable. Please retry.',
          );
        }
        let result: string;
        try {
          result = redact(await readLimitedBody(response, RESPONSE_LIMIT));
        } catch {
          throw new RelayError(502, 'Invalid Solana provider response.');
        }
        const parsed = JSON.parse(result) as {
          jsonrpc?: string;
          id?: unknown;
          result?: unknown;
          error?: unknown;
        };
        if (
          parsed.jsonrpc !== '2.0' ||
          parsed.id !== rpc.id ||
          !('result' in parsed || 'error' in parsed)
        )
          throw new RelayError(502, 'Invalid Solana provider response.');
        // Validation parses a copy; returning original text preserves u64 precision.
        return new Response(result, {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          },
        });
      } finally {
        activeRequests--;
      }
    } catch (error) {
      return errorResponse(error);
    }
  }
  return { handle, authenticate, consume, redact, options };
}
export type Relay = ReturnType<typeof createRelay>;
