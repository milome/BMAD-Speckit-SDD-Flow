#!/usr/bin/env node
'use strict';

function buildRuntimeErrorMessage({ stderr, stdout }) {
  return ['[emit-runtime-policy FAILED]', stderr || '', stdout || '']
    .filter(Boolean)
    .join('\n');
}

module.exports = { buildRuntimeErrorMessage };
