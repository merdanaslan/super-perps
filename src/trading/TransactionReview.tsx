import { shortAddress } from '../app/format';
import { fromLots } from './math';
import type { ReviewPlan } from './types';

/** Disclosure only. The provider owns expiry checks, approval, signing and submission. */
export function TransactionReview({
  plan,
  depositJourney,
}: {
  plan: ReviewPlan;
  depositJourney: boolean;
}) {
  return (
    <>
      {plan.action.kind === 'setup' && (
        <p className="transaction-note">
          This creates your Phoenix trading account using SOL for setup and fees. Your USDC stays in
          your wallet.{' '}
          {depositJourney
            ? 'The deposit review opens automatically after setup confirms. You’ll approve the deposit separately.'
            : 'After setup is confirmed, open Deposit to add collateral.'}
        </p>
      )}
      <dl className="detail-list">
        {plan.details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Network</dt>
          <dd>Solana mainnet</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>{shortAddress(plan.authority)}</dd>
        </div>
        <div>
          <dt>Estimated network fee</dt>
          <dd>{fromLots(BigInt(plan.feeLamports), 9)} SOL</dd>
        </div>
        {plan.rentLamports > 0 && (
          <div>
            <dt>Account rent</dt>
            <dd>{fromLots(BigInt(plan.rentLamports), 9)} SOL</dd>
          </div>
        )}
      </dl>
      {plan.action.kind === 'send' && plan.action.asset === 'SOL' && (
        <p className="transaction-note">
          {plan.action.max
            ? 'Max sends all available SOL after the network fee. You will need to add SOL again before trading, depositing or sending funds.'
            : 'Leave some SOL in your wallet if you plan to keep trading or sending funds. Future transactions require SOL for fees.'}
        </p>
      )}
      <p className="transaction-note">
        {plan.action.kind === 'order'
          ? 'Builder fees, when shown, are additional to Phoenix fees and apply to taking fills on this order. Resting maker fills and later native TP/SL triggers do not earn a builder fee here. Account-specific exchange-fee adjustments may apply.'
          : plan.action.kind === 'setup' && plan.action.referralCode
            ? 'Phoenix validates this code when you activate. A valid referral may reduce exchange fees and compensate its owner. The relationship is permanent; builder fees are separate. No discount or reward is confirmed by this preview.'
            : 'This action uses real funds. Check the amount and wallet before signing.'}
      </p>
    </>
  );
}

/** Render in the sheet footer so the approval control is never clipped by details. */
export function TransactionReviewAction({
  expired,
  onRefresh,
  onConfirm,
}: {
  expired: boolean;
  onRefresh: () => void;
  onConfirm: () => void;
}) {
  return (
    <button className="primary-button full-width" onClick={expired ? onRefresh : onConfirm}>
      {expired ? 'Refresh review' : 'Confirm & sign'}
    </button>
  );
}
