#!/usr/bin/env node
'use strict';

const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceAuthorityCleanup = path.join(
  packageRoot,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'cleanup-packed-bmad.js'
);

process.env.BMAD_SPECKIT_REPO_ROOT = repoRoot;

require(sourceAuthorityCleanup);
