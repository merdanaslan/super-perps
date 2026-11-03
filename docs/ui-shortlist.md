# Historical UI shortlist — 26–28 October 2026

These were research candidates before the current interface was settled. The
[design system](design-system.md) records the implemented design; this shortlist
does not prescribe the older branding, colors or separate Trade navigation below.

The creator's references have now arrived; [UI direction](ui-direction.md) records
their screen map, chart behavior and floating navigation. A compact dark trading app
must read well on a phone and in a thumbnail: strong hierarchy, legible prices,
an intentional chart/order-entry composition, and a distinctive but restrained
accent palette. This document records reuse candidates; the reference brief takes
precedence over the earlier layout suggestions below.

## Recommended foundation

| Candidate                                                                      | Useful here                                                                             | License / evidence                                | Decision                                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [shadcn/ui](https://github.com/shadcn-ui/ui) + [Base UI](https://base-ui.com/) | Owned, customizable controls, sheets, tabs, dialogs, inputs and accessible interactions | shadcn is MIT; actively updated on 26 Oct 2026    | Preferred base; choose individual components after layout alignment                             |
| [Lightweight Charts](https://github.com/tradingview/lightweight-charts)        | Touch-friendly financial candles and time scales                                        | Apache-2.0; official NOTICE; updated 23 Oct 2026  | Preferred chart candidate; retain notices and confirm current attribution rules before shipping |
| [Motion](https://motion.dev/docs/react)                                        | Tab/sheet transitions and restrained feedback                                           | Use open-source core, not paid Motion+ components | Optional polish; honor reduced motion and avoid animating every tick                            |

The current [shadcn Drawer](https://ui.shadcn.com/docs/components/base/drawer)
documentation points to its Base UI variant. Do not reflexively choose the original
[Vaul](https://github.com/emilkowalski/vaul): its README explicitly says it is
unmaintained, despite being a familiar mobile drawer library.

## Full repositories and trading-specific components considered

| Repository                                                                                  | Fit / current evidence                                                                                                                          | Reuse decision                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [TBT Paper Terminal](https://github.com/TheNewMikeMusic/tbt-paper-terminal)                 | React/TS/Vite, chart/book patterns, mobile and desktop support; Apache-2.0; latest push observed 5 Jan 2026; package still uses React 18/Vite 5 | Best small reference candidate. Its paper-order engine and non-Phoenix feeds are not our integration. Assess individual components if the creator likes the design |
| [Wick](https://github.com/wick-trading/Wick) / [demo](https://wick-trading.github.io/Wick/) | MIT headless trading web components, including order book; small project, latest push observed 8 Apr 2026                                       | Interesting experiment, not yet a dependency. Verify accessibility, React integration and correctness; demo data is synthetic                                      |
| [dYdX v4 web](https://github.com/dydxprotocol/v4-web)                                       | Comprehensive trading UX, active updates; large venue-specific app                                                                              | Interaction reference only. Its license adds terms to AGPL; not a clean permissive starter foundation                                                              |
| [GMX interface](https://github.com/gmx-io/gmx-interface)                                    | Mature perps patterns; tied to GMX/EVM                                                                                                          | Reference only. Checked license is BSL with a stated 31 Aug 2026 change date and GPL successor; not an MIT component pool                                          |
| [Percolator mobile](https://github.com/dcccrypto/percolator-mobile)                         | Apache-2.0 Solana Seeker React Native/Expo app; updated 28 Sep 2026                                                                             | Mobile-flow reference, not a web/PWA foundation                                                                                                                    |

Repository metadata and the named license/package/README files were inspected.
No full security audit or device-level visual evaluation of these projects has been
performed. No code or brand assets from these repositories have been copied.

## Direction after the reference walkthrough

Use an inline ticket beside the order book, a searchable market-selection sheet,
and an expandable candlestick chart dock above the bottom navigation. The dock
remains visible while the upper ticket/positions region scrolls. Home, Markets and
Assets share a glossy navigation pill; Trade sits separately to its right.
Account/settings opens through Home. Educational information belongs on Home and
in Account, with concise reminders at financial actions.

Start the visual review with Trade in its collapsed and expanded chart states.
Exact chart height, spacing, accent and glass treatment can then be judged in a
real narrow viewport. The preference is dark surfaces with a blue interface accent
and semantic green/red trading colors. Lightweight Charts supports actual OHLC
candlesticks; its name does not mean we would use a line chart.

The recommendation is a custom composition of a small set of reusable components.
Forking a complete terminal would bring a larger rewrite and less teachable code.
The choice remains open if the creator's references reveal a better foundation.
