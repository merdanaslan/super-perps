import { ArrowDownToLine, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import { isSessionLoading, useWalletSession } from '../wallet/session';
import { WalletStatus } from '../wallet/WalletStatus';
import { useTrading } from '../trading/state';
import { fromLots } from '../trading/math';
import type { FundingTab } from './Funding';
import { usdc } from './format';
import { SessionSkeleton, Skeleton } from './components/SessionSkeleton';
import { EquityHistory } from './components/EquityHistory';
import { useEquityHistory } from './useEquityHistory';
import { useOnline } from '../pwa/connectivity';

export function Assets({ openFunding }: { openFunding: (tab: FundingTab) => void }) {
  const session = useWalletSession();
  const trading = useTrading();
  const account = trading.account;
  const online = useOnline();
  const trader =
    account?.registered && account.authority === session.selected
      ? account.traderAddress
      : undefined;
  const history = useEquityHistory(trader);
  const sessionLoading = isSessionLoading(session);
  const balanceLoading = session.authenticated && !account && !trading.error && !session.error;
  const display = (value?: string | bigint, decimals = 6) =>
    value !== undefined && !trading.stale ? usdc(Number(fromLots(value, decimals))) : '—';
  const equity = account?.registered
    ? account.margin?.margin.portfolioValueQuoteLots
    : account
      ? '0'
      : undefined;
  return (
    <div className="page-scroll assets-page">
      <header className="page-heading">
        <h1>Assets</h1>
        {session.authenticated && session.selected && (
          <button
            className="icon-button"
            aria-label="Refresh balances and equity history"
            title="Refresh balances and equity history"
            disabled={!online || history.refreshing}
            onClick={() => {
              history.refresh();
              void trading.refresh();
            }}
          >
            <RefreshCw
              size={19}
              className={history.refreshing ? 'spin' : undefined}
              aria-hidden="true"
            />
          </button>
        )}
      </header>
      {sessionLoading ? (
        <section className="asset-overview">
          <SessionSkeleton variant="assets" />
        </section>
      ) : !session.authenticated ? (
        <section className="assets-welcome session-resolved">
          <span className="profile-avatar">
            <Wallet size={32} />
          </span>
          <h2>
            Your wallet.
            <br />
            Your starting point.
          </h2>
          <p>
            {session.configured
              ? 'Sign up or log in to access your Solana wallet.'
              : 'Sign-in is unavailable in this installation. You can still explore the markets.'}
          </p>
          <button
            className="primary-button full-width"
            disabled={!session.ready || !session.configured}
            onClick={session.login}
          >
            Sign up / Log in
          </button>
        </section>
      ) : (
        <section className="asset-overview session-resolved">
          <div className="balance-label">Equity</div>
          <div className="asset-balance-row">
            <div
              className="asset-value"
              aria-busy={balanceLoading}
              aria-label={balanceLoading ? 'Loading equity' : undefined}
            >
              {balanceLoading ? <Skeleton className="skeleton-amount" /> : display(equity)}
              <small>USDC</small>
            </div>
            <EquityHistory
              history={history}
              currentEquity={
                trader && account && !trading.stale && equity !== undefined
                  ? { time: account.receivedAt, value: Number(fromLots(equity, 6)) }
                  : undefined
              }
              accountState={
                (!account && (trading.error || session.error)) || (account && trading.stale)
                  ? 'unavailable'
                  : balanceLoading
                    ? 'loading'
                    : undefined
              }
            />
          </div>
          <p className="equity-history-note">History includes deposits and withdrawals.</p>
          <WalletStatus />
          <div className="two-actions">
            <button
              className="primary-button"
              disabled={!session.selected}
              onClick={() => openFunding('deposit')}
            >
              <ArrowDownToLine size={17} />
              Deposit
            </button>
            <button
              className="secondary-button"
              disabled={!session.selected}
              onClick={() => openFunding('withdraw')}
            >
              <ArrowUpRight size={17} />
              Withdraw
            </button>
          </div>
        </section>
      )}
      <div className="section-heading">
        <h2>Overview</h2>
      </div>
      <dl className="detail-list assets-details">
        <div>
          <dt>
            Wallet<small>Available in your wallet</small>
          </dt>
          <dd>
            {display(account?.walletUsdc)} <span className="asset-unit">USDC</span>
          </dd>
        </div>
        <div>
          <dt>
            Phoenix equity<small>Collateral + unrealized PnL</small>
          </dt>
          <dd>
            {display(equity)} <span className="asset-unit">USDC</span>
          </dd>
        </div>
        <div>
          <dt>
            Free margin<small>Available for new positions</small>
          </dt>
          <dd>
            {display(account?.freeMargin)} <span className="asset-unit">USDC</span>
          </dd>
        </div>
        <div>
          <dt>Unrealized PnL</dt>
          <dd>
            {display(account?.margin?.margin.unrealizedPnlQuoteLots)}{' '}
            <span className="asset-unit">USDC</span>
          </dd>
        </div>
        <div>
          <dt>Withdrawable collateral</dt>
          <dd>
            {display(account?.margin?.margin.withdrawableQuoteCollateralQuoteLots)}{' '}
            <span className="asset-unit">USDC</span>
          </dd>
        </div>
        <div>
          <dt>SOL for network fees</dt>
          <dd>
            {account && !trading.stale
              ? Number(fromLots(account.walletSol, 9)).toLocaleString('en-US', {
                  maximumFractionDigits: 6,
                })
              : '—'}{' '}
            <span className="asset-unit">SOL</span>
          </dd>
        </div>
      </dl>
      {trading.error ? (
        <div className="info-panel">
          <strong>Balances unavailable</strong>
          <p>{trading.error}</p>
          <button className="text-button" onClick={() => void trading.refresh()}>
            Retry
          </button>
        </div>
      ) : account &&
        (!account.registered ||
          (account.subaccount?.capabilities ?? account.state?.snapshot.capabilities)?.state ===
            'uninitialized') ? (
        <div className="info-panel">
          <strong>Make room for your first trade</strong>
          <p>Set up your Phoenix account, then deposit USDC as collateral.</p>
          <button
            className="primary-button full-width"
            disabled={trading.busy || trading.stale}
            onClick={() => openFunding('deposit')}
          >
            Set up trading
          </button>
        </div>
      ) : null}
    </div>
  );
}
