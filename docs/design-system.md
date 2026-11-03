# super perps

Updated 1 November 2026 for the super perps name and emerald brand artwork.
The floating glass dock and two-line market discovery rows follow the creator's
FOMO reference, retaining the dark interface palette. Shared glass surfaces connect
buttons, category pills, selectors and sheets to the same visual language.

## Direction

A minimal, industrial trading interface with an emerald community identity.
True black is intentional: the selected reference uses an OLED-black canvas,
charcoal input fields and white typography. A translucent pill floats above the
home-indicator safe area, with an outlined capsule following the selected tab.
Home and onboarding have room to breathe; Trade is compact and functional.

- Product name: **super perps**, lowercase. A nod to the Superteam community that
  also reads naturally beyond Germany. It is an independent educational project.
- Brand mark: two-piece bracket frame in emerald green with mint highlights.
  The hero extends that language into a sculptural frame and fine green pixel
  waves. The geometry was inspired by the hackathon mark; no official Solana or
  Superteam endorsement is implied.
- Colors: black `#000000`, panel `#101114`, field `#17191f`, white `#f5f5f6`,
  secondary `#9399a4`, positive `#00c78b`, negative `#ff3d65`, gold `#f6c85f`.
- Brand green `#00c78b` appears in the artwork, educational icon and desktop
  headline. Trading colors retain their semantic meaning; amber remains for
  warnings. Primary controls stay neutral. Asset logos retain their own colors.
- Typography: native system sans, intentionally close to the iOS references;
  tabular numerals for financial values. No downloaded font dependency.
- Shape: pill-shaped authentication buttons and search; 20–23px content panels;
  6–9px compact trading fields; thin neutral separators.
- Icons: Lucide's consistent simple line icons, with stronger active nav weight.
  Home keeps the same outlined shape in every state; Markets uses a rising chart
  icon. Asset identities use round artwork, with local BTC/ETH
  variants, Phoenix artwork for SOL and official provider symbols for QQQ/SPY/TLT.
  Market discovery adds a small Phoenix venue badge.
- Motion: a 350ms Magic UI-derived Blur Fade and subtle 6.5-second float on the
  Home logo layer over a fixed pixel-wave base, respecting reduced motion.
  Startup uses the bracket mark, wordmark and a small spinner on black, with styles
  available before the app bundle loads. It never adds an artificial delay.
  Buttons use restrained press feedback, selection indicators move between tabs,
  and sheets enter/exit with short transitions. Reduced-motion preferences disable
  decorative movement. The dock contracts from 64px to 56px while scrolling
  down past 88px, and expands on upward scrolling, a dock tap, keyboard focus,
  or route changes. Small direction thresholds absorb scroll jitter; all tabs
  keep at least 44px touch targets.
  Resizing and selection share a 420ms ease-in/out transition. The dock's outer
  layout stays fixed: its glass background resizes while fixed-size icon buttons
  translate inward and downward. This avoids re-centering and repainting the
  icons inside a changing grid on every frame. The selection capsule also uses
  a fixed translation anchor, with its glass resizing independently, so changing
  tabs during expansion keeps one continuous movement. Pointer taps expand at the
  same time as navigation; keyboard focus can expand without switching tabs.
  These timings are an
  interpretation of still references, not measured FOMO motion.
  No count-up animations or decorative trade effects.

## Scope boundaries

Four routes in the floating dock: Home, Markets, Trade, Assets. Account is a full page from Home;
signup/login opens Privy directly. Legacy `/signup` and `/login` routes use the same modal.

Tab changes, market selection and full-page panels replace the current URL instead
of adding browser-history entries. This avoids an iPhone edge swipe replaying tab
changes. Search Back/Escape and Account Close return within the app explicitly;
reloads and deep links still restore the selected route. Horizontal overscroll is
contained where supported, while vertical scrolling, category scrolling and chart
gestures remain available. This does not erase entries from an older app session
or override the browser's own navigation to other websites.
No copied CEX promotions, bonuses, VIP tiers, spot accounts, fabricated sentiment
or unconfigured social sign-in controls.

Normal wide-screen visits show a mobile-only handoff. The developer phone preview
is compile-gated to Vite development mode. This viewport rule is a product layout
choice, not a security boundary or a claim of physical-device verification.

Brand asset prompts and provenance: [brand assets](brand-assets.md).

## Market discovery

Glass category pills scroll horizontally. Each row pairs a 48px circular
asset identity with its symbol, maximum venue leverage and real 24-hour volume;
mark price and daily change are aligned on the right. Leverage is a maximum
from Phoenix's tiers, not a selected position setting. Missing data stays as a
dash; isolated-only and inactive markets keep their restriction labels.
The list header keeps only the right-aligned "Price / 24h" label, centered in
the space between the category pills and the first price row.

All logos have a neutral fallback. Local marks are precached as public static
assets. Lists can scroll behind the dock, with bottom clearance so their last
rows remain reachable. Trade reserves space for its chart above the dock.

The dock uses a light charcoal tint, a 6px backdrop blur and restrained rim
highlights. An opaque fallback preserves contrast when blur is unsupported or
the device requests reduced transparency. No canvas renderer is needed for this
surface. Aceternity's [Liquid Glass](https://ui.aceternity.com/components/liquid-glass)
and [Floating Dock](https://ui.aceternity.com/components/floating-dock) were reviewed
as alternatives: the glass component documents a frosted fallback for Safari,
and the dock still requires adaptation to this app's route and scroll behavior.
The existing reusable `BottomNavigation` stays in place; neither library is added.

## Home search

Search fills the app screen and opens or closes immediately, without a slide,
zoom or scaling animation. The underlying tab stays mounted and becomes inert
while search is open.

The Home search trigger and search-page field share their left alignment,
44px height and 16px text. The search page omits the brand mark so its field
extends to the right page gutter. Opening the page focuses Back; tapping the
field brings up the keyboard. Back and Escape restore focus to the Home search
trigger without traversing browser history. A direct search URL returns to
its selected tab without leaving the site. Suggestions follow the header directly, with
no promotional card.

Search fields use a neutral inset edge for focus instead of the gold outer
outline. This applies to both Home search and the Markets tab.

## Shared surfaces

[`tokens.css`](../src/app/tokens.css) defines the material colors, edge highlights
and shadows. [`surfaces.css`](../src/app/surfaces.css) applies them across existing
components; layout and responsive rules remain in `app.css`.

- Primary actions use a soft white gradient with dark text. Secondary actions,
  search fields and compact selectors use translucent charcoal with a fine rim.
- Selected pills and sheet choices use the same highlight family as the dock's
  active capsule. Selection remains explicit through text contrast and ARIA state.
- Information panels have a quieter finish. Trading amounts and prices keep
  opaque fields for readability; long/short controls retain green/red with only
  a subtle top highlight.
- Bottom sheets use a dense dark tint and 24px backdrop blur. Blur is limited to
  floating navigation and sheets, rather than repeated controls or moving data.
  Unsupported blur and reduced-transparency preferences use opaque surfaces.

Primary hover keeps its gradient, smoothly darkening it and strengthening the rim
instead of switching abruptly to a flat background. Hover highlights apply only
to precise pointing devices; reduced-motion preferences retain immediate state
changes without decorative transitions. No extra component package is required.

## Mobile keyboard and amounts

Decimal keyboards use the device locale. Funding, transfer, order-size, limit-price
and TP/SL fields accept a single comma or point as the decimal separator, normalizing
to a point without converting through floating-point numbers. Grouped or mixed
separators are not silently stripped. Editable text defaults to at least 16px;
funding amounts retain their larger 26px text, and deliberate pinch zoom stays enabled.

`components/useSheetViewport.ts` fits the Base UI `Dialog.Viewport` positioning
container to the visible screen's height and top offset. Updates are coalesced into
one animation frame, without a React render for each viewport event. A final
correction after native focus scrolling keeps the active field (and its label/unit
when space permits) visible, even if a late scroll event
reports unchanged viewport bounds. Only the sheet body scrolls; normal manual body
scrolling is not intercepted. When the keyboard closes, field corrections stop
even if the input retains focus. Container height and pan offset follow the native
viewport directly, without a second CSS resize animation. Home-indicator padding
is consumed progressively as the keyboard covers it, rather than switching at a
height threshold. Receive, Deposit and Withdraw use a full-height form panel with
a steady top edge, like the Search page. Only its scrolling area resizes above the
keyboard. A content-height floor preserves the current scroll position as that
area grows again, preventing the browser from pushing a focused field back down.
The extra scroll space is released as the user scrolls up and resets on a tab
change or dismissal; scrolling down cannot extend it. Fractional layout heights
are rounded up to avoid a repeated scroll-clamp correction. Other sheets retain
their existing bottom alignment. Funding amount and destination-address fields
use a neutral inset focus edge that cannot be clipped outside the scroll area.
The development phone frame keeps its container-relative sizing. The operating
system owns the keyboard's keys, accessory bar and bottom spacing; the app does
not draw them. Desktop viewport simulation is not physical iPhone acceptance.

## Assets equity history

A compact line chart sits beside the equity value. Phoenix provides 15-minute
portfolio snapshots; the chart requests the latest 24 hours and shows the change
in USDC. Deposits and withdrawals affect that change, so it is not labeled profit.
Shorter histories say "Recent equity". Missing intervals remain gaps, and loading,
empty, offline and failed reads have explicit states. No fabricated curve or
animated balance is used. The Overview heading has no margin-mode badge.
Overview rows use spacing rather than horizontal dividers. Labels are 15px and
near-white; supporting descriptions remain muted. Each amount carries its unit
(USDC or SOL), and the first row is named "Wallet". The redundant footer note is
omitted. The trade ticket's TP/SL checkbox has a plain label; the time-in-force
explanation retains its dashed underline.

The trade ticket labels available collateral as "Free margin". Both that balance
and "Est. margin" carry USDC units. Estimated margin is the SDK's incremental
initial margin for the draft order, accounting for the current account and open
orders. It is separate from trading and network fees; this presentation change
does not alter the margin calculation.
