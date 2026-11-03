import { describe, expect, it } from 'vitest';
import { pnl } from '../app/format';
import { positionView } from './position-view';
import type { TradingAccount } from './types';

function account() {
  return {
    authority: 'test-wallet',
    subaccount: {
      positions: [
        { symbol: 'ETH', basePositionLots: '1000', entryPriceTicks: '23500' },
        { symbol: 'BTC', basePositionLots: '-10', entryPriceTicks: '80000' },
      ],
    },
    margin: {
      marketMargins: [
        {
          symbol: 'ETH',
          basePositionLots: '1000',
          entryPriceTicks: '23500',
          unrealizedPnlQuoteLots: '20123456',
        },
        {
          symbol: 'BTC',
          basePositionLots: '-10',
          entryPriceTicks: '80000',
          unrealizedPnlQuoteLots: '-500000',
        },
      ],
    },
    params: {
      paramsBySymbol: {
        ETH: { tickSize: '100', baseLotDecimals: 3, markPriceTicks: '23700' },
        BTC: { tickSize: '100', baseLotDecimals: 4, markPriceTicks: '80500' },
      },
    },
  };
}

describe('current position chart data', () => {
  it('uses the matching SDK liquidation estimate and keeps funding separate from price P&L', () => {
    const a = account() as unknown as TradingAccount;
    a.liquidationPrices = [
      {
        symbol: 'ETH',
        basePositionLots: '1000',
        basePositionUnits: 1,
        entryPriceUsd: 2350,
        liquidationPriceUsd: 1800.1,
        liquidationPriceTicks: '18001',
      },
    ];
    a.margin!.marketMargins[0]!.unsettledFundingQuoteLots = '-123';
    expect(positionView(a, 'ETH', a.authority, false)).toMatchObject({
      liquidationPrice: 1800.1,
      unsettledFunding: '-0.000123',
      unrealizedPnl: '20.123456',
    });
    a.margin!.marketMargins[0]!.unsettledFundingQuoteLots = '123';
    expect(positionView(a, 'ETH', a.authority, false)?.unsettledFunding).toBe('0.000123');
    a.liquidationPrices[0]!.basePositionLots = '999';
    expect(positionView(a, 'ETH', a.authority, false)?.liquidationPrice).toBeUndefined();
    a.liquidationPrices[0]!.basePositionLots = '1000';
    for (const invalid of [null, 0, -1, Infinity, NaN]) {
      a.liquidationPrices[0]!.liquidationPriceUsd = invalid;
      expect(positionView(a, 'ETH', a.authority, false)?.liquidationPrice).toBeUndefined();
    }
  });
  it('uses the selected market margin P&L and converts ticks to USD', () => {
    expect(positionView(account(), 'ETH', 'test-wallet', false)).toEqual({
      symbol: 'ETH',
      side: 'Long',
      entryPrice: 2350,
      markPrice: 2370,
      unrealizedPnl: '20.123456',
      pnlTone: 'positive',
    });
    // The SDK-supplied P&L is deliberately different from (mark - entry) * size.
    // Never replace it with rounded entry arithmetic or another market's total.
  });
  it('preserves short direction independently of whether P&L is positive or negative', () => {
    const a = account();
    expect(positionView(a, 'BTC', a.authority, false)).toMatchObject({
      side: 'Short',
      entryPrice: 80000,
      markPrice: 80500,
      unrealizedPnl: '-0.5',
      pnlTone: 'negative',
    });
    a.margin.marketMargins[1]!.unrealizedPnlQuoteLots = '500000';
    expect(positionView(a, 'BTC', a.authority, false)).toMatchObject({
      side: 'Short',
      pnlTone: 'positive',
    });
  });
  it('clears on logout, wallet switch, stale data, or a different market', () => {
    const a = account();
    expect(positionView(undefined, 'ETH', a.authority, false)).toBeUndefined();
    expect(positionView(a, 'ETH', undefined, false)).toBeUndefined();
    expect(positionView(a, 'ETH', 'other-wallet', false)).toBeUndefined();
    expect(positionView(a, 'ETH', a.authority, true)).toBeUndefined();
    expect(positionView(a, 'SOL', a.authority, false)).toBeUndefined();
  });
  it('removes closed positions and refuses mismatched account/margin snapshots', () => {
    const a = account();
    a.subaccount.positions[0]!.basePositionLots = '0';
    expect(positionView(a, 'ETH', a.authority, false)).toBeUndefined();
    a.subaccount.positions[0]!.basePositionLots = '500';
    expect(positionView(a, 'ETH', a.authority, false)).toBeUndefined();
    a.margin.marketMargins[0]!.basePositionLots = '500';
    expect(positionView(a, 'ETH', a.authority, false)?.side).toBe('Long');
    a.margin.marketMargins[0]!.entryPriceTicks = '24000';
    expect(positionView(a, 'ETH', a.authority, false)).toBeUndefined();
    a.subaccount.positions[0]!.entryPriceTicks = '24000';
    expect(positionView(a, 'ETH', a.authority, false)?.entryPrice).toBe(2400);
  });
  it('withholds an overlay if margin data is missing', () => {
    const a = account();
    a.margin.marketMargins = [];
    expect(positionView(a, 'ETH', a.authority, false)).toBeUndefined();
  });
  it.each(['NaN', 'Infinity', '-1', '0', 'bad'])('rejects an invalid entry price: %s', (value) => {
    const a = account();
    a.subaccount.positions[0]!.entryPriceTicks = value;
    a.margin.marketMargins[0]!.entryPriceTicks = value;
    expect(positionView(a, 'ETH', a.authority, false)).toBeUndefined();
  });
  it('formats a flat position without a profit sign and keeps tiny losses visible', () => {
    const a = account();
    a.margin.marketMargins[0]!.unrealizedPnlQuoteLots = '0';
    expect(positionView(a, 'ETH', a.authority, false)?.pnlTone).toBe('neutral');
    expect(pnl('0')).toBe('0.00');
    expect(pnl('20.123456')).toBe('+20.12');
    expect(pnl('-0.000001')).toBe('-0.000001');
    expect(pnl(undefined)).toBe('—');
    expect(pnl('NaN')).toBe('—');
  });
});
