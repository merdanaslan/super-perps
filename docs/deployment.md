# Hosting a fork

This is a React/Vite PWA with a small Node HTTP/WebSocket RPC relay. No database,
paymaster, wallet private key or Privy app secret is needed. Phoenix and Privy are
external services. Mainnet transactions still require user approval. Review
[release readiness](release-checklist.md) before public use.

## Production configuration

1. Use Node 24 and `npm ci`. Configure public build-time values from `.env.example`
   in the host's environment settings. A build with no Privy App ID is a public
   market browser with login disabled.
2. For wallet/trading features, set your public `VITE_PRIVY_APP_ID` and private
   server **mainnet** `SOLANA_RPC_URL`. Optionally set `SOLANA_WS_URL`; otherwise
   WSS is derived from the private HTTPS URL. Leave `VITE_SOLANA_*` empty to use
   the authenticated relay. No Privy app secret is needed.
3. Set `VITE_REPOSITORY_URL` to your actual public repository. Builder routing and
   referrals are optional; leave their settings blank to disable them. For a
   registered builder, use `0` for zero-fee routing or its exact registered rate
   for paid routing; see [monetization](monetization.md). The template contains
   no creator provider identifiers.
4. Set `RPC_ALLOWED_ORIGINS` to your exact final HTTPS origin(s), without paths
   or trailing slashes. Also configure Privy allowed origins. Configure host
   firewall limits for `/api/solana` and `/api/rpc-session`, provider quotas and
   alerts. The relay limits in memory do not create a global serverless quota.
5. Run the [release checks](release-checklist.md), build with `npm run build`, and
   deploy both `dist/` and the server endpoints at the origin root. Public
   environment changes require another build; private changes require a redeploy.

## Vercel

The included `vercel.json` defines the Vite build, `dist` output, direct navigation
to the supported app routes, cache headers, Fluid compute and function durations.
Import your repository, select Node 24, and configure the variables above. The file prepares the project for
hosting; it does not create a project or publish a deployment.

### GitHub and production updates

Publishing source grants others permission to read and fork it, not write access
to your repository or control of your Vercel project. Their fork has its own code
and deployment. A pull request proposes a change; it changes your site only after
an authorized maintainer merges it into the production branch and it deploys.

When connecting your own GitHub repository:

1. Choose the intended Vercel account/project and production branch (normally
   `main`). Pushes and merges there trigger production builds. Other branches
   produce separate previews. See [Vercel's GitHub integration](https://vercel.com/docs/git/vercel-for-github).
2. Protect the production branch with pull-request review and required quality
   and dependency checks. Limit repository write access and Vercel project access
   to the maintainers who should be able to release changes.
3. Keep **Git Fork Protection** enabled. Inspect contributed code before approving
   a fork's preview build: build scripts can access that environment's configured
   values. Use separate preview provider values or leave login disabled there.
4. Configure deployment checks or controlled promotion if production must wait
   for CI. A failing GitHub check does not by itself stop a parallel Vercel build.
   The current dependency gate is still failing; resolve or explicitly review the
   documented findings before enabling a funded public deployment.

These account/repository controls must be applied when the real project is
created; `vercel.json` does not configure branch protection, reviewers or provider
restrictions. Connecting GitHub is convenient, but Vercel can also deploy through
its CLI without automatic Git deployments.

### Deployment inputs and credentials

Keep `.env.local` and all server credentials out of Git. Set only the intended
public build values and private **non-`VITE_`** server values in Vercel's
Production environment; configure Preview separately. The included `.vercelignore` also excludes local environment files,
builds and private diagnostic output from source uploads, including CLI uploads.
It does not remove values already embedded in a JavaScript bundle.

The [configuration visibility table](configuration.md#what-is-public) explains
which values users can inspect. In particular, a direct browser RPC URL and its
key remain visible even when entered only in Vercel. A private RPC credential
uses the included [HTTP/WebSocket relay](rpc-relay.md). Verify login, balances
and a subscription on a hosted preview before enabling production. Rotate any
key previously exposed in a public test bundle before using a dedicated
production key.

## Other static hosts

Public market browsing works as a static site. Wallet features require a compatible
relay host or explicit public direct-provider URLs; a `dist/` upload alone does not
include the server endpoints. Do not put private credentials in `VITE_*`.

Return `index.html` for `/`, `/account`, `/search`, `/login`, `/signup` and `/lab`.
Serve `/assets/*`, `/sw.js`, `/manifest.webmanifest`, icons and other public files
as actual files with their correct MIME types. Do not rewrite missing JavaScript,
API paths or the service worker to HTML. Host at `/`; a subdirectory deployment
requires changing absolute asset URLs and PWA scope.

Use revalidation (`Cache-Control: no-cache`) for the service worker, HTML routes
and manifest. Hashed `/assets/*` files can use a long immutable cache. Deploy
atomically; keep earlier hashed assets available during rollout where the host
supports it. An already-open page may still request an earlier lazy chunk.

The worker caches public static assets only. New workers wait for all previous
app windows/tabs to close; do not add forced activation or automatic reloads while
transactions may be pending. Keep the stable HTTPS origin for wallet sessions,
installation and the per-origin transaction journal.

## After hosting

- Open every direct route, then check the manifest, icons, service worker and
  third-party notices. Check the desktop QR points to the final origin.
- Open on a phone without `preview=mobile`; production ignores that parameter.
  Install from Safari/Chrome and follow [phone acceptance](pwa-testing.md#phone-acceptance).
- Verify exact app-wallet continuity, safe areas, keyboard behavior and the
  funded baseline on the intended devices. Test offline recovery and an update.
- Enable the repository's private vulnerability reporting (or publish a private
  contact), required CI checks and secret scanning where available.

For temporary testing before hosting, use the existing
[Cloudflare instructions](pwa-testing.md#start-the-temporary-https-url).
