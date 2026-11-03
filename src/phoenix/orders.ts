import {
  buildMarketOrderPacketFromMarketParams,
  OrderFlags,
  Side,
  symbol as phoenixSymbol,
  type Authority,
  type ImmediateOrCancelOrderPacket,
  type PhoenixClient,
} from '@ellipsis-labs/rise';
import { address } from '@solana/kit';
import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 80 });
const MAX_LOTS = new ExactDecimal('18446744073709551615');
const MAX_QUOTE_AGE_MS = 15_000;

function positiveDecimal(value: string, label: string) {
  if (value.length > 60 || !/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid ${label}: enter a positive decimal amount.`);
  }
  const decimal = new ExactDecimal(value);
  if (!decimal.isFinite() || !decimal.isPositive() || decimal.isZero()) {
    throw new Error(`Invalid ${label}: amount must be greater than zero.`);
  }
  return decimal;
}

export interface MarketOrderIntent {
  symbol: string;
  side: 'long' | 'short';
  baseUnits: string;
  slippageBps: number;
  reduceOnly: boolean;
}

export interface MarketRules {
  symbol: string;
  status: string;
  tickSize: bigint | number | string;
  baseLotsDecimals: number;
}

export interface BookQuote {
  symbol: string;
  bid: string;
  ask: string;
  receivedAtMs: number;
}

export function prepareMarketOrder(
  intent: MarketOrderIntent,
  market: MarketRules,
  quote: BookQuote,
  now: number,
): { packet: ImmediateOrCancelOrderPacket; priceLimitUsd: string } {
  if (intent.symbol !== market.symbol || quote.symbol !== market.symbol) {
    throw new Error('Order, quote and market must refer to the same canonical market.');
  }
  if (market.status !== 'active') throw new Error('Market is not active.');
  if (intent.side !== 'long' && intent.side !== 'short') throw new Error('Invalid order side.');
  if (!Number.isFinite(now) || !Number.isFinite(quote.receivedAtMs) || quote.receivedAtMs > now) {
    throw new Error('Invalid quote receipt time.');
  }
  if (now - quote.receivedAtMs > MAX_QUOTE_AGE_MS)
    throw new Error('Quote is stale; refresh the book.');
  if (!Number.isInteger(intent.slippageBps) || intent.slippageBps < 1 || intent.slippageBps > 500) {
    throw new Error('Slippage must be an integer from 1 to 500 basis points.');
  }
  if (!Number.isInteger(market.baseLotsDecimals) || Math.abs(market.baseLotsDecimals) > 18) {
    throw new Error('Unsupported market lot precision.');
  }

  const size = positiveDecimal(intent.baseUnits, 'size');
  const lots = size.mul(new ExactDecimal(10).pow(market.baseLotsDecimals));
  if (!lots.isInteger()) throw new Error('Size must be a whole number of market lots.');
  if (lots.gt(MAX_LOTS)) throw new Error('Order size exceeds the protocol limit.');

  const bid = positiveDecimal(quote.bid, 'bid');
  const ask = positiveDecimal(quote.ask, 'ask');
  if (bid.gt(ask)) throw new Error('Order book is crossed; refresh before preparing an order.');
  const isLong = intent.side === 'long';
  const reference = isLong ? ask : bid;
  const factor = new ExactDecimal(1).plus(
    new ExactDecimal(intent.slippageBps).div(10_000).mul(isLong ? 1 : -1),
  );
  const priceLimitUsd = reference.mul(factor).toFixed();

  // Rise owns lot/tick rounding and wire flags. Never pass an unbounded market price.
  const packet = buildMarketOrderPacketFromMarketParams(
    {
      side: isLong ? Side.Bid : Side.Ask,
      baseUnits: intent.baseUnits,
      priceLimitUsd,
      orderFlags: intent.reduceOnly ? OrderFlags.ReduceOnly : OrderFlags.None,
      cancelExisting: false,
    },
    market,
  );
  if (
    packet.priceInTicks === null ||
    packet.priceInTicks <= 0n ||
    packet.priceInTicks > BigInt(MAX_LOTS.toFixed())
  ) {
    throw new Error('Price limit is outside the protocol tick range.');
  }
  return { packet, priceLimitUsd };
}

/** Constructs an instruction only: no signing, RPC submission, or account mutation. */
export async function buildUnsignedMarketOrder(
  client: PhoenixClient,
  authority: string,
  intent: MarketOrderIntent,
  quote: BookQuote,
) {
  const validatedAuthority = address(authority);
  await client.exchange.ready();
  const market = client.exchange.market(intent.symbol);
  if (!market) throw new Error(`Unsupported Phoenix market: ${intent.symbol}`);
  if (market.isolatedOnly) throw new Error('This lab only builds default cross-account orders.');
  const prepared = prepareMarketOrder(
    intent,
    {
      symbol: phoenixSymbol(market.symbol),
      status: market.marketStatus,
      tickSize: market.tickSize,
      baseLotsDecimals: market.baseLotsDecimals,
    },
    quote,
    Date.now(),
  );
  const instruction = await client.ixs.buildPlaceMarketOrder({
    authority: validatedAuthority as Authority,
    symbol: phoenixSymbol(market.symbol),
    orderPacket: prepared.packet,
    traderPdaIndex: 0,
    traderSubaccountIndex: 0,
  });
  return { ...prepared, instruction };
}
