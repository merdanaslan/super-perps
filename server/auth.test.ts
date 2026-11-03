import { beforeAll, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createPrivyVerifier } from './auth.ts';
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let verify: ReturnType<typeof createPrivyVerifier>;
beforeAll(async () => {
  pair = await generateKeyPair('ES256');
  verify = createPrivyVerifier(
    'app-test',
    createLocalJWKSet({
      keys: [{ ...(await exportJWK(pair.publicKey)), alg: 'ES256', kid: 'test-key' }],
    }),
  );
});
function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    sub: 'did:privy:user-one',
    iss: 'privy.io',
    aud: 'app-test',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .sign(pair.privateKey);
}
it('accepts a valid signed access token for this app', async () => {
  expect((await verify(await token())).sub).toBe('did:privy:user-one');
});
it.each([
  { aud: 'different-app' },
  { iss: 'fake-issuer' },
  { exp: 1 },
  { exp: undefined },
  { sub: undefined },
  { sub: 'not-a-privy-user' },
])('rejects invalid claims %j', async (claims) => {
  await expect(verify(await token(claims))).rejects.toThrow();
});
it('rejects forged signatures', async () => {
  const other = await generateKeyPair('ES256');
  const forged = await new SignJWT({ sub: 'did:privy:user-one' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer('privy.io')
    .setAudience('app-test')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(other.privateKey);
  await expect(verify(forged)).rejects.toThrow();
});
