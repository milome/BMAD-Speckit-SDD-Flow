const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { x: extractTar } = require('tar');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'standalone-goal');
const CONFIRMED_ARCHIVE = path.join(
  FIXTURE_ROOT,
  'canonical-source-plan-v1-full.confirmed-authority.tar.gz'
);
const { resolveConfirmedRequirementsAuthority } = require(
  '../src/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-adapter.ts'
);
const { compileConfirmedRequirementsGoalSemantics } = require(
  '../src/utils/goal-contract/control-plane/confirmed-requirements-goal-compiler.ts'
);
const {
  compileFrozenGoalExecutionEligibility,
  compilePartitionFromFrozenGoalAuthority,
} = require('../src/utils/goal-contract/control-plane/frozen-goal-activation.ts');

function hash(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function readConfirmedAuthority(projectRoot) {
  const recordsRoot = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records'
  );
  const requestId = fs.readdirSync(recordsRoot).find((entry) =>
    fs.statSync(path.join(recordsRoot, entry)).isDirectory()
  );
  assert.ok(requestId);
  const requirementRecordPath = path.join(
    recordsRoot,
    requestId,
    'record',
    'requirement-record.json'
  );
  return {
    requestId,
    requirementRecordPath,
    authority: resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath,
    }),
  };
}

function buildSixStateContext(base) {
  const typedConstraints = base.goalExecutionIr.semanticSource.typedExecutionConstraints.filter(
    (constraint) => constraint.kind === 'PATH'
  );
  const architectureConfirmationCandidateHash = hash('confirmed-six-state-architecture');
  const implementationReadinessCandidateHash = hash('confirmed-six-state-readiness');
  const readinessScopedInputDigest = hash('confirmed-six-state-input');
  return {
    architecture: {
      architectureConfirmationCandidateHash,
      isolation: { mode: 'canonical_requirement_graph' },
      ownership: typedConstraints.map((constraint) => ({
        targetPath: constraint.canonicalValue,
        owner: constraint.applicableSourceRefs?.[0] ?? constraint.scope?.owner ?? constraint.constraintId,
        basisRefs: [constraint.constraintId],
        obligationRefs: constraint.applicableMustRefs ?? [],
        atomRefs: constraint.applicableAtomRefs ?? [],
        sourceRefs: constraint.sourceRefs ?? [constraint.constraintId],
      })),
      architectureDecisions: [],
      logicalScope: { forbiddenPaths: [] },
    },
    readiness: {
      implementationReadinessCandidateHash,
      readinessScopedInputDigest,
      normalizedCommands: [],
      inputArtifacts: [],
      redOutcomes: [],
    },
    architectureConfirmationCandidateHash,
    implementationReadinessCandidateHash,
    readinessScopedInputDigest,
  };
}

test('confirmed Requirements full parent partitions into immutable child packages after six-state readiness', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmed-parent-child-'));
  try {
    await extractTar({ file: CONFIRMED_ARCHIVE, cwd: projectRoot, strict: true });
    const { authority } = readConfirmedAuthority(projectRoot);
    const base = compileConfirmedRequirementsGoalSemantics({ authority });
    const sixState = compileConfirmedRequirementsGoalSemantics({
      authority,
      sixStateContext: buildSixStateContext(base),
    });
    const eligibility = compileFrozenGoalExecutionEligibility(sixState.goalExecutionIr);
    assert.deepEqual(
      {
        decision: eligibility.decision,
        executionMode: eligibility.executionMode,
        componentCount: eligibility.componentCount,
      },
      { decision: 'pass', executionMode: 'partitioned_goal', componentCount: 16 }
    );

    const partition = compilePartitionFromFrozenGoalAuthority({
      goalExecutionIr: sixState.goalExecutionIr,
      eligibility,
      executionAdapterRef: {
        path: 'adapter/authority.json',
        hash: hash('confirmed-six-state-execution-adapter'),
      },
    });
    assert.equal(partition.manifest.schemaVersion, 'GoalContractPartitionManifest/v2');
    assert.equal(partition.manifest.partitionOutcome, 'complete_valid');
    assert.equal(partition.manifest.partitionCount, 16);
    assert.equal(partition.childPackages.length, 16);

    const childContracts = partition.manifest.partitions.map((row) => {
      const relativePath = `partition/children/${row.partitionId}/child-execution-contract.json`;
      const bytes = partition.files.get(relativePath);
      assert.ok(Buffer.isBuffer(bytes), relativePath);
      return JSON.parse(bytes.toString('utf8'));
    });
    assert.ok(childContracts.every((child) => child.atomicTasks.length === 1));
    assert.equal(new Set(childContracts.flatMap((child) => child.taskRefs)).size, 16);
    assert.equal(
      new Set(childContracts.flatMap((child) => child.traceSliceRefs)).size,
      sixState.goalExecutionIr.traceSlices.length
    );
    const obligationCount = childContracts.reduce(
      (total, child) => total + child.obligations.length,
      0
    );
    assert.ok(obligationCount < 500, `child obligation expansion: ${obligationCount}`);
    assert.ok(
      Math.max(...childContracts.map((child) => child.obligations.length)) < 120,
      'one child inherited an unbounded source-scope obligation set'
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
