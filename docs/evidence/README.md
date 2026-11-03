# Public integration evidence

These dated JSON files are historical observations, not current executable quotes
or proof of an authenticated trade, deposit or payout.

- `public-probe-2026-10-26.json`: original public API/stream reads and unsigned
  synthetic-address instruction construction. Regenerate with `npm run probe`.
- `trading-probe-2026-10-27.json`: public mainnet RPC and 104-market risk reads,
  unsigned wire sizes and the expected refusal of an unfunded onboarding
  simulation. Regenerate with `npm run probe:trading`.
- `trading-probe-2026-10-28.json`: adds verified public Flight/referral permission
  accounts, synthetic-builder wire sizes, comparison with the official referral
  activation builder and unfunded simulation refusals. No authentication, builder
  registration, referral activation or collected fee is implied.
- `public-probe-2026-10-28-readiness.json` and
  `trading-probe-2026-10-28-readiness.json`: fresh 16:03 UTC checks during the trade
  readiness review; the same public/unsigned and unfunded-simulation boundaries apply.
- `trading-probe-2026-10-28-funding.json`: adds the official withdrawal instruction
  sequence plus an external USDC transfer, compiled to 981 bytes. Construction only;
  no funded withdrawal, recipient credit or sponsorship was verified.
- `public-probe-2026-10-29-preflight.json` and
  `trading-probe-2026-10-29-preflight.json`: fresh public/unsigned preflight checks.
  `trading-probe-2026-10-29-throttled.json` preserves the initial HTTP 429 during
  referral preparation; the separate retry passed. SDK teardown warnings remain
  in the accompanying [preflight review](../preflight-2026-10-29.md).
- `builder-read-only-2026-10-29.json`: the locally configured builder is active,
  with a matching registered 10-bps rate. No fee collection was exercised.
- `builder-zero-read-only-2026-11-01.json`: read-only validation of an explicit
  zero-bps app override against the active builder's registered 10-bps default.
  Addresses and credentials are omitted; no registry update or trade was submitted.
- `tpsl-simulation-2026-10-29.json` and `risk-exits-read-only-2026-10-29.json`:
  unsigned instruction and independent-exit simulations. Personal wallet balances
  and position values were removed during the 31 October privacy review; the
  reports retain the technical results and explicitly note those omissions.

New output goes to ignored `output/`. Probe addresses have no private key in this
project; never fund them. No probe signs or submits a financial transaction.
Retain corresponding verification/release failure notes alongside passing checks.
Do not add authenticated responses, provider tokens or personal wallet data here.
