import {
  flight,
  type Authority,
  type PhoenixProgramAddress,
  type TraderAddress,
} from '@ellipsis-labs/rise';
import { address, getBase64Encoder, type Instruction } from '@solana/kit';
import { PHOENIX_PROGRAM_ID } from '../phoenix/client';
import type { RpcAccount, RpcCall } from './chain';

export interface BuilderSettings {
  builderAuthority?: string;
  builderFeeBps?: string;
}
export interface BuilderRoute {
  authority: Authority;
  collector: TraderAddress;
  feeBps: bigint;
}

/** Blank disables Flight; "0" is an explicit fee, not a missing setting. */
export function parseBuilderSettings(settings: BuilderSettings) {
  const authority = settings.builderAuthority?.trim() || '';
  const fee = settings.builderFeeBps?.trim() || '';
  if (!authority && !fee) return undefined;
  if (!authority || !/^(0|[1-9]\d{0,4})$/.test(fee) || BigInt(fee) > 10_000n)
    throw new Error(
      'Builder routing requires a valid public authority and an integer fee in basis points.',
    );
  return { authority: address(authority) as Authority, feeBps: BigInt(fee) };
}

/** Verify both on-chain accounts before enabling routing. Never fall back to a guessed collector. */
export async function readBuilderRoute(
  rpc: RpcCall,
  settings: BuilderSettings,
): Promise<BuilderRoute | undefined> {
  const configured = parseBuilderSettings(settings);
  if (!configured) return;
  const phoenix = address(PHOENIX_PROGRAM_ID) as PhoenixProgramAddress;
  const keys = await Promise.all([
    flight.getFlightGlobalStateAddress(phoenix),
    flight.getFlightBuilderStateAddress(configured.authority, phoenix),
  ]);
  const response = await rpc<{ value: (RpcAccount | null)[] }>('getMultipleAccounts', [
    keys,
    { encoding: 'base64', commitment: 'confirmed' },
  ]);
  const [globalAccount, builderAccount] = response.value;
  if (
    !globalAccount ||
    !builderAccount ||
    response.value.length !== 2 ||
    globalAccount.owner !== flight.FLIGHT_PROGRAM_ADDRESS ||
    builderAccount.owner !== flight.FLIGHT_PROGRAM_ADDRESS
  )
    throw new Error('The configured Flight builder is unavailable or has not been registered.');
  const decode = (account: RpcAccount) =>
    new Uint8Array(getBase64Encoder().encode(account.data[0]));
  const global = flight.decodeGlobalState(decode(globalAccount));
  const builder = flight.decodeBuilderState(decode(builderAccount));
  if (
    global.programId !== phoenix ||
    builder.authorityKey !== configured.authority ||
    !builder.isActive
  )
    throw new Error('The configured Flight builder is inactive or belongs to another exchange.');
  // The dashboard registration stores a default; an order can explicitly use zero.
  // Requiring a registered-rate match for paid routes is this starter's policy,
  // not an SDK restriction. The exchange cap still applies to every route.
  if (
    (configured.feeBps !== 0n && configured.feeBps !== builder.feeBps) ||
    configured.feeBps > global.maxFeeCapBps
  )
    throw new Error(
      'The configured builder fee does not match its registered rate or exceeds the exchange cap.',
    );
  return { ...configured, collector: builder.traderKey };
}

/**
 * Pin the reviewed rate into each order after verifying registration and collector.
 * This changes the transaction's fee, not the builder's on-chain registered default.
 */
export async function routeBuilderOrders(
  instructions: Instruction[],
  owner: string,
  route: BuilderRoute,
) {
  return Promise.all(
    instructions.map((ix) =>
      flight.wrapInstructionWithFlight({
        phoenixInstruction: {
          ...ix,
          data: ix.data ?? new Uint8Array(),
          accounts: ix.accounts ?? [],
        },
        signer: address(owner) as Authority,
        phoenixProgramAddress: address(PHOENIX_PROGRAM_ID) as PhoenixProgramAddress,
        flight: {
          builderAuthority: route.authority,
          // Keep 0n explicit: omitting the override would use the registered fee.
          feeBpsOverride: route.feeBps,
        },
        resolveFeeCollectorTraderAddress: async () => route.collector,
      }),
    ),
  );
}

/** Preserve case; Phoenix validates code existence, eligibility and remaining uses on activation. */
export function referralCode(value: string): string {
  const code = value.trim();
  if (code && !/^[A-Za-z0-9_-]{1,64}$/.test(code))
    throw new Error('Use a referral code with up to 64 letters, numbers, hyphens or underscores.');
  return code;
}
