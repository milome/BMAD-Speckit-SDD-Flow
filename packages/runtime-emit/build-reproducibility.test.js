/* eslint-disable @typescript-eslint/no-require-imports -- node:test validates the CommonJS build entry */
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PACKAGE_ROOT = __dirname;
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'build.js');
const BUILD_MANIFEST = path.join(PACKAGE_ROOT, 'dist', 'build-manifest.json');

test('runtime emit build manifest is byte-reproducible for unchanged source', () => {
  execFileSync(process.execPath, [BUILD_SCRIPT], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });
  const first = fs.readFileSync(BUILD_MANIFEST);

  execFileSync(process.execPath, [BUILD_SCRIPT], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });
  const second = fs.readFileSync(BUILD_MANIFEST);

  assert.deepEqual(second, first);
});
