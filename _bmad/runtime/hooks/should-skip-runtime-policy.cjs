#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function shouldSkipRuntimePolicy({ cursorHost, root, res }) {
  if (cursorHost && !fs.existsSync(path.join(root, '_bmad'))) return true;
  const stderr = (res && res.stderr ? res.stderr : '').trim();
  if (!stderr.includes('emit-runtime-policy: missing flow/stage')) return false;
  if (fs.existsSync(path.join(root, '_bmad'))) return false;
  return true;
}

module.exports = { shouldSkipRuntimePolicy };
