#!/usr/bin/env node
'use strict';

const path = require('node:path');

const runtimeEntry = path.resolve(
  __dirname,
  '..',
  'packages',
  'bmad-speckit',
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'run-ci-release-gate-fixture.js'
);

require(runtimeEntry);
