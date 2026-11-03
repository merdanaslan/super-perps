# Funding and signing experience — updated 1 November 2026

**Current MVP decision, 29 October:** keep Receive / Deposit / Withdraw. Users send
USDC for collateral and SOL for fees/account rent to the same Privy app-wallet
address on Solana. Only USDC is deposited as collateral by this app. The app does
not pay users' network fees.

Kora/Pimlico and automatic USDC-to-SOL swaps are deferred. Automatic deposits,
one-click trading and user-paid USDC network fees are **not implemented or enabled**.
The research below is retained for later forks; it is not an MVP dependency or
an instruction to enable provider billing.

## Current behavior

The app accepts Solana USDC for collateral deposits. `Funding.tsx` separates
receiving wallet funds from depositing collateral. A first deposit now guides the
user through account activation and the deposit in one continuous sheet.
`service.ts` constructs Phoenix deposit instructions; `chain.ts` currently uses
the automatically restored Privy app wallet as fee payer and checks its SOL for fees
and account rent.
`PrivySessionBridge.tsx` signs the reviewed message, while the app records a pending
receipt before submitting it. It does not request gas sponsorship or delegated
background signing.

New trader accounts reserve **32 simultaneous position slots**, Phoenix's minimum
supported onboarding capacity, instead of the SDK default of 128. This reduces
upfront SOL account rent; it does not limit the lifetime number of trades or resize
existing accounts. Both referral and ordinary onboarding use the same capacity,
including the ordinary co-signing submission request. The unsigned review shows
the capacity, simulated rent and network fee. See [Phoenix onboarding](https://docs.phoenix.trade/sdk/register).

The first funded-wallet check on 29 October found that 0.01 SOL was insufficient
for the previous 128-slot registration. The 32-slot setup simulated successfully
at 0.00837184 SOL rent plus 0.00001 SOL network fee. Those are dated observations,
not fixed prices or a successful activation. The first USDC deposit may also create
a token account, and the wallet must retain its required SOL rent balance. Native
TP/SL accounts can add rent later. Simulation errors now explain SOL shortfalls
and distinguish fee/rent failures instead of showing only generic program codes.

A normal wallet address can receive SOL and other SPL tokens too. Restricting the
app's supported deposit asset cannot stop unsolicited transfers to that address.
There is no automatic conversion of unsupported assets. Instructions should specify
**USDC on Solana**. Phoenix itself supports USDC and SOL collateral; this MVP only
implements the USDC deposit path. See [Phoenix collateral](https://docs.phoenix.trade/phoenix/collateral-and-accounts/collateral).

Receiving a transfer does not credit a Phoenix trading account. The SDK builds
additional instructions that convert USDC to its canonical representation and
deposit it. The trader account must exist, and actual collateral must be checked
after confirmation. See [the SDK deposit flow](https://docs.phoenix.trade/sdk/collateral).

The Receive page explicitly says **USDC + SOL · Solana network** and explains the
same address receives both, with separate collateral and fee purposes. An external sender's transfer signature
does not authorize the receiving wallet's Phoenix deposit. The deposit transaction
still needs the trader wallet's signature.

## External withdrawal destination — implemented

Withdraw → USDC → Phoenix collateral accepts a destination Solana wallet, with a **Use my app wallet** shortcut.
The service builds the official Phoenix withdrawal/Ember unwrap instructions, then
appends idempotent creation of the destination USDC associated token account and
an exact-amount `TransferChecked`. These instructions share one transaction and one
user review/signature. If the onward transfer fails, the withdrawal also rolls back;
network fees may still be charged. With the app wallet selected, the extra transfer
is omitted. The review shows the full destination and amount before signing.

The MVP supports regular Solana wallet destinations. It rejects malformed,
off-curve, executable and existing non-wallet accounts; memo-required exchange
destinations are not supported. Phoenix cooldown and withdrawable-margin checks
still apply to this source. Creating a recipient's USDC account can add SOL rent
to the reviewed cost.

## Wallet SOL and USDC transfers — implemented 1 November

Withdraw offers **USDC / SOL**. For USDC, users explicitly choose **Phoenix
collateral / Wallet**; the app never combines those balances or silently withdraws
collateral to cover a wallet send. SOL always comes from the app wallet.
Wallet transfers work without a registered Phoenix account. Balance reads use
Solana's native account and canonical USDC associated token account at one confirmed
slot, independently of Phoenix API availability. Unsupported tokens, noncanonical
token accounts, swaps and wrapped SOL are not included.

`trading/wallet-transfers.ts` constructs either a native System Program transfer
or recipient ATA creation plus `TransferChecked` for USDC. Amounts remain exact
integer lamports/base units. The native SOL transfer uses the ordinary network
fee without an added priority-fee instruction; `getFeeForMessage` quotes the
compiled message before simulation. **Max** resolves to balance minus that fee,
shows the exact amount and remaining SOL in review, and can leave zero SOL. Users
must add SOL again before sending remaining tokens or trading. No fixed fee or
permanent reserve is assumed. An invalid rent balance or destination is rejected
by simulation before any signature; outgoing SOL principal is never shown as rent.

Both paths retain explicit review/signing, exact-message checks, the pending
receipt journal and HTTP confirmation polling. Wallet-transfer confirmation waits
for a sufficiently recent Solana wallet snapshot, rather than a Phoenix snapshot.
The full destination is visible in review. Self-sends, off-curve/non-wallet
destinations and destinations requiring a memo are not supported.

Local regression and UI checks are separate from a funded transfer. The new wallet
send paths still require the maintainer's small-amount phone acceptance test.

## Guided first deposit — implemented 29 October

Receive / Deposit / Withdraw remains the navigation. In Deposit, the user enters
the amount once, including for an unregistered account. The sheet shows **Create
Phoenix account → Deposit USDC**, with a separate app review and **Confirm & sign** for
each transaction. After setup confirms and the refreshed account reaches that
slot, the deposit review opens automatically with the original amount. Returning
users skip the setup transaction. Nothing signs or deposits merely because funds
arrive, a user logs in, or a page reloads.

The setup receipt stores the requested amount alongside its pending signature.
After a reload, opening transaction status can resume the deposit review. Failed,
expired or rejected setup does not advance; retries remain explicit. Wallet
changes stop continuation. An ambiguous submission retains the pending receipt
and cannot be retried until resolved. Deposit completion waits for confirmation
and account refresh, rather than treating a signature as a credited balance.

Solana can batch instructions, and our earlier unsigned combined setup/deposit
simulation passed. That does not prove acceptance by Phoenix's onboarding
co-signing API. The MVP retains the separately verified transactions; changing to
one signature would require checking the combined co-signing/submission path.
See [Phoenix onboarding](https://docs.phoenix.trade/sdk/register).

The app's **Confirm & sign** is now the final transaction approval. Privy 3.51.0
supports `uiOptions.showWalletUIs: false` on Solana `signTransaction`, so the
bridge uses that per-call option to avoid a duplicate approval and success receipt.
The former DOM receipt-dismissal adapter has been removed. See
[Privy's signing documentation](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction).
The app immediately displays signing progress, then submission and confirmation.
Exact-message/signature verification, wallet-identity checks and save-before-send
remain in place. This does not skip either review or combine the two transactions.

Tests and an isolated browser rehearsal cover these transitions without a real
wallet or network submission. The revised single-confirmation UI still needs its
next funded acceptance check; see [funded acceptance evidence](preflight-2026-10-29.md).

## Deferred automatic receiving and depositing

Combining the Receive page with waiting for an incoming transfer is still deferred.

Fully automatic deposits need a separate, explicit authorization design. This is
product consent, not a Phoenix protocol setting called "automatic deposits". A balance
increase alone must not authorize sweeping the wallet: withdrawal returns, existing
funds and repeated notifications must not be mistaken for new deposit requests.
Completion while the app is closed needs a server worker and a constrained signer
or equivalent preauthorized deposit mechanism. These are additional backend and
wallet capabilities, not a cosmetic change to the current sheet.

Background execution is not required for a foreground-only funding journey. If
the user leaves the PWA to send USDC from another wallet/exchange, the app can
resume detection and preparation on return. Do not promise an immediate deposit
while the app is suspended. A future journey must distinguish an incoming transfer
from USDC deliberately withdrawn to the app wallet, so it does not redeposit
funds the user wanted to park there.

During an authenticated foreground session, Privy's client SDK can request the
embedded wallet's signature without exposing its private key. Its documented
[`showWalletUIs` option](https://docs.privy.io/recipes/react/manage-wallet-UIs)
controls the confirmation modal. Removing a modal does not remove the signature
or provide informed consent to recurring deposits. Current calls explicitly set
this option to `true`; a future deposit-only opt-in must be implemented separately.

[Privy additional signers](https://docs.privy.io/wallets/using-wallets/signers/overview)
can support preauthorized background actions. A future automatic-deposit option
must explicitly obtain that authorization and enforce deposit-only destinations,
amount and fee limits, and revocation. This avoids a prompt on each arrival, not
the underlying wallet signature. Kora's fee-payer signature cannot substitute for
the user's deposit authority.

## Removing the user's SOL requirement

This is deferred beyond the MVP. A normal USDC-to-SOL swap cannot pay its own
upfront fee from the SOL it produces: [Solana deducts the fee before execution](https://solana.com/docs/core/fees/fee-structure).
A separate gasless swap/fee-payer service can address that, but would require
another integration and verified terms. Privy signing alone does not provide it.

[Privy's swap API](https://docs.privy.io/wallets/actions/swap/overview) does support
Solana swaps. Its documented network-fee options are payment from the wallet's
native token balance or app-funded gas sponsorship. Integrating it would therefore
not, on its own, remove the zero-SOL funding problem without costs for the app.
It is not configured in this starter.

Solana still charges SOL; a separate sponsor can pay it. [Solana's fee abstraction
guide](https://solana.com/docs/payments/send-payments/payment-processing/fee-abstraction)
also describes Kora for collecting fees in tokens such as USDC.

[Privy's current setup guide](https://docs.privy.io/wallets/gas-and-asset-management/gas/setup)
supports **App pays** on Solana, with billing/credits, compatible TEE execution
and sponsored sign-and-send requests. Its **User pays** stablecoin-gas mode is
currently EVM-only. Therefore, a USDC-only onboarding experience using native
Privy sponsorship would make the operator responsible for costs; it would not
deduct Solana gas from USDC automatically.

Account creation/rent is distinct from the transaction fee. The documentation does
not establish that a sponsorship toggle covers this app's custom Phoenix account
creation instructions. Verify sponsor handling for trader setup, token accounts
and conditional-order accounts before promising a zero-SOL experience.

The sponsor also changes the transaction fee payer and blockhash, according to
[Privy's overview](https://docs.privy.io/wallets/gas-and-asset-management/gas/overview).
The current exact-message check and record-before-broadcast flow need a deliberate
adapter, including recovery if the provider submits but the client loses its
response. Do not remove those checks just to accept a modified transaction.

## Paying Solana fees in USDC with Kora — researched

[Kora](https://solana.com/docs/tools/kora) can collect a token fee while its operator
pays the network in SOL. Self-hosting requires SOL liquidity and operational work;
a [hosted provider](https://solana.com/docs/tools/kora/providers) manages that role.
This is distinct from Privy's EVM-only built-in **User pays** mode.

[Pimlico's Privy integration](https://docs.pimlico.io/guides/how-to/solana/privy)
documents quoting the fee, adding the USDC payment instruction, having Privy sign
the final transaction and obtaining the paymaster's signature. It is a candidate
that can retain the app's existing Privy wallets. On 29 October the creator supplied
a key, stored in ignored `.env.server.local` without a `VITE_` prefix. Read-only
mainnet calls to `getSupportedTokens` and `getPayerSigner` succeeded, with USDC
supported. See the [sanitized probe](evidence/pimlico-read-only-2026-10-29.json).
This verifies metadata access, not the account's subscription, billing limits or
transaction eligibility. No billing settings changed and no payment integration
was enabled.

Kora is the paymaster software/API; Pimlico is a hosted operator offering that API.
With self-hosting, this app's operator maintains SOL liquidity, receives users'
USDC payments and manages any treasury rebalancing. A USDC-to-SOL swap is not an
inherent step of every Kora transaction. With hosted Pimlico, Pimlico manages the
SOL fee-payer account. In its [token-payment mode](https://docs.pimlico.io/guides/how-to/solana/token-sponsorship),
the user pays the quoted USDC fee in the same transaction. This network/service
payment is separate from Phoenix exchange fees and this app's Flight builder fee.

**Required integration rule:** Pimlico also documents charging the app's balance
when a transaction does not pay a supported token fee. The future adapter must
require a valid, user-reviewed USDC payment and reject missing/invalid quotes or
payments before calling the provider. Never silently fall back to app billing.
Keep the provider credential on a server, not in a `VITE_*` variable. This static
client does not yet have the required server-side provider adapter. Requiring a
USDC instruction prevents missing-payment fallback, but cannot eliminate the
failed-transaction liability described below.

### Pricing and cost boundary — checked 29 October, integration deferred

Pimlico supports Solana mainnet. The distinction below is the Free plan versus
the $0/month pay-as-you-go plan, not a lack of mainnet support.

[Pimlico's pricing documentation](https://docs.pimlico.io/guides/pricing) excludes
mainnets from its Free plan. Solana mainnet is in the $0/month pay-as-you-go plan,
which requires a card, includes 10 million API credits/month, and charges $1 per
additional 100,000 credits. The documented SPL-token flow uses about 1,202 credits
per transaction. API usage is separate from the user's USDC network payment;
metadata access does not identify this key's actual plan or remaining allowance.

The [Solana token guide](https://docs.pimlico.io/guides/how-to/solana/token-sponsorship)
quotes the simulated SOL cost in USDC, including supported account rent. If a
transaction fails on-chain, its USDC payment rolls back and Pimlico charges the
SOL fee to the app balance. Simulation does not remove this possibility.
[The pricing page](https://www.pimlico.io/pricing) also lists a 10% surcharge for
mainnet sponsored gas; confirm its application to failed Solana transactions
before enabling billing. Do not import the separate ERC-20 surcharge into SPL
token quotes without provider confirmation.

Therefore this is not an unconditional zero-cost service for the app. Keep it
inactive until the creator's cost requirement is resolved with provider terms or
a separate user-prepaid fee design. No subscription, card or spending permission
was added during verification.

A future automatic deposit should leave a disclosed, quoted USDC fee reserve in
the wallet. Sweeping all USDC into Phoenix collateral would leave no wallet tokens
to pay for subsequent operations. The reserve must follow actual provider quotes,
not an assumed fixed fee.

Compatibility is not yet established for first-time Phoenix activation. Current
activation uses a Phoenix onboarding co-signer and an API that co-signs and sends
the registration transaction. A paymaster needs the complete signing/broadcast
sequence to be coordinated without changing the reviewed message. Also verify
Phoenix account rent: [Kora fee estimates](https://solana.com/docs/tools/kora/operators/fees)
include supported account-creation costs, while [Pimlico's constraints](https://docs.pimlico.io/guides/how-to/solana)
include a 0.1 SOL per-transaction cap covering fees, priority fees and rent. This
research does not prove that custom Phoenix account creation fits that path.

## One-click trading — researched, not implemented

Every current financial action has an app review and explicit **Confirm & sign**.
Privy's duplicate transaction modal is disabled per call; that alone is not a
delegated one-click trading session. A future mode that skips repeated app reviews
needs explicit opt-in and a defined authorization lifetime and scope. It must still
simulate, sign, submit and reconcile each transaction; withdrawals and authority
changes should retain their own approval flow.

[Phoenix's account documentation](https://docs.phoenix.trade/sdk/accounts) also
supports `DelegateTrader`, which sets a separate `position_authority` for trading
while withdrawals remain owner-controlled. That setup is an owner-signed on-chain
transaction, not merely signing a login message. This app has not implemented
delegation, session controls or revocation UI. Automatic deposits, one-click
trading and USDC fee payment are three separate capabilities; enabling one does
not implicitly authorize the others.

The preferred one-click design combines Privy signing with Phoenix's separate
trading authority; these are different layers, not competing wallet providers.
It requires a separate trading signer and owner-approved delegation plus a way
to disable/revoke it. That technical signer need not become another wallet that
the user chooses in Account.

The current primary Privy wallet already owns the Phoenix account. Delegating
back to that same wallet would not separate trading from ownership. A distinct
Privy-managed trading signer could provide that separation while keeping one
visible app account. Every order still needs a cryptographic signature; one-click
mode changes how authorized trading signatures are requested, not that requirement.

**For the current self-funded MVP:** a separate trading signer also needs an
explicit fee-payer design and SOL funding/reserve. Delegation does not automatically
fund that signer or authorize it to spend the owner's wallet. Prove the existing
manual-confirmation funded flow first; then implement and test one-click if still
in scope. See the [29 October preflight sequence](preflight-2026-10-29.md).

**For a future USDC-fee provider, fee authorization is a separate check:** Phoenix's position
authority does not by itself authorize transferring the owner's wallet USDC to
Pimlico. A delegated trade must also have an authorized source for its USDC fee.
Test a bounded fee-payment design or a disclosed fee reserve before claiming that
Phoenix delegation alone removes every signature prompt. Do not silently give a
trading signer unrestricted access to the primary wallet.

## Deferred implementation sequence

These are prerequisites only if a future version revisits the provider path.
They do not block testing or shipping the current self-funded MVP flow.

1. Key storage and read-only mainnet metadata checks are complete. Resolve actual
   account entitlement, API overages and failed-transaction liability before
   enabling paid calls. The current documented service cannot promise zero app
   costs merely by attaching a USDC payment.
2. Build a narrow server adapter for Pimlico's token-payment mode. Require quoted
   USDC payment, validate the final message and fail without app billing if that
   payment is absent or invalid. Preserve the app's pending-transaction recovery.
3. Prove first-time Phoenix activation and account rent with the paymaster, then
   deposit, orders, cancellations, TP/SL and withdrawal using a wallet with USDC
   and zero SOL. Start with construction/simulation; funded acceptance is a
   separate user-controlled run. Phoenix mainnet is not a Solana devnet deployment.
4. Add optional Phoenix trading delegation only after its USDC fee authority is
   resolved. Verify enable/disable, rejected setup, reload, signer expiry/recovery
   and that withdrawal still requires owner approval. UI session expiry alone is
   not on-chain revocation of a Phoenix position authority.
5. Revisit foreground automatic deposits only if the existing funding flow remains
   too cumbersome. Keep parked wallet funds distinct from trading collateral.

## Acceptance required before enabling a future paymaster

Exercise a fresh embedded wallet holding USDC and zero SOL through activation,
deposit, trade, TP/SL and withdrawal; reconcile sponsor costs and resulting state.
Check cancellation, duplicate arrival events, wallet switches, expired quotes,
reloads, ambiguous submission and exhausted provider limits. Verify that a missing
USDC payment fails without app billing. The current product uses one Privy wallet;
external-wallet support is not part of this acceptance scope. Public-template
paymaster settings stay optional;
operator billing, secrets and signing keys must not enter the client bundle.

Funding verification on 28 October: 144 tests passed, including 17
withdrawal-destination cases. The 29 October automatic-wallet update has 161
passing tests; see [verification](verification.md).
The real SDK's unsigned external-withdrawal transaction is 981 bytes, below the
1,232-byte limit. Type checking, formatting and a configured build pass. Browser
checks verify the receive notice, destination validation, own-wallet shortcut and
disabled withdrawal on an empty account. These are construction/UI checks, not
proof of a successful withdrawal. No sponsored or funded transaction was executed
for this investigation.
