# Private Solana RPC relay

The React app stays client-rendered. A small Node relay keeps provider URLs out
of browser bundles while supporting the existing Privy wallet integration.
It is not a wallet, custody service or trading authority.

## Request flow

1. The user signs in through Privy as before. The public App ID identifies the app.
2. Before the first RPC call or socket, the client sends its access token to
   `POST /api/rpc-session`. The server verifies ES256, issuer, audience, expiry
   and user subject against Privy's public JWKS, then sets a five-minute HttpOnly,
   SameSite=Strict cookie, Secure on HTTPS and scoped to `/api/solana`.
3. HTTP requests and WebSocket upgrades use that cookie and must have an exact
   allowed Origin. The upstream is fixed by server environment configuration;
   callers cannot provide a forwarding URL. Browser credentials are not forwarded.
4. The client renews the cookie before expiry. Logout clears it after outstanding
   setup requests finish. No provider key or access token is put in a socket URL.

Public Phoenix data and streams are unchanged. The app still polls Solana for
confirmation only while a submitted transaction is pending. Privy's supplied Kit
subscription client uses the WebSocket relay when its wallet flow needs it.

## Policy and limits

`server/policy.ts` permits the account, balance, blockhash, slot, fee, simulation,
submission and signature-status methods used by the app and wallet. It excludes
batches, program scans and arbitrary provider APIs. WebSockets permit account and
signature subscriptions only. Adding a method needs a bounded policy and test.

- HTTP: 16 KiB requests, 1 MiB responses, a 12-second upstream timeout, and at
  most 16 upstream requests in flight per instance.
- Burst limits: 240 calls/messages per user per minute; HTTP also has a 1,200
  request/minute instance budget and a 120 session-setup/minute instance budget.
- Sockets: two per user and 32 per instance, with eight pending/active
  subscriptions per connection. Payloads, pending queues and send buffers are bounded.
- Sockets close after at most four minutes or at JWT expiry, whichever comes
  first. Kit surfaces disconnections; a subsequent operation establishes a fresh
  authenticated channel. Long-lived automatic resubscription is outside this MVP.

These are **per-instance burst limits**, not a distributed quota or protection
against all abuse. Any valid user of the configured Privy app can use the allowed
RPC methods. Set host firewall rate limits on both API routes, provider quotas
and usage alerts before public launch. This repo does not configure a cloud
account's firewall or billing controls.

JWT verification is stateless: clearing a browser cookie is not instant server
revocation of an already copied token or open socket. Token expiry and the socket
duration bound remain enforced. No administrative Privy secret is used.

The server never signs, changes signed bytes or retries a submission. A timeout
can mean the transaction was sent; the existing receipt journal reconciles its
original signature. Responses are validated without reserializing their numbers.
Provider failures are generic and known configured URL/key values are redacted.
The shared redaction/build guard recognizes credentials in query parameters,
path segments and user-info. Oversized upstream bodies are cancelled rather
than left streaming after rejection.
Do not log authorization headers, cookies, request bodies or upstream URLs.

## Running and hosting

Set `SOLANA_RPC_URL` (HTTPS mainnet), optionally `SOLANA_WS_URL` (WSS), and your
public `VITE_PRIVY_APP_ID`. Leave `VITE_SOLANA_RPC_URL` and `VITE_SOLANA_WS_URL`
empty. `PRIVY_APP_ID` may override the same App ID on the server. No Privy app
secret or wallet private key is required.

Set `RPC_ALLOWED_ORIGINS` to exact comma-separated HTTPS origins, without paths
or trailing slashes. Blank permits localhost/127.0.0.1 ports 5173/4173 locally;
on Vercel it permits only the exact `VERCEL_URL`, not every preview domain. Add
your final domain or current Cloudflare URL explicitly and restart local servers.

Vite dev and preview mount the shared relay. Vercel uses `api/solana.ts` (Node
HTTP server with upgrades) and `api/rpc-session.ts` (HTTP handler). The included
configuration enables Fluid compute and gives the socket function 300 seconds.
This follows [Vercel's WebSocket support](https://vercel.com/docs/functions/websockets).
Verify both transports on an actual Vercel preview before production; local
tests do not prove hosting behavior or cloud account settings.

For a static-only host, public browsing works without a backend. Wallet features
need a compatible relay host or explicitly public, restricted direct-provider
URLs in `VITE_SOLANA_*`; those values are visible to users. See
[configuration](configuration.md) and [deployment](deployment.md).

Tests cover signed JWT validation, rejected origins and methods, cookie setup,
limits, timeouts, exact large integers, socket expiry and actual Kit transports
against a local test upstream. They never sign or submit real transactions.
