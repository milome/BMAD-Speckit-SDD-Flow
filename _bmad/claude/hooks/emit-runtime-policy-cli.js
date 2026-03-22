#!/usr/bin/env node
/**
 * Launcher: prefers `emit-runtime-policy.cjs` next to this file (init / sync deploy from @bmad-speckit/runtime-emit),
 * then `scripts/emit-runtime-policy.cjs`, legacy `emit-runtime-policy.bundle.cjs`, else `scripts/emit-runtime-policy.ts` + ts-node.
 * Project root = CLAUDE_PROJECT_DIR | CURSOR_PROJECT_ROOT | nearest _bmad ancestor.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.env.BMAD_POLICY_INJECT === '0') {
  process.stderr.write('BMAD_POLICY_INJECT=0: emit-runtime-policy-cli skipped.\n');
  process.exit(0);
}

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

const root = findRoot();
if (!root) {
  process.stderr.write('emit-runtime-policy-cli: project root with _bmad/ not found.\n');
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const node = process.execPath;
const envRun = { ...process.env, BMAD_RUNTIME_CWD: root };
const spawnOpts = {
  cwd: root,
  encoding: 'utf8',
  env: envRun,
  maxBuffer: 10 * 1024 * 1024,
};

const emitAdjacent = path.join(__dirname, 'emit-runtime-policy.cjs');
const emitScripts = path.join(root, 'scripts', 'emit-runtime-policy.cjs');
const emitBundleLegacy = path.join(root, 'scripts', 'emit-runtime-policy.bundle.cjs');
let result;
if (fs.existsSync(emitAdjacent)) {
  result = spawnSync(node, [emitAdjacent, ...extraArgs], spawnOpts);
} else if (fs.existsSync(emitScripts)) {
  result = spawnSync(node, [emitScripts, ...extraArgs], spawnOpts);
} else if (fs.existsSync(emitBundleLegacy)) {
  result = spawnSync(node, [emitBundleLegacy, ...extraArgs], spawnOpts);
} else {
  const emitTs = path.join(root, 'scripts', 'emit-runtime-policy.ts');
  if (!fs.existsSync(emitTs)) {
    process.stderr.write(
      `emit-runtime-policy-cli: missing ${emitAdjacent} or ${emitScripts} (re-init) and ${emitTs} (dev: npm run build:runtime-emit)\n`
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
