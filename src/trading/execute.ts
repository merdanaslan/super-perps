import { verifyWalletSignature, type Receipt } from './chain';
import type { ReviewPlan } from './types';

/** The caller holds an origin-wide Web Lock. Persist BEFORE broadcast, including on network errors. */
export async function executeReviewed(
  plan: ReviewPlan,
  deps: {
    currentAuthority: () => string | undefined;
    sign: (bytes: Uint8Array, authority: string) => Promise<Uint8Array>;
    onSigned?: () => void;
    blockHeight: () => Promise<number>;
    persist: (receipt: Receipt) => void;
    broadcast: (
      plan: ReviewPlan,
      signed: { bytes: Uint8Array; signature: string },
    ) => Promise<void>;
    now?: () => number;
  },
): Promise<Receipt> {
  const now = deps.now ?? Date.now;
  const assertWallet = () => {
    if (deps.currentAuthority() !== plan.authority)
      throw new Error('Wallet changed. Review the action again.');
  };
  assertWallet();
  if (now() - plan.preparedAt > 30_000)
    throw new Error('Review expired. Refresh the action before signing.');
  const signedBytes = await deps.sign(plan.bytes, plan.authority);
  assertWallet();
  deps.onSigned?.();
  if (
    now() - plan.preparedAt > 60_000 ||
    (await deps.blockHeight()) > plan.lifetime.lastValidBlockHeight
  )
    throw new Error('Transaction expired while signing. Nothing was sent. Review again.');
  const signed = await verifyWalletSignature(plan, signedBytes, plan.extraSigner);
  assertWallet();
  const pending: Receipt = {
    signature: signed.signature,
    authority: plan.authority,
    label: plan.title,
    actionKind: plan.action.kind,
    lifetime: plan.lifetime,
    createdAt: now(),
    state: 'pending',
  };
  deps.persist(pending); // A write failure stops submission rather than losing recovery information.
  try {
    await deps.broadcast(plan, signed);
  } catch {
    return {
      ...pending,
      detail:
        'Submission response unavailable. Checking this transaction; do not repeat the action.',
    };
  }
  return pending;
}
