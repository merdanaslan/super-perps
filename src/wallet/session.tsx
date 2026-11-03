import { Component, createContext, lazy, Suspense, useContext, type ReactNode } from 'react';
import { WalletRecovery } from './WalletRecovery';

export interface WalletSession {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  selected?: string;
  error?: string;
  login: () => void;
  logout: () => Promise<void>;
  signTransaction?: (bytes: Uint8Array, expectedAuthority: string) => Promise<Uint8Array>;
  signMessage?: (message: Uint8Array, expectedAuthority: string) => Promise<Uint8Array>;
}
const emptySession: WalletSession = {
  configured: false,
  ready: true,
  authenticated: false,
  login: () => {},
  logout: async () => {},
};
export const WalletSessionContext = createContext<WalletSession>(emptySession);
export const useWalletSession = () => useContext(WalletSessionContext);
/** Unknown authentication is not logged out; wallet failure must end the placeholder. */
export const isSessionLoading = (session: WalletSession) =>
  !session.error && (!session.ready || (session.authenticated && !session.selected));
const Bridge = import.meta.env.VITE_PRIVY_APP_ID
  ? lazy(() => import('./PrivySessionBridge'))
  : null;

export class WalletBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <WalletRecovery /> : this.props.children;
  }
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  if (!Bridge)
    return (
      <WalletSessionContext.Provider value={emptySession}>{children}</WalletSessionContext.Provider>
    );
  return (
    <WalletBoundary>
      <Suspense
        fallback={
          <WalletSessionContext.Provider
            value={{ ...emptySession, configured: true, ready: false }}
          >
            {children}
          </WalletSessionContext.Provider>
        }
      >
        <Bridge>{children}</Bridge>
      </Suspense>
    </WalletBoundary>
  );
}
