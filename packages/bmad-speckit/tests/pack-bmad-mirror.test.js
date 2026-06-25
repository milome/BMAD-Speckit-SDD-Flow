const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('npm pack --dry-run includes packaged _bmad hook cjs files', () => {
  const cwd = path.join(__dirname, '..');
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    shell: process.platform === 'win32',
  });

  assert.strictEqual(
    result.status,
    0,
    `npm pack failed: ${result.error?.message || ''}\n${result.stderr || result.stdout}`
  );

  const jsonStart = result.stdout.indexOf('[');
  assert.ok(jsonStart >= 0, `npm pack output missing JSON payload: ${result.stdout}`);

  const packInfo = JSON.parse(result.stdout.slice(jsonStart))[0];
  const files = packInfo.files.map((file) => file.path);
  const hookCjs = files.filter((file) => /^_bmad\/.+\/hooks\/.+\.cjs$/.test(file));

  const expectedHookFiles = [
    'node_modules/@bmad-speckit/schema/run-score-schema.json',
    '_bmad/runtime/hooks/runtime-policy-inject-core.cjs',
    '_bmad/cursor/hooks/runtime-policy-inject.cjs',
    '_bmad/claude/hooks/runtime-policy-inject.cjs',
    '_bmad/_config/ai-tdd-six-model-manifest.csv',
    '_bmad/_config/ai-tdd-six-model-action-matrix.csv',
    '_bmad/_config/ai-tdd-six-model-skill-routes.csv',
    '_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv',
    '_bmad/skills/ai-tdd-runtime-navigator/workflow.md',
    '_bmad/skills/large-document-writer/SKILL.md',
    '_bmad/skills/large-document-writer/agents/openai.yaml',
    'dist/runtime/bmad-help-renderer.js',
    'dist/runtime/bmads-renderer.js',
    'dist/runtime/ai-tdd/projection-manifest.js',
    'dist/runtime/ai-tdd/display-budget.js',
    'dist/runtime/ai-tdd/runtime-decision.js',
    'dist/commands/large-doc.js',
    'dist/utils/large-document-writer/index.js',
  ];

  const expectedHookSubset = expectedHookFiles.filter((file) => file.endsWith('.cjs'));
  const expectedNonHookSubset = expectedHookFiles.filter((file) => !file.endsWith('.cjs'));

  for (const file of expectedHookSubset) {
    assert.ok(files.includes(file), `tarball missing ${file}`);
  }

  for (const file of expectedNonHookSubset) {
    assert.ok(files.includes(file), `tarball missing ${file}`);
  }

  assert.ok(hookCjs.length >= 10, `expected multiple hook .cjs files, got ${hookCjs.length}`);
});
