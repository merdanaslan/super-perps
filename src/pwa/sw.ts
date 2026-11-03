/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { isAppNavigation } from './navigation';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [] });

self.addEventListener('fetch', (event) => {
  if (!isAppNavigation(event.request, self.location.origin)) return;
  event.respondWith(
    fetch(event.request).catch(
      async () => (await matchPrecache('/offline.html')) ?? Response.error(),
    ),
  );
});

// Deliberately no skipWaiting/clientsClaim: an update activates after all old
// app windows close. It must never reload a signing or pending-transaction tab.
