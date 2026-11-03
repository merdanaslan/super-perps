import { useLayoutEffect, useState } from 'react';
import { Copy, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useWalletSession } from '../wallet/session';
import { WalletStatus } from '../wallet/WalletStatus';
import { useTrading } from '../trading/state';
import { fromLots } from '../trading/math';
import { Sheet } from './components/Sheet';
import { SelectionTabs } from './components/SelectionTabs';
import { usdc } from './format';
import { config } from '../config';
import { referralCode } from '../trading/monetization';
import { FundingWithdrawal } from './FundingWithdrawal';
import { needsAccountSetup } from '../trading/deposit-journey';
import { normalizeDecimalInput } from './decimal-input';

export type FundingTab = 'receive' | 'deposit' | 'withdraw';
export function Funding({
  open,
  close,
  initialTab = 'receive',
}: {
  open: boolean;
  close: () => void;
  initialTab?: FundingTab;
}) {
  const wallet = useWalletSession();
  const trading = useTrading();
  // Attribution belongs to this app's configuration, never a URL or saved user draft.
  const code = config.referralCode.trim();
  let validCode = true;
  try {
    referralCode(code);
  } catch {
    validCode = false;
  }
  const [tab, setTab] = useState<FundingTab>(initialTab);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  // Keep the dialog mounted through its exit transition, but start each new
  // opening with a fresh draft and the requested funding tab.
  useLayoutEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setAmount('');
    setMessage('');
  }, [open, initialTab]);
  const account = trading.account;
  const setup = account && needsAccountSetup(account);
  const needsSetup = setup && tab === 'deposit';
  const available = account?.walletUsdc;
  const act = async () => {
    close();
    await trading.reviewDeposit(amount, code);
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Your funds"
      description="USDC collateral and wallet transfers on Solana."
      // Like Search, keep the form's top edge anchored while the keyboard resizes.
      fullHeight={wallet.authenticated && Boolean(wallet.selected)}
      contentKey={tab}
    >
      {!wallet.authenticated ? (
        <div className="funding-welcome">
          <Wallet size={35} />
          <p>Sign up or log in to access your wallet.</p>
          <button
            className="primary-button full-width"
            disabled={!wallet.ready || !wallet.configured}
            onClick={() => {
              close();
              wallet.login();
            }}
          >
            Sign up / Log in
          </button>
        </div>
      ) : !wallet.selected ? (
        <WalletStatus />
      ) : (
        <>
          <SelectionTabs
            className="funding-tabs segmented"
            variant="pill"
            label="Funding actions"
            value={tab}
            options={[
              { value: 'receive', label: 'Receive' },
              { value: 'deposit', label: 'Deposit' },
              { value: 'withdraw', label: 'Withdraw' },
            ]}
            onChange={(value) => {
              setTab(value);
              setAmount('');
              setMessage('');
            }}
          />
          {tab === 'receive' ? (
            <div className="receive-wallet">
              <h3>Fund your wallet</h3>
              <p className="receive-network">USDC + SOL · Solana network</p>
              <div className="wallet-qr">
                <QRCodeSVG
                  value={wallet.selected}
                  size={156}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  marginSize={3}
                />
              </div>
              <p>
                Send USDC for trading and SOL for network fees and account setup. Use the same
                wallet address below for both, on Solana only.
              </p>
              <code>{wallet.selected}</code>
              <button
                className="secondary-button full-width"
                onClick={() =>
                  void navigator.clipboard.writeText(wallet.selected!).then(
                    () => setMessage('Wallet address copied.'),
                    () => setMessage('Copy the wallet address shown above.'),
                  )
                }
              >
                <Copy size={16} />
                Copy wallet address
              </button>
              <p className="quiet-note">
                After your funds arrive, choose Deposit to move USDC into your Phoenix account. Only
                USDC is used as trading collateral here. SOL stays in your wallet for fees.
              </p>
            </div>
          ) : tab === 'withdraw' ? (
            <FundingWithdrawal key={`${open}-${wallet.selected}`} close={close} />
          ) : (
            <>
              <div className="funding-flow">
                <span>Solana wallet</span>
                <span>→</span>
                <span>Phoenix collateral</span>
              </div>
              {needsSetup ? (
                <>
                  <div className="info-panel">
                    <strong>Set up your trading account</strong>
                    <p>
                      Your first deposit has two confirmations: create your Phoenix account, then
                      deposit USDC. Enter the amount below. We’ll guide you through both, including
                      the SOL setup cost.
                    </p>
                  </div>
                  {!validCode ? (
                    <p className="form-error" role="alert">
                      This app’s referral configuration is invalid. Contact the app operator before
                      setting up your account.
                    </p>
                  ) : code ? (
                    <p className="quiet-note">
                      This app’s referral code, <strong>{code}</strong>, will be included in your
                      activation review. An accepted referral may lower Phoenix exchange fees and
                      reward the app operator. The relationship is permanent.
                      <br />
                      First, verify wallet ownership with a Phoenix sign-in message. Then review and
                      sign account activation.
                    </p>
                  ) : null}
                </>
              ) : null}
              <>
                <label className="funding-amount">
                  <span>
                    Amount <small>USDC</small>
                  </span>
                  <input
                    aria-label="Amount in USDC"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(normalizeDecimalInput(e.target.value))}
                  />
                </label>
                <div className="funding-available">
                  <span>
                    Wallet balance:{' '}
                    {available !== undefined && !trading.stale
                      ? usdc(Number(fromLots(available, 6)))
                      : '—'}{' '}
                    USDC
                  </span>
                  <button
                    className="text-button"
                    disabled={available === undefined || trading.stale}
                    onClick={() => setAmount(fromLots(available!, 6))}
                  >
                    Max
                  </button>
                </div>
              </>
              {trading.error && <p className="form-error">{trading.error}</p>}
              <button
                className="primary-button full-width"
                disabled={
                  trading.busy || trading.stale || !account || (needsSetup && !validCode) || !amount
                }
                onClick={() => void act()}
              >
                {needsSetup
                  ? code.trim()
                    ? 'Verify wallet & review setup'
                    : 'Review setup & deposit'
                  : 'Review deposit'}
              </button>
              <p className="quiet-note funding-note">
                Deposited USDC becomes shared collateral for your cross-margin positions. Phoenix
                may apply a withdrawal cooldown after a deposit.
              </p>
            </>
          )}
          <p className="account-feedback" role="status">
            {message}
          </p>
        </>
      )}
    </Sheet>
  );
}
