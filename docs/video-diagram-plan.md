# super perps: video and Excalidraw plan

Reviewed **1 November 2026** against the current working tree, the installed
`@ellipsis-labs/rise` **0.6.2** source, and Phoenix's official documentation.
This is an analysis and production brief; no diagram artwork has been created.
The checkout has no initial commit, so source line references below identify this
review snapshot and may move.

## Recommendation

Create **six core diagrams in one editable Excalidraw board**. Give each diagram
its own numbered, independently exportable panel. Use the board to tell one story:

**What we built → how users fund it → where data comes from → how an order becomes
a transaction → how exits work → how an integration can use builder codes.**

Assume a **12–15 minute developer walkthrough** for someone who knows basic React
and wallets but has not integrated Phoenix. This is a suggested edit length, not
a requirement supplied by the creator.

| Format                                | Diagram count            | Best use                                        | Tradeoff                                          |
| ------------------------------------- | ------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| Short product/build overview          | 4: panels 1, 2, 4 and 6  | Approximately 6–8 minutes                       | Explain data and exits briefly over the app       |
| **Recommended technical walkthrough** | **6**                    | **Approximately 12–15 minutes**                 | Enough depth to explain the actual implementation |
| Extended engineering lesson           | 6 plus 2 optional panels | Approximately 20 minutes or a follow-up episode | More room for recovery and protocol details       |

The earlier five-panel proposal is a useful starting point. Builder routing and
native exits now merit dedicated panels. Transaction recovery becomes a zoom-in
inside the execution panel, keeping the main set to six.

## What the review changes about the story

- The current product is **super perps**, with emerald artwork. Use the current
  [design system](design-system.md), not the earlier zupa red/gold direction.
- This is a static React application with a substantial transaction layer.
  Rise runs inside the client. There is no custom application backend or custom
  on-chain program in this repository. Phoenix, Privy and RPC remain external
  dependencies. See [architecture](architecture.md).
- Privy restores the primary embedded Solana wallet. Login, Phoenix account
  activation, funding and financial approval are separate events. The app still
  requires **Confirm & sign** for each financial transaction.
- Public prices/order books use streams; account state is polled, normally every
  eight seconds while visible. Candles refresh every fifteen seconds. Portfolio
  history uses fifteen-minute samples and a five-minute refresh. Do not draw
  trader WebSocket subscriptions that this app does not use.
- Ordinary financial actions broadcast through RPC. Account setup instead goes
  through Phoenix's API for its onboarding co-signature and submission. A diagram
  that routes every action straight from the app to RPC would omit this exception.
- The app uses USDC collateral and cross account 0/subaccount 0. SOL pays network
  fees and account rent in this MVP. Newer protocol features, separate trading
  delegates and gas sponsorship are not part of this implementation.
- Builder routing can be disabled, enabled with an explicit zero fee, or enabled
  with a supported paid configuration. The current educational zero-fee behavior
  is worth explaining separately from the general monetization mechanism.

Phoenix recommends stream-backed trader state and shared clients for fuller live
integrations. Present that as a possible extension, while accurately drawing our
snapshot-based account reads and fresh preparation checks.
[Phoenix WS/API guidance](https://docs.phoenix.trade/sdk/ws-api-best-practices).

This pass inspected source, existing evidence and documentation. It did not rerun
the test suite, sign transactions or independently repeat funded acceptance.
The [current release checklist](release-checklist.md) is the source for readiness:
it records maintainer-reported core flows and remaining native-exit, device,
recovery, fee-reconciliation and dependency checks.

## Panel 1 — The app at a glance

**Viewer's question:** What does our app build, and what do Phoenix, Privy and
Solana provide?

**Narration:** “super perps is the mobile interface and transaction coordinator.
Phoenix provides the venue, Privy connects the user's signer, and Solana executes
the transactions.”

Draw one large **Mobile PWA** container on the left, containing small labels for
screens, market data and trading logic. Put **Rise SDK** inside that container.
Place **Privy / app wallet** above it, **Phoenix API + streams** at upper right,
and **Solana RPC → on-chain programs** at lower right. The on-chain container can
contain Phoenix and a small optional Flight label.

Use separate labeled arrows for:

1. Public snapshots/streams into the app.
2. A signature request to the app wallet after approval.
3. Simulation, ordinary submission and status checks through RPC.
4. Account activation through Phoenix's co-sign/send API.

Keep this to approximately six main visual groups. Open with the actual Home and
Trade screens for 20–30 seconds, then zoom out to this map. No code excerpt is
needed on the opening diagram. A small caption can explain that a perps position
is exposure recorded in a trading account; buying an ETH perp does not deposit
spot ETH into the app wallet.

**Code anchors:** [App.tsx](../src/app/App.tsx),
[client.ts](../src/phoenix/client.ts) lines 6–15,
[service.ts](../src/trading/service.ts) lines 126–146 and 827–879.
The [Rise overview](https://docs.phoenix.trade/sdk/rise) describes the SDK surfaces;
[trader onboarding](https://docs.phoenix.trade/sdk/register) explains the API
co-signature path. Phoenix's matching-engine internals can remain behind a single
venue box in this app-focused video.

## Panel 2 — From login to usable collateral

**Viewer's question:** Why do I need both a wallet balance and a Phoenix balance?

**Narration:** “Login restores the wallet. Setup creates the Phoenix account.
Deposit moves USDC into the shared collateral account used for trading.”

Use two large containers: **Your app wallet** and **Your Phoenix cross account**.
Above the wallet, show email login and primary-wallet restoration. Inside the
wallet, show separate **USDC** and **SOL** balances. Inside Phoenix, show **USDC
collateral**, then small positions/orders labels sharing that collateral.

The main money arrows are **Receive → wallet USDC → deposit → Phoenix collateral**
and **withdraw → wallet USDC**. SOL has its own branch labeled **network fees +
account rent**. Put the two first-deposit approvals above the route:
**1. Set up account** and **2. Deposit USDC**. They are separate transactions and
reviews, even though the entered amount carries forward.

For an already activated account, skip the setup transaction. Give external
withdrawal a small optional branch: the app appends an exact USDC
transfer to the selected Solana wallet after withdrawal, inside the same
transaction. The ordinary SDK withdrawal returns funds to the authority wallet;
the external-recipient behavior is our composition in `withdrawal.ts`.

Keep Ember conversion in a small “inside the SDK helper” inset if needed. Phoenix's
USDC helpers include canonical-token conversion and account instructions; this is
not an app swap or gas sponsorship feature.
[Phoenix collateral helpers](https://docs.phoenix.trade/sdk/collateral).

**Code anchors:** [app-wallet.ts](../src/wallet/app-wallet.ts),
[service.ts](../src/trading/service.ts) lines 394–550,
[deposit-journey.ts](../src/trading/deposit-journey.ts),
[withdrawal.ts](../src/trading/withdrawal.ts) lines 26–85.
The [account model](https://docs.phoenix.trade/sdk/accounts) confirms the role of
subaccount 0. Show `buildDepositIxs`/`buildWithdrawIxs` only if the audience needs
a concrete SDK entry point; the funds diagram should remain the focus.

## Panel 3 — Three kinds of data on one screen

**Viewer's question:** Where do prices, candles, balances and P&L come from?

Use three horizontal lanes that end at the UI they power:

| Lane               | Actual implementation                                       | Visible result                                                |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Public market data | Metadata bootstrap, `marketData()` and `streams.l2Book()`   | Market rows, current stats and book                           |
| Historical data    | REST candles; separate portfolio-value history              | Candlestick chart and equity-history chart                    |
| Account and risk   | REST trader snapshots + RPC account reads + SDK margin math | Positions, orders, free margin, P&L and liquidation estimates |

Mark the account lane **8s while visible**, candles **15s**, and portfolio history
**5min refresh / 15min samples** as secondary annotations. A shared freshness
check sits before values become actionable. Missing or stale account data must
not look like a current zero balance.

Make three distinctions legible through callouts, revealed one at a time:

- Candle prices are traded prices; position P&L uses mark-based account math.
- Wallet USDC, equity, free margin and withdrawable collateral are different values.
- Portfolio history includes cash flows. It is not a pure trading-return chart
  and is not used to construct orders.

The SDK computes risk from the account and market inputs; the percentage slider
is capacity sizing, not an adjustable leverage setting. Use this as a brief
explanation over the ticket rather than another full diagram.

**Code anchors:** [market-data.tsx](../src/app/market-data.tsx) lines 29–64, 86–129
and 135–172; [service.ts](../src/trading/service.ts) lines 168–307;
[context.tsx](../src/trading/context.tsx) lines 108–154;
[useEquityHistory.ts](../src/app/useEquityHistory.ts) lines 18–63.
Use [exchange-data documentation](https://docs.phoenix.trade/sdk/markets) for the
SDK vocabulary and [margin documentation](https://docs.phoenix.trade/sdk/margin)
for the account/price join. Neither source is evidence that this app uses every
stream or collateral feature shown in their examples.

## Panel 4 — From a tap to a verified result

**Viewer's question:** What happens after I finish the order ticket?

This is the central technical diagram. Use a vertical flow grouped into three
bands, with the approval step drawn prominently:

| Prepare                                         | Approve and submit                              | Verify                                       |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| Read fresh account, market and book             | **Confirm & sign**                              | Check original signature                     |
| Validate lots/ticks, capacity and bounds        | Lock + recheck wallet/review; request signature | Wait for current account snapshot            |
| Build instructions; optionally wrap with Flight | Verify exact signed message and lifetime        | Show the actual order/position result        |
| Simulate; estimate fees/rent; display review    | **Persist pending receipt → broadcast**         | Clear/reset UI only for the matching success |

Present these as staged zooms, not twelve equally small boxes visible throughout.
The order's Flight wrapper belongs before simulation and signature, not after
the user has approved a different message.

Add one compact side loop: **response missing → keep original receipt → check
same signature**. A timeout does not prove failure. Pending recovery blocks a new
financial action in this app. The lock/journal are scoped to the browser origin;
do not promise cross-device coordination or universal exactly-once execution.

Show the difference between a confirmed transaction and its outcome: a limit can
be confirmed and resting without a filled position. The app waits for account
state to catch up, but the narration should inspect the actual order/position
instead of treating a green transaction receipt as a fill.

**Code anchors:** [service.ts](../src/trading/service.ts) lines 364–389, 613–825
and 827–879; [chain.ts](../src/trading/chain.ts) lines 106–216 and 218–310;
[execute.ts](../src/trading/execute.ts) lines 20–57;
[context.tsx](../src/trading/context.tsx) lines 174–234 and 348–407.
The [order SDK docs](https://docs.phoenix.trade/sdk/orders) explicitly separate
instruction building from transaction submission.

## Panel 5 — Market, limit and native exits

**Viewer's question:** What gets created on Phoenix, and what does TP/SL actually do?

Use two paths across the top, followed by a shared trigger explanation below:

- **Market opening + exits:** one transaction envelope contains conditional-account
  creation if needed, the bounded market order, and position conditionals sized
  to the requested base lots. The market packet requires a full fill. Failure of
  one instruction rolls back the transaction's state changes; transaction fees
  can still be charged.
- **Limit opening + exits:** conditional-account creation if needed, then the
  limit-with-conditionals builder. The order can rest or fill. The attached exits
  track the filled portion under Phoenix's parent/child rules.

Below both, show **mark reaches trigger → reduce-only exit attempt**. Illustrate
one long position with TP above and SL below; briefly note that short directions
reverse. For this app's installed helper, **TP is a limit exit** and **SL is an IOC
exit with a 0.5% price bound**. A trigger does not guarantee a fill. Show separate
TP/SL cancellation controls and avoid implying an unverified automatic sibling
cleanup behavior.

Use an envelope/bracket to make transaction atomicity visible. Do not put a
signature between the market-opening and conditional-placement instructions.
This is a useful explanation of why the app uses different builders for market
and limit entries.

**Code anchors:** [orders.ts](../src/phoenix/orders.ts) lines 50–106,
[service.ts](../src/trading/service.ts) lines 701–761,
[conditional-order-view.ts](../src/trading/conditional-order-view.ts), and the
installed SDK's `src/conditionalOrders.ts` and `src/orderPackets.ts`.
[Phoenix TP/SL](https://docs.phoenix.trade/phoenix/matching-engine/take-profit-stop-loss)
documents mark-price triggers and parent/child behavior. Its website defaults
and editing UI should not be presented as this app's settings.
[Solana transaction atomicity](https://solana.com/developers/evm-to-svm/complete-guide)
explains the all-or-nothing state change and fee distinction.

Actual triggered-exit footage needs its own evidence. The release checklist
records creation separately from independently verified automatic triggers/fills.

## Panel 6 — Builder codes and the fee path

**Viewer's question:** How can an app route through Flight, and when does a builder
receive money?

Separate **operator setup** from **each user order**. Put the Flight dashboard in
a small setup box at the top: register a builder authority and its collector,
choose a registered default. This app reads that registration; it does not
register builders or update the registry.

The main path is **Phoenix instruction → verified Flight wrapper → simulated,
reviewed and signed transaction → Phoenix execution**. A labeled fee branch from
**eligible taking fill** leads to **builder's Phoenix collateral account** when
the signed rate is positive. Do not draw an API server automatically charging a
card or sending revenue to an arbitrary app wallet.

Use a configuration inset with three states:

| Configuration                                | What the diagram should show                                            |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Both settings blank                          | Native Phoenix order; Flight bypassed                                   |
| Registered authority + `0`                   | Flight wrapper with explicit `feeBpsOverride: 0n`; zero app builder fee |
| Registered authority + matching nonzero rate | Verified paid route, capped and disclosed before signing                |

Highlight **registered default ≠ rate in this signed order**. A zero override
does not update the dashboard's registered rate. Paid-rate matching is a deliberate
policy in this app; the SDK supports a broader override mechanism.

The official [Flight overview](https://docs.phoenix.trade/builder-codes) describes
fees on market/taking fills and the crossing part of limits, with revenue credited
to the builder's trader account. Resting maker fills do not currently generate
that fee. Keep **Phoenix trading fees**, **app builder fee**, **funding**, and
**SOL network fees/rent** in separate labels. Zero app fees do not eliminate the
other costs.

**Code anchors:** [monetization.ts](../src/trading/monetization.ts) lines 21–78
and 85–108; [service.ts](../src/trading/service.ts) lines 669–700 and 776–811;
[monetization guide](monetization.md).
The official [Flight SDK guide](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/src/flight/README.md)
and [override builder](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/src/flight/core/ixBuilders/ProxyInstruction/ix.ts)
describe the manual wrapper and explicit override. The installed 0.6.2 source was
also inspected, including preservation of `0n`.

Keep referrals to one small separate label: **optional onboarding attribution**.
They are not builder codes. The current MVP disables referrals, and its release
record does not establish live referral attribution or collected Flight revenue.
Do not spend the core video on referral percentages or portal administration.

## Code excerpts to put on screen

Use **four short code moments** in the main edit, with optional inserts if the
audience wants more depth. These are teaching excerpts from the current source;
surrounding variables and checks are omitted. They are not standalone trading
scripts. Keep the actual safeguards in the repository and link viewers to them.

### A. A live book subscription — panel 3

Shortened from `src/app/market-data.tsx`, lines 104–115; error clearing is omitted:

```ts
for await (const update of client.streams!.l2Book(symbol, controller.signal)) {
  if (controller.signal.aborted) return;
  if (update.market !== symbol) continue;
  setBook({
    market: symbol,
    bids: update.bids,
    asks: update.asks,
    receivedAtMs: Date.now(),
    serverTimeMs: update.ts,
  });
}
```

Highlight the subscription and the two timestamps. The adjacent code handles
abort/cleanup and stale-state checks; do not imply that this excerpt alone is the
whole data implementation.

### B. A bounded market packet — panel 4

From `src/phoenix/orders.ts`, lines 89–98:

```ts
const packet = buildMarketOrderPacketFromMarketParams(
  {
    side: isLong ? Side.Bid : Side.Ask,
    baseUnits: intent.baseUnits,
    priceLimitUsd,
    orderFlags: intent.reduceOnly ? OrderFlags.ReduceOnly : OrderFlags.None,
    cancelExisting: false,
  },
  market,
);
```

Explain the bounded price, exact quantity and reduce-only flag. Briefly point to
`client.ixs.buildPlaceMarketOrder(...)` in `service.ts` as the next step. The packet
is order parameters; the instruction is a program call; the signed transaction
is what gets submitted. The installed packet helper defaults its minimum fill to
the requested base quantity, giving this market path its full-fill requirement.

### C. Preserve the original receipt — panel 4 recovery zoom

From `src/trading/execute.ts`, lines 47–55, shortened only by removing its comment:

```ts
deps.persist(pending);
try {
  await deps.broadcast(plan, signed);
} catch {
  return {
    ...pending,
    detail: 'Submission response unavailable. Checking this transaction; do not repeat the action.',
  };
}
```

For video, wrap the long message across two display lines without changing it.
This is **our application code**, not a Rise SDK function. Its teaching point is
ordering: recovery information is stored before a network response can be lost.

### D. The signed builder rate — panel 6

Object fragment from the call to `flight.wrapInstructionWithFlight` in
`src/trading/monetization.ts`, lines 100–105; comment omitted:

```ts
flight: {
  builderAuthority: route.authority,
  feeBpsOverride: route.feeBps,
},
resolveFeeCollectorTraderAddress: async () => route.collector,
```

Put **`route.feeBps = 0n` for the educational route** beside it as an annotation,
not a fake line copied from the implementation. Zoom briefly to `readBuilderRoute`
to explain that the authority, active state, cap and collector were verified first.

### Optional SDK inserts

| Insert               | Actual symbols and location                                                                                                                      | When it earns screen time                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Funding instructions | `buildDepositIxs`, `buildWithdrawIxs`; `service.ts` lines 511–541                                                                                | Audience wants to reproduce funding; mention native USDC units |
| Account risk math    | `buildSubaccountMarginInputsFromSnapshot`, `createMarginCalculator`, `computeSubaccountMarginFromInputs`; `service.ts` lines 281–286             | Explain equity/capacity and why candle prices are insufficient |
| Native exits         | `buildTakeProfitStopLossTriggerOrders`, `buildPlacePositionConditionalOrder`, `buildPlaceLimitOrderWithConditionals`; `service.ts` lines 707–761 | Expand panel 5 into a deeper SDK lesson                        |
| Portfolio history    | `getTraderPortfolioValues`; `useEquityHistory.ts` lines 38–43                                                                                    | Short UI implementation bonus, not a core transaction concept  |

`prepareMarketOrder`, `prepareTransaction`, `executeReviewed` and `readBuilderRoute`
are app helpers. Label them as such. Use the installed SDK call names actually
used by this checkout; do not substitute a newer documentation example and call
it our implementation.

## Visual direction and recording layout

Use a **light teaching board with emerald brand accents**. This will read clearly
in documentation while still belonging to super perps. A dark charcoal export
could match the app footage, but it is a secondary treatment after the diagram
content and spacing work. No extra version is needed for the first draft.

| Element                  | Direction                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Canvas                   | Warm white `#f8faf8`; charcoal text `#242a2d`                                                         |
| Brand                    | Emerald `#00c78b` for section numbers and small highlights; dark green text where needed for contrast |
| Data / external services | Pale blue / pale lavender fills with explicit labels                                                  |
| Funds / accounts         | Pale mint fill; token labels, not colour alone                                                        |
| Approval / decisions     | Soft amber; prominent **Confirm & sign** label                                                        |
| Failure / uncertainty    | Muted rose branch, labeled pending/failed/expired                                                     |
| Shapes                   | Lightly hand-drawn rounded rectangles; limited hatching; consistent stroke weight                     |
| Text                     | Clear sans-serif labels; monospace only for code and identifiers                                      |
| Arrows                   | Solid for main paths; dashed for alternate/error branches; explicit verbs on crossings                |

Create a **3-column × 2-row master board**, ordered 1–6. Each panel should have a
**1600 × 900 content frame**, generous padding, a short title and a one-line
question. Use roughly 44–48px titles, 28–32px node labels and 24–28px code text.
Keep about 6–9 primary groups per view; reveal nested detail through zooms.

Each panel has two planned viewing states: the conceptual view, then an optional
code/detail zoom. Use a dedicated inset beside the relevant nodes; keep code out
of the overview panel. Show one excerpt at a time and highlight only the lines
being discussed. Avoid shrinking the full master board to fit the video frame.

The master `.excalidraw` file should remain the editable source of truth. Export
six individual 16:9 images for editing, a combined preview, and an index linking
the artifacts. Use existing app captures for the UI; redraw a simplified ticket
only where the diagram needs to connect an input to a transaction field.

## Suggested edit order

| Approximate time | Visual                                 | Purpose                                                          |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------- |
| 0:00–0:30        | Actual app: Home → Markets → Trade     | Establish what viewers will understand/build                     |
| 0:30–1:45        | Panel 1                                | Map the app and external responsibilities                        |
| 1:45–3:15        | Panel 2 + funding screen               | Explain wallet, activation, collateral and SOL                   |
| 3:15–4:45        | Panel 3 + excerpt A                    | Connect visible prices and account values to their sources       |
| 4:45–7:45        | Panel 4 + excerpts B/C + review screen | Explain preparation, approval, submission and recovery           |
| 7:45–9:45        | Panel 5 + order/position cards         | Explain the two entry paths and native exits                     |
| 9:45–12:00       | Panel 6 + excerpt D                    | Explain builder configuration, routing and fee behavior          |
| 12:00–13:30      | Code map, README and evidence          | Point viewers to the fork and state what the footage establishes |

These timings include diagram explanation and code transitions. Additional funded
demonstrations would extend the edit. Use recorded signatures and resulting
account state when claiming actual execution; fixtures can teach UI behavior if
labeled as examples. Source implementation, simulation and live results should
have distinct captions.

Two optional appendix panels are sufficient:

1. **Recovery and PWA:** expand panel 4's pending loop, then add static-only cache,
   offline blocking and updates after old windows close. Use for a reliability lesson.
2. **Builder codes versus referrals:** compare per-order routing with optional
   account-onboarding attribution. Use only if monetization gets a longer segment.

Show navigation, animations, responsive layout and chart interactions through the
app itself. Leave exhaustive component trees, full API catalogs, spline matching,
liquidation mathematics, isolated accounts, SOL collateral, paymasters and
delegated one-click trading outside the core diagram set. They would each require
their own explanation and some are outside the app's scope.

## Recommended drawing sequence

Draft **panel 1** first to establish typography, colour and grouping. Then draw
**2, 4 and 6**, which form a useful shorter video on their own. Complete **3 and 5**
for the technical walkthrough. Check each diagram against its source anchors,
especially onboarding submission, account polling, the atomic exit envelope and
the explicit zero builder fee, before exporting.

The concrete next deliverable is one six-panel board and its individual exports.
This brief supplies the content and layout decisions for that work; it does not
change application behavior or claim new funded verification.
