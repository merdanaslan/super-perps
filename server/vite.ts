import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { configuredRelay } from './runtime.ts';
import { nodeHandler } from './node.ts';
import { createSocketRelay } from './socket.ts';
import { assertNoPrivateRpc } from './build-guard.ts';

export function rpcRelayPlugin(env: Record<string, string | undefined>): Plugin {
  function mount(server: ViteDevServer | PreviewServer) {
    const relay = configuredRelay(env);
    const handle = nodeHandler(relay);
    const sockets = createSocketRelay(relay);
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split('?')[0];
      if (path === '/api/solana' || path === '/api/rpc-session') void handle(request, response);
      else next();
    });
    server.httpServer?.on('upgrade', (request, socket, head) => {
      if (request.url?.split('?')[0] === '/api/solana') void sockets.upgrade(request, socket, head);
    });
    server.httpServer?.on('close', sockets.close);
  }
  return {
    name: 'private-solana-relay',
    configureServer: mount,
    configurePreviewServer: mount,
    generateBundle(_options, bundle) {
      for (const entry of Object.values(bundle)) {
        const contents =
          entry.type === 'chunk'
            ? entry.code
            : typeof entry.source === 'string'
              ? entry.source
              : Buffer.from(entry.source).toString('utf8');
        assertNoPrivateRpc(contents, env);
      }
    },
  };
}
