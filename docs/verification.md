# Verification record — super perps

Current status is in [release readiness](release-checklist.md), prepared **30 October
2026**. The dated sections below retain their original observations; they are not
all claims about today's state. The maintainer subsequently reported the funded
baseline and supplied installed-iPhone screenshots, as recorded in the release summary.

The initial entries use Node 24 and local Chromium browser viewports.
This record separates implemented behavior, local checks, public network reads and
funded acceptance. No agent action funded a wallet, signed a mainnet transaction,
submitted an order or moved funds.

## Rebrand and zero builder fee — 1 November 2026

The public name is now **super perps**, with emerald artwork and updated install
icons. Existing receipt storage and Web Lock names are preserved. Earlier entries
below describe the previous name and, where stated, its historical 10 bps test rate.

The current local builder override is **0 bps**. A
[read-only Flight check](evidence/builder-zero-read-only-2026-11-01.json) verified
an active registered builder with a 10 bps default while the app resolved zero.
Regression tests decode the SDK wrapper to distinguish explicit zero from a
missing override. No registry update, signing or trade submission occurred.

All **299 tests in 31 files**, type checks, formatting/source hygiene and the
configured production build passed. Anonymous browser checks covered the mobile
Home/Markets/Trade views, Privy logo and desktop handoff. The manifest names and
all install-icon files/sizes were checked. README captures were refreshed; this
does not replace physical-device acceptance or the open release findings.

## Current implementation

The product now includes real mainnet account reads, Phoenix account activation,
USDC deposits/withdrawals, market/limit orders, native attached TP/SL, cancellation
and reduce-only closing. Privy signs the exact reviewed transaction. The app
simulates first, persists a pending receipt before sending, and reconciles the
original signature after an ambiguous response. This implementation description
predates the maintainer's funded acceptance reports; see the current summary above.

The original `/lab` and `npm run probe` remain unsigned diagnostics. Cross margin,
account 0 / subaccount 0 and USDC are the MVP boundaries.

### Authenticated Home and Account, 28 October

Home now shares the same hero in both session states: the logo floats over a fixed
base. Authenticated users see **Equity**, its existing combined wallet/account
value and funding actions underneath; the Home wallet-address line is removed.
Account no longer has the redundant Continue button; its Close control remains.
The existing authenticated browser session verified these changes. Computed styles
confirmed `zupa-float` only on the logo and no animation/transform on the base.
The signed-in Home capture is kept in ignored `output/`, not public evidence.

TypeScript, formatting, the configured production build and `git diff --check`
passed after the UI edits. Existing provider browser-externalization and bundle-size
warnings remain. The funding investigation is recorded in
[funding abstraction](funding-abstraction.md); this turn did not alter signing,
fee payment or collateral movement.

## Local and public-network checks, 27–28 October

| Check                             | Result                                                                                                                            | Evidence boundary                                                                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                        | **116 pass in nine files**                                                                                                        | Decimal/lot/tick bounds, sizing, TP/SL direction, source-slot freshness, wallet/signature integrity, expiry, recovery, navigation, Flight routing and referral authentication/submission; mocks and ephemeral local keys are not mainnet execution |
| TypeScript and builds             | Configured and blank-Privy production builds compile                                                                              | Runtime startup was checked separately; a compilation pass alone did not catch the chunk-order issue below                                                                                                                                         |
| Formatting                        | `npm run format:check`, `git diff --check` pass                                                                                   | Source consistency only                                                                                                                                                                                                                            |
| Mainnet instruction probe         | 104 margin-market parameters read; book slot 462247254 and chain slot 462247259                                                   | Public network observations at the recorded time, not current quotes                                                                                                                                                                               |
| Wire size                         | Deposit 798, withdraw 890, market 554, limit 536, market + new TP/SL account 689, limit + new TP/SL account 671, cancel 521 bytes | Real SDK instruction construction for a random unfunded public address; all below 1,232 bytes                                                                                                                                                      |
| Onboarding simulation refusal     | Expected `AccountNotFound`                                                                                                        | Random unfunded address, no private key, no signature, no submission; does not prove successful onboarding                                                                                                                                         |
| Public template                   | Creator App ID absent from publishable source/default bundle; `.env.local`, `dist`, `output` ignored                              | Configured build is private local output; repository variables remain placeholders                                                                                                                                                                 |
| Configured Helius RPC, 28 October | Mainnet genesis matched; confirmed slot 462423457 read with HTTP 200; browser wallet/account reads succeeded                      | Creator endpoint is in ignored `.env.local` only, with placeholders in the public template; reads do not prove trading                                                                                                                             |

The dated machine-readable result is
[`trading-probe-2026-10-27.json`](evidence/trading-probe-2026-10-27.json).
It deliberately excludes the creator's wallet and authentication details.

### Optional monetization checks, 28 October

During the initial probe, builder authority/rate and default referral code were
blank. Their implementation is described in [monetization](monetization.md). That
probe did not register a builder or activate a code. The updated
[public probe result](evidence/trading-probe-2026-10-28.json) records:

- Flight global account verified against the Phoenix program, with a **10-bps**
  cap at the checked slot (not a hardcoded future limit).
- Public referral permission matched its on-chain owner, authority and derived
  address. Locally constructed activation bytes matched the official SDK builder.
- A **synthetic, unregistered** Flight route compiled to 737 bytes for market,
  719 for limit, 873 for market + a new TP/SL account, and 854 for limit + a new
  TP/SL account. Referral activation with compute budget compiled to 603 bytes.
  This is wire-format evidence, not successful execution or fee collection.
- Both ordinary and referral setup simulations refused the random unfunded address
  with `AccountNotFound`. The first run had a transient `BlockhashNotFound` on
  ordinary setup; a fresh run passed both expected-refusal checks. No signature,
  submission, authentication, activation or reward claim occurred.
- Unit tests reject unregistered/inactive or mismatched builder configuration,
  preserve inner order bytes and the explicit fee override, reject invalid/expired
  auth signatures and wallet switches, and require the exact referral submission
  payload and response. Referral rejection has no fallback to ordinary activation.
- The earlier manual referral field and invitation-link checks are superseded by
  the automatic operator-code flow below. The earlier
  [`fees-referrals.jpg`](images/fees-referrals.jpg) records that removed interface,
  not current behavior. Live Phoenix message signing and attribution remain untested.
- Configured and blank-placeholder production builds compiled before this UI
  simplification. The configured build was rerun after it and still passes.
  Existing dependency/chunk-size warnings remain; this is not a full device or
  provider-signing acceptance run.

### Automatic operator referral, 28 October

- Removed Account's fees/referrals entry and sheet, the manual setup field and
  saved-draft/URL attribution overrides. The funding action reads only
  `VITE_PHOENIX_REFERRAL_CODE`; blank keeps ordinary onboarding, and invalid
  configuration blocks setup with visible feedback.
- The code, possible compensation and permanence remain disclosed before setup
  and in the activation review. Builder fees remain disclosed in order review.
  Existing accounts are still rejected by the activation builder; this change
  does not replace a previously established relationship.
- The Account page was checked in the **637×823 development preview**: the section
  is absent and the other settings and About entry remain visible. Capture:
  [`account-automatic-referral.jpg`](images/account-automatic-referral.jpg).
- **116 tests in nine files** pass after removing ten tests solely for the deleted
  manual-choice and invitation-link features. The navigation check now verifies
  that phone links omit obsolete referral parameters. TypeScript, the configured
  production build and formatting pass. Funded activation/fee collection was not
  attempted.

### Local builder configuration, 28 October

The operator subsequently registered a dedicated Flight builder wallet. A read-only
mainnet check at **15:11:42 UTC**, finalized slot **462522291**, verified the builder
account owner, active status, authority, collector and **10-bps registered fee**
against Flight's **10-bps global cap**. The application's `readBuilderRoute`
validation passed using that authority and rate.

Only ignored `.env.local` now enables this builder at **0.10%**. Referrals remain
blank. The public template keeps both features disabled. The authority and collector
are recorded only in ignored `output/builder-registration-2026-10-28.json` rather
than publishable documentation. Registration verification does not prove that this
app has executed a trade or collected a fee; funded acceptance is still pending.
The 24 targeted monetization tests and configured production build pass. Vite
loads the intended authority/rate with referrals disabled; the public template
remains blank and publishable source contains neither local account address.

## Browser checks

### Trade readiness and position chart, 28 October

- Reviewed the ticket, SDK instruction construction, account freshness, exact
  wallet-message checks, simulation, receipt persistence and recovery paths.
  [Trade readiness](trade-readiness.md) lists the fields and deliberate omissions.
- Added the selected wallet's current average-entry line and unrealized P&L to
  the chart, plus entry/mark/P&L in Positions. These use the per-market SDK margin
  result, not account-wide P&L or candle prices. Stale, mismatched, closed or
  different-wallet positions do not render an overlay.
- Fixed Trade's setup entry to open the same funding/onboarding flow used by
  Assets. It previously called ordinary setup directly, which would have skipped
  the configured referral if a fork enabled one. Referrals remain disabled locally.
- **127 tests in ten files** pass, including 11 position-presentation cases.
  TypeScript, formatting and the configured production build pass. The existing
  large-chunk and provider externalization warnings remain.
- At **16:03 UTC**, public reads/streams and unsigned construction passed **5/5**.
  The trading probe read **104 markets**, checked book/RPC slot alignment and
  constructed funding, market, limit, native TP/SL, cancellation and synthetic
  Flight transactions. Unfunded onboarding simulations were refused with
  `AccountNotFound`, as expected. No financial message was signed or sent.
  New records: [public](evidence/public-probe-2026-10-28-readiness.json),
  [trading](evidence/trading-probe-2026-10-28-readiness.json).
  The existing Node WebSocket shutdown warning occurred after the public checks.
- Browser-tested limit price/quantity and notional, GTC, TP/SL fields and
  reduce-only close mode. The configured production build rendered a **160-candle
  ETH chart at 390×844**, without a position overlay for an anonymous user,
  horizontal overflow or captured console errors. Capture:
  [production trade screen](images/trade-readiness-2026-10-28.jpg).
- The production chart component was separately exercised in an ignored, explicitly
  labeled **synthetic visual fixture** at 390×844: long/short, positive/negative
  P&L, updated P&L, closure, staleness, wallet/market changes, an entry outside the
  candle range and remounting. The line cleared/reappeared correctly, autoscaling
  included the entry, and no console errors were captured. This proves display
  behavior only; [fixture capture](images/chart-position-fixture.jpg).
- A fresh dependency audit still reports **30 affected package entries: 21 high,
  9 moderate**. No forced dependency replacement was performed. Public-release
  findings and all funded/device acceptance items below remain open.

- At **390×844**, Home renders the two-piece black/red/gold mark. Two aligned hero
  layers keep the wave floor fixed while only the transparent logo floats over
  6.5 seconds. Browser samples confirmed an unchanged base rectangle/transform
  and changing logo transforms. Reduced-motion CSS disables logo animation.
- Removed the Home Live badge, both Markets Perpetuals badges and the redundant
  Search context row. Anonymous screenshots capture the simplified layouts.
- The Home footer pairs zupa branding with "Powered by Phoenix" and the official
  orange Phoenix mark. The locally served SVG loads at phone width and links to
  Phoenix's official site; the footer has no horizontal overflow.
- Home Search opens a full searchable page, with input focus, back, clear, empty
  results and genuine Phoenix market names/logos. ETH selection opens its ticket.
- Markets category filtering shows actual stock contracts; Crypto, Commodities,
  Indices and Pre-IPO are separate filters. Explicit overrides supplement missing
  venue classification. Unknown listings remain in All.
- Signup/login opens the real Privy email modal directly. It opens, focuses and
  closes without the intermediate app signup screen. No email/OTP was entered by
  the agent. Legacy auth routes invoke this same entry path.
- Account shows settings directly and About shows “Repository link coming soon.”
  Assets has a title-only header; balances refresh automatically and failures retain Retry.
- Trade renders Market/Limit, Open/Close, Long/Short, a percentage sizing slider and
  TP/SL fields. The logged-out slider cannot fabricate account capacity. An example
  ETH amount and TP/SL were entered only to inspect layout; no order was submitted.
- The Trade submit action has a measured **20px** gap below estimates. The manual
  account refresh button and healthy Live book indicator are removed. Account
  polling and error Retry/Reconnect controls remain; no horizontal overflow was
  observed at 390px.
- Time in force is displayed beside TP/SL and matches the existing packets:
  **GTC** for a resting limit order with no slot expiry, **FOK** for market packets
  whose minimum fill equals the requested size. Both explanation sheets were
  opened, and TP/SL fields plus the Close state were checked. At 375px the controls
  do not overlap, the submit gap remains 20px and the page has no horizontal
  overflow. The price-protection footer is removed; bounded execution and the
  exact review price limit remain. The existing 29 order-preparation tests pass.
- **375×812** and **390×844** trade layouts have no horizontal document overflow;
  the navigation remains inside the viewport and the 160-candle ETH chart expands.
- The configured production origin restores the creator's existing authenticated
  session and lists the existing wallet. Read-only wallet selection was exercised;
  wallet balances and the account-setup prerequisites render. The initial check
  used the local RPC proxy; a rebuilt configured production bundle subsequently
  read them through the creator-provided Helius endpoint. No wallet confirmation
  or financial action was invoked. Personal captures are excluded from the repository.

The blank-Privy production build loads public market data and explains disabled
sign-in. At 1280×900, production ignores `preview=mobile` and renders the mobile-only
handoff. Localhost has no QR that would incorrectly point a phone to itself.

Anonymous visual evidence is in `docs/images/`. See the [historical UI review](history/ui-review-2026-10-28.md)
for the reference comparison and screen-specific results.

## Runtime issues found during verification

The configured production build initially failed during an eagerly created Phoenix
codec. Automatic splitting had introduced an initialization-order cycle with shared
Solana modules. `strictExecutionOrder: true` in Vite's Rolldown output preserves
source initialization order; a fresh configured production load now renders Account
and Assets and restores Privy. This setting has a bundle-size cost. See
[Rolldown's documented option](https://rolldown.rs/reference/Interface.OutputOptions#strictexecutionorder).

The direct shared public Solana RPC returned **403 in the browser**, although the
Node probe could read it. Vite provides a local `/api/solana` fallback proxy to that
same public endpoint when no RPC is configured. On 28 October the creator supplied
a Helius endpoint, saved only in ignored `.env.local`. It overrides that fallback;
Node mainnet reads and authenticated browser balance reads passed. The public
template still requires each hosted installation to configure its own
browser-enabled mainnet RPC. The earlier generic “retry” message now explains a
rejected connection. See [wallet setup](wallet-setup.md).

A development fast-refresh context identity failure was fixed by moving the shared
trading context/hook to `src/trading/state.ts`. Older stopped WebSocket actor and
provider distribution/build warnings remain recorded in
[release findings](release-findings.md); clean teardown across all runtimes is not claimed.

## Earlier evidence retained

- **26 October:** clean npm installs, the initial 35-test lab suite and five public
  SDK probe checks passed. The original
  [public probe](evidence/public-probe-2026-10-26.json) contains read/stream and
  unsigned registration/order evidence. Injected failures checked retry,
  stale-response rejection and stream recovery; they were controlled browser faults.
- **26 October:** the creator reported completing Privy email/OTP login. Their
  screenshot showed an authenticated session and a connected selected Solana wallet.
  This is user-reported, screenshot-supported discovery evidence, not proof of
  wallet creation, recovery or transaction signing.
- **26–27 October:** earlier 43- and 53-test UI checkpoints verified the original
  preview-only product. Those financial limitations describe that earlier version,
  not the current implementation. The latest changes above supersede the earlier
  signup intermediary, fixed notional presets and four-corner mark.

## Outstanding acceptance

### Funding destination update — 28 October

- **144 tests in 11 files** pass. The 17 new withdrawal tests cover destination
  parsing, rejection of program/token accounts, exact USDC amount and recipient,
  recipient-account creation, same-wallet behavior and signed-message substitution.
- Type checking, formatting and a configured production build pass. The existing
  large-chunk build warning remains.
- The updated unsigned SDK probe constructs an external withdrawal at **981 bytes**,
  including compute-budget instructions, below the 1,232-byte limit. See
  [funding probe](evidence/trading-probe-2026-10-28-funding.json). Its unfunded setup
  and referral simulations still return `AccountNotFound`; this is not successful
  execution evidence.
- The authenticated local browser shows **USDC only · Solana network** on Receive,
  a destination address on Withdraw, inline invalid-address feedback and a working
  **Use my app wallet** shortcut. An empty/unregistered account cannot review a
  withdrawal and no longer offers account activation on that tab. Authenticated
  screenshots stay in ignored `output/`.
- Automatic deposits and Kora/Privy fee sponsorship are researched in
  [funding abstraction](funding-abstraction.md), not enabled. No financial
  transaction was signed or submitted during these checks.

### Automatic app wallet — 29 October

- **161 tests in 12 files** pass. The 17 new wallet-resolution cases cover reload,
  provider readiness, current-user identity, primary/legacy wallets, external and
  imported wallet rejection, disconnection and ambiguous metadata.
- Type checking and a configured production build pass. The existing large-chunk
  warning remains; this change does not establish device or funded readiness.
- A deliberate reload of the authenticated local Home page restored the existing
  wallet automatically and showed **Deposit** with the observed empty balance.
  Account showed the same wallet address with Copy and Explorer, with no selection
  control. The authenticated screenshot stays in ignored
  `output/account-automatic-wallet.jpg`.
- Transaction/message signing still requests Privy's confirmation UI and checks
  authority and user continuity. No new delegation, one-click signing, automatic
  deposit, paymaster configuration or financial transaction was enabled/executed.

### Session-loading polish — 29 October

- Home, Account and Assets now distinguish unknown session state from confirmed
  logout. Shaped placeholders pulse while authentication/wallet discovery completes;
  initial equity reads have a separate placeholder. Reduced-motion settings disable
  the pulse/reveal. Errors end loading and retain recovery controls.
- Real authenticated Home and Account reloads visibly showed their loading states
  without signup/login controls, then restored the same existing app wallet.
  Local captures: `output/home-loading-live.jpg` and `output/account-loading-live.jpg`.
- An isolated local UI fixture checked restoration, wallet connection, balance
  loading, loaded, logged-out, wallet-error and balance-error states. Home's market
  card position stayed fixed through restoration, balance loading and loaded states;
  Account and Assets shifted less than 3 CSS pixels in that fixture. Its balances
  and identity are synthetic; this is UI evidence, not funded execution.
- Existing 161 tests, type checking and the configured production build pass.
  No signing permissions, funding behavior or provider billing changed.

### Simple MVP funding — 29 October

- Receive now explicitly requests **USDC + SOL on Solana** at the same app-wallet
  address. The copy separates USDC collateral from SOL kept for fees/account rent.
- The authenticated browser preview shows the revised Receive screen, QR code,
  address and Copy control. Capture: `output/funding-usdc-sol.jpg` (ignored).
- Kora/Pimlico and automatic swaps are deferred in the product scope and README;
  inactive paymaster placeholders were removed from the public environment template.
  The previously stored provider credential remains ignored and unused by the app.
- This is a copy/documentation change. No signer, transaction, billing or automatic
  deposit behavior changed. No financial transaction was signed or submitted.

### Preflight review — 29 October

The [fresh preflight record](preflight-2026-10-29.md) covers 161 passing tests,
configured build and formatting, public/unsigned probes, a read-only check of the
active 10-bps builder, authenticated browser navigation and the funding/trade
controls. The initial concurrent probe was throttled; its separate retry passed.
Dependency findings and SDK connection/disposal warnings remain recorded. No
financial transaction was signed or submitted. One-click is still absent and is
recommended after the first successful baseline funded round trip, followed by
separate authorization/recovery tests and another trading acceptance run.

### Funded and device acceptance

A user-controlled funded round trip must still verify venue eligibility, successful
activation, deposited collateral, actual fills/cancellations, native exit triggers,
reduce-only closure and returned withdrawal funds. Record each confirmed signature
**and resulting account state**. A successful login, simulation or receipt alone
is not a fill. Follow the sequence in [wallet setup](wallet-setup.md).

Also outstanding: physical iPhone/Android wallet signing and recovery, rejection and
network interruption with real pending transactions, multi-tab recovery under live
conditions, provider rate limits, hosted QR scanning, full accessibility/security
review and dependency/license release findings. The installable PWA shell is not
implemented. No public hosting or repository publication was performed.

The local Flight builder is registered and its configured 10-bps rate has been
verified as recorded above. Taking-fill fee/collector deltas and resting-maker
behavior still need funded acceptance. Referrals are deferred and disabled until
the operator has an eligible code; attribution, discounts and rewards are unproven.
Passing local checks and registration do not demonstrate collected revenue.

### Funding sheet layout — 29 October

- Removed the shortened wallet address below Assets equity and its loading
  placeholder; kept a 24px gap before Deposit/Withdraw. Wallet details remain in
  Account and Receive.
- Funding review notes now have 18px above them, and destination-address help has
  12px above it. The address input uses 16px text.
- Shared funding and transaction sheets now stay inside the development phone
  frame. The authenticated preview measured 388px for the sheet inside a 390px
  bordered frame, replacing the previous 480px sheet. Closing it returned focus
  to Deposit. Real phone layouts continue to use a viewport portal.
- Production components were also checked in isolated 320px and 430px iframe
  viewports, including a 390px viewport height. Long trade-review details wrap;
  the review and withdrawal buttons remain reachable by scrolling. This fixture
  used sample account/review data with signing and network requests disabled.
- Local captures are in ignored `output/assets-clean-equity.png`,
  `output/funding-deposit-mobile-spacing.png`,
  `output/funding-withdraw-mobile-spacing.png`, and
  `output/review-small-height-scroll.png`.
- 262 tests, production build and formatting pass. The existing large-chunk
  build warning remains. No transaction was signed or submitted in this check.
  Funded withdrawal, physical-phone keyboard/safe-area checks and installed-PWA
  testing remain outstanding; the PWA shell has not been implemented yet.

## 29 October — PWA build and Cloudflare phone-test handoff

This supersedes the earlier missing-PWA checkpoint above. The creator chose a
temporary unprotected Cloudflare URL; no Vercel deployment or provider dashboard
settings were changed.

- Added the standalone manifest, 192/512px icons, padded maskable icon and Apple
  touch icon/title. All icons derive from the existing zupa mark.
- The production-only worker precaches public assets. A local browser check
  inspected 323 distinct cached requests: build assets, brand/icon files, the
  manifest and offline HTML only. No RPC/account/quote/auth responses were cached.
- In an isolated 390px production iframe, deliberately failing the local app
  server produced the actual worker's reconnect page. Restoring it loaded fresh
  app data. This is a local network-failure rehearsal, not a physical phone test.
- A subsequent build displayed the update notice while leaving the existing app
  running. Updates do not call skipWaiting, claim clients or reload active tabs.
  All old app windows must close before the worker activates.
- A hosted tab retained an old lazy-module URL across a rebuild and displayed the
  existing wallet recovery screen. Reloading the completed build restored Home;
  closing/reopening the app was then checked for update activation. No signing was
  in progress. The phone-test guide now says to finish actions and close tabs
  before rebuilding the preview.
- Offline review and confirm guards are covered by regression tests: no prepare
  or signing execution when offline. The existing transaction journal is retained.
- Cloudflare served the app, manifest and worker with HTTP 200. Read-only Helius
  CORS preflight and RPC requests using the actual HTTPS origin both returned 200;
  the full genesis hash matched mainnet. Privy returned 200 with that CORS origin
  and an empty allowed-domain list. The actual hosted page displayed market data
  and opened the Privy email form in a mobile iframe. No OTP was sent, login
  completed, signature requested or transaction submitted in these checks.
- 269 tests across 25 files, production build, full source formatting and diff
  whitespace checks pass. Browser evidence and a redacted origin-check report are
  in ignored `output/pwa-*` files. The test harness was served on a separate local
  port and is not part of the tunnel's production build.

The creator separately reported that withdrawal succeeded. This report is not
freshly independently observed execution. Physical-device installation, standalone
launch, login/wallet continuity, keyboard/safe areas and funded signing remain
the next acceptance step. Follow [PWA phone testing](pwa-testing.md).

Dependency note: the added PWA build-tool chain is flagged for the low-severity
`deepmerge` advisory GHSA-gcqx-w48m-w2h4; npm's suggested downgrade is not a compatible
fix. It processes build configuration and is not shipped as app code. The overall
dependency audit still has release findings; this step is not a security audit.
