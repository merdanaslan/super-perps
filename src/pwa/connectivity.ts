import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false);
}

export function requireOnline() {
  if (navigator.onLine === false)
    throw new Error('You’re offline. Reconnect before reviewing or signing a transaction.');
}
