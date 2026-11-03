import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignTransaction, useSignMessage } from '@privy-io/react-auth/solana';
import { PrivyRoot } from './PrivyRoot';
import { WalletSessionContext } from './session';
import { resolveAppWallet } from './app-wallet';
import { clearRpcSession, isRelayUrl } from './rpc-session';
import { config } from '../config';

function Session({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [walletTimedOut, setWalletTimedOut] = useState(false);
  const { signTransaction } = useSignTransaction();
  const { signMessage } = useSignMessage();
  const appWallet = resolveAppWallet({
    ready,
    authenticated: authenticated && !loggingOut,
    walletsReady,
    user,
    wallets,
  });
  const selected = appWallet?.address;
  const identity = {
    authenticated: authenticated && !loggingOut,
    selected,
    userId: user?.id,
    appWallet,
  };
  const live = useRef(identity);
  live.current = identity;
  const [error, setError] = useState('');
  useEffect(() => {
    setWalletTimedOut(false);
    if (!authenticated || selected) return;
    const timer = setTimeout(() => setWalletTimedOut(true), 15_000);
    return () => clearTimeout(timer);
  }, [authenticated, selected, user?.id]);
  return (
    <WalletSessionContext.Provider
      value={{
        configured: true,
        ready: ready && (!authenticated || walletsReady),
        authenticated,
        selected,
        login: () => login({ loginMethods: ['email'] }),
        error:
          error ||
          (authenticated && !selected && walletTimedOut
            ? 'Your app wallet could not connect. Reload or log in again to reconnect it.'
            : undefined),
        signMessage: async (message, expectedAuthority) => {
          const current = live.current;
          if (!current.authenticated || current.selected !== expectedAuthority)
            throw new Error('Wallet changed. Verify your wallet again.');
          const wallet = current.appWallet;
          if (!wallet) throw new Error('Selected wallet is no longer connected.');
          const result = await signMessage({
            message,
            wallet,
            options: {
              uiOptions: {
                showWalletUIs: true,
                title: 'Verify your Phoenix wallet',
                description:
                  'Sign in to Phoenix to use your referral. Account activation is reviewed separately.',
              },
            },
          });
          if (
            !live.current.authenticated ||
            live.current.selected !== expectedAuthority ||
            live.current.userId !== current.userId
          )
            throw new Error('Wallet changed while authenticating.');
          return result.signature;
        },
        signTransaction: async (transaction, expectedAuthority) => {
          const current = live.current;
          if (!current.authenticated || current.selected !== expectedAuthority)
            throw new Error('Wallet changed. Review the action again.');
          const wallet = current.appWallet;
          if (!wallet) throw new Error('Selected wallet is no longer connected.');
          const stillCurrent = () =>
            live.current.authenticated &&
            live.current.selected === expectedAuthority &&
            live.current.userId === current.userId;
          // TradingProvider invokes this only after the user confirms its simulated
          // review. Privy's supported per-call option avoids a second approval modal.
          // Message authentication and other wallet operations keep their own prompts.
          const result = await signTransaction({
            transaction,
            wallet,
            chain: 'solana:mainnet',
            options: { uiOptions: { showWalletUIs: false } },
          });
          if (!stillCurrent()) throw new Error('Wallet changed while signing. Nothing was sent.');
          return result.signedTransaction;
        },
        logout: async () => {
          live.current = {
            ...live.current,
            authenticated: false,
            selected: undefined,
            appWallet: undefined,
          };
          setLoggingOut(true);
          setError('');
          try {
            await logout();
            if (isRelayUrl(config.solanaRpcUrl) || isRelayUrl(config.solanaWsUrl))
              await clearRpcSession();
          } catch {
            setError('Logout did not complete. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      }}
    >
      {children}
    </WalletSessionContext.Provider>
  );
}

export default function PrivySessionBridge({ children }: { children: ReactNode }) {
  return (
    <PrivyRoot>
      <Session>{children}</Session>
    </PrivyRoot>
  );
}
