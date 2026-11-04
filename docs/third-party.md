# Third-party notes

Original project code is MIT. Dependencies retain their own terms; the lockfile
records the versions used. The generated [production inventory](dependency-licenses.json)
and [full available license/notice texts](../public/dependency-notices.txt) cover
the installed runtime tree, including optional wallet providers. Run
`npm run licenses` after `npm ci` when changing dependencies; CI checks for drift.
Metadata without a license text is explicitly visible in that inventory. These
files do not replace review of custom terms for a particular use.

Current direct runtime dependencies:

| Package                                                        | Declared license | Purpose                                                                |
| -------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `@ellipsis-labs/rise` 0.6.2                                    | MIT              | Official Phoenix perpetuals client and instruction builders            |
| `@solana/kit` 8.5.0                                            | MIT              | Solana types, addresses and codecs                                     |
| `@solana-program/compute-budget` 0.20.0                        | Apache-2.0       | Simulated compute-unit and priority-fee instructions                   |
| `@solana-program/memo` 0.16.0, `system` 0.16.0, `token` 0.18.0 | Apache-2.0       | Required peers for Privy's Solana browser modules                      |
| `@privy-io/react-auth` 3.51.0                                  | Apache-2.0       | Optional wallet onboarding SDK; hosted service terms are separate      |
| `decimal.js` 10.6.0                                            | MIT              | Exact decimal validation and slippage arithmetic                       |
| `react`, `react-dom` 19.3.1                                    | MIT              | Browser application                                                    |
| `@vercel/analytics` 2.0.1                                      | MIT              | Optional basic page views on Vercel; hosted service terms are separate |
| `lightweight-charts` 5.2.1                                     | Apache-2.0       | Candlesticks; Phoenix supplies the OHLC data                           |
| `@base-ui/react` 1.9.0                                         | MIT              | Accessible dialog primitives for mobile sheets                         |
| `lucide-react` 1.61.0                                          | ISC              | Interface icons                                                        |
| `motion` 14.7.1                                                | MIT              | Reduced-motion-aware hero entrance and tab selection indicators        |
| `qrcode.react` 4.2.0                                           | ISC              | QR handoff on hosted HTTPS origins                                     |
| `jose` 6.2.15                                                  | MIT              | Server-only Privy JWT verification against public JWKS                 |
| `ws` 8.22.1                                                    | MIT              | Server-only authenticated WebSocket relay                              |

Magic UI’s MIT-licensed Blur Fade is adapted in `src/app/components/BlurFade.tsx`;
its full notice is retained in `public/third-party-notices.txt`. Original super perps
artwork and actual asset-logo handling are described in [asset provenance](brand-assets.md).
Market and provider logos retain their owners’ rights. Three local market
marks ship with the app; the BTC/ETH variants use cryptocurrency-icons
under CC0 1.0, whose full text is retained beside the SVGs. SOL uses venue artwork;
QQQ, SPY and TLT use Phoenix's ticker placeholders from exchange metadata. See asset provenance
for each source and the scope of the third-party rights. The Home footer also
includes Phoenix's official orange mark, copied unchanged from its website and
linked in the asset-provenance document; Phoenix retains rights to that mark.
No CEX illustration,
brand mark, promotion or screenshot pixels have been copied into the application. The
UI shortlist informed the choices above. TradingView's creator notice is retained
in `public/third-party-notices.txt` and Account; its attribution link is visible on
the chart. Keep these in forks. Inspect transitive dependency licenses and
retain necessary distribution notices before a public release. This early-phase
inventory is not a completed release compliance audit.

The installed provider tree contains **custom-licensed transitive dependencies**:
Reown/WalletConnect community licenses and the MetaMask SDK license. Do not describe
all installed dependencies as MIT/Apache or assume the project's MIT license
relicenses them. See [release findings](release-findings.md) for the inspected
files and the remaining provider-enabled distribution review. `@privy-io/api-base`
omits package metadata for its license but includes an Apache-2.0 `LICENSE` file.
The generated inventory also identifies missing license metadata, missing root
license texts and MPL dependencies; review their obligations for the actual
distribution. No entire third-party packages are vendored; the small Blur Fade
adaptation is explicitly attributed.

Sources: [Rise package](https://github.com/Ellipsis-Labs/rise-public/blob/master/ts/package.json),
[Solana Kit](https://github.com/anza-xyz/kit),
[Privy SDK](https://www.npmjs.com/package/@privy-io/react-auth),
[React license](https://github.com/facebook/react/blob/main/LICENSE).

UI sources: [Lightweight Charts license](https://github.com/tradingview/lightweight-charts/blob/v5.2.1/LICENSE),
[upstream NOTICE](https://github.com/tradingview/lightweight-charts/blob/v5.2.1/NOTICE),
[Base UI](https://github.com/mui/base-ui), [Lucide license](https://lucide.dev/license).
