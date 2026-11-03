import { afterEach, describe, expect, it, vi } from 'vitest';
import { address } from '@solana/kit';
import {
  type ActivateReferralTxResponse,
  type Authority,
  type createPhoenixClient,
} from '@ellipsis-labs/rise';
import { TradingService } from './service';
import type { ReviewPlan } from './types';
import { toBase64 } from './chain';

afterEach(() => vi.restoreAllMocks());
async function fixture() {
  // All submission methods are mocked; these bytes are not a signable transaction.
  const service = new TradingService('https://phoenix.example', 'https://rpc.example');
  const authority = address('11111111111111111111111111111112') as Authority;
  const trader = await service.client.pda.getTraderAddress({
    authority,
    traderPdaIndex: 0,
    subaccountIndex: 0,
  });
  const signed = { bytes: new Uint8Array([1, 2, 3]), signature: 'original-signature' };
  const plan: ReviewPlan = {
    authority,
    action: { kind: 'setup', referralCode: 'EXAMPLE' },
    bytes: signed.bytes,
    lifetime: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 10 },
    preparedAt: Date.now(),
    feeLamports: 5000,
    rentLamports: 0,
    title: 'Set up Phoenix account',
    details: [],
  };
  const result: ActivateReferralTxResponse = {
    signature: signed.signature,
    trader_pda: trader,
    referral_code: 'EXAMPLE',
    status: 'submitted',
  };
  const activate = vi.fn(async () => result);
  const client = { api: { invite: () => ({ activateReferralTx: activate }) } };
  vi.spyOn(service.referralAuth, 'clientFor').mockReturnValue(
    client as unknown as ReturnType<typeof createPhoenixClient>,
  );
  const ordinarySetup = vi.spyOn(service.client.api.exchange(), 'sendRegisterIxs');
  const rpc = vi.spyOn(service, 'rpc').mockRejectedValue(new Error('Unexpected RPC submission'));
  return { service, signed, plan, result, activate, ordinarySetup, rpc };
}
describe('referral activation submission', () => {
  it('uses the same 32-position capacity when submitting ordinary account setup', async () => {
    const f = await fixture();
    try {
      f.plan.action = { kind: 'setup' };
      f.ordinarySetup.mockResolvedValue({
        signature: f.signed.signature,
        traderPda: f.result.trader_pda,
        traderOnboarder: '11111111111111111111111111111113',
        txFeePayer: f.plan.authority,
        maxPositions: 32,
        includeRegisterTrader: true,
      });
      await f.service.broadcast(f.plan, f.signed);
      expect(f.ordinarySetup).toHaveBeenCalledExactlyOnceWith({
        transaction: toBase64(f.signed.bytes),
        traderAuthority: f.plan.authority,
        txFeePayer: f.plan.authority,
        maxPositions: 32,
        traderPdaIndex: 0,
        traderSubaccountIndex: 0,
      });
      expect(f.activate).not.toHaveBeenCalled();
      expect(f.rpc).not.toHaveBeenCalled();
    } finally {
      f.service.dispose();
    }
  });
  it('submits only the reviewed code, authority, blockhash and signed bytes to the authenticated endpoint', async () => {
    const f = await fixture();
    try {
      await f.service.broadcast(f.plan, f.signed);
      expect(f.activate).toHaveBeenCalledExactlyOnceWith({
        referral_code: 'EXAMPLE',
        trader_authority: f.plan.authority,
        trader_pda_index: 0,
        trader_subaccount_index: 0,
        recent_blockhash: f.plan.lifetime.blockhash,
        transaction: toBase64(f.signed.bytes),
      });
      expect(f.ordinarySetup).not.toHaveBeenCalled();
      expect(f.rpc).not.toHaveBeenCalled();
    } finally {
      f.service.dispose();
    }
  });
  it.each(['signature', 'trader_pda', 'referral_code', 'status'] as const)(
    'rejects a mismatched %s without falling back to ordinary onboarding',
    async (field) => {
      const f = await fixture();
      try {
        if (field === 'status') f.result.status = 'already_activated';
        else f.result[field] = 'different';
        await expect(f.service.broadcast(f.plan, f.signed)).rejects.toThrow('not confirmed');
        expect(f.ordinarySetup).not.toHaveBeenCalled();
        expect(f.rpc).not.toHaveBeenCalled();
      } finally {
        f.service.dispose();
      }
    },
  );
  it('does not silently activate without a referral after a rejected code or network error', async () => {
    const f = await fixture();
    try {
      f.activate.mockRejectedValue(new Error('Invalid referral'));
      await expect(f.service.broadcast(f.plan, f.signed)).rejects.toThrow('Invalid referral');
      expect(f.ordinarySetup).not.toHaveBeenCalled();
      expect(f.rpc).not.toHaveBeenCalled();
    } finally {
      f.service.dispose();
    }
  });
});
