import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Inventory installed production dependencies from the committed lockfile.
// Includes optional provider code even when the default build tree-shakes it.
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const rows = new Map();
const notices = new Map();
for (const [path, metadata] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!path || metadata.dev) continue;
  if (!existsSync(join(path, 'package.json'))) {
    if (metadata.optional) continue;
    throw new Error(`Missing installed dependency: ${path}. Run npm ci with Node 24 first.`);
  }
  const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  if (pkg.version !== metadata.version)
    throw new Error(`Installed version differs from lockfile: ${path}. Run npm ci first.`);
  const key = `${pkg.name}@${pkg.version}`;
  if (rows.has(key)) continue;
  const licenseFiles = readdirSync(path)
    .filter(
      (name) =>
        /^(?:licen[cs]e|copying|notice)(?:[.-]|$)/i.test(name) &&
        statSync(join(path, name)).isFile(),
    )
    .sort();
  const texts = [];
  for (const file of licenseFiles) {
    const text = readFileSync(join(path, file), 'utf8').trim();
    const hash = createHash('sha256').update(text).digest('hex');
    const entry = notices.get(hash) ?? { packages: [], text };
    entry.packages.push(`${key} (${file})`);
    notices.set(hash, entry);
    texts.push(file);
  }
  rows.set(key, {
    name: pkg.name,
    version: pkg.version,
    declaredLicense:
      typeof pkg.license === 'string' ? pkg.license : (pkg.license ?? 'not declared'),
    licenseFiles: texts,
  });
}
const packages = [...rows.values()].sort((a, b) =>
  `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
);
const inventory =
  JSON.stringify(
    {
      description:
        'Installed production dependency inventory. Metadata is not a legal assessment. Missing texts and custom terms need review; packages retain their own licenses.',
      lockfileSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
      packages,
    },
    null,
    2,
  ) + '\n';
const noticeText =
  'super perps - third-party dependency notices\n\nGenerated from installed production dependencies. Original package license/notice texts are reproduced below, grouped when identical. This inventory does not relicense dependencies or determine whether a particular deployment satisfies their terms. See docs/third-party.md and the separate third-party-notices.txt for copied UI code and brand attribution.\n\n' +
  [...notices.values()]
    .sort((a, b) => a.packages[0].localeCompare(b.packages[0]))
    .map(({ packages, text }) => `${packages.sort().join('\n')}\n\n${text}`)
    .join('\n\n' + '='.repeat(72) + '\n\n') +
  '\n';
for (const [path, content] of [
  ['docs/dependency-licenses.json', inventory],
  ['public/dependency-notices.txt', noticeText],
]) {
  if (process.argv.includes('--check')) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) {
      console.error(`${path} is out of date. Run npm run licenses after npm ci.`);
      process.exitCode = 1;
    }
  } else writeFileSync(path, content);
}
console.log(
  `${packages.length} production package/version entries; ${packages.filter((pkg) => !pkg.licenseFiles.length).length} without a root license/notice file. See docs/third-party.md for review scope.`,
);
