// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { isAppNavigation } from './navigation';
import { pwaOptions } from '../../pwa.config';

beforeEach(() => vi.resetModules());

function request(url: string, mode = 'navigate', method = 'GET') {
  return { url, mode, method } as Request;
}

it('uses the offline landing page only for app navigations, never API or wallet requests', () => {
  const origin = 'https://test.trycloudflare.com';
  for (const path of ['/', '/account', '/search?tab=home', '/login', '/signup'])
    expect(isAppNavigation(request(origin + path), origin)).toBe(true);
  for (const path of ['/api/solana', '/api/account', '/lab', '/sw.js', '/assets/app.js'])
    expect(isAppNavigation(request(origin + path), origin)).toBe(false);
  expect(isAppNavigation(request('https://auth.privy.io/', 'navigate'), origin)).toBe(false);
  expect(isAppNavigation(request(origin + '/', 'cors'), origin)).toBe(false);
  expect(isAppNavigation(request(origin + '/', 'navigate', 'POST'), origin)).toBe(false);
});

it('installs from a stable home URL without preview, market or referral parameters', () => {
  const manifest = pwaOptions.manifest;
  expect(manifest && manifest.start_url).toBe('/');
  expect(manifest && manifest.id).toBe('/');
  expect(manifest && manifest.scope).toBe('/');
  expect(manifest && manifest.display).toBe('standalone');
  expect(pwaOptions.devOptions?.enabled).toBe(false);
});

it('offers an update without activating it or reloading a transaction in another tab', async () => {
  const { watchRegistration, subscribePwaUpdate, hasPwaUpdate } = await import('./register');
  const notify = vi.fn();
  const stop = subscribePwaUpdate(notify);
  const waiting = { postMessage: vi.fn() };
  const registration = Object.assign(new EventTarget(), { waiting, installing: null });
  watchRegistration(registration as unknown as ServiceWorkerRegistration, () => true);
  expect(hasPwaUpdate()).toBe(true);
  expect(notify).toHaveBeenCalledOnce();
  expect(waiting.postMessage).not.toHaveBeenCalled();
  stop();
});

it('does not label first installation as an app update', async () => {
  const { watchRegistration, hasPwaUpdate } = await import('./register');
  const registration = Object.assign(new EventTarget(), { waiting: {}, installing: null });
  watchRegistration(registration as unknown as ServiceWorkerRegistration, () => false);
  expect(hasPwaUpdate()).toBe(false);
});

it('notifies when a later worker finishes installing, without forcing activation', async () => {
  const { watchRegistration, hasPwaUpdate } = await import('./register');
  const worker = Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {
    waiting: null as null | typeof worker,
    installing: worker,
  });
  watchRegistration(registration as unknown as ServiceWorkerRegistration, () => true);
  registration.dispatchEvent(new Event('updatefound'));
  expect(hasPwaUpdate()).toBe(false);
  worker.state = 'installed';
  registration.waiting = worker;
  worker.dispatchEvent(new Event('statechange'));
  expect(hasPwaUpdate()).toBe(true);
  expect(worker.postMessage).not.toHaveBeenCalled();
});
