import { useState, useSyncExternalStore } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnline } from './connectivity';
import { hasPwaUpdate, subscribePwaUpdate } from './register';

export function PwaStatus() {
  const online = useOnline();
  const updateReady = useSyncExternalStore(subscribePwaUpdate, hasPwaUpdate);
  const [dismissed, setDismissed] = useState(false);
  if (!online)
    return (
      <div className="pwa-notice" role="status">
        <WifiOff size={18} aria-hidden="true" />
        <p>You’re offline. Prices and balances may be out of date. Reconnect to trade.</p>
      </div>
    );
  if (!updateReady || dismissed) return null;
  return (
    <div className="pwa-notice" role="status">
      <p>Update ready. When finished, close all super perps windows and reopen the app.</p>
      <button aria-label="Dismiss update notice" onClick={() => setDismissed(true)}>
        <X size={18} />
      </button>
    </div>
  );
}
