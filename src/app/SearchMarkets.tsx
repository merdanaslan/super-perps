import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useMarkets } from './market-data';
import { MarketList, MarketRow } from './components/MarketList';
import { SelectionTabs } from './components/SelectionTabs';

export function SearchMarkets({
  close,
  onSelect,
}: {
  close: () => void;
  onSelect: (symbol: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'popular' | 'gainers' | 'volume'>('popular');
  const backButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    // Focus the page controls without opening the software keyboard or moving
    // the viewport until the user chooses to type.
    backButton.current?.focus({ preventScroll: true });
  }, []);
  const { markets, data } = useMarkets();
  const suggested = [...markets]
    .sort((a, b) => {
      if (sort === 'gainers')
        return (
          (data?.marketsBySymbol[b.symbol]?.priceChange24hPercent ?? 0) -
          (data?.marketsBySymbol[a.symbol]?.priceChange24hPercent ?? 0)
        );
      if (sort === 'volume')
        return (
          (data?.marketsBySymbol[b.symbol]?.dayVolumeUsd ?? 0) -
          (data?.marketsBySymbol[a.symbol]?.dayVolumeUsd ?? 0)
        );
      const order = ['BTC', 'ETH', 'SOL', 'GOLD', 'NVDA', 'TSLA'];
      return (
        (order.indexOf(a.symbol) < 0 ? 999 : order.indexOf(a.symbol)) -
        (order.indexOf(b.symbol) < 0 ? 999 : order.indexOf(b.symbol))
      );
    })
    .slice(0, 8);
  return (
    <section
      className="page-scroll search-page"
      aria-label="Search markets"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <header className="search-page-header">
        <button
          ref={backButton}
          className="icon-button profile-button"
          aria-label="Back from search"
          onClick={close}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search all markets"
            placeholder="Search markets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={17} />
            </button>
          )}
        </div>
      </header>
      {!query.trim() ? (
        <>
          <SelectionTabs
            className="market-category-tabs search-tabs"
            label="Market suggestions"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'popular', label: 'Discover' },
              { value: 'gainers', label: 'Top gainers' },
              { value: 'volume', label: 'By volume' },
            ]}
          />
          <section className="search-results-card" aria-label="Suggested markets">
            {suggested.map((market, index) => (
              <div className="ranked-market" key={market.symbol}>
                <span className="market-rank">{index + 1}</span>
                <MarketRow market={market} onSelect={onSelect} />
              </div>
            ))}
          </section>
          {!markets.length && <MarketList onSelect={onSelect} searchQuery="" />}
        </>
      ) : (
        <>
          <h1 className="search-results-title">Search results</h1>
          <MarketList onSelect={onSelect} searchQuery={query} />
        </>
      )}
    </section>
  );
}
