import { describe, expect, it } from 'vitest';
import { openOrderViews } from './order-view';

function account() {
  return {
    authority: 'wallet',
    subaccount: {
      orders: [
        {
          symbol: 'ETH',
          orders: [
            {
              orderSequenceNumber: '12345',
              side: 'bid' as const,
              orderType: 'limit',
              priceTicks: '23000',
              priceUsd: '9999',
              sizeRemainingLots: '1',
              initialSizeLots: '3',
              sizeRemainingUnits: '999',
              reduceOnly: false,
              status: 'open',
              isConditionalOrder: false,
            },
          ],
        },
      ],
    },
    params: {
      paramsBySymbol: { ETH: { tickSize: '100', baseLotDecimals: 3, markPriceTicks: '23250' } },
    },
  };
}
describe('open order presentation', () => {
  it('uses exact lots and ticks for remaining size, filled size and prices', () => {
    expect(openOrderViews(account(), 'wallet')[0]).toMatchObject({
      symbol: 'ETH',
      side: 'Buy',
      price: 2300,
      markPrice: 2325,
      remaining: '0.001',
      filled: '0.002',
      sequence: '12345',
      priceTicks: '23000',
      reduceOnly: false,
    });
  });
  it('does not expose another wallet’s orders', () => {
    expect(openOrderViews(account(), 'different-wallet')).toEqual([]);
    expect(openOrderViews(account(), undefined)).toEqual([]);
    expect(openOrderViews(undefined, 'wallet')).toEqual([]);
  });
  it.each(['closed', 'cancelled', 'canceled', 'filled', 'expired'])('omits %s orders', (status) => {
    const a = account();
    a.subaccount.orders[0]!.orders[0]!.status = status;
    expect(openOrderViews(a, 'wallet')).toEqual([]);
  });
  it('omits filled and conditional orders', () => {
    const a = account();
    const o = a.subaccount.orders[0]!.orders[0]!;
    o.sizeRemainingLots = '0';
    expect(openOrderViews(a, 'wallet')).toEqual([]);
    o.sizeRemainingLots = '1';
    o.isConditionalOrder = true;
    expect(openOrderViews(a, 'wallet')).toEqual([]);
  });
  it.each(['NaN', 'Infinity', '0', '-1', 'broken'])('omits invalid order prices %s', (price) => {
    const a = account();
    a.subaccount.orders[0]!.orders[0]!.priceTicks = price;
    expect(openOrderViews(a, 'wallet')).toEqual([]);
  });
  it('retains reduce-only order direction without describing it as a new position', () => {
    const a = account();
    a.subaccount.orders[0]!.orders[0]!.reduceOnly = true;
    expect(openOrderViews(a, 'wallet')[0]).toMatchObject({ side: 'Buy', reduceOnly: true });
  });
});
