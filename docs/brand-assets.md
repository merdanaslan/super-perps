# Brand assets

Updated **1 November 2026** for **super perps**. The creator chose emerald green
and mint highlights in place of the former German flag palette. The original
two-bracket geometry and fine pixel waves remain. The name is a nod to the
Superteam community, not a claim of official affiliation.

The original artwork was made with the built-in Image Gen tool on 27–28 October;
the current assets are Image Gen edits of those originals. No CEX illustrations
or screenshot pixels are shipped. See the [exact edit prompts](brand-prompts.md).

| Asset               | File                                   | Use                                                                     |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Mark                | `public/brand/super-mark.png`          | Header, account, Privy logo, startup and favicon; 512px transparent PNG |
| Fixed hero base     | `public/brand/super-hero-base.png`     | Green pixel-wave background; 1152×768 PNG on black                      |
| Floating hero logo  | `public/brand/super-hero-logo.png`     | Emerald bracket foreground; 1152×768 transparent PNG                    |
| Installed app icons | `public/icons/super-*.png`             | Opaque 180/192/512px exports; maskable icon adds a safe black border    |
| Phoenix mark        | `public/brand/phoenix-mark-orange.svg` | Unmodified official Phoenix attribution and venue badge                 |

Home and the desktop handoff reuse the same two hero layers. Only Home animates
the foreground; the wave floor stays fixed, with soft fading at its sides.
Reduced-motion settings disable decoration. The foreground is scaled within the
shared canvas so the brackets float above the wave floor.

The old branded assets have been removed from the public bundle. Icon filenames
changed so a fresh installation uses the green artwork. An existing iOS Home
Screen installation may keep its previous name/icon until removed and added again;
its wallet and pending receipts must be handled before clearing any site data.

The transaction journal and cross-tab lock deliberately retain their old internal
names. This preserves recovery and coordination with an already-open older tab.
No wallet or account migration is needed for the name change.

The PNG mark has subtle texture at full resolution and is intended for app/web
use. An independently refined vector master would be useful for print or large
brand applications. Artwork is not evidence of affiliation or endorsement.

The Phoenix mark was obtained unchanged on 28 October 2026 from
[Phoenix's official artwork](https://www.phoenix.trade/img/phoenix-mark-orange-sm.svg).
It remains Phoenix's third-party mark, not generated art or an MIT relicensing.

## Market logos — 1 November

`AssetIcon` uses round identities in Home, Trade, market lists and account cards.
The local copies below make the most visible crypto symbols reliable
without waiting on third-party image requests. All other assets use HTTPS
`metadata.logoUri` from Phoenix's public exchange snapshot, with a neutral
fallback on failure. Images are rendered as images, never injected SVG markup.

| File                     | Original source                                                                                                        | Treatment                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `public/markets/btc.svg` | [cryptocurrency-icons color BTC](https://github.com/spothq/cryptocurrency-icons/blob/master/svg/color/btc.svg)         | Unmodified orange circle / white mark                                   |
| `public/markets/eth.svg` | [cryptocurrency-icons white ETH](https://github.com/spothq/cryptocurrency-icons/blob/master/svg/white/eth.svg)         | Unmodified white circle, dark faceted mark on the app's dark background |
| `public/markets/sol.svg` | [Phoenix SOL](https://phoenixcdn.trade/logos/SOL/b82944495839f0a92b535eaa8923ea68283b875e8c444840b9eff4fac8819c01.svg) | Unmodified art on a dark circle                                         |

BTC/ETH come from the spothq cryptocurrency-icons project under its
[CC0 1.0 dedication](https://github.com/spothq/cryptocurrency-icons/blob/master/LICENSE.md);
the full text is retained in [public/markets/CC0-1.0.txt](../public/markets/CC0-1.0.txt).
Third-party brand assets retain their owners' rights and are not relicensed as MIT.
QQQ, SPY and TLT use the original ticker placeholders supplied by Phoenix's
exchange metadata. Issuer/company icons were removed because they did not
clearly identify the individual funds. These placeholders are market labels,
not official fund logos. The app trades Phoenix perpetuals, not ETF shares.
No trademark rights or endorsements are implied.

The small badge is the same unmodified official Phoenix mark used in the Home
footer. FOMO screenshots informed layout and motion direction only; their
pixels, branding, balances and promotion content are not shipped in the app.

## Navigation icons — 31 October

Home and the other navigation icons use Lucide in every state. Selection changes
the stroke weight and the capsule behind the icon, preserving the same shape.
