import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  address,
  generateKeyPair,
  getAddressFromPublicKey,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getTokenEncoder,
  getTransferCheckedInstructionDataDecoder,
  TOKEN_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  getTransferSolInstructionDataDecoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import { MAINNET_GENESIS, toBase64, type RpcAccount, type RpcCall } from './chain';
import { USDC_MINT } from './tokens';
import { readWalletBalances } from './wallet-balances';
import { prepareWalletTransfer } from './wallet-transfers';
import { TradingService } from './service';

function message(bytes: ReadonlyUint8Array) {
  const decoded = getCompiledTransactionMessageDecoder().decode(
    getTransactionDecoder().decode(bytes).messageBytes,
  );
  if (decoded.version !== 0) throw new Error('Expected a v0 transaction');
  return decoded;
}
async function fixture() {
  // Unfunded, ephemeral identities. RPC responses are modeled; nothing is signed or sent.
  const owner = await getAddressFromPublicKey((await generateKeyPair()).publicKey);
  const recipient = await getAddressFromPublicKey((await generateKeyPair()).publicKey);
  const state = {
    sol: 50_000_000,
    usdc: 2_123_456n,
    fee: 5_000 as number | null,
    genesis: MAINNET_GENESIS,
    slot: 100,
    simulationSlot: 101,
    rent: 2_039_280,
    err: null as unknown,
    destination: null as RpcAccount | null,
    after: undefined as number | null | undefined,
    omitAccounts: false,
    tokenOwner: TOKEN_PROGRAM_ADDRESS as string,
    tokenMint: address(USDC_MINT) as Address,
    tokenAuthority: owner,
  };
  const calls = vi.fn(async (method: string, params: unknown[] = []): Promise<unknown> => {
    switch (method) {
      case 'getGenesisHash':
        return state.genesis;
      case 'getMultipleAccounts':
        return {
          context: { slot: state.slot },
          value: [
            state.sol === 0
              ? null
              : { owner: SYSTEM_PROGRAM_ADDRESS, lamports: state.sol, data: ['', 'base64'] },
            {
              owner: state.tokenOwner,
              lamports: 2_039_280,
              data: [
                toBase64(
                  getTokenEncoder().encode({
                    mint: state.tokenMint,
                    owner: state.tokenAuthority,
                    amount: state.usdc,
                    state: 1,
                    delegate: null,
                    isNative: null,
                    delegatedAmount: 0n,
                    closeAuthority: null,
                  }),
                ),
                'base64',
              ],
            },
          ],
        };
      case 'getAccountInfo':
        return { value: state.destination };
      case 'getBalance':
        return { value: state.sol };
      case 'getLatestBlockhash':
        return {
          value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 200 },
        };
      case 'getFeeForMessage':
        return { value: state.fee };
      case 'simulateTransaction': {
        const tx = message(getBase64Encoder().encode(String(params[0])));
        const native = tx.instructions.find(
          (ix) => tx.staticAccounts[ix.programAddressIndex] === SYSTEM_PROGRAM_ADDRESS,
        );
        const sent = native
          ? Number(getTransferSolInstructionDataDecoder().decode(native.data!).amount)
          : 0;
        const remaining =
          state.after === undefined
            ? state.sol - (state.fee ?? 0) - sent - (native ? 0 : state.rent)
            : state.after;
        return {
          context: { slot: state.simulationSlot },
          value: {
            err: state.err,
            logs: [],
            unitsConsumed: 10_000,
            accounts: state.omitAccounts
              ? undefined
              : [remaining === null || remaining === 0 ? null : { lamports: remaining }],
          },
        };
      }
      default:
        throw new Error(`Unexpected RPC method: ${method}`);
    }
  });
  const rpc = calls as RpcCall;
  const sol = (overrides = {}) =>
    prepareWalletTransfer(rpc, owner, {
      kind: 'send',
      asset: 'SOL',
      amount: '0.01',
      recipient,
      ...overrides,
    });
  const usdc = (overrides = {}) =>
    prepareWalletTransfer(rpc, owner, {
      kind: 'send',
      asset: 'USDC',
      amount: '1.123456',
      recipient,
      ...overrides,
    });
  return { owner, recipient, state, rpc, calls, sol, usdc };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('wallet transfers', () => {
  it('encodes exact native lamports, sender and destination without calling Phoenix or charging rent', async () => {
    const f = await fixture();
    const plan = await f.sol({ amount: '0.010000001' });
    const tx = message(plan.bytes);
    expect(tx.instructions).toHaveLength(1);
    const ix = tx.instructions[0]!;
    expect(tx.staticAccounts[ix.programAddressIndex]).toBe(SYSTEM_PROGRAM_ADDRESS);
    expect(ix.accountIndices?.map((i) => tx.staticAccounts[i])).toEqual([f.owner, f.recipient]);
    expect(getTransferSolInstructionDataDecoder().decode(ix.data!).amount).toBe(10_000_001n);
    expect(plan.rentLamports).toBe(0);
    expect(plan.details).toContainEqual(['SOL left in wallet', '0.039994999 SOL']);
    expect(f.calls.mock.calls.some(([method]) => method === 'sendTransaction')).toBe(false);
  });
  it('resolves Max after the message fee and accepts the empty system account in simulation', async () => {
    const f = await fixture();
    const plan = await f.sol({ amount: '', max: true });
    expect(plan.action).toMatchObject({ amount: '0.049995', max: true });
    expect(plan.feeLamports).toBe(5_000);
    expect(plan.rentLamports).toBe(0);
    expect(plan.details).toContainEqual(['SOL left in wallet', '0 SOL']);
    expect(
      getTransferSolInstructionDataDecoder().decode(message(plan.bytes).instructions[0]!.data!)
        .amount,
    ).toBe(49_995_000n);
    expect(f.calls.mock.calls.filter(([method]) => method === 'simulateTransaction')).toHaveLength(
      1,
    );
  });
  it.each([0, 4_999, 5_000])(
    'rejects Max when %s lamports cannot cover a positive send plus fee',
    async (sol) => {
      const f = await fixture();
      f.state.sol = sol;
      await expect(f.sol({ max: true, amount: '' })).rejects.toThrow(/Not enough SOL/);
    },
  );
  it('rejects sending the displayed SOL balance without reserving its fee', async () => {
    const f = await fixture();
    await expect(f.sol({ amount: '0.05' })).rejects.toThrow(/network fee/);
  });
  it.each(['0', '-1', '1e-3', '0.0000000001'])(
    'rejects invalid native precision or amount %s',
    async (amount) => {
      const f = await fixture();
      await expect(f.sol({ amount })).rejects.toThrow();
    },
  );
  it('rejects a stale or changed balance instead of silently changing the reviewed amount', async () => {
    const f = await fixture();
    f.state.after = 40_000_000;
    await expect(f.sol()).rejects.toThrow(/balance changed/);
    f.state.after = undefined;
    f.state.simulationSlot = 99;
    await expect(f.sol()).rejects.toThrow(/balance changed/);
  });
  it('does not treat a missing simulation account as a fully drained wallet', async () => {
    const f = await fixture();
    f.state.omitAccounts = true;
    await expect(f.sol({ max: true, amount: '' })).rejects.toThrow(/did not report/);
  });
  it('fails closed on simulation rejection, expired fee quotes and a non-mainnet RPC', async () => {
    const f = await fixture();
    f.state.err = { InsufficientFundsForRent: { account_index: 1 } };
    await expect(f.sol()).rejects.toThrow(/No transaction was signed/);
    f.state.err = null;
    f.state.fee = null;
    await expect(f.sol()).rejects.toThrow(/expired/);
    f.state.genesis = 'devnet';
    await expect(f.sol()).rejects.toThrow(/mainnet/);
  });
  it('builds only ATA creation and a checked USDC transfer, preserving USDC precision and rent disclosure', async () => {
    const f = await fixture();
    const plan = await f.usdc();
    const tx = message(plan.bytes);
    const programs = tx.instructions.map((ix) => tx.staticAccounts[ix.programAddressIndex]);
    expect(programs.slice(-2)).toEqual([ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS]);
    expect(
      getTransferCheckedInstructionDataDecoder().decode(tx.instructions.at(-1)!.data!),
    ).toEqual({ discriminator: 12, amount: 1_123_456n, decimals: 6 });
    expect(plan.rentLamports).toBe(f.state.rent);
    expect(plan.details).toContainEqual(['Amount', '1.123456 USDC']);
    expect(tx.staticAccounts).toContain(USDC_MINT);
    expect(tx.staticAccounts).toContain(f.recipient);
  });
  it('rejects USDC overbalance, excess decimals and native Max intent applied to USDC', async () => {
    const f = await fixture();
    await expect(f.usdc({ amount: '3' })).rejects.toThrow(/Not enough USDC/);
    await expect(f.usdc({ amount: '0.0000001' })).rejects.toThrow(/whole market lots/);
    await expect(f.usdc({ max: true })).rejects.toThrow(/Enter the USDC amount/);
  });
  it('rejects self-sends and program or token-account destinations for both assets', async () => {
    const f = await fixture();
    await expect(f.sol({ recipient: f.owner })).rejects.toThrow(/other than your app wallet/);
    await expect(f.usdc({ recipient: '11111111111111111111111111111111' })).rejects.toThrow(
      /wallet address/,
    );
    f.state.destination = { owner: TOKEN_PROGRAM_ADDRESS, lamports: 1, data: ['', 'base64'] };
    await expect(f.sol()).rejects.toThrow(/not a regular Solana wallet/);
    await expect(f.usdc()).rejects.toThrow(/not a regular Solana wallet/);
  });
  it('keeps the complete service preparation path independent of Phoenix registration and APIs', async () => {
    const f = await fixture();
    const venue = vi
      .spyOn(TradingService.prototype, 'refreshExchange')
      .mockRejectedValue(new Error('Phoenix unavailable'));
    const account = vi
      .spyOn(TradingService.prototype, 'readAccount')
      .mockRejectedValue(new Error('No trader account'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        if (url !== 'https://rpc.example.invalid') throw new Error('Unexpected venue request');
        const body = JSON.parse(init.body);
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: await f.rpc(body.method, body.params),
        });
      }),
    );
    const service = new TradingService(
      'https://phoenix.example.invalid',
      'https://rpc.example.invalid',
    );
    try {
      await expect(
        service.prepare(f.owner, {
          kind: 'send',
          asset: 'SOL',
          amount: '0.01',
          recipient: f.recipient,
        }),
      ).resolves.toHaveProperty('title', 'Send SOL');
      await expect(
        service.prepare(f.owner, {
          kind: 'send',
          asset: 'USDC',
          amount: '1',
          recipient: f.recipient,
        }),
      ).resolves.toHaveProperty('title', 'Send USDC');
      expect(venue).not.toHaveBeenCalled();
      expect(account).not.toHaveBeenCalled();
    } finally {
      service.dispose();
    }
  });
});

describe('independent wallet balances', () => {
  it('reads both balances from one slot and validates the USDC account identity', async () => {
    const f = await fixture();
    await expect(readWalletBalances(f.rpc, f.owner)).resolves.toMatchObject({
      authority: f.owner,
      walletUsdc: 2_123_456n,
      walletSol: 50_000_000n,
      slot: 100,
    });
    f.state.tokenMint = f.recipient;
    await expect(readWalletBalances(f.rpc, f.owner)).rejects.toThrow(/does not match/);
    f.state.tokenMint = address(USDC_MINT);
    f.state.tokenAuthority = f.recipient;
    await expect(readWalletBalances(f.rpc, f.owner)).rejects.toThrow(/does not match/);
    f.state.tokenOwner = SYSTEM_PROGRAM_ADDRESS;
    await expect(readWalletBalances(f.rpc, f.owner)).rejects.toThrow(/Unexpected USDC/);
  });
  it('reports absent wallet accounts as zero but rejects imprecise native balances', async () => {
    const f = await fixture();
    const empty = vi.fn(async () => ({ context: { slot: 100 }, value: [null, null] })) as RpcCall;
    await expect(readWalletBalances(empty, f.owner)).resolves.toMatchObject({
      walletSol: 0n,
      walletUsdc: 0n,
    });
    f.state.sol = Number.MAX_SAFE_INTEGER + 1;
    await expect(readWalletBalances(f.rpc, f.owner)).rejects.toThrow(/invalid SOL balance/);
  });
});
