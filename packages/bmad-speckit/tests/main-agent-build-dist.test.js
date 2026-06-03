const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const PACKAGE_JSON = path.join(PACKAGE_ROOT, 'package.json');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist', 'main-agent');
const EXPECTED_DIST_FILES = [
  'index.js',
  'runtime.js',
  'actions/inspect.js',
  'actions/confirm-scope.js',
  'actions/dispatch-plan.js',
  'actions/run-loop.js',
];

describe('main-agent dist build', () => {
  it('declares package build and pack surface for main-agent dist', () => {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    assert.equal(typeof pkg.scripts['build:main-agent-dist'], 'string');
    assert.match(pkg.scripts.prepack, /build:main-agent-dist/);
    assert.ok(pkg.files.includes('dist/'));
  });

  it('generates required dist runtime files from package source', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    for (const relativePath of EXPECTED_DIST_FILES) {
      const distFile = path.join(DIST_ROOT, relativePath);
      assert.equal(fs.existsSync(distFile), true, `missing ${relativePath}`);
      const source = fs.readFileSync(distFile, 'utf8');
      assert.doesNotMatch(source, /scripts[\\/]main-agent-orchestration\.ts/);
      assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/);
    }
  });
});
