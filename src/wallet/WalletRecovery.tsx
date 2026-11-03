import { RefreshCw, Wallet } from 'lucide-react';
import { Brand } from '../app/components/Brand';

/** A provider/render failure is not evidence that the user logged out. */
export function WalletRecovery() {
  return (
    <main className="phone-shell wallet-recovery">
      <Brand />
      <section role="alert" className="wallet-recovery-content">
        <span className="wallet-recovery-icon">
          <Wallet size={30} />
        </span>
        <h1>Wallet connection interrupted</h1>
        <p>
          The wallet screen couldn’t open. Reload to reconnect and check your transaction status.
        </p>
        <button className="primary-button full-width" onClick={() => window.location.reload()}>
          <RefreshCw size={18} /> Reload wallet
        </button>
        <p className="wallet-recovery-note">
          If you already approved a transaction, check its status after reloading before trying
          again.
        </p>
      </section>
    </main>
  );
}
