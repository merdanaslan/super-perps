# Phoenix Mobile Perps: agreed product scope

Approved in the project conversation on 26 October 2026. The supplied
`Phoenix_PWA_PRD_Updated.md` is the product source; these notes record the agreed
scope and subsequent additions without treating its technical suggestions as proven.

## Outcome

A working, polished mobile-only trading PWA and understandable MIT-licensed
starter for Superteam Germany's Road to the Solana Perps & Prediction Markets
Hackathon series. Phoenix **perpetuals** is the venue. Following the creator's
latest visual polish on 31 October, navigation is a floating glass
Home / Markets / Trade / Assets pill with an animated selection and compact scroll state. Account opens from Home; its settings are
displayed directly and About contains the configurable repository link. This supersedes the PRD's original
Markets/Trade/Portfolio/Account navigation. Desktop gets a mobile-only
QR handoff, not a desktop terminal. Public browsing precedes login.

Core journeys: market selection and real market data; recoverable Solana wallet
access; Phoenix onboarding and collateral; explicit long/short order review,
signing, confirmation and reconciliation; actual positions and essential management.
Every unavailable or unverified capability must be identified as such.

Market and limit orders, cancellation, and reduce-only closing are in scope.
USDC order entry converts position value to whole base lots, rounded down at the
entered limit price or current market quote. The ticket shows the resulting
quantity, order value and any rounding. For example, with a 0.0001 BTC lot at
78,400 USD, a 10 USDC input sizes 0.0001 BTC worth 7.84 USDC; the next lot would
exceed the input. This is position value, not margin or fees. Market execution
prices can move within the reviewed slippage bound.
Attached native TP/SL and the percentage-capacity slider were added by the creator
on 27 October. Home search is a dedicated page; signup/login opens Privy directly.
The Trade screen pairs an inline ticket with an order book and a collapsible
candlestick chart. The creator simplified the MVP to **one margin mode** on
26 October. The implementation uses **cross only**, the default onboarding account
(PDA 0 / subaccount 0). Phoenix creates it during onboarding; isolated positions
require additional child subaccounts and separate collateral management. This
keeps the MVP on one collateral account. Cross shares collateral across positions,
so losses in one position can affect the others. See the official
[account model](https://docs.phoenix.trade/sdk/accounts).
There is no cross/isolated toggle. Isolated accounts are out of scope. Leverage
controls must reflect verified account behavior; the ticket displays a market
ceiling without pretending to adjust leverage.
On 28 October, the creator requested position visibility on the chart. The MVP
adds a read-only average-entry line and unrealized P&L for the current market and
selected wallet, using fresh Phoenix account/margin data. P&L excludes fees and
funding and updates with account refreshes. It is not computed from trade-price
candles. Historical fill markers, draggable orders/TP/SL and a full chart trading
workspace remain out of scope.
See [the reference-based UI direction](ui-direction.md) for the screen map and
the proposed implementation sequence.

## Additions from the creator

- Direct wallet SOL and USDC transfers, added 1 November. USDC withdrawals explicitly
  select wallet funds or Phoenix collateral; SOL stays outside Phoenix collateral
  in this MVP. Each transfer receives its own simulated review and approval.
- Educational-purpose and financial-risk notices prominently in README and app
  entry/home, with full information available from Account. Reiterate relevant
  risks and the real execution environment before enabled financial actions.
- MIT warranty/liability disclaimer; educational intent is not an extra license
  restriction. Do not claim that wording guarantees protection from all liability.
- Treat visual appeal as a product requirement: the result should work in a README
  screenshot and video thumbnail as well as on an actual phone.
- The creator plans a publicly hosted demo. Prepare for it, but obtain authorization
  before publishing. No repository push, deployment, paid service, credential use,
  deposit, or live trade is authorized by this planning approval alone.

## Order and checkpoints

1. Independently research official APIs, wallets, costs, environments and reusable UIs.
2. Build and verify a minimal integration foundation before polished UI work.
3. Agree on visual direction with the creator using their references and our shortlist.
4. Implement complete mobile journeys and the desktop introduction.
5. Verify available browsers/devices, PWA lifecycle, reconnects and fresh-clone setup.
6. Complete documentation, licensing and concise video/code walkthrough notes.

The creator approved normal technical decisions and has now supplied detailed UI
references, accepted the candlestick library and reported email login success.
The UI and mainnet transaction implementation are present. Local tests and unsigned
probes pass; later maintainer-reported funded testing is summarized in
[release readiness](release-checklist.md). The creator explicitly requested
trading to be enabled on 27 October. That authorizes implementing signing/submission
flows; a consequential financial action still belongs to the user.
Do not request private keys or seed phrases. Do not invent a Phoenix devnet, reuse
another project's credentials, or substitute another venue.

## Architecture direction

On 29 October the creator specified one primary Privy app wallet, automatically
created/restored at login and reload. Manual wallet selection is removed. Account
shows its address, Copy and Explorer. Other connected wallets must not silently
become the trading authority.

**Latest funding decision, 29 October:** keep Receive / Deposit / Withdraw and
have users send USDC plus SOL to the same Privy app-wallet address on Solana. USDC
is the app's trading collateral; SOL remains in the wallet for network fees and
account rent. This replaces the earlier direction to proceed with Pimlico.
Kora/Pimlico integration, automatic USDC-to-SOL swaps and automatic deposits are
deferred beyond the MVP. The app does not pay users' network fees.

**One-click trading is excluded from the first MVP**, confirmed by the creator on
29 October. It remains a separate, unimplemented opt-in capability. A future
Phoenix trading authority may be managed by Privy while keeping withdrawals
owner-controlled. See the retained [funding and signing research](funding-abstraction.md).

Home keeps the animated hero and account actions without a balance figure. Assets
shows Phoenix equity alone as its headline **Equity**; wallet USDC stays in the
Overview. Equity includes the account's collateral and unrealized PnL; **Free margin**
separately shows capacity for new positions. The completed Latest transaction
button is removed from Assets; pending transaction recovery remains available.
Assets also shows a compact 24-hour equity history from Phoenix's 15-minute
portfolio snapshots. Its change includes deposits and withdrawals, and is not a
trading-return calculation. Shorter, missing and unavailable histories are labeled.

Use a small React/TypeScript web application, a Phoenix-specific integration module,
an explicit wallet boundary, and separate data/transaction state. Prefer current
official SDK primitives over duplicating exchange math and order-book delta handling.
Avoid a backend, database or multi-exchange framework unless a verified need emerges.

Later episodes, advanced order types, native apps, and final video production are
out of scope. A working transaction means confirmed execution and reconciled account
state; an unsigned instruction, simulation or returned signature is narrower evidence.
