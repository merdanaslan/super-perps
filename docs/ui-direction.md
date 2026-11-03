# Historical UI direction — 28 October 2026

This is the earlier zupa reference checkpoint. Its branding, flat navigation and
some screen details have since changed. For current implementation guidance, use
the [design system](design-system.md) and [architecture](architecture.md).

28 October 2026. The latest creator-supplied MEXC references define the black,
charcoal, white, green/red interface. Older blue accents and floating navigation
are superseded. Germany colors belong to the two-piece bracket mark and hero.

| Screen         | Current direction                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home           | Account/search header, floating logo above a fixed wave base, direct Privy signup/login or Deposit/View assets, no balance figure, actual BTC/ETH/SOL overview, educational notice, Phoenix footer attribution |
| Search         | Dedicated full page with back, autofocus query, discovery/gainers/volume and real results                                                                                                                      |
| Markets        | Search plus All/Crypto/Stocks/Commodities/Indices/Pre-IPO categories, logos, prices and signed changes                                                                                                         |
| Trade          | Ticket left / book right; Open/Close, Long/Short, Market/Limit, base/USDC size, capacity slider, optional TP/SL fields and adjacent time-in-force information                                                  |
| Assets         | Title-only header, Phoenix-only Equity headline without a wallet address, separate wallet/free-margin overview, receive/deposit/withdraw flows, no Latest transaction button                                   |
| Account        | Wallet selection or welcome; appearance/currency/margin/network shown directly; About contains the repository placeholder and attribution                                                                      |
| Authentication | One click opens the real Privy dialog; no custom intermediate signup/login page                                                                                                                                |
| Desktop        | Production mobile-only handoff; hosted HTTPS QR; localhost explanation                                                                                                                                         |

Bottom navigation: **Home / Markets / Trade / Assets**. Search and Account have
clear back/close actions and preserve the originating tab/market. Account settings
are fixed MVP values, not pretend editable controls.

Cross margin is the only execution mode. Isolated-only markets are clearly marked
and viewable. The venue sets margin tiers; “Up to …×” explains the ceiling rather
than inventing a leverage setting. Sizing uses real account capacity. Unavailable
balances and estimates remain dashes. A stale or missing account cannot submit.

The ticket's signed-in action prepares a transaction review. It simulates before
wallet confirmation, then tracks the actual signature. Market actions require a
full fill within the price bound or cancel; TP/SL is native and liquidity dependent.
Time in force displays GTC for limit orders and FOK for the existing full-fill
market-order behavior; tapping it explains that policy. It is informational,
not an unimplemented order-policy selector. The redundant price-protection line
below the submit button is removed. The 0.5% market-price bound remains active;
the exact price limit stays in the order review and the explanation is available
in the time-in-force sheet.
The educational notice remains on Home and Account without a preview-only banner.

Charts remain above the bottom bar while the ticket/positions scroll independently.
Phoenix supplies OHLC data; retain the visible TradingView attribution. Asset logos
are remote images from venue metadata, never injected SVG markup. The hero's entrance
and subtle 6.5-second float respect reduced-motion preferences; market values do not animate.

No fake bonuses, VIP rewards, social buttons, spot products or invented sentiment.
See [design QA](history/ui-review-2026-10-28.md) and [verification](verification.md) for observed
states and the distinction between browser checks and funded acceptance.
