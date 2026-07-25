const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_COMMAND = path.join(
  PACKAGE_ROOT,
  'src',
  'commands',
  'goal-contract.ts'
);
const SOURCE_RUNNER = [
  "const { goalContractCommand } = require(process.argv[1]);",
  'process.exitCode = goalContractCommand({}, process.argv.slice(2));',
].join('');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-partition-cli-'));
}

function writeSourcePlan(root) {
  const sourcePath = path.join(root, 'source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Partition Source Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- TASK-001 MUST create deterministic partition input.',
      '',
      '## Acceptance Criteria',
      '',
      '- AC-001 MUST prove exact source coverage.',
      '',
      '## Completion Evidence Packet',
      '',
      '- EVD-001 MUST bind the exact source bytes.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writeCanonicalRegressionPlan(root) {
  const sourcePath = path.join(root, 'canonical-regression-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Canonical-Shaped Partition Source Plan',
      '',
      '> Workers may inspect evidence, but they must not modify repository files.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task P01-T01: Publish and Load the Partition Methodology Profile',
      '',
      '```json',
      '{',
      '  "rules": [',
      '    {"ruleId":"PM-001","normativeRule":"Preserve complete requirement coverage."},',
      '    {"ruleId":"PM-002","normativeRule":"Validate dependency direction."}',
      '  ]',
      '}',
      '```',
      '',
      'The schema must constrain classification to the three allowed values.',
      '',
      'Add optional `--release-receipt`; otherwise use the default receipt path.',
      '',
      '### Task P04-T04: Bind Shared-Artifact Changes to Dependency Compatibility Receipts',
      '',
      '- [ ] P05-T01: Dependencies: P04-T04; mention PM-001 as evidence.',
      '',
      '## P03 Slice Gate',
      '',
      '- Different source shapes can produce different counts.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function runSourceCommand(args) {
  return spawnSync(
    process.execPath,
    ['-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }
  );
}

function parsePayload(result) {
  assert.equal(result.signal, null, result.stderr || result.stdout);
  assert.notEqual(result.stdout.trim(), '', result.stderr);
  return JSON.parse(result.stdout);
}

describe('bmad-speckit goal-contract partition command', () => {
  it('runs the production partition chain to the declared P02 boundary without writing authority artifacts', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');

    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--json',
    ]);

    assert.notEqual(result.status, 0);
    const payload = parsePayload(result);
    assert.equal(payload.failureClass, 'execution_projection_not_implemented');
    assert.match(payload.sourceSnapshotHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.methodologyProfileHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.partitionPolicyHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(payload.semanticDerivationAllowance, true);
    assert.equal(
      payload.sequenceApplicabilityReceipt.sourceSnapshotHash,
      payload.sourceSnapshotHash
    );
    assert.equal(fs.existsSync(out), false);
  });

  it('reaches the P02 boundary for canonical-shaped task headings and descriptive dependency prose', () => {
    const root = tempRoot();
    const source = writeCanonicalRegressionPlan(root);
    const out = path.join(root, 'partition-manifest.json');

    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--json',
    ]);

    assert.notEqual(result.status, 0);
    const payload = parsePayload(result);
    assert.equal(payload.failureClass, 'execution_projection_not_implemented');
    assert.equal(fs.existsSync(out), false);
  });

  it('rejects caller-authored partition authority before reading source or writing output', () => {
    const root = tempRoot();
    const missingSource = path.join(root, 'missing-source.md');
    const out = path.join(root, 'must-not-exist.json');
    const cases = [
      ['--partition-count', '2'],
      ['--task', 'TASK-001'],
      ['--selected-candidate', 'candidate-1'],
      ['--decision', 'accept'],
      ['--selection-receipt', path.join(root, 'selection-receipt.json')],
      ['--partition-policy-hash', `sha256:${'a'.repeat(64)}`],
    ];

    for (const authorityArgs of cases) {
      const result = runSourceCommand([
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        missingSource,
        '--out',
        out,
        '--json',
        ...authorityArgs,
      ]);

      assert.notEqual(result.status, 0);
      assert.equal(
        parsePayload(result).failureClass,
        'partition_authority_argument_forbidden'
      );
      assert.equal(fs.existsSync(out), false);
    }
  });

  it('binds an explicit policy path and exact bytes before entering P02', () => {
    const root = tempRoot();
    const source = writeSourcePlan(root);
    const out = path.join(root, 'partition-manifest.json');
    const policyPath = path.join(root, 'explicit-policy.json');
    fs.copyFileSync(
      path.join(
        REPO_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'goal-contract-partition-policy.json'
      ),
      policyPath
    );

    const result = runSourceCommand([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--policy',
      policyPath,
      '--out',
      out,
      '--json',
    ]);

    assert.notEqual(result.status, 0);
    const payload = parsePayload(result);
    assert.equal(payload.failureClass, 'execution_projection_not_implemented');
    assert.equal(payload.policyPath, path.resolve(policyPath).replace(/\\/gu, '/'));
    assert.equal(payload.policyBytes, fs.readFileSync(policyPath).length);
    assert.match(payload.partitionPolicyArtifactHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(payload.partitionPolicyHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(fs.existsSync(out), false);
  });

  it('rejects incomplete partition-bound generation arguments before source access', () => {
    const root = tempRoot();
    const missingSource = path.join(root, 'missing-source.md');
    const out = path.join(root, 'must-not-exist.md');
    const cases = [
      ['--partition-manifest', path.join(root, 'manifest.json')],
      ['--partition-id', 'PARTITION-001'],
    ];

    for (const selectorArgs of cases) {
      const result = runSourceCommand([
        'generate',
        '--entry',
        'standalone_goal_contract',
        '--source',
        missingSource,
        '--out',
        out,
        '--json',
        ...selectorArgs,
      ]);

      assert.notEqual(result.status, 0);
      assert.equal(
        parsePayload(result).failureClass,
        'partition_generation_arguments_incomplete'
      );
      assert.equal(fs.existsSync(out), false);
    }
  });
});
