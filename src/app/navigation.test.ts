import { describe, expect, it } from 'vitest';
import { phoneUrl, readRoute, routeUrl } from './navigation';

describe('mobile handoff and authentication navigation', () => {
  it('shares the app route without obsolete referral overrides or incidental URL data', () => {
    expect(
      phoneUrl(new URL('https://super.example/?ref=Example_Code&token=secret&preview=mobile')),
    ).toBe('https://super.example/?tab=home&market=SOL');
    expect(phoneUrl(new URL('https://super.example/?ref=bad%2Fcode'))).not.toContain('ref=');
  });
  it.each([
    'http://127.0.0.1:4173',
    'https://127.0.0.1',
    'https://localhost',
    'https://demo.localhost',
    'https://[::1]',
  ])('does not advertise an unreachable loopback QR: %s', (origin) => {
    expect(phoneUrl(new URL(origin))).toBeUndefined();
  });
  it('preserves the market and return tab through signup, without sharing incidental URL data', () => {
    const current = new URL(
      'https://super.example/signup?tab=trade&market=BTC&preview=mobile&token=private#fragment',
    );
    expect(phoneUrl(current)).toBe('https://super.example/signup?tab=trade&market=BTC');
    const afterLogin = routeUrl({ ...readRoute(current), screen: 'app' }, current);
    expect(readRoute(afterLogin)).toEqual({ tab: 'trade', symbol: 'BTC', screen: 'app' });
  });
  it('uses safe defaults for unsupported pages and tabs', () => {
    expect(readRoute(new URL('https://super.example/unknown?tab=bad'))).toEqual({
      screen: 'app',
      tab: 'home',
      symbol: 'SOL',
    });
  });
  it.each(['kBONK', 'kPEPE', 'kSHIB'])(
    'keeps canonical symbol casing after reload and auth: %s',
    (symbol) => {
      const current = new URL(`https://super.example/?tab=trade&market=${symbol}`);
      const signup = routeUrl({ ...readRoute(current), screen: 'signup' }, current);
      expect(readRoute(signup).symbol).toBe(symbol);
      expect(phoneUrl(signup)).toBe(`https://super.example/signup?tab=trade&market=${symbol}`);
    },
  );
});
