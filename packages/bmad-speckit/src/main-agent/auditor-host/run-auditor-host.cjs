#!/usr/bin/env node
'use strict';

const path = require('node:path');

function resolveRuntime() {
  const runtimePath = path.resolve(
    __dirname,
    '..',
    'source-authority',
    'scripts',
    'run-auditor-host.js'
  );
  try {
    const runtime = require(runtimePath);
    if (typeof runtime.mainRunAuditorHost !== 'function') {
      throw new Error('mainRunAuditorHost export missing');
    }
    return runtime;
  } catch (error) {
    throw new Error(
      `run-auditor-host production runtime unavailable at ${runtimePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function main(argv = process.argv.slice(2)) {
  const runtime = resolveRuntime();
  return runtime.mainRunAuditorHost(argv);
}

module.exports = {
  main,
  resolveRuntime,
};

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(
        `run-auditor-host: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    });
}
