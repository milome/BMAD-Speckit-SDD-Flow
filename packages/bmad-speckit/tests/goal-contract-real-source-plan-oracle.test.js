const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const test = require('node:test');

test('real source plan independent semantic oracle is included in default package discovery', () => {
  const suite = join(__dirname, 'fixtures', 'standalone-goal', 'real-source-plan-20260904.expected.oracle.test.mjs');
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
