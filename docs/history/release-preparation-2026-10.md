# Release preparation history — 30–31 October 2026

These are dated checkpoints from before the final source audit. Test counts,
open gates and UI details describe those checkpoints. Use the
[current release checklist](../release-checklist.md) for present status.
The fresh-install disk-space failure recorded here was resolved in the final pass.

## Preparation results — 30 October 2026

- `npm run check`: passed, including **277 tests across 26 files**. Final type,
  formatting, repository-hygiene and license-drift checks also passed after the
  release tooling edits. `git diff --check` passed.
- Exact-value comparison against local environment configuration found no copied
  configuration values in release-source files. This and `check:repo` are scoped
  hygiene checks, not a complete secret or security audit.
- The generated notices cover **600 installed production package/version entries**;
  **26** lack a root license/notice file and remain identified for review.
- Browser checks confirmed immediate tab/category selection, sheet grip dismissal,
  focus restoration and a fresh funding draft on reopening. No transaction was
  signed or submitted. Reduced motion is supported in code; physical-device
  verification of the new motion remains outstanding.
- **Fresh install is incomplete:** `npm ci` with Node 24 started installing but
  stopped with `ENOSPC` (disk full). The partial temporary install was removed.
  `npm ci --dry-run --ignore-scripts --no-audit --no-fund` passed with Node 24;
  this verifies dependency resolution, not a successful installation.
- **Configured production build passed on the 30 October retry:** after disk
  space became available, `npm run build -- --outDir output/release-configured`
  succeeded, including type checking and service-worker generation. The phone
  preview was updated, retaining old hashed assets for already-open tabs. Its
  HTML, manifest and service worker matched the new build over HTTPS. This reused
  existing dependencies. The initial credential-free isolated build stopped with
  `ENOSPC`; the credential-free build was subsequently verified on 31 October below.
- Dependency audit: **34 affected package entries (23 high, 7 moderate, 4 low)**.
  The release audit gate remains failing; see [findings](../release-findings.md).

## Maintainability and documentation pass — 31 October 2026

- Extracted order-book rendering and account cards from Trade, transaction-review
  disclosure from the provider, and shared account/action types from the service.
  The review/sign/submit/reconcile sequence is unchanged.
- Added amount-unit comments, architecture and configuration guides, a documentation
  index, contributor conventions and issue forms. The README includes independent
  community hackathon context and three fresh anonymous screenshots.
- `npm run check` passed: type checking, formatting, repository hygiene and
  **277 tests across 26 files**. `npm run licenses:check` passed with the same
  600 entries / 26 missing root license files; dependencies were not changed.
- Both production variants passed on Node 24.10.0 using the existing dependency
  installation: the public build with every provider/monetization value blank,
  and the configured Privy build. Both emitted the manifest and service worker.
  Existing large-chunk, provider worker-externalization and service-worker build
  deprecation warnings remain; these are not warning-free builds. Both variants
  rendered the ETH ticket and live public order book in anonymous production
  browser sessions without captured console errors. The public build correctly
  disabled login; the configured build exposed it. Login/signing were not exercised.
- Browser smoke checks at 390px and 320px verified public Home/discovery, the ETH
  book, funding details, account tabs and chart expansion. No horizontal document
  overflow was present at 320px. These were desktop browser viewports, not a new
  physical-device or funded test. No transaction was signed or submitted.
- Current audit: **40 affected package entries (23 high, 15 moderate, 2 low)**.
  The unchanged dependency tree is now also flagged for glob/minimatch in the
  build toolchain; see [release findings](../release-findings.md). The audit gate fails.
- A fresh dependency installation remains unverified after the earlier `ENOSPC`.
  This pass reused installed dependencies; successful builds do not close that gate.

## Phone preview and privacy review — 31 October 2026

- Rebuilt the configured production preview and verified matching HTML, entry
  JavaScript, manifest, service worker and offline page over a fresh HTTPS tunnel.
  Public Home/market data and the Privy login form rendered. No login, signing
  or transaction was completed; the next physical-phone test belongs to the user.
- Reviewed all **191 candidate source files**, including untracked files, against
  local configuration values and common credential patterns. No credentials,
  personal wallet identifiers or local filesystem paths were found in the release
  files. The default public Phoenix API URL is intentionally included.
- Confirmed local environment files, build artifacts and raw reports are ignored
  and absent from the Git index. No branch/tag history or remote exists yet;
  local Codex snapshot references are not part of the planned initial source push.
- Removed wallet/collateral balances and account-specific position values from
  two historical JSON reports and their accompanying narrative. Original records
  remain in ignored local output; the public reports explicitly note the omissions.
- Visually reviewed all **16 documentation screenshots**: anonymous screens or a
  clearly labeled synthetic chart fixture, with no personal account information.
  The JPEGs contain no EXIF/XMP, IPTC or comment metadata.
- Extended `check:repo` to detect copied local configuration, including query-token
  fragments and credentials in `.env.example`, without printing matched values.
  A synthetic isolated-checkout rehearsal exercises acceptance and rejection paths.
  This is a scoped source/privacy review, not a complete security audit; the
  dependency and funded-release gates above remain open.

## Market and navigation polish — 31 October 2026

- Reusable four-tab glass dock with sliding selection, solid selected Home,
  scroll-down compaction and expansion on upward scroll, tapping or keyboard focus.
  Market categories and rows now use circular identities, Phoenix badges, venue
  maximum leverage and public 24-hour volume. QQQ/SPY/TLT have local provider artwork.
  Follow-up polish replaces the Markets search icon with a chart, removes the
  redundant list heading and replaces generic index ticker tiles with actual
  Invesco, State Street and iShares symbols.
- `npm run check` passed: **285 tests across 28 files**, plus type checking,
  formatting and repository hygiene. No runtime dependency was added.
- The configured production build passed and its new entry, manifest, service
  worker and local icon files were verified over the existing HTTPS phone tunnel.
  Static icon precaching includes the new artwork. Existing build warnings and
  the dependency/fresh-install gates above remain open.
- Browser checks covered 390px and 320px layouts, filtering, empty search, market
  navigation, upward-scroll expansion away from the top, same-tab expansion,
  and chart/dock clearance. The configured anonymous preview had no captured
  console errors or warnings during these checks. No transaction was signed.
- Updated the three anonymous README captures and asset source/license notices.
  See the [visual QA record](../../design-qa.md). This is browser evidence, not a new
  physical iPhone/Android or funded acceptance run. Publishing remains deferred.

## Shared surfaces — 31 October 2026

The follow-up shared-surface pass on 31 October extends the glass treatment to
buttons, search, category pills, selectors, panels and sheets. It adds no runtime
dependency or trading logic. `npm run check` passed again: **285 tests / 28 files**,
types, formatting and hygiene across **207 release-source files**. The configured
build passed; HTML, entry JavaScript, application CSS, manifest and service worker
matched the build over the existing HTTPS tunnel. Browser checks covered 390px
and 320px layouts, category selection, empty search, sheet dismissal/focus return,
and the 1280px desktop handoff. Anonymous README images were refreshed.

The authenticated development UI encountered Phoenix HTTP 429 rate limiting on
account refresh. The anonymous production preview populated public market/book
data and had no captured console errors or warnings. No transaction was signed
or submitted during this visual pass; the existing release gates remain open.

## Navigation and equity follow-up — 31 October 2026

- Home now keeps its Lucide outline in both states. Dock width, maximum width and
  height ease together over 420ms; the instant maximum-width change was causing
  the earlier snap. Deposit hover preserves its gradient and animates brightness
  and edge emphasis. Assets no longer shows the Overview margin-mode badge.
- Assets adds a read-only 24-hour equity sparkline using Phoenix's 15-minute
  portfolio snapshots. Change includes deposits/withdrawals; empty, partial,
  stale, offline and failed histories have explicit handling. No signing or
  transaction-construction code changed and no dependency was added.
- `npm run check` passed: **293 tests / 30 files**, type checking, formatting and
  repository hygiene across **210 release-source files**. The configured build
  passed, and its HTML, entry JavaScript, CSS, manifest and service worker matched
  the existing HTTPS phone preview. Existing upstream build warnings remain.
- Browser checks verified the same Home SVG shape, gradient-preserving hover,
  compact/expanded sizes at 390px and 637px, and an intermediate maximum width
  during expansion. The 320px Assets error state stayed within the viewport.
  Actual history rendered in the authenticated Assets DOM; recurring account
  HTTP 429 responses later made the account unavailable. A separate local,
  read-only component check rendered real history without the trading provider.
  No transaction was signed or submitted. Physical-device motion and the existing
  release gates remain unverified.
