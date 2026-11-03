// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FundingWithdrawal } from './FundingWithdrawal';
import { WalletSessionContext } from '../wallet/session';
import { TradingContext } from '../trading/state';
import type { TradingAccount } from '../trading/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// Public, unfunded test identities; no signer exists in this component harness.
const owner = 'CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8';
const destination = 'So11111111111111111111111111111111111111112';
let container: HTMLDivElement;
let root: Root;
let context: NonNullable<React.ContextType<typeof TradingContext>>;
const review = vi.fn();
const close = vi.fn();
const click = async (text: string) => {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === text);
  expect(button, text).toBeTruthy();
  await act(() => button!.click());
};
async function input(selector: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(selector)!;
  expect(element).toBeTruthy();
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function render() {
  root.render(
    <WalletSessionContext.Provider
      value={{
        configured: true,
        ready: true,
        authenticated: true,
        selected: owner,
        login: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <TradingContext.Provider value={context}>
        <FundingWithdrawal close={close} />
      </TradingContext.Provider>
    </WalletSessionContext.Provider>,
  );
}
const reviewButton = () =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Review'))!;
beforeEach(() => {
  review.mockReset().mockResolvedValue(undefined);
  close.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  context = {
    account: {
      authority: owner,
      registered: true,
      subaccount: { capabilities: { state: 'active' } },
      margin: { margin: { withdrawableQuoteCollateralQuoteLots: '1500000' } },
    } as TradingAccount,
    walletBalances: {
      authority: owner,
      walletUsdc: 2_123_456n,
      walletSol: 50_000_001n,
      receivedAt: Date.now(),
      slot: 100,
    },
    loading: false,
    error: '',
    walletError: '',
    busy: false,
    stale: false,
    walletStale: false,
    walletBusy: false,
    refresh: vi.fn(),
    review,
    reviewDeposit: vi.fn(),
    openStatus: vi.fn(),
  };
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});

it('keeps Phoenix withdrawal and wallet USDC transfer as explicit, distinct sources', async () => {
  await act(render);
  expect(container.textContent).toContain('Withdrawable: 1.5 USDC');
  await input('[inputmode="decimal"]', '1');
  await click('Use my app wallet');
  await click('Review withdrawal');
  expect(review).toHaveBeenLastCalledWith({ kind: 'withdraw', amount: '1', recipient: owner });
  await click('Wallet');
  expect(container.querySelector<HTMLInputElement>('[inputmode="decimal"]')!.value).toBe('');
  expect(container.textContent).toContain('Wallet balance: 2.123456 USDC');
  await input('[inputmode="decimal"]', '0.123456');
  await input('#withdrawal-recipient', destination);
  await click('Review transfer');
  expect(review).toHaveBeenLastCalledWith({
    kind: 'send',
    asset: 'USDC',
    amount: '0.123456',
    max: false,
    recipient: destination,
  });
});
it('offers native SOL with all nine decimals and no Phoenix source selector', async () => {
  await act(render);
  await click('SOL');
  expect(container.textContent).toContain('Wallet balance: 0.050000001 SOL');
  expect(container.querySelector('[aria-label="USDC source"]')).toBeNull();
  await input('[inputmode="decimal"]', '0.010000001');
  await input('#withdrawal-recipient', destination);
  expect(reviewButton().disabled).toBe(false);
  await click('Review transfer');
  expect(review).toHaveBeenCalledWith({
    kind: 'send',
    asset: 'SOL',
    amount: '0.010000001',
    max: false,
    recipient: destination,
  });
  expect(close).toHaveBeenCalledOnce();
});
it.each([
  ['SOL', 'wallet', '0,010000001', '0.010000001'],
  ['USDC', 'wallet', '0,123456', '0.123456'],
  ['USDC', 'phoenix', '1,25', '1.25'],
] as const)('accepts a decimal comma for %s from %s', async (asset, source, typed, amount) => {
  await act(render);
  if (asset === 'SOL') await click('SOL');
  else if (source === 'wallet') await click('Wallet');
  await input('[inputmode="decimal"]', typed);
  await input('#withdrawal-recipient', destination);
  expect(reviewButton().disabled).toBe(false);
  await click(source === 'phoenix' ? 'Review withdrawal' : 'Review transfer');
  expect(review).toHaveBeenCalledWith(
    source === 'phoenix'
      ? { kind: 'withdraw', amount, recipient: destination }
      : { kind: 'send', asset, amount, max: false, recipient: destination },
  );
});
it('shows Max as an amount to calculate after fees, never as the gross SOL balance', async () => {
  await act(render);
  await click('SOL');
  await click('Max');
  expect(container.querySelector<HTMLInputElement>('[inputmode="decimal"]')!.value).toBe('');
  expect(container.querySelector('input[placeholder="Max after fees"]')).not.toBeNull();
  expect(container.textContent).toContain('need to add SOL again');
  await input('#withdrawal-recipient', destination);
  await click('Review transfer');
  expect(review).toHaveBeenCalledWith({
    kind: 'send',
    asset: 'SOL',
    amount: '',
    max: true,
    recipient: destination,
  });
  await click('USDC');
  expect(container.querySelector('input[placeholder="Max after fees"]')).toBeNull();
  expect(reviewButton().disabled).toBe(true);
});
it('supports wallet sends without a Phoenix account, including a Phoenix outage', async () => {
  context = { ...context, account: undefined, stale: true, error: 'Phoenix unavailable' };
  await act(render);
  expect(container.textContent).not.toContain('Phoenix unavailable');
  await click('Max');
  await input('#withdrawal-recipient', destination);
  expect(reviewButton().disabled).toBe(false);
  await click('Review transfer');
  expect(review).toHaveBeenCalledWith({
    kind: 'send',
    asset: 'USDC',
    amount: '2.123456',
    max: false,
    recipient: destination,
  });
  await click('Phoenix collateral');
  expect(reviewButton().disabled).toBe(true);
});
it('blocks self-sends, excess precision and stale wallet balances before review', async () => {
  await act(render);
  await click('SOL');
  await input('[inputmode="decimal"]', '0.01');
  await input('#withdrawal-recipient', owner);
  expect(container.textContent).toContain('other than your app wallet');
  expect(reviewButton().disabled).toBe(true);
  await input('#withdrawal-recipient', destination);
  await input('[inputmode="decimal"]', '0.0000000001');
  expect(reviewButton().disabled).toBe(true);
  await input('[inputmode="decimal"]', '0.01');
  context = { ...context, walletStale: true };
  await act(render);
  expect(reviewButton().disabled).toBe(true);
  expect(review).not.toHaveBeenCalled();
});
