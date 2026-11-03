import { privateRpcStrings } from './rpc-secrets.ts';

/** Fail closed if a private endpoint is accidentally copied into VITE_* or
 * imported by the client. Diagnostics deliberately never echo credentials. */
export function assertNoPrivateRpc(contents: string, env: Record<string, string | undefined>) {
  const secrets = privateRpcStrings([env.SOLANA_RPC_URL, env.SOLANA_WS_URL]);
  if (secrets.some((value) => contents.includes(value)))
    throw new Error('Private RPC configuration reached browser output.');
}
