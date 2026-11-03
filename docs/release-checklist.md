# Release readiness — 0.1.0 candidate

Updated 3 November 2026. This is the current release summary; older dated
verification notes are historical observations. Source preparation and automated
checks are distinct from publishing a repository or clearing a funded deployment.

## GitHub and hosted preview — 3 November 2026

- Published the reviewed source at [merdanaslan/super-perps](https://github.com/merdanaslan/super-perps).
  GitHub secret scanning, push protection and private vulnerability reporting are enabled.
- The Vercel preview uses Node 24 and private server RPC configuration scoped to
  the release preview branch. The builder fee remains zero. Production deployment
  is disabled while the dependency findings and hosted acceptance remain open.
- Fixed two differences exposed by hosted checks: Git's LF normalization of
  dependency notices and compiled server imports still referring to `.ts` files.
  CI now imports the emitted API entry points as a deployment regression check.
- GitHub's quality job passes, including **478 tests**, license verification and
  both browser builds. The separate dependency audit still fails with **24 high
  and 4 low affected entries**; it is not suppressed.
- **19 checks on the actual Vercel preview pass:** direct routes, PWA files,
  notices, missing-asset handling, HTTP and WebSocket login/origin rejection,
  unsupported HTTP methods and session clearing. Public markets and the Privy
  email panel load in a phone-sized browser viewport.
- These checks did not authenticate a wallet, subscribe through the upstream
  provider, sign or submit a transaction. Hosted login, balances, subscriptions
  and phone acceptance remain the next verification step before production.

## Dependency assessment — 3 November 2026

- Corrected the lockfile's Zod peer resolution without changing package versions
  or adding an override. A fresh `npm ci` and `npm ls --all` pass; CI now checks
  tree validity as well as the existing quality and audit jobs.
- Public and configured-placeholder browser builds pass. The decoder is absent
  from both builds, deepmerge is build-only, and the included Privy Zod 3 consumer
  uses a scalar error schema; no collection-validation exploit path was identified.
  None of the affected packages is imported by the server relay. See the
  [scoped exposure assessment](release-findings.md#exposure-in-this-app--3-november).
- **478 tests across 46 files**, type/format/repository checks and license
  verification pass. The audit still fails with **24 high and 4 low affected
  entries**. No incompatible upgrade or suppression was used.
- Recommendation: publish the educational source with the findings disclosed,
  then verify a hosted preview. Accepting unresolved upstream risk for a funded
  public deployment remains a maintainer decision, not an automated pass.

## Educational source review — 3 November 2026

- The maintainer chose to keep the existing provider key and relay protections
  for the first educational release. A separate production key and additional
  host/provider quotas are deferred, rather than requirements for this version.
  Authentication, method restrictions, byte limits and per-instance budgets remain
  unchanged; those budgets are not a global quota across server instances.
- A fresh unused-code scan found no unused source files, exports or declared
  dependencies. The larger trading and keyboard-handling modules support the
  current flows; no additional abstraction or infrastructure was introduced.
- The contributor guide now matches the private RPC setup and distinguishes
  useful regression tests from tests that merely assert copy or CSS. The
  architecture guide starts transaction reading with the short execution sequence
  before the larger React provider and builders. Existing safety tests are retained.

The dependency findings below still need a separate release decision. The later
publication and hosted checks are recorded above; this source review does not
certify that the app cannot be exploited.

## Security release review — 2 November 2026

- The maintainer reports that the current app works in phone testing. This is
  user-reported acceptance, not an independently witnessed transfer receipt or
  proof of every recovery/device case. No funded transaction was performed by
  the security-review tools.
- Fixed framing of the trading UI, expanded private-provider redaction/build
  checks to URL paths and decoded user-info, and cancelled oversized upstream
  response bodies promptly. Four regression tests failed before the latter two
  fixes and pass afterward. See the [security report](security-review-2026-11-02.md).
- A credential-free source copy passed a fresh `npm ci`, **478 tests across
  46 files**, type/format/repository checks and license verification on
  **Node 24.10.0 / npm 11.6.1**. Public-only and configured production builds pass.
- Source secret scanning found no leaks. All **331 configured production files**
  were checked against private RPC configuration with no matches. A separate
  bundle scan flagged three vendor-distributed client constants, reviewed against
  the installed vendor packages; these are not project credentials. Screenshot
  OCR covered 17 images and GIF frames; its email flag was the login placeholder.
- Knip found no unused source files, exports or declared dependencies with the
  server, service worker and diagnostic script entry points included.
- The updated production preview rejects framing and still loads the normal
  app and Privy email panel. The HTTPS phone tunnel returns the new headers.
  This verifies the local/tunnel host, not an actual Vercel deployment.
- **The release audit still fails: 24 high and 4 low affected entries in three
  dependency families.** No incompatible override, forced downgrade or audit
  suppression was added. A funded public launch is not cleared by this review.

At that review, the recommended next steps included a dedicated production key
and host/provider quotas; the 3 November scope decision above supersedes those
recommendations for this version. Remaining steps are to resolve or explicitly
assess the dependency findings, configure exact hosted origins and private
vulnerability reporting, and verify a Vercel preview before enabling production.

## Review sheet polish — 2 November 2026

- Restored the original viewport-based desktop/QR handoff at the creator's request;
  the trial portrait preference and rotate-phone notice have been removed.
- Review approval/refresh controls now live outside the scrolling details, with
  bottom clearance. Market/Limit cards have equal heights at each phone width.
- `npm run check` passes **474 tests across 46 files**, type, formatting and repo
  checks; the configured production build passes. Browser checks covered four
  review viewport sizes and three option-card widths. See
  [phone test details](pwa-testing.md#review-layout-follow-up-2-november).
- Physical iPhone orientation, keyboard and review acceptance remain device tests.
  No wallet approval or transaction was performed for these layout checks. The
  dependency findings below are unchanged.

## Private RPC relay — 2 November 2026

- Implemented the authenticated same-origin HTTP/WebSocket relay, private server
  provider settings, cookie renewal/logout handling and a browser-build credential
  guard. Vite dev/preview and the Vercel API entry points share the server code.
  See [relay boundaries](rpc-relay.md); the existing signing and confirmation
  lifecycle is unchanged, including HTTP polling while transactions are pending.
- `npm run check` passes: **473 tests across 46 files**, plus type, formatting and
  repository checks. An isolated source copy with no local credentials passed a
  fresh `npm ci`, all checks, license verification and the configured-placeholder
  production build using **Node 24.10.0 / npm 11.6.1**. An initial run of that
  isolated copy used the shell's unsupported Node 20 and hit an Intl formatting
  difference; rerunning on the documented Node 24 runtime passed without changing UI code.
- Tests include real ES256 JWT verification, exact-origin/session rejection,
  request/response limits, stalled-body cancellation, subscription expiry,
  large-integer preservation and the actual Kit HTTP/WS clients through a local
  authenticated relay with a test upstream. Test tokens never authorize mainnet calls.
- Both local configured and public-only production builds pass. A scan of all
  **331 configured production files** found no configured private RPC URL/key.
  Public-only build: 25 precached assets, about 2.8 MiB; configured build:
  329 precached assets, about 7.9 MiB. Existing chunk/worker/PWA warnings remain.
- Read-only checks against the configured Helius provider returned mainnet over
  HTTP and acknowledged WebSocket subscribe/unsubscribe. The temporary HTTPS
  preview served HTML, manifest and service worker with HTTP 200. Its relay
  rejected missing/invalid login with 401 and an unapproved origin with 403.
- Browser check at 390 × 844 loaded public market data and Privy's email login
  panel within the viewport. The cold provider bundle took tens of seconds over
  the temporary tunnel; no cold-load performance claim is made. No real login
  token, wallet signing or funded transaction was exercised in this check.
- License inventory: 600 production package/version entries, including server-only
  `jose` and `ws`; 26 lack a root license/notice file and remain identified.
- **Audit remains failing:** 28 affected dependency entries, 24 high and 4 low,
  in the existing Zod, decode-uri-component and deepmerge families. No findings
  were suppressed and no incompatible upgrade was forced. See [release findings](release-findings.md).

The maintainer's later phone acceptance and provider-scope decision are recorded
above. Review the remaining dependency and distribution findings, then verify
HTTP and WebSocket behavior on an actual Vercel preview. No GitHub repository,
Vercel project or deployment has been created by this change; a temporary phone
tunnel is not that deployment.

## Reproducible checks

```sh
nvm use # if using nvm; otherwise select Node 24 with your version manager
npm ci
npm ls --all
npm run check
npm run licenses:check
npm run build
npm run audit:release
```

`npm run release:check` runs these quality, license, build and audit gates together.
It intentionally fails when high/critical dependency advisories remain. A passing
quality job does not override the audit job. CI contains no live wallet credentials
and never sends transactions. Network probes are optional, unsigned diagnostics.

## Source preparation

- [x] Node version, pinned direct dependencies and npm lockfile.
- [x] Blank public environment template; local credentials/output excluded.
- [x] Quick start, code map, funding/signing boundaries and fork setup.
- [x] Contribution guide, security reporting guidance, changelog and MIT license.
- [x] GitHub Actions for formatting, types, repository hygiene, tests and both
      public/configured-provider builds; separate visible dependency-audit gate.
- [x] Dependency inventory and available license texts retained with attribution.
- [x] Static hosting config/instructions, direct routes and PWA update behavior.
- [x] Reduced-motion support for button, selection and sheet polish.
- [x] Shared typed trading contracts, focused UI components and comments at
      financial/asynchronous boundaries.
- [x] Illustrated README, architecture/configuration guides, documentation index,
      dated screenshot provenance and issue templates.

The source is committed and published; a release tag and production launch remain
separate steps. Keep package.json's `private: true`: this is a forkable app, not an
npm package.

## Wallet transfers — 1 November 2026

SOL and wallet-held USDC sends are implemented alongside the existing Phoenix
USDC withdrawal. Withdraw now selects the asset and, for USDC, the funding source.
SOL Max resolves the network fee before review and explicitly shows the remaining
SOL; sending all SOL requires replenishing it before later transactions.

- `npm run check` passes with **351 tests across 35 files**, including exact
  amounts, recipient validation, fee subtraction, USDC account creation, wallet
  switches and balance reconciliation during a Phoenix outage or delayed request.
- Wallet funds refresh independently of Phoenix. Pending transactions still block
  another send; a confirmed transfer waits for a fresh Solana wallet snapshot.
- Browser rehearsals at **390 × 844** and **320 × 640** verified asset/source
  selection, Max, destination entry, reachable reviews and no horizontal overflow.
  These used sample balances and disabled signing; they are not funded execution.
- Both the configured production build and the public build with browser provider
  settings cleared pass. The active phone tunnel serves the updated build; its
  home page, manifest and service worker return HTTP 200. License inventory and
  repository hygiene checks also pass; the existing dependency-audit findings below
  are unchanged.
- README, funding design, architecture, product scope and changelog describe the
  new flow. No provider credentials, dependency versions or deployment settings changed.
- **Still required:** small wallet SOL and USDC transfers on the phone, recipient
  balance verification, and a refresh/reopen check. Earlier funded withdrawal
  reports refer to Phoenix USDC, not these newly added wallet sends.

## Final source review — 1 November 2026

- **Fresh clone-equivalent installation passed:** copied candidate source into an
  isolated directory without local credentials or dependencies, then ran a full
  `npm ci --no-audit --no-fund` with Node **24.10.0 / npm 11.6.1**. Use the documented
  Node 24 toolchain; older Node/npm versions are not supported by this lockfile.
- `npm run check` passed in the fresh dependency-install verification with
  **306 tests across 32 files**. After the equity-chart follow-up below, the
  working checkout passed **318 tests across 33 files**, plus types, formatting
  and repository hygiene; the dependency lockfile is unchanged by that follow-up.
  The existing [read-only builder check](evidence/builder-zero-read-only-2026-11-01.json)
  resolved a 0 bps override against the active 10 bps registry default; no new
  live fee collection or registry update is claimed.
- Both production variants passed using the fresh installation: public browsing
  with no provider values, and the optional provider bundle with a build-only
  placeholder App ID. Both generated the manifest and service worker. Compilation
  with a placeholder does not verify provider authentication or signing.
- `npm run licenses:check` passed after the fresh install: **599 production
  package/version entries**, **26** without a root license/notice file. Review of
  their distribution terms remains separate from this drift check.
- A fresh Knip 6.44.1 scan reports no unused source files, exports or declared
  dependencies when the service-worker and script entry points are included.
  Dynamic class names, the unsigned integration lab and historical evidence were
  retained deliberately. The two CSS selectors without literal source matches are
  generated selection-tab variants; all shipped image assets have source references.
- The credential checker passed across **215 candidate files**, including comparison
  against local root `.env` / `.env.*` values and scanning SVG text. Local provider
  files, generated builds and raw diagnostic output are excluded from publication.
  Four isolated regression tests cover copied server configuration, URL fragments
  and redacted failure output. No credentials were detected by these checks; this
  is not a guarantee that every secret format or security flaw is detectable.
- README, module boundaries, comments, setup instructions, CI, license notices and
  ignore rules were reviewed. Local links and heading anchors passed across all
  34 Markdown documents.
  Setup instructions clarify that nvm is optional; deployment instructions now
  explicitly cover the supported zero-bps builder configuration. Historical notes
  live in [release preparation history](history/release-preparation-2026-10.md), keeping
  the current checklist separate from earlier counts and unfinished checks.
- Anonymous browser smoke checks against the fresh public production build covered
  Home, search/filtering, the ETH ticket and live order book, Assets at 320px and
  the desktop handoff. There was no document overflow at 320px/390px and no captured
  console warning/error during this pass. Missing provider configuration clearly
  disables login while keeping public browsing available.
  These are desktop viewport checks, not physical-device or funded acceptance.
- Dependency remediation added verified UUID, glob and minimatch overrides and
  four focused compatibility/regression tests. A fresh Node 24 install of the
  resulting lockfile, `npm ls uuid glob minimatch`, the complete quality suite,
  license checks and both production variants passed. An initial isolated
  reinstall exhausted disk space; temporary files were removed and the clean
  retry completed successfully before this result was recorded.
  A new anonymous production-browser smoke check covered market filtering,
  the ETH order book, disabled unconfigured login and the PWA update notice:
  the notice remained while the old window was open and disappeared after
  closing/reopening. No browser warnings/errors were captured. These checks
  did not sign or submit a transaction.
- Equity-chart follow-up: an actual portfolio-history response included the current
  unfinished 15-minute interval with a future end boundary. Filtering that row out
  left the preceding zero snapshot on the chart. The chart now retains that value
  at the read time and adds the latest fresh, wallet-matched account equity between
  history reads. An Assets refresh button reloads both data sources without hiding
  the chart. Regression tests cover the interval boundary, account changes, stale
  data, manual refresh, visibility/reconnection and valid zero/negative equity.
  Read-only checks with the existing logged-in account confirmed that the endpoint
  matched the displayed equity and moved with subsequent account updates. Both
  production build variants passed; the phone tunnel's HTML, service worker and
  manifest matched the new configured build. No transaction was signed or sent.

### Prepublication privacy and hosting review

Navigation follow-up on 1 November: **356 tests across 36 files**, typecheck,
formatting, repository hygiene and the configured production build pass. Browser
checks at 390×844 confirm that tab changes, market selection, Search Back/Escape
and Account Close keep a single app history entry. Direct search links and reloads
restore the intended tab; vertical pages and horizontal category lists still scroll.
The phone tunnel's HTML, manifest and service worker match the new build. Actual
iPhone edge-gesture acceptance remains a device check; old session history is not
erased. No transaction was signed or submitted during these checks.

Keyboard follow-up: **380 tests across 37 files**, types, formatting, repository
hygiene and the configured production build pass. Decimal commas normalize in SOL,
USDC, limit-price, order-size and TP/SL drafts without changing exact execution
validation. At 320px and 390px, a simulated keyboard viewport keeps the sheet header
and focused amount visible, with no horizontal overflow or document pan. The
unsigned UI rehearsal preserves a nine-decimal SOL amount through review and a
comma-entered USDC deposit amount; production market search and sheet dismissal
also pass. Native iPhone keyboard/zoom acceptance remains a phone check. No wallet
was connected and no transaction was signed or broadcast in these rehearsals.

The subsequent physical iPhone check still showed the funding amount obscured by
the keyboard. That supersedes the earlier simulated viewport result for native
acceptance. The revised sheet uses one visual-viewport positioning container and
rechecks field visibility after late focus/scroll events, including unchanged
bounds and browsers where `innerHeight` also shrinks. Funding focus styling stays
inside the field. **384 tests across 37 files**, types, formatting, repository
hygiene and the configured production build pass. Chromium rehearsals at 320px and
390px cover deposit/withdrawal amount visibility, destination-field switching and unchanged field width; backdrop,
drag and Escape dismissal return focus correctly. Physical iPhone acceptance of
this revision remains outstanding. The phone tunnel's HTML, manifest and service
worker match the rebuilt output.

The user confirmed that opening the keyboard improved on iPhone, then reported a
jumpy return when dismissing it. The dismissal follow-up pauses field scrolling
during that return and eases height/padding over 220ms, with reduced-motion support.
**386 tests across 37 files** pass. Chromium frame checks for USDC deposit, USDC
withdrawal and SOL transfer show a monotonic return and keep the amount visible
when reopening mid-transition. The subsequent iPhone report found that the extra
animation made dismissal worse and that Deposit was shorter than the other tabs;
the simulated result did not establish native acceptance.

The next revision removes that extra resize animation. Authenticated funding tabs
share a fixed tall frame; keyboard height and pan offset follow the native viewport
directly, and bottom padding follows the occluded space without a threshold jump.
Chromium checks at 320px and 390px confirm equal tab heights, unchanged amount-field
width and visible inputs through repeated USDC deposit, USDC withdrawal and SOL
transfer keyboard cycles. There is no delayed second layout adjustment after the
simulated keyboard closes. Native iPhone smoothness still needs the user's check;
these were unsigned UI rehearsals, not transaction tests. **386 tests across 37
files**, types, formatting, repository hygiene and the production build pass.
The phone tunnel's HTML, manifest and service worker match this rebuilt output.

2 November keyboard follow-up: the user still reported movement and identified
Search as the better reference. The previous bottom-aligned funding panel moved
about 115px in a 390px browser rehearsal, followed by scroll clamping when the
keyboard closed. Funding now uses a full-height panel with a steady top edge and
preserves the focused field's scroll position during that return. The layout
check fails before this change and passes afterward. Twenty-one simulated
amount/address cycles cover 320px and 390px layouts, including a modeled safe
area, USDC deposit, Phoenix withdrawal, wallet USDC and SOL transfers; all retain
visible inputs with no measured field drift on dismissal. Tab switching resets
the temporary scroll space. A regression also covers fractional-pixel clamping.
This remains browser evidence, not physical iPhone acceptance or funded execution.
**388 tests across 37 files**, types, formatting, repository hygiene and the
production build pass. The replacement phone tunnel serves matching HTML,
manifest and service-worker bytes from the current build.

The follow-up source review on 1 November passes **322 tests across 33 files**,
types, formatting and repository hygiene across **216 candidate files**. The
checker now examines staged blobs as well as working files, including extensionless
text and copied RPC path credentials. Four new failing-then-passing regressions
cover those gaps; matching values never appear in its diagnostic output.

The unused-code/dependency scan is clean after resolving the compatibility test's
FileList dependency through its actual consumer. Module boundaries and the
financial/asynchronous comments were reviewed; no transaction refactor was needed.
Stale contributor branding and the lab's unfinished-screen copy were corrected,
and superseded design notes now explicitly point to the current design system.

Local provider values were not detected in the candidate source or staged blobs.
Only the blank `.env.example` template is tracked; local environment files,
generated builds and private reports remain excluded. There are no commits or
remotes yet, so there is no committed history to redact. The configured Git author
uses a GitHub no-reply email. The 16 documentation screenshots and all four GIF
frames were visually reviewed: anonymous screens or explicitly labeled fixtures,
with no personal account information found. Image metadata contains no personal
or location fields; artwork metadata contains color-space/dimension information.

The configured test bundle does contain its public Privy identifier, builder
authority and credential-bearing RPC URL, as expected for a direct browser
integration. This is a **hosting configuration boundary**, not a secret removed by
ignoring `.env`. The new [visibility table](configuration.md#what-is-public) and
[deployment guidance](deployment.md#github-and-production-updates) explain public
browser keys, private server credentials, fork previews and production controls.
`.vercelignore` excludes local provider files and diagnostic output from uploads;
CI checkouts no longer retain Git credentials in checkout configuration.

The final public and placeholder-provider builds pass, and the license inventory
check remains unchanged. These builds use no live provider credentials; they do
not prove login or signing. The maintainer separately confirmed that the updated
equity chart works on the phone. No transaction, commit, push or deployment was
performed in this follow-up. Provider restrictions and GitHub/Vercel account
settings have not been configured or verified by these local checks.

The current audit still fails: **28 affected package entries — 24 high and 4 low,
no moderate or critical**. These are affected package entries, not independent
vulnerability counts. See [release findings](release-findings.md) for the paths
and the verified overrides. UUID, glob and minimatch findings were removed;
Zod, decode-uri-component and deepmerge remain. Provider versions and the
high/critical audit gate are unchanged.

Existing build warnings remain: large chunks, optional-provider worker
externalization and the PWA build plugin's deprecated bundler option. The fresh
provider build precaches about **7.9 MiB uncompressed / 328 static entries**;
public browsing precaches about **2.8 MiB / 25 entries**. These totals are not
measured network transfer sizes or phone startup times. A mobile performance pass
can narrow optional chunk precaching and optimize artwork before a wider rollout.

## Acceptance evidence

| Flow                                           | Current evidence                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Receive USDC/SOL and balances                  | Maintainer reported successful funding and automatic balance updates                                           |
| Phoenix setup and deposit                      | Maintainer reported completion and Phoenix equity increase                                                     |
| Limit order and cancellation                   | Maintainer reported success; earlier browser checks recorded resting order and subsequent removal              |
| Market opening and reduce-only closing         | Maintainer reported success; earlier read-only checks recorded the position and subsequent empty position list |
| Attached TP/SL creation                        | Maintainer reported success after the instruction-builder fix                                                  |
| Independent TP/SL cancellation                 | Local tests and unsigned mainnet simulations; separate funded acceptance still outstanding                     |
| Automatic TP/SL triggering/fill                | Not independently verified                                                                                     |
| Withdrawal                                     | Maintainer reported success; exact external recipient/amount not independently reverified in this release pass |
| Installed iPhone appearance                    | Maintainer screenshots and iterative on-device feedback; not a full signing/recovery acceptance run            |
| Android installation/signing                   | Not recorded                                                                                                   |
| Reload, ambiguous submission and multiple tabs | Automated/mocked checks; interrupted funded physical-device flow not recorded                                  |
| Flight builder-fee collection                  | Registration/routing validated; collector reconciliation not independently verified                            |
| Referrals                                      | Optional implementation; disabled for the maintainer's MVP and not live-tested                                 |

Detailed historical evidence: [trade readiness](trade-readiness.md),
[verification](verification.md), [phone testing](pwa-testing.md).

## Open gates before a funded public launch

- [ ] Resolve or explicitly review the upstream dependency findings in
      [release findings](release-findings.md). The dependency CI job currently fails.
- [ ] Complete the remaining device, interrupted-transaction and native-exit
      checks above using deliberately limited funds and the wallet owner's approval.
- [ ] Review distributed provider dependencies' custom terms and missing license
      texts for the intended deployment; retain all notices.
- [ ] Choose the repository/final HTTPS origin, set the real repository URL,
      replace the README clone URL and website placeholders, configure the fork's
      providers, and verify the hosted build.
- [ ] Select dedicated production provider configuration. A browser RPC URL is
      public; keep private credentials in the included server relay's private
      settings. Verify origin restrictions, quotas and separate preview configuration.
- [ ] Enable private vulnerability reporting and verify checks in the actual
      GitHub repository. Local success is not evidence that hosted CI has run.
- [ ] Protect the chosen production branch and keep Vercel Git Fork Protection
      enabled. Verify deployment checks or controlled promotion before relying on
      CI to block a production release.
- [ ] Create the initial reviewed commit and release/tag after the remaining
      limitations are accepted. Review the actual staged file list before pushing.

The source is prepared for sharing as an experimental educational starter with
these limitations disclosed. It is not cleared as an audited public trading
service. No commit, push, permanent deployment or financial transaction was
performed during this review.
