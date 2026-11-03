# Contributing

super perps is an educational mobile web starter for Phoenix perpetuals. Keep the
first version small, understandable and usable on a phone. Read the
[product scope](docs/product-scope.md) and [architecture guide](docs/architecture.md) first.

## Local setup

Use Node 24 (`nvm use` if you use nvm), then `npm ci`, copy `.env.example` to
`.env.local`, and run `npm run dev`. Public market browsing works without
credentials. For the desktop development preview, open
`http://127.0.0.1:5173/?preview=mobile`.

For wallet features, configure your own public Privy App ID and private server
RPC settings; follow [configuration](docs/configuration.md) and
[wallet setup](docs/wallet-setup.md). The same relay runs locally and on Vercel.
All `VITE_*` values are public. Never commit credentials, local provider
configuration, wallet exports or authenticated diagnostic captures. Keep
diagnostic output in ignored `output/`.

## Code conventions

- Keep screen composition in `app/`, venue construction in `trading/`, and wallet
  signing in `wallet/`. Read the [extension map](docs/architecture.md#where-to-make-a-change)
  before adding another path.
- Share action/account types through `trading/types.ts`. Use decimal strings at
  the form boundary and exact lot/tick conversions for execution.
- Prefer named components and small, focused modules. Extract real responsibilities;
  avoid generic wrappers that only hide straightforward code.
- Explain why a financial or asynchronous constraint exists in a short comment.
  Do not narrate obvious code or leave unexplained magic amounts.
- Keep tests beside their modules as `*.test.ts` / `*.test.tsx`. Cover user-visible
  behavior and failure boundaries; avoid tests that only mirror implementation.
  Copy and styling changes usually need a visual check, not a new test asserting
  markup or CSS. Keep regression tests for financial calculations, signing,
  recovery and interactions such as keyboard handling.
- Update the relevant guide and changelog when behavior or configuration changes.
  Label sample screenshots and maintainers' reports accurately.

## Before a pull request

```sh
npm run format
npm run check
npm run build
```

If dependencies change, regenerate `npm run licenses`, inspect the generated
inventory/notices, run `npm run audit:release`, and explain remaining findings.
Do not use forced upgrades or remove safeguards just to make a check pass.
CI builds both credential-free and configured-provider variants. Its provider ID
is a nonfunctional placeholder; compilation does not test login or signing.

For UI changes, check 320px and 390px widths, keyboard access, reduced motion,
sheet dismissal and small-height screens. A browser viewport check is separate
from physical iOS/Android acceptance. Include a screenshot or short recording.

For transaction changes, test exact decimal/lot conversion, long and short
directions, simulation refusal, review expiry, wallet changes and pending receipt
recovery. Keep explicit review before signing, exact-message verification,
origin-wide locking and persistence before broadcast. Never cache balances,
quotes, authentication or transaction responses in the service worker.

Automated tests use mocks and ephemeral keys. `probe` and `probe:trading` perform
public reads and unsigned construction/simulation only. Never fund probe addresses.
Live mainnet tests require a deliberately funded test wallet and explicit approval
from its owner; they are not part of CI.

Describe the user-visible problem, the resulting behavior and exactly what was
verified. Label sample data, simulations and user-reported results honestly.
Retain third-party attribution and the educational/risk notices.

## Reporting bugs

Include app version, browser/device, reproduction steps and a redacted error.
Do not attach `.env` files, wallet secrets, OTPs or full authenticated network
captures. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.
