import { createPhoenixClient } from '@ellipsis-labs/rise';

export const PHOENIX_API_URL = 'https://perp-api.phoenix.trade';
export const PHOENIX_PROGRAM_ID = 'EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih';

export function createPublicPhoenixClient(apiUrl = PHOENIX_API_URL) {
  return createPhoenixClient({
    apiUrl,
    auth: false,
    timeout: 12_000,
    rateLimitRetry: false,
    // Public lab reads must not fall back to an ambient authenticated RPC.
    exchangeMetadata: { stream: false, rpc: { enabled: false } },
    ws: { connectMode: 'lazy', idleCloseMs: 1_000 },
  });
}

export type PublicPhoenixClient = ReturnType<typeof createPublicPhoenixClient>;
