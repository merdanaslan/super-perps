import { expect, it } from 'vitest';
import { readRelayConfig } from './config.ts';
it('loads only server provider URLs and derives the private WebSocket endpoint', () => {
  const result = readRelayConfig({
    SOLANA_RPC_URL: 'https://rpc.example.test/?api-key=EXAMPLE',
    VITE_PRIVY_APP_ID: 'public-app',
    RPC_ALLOWED_ORIGINS: 'https://app.example.test',
  });
  expect(result).toMatchObject({
    rpcUrl: 'https://rpc.example.test/?api-key=EXAMPLE',
    wsUrl: 'wss://rpc.example.test/?api-key=EXAMPLE',
    appId: 'public-app',
    origins: ['https://app.example.test'],
  });
});
it('does not reinterpret a public browser URL as a server credential', () => {
  expect(
    readRelayConfig({
      VITE_SOLANA_RPC_URL: 'https://browser.example.test',
      VITE_PRIVY_APP_ID: 'public-app',
    }).rpcUrl,
  ).toBe('');
});
it('uses the exact Vercel deployment origin when no custom origin is provided', () => {
  expect(readRelayConfig({ VERCEL: '1', VERCEL_URL: 'preview.example.test' }).origins).toEqual([
    'https://preview.example.test',
  ]);
});
it.each([
  { SOLANA_RPC_URL: 'http://untrusted.test' },
  { SOLANA_RPC_URL: 'file:///etc/passwd' },
  { SOLANA_WS_URL: 'https://rpc.example.test' },
  { RPC_ALLOWED_ORIGINS: 'https://*.example.test' },
  { RPC_ALLOWED_ORIGINS: 'https://app.example.test/path' },
])('rejects invalid transport or origin configuration without printing its value: %j', (env) => {
  expect(() => readRelayConfig(env)).toThrow('Invalid server RPC configuration.');
});
