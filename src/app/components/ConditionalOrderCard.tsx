import type { ConditionalOrderLeg } from '../../trading/conditional-order-view';
import { price } from '../format';
import { TradeAccountCard } from './TradeAccountCard';

export function ConditionalOrderCard({
  order,
  disabled,
  onCancel,
}: {
  order: ConditionalOrderLeg;
  disabled: boolean;
  onCancel: () => void;
}) {
  const kind = order.kind;
  return (
    <TradeAccountCard
      symbol={order.symbol}
      label={`${order.symbol} ${kind} order`}
      tags={
        <>
          <span>{kind}</span>
          <span>Cross</span>
          <span>Reduce only</span>
        </>
      }
      action={{
        label: 'Cancel',
        accessibleLabel: `Cancel ${order.symbol} ${kind} #${order.sequence}`,
        disabled,
        onClick: onCancel,
      }}
    >
      <div>
        <dt>{kind === 'TP' ? 'Take profit' : 'Stop loss'} trigger</dt>
        <dd>
          {price(order.price)} <small>USD</small>
        </dd>
      </div>
    </TradeAccountCard>
  );
}
