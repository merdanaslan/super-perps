# Historical release findings — 26–28 October 2026

This file preserves earlier implementation evidence. Audit counts, missing tests
and runtime observations are historical. Use the
[current findings](../release-findings.md) and
[release checklist](../release-checklist.md) for the current state.

## Earlier findings — 26–28 October

The sections below preserve dated implementation history. References to untested
funded flows and earlier audit totals apply to those checkpoints. Use the
[current release summary](../release-checklist.md) for present status.

This checkpoint includes a local mobile UI and mainnet transaction implementation.
Funded end-to-end acceptance and public-release review remain outstanding. These are findings from the actual dependency tree and build, not a security
audit of Phoenix, Privy or the complete future application.

## Dependency audit

`npm audit --json` reports **30 affected package entries: 21 high and 9 moderate**
after compatible overrides. The underlying remaining advisory families are:

- Zod versions below 4.6.6: [oversized-collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
  Rise's Zod 4 dependency is overridden to 4.6.7 and the SDK probe/tests pass.
  Privy and several transitive packages still use Zod 3. Replacing these with a
  different major version without vendor compatibility evidence is not a fix.
- `decode-uri-component`: [malformed-input denial of service](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- `uuid`: [missing output-buffer bounds checks](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

Older `ws` 8 versions are overridden within the same major to 8.22.0; the remaining
8.21.0 instances are outside the reported affected ranges. Overrides are pinned
and documented in `package.json`; do not remove them without rechecking advisories.
No `npm audit fix --force` downgrade/major replacement was applied.

An audit finding is not proof of exploitability in this app. Conversely, a disabled
UI path is not proof a dependency can never be reached. Before a provider-enabled
release, update the provider tree or document reviewed reachability/mitigation.
There is no clean-audit claim for this checkpoint.

## Provider distribution licenses

Original source code is MIT. The installed Privy tree also contains:

- `@reown/appkit` 1.8.9: `LICENSE.md`, Reown Community License.
- `@walletconnect/core` 2.22.4 (and other versions/packages): `LICENSE.md`,
  WalletConnect Community License.
- `@metamask/sdk` 0.33.1: `LICENSE`, ConsenSys terms with a defined noncommercial
  use scope and an MAU condition.

These texts were read from the installed packages. They include additional usage
and redistribution conditions; they are not ordinary MIT/Apache licenses. Reown's
[published license](https://github.com/reown-com/appkit/blob/main/LICENSE.md) and
[service terms](https://reown.com/terms-of-service) describe attribution,
infrastructure and commercial-use conditions. This inventory does not determine
how their conditions apply to every fork or a vendor's commercial arrangement.

Without `VITE_PRIVY_APP_ID`, Vite excludes the provider import and wallet bundles
from the build. With an app ID, the optional provider path is bundled; disabling
WalletConnect initialization alone does not remove all its code. Resolve the
distribution/notice requirements or choose a compatible provider integration
before publishing that build. Do not promise unrestricted commercial reuse of
third-party code based on the original project's MIT license.

## Build and runtime observations

- The initial lab default build had one JS bundle around 766 kB minified / 213 kB
  gzip. The new default UI build has four JS chunks; the shared Rise chunk still
  triggers a large-chunk warning. This is not a mobile performance pass.
- The initial provider build used a fake build-only App ID. The creator then
  supplied their development app's public ID; startup and creator-operated email
  login have separate evidence in `verification.md`. The configured build
  emits `node:worker_threads` externalization warnings from transitive `ox` Tempo
  helpers and a large-chunk warning. Recovery/signing still need verification;
  do not add fake browser polyfills
  merely to silence the warnings.
- In Node 24, Rise logged a WebSocket connection error after the probe closed its
  socket. An instrumented run observed `close()` during disposal, then an error
  and close code 1006. The source of the unclean close remains unresolved.
  Three updates and all functional probe checks had already succeeded. A clean
  browser run did not emit this error. Do not present this as proven graceful
  socket teardown or uninterrupted feed reliability.

The 27 October install (adding Motion and qrcode.react) still reported 30 audit
entries, with the same 21 high / 9 moderate split. Configured and default redesign
builds pass; the default has four JS chunks, with the largest around 539 kB
minified. The provider build still emits the existing worker/chunk warnings.
During browser navigation away from the development UI, one warning said a
`SOCKET_CLOSE` event was sent to a stopped actor (code 1006). Public book and candle
reads had worked. Default production signup/return checks did not report a warning
or error attributed to that origin. The navigation warning needs lifecycle review
before claiming clean stream disposal; no dependency internals were patched.

The subsequent transaction implementation refreshes metadata for each action, checks
source slots and reconciles submitted signatures. Runtime acceptance still needs
reconnect/outage, rate-limit and physical-device checks. A fresh local receipt time
alone does not prove a server snapshot is current enough to trade against.

## Transaction implementation checkpoint

On 27 October the product gained account reads, SDK margin sizing, onboarding,
funding and order builders, simulation, Privy signing and confirmation recovery.
The lab stays unsigned. Adding `@solana-program/compute-budget` 0.20.0 did not
resolve the previously reported provider dependency findings. No forced major
upgrades were applied.

The configured build passes with the existing worker externalization and large
chunk warnings. During development, editing the provider and consumers together
exposed a React fast-refresh context identity error. The shared context/hook now
lives separately in `src/trading/state.ts`; a clean load works. This was a local
hot-update failure, not a funded transaction result.

Financial safeguards are implemented and locally tested, but they are not an
independent security audit. The remaining acceptance work includes actual venue
activation, deposits, fills/cancellations, exit triggers, closure and withdrawals;
physical-device signing; RPC rate limits/outages; multiple-tab and reload scenarios
with a real pending transaction; and post-confirmation account reconciliation.
Public market/unsigned evidence does not establish these results.

## Final browser findings — 28 October

- **Resolved production startup failure:** configured code splitting introduced a
  circular initialization order between Phoenix's eager codecs and shared Solana
  modules. The browser failed with `d is not a function`; compilation had passed.
  `build.rolldownOptions.output.strictExecutionOrder` now preserves source order.
  Fresh configured and blank-provider production pages render. This documented
  bundler option adds runtime wrappers/size; it does not patch vendor internals.
- **Resolved local RPC refusal:** the shared public mainnet endpoint returned 403
  for direct browser requests. Vite development/preview now offers a same-origin
  proxy to that same endpoint, stripping Origin/Referer and adding no credentials.
  Read-only wallet balances and account-setup prerequisites render through it.
  Static hosting needs `VITE_SOLANA_RPC_URL` configured to a browser-enabled provider;
  the local proxy is not a hosted backend or a production rate-limit solution.
- **Verification:** 78 tests pass. Both production variants compile; the blank
  provider build renders public markets and explains disabled login. The configured
  build restores the prior Privy session. No funded action was signed or submitted.
