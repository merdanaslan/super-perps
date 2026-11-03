import { createPrivyVerifier } from './auth.ts';
import { readRelayConfig } from './config.ts';
import { createRelay } from './relay.ts';

export function configuredRelay(env: Record<string, string | undefined>) {
  const settings = readRelayConfig(env);
  return createRelay({
    ...settings,
    rpcUrl: settings.appId ? settings.rpcUrl : '',
    verifyToken: createPrivyVerifier(settings.appId),
  });
}
