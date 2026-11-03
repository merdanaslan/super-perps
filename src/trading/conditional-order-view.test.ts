import { describe, expect, it } from 'vitest';
import { conditionalOrderViews } from './conditional-order-view';

const account = {
  authority: 'wallet',
  conditionals: [
    { index: 0, sequence: '9', symbol: 'ETH', takeProfit: '2400.5', stopLoss: '2250' },
    { index: 1, sequence: '10', symbol: 'SOL', stopLoss: '90' },
  ],
};

describe('conditional trigger presentation', () => {
  it('keeps each active TP and SL at its trigger price, including a single exit', () => {
    expect(conditionalOrderViews(account, 'wallet', false)).toEqual([
      { id: 'ETH:0:9:TP', index: 0, sequence: '9', symbol: 'ETH', kind: 'TP', price: 2400.5 },
      { id: 'ETH:0:9:SL', index: 0, sequence: '9', symbol: 'ETH', kind: 'SL', price: 2250 },
      { id: 'SOL:1:10:SL', index: 1, sequence: '10', symbol: 'SOL', kind: 'SL', price: 90 },
    ]);
  });
  it('hides triggers for a stale, disconnected or different wallet', () => {
    expect(conditionalOrderViews(account, 'wallet', true)).toEqual([]);
    expect(conditionalOrderViews(account, 'another-wallet', false)).toEqual([]);
    expect(conditionalOrderViews(account, undefined, false)).toEqual([]);
    expect(conditionalOrderViews(undefined, 'wallet', false)).toEqual([]);
  });
  it('removes a canceled or triggered leg while retaining its active sibling', () => {
    expect(
      conditionalOrderViews(
        { ...account, conditionals: [{ ...account.conditionals[0]!, takeProfit: undefined }] },
        'wallet',
        false,
      ),
    ).toEqual([
      { id: 'ETH:0:9:SL', index: 0, sequence: '9', symbol: 'ETH', kind: 'SL', price: 2250 },
    ]);
    expect(conditionalOrderViews({ ...account, conditionals: [] }, 'wallet', false)).toEqual([]);
  });
  it.each(['', '0', '-1', 'Infinity', 'NaN', 'broken'])(
    'omits invalid trigger price %s without dropping the other leg',
    (takeProfit) => {
      const a = { ...account, conditionals: [{ ...account.conditionals[0]!, takeProfit }] };
      expect(conditionalOrderViews(a, 'wallet', false)).toEqual([
        { id: 'ETH:0:9:SL', index: 0, sequence: '9', symbol: 'ETH', kind: 'SL', price: 2250 },
      ]);
    },
  );
});
