# Preflight review — 29 October 2026

The core manual-confirmation MVP is ready for a limited, user-operated acceptance
run. This is a local implementation review and public-network check, not an
independent security audit or proof of successful funded execution. No financial
transaction was signed or submitted during this review.

## Fresh results

| Check                                      | Result and boundary                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated tests                            | 179 tests pass in 15 files after the setup and wallet corrections below; financial submission is mocked and test signing uses unfunded ephemeral keys                             |
| TypeScript and configured production build | Pass; existing worker externalization and large-chunk warnings remain                                                                                                             |
| Formatting and whitespace                  | `npm run format:check` and `git diff --check` pass                                                                                                                                |
| Public integration probe                   | 5/5 checks pass: metadata, books, candles, stream updates and unsigned instruction builders                                                                                       |
| Trading probe                              | Pass on a separate retry: 104-market risk reads, unsigned orders/exits/funding/cancellation, Flight routing shapes and expected unfunded simulation refusals                      |
| Actual configured builder                  | Read-only on-chain lookup confirms active registration and an exact configured/registered rate of 10 bps; collection on fills remains untested                                    |
| Browser session                            | Existing Privy session restores after reload; the primary app wallet resolves automatically and empty balances render                                                             |
| Trade controls                             | Market/Limit, Long/Short, Open/Close, size/unit/allocation, TP/SL fields, GTC/FOK labels, totals and margin readouts inspected; Close removes opening exits and shows Reduce only |
| Public charts and navigation               | AAPL candles load (160 bars); Home search filters and opens the matching ETH ticket; Account and Assets render                                                                    |
| Funding                                    | Receive explains USDC plus SOL on Solana; Deposit requires setup; withdrawal exposes a recipient field and is blocked for the empty, uninitialized account                        |
| Compiled startup                           | Production desktop handoff renders without a warning/error in that tab; this is not a production mobile signing check                                                             |

The code review covered automatic wallet ownership resolution, identity checks
before/after signing, fresh action preparation, mainnet/mint checks, whole-lot and
tick sizing, reduce-only direction/size, native exits, withdrawal destinations,
builder-rate validation, simulation, exact-message signature verification and
persisted recovery before broadcast. The existing tests exercise these helpers;
full React/provider integration and funded behavior still need acceptance.

## First funded-wallet setup check

The user received 2 USDC and 0.01 SOL in the Privy app wallet; Assets displayed
both without manual refresh. No Phoenix setup, deposit or trade was signed by
the assistant. The first account setup review exposed an oversized default:

- The 128-position setup failed unsigned simulation with `Transfer: insufficient
lamports 9990000, need 27879040`. The trailing `0x1` messages hid this useful
  cause. More USDC would not cover the missing SOL.
- A 32-position setup succeeded in unsigned mainnet simulation. Observed rent was
  8,371,840 lamports and the fee was 10,000 lamports, leaving 1,618,160 lamports.
  New accounts now use this documented supported capacity; existing accounts
  are not resized. Build, exact instruction comparison and ordinary submission
  all use the same capacity.
- An unsigned combined setup + 2 USDC deposit probe reached Phoenix's successful
  deposit instruction but the transaction failed the runtime rent check on the
  payer. This is **not a successful deposit**. The live RPC quoted 1,488,440
  lamports for a token account and 650,240 lamports for a zero-data wallet's rent
  reserve. Separate app transactions also need their own network fees.
- No blanket 10 USDC deposit/collateral minimum was found in the checked SDK/docs.
  Public metadata reported ETH lots of 0.001 ETH and SOL lots of 0.01 SOL. SDK
  calculations for a hypothetical empty account with 2 USDC gave initial margin
  below 0.10 USDC for one such lot; these are estimates, exclude the final fee
  outcome and do not prove a funded order fill.
- Error handling now retains precise SOL shortfalls and explains runtime
  fee/rent failures. Regression tests cover the original logs, unrelated `0x1`
  failures, fee/rent errors and the 32-slot submission request. All 166 tests,
  TypeScript and the production build pass after this correction.

Wallet-linked probe logs remain in ignored `output/setup-*-2026-10-29.json`.
Funded activation, deposit and orders still require the user's confirmations and
resulting on-chain receipts before they can be marked as passed.

## Signing-screen interruption follow-up

After topping up, the user reported that **Confirm & sign** briefly opened a
wallet screen, then appeared to log them out; login did nothing until reload.
Read-only checks found 0.025 SOL and 2 USDC in the app wallet and no registered
Phoenix trader account. Account activation had not completed. The earlier
browser exception was no longer available after the user's reload.

Source inspection found that `PrivyRoot` omitted `config.solana.rpcs`. Privy
3.51.0's signing screen throws during render when its mainnet RPC client is
missing. Our outer boundary then rendered a false unauthenticated session with
a no-op login function. These two reproducible defects explain the reported
behavior; they were fixed with explicit mainnet HTTP/WebSocket clients and an
honest recovery screen with a reload action. Wallet approvals remain enabled.

Regression tests reproduce the missing configuration and fallback behavior;
client-rendered recovery preserves the transaction journal and invokes reload.
An isolated browser fixture also verified that a render failure shows the recovery
screen and its **Reload wallet** button restores the fixture. It had no connected
wallet and performed no signing.
Errors now distinguish wallet cancellation, network interruption, simulation
refusal and confirmed on-chain failure, retaining technical details separately.
Setup review and confirmation explicitly state that setup does not deposit USDC.

A clean browser reload restored the user's existing wallet. A fresh **unsigned**
setup simulation passed and the browser review displayed 0.00837184 SOL rent and
0.00001 SOL network fee. All 179 tests, TypeScript, production build, formatting
and whitespace checks pass. Actual Privy approval, Phoenix co-signing, submission
and confirmation still require the user's next acceptance attempt; no successful
funded activation or deposit is claimed by this fix.

## Funded acceptance preparation

The user authorized continued testing with the funded app wallet. A fresh
unsigned mainnet simulation combined 32-slot setup and a 2 USDC deposit to check
the earlier rent shortfall after the SOL top-up. It returned `err: null` and
64,165 compute units. Read-only snapshots before and after both showed 0.025 SOL,
2 USDC and no registered trader account. This simulation did not sign, co-sign,
submit or persist any state; the product continues to use separate setup and
deposit transactions. The wallet-linked result is in ignored
`output/funded-acceptance-readonly-2026-10-29.json`.

## Funded account activation confirmed

After the user approved setup, a read-only check at 13:08:50 UTC on October 29
verified the transaction was finalized with no error. Its logs contain
`RegisterTrader`, successful registration with 32 positions, and enabled order,
deposit and withdrawal capabilities. The registered account is now readable by
the app. The transaction charged 0.00837184 SOL in account rent and 0.00001 SOL
in network fees, leaving 0.01661816 SOL in the wallet.

This transaction only activated the account: wallet USDC remains 2.00 and Phoenix
equity/free margin remain zero. It is not a deposit. The app's confirmation says
this explicitly, and the Deposit sheet now offers the amount form instead of the
setup gate. A subsequent unsigned review of a 2 USDC deposit passed, quoting
0.00148844 SOL account rent and 0.000005066 SOL network fees. The deposit still
requires wallet approval and its own confirmation before it can be marked passed.
The assistant did not sign or submit either transaction. The finalized activation
receipt and account snapshot are in ignored
`output/funded-setup-confirmed-2026-10-29.json`.

## Funded deposit confirmed and funding UI follow-up

After the user approved the separate 2 USDC deposit, a read-only check at 13:41:13
UTC verified a finalized transaction with no error and a Phoenix `DepositFunds`
event. Wallet USDC is zero; Phoenix equity and free margin are both 2,000,000 quote
lots (2 USDC). The wallet has 15,124,654 lamports remaining; the network fee was
5,066 lamports. The receipt and snapshot are saved locally in ignored
`output/funded-deposit-confirmed-2026-10-29.json`. The assistant did not sign or
submit this transaction. Funded account setup and deposit are now verified; trading,
closing, withdrawals and fee collection are not yet verified.

The creator requested a clearer first-deposit journey. The amount is now collected
before setup, both stages show progress, and a confirmed setup automatically opens
a fresh deposit review. Rejected/failed/expired transactions do not advance. The
saved amount can be recovered after reload by opening transaction status, without
automatic signing. Existing accounts skip setup.

The manual dismissal delay came from Privy 3.51.0 returning the signed transaction
only after its success receipt closed. The adapter now closes only that explicitly
labelled signed receipt, retaining approval and error screens. App progress begins
immediately after signing, before submission finishes. See the compatibility note
in [funding abstraction](funding-abstraction.md).

An isolated `localhost` browser fixture with an ephemeral, unfunded signer and
mocked service responses verified the complete UI progression, including automatic
receipt dismissal and setup-to-deposit transition. It used a separate origin from
the actual wallet app and made no financial network submissions. Screenshots are
in ignored `output/deposit-journey-*-2026-10-29.png`. These are UI rehearsal results,
not a second mainnet deposit or proof of the revised UI on a real Privy signature.
All 195 tests across 17 files pass after the update, along with TypeScript,
production build, formatting and whitespace checks. Existing build chunk-size
warnings remain.

## Findings retained

- The first trading probe received HTTP 429 during its referral setup simulation
  while the public probe was also running. A separate retry passed. Referrals are
  disabled in the MVP, but API throttling/retry behavior still needs acceptance.
- Rise again logged a connection error after the Node public probe completed.
  The development browser also logged events sent to a stopped SDK actor. Book
  updates and candles worked; graceful disposal/reconnection is not proven.
- `npm audit` still reports 30 affected package entries (21 high, 9 moderate),
  across the Zod, decode-uri-component and uuid advisory families. These are not
  30 independently established app exploits. Review/update the provider dependency
  tree before public release; see [release findings](release-findings.md).
- Physical iPhone/Android signing, live rejection/interruption and pending-receipt
  recovery, provider origins, license/distribution review and mobile performance
  remain outstanding. The installable PWA lifecycle is not implemented.

Public evidence is retained under [evidence/](evidence/README.md). Local command
logs are in ignored `output/preflight-*-2026-10-29.*`. The initial throttled result
is retained alongside the successful retry rather than presented as a clean run.

## Next step and one-click sequencing

1. Prove the baseline with normal wallet confirmations: receive SOL/USDC, activate,
   deposit, place/cancel a small limit, open a small position, check TP/SL and chart
   state, reduce-only close, then withdraw. The human chooses the amount and confirms
   every financial action. Record both signatures and resulting account state.
2. If one-click remains in scope, implement it after that baseline works and before
   broader user acceptance. It is currently absent; the signing bridge explicitly
   requests Privy's wallet confirmation UI.
3. Test one-click separately: owner-approved setup, permitted order/cancel actions,
   enable/disable, reload/logout, lost signer, expiry handling, revocation and
   unchanged owner confirmation for withdrawals. Then repeat the trading round trip.

[Phoenix delegation](https://docs.phoenix.trade/sdk/accounts) and
[Privy signing UI controls](https://docs.privy.io/recipes/react/manage-wallet-UIs)
are complementary. A separate Phoenix position authority provides separation from
the account owner; simply suppressing the owner's Privy modal does not. The
delegation is an owner-signed on-chain transaction, and each later order still
needs a signature. Local session expiry alone is not on-chain revocation.

With the accepted self-funded MVP, the fee payer and SOL reserve for a separate
trading signer must also be designed and tested. Delegation alone neither funds
that signer nor authorizes it to spend the owner's wallet funds. Kora/Pimlico,
automatic swaps and automatic deposits stay deferred.
