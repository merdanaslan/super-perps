import { PHOENIX_API_URL } from './phoenix/client';

const configuredRpc: string | undefined = import.meta.env.VITE_SOLANA_RPC_URL?.trim();
const configuredWs: string | undefined = import.meta.env.VITE_SOLANA_WS_URL?.trim();
const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
const rpcUrl = new URL(configuredRpc || '/api/solana', origin).href;

// Vite embeds these values in browser JavaScript, including RPC URLs. Moving a
// value to the hosting dashboard does not make it secret; use only public config.
export const config = {
  phoenixApiUrl: import.meta.env.VITE_PHOENIX_API_URL?.trim() || PHOENIX_API_URL,
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID?.trim() || '',
  privyClientId: import.meta.env.VITE_PRIVY_CLIENT_ID?.trim() || undefined,
  solanaRpcUrl: rpcUrl,
  solanaWsUrl: configuredWs
    ? new URL(configuredWs, origin).href.replace(/^http/, 'ws')
    : rpcUrl.replace(/^http/, 'ws'),
  repositoryUrl: import.meta.env.VITE_REPOSITORY_URL?.trim() || '',
  // Public Flight settings, validated in trading/monetization.ts. Both blank disables
  // routing; a registered authority plus "0" keeps routing without an app builder fee.
  builderAuthority: import.meta.env.VITE_PHOENIX_BUILDER_AUTHORITY?.trim() || '',
  builderFeeBps: import.meta.env.VITE_PHOENIX_BUILDER_FEE_BPS?.trim() || '',
  referralCode: import.meta.env.VITE_PHOENIX_REFERRAL_CODE?.trim() || '',
};
