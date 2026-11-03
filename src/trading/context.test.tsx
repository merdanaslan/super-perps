// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WalletSessionContext, type WalletSession } from '../wallet/session';
import { Funding } from '../app/Funding';
import { TradingProvider } from './context';
import { useTrading } from './state';
import type { Action, ReviewPlan, TradingAccount } from './types';
import type { Receipt } from './chain';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  readWallet: vi.fn(),
  prepare: vi.fn(),
  execute: vi.fn(),
  check: vi.fn(),
}));
vi.mock('./service', () => ({
  TradingService: class {
    readAccount = mocks.read;
    readWallet = mocks.readWallet;
    prepare = mocks.prepare;
    rpc = vi.fn();
    broadcast = vi.fn();
    referralAuth = { clear: vi.fn() };
    dispose() {}
  },
}));
vi.mock('./execute', () => ({ executeReviewed: mocks.execute }));
vi.mock('./chain', () => ({ checkReceipt: mocks.check }));
vi.mock('../app/components/Sheet', () => ({
  Sheet: ({
    open,
    title,
    onClose,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
  }) =>
    open ? (
      <section role="dialog">
        <h2>{title}</h2>
        <button onClick={onClose}>Close sheet</button>
        {children}
        {footer}
      </section>
    ) : null,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const authority = '11111111111111111111111111111111';
const wallet: WalletSession = {
  ready: true,
  configured: true,
  authenticated: true,
  selected: authority,
  login: vi.fn(),
  logout: vi.fn(),
  signTransaction: vi.fn(),
};
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
let trading: ReturnType<typeof useTrading>;
function Consumer() {
  trading = useTrading();
  return <button onClick={trading.openStatus}>Latest transaction</button>;
}
function account(registered = false, slot = 100): TradingAccount {
  return {
    authority,
    registered,
    slot,
    receivedAt: Date.now(),
    walletUsdc: 2_000_000n,
    walletSol: 20_000_000n,
    freeMargin: 0n,
    subaccount: registered ? { capabilities: { state: 'active' } } : undefined,
    inputs: registered ? {} : undefined,
  } as TradingAccount;
}
function pending(plan: ReviewPlan): Receipt {
  return {
    signature: '1'.repeat(88),
    authority,
    state: 'pending',
    actionKind: plan.action.kind,
    label: plan.title,
    lifetime: plan.lifetime,
    createdAt: Date.now(),
  };
}
async function render(session = wallet, funding = false) {
  await act(() =>
    root.render(
      <WalletSessionContext.Provider value={session}>
        <TradingProvider>
          <Consumer />
          {funding && <Funding open close={vi.fn()} initialTab="deposit" />}
        </TradingProvider>
      </WalletSessionContext.Provider>,
    ),
  );
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === text);
  expect(button, `Missing button: ${text}`).toBeTruthy();
  await act(() => button!.click());
}
async function start(amount = '2') {
  expect(typeof trading.reviewDeposit).toBe('function');
  await act(() => trading.reviewDeposit(amount));
}
beforeEach(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T13:30:00Z'));
  localStorage.clear();
  mocks.read.mockResolvedValue(account());
  mocks.readWallet.mockImplementation(async () => account());
  mocks.prepare.mockImplementation(async (_owner: string, action: Action): Promise<ReviewPlan> => ({
    authority,
    action,
    title: action.kind === 'setup' ? 'Set up Phoenix account' : 'Deposit to Phoenix',
    details: [],
    bytes: new Uint8Array(),
    preparedAt: Date.now(),
    feeLamports: 5000,
    rentLamports: 0,
    lifetime: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 200 },
  }));
  mocks.execute.mockImplementation(async (plan: ReviewPlan, deps) => {
    deps.onSigned?.();
    const receipt = pending(plan);
    deps.persist(receipt);
    return receipt;
  });
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => receipt);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, _options: unknown, run: (lock: object) => unknown) => run({}),
    },
  });
});
afterEach(async () => {
  await act(() => root.render(null));
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

it('refreshes wallet funds independently when Phoenix is unavailable', async () => {
  mocks.read.mockRejectedValue(new Error('Phoenix unavailable'));
  await render();
  expect(trading.account).toBeUndefined();
  expect(trading.stale).toBe(true);
  expect(trading.walletBalances?.walletSol).toBe(20_000_000n);
  expect(trading.walletStale).toBe(false);
  await act(() =>
    trading.review({ kind: 'send', asset: 'SOL', amount: '0.01', recipient: authority }),
  );
  expect(mocks.prepare).toHaveBeenCalledOnce();
});

it('keeps wallet funds fresh while a venue request is still in flight', async () => {
  let finish!: (value: TradingAccount) => void;
  mocks.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  expect(trading.walletStale).toBe(false);
  await act(() => vi.advanceTimersByTimeAsync(24_000));
  expect(trading.walletStale).toBe(false);
  expect(mocks.readWallet.mock.calls.length).toBeGreaterThan(1);
  expect(mocks.read).toHaveBeenCalledOnce();
  await act(() => finish(account()));
});

it('permits a wallet send after a previous confirmed Phoenix action once Solana balances catch up', async () => {
  localStorage.setItem(
    'zupa.transaction.v1',
    JSON.stringify({
      signature: '1'.repeat(88),
      authority,
      state: 'confirmed',
      actionKind: 'withdraw',
      label: 'Withdraw USDC',
      lifetime: { blockhash: authority, lastValidBlockHeight: 200 },
      createdAt: Date.now() - 1000,
      slot: 100,
    }),
  );
  mocks.read.mockRejectedValue(new Error('Phoenix unavailable'));
  await render();
  expect(trading.busy).toBe(true);
  expect(trading.walletBusy).toBe(false);
  expect(trading.walletStale).toBe(false);
  await act(() =>
    trading.review({ kind: 'send', asset: 'USDC', amount: '1', recipient: authority }),
  );
  expect(mocks.prepare).toHaveBeenCalledOnce();
  expect(mocks.execute).not.toHaveBeenCalled();
});

it('reconciles wallet transfers against the wallet slot, without waiting for Phoenix', async () => {
  mocks.read.mockRejectedValue(new Error('Phoenix unavailable'));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await render();
  const confirmed = vi.fn();
  await act(() =>
    trading.review({ kind: 'send', asset: 'SOL', amount: '0.01', recipient: authority }, confirmed),
  );
  await click('Confirm & sign');
  expect(trading.busy).toBe(true);
  expect(confirmed).not.toHaveBeenCalled();
  mocks.readWallet.mockResolvedValue(account(false, 120));
  await act(() => trading.refresh());
  expect(trading.busy).toBe(false);
  expect(confirmed).toHaveBeenCalledOnce();
  expect(container.textContent).toContain('Your wallet transfer is confirmed');
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it('discards wallet balances after a wallet switch even if its old request finishes later', async () => {
  let finish!: (value: TradingAccount) => void;
  mocks.readWallet.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await render({ ...wallet, selected: 'another-wallet' });
  await act(() => finish(account()));
  expect(trading.walletBalances).toBeUndefined();
  expect(trading.walletStale).toBe(true);
});

it('blocks offline reviews before preparation or wallet signing', async () => {
  await render();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(() => window.dispatchEvent(new Event('offline')));
  await start();
  expect(trading.stale).toBe(true);
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(container.textContent).toContain('You’re offline');
});

it('does not sign a prepared review after the connection goes offline', async () => {
  await render();
  await start();
  expect(mocks.prepare).toHaveBeenCalledOnce();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(() => window.dispatchEvent(new Event('offline')));
  await click('Confirm & sign');
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(container.textContent).toContain('You’re offline');
});

it('collects the deposit amount before first-time account setup', async () => {
  await render(wallet, true);
  expect(container.querySelector('input[inputmode="decimal"]')).not.toBeNull();
  expect(container.textContent).toContain('two confirmations');
});

it('requires the app confirmation and immediately replaces the review with signing progress', async () => {
  let finish!: () => void;
  mocks.execute.mockImplementationOnce(async (plan: ReviewPlan, deps) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    deps.onSigned?.();
    const receipt = pending(plan);
    deps.persist(receipt);
    return receipt;
  });
  await render();
  await start();
  expect(mocks.execute).not.toHaveBeenCalled();
  await click('Confirm & sign');
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Signing transaction');
  expect(container.textContent).not.toContain('Confirm & sign');
  expect(container.textContent).not.toContain('Confirm in your wallet');
  await act(() => finish());
  expect(container.textContent).toContain('Waiting for confirmation');
});

it('switches from review to progress as soon as the wallet returns a signature', async () => {
  mocks.read.mockResolvedValue(account(true));
  let finish!: () => void;
  mocks.execute.mockImplementationOnce(async (plan: ReviewPlan, deps) => {
    deps.onSigned?.();
    const receipt = pending(plan);
    deps.persist(receipt);
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return receipt;
  });
  await render();
  await start();
  await click('Confirm & sign');
  expect(container.textContent).toContain('Submitting transaction');
  expect(container.textContent).not.toContain('Confirm in your wallet');
  await act(() => finish());
  expect(container.textContent).toContain('Waiting for confirmation');
});

it('waits for confirmed setup and fresh account state, then reviews the original deposit exactly once', async () => {
  await render();
  await start('1.25');
  await click('Confirm & sign');
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  const saved = JSON.parse(localStorage.getItem('zupa.transaction.v1')!);
  expect(saved.depositJourney).toEqual({ amount: '1.25', step: 'setup' });
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  mocks.read.mockResolvedValue(account(true, 120));
  await act(() => trading.refresh());
  expect(mocks.prepare).toHaveBeenLastCalledWith(authority, { kind: 'deposit', amount: '1.25' });
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(8000));
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
});

it.each(['failed', 'expired'] as const)('never advances after %s setup', async (state) => {
  await render();
  await start();
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state,
    slot: 120,
  }));
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Review again');
});

it('keeps a cancelled wallet approval recoverable without advancing or signing again', async () => {
  mocks.execute.mockRejectedValueOnce(new Error('User rejected the request'));
  await render();
  await start();
  await click('Confirm & sign');
  expect(container.textContent).toContain('cancelled');
  expect(container.textContent).toContain('Review again');
  await act(() => vi.advanceTimersByTimeAsync(8000));
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
});

it('resumes the saved amount after reload only when the user opens status, without auto-signing', async () => {
  const saved = {
    signature: '1'.repeat(88),
    authority,
    state: 'confirmed',
    actionKind: 'setup',
    label: 'Setup',
    lifetime: { blockhash: authority, lastValidBlockHeight: 200 },
    createdAt: Date.now() - 1000,
    slot: 120,
    depositJourney: { amount: '1.25', step: 'setup' },
  };
  localStorage.setItem('zupa.transaction.v1', JSON.stringify(saved));
  mocks.read.mockResolvedValue(account(true, 120));
  await render();
  expect(mocks.prepare).not.toHaveBeenCalled();
  await click('Latest transaction');
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(authority, {
    kind: 'deposit',
    amount: '1.25',
  });
  expect(mocks.execute).not.toHaveBeenCalled();
});

it('does not continue a deposit for a different wallet after setup', async () => {
  await render();
  await start();
  await click('Confirm & sign');
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  mocks.read.mockResolvedValue({ ...account(true, 120), authority: 'different-wallet' });
  await render({ ...wallet, selected: 'different-wallet' });
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
});

it('skips setup for an activated account and rejects an amount above the wallet balance', async () => {
  mocks.read.mockResolvedValue(account(true));
  await render();
  await start('3');
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Not enough USDC');
  await start('2');
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(authority, {
    kind: 'deposit',
    amount: '2',
  });
});

it('shows deposit completion only after the account catches up to its confirmed receipt', async () => {
  mocks.read.mockResolvedValue(account(true));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await render();
  await start();
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(container.textContent).toContain('Updating your balance');
  expect(container.textContent).not.toContain('Deposit complete');
  mocks.read.mockResolvedValue({ ...account(true, 120), walletUsdc: 0n, freeMargin: 2_000_000n });
  await act(() => trading.refresh());
  expect(container.textContent).toContain('Deposit complete');
});

it('dismisses a fresh confirmation after one second and keeps its receipt available to inspect', async () => {
  mocks.read.mockResolvedValue(account(true, 120));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await render();
  await start();
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(999));
  expect(container.textContent).toContain('Deposit complete');
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem('zupa.transaction.v1')!).state).toBe('confirmed');
  await click('Latest transaction');
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(container.textContent).toContain('Deposit complete');
});

it('starts the dismissal delay only after the confirmed account snapshot arrives', async () => {
  mocks.read.mockResolvedValue(account(true, 100));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await render();
  await start();
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(container.textContent).toContain('Updating your balance');
  mocks.read.mockResolvedValue(account(true, 120));
  await act(() => trading.refresh());
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it('notifies only the submitted review once, after confirmation and account catch-up', async () => {
  mocks.read.mockResolvedValue(account(true, 100));
  const confirmed = vi.fn();
  const abandoned = vi.fn();
  await render();
  await act(() => trading.review({ kind: 'deposit', amount: '1' }, abandoned));
  await click('Close sheet');
  await act(() => trading.review({ kind: 'deposit', amount: '2' }, confirmed));
  expect(confirmed).not.toHaveBeenCalled();
  await click('Confirm & sign');
  expect(confirmed).not.toHaveBeenCalled();
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(confirmed).not.toHaveBeenCalled();
  mocks.read.mockResolvedValue(account(true, 120));
  await act(() => trading.refresh());
  expect(confirmed).toHaveBeenCalledTimes(1);
  expect(abandoned).not.toHaveBeenCalled();
  await act(() => trading.refresh());
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(confirmed).toHaveBeenCalledTimes(1);
});
it.each(['failed', 'expired'] as const)(
  'does not reset a ticket on a %s transaction',
  async (state) => {
    mocks.read.mockResolvedValue(account(true, 120));
    mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
      ...receipt,
      state,
      slot: 120,
    }));
    await render();
    const confirmed = vi.fn();
    await act(() => trading.review({ kind: 'deposit', amount: '1' }, confirmed));
    await click('Confirm & sign');
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(confirmed).not.toHaveBeenCalled();
  },
);
it('preserves the ticket callback when an expired review is refreshed', async () => {
  mocks.read.mockResolvedValue(account(true, 120));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await render();
  const confirmed = vi.fn();
  await act(() => trading.review({ kind: 'deposit', amount: '1' }, confirmed));
  await act(() => vi.advanceTimersByTimeAsync(31_000));
  await click('Refresh review');
  expect(confirmed).not.toHaveBeenCalled();
  await click('Confirm & sign');
  expect(confirmed).toHaveBeenCalledTimes(1);
});

it.each(['pending', 'failed', 'expired'] as const)('keeps %s receipts open', async (state) => {
  mocks.read.mockResolvedValue(account(true, 120));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state,
    slot: 120,
  }));
  await render();
  await start();
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(6000));
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
});

it('does not let an earlier success timer dismiss a new review', async () => {
  mocks.read.mockResolvedValue(account(true, 120));
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  await render();
  await start();
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(500));
  await click('Done');
  await start('1');
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(container.textContent).toContain('Confirm & sign');
});

it('retries a cancelled deposit without repeating already-confirmed account setup', async () => {
  await render();
  await start('1.25');
  mocks.check.mockImplementation(async (_rpc, receipt: Receipt) => ({
    ...receipt,
    state: 'confirmed',
    slot: 120,
  }));
  mocks.read.mockResolvedValue(account(true, 120));
  await click('Confirm & sign');
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(mocks.prepare).toHaveBeenLastCalledWith(authority, { kind: 'deposit', amount: '1.25' });
  mocks.execute.mockRejectedValueOnce(new Error('User rejected the request'));
  await click('Confirm & sign');
  expect(container.textContent).toContain('cancelled');
  await click('Review again');
  expect(mocks.prepare.mock.calls.filter(([, action]) => action.kind === 'setup')).toHaveLength(1);
  expect(mocks.prepare).toHaveBeenLastCalledWith(authority, { kind: 'deposit', amount: '1.25' });
});

it('rejects a corrupted saved continuation instead of preparing another transaction', async () => {
  localStorage.setItem(
    'zupa.transaction.v1',
    JSON.stringify({
      signature: '1'.repeat(88),
      authority,
      state: 'confirmed',
      actionKind: 'setup',
      lifetime: { lastValidBlockHeight: 200 },
      depositJourney: { amount: '-2', step: 'setup' },
    }),
  );
  await render();
  await click('Latest transaction');
  expect(container.textContent).toContain('recovery data is unreadable');
  expect(mocks.prepare).not.toHaveBeenCalled();
});
