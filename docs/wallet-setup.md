# Privy and RPC settings for a fork

Use your own Privy app. `.env.example` leaves personal identifiers blank;
`.env.local`, build outputs and local diagnostic captures are gitignored.

| Setting                | Required value                                                             |
| ---------------------- | -------------------------------------------------------------------------- |
| `VITE_PRIVY_APP_ID`    | Your public App ID                                                         |
| `VITE_PRIVY_CLIENT_ID` | Optional public client ID                                                  |
| `SOLANA_RPC_URL`       | Private server HTTPS mainnet RPC                                           |
| `SOLANA_WS_URL`        | Optional private WSS endpoint; otherwise derived from the private HTTP URL |
| `RPC_ALLOWED_ORIGINS`  | Exact app origins allowed to use the relay                                 |
| `VITE_PHOENIX_API_URL` | Default Phoenix perpetuals API                                             |
| `VITE_REPOSITORY_URL`  | Optional GitHub/GitLab URL; blank preserves the About placeholder          |

`VITE_*` values ship to browsers. Never include an app secret, private key, seed,
OAuth secret or bearer token. This client does not use a Privy app secret.
Restart Vite after environment changes; rebuild for `npm run preview`.

## Privy dashboard settings

- If a domain allowlist is configured, allow exact origins: `http://127.0.0.1:5173` for dev and
  `http://127.0.0.1:4173` for preview. `localhost` is a different origin.
  Add the intended hosted HTTPS origin before release. An empty Privy domain list
  does not require adding each temporary test URL. Verify login at the URL;
  see [phone testing](pwa-testing.md). These rules restrict provider use, not access
  to the website itself.
- Enable **email login**. Every product signup/login action requests Privy's email
  flow directly. Legacy `/signup` and `/login` links return to the app and open Privy.
- Enable Solana embedded wallets. `PrivyRoot.tsx` uses `createOnLogin: 'all-users'`
  so an existing external wallet does not prevent creation of the app wallet.
  Existing embedded wallets are reused; Ethereum auto-creation is off.
  The app resolves the authenticated user's primary embedded Solana wallet
  (HD index 0, or one unambiguous legacy wallet). It does not select external or
  secondary wallets. Account provides the address, Copy and Explorer only.
- Configure your app's display name/branding, recovery options and usage settings.
  The UI supplies the super mark and dark appearance; dashboard app names can still
  appear in provider accessibility labels or messages.

Official references: [allowed origins](https://docs.privy.io/recipes/dashboard/allowed-domains),
[React setup](https://docs.privy.io/basics/react/setup),
[login methods](https://docs.privy.io/basics/get-started/dashboard/configure-login-methods),
[wallet creation](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation),
[Solana signing](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction).

## RPC requirements

The mainnet genesis hash is checked before preparing transactions. Devnet RPC
cannot be substituted for Phoenix mainnet. The private provider must support
balance/account reads, blockhash/slot queries, simulation, fee estimation,
submission and signature-history polling. The default client uses an authenticated
same-origin relay, shared by Vite dev/preview and the Vercel functions. Keep
`VITE_SOLANA_RPC_URL` and `VITE_SOLANA_WS_URL` blank; put credentials in server
settings. See [relay setup and limits](rpc-relay.md).

Privy's `config.solana.rpcs['solana:mainnet']` receives Kit HTTP and WebSocket
clients. Before requests/connections, the existing Privy login establishes a short
HttpOnly relay cookie; no additional wallet approval is involved. Set private
`SOLANA_WS_URL` if your provider has a separate subscription endpoint. Explicit
public `VITE_SOLANA_*` alternatives are available for static forks, with visible
provider URLs. See [Privy's Solana network configuration](https://docs.privy.io/basics/react/advanced/configuring-solana-networks).
The app's simulated review and **Confirm & sign** button are the transaction
approval. `PrivySessionBridge` passes `uiOptions.showWalletUIs: false` for that
transaction-signing call, using Privy's
[documented option](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction)
to avoid a second approval and signed-receipt modal. This is scoped to transaction
calls; message-authentication prompts stay enabled. It does not add delegation,
automatic signing on login, or a trading session without per-action reviews.
A wallet-render failure displays an explicit
recovery screen, preserves the pending transaction journal, and offers reload;
it must never be presented as a successful logout or an inert login button.

## User-controlled acceptance sequence

The sequence below is the chosen MVP funding flow. Users supply USDC and SOL;
[fee sponsorship and automatic swaps](funding-abstraction.md) are deferred.

1. Log in and verify that the app wallet loads automatically. Confirm address
   continuity in Account after reload and recovery. Other connected wallets must
   never replace the current user's primary app wallet. Slow discovery shows a
   loading state; connection failure offers reload rather than a wallet picker.
2. In Assets → Deposit → Receive, verify the Solana wallet address. Send USDC for
   collateral and SOL for fees/account rent to that same app-wallet address, using
   Solana for both transfers. Only USDC is deposited as collateral by this app;
   SOL stays in the wallet. Wallet USDC and Phoenix collateral are separate.
3. Enter the deposit amount and review account setup if needed. The server's activation instructions are checked against
   the SDK and on-chain onboarding permission. Simulation must pass before signing;
   the review displays the network fee and rent. Venue eligibility still applies.
   Setup only activates the trading account; it does not deposit wallet USDC.
   The progress view advances to a fresh deposit review when setup confirms.
4. Deposit a deliberately small test amount. Check the confirmed Explorer receipt
   and actual Phoenix collateral before placing an order.
5. Exercise limit placement/cancellation, a small market position, TP/SL management
   and reduce-only closing. Verify resulting orders/positions, not only a signature.
6. After venue cooldown/margin rules allow it, enter a regular Solana destination
   wallet (or choose **Use my app wallet**), review the full address and USDC amount,
   and withdraw. Verify both the Phoenix collateral decrease and the exact USDC
   credit at that destination. External withdrawals combine the Phoenix withdrawal
   and onward token transfer in one transaction. Test a destination with and without
   an existing USDC token account. Memo-required exchange destinations are unsupported.
   A failed/ambiguous action must resolve before retrying.

The maintainer has reported a successful funded baseline, including withdrawal;
the evidence and remaining cases are in [release readiness](release-checklist.md).
This release-preparation pass did not submit a financial transaction. Never fund
a diagnostic probe address.

Repeat cancellation, rejection, reload, user changes and interrupted-network
cases on physical iPhone/Android browsers. Desktop viewport emulation does not
prove device behavior. The production PWA shell is now implemented; follow the
[installed-phone test checklist](pwa-testing.md).
