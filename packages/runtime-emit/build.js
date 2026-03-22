#!/usr/bin/env node
/**
 * Bundles repo-root `scripts/emit-runtime-policy.ts` into dist/emit-runtime-policy.cjs.
 * Invoked by prepare/prepublishOnly and `npm run build` from this package.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const pkgDir = __dirname;
const repoRoot = path.resolve(pkgDir, '../..');
const entry = path.join(repoRoot, 'scripts', 'emit-runtime-policy.ts');
const outDir = path.join(pkgDir, 'dist');
const outfile = path.join(outDir, 'emit-runtime-policy.cjs');

if (!fs.existsSync(entry)) {
  console.error('runtime-emit build: missing entry', entry);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
});

console.log('runtime-emit: wrote', path.relative(repoRoot, outfile));
