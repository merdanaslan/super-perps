// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  provider: vi.fn(),
  rpc: { getLatestBlockhash: vi.fn() },
  subscriptions: { signatureNotifications: vi.fn() },
  createRpc: vi.fn(),
  createSubscriptions: vi.fn(),
}));
vi.mock('../config', () => ({
  config: {
    privyAppId: 'test-app',
    solanaRpcUrl: 'https://rpc.example.test/?key=public-test-key',
    solanaWsUrl: 'wss://rpc.example.test/?key=public-test-key',
  },
}));
vi.mock('@solana/kit', () => ({
  createSolanaRpc: mocks.createRpc.mockReturnValue(mocks.rpc),
  createSolanaRpcSubscriptions: mocks.createSubscriptions.mockReturnValue(mocks.subscriptions),
}));
vi.mock('@privy-io/react-auth', () => ({
  getAccessToken: async () => null,
  PrivyProvider: ({ children, ...props }: { children: ReactNode }) => {
    mocks.provider(props);
    return children;
  },
}));
vi.mock('@privy-io/react-auth/solana', () => ({
  toSolanaWalletConnectors: () => [],
}));

it('supplies the mainnet RPC clients required by Privy before its signing screen renders', async () => {
  const { PrivyRoot } = await import('./PrivyRoot');
  renderToStaticMarkup(<PrivyRoot>App</PrivyRoot>);
  const providerConfig = mocks.provider.mock.calls.at(-1)?.[0].config;
  expect(providerConfig.solana?.rpcs?.['solana:mainnet']).toEqual({
    rpc: mocks.rpc,
    rpcSubscriptions: mocks.subscriptions,
  });
  expect(mocks.createRpc).toHaveBeenCalledWith('https://rpc.example.test/?key=public-test-key');
  expect(mocks.createSubscriptions).toHaveBeenCalledWith(
    'wss://rpc.example.test/?key=public-test-key',
  );
  expect(mocks.rpc.getLatestBlockhash).not.toHaveBeenCalled();
  expect(mocks.subscriptions.signatureNotifications).not.toHaveBeenCalled();
});
