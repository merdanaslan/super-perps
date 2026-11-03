# Security release review — 2 November 2026

## Result and scope

**The source and documentation checks pass, but the dependency release gate
still fails. A funded public deployment is not cleared by this review.** Three
application issues were fixed and verified. The remaining audit findings are
tracked openly; tests and phone acceptance do not waive them.

This is a local engineering review of the 0.1.0 candidate, not an independent
security audit or a guarantee against compromise. At review time there was no
initial Git commit, remote or Vercel deployment. No real wallet was signed with,
no funds were moved, and no source was uploaded to a security-scanning service.
The maintainer separately reports that the app works in physical-phone testing.

Reviewed: UI/Privy configuration, transaction preparation and execution,
receipt recovery, HTTP/WebSocket relay, build/hosting settings, dependency tree,
CI, candidate source files, generated browser assets and documentation/media.
Phoenix/Solana/Privy internals, cloud account permissions and real-device edge
cases were not independently audited. No database, admin API, uploaded-file
handler or runtime AI agent is present in this app.

## Verification

| Check                   | Result and limit                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Clean installation      | Credential-free copy, fresh `npm ci`; Node 24.10.0 / npm 11.6.1                                                                    |
| Quality suite           | 478 tests across 46 files, types, formatting and repository hygiene pass                                                           |
| Regression proof        | Four new guard/redaction/body-limit tests failed before fixes and pass afterward                                                   |
| Production builds       | Public-only and configured builds pass; existing size/worker/PWA warnings remain                                                   |
| Unused code             | Knip 6.44.1 reports no unused files, exports or declared dependencies with all entry points included                               |
| License inventory       | 600 production package/version entries; 26 missing root notice texts remain identified; not legal clearance                        |
| Candidate source        | Gitleaks 8.30.1 reports no leaks; repository checker also compares local configuration and staged blobs                            |
| Configured assets       | 331 files scanned; no known private RPC URL/key matches                                                                            |
| Independent bundle scan | Three generic-key flags trace to vendor-distributed Coinbase analytics and Privy/MoonPay client constants; not project credentials |
| Media                   | Local OCR across 17 images including GIF frames; flagged email manually verified as `your@email.com` placeholder                   |
| Browser                 | Normal 390 × 844 app and Privy email panel load without page errors; embedding is blocked by CSP                                   |
| HTTPS preview           | Root returns 200 with the new framing/security headers; not Vercel hosting proof                                                   |
| Dependency audit        | Fails: 24 high, 4 low affected package entries; no critical or moderate entries                                                    |

Raw logs and scanner output remain in ignored local output. No scanner can
recognize every credential format; OCR is not a complete privacy review of every
pixel. Public App IDs, venue URLs and on-chain addresses are distinct from
provider credentials, signing keys and personal account screenshots.

## Resolved application findings

### R01 — Medium: trading UI could be framed

**Confidence:** 10/10. **Category:** UI spoofing / clickjacking. **Status:** fixed.
**Location:** `server/security-headers.ts`, `vite.config.ts`, `vercel.json`.

A separate page could embed the app and place misleading overlays around its
controls. Successful framing was reproduced in an anonymous local browser;
no funded clickjacking attack was attempted. Previously there was no framing
policy in the response.

The app now sends `frame-ancestors 'none'` and `X-Frame-Options: DENY`, alongside
`object-src 'none'`, `base-uri 'self'`, nosniff and a referrer policy. A browser
embedding attempt now logs a CSP rejection and cannot render the app. The normal
app and Privy login panel still work. The policy does not restrict Privy's child
frames and is not a complete script/connect-source CSP. Preserve these headers
on any alternative host. **Priority:** P2, completed.

### R02 — Medium: incomplete configured-credential matching

**Confidence:** 10/10 for the reproduced formats. **Category:** information
disclosure / configuration. **Status:** fixed. **Location:**
`server/rpc-secrets.ts`, `server/build-guard.ts`, `server/relay.ts`.

The old checks recognized full URLs and query keys but missed a standalone
credential from a URL path or decoded user-info. With such a provider, accidentally
importing that fragment into browser code, or receiving it in an upstream error,
could expose it. This was a conditional defect; the scan found no leak of the
current configured provider credential.

Build checks and HTTP/WebSocket redaction now share extraction of query values,
path segments and user-info, with literal, decoded, URI-encoded and JSON-escaped
forms. Three regression cases reproduced the gap before the fix. The configured
production file scan has no private matches afterward. This is a known-value
guard, not a general data-loss-prevention system. **Priority:** P2, completed.

### R03 — Low: oversized response stream not promptly cancelled

**Confidence:** 10/10. **Category:** resource consumption / availability.
**Status:** fixed. **Location:** `server/relay.ts`.

An upstream response declaring an excessive Content-Length was rejected before
reading, but its body was not explicitly cancelled. A slow or faulty provider
could keep resources occupied after rejection; the upstream remains fixed and
cannot be supplied by a caller.

The response body is now cancelled before returning the size-limit failure.
A test first reproduced the missing cancellation and now passes. Existing
timeout, streaming-limit and real Kit transport tests also pass.
**Priority:** P3, completed.

## Open dependency findings

These are **three affected package families**, including two decode-uri-component
advisories. The 28 npm entries also count affected parents. Confidence is 10/10
that these versions/advisories are in the resolved tree; that does not establish
that each advisory is remotely exploitable through this application's flows.

| ID / severity                     | Conditional impact and current constraint                                                                                                                                                                                     | Priority                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| R04 / High — Zod                  | Oversized constrained collections can exhaust memory if passed to affected validation. Zod 4 is patched by the existing override, but Privy's API package still requires Zod 3.25.76; no patched Zod 3 release was available. | P1: keep the release gate open; use a compatible provider update or review a scoped patch separately |
| R05 / High — decode-uri-component | Malformed encoded input can cause excessive decoding work when it reaches the affected decoder. The patched 0.5.1 package is ESM; installed query-string 7 consumers require the older CommonJS function export.              | P1: compatible upstream fix or separately validated dependency change                                |
| R06 / Low — deepmerge             | Special object keys can poison the returned object's prototype. This copy is in the PWA build toolchain, not runtime app code; no published fix was available. Build inputs should remain trusted.                            | P3: track upstream and recheck build tooling                                                         |

Evidence: fresh `npm audit --json`, resolved package inspection and the official
advisories for [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[decode-uri-component exponential decoding](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr),
[decode-uri-component quadratic decoding](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)
and [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

Privy 3.51.0 and vite-plugin-pwa 2.0.0 matched their stable releases when checked.
Npm's suggested major downgrades are not reviewed fixes. No blanket incompatible
override, forced downgrade or audit allowlist was added. See
[release findings](release-findings.md) for existing compatibility-tested overrides.

## Trust boundaries and threat model

| Component / STRIDE concern        | Reviewed control                                                                                                       | Remaining boundary                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Login / spoofing                  | ES256 signature, fixed issuer/audience/JWKS, subject and expiry verification; exact origins; HttpOnly, SameSite cookie | Privy and browser integrity; copied tokens last until expiry; logout is not global revocation              |
| RPC / tampering and disclosure    | Fixed provider, method/size bounds, no arbitrary URL or redirects, no forwarded browser auth, shared redaction         | A valid app user can call allowed methods; this is not per-account on-chain authorization                  |
| Trading / tampering and privilege | Reviewed message equals signed message; signature/wallet checks, fresh reads and review expiry; no server signing key  | Compromised frontend/dependency/wallet can still matter; external program correctness is not proven        |
| Submission / repudiation          | Receipt saved before send, Web Lock, original-signature reconciliation, ambiguous outcomes retained                    | Local receipts are not a tamper-proof server audit trail; no claim of every recovery path on every device  |
| Relay / denial of service         | Body limits, timeouts, concurrency and subscription bounds; no automatic transaction retry                             | In-memory limits are per instance; global firewall limits and provider quotas still require cloud setup    |
| PWA / information disclosure      | Only static assets cached; live RPC/account data not cached by the service worker                                      | Browser storage and third-party SDK behavior need their own protections; pending receipt metadata is local |
| Delivery / supply chain           | Locked dependencies, full-SHA CI actions, read-only CI permissions, no PR signing secrets                              | Remaining advisories; deployment permissions and fork-preview environment access need verification         |

Secrets belong only in server environment settings. Browser `VITE_*` values are
public. The repository template contains no maintainer provider credentials or
wallet keys. Raw logs, local env files, generated output, certificate/key files
and local security reports are excluded from source and Vercel uploads. There
is no committed history in this checkout to claim as a historical secret scan.

## Educational source and next steps

The existing screen/UI, wallet, trading, Phoenix adapter and server boundaries
are suitable for an educational reference. Comments explain units, exact-message
approval, stale reviews, ambiguous sends, keyboard lifecycle and credential
boundaries. No broad pre-release refactor is warranted by the unused-code check.
README now maps the server alongside client code; setup, fees, limitations,
architecture, screenshot provenance and third-party attribution remain linked.

1. Resolve the high dependency findings, or make an explicit, documented scope
   and risk decision before a funded public deployment. The current release gate
   continues to fail. Publishing educational source is not a production security
   endorsement.
2. Before hosting, create a dedicated production RPC key and retire any key
   previously exposed in public test bundles. Configure exact origins, global
   firewall limits, provider quotas/alerts, deployment access and private
   vulnerability reporting. These account settings were not changed by this review.
3. Verify a Vercel preview: HTTP and WebSocket auth/expiry, headers, routes/PWA,
   login/logout and user-controlled phone regression. Keep production isolated
   from untrusted fork preview builds. Local success is not hosted proof.
4. Publish the reviewed Git snapshot and link the eventual website only after
   those release decisions. No GitHub repository or Vercel deployment was created
   during this review.

## Confidence calibration

- Daily review mode, 8/10 minimum evidence gate.
- Six review items: three application findings fixed; three dependency families
  remain open. Two high, two medium and two low; no critical finding confirmed.
- All six have 10/10 confidence in the stated reproduced condition or dependency
  presence. Exploitability through live funded flows is not claimed for the
  dependency inventory findings.
- Three bundle credential flags were traced to vendor-distributed client values;
  one OCR email flag was a placeholder. They are excluded from project-secret
  findings, not hidden with a scanner-wide allowlist.
- Production cloud settings, vendor services, formal correctness and exhaustive
  mobile behavior remain outside the verified scope.
