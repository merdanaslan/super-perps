import { describe, expect, it, vi } from 'vitest';
import {
  address,
  generateKeyPair,
  getAddressFromPublicKey,
  getTransactionDecoder,
  getTransactionEncoder,
  partiallySignTransaction,
  type Instruction,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  getTransferCheckedInstructionDataDecoder,
  TOKEN_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { compileInstructions, verifyWalletSignature, type RpcCall } from './chain';
import { USDC_MINT } from './tokens';
import { withdrawalInstructions, withdrawalRecipient } from './withdrawal';

const phoenixInstructions: Instruction[] = [
  {
    programAddress: address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    data: new Uint8Array([1]),
  },
];
async function fixture() {
  // Ephemeral local keys, never funded or submitted. The real SDK wire shape is checked by the probe.
  const key = await generateKeyPair();
  const authority = await getAddressFromPublicKey(key.publicKey);
  const recipient = await getAddressFromPublicKey((await generateKeyPair()).publicKey);
  const rpc = vi.fn(async () => ({ value: null }));
  return { key, authority, recipient, rpc, amount: 1_234_567n, phoenixInstructions };
}

describe('withdrawal destination', () => {
  it.each(['', '   ', '0x1234567890', 'not-a-wallet', '11111111111111111111111111111111'])(
    'rejects an invalid wallet address: %s',
    (value) => expect(() => withdrawalRecipient(value)).toThrow(/Solana wallet/),
  );
  it('accepts surrounding whitespace but rejects a token account PDA', async () => {
    const { recipient } = await fixture();
    expect(withdrawalRecipient(` ${recipient}\n`)).toBe(recipient);
    const [ata] = await findAssociatedTokenPda({
      owner: recipient,
      mint: address(USDC_MINT),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    expect(() => withdrawalRecipient(ata)).toThrow(/program or token account/);
  });
  it('preserves an own-wallet withdrawal with no additional transfer', async () => {
    const f = await fixture();
    const result = await withdrawalInstructions({
      ...f,
      recipient: f.authority,
      rpc: f.rpc as RpcCall,
    });
    expect(result).toEqual(phoenixInstructions);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('appends recipient ATA creation and the exact withdrawal amount, after the Phoenix instructions', async () => {
    const f = await fixture();
    const result = await withdrawalInstructions({ ...f, rpc: f.rpc as RpcCall });
    expect(f.rpc).toHaveBeenCalledWith('getAccountInfo', [
      f.recipient,
      { commitment: 'confirmed', encoding: 'base64' },
    ]);
    expect(result.slice(0, -2)).toEqual(phoenixInstructions);
    const [source] = await findAssociatedTokenPda({
      owner: f.authority,
      mint: address(USDC_MINT),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [destination] = await findAssociatedTokenPda({
      owner: f.recipient,
      mint: address(USDC_MINT),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const create = result.at(-2)!;
    expect(create.programAddress).toBe(ASSOCIATED_TOKEN_PROGRAM_ADDRESS);
    expect(create.accounts?.slice(0, 4).map((a) => a.address)).toEqual([
      f.authority,
      destination,
      f.recipient,
      USDC_MINT,
    ]);
    expect([...create.data!]).toEqual([1]); // Idempotent: existing ATA remains usable.
    const transfer = result.at(-1)!;
    expect(transfer.programAddress).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(transfer.accounts?.map((a) => a.address)).toEqual([
      source,
      USDC_MINT,
      destination,
      f.authority,
    ]);
    expect(transfer.accounts?.[3]?.role).toBe(2); // Only the sender signs for token movement.
    expect(getTransferCheckedInstructionDataDecoder().decode(transfer.data!)).toEqual({
      discriminator: 12,
      amount: f.amount,
      decimals: 6,
    });
  });
  it.each([
    { owner: TOKEN_PROGRAM_ADDRESS, data: ['', 'base64'] },
    { owner: SYSTEM_PROGRAM_ADDRESS, data: ['AQ==', 'base64'] },
    { owner: SYSTEM_PROGRAM_ADDRESS, data: ['', 'base64'], executable: true },
  ])('refuses existing non-wallet destination accounts', async (account) => {
    const f = await fixture();
    f.rpc.mockResolvedValue({ value: account } as never);
    await expect(withdrawalInstructions({ ...f, rpc: f.rpc as RpcCall })).rejects.toThrow(
      /not a regular Solana wallet/,
    );
  });
  it('accepts an existing normal wallet and fails closed on unavailable RPC', async () => {
    const f = await fixture();
    f.rpc.mockResolvedValueOnce({
      value: { owner: SYSTEM_PROGRAM_ADDRESS, data: ['', 'base64'], executable: false },
    } as never);
    expect(await withdrawalInstructions({ ...f, rpc: f.rpc as RpcCall })).toHaveLength(3);
    f.rpc.mockRejectedValueOnce(new Error('RPC unavailable'));
    await expect(withdrawalInstructions({ ...f, rpc: f.rpc as RpcCall })).rejects.toThrow(
      'RPC unavailable',
    );
  });
  it.each([0n, -1n, 18_446_744_073_709_551_616n])('rejects unsafe amounts: %s', async (amount) => {
    const f = await fixture();
    await expect(withdrawalInstructions({ ...f, amount, rpc: f.rpc as RpcCall })).rejects.toThrow(
      /positive USDC amount/,
    );
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('never produces a wallet-only transfer if the Phoenix withdrawal is absent', async () => {
    const f = await fixture();
    await expect(
      withdrawalInstructions({ ...f, phoenixInstructions: [], rpc: f.rpc as RpcCall }),
    ).rejects.toThrow('Missing Phoenix withdrawal');
  });
  it('binds the destination into the reviewed message and rejects wallet substitution', async () => {
    const f = await fixture();
    const lifetime = { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 200 };
    const instructions = await withdrawalInstructions({ ...f, rpc: f.rpc as RpcCall });
    const { bytes } = compileInstructions(f.authority, lifetime, instructions);
    const plan = {
      authority: f.authority,
      bytes,
      lifetime,
      feeLamports: 5000,
      rentLamports: 0,
      preparedAt: Date.now(),
    };
    const sign = async (input: Uint8Array) =>
      new Uint8Array(
        getTransactionEncoder().encode(
          await partiallySignTransaction([f.key], getTransactionDecoder().decode(input)),
        ),
      );
    await expect(verifyWalletSignature(plan, await sign(bytes))).resolves.toHaveProperty(
      'signature',
    );
    const replaced = await withdrawalInstructions({
      ...f,
      recipient: await getAddressFromPublicKey((await generateKeyPair()).publicKey),
      rpc: f.rpc as RpcCall,
    });
    await expect(
      verifyWalletSignature(
        plan,
        await sign(compileInstructions(f.authority, lifetime, replaced).bytes),
      ),
    ).rejects.toThrow(/reviewed transaction/);
  });
});
