import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPhoenixClient } from '@ellipsis-labs/rise';
import { generateKeyPair, getAddressFromPublicKey, getBase58Encoder } from '@solana/kit';
import { ReferralAuth, signReferralChallenge } from './referral-auth';

vi.mock('@ellipsis-labs/rise', async (original) => ({
  ...(await original<typeof import('@ellipsis-labs/rise')>()),
  createPhoenixClient: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
async function fixture() {
  const key = await generateKeyPair();
  const owner = await getAddressFromPublicKey(key.publicKey);
  const nonce = {
    nonce_id: 'local-test',
    message: `Phoenix test sign-in for ${owner}`,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  const sign = vi.fn(
    async (message: Uint8Array) =>
      new Uint8Array(await crypto.subtle.sign('Ed25519', key.privateKey, new Uint8Array(message))),
  );
  const fake = {
    auth: {
      getWalletNonce: vi.fn(async () => nonce),
      loginWithWalletSignature: vi.fn(async () => {}),
    },
    sessionManager: { clearSession: vi.fn(async () => {}) },
    dispose: vi.fn(),
  };
  vi.mocked(createPhoenixClient).mockReturnValue(
    fake as unknown as ReturnType<typeof createPhoenixClient>,
  );
  return { owner, nonce, sign, fake };
}
describe('Phoenix referral authentication', () => {
  it('signs the exact challenge and validates the signature against the selected wallet', async () => {
    const { owner, nonce, sign } = await fixture();
    const signature = await signReferralChallenge(owner, nonce, sign, () => true);
    expect(sign).toHaveBeenCalledWith(new TextEncoder().encode(nonce.message), owner);
    expect(getBase58Encoder().encode(signature)).toHaveLength(64);
  });
  it('rejects expired challenges before calling the wallet', async () => {
    const { owner, nonce, sign } = await fixture();
    await expect(
      signReferralChallenge(
        owner,
        { ...nonce, expires_at: new Date(0).toISOString() },
        sign,
        () => true,
      ),
    ).rejects.toThrow('expired');
    expect(sign).not.toHaveBeenCalled();
  });
  it('rejects invalid signatures and signatures from another key', async () => {
    const { owner, nonce } = await fixture();
    const other = await fixture();
    await expect(
      signReferralChallenge(
        owner,
        nonce,
        async () => new Uint8Array(64),
        () => true,
      ),
    ).rejects.toThrow('invalid');
    await expect(signReferralChallenge(owner, nonce, other.sign, () => true)).rejects.toThrow(
      'invalid',
    );
  });
  it('does not log in if the wallet changes while signing', async () => {
    const { owner, sign, fake } = await fixture();
    let current = true;
    const auth = new ReferralAuth('https://phoenix.example');
    await expect(
      auth.authenticate(
        owner,
        async (message) => {
          const out = await sign(message);
          current = false;
          return out;
        },
        () => current,
      ),
    ).rejects.toThrow('Wallet changed');
    expect(fake.auth.loginWithWalletSignature).not.toHaveBeenCalled();
    expect(fake.sessionManager.clearSession).toHaveBeenCalledOnce();
    expect(fake.dispose).toHaveBeenCalledOnce();
  });
  it('invalidates an in-flight authentication on session clear', async () => {
    const { owner, sign, fake } = await fixture();
    const auth = new ReferralAuth('https://phoenix.example');
    fake.auth.loginWithWalletSignature.mockImplementation(async () => {
      auth.clear();
    });
    await expect(auth.authenticate(owner, sign, () => true)).rejects.toThrow('Wallet changed');
    expect(() => auth.clientFor(owner)).toThrow('Verify this wallet');
    expect(fake.dispose).toHaveBeenCalledOnce();
  });
  it('keeps successful authentication wallet-scoped and drops it on logout', async () => {
    const { owner, sign, fake } = await fixture();
    const auth = new ReferralAuth('https://phoenix.example');
    await auth.authenticate(owner, sign, () => true);
    expect(auth.clientFor(owner)).toBe(fake);
    expect(() => auth.clientFor('different-wallet')).toThrow('Verify this wallet');
    const options = vi.mocked(createPhoenixClient).mock.calls.at(-1)![0];
    expect(options?.authConfig?.storage?.constructor.name).toBe('MemoryAuthSessionStorage');
    auth.clear();
    expect(() => auth.clientFor(owner)).toThrow('Verify this wallet');
    expect(fake.sessionManager.clearSession).toHaveBeenCalledOnce();
  });
  it('does not authenticate after the user rejects a message', async () => {
    const { owner, fake } = await fixture();
    const auth = new ReferralAuth('https://phoenix.example');
    await expect(
      auth.authenticate(
        owner,
        async () => {
          throw new Error('User rejected');
        },
        () => true,
      ),
    ).rejects.toThrow('User rejected');
    expect(fake.auth.loginWithWalletSignature).not.toHaveBeenCalled();
    expect(() => auth.clientFor(owner)).toThrow();
  });
});
