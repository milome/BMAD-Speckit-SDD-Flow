const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const fs = require('node:fs');
const { materializeFullFixture } = require('./fixtures/standalone-goal/canonical-full-fixture.cjs');

const materializedFixture = materializeFullFixture({ copyOracleHelpers: true });
process.on('exit', () => {
  try {
    fs.rmSync(materializedFixture.root, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup for the process-scoped fixture workspace.
  }
});

test('real source plan independent semantic oracle is included in default package discovery', () => {
  const suite = materializedFixture.oracleTestPath;
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', suite], {
    encoding: 'utf8',
    env,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.error?.message || ''}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /# fail 0\b/u);
});
