# Open release findings — updated 3 November 2026

## Current release candidate

Rechecked on **3 November** with a fresh install and inspection of the browser
build and server imports. The audit still reports **28 affected entries (24 high,
4 low)** in the same three advisory families below. Installed Privy 3.51.0,
its API package 1.12.0 and vite-plugin-pwa 2.0.0 still match their stable releases.
No compatible upstream update clears these findings. No forced downgrade,
incompatible override or audit suppression was applied.

The lockfile had a separate compatibility defect: three older `abitype` consumers
resolved Zod 4 despite declaring an optional Zod 3 peer. The corrected lockfile
resolves their existing Zod 3.25.76 and keeps patched Zod 4.6.7 under the consumers
that require version 4. Only six package locations changed; **no package versions,
direct dependencies or overrides changed**. A fresh `npm ci` followed by
`npm ls --all` now passes. CI also checks the dependency tree to catch recurrence.

The 1 November dependency remediation removed the uuid, glob and minimatch
advisory families. The updated lockfile reports **28 affected package entries:
24 high and 4 low; no moderate or critical entries**, down from 40 entries before
the changes. Remaining advisory families are Zod, decode-uri-component and
deepmerge. These totals include parent packages affected through dependencies;
they are not counts of independent vulnerabilities. Changes in the propagated
severity totals do not mean a new advisory family was introduced.

A clean audit is not claimed. `npm run audit:release` and the CI dependency job
still fail on high/critical findings, including the known ones; none are silently
allowlisted.

The [2 November security review](security-review-2026-11-02.md) records three
resolved application issues, clean-install checks, source/bundle credential
scans and the remaining hosting gates. No GitHub publication or Vercel
deployment has been performed. Successful phone testing does not clear these
dependency findings.

## Verified dependency overrides

The direct Phoenix, Privy and PWA versions are unchanged. `package.json` keeps
the existing Zod 4 and ws overrides and adds the following exact versions:

| Override                              | Reason and compatibility boundary                                                                                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid@>=8.3.2 <11.1.1` → `11.1.1`     | Fixes [partial buffer writes](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Version 11 retains both CommonJS and ESM entry points. Installed wallet consumers use `v4` / `validate`; these are exercised through each consumer's actual resolved package. |
| `workbox-build@7.4.1` → `glob@14.0.3` | Fixes [cancellation handling](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Workbox uses the retained CommonJS `globSync` API; the real manifest generator is checked against the app's cache patterns. Build tooling only.                               |
| `minimatch` → `11.0.3`                | Fixes [pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249). Both glob and filelist resolve this version. Filelist's CommonJS `match` API, include/exclude behavior and brace patterns are covered. Build tooling only.                    |

These upgrades cross some transitive parents' declared ranges. Their API usage
was inspected before adding overrides; Node 24 remains required. The regression
test in `scripts/dependency-compat.test.ts` first reproduced the UUID buffer bug,
then passed with the patch. It also checks wallet ID generation and the real
PWA file-selection paths. This is compatibility evidence, not proof of every
third-party SDK feature or a new funded trading test.

On an upstream upgrade, try removing the corresponding override, then run
`npm ci`, `npm ls uuid glob minimatch`, the tests, both production build variants,
license regeneration/checks and the audit. Do not leave an invalid dependency
tree or remove an override until the resolved tree contains patched versions.

## Remaining findings

At the 3 November registry check, installed Privy 3.51.0 and vite-plugin-pwa 2.0.0
matched their stable releases. The existing compatible Zod 4 and ws overrides
remain. The provider tree also needs Zod 3, and npm's suggested Privy downgrade
to 3.6.1 is not a reviewed solution.
The patched [decode-uri-component 0.5.1](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)
is ESM, while the installed query-string 7 path requires the older CommonJS
function export. A blanket version override can break that consumer, so it was
not added solely to clear the audit. The inspected older WalletConnect utility
bundles use `URLSearchParams` and retain query-string in their dependency metadata;
that observation does not remove the vulnerable installed dependency or clear
the audit. A compatible upstream update remains preferable to replacing the
provider stack or maintaining local forks solely to change the audit total.

The [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) lists a fix
in Zod 4.6.6. Privy's current API package still declares Zod 3.25.76. A blanket
Zod 3 → 4 override is not a compatible patch and was not applied.

The low-severity [deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
has no published fix at this check. Its path is the PWA build toolchain
(`workbox-build` → `@rollup/plugin-node-resolve`), not runtime application code.
Build configuration should be trusted; the audit gate still reports this finding.

### Exposure in this app — 3 November

The assessment traced the installed consumers and captured Vite's emitted module
graph for both the public build and a build with a placeholder Privy App ID. These
builds use the app's React, relay build guard and PWA configuration. They do not
exercise authenticated provider responses or establish hosted exploit resistance.

| Finding              | Observed use                                                                                                                                                                                                                     | Assessment for this configuration                                                                                                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zod                  | Phoenix uses patched 4.6.7. The configured browser build includes 3.25.76 through `@privy-io/api-base`; that package defines an `APIError` object with string/enum fields.                                                       | No use of the advisory's collection-validation path was found in that consumer. A bounded local check passed 10,000-element arrays in each invalid field and received three type errors, rather than per-element issues. Zod 3 remains installed and bundled; this is not a claim that it is patched. |
| decode-uri-component | The older WalletConnect dependency tree installs 0.2.2 through query-string 7.1.3. Neither decoder nor query-string modules appear in either emitted browser build. WalletConnect is disabled in this app's Privy configuration. | No current browser execution path was identified. The server relay does not import it. A local check confirmed that patched 0.5.1 returns an ESM namespace to `require()`, while query-string expects a callable function; a blanket override is incompatible.                                        |
| deepmerge            | Installed only in PWA build tooling. The inspected node-resolve package uses it to clone its fixed defaults, before merging options with object spread.                                                                          | No browser or server execution path was found. The identified call does not merge visitor-supplied objects. The upstream advisory remains open with no patched release.                                                                                                                               |

The server entry points import the local relay plus `jose`, `ws` and Node built-ins;
none of these three affected packages is on that runtime import path. This is a
source/import review, not a test of an actual Vercel deployment. Reassess after
changing SDK versions, wallet connectors, schema consumers or build configuration.

**Release recommendation:** the findings do not establish an exploitable path in
the reviewed app configuration. Publishing the educational source and testing a
hosted preview are reasonable with these findings disclosed. A public deployment
that signs real transactions still needs an explicit maintainer decision on the
remaining upstream risk; this assessment does not silently accept it or turn the
audit gate green. Keep the warnings visible and prefer compatible upstream fixes
over maintaining local vendor forks solely to reduce the audit count.

Verification: fresh install, valid dependency tree, **478 tests across 46 files**,
type/format/repository checks, license verification and both production browser
build variants pass. All 311 configured browser JavaScript files are byte-identical
before and after the lockfile correction. No new tests, runtime features or provider settings were
added for this assessment. Raw build graphs and checks are kept in ignored local
output; the public report contains no provider credentials.

Validation results are recorded in [release readiness](release-checklist.md),
along with maintainer-reported funded testing. Core functionality working does
not resolve the remaining dependency advisories, custom distribution terms or
untested devices.

`docs/dependency-licenses.json` inventories installed production package versions;
`public/dependency-notices.txt` retains their available root license/notice texts.
Regenerate with `npm run licenses` after `npm ci`. Missing texts and custom terms
remain identified for review; this is attribution preparation, not a legal opinion
that every monetized fork satisfies every vendor's conditions.

## Performance follow-up

The 2 November configured production build has **329 precached static entries,
about 7.9 MiB uncompressed**; the public-only build has **25 entries, about 2.8 MiB**.
The optional provider tree and PNG hero artwork contribute to that footprint.
Large chunks, provider worker-externalization and a PWA plugin deprecation warning
remain visible. Builds pass; these are not measured phone performance results.

Before a wider rollout, profile a cold mobile load and consider limiting
`pwa.config.ts` precaching to the offline page and essential assets rather than
all lazy provider chunks. Keep runtime account/RPC caching disabled and preserve
the no-forced-reload rule during signing. Recheck installation, offline fallback,
returning tabs and provider loading after any cache-policy change.

## Historical evidence

Earlier resolved issues, audit totals and implementation checkpoints are retained
in [the 26–28 October findings](history/release-findings-2026-10-28.md) and
[the 30–31 October preparation log](history/release-preparation-2026-10.md).
They are not fresh verification of the current app.
