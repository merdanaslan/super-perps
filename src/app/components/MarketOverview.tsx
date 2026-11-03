import { ArrowUpRight } from 'lucide-react';
import { useMarkets } from '../market-data';
import { percent, price } from '../format';
import { AssetIcon } from './AssetIcon';

export function MarketOverview({ onSelect }: { onSelect: (symbol: string) => void }) {
  const { data, error, retry } = useMarkets();
  return (
    <section className="market-overview" aria-label="Market overview">
      <div className="overview-label">
        <span>Market overview</span>
      </div>
      {error ? (
        <div className="overview-error">
          <p>Market data is unavailable.</p>
          <button className="text-button" onClick={retry}>
            Retry
          </button>
        </div>
      ) : (
        <div className="overview-grid">
          {['BTC', 'ETH', 'SOL'].map((symbol) => {
            const row = data?.marketsBySymbol[symbol];
            return (
              <button
                className="overview-market"
                key={symbol}
                onClick={() => onSelect(symbol)}
                aria-label={`View ${symbol} perpetual`}
              >
                <span className="overview-symbol">
                  <AssetIcon symbol={symbol} />
                  <strong>{symbol}</strong>
                  <span className="overview-perp">Perp</span>
                  <ArrowUpRight size={17} />
                </span>
                <span className="overview-price">{price(row?.markPrice)}</span>
                <span
                  className={`overview-change ${(row?.priceChange24hPercent ?? 0) < 0 ? 'negative' : 'positive'}`}
                >
                  {percent(row?.priceChange24hPercent)} <small>24h</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
