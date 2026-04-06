#!/usr/bin/env node
'use strict';

/** Deployed `.cursor/hooks` has `runtime-policy-inject-core.cjs` beside this file; repo `_bmad/cursor/hooks` falls back to `_bmad/runtime/hooks`. */
const path = require('node:path');
const fs = require('node:fs');
const localCore = path.join(__dirname, 'runtime-policy-inject-core.cjs');
const { runtimePolicyInjectCore } = require(
  fs.existsSync(localCore) ? './runtime-policy-inject-core.cjs' : '../../runtime/hooks/runtime-policy-inject-core.cjs'
);

runtimePolicyInjectCore({ host: 'cursor' })
  .then(({ exitCode, output, stderr }) => {
    if (stderr && process.env.BMAD_HOOKS_QUIET !== '1') {
      process.stderr.write(`${stderr}\n`);
    }
    if (output) process.stdout.write(output);
    process.exit(exitCode);
  })
  .catch((e) => {
    process.stderr.write(`${e && e.message ? e.message : e}\n`);
    process.exit(1);
  });
