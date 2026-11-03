import { describe, expect, it } from 'vitest';
import { receiptMessage, transactionProblem } from './feedback';
import type { Receipt } from './chain';

describe('transaction explanations', () => {
  it.each([
    new Error('User rejected the request.'),
    { code: 4001, message: 'Request rejected' },
    new Error('User denied transaction signature'),
  ])('explains a declined wallet request without exposing a provider code', (cause) => {
    expect(transactionProblem(cause).message).toContain('You cancelled the wallet request');
  });
  it('gives a connection recovery step for a fetch failure', () => {
    const problem = transactionProblem(new TypeError('Failed to fetch'));
    expect(problem.message).toContain('Check your connection');
    expect(problem.message).not.toContain('Nothing was sent');
  });
  it('explains a simulation refusal and retains sanitized diagnostics separately', () => {
    const problem = transactionProblem(
      new Error(
        'Simulation failed. Program example failed: custom program error: 0x1 No transaction was signed.',
      ),
    );
    expect(problem.message).toContain('network checks');
    expect(problem.message).not.toContain('0x1');
    expect(problem.message).not.toContain('Not enough SOL');
    expect(problem.details).toContain('0x1');
  });
  it('keeps exact, actionable SOL shortfalls', () => {
    const text =
      'Not enough SOL for Phoenix account setup. Add at least 0.001 SOL. No transaction was signed.';
    expect(transactionProblem(new Error(text))).toEqual({ message: text });
  });
  it('identifies unsupported attached order types as an app issue instead of requesting more SOL', () => {
    const problem = transactionProblem(
      new Error(
        'Simulation failed. Program log: "Order type must be Limit or PostOnly" No transaction was signed.',
      ),
    );
    expect(problem.message).toContain('order type with TP/SL');
    expect(problem.message).toContain('adding more SOL');
    expect(problem.details).toContain('Limit or PostOnly');
  });
  it('keeps endpoint credentials out of displayed diagnostics', () => {
    const problem = transactionProblem(
      new Error('RPC request failed: https://rpc.example.test/private-path?api-key=secret-value'),
    );
    expect(JSON.stringify(problem)).not.toContain('secret-value');
    expect(JSON.stringify(problem)).not.toContain('private-path');
  });
});

const receipt: Receipt = {
  signature: 'test-signature',
  authority: 'test-owner',
  label: 'Test transaction',
  lifetime: { blockhash: 'test-blockhash', lastValidBlockHeight: 10 },
  createdAt: 0,
  state: 'confirmed',
};
describe('confirmed action feedback', () => {
  it('distinguishes successful account activation from a USDC deposit', () => {
    expect(receiptMessage({ ...receipt, actionKind: 'setup' })).toContain(
      'Your USDC is still in your wallet',
    );
    expect(receiptMessage({ ...receipt, actionKind: 'setup' })).toContain('Open Deposit');
  });
  it('describes a deposit as confirmed but lets the account refresh determine equity', () => {
    expect(receiptMessage({ ...receipt, actionKind: 'deposit' })).toContain(
      'USDC deposit is confirmed',
    );
  });
  it('does not call an ambiguous submission a failed transaction', () => {
    const pending = {
      ...receipt,
      state: 'pending' as const,
      detail:
        'Submission response unavailable. Checking this transaction; do not repeat the action.',
    };
    expect(receiptMessage(pending)).toBe(pending.detail);
  });
  it('explains a confirmed on-chain failure without implying no fees were charged', () => {
    const text = receiptMessage({
      ...receipt,
      state: 'failed',
      detail: '{"InstructionError":[0,{"Custom":1}]}',
    });
    expect(text).toContain('network fee may still have been charged');
    expect(text).not.toContain('InstructionError');
  });
});
