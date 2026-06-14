const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'bmad-speckit.js');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-cli-'));
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN, 'goal-contract', ...args], {
    cwd: options.cwd || path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function writeSourcePlan(root) {
  const sourcePath = path.join(root, 'source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Source Plan',
      '',
      '## Problem Statement',
      '',
      'The generator must prove source coverage.',
      '',
      '## File Map',
      '',
      '- Create `packages/bmad-speckit/src/commands/goal-contract.js`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task 1: Add package CLI',
      '',
      '- [ ] Parse `--source`, `--out`, and `--json`.',
      '',
      'Run:',
      '',
      '```powershell',
      'npx --no-install bmad-speckit goal-contract generate --source docs/plans/source.md --out docs/plans/goal.md --json',
      '```',
      '',
      '## Completion Evidence Packet',
      '',
      '- Coverage receipt and generation receipt must exist.',
      '',
      '## Decision',
      '',
      'This repair blocks release until coverage passes.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

describe('bmad-speckit goal-contract command', () => {
  it('generates a source-covered goal contract with coverage and generation receipts', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(['generate', '--source', source, '--out', out, '--json']);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.unmappedSourceObligations, 0);
    assert.ok(payload.sourceObligationCount > 0);
    assert.match(payload.sourcePlanHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.goalContractHash, /^sha256:[0-9a-f]{64}$/u);
    assert.ok(fs.existsSync(out));
    assert.ok(fs.existsSync(payload.coverageReceiptPath));
    assert.ok(fs.existsSync(payload.generationReceiptPath));

    const goalText = fs.readFileSync(out, 'utf8');
    assert.match(goalText, /sourceBytes: \d+/u);
    assert.match(goalText, /sourceLines: \d+/u);
    assert.match(goalText, /coverageReceiptPath:/u);
    assert.match(goalText, /generationReceiptPath:/u);
    assert.match(goalText, /unmappedSourceObligations: 0/u);
    assert.match(goalText, /## Source Coverage Matrix/u);
    assert.match(goalText, /\| SRC001 \|/u);
    assert.match(goalText, /coverage receipt contains SRC001/u);
    assert.doesNotMatch(goalText, /rg -n -F 'SRC001' -- '.*source-plan\.md'/u);

    const coverage = JSON.parse(fs.readFileSync(payload.coverageReceiptPath, 'utf8'));
    const generation = JSON.parse(fs.readFileSync(payload.generationReceiptPath, 'utf8'));
    assert.equal(coverage.decision, 'pass');
    assert.deepEqual(coverage.unmappedSourceObligations, []);
    assert.equal(coverage.sourcePlanHash, payload.sourcePlanHash);
    assert.equal(coverage.goalContractHash, payload.goalContractHash);
    assert.equal(generation.coverageReceiptPath, payload.coverageReceiptPath);
    assert.equal(generation.goalContractHash, payload.goalContractHash);
    assert.equal(generation.writeReceipt.schemaVersion, 'large-document-writer-safe-write/v1');
  });

  it('returns a stable JSON failure when the source path is missing', () => {
    const root = tempRoot();
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(['generate', '--source', path.join(root, 'missing.md'), '--out', out, '--json']);

    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'source_plan_missing');
  });
});
