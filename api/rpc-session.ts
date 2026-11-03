import { configuredRelay } from '../server/runtime.ts';
const relay = configuredRelay(process.env);
export default { fetch: (request: Request) => relay.handle(request) };
