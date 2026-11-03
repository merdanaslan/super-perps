import type { OpenOrderView } from '../../trading/order-view';
import { price } from '../format';
import { TradeAccountCard } from './TradeAccountCard';

export function OpenOrderCard({
  order,
  disabled,
  onCancel,
}: {
  order: OpenOrderView;
  disabled: boolean;
  onCancel: () => void;
}) {
  const tone = order.side === 'Buy' ? 'positive' : 'negative';
  return (
    <TradeAccountCard
      symbol={order.symbol}
      label={`${order.symbol} ${order.side.toLowerCase()} limit order`}
      tags={
        <>
          <span className={tone}>Limit · {order.side}</span>
          <span>Cross</span>
          {order.reduceOnly && <span>Reduce only</span>}
        </>
      }
      action={{
        label: 'Cancel',
        accessibleLabel: `Cancel ${order.symbol} order #${order.sequence}`,
        disabled,
        onClick: onCancel,
      }}
    >
      <div>
        <dt>Order price</dt>
        <dd>
          {price(order.price)} <small>USD</small>
        </dd>
      </div>
      <div>
        <dt>Remaining</dt>
        <dd>
          {order.remaining} <small>{order.symbol}</small>
        </dd>
      </div>
      {order.filled !== '0' && (
        <div>
          <dt>Filled</dt>
          <dd>
            {order.filled} <small>{order.symbol}</small>
          </dd>
        </div>
      )}
    </TradeAccountCard>
  );
}
