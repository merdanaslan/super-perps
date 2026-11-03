import { Decimal } from 'decimal.js';
import type { MarketParams } from '@ellipsis-labs/rise';
export const Exact = Decimal.clone({ precision: 80 });
const U64 = new Exact('18446744073709551615');
export function assertSourceSlotFresh(source: number, chain: number) {
  if (
    !Number.isSafeInteger(source) ||
    !Number.isSafeInteger(chain) ||
    source <= 0 ||
    chain <= 0 ||
    Math.abs(chain - source) > 75
  ) {
    throw new Error('Market data and Solana RPC are out of sync. Refresh before trading.');
  }
}
function positive(value: string, label: string) {
  if (value.length > 60 || !/^\d+(\.\d+)?$/.test(value)) throw new Error(`Enter a valid ${label}.`);
  const d = new Exact(value);
  if (!d.isPositive() || d.isZero() || !d.isFinite())
    throw new Error(`${label} must be greater than zero.`);
  return d;
}
export function toLots(value: string, decimals: number, label = 'amount') {
  const lots = positive(value, label).mul(new Exact(10).pow(decimals));
  if (!lots.isInteger())
    throw new Error(
      `${label} must use whole market lots (${new Exact(10).pow(-decimals).toFixed()}).`,
    );
  if (lots.gt(U64)) throw new Error(`${label} exceeds the protocol limit.`);
  return BigInt(lots.toFixed(0));
}
export const fromLots = (lots: bigint | string, decimals: number) =>
  new Exact(String(lots)).div(new Exact(10).pow(decimals)).toFixed();
export function toTicks(price: string, market: Pick<MarketParams, 'tickSize' | 'baseLotDecimals'>) {
  const tickUsd = new Exact(market.tickSize)
    .mul(new Exact(10).pow(market.baseLotDecimals))
    .div(1_000_000);
  const ticks = positive(price, 'price').div(tickUsd);
  if (!ticks.isInteger()) throw new Error(`Price must be a multiple of ${tickUsd.toFixed()} USD.`);
  if (ticks.gt(U64)) throw new Error('Price exceeds the protocol limit.');
  return BigInt(ticks.toFixed(0));
}
export function validateExits(side: 'long' | 'short', reference: string, tp?: string, sl?: string) {
  const entry = positive(reference, 'entry price');
  if (tp) {
    const take = positive(tp, 'take-profit price');
    if (side === 'long' ? take.lte(entry) : take.gte(entry))
      throw new Error(
        `Take profit must be ${side === 'long' ? 'above' : 'below'} the entry price.`,
      );
  }
  if (sl) {
    const stop = positive(sl, 'stop-loss price');
    if (side === 'long' ? stop.gte(entry) : stop.lte(entry))
      throw new Error(`Stop loss must be ${side === 'long' ? 'below' : 'above'} the entry price.`);
  }
}
export function assertCloseSize(position: bigint, side: 'long' | 'short', lots: bigint) {
  if (position === 0n || (position > 0n ? side !== 'short' : side !== 'long'))
    throw new Error('There is no position to close on this side.');
  if (lots > (position < 0n ? -position : position))
    throw new Error('Closing size exceeds the current position.');
}
