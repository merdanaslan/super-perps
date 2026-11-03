# Builder fees and referrals

Implemented **28 October 2026** against `@ellipsis-labs/rise` **0.6.2**;
zero-fee educational routing added **1 November 2026**.
The public template remains blank: no creator builder, referral code, private key or
provider secret is shipped. This app does not register builders, update their
on-chain fee or claim builder/referral earnings.

## Zero builder fee for the educational app

Both builder settings blank means native Phoenix orders with no Flight wrapper.
To retain Flight routing without charging users an app fee, configure a registered
builder authority and set `VITE_PHOENIX_BUILDER_FEE_BPS=0`. Zero is a valid explicit
SDK override; it is encoded as `Some(0)`, not an absent value that would use the
registered rate. See the official
[Flight SDK guide](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/src/flight/README.md)
and [override validation](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/src/flight/core/ixBuilders/ProxyInstruction/ix.ts).

The local educational configuration uses **0 bps (0%)**, replacing the previous
10 bps testing rate. This is an app routing change, not an on-chain registry update.
It applies to newly prepared transactions from this build; other clients and
already signed transactions retain their own rates. Phoenix trading fees, funding,
account rent and Solana network fees still apply.

## Follow the fee through the code

The rate chosen in the Flight dashboard is the builder's **registered default**.
The setting in this app is the **explicit rate for its new orders**. Setting the
app to zero does not change what the dashboard displays or how other integrations
use that builder.

| App configuration                                    | Result                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Authority and rate both blank                        | Flight is disabled; no additional app builder fee.                                   |
| Registered authority and rate `0`                    | Flight remains enabled with an explicit zero builder fee.                            |
| Registered authority and its nonzero registered rate | Flight remains enabled with that disclosed builder fee, subject to the exchange cap. |

1. [`.env.example`](../.env.example) documents the public settings. Put local values
   in ignored `.env.local`; [config.ts](../src/config.ts) reads them at build time.
   Restart development or rebuild the hosted app after changing them.
2. [monetization.ts](../src/trading/monetization.ts) parses the settings, verifies the
   active on-chain registration and fee cap, and resolves the fee collector. The
   exact registered-rate requirement for paid routes is a deliberate starter
   policy; it is stricter than the SDK's override range.
3. `routeBuilderOrders` in that same file uses the official SDK's manual wrapper:

   ```ts
   flight: {
     builderAuthority: route.authority,
     feeBpsOverride: route.feeBps, // 0n for the zero-fee configuration
   }
   ```

   **Keep `0n` explicit.** Replacing it with `undefined` would select the registered
   default. No custom transaction-byte patching or registry update is involved.

4. [service.ts](../src/trading/service.ts) uses that same verified route for the
   order and its review disclosure before simulation and signing.
5. [monetization.test.ts](../src/trading/monetization.test.ts) includes a regression
   test with a synthetic 10 bps registration and checks that the real SDK encodes
   a zero override. This proves local encoding, not a submitted mainnet trade.

For a free app that does not need builder routing, leaving both settings blank is
the simplest option: there is no Flight lookup or wrapper. For this educational
example, keeping the optional integration with an explicit zero rate demonstrates
builder codes without adding an app fee. The manual wrapper is a documented SDK
path and lets this app validate the registration before constructing the review.

## Two separate revenue paths

| Path                       | Who pays / benefits                                                                            | Scope                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Phoenix Flight builder fee | An extra fee paid by the trader to the configured builder's Phoenix trader account             | Taking fills routed through this app: market orders and the crossing portion of limits. Current resting maker fills do not earn it. |
| Phoenix referral program   | Eligible users receive an exchange-fee discount; the referrer receives a share of Phoenix fees | A permanent relationship established during new-account activation, subject to venue eligibility, code limits and program terms.    |

Phoenix's [builder documentation](https://docs.phoenix.trade/builder-codes) describes
on-chain registration through [Flight](https://flight.phoenix.trade) and credits
builder revenue as collateral. This code routes owner-signed orders with the
official SDK wrapper. It does not register a builder, change its on-chain rate or
withdraw its earnings. Phoenix recommends a dedicated builder wallet.

As checked on 28 October 2026, the [referral program](https://docs.phoenix.trade/incentive-programs/referral-program)
offers eligible new users a **10% exchange-fee discount**, referrers **20% of direct
referrals' fees** and **10% of second-tier fees**, within the first **$100 million
of volume per referred user**. Rewards are distributed weekly in USDC. Creating
a code requires **$10,000 lifetime trading volume** in Phoenix; codes have limited
uses. Relationships are permanent and self-referrals are prohibited. These terms
can change. Refer to Phoenix for current eligibility, balances and claims.

The referral discount is not presented as a discount on this app's builder fee.
The review shows venue base rates plus the additional builder rate; it does not
invent a personalized net fee or assert that a referral was accepted. Actual fee
adjustments and rewards require venue confirmation.

## Fork configuration

In ignored `.env.local`, configure only values you have obtained from Phoenix:

```dotenv
# Both blank: no additional app builder fee.
VITE_PHOENIX_BUILDER_AUTHORITY=
VITE_PHOENIX_BUILDER_FEE_BPS=
# Blank: no referral attribution. Configured code is included in new-account setup.
VITE_PHOENIX_REFERRAL_CODE=
```

Use the public **builder authority**, not the collector account, seed phrase or
private key. Set the rate to `0` for educational routing, or supply its exact
registered integer rate for paid routing: `1` basis point is **0.01%**, which is
$0.10 per $1,000 of taking notional. The application resolves the collector from
Flight's on-chain builder record. Both settings are needed. Incomplete, inactive
or unregistered configurations still block preparation at zero. For any nonzero
fee, this starter also requires an exact registered-rate match. The chain's global
fee cap is checked each time; no cap is hardcoded into the app.

The public probe observed a 10-basis-point Flight cap at its recorded slot.
That observation is not a promise about future limits. The configured rate is
encoded as `feeBpsOverride` in the signed transaction. A later registry change
cannot silently change that signed rate; the program can reject it instead.

Resting maker fills and later native TP/SL trigger execution are not monetized by
this wrapper. A taking primary order with attached exits is routed normally.
Deposits, withdrawals, registration and cancellations have no builder wrapper.
The review's USDC fee estimate uses the order's price limit and assumes a full
taking fill; it is not an all-in or universal maximum (a sell may fill higher).
The whole transaction is simulated, including Flight, before wallet review.

## Getting the operator values

1. **Referral code:** in the Phoenix app, an eligible wallet with at least $10,000
   lifetime volume can open the referral page and create its code. Keep the code
   (or its Phoenix referral link); this app needs the code, not a private key.
   If the wallet is not eligible, leave referrals blank and ask Phoenix support
   about integration onboarding. Builder fees can be configured separately.
2. **Builder authority and rate:** use a fresh, dedicated wallet at
   [Phoenix Flight](https://flight.phoenix.trade), choose a fee in basis points and
   review/sign the builder registration there. Retain that wallet's public address
   and its registered rate. The portal also manages accrued fees and withdrawals.
3. Enter the authority and either `0` or its registered rate in the ignored local
   configuration above, then restart development or rebuild for hosting.
   Keep the public template blank. Before
   public use, complete the funded checks below with the actual registration/code.

## Referral flow

1. `VITE_PHOENIX_REFERRAL_CODE` is the only attribution source. A configured code
   is included automatically during new-account setup; blank means ordinary
   onboarding without a referral. URL parameters and previous session-storage
   drafts cannot override it. Malformed configuration blocks setup with feedback.
2. Before setup, the user sees the code, possible operator compensation and
   permanence notice. They still review and approve activation. There is no manual
   referral field or separate fees/referrals page. An already active account cannot
   change its relationship through this interface.
3. With a code configured, Privy signs the exact Phoenix authentication challenge
   for the selected wallet. Privy email login alone is insufficient. The app checks
   the challenge expiry, wallet continuity and Ed25519 signature. Phoenix access
   and refresh tokens use SDK **memory-only storage**, scoped to that wallet and
   cleared on wallet change/logout. No session tokens are placed in a share URL.
4. The app verifies the venue's referral-onboarding permission account, constructs
   registration/activation locally, simulates it and shows the code in review.
   The user signs this separate transaction. The authenticated
   `/v1/referral/activate-tx` endpoint validates the code, co-signs and submits.
   See [Phoenix authentication](https://docs.phoenix.trade/sdk/auth) and
   [registration](https://docs.phoenix.trade/sdk/register).
5. Rejection never falls back to ordinary activation. An ambiguous response keeps
   the original transaction signature in recovery. A confirmed chain receipt
   alone does not prove referral attribution or a discount: verify those in Phoenix.

Share the app's normal hosted URL: no referral parameter is needed. The desktop
phone QR includes only the public route and selected market. Code creation,
personal referral statistics, reward claims and a referrer dashboard remain in
Phoenix; this starter does not implement or simulate those services. Builder fees
remain disclosed in the order review even though there is no separate fee page.

## Verification and acceptance

Local tests cover blank/invalid builder config, active on-chain account decoding,
rate/cap/authority mismatches, exact wrapped order bytes, an explicit zero override
against a 10 bps registered default, and inactive-registration rejection at zero,
code validation, sanitized URLs, authentication signature checks and wallet
changes, exact activation payloads and no fallback after rejection. They use
synthetic accounts, ephemeral keys and mocked submission endpoints.

The [1 November read-only check](evidence/builder-zero-read-only-2026-11-01.json)
confirmed an active registration with a 10 bps default and a resolved app override
of 0 bps. Local tests separately decode the actual SDK instruction bytes and
assert an explicit zero. No trade was signed or submitted for this check; it is
not a new live fill or collector-balance reconciliation.

`npm run probe:trading` reads public mainnet data and checks real SDK transaction
shapes. It compares referral instruction bytes with the official activation
builder, verifies the public onboarding permission and Flight global account,
and compiles orders with a **synthetic, unregistered** builder. Expected unfunded
simulation failures are recorded; this does not prove a successful transaction.

Before enabling monetization in a hosted fork, use a registered builder and valid
referral code to verify a user-controlled round trip: Phoenix wallet authentication,
activation attribution and discount, taking and resting fills, exact builder
collector deltas, close/cancel, failure handling and withdrawal. Reconcile actual
fills and fees rather than treating a signed transaction as proof of earnings.
Referral rewards and claims need separate confirmation in Phoenix. Mobile wallet
signing and refresh/recovery also remain to be checked on physical devices.
