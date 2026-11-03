import { address, getBase64Encoder } from '@solana/kit';
import {
  findAssociatedTokenPda,
  getTokenDecoder,
  getTokenSize,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import type { RpcAccount, RpcCall } from './chain';
import { USDC_MINT } from './tokens';
import type { WalletBalances } from './types';

/** Read native SOL and the canonical USDC ATA at one confirmed Solana slot.
 * This deliberately has no Phoenix dependency, including for a wallet with no trader account.
 */
export async function readWalletBalances(rpc: RpcCall, authority: string): Promise<WalletBalances> {
  const owner = address(authority);
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint: address(USDC_MINT),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const result = await rpc<{
    context: { slot: number };
    value: ((RpcAccount & { executable?: boolean }) | null)[];
  }>('getMultipleAccounts', [[owner, ata], { commitment: 'confirmed', encoding: 'base64' }]);
  if (
    !Number.isSafeInteger(result.context.slot) ||
    result.context.slot <= 0 ||
    result.value.length !== 2
  )
    throw new Error('Wallet balances are unavailable. Refresh and try again.');
  const [native, token] = result.value;
  const lamports = native?.lamports ?? 0;
  if (!Number.isSafeInteger(lamports) || lamports < 0)
    throw new Error('The RPC returned an invalid SOL balance.');
  if (
    native &&
    (native.owner !== SYSTEM_PROGRAM_ADDRESS || native.executable || native.data[0] !== '')
  )
    throw new Error('This account is not a regular Solana wallet.');
  let walletUsdc = 0n;
  if (token) {
    const bytes = getBase64Encoder().encode(token.data[0]);
    if (
      token.owner !== TOKEN_PROGRAM_ADDRESS ||
      token.executable ||
      bytes.length !== getTokenSize()
    )
      throw new Error('Unexpected USDC token account.');
    const decoded = getTokenDecoder().decode(bytes);
    if (decoded.mint !== USDC_MINT || decoded.owner !== owner || decoded.state === 0)
      throw new Error('The USDC account does not match this wallet.');
    walletUsdc = decoded.amount;
  }
  return {
    authority,
    walletSol: BigInt(lamports),
    walletUsdc,
    slot: result.context.slot,
    receivedAt: Date.now(),
  };
}
