import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions: Partial<VitePWAOptions> = {
  strategies: 'injectManifest',
  srcDir: 'src/pwa',
  filename: 'sw.ts',
  injectRegister: false,
  registerType: 'prompt',
  devOptions: { enabled: false },
  manifest: {
    id: '/',
    name: 'super perps',
    short_name: 'super perps',
    description: 'Educational, open-source Phoenix perpetuals trading app.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/super-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/super-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/super-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  // Only build-time public files. Never runtime-cache account, RPC, Phoenix or
  // Privy responses. No automatic activation/reload during a transaction.
  injectManifest: {
    globPatterns: [
      'assets/*.{js,css,woff2}',
      'brand/*.{png,svg}',
      'markets/*.{svg,png}',
      'icons/*.{png,svg}',
      'offline.html',
    ],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  },
};
