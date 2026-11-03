# Technical video map

For the recommended six-diagram narrative, Excalidraw layouts and SDK excerpt
shortlist, see the [video and diagram plan](video-diagram-plan.md).

Public prices in captures are historical snapshots, not executable quotes. Keep
emails, personal provider identifiers and authenticated wallet captures out of
public recordings unless deliberately prepared for that purpose.

| Sequence                                    | Code                                                            | Teaching point                                                                        |
| ------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Floating hero → Home search → category list | `src/app/Home.tsx`, `SearchMarkets.tsx`, `market-categories.ts` | Restrained motion, dedicated search, canonical market routes                          |
| Trade → slider → TP/SL → expand chart       | `Trade.tsx`, `components/CandleChart.tsx`                       | Capacity versus notional, compact ticket/book, independent chart scrolling            |
| Direct Privy login → automatic app wallet   | `src/wallet/`                                                   | Restore the current user's primary Privy wallet; read-only address, Copy and Explorer |
| Assets → receive → review setup/deposit     | `Funding.tsx`, `src/trading/service.ts`                         | Wallet funds differ from exchange collateral; onboarding eligibility and rent         |
| Simulate → review → Confirm & sign          | `chain.ts`, `execute.ts`                                        | Exact message signing, bounded prices, fee/rent display, one explicit app approval    |
| Pending → confirmed → refreshed account     | `context.tsx`, `receipt.ts`                                     | Persist before send, reconcile ambiguous responses, avoid duplicate exposure          |
| Positions/orders/TP-SL → close or cancel    | `Trade.tsx`, `service.ts`                                       | Native exit orders, reduce-only closure, results verified from account state          |
| Run tests and unsigned probes               | `scripts/`, `src/trading/*.test.ts`                             | Local tests, simulation, submission and actual fills are different evidence           |

The maintainer reported funded setup/deposit, order placement/cancellation,
market opening/closing, TP/SL creation and withdrawal. Use an actual recorded
transaction and resulting state when demonstrating those flows; do not present a
fixture or simulation as live execution. The [release summary](release-checklist.md)
lists the remaining native-exit, device and recovery cases.

Show the production desktop handoff and development-only phone preview. Explain
the small cross-margin MVP scope, configurable repository placeholder, original
artwork and actual coin logos. The Magic UI adaptation is limited to hero entrance;
the useful engineering detail is in the data and transaction lifecycle.
