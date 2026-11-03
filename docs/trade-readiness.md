# Trade readiness — current summary 30 October 2026

The core MVP is implemented. The maintainer reported successful setup/deposit,
limit placement/cancellation, market opening/closing, attached TP/SL creation and
withdrawal. The [release summary](release-checklist.md) separates those reports
from independent checks and outstanding cases. Dated follow-ups below preserve
the evidence at each checkpoint rather than retroactively claiming more proof.

## Fields and behavior

| Area                 | Current MVP                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Market and direction | Market selector, Long/Short, Open/Close; cross-compatible markets only                                                          |
| Order type           | Market with full-fill requirement and 0.5% bound; Limit at the specified price or better                                        |
| Price and size       | Limit price; quantity in base units or USDC notional; percentage of available capacity; total notional                          |
| Capacity             | Available margin, SDK estimated margin, maximum size; lot/tick validation before review                                         |
| Exits                | Optional attached take-profit/stop-loss; opposite-side native exits; reduce-only closing                                        |
| Time in force        | GTC for Limit; FOK for Market; explanations beside TP/SL                                                                        |
| Review               | Direction, size, price/bound, fees including configured Flight fee, margin, exits, network fee/rent and explicit Confirm & sign |
| Account management   | Positions, open orders and TP/SL; close position and cancel actions                                                             |
| Position readout     | Size, average entry, mark, estimated liquidation, price P&L and separate unsettled funding                                      |
| Chart                | Phoenix candles/timeframes; average entry/P&L, resting limits and TP/SL trigger lines                                           |

Trade's setup action now uses the shared funding/onboarding view, including the
operator referral configuration when enabled. It no longer bypasses that flow.

Cross is fixed to account 0/subaccount 0. “Up to N×” is the venue's market ceiling,
not an adjustable leverage setting. Effective exposure depends on position size
and shared collateral. Other cross positions can affect account risk.

Deliberate omissions: isolated accounts, an adjustable leverage target, a pre-trade
liquidation-price forecast, a historical funding panel, selectable IOC/post-only modes,
order amendments, historical fill markers and draggable chart orders. These are
not needed to exercise the implemented core order lifecycle, but the app is not a
full exchange terminal. Native TP/SL is not guaranteed protection: TP is a limit
exit and SL is a bounded IOC exit, either of which may remain unfilled.

The entry line represents the **average of the current net position**, not the
time of an individual fill. Unrealized P&L comes from Phoenix's per-market SDK
margin calculation, using mark prices. It updates with account polling (normally
every eight seconds while visible), not every candle/trade tick, and disappears
when account data is stale, mismatched, closed or belongs to a different wallet.
Candles are exchange trade prices, so their latest close can differ from the mark.

## Original preflight checks — 29 October

- 161 automated tests pass; TypeScript, formatting and configured build pass.
- Five public API/stream/unsigned checks pass. The separate trading probe validates
  current public metadata and unsigned instructions, including native exits and
  synthetic Flight routing. Expected unfunded simulations refuse before signing.
- Anonymous ticket behavior and production startup/chart rendering checked at
  phone size. Position chart transitions checked with explicitly synthetic data.
- Simulation, exact-message signing, review expiry, wallet-switch rejection,
  pending-receipt persistence and ambiguous submission handling have local tests.

See [the verification record](verification.md) for dates, captures and limitations.
No funded activation, fill, fee collection or withdrawal is proven by these checks.
The [29 October preflight](preflight-2026-10-29.md) records the latest checks,
the transient API rate limit, remaining release findings and one-click sequencing.

## Repeatable acceptance sequence

The human user performs each final **Confirm & sign** in the app review. Use a dedicated test trading
wallet with a deliberately limited amount; the operator's builder collector is a
separate role. Do not fund diagnostic probe addresses.

1. Verify login, automatic app-wallet continuity and rejection/reconnect on the actual
   phone/browser that will be used. Confirm the intended Solana wallet/network.
2. Receive SOL for fees/rent and USDC; check the displayed wallet balances.
3. Review and activate the Phoenix account; verify account eligibility and state.
4. Deposit USDC; verify wallet balance change and Phoenix collateral separately.
5. Place a small limit order, confirm it rests, cancel it and verify its removal.
6. Exercise a small market opening, reconcile actual filled size/average entry,
   and compare the position list, chart and Phoenix account state.
7. Verify native TP/SL creation, trigger/fill semantics and cancellation. Check
   the remaining sibling exit after a trigger; do not assume a guaranteed fill.
8. Reduce-only close, verify the position and chart line disappear, then withdraw
   the permitted remaining collateral and verify the wallet receives it.
9. Verify the configured builder fee against taking-fill details and collector
   balance changes, including a separate resting-maker case. Referrals are deferred.
10. Check wallet rejection and connection interruption without duplicate submission;
    reload recovery must reconcile the original signature before allowing another action.

Keep confirmed signatures **and resulting balances/positions/orders** for each step.
Do not treat transaction confirmation alone as evidence of an order fill.
Trading without per-action app reviews and delegated trading sessions are not
implemented. Prove this baseline with explicit confirmations first; if one-click
is added, test its authorization/revocation lifecycle and repeat
the trading acceptance before broader release.

Before public release: review the [dependency/distribution findings](release-findings.md),
complete remaining physical iPhone/Android signing/recovery and hosted-origin
checks, and verify the implemented PWA install/update lifecycle on those devices.

## Order display and confirmation follow-up — 29 October

The user approved the 0.001 ETH buy limit at 2,300 USD. The browser at that check
showed one resting order, no position, and about 1.91 USDC free margin. That proved
order visibility, not a fill. The subsequent cancellation is recorded below.

- Open orders use a compact market header, direction/cross tags, order price,
  remaining quantity, partial-fill quantity when applicable, and Cancel.
  Quantities/prices are derived from exact Phoenix lots/ticks. No creation time
  or chosen leverage is invented when the snapshot does not supply it.
- Fresh open orders for the selected market appear as dotted chart price lines.
  Position entries remain separate dashed lines with unrealized P&L. Both are
  included in autoscaling; time zoom is preserved. Lines are removed on cancelled,
  filled, stale, other-wallet or other-market data. This uses the chart library's
  [price-line API](https://tradingview.github.io/lightweight-charts/tutorials/how_to/price-line).
- A just-confirmed transaction dismisses after three visible seconds, once the
  account snapshot has caught up. Pending/failed/expired receipts remain open.
  Explicitly reopened receipts remain available; the journal is not deleted.
  First-deposit setup still advances to deposit review instead of dismissing.
- Privy's disabled loading button keeps its accessible label but centers the
  spinner independently of that label. The CSS is scoped to the spinner/label
  structure in Privy 3.51.0 and does not alter approval behavior.

218 tests, TypeScript, formatting and production build pass. The existing build
warnings remain. Actual order card/chart rendering was inspected in the funded
browser. A separate localhost rehearsal verified automatic dismissal and the
spinner's horizontal offset changing from about 36 pixels to zero, without a
real wallet or broadcast. The next human-approved transaction should confirm
the brief spinner state in Privy's live flow. No new transaction was signed or
submitted during these UI changes.

## Cancellation and chart coverage follow-up — 29 October

The user reported successfully canceling the resting ETH limit. The actual app
then showed Orders (0), no open orders, no resting-limit chart line, no position,
and 2.00 USDC available collateral. This is user-reported transaction success plus
fresh browser/account-state verification; the cancellation signature has not been
independently recorded here. The assistant submitted no funded transaction.

- The open-order card now omits the visible sequence number, market arrow, mark
  price and Open/GTC footer. A single centered button reads Cancel. The exact order
  identity and price ticks remain attached to the cancellation action.
- Buy and sell limits have chart lines. Filled long and short positions show their
  current average entry and unrealized P&L regardless of whether the opening was
  a market or limit order; this is not a historical marker for each fill.
- Active TP and SL legs now add explicitly labeled trigger lines. They use the
  service's decoded active conditional-order prices, not an assumed fill price.
  Lines are removed when the corresponding leg disappears from the next fresh
  snapshot, or when the wallet/market changes or account data becomes stale.
- All 230 tests, TypeScript, formatting and production build pass. Existing build
  warnings remain. Production card/chart components were visually checked with
  labeled sample data for long, short, cancellation and clearing overlays. These
  samples do not prove a funded TP/SL trigger or fill.

The next funded acceptance step is a small market opening and reconciliation of
the filled size, entry and P&L, followed by native TP/SL and reduce-only closing.

## Market round trip and single confirmation — 29 October

The user reported opening a small market position and then successfully closing
it. Their screenshot showed a 0.001 ETH long with a 2,339.40 USD entry. The actual
app was subsequently checked and showed Positions (0), Orders (0) and no open
positions. This is user-reported execution plus fresh browser/account-state
verification. Opening and closing signatures have not been independently recorded
here; no funded transaction was submitted by the assistant during this update.

- The app's **Confirm & sign** is the final transaction approval. The installed
  Privy 3.51.0 bridge now uses the documented per-call `showWalletUIs: false`
  option to avoid a second approval popup and signed-receipt screen. Signing
  progress begins immediately; submission, confirmation and account refresh
  follow. The DOM receipt-dismissal adapter was removed.
- Opening a review does not sign. Exact-message verification, selected-wallet
  checks, review expiry, origin-wide locking and pending-receipt recovery remain
  in place. Message-authentication prompts stay enabled. This is not a delegated
  signer or authorization to trade automatically.
- Privy's USD fee label is separate from Phoenix and builder fees. The screenshot
  shows US$0.00 while the app review shows 0.000005307 SOL, consistent with a
  sub-cent network fee being rounded. The app retains the exact SOL estimate and
  separate exchange/builder fee details.
- Positions, limit orders and native TP/SL groups share the same market header,
  tags, detail rows and centered action. TP/SL groups appear in Orders. Cancel on
  a paired TP/SL card cancels that group; exact order/group identifiers remain
  attached to the action despite being omitted from visible card text.
- All 237 tests and the production build pass. Tests cover no signing on review,
  the per-call Privy option, wallet identity changes, the immediate signing state,
  exact limit/conditional cancellation identities and reduce-only long/short
  closure. Formatting and whitespace checks pass. Browser card previews use
  explicitly labeled sample data. A separate localhost fake-wallet rehearsal
  verified immediate signing progress, setup advancing to deposit review, deposit
  confirmation updating synthetic balances and automatic dismissal. It made no
  RPC submission and did not exercise Privy's authenticated signer.

The revised single-confirmation path still needs its next funded acceptance
check. Native TP/SL creation/cancellation/trigger behavior, withdrawal and builder
fee reconciliation remain to be proven with funded transactions. Physical-device,
hosted-origin and distribution checks also remain before release.

## Market TP/SL simulation fix — 29 October

The user attempted a 0.001 ETH market long with a 2,400 USD take profit and 2,300
USD stop loss. After funding SOL, the app showed only `assert_with_side_effect
failed`. An unsigned reproduction against the actual account returned
`InvalidInstructionData` and the following omitted reason: **Order type must be
Limit or PostOnly**. The integration had passed an IOC packet to
`PlaceLimitOrderWithConditionals`. This was an app instruction-selection bug, not
another SOL shortfall. The balance check ruled out insufficient SOL; personal
account balances are omitted from this public report.

Market orders now create the conditional account if absent, place the bounded
full-fill market order, then use `PlacePositionConditionalOrder` with the exact
requested base-lot size, all in the same transaction. Either step failing rejects
the complete transaction; no fallback silently opens without the requested exits.
The limit-order path and Flight fee routing remain in place. Trigger size is not
set to 100% of any pre-existing position. This follows the separate market and
position-conditional builders documented in [Phoenix Orders](https://docs.phoenix.trade/sdk/orders).

The same long/TP/SL request passed both unsigned simulations, including the final
compute-budget transaction. The review estimated 5,399 lamports network fee and
19,344,640 lamports of account funding. These are estimates for this first TP/SL
setup, not recurring fees promised for every order. See the
[before/after evidence](evidence/tpsl-simulation-2026-10-29.json).

The error formatter now retains the explanation immediately following Phoenix's
assertion plus the runtime error code. This specific unsupported-order failure
is explained as an app compatibility issue, rather than suggesting more funding.
All 245 tests, TypeScript, formatting and the production build pass. Regression
tests cover long/short market exits, one-leg exits, existing conditional accounts,
unchanged limit routing, atomic simulation failure and useful error messages.
This is simulation evidence only; funded TP/SL creation/trigger/cancellation still
requires user acceptance.

After reloading the browser to replace a retained development service instance,
the actual app reached the review screen for the same 0.001 ETH / 2,400 TP / 2,300
SL request, showing 0.01934464 SOL account rent and a 0.000005382 SOL fee estimate.
The assistant stopped at review. No signing or submission occurred in this check.

## Position risk, funding and independent exits — 29 October

The user subsequently reported successful market opening with TP/SL. Read-only
account observations were consistent with the user's report that cancelling the
old paired card removed both exits. Personal position values are omitted from
this public report. These historical observations do not prove that a TP or SL
has triggered a funded exit.

Position cards now use `computeSubaccountLiquidationPricesFromMargin` from Rise
0.6.2, with the same complete cross-account margin, normalized market parameters
and inputs used for account health. The UI labels the result as an estimate,
explains the fixed-other-prices/no-future-fills
assumption, and withholds stale, mismatched or nonpositive levels. Unsettled
funding comes from each market margin's signed `unsettledFundingQuoteLots`, where
positive increases collateral. It is not lifetime funding paid.

Funding appears beside the order-book title in place of the decorative filter.
The current funding field is an hourly **percentage**, confirmed against the
public market-stats and funding-history responses (0.00120135581585 current,
0.00961084652679 eight-hour, 10.5238769468 annualized, and 0.001200 latest hourly
history in the initial sample). The market-stats timestamp, not a later price-only
update, controls the 30-second freshness bound. See [Phoenix funding](https://docs.phoenix.trade/phoenix/margin-and-risk/funding-rate)
and [SDK margin](https://docs.phoenix.trade/sdk/margin).

TP and SL now appear and count separately in Orders. Review validates the active
leg plus group index/sequence/symbol, and maps it to `disableFirst` (greater
trigger) or `disableSecond` (less trigger). It never defaults to both. The mainnet
probe simulated placement of two exits for the existing long, then simulated
cancelling each independently. TP cancellation returned greater=false/less=true;
SL cancellation returned greater=true/less=false. The actual chain still had no
conditionals afterwards. **Nothing was signed or submitted.** See
[unsigned evidence](evidence/risk-exits-read-only-2026-10-29.json).

The fresh-success delay is now one second after account catch-up. A callback tied
to the exact submitted signature resets the original order ticket after confirmed
success; pending, failed, expired, abandoned and historical receipts cannot reset
it. Refreshing an expired review preserves the callback, while editing a new
draft prevents the old callback from clearing those values.

All 262 tests and the production build passed. Tests cover long/short per-leg
cancellation, inactive/replaced legs, funding units/freshness, position data,
confirmation-driven form reset, newer drafts and review expiry. Browser checks
verified the actual position/rate and help sheets, and an isolated sample UI
verified separate TP and SL cards and removal of only the clicked card. Funded
independent cancellation and automatic TP/SL execution remain acceptance tests.
