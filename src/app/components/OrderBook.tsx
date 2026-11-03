import { RefreshCw } from 'lucide-react';
import type { DisplayBook } from '../market-data';
import { price, quantity } from '../format';

/** Shares the ticket's stream so displayed depth and the sizing reference cannot diverge. */
export function OrderBook({
  symbol,
  book,
  stale,
  error,
  retry,
  fundingLabel,
  onFunding,
}: {
  symbol: string;
  book: DisplayBook | undefined;
  stale: boolean;
  error: string;
  retry: () => void;
  fundingLabel: string | undefined;
  onFunding: () => void;
}) {
  const mid = book?.bids[0] && book.asks[0] ? (book.bids[0][0] + book.asks[0][0]) / 2 : undefined;
  const asks = book?.asks.slice(0, 7).reverse() ?? [];
  const bids = book?.bids.slice(0, 7) ?? [];
  const maxDepth = Math.max(1e-10, ...asks.map((l) => l[1]), ...bids.map((l) => l[1]));
  function levelRows(levels: Array<[number, number]>, direction: 'ask' | 'bid') {
    return Array.from({ length: 7 }, (_, i) => (
      <div key={`${direction}-${i}`} className={`book-row ${direction}`}>
        <span
          className="depth-bar"
          style={{ width: `${levels[i] ? Math.max(2, (levels[i]![1] / maxDepth) * 100) : 0}%` }}
        />
        <span>{price(levels[i]?.[0])}</span>
        <span>{quantity(levels[i]?.[1])}</span>
      </div>
    ));
  }
  return (
    <section className={`order-book ${stale ? 'book-stale' : ''}`} aria-label="Order book">
      <div className="book-heading">
        <span>Order book</span>
        <button className="book-funding" aria-label="Hourly funding rate" onClick={onFunding}>
          <span>Funding / 1h</span>
          <strong>{fundingLabel ?? '—'}</strong>
        </button>
      </div>
      <div className="book-columns">
        <span>
          Price
          <br />
          <small>USD</small>
        </span>
        <span>
          Size
          <br />
          <small>{symbol}</small>
        </span>
      </div>
      {levelRows(asks, 'ask')}
      <div className="book-mid">
        <strong>{price(mid)}</strong>
        <small>Mid price</small>
      </div>
      {levelRows(bids, 'bid')}
      {(stale || error) && (
        <div className="book-health">
          <button onClick={retry}>
            <RefreshCw size={12} />
            Reconnect
          </button>
        </div>
      )}
    </section>
  );
}
