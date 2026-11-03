import type { TradingAccount } from './types';

export interface ConditionalOrderView {
  id: string;
  symbol: string;
  kind: 'TP' | 'SL';
  price: number;
}

export interface ConditionalOrderLeg extends ConditionalOrderView {
  index: number;
  sequence: string;
}

/** The service supplies active trigger legs only. These levels are trigger prices,
 * not fill prices or a prediction that the exit will execute. */
export function conditionalOrderViews(
  account: Pick<TradingAccount, 'authority' | 'conditionals'> | undefined,
  selectedAuthority: string | undefined,
  stale: boolean,
): ConditionalOrderLeg[] {
  if (!account || !selectedAuthority || account.authority !== selectedAuthority || stale) return [];
  return account.conditionals.flatMap((order) =>
    (['TP', 'SL'] as const).flatMap((kind) => {
      const price = Number(kind === 'TP' ? order.takeProfit : order.stopLoss);
      if (!Number.isFinite(price) || price <= 0) return [];
      return [
        {
          id: `${order.symbol}:${order.index}:${order.sequence}:${kind}`,
          symbol: order.symbol,
          kind,
          price,
          index: order.index,
          sequence: order.sequence,
        },
      ];
    }),
  );
}
