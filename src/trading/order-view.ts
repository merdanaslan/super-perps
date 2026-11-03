import type { MarketParams } from '@ellipsis-labs/rise';
import type { TraderSubaccount } from './types';
import { Exact, fromLots } from './math';

type OrderAccount = {
  authority: string;
  subaccount?: Pick<TraderSubaccount, 'orders'>;
  params: {
    paramsBySymbol: Record<
      string,
      Pick<MarketParams, 'tickSize' | 'baseLotDecimals' | 'markPriceTicks'>
    >;
  };
};

export interface OpenOrderView {
  id: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  price: number;
  markPrice?: number;
  remaining: string;
  filled: string;
  reduceOnly: boolean;
  sequence: string;
  priceTicks: string;
}

/** Display resting orders from the selected wallet, never an optimistic submission. */
export function openOrderViews(
  account: OrderAccount | undefined,
  selectedAuthority: string | undefined,
): OpenOrderView[] {
  if (!account || !selectedAuthority || account.authority !== selectedAuthority) return [];
  return (
    account.subaccount?.orders.flatMap(({ symbol, orders }) => {
      const params = account.params.paramsBySymbol[symbol];
      if (!params) return [];
      return orders.flatMap((order): OpenOrderView[] => {
        if (
          order.isConditionalOrder ||
          !['bid', 'ask'].includes(order.side) ||
          ['closed', 'cancelled', 'canceled', 'filled', 'expired'].includes(
            order.status.toLowerCase(),
          )
        )
          return [];
        try {
          const remaining = BigInt(order.sizeRemainingLots);
          const initial = BigInt(order.initialSizeLots);
          const ticks = BigInt(order.priceTicks);
          if (remaining <= 0n || initial < remaining || ticks <= 0n) return [];
          const tickUsd = new Exact(params.tickSize)
            .mul(new Exact(10).pow(params.baseLotDecimals))
            .div(1_000_000);
          const price = tickUsd.mul(String(ticks)).toNumber();
          const markPrice = tickUsd.mul(params.markPriceTicks).toNumber();
          if (!Number.isFinite(price) || price <= 0) return [];
          return [
            {
              id: `${symbol}:${order.orderSequenceNumber}`,
              symbol,
              side: order.side === 'bid' ? 'Buy' : 'Sell',
              price,
              markPrice: Number.isFinite(markPrice) && markPrice > 0 ? markPrice : undefined,
              remaining: fromLots(remaining, params.baseLotDecimals),
              filled: fromLots(initial - remaining, params.baseLotDecimals),
              reduceOnly: order.reduceOnly,
              sequence: order.orderSequenceNumber,
              priceTicks: order.priceTicks,
            },
          ];
        } catch {
          return [];
        }
      });
    }) ?? []
  );
}
