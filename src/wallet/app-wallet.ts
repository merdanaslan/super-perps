type LinkedAccount = {
  type: string;
  address?: string;
  chainType?: string;
  walletClientType?: string;
  walletIndex?: number | null;
  imported?: boolean;
};

/** Resolve the authenticated user's primary embedded wallet, never an arbitrary connector. */
export function resolveAppWallet<T extends { address: string }>({
  ready,
  authenticated,
  walletsReady,
  user,
  wallets,
}: {
  ready: boolean;
  authenticated: boolean;
  walletsReady: boolean;
  user?: { id: string; linkedAccounts: readonly LinkedAccount[] } | null;
  wallets: readonly T[];
}): T | undefined {
  if (!ready || !authenticated || !walletsReady || !user?.id) return;
  const embedded = user.linkedAccounts.filter(
    (account) =>
      account.type === 'wallet' &&
      account.chainType === 'solana' &&
      ['privy', 'privy-v2'].includes(account.walletClientType ?? '') &&
      !account.imported &&
      !!account.address,
  );
  const primary = embedded.filter((account) => account.walletIndex === 0);
  // Older Privy accounts may not expose an HD index. Accept only a single wallet.
  const candidates = primary.length
    ? primary
    : embedded.length === 1 && embedded[0]?.walletIndex == null
      ? embedded
      : [];
  const addresses = [...new Set(candidates.map((account) => account.address!))];
  if (addresses.length !== 1) return;
  return wallets.find((wallet) => wallet.address === addresses[0]);
}
