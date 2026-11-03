let updateReady = false;
let started = false;
const listeners = new Set<() => void>();
export const hasPwaUpdate = () => updateReady;
export function subscribePwaUpdate(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function watchRegistration(registration: ServiceWorkerRegistration, active: () => boolean) {
  const notify = () => {
    if (!active() || !registration.waiting) return;
    updateReady = true;
    listeners.forEach((listener) => listener());
  };
  notify();
  let watched: ServiceWorker | null = null;
  const watchInstalling = () => {
    const installing = registration.installing;
    if (!installing || installing === watched) return;
    watched = installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') notify();
    });
  };
  watchInstalling();
  registration.addEventListener('updatefound', watchInstalling);
}

export async function registerPwa() {
  if (started || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  started = true;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    });
    watchRegistration(registration, () => !!navigator.serviceWorker.controller);
    // Check when returning to the app, without interrupting the current build.
    const check = () => {
      if (!document.hidden && navigator.onLine) void registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
  } catch {
    // Login/trading can still work online if the browser refuses offline storage.
    console.warn('Offline app storage is unavailable. The app can still be used online.');
  }
}
