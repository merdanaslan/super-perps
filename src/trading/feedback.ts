import type { Receipt } from './chain';

export interface TransactionProblem {
  message: string;
  details?: string;
}

export const safeDiagnostic = (text: string) =>
  text.replace(/https?:\/\/[^\s"'<>]+/g, '[RPC endpoint]').slice(0, 1200);

export function transactionProblem(cause: unknown): TransactionProblem {
  const raw =
    typeof cause === 'string'
      ? cause
      : cause &&
          typeof cause === 'object' &&
          'message' in cause &&
          typeof cause.message === 'string'
        ? cause.message
        : '';
  const details = safeDiagnostic(raw);
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  if (code === 4001 || /user (?:rejected|denied|cancelled|canceled)/i.test(raw))
    return {
      message: 'You cancelled the wallet request. Review the action again when you’re ready.',
    };
  if (/No RPC configuration found/i.test(raw))
    return {
      message:
        'The wallet’s network connection is not configured. The app owner needs to configure Solana mainnet before signing can continue.',
      details,
    };
  if (/session (?:has )?expired|not authenticated/i.test(raw))
    return {
      message: 'Your wallet session expired. Reload and log in again, then review this action.',
    };
  if (/^Simulation failed\./.test(raw) && /Order type must be Limit or PostOnly/.test(raw))
    return {
      message:
        'Phoenix rejected this order type with TP/SL. No transaction was signed. This is an app compatibility issue; adding more SOL won’t fix it.',
      details,
    };
  if (/^Simulation failed\./.test(raw))
    return {
      message:
        'This transaction couldn’t pass the network checks. No transaction was signed. Check the details below before reviewing again.',
      details,
    };
  if (
    /failed to fetch|fetch failed|network request failed|networkerror|timed? ?out|timeout|RPC (?:unavailable|request failed)|429|too many requests/i.test(
      raw,
    )
  )
    return {
      message:
        'We couldn’t reach the network. Check your connection and try again shortly. If a transaction is pending, wait for its result before repeating the action.',
      details,
    };
  if (/custom program error|InstructionError/i.test(raw))
    return {
      message: 'The network rejected this transaction. Check the transaction details to see why.',
      details,
    };
  // Preserve app validation messages, including exact SOL shortfalls and input limits.
  return {
    message:
      details ||
      'This action could not be completed. Reload to check its status before trying again.',
  };
}

export function receiptMessage(receipt: Receipt): string {
  if (receipt.state === 'failed')
    return 'The network rejected this transaction, so its changes were not applied. A network fee may still have been charged. Check the details before reviewing again.';
  if (receipt.state === 'confirmed') {
    if (receipt.actionKind === 'setup')
      return 'Your Phoenix account is ready. Your USDC is still in your wallet. Open Deposit to move it into trading collateral.';
    if (receipt.actionKind === 'deposit')
      return 'Your USDC deposit is confirmed. Phoenix equity will update when your account refreshes.';
    if (receipt.actionKind === 'send')
      return 'Your wallet transfer is confirmed. Check the destination wallet for the funds.';
    if (receipt.actionKind === 'withdraw')
      return 'Your USDC withdrawal is confirmed. Check the destination wallet for the funds.';
    return 'The transaction is confirmed. Check your account, positions and orders for the result.';
  }
  if (receipt.state === 'expired')
    return 'This transaction expired and was not found in network history. Check your account, then start a new review.';
  return (
    receipt.detail ??
    'You can leave this panel. This transaction will continue to be checked. Do not repeat the action while it is pending.'
  );
}
