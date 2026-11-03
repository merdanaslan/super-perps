# Security

This is experimental, unaudited software that can sign real Solana mainnet
transactions. The MIT license is not a security assurance. Review the current
[release findings](docs/release-findings.md) before running a funded deployment.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** option when enabled.
If it is unavailable, contact the repository maintainer privately through their
published contact information. Do not disclose exploitable details, wallet
secrets or user data in a public issue. This starter does not promise a bounty,
response-time SLA or support for old forks.

Before publishing a fork, its maintainer must enable private vulnerability
reporting or publish a private security contact. This template does not invent
an inbox or claim a reporting channel has already been configured.

## Important boundaries

- The client uses the user's primary Privy embedded wallet. Private keys and seed
  phrases do not belong in this repository or its environment variables.
- Browser configuration (`VITE_*`) is public. Apply provider origin restrictions
  and quotas; keep server secrets out of frontend builds.
- Private `SOLANA_RPC_URL` / `SOLANA_WS_URL` belong only on the server. The default
  relay verifies Privy login and exact origins, bounds methods/bytes/concurrency,
  and never retries submissions. Its in-memory burst limits are per instance;
  configure host firewall limits, provider quotas and alerts before public use.
  See [RPC relay boundaries](docs/rpc-relay.md), including token/socket expiry.
- A review never authorizes a different transaction. Exact-message signature
  verification, wallet identity checks and review expiry must remain enforced.
- Serve the included framing policy (`frame-ancestors 'none'` and
  `X-Frame-Options: DENY`) so another website cannot embed the approval UI.
  Vite and Vercel configurations include it; other hosts must preserve it.
  This limited CSP is not a complete script or network-source allowlist.
- A submission timeout is ambiguous. Preserve its receipt and reconcile the
  original signature before retrying; do not clear storage to bypass recovery.
- Only public static assets are cached offline. Trading requires current network
  and account data. A successful simulation or confirmation alone does not prove
  a filled order or an externally credited withdrawal.
- Dependency advisories and custom third-party terms remain separately tracked.
  Passing unit tests does not resolve them.

## Before publishing source

Run `npm run check:repo` from your local checkout before staging a release. It
checks candidate text files, including untracked and extensionless files, for
excluded artifacts and common credential formats. It checks staged content too:
cleaning a working copy does not clean the version Git is about to commit. It also
checks for copied configuration values and URL path/query credentials from every
local root `.env` / `.env.*` file except the public `.env.example` template;
only locations are logged.
The default public Phoenix API endpoint is allowed. This is a limited
hygiene check, not a guarantee that every kind of secret can be detected.

Review screenshots and diagnostic reports separately: wallet addresses, balances,
position history, emails and provider dashboards can expose personal information
without containing a private key. Keep raw reports in ignored `output/`, use
anonymous screenshots, and inspect the actual staged diff before publishing.
Ignoring a file does not remove it from an existing Git commit. If a secret was
ever published, rotate it at the provider; deleting it from the latest file is
not enough.

Before hosting, review [what the browser exposes](docs/configuration.md#what-is-public).
A clean source scan alone does not protect a direct browser RPC key. The default
relay keeps configured provider URLs server-side; explicit `VITE_SOLANA_*`
alternatives are public. A build guard rejects known private URLs/keys in generated
browser output. It is a limited check, not a guarantee against every disclosure.
The guard and upstream-response redaction cover URL query parameters, path
segments and user-info, including encoded spellings. They do not make unknown
provider response fields safe to log.
Production firewall/provider quotas and deployment permissions must be verified
separately. Rotate any provider key previously served in public test bundles
before using a dedicated production key.
