import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export interface RelayIdentity {
  sub: string;
  exp: number;
}

/** Public verification keys only: this backend never needs a Privy app secret. */
export function createPrivyVerifier(appId: string, keys?: JWTVerifyGetKey) {
  const resolveKey =
    keys ??
    createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`),
      { timeoutDuration: 5000 },
    );
  return async (token: string): Promise<RelayIdentity> => {
    const { payload } = await jwtVerify(token, resolveKey, {
      algorithms: ['ES256'],
      issuer: 'privy.io',
      audience: appId,
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (!payload.sub?.startsWith('did:privy:') || !Number.isFinite(payload.exp))
      throw new Error('Invalid session.');
    return { sub: payload.sub, exp: payload.exp! };
  };
}
