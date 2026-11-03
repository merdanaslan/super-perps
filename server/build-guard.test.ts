import { expect, it } from 'vitest';
import { assertNoPrivateRpc } from './build-guard.ts';
const env = { SOLANA_RPC_URL: 'https://rpc.example.test/?api-key=EXAMPLE_CREDENTIAL_ONLY' };
it.each([env.SOLANA_RPC_URL, 'EXAMPLE_CREDENTIAL_ONLY', encodeURIComponent(env.SOLANA_RPC_URL)])(
  'rejects a private URL or key in browser output',
  (value) => {
    expect(() => assertNoPrivateRpc(value, env)).toThrow(
      'Private RPC configuration reached browser output.',
    );
  },
);
it('allows public app IDs and same-origin relay paths', () => {
  expect(() => assertNoPrivateRpc('public-privy-id /api/solana', env)).not.toThrow();
});

it.each([
  'https://rpc.example.test/v2/EXAMPLE_PATH_CREDENTIAL',
  'https://EXAMPLE%2FPRIVATE_USER:EXAMPLE%2FPRIVATE_PASSWORD@rpc.example.test/',
])('rejects decoded path and user-info credentials, not only query keys', (url) => {
  const values = url.includes('/v2/')
    ? ['EXAMPLE_PATH_CREDENTIAL']
    : ['EXAMPLE/PRIVATE_USER', 'EXAMPLE/PRIVATE_PASSWORD'];
  for (const value of values)
    expect(() => assertNoPrivateRpc(value, { SOLANA_RPC_URL: url })).toThrow(
      'Private RPC configuration reached browser output.',
    );
});
