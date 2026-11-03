import { address, createNoopSigner, isOffCurveAddress, type Instruction } from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import type { RpcAccount, RpcCall } from './chain';
import { USDC_MINT } from './tokens';

/** This MVP accepts ordinary Solana wallet addresses, not token accounts or program vaults. */
export function withdrawalRecipient(value: string) {
  let recipient;
  try {
    recipient = address(value.trim());
  } catch {
    throw new Error('Enter a valid Solana wallet address.');
  }
  if (recipient === SYSTEM_PROGRAM_ADDRESS || isOffCurveAddress(recipient))
    throw new Error('Enter a Solana wallet address, not a program or token account.');
  return recipient;
}

export async function assertWalletRecipient(rpc: RpcCall, recipient: string) {
  const { value: destinationAccount } = await rpc<{
    value: (RpcAccount & { executable?: boolean }) | null;
  }>('getAccountInfo', [recipient, { commitment: 'confirmed', encoding: 'base64' }]);
  if (
    destinationAccount &&
    (destinationAccount.owner !== SYSTEM_PROGRAM_ADDRESS ||
      destinationAccount.executable ||
      destinationAccount.data[0] !== '')
  )
    throw new Error(
      'The destination is not a regular Solana wallet. Use its wallet address, not a token account.',
    );
}

/** Shared by wallet sends and atomic Phoenix withdrawals; never wraps or swaps assets. */
export async function usdcTransferInstructions(
  authority: string,
  recipient: string,
  amount: bigint,
) {
  if (amount <= 0n || amount > 18_446_744_073_709_551_615n)
    throw new Error('Enter a positive USDC amount within the transfer limit.');
  const owner = address(authority);
  const destinationOwner = withdrawalRecipient(recipient);
  const mint = address(USDC_MINT);
  const [[source], [destination]] = await Promise.all([
    findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    findAssociatedTokenPda({ owner: destinationOwner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
  ]);
  const signer = createNoopSigner(owner);
  return [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: signer,
      ata: destination,
      owner: destinationOwner,
      mint,
    }),
    getTransferCheckedInstruction({
      source,
      mint,
      destination,
      authority: signer,
      amount,
      decimals: 6,
    }),
  ];
}

/** Append an exact transfer after Ember unwraps the withdrawal to the user's USDC ATA.
 * The withdrawal and onward transfer share a transaction: neither can succeed on its own.
 */
export async function withdrawalInstructions({
  authority,
  recipient: requestedRecipient,
  amount,
  phoenixInstructions,
  rpc,
}: {
  authority: string;
  recipient: string;
  amount: bigint;
  phoenixInstructions: readonly Instruction[];
  rpc: RpcCall;
}): Promise<Instruction[]> {
  if (amount <= 0n || amount > 18_446_744_073_709_551_615n)
    throw new Error('Enter a positive USDC amount within the transfer limit.');
  if (!phoenixInstructions.length) throw new Error('Missing Phoenix withdrawal instructions.');
  const owner = address(authority);
  const recipient = withdrawalRecipient(requestedRecipient);
  if (recipient === owner) return [...phoenixInstructions];

  await assertWalletRecipient(rpc, recipient);
  return [...phoenixInstructions, ...(await usdcTransferInstructions(owner, recipient, amount))];
}
