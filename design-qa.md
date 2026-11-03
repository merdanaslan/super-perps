# Mobile navigation and market discovery QA

31 October 2026. Scope: the creator's FOMO reference direction applied to zupa's
existing four-tab mobile PWA. This is visual and interaction QA, not a trading audit.

**Final result: passed**

## Comparison evidence

- Source visual truth: the creator's three FOMO screenshots, retained locally as
  `output/ui-polish/references/{expanded,compact,crypto}.jpg`, plus the follow-up
  glass reference at `output/ui-polish/references/glass.png`. Reference screenshots
  remain in ignored local output and are not redistributed in the repository.
- Original sources: 591 × 1280 for the first three and 1170 × 2532 for the glass
  reference. Normalized copies are 390 × 845 and 390 × 844 respectively. The
  one-pixel aspect-ratio difference is not a layout finding.
- Implementation: anonymous configured production build, rendered at 390 × 844
  CSS pixels, with 390 × 844 captures; no browser frame or simulated status bar.
  Additional narrow check: 320 × 740. These are desktop browser viewports.
- Full-view comparison: normalized source and rendered Markets captures were
  opened together in the same comparison input. Final evidence is
  `output/ui-polish/references/glass-390.png` and
  `output/ui-polish/release-markets-final.png`.
- Follow-up review: `output/ui-polish/indices-release.png` verifies the provider
  artwork, simplified legend and chart icon on the configured HTTPS preview.
  The source and the 390px index view were inspected together. QQQ/SPY/TLT use
  their underlying fund providers' symbols, an intentional adaptation rather
  than a copy of the different index marks in the FOMO screenshot. The index
  rows also fit at 320px without horizontal overflow.
- Focused navigation review: `output/ui-polish/nav-home-final.png` shows the
  bottom 94 pixels at the same 390px width. It was compared with the readable
  bottom dock of the normalized full source. This isolates icon fill, capsule,
  rim, transparency and touch spacing without comparing different image densities.
- States: expanded Markets/Crypto, filtered Indices, empty search, compact scrolled
  list, expansion while still 447px down the page, same-tab tapping at 616px,
  selected Home, and anonymous ETH ticket. FOMO puts markets within Home; zupa
  intentionally keeps Markets as its own tab. Live symbols, prices and volumes
  differ, so comparisons concern layout rather than market-value identity.
- Published project captures: [Home](docs/images/release-home.jpg),
  [Markets](docs/images/release-markets.jpg), [Trade](docs/images/release-trade.jpg).
  These contain public market data and no wallet identifiers or private balances.

## Findings and comparison history

1. **[P2, fixed] Category selection was too bright.** The first implementation
   inherited a general selection surface, producing a filled gray tab instead of
   the reference's subtle outlined chip. Scoped the discovery indicator styling.
   The repeated comparison shows a restrained dark selected pill.
2. **[P2, fixed] Dock looked too opaque and Home remained outlined.** Reduced
   background tint to 20–28%, reduced blur to 10px, and added fine rim/inset
   highlights. The final scrolled capture shows underlying asset colors and rows
   through the glass. Selected Home uses a real Heroicons filled silhouette;
   inactive Home remains outlined. The earlier two-part roof icon was replaced
   with the solid 20px variant for a clearer filled appearance at this size.
3. **[P2, fixed] Expansion depended on reaching the top.** The creator clarified
   that reversing scroll direction or tapping should expand the dock. Direction
   tracking now expands after a small upward movement; tapping and focus expand
   it as well. Browser checks and regression tests verify expansion while well
   below the top, and no page jump on tapping the already-selected tab.
4. **[P2, fixed] Index logos looked like placeholders.** The original local copies
   were Phoenix's orange ticker tiles. QQQ/SPY/TLT now use genuine Invesco,
   State Street and iShares symbols, with source provenance retained. The
   Markets dock icon is a chart and the redundant "Phoenix perps" list label
   is removed. The right-aligned "Price / 24h" label remains.

There are no remaining actionable P0/P1/P2 findings within this visual scope.

## Fidelity surfaces

- **Typography:** native system sans remains consistent with the iOS-style source.
  Symbol/price hierarchy, tabular figures and lighter secondary volume lines are
  clear. Leverage badges remain subordinate. At 320px, the first eight rows have
  no horizontal overflow; longer categories scroll horizontally.
- **Spacing and layout:** 48px circular market artwork and 72px minimum rows
  create consistent alignment. Dock geometry is 64px expanded / 56px compact,
  with at least 44px targets. On a 390px viewport it changes from 358px to 322px
  wide. Scroll content has trailing clearance, and Trade reserves chart space
  above the dock. The chart controls were clear of the dock at 320px and 390px.
- **Colors and tokens:** zupa retains true black, neutral chrome and green/red
  financial states. FOMO's navy, blue badges and green selected glow are intentional
  deviations; they are not copied into zupa. Real content shows through the glass,
  while the selected capsule and white icon stay readable. Blur has an opaque
  fallback, including for reduced-transparency preferences.
- **Image quality:** BTC is the orange/white variant; ETH is the dark mark in a
  white circle. SOL uses Phoenix metadata artwork. QQQ/SPY/TLT use actual fund
  provider symbols, served locally; the State Street vector is framed to its
  left-hand symbol, and the iShares icon is the source's 32px raster. The small
  venue badge uses the official Phoenix mark. Other
  assets retain their venue logo and neutral failure fallback. No FOMO artwork,
  screenshots or invented issuer logos are shipped. Source/license notices are
  retained in the repository.
- **Copy and content:** zupa keeps Markets, search and the four functional routes.
  Volume and leverage come from venue data; missing values remain dashes and
  isolated-only restrictions remain visible. Promotions, balances and extra tabs
  from the reference are excluded deliberately. Up/down triangles supplement
  color; navigation buttons retain accessible labels and current-page state.

## Interaction and runtime checks

- Market/category selection, empty search and recovery, and ETH routing passed.
- Downward compaction, upward expansion away from the top, tapping the current
  tab, and returning to Home passed. Horizontal category scroll does not compact
  the dock. Unit tests also cover keyboard focus and direction jitter.
- Configured anonymous browser console: no captured errors or warnings in the
  checked production session. Public order-book data populated after loading.
- The follow-up index images all loaded in the browser and matched the current
  build over HTTPS. Home, Markets and ETH screenshots were refreshed anonymously;
  JPEG metadata was removed before replacing the README images.
- `npm run check`: 285 tests / 28 files passed, with types, formatting and source
  hygiene. Configured production build and HTTPS static-asset checks passed.
- Motion is disabled in the reduced-motion media query; reduced transparency
  has an opaque style. These OS preferences were reviewed in code, not newly
  verified on physical hardware in this pass.

## Implementation checklist

- [x] Extract the reusable dock and scroll behavior.
- [x] Add transparent glass, active fill, selection motion and reverse-scroll expansion.
- [x] Retain routing, chart clearance and usable touch targets.
- [x] Restyle discovery with real values and attributed artwork.
- [x] Refresh anonymous README images, source notices and phone preview.

## Follow-up polish

- Recheck scrolling, keyboard behavior and safe-area spacing in the installed
  iPhone PWA and on Android. Native rendering may differ from the browser viewport.
- Existing funded acceptance and dependency findings remain documented in
  [release readiness](docs/release-checklist.md); this pass does not close them.

## Shared glass surfaces — 31 October 2026

**Result: passed for the visual scope.** The creator asked to carry the accepted
dock finish across the rest of the app. This follow-up uses that dock as the
material reference; it does not introduce a different palette or navigation.

- Added shared material tokens and `src/app/surfaces.css`: white primary actions,
  translucent charcoal secondary controls, matching selected pills, restrained
  panel highlights and dark frosted sheets. Amount/price fields remain opaque,
  and green/red trading semantics remain intact. Blur is limited to floating
  navigation and sheets, with opaque fallbacks.
- Inspected Home's Deposit/View assets actions, the funding sheet, account panel
  and order-type choices in the authenticated development view. These were
  read-only UI checks; the funding review was not submitted.
- Captured the configured anonymous HTTPS build at 390 × 844 in
  `output/glass-system/release-{home,markets,trade}.png` and
  `output/glass-system/order-type-sheet.png`. Visually compared the buttons,
  selected category and sheet rim with the dock in the same rendered screens.
  The three README JPEGs were refreshed from these anonymous captures, with
  private metadata segments stripped.
- At 320 × 740, checked category overflow, search focus/empty state, Assets and
  the order-type sheet. The sheet and document stayed 320px wide. Search retains
  16px text and its visible focus ring. Escape dismissed the sheet and restored
  focus to the Market button. At 1280px, the desktop phone handoff still rendered.
- `npm run check` passed: 285 tests / 28 files, type checking, formatting and
  repository hygiene. The configured build and HTTPS file comparisons passed.
  No new dependency or signing behavior was introduced.
- Phoenix returned HTTP 429 during authenticated account reads in development.
  This prevented a clean balance display in that session; it is not recorded as
  successful funding or transaction validation. The anonymous production check
  populated public data and captured no console errors or warnings.

Physical iPhone/Android rendering, keyboard placement and OS transparency/motion
preferences still need on-device confirmation. Those preferences were reviewed
in the CSS; the browser viewport checks do not simulate physical hardware.

## Navigation and equity follow-up — 31 October 2026

This follow-up supersedes the earlier selected-Home fill choice. The creator
requested the original outline, gentler resizing, a stable Deposit hover, removal
of the Assets margin-mode badge and an equity line beside the headline balance.

- Home uses the same Lucide SVG in every state; its selection capsule remains.
- Dock dimensions now share a 420ms ease-in/out transition, including maximum
  width. At 637px, expansion was observed at an intermediate 360.21px, rather
  than jumping from 360px to 420px. At 390px, the dock moved between 322px / 56px
  and 358px / 64px; scrolling upward at a nonzero scroll offset expanded it.
- Deposit kept the same gradient before and during hover. Computed brightness
  changed from 1 to 0.9, with a stronger rim and a 160ms transition. Opening and
  dismissing the funding sheet restored focus without preparing a transaction.
- Removed the Cross margin badge from Assets. Added the real 24-hour history
  sparkline, separate from live margin readings and labeled to include cash flows.
  It uses straight sampled segments with gaps preserved and explicit unavailable
  states; no invented account performance is displayed.
- The authenticated Assets DOM showed actual account history, followed by
  intermittent Phoenix HTTP 429 account failures. Verified the unavailable state
  at 320px with no document overflow. A temporary local component page then
  rendered the same chart from real Phoenix history without account polling;
  its private capture is `output/nav-equity/history-read-only.png`. This was a
  read-only component check, not a funded transaction or physical-phone test.
- All 293 tests / 30 files, types, formatting, hygiene and the configured build
  passed. New tests cover time/value units, missing data, account isolation,
  late responses, offline/hidden gating and polling failure. HTTPS assets match
  the built version. No dependency or financial signing behavior changed.

## Assets readability follow-up — 31 October 2026

- Removed the Overview row dividers, the separator above Overview and its
  redundant footer note. Labels are now 15px, near-white, with muted 12px helper
  text. Wallet is named without a unit; all amounts include USDC or SOL.
- Checked real account rendering at 390px and 320px. The narrow layout has no
  horizontal overflow; all six values retain their units. Private verification
  images remain under ignored `output/assets-overview/`, outside public docs.
- TP/SL has no underline. FOK retains its 1px dashed explanation underline.
- `npm run check` passed with 293 tests / 30 files; the configured production
  build passed. This pass changed presentation only and submitted no transaction.

## Compact dock tab switching — 31 October 2026

- Pointer focus no longer expands the dock ahead of the click. Keyboard focus
  still expands it without changing the selected route. Expansion and capsule
  movement now share a 420ms curve; the capsule's position uses the dock's layout
  instead of a transform relative to its own changing width.
- At 390px, sampled a compact Markets-to-Assets switch across the animation.
  Width and capsule position moved monotonically, from intermediate widths
  323.38px through 356.52px to the final 358px. The final capsule and selected
  button had the same center. At 637px, compact width was 360px; Tab focus expanded
  the dock while keeping Markets selected.
- Reduced the glass tint and backdrop blur from 10px to 8px, retaining the rim,
  readable icons and opaque reduced-transparency/unsupported-blur fallbacks.
- Trade now says "Free margin" and includes USDC beside both margin values.
  Checked real account rendering at 320px; the label and balance fit on one line.
  A draft quantity displayed the estimated margin; no order was submitted.
- `npm run check` passed: 293 tests / 30 files, types, formatting and repository
  hygiene. The configured production build passed. No dependency or margin
  calculation changed.

These are desktop browser viewport checks. The installed phone app still needs
the creator's visual check for native touch and rendering behavior.

## Search navigation and glass refinement — 31 October 2026

- Removed the search promotional card. The Home search trigger and opened field
  both measure 262 × 44px at 390px, at the same position, with 16px text. At 320px,
  both are 200 × 44px. Opening search focuses Back rather than the input.
- Search fills the app screen without scaling. The creator's final direction
  choice is entry from the left and exit back to the left on Back.
  At 390 × 844px, sampled entry positions moved from -193.8px toward zero and
  exit positions from -103.4px to -321.5px. The layer retained its full viewport
  dimensions and a scale of 1 throughout. The underlying tab stays mounted but
  inert; keyboard focus returned to the Home trigger after exit.
  Browser Back and Forward also exercised the slide transition.
- Checked keyboard entry, query results, clearing the query, the empty-result
  state and Escape. Replaced fixed negative category margins with the page-gutter
  token, removing a 4px horizontal overflow at the 320px width.
- Moved "Price / 24h" lower between category pills and the first price. Lightened
  the dock tint again and reduced its blur to 6px; the opaque accessibility
  fallback and touch-target dimensions remain in place.
- `npm run check` passed: 293 tests / 30 files, types, formatting and repository
  hygiene. After the final direction change, formatting and the configured
  production build passed again. No dependency changed.

No financial action was prepared, signed or submitted. These checks use desktop
mobile-sized viewports; native phone keyboard and touch behavior still need the
creator's device check.

## Search simplification follow-up — 31 October 2026

- Supersedes the slide animation above: search now opens and closes immediately.
  Removed its Motion wrapper and exit timing while preserving the mounted Home
  page, browser history and focus restoration on Back or Escape.
- Removed the logo from the search-page header. The field keeps its 44px height,
  16px input text and left alignment, extending to the right page gutter. It
  measures 301px wide at 390px and 239px wide at 320px, with no horizontal overflow.
- Both search fields now use a neutral gray inner edge for focus. Verified that
  the field and input have no outline, while text entry remains visibly focused.
  The Home search trigger uses the same neutral focus treatment.
- Browser checks confirmed a full-height page with no transform or animation,
  immediate dismissal, and restored focus on the Home trigger. The screenshots
  in `output/search-simple/` are desktop mobile-viewport checks, not phone captures.
- `npm run check` passed: 293 tests / 30 files, types, formatting and repository
  hygiene. The configured production build passed and was copied to the phone
  preview. No financial action was prepared, signed or submitted.
