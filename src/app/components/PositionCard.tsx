import type { PositionView } from '../../trading/position-view';
import { useState } from 'react';
import { pnl, price } from '../format';
import { TradeAccountCard } from './TradeAccountCard';
import { Sheet } from './Sheet';

export function PositionCard({
  symbol,
  side,
  size,
  view,
  disabled,
  onClose,
}: {
  symbol: string;
  side: 'Long' | 'Short';
  size: string;
  view?: PositionView;
  disabled: boolean;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<'liquidation' | 'funding' | null>(null);
  return (
    <>
      <TradeAccountCard
        symbol={symbol}
        label={`${symbol} ${side.toLowerCase()} position`}
        tags={
          <>
            <span className={side === 'Long' ? 'positive' : 'negative'}>{side}</span>
            <span>Cross</span>
          </>
        }
        action={{
          label: 'Close position',
          accessibleLabel: `Close ${symbol} ${side.toLowerCase()} position`,
          disabled,
          onClick: onClose,
        }}
      >
        <div>
          <dt>Position size</dt>
          <dd>
            {size} <small>{symbol}</small>
          </dd>
        </div>
        <div>
          <dt>Entry price</dt>
          <dd>
            {price(view?.entryPrice)} <small>USD</small>
          </dd>
        </div>
        <div>
          <dt>Mark price</dt>
          <dd>
            {price(view?.markPrice)} <small>USD</small>
          </dd>
        </div>
        <div>
          <dt>
            <button className="metric-info" onClick={() => setInfo('liquidation')}>
              Est. liquidation price
            </button>
          </dt>
          <dd>
            {price(view?.liquidationPrice)} <small>USD</small>
          </dd>
        </div>
        <div>
          <dt>
            Unrealized P&L <small>Before fees and funding</small>
          </dt>
          <dd className={view?.pnlTone}>
            {pnl(view?.unrealizedPnl)}
            {view && <small> USDC</small>}
          </dd>
        </div>
        <div>
          <dt>
            <button className="metric-info" onClick={() => setInfo('funding')}>
              Unsettled funding
            </button>
          </dt>
          <dd>
            {pnl(view?.unsettledFunding)}
            {view?.unsettledFunding !== undefined && <small> USDC</small>}
          </dd>
        </div>
      </TradeAccountCard>
      <Sheet
        open={info === 'liquidation'}
        onClose={() => setInfo(null)}
        title="Estimated liquidation price"
      >
        <div className="info-panel">
          <p>
            Phoenix’s SDK estimates this level from your current cross-margin collateral, positions,
            funding and open orders.
          </p>
          <p>
            It assumes only this market’s mark price changes and resting orders do not fill.
            Collateral changes and other positions can move the level. It is not a guaranteed
            liquidation or execution price.
          </p>
          <p>A dash means no positive liquidation level is available from the current snapshot.</p>
        </div>
      </Sheet>
      <Sheet open={info === 'funding'} onClose={() => setInfo(null)} title="Unsettled funding">
        <div className="info-panel">
          <p>
            Funding accrued on this position that Phoenix has not settled yet. Positive amounts are
            a credit; negative amounts are a cost. It is separate from the price P&amp;L above.
          </p>
          <p>
            This is not lifetime funding paid. Once settled, it is reflected in your collateral
            balance.
          </p>
        </div>
      </Sheet>
    </>
  );
}
