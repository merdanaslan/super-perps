import { execFileSync } from 'node:child_process';
import { isUtf8 } from 'node:buffer';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { parseEnv } from 'node:util';

// A small release hygiene check, not a replacement for a security review.
// Report locations and categories only; never print a matched credential.
const files = [
  ...new Set(
    execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      encoding: 'utf8',
    }).split('\0'),
  ),
].filter((file) => file && existsSync(file));
const issues = [];
const fail = (file, message) => issues.push(`${file}: ${message}`);
const required = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  '.env.example',
  'package-lock.json',
  '.github/workflows/ci.yml',
  'docs/README.md',
  'docs/architecture.md',
  'docs/configuration.md',
];
for (const file of required) if (!files.includes(file)) fail(file, 'missing from release source');

const forbidden =
  /(^|\/)(?:node_modules|dist|output|coverage|\.vercel|\.netlify|\.wrangler|\.cache|\.superstack|\.playwright-mcp)(?:\/|$)|(^|\/)\.env(?:$|\.(?!example$))|\.(?:log|pem|key|p12)$/i;
const patterns = [
  ['private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['provider credential', /\b(?:pim_|sk_live_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}\b/],
  ['URL credential', /[?&](?:api[-_]?key|access_token|secret)=([A-Za-z0-9_-]{20,})/i],
  ['bearer credential', /\bBearer\s+[A-Za-z0-9_.-]{30,}/],
];
const envExample = readFileSync('.env.example', 'utf8');
// Keep this allowlist explicit: copying a key into .env.example must not make
// that key an allowed public default.
const publicDefaults = new Set(['https://perp-api.phoenix.trade']);
// A generic token pattern cannot recognize every provider's key format. Compare
// release text with local configuration too, without logging any of its values.
// CI has no local env files, so this extra check only runs where they exist.
const localValues = new Set();
const localEnvFiles = readdirSync('.', { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\.env(?:\..+)?$/.test(entry.name))
  .map((entry) => entry.name)
  .filter((file) => file !== '.env.example');
for (const file of localEnvFiles) {
  for (const value of Object.values(parseEnv(readFileSync(file, 'utf8')))) {
    if (value.length < 12 || publicDefaults.has(value)) continue;
    localValues.add(value);
    try {
      const url = new URL(value);
      for (const part of [
        ...url.searchParams.values(),
        ...url.pathname.split('/').map(decodeURIComponent),
        decodeURIComponent(url.username),
        decodeURIComponent(url.password),
      ])
        if (part.length >= 12) localValues.add(part);
    } catch {
      // Most config entries are identifiers, not URLs.
    }
  }
}
const defined = new Set([...envExample.matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map((match) => match[1]));
function checkCredentials(file, bytes) {
  // File extensions are not a safety boundary: .npmrc, CSV and shell files can
  // contain credentials too. Images and other binary files need separate review.
  if (bytes.includes(0) || !isUtf8(bytes)) return;
  const text = bytes.toString('utf8');
  for (const value of localValues) {
    const index = text.indexOf(value);
    if (index >= 0)
      fail(file, `local configuration copied at line ${text.slice(0, index).split('\n').length}`);
  }
  for (const [label, pattern] of patterns) {
    for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`)))
      if (!/YOUR_|EXAMPLE|PLACEHOLDER/i.test(match[0]))
        fail(file, `${label} pattern at line ${text.slice(0, match.index).split('\n').length}`);
  }
  return text;
}
const workingCopies = new Map();
for (const file of files) {
  if (forbidden.test(file)) fail(file, 'local/generated/sensitive file must not be published');
  const bytes = readFileSync(file);
  workingCopies.set(file, bytes);
  const text = checkCredentials(file, bytes);
  if (text === undefined) continue;
  if (file.startsWith('src/')) {
    for (const match of text.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g))
      if (!defined.has(match[1])) fail(file, `${match[1]} is missing from .env.example`);
  }
  if (extname(file) === '.md') {
    const links = [
      ...text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)|<(?:img|a)\b[^>]*\b(?:src|href)="([^"]+)"/g),
    ];
    for (const match of links) {
      const target = (match[1] ?? match[2]).split('#')[0];
      if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
      const path = resolve(dirname(file), decodeURIComponent(target));
      if (!existsSync(path)) fail(file, `broken local link: ${target}`);
      else if (/^(?:\.\.\/)*output\//.test(target))
        fail(file, 'links to ignored local output are not portable');
    }
  }
}

// Git publishes the index, which can still contain a secret after its working
// copy was cleaned or deleted. Inspect differing staged blobs without printing
// their contents, and leave the user's staging choices untouched.
const staged = execFileSync('git', ['ls-files', '--stage', '-z'], { encoding: 'utf8' });
const blobs = new Map();
for (const entry of staged.split('\0').filter(Boolean)) {
  const [, hash, stage, file] = entry.match(/^\d+ ([a-f\d]+) (\d)\t([\s\S]*)$/) ?? [];
  if (!file) continue;
  const label = `${file} (staged)`;
  if (stage !== '0') {
    fail(label, 'resolve the merge conflict before publishing');
    continue;
  }
  if (forbidden.test(file)) fail(label, 'local/generated/sensitive file must not be published');
  if (!blobs.has(hash)) blobs.set(hash, execFileSync('git', ['cat-file', 'blob', hash]));
  const bytes = blobs.get(hash);
  if (!workingCopies.get(file)?.equals(bytes)) checkCredentials(label, bytes);
}

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const root = lock.packages[''];
if (manifest.name !== root.name || manifest.version !== root.version)
  fail('package-lock.json', 'package identity does not match package.json');
for (const group of ['dependencies', 'devDependencies'])
  if (JSON.stringify(manifest[group]) !== JSON.stringify(root[group]))
    fail('package-lock.json', `${group} does not match package.json`);

if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Repository hygiene passed (${files.length} release-source files; staged content, environment names, links and lockfile checked).`,
  );
