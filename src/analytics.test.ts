import { expect, it } from 'vitest';
import { analyticsBeforeSend } from './analytics';

it('removes query values and fragments before reporting a page view', () => {
  expect(
    analyticsBeforeSend({
      type: 'pageview',
      url: 'https://app.example.test/search?tab=home&market=SOL&q=wallet&_vercel_share=EXAMPLE#token',
    }),
  ).toEqual({ type: 'pageview', url: 'https://app.example.test/search' });
});

it('does not report diagnostics, unknown paths, custom events or malformed URLs', () => {
  for (const url of [
    'https://app.example.test/lab',
    'https://app.example.test/private/EXAMPLE',
    'invalid-url',
  ]) {
    expect(analyticsBeforeSend({ type: 'pageview', url })).toBeNull();
  }
  expect(analyticsBeforeSend({ type: 'event', url: 'https://app.example.test/' })).toBeNull();
});
