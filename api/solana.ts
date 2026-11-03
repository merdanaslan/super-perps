import { createServer } from 'node:http';
import { configuredRelay } from '../server/runtime.ts';
import { nodeHandler } from '../server/node.ts';
import { createSocketRelay } from '../server/socket.ts';

const relay = configuredRelay(process.env);
const server = createServer(nodeHandler(relay));
const sockets = createSocketRelay(relay);
server.on('upgrade', sockets.upgrade);
server.on('close', sockets.close);
// Vercel owns the listening socket. This endpoint never stores or signs wallet keys.
export default server;
