const { after, before, describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SOURCE_COMMAND = path.join(PACKAGE_ROOT, 'src', 'commands', 'goal-contract.ts');
const PUBLIC_BIN = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const BUILD_LOCK = path.join(PACKAGE_ROOT, 'node_modules', '.pack-session.lock');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-runtime-parity-'));
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');

before(() => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180000) {
    try {
      fs.mkdirSync(BUILD_LOCK);
      fs.writeFileSync(
        path.join(BUILD_LOCK, 'owner.json'),
        `${JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
          packSession: false,
        })}\n`,
        'utf8'
      );
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  throw new Error(`timed out acquiring package runtime read lock: ${BUILD_LOCK}`);
});

after(() => {
  fs.rmSync(BUILD_LOCK, { force: true, recursive: true });
  fs.rmSync(ROOT, { force: true, recursive: true });
});

function sourceText(title, tasks) {
  return [
    `# ${title}`,
    '',
    '## Implementation Task Breakdown',
    '',
    ...tasks.flatMap((task) => [`- [ ] ${task}`, '']),
    '## Acceptance Criteria',
    '',
    '- [ ] AC-CORPUS: MUST prove observable completion.',
    '',
    '## Completion Evidence Packet',
    '',
    '- [ ] EVD-CORPUS: MUST bind current source bytes.',
    '',
    '## Required Test Commands',
    '',
    '- [ ] CMD-CORPUS: Run `node --version`.',
    '',
  ].join('\n');
}

const CORPUS = [
  ['cohesive', sourceText('Cohesive Capability', ['TASK-COHESIVE: MUST close one capability.'])],
  [
    'serial',
    sourceText('Serial Authority Handoffs', [
      'TASK-SERIAL-1: MUST establish the authority input.',
      'TASK-SERIAL-2: Dependencies: TASK-SERIAL-1; MUST consume the authority input.',
      'TASK-SERIAL-3: Dependencies: TASK-SERIAL-2; MUST close the authority output.',
    ]),
  ],
  [
    'parallel',
    sourceText('Independent Parallel Capabilities', [
      'TASK-PARALLEL-1: MUST close capability alpha.',
      'TASK-PARALLEL-2: MUST close capability beta.',
      'TASK-PARALLEL-3: MUST close capability gamma.',
    ]),
  ],
  [
    'distribution',
    sourceText('Distribution and Final Delivery Obligations', [
      'TASK-DISTRIBUTION: MUST publish package assets and verify final delivery.',
    ]),
  ],
  [
    'oversized',
    sourceText(
      'Oversized Atomic Component',
      Array.from(
        { length: 8 },
        (_, index) => `TASK-ATOMIC-${index + 1}: MUST close atomic work item ${index + 1}.`
      )
    ),
  ],
];

function runLane(kind, source, root, sequenceMode = 'auto') {
  const out = path.join(root, 'partition-manifest.json');
  const receipts = path.join(root, 'receipts');
  const common = [
    'partition', '--entry', 'standalone_goal_contract', '--source', source,
    '--sequence-mode', sequenceMode,
    '--out', out, '--receipts-dir', receipts, '--json',
  ];
  const argv = kind === 'source'
    ? ['-e', SOURCE_RUNNER, SOURCE_COMMAND, ...common]
    : [PUBLIC_BIN, 'goal-contract', ...common];
  const result = spawnSync(process.execPath, argv, {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(result.signal, null, result.stderr || result.stdout);
  assert.notEqual(result.stdout.trim(), '', result.stderr);
  const payload = JSON.parse(result.stdout);
  if (result.status !== 0) {
    assert.equal(fs.existsSync(out), false);
    return { outcome: 'blocked', failureClass: payload.failureClass };
  }
  const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
  const analysis = JSON.parse(
    fs.readFileSync(
      path.join(receipts, 'partition-runs', payload.runId, 'partition-analysis.receipt.json'),
      'utf8'
    )
  );
  assert.equal(analysis.semanticDerivationMode, 'structured_fast_path');
  return {
    outcome: 'pass',
    partitionManifestHash: payload.partitionManifestHash,
    executionProjectionHash: payload.executionProjectionHash,
    partitionSetHash: payload.partitionSetHash,
    partitionCount: payload.partitionCount,
    partitionIds: manifest.topologicalOrder,
    sequenceMode: payload.sequenceMode,
    sequenceApplicability: payload.sequenceApplicability,
    sequenceCoverage: payload.sequenceCoverage,
    sequenceClosureStatus: payload.sequenceClosureStatus,
    childContractAuthority: payload.childContractAuthority,
    semanticProviderCallCount: payload.semanticProviderCallCount,
  };
}

describe('goal-contract partition source/dist runtime parity', () => {
  for (const [name, text] of CORPUS) {
    it(`matches ${name} corpus semantics`, () => {
      const caseRoot = path.join(ROOT, name);
      fs.mkdirSync(caseRoot, { recursive: true });
      const source = path.join(caseRoot, 'source.md');
      fs.writeFileSync(source, text, 'utf8');
      const sourceSemantic = runLane('source', source, path.join(caseRoot, 'source'));
      const distSemantic = runLane('dist', source, path.join(caseRoot, 'dist'));
      assert.deepEqual(distSemantic, sourceSemantic);
      if (name === 'oversized') {
        assert.deepEqual(sourceSemantic, {
          outcome: 'blocked',
          failureClass: 'partition_global_coverage_blocked',
        });
      } else {
        assert.equal(sourceSemantic.sequenceMode, 'auto');
        assert.equal(sourceSemantic.sequenceApplicability, 'not_applicable_with_proof');
        assert.equal(sourceSemantic.sequenceCoverage, 'not_applicable');
        assert.equal(sourceSemantic.sequenceClosureStatus, 'not_required');
        assert.equal(sourceSemantic.childContractAuthority, 'full');
        assert.equal(sourceSemantic.semanticProviderCallCount, 0);
      }
    });
  }

  it('keeps mode-sensitive authority identity equal across source and dist', () => {
    const caseRoot = path.join(ROOT, 'mode-identity');
    fs.mkdirSync(caseRoot, { recursive: true });
    const source = path.join(caseRoot, 'source.md');
    fs.writeFileSync(source, CORPUS[0][1], 'utf8');
    const runs = {};

    for (const mode of ['auto', 'disabled']) {
      const sourceSemantic = runLane(
        'source',
        source,
        path.join(caseRoot, 'source', mode),
        mode
      );
      const distSemantic = runLane(
        'dist',
        source,
        path.join(caseRoot, 'dist', mode),
        mode
      );
      assert.deepEqual(distSemantic, sourceSemantic);
      runs[mode] = sourceSemantic;
    }

    assert.notEqual(
      runs.auto.executionProjectionHash,
      runs.disabled.executionProjectionHash
    );
    assert.notEqual(
      runs.auto.partitionManifestHash,
      runs.disabled.partitionManifestHash
    );
    assert.equal(runs.auto.partitionCount, runs.disabled.partitionCount);
    assert.equal(runs.disabled.sequenceMode, 'disabled');
    assert.equal(runs.disabled.sequenceApplicability, 'not_applicable_with_proof');
    assert.equal(runs.disabled.sequenceCoverage, 'excluded');
    assert.equal(runs.disabled.sequenceClosureStatus, 'not_requested');
    assert.equal(runs.disabled.childContractAuthority, 'core_only');
  });
});
