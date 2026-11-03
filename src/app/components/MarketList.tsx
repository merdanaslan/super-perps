import { useMemo, useState } from 'react';
import { Search, Triangle, X } from 'lucide-react';
import { useMarkets, type Market } from '../market-data';
import { compactUsd, percent, price } from '../format';
import { crossMarketSupported } from '../../phoenix/presentation';
import { marketCategory, marketCategories, type MarketCategory } from '../market-categories';
import { SelectionTabs } from './SelectionTabs';
import { AssetIcon } from './AssetIcon';

export function MarketRow({
  market,
  onSelect,
  discovery = false,
}: {
  discovery?: boolean;
  market: Market;
  onSelect: (symbol: string) => void;
}) {
  const { data } = useMarkets();
  const row = data?.marketsBySymbol[market.symbol];
  const supported = crossMarketSupported(market);
  const maxLeverage = Math.max(...market.leverageTiers.map((tier) => tier.maxLeverage));
  const change = row?.priceChange24hPercent;
  const direction =
    change == null || !Number.isFinite(change) || change === 0
      ? 'neutral'
      : change < 0
        ? 'negative'
        : 'positive';
  return (
    <button
      className={`market-row${discovery ? ' market-row-discovery' : ''}`}
      onClick={() => onSelect(market.symbol)}
      aria-label={`View ${market.symbol} perpetual`}
    >
      <AssetIcon symbol={market.symbol} venue={discovery} />
      <span className="market-name">
        <span className="market-symbol-line">
          <strong>{market.symbol}</strong>
          {discovery && supported && Number.isFinite(maxLeverage) && maxLeverage > 0 && (
            <span className="market-leverage" title={`Maximum leverage: ${maxLeverage}×`}>
              {maxLeverage}×
            </span>
          )}
        </span>
        <small>
          {supported
            ? discovery
              ? `${compactUsd(row?.dayVolumeUsd)} Vol`
              : 'Perpetual'
            : market.isolatedOnly
              ? 'Isolated only'
              : 'Market inactive'}
        </small>
      </span>
      {discovery ? (
        <span className="market-stats">
          <span className="market-price">
            {row?.markPrice == null || !Number.isFinite(row.markPrice)
              ? '—'
              : `$${price(row.markPrice)}`}
          </span>
          <span className={`market-change ${direction}`}>
            {direction !== 'neutral' && (
              <Triangle size={8} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            )}
            <span>
              {change == null || !Number.isFinite(change) ? '—' : `${Math.abs(change).toFixed(2)}%`}
            </span>
          </span>
        </span>
      ) : (
        <>
          <span className="market-price">{price(row?.markPrice)}</span>
          <span className={`change-chip ${direction}`}>{percent(change)}</span>
        </>
      )}
    </button>
  );
}

export function MarketList({
  onSelect,
  compact = false,
  browse = false,
  searchQuery,
}: {
  onSelect: (symbol: string) => void;
  compact?: boolean;
  browse?: boolean;
  searchQuery?: string;
}) {
  const { markets, error, retry, data } = useMarkets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MarketCategory>('All');
  const effectiveQuery = searchQuery ?? query;
  const sorted = useMemo(() => {
    const priority = ['BTC', 'ETH', 'SOL'];
    return [...markets].sort((a, b) => {
      const ai = priority.indexOf(a.symbol),
        bi = priority.indexOf(b.symbol);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a.symbol.localeCompare(b.symbol);
    });
  }, [markets]);
  const visible = compact
    ? sorted.slice(0, 3)
    : sorted.filter(
        (market) =>
          `${market.symbol} ${market.metadata?.name ?? ''}`
            .toLowerCase()
            .includes(effectiveQuery.trim().toLowerCase()) &&
          (category === 'All' || marketCategory(market) === category),
      );
  return (
    <div className={`market-list${browse ? ' market-discovery' : ''}`}>
      {!compact && searchQuery === undefined && (
        <div className="search-field">
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search markets"
            placeholder="Search markets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          {query && (
            <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>
      )}
      {browse && (
        <>
          <SelectionTabs
            className="market-category-tabs"
            variant="pill"
            label="Asset categories"
            value={category}
            onChange={setCategory}
            options={marketCategories.map((value) => ({ value, label: value }))}
          />
          <div className="market-list-legend">
            <span>Price / 24h</span>
          </div>
        </>
      )}
      {!browse && (
        <div className="market-columns">
          <span>Market</span>
          <span>Mark price</span>
          <span>24h change</span>
        </div>
      )}
      {error ? (
        <div className="empty-state">
          <p>Markets are unavailable.</p>
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : markets.length === 0 ? (
        <div aria-label="Loading markets" className="market-skeletons">
          {[0, 1, 2, 3].map((n) => (
            <div className="skeleton" key={n} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Search size={28} />
          <p>
            {effectiveQuery
              ? `No markets match “${effectiveQuery}”.`
              : 'No markets in this category yet.'}
          </p>
          {searchQuery === undefined && (
            <button
              className="text-button"
              onClick={() => {
                setQuery('');
                setCategory('All');
              }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        visible.map((market) => (
          <MarketRow key={market.symbol} market={market} onSelect={onSelect} discovery={browse} />
        ))
      )}
      {markets.length > 0 && data?.status.health !== 'live' && (
        <p className="quiet-note">Prices are reconnecting. Displayed values may be out of date.</p>
      )}
    </div>
  );
}
