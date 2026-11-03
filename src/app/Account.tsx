import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Copy,
  ExternalLink,
  LogOut,
  Wallet,
  X,
  Moon,
  Coins,
  Layers,
  Code2,
} from 'lucide-react';
import { isSessionLoading, useWalletSession } from '../wallet/session';
import { config } from '../config';
import { WalletStatus } from '../wallet/WalletStatus';
import { Brand } from './components/Brand';
import { Sheet } from './components/Sheet';
import { SessionSkeleton } from './components/SessionSkeleton';

export function Account({ close }: { close: () => void }) {
  const session = useWalletSession();
  const sessionLoading = isSessionLoading(session);
  const [about, setAbout] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const repo = /^https:\/\/(github\.com|gitlab\.com)\//.test(config.repositoryUrl)
    ? config.repositoryUrl
    : undefined;
  async function copy() {
    if (!session.selected) return;
    try {
      await navigator.clipboard.writeText(session.selected);
      setMessage('Wallet address copied.');
    } catch {
      setMessage('Select the address below to copy it manually.');
    }
  }
  return (
    <div className="page-scroll account-page">
      <header className="account-header">
        <button className="icon-button" aria-label="Close account" onClick={close}>
          <X size={25} />
        </button>
        <Brand />
      </header>
      {sessionLoading ? (
        <SessionSkeleton variant="account" />
      ) : session.authenticated ? (
        <div className="session-resolved">
          <div className="account-title">
            <span className="profile-avatar">
              <Wallet size={30} />
            </span>
            <h1>Your account</h1>
            <p>Connected with Privy</p>
          </div>
          <section className="account-panel wallet-panel">
            <h2>Your Solana wallet</h2>
            <WalletStatus />
            {session.selected && (
              <>
                <p className="wallet-address">{session.selected}</p>
                <div className="two-actions">
                  <button className="secondary-button" onClick={() => void copy()}>
                    <Copy size={16} />
                    Copy
                  </button>
                  <a
                    className="secondary-button"
                    href={`https://explorer.solana.com/address/${session.selected}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explorer
                    <ExternalLink size={15} />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <section className="account-welcome session-resolved">
          <h1>
            Welcome to
            <br />
            super perps.
          </h1>
          <p>Your markets. Your wallet. Your move.</p>
          <div className="two-actions">
            <button
              className="secondary-button"
              disabled={!session.configured || !session.ready}
              onClick={session.login}
            >
              Log in
            </button>
            <button
              className="primary-button"
              disabled={!session.configured || !session.ready}
              onClick={session.login}
            >
              Sign up
              <ArrowRight size={17} />
            </button>
          </div>
          {!session.configured && (
            <p className="quiet-note">
              Wallet login is not configured for this installation. You can still explore every
              market.
            </p>
          )}
        </section>
      )}
      {session.error && (!session.authenticated || session.selected) && (
        <p className="inline-error" role="alert">
          {session.error}
        </p>
      )}
      <section className="account-panel account-menu account-settings" aria-label="Settings">
        <div className="setting-line">
          <Moon size={21} />
          <span>Appearance</span>
          <small>Dark</small>
        </div>
        <div className="setting-line">
          <Coins size={21} />
          <span>Display currency</span>
          <small>USDC</small>
        </div>
        <div className="setting-line">
          <Layers size={21} />
          <span>Margin mode</span>
          <small>Cross</small>
        </div>
        <a href="https://www.phoenix.trade/" target="_blank" rel="noopener noreferrer">
          <img src="/brand/phoenix-mark-orange.svg" width="21" height="21" alt="" />
          <span>Powered by Phoenix</span>
          <ExternalLink size={19} />
        </a>
        <button onClick={() => setAbout(true)}>
          <BookOpen size={21} />
          <span>About this project</span>
          <ChevronRight size={19} />
        </button>
      </section>
      {!sessionLoading && session.authenticated && (
        <button
          className="logout-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void session.logout().finally(() => setBusy(false));
          }}
        >
          <LogOut size={18} />
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      )}
      <p className="quiet-note account-feedback" role="status">
        {message}
      </p>
      <p className="account-disclaimer">
        Educational & experimental. Unaudited software, provided “as is” without warranty. Trading
        can lose real funds. Use at your own risk.
      </p>
      <Sheet
        open={about}
        onClose={() => setAbout(false)}
        title="About super perps"
        description="A small screen. An open starting point."
      >
        <Brand />
        <p className="about-description">
          An independent, open-source Phoenix perpetuals app from the Superteam Germany community.
          Built for learning, experimenting and making it your own.
        </p>
        {repo ? (
          <a className="secondary-button full-width" href={repo} target="_blank" rel="noreferrer">
            <Code2 size={18} />
            View repository
            <ExternalLink size={15} />
          </a>
        ) : (
          <div className="repository-placeholder">
            <Code2 size={19} />
            <span>Repository link coming soon</span>
          </div>
        )}
        <p className="quiet-note">
          MIT-licensed application code. Wallet infrastructure by Privy. Market data and execution
          through Phoenix.
        </p>
        <p className="quiet-note">
          Charts by{' '}
          <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
            TradingView Lightweight Charts™
          </a>
          .{' '}
          <a href="/third-party-notices.txt" target="_blank" rel="noreferrer">
            Third-party licenses
          </a>
          .
        </p>
        <p className="quiet-note">
          Educational software is not investment advice. Leveraged trading can lose all deposited
          collateral. No warranty or guarantee of availability.
        </p>
      </Sheet>
    </div>
  );
}
