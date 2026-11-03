import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('uses same-origin HTTP and WebSocket relay URLs by default', async () => {
  vi.stubGlobal('location', { origin: 'https://app.example.test', hostname: 'app.example.test' });
  vi.stubEnv('VITE_SOLANA_RPC_URL', '');
  vi.stubEnv('VITE_SOLANA_WS_URL', '');
  const { config } = await import('./config');
  expect(config.solanaRpcUrl).toBe('https://app.example.test/api/solana');
  expect(config.solanaWsUrl).toBe('wss://app.example.test/api/solana');
});
it('resolves relative relay overrides without embedding a provider URL', async () => {
  vi.stubGlobal('location', { origin: 'https://app.example.test', hostname: 'app.example.test' });
  vi.stubEnv('VITE_SOLANA_RPC_URL', '/api/solana');
  vi.stubEnv('VITE_SOLANA_WS_URL', '');
  const { config } = await import('./config');
  expect(config.solanaRpcUrl).toBe('https://app.example.test/api/solana');
  expect(config.solanaWsUrl).toBe('wss://app.example.test/api/solana');
});
