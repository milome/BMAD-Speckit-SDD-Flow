const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LEDGER_PATH = path.join(
  REPO_ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.12',
  'migration-ledger.json'
);
const BIN_PATH = path.join(REPO_ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

function readLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function publicCliEntries() {
  return readLedger().entries.filter((entry) => entry.migrationStrategy === 'public_cli_de_surface');
}

function uniqueCommandTargets() {
  return Array.from(
    new Map(
      publicCliEntries().map((entry) => {
        const targetPath = entry.targetPaths.find((target) =>
          target.startsWith('packages/bmad-speckit/src/commands/')
        );
        return [targetPath, entry];
      })
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

describe('main-agent wave 3.12 public CLI package actions', () => {
  it('registers every public CLI command source with package-local exports', () => {
    const targets = uniqueCommandTargets();
    assert.equal(publicCliEntries().length, 9);
    assert.equal(targets.length, 8);
    for (const [targetPath, entry] of targets) {
      const absolutePath = path.join(REPO_ROOT, targetPath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      assertNoForbiddenDependencyForms(source, targetPath);
      const mod = require(absolutePath);
      assert.equal(typeof mod[entry.runnerApi.exportName], 'function', `${targetPath} missing export`);
    }
  });

  it('serves package CLI help for every unique Wave 3.12 command', () => {
    for (const [targetPath] of uniqueCommandTargets()) {
      const commandName = path.basename(targetPath, '.js');
      const result = spawnSync(process.execPath, [BIN_PATH, commandName, '--help'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${commandName} help failed: ${result.stderr || result.stdout}`);
      assert.match(result.stdout, new RegExp(commandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
