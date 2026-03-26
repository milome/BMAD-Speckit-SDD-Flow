#!/usr/bin/env node
/**
 * Launcher: (1) emit-runtime-policy.cjs next to this file (init deploy),
 * (2) require.resolve('@bmad-speckit/runtime-emit/dist/emit-runtime-policy.cjs') from project root,
 * (3) dev fallbacks: scripts/emit-runtime-policy.cjs, legacy bundle, scripts/emit-runtime-policy.ts + ts-node.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function findRoot() {
  const envRoot = process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_ROOT;
  if (envRoot) {
    const r = path.resolve(envRoot);
    if (fs.existsSync(path.join(r, '_bmad'))) return r;
  }
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, '_bmad'))) return dir;
    const p = path.dirname(dir);
    if (p === dir) return null;
    dir = p;
  }
}

function resolveBundledEmitCjs(root) {
  try {
    const p = require.resolve('@bmad-speckit/runtime-emit/dist/emit-runtime-policy.cjs', {
      paths: [root],
    });
    if (p && fs.existsSync(p)) return p;
  } catch {
    /* continue */
  }
  const direct = path.join(
    root,
    'node_modules',
    '@bmad-speckit',
    'runtime-emit',
    'dist',
    'emit-runtime-policy.cjs'
  );
  if (fs.existsSync(direct)) return direct;
  const nestedBundled = path.join(
    root,
    'node_modules',
    'bmad-speckit',
    'node_modules',
    '@bmad-speckit',
    'runtime-emit',
    'dist',
    'emit-runtime-policy.cjs'
  );
  return fs.existsSync(nestedBundled) ? nestedBundled : null;
}

const root = findRoot();
if (!root) {
  process.stderr.write('emit-runtime-policy-cli: project root with _bmad/ not found.\n');
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const node = process.execPath;
const spawnOpts = {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env },
  maxBuffer: 10 * 1024 * 1024,
};

const emitAdjacent = path.join(__dirname, 'emit-runtime-policy.cjs');
const emitBundled = resolveBundledEmitCjs(root);
const emitScripts = path.join(root, 'scripts', 'emit-runtime-policy.cjs');
const emitBundleLegacy = path.join(root, 'scripts', 'emit-runtime-policy.bundle.cjs');
let result;
if (fs.existsSync(emitAdjacent)) {
  result = spawnSync(node, [emitAdjacent, ...extraArgs], spawnOpts);
} else if (emitBundled) {
  result = spawnSync(node, [emitBundled, ...extraArgs], spawnOpts);
} else if (fs.existsSync(emitScripts)) {
  result = spawnSync(node, [emitScripts, ...extraArgs], spawnOpts);
} else if (fs.existsSync(emitBundleLegacy)) {
  result = spawnSync(node, [emitBundleLegacy, ...extraArgs], spawnOpts);
} else {
  const emitTs = path.join(root, 'scripts', 'emit-runtime-policy.ts');
  if (!fs.existsSync(emitTs)) {
    process.stderr.write(
      'emit-runtime-policy-cli: missing emit bundle (hook-adjacent cjs, @bmad-speckit/runtime-emit, or scripts/). Run: npm install, npm run build:runtime-emit, npx bmad-speckit init.\n'
    );
    process.exit(1);
  }
  const tsNodeBin = path.join(root, 'node_modules', 'ts-node', 'dist', 'bin.js');
  if (fs.existsSync(tsNodeBin)) {
    result = spawnSync(node, [tsNodeBin, '--transpile-only', emitTs, ...extraArgs], spawnOpts);
  } else {
    result = spawnSync('npx', ['ts-node', '--transpile-only', emitTs, ...extraArgs], {
      ...spawnOpts,
      shell: true,
    });
  }
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
const code = result.status === 0 ? 0 : result.status || 1;
process.exit(code);
