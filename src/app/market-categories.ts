import type { Market } from './market-data';

export const marketCategories = [
  'All',
  'Crypto',
  'Stocks',
  'Commodities',
  'Indices',
  'Pre-IPO',
] as const;
export type MarketCategory = (typeof marketCategories)[number];
// Phoenix metadata does not yet supply a complete asset-class field. Explicit
// overrides cover its non-crypto underlyings; unknown listings remain in All.
const stocks = new Set(
  'NVDA AAPL TSLA GOOGL MU AMD INTC CRWV MSFT META AMZN COIN CRCL HOOD MSTR SKHY TSM ASML QCOM ARM CBRS AMAT NBIS PLTR BABA AVGO CRWD MRVL IREN NET NFLX MRNA LLY DELL ORCL OPEN IBM KLAC SNDK TXN SPCX'.split(
    ' ',
  ),
);
const commodities = new Set(['WTIOIL', 'GOLD', 'SILVER', 'COPPER']);
const indices = new Set(['SPY', 'QQQ', 'TLT']);
export function marketCategory(market: Pick<Market, 'symbol' | 'metadata'>): MarketCategory {
  if (market.metadata?.classifications?.includes('pre-ipo')) return 'Pre-IPO';
  if (stocks.has(market.symbol)) return 'Stocks';
  if (commodities.has(market.symbol)) return 'Commodities';
  if (indices.has(market.symbol)) return 'Indices';
  if (
    market.metadata?.coinGeckoId ||
    ['kBONK', 'kSHIB', 'kPEPE'].includes(market.symbol) ||
    market.metadata?.classifications?.some((c) => ['solana', 'l1', 'defi', 'meme'].includes(c))
  )
    return 'Crypto';
  return 'All';
}
