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

function standaloneGenerateArgs(args) {
  return ['generate', '--entry', 'standalone_goal_contract', ...args];
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
      '- Create `packages/bmad-speckit/src/commands/goal-contract.ts`.',
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

    const result = runCli(standaloneGenerateArgs(['--source', source, '--out', out, '--json']));

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
    assert.match(goalText, /goalContractProfileVersion: 2\.1\.0/u);
    assert.match(goalText, /entryScenario: standalone_goal_contract/u);
    assert.match(
      goalText,
      /finalArtifactAuthority: standalone_goal_execution_plan_markdown/u
    );
    assert.match(goalText, /coverageReceiptPath:/u);
    assert.match(goalText, /generationReceiptPath:/u);
    assert.match(goalText, /unmappedSourceObligations: 0/u);
    assert.match(goalText, /## Source Coverage Matrix/u);
    assert.match(goalText, /\| SRC001 \|/u);
    assert.match(goalText, /npx --no-install bmad-speckit goal-contract generate --source docs\/plans\/source\.md --out docs\/plans\/goal\.md --json/u);
    assert.doesNotMatch(goalText, /rg -n -F 'SRC001' -- '.*source-plan\.md'/u);
    assert.doesNotMatch(goalText, /rg -n -F 'SRC\d{3}'.*coverage\.json/u);
    assert.match(goalText, /sourceTextHash=sha256:[0-9a-f]{64}/u);
    assert.match(
      goalText,
      /standalone Markdown contract is the frozen execution authority/u
    );

    const coverage = JSON.parse(fs.readFileSync(payload.coverageReceiptPath, 'utf8'));
    const generation = JSON.parse(fs.readFileSync(payload.generationReceiptPath, 'utf8'));
    assert.equal(coverage.decision, 'pass');
    assert.deepEqual(coverage.unmappedSourceObligations, []);
    assert.equal(coverage.sourcePlanHash, payload.sourcePlanHash);
    assert.equal(coverage.goalContractHash, payload.goalContractHash);
    assert.equal(generation.coverageReceiptPath, payload.coverageReceiptPath);
    assert.equal(generation.goalContractHash, payload.goalContractHash);
    assert.equal(payload.implementationProofAudit.decision, 'pass');
    assert.equal(generation.implementationProofAudit.decision, 'pass');
    assert.equal(generation.implementationProofAudit.coverageOnlyCommandAllowedForCodeObligations, false);
    assert.equal(payload.deterministicPreflight.decision, 'pass');
    assert.equal(payload.deterministicPreflight.auditEpochAllowed, true);
    assert.equal(payload.auditMetrics.auditEpochOpened, false);
    assert.deepEqual(payload.auditMetrics.sequence, [
      'deterministic_preflight',
    ]);
    assert.equal(payload.auditProfile.finalDocsReviewRequired, false);
    assert.deepEqual(
      generation.deterministicPreflight,
      payload.deterministicPreflight
    );
    assert.equal(generation.writeReceipt.schemaVersion, 'large-document-writer-safe-write/v1');
  });

  it('assigns each command block its own command reference', () => {
    const root = tempRoot();
    const sourcePath = path.join(root, 'multi-command-source-plan.md');
    fs.writeFileSync(
      sourcePath,
      [
        '# Multi Command Plan',
        '',
        '## File Map',
        '',
        '- Modify `packages/bmad-speckit/src/commands/goal-contract.ts`.',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task 1: First command',
        '',
        '- MUST run the first command block.',
        '',
        '```powershell',
        'node --test packages/bmad-speckit/tests/goal-contract-command.test.js',
        '```',
        '',
        '### Task 2: Second command',
        '',
        '- MUST run the second command block.',
        '',
        '```powershell',
        'node --test packages/bmad-speckit/tests/goal-contract-implementation-proof.test.js',
        '```',
      ].join('\n'),
      'utf8'
    );
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs(['--source', sourcePath, '--out', out, '--json']));

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const goalText = fs.readFileSync(out, 'utf8');
    const commandHeadings = [...goalText.matchAll(/### \d+\. COMMAND (CMD\d{3})/gu)].map((match) => match[1]);

    assert.equal(commandHeadings.length, 2);
    assert.notEqual(commandHeadings[0], commandHeadings[1]);
    assert.match(goalText, /node --test packages\/bmad-speckit\/tests\/goal-contract-command\.test\.js/u);
    assert.match(goalText, /node --test packages\/bmad-speckit\/tests\/goal-contract-implementation-proof\.test\.js/u);
  });

  it('returns a stable JSON failure when the source path is missing', () => {
    const root = tempRoot();
    const out = path.join(root, 'goal-execution-plan.md');

    const result = runCli(standaloneGenerateArgs([
      '--source',
      path.join(root, 'missing.md'),
      '--out',
      out,
      '--json',
    ]));

    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'source_plan_missing');
  });

  it('fails closed before writing a contract with non-portable PowerShell Git revisions', () => {
    const root = tempRoot();
    const sourcePath = path.join(root, 'non-portable-command-plan.md');
    const out = path.join(root, 'goal-execution-plan.md');
    fs.writeFileSync(
      sourcePath,
      [
        '# Non-Portable Command Plan',
        '',
        '## File Map',
        '',
        '- Modify `packages/bmad-speckit/src/commands/goal-contract.ts`.',
        '',
        '## Implementation Task Breakdown',
        '',
        '### Task 1: Capture the tree hash',
        '',
        '- MUST capture the current Git tree hash.',
        '',
        '```powershell',
        'git rev-parse HEAD^{tree}',
        '```',
      ].join('\n'),
      'utf8'
    );

    const result = runCli(standaloneGenerateArgs(['--source', sourcePath, '--out', out, '--json']));

    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.failureClass, 'command_portability_failed');
    assert.equal(payload.commandPortabilityAudit.status, 'FAIL');
    assert.ok(payload.commandPortabilityAudit.issueCount >= 1);
    assert.equal(payload.deterministicPreflight.decision, 'block');
    assert.equal(payload.deterministicPreflight.auditEpochAllowed, false);
    assert.ok(
      payload.deterministicPreflight.issues.some(
        (issue) => issue.checkId === 'command_portability'
      )
    );
    assert.equal(fs.existsSync(out), false);
  });

  it('fails closed when entry selection is missing, unknown, or duplicated', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'goal-execution-plan.md');
    const cases = [
      {
        args: ['generate', '--source', source, '--out', out, '--json'],
        failureClass: 'entry_missing',
      },
      {
        args: ['generate', '--entry', 'unknown', '--source', source, '--out', out, '--json'],
        failureClass: 'entry_unknown',
      },
      {
        args: [
          'generate',
          '--entry',
          'standalone_goal_contract',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--out',
          out,
          '--json',
        ],
        failureClass: 'entry_duplicated',
      },
    ];

    for (const testCase of cases) {
      const result = runCli(testCase.args);
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stdout).failureClass, testCase.failureClass);
      assert.equal(fs.existsSync(out), false);
    }
  });

  it('rejects incompatible entry routes, output sets, and missing authority', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const cases = [
      {
        args: [
          'generate',
          '--entry',
          'req_trace_direct',
          '--source',
          source,
          '--out',
          path.join(root, 'goal-execution-plan.md'),
          '--json',
        ],
        failureClass: 'entry_route_mismatch',
      },
      {
        args: standaloneGenerateArgs([
          '--source',
          source,
          '--out',
          path.join(root, 'model_packet.json'),
          '--json',
        ]),
        failureClass: 'entry_output_set_mismatch',
      },
      {
        args: standaloneGenerateArgs([
          '--out',
          path.join(root, 'goal-execution-plan.md'),
          '--json',
        ]),
        failureClass: 'entry_source_authority_missing',
      },
    ];

    for (const testCase of cases) {
      const result = runCli(testCase.args);
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stdout).failureClass, testCase.failureClass);
    }
  });
});
