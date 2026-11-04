# Configure your fork

Start with the [quick start](../README.md#quick-start). Public market browsing
works without a wallet provider; login and signing are optional integrations.
The template does not contain the creator's App ID, RPC credential, builder
address or referral code.

## Environment

Copy `.env.example` to gitignored `.env.local` and use your own provider accounts.
Vite reads public configuration at build time; the server reads private settings
at startup. Restart local servers after changes and rebuild if public values change.
See [`src/config.ts`](../src/config.ts) and [`server/config.ts`](../server/config.ts).

| Variable                         | Purpose                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `VITE_PHOENIX_API_URL`           | Phoenix perps API; the template uses its public mainnet default                       |
| `VITE_PRIVY_APP_ID`              | Public Privy App ID; blank disables login and excludes provider bundles               |
| `VITE_PRIVY_CLIENT_ID`           | Optional public Privy client ID                                                       |
| `SOLANA_RPC_URL`                 | Private server HTTPS mainnet RPC; required for the default relay                      |
| `SOLANA_WS_URL`                  | Optional private WSS endpoint; otherwise derived from the private RPC URL             |
| `RPC_ALLOWED_ORIGINS`            | Exact comma-separated app origins; add hosted/tunnel origins explicitly               |
| `PRIVY_APP_ID`                   | Optional server override; otherwise uses `VITE_PRIVY_APP_ID`                          |
| `VITE_SOLANA_RPC_URL`            | Optional **public** direct-provider alternative; blank uses `/api/solana`             |
| `VITE_SOLANA_WS_URL`             | Optional **public** WebSocket alternative; blank derives from the browser RPC         |
| `VITE_REPOSITORY_URL`            | Your actual public repository URL, displayed in About                                 |
| `VITE_WEB_ANALYTICS_ENABLED`     | Set `true` for basic Vercel page views; blank disables it, and local dev never tracks |
| `VITE_PHOENIX_BUILDER_AUTHORITY` | Optional registered Flight builder authority                                          |
| `VITE_PHOENIX_BUILDER_FEE_BPS`   | `0` for no app fee, or the registered integer rate; requires its authority            |
| `VITE_PHOENIX_REFERRAL_CODE`     | Optional operator referral code for new-account setup                                 |

**Every `VITE_*` value is visible in the browser.** Never include a private key,
seed phrase, Privy app secret or server-only credential. Use provider origin
restrictions and quotas for public browser endpoints. Local `.env` files and
`output/` are ignored; do not put them in screenshots, issues or release archives.

## What is public

| Value or file                                                   | GitHub source template | Hosted browser app                                                         |
| --------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| Privy App ID / client ID                                        | Blank placeholders     | Public identifiers when configured; they are not app secrets               |
| Server `SOLANA_RPC_URL` / `SOLANA_WS_URL`                       | Blank placeholders     | Private; browser uses the authenticated same-origin relay                  |
| Direct `VITE_SOLANA_RPC_URL` / `VITE_SOLANA_WS_URL`             | Blank placeholders     | Public if explicitly configured, including any URL key                     |
| Phoenix API and program addresses                               | Public defaults        | Public venue information                                                   |
| Builder authority / referral code                               | Blank placeholders     | Public routing information when enabled                                    |
| Private keys, seed phrases, Privy app secrets and server tokens | Never include          | Never include; the current client does not require them                    |
| Local environment files, private screenshots and raw reports    | Ignored                | Excluded from upload; any referenced `VITE_*` values still enter the build |

Vercel's environment settings keep values out of the repository, **not out of
client-side JavaScript**. This is [Vite's build-time behavior](https://vite.dev/guide/env-and-mode#env-variables).
The default app uses the [authenticated HTTP/WebSocket relay](rpc-relay.md).
Keep provider keys in `SOLANA_RPC_URL` / `SOLANA_WS_URL`, without a `VITE_` prefix.
A build guard rejects configured private URLs/keys found in browser output.

For a direct browser connection, use a dedicated provider key intended for public
client use, limited to this app's needs, with provider-supported origin restrictions,
quotas and usage alerts. Do not reuse a shared backend/admin key. Origin restrictions
reduce browser misuse but do not make a key private or authenticate every caller.
The included relay requires Privy login and bounds methods, bytes and connections.
Its in-memory rate limits are per instance; configure host firewall limits and
provider quotas before public launch. A hidden key alone does not prevent abuse.

Use separate production and development/preview provider configuration. Set
[Privy's allowed origins](https://docs.privy.io/recipes/dashboard/allowed-domains)
to the exact hosted origins you control; do not allow all `*.vercel.app` sites.
An App ID being public does not grant access to other users' authenticated sessions
or wallet signing authority.

## Choose the setup you need

| Goal                                  | Setup                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Explore the UI and public markets     | Leave provider IDs and monetization values blank                                                |
| Test login and the primary app wallet | Configure your own Privy app; enable email and Solana embedded wallets                          |
| Test mainnet funding and trading      | Also configure private server mainnet RPC and deliberately fund a test wallet with USDC and SOL |
| Charge an optional builder fee        | Register your own Flight builder and follow [monetization setup](monetization.md)               |
| Attribute new accounts to a referral  | Configure a valid operator code; existing relationships are not overwritten                     |

Blank browser RPC settings use the same-origin relay in dev, preview and Vercel.
Without server configuration it fails closed; there is no public-RPC fallback.
Public market browsing still works without credentials. See [relay setup](rpc-relay.md).

The app validates the mainnet genesis, Phoenix program and USDC mint. Merely
changing the URL to devnet does not make this a devnet integration.

## Before hosting

Follow [wallet setup](wallet-setup.md) and [deployment](deployment.md). Add your
final HTTPS origin to provider restrictions where configured, test that origin,
and rebuild after environment changes. Domain allowlists govern provider access;
they do not make the site private.

For a temporary phone test, use the [Cloudflare/PWA guide](pwa-testing.md).
For the state of the release gates, see [release readiness](release-checklist.md).
