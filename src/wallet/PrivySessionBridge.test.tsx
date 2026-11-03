// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PrivySessionBridge from './PrivySessionBridge';
import { useWalletSession, type WalletSession } from './session';

const mocks = vi.hoisted(() => ({
  auth: {
    ready: true,
    authenticated: true,
    user: { id: 'user-one', linkedAccounts: [] as object[] },
  },
  wallets: { ready: true, wallets: [] as { address: string }[] },
  sign: vi.fn(),
  message: vi.fn(),
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ ...mocks.auth, login: vi.fn(), logout: vi.fn() }),
}));
vi.mock('@privy-io/react-auth/solana', () => ({
  useWallets: () => mocks.wallets,
  useSignTransaction: () => ({ signTransaction: mocks.sign }),
  useSignMessage: () => ({ signMessage: mocks.message }),
}));
vi.mock('./PrivyRoot', () => ({ PrivyRoot: ({ children }: { children: ReactNode }) => children }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
let session: WalletSession;
function Consumer() {
  session = useWalletSession();
  return null;
}
async function render() {
  await act(() =>
    root.render(
      <PrivySessionBridge>
        <Consumer />
      </PrivySessionBridge>,
    ),
  );
}
beforeEach(() => {
  mocks.auth.authenticated = true;
  mocks.auth.user = {
    id: 'user-one',
    linkedAccounts: [
      {
        type: 'wallet',
        chainType: 'solana',
        walletClientType: 'privy',
        walletIndex: 0,
        address: 'wallet-one',
      },
    ],
  };
  mocks.wallets.wallets = [{ address: 'wallet-one' }];
  mocks.sign.mockResolvedValue({ signedTransaction: new Uint8Array([9]) });
  mocks.message.mockResolvedValue({ signature: new Uint8Array([8]) });
});
afterEach(async () => {
  await act(() => root.render(null));
  vi.clearAllMocks();
});
it('does not sign on login, render or balance refresh', async () => {
  await render();
  await render();
  expect(mocks.sign).not.toHaveBeenCalled();
});
it('signs the explicitly requested bytes with the primary wallet without a duplicate modal', async () => {
  await render();
  const bytes = new Uint8Array([1, 2, 3]);
  await expect(session.signTransaction!(bytes, 'wallet-one')).resolves.toEqual(new Uint8Array([9]));
  expect(mocks.sign).toHaveBeenCalledExactlyOnceWith({
    transaction: bytes,
    wallet: mocks.wallets.wallets[0],
    chain: 'solana:mainnet',
    options: { uiOptions: { showWalletUIs: false } },
  });
});
it('refuses a request for a different wallet before invoking Privy', async () => {
  await render();
  await expect(session.signTransaction!(new Uint8Array(), 'another-wallet')).rejects.toThrow(
    'Wallet changed',
  );
  expect(mocks.sign).not.toHaveBeenCalled();
});
it('rejects a signing result after the authenticated user changes', async () => {
  let finish!: (value: { signedTransaction: Uint8Array }) => void;
  mocks.sign.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  const signing = session.signTransaction!(new Uint8Array([1]), 'wallet-one');
  const rejected = expect(signing).rejects.toThrow('Wallet changed while signing');
  mocks.auth.user = { ...mocks.auth.user, id: 'user-two' };
  await render();
  finish({ signedTransaction: new Uint8Array([9]) });
  await rejected;
});
it('retains explicit message authentication prompts', async () => {
  await render();
  await session.signMessage!(new Uint8Array([1]), 'wallet-one');
  expect(mocks.message).toHaveBeenCalledWith(
    expect.objectContaining({
      options: { uiOptions: expect.objectContaining({ showWalletUIs: true }) },
    }),
  );
});
