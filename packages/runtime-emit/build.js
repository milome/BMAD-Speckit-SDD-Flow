#!/usr/bin/env node
/**
 * Bundles repo-root CLIs into dist/*.cjs:
 * - scripts/emit-runtime-policy.ts → emit-runtime-policy.cjs
 * - scripts/i18n/resolve-for-session-cli.ts → resolve-for-session.cjs
 * - scripts/i18n/render-audit-block-cli.ts → render-audit-block.cjs
 * Invoked by prepare/prepublishOnly and `npm run build` from this package.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const pkgDir = __dirname;
const repoRoot = path.resolve(pkgDir, '../..');
const outDir = path.join(pkgDir, 'dist');
const bundles = [
  {
    entry: path.join(repoRoot, 'scripts', 'emit-runtime-policy.ts'),
    outfile: path.join(outDir, 'emit-runtime-policy.cjs'),
    label: 'emit-runtime-policy',
  },
  {
    entry: path.join(repoRoot, 'scripts', 'i18n', 'resolve-for-session-cli.ts'),
    outfile: path.join(outDir, 'resolve-for-session.cjs'),
    label: 'resolve-for-session',
  },
  {
    entry: path.join(repoRoot, 'scripts', 'i18n', 'render-audit-block-cli.ts'),
    outfile: path.join(outDir, 'render-audit-block.cjs'),
    label: 'render-audit-block',
  },
];

fs.mkdirSync(outDir, { recursive: true });

for (const { entry, outfile, label } of bundles) {
  if (!fs.existsSync(entry)) {
    console.error(`runtime-emit build: missing entry for ${label}:`, entry);
    process.exit(1);
  }
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
  });
  console.log('runtime-emit: wrote', path.relative(repoRoot, outfile));
}
