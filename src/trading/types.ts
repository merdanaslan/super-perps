import type {
  TraderStateSnapshotResponse,
  MarginMarketParamsSnapshot,
  SubaccountMarginResult,
  SubaccountMarginInputs,
  MarketLiquidationPriceResult,
} from '@ellipsis-labs/rise';
import type { PreparedTransaction } from './chain';

export type TraderSubaccount = TraderStateSnapshotResponse['snapshot']['subaccounts'][number];
/** Wallet funds are read from Solana independently of Phoenix account availability. */
export interface WalletBalances {
  authority: string;
  walletUsdc: bigint;
  walletSol: bigint;
  slot: number;
  receivedAt: number;
}
export interface WalletTransfer {
  kind: 'send';
  asset: 'SOL' | 'USDC';
  amount: string;
  recipient: string;
  /** SOL only: resolve balance minus the quoted fee before presenting a review. */
  max?: boolean;
}
/** A confirmed account snapshot. Missing venue data stays undefined, never zero-filled. */
export interface TradingAccount {
  authority: string;
  traderAddress: string;
  registered: boolean;
  state?: TraderStateSnapshotResponse;
  subaccount?: TraderSubaccount;
  margin?: SubaccountMarginResult;
  liquidationPrices?: MarketLiquidationPriceResult[];
  inputs?: SubaccountMarginInputs;
  params: MarginMarketParamsSnapshot;
  /** Native USDC base units (6 decimals). */
  walletUsdc: bigint;
  /** Lamports (9 decimals). */
  walletSol: bigint;
  /** Phoenix quote lots (6 decimals); distinct from equity and withdrawable collateral. */
  freeMargin: bigint;
  /** Local receipt time in milliseconds, used with the chain slot to reject stale data. */
  receivedAt: number;
  slot: number;
  conditionals: {
    index: number;
    symbol: string;
    sequence: string;
    takeProfit?: string;
    stopLoss?: string;
    takeProfitDirection?: 'greater' | 'less';
    stopLossDirection?: 'greater' | 'less';
  }[];
}
/** Decimal strings are user units; convert to exact lots/ticks only at the venue boundary. */
export interface OrderRequest {
  kind: 'order';
  symbol: string;
  side: 'long' | 'short';
  orderType: 'market' | 'limit';
  baseUnits: string;
  limitPrice?: string;
  reduceOnly: boolean;
  takeProfit?: string;
  stopLoss?: string;
}
export type Action =
  | OrderRequest
  | WalletTransfer
  | { kind: 'setup'; referralCode?: string }
  | { kind: 'deposit'; amount: string }
  | { kind: 'withdraw'; amount: string; recipient?: string }
  | { kind: 'cancel'; symbol: string; sequence: string; priceTicks: string }
  | {
      kind: 'cancelConditional';
      symbol: string;
      index: number;
      sequence: string;
      leg: 'TP' | 'SL';
    };
/** The review describes these exact simulated bytes, not permission to rebuild a later order. */
export interface ReviewPlan extends PreparedTransaction {
  action: Action;
  title: string;
  details: [string, string][];
  extraSigner?: string;
}
