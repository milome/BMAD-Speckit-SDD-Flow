const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

const COMMAND_SCRIPT_PAIRS = [
  ['main-agent:release-gate', 'scripts/main-agent-release-gate.ts'],
  ['main-agent:quality-gate', 'scripts/main-agent-quality-gate.ts'],
  ['main-agent:delivery-truth-gate', 'scripts/main-agent-delivery-truth-gate.ts'],
  ['run-auditor-host', 'scripts/run-auditor-host.ts'],
  ['write-runtime-context', 'scripts/write-runtime-context.cjs'],
  ['eval-questions', 'scripts/eval-questions-cli.ts'],
  ['main-agent:bmad-help-five-layer-matrix', 'scripts/main-agent-bmad-help-five-layer-matrix.ts'],
  ['main-agent:host-matrix-pr-orchestrate', 'scripts/main-agent-host-matrix-pr-orchestrator.ts'],
  ['bmads-auto', 'scripts/bmads-auto-cli.ts'],
];
const OPTIONAL_SOURCE_DEV_ROOT_FILES = new Set([
  // bmads-auto is de-surfaced and intentionally ignored in CI; keep the dispatch
  // guard without requiring a deprecated local-only source file to exist.
  'scripts/bmads-auto-cli.ts',
]);

function commandBlock(source, command) {
  const start = source.indexOf(`.command('${command}'`);
  assert.notEqual(start, -1, `missing command ${command}`);
  const next = source.indexOf('\nprogram', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function forbiddenRunnerPatterns() {
  return [
    new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`),
    new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join('')),
  ];
}

describe('main-agent wave 3.1 public dispatch guard', () => {
  it('does not dispatch any wave 3.1 public command to its original root runtime file', () => {
    const source = fs.readFileSync(PACKAGE_CLI, 'utf8');

    for (const [command, originalScript] of COMMAND_SCRIPT_PAIRS) {
      const block = commandBlock(source, command);
      assert.doesNotMatch(block, /runRepoScript\(/);
      assert.doesNotMatch(block, new RegExp(originalScript.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(block, /ensure-governance-user-story-mapping-fixture\.js/);
      for (const forbidden of forbiddenRunnerPatterns()) {
        assert.doesNotMatch(block, forbidden);
      }
    }
  });

  it('keeps original wave 3.1 root files retained for source-development history', () => {
    for (const [, originalScript] of COMMAND_SCRIPT_PAIRS) {
      const rootScript = path.join(PROJECT_ROOT, originalScript);
      if (OPTIONAL_SOURCE_DEV_ROOT_FILES.has(originalScript) && !fs.existsSync(rootScript)) {
        continue;
      }
      assert.equal(fs.existsSync(rootScript), true, rootScript);
    }
  });
});
