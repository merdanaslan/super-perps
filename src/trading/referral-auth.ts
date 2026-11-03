import { createPhoenixClient, MemoryAuthSessionStorage } from '@ellipsis-labs/rise';
import { address, getAddressEncoder, getBase58Decoder } from '@solana/kit';

export type MessageSigner = (message: Uint8Array, authority: string) => Promise<Uint8Array>;
export interface WalletChallenge {
  nonce_id: string;
  message: string;
  expires_at: string;
}
export async function signReferralChallenge(
  owner: string,
  nonce: WalletChallenge,
  sign: MessageSigner,
  isCurrent: () => boolean,
) {
  const expires = Date.parse(nonce.expires_at);
  if (
    !nonce.nonce_id ||
    !nonce.message ||
    nonce.message.length > 4096 ||
    !Number.isFinite(expires) ||
    expires <= Date.now()
  )
    throw new Error('Phoenix returned an invalid or expired authentication challenge.');
  if (!isCurrent()) throw new Error('Wallet changed. Review account setup again.');
  const message = new TextEncoder().encode(nonce.message);
  const signature = await sign(message, owner);
  if (!isCurrent()) throw new Error('Wallet changed while authenticating.');
  if (expires <= Date.now())
    throw new Error('Phoenix authentication challenge expired. Try again.');
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(getAddressEncoder().encode(address(owner))),
    'Ed25519',
    false,
    ['verify'],
  );
  if (
    signature.length !== 64 ||
    !(await crypto.subtle.verify('Ed25519', key, new Uint8Array(signature), message))
  )
    throw new Error('Wallet returned an invalid authentication signature.');
  return getBase58Decoder().decode(signature);
}

/** Short-lived, wallet-scoped sessions; no JWT or refresh token is written to browser storage. */
export class ReferralAuth {
  private active?: { owner: string; client: ReturnType<typeof createPhoenixClient> };
  private generation = 0;
  constructor(private readonly apiUrl: string) {}
  clear() {
    this.generation++;
    const previous = this.active;
    this.active = undefined;
    if (previous) {
      void previous.client.sessionManager?.clearSession();
      previous.client.dispose();
    }
  }
  async authenticate(owner: string, sign: MessageSigner, isCurrent: () => boolean) {
    this.clear();
    const token = this.generation;
    const current = () => this.generation === token && isCurrent();
    const client = createPhoenixClient({
      apiUrl: this.apiUrl,
      auth: true,
      authConfig: { storage: new MemoryAuthSessionStorage() },
      ws: false,
      timeout: 12_000,
      rateLimitRetry: false,
      exchangeMetadata: { stream: false, rpc: { enabled: false } },
    });
    try {
      const nonce = await client.auth!.getWalletNonce(owner);
      const signature = await signReferralChallenge(owner, nonce, sign, current);
      if (!current()) throw new Error('Wallet changed while authenticating.');
      await client.auth!.loginWithWalletSignature(owner, signature, nonce.nonce_id);
      if (!current()) throw new Error('Wallet changed while authenticating.');
      this.active = { owner, client };
    } catch (error) {
      await client.sessionManager?.clearSession();
      client.dispose();
      throw error;
    }
  }
  clientFor(owner: string) {
    if (this.active?.owner !== owner)
      throw new Error('Verify this wallet with Phoenix before using a referral.');
    return this.active.client;
  }
}
