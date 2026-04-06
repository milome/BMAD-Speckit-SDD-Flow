const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('npm pack --dry-run includes packaged _bmad hook cjs files', () => {
  const cwd = path.join(__dirname, '..');
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  assert.strictEqual(result.status, 0, `npm pack failed: ${result.stderr || result.stdout}`);

  const jsonStart = result.stdout.indexOf('[');
  assert.ok(jsonStart >= 0, `npm pack output missing JSON payload: ${result.stdout}`);

  const packInfo = JSON.parse(result.stdout.slice(jsonStart))[0];
  const files = packInfo.files.map((file) => file.path);
  const hookCjs = files.filter((file) => /^_bmad\/.+\/hooks\/.+\.cjs$/.test(file));

  const expected = [
    '_bmad/runtime/hooks/runtime-policy-inject-core.cjs',
    '_bmad/cursor/hooks/runtime-policy-inject.cjs',
    '_bmad/claude/hooks/runtime-policy-inject.cjs',
  ];

  for (const file of expected) {
    assert.ok(hookCjs.includes(file), `tarball missing ${file}`);
  }

  assert.ok(hookCjs.length >= 10, `expected multiple hook .cjs files, got ${hookCjs.length}`);
});
