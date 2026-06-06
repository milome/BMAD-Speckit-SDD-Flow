#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const vitestBin = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitestBin, 'run', 'packages/scoring'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`${result.error.stack || result.error.message}\n`);
}

process.exit(result.status === null ? 1 : result.status);
