import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const checker = join(import.meta.dirname, 'check-repo.mjs');
const fixtures: string[] = [];

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'super-perps-repo-check-'));
  fixtures.push(cwd);
  execFileSync('git', ['init', '--quiet'], { cwd });
  const write = (file: string, content = '') => {
    const path = join(cwd, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  for (const file of [
    'README.md',
    'LICENSE',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CHANGELOG.md',
    '.env.example',
    '.github/workflows/ci.yml',
    'docs/README.md',
    'docs/architecture.md',
    'docs/configuration.md',
  ])
    write(file);
  write('.gitignore', '.env\n.env.*\n!.env.example\n');
  const manifest = { name: 'release-fixture', version: '0.0.0' };
  write('package.json', JSON.stringify(manifest));
  write('package-lock.json', JSON.stringify({ packages: { '': manifest } }));
  return {
    write,
    stage: (file: string) => execFileSync('git', ['add', '--', file], { cwd }),
    remove: (file: string) => rmSync(join(cwd, file)),
    check: () => spawnSync(process.execPath, [checker], { cwd, encoding: 'utf8', timeout: 10_000 }),
  };
}

afterEach(() => {
  for (const cwd of fixtures.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

describe('release-source credential checks', () => {
  it('allows ignored environment files without exposing their values', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.server.local', `SERVER_TOKEN=${secret}\n`);
    const result = repo.check();
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('rejects a server configuration value copied into publishable documentation', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.server.local', `SERVER_TOKEN=${secret}\n`);
    repo.write('README.md', `# Example\n${secret}\n`);
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('README.md: local configuration copied at line 2');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('detects query fragments from mode-specific configuration in SVG files', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.production', `RPC_URL=https://example.invalid/rpc?token=${secret}\n`);
    repo.write('public/example.svg', `<svg><metadata>${secret}</metadata></svg>`);
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/example.svg: local configuration copied at line 1');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('does not allow a local credential merely because it also appears in the template', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.local', `PROVIDER_ID=${secret}\n`);
    repo.write('.env.example', `PROVIDER_ID=${secret}\n`);
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env.example: local configuration copied at line 1');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('checks extensionless configuration files too', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.local', `PACKAGE_TOKEN=${secret}\n`);
    repo.write('.npmrc', `//registry.example.invalid/:_authToken=${secret}\n`);
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.npmrc: local configuration copied');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('detects a credential copied from an RPC URL path', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.local', `RPC_URL=https://example.invalid/v2/${secret}\n`);
    repo.write('README.md', `# Example\n${secret}\n`);
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('README.md: local configuration copied at line 2');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('rejects a staged credential even when the working file has been cleaned', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.local', `SERVER_TOKEN=${secret}\n`);
    repo.write('README.md', `# Example\n${secret}\n`);
    repo.stage('README.md');
    repo.write('README.md', '# Example\n');
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('README.md (staged): local configuration copied at line 2');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });

  it('rejects a staged credential when its working file has been removed', () => {
    const repo = fixture();
    const secret = randomUUID();
    repo.write('.env.local', `SERVER_TOKEN=${secret}\n`);
    repo.write('notes.txt', secret);
    repo.stage('notes.txt');
    repo.remove('notes.txt');
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.txt (staged): local configuration copied');
    expect(result.stdout + result.stderr).not.toContain(secret);
  });
});
