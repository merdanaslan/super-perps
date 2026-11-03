import { useState } from 'react';
import { useWalletSession } from '../wallet/session';
import { useTrading } from '../trading/state';
import { fromLots, toLots } from '../trading/math';
import { withdrawalRecipient } from '../trading/withdrawal';
import { needsAccountSetup } from '../trading/deposit-journey';
import { SelectionTabs } from './components/SelectionTabs';
import { normalizeDecimalInput } from './decimal-input';

/** Phoenix collateral and wallet funds are separate sources, not an implicit sweep. */
export function FundingWithdrawal({ close }: { close: () => void }) {
  const wallet = useWalletSession();
  const trading = useTrading();
  const [asset, setAsset] = useState<'USDC' | 'SOL'>('USDC');
  const [source, setSource] = useState<'phoenix' | 'wallet'>(() =>
    trading.account && !needsAccountSetup(trading.account) ? 'phoenix' : 'wallet',
  );
  const [amount, setAmount] = useState('');
  const [max, setMax] = useState(false);
  const [recipient, setRecipient] = useState('');
  const walletSource = asset === 'SOL' || source === 'wallet';
  const stale = walletSource ? trading.walletStale : trading.stale;
  const error = walletSource ? trading.walletError : trading.error;
  const balances = trading.walletBalances;
  const available = walletSource
    ? balances && (asset === 'SOL' ? balances.walletSol : balances.walletUsdc)
    : trading.account &&
      BigInt(trading.account.margin?.margin.withdrawableQuoteCollateralQuoteLots ?? '0');
  const decimals = asset === 'SOL' ? 9 : 6;
  let recipientError = '';
  let amountError = '';
  if (recipient) {
    try {
      const destination = withdrawalRecipient(recipient);
      if (walletSource && destination === wallet.selected)
        recipientError = 'Choose a destination other than your app wallet.';
    } catch (cause) {
      recipientError = (cause as Error).message;
    }
  }
  if (amount && !max) {
    try {
      const units = toLots(amount, decimals, `${asset} amount`);
      if (!stale && available !== undefined && units > available)
        amountError = `Not enough ${asset} in ${walletSource ? 'your wallet' : 'withdrawable collateral'}.`;
    } catch (cause) {
      amountError = (cause as Error).message;
    }
  }
  const clearAmount = () => {
    setAmount('');
    setMax(false);
  };
  const review = () => {
    close();
    void trading.review(
      walletSource
        ? { kind: 'send', asset, amount, max, recipient: recipient.trim() }
        : { kind: 'withdraw', amount, recipient: recipient.trim() },
    );
  };
  return (
    <>
      <div className="funding-choice">
        <span>Asset</span>
        <SelectionTabs
          className="segmented"
          variant="pill"
          label="Withdrawal asset"
          value={asset}
          options={[
            { value: 'USDC', label: 'USDC' },
            { value: 'SOL', label: 'SOL' },
          ]}
          onChange={(value) => {
            setAsset(value);
            clearAmount();
          }}
        />
      </div>
      {asset === 'USDC' && (
        <div className="funding-choice">
          <span>From</span>
          <SelectionTabs
            className="segmented"
            variant="pill"
            label="USDC source"
            value={source}
            options={[
              { value: 'phoenix', label: 'Phoenix collateral' },
              { value: 'wallet', label: 'Wallet' },
            ]}
            onChange={(value) => {
              setSource(value);
              clearAmount();
            }}
          />
        </div>
      )}
      <div className="funding-flow">
        <span>{walletSource ? 'App wallet' : 'Phoenix collateral'}</span>
        <span>→</span>
        <span>Destination wallet</span>
      </div>
      <label className="funding-amount">
        <span>
          Amount <small>{asset}</small>
        </span>
        <input
          aria-label={`Amount in ${asset}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={max ? 'Max after fees' : '0.00'}
          value={amount}
          aria-invalid={!!amountError}
          onChange={(event) => {
            setMax(false);
            setAmount(normalizeDecimalInput(event.target.value));
          }}
        />
      </label>
      <div className="funding-available">
        <span>
          {walletSource ? 'Wallet balance' : 'Withdrawable'}:{' '}
          {available !== undefined && !stale ? fromLots(available, decimals) : '—'} {asset}
        </span>
        <button
          className="text-button"
          disabled={available === undefined || available === 0n || stale}
          aria-pressed={max}
          onClick={() => {
            setMax(asset === 'SOL');
            setAmount(asset === 'SOL' ? '' : fromLots(available!, decimals));
          }}
        >
          Max
        </button>
      </div>
      {amountError && (
        <p className="form-error" role="alert">
          {amountError}
        </p>
      )}
      {asset === 'SOL' && (
        <p className="quiet-note">
          {max
            ? 'Max deducts this transfer’s network fee. Review the exact amount next. You will need to add SOL again for future transactions.'
            : 'Keep some SOL for future network fees. Max sends the balance after this transfer’s fee.'}
        </p>
      )}
      <div className="funding-recipient">
        <div className="funding-recipient-label">
          <label htmlFor="withdrawal-recipient">Destination wallet</label>
          {!walletSource && (
            <button className="text-button" onClick={() => setRecipient(wallet.selected!)}>
              Use my app wallet
            </button>
          )}
        </div>
        <input
          id="withdrawal-recipient"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="Solana wallet address"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!recipientError}
          aria-describedby="withdrawal-recipient-help"
        />
        <p id="withdrawal-recipient-help" className={recipientError ? 'form-error' : 'quiet-note'}>
          {recipientError ||
            `${asset} on Solana only. Enter a wallet address, not a token account. Destinations requiring a memo are not supported.`}
        </p>
      </div>
      {!walletSource && available === 0n && (
        <p className="quiet-note">
          There is no Phoenix collateral available to withdraw. Choose Wallet for funds held in your
          app wallet.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button full-width"
        disabled={
          (walletSource ? trading.walletBusy : trading.busy) ||
          stale ||
          available === undefined ||
          available === 0n ||
          (!amount && !max) ||
          !!amountError ||
          !recipient.trim() ||
          !!recipientError
        }
        onClick={review}
      >
        {walletSource ? 'Review transfer' : 'Review withdrawal'}
      </button>
      <p className="quiet-note funding-note">
        {walletSource
          ? `Send ${asset} directly from your wallet. Phoenix collateral stays in your trading account.${asset === 'USDC' ? ' Creating a recipient’s USDC account may also require SOL for rent.' : ''}`
          : 'Withdraw USDC from Phoenix and send it to your destination in one transaction. Open positions, orders and cooldowns affect what you can withdraw.'}
      </p>
    </>
  );
}
