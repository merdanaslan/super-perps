import { describe, expect, it } from 'vitest';
import { resolveAppWallet } from './app-wallet';

const primary = {
  type: 'wallet',
  address: 'primary-solana',
  chainType: 'solana',
  walletClientType: 'privy',
  walletIndex: 0,
  imported: false,
};
const secondary = { ...primary, address: 'secondary-solana', walletIndex: 1 };
const connected = [{ address: 'external-solana' }, { address: primary.address }];
const session = {
  ready: true,
  authenticated: true,
  walletsReady: true,
  user: { id: 'user-a', linkedAccounts: [primary] },
  wallets: connected,
};

describe('automatic app wallet', () => {
  it('resolves the linked Privy wallet without a prior selection, including a fresh reload', () => {
    expect(resolveAppWallet(session)).toBe(connected[1]);
    expect(resolveAppWallet({ ...session, user: { ...session.user } })).toBe(connected[1]);
  });
  it.each(['ready', 'authenticated', 'walletsReady'] as const)(
    'does not expose a wallet while %s is false',
    (flag) => expect(resolveAppWallet({ ...session, [flag]: false })).toBeUndefined(),
  );
  it('requires a current user even if a connector is still connected', () => {
    expect(resolveAppWallet({ ...session, user: null })).toBeUndefined();
    expect(
      resolveAppWallet({ ...session, user: { id: '', linkedAccounts: [primary] } }),
    ).toBeUndefined();
  });
  it.each([
    { ...primary, type: 'smart_wallet' },
    { ...primary, chainType: 'ethereum' },
    { ...primary, walletClientType: 'phantom' },
    { ...primary, walletClientType: undefined },
    { ...primary, imported: true },
  ])('does not treat an unrelated wallet as the app wallet: %j', (account) => {
    expect(
      resolveAppWallet({ ...session, user: { id: 'user-a', linkedAccounts: [account] } }),
    ).toBeUndefined();
  });
  it('selects index zero regardless of connected/linked wallet order', () => {
    const other = { ...primary, address: 'external-solana', walletClientType: 'phantom' };
    expect(
      resolveAppWallet({
        ...session,
        user: { id: 'user-a', linkedAccounts: [secondary, other, primary] },
        wallets: [...connected].reverse(),
      })?.address,
    ).toBe(primary.address);
  });
  it('never falls back to an external or secondary wallet when the primary disconnects', () => {
    expect(
      resolveAppWallet({
        ...session,
        user: { id: 'user-a', linkedAccounts: [primary, secondary] },
        wallets: [{ address: secondary.address }, connected[0]!],
      }),
    ).toBeUndefined();
  });
  it('resolves the current user only when old connectors survive an account change', () => {
    const next = { ...primary, address: 'next-user-wallet' };
    const state = { ...session, user: { id: 'user-b', linkedAccounts: [next] } };
    expect(resolveAppWallet(state)).toBeUndefined();
    expect(
      resolveAppWallet({ ...state, wallets: [...connected, { address: next.address }] })?.address,
    ).toBe(next.address);
  });
  it.each([undefined, null])(
    'supports a single legacy embedded wallet with index %s',
    (walletIndex) => {
      expect(
        resolveAppWallet({
          ...session,
          user: { id: 'user-a', linkedAccounts: [{ ...primary, walletIndex }] },
        })?.address,
      ).toBe(primary.address);
    },
  );
  it('supports Privy v2 metadata', () => {
    expect(
      resolveAppWallet({
        ...session,
        user: { id: 'user-a', linkedAccounts: [{ ...primary, walletClientType: 'privy-v2' }] },
      })?.address,
    ).toBe(primary.address);
  });
  it('refuses ambiguous primary metadata or a secondary-only account', () => {
    for (const linkedAccounts of [
      [primary, { ...secondary, walletIndex: 0 }],
      [
        { ...primary, walletIndex: null },
        { ...secondary, walletIndex: null },
      ],
      [secondary],
    ]) {
      expect(
        resolveAppWallet({ ...session, user: { id: 'user-a', linkedAccounts } }),
      ).toBeUndefined();
    }
  });
});
