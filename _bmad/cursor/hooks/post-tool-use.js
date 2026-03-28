#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const localCore = path.join(__dirname, 'post-tool-use-core.js');
const { captureToolTrace, postToolUseCore } = require(
  fs.existsSync(localCore) ? './post-tool-use-core' : '../../runtime/hooks/post-tool-use-core'
);

function postToolUse(event) {
  return captureToolTrace(event);
}

if (require.main === module) {
  postToolUseCore({ host: 'cursor' })
    .then(({ exitCode, output, stderr }) => {
      if (stderr && process.env.BMAD_HOOKS_QUIET !== '1') {
        process.stderr.write(`${stderr}\n`);
      }
      if (output) {
        process.stdout.write(output);
      }
      process.exit(exitCode);
    })
    .catch((error) => {
      process.stderr.write(`${error && error.message ? error.message : error}\n`);
      process.exit(1);
    });
}

module.exports = {
  postToolUse,
};
