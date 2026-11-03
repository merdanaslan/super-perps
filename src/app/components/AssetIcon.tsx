import { useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { useMarkets } from '../market-data';

// Stable local identities for the common crypto assets.
// Sources and original licenses are recorded in docs/brand-assets.md.
const localMarks: Readonly<Record<string, string>> = {
  BTC: '/markets/btc.svg',
  ETH: '/markets/eth.svg',
  SOL: '/markets/sol.svg',
};

export function AssetIcon({ symbol, venue = false }: { symbol: string; venue?: boolean }) {
  const { markets } = useMarkets();
  const uri = markets.find((market) => market.symbol === symbol)?.metadata?.logoUri;
  const remote = typeof uri === 'string' && uri.startsWith('https://') ? uri : undefined;
  const [failed, setFailed] = useState<string[]>([]);
  const src = [localMarks[symbol], remote].find(
    (candidate) => candidate && !failed.includes(candidate),
  );
  return (
    <span className={`asset-icon${venue ? ' asset-icon-with-venue' : ''}`} aria-hidden="true">
      {src ? (
        <img
          src={src}
          alt=""
          width="48"
          height="48"
          referrerPolicy="no-referrer"
          onError={() => setFailed((previous) => [...previous, src])}
        />
      ) : (
        <CircleDollarSign size={24} />
      )}
      {venue && (
        <span className="asset-venue">
          <img src="/brand/phoenix-mark-orange.svg" alt="" width="12" height="12" />
        </span>
      )}
    </span>
  );
}
