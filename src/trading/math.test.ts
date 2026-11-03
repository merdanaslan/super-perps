import { assertSourceSlotFresh } from './math';
import { describe, expect, it } from 'vitest';
import {
  buildTakeProfitStopLossTriggerOrders,
  Side,
  StopLossOrderKind,
  ticks,
} from '@ellipsis-labs/rise';
import { assertCloseSize, fromLots, toLots, toTicks, validateExits } from './math';

describe('exact order amounts and exit direction', () => {
  it('keeps large integers exact and rejects fractional lots or overflow', () => {
    expect(toLots('9007199254740993', 0)).toBe(9007199254740993n);
    expect(toLots('0.0001', 4)).toBe(1n);
    expect(fromLots(1234567n, 6)).toBe('1.234567');
    expect(() => toLots('0.00001', 4)).toThrow('whole market lots');
    expect(() => toLots('18446744073709551616', 0)).toThrow('limit');
    for (const v of ['NaN', '1e3', '-1', '0', 'Infinity', '0x10'])
      expect(() => toLots(v, 6)).toThrow();
  });
  it('respects BTC whole-dollar ticks and finer market ticks', () => {
    expect(toTicks('80000', { tickSize: '100', baseLotDecimals: 4 })).toBe(80000n);
    expect(() => toTicks('80000.1', { tickSize: '100', baseLotDecimals: 4 })).toThrow(
      'multiple of 1',
    );
    expect(toTicks('1.2345', { tickSize: '1', baseLotDecimals: 2 })).toBe(12345n);
  });
  it('validates both long and short protection and rejects equality', () => {
    expect(() => validateExits('long', '100', '110', '90')).not.toThrow();
    expect(() => validateExits('short', '100', '90', '110')).not.toThrow();
    expect(() => validateExits('long', '100', '90')).toThrow('above');
    expect(() => validateExits('short', '100', undefined, '90')).toThrow('above');
    expect(() => validateExits('long', '100', '100')).toThrow();
  });
  it('cannot close the wrong side, reverse a position or exceed its size', () => {
    expect(() => assertCloseSize(10n, 'short', 10n)).not.toThrow();
    expect(() => assertCloseSize(-10n, 'long', 5n)).not.toThrow();
    expect(() => assertCloseSize(10n, 'long', 1n)).toThrow();
    expect(() => assertCloseSize(10n, 'short', 11n)).toThrow('exceeds');
    expect(() => assertCloseSize(0n, 'short', 1n)).toThrow();
  });
  it('builds Phoenix TP as a limit and SL as a bounded IOC on the opposite side', () => {
    const long = buildTakeProfitStopLossTriggerOrders({
      primarySide: Side.Bid,
      takeProfitPrice: ticks(110n),
      stopLossPrice: ticks(90n),
      slippageBps: 50,
    });
    expect(long.greaterTriggerOrder?.orderKind).toBe(StopLossOrderKind.Limit);
    expect(long.lessTriggerOrder?.orderKind).toBe(StopLossOrderKind.IOC);
    expect(long.lessTriggerOrder?.tradeSide).toBe(Side.Ask);
    const short = buildTakeProfitStopLossTriggerOrders({
      primarySide: Side.Ask,
      takeProfitPrice: ticks(90n),
      stopLossPrice: ticks(110n),
      slippageBps: 50,
    });
    expect(short.greaterTriggerOrder?.tradeSide).toBe(Side.Bid);
    expect(short.lessTriggerOrder?.orderKind).toBe(StopLossOrderKind.Limit);
  });
});

it('requires an order-book slot close to the independently read chain slot', () => {
  expect(() => assertSourceSlotFresh(1000, 1010)).not.toThrow();
  expect(() => assertSourceSlotFresh(1000, 1076)).toThrow('out of sync');
  expect(() => assertSourceSlotFresh(1080, 1000)).toThrow('out of sync');
  expect(() => assertSourceSlotFresh(NaN, 1000)).toThrow('out of sync');
});
