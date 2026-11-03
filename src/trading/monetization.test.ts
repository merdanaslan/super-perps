import { describe, expect, it, vi } from 'vitest';
import { DISCRIMINANTS, flight, type Authority, type TraderAddress } from '@ellipsis-labs/rise';
import {
  address,
  getAddressEncoder,
  getU64Decoder,
  getU64Encoder,
  type Instruction,
} from '@solana/kit';
import { PHOENIX_PROGRAM_ID } from '../phoenix/client';
import { toBase64, type RpcCall } from './chain';
import {
  parseBuilderSettings,
  readBuilderRoute,
  referralCode,
  routeBuilderOrders,
} from './monetization';

const authority = address('11111111111111111111111111111112') as Authority;
const collector = address('11111111111111111111111111111113') as TraderAddress;
const settings = { builderAuthority: authority, builderFeeBps: '2' };
function fixture() {
  // Synthetic account data: no registered builder or blockchain submission is implied.
  const global = new Uint8Array(368);
  global.set(flight.FLIGHT_ACCOUNT_DISCRIMINANTS.GLOBAL_STATE!);
  global.set(getAddressEncoder().encode(address(PHOENIX_PROGRAM_ID)), 8);
  global.set(getU64Encoder().encode(10n), 104);
  const builder = new Uint8Array(216);
  builder.set(flight.FLIGHT_ACCOUNT_DISCRIMINANTS.BUILDER_STATE!);
  builder.set(getAddressEncoder().encode(authority), 8);
  builder.set(getAddressEncoder().encode(collector), 40);
  builder.set(getU64Encoder().encode(1n), 72);
  builder.set(getU64Encoder().encode(2n), 80);
  const read = (owner: string = flight.FLIGHT_PROGRAM_ADDRESS) =>
    vi.fn(async () => ({
      value: [global, builder].map((data) => ({
        owner,
        data: [toBase64(data), 'base64'],
        lamports: 1,
      })),
    }));
  return { global, builder, read };
}
describe('optional Flight routing', () => {
  it('does no RPC work when placeholders are blank', async () => {
    const rpc = vi.fn();
    expect(parseBuilderSettings({})).toBeUndefined();
    expect(await readBuilderRoute(rpc, {})).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { builderAuthority: authority },
    { builderFeeBps: '2' },
    { ...settings, builderFeeBps: '-1' },
    { ...settings, builderFeeBps: '0.2' },
    { ...settings, builderFeeBps: '10001' },
    { ...settings, builderAuthority: 'placeholder' },
  ])('blocks incomplete or invalid configuration: %j', (value) => {
    expect(() => parseBuilderSettings(value)).toThrow();
  });
  it('resolves the collector from the verified registered account', async () => {
    const rpc = fixture().read();
    expect(await readBuilderRoute(rpc as RpcCall, settings)).toEqual({
      authority,
      collector,
      feeBps: 2n,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('overrides a registered 10 bps fee with an explicit zero for educational routing', async () => {
    const f = fixture();
    f.builder.set(getU64Encoder().encode(10n), 80);
    const route = await readBuilderRoute(f.read() as RpcCall, {
      ...settings,
      builderFeeBps: '0',
    });
    expect(route).toEqual({ authority, collector, feeBps: 0n });
    const original: Instruction = {
      programAddress: address(PHOENIX_PROGRAM_ID),
      accounts: [{ address: authority, role: 2 }],
      data: new Uint8Array([...DISCRIMINANTS.PLACE_MARKET_ORDER!, 9, 17, 23]),
    };
    const [wrapped] = await routeBuilderOrders([original], authority, route!);
    expect(wrapped!.programAddress).toBe(flight.FLIGHT_PROGRAM_ADDRESS);
    expect(wrapped!.data.slice(0, 8)).toEqual(
      flight.FLIGHT_DISCRIMINANTS.PROXY_INSTRUCTION_WITH_FEE_OVERRIDE,
    );
    expect(wrapped!.data[8]).toBe(1); // Some(0), not None / the registered 10 bps.
    expect(getU64Decoder().decode(wrapped!.data.slice(9, 17))).toBe(0n);
    expect(wrapped!.data.slice(17)).toEqual(original.data);
  });
  it('still requires active registration when the app fee is zero', async () => {
    const f = fixture();
    f.builder.set(getU64Encoder().encode(0n), 72);
    await expect(
      readBuilderRoute(f.read() as RpcCall, { ...settings, builderFeeBps: '0' }),
    ).rejects.toThrow('inactive');
  });
  it.each(['inactive', 'authority', 'exchange', 'rate', 'cap', 'discriminant'] as const)(
    'blocks %s mismatches without using a fallback collector',
    async (kind) => {
      const f = fixture();
      if (kind === 'inactive') f.builder.set(getU64Encoder().encode(0n), 72);
      if (kind === 'authority') f.builder.set(getAddressEncoder().encode(collector), 8);
      if (kind === 'exchange') f.global.set(getAddressEncoder().encode(collector), 8);
      if (kind === 'rate') f.builder.set(getU64Encoder().encode(3n), 80);
      if (kind === 'cap') f.global.set(getU64Encoder().encode(1n), 104);
      if (kind === 'discriminant') f.builder[0] = f.builder[0]! ^ 1;
      await expect(readBuilderRoute(f.read() as RpcCall, settings)).rejects.toThrow();
    },
  );
  it('rejects absent accounts and accounts owned by another program', async () => {
    await expect(
      readBuilderRoute(vi.fn(async () => ({ value: [null, null] })) as RpcCall, settings),
    ).rejects.toThrow('not been registered');
    await expect(readBuilderRoute(fixture().read(authority) as RpcCall, settings)).rejects.toThrow(
      'not been registered',
    );
  });
  it.each(['PLACE_MARKET_ORDER', 'PLACE_LIMIT_ORDER', 'PLACE_LIMIT_ORDER_WITH_CONDITIONALS'])(
    'preserves %s payload and locks the reviewed fee into Flight',
    async (kind) => {
      const data = new Uint8Array([...DISCRIMINANTS[kind]!, 9, 17, 23]);
      const original: Instruction = {
        programAddress: address(PHOENIX_PROGRAM_ID),
        accounts: [{ address: authority, role: 2 }],
        data,
      };
      const [wrapped] = await routeBuilderOrders([original], authority, {
        authority,
        collector,
        feeBps: 2n,
      });
      if (!wrapped) throw new Error('Missing Flight instruction');
      expect(wrapped.programAddress).toBe(flight.FLIGHT_PROGRAM_ADDRESS);
      expect(wrapped.data.slice(0, 8)).toEqual(
        flight.FLIGHT_DISCRIMINANTS.PROXY_INSTRUCTION_WITH_FEE_OVERRIDE,
      );
      expect(wrapped.data[8]).toBe(1); // Some(fee), not a dynamic registered-rate lookup.
      expect(getU64Decoder().decode(wrapped.data.slice(9, 17))).toBe(2n);
      expect(wrapped.data.slice(17)).toEqual(data);
      expect(wrapped.accounts[3]!.address).toBe(collector);
      expect(wrapped.accounts.slice(6)).toEqual(original.accounts);
    },
  );
  it('does not wrap setup, deposits, withdrawals or cancellation', async () => {
    const kinds = [
      'REGISTER_TRADER',
      'DEPOSIT_FUNDS',
      'WITHDRAW_FUNDS',
      'CANCEL_ORDERS_BY_ID',
      'CREATE_CONDITIONAL_ORDERS_ACCOUNT',
    ];
    const originals = kinds.map((kind) => ({
      programAddress: address(PHOENIX_PROGRAM_ID),
      accounts: [],
      data: DISCRIMINANTS[kind]!,
    }));
    const result = await routeBuilderOrders(originals, authority, {
      authority,
      collector,
      feeBps: 2n,
    });
    expect(result).toEqual(originals);
  });
});
describe('configured referral codes', () => {
  it('preserves code case and allows blank configuration to disable referrals', () => {
    expect(referralCode('  Team-Super_1  ')).toBe('Team-Super_1');
    expect(referralCode('  ')).toBe('');
  });
  it.each(['abc/def', 'a?token=secret', 'two words', 'x'.repeat(65)])(
    'rejects malformed code %s',
    (code) => {
      expect(() => referralCode(code)).toThrow();
    },
  );
});
