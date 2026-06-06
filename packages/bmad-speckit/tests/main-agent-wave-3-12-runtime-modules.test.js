const { describe, it } = require('node:test');
const assert = require('node:assert');
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

function runtimeEntries() {
  return readLedger().entries.filter((entry) => entry.migrationStrategy === 'package_runtime_module');
}

function uniqueSourceTargets(entries) {
  return Array.from(
    new Map(
      entries.map((entry) => [
        entry.targetPaths.find((targetPath) =>
          targetPath.startsWith('packages/bmad-speckit/src/main-agent/actions/')
        ),
        entry,
      ])
    )
  ).filter(([targetPath]) => Boolean(targetPath));
}

function assertNoForbiddenDependencyForms(source, targetPath) {
  assert.doesNotMatch(source, /\b(?:npx|pnpm|yarn|node)\s+(?:[^'"`;&|]*\s+)?tsx\b/u, targetPath);
  assert.doesNotMatch(source, /\b(?:npx|pnpm|yarn|node)\s+(?:[^'"`;&|]*\s+)?ts-node\b/u, targetPath);
  assert.doesNotMatch(source, /\brequire\(['"]tsx['"]\)/u, targetPath);
  assert.doesNotMatch(source, /\brequire\(['"]ts-node(?:\/register)?['"]\)/u, targetPath);
  assert.doesNotMatch(source, /scripts[\\/][^'")\s]+\.ts/u, targetPath);
  assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/u, targetPath);
}

describe('main-agent wave 3.12 runtime modules', () => {
  it('exposes every ledger-declared package runtime action export without root runner dependencies', () => {
    const targets = uniqueSourceTargets(runtimeEntries());
    assert.equal(runtimeEntries().length, 28);
    assert.equal(targets.length, 24);
    for (const [targetPath, entry] of targets) {
      const absolutePath = path.join(REPO_ROOT, targetPath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      assertNoForbiddenDependencyForms(source, targetPath);
      const mod = require(absolutePath);
      assert.equal(typeof mod[entry.runnerApi.exportName], 'function', `${targetPath} missing export`);
      const result = mod[entry.runnerApi.exportName]({ cwd: REPO_ROOT, args: {} });
      assert.equal(result.report.consumerRuntimeProof.usedRootScript, false);
      assert.equal(result.report.consumerRuntimeProof.usedCompiledFallback, false);
      assert.equal(result.report.consumerRuntimeProof.usedTypeScriptRunner, false);
    }
  });

  it('requires the package runtime index without loading root scripts or compiled fallback', () => {
    const runtime = require(path.join(REPO_ROOT, 'packages', 'bmad-speckit', 'src', 'main-agent', 'index.js'));
    assert.equal(typeof runtime.mainAgentRuntimeCommand, 'function');
  });
});
