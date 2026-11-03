import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa.config.ts';
import { rpcRelayPlugin } from './server/vite.ts';
import { securityHeaders } from './server/security-headers.ts';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    rpcRelayPlugin({ ...loadEnv(mode, process.cwd(), ''), ...process.env }),
    VitePWA(pwaOptions),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Phoenix creates codecs during module initialization. Preserve their
        // dependency order across chunks shared with the lazy Privy bundle.
        strictExecutionOrder: true,
      },
    },
  },
  server: {
    headers: securityHeaders,
    port: 5173,
    strictPort: true,
  },
  preview: { port: 4173, strictPort: true, headers: securityHeaders },
}));
