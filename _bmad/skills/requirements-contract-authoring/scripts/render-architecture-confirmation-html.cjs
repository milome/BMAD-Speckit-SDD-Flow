#!/usr/bin/env node
'use strict';

const path = require('node:path');

function loadCanonicalRenderer() {
  const packageRoot = path.resolve(__dirname, '..', '..', '..', '..');
  return require(
    path.join(
      packageRoot,
      'dist',
      'main-agent',
      'skill-runtime',
      'requirements-contract-authoring',
      'scripts',
      'render-architecture-confirmation-html.js'
    )
  );
}

try {
  const renderer = loadCanonicalRenderer();
  if (typeof renderer.main !== 'function') {
    throw new Error('architecture_confirmation_renderer_entry_missing');
  }
  process.exitCode = renderer.main(process.argv.slice(2));
} catch (error) {
  console.error(
    JSON.stringify(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      null,
      2
    )
  );
  process.exitCode = 2;
}
