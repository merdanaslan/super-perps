import type { ReactNode } from 'react';
import { getAccessToken, PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { config } from '../config';
import { registerRpcTokenGetter } from './rpc-session';
import { createWalletRpcClients } from './rpc-clients';

const connectors = toSolanaWalletConnectors({ shouldAutoConnect: false });
// Provide mainnet clients for Privy wallet operations. Transaction reviews and
// broadcasting are handled by the app; signing prompts are configured per call.
registerRpcTokenGetter(getAccessToken);
const mainnet = createWalletRpcClients(config.solanaRpcUrl, config.solanaWsUrl);

export function PrivyRoot({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={config.privyAppId}
      clientId={config.privyClientId}
      config={{
        solana: { rpcs: { 'solana:mainnet': mainnet } },
        // Login methods come from the fork owner's dashboard configuration.
        appearance: {
          walletChainType: 'solana-only',
          theme: '#000000',
          accentColor: '#ffffff',
          logo: `${window.location.origin}/brand/super-mark.png`,
        },
        embeddedWallets: {
          solana: { createOnLogin: 'all-users' },
          ethereum: { createOnLogin: 'off' },
        },
        externalWallets: { solana: { connectors }, walletConnect: { enabled: false } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
