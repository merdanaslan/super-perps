import { address, createNoopSigner, type ReadonlyUint8Array } from '@solana/kit';
import { getTransferSolInstruction } from '@solana-program/system';
import {
  compileInstructions,
  MAINNET_GENESIS,
  prepareTransaction,
  simulateTransaction,
  toBase64,
  type Lifetime,
  type PreparedTransaction,
  type RpcCall,
} from './chain';
import { fromLots, toLots } from './math';
import type { ReviewPlan, WalletTransfer } from './types';
import { readWalletBalances } from './wallet-balances';
import { assertWalletRecipient, usdcTransferInstructions, withdrawalRecipient } from './withdrawal';

/** Build a wallet transfer independently of Phoenix, then reuse the normal review/sign journal. */
export async function prepareWalletTransfer(
  rpc: RpcCall,
  authority: string,
  request: WalletTransfer,
): Promise<ReviewPlan> {
  const recipient = withdrawalRecipient(request.recipient);
  if (recipient === authority) throw new Error('Choose a destination other than your app wallet.');
  if (request.asset !== 'SOL' && request.asset !== 'USDC') throw new Error('Choose SOL or USDC.');
  if (request.max && request.asset !== 'SOL') throw new Error('Enter the USDC amount to send.');
  if ((await rpc<string>('getGenesisHash')) !== MAINNET_GENESIS)
    throw new Error('The RPC must connect to Solana mainnet.');
  const [balances] = await Promise.all([
    readWalletBalances(rpc, authority),
    assertWalletRecipient(rpc, recipient),
  ]);
  const decimals = request.asset === 'SOL' ? 9 : 6;
  let amount = request.max ? 0n : toLots(request.amount, decimals, `${request.asset} amount`);
  let prepared: PreparedTransaction;
  let remainingSol: bigint | undefined;
  if (request.asset === 'SOL') {
    const { value: lifetime } = await rpc<{ value: Lifetime }>('getLatestBlockhash', [
      { commitment: 'confirmed' },
    ]);
    const compile = (lamports: bigint) =>
      compileInstructions(authority, lifetime, [
        getTransferSolInstruction({
          source: createNoopSigner(address(authority)),
          destination: recipient,
          amount: lamports,
        }),
      ]);
    const feeFor = async (message: ReadonlyUint8Array) => {
      const { value } = await rpc<{ value: number | null }>('getFeeForMessage', [
        toBase64(message),
        { commitment: 'confirmed' },
      ]);
      if (value === null)
        throw new Error('The transaction expired while estimating fees. Review it again.');
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error('The RPC returned an invalid network fee.');
      return value;
    };
    // A native transfer needs no account creation or dynamic compute budget. Quote its
    // fixed-shape message before simulation so Max never tries to spend the fee itself.
    // No priority-fee instruction is added to this simple SOL transfer.
    const feeLamports = await feeFor(compile(amount).tx.messageBytes);
    if (request.max) amount = balances.walletSol - BigInt(feeLamports);
    if (amount <= 0n || amount + BigInt(feeLamports) > balances.walletSol)
      throw new Error(
        'Not enough SOL for the amount and network fee. Reduce the amount or use Max.',
      );
    const compiled = compile(amount);
    if ((await feeFor(compiled.tx.messageBytes)) !== feeLamports)
      throw new Error('The network fee changed. Review the transfer again.');
    const simulation = await simulateTransaction(rpc, authority, compiled.bytes);
    const accountAfter = simulation.value.accounts?.[0];
    // A fully drained system account is returned as null; an omitted result is not zero.
    const after = accountAfter === null ? 0 : accountAfter?.lamports;
    remainingSol = balances.walletSol - amount - BigInt(feeLamports);
    if (after === undefined || !Number.isSafeInteger(after) || after < 0)
      throw new Error('Simulation did not report the fee-payer balance.');
    if (
      !Number.isSafeInteger(simulation.context.slot) ||
      simulation.context.slot < balances.slot ||
      BigInt(after) !== remainingSol
    )
      throw new Error('Your SOL balance changed while preparing. Review the transfer again.');
    // The transferred principal is not account rent. Only USDC ATA creation can
    // introduce additional rent in the wallet-send flow.
    prepared = {
      authority,
      bytes: compiled.bytes,
      lifetime,
      feeLamports,
      rentLamports: 0,
      preparedAt: Date.now(),
    };
  } else {
    if (amount > balances.walletUsdc)
      throw new Error(
        'Not enough USDC in your wallet. Choose Phoenix collateral if your funds are deposited there.',
      );
    prepared = await prepareTransaction(
      rpc,
      authority,
      await usdcTransferInstructions(authority, recipient, amount),
    );
  }
  const action = { ...request, recipient, amount: fromLots(amount, decimals) };
  const details: [string, string][] = [
    ['Amount', `${action.amount} ${request.asset}`],
    ['From', 'App wallet'],
    ['Destination wallet', recipient],
  ];
  if (remainingSol !== undefined)
    details.push(['SOL left in wallet', `${fromLots(remainingSol, 9)} SOL`]);
  return { ...prepared, action, title: `Send ${request.asset}`, details };
}
