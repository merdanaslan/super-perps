import {
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Decoder,
  getBase64Decoder,
  getTransactionDecoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  type Transaction,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import type { Action } from './types';
import type { DepositJourney } from './deposit-journey';
import { ensureRpcSession, invalidateRpcSession } from '../wallet/rpc-session';

export const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export type RpcCall = <T>(method: string, params?: unknown[]) => Promise<T>;

/** Keep structured RPC errors: a known preflight rejection is not a lost response. */
export class RpcResponseError extends Error {
  constructor(
    readonly method: string,
    readonly code: number | undefined,
    message: string,
    readonly data?: { err?: unknown },
  ) {
    super(message);
  }

  get rejectedBeforeBroadcast() {
    // AlreadyProcessed may mean the signature has landed. Keep checking it.
    return (
      this.method === 'sendTransaction' &&
      [-32002, -32003, -32602].includes(this.code ?? 0) &&
      this.data?.err !== 'AlreadyProcessed' &&
      !/already\s?processed/i.test(this.message)
    );
  }
}

export function createRpcCall(url: string): RpcCall {
  let id = 0;
  return async <T>(method: string, params: unknown[] = []): Promise<T> => {
    await ensureRpcSession(url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      signal: AbortSignal.timeout(18_000),
    });
    if (response.status === 401) invalidateRpcSession();
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'Sign in again to reconnect your wallet.'
          : response.status === 403
            ? 'The RPC rejected this connection. Check the allowed app origin in the server configuration.'
            : `Solana RPC unavailable (${response.status}). Please retry.`,
      );
    const body = (await response.json()) as {
      result?: T;
      error?: { code?: number; message: string; data?: { err?: unknown } };
    };
    if (body.error)
      throw new RpcResponseError(method, body.error.code, body.error.message, body.error.data);
    if (body.result === undefined) throw new Error('Solana RPC returned no result.');
    return body.result;
  };
}
export interface RpcAccount {
  owner: string;
  lamports: number;
  data: [string, string];
}
export interface Lifetime {
  blockhash: string;
  lastValidBlockHeight: number;
}
export interface PreparedTransaction {
  authority: string;
  bytes: Uint8Array;
  lifetime: Lifetime;
  feeLamports: number;
  rentLamports: number;
  preparedAt: number;
}
export const toBase64 = (bytes: ReadonlyUint8Array) => getBase64Decoder().decode(bytes);
export const sameBytes = (a: ReadonlyUint8Array, b: ReadonlyUint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function compileInstructions(
  authority: string,
  lifetime: Lifetime,
  instructions: readonly Instruction[],
) {
  const tx = compileTransaction(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(address(authority), m),
      (m) =>
        setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash(lifetime.blockhash),
            lastValidBlockHeight: BigInt(lifetime.lastValidBlockHeight),
          },
          m,
        ),
      (m) => appendTransactionMessageInstructions(instructions, m),
    ),
  );
  const bytes = new Uint8Array(getTransactionEncoder().encode(tx));
  if (bytes.length > 1232)
    throw new Error(
      'This action exceeds the transaction size limit. Split the action into smaller steps.',
    );
  return { tx, bytes };
}
interface Simulation {
  context: { slot: number };
  value: {
    err: unknown;
    logs: string[] | null;
    unitsConsumed?: number;
    accounts?: (RpcAccount | null)[] | null;
  };
}
/** Simulates unsigned bytes and preserves useful fee, rent and program diagnostics. */
export async function simulateTransaction(
  rpc: RpcCall,
  authority: string,
  bytes: Uint8Array,
  onboarding = false,
): Promise<Simulation> {
  const result = await rpc<Simulation>('simulateTransaction', [
    toBase64(bytes),
    {
      encoding: 'base64',
      commitment: 'confirmed',
      sigVerify: false,
      accounts: { encoding: 'base64', addresses: [authority] },
    },
  ]);
  if (result.value.err) {
    const unsigned = 'No transaction was signed.';
    // The System Program gives the actual shortfall before the generic 0x1
    // failures. Do not discard it, or interpret an arbitrary program's 0x1
    // as an insufficient-SOL error.
    const transfer = result.value.logs
      ?.map((line) => /^Transfer: insufficient lamports (\d+), need (\d+)$/.exec(line))
      .find((match) => match !== null);
    if (transfer?.[1] && transfer[2]) {
      const available = BigInt(transfer[1]);
      const needed = BigInt(transfer[2]);
      if (needed > available) {
        const shortfall = needed - available;
        const sol = `${shortfall / 1_000_000_000n}.${(shortfall % 1_000_000_000n)
          .toString()
          .padStart(9, '0')}`.replace(/\.?0+$/, '');
        throw new Error(
          `Not enough SOL for ${onboarding ? 'Phoenix account setup' : 'this transaction'}. Add at least ${sol} SOL to cover this step, and keep some SOL for later transactions. ${unsigned}`,
        );
      }
    }
    if (result.value.err === 'InsufficientFundsForFee')
      throw new Error(`Add SOL to your wallet to pay the network fee. ${unsigned}`);
    if (
      typeof result.value.err === 'object' &&
      result.value.err !== null &&
      'InsufficientFundsForRent' in result.value.err
    )
      throw new Error(
        `Not enough SOL remains to meet the account rent requirement. Add SOL for account rent and network fees, then review again. ${unsigned}`,
      );
    const logs = result.value.logs ?? [];
    // Phoenix prints an assertion's actual reason on the following log line.
    // Retain that context even if it has none of the generic error keywords.
    const errors = logs.filter(
      (line, index) =>
        /Error|failed|insufficient/i.test(line) ||
        /assert_with_side_effect failed/.test(logs[index - 1] ?? ''),
    );
    const useful = errors?.filter((l) => !/^Program \S+ failed:/.test(l));
    const detail = (useful.length ? useful : errors).slice(-4).join(' ').slice(0, 800);
    throw new Error(
      `Simulation failed. ${detail ? `${detail} ` : ''}${JSON.stringify(result.value.err)} ${unsigned}`,
    );
  }
  return result;
}

export async function prepareTransaction(
  rpc: RpcCall,
  authority: string,
  instructions: readonly Instruction[],
  onboarding = false,
): Promise<PreparedTransaction> {
  if ((await rpc<string>('getGenesisHash')) !== MAINNET_GENESIS)
    throw new Error('The RPC must connect to Solana mainnet.');
  const [{ value: lifetime }, { value: balance }] = await Promise.all([
    rpc<{ value: Lifetime }>('getLatestBlockhash', [{ commitment: 'confirmed' }]),
    rpc<{ value: number }>('getBalance', [authority, { commitment: 'confirmed' }]),
  ]);
  const budget = (units: number) => [
    getSetComputeUnitLimitInstruction({ units }),
    getSetComputeUnitPriceInstruction({ microLamports: 1_000n }),
  ];
  let compiled = compileInstructions(
    authority,
    lifetime,
    onboarding ? instructions : [...budget(1_400_000), ...instructions],
  );
  let result = await simulateTransaction(rpc, authority, compiled.bytes, onboarding);
  if (!onboarding) {
    const units = result.value.unitsConsumed;
    if (!units || units <= 0) throw new Error('Simulation did not report compute usage.');
    compiled = compileInstructions(authority, lifetime, [
      ...budget(Math.min(1_400_000, Math.ceil(units * 1.2) + 20_000)),
      ...instructions,
    ]);
    result = await simulateTransaction(rpc, authority, compiled.bytes, onboarding);
  }
  const fee = await rpc<{ value: number | null }>('getFeeForMessage', [
    toBase64(compiled.tx.messageBytes),
    { commitment: 'confirmed' },
  ]);
  if (fee.value === null)
    throw new Error('The transaction expired while estimating fees. Review it again.');
  const after = result.value.accounts?.[0]?.lamports;
  if (after === undefined) throw new Error('Simulation did not report the fee-payer balance.');
  const rentLamports = Math.max(0, balance - after - fee.value);
  if (balance < fee.value + rentLamports)
    throw new Error('Add SOL to your wallet for network fees and account rent.');
  return {
    authority,
    bytes: compiled.bytes,
    lifetime,
    feeLamports: fee.value,
    rentLamports,
    preparedAt: Date.now(),
  };
}

/** Wallet output must sign exactly the reviewed message; it cannot replace the transfer/order. */
export async function verifyWalletSignature(
  plan: PreparedTransaction,
  output: Uint8Array,
  extraSigner?: string,
) {
  const original = getTransactionDecoder().decode(plan.bytes);
  let tx: Transaction;
  if (output.length === 64) {
    tx = {
      ...original,
      signatures: { ...original.signatures, [plan.authority]: output },
    } as Transaction;
  } else tx = getTransactionDecoder().decode(output);
  if (!sameBytes(original.messageBytes, tx.messageBytes))
    throw new Error('Wallet changed the reviewed transaction. Nothing was sent.');
  const signers = Object.keys(original.signatures);
  if (
    !signers.includes(plan.authority) ||
    signers.some((s) => s !== plan.authority && s !== extraSigner)
  )
    throw new Error('Unexpected transaction signer.');
  const signed = tx.signatures[address(plan.authority)];
  if (!signed || signed.length !== 64 || signed.every((b) => b === 0))
    throw new Error('Wallet returned no signature.');
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(getAddressEncoder().encode(address(plan.authority))),
    'Ed25519',
    false,
    ['verify'],
  );
  if (
    !(await crypto.subtle.verify(
      'Ed25519',
      key,
      new Uint8Array(signed),
      new Uint8Array(original.messageBytes),
    ))
  )
    throw new Error('Wallet signature is invalid.');
  return {
    signature: getBase58Decoder().decode(signed),
    bytes: new Uint8Array(getTransactionEncoder().encode(tx)),
  };
}

export interface Receipt {
  signature: string;
  authority: string;
  label: string;
  actionKind?: Action['kind'];
  depositJourney?: DepositJourney;
  lifetime: Lifetime;
  createdAt: number;
  state: 'pending' | 'confirmed' | 'failed' | 'expired';
  slot?: number;
  detail?: string;
  rejectedBeforeBroadcast?: boolean;
}
export async function checkReceipt(rpc: RpcCall, receipt: Receipt): Promise<Receipt> {
  const getStatus = () =>
    rpc<{ value: ({ err: unknown; slot: number; confirmationStatus: string } | null)[] }>(
      'getSignatureStatuses',
      [[receipt.signature], { searchTransactionHistory: true }],
    );
  const resolve = (
    s: Awaited<ReturnType<typeof getStatus>>['value'][number] | undefined,
  ): Receipt | undefined => {
    if (s?.err) return { ...receipt, state: 'failed', slot: s.slot, detail: JSON.stringify(s.err) };
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized'))
      return { ...receipt, state: 'confirmed', slot: s.slot, detail: undefined };
  };
  const status = await getStatus();
  const resolved = resolve(status.value[0]);
  if (resolved) return resolved;
  const height = await rpc<number>('getBlockHeight', [{ commitment: 'finalized' }]);
  if (height > receipt.lifetime.lastValidBlockHeight) {
    // Check history again after expiry. A timeout is not evidence of a failed broadcast.
    const second = await getStatus();
    const final = resolve(second.value[0]);
    if (final) return final;
    if (!second.value[0])
      return {
        ...receipt,
        state: 'expired',
        detail: 'Blockhash expired; no transaction found in RPC history.',
      };
  }
  return { ...receipt, state: 'pending' };
}
