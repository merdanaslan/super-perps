import type { TradingAccount } from './types';
import { toLots } from './math';

/** A user-entered amount, never an instruction to sweep funds arriving later. */
export interface DepositJourney {
  amount: string;
  step: 'setup' | 'deposit';
}
export function needsAccountSetup(account: TradingAccount): boolean {
  return (
    !account.registered ||
    (account.subaccount?.capabilities ?? account.state?.snapshot.capabilities)?.state ===
      'uninitialized'
  );
}
export function isDepositJourney(value: unknown): value is DepositJourney {
  if (
    !value ||
    typeof value !== 'object' ||
    !('amount' in value) ||
    !('step' in value) ||
    typeof value.amount !== 'string' ||
    !['setup', 'deposit'].includes(String(value.step))
  )
    return false;
  try {
    return toLots(value.amount, 6, 'USDC amount') > 0n;
  } catch {
    return false;
  }
}
