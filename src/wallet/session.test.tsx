// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { WalletBoundary } from './session';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
afterEach(async () => {
  await act(() => root.render(null));
  localStorage.clear();
  vi.restoreAllMocks();
});

it('replaces a crashed wallet screen with working recovery instead of a fake logged-out app', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  const journal = JSON.stringify({ signature: 'existing-pending-transaction', state: 'pending' });
  localStorage.setItem('zupa.transaction.v1', journal);
  function FailedSigningScreen(): never {
    throw new Error('No RPC configuration found for chain solana:mainnet');
  }
  await act(() =>
    root.render(
      <WalletBoundary>
        <FailedSigningScreen />
      </WalletBoundary>,
    ),
  );
  expect(container.textContent).toContain('Wallet connection interrupted');
  expect(container.textContent).not.toContain('Sign up / Log in');
  expect(container.textContent).toContain('check its status');
  const button = container.querySelector('button');
  expect(button?.textContent).toContain('Reload wallet');
  expect(reload).not.toHaveBeenCalled();
  await act(() => button!.click());
  expect(reload).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('zupa.transaction.v1')).toBe(journal);
});
