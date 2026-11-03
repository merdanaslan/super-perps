import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { config } from '../config';
import { useWalletSession } from '../wallet/session';
import { Sheet } from '../app/components/Sheet';
import { requireOnline, useOnline } from '../pwa/connectivity';
import { TradingService } from './service';
import type { Action, ReviewPlan, TradingAccount, WalletBalances } from './types';
import { checkReceipt, type Receipt } from './chain';
import { executeReviewed } from './execute';
import { toLots } from './math';
import { isDepositJourney, needsAccountSetup, type DepositJourney } from './deposit-journey';
import { TransactionReview, TransactionReviewAction } from './TransactionReview';
import { DepositProgress } from './DepositProgress';
import { reconcileReceipt } from './receipt';
import { TradingContext } from './state';
import { referralCode } from './monetization';
import {
  receiptMessage,
  safeDiagnostic,
  transactionProblem,
  type TransactionProblem,
} from './feedback';

// Keep the pre-rebrand storage key and Web Lock name. Old tabs must still share
// the transaction lock, and pending receipts must survive the super perps rename.
const JOURNAL = 'zupa.transaction.v1';
function storedReceipt(): Receipt | undefined {
  const raw = localStorage.getItem(JOURNAL);
  if (!raw) return;
  const data = JSON.parse(raw) as Receipt;
  if (
    !data ||
    !/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(data.signature) ||
    !['pending', 'confirmed', 'failed', 'expired'].includes(data.state) ||
    !Number.isSafeInteger(data.lifetime?.lastValidBlockHeight) ||
    (data.depositJourney !== undefined &&
      (!isDepositJourney(data.depositJourney) || data.depositJourney.step !== data.actionKind))
  )
    throw new Error(
      'Transaction recovery data is unreadable. Check your wallet history before clearing site data.',
    );
  return data;
}
/**
 * Owns the review → sign → submit → reconcile lifecycle for every screen.
 * Keep wallet identity checks, cross-tab locking and the receipt journal together:
 * a delayed response must never authorize a new wallet or a duplicate transaction.
 */
export function TradingProvider({ children }: { children: ReactNode }) {
  const online = useOnline();
  const wallet = useWalletSession();
  const liveWallet = useRef(wallet);
  liveWallet.current = wallet;
  const service = useRef<TradingService | null>(null);
  const getService = useCallback(
    () =>
      (service.current ??= new TradingService(config.phoenixApiUrl, config.solanaRpcUrl, config)),
    [],
  );
  useEffect(
    () => () => {
      service.current?.dispose();
      service.current = null;
    },
    [],
  );
  const [account, setAccount] = useState<TradingAccount>();
  const [walletBalances, setWalletBalances] = useState<WalletBalances>();
  const [walletError, setWalletError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txError, setTxError] = useState<TransactionProblem>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [plan, setPlan] = useState<ReviewPlan>();
  const reviewCallback = useRef<{ plan: ReviewPlan; run: () => void } | undefined>(undefined);
  const confirmationCallback = useRef<
    | {
        signature: string;
        authority: string;
        run: () => void;
      }
    | undefined
  >(undefined);
  const [journey, setJourney] = useState<DepositJourney>();
  const continuedSetup = useRef<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [dismissOnSuccess, setDismissOnSuccess] = useState(false);
  const [phase, setPhase] = useState<
    'idle' | 'authenticating' | 'preparing' | 'signing' | 'submitting'
  >('idle');
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const reading = useRef<number | undefined>(undefined);
  const walletReading = useRef<{ token: number; promise: Promise<WalletBalances> } | undefined>(
    undefined,
  );
  const generation = useRef(0);
  const recoveryError = useRef('');
  const save = useCallback((next: Receipt) => {
    localStorage.setItem(JOURNAL, JSON.stringify(next));
    setReceipt(next);
  }, []);
  // Call while holding the same origin-wide lock as signing and submission.
  const updateSaved = useCallback(
    (next: Receipt) => {
      const merged = reconcileReceipt(storedReceipt(), next);
      if (merged) save(merged);
      else setReceipt(undefined);
    },
    [save],
  );
  const refresh = useCallback(async () => {
    const owner = liveWallet.current.selected;
    if (!owner || !liveWallet.current.authenticated) return;
    const token = generation.current;
    const current = () => generation.current === token && liveWallet.current.selected === owner;
    const balances =
      walletReading.current?.token === token
        ? walletReading.current.promise
        : getService().readWallet(owner);
    walletReading.current = { token, promise: balances };
    const walletRefresh = balances
      .then(
        (data) => {
          if (current()) {
            setWalletBalances(data);
            setWalletError('');
          }
        },
        (cause) => {
          if (current()) {
            setWalletBalances(undefined);
            setWalletError(cause instanceof Error ? cause.message : 'Wallet balances unavailable.');
          }
        },
      )
      .finally(() => {
        if (walletReading.current?.promise === balances) walletReading.current = undefined;
      });
    // Keep refreshing wallet funds even while the venue request is slow. Both
    // readers share this request when starting together, without duplicate RPCs.
    if (reading.current === token) {
      await walletRefresh;
      return;
    }
    reading.current = token;
    setLoading(true);
    try {
      await Promise.all([
        walletRefresh,
        getService()
          .readAccount(owner, balances)
          .then(
            (data) => {
              if (current()) {
                setAccount(data);
                setError('');
              }
            },
            (cause) => {
              if (current()) {
                setError(cause instanceof Error ? cause.message : 'Account unavailable.');
                setAccount(undefined);
              }
            },
          ),
      ]);
    } finally {
      if (reading.current === token) reading.current = undefined;
      if (generation.current === token) setLoading(false);
    }
  }, [getService]);
  useEffect(() => {
    generation.current++;
    service.current?.referralAuth.clear();
    setAccount(undefined);
    setWalletBalances(undefined);
    setWalletError('');
    setError('');
    setPlan(undefined);
    setJourney(undefined);
    setDismissOnSuccess(false);
    continuedSetup.current = undefined;
    setTxError(undefined);
    setLoading(false);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8_000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [wallet.selected, wallet.authenticated, refresh]);
  useEffect(() => {
    const read = () => {
      try {
        setReceipt(storedReceipt());
        recoveryError.current = '';
      } catch (cause) {
        recoveryError.current =
          cause instanceof Error ? cause.message : 'Transaction recovery storage unavailable.';
        setTxError(transactionProblem(recoveryError.current));
      }
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (receipt?.state !== 'pending') return;
    let ended = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const updated = await checkReceipt(getService().rpc, receipt);
        if (ended) return;
        if (updated.state !== 'pending' && navigator.locks) {
          const saved = await navigator.locks.request(
            'zupa-financial-action',
            { ifAvailable: true },
            (lock) => {
              if (!lock || ended) return false;
              updateSaved(updated);
              return true;
            },
          );
          if (saved) {
            void refresh();
            return;
          }
        }
      } catch {
        /* Preserve the unresolved receipt, including across reloads. */
      }
      if (!ended) timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => {
      ended = true;
      clearTimeout(timer);
    };
  }, [receipt, refresh, updateSaved, getService]);
  const selectedAccount =
    account?.authority === wallet.selected && wallet.authenticated ? account : undefined;
  const selectedBalances =
    walletBalances?.authority === wallet.selected && wallet.authenticated
      ? walletBalances
      : undefined;
  const snapshotSlot =
    receipt?.actionKind === 'send' ? selectedBalances?.slot : selectedAccount?.slot;
  const awaitingSnapshot =
    receipt?.state === 'confirmed' &&
    receipt.authority === wallet.selected &&
    (snapshotSlot === undefined || snapshotSlot < (receipt.slot ?? 0));
  const awaitingWalletSnapshot =
    receipt?.state === 'confirmed' &&
    receipt.authority === wallet.selected &&
    (!selectedBalances || selectedBalances.slot < (receipt.slot ?? 0));
  const pending = receipt?.state === 'pending';
  useEffect(() => {
    const callback = confirmationCallback.current;
    if (!callback) return;
    if (
      !wallet.authenticated ||
      wallet.selected !== callback.authority ||
      (receipt?.signature === callback.signature && ['failed', 'expired'].includes(receipt.state))
    ) {
      confirmationCallback.current = undefined;
      return;
    }
    if (
      receipt?.signature === callback.signature &&
      receipt.state === 'confirmed' &&
      !awaitingSnapshot
    ) {
      confirmationCallback.current = undefined;
      callback.run();
    }
  }, [receipt, wallet.authenticated, wallet.selected, awaitingSnapshot]);
  const review = useCallback(
    async (action: Action, depositJourney?: DepositJourney, onConfirmed?: () => void) => {
      if (busy.current) return;
      setOpen(true);
      setDismissOnSuccess(false);
      setTxError(undefined);
      setPlan(undefined);
      reviewCallback.current = undefined;
      setJourney(depositJourney);
      try {
        requireOnline();
        if (recoveryError.current) throw new Error(recoveryError.current);
        if (storedReceipt()?.state === 'pending')
          throw new Error('A transaction is still being checked. Wait for its result.');
        if (action.kind === 'send' ? awaitingWalletSnapshot : awaitingSnapshot)
          throw new Error(
            'Your last transaction is confirmed. Waiting for account balances to catch up.',
          );
        if (!wallet.selected || !wallet.authenticated)
          throw new Error('Your app wallet is still connecting. Try again when it is ready.');
        if (depositJourney) {
          const amount = toLots(depositJourney.amount, 6, 'USDC amount');
          if (!selectedAccount)
            throw new Error('Waiting for your wallet balance. Please try again shortly.');
          if (amount > selectedAccount.walletUsdc)
            throw new Error('Not enough USDC in your wallet.');
        }
        busy.current = true;
        setPhase('preparing');
        const owner = wallet.selected;
        const token = generation.current;
        if (action.kind === 'setup' && referralCode(action.referralCode ?? '')) {
          if (!wallet.signMessage)
            throw new Error('This wallet cannot authenticate with Phoenix for referrals.');
          setPhase('authenticating');
          await getService().referralAuth.authenticate(
            owner,
            wallet.signMessage,
            () =>
              generation.current === token &&
              liveWallet.current.selected === owner &&
              liveWallet.current.authenticated,
          );
          setPhase('preparing');
        }
        const prepared = await getService().prepare(owner, action);
        if (
          generation.current !== token ||
          liveWallet.current.selected !== owner ||
          !liveWallet.current.authenticated
        )
          throw new Error('Wallet changed. Review again.');
        setPlan(prepared);
        if (onConfirmed) reviewCallback.current = { plan: prepared, run: onConfirmed };
      } catch (cause) {
        setTxError(transactionProblem(cause));
      } finally {
        busy.current = false;
        setPhase('idle');
      }
    },
    [
      awaitingSnapshot,
      awaitingWalletSnapshot,
      wallet.selected,
      wallet.authenticated,
      selectedAccount,
      getService,
    ],
  );
  const reviewAction = useCallback(
    (action: Action, onConfirmed?: () => void) => review(action, undefined, onConfirmed),
    [review],
  );
  const reviewDeposit = useCallback(
    async (amount: string, code = '') => {
      const step = selectedAccount && needsAccountSetup(selectedAccount) ? 'setup' : 'deposit';
      await review(
        step === 'setup' ? { kind: 'setup', referralCode: code } : { kind: 'deposit', amount },
        { amount, step },
      );
    },
    [selectedAccount, review],
  );

  // Advance only a user-requested deposit after its setup receipt and account state agree.
  // This opens a fresh review; it never requests the next signature automatically.
  useEffect(() => {
    if (
      !open ||
      phase !== 'idle' ||
      plan ||
      txError ||
      busy.current ||
      receipt?.state !== 'confirmed' ||
      receipt.actionKind !== 'setup' ||
      receipt.depositJourney?.step !== 'setup' ||
      receipt.authority !== wallet.selected ||
      !wallet.authenticated ||
      !selectedAccount ||
      awaitingSnapshot ||
      needsAccountSetup(selectedAccount) ||
      continuedSetup.current === receipt.signature
    )
      return;
    continuedSetup.current = receipt.signature;
    const amount = receipt.depositJourney.amount;
    void review({ kind: 'deposit', amount }, { amount, step: 'deposit' });
  }, [
    open,
    phase,
    plan,
    txError,
    receipt,
    wallet.selected,
    wallet.authenticated,
    selectedAccount,
    awaitingSnapshot,
    review,
  ]);

  async function confirm() {
    if (!plan || busy.current) return;
    busy.current = true;
    setDismissOnSuccess(true);
    setPhase('signing');
    setTxError(undefined);
    try {
      requireOnline();
      if (!navigator.locks)
        throw new Error('Use a current browser with secure transaction locking support.');
      await navigator.locks.request(
        'zupa-financial-action',
        { ifAvailable: true },
        async (lock) => {
          requireOnline();
          if (!lock) throw new Error('Another tab is processing a transaction.');
          const previous = storedReceipt();
          if (previous?.state === 'pending')
            throw new Error('A previous transaction is still pending.');
          if (previous && previous.createdAt > plan.preparedAt)
            throw new Error('Another transaction changed your account. Refresh this review.');
          const signer = liveWallet.current.signTransaction;
          if (!signer) throw new Error('Wallet signing is unavailable.');
          const next = await executeReviewed(plan, {
            currentAuthority: () =>
              liveWallet.current.authenticated ? liveWallet.current.selected : undefined,
            sign: signer,
            onSigned: () => {
              setPlan(undefined);
              setPhase('submitting');
            },
            blockHeight: () =>
              getService().rpc<number>('getBlockHeight', [{ commitment: 'confirmed' }]),
            persist: (saved) => {
              save({ ...saved, depositJourney: journey });
              if (reviewCallback.current?.plan === plan) {
                confirmationCallback.current = {
                  signature: saved.signature,
                  authority: saved.authority,
                  run: reviewCallback.current.run,
                };
                reviewCallback.current = undefined;
              }
            },
            broadcast: (p, signed) => getService().broadcast(p, signed),
          });
          updateSaved({ ...next, depositJourney: journey });
          setPlan(undefined);
        },
      );
    } catch (cause) {
      setTxError(transactionProblem(cause));
      setPlan(undefined);
    } finally {
      busy.current = false;
      setPhase('idle');
    }
  }
  const stale =
    !online || !selectedAccount || now - selectedAccount.receivedAt > 20_000 || !!awaitingSnapshot;
  const walletStale =
    !online ||
    !selectedBalances ||
    now - selectedBalances.receivedAt > 20_000 ||
    !!awaitingWalletSnapshot;
  const currentReceipt = !plan && phase === 'idle' && (!txError || pending) ? receipt : undefined;
  const visibleJourney =
    journey ??
    (currentReceipt && currentReceipt.authority === wallet.selected
      ? currentReceipt.depositJourney
      : undefined);
  const depositComplete =
    currentReceipt?.state === 'confirmed' &&
    currentReceipt.actionKind === 'deposit' &&
    !awaitingSnapshot;
  const setupReady =
    currentReceipt?.state === 'confirmed' &&
    currentReceipt.actionKind === 'setup' &&
    currentReceipt.depositJourney?.step === 'setup' &&
    currentReceipt.authority === wallet.selected;
  const canRetryJourney =
    !!visibleJourney &&
    phase === 'idle' &&
    !pending &&
    !awaitingSnapshot &&
    !plan &&
    (!!txError || currentReceipt?.state === 'failed' || currentReceipt?.state === 'expired');
  const completedSignature =
    open &&
    dismissOnSuccess &&
    currentReceipt?.state === 'confirmed' &&
    currentReceipt.authority === wallet.selected &&
    wallet.authenticated &&
    !awaitingSnapshot &&
    !setupReady
      ? currentReceipt.signature
      : undefined;
  useEffect(() => {
    if (!completedSignature) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      timer = setTimeout(() => {
        setOpen(false);
        setJourney(undefined);
        setDismissOnSuccess(false);
      }, 1000);
    };
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [completedSignature]);
  const openStatus = () => {
    // Explicit receipt inspection stays open; only a just-completed action fades away.
    setDismissOnSuccess(false);
    setOpen(true);
  };
  return (
    <TradingContext.Provider
      value={{
        account: selectedAccount,
        walletBalances: selectedBalances,
        walletError,
        walletStale,
        walletBusy: phase !== 'idle' || !!pending || !!awaitingWalletSnapshot,
        loading,
        error,
        busy: phase !== 'idle' || !!pending || !!awaitingSnapshot,
        stale,
        refresh,
        review: reviewAction,
        reviewDeposit,
        receipt,
        openStatus,
      }}
    >
      {children}
      {(pending || awaitingSnapshot || (setupReady && !open)) && (
        <button className="transaction-status" onClick={openStatus}>
          {pending || awaitingSnapshot ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}
          {pending
            ? 'Checking transaction'
            : awaitingSnapshot
              ? 'Confirmed · refreshing account'
              : 'Account ready · continue deposit'}
          <ArrowUpRight size={15} />
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => {
          if (phase === 'idle') {
            setOpen(false);
            setPlan(undefined);
            setJourney(undefined);
          }
        }}
        title={
          (phase === 'submitting' ? 'Submitting transaction' : undefined) ??
          (phase === 'signing' ? 'Signing transaction' : undefined) ??
          plan?.title ??
          (phase === 'authenticating'
            ? 'Verify wallet with Phoenix'
            : phase === 'preparing'
              ? 'Preparing transaction'
              : currentReceipt
                ? 'Transaction status'
                : 'Transaction')
        }
        footer={
          plan &&
          phase === 'idle' && (
            <TransactionReviewAction
              expired={now - plan.preparedAt > 30_000}
              onRefresh={() =>
                void review(
                  plan.action,
                  journey,
                  reviewCallback.current?.plan === plan ? reviewCallback.current.run : undefined,
                )
              }
              onConfirm={() => void confirm()}
            />
          )
        }
      >
        {visibleJourney && (
          <DepositProgress
            journey={visibleJourney}
            working={phase !== 'idle' || !!pending || !!awaitingSnapshot}
            complete={currentReceipt?.state === 'confirmed' && !awaitingSnapshot}
            failed={
              !!txError || currentReceipt?.state === 'failed' || currentReceipt?.state === 'expired'
            }
          />
        )}
        {phase === 'authenticating' && (
          <div className="transaction-loading">
            <LoaderCircle className="spin" />
            <p>
              Approve the Phoenix sign-in message in your wallet. This verifies ownership; account
              activation is reviewed separately.
            </p>
          </div>
        )}
        {phase === 'preparing' && (
          <div className="transaction-loading">
            <LoaderCircle className="spin" />
            <p>Checking balances and simulating on Solana…</p>
          </div>
        )}
        {phase === 'signing' && (
          <div className="transaction-loading" role="status">
            <LoaderCircle className="spin" />
            <p>Signing your confirmed transaction securely…</p>
          </div>
        )}
        {phase === 'submitting' && (
          <div className="transaction-loading" role="status">
            <LoaderCircle className="spin" />
            <p>Your signature is approved. Submitting the transaction and checking confirmation…</p>
          </div>
        )}
        {txError && (
          <div role="alert">
            <p className="form-error">{txError.message}</p>
            {txError.details && <TransactionDetails detail={txError.details} />}
          </div>
        )}
        {plan && phase === 'idle' && <TransactionReview plan={plan} depositJourney={!!journey} />}
        {currentReceipt && (
          <div className="receipt" role="status">
            {currentReceipt.state === 'confirmed' ? (
              <Check size={30} className="positive" />
            ) : currentReceipt.state === 'pending' ? (
              <LoaderCircle size={30} className="spin" />
            ) : null}
            <h3>
              {currentReceipt.state === 'confirmed'
                ? depositComplete
                  ? 'Deposit complete'
                  : 'Transaction confirmed'
                : currentReceipt.state === 'pending'
                  ? 'Waiting for confirmation'
                  : currentReceipt.state === 'expired'
                    ? 'Transaction expired'
                    : 'Transaction failed'}
            </h3>
            <p>{currentReceipt.label}</p>
            <p>
              {setupReady
                ? 'Your Phoenix account is ready. Preparing your deposit review next.'
                : depositComplete
                  ? 'Your USDC is now in Phoenix collateral. Your balance is up to date.'
                  : receiptMessage(currentReceipt)}
            </p>
            {awaitingSnapshot && (
              <p>
                <LoaderCircle size={15} className="spin" /> Updating your balance…
              </p>
            )}
            {awaitingSnapshot && error && (
              <button className="text-button" onClick={() => void refresh()}>
                Retry balance update
              </button>
            )}
            {currentReceipt.state === 'failed' && currentReceipt.detail && (
              <TransactionDetails detail={currentReceipt.detail} />
            )}
            <a
              className="secondary-button full-width"
              href={`https://explorer.solana.com/tx/${currentReceipt.signature}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Solana Explorer
              <ArrowUpRight size={16} />
            </a>
            {setupReady && !awaitingSnapshot && (
              <button
                className="primary-button full-width"
                onClick={() => void reviewDeposit(currentReceipt.depositJourney!.amount)}
              >
                Continue deposit
              </button>
            )}
            {currentReceipt.state !== 'pending' && !setupReady && (
              <button
                className="text-button"
                onClick={() => {
                  setOpen(false);
                  setJourney(undefined);
                  void refresh();
                }}
              >
                Done
              </button>
            )}
          </div>
        )}
        {canRetryJourney && (
          <button
            className="primary-button full-width"
            disabled={stale}
            onClick={() => void reviewDeposit(visibleJourney.amount, config.referralCode)}
          >
            Review again
          </button>
        )}
        {!plan && phase === 'idle' && !currentReceipt && !txError && (
          <p className="transaction-note">Choose an action to review its amount and network fee.</p>
        )}
      </Sheet>
    </TradingContext.Provider>
  );
}

function TransactionDetails({ detail }: { detail: string }) {
  return (
    <details className="transaction-details">
      <summary>Technical details</summary>
      <p>{safeDiagnostic(detail)}</p>
    </details>
  );
}
