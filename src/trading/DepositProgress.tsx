import { Check, LoaderCircle } from 'lucide-react';
import type { DepositJourney } from './deposit-journey';

export function DepositProgress({
  journey,
  working,
  complete,
  failed,
}: {
  journey: DepositJourney;
  working: boolean;
  complete: boolean;
  failed: boolean;
}) {
  return (
    <ol className="deposit-progress" aria-label="Deposit progress">
      {(['setup', 'deposit'] as const).map((step, index) => {
        const done =
          step === 'setup'
            ? journey.step === 'deposit' || complete
            : journey.step === step && complete;
        const active = journey.step === step && !done;
        return (
          <li
            key={step}
            data-state={done ? 'complete' : active ? (failed ? 'error' : 'active') : 'waiting'}
            aria-current={active ? 'step' : undefined}
          >
            <span className="deposit-step-icon" aria-hidden="true">
              {done ? (
                <Check size={15} />
              ) : active && working ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                index + 1
              )}
            </span>
            <span>
              <strong>{step === 'setup' ? 'Create Phoenix account' : 'Deposit USDC'}</strong>
              <small>
                {done ? 'Complete' : step === 'setup' ? 'One-time setup' : `${journey.amount} USDC`}
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
