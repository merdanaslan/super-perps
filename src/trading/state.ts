import { createContext, useContext } from 'react';
import type { TradingAccount, Action, WalletBalances } from './types';
import type { Receipt } from './chain';

interface TradingContextValue {
  account?: TradingAccount;
  walletBalances?: WalletBalances;
  walletError: string;
  walletStale: boolean;
  walletBusy: boolean;
  loading: boolean;
  error: string;
  busy: boolean;
  stale: boolean;
  refresh: () => Promise<void>;
  review: (action: Action, onConfirmed?: () => void) => Promise<void>;
  reviewDeposit: (amount: string, referralCode?: string) => Promise<void>;
  openStatus: () => void;
  receipt?: Receipt;
}
export const TradingContext = createContext<TradingContextValue | null>(null);
export const useTrading = () => {
  const value = useContext(TradingContext);
  if (!value) throw new Error('TradingProvider required.');
  return value;
};
