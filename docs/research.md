# Integration research — 26 October 2026

## Decision

Use React + Vite + TypeScript, the official Rise TypeScript SDK, and Solana Kit.
Start as a static client: public Phoenix reads already permit browser origins.
Keep Privy optional until the creator supplies/approves a configured app. Helius
can later be an RPC choice; it is unnecessary for Phoenix market data. No
database, backend signer, custom program or generic multi-venue framework is needed
for this first slice. Revisit a small backend only if a verified secret-bearing
service or operational requirement demands one.

## Phoenix identity and SDK

The official [Phoenix docs](https://docs.phoenix.trade/) describe perpetual futures
and link to [Rise](https://docs.phoenix.trade/sdk/rise), whose public source is
[Ellipsis-Labs/rise-public](https://github.com/Ellipsis-Labs/rise-public).
The npm package `@ellipsis-labs/rise` currently resolves to **0.6.2** and declares
MIT in its [package metadata](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/package.json).
Its current dependencies use Solana Kit; isolate that SDK in `src/phoenix`.
Do not use the legacy Phoenix spot SDK or unrelated similarly named services.

The SDK advertises Bun for its source build; this project consumes the published
distribution and tests Node 24/Vite compatibility. Node compatibility must be
established by the actual probe/build rather than inferred from the npm listing.

## Public data

[API overview](https://docs.phoenix.trade/api/index): REST is
`https://perp-api.phoenix.trade`, WebSocket is the same host at `/v1/ws`.
Unauthenticated local HTTP checks returned 200 for exchange snapshot, market list,
SOL L2 book and SOL mark price, with `Access-Control-Allow-Origin: *`.
The first list contained 99 markets. This is a dated observation, not a guaranteed
market count, service SLA or proof of trading.

[Candles](https://docs.phoenix.trade/api/exchange/get-candles) accept `timeframe=1h`
and return milliseconds; `timeframe=60` was rejected. Preserve canonical symbols
(including case). Do not enable the optional external candle source silently.
Trade-price candles and mark prices are distinct values.

[WebSocket/API practices](https://docs.phoenix.trade/sdk/ws-api-best-practices)
recommend initial REST snapshots, shared streams and SDK stores, and snapshot
reconciliation after reconnects or sequence gaps. Record server slot/time and
local receipt time separately. Numeric anonymous quotas were not established;
avoid aggressive polling and respect retry/backoff behavior. Some OpenAPI security
annotations differ from the narrative public-read guidance: live endpoint checks
are recorded separately rather than interpreting the schema as a blanket gate.

## Wallet and account path

[Auth](https://docs.phoenix.trade/sdk/auth) and Solana signing are separate. Most
reads are public; referral onboarding/notifications need Phoenix auth. For a
third-party embedded wallet, prefer Phoenix's wallet nonce/signature authentication
when auth is actually required. Do not assume a token issued by our Privy app is
accepted by Phoenix's own Privy-token endpoint. Never log JWTs or refresh tokens.

[Trader onboarding](https://docs.phoenix.trade/sdk/register) documents a no-referral
build-register/send-register flow and an authenticated referral transaction flow.
The legacy sponsored activation routes are deprecated. Registering incurs account
rent and transaction fees; successful instruction building alone is not onboarding.
Use the actual wallet as fee payer in the eventual user-funded path. API-added
onboarder signatures require testing; do not treat the transaction as an ordinary
single-signer transfer or claim full signature simulation before all signatures exist.

[Collateral](https://docs.phoenix.trade/sdk/collateral),
[accounts](https://docs.phoenix.trade/sdk/accounts), and
[orders](https://docs.phoenix.trade/sdk/orders) define USDC movements, authority and
position-authority boundaries, and instruction builders. Use the official packet
and margin math. Explicit amount precision, price protection, partial fills,
reduce-only close behavior, transaction expiry and post-submit account reconciliation
are required before enabling financial actions. Do not infer that a confirmed
transaction fully filled an order. Native SOL collateral and advanced orders can
remain outside the initial UI.

No public Phoenix Perps devnet endpoint was found in the reviewed official docs.
That is an unresolved environment question, not proof that no test environment
exists. Official local LiteSVM fixtures offer offline instruction testing but do
not establish hosted wallet, API or live trading compatibility.

## Privy: preferred, not yet credential-tested

The official [React setup](https://docs.privy.io/basics/react/setup) supports a public
app ID, and [Solana wallet creation](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation)
supports `users-without-wallets`. Use deliberate login, no guest identities, explicit
wallet selection, and verify the same address after reload/relogin and in standalone
PWA mode. A new Privy app does not automatically recover a wallet from another app.

[Solana message signing](https://docs.privy.io/wallets/using-wallets/solana/sign-a-message)
supports nonce auth. [Transaction signing](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction)
accepts encoded transaction bytes. Preserve confirmation prompts. The docs identify
some external sign-only wallets returning a bare 64-byte signature: eventual
execution must handle or clearly reject that case, not submit it as a wire transaction.

[Pricing](https://www.privy.io/pricing), checked today: free developer tier lists
0–499 MAU, 50,000 monthly signatures and $1M monthly transaction volume; Core lists
$299/month. The page mixes “up to 500” and “0–499” wording and describes usage-based
charges beyond thresholds. Confirm dashboard limits/terms before a public rollout;
do not enable billing or assume an unlimited free demo. SDK license is Apache-2.0;
the hosted service has separate [developer terms](https://www.privy.io/developer-terms-of-service).
No account was configured, accessed or billed during this research.

## Mobile/PWA constraint

[Solana Mobile's compatibility table](https://docs.solanamobile.com/get-started/web/apps)
lists MWA support for Chrome/Chrome PWAs on Android and no iOS-browser support.
Embedded wallets are therefore the preferred iPhone path to test. External-wallet
availability depends on the actual browser, injected wallet or handoff mechanism.
Desktop emulation cannot prove iPhone installed-PWA session persistence or signing.

## Helius and hosting

Helius would supply RPC for blockhashes, simulation and confirmation, not Phoenix's
order-book/candle feed. The [free plan](https://www.helius.dev/pricing) currently
lists 1M monthly credits, 10 RPC requests/second and 1 transaction submission/second.
Keep RPC configurable; no Helius account/key has been used. A browser-visible RPC
key is public, not a secret; use provider restrictions or a scoped proxy if needed.

A static HTTPS host is sufficient for the initial application. Local localhost is
suitable for development; installation and device OAuth/wallet behavior need an
approved HTTPS deployment or approved local HTTPS setup. No deployment is authorized
or performed yet. The event's [official page](https://hackathons.solana.com/hackathons/perps-and-prediction-markets)
currently confirms the PRD's 5 December 2026 deadline.

## Educational-use presentation

Use a brief visible educational label on entry/home and comprehensive text in
README/Account, with relevant risk details when reviewing financial actions.
The [MIT license](https://opensource.org/license/mit) supplies standard warranty and
liability terms for original code. Do not make “educational only” a new license
restriction or promise it eliminates every legal obligation. Public demo behavior
and provider rules still need review before publishing; publication is not performed
as part of this local implementation.
