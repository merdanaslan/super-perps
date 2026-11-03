import { useMemo, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { useWalletSession } from '../../wallet/session';
import { useTrading } from '../../trading/state';
import { fromLots } from '../../trading/math';
import { positionView } from '../../trading/position-view';
import { openOrderViews } from '../../trading/order-view';
import { conditionalOrderViews } from '../../trading/conditional-order-view';
import { useMarkets } from '../market-data';
import { SelectionTabs } from './SelectionTabs';
import { OpenOrderCard } from './OpenOrderCard';
import { PositionCard } from './PositionCard';
import { ConditionalOrderCard } from './ConditionalOrderCard';

/** Account actions request a review; this view never signs or submits directly. */
export function TradingAccountPanel() {
  const { markets } = useMarkets();
  const wallet = useWalletSession();
  const trading = useTrading();
  const account = trading.account;
  const [accountTab, setAccountTab] = useState<'positions' | 'orders'>('positions');
  const positions =
    account?.subaccount?.positions.filter((p) => BigInt(p.basePositionLots) !== 0n) ?? [];
  const orders = useMemo(
    () => openOrderViews(account, wallet.selected),
    [account, wallet.selected],
  );
  const conditionals = useMemo(
    () => conditionalOrderViews(account, wallet.selected, false),
    [account, wallet.selected],
  );
  const orderCount = orders.length + conditionals.length;

  return (
    <section className="trading-account" aria-label="Trading account">
      <SelectionTabs
        className="account-tabs"
        label="Trading account views"
        value={accountTab}
        onChange={setAccountTab}
        options={[
          { value: 'positions', label: `Positions${account ? ` (${positions.length})` : ''}` },
          { value: 'orders', label: `Orders${account ? ` (${orderCount})` : ''}` },
        ]}
      />
      {trading.error ? (
        <div className="account-empty">
          <strong>Account unavailable</strong>
          <p>{trading.error}</p>
          <button className="text-button" onClick={() => void trading.refresh()}>
            Retry
          </button>
        </div>
      ) : !account ? (
        <div className="account-empty">
          <ListFilter size={24} />
          <strong>
            {wallet.authenticated
              ? wallet.selected
                ? 'Loading your account…'
                : wallet.error
                  ? 'Wallet unavailable'
                  : 'Loading your wallet…'
              : 'Your trades, in one place'}
          </strong>
          <p>
            {wallet.authenticated
              ? 'Balances, positions and open orders appear here.'
              : 'Sign up or log in to get started.'}
          </p>
          {!wallet.authenticated && (
            <button
              className="text-button"
              disabled={!wallet.ready || !wallet.configured}
              onClick={wallet.login}
            >
              Sign up / Log in
            </button>
          )}
        </div>
      ) : (
        <>
          {trading.stale && <p className="quiet-note account-sync">Refreshing account data…</p>}
          {accountTab === 'positions' &&
            positions.map((p) => {
              const view = positionView(account, p.symbol, wallet.selected, trading.stale);
              const long = BigInt(p.basePositionLots) > 0n;
              const lots = long ? BigInt(p.basePositionLots) : -BigInt(p.basePositionLots);
              const params = account.params.paramsBySymbol[p.symbol];
              return (
                <PositionCard
                  key={p.symbol}
                  symbol={p.symbol}
                  side={long ? 'Long' : 'Short'}
                  size={params ? fromLots(lots, params.baseLotDecimals) : '—'}
                  view={view}
                  disabled={trading.busy || trading.stale || !params}
                  onClose={() => {
                    const m = markets.find((m) => m.symbol === p.symbol);
                    if (!m) return;
                    void trading.review({
                      kind: 'order',
                      symbol: p.symbol,
                      side: long ? 'short' : 'long',
                      orderType: 'market',
                      baseUnits: fromLots(lots, m.baseLotsDecimals),
                      reduceOnly: true,
                    });
                  }}
                />
              );
            })}
          {accountTab === 'orders' &&
            orders.map((o) => (
              <OpenOrderCard
                key={o.id}
                order={o}
                disabled={trading.busy || trading.stale}
                onCancel={() =>
                  void trading.review({
                    kind: 'cancel',
                    symbol: o.symbol,
                    sequence: o.sequence,
                    priceTicks: o.priceTicks,
                  })
                }
              />
            ))}
          {accountTab === 'orders' &&
            conditionals.map((c) => (
              <ConditionalOrderCard
                key={c.id}
                order={c}
                disabled={trading.busy || trading.stale}
                onCancel={() =>
                  void trading.review({
                    kind: 'cancelConditional',
                    symbol: c.symbol,
                    index: c.index,
                    sequence: c.sequence,
                    leg: c.kind,
                  })
                }
              />
            ))}
          {(accountTab === 'positions' ? positions.length === 0 : orderCount === 0) && (
            <div className="account-empty">
              <ListFilter size={26} />
              <strong>{accountTab === 'positions' ? 'No open positions' : 'No open orders'}</strong>
              <p>
                {accountTab === 'orders'
                  ? 'Your limit and TP/SL orders appear here.'
                  : 'Your next move starts above.'}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
