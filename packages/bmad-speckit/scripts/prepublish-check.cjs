#!/usr/bin/env node
'use strict';

const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceAuthorityPrepublish = path.join(
  packageRoot,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'prepublish-check.js'
);

if (!require('node:fs').existsSync(sourceAuthorityPrepublish)) {
  throw new Error(
    `Missing built source-authority prepublish runtime: ${sourceAuthorityPrepublish}. Run npm run build:main-agent-dist before prepublish.`
  );
}

if (process.argv.includes('--silent')) process.env.BMAD_PREPUBLISH_SILENT = '1';
if (process.argv.includes('--pack-session')) process.env.BMAD_PACK_SESSION = '1';
process.env.BMAD_SPECKIT_REPO_ROOT = repoRoot;

require(sourceAuthorityPrepublish);
