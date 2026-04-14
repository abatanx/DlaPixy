#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_LOCK_PATH = path.join(PROJECT_ROOT, 'package-lock.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'src', 'generated', 'oss-licenses.json');

const LICENSE_FILE_CANDIDATES = [
  'LICENSE',
  'LICENSE.txt',
  'LICENSE.md',
  'LICENSE-MIT',
  'LICENSE.Apache-2.0.txt',
  'LICENCE',
  'LICENCE.txt',
  'LICENCE.md',
  'COPYING',
  'COPYING.txt',
  'COPYING.md'
];

function resolvePackageNameFromLockKey(lockKey) {
  const segments = lockKey
    .split('node_modules/')
    .map((segment) => segment.replace(/\/$/, ''))
    .filter(Boolean);
  return segments.at(-1) ?? null;
}

function normalizeRepositoryUrl(repository) {
  const rawUrl =
    typeof repository === 'string'
      ? repository
      : repository && typeof repository === 'object' && typeof repository.url === 'string'
        ? repository.url
        : null;
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith('github:')) {
    return `https://github.com/${rawUrl.slice('github:'.length)}`;
  }

  if (/^[^/:]+\/[^/:]+$/.test(rawUrl)) {
    return `https://github.com/${rawUrl}`;
  }

  return rawUrl
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
}

function normalizeLicense(pkg, lockEntry) {
  if (typeof pkg.license === 'string' && pkg.license.trim()) {
    return pkg.license.trim();
  }

  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    return pkg.licenses
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (entry && typeof entry === 'object' && typeof entry.type === 'string') {
          return entry.type.trim();
        }
        return '';
      })
      .filter(Boolean)
      .join(' / ');
  }

  if (typeof lockEntry.license === 'string' && lockEntry.license.trim()) {
    return lockEntry.license.trim();
  }

  return 'UNKNOWN';
}

function extractCopyright(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matchedLines = lines.filter((line) => /^\s*copyright\b/i.test(line)).slice(0, 3);
  if (matchedLines.length === 0) {
    return null;
  }

  return matchedLines.join('\n');
}

async function readLicenseText(packageDir) {
  for (const candidate of LICENSE_FILE_CANDIDATES) {
    const targetPath = path.join(packageDir, candidate);
    try {
      const content = await fs.readFile(targetPath, 'utf8');
      return content.trim();
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return '';
}

async function collectPackages() {
  const lock = JSON.parse(await fs.readFile(PACKAGE_LOCK_PATH, 'utf8'));
  const packages = lock.packages ?? {};
  const collected = new Map();

  for (const [lockKey, lockEntry] of Object.entries(packages)) {
    if (!lockKey || !lockKey.startsWith('node_modules/')) {
      continue;
    }

    const packageName = resolvePackageNameFromLockKey(lockKey);
    if (!packageName) {
      continue;
    }

    const includeEntry = lockEntry.dev !== true || packageName === 'electron';
    if (!includeEntry) {
      continue;
    }

    const packageDir = path.join(PROJECT_ROOT, lockKey);
    const packageJsonPath = path.join(packageDir, 'package.json');

    let packageJson;
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    const name = typeof packageJson.name === 'string' && packageJson.name ? packageJson.name : packageName;
    const version =
      typeof packageJson.version === 'string' && packageJson.version
        ? packageJson.version
        : typeof lockEntry.version === 'string' && lockEntry.version
          ? lockEntry.version
          : '0.0.0';
    const uniqueKey = `${name}@${version}`;
    if (collected.has(uniqueKey)) {
      continue;
    }

    const licenseText = await readLicenseText(packageDir);
    collected.set(uniqueKey, {
      name,
      version,
      license: normalizeLicense(packageJson, lockEntry),
      packagePath: lockKey,
      homepage: typeof packageJson.homepage === 'string' ? packageJson.homepage : null,
      repositoryUrl: normalizeRepositoryUrl(packageJson.repository),
      copyright: licenseText ? extractCopyright(licenseText) : null,
      licenseText: licenseText || 'License text was not found in the installed package.'
    });
  }

  return [...collected.values()].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }
    return left.version.localeCompare(right.version);
  });
}

async function main() {
  const packages = await collectPackages();
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        packages
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  process.stdout.write(`Generated ${packages.length} OSS license entries: ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
