import { describe, expect, it } from 'vitest';
import { parseRpcRequest } from './policy.ts';

const address = '11111111111111111111111111111111';
const request = (method: string, params: unknown[] = []) =>
  JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

describe('RPC relay method boundary', () => {
  it.each([
    ['getGenesisHash', []],
    ['getBalance', [address]],
    ['getAccountInfo', [address, { encoding: 'base64' }]],
    ['getMultipleAccounts', [[address], { encoding: 'base64' }]],
    ['getLatestBlockhash', [{ commitment: 'confirmed' }]],
    ['getBlockHeight', []],
    ['getSlot', []],
    ['getFeeForMessage', ['AQ==', { commitment: 'confirmed' }]],
    ['getMinimumBalanceForRentExemption', [165]],
    ['getSignatureStatuses', [['1'.repeat(88)], { searchTransactionHistory: true }]],
    ['simulateTransaction', ['AQ==', { encoding: 'base64', sigVerify: false }]],
    ['sendTransaction', ['AQ==', { encoding: 'base64', maxRetries: 0 }]],
  ])('allows the existing %s flow', (method, params) => {
    expect(parseRpcRequest(request(method as string, params as unknown[])).method).toBe(method);
  });

  it.each([
    'getProgramAccounts',
    'getBlock',
    'getTransactions',
    'requestAirdrop',
    'signTransaction',
    'getAsset',
  ])('refuses unrelated or costly %s calls', (method) => {
    expect(() => parseRpcRequest(request(method))).toThrow();
  });

  it.each([
    'null',
    '[]',
    '{}',
    request('getBalance', ['https://other.test']),
    request('getMultipleAccounts', [Array(33).fill(address)]),
    request('getSignatureStatuses', [Array(33).fill('1'.repeat(88))]),
    request('sendTransaction', ['a'.repeat(1700), { encoding: 'base64' }]),
    JSON.stringify({ jsonrpc: '2.0', method: 'getSlot' }),
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSlot',
      params: [],
      url: 'https://other.test',
    }),
  ])('rejects invalid, oversized, batch or notification input', (raw) => {
    expect(() => parseRpcRequest(raw)).toThrow();
  });

  it('allows bounded account/signature subscriptions and unsubscriptions', () => {
    expect(parseRpcRequest(request('accountSubscribe', [address]), true).method).toBe(
      'accountSubscribe',
    );
    expect(parseRpcRequest(request('signatureSubscribe', ['1'.repeat(88)]), true).method).toBe(
      'signatureSubscribe',
    );
    expect(parseRpcRequest(request('signatureUnsubscribe', [42]), true).method).toBe(
      'signatureUnsubscribe',
    );
  });

  it.each(['logsSubscribe', 'programSubscribe', 'blockSubscribe', 'sendTransaction'])(
    'refuses %s on the subscription relay',
    (method) => {
      expect(() => parseRpcRequest(request(method), true)).toThrow();
    },
  );
});
