/** Prevent another site from framing the trading/approval UI. This deliberately
 * does not restrict Privy's child frames, network calls or wallet popups.
 * Keep the equivalent hosted headers in vercel.json when changing this policy. */
export const securityHeaders = {
  'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
