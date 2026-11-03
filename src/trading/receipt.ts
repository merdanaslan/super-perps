import type { Receipt } from './chain';

/** A late poll or submission response must not replace a newer transaction or undo confirmation. */
export function reconcileReceipt(
  current: Receipt | undefined,
  update: Receipt,
): Receipt | undefined {
  if (!current || current.signature !== update.signature) return current;
  return current.state === 'pending' ? update : current;
}
