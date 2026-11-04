# Changelog

## Unreleased

- Add optional basic Vercel Web Analytics for hosted visits, with URL redaction
  and no custom events. Tracking is disabled by default and in local development.
- Correct Zod peer resolution in the lockfile without changing package versions,
  and check dependency-tree validity in CI. Document which remaining advisory
  paths are included in the browser, server and build tooling.
- Prevent external framing of the trading UI with matching local/hosted headers.
- Cover path and decoded user-info credentials in the RPC redaction/build guard,
  and cancel oversized upstream response bodies before reading them.
- Record a fresh source, dependency, bundle and documentation security review;
  unresolved upstream advisories keep the release audit failing.
- Keep review approval/refresh actions above the bottom safe area in a separate
  sheet footer, and give Market/Limit choices equal card heights.
- Add a shared authenticated HTTP/WebSocket relay for Vite dev/preview and Vercel.
- Keep private provider URLs in server settings; verify Privy login and exact
  origins, bound calls/subscriptions and preserve original transaction bytes.
- Add cookie renewal/logout handling and a build guard against private RPC
  credentials reaching browser assets. Trading confirmations still use HTTP polling.
- Document deployment controls and the remaining dependency audit findings.

## 0.1.0 — Unreleased

First educational super perps release candidate, prepared 30 October–1 November 2026.

- Super perps name and emerald bracket artwork across Home, startup, wallet UI,
  desktop handoff and installation icons; transaction recovery keys are preserved.
- Explicit zero-bps Flight routing for the educational configuration, with fee
  disclosure and regression coverage against a paid registered default.
- Floating glass navigation with a sliding active capsule, consistent outlined icons,
  and compact state that expands on upward scrolling or interaction;
  category pills, live volume/leverage rows and round asset/Phoenix badges.
- Shared glass surfaces for actions, search, category pills, selectors and sheets,
  with opaque financial fields and reduced-transparency fallbacks.
- Mobile Home, market discovery/search, Trade, Assets and Account; desktop phone
  handoff with a QR code on HTTPS. Internal navigation replaces the current history
  entry so edge swipes do not replay tab changes; explicit panel Back/Close stays available.
- Live Phoenix market data, order books and candlesticks with entry/P&L, resting
  order and TP/SL trigger overlays.
- Compact, read-only equity history on Assets from Phoenix's 15-minute snapshots;
  retains the unfinished interval and follows fresh account equity between history
  reads. A manual refresh reloads balances and history; the displayed change
  includes deposits and withdrawals.
- Privy email login and automatic primary Solana app-wallet restoration.
- Direct wallet SOL and USDC transfers, explicit USDC source selection, independent
  wallet balance reads and a fee-aware SOL Max review. The maintainer reports
  successful phone testing; see release readiness for the limits of that evidence.
- Cross-margin account setup, USDC deposits, wallet/external withdrawals, bounded
  full-fill market orders, GTC limits, independent TP/SL cancellation and
  reduce-only closing.
- Explicit simulated reviews, precise fee/rent disclosure, signature verification,
  pending transaction recovery and account reconciliation.
- Optional verified Flight builder fees and operator-configured referrals,
  disabled in the public template.
- PWA manifest/icons, dark branded startup, static-only offline caching and
  updates deferred until existing app windows close.
- Localized decimal-comma input without precision loss, plus keyboard-aware
  sheets with coalesced viewport positioning, a correction after native focus
  scrolling, anchored funding forms that preserve the field position on keyboard
  dismissal, consistent funding-tab heights, and neutral inset focus styling
  for funding amounts.
- Accessible sheets with drag dismissal, reduced-motion-aware selection indicators
  and restrained button feedback.
- Reproducible quality checks, CI, contributor/security guidance and dependency
  notices for forks.
- Shared trading contracts with documented units; separate order-book, account-panel
  and transaction-review components, preserving the reviewed execution path.
- Illustrated README, configuration and architecture guides, documentation index,
  and independent community hackathon context.
- Removed obsolete UI styles and unused exports; verified a fresh Node 24 install
  and both production build variants. Credential scanning now covers every local
  root environment file, with regression tests that keep diagnostics redacted.
- Prepublication checks also scan staged blobs, extensionless text and RPC URL
  path credentials; local Vercel uploads exclude environment files and raw output.
  Hosting guidance distinguishes public browser configuration from server secrets
  and explains production-branch and fork-preview controls.
- Patched transitive UUID and PWA glob/minimatch dependencies with compatibility
  tests and documented overrides. Remaining upstream advisories stay visible in
  the release audit; Phoenix and Privy versions are unchanged.

The maintainer reported successful funded account setup/deposit, limit order and
cancellation, market opening/closing, attached TP/SL creation and withdrawal.
These reports do not establish every device, trigger-execution or recovery case.
See [release readiness](docs/release-checklist.md) for outstanding gates; this is
not an audited or already-published release.
