import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { getAddressDecoder } from '@solana/kit';
import {
  createPublicPhoenixClient,
  PHOENIX_API_URL,
  PHOENIX_PROGRAM_ID,
} from '../src/phoenix/client';
import { quoteFromBook, readMarketSnapshot, sampleBookUpdates } from '../src/phoenix/data';
import { buildUnsignedMarketOrder } from '../src/phoenix/orders';

const client = createPublicPhoenixClient(process.env.VITE_PHOENIX_API_URL || PHOENIX_API_URL);
// A fixed public byte string, not a generated wallet. No private key exists in this probe.
const syntheticAuthority = getAddressDecoder().decode(new Uint8Array(32).fill(7));
const checks: Array<{
  name: string;
  passed: boolean;
  durationMs: number;
  detail?: unknown;
  error?: string;
}> = [];
const startedAt = new Date().toISOString();

async function check(name: string, run: () => Promise<unknown>) {
  const start = performance.now();
  try {
    const detail = await run();
    checks.push({ name, passed: true, durationMs: Math.round(performance.now() - start), detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name,
      passed: false,
      durationMs: Math.round(performance.now() - start),
      error: message,
    });
    console.error(`FAIL ${name}: ${message}`);
    process.exitCode = 1;
  }
}

try {
  await check('official SDK exchange metadata', async () => {
    const snapshot = await client.exchange.ready();
    assert.equal(snapshot.exchange.programId, PHOENIX_PROGRAM_ID);
    assert(snapshot.markets.length > 0);
    const sol = client.exchange.market('SOL');
    assert(sol, 'Canonical SOL market must exist');
    return {
      source: client.exchange.source(),
      programId: snapshot.exchange.programId,
      slot: snapshot.slot,
      marketCount: snapshot.markets.length,
      sol: {
        status: sol.marketStatus,
        baseLotsDecimals: sol.baseLotsDecimals,
        tickSize: sol.tickSize,
      },
    };
  });

  await check('public SOL order book and exchange candles', async () => {
    const result = await readMarketSnapshot(client, 'SOL');
    const quote = quoteFromBook(result.book, result.receivedAtMs);
    assert(result.candles.length > 0);
    assert(
      result.candles.every((candle) => candle.time > 1_000_000_000_000 && !candle.externalSource),
    );
    return {
      quote,
      slot: result.book.slot,
      candles: result.candles.length,
      lastCandle: result.candles.at(-1),
    };
  });

  await check('three public WebSocket book updates', async () => {
    const samples = await sampleBookUpdates(client, 'SOL');
    assert(
      samples.every(
        (sample) => sample.market === 'SOL' && sample.bid !== null && sample.ask !== null,
      ),
    );
    assert(
      new Set(samples.map((sample) => sample.slot)).size > 1,
      'Expect updates from multiple slots',
    );
    assert(
      samples.every((sample) => Math.abs(sample.receivedAtMs - sample.serverTimeMs) < 60_000),
      'Check timestamp units and freshness',
    );
    return samples;
  });

  await check('unsigned long, short and reduce-only instructions', async () => {
    const book = await client.api.orderbook().getOrderbook('SOL');
    const quote = quoteFromBook(book, Date.now());
    const results = [];
    for (const order of [
      { side: 'long', reduceOnly: false },
      { side: 'short', reduceOnly: false },
      { side: 'short', reduceOnly: true },
    ] as const) {
      const prepared = await buildUnsignedMarketOrder(
        client,
        syntheticAuthority,
        {
          symbol: 'SOL',
          baseUnits: '1',
          slippageBps: 100,
          ...order,
        },
        quote,
      );
      assert.equal(prepared.instruction.programAddress, PHOENIX_PROGRAM_ID);
      assert((prepared.instruction.data?.length ?? 0) > 0);
      assert((prepared.instruction.accounts?.length ?? 0) > 0);
      results.push({
        ...order,
        priceLimitUsd: prepared.priceLimitUsd,
        packet: prepared.packet,
        programAddress: prepared.instruction.programAddress,
        accounts: prepared.instruction.accounts?.length,
        bytes: prepared.instruction.data?.length,
      });
    }
    return { syntheticAuthority, instructions: results, submitted: false };
  });

  await check('unsigned no-referral registration builder', async () => {
    // This endpoint only builds instructions. Never call sendRegisterIxs here.
    const result = await client.api.exchange().buildRegisterIxs({
      traderAuthority: syntheticAuthority,
      txFeePayer: syntheticAuthority,
      maxPositions: 32,
    });
    assert.equal(result.txFeePayer, syntheticAuthority);
    assert(result.instructions.some((instruction) => instruction.programId === PHOENIX_PROGRAM_ID));
    return {
      syntheticAuthority,
      traderPda: result.traderPda,
      includeRegisterTrader: result.includeRegisterTrader,
      instructions: result.instructions.map((ix) => ({
        programId: ix.programId,
        accounts: ix.keys.length,
        bytes: ix.data.length,
      })),
      maxPositions: result.maxPositions,
      submitted: false,
    };
  });
} finally {
  client.dispose();
  await mkdir('output', { recursive: true });
  await writeFile(
    'output/probe-latest.json',
    JSON.stringify(
      {
        startedAt,
        completedAt: new Date().toISOString(),
        endpoint: process.env.VITE_PHOENIX_API_URL || PHOENIX_API_URL,
        sdkVersion: '0.6.2',
        evidence:
          'Public reads and unsigned instruction construction only; no wallet, simulation, signing or submission.',
        checks,
      },
      (_, value: unknown) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ) + '\n',
  );
  console.log(
    `${checks.filter((result) => result.passed).length}/${checks.length} passed; details: output/probe-latest.json`,
  );
}
