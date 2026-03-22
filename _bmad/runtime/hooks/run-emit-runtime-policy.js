#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function emitCliPath(root) {
  const canonical = path.join(root, '_bmad', 'claude', 'hooks', 'emit-runtime-policy-cli.js');
  if (fs.existsSync(canonical)) return canonical;
  const deployed = path.join(root, '.claude', 'hooks', 'emit-runtime-policy-cli.js');
  if (fs.existsSync(deployed)) return deployed;
  const cursorDeployed = path.join(root, '.cursor', 'hooks', 'emit-runtime-policy-cli.js');
  if (fs.existsSync(cursorDeployed)) return cursorDeployed;
  return canonical;
}

function runEmitRuntimePolicy(root) {
  const script = emitCliPath(root);
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      CURSOR_PROJECT_ROOT: root,
      BMAD_RUNTIME_CWD: root,
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

module.exports = { runEmitRuntimePolicy };
