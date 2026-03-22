#!/usr/bin/env node
'use strict';

const { runtimePolicyInjectCore } = require('../../runtime/hooks/runtime-policy-inject-core');

runtimePolicyInjectCore({ host: 'claude' })
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
