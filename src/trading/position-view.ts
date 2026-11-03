import type { MarketMarginResult, MarketParams } from '@ellipsis-labs/rise';
import type { TraderSubaccount, TradingAccount } from './types';
import { Exact, fromLots } from './math';

// Accept the relevant fields of a TradingAccount without importing runtime services.
type PositionAccount = {
  authority: string;
  subaccount?: {
    positions: ReadonlyArray<
      Pick<TraderSubaccount['positions'][number], 'symbol' | 'basePositionLots' | 'entryPriceTicks'>
    >;
  };
  margin?: {
    marketMargins: ReadonlyArray<
      Pick<
        MarketMarginResult,
        'symbol' | 'basePositionLots' | 'entryPriceTicks' | 'unrealizedPnlQuoteLots'
      > &
        Partial<Pick<MarketMarginResult, 'unsettledFundingQuoteLots'>>
    >;
  };
  liquidationPrices?: TradingAccount['liquidationPrices'];
  params: {
    paramsBySymbol: Record<
      string,
      Pick<MarketParams, 'tickSize' | 'baseLotDecimals' | 'markPriceTicks'>
    >;
  };
};

export interface PositionView {
  symbol: string;
  side: 'Long' | 'Short';
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: string;
  pnlTone: 'positive' | 'negative' | 'neutral';
  liquidationPrice?: number;
  unsettledFunding?: string;
}

/** Read-only presentation of one fresh position. P&L comes from Phoenix margin math,
 * not chart candles, the account-wide total, or an estimate from a submitted order. */
export function positionView(
  account: PositionAccount | undefined,
  symbol: string,
  selectedAuthority: string | undefined,
  stale: boolean,
): PositionView | undefined {
  if (!account || !selectedAuthority || account.authority !== selectedAuthority || stale) return;
  const position = account.subaccount?.positions.find((p) => p.symbol === symbol);
  const margin = account.margin?.marketMargins.find((p) => p.symbol === symbol);
  const params = account.params.paramsBySymbol[symbol];
  if (!position || !margin || !params) return;
  try {
    const size = BigInt(position.basePositionLots);
    if (
      size === 0n ||
      size !== BigInt(margin.basePositionLots) ||
      BigInt(position.entryPriceTicks) !== BigInt(margin.entryPriceTicks)
    )
      return;
    const tickUsd = new Exact(params.tickSize)
      .mul(new Exact(10).pow(params.baseLotDecimals))
      .div(1_000_000);
    const entryPrice = tickUsd.mul(position.entryPriceTicks).toNumber();
    const markPrice = tickUsd.mul(params.markPriceTicks).toNumber();
    const pnlLots = BigInt(margin.unrealizedPnlQuoteLots);
    if (![entryPrice, markPrice].every((v) => Number.isFinite(v) && v > 0)) return;
    const liquidation = account.liquidationPrices?.find(
      (p) => p.symbol === symbol && p.basePositionLots === position.basePositionLots,
    )?.liquidationPriceUsd;
    return {
      symbol,
      side: size > 0n ? 'Long' : 'Short',
      entryPrice,
      markPrice,
      unrealizedPnl: fromLots(pnlLots, 6),
      pnlTone: pnlLots > 0n ? 'positive' : pnlLots < 0n ? 'negative' : 'neutral',
      liquidationPrice:
        liquidation != null && Number.isFinite(liquidation) && liquidation > 0
          ? liquidation
          : undefined,
      unsettledFunding:
        margin.unsettledFundingQuoteLots !== undefined
          ? fromLots(margin.unsettledFundingQuoteLots, 6)
          : undefined,
    };
  } catch {
    // Never turn incomplete/mismatched account data into a chart position.
    return;
  }
}
