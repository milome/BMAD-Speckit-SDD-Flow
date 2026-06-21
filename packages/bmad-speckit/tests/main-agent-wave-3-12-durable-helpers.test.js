const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LEDGER_PATH = path.join(
  REPO_ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.12',
  'migration-ledger.json'
);

function readLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function bmadHelperTargets() {
  const targets = [];
  for (const entry of readLedger().entries) {
    if (entry.migrationStrategy !== 'durable_helper_copy') continue;
    for (const targetPath of entry.targetPaths || []) {
      if (targetPath.startsWith('packages/bmad-speckit/src/main-agent/helpers/')) {
        targets.push(targetPath);
      }
    }
  }
  return Array.from(new Set(targets)).sort();
}

function assertNoForbiddenDependencyForms(source, targetPath) {
  assert.doesNotMatch(source, /\b(?:npx|pnpm|yarn|node)\s+(?:[^'"`;&|]*\s+)?tsx\b/u, targetPath);
  assert.doesNotMatch(source, /\b(?:npx|pnpm|yarn|node)\s+(?:[^'"`;&|]*\s+)?ts-node\b/u, targetPath);
  assert.doesNotMatch(source, /\brequire\(['"]tsx['"]\)/u, targetPath);
  assert.doesNotMatch(source, /\brequire\(['"]ts-node(?:\/register)?['"]\)/u, targetPath);
  assert.doesNotMatch(source, /scripts[\\/][^'")\s]+\.ts/u, targetPath);
  assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/u, targetPath);
}

function assertDescriptorHasNoImportSideEffects(absolutePath, targetPath) {
  const script = [
    `const mod = require(${JSON.stringify(absolutePath)});`,
    `const descriptor = mod.moduleExports({ cwd: ${JSON.stringify(REPO_ROOT)} });`,
    "if (!descriptor || !descriptor.consumerRuntimeProof) throw new Error('bad descriptor');",
  ].join(' ');
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${targetPath} descriptor process failed: ${result.stderr || result.stdout}`);
  assert.equal(result.signal, null, `${targetPath} descriptor process signaled`);
  assert.equal(result.stdout, '', `${targetPath} descriptor wrote stdout`);
  assert.equal(result.stderr, '', `${targetPath} descriptor wrote stderr`);
}

describe('main-agent wave 3.12 durable helpers', () => {
  it('imports every bmad-speckit helper target without root runner dependencies', () => {
    const targets = bmadHelperTargets();
    assert.equal(targets.length, 54);
    for (const targetPath of targets) {
      const absolutePath = path.join(REPO_ROOT, targetPath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      assertNoForbiddenDependencyForms(source, targetPath);
      assertDescriptorHasNoImportSideEffects(absolutePath, targetPath);
      const mod = require(absolutePath);
      assert.equal(typeof mod.moduleExports, 'function', `${targetPath} missing moduleExports`);
      const descriptor = mod.moduleExports({ cwd: REPO_ROOT });
      assert.equal(descriptor.consumerRuntimeProof.usedRootScript, false);
      assert.equal(descriptor.consumerRuntimeProof.usedCompiledFallback, false);
      assert.equal(descriptor.consumerRuntimeProof.usedTypeScriptRunner, false);
    }
  });
});
