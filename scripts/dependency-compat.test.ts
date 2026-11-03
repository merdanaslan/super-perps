import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pwaOptions } from '../pwa.config';

const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, { dependencies?: Record<string, string> }>;
};
const uuidConsumers = Object.entries(lock.packages)
  .filter(([, pkg]) => pkg.dependencies?.uuid)
  .map(([path]) => createRequire(resolve(path, 'package.json'))('uuid'));
const filelistConsumers = Object.entries(lock.packages)
  .filter(([, pkg]) => pkg.dependencies?.filelist)
  .map(([path]) => createRequire(resolve(path, 'package.json'))('filelist'));
const fixtures: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'super-perps-dependencies-'));
  fixtures.push(directory);
  for (const file of [
    'assets/app.js',
    'assets/app.css',
    'assets/app.js.map',
    'brand/mark.svg',
    'markets/BTC.svg',
    'icons/app.png',
    'offline.html',
    'account.json',
  ]) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), file);
  }
  return directory;
}

afterEach(() => {
  for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true, force: true });
});

// These exercise the consuming packages, not just a top-level overridden copy.
// Keep them while the temporary overrides in package.json are necessary.
describe('dependency override compatibility', () => {
  it('keeps UUID v4 generation and validation used by the wallet SDKs', () => {
    expect(uuidConsumers.length).toBeGreaterThan(0);
    for (const uuid of uuidConsumers) {
      const id = uuid.v4();
      expect(uuid.validate(id)).toBe(true);
      expect(uuid.version(id)).toBe(4);
      expect(uuid.v4()).not.toBe(id);
      expect(uuid.validate('not-a-uuid')).toBe(false);
    }
  });

  it('rejects partial UUID writes instead of silently truncating their output', () => {
    expect(uuidConsumers.length).toBeGreaterThan(0);
    for (const uuid of uuidConsumers) {
      for (const version of [uuid.v3, uuid.v5]) {
        const buffer = new Uint8Array(8).fill(0xaa);
        expect(() => version('example', uuid.v5.DNS, buffer, 4)).toThrow(RangeError);
        expect(buffer).toEqual(new Uint8Array(8).fill(0xaa));
      }
    }
  });

  it('keeps the real Workbox manifest limited to configured public static files', async () => {
    const workbox = require('workbox-build');
    const result = await workbox.getManifest({
      globDirectory: fixture(),
      ...pwaOptions.injectManifest,
    });
    expect(result.warnings).toEqual([]);
    expect(result.manifestEntries.map((entry: { url: string }) => entry.url).sort()).toEqual([
      'assets/app.css',
      'assets/app.js',
      'brand/mark.svg',
      'icons/app.png',
      'markets/BTC.svg',
      'offline.html',
    ]);
  });

  it('preserves filelist inclusion and exclusion through its minimatch dependency', () => {
    const directory = fixture();
    expect(filelistConsumers.length).toBeGreaterThan(0);
    for (const { FileList } of filelistConsumers) {
      const files = new FileList();
      files.include(join(directory, '**/*.{js,css,svg}'));
      files.exclude(join(directory, 'brand/**'));
      expect(files.toArray().sort()).toEqual(
        ['assets/app.css', 'assets/app.js', 'markets/BTC.svg'].map((file) => join(directory, file)),
      );
    }
  });
});
