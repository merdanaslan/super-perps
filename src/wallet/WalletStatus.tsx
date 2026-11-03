import { useWalletSession } from './session';

/** Wallet discovery is automatic. A provider failure must not become a wallet picker. */
export function WalletStatus() {
  const session = useWalletSession();
  if (!session.authenticated || session.selected) return null;
  return session.error ? (
    <div className="info-panel" role="alert">
      <p>{session.error}</p>
      <button className="text-button" onClick={() => window.location.reload()}>
        Reload wallet
      </button>
    </div>
  ) : (
    <p className="quiet-note" role="status">
      Loading your wallet…
    </p>
  );
}
