import { describe, expect, it, vi } from 'vitest';
import {
  address,
  generateKeyPair,
  getAddressFromPublicKey,
  getTransactionDecoder,
  getTransactionEncoder,
  partiallySignTransaction,
  type Instruction,
} from '@solana/kit';
import {
  checkReceipt,
  compileInstructions,
  MAINNET_GENESIS,
  prepareTransaction,
  verifyWalletSignature,
  type Receipt,
  type RpcCall,
} from './chain';
import { reconcileReceipt } from './receipt';
import { executeReviewed } from './execute';
import { assertSameInstructions } from './service';
import type { ReviewPlan } from './types';

const lifetime = { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 200 };
const memo = (text = 'local-test'): Instruction => ({
  programAddress: address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
  data: new TextEncoder().encode(text),
});
async function fixture() {
  // Ephemeral, unfunded keys exist only inside these unit tests. No RPC submits are used.
  const key = await generateKeyPair();
  const authority = await getAddressFromPublicKey(key.publicKey);
  const compiled = compileInstructions(authority, lifetime, [memo()]);
  const plan: ReviewPlan = {
    authority,
    bytes: compiled.bytes,
    lifetime,
    feeLamports: 5000,
    rentLamports: 0,
    preparedAt: Date.now(),
    action: { kind: 'deposit', amount: '1' },
    title: 'Deposit 1 USDC',
    details: [],
  };
  const sign = async (bytes: Uint8Array) =>
    new Uint8Array(
      getTransactionEncoder().encode(
        await partiallySignTransaction([key], getTransactionDecoder().decode(bytes)),
      ),
    );
  return { plan, key, sign };
}
describe('reviewed transactions', () => {
  it('reports wallet approval before network checks and preserves save-before-submit ordering', async () => {
    const { plan, sign } = await fixture();
    const steps: string[] = [];
    await executeReviewed(plan, {
      currentAuthority: () => plan.authority,
      sign: async (bytes) => {
        const signed = await sign(bytes);
        steps.push('signed');
        return signed;
      },
      onSigned: () => steps.push('progress'),
      blockHeight: async () => {
        steps.push('height');
        return 100;
      },
      persist: () => steps.push('persist'),
      broadcast: async () => {
        steps.push('broadcast');
      },
    });
    expect(steps).toEqual(['signed', 'progress', 'height', 'persist', 'broadcast']);
  });
  it('accepts an exact signature and persists recovery information before its single broadcast', async () => {
    const { plan, sign } = await fixture();
    const steps: string[] = [];
    const broadcast = vi.fn(async () => {
      steps.push('broadcast');
    });
    const receipt = await executeReviewed(plan, {
      currentAuthority: () => plan.authority,
      sign,
      blockHeight: async () => 100,
      persist: () => steps.push('persist'),
      broadcast,
    });
    expect(steps).toEqual(['persist', 'broadcast']);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(receipt.state).toBe('pending');
    expect(receipt.actionKind).toBe('deposit');
  });
  it('retains the original signature after an ambiguous network failure without resubmission', async () => {
    const { plan, sign } = await fixture();
    let saved: Receipt | undefined;
    const broadcast = vi.fn(async () => {
      throw new Error('timeout after acceptance');
    });
    const receipt = await executeReviewed(plan, {
      currentAuthority: () => plan.authority,
      sign,
      blockHeight: async () => 100,
      persist: (r) => {
        saved = r;
      },
      broadcast,
    });
    expect(receipt.signature).toBe(saved?.signature);
    expect(receipt.state).toBe('pending');
    expect(broadcast).toHaveBeenCalledTimes(1);
  });
  it('rejects expired reviews before the wallet is called', async () => {
    const { plan } = await fixture();
    const sign = vi.fn();
    await expect(
      executeReviewed(plan, {
        currentAuthority: () => plan.authority,
        sign,
        blockHeight: async () => 100,
        persist: vi.fn(),
        broadcast: vi.fn(),
        now: () => plan.preparedAt + 30_001,
      }),
    ).rejects.toThrow('Review expired');
    expect(sign).not.toHaveBeenCalled();
  });
  it('rejects a wallet switch while the signature prompt is open', async () => {
    const { plan, sign } = await fixture();
    let owner: string | undefined = plan.authority;
    const broadcast = vi.fn();
    await expect(
      executeReviewed(plan, {
        currentAuthority: () => owner,
        sign: async (b) => {
          const out = await sign(b);
          owner = undefined;
          return out;
        },
        blockHeight: async () => 100,
        persist: vi.fn(),
        broadcast,
      }),
    ).rejects.toThrow('Wallet changed');
    expect(broadcast).not.toHaveBeenCalled();
  });
  it('rejects an expired blockhash after signing', async () => {
    const { plan, sign } = await fixture();
    const broadcast = vi.fn();
    await expect(
      executeReviewed(plan, {
        currentAuthority: () => plan.authority,
        sign,
        blockHeight: async () => 201,
        persist: vi.fn(),
        broadcast,
      }),
    ).rejects.toThrow('expired');
    expect(broadcast).not.toHaveBeenCalled();
  });
  it('refuses submission when recovery storage fails', async () => {
    const { plan, sign } = await fixture();
    const broadcast = vi.fn();
    await expect(
      executeReviewed(plan, {
        currentAuthority: () => plan.authority,
        sign,
        blockHeight: async () => 100,
        persist: () => {
          throw new Error('storage unavailable');
        },
        broadcast,
      }),
    ).rejects.toThrow('storage unavailable');
    expect(broadcast).not.toHaveBeenCalled();
  });
  it('rejects wallet replacement of the reviewed message', async () => {
    const { plan, sign } = await fixture();
    const malicious = compileInstructions(plan.authority, lifetime, [memo('different action')]);
    await expect(verifyWalletSignature(plan, await sign(malicious.bytes))).rejects.toThrow(
      'changed',
    );
  });
  it('rejects invalid or absent signatures', async () => {
    const { plan } = await fixture();
    await expect(verifyWalletSignature(plan, new Uint8Array(64))).rejects.toThrow('no signature');
    await expect(verifyWalletSignature(plan, new Uint8Array(64).fill(7))).rejects.toThrow(
      'invalid',
    );
  });
});
describe('simulation before wallet signing', () => {
  const rpcMock = (overrides: Record<string, unknown> = {}) => {
    const responses: Record<string, unknown> = {
      getGenesisHash: MAINNET_GENESIS,
      getLatestBlockhash: { value: lifetime },
      getBalance: { value: 10000000 },
      simulateTransaction: {
        context: { slot: 1 },
        value: { err: null, unitsConsumed: 10000, accounts: [{ lamports: 7995000 }] },
      },
      getFeeForMessage: { value: 5000 },
      ...overrides,
    };
    const mock = vi.fn(async (method: string) => responses[method]);
    return { rpc: mock as RpcCall, mock };
  };
  it('checks mainnet identity and refuses the wrong chain', async () => {
    const { rpc, mock } = rpcMock({ getGenesisHash: 'devnet' });
    await expect(
      prepareTransaction(rpc, '11111111111111111111111111111112', [memo()]),
    ).rejects.toThrow('mainnet');
    expect(mock.mock.calls.map((c) => c[0])).toEqual(['getGenesisHash']);
  });
  it('blocks a failed simulation and preserves its useful error', async () => {
    const { rpc } = rpcMock({
      simulateTransaction: {
        context: { slot: 1 },
        value: {
          err: { InstructionError: [0, 'InsufficientFunds'] },
          logs: ['Program failed: insufficient funds'],
        },
      },
    });
    await expect(
      prepareTransaction(rpc, '11111111111111111111111111111112', [memo()]),
    ).rejects.toThrow('insufficient funds');
  });
  it('shows the exact SOL shortfall instead of the trailing generic program failures', async () => {
    const { rpc, mock } = rpcMock({
      simulateTransaction: {
        context: { slot: 1 },
        value: {
          err: { InstructionError: [0, { Custom: 1 }] },
          logs: [
            'Transfer: insufficient lamports 9990000, need 27879040',
            'Program 11111111111111111111111111111111 failed: custom program error: 0x1',
            'Program EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih failed: custom program error: 0x1',
          ],
        },
      },
    });
    await expect(
      prepareTransaction(rpc, '11111111111111111111111111111112', [memo()], true),
    ).rejects.toThrow(
      'Not enough SOL for Phoenix account setup. Add at least 0.01788904 SOL to cover this step',
    );
    expect(mock.mock.calls.map((c) => c[0])).not.toContain('sendTransaction');
  });
  it('does not classify an unrelated custom error 0x1 as a SOL shortfall', async () => {
    const { rpc } = rpcMock({
      simulateTransaction: {
        context: { slot: 1 },
        value: {
          err: { InstructionError: [0, { Custom: 1 }] },
          logs: ['Program example failed: custom program error: 0x1'],
        },
      },
    });
    await expect(
      prepareTransaction(rpc, '11111111111111111111111111111112', [memo()]),
    ).rejects.toThrow('Simulation failed. Program example failed: custom program error: 0x1');
  });
  it('preserves the explanation following a Phoenix assertion and the runtime error code', async () => {
    const { rpc } = rpcMock({
      simulateTransaction: {
        context: { slot: 1 },
        value: {
          err: { InstructionError: [3, 'InvalidInstructionData'] },
          logs: [
            'Program log: Phoenix Eternal: PlaceLimitOrderWithConditionals',
            'Program log: assert_with_side_effect failed',
            'Program log: "Order type must be Limit or PostOnly"\nprograms/eternal-lib/src/loaders/mod.rs:60:22',
            'Program phoenix failed: invalid instruction data',
            'Program flight failed: invalid instruction data',
          ],
        },
      },
    });
    const error = await prepareTransaction(rpc, '11111111111111111111111111111112', [memo()]).catch(
      (cause: Error) => cause,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Order type must be Limit or PostOnly');
    expect((error as Error).message).toContain('InvalidInstructionData');
    expect((error as Error).message).toContain('No transaction was signed.');
  });
  it.each([
    ['InsufficientFundsForFee', 'Add SOL to your wallet to pay the network fee'],
    [
      { InsufficientFundsForRent: { account_index: 0 } },
      'Not enough SOL remains to meet the account rent requirement',
    ],
  ])('explains the runtime funding error %j before signing', async (err, message) => {
    const { rpc } = rpcMock({
      simulateTransaction: {
        context: { slot: 1 },
        value: { err, logs: [] },
      },
    });
    await expect(
      prepareTransaction(rpc, '11111111111111111111111111111112', [memo()]),
    ).rejects.toThrow(`${message}`);
  });
  it('simulates the final compute-budget message and separates rent from fees', async () => {
    const { rpc, mock } = rpcMock();
    const p = await prepareTransaction(rpc, '11111111111111111111111111111112', [memo()]);
    expect(p.rentLamports).toBe(2000000);
    expect(p.feeLamports).toBe(5000);
    expect(mock.mock.calls.filter((c) => c[0] === 'simulateTransaction')).toHaveLength(2);
  });
});
describe('confirmation recovery', () => {
  const receipt: Receipt = {
    signature: 'unused-by-mock',
    authority: 'test',
    label: 'Order',
    lifetime,
    createdAt: 0,
    state: 'pending',
  };
  it('does not expire a transaction confirmed before the timeout', async () => {
    const rpc = vi.fn(async () => ({
      value: [{ err: null, slot: 199, confirmationStatus: 'confirmed' }],
    })) as RpcCall;
    expect((await checkReceipt(rpc, receipt)).state).toBe('confirmed');
  });
  it('rechecks history after finalized blockhash expiry', async () => {
    let checks = 0;
    const rpc = (async (method: string) =>
      method === 'getBlockHeight'
        ? 201
        : {
            value: [
              ++checks === 1 ? null : { err: null, slot: 199, confirmationStatus: 'finalized' },
            ],
          }) as RpcCall;
    expect((await checkReceipt(rpc, receipt)).state).toBe('confirmed');
    expect(checks).toBe(2);
  });
  it('only expires when the history remains absent after expiry', async () => {
    const rpc = (async (method: string) =>
      method === 'getBlockHeight' ? 201 : { value: [null] }) as RpcCall;
    expect((await checkReceipt(rpc, receipt)).state).toBe('expired');
  });
  it('leaves uncertainty pending and propagates network errors for recovery', async () => {
    const rpc = (async (method: string) =>
      method === 'getBlockHeight' ? 190 : { value: [null] }) as RpcCall;
    expect((await checkReceipt(rpc, receipt)).state).toBe('pending');
    await expect(
      checkReceipt(
        (async () => {
          throw new Error('offline');
        }) as RpcCall,
        receipt,
      ),
    ).rejects.toThrow('offline');
  });
});
it('rejects onboarding that changes an account role, instruction bytes, or adds a transfer', () => {
  const ix: Instruction = {
    ...memo(),
    accounts: [{ address: address('11111111111111111111111111111112'), role: 0 }],
  };
  expect(() => assertSameInstructions([ix], [ix])).not.toThrow();
  expect(() =>
    assertSameInstructions([{ ...ix, accounts: [{ ...ix.accounts![0]!, role: 3 }] }], [ix]),
  ).toThrow('unexpected');
  expect(() => assertSameInstructions([memo('modified')], [ix])).toThrow('unexpected');
  expect(() => assertSameInstructions([ix, memo()], [ix])).toThrow('unexpected');
});

describe('receipt updates across tabs', () => {
  const original: Receipt = {
    signature: 'original',
    authority: 'test',
    label: 'Order',
    lifetime,
    createdAt: 1,
    state: 'pending',
  };
  it('keeps a newer transaction when an older poll finishes late', () => {
    const newer: Receipt = { ...original, signature: 'newer', createdAt: 2 };
    expect(reconcileReceipt(newer, { ...original, state: 'confirmed' })).toEqual(newer);
  });
  it('does not undo confirmation when a submission response arrives late', () => {
    const confirmed: Receipt = { ...original, state: 'confirmed', slot: 100 };
    expect(reconcileReceipt(confirmed, { ...original, detail: 'response lost' })).toEqual(
      confirmed,
    );
  });
  it('resolves the same pending transaction and does not revive cleared data', () => {
    const resolved: Receipt = { ...original, state: 'expired' };
    expect(reconcileReceipt(original, resolved)).toEqual(resolved);
    expect(reconcileReceipt(undefined, resolved)).toBeUndefined();
  });
});
