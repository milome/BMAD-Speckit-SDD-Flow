const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'bmad-speckit.js');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-proof-'));
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN, 'goal-contract', ...args], {
    cwd: options.cwd || path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function standaloneGenerateArgs(args) {
  return ['generate', '--entry', 'standalone_goal_contract', ...args];
}

function writePlan(root, lines) {
  const sourcePath = path.join(root, 'source-plan.md');
  fs.writeFileSync(sourcePath, `${lines.join('\n')}\n`, 'utf8');
  return sourcePath;
}

function generationPayload(result) {
  assert.match(result.stdout, /^\{/u, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe('goal-contract implementation proof audit', () => {
  it('fails closed when source text contains an optional executable obligation', () => {
    const root = tempRoot();
    const source = writePlan(root, [
      '# Ambiguous Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- Optional internal refactor may update `packages/bmad-speckit/src/utils/goal-contract/slot-data-builder.ts`.',
    ]);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));
    const payload = generationPayload(result);

    assert.notEqual(result.status, 0);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'non_deterministic_source_obligation');
    assert.match(payload.sourceId, /^SRC\d{3}$/u);
    assert.equal(payload.matchedPhrase.toLowerCase(), 'optional');
    assert.ok(Number.isInteger(payload.lineStart));
    assert.ok(Number.isInteger(payload.lineEnd));
    assert.match(payload.sourceExcerpt, /Optional internal refactor/u);
    assert.match(payload.repairHint, /MUST|MUST NOT/u);
  });

  it('fails closed when source text contains an allowed executable seam', () => {
    const root = tempRoot();
    const source = writePlan(root, [
      '# Ambiguous Seam Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- The allowed seam can update `packages/bmad-speckit/src/utils/goal-contract/slot-data-builder.ts`.',
    ]);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));
    const payload = generationPayload(result);

    assert.notEqual(result.status, 0);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'non_deterministic_source_obligation');
    assert.match(payload.sourceId, /^SRC\d{3}$/u);
    assert.equal(payload.matchedPhrase.toLowerCase(), 'allowed');
    assert.match(payload.sourceExcerpt, /allowed seam/u);
  });

  it('does not reject nondeterministic wording inside non-executable problem statements', () => {
    const root = tempRoot();
    const source = writePlan(root, [
      '# Problem Description Plan',
      '',
      '## Problem Statement',
      '',
      '1. The requirements promote seam is broken.',
      '2. The previous generator allowed ambiguous or optional obligations to pass.',
      '',
      '## File Map',
      '',
      '- Modify `packages/bmad-speckit/src/utils/goal-contract/slot-data-builder.ts`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task 1: Add implementation proof audit',
      '',
      '- MUST emit `implementationProofAudit.decision === "pass"` for deterministic code obligations.',
      '',
      'Run:',
      '',
      '```powershell',
      'node --test packages/bmad-speckit/tests/goal-contract-implementation-proof.test.js',
      '```',
    ]);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));
    const payload = generationPayload(result);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.implementationProofAudit.decision, 'pass');
  });

  it('does not reject backticked nondeterministic phrase names inside executable detection rules', () => {
    const root = tempRoot();
    const source = writePlan(root, [
      '# Denylist Rule Plan',
      '',
      '## File Map',
      '',
      '- Modify `packages/bmad-speckit/src/utils/goal-contract/non-deterministic-source-validator.ts`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '- Detect nondeterministic source wording that includes `optional`, `allowed`, `if refactoring`, `may`, `might`, `should`, `can`, `as needed`, `where appropriate`, and ambiguous `where applicable` cases without an explicit condition.',
      '',
      'Run:',
      '',
      '```powershell',
      'node --test packages/bmad-speckit/tests/goal-contract-implementation-proof.test.js',
      '```',
    ]);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));
    const payload = generationPayload(result);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.implementationProofAudit.decision, 'pass');
  });

  it('emits implementationProofAudit and non coverage-grep commands for a mandatory code seam', () => {
    const root = tempRoot();
    const source = writePlan(root, [
      '# Mandatory Code Seam Plan',
      '',
      '## File Map',
      '',
      '- Modify `packages/bmad-speckit/src/utils/goal-contract/slot-data-builder.ts`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task 1: Add implementation proof audit',
      '',
      '- MUST emit `implementationProofAudit.decision === "pass"` for deterministic code obligations.',
      '',
      'Run:',
      '',
      '```powershell',
      'node --test packages/bmad-speckit/tests/goal-contract-implementation-proof.test.js',
      '```',
    ]);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));
    const payload = generationPayload(result);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.implementationProofAudit.decision, 'pass');
    assert.equal(payload.implementationProofAudit.coverageOnlyCommandAllowedForCodeObligations, false);

    const generation = JSON.parse(fs.readFileSync(payload.generationReceiptPath, 'utf8'));
    const goalText = fs.readFileSync(out, 'utf8');

    assert.equal(generation.implementationProofAudit.decision, 'pass');
    assert.doesNotMatch(goalText, /rg -n -F 'SRC\d{3}'.*coverage\.json/u);
    assert.match(goalText, /node --test packages\/bmad-speckit\/tests\/goal-contract-implementation-proof\.test\.js/u);
    assert.doesNotMatch(goalText, /\bObserved(?: Evidence)?:\s*PASS\b/u);
    assert.equal(generation.evidenceTerminalState ?? null, null);
  });
});
