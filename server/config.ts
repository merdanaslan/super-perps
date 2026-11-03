/** Only this server module reads private provider settings. VITE_* stays public. */
export function readRelayConfig(env: Record<string, string | undefined>) {
  try {
    const rpcUrl = env.SOLANA_RPC_URL?.trim() ?? '';
    const wsUrl = env.SOLANA_WS_URL?.trim() || (rpcUrl ? rpcUrl.replace(/^http/, 'ws') : '');
    for (const [value, protocol] of [
      [rpcUrl, 'https:'],
      [wsUrl, 'wss:'],
    ]) {
      if (!value) continue;
      const url = new URL(value);
      if (url.protocol !== protocol || url.hash) throw new Error();
    }
    const appId = (env.PRIVY_APP_ID || env.VITE_PRIVY_APP_ID)?.trim() ?? '';
    const origins = env.RPC_ALLOWED_ORIGINS?.trim()
      ? env.RPC_ALLOWED_ORIGINS.split(',').map((value) => value.trim())
      : env.VERCEL_URL
        ? [`https://${env.VERCEL_URL}`]
        : env.VERCEL
          ? []
          : [
              'http://127.0.0.1:5173',
              'http://localhost:5173',
              'http://127.0.0.1:4173',
              'http://localhost:4173',
            ];
    for (const origin of origins) {
      const url = new URL(origin);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (
        url.origin !== origin ||
        url.hostname.includes('*') ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && !env.VERCEL))
      )
        throw new Error();
    }
    return { rpcUrl, wsUrl, appId, origins: [...new Set(origins)] };
  } catch {
    throw new Error('Invalid server RPC configuration.');
  }
}
