import {
  createDefaultRpcTransport,
  createSolanaRpc,
  createSolanaRpcFromTransport,
  createDefaultRpcSubscriptionsTransport,
  createDefaultSolanaRpcSubscriptionsChannelCreator,
  createSolanaRpcSubscriptions,
  createSolanaRpcSubscriptionsFromTransport,
} from '@solana/kit';
import { ensureRpcSession, isRelayUrl } from './rpc-session';

/** Authenticate before Kit opens a socket: browser WebSockets cannot add a
 * bearer header. The short HttpOnly cookie keeps tokens out of connection URLs. */
export function createWalletRpcClients(rpcUrl: string, wsUrl: string) {
  function http() {
    if (!isRelayUrl(rpcUrl)) return createSolanaRpc(rpcUrl);
    const transport = createDefaultRpcTransport({ url: rpcUrl });
    return createSolanaRpcFromTransport(async (config) => {
      await ensureRpcSession(rpcUrl);
      return transport(config);
    });
  }
  function subscriptions() {
    if (!isRelayUrl(wsUrl)) return createSolanaRpcSubscriptions(wsUrl);
    const createChannel = createDefaultSolanaRpcSubscriptionsChannelCreator({
      url: wsUrl,
      maxSubscriptionsPerChannel: 8,
    });
    return createSolanaRpcSubscriptionsFromTransport(
      createDefaultRpcSubscriptionsTransport({
        createChannel: async (config) => {
          await ensureRpcSession(wsUrl);
          return createChannel(config);
        },
      }),
    );
  }
  return { rpc: http(), rpcSubscriptions: subscriptions() };
}
