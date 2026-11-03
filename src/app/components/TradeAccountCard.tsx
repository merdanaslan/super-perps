import type { ReactNode } from 'react';
import { AssetIcon } from './AssetIcon';

export function TradeAccountCard({
  symbol,
  label,
  tags,
  children,
  action,
}: {
  symbol: string;
  label: string;
  tags: ReactNode;
  children: ReactNode;
  action: { label: string; accessibleLabel: string; disabled: boolean; onClick: () => void };
}) {
  return (
    <article className="trade-card" aria-label={label}>
      <header className="trade-card-heading">
        <AssetIcon symbol={symbol} />
        <strong>
          {symbol}
          <span> / USDC</span>
        </strong>
      </header>
      <div className="trade-card-tags">{tags}</div>
      <dl className="trade-card-details">{children}</dl>
      <footer className="trade-card-footer">
        <button
          className="secondary-button"
          disabled={action.disabled}
          onClick={action.onClick}
          aria-label={action.accessibleLabel}
        >
          {action.label}
        </button>
      </footer>
    </article>
  );
}
