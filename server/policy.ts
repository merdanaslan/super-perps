export const REQUEST_LIMIT = 16_384;
export const RESPONSE_LIMIT = 1_048_576;
export interface RpcRequest {
  id: string | number;
  method: string;
  params: unknown[];
}
const account = (v: unknown) => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const signature = (v: unknown) => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(v);
const list = (v: unknown, valid: (entry: unknown) => boolean) =>
  Array.isArray(v) && v.length > 0 && v.length <= 32 && v.every(valid);
const base64 = (v: unknown) =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 1644 &&
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v);
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Intentionally excludes scans, batches, provider-specific APIs and signing.
 * Forward the original text after validation: Solana integers can exceed JS precision. */
export function parseRpcRequest(raw: string, websocket = false): RpcRequest {
  if (Buffer.byteLength(raw) > REQUEST_LIMIT) throw new Error('RPC request too large.');
  const data: unknown = JSON.parse(raw);
  if (
    !object(data) ||
    data.jsonrpc !== '2.0' ||
    !(
      (typeof data.id === 'string' && data.id.length <= 128) ||
      (typeof data.id === 'number' && Number.isSafeInteger(data.id))
    ) ||
    typeof data.method !== 'string' ||
    Object.keys(data).some((key) => !['id', 'jsonrpc', 'method', 'params'].includes(key))
  )
    throw new Error('Invalid RPC request.');
  const params = data.params ?? [];
  if (!Array.isArray(params) || params.length > 3) throw new Error('Invalid RPC parameters.');
  const [first, second] = params;
  let allowed = false;
  if (websocket) {
    if (data.method === 'accountSubscribe') allowed = account(first) && params.length <= 2;
    if (data.method === 'signatureSubscribe') allowed = signature(first) && params.length <= 2;
    if (['accountUnsubscribe', 'signatureUnsubscribe'].includes(data.method))
      allowed = params.length === 1 && Number.isSafeInteger(first) && Number(first) >= 0;
  } else {
    switch (data.method) {
      case 'getGenesisHash':
        allowed = params.length === 0;
        break;
      case 'getLatestBlockhash':
      case 'getBlockHeight':
      case 'getSlot':
        allowed = params.length <= 1 && (first === undefined || object(first));
        break;
      case 'getBalance':
      case 'getAccountInfo':
        allowed = account(first) && params.length <= 2;
        break;
      case 'getMultipleAccounts':
        allowed = list(first, account) && params.length <= 2;
        break;
      case 'getSignatureStatuses':
        allowed = list(first, signature) && params.length <= 2;
        break;
      case 'getMinimumBalanceForRentExemption':
        allowed =
          Number.isSafeInteger(first) &&
          Number(first) >= 0 &&
          Number(first) <= 10_485_760 &&
          params.length <= 2;
        break;
      case 'getFeeForMessage':
        allowed = base64(first) && params.length <= 2;
        break;
      case 'simulateTransaction':
      case 'sendTransaction':
        allowed =
          base64(first) && params.length <= 2 && object(second) && second.encoding === 'base64';
        break;
      // Privy's wallet UI reads SPL token balances by owner; never allow a program scan.
      case 'getTokenAccountsByOwner':
        allowed =
          account(first) &&
          object(second) &&
          Object.keys(second).length === 1 &&
          (account(second.mint) ||
            second.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
            second.programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
        break;
    }
  }
  if (!allowed) throw new Error('RPC method or parameters not allowed.');
  return { id: data.id as string | number, method: data.method, params };
}
