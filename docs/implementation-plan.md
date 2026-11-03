# Phoenix integration plan and checkpoints

Current checkpoint (30 October): mainnet transaction flows, chart overlays,
primary Privy wallet restoration and the PWA are implemented. The maintainer
reported a successful funded baseline. [Release readiness](release-checklist.md)
records the outstanding checks. The original completed foundation plan below describes an
**earlier unsigned phase**, not a current restriction on the product.

**Goal:** Establish a reproducible, unsigned Phoenix Perps integration and a
credential-ready wallet boundary before the visual design checkpoint.

**Architecture:** React/Vite browser lab uses a single Rise client. SDK data and
instruction builders are isolated from presentation. Optional Privy loads only
when configured. This first slice cannot send trades or move collateral.

**Stack:** Node 24, npm lockfile, TypeScript, React, Vite, `@ellipsis-labs/rise`
0.6.2, `@solana/kit` 8.5.0, optional Privy React SDK 3.51.0, Lightweight Charts
5.2.1, Base UI 1.9.0 and Lucide React 1.61.0. The creator accepted candlesticks
and supplied the mobile layout references.

## 1. Record requirements and research

- [x] Read the whole PRD and obtain product/sequence alignment.
- [x] Capture educational-use notices, public-demo intent and UI checkpoint.
- [x] Verify official Phoenix identity, public reads, wallet documentation and licenses.
- [x] Write concise research findings and a UI reuse shortlist with primary sources.

Files: `README.md`, `LICENSE`, `docs/product-scope.md`, `docs/research.md`,
`docs/ui-shortlist.md`, `.env.example`.

## 2. Scaffold a minimal browser lab

- [x] Pin dependencies and add `dev`, `build`, `typecheck`, `test`, `probe` commands.
- [x] Keep `/lab` explicitly labeled as an integration harness, not final product UI.
- [x] Show the educational notice in the runnable app from the first build.
- [x] Make missing wallet configuration an explicit state; no generated guest wallet.

Files: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
`src/main.tsx`, `src/lab/IntegrationLab.tsx`, `src/lab/lab.css`, `src/config.ts`.

## 3. Implement and test the Phoenix boundary

- [x] Add a public-data client using Rise and actual canonical market symbols.
- [x] Test exact order amount validation, slippage bounds, unsupported markets and
      stale quotes before implementing unsigned order instruction construction.
- [x] Test market-order limits for both sides and ensure the closing intent encodes reduce-only.
- [x] Add a bounded read-only probe for metadata, candles, book, stream, and unsigned
      instruction construction. Record failures individually and clean up subscriptions.
- [x] Distinguish receipt time from server slot/time; never call a snapshot a live feed.

Files: `src/phoenix/client.ts`, `src/phoenix/orders.ts`,
`src/phoenix/orders.test.ts`, `src/phoenix/data.ts`, `scripts/probe.ts`.

Verification: `npm test`, `npm run typecheck`, `npm run probe`. Network failures are
evidence about the environment, not a reason to substitute fixtures into live outputs.

## 4. Prepare the wallet integration without using credentials

Historical foundation behavior below. On 29 October, the creator's single-wallet
direction superseded manual selection: both the app and lab now resolve the current
user's primary Privy wallet automatically. The lab remains unsigned.

- [x] Isolate provider code and require explicit wallet selection; omit signing from the lab.
- [x] Add conditional Privy provider and Solana wallet discovery, using documented
      public app-ID configuration and explicit wallet selection.
- [x] Keep signing/submission out of the lab until approval for that test is obtained.
- [x] Document separate browser, installed-PWA, reconnect and recovery test cases.
- [x] Creator reports email OTP login and a selectable Solana wallet in the lab.
- [ ] Verify wallet continuity/recovery and real-device behavior separately.

Files: `src/wallet/PrivyWalletLab.tsx`, `docs/verification.md`.

## 5. Verify and hand off the first checkpoint

- [x] Run focused tests, typecheck and build; inspect browser lab and public data.
- [x] Check default no-credential startup and production bundle loading.
- [x] Preserve a timestamped public probe result, with no secrets or user account data.
- [x] Record what is proven, what requires a configured Privy app, and what requires
      a user-approved funded wallet test. Request the creator's UI references.

Evidence: 35 focused tests; 5/5 public/unsigned probe checks; production-browser
success and injected-failure checks. See `docs/verification.md` and
`docs/release-findings.md` for precise limits, the Node socket-close warning,
dependency audit and provider distribution-license findings. The initial plan
received a separate read-only reviewer check before implementation.

## Product and transaction implementation — 27 October

- [x] zupa branding, black/charcoal theme, actual coin logos and flat navigation.
- [x] Floating hero, two-piece mark, dedicated search and category filtering.
- [x] Direct Privy signup/login, flat Account settings and repository placeholder.
- [x] Mobile-only production handoff and local development phone preview.
- [x] Real wallet balances, Phoenix account state and SDK margin sizing.
- [x] Current-position average-entry line, unrealized P&L and mark-price readouts;
      fresh account data only, with synthetic browser/lifecycle verification.
- [x] Verified onboarding instruction construction and permission derivation.
- [x] Deposit/withdraw, market/limit, attached native TP/SL, cancellation and reduce-only close builders.
- [x] Optional Flight builder routing and automatic, disclosed operator referral onboarding with blank public placeholders; see [monetization](monetization.md).
- [ ] Funded verification of Flight fee collection, Phoenix referral attribution/discount and referral rewards.
- [x] Mainnet validation, simulation, exact wallet signature, persisted recovery and origin-wide locking.
- [x] Confirmation/expiry, ambiguous response reconciliation and refreshed account gating.
- [x] Local tests, unsigned public probe, build and targeted browser verification.
- [ ] User-controlled funded round trip and resulting account-state evidence.
- [ ] Real iPhone/Android wallet continuity, signing, recovery and failure cases.
- [x] PWA manifest/icons, production static-asset cache, offline landing page and deferred updates.
- [ ] Physical-phone installed-mode verification; see [PWA test steps](pwa-testing.md).
- [ ] Hosted QR test, dependency/distribution review and public release.

Current evidence: [verification](verification.md) and [trade readiness](trade-readiness.md). The educational notice stays;
no preview-only banner or blanket transaction disable flag remains. Native controls
still enforce eligibility, cross-only markets, balances, freshness and simulation.

Only static assets may enter a future offline cache. Account data, authentication,
quotes and transactions must not be presented as current from an offline cache.
Publication and consequential financial actions remain separate from implementation.
