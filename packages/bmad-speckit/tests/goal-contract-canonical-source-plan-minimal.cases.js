const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const {
  lintStandaloneSourcePlanFile,
} = require('../src/utils/goal-contract/source-plan/standalone-source-plan.ts');
const {
  resolveGoalExecutionAuthority,
} = require('../src/utils/goal-contract/control-plane/goal-execution-authority.ts');
const {
  goalExecutionIRHash,
  validateGoalExecutionIR,
} = require('../src/utils/goal-contract/control-plane/goal-execution-ir.ts');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const FIXTURE_ROOT = path.join(PACKAGE_ROOT, 'tests', 'fixtures', 'standalone-goal');
const MINIMAL = path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-minimal.md');
const SOURCE_COMMAND = path.join(PACKAGE_ROOT, 'src', 'commands', 'goal-contract.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');

const RELATION_TYPES = {
  ownerRef: 'owned_by',
  requirementRefs: 'applies_to_requirement',
  taskRefs: 'implemented_by',
  acceptanceRefs: 'accepted_by',
  pathRefs: 'uses_path',
  commandRefs: 'validated_by',
  evidenceRefs: 'evidenced_by',
  artifactRefs: 'produces_artifact',
  dependencyRefs: 'depends_on',
  stopRefs: 'guarded_by',
  producerRef: 'produced_by',
  consumerRefs: 'consumed_by',
  commandSetRefs: 'includes_command',
  globalAuthorityRef: 'globally_authorized_by',
};
const EXPECTED_IDS = [
  'AC-NORM-001-S01',
  'ART-NORM-001',
  'CMD-NORM-001',
  'CMD-NORM-002',
  'CMD-NORM-003',
  'DEP-NORM-001',
  'EVD-NORM-001',
  'NEG-NORM-001',
  'NFR-NORM-001',
  'OUT-NORM-001',
  'PATH-NORM-001',
  'REQ-NORM-001',
  'STOP-NORM-001',
  'TASK-NORM-001',
];
const EXPECTED_RELATION_COUNTS = {
  accepted_by: 6,
  applies_to_requirement: 20,
  consumed_by: 3,
  depends_on: 1,
  evidenced_by: 3,
  globally_authorized_by: 1,
  guarded_by: 1,
  implemented_by: 6,
  includes_command: 1,
  owned_by: 9,
  produced_by: 2,
  produces_artifact: 1,
  uses_path: 1,
  validated_by: 4,
};
const EXPECTED_ALIASES = {
  'AC-20-S03': 'AC-NORM-001-S01',
  'FIX-NORM-01': 'REQ-NORM-001',
  'NOT-DONE-NORM-01': 'OUT-NORM-001',
  'WORK-NORM-01': 'TASK-NORM-001',
};
const NEGATIVE_FIXTURES = {
  'dangling-reference.md': 'source_reference_missing',
  'duplicate-id.md': 'source_semantic_id_duplicate',
  'global-wildcard.md': 'source_global_fanout_invalid',
  'invalid-applicability.md': 'source_semantic_applicability_invalid',
  'orphan-ac.md': 'source_semantic_owner_missing',
  'orphan-cmd.md': 'source_semantic_owner_missing',
  'orphan-evd.md': 'source_semantic_owner_missing',
  'provenance-alias.md': 'source_alias_invalid',
  'purpose-conflict.md': 'source_plan_purpose_conflict',
};

function independentNodes(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  return [...source.matchAll(/```standalone-source-plan-node\r?\n([\s\S]*?)\r?\n```/gu)].map(
    (match) => yaml.load(match[1])
  );
}

function independentInventory(nodes) {
  const relations = [];
  const aliases = {};
  for (const node of nodes) {
    for (const [field, type] of Object.entries(RELATION_TYPES)) {
      const refs = Array.isArray(node[field]) ? node[field] : node[field] ? [node[field]] : [];
      for (const target of refs) relations.push(`${type}:${node.id}:${target}`);
    }
    for (const alias of node.aliases || []) aliases[alias] = node.id;
  }
  const relationCounts = {};
  for (const relation of relations) {
    const type = relation.slice(0, relation.indexOf(':'));
    relationCounts[type] = (relationCounts[type] || 0) + 1;
  }
  return { aliases, relationCounts, relations };
}

function readGoalExecutionIR(goalContractPath) {
  const irRoot = path.join(`${goalContractPath}.authority`, 'goal', 'ir');
  const hashDirectories = fs.readdirSync(irRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.equal(hashDirectories.length, 1);
  const envelope = JSON.parse(fs.readFileSync(path.join(irRoot, hashDirectories[0].name, 'goal-execution-ir.json'), 'utf8'));
  return resolveGoalExecutionAuthority(envelope);
}

describe('canonical Source Plan v1 minimal fixture', () => {
  it('matches the independently authored node, alias, and relation inventory', () => {
    const nodes = independentNodes(MINIMAL);
    const inventory = independentInventory(nodes);
    assert.deepEqual(nodes.map(({ id }) => id).sort(), EXPECTED_IDS);
    assert.deepEqual(inventory.aliases, EXPECTED_ALIASES);
    assert.deepEqual(inventory.relationCounts, EXPECTED_RELATION_COUNTS);
    assert.equal(inventory.relations.length, 59);
    assert.equal(new Set(inventory.relations).size, 59);
  });

  it('normalizes to the same complete sparse inventory without semantic SRC ids', () => {
    const result = lintStandaloneSourcePlanFile(MINIMAL);
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(result.nodeCount, 14);
    assert.equal(result.relationCount, 59);
    assert.deepEqual(result.canonicalGraph.nodes.map(({ id }) => id), EXPECTED_IDS);
    assert.deepEqual(
      Object.fromEntries(result.canonicalGraph.aliases.map(({ alias, canonicalRef }) => [alias, canonicalRef])),
      EXPECTED_ALIASES
    );
    assert.ok(result.canonicalGraph.nodes.every(({ id }) => !/^SRC-/u.test(id)));
  });

  it('rejects every negative fixture with its expected class and no partial graph', () => {
    for (const [name, expectedFailure] of Object.entries(NEGATIVE_FIXTURES)) {
      const result = lintStandaloneSourcePlanFile(path.join(FIXTURE_ROOT, 'invalid-v1', name));
      assert.equal(result.ok, false, name);
      assert.equal(result.canonicalGraph, null, name);
      assert.ok(result.issues.some(({ failureClass }) => failureClass === expectedFailure), name);
      assert.ok(result.issues.every(({ lineStart, startByte, excerptHash }) => lineStart > 0 && startByte >= 0 && excerptHash), name);
    }
  });

  it('compiles through the production standalone entry without semantic SRC ids', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-source-plan-minimal-'));
    const out = path.join(root, 'goal-execution-plan.md');
    try {
      const result = spawnSync(
        process.execPath,
        [TSX, '-e', SOURCE_RUNNER, SOURCE_COMMAND, 'generate', '--entry', 'standalone_goal_contract', '--source', MINIMAL, '--out', out, '--sequence-mode', 'disabled', '--json'],
        { cwd: PACKAGE_ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(fs.existsSync(out), true);
      const goal = fs.readFileSync(out, 'utf8');
      assert.doesNotMatch(goal, /\bSRC-[A-Z0-9]+/u);
      for (const id of ['REQ-NORM-001', 'TASK-NORM-001', 'AC-NORM-001-S01', 'CMD-NORM-001', 'EVD-NORM-001']) {
        assert.match(goal, new RegExp(id, 'u'));
      }

      const ir = readGoalExecutionIR(out);
      assert.equal(ir.schemaVersion, 'GoalExecutionIR/v3');
      assert.equal(ir.profile, 'standalone');
      assert.equal(ir.sourceLineage.schemaVersion, 'GoalExecutionSourceLineage/v1');
      assert.equal(ir.sourceLineage.authorities.length, 1);
      assert.equal(ir.sourceLineage.authorities[0].sourceSnapshotHash, ir.standaloneLineage.sourceSnapshotHash);
      assert.deepEqual(ir.sourceLineage.logicalSpecSpanRefs, ir.logicalSpecSpans.map(({ specSpanId }) => specSpanId));
      assert.ok(ir.logicalSpecSpans.every((span) =>
        span.sourceArtifactId && span.sourceSnapshotHash && span.startByte >= 0 &&
        span.endByteExclusive > span.startByte && span.lineStart > 0 &&
        span.lineEnd >= span.lineStart && /^sha256:[a-f0-9]{64}$/u.test(span.exactTextHash) &&
        span.boundObligationIds.length > 0
      ));
      assert.deepEqual(ir.obligations.map(({ obligationId }) => obligationId), [
        'AC-NORM-001-S01',
        'NEG-NORM-001',
        'NFR-NORM-001',
        'OUT-NORM-001',
        'REQ-NORM-001',
        'TASK-NORM-001',
      ]);
      assert.deepEqual(
        ir.obligations.filter(({ executionRole }) => executionRole === 'action').map(({ obligationId }) => obligationId),
        ['TASK-NORM-001']
      );
      assert.equal(ir.atomicTasks.length, 1);
      assert.deepEqual(ir.atomicTasks[0].obligationRefs, ['TASK-NORM-001']);
      assert.deepEqual(ir.atomicTasks[0].atomRefs, ['TASK-NORM-001-A1']);
      const taskObligation = ir.obligations.find(({ obligationId }) => obligationId === 'TASK-NORM-001');
      assert.ok(taskObligation.typedRefs.some(({ kind, targetId }) =>
        kind === 'validated_by' && targetId === 'CMD-NORM-003'));

      const constraints = ir.semanticSource.typedExecutionConstraints;
      assert.deepEqual(constraints.map(({ constraintId }) => constraintId).sort(), [
        'ART-NORM-001',
        'CMD-NORM-001',
        'EVD-NORM-001',
        'PATH-NORM-001',
        'STOP-NORM-001',
      ]);
      assert.ok(constraints.filter(({ scope }) => scope !== 'global')
        .every(({ applicableMustRefs }) => applicableMustRefs.length < ir.obligations.length));
      assert.equal(JSON.stringify(ir).includes('SRC-'), false);
      assert.deepEqual(ir.logicalScopes.forbiddenPaths, []);
      assert.equal(ir.logicalScopes.stopConditions.length, 1);
      assert.equal(ir.logicalScopes.stopConditions[0].constraintId, 'STOP-NORM-001');
      assert.equal(ir.logicalScopes.stopConditions[0].declarationRole, 'stop_condition');
      assert.deepEqual(ir.commands.map(({ commandId }) => commandId), ['CMD-NORM-001']);
      assert.deepEqual(ir.evidenceContracts.map(({ evidenceContractId }) => evidenceContractId), ['EVD-NORM-001']);
      assert.deepEqual(ir.artifacts.map(({ artifactId }) => artifactId), ['ART-NORM-001']);
      assert.deepEqual(ir.executionDomains[0].ownership.flatMap(({ basisRefs }) => basisRefs), ['PATH-NORM-001']);
      const spanIds = new Set(ir.logicalSpecSpans.map(({ specSpanId }) => specSpanId));
      assert.ok(ir.obligations.every(({ sourceRefs }) => sourceRefs.some((ref) => spanIds.has(ref))));
      assert.ok(constraints.every(({ sourceRefs }) => sourceRefs.some((ref) => spanIds.has(ref))));

      const expectLineageBlock = (mutate) => {
        const candidate = structuredClone(ir);
        mutate(candidate);
        candidate.goalExecutionIRHash = goalExecutionIRHash(candidate);
        const validation = validateGoalExecutionIR(candidate);
        assert.equal(validation.decision, 'block');
        assert.ok(validation.issueCodes.includes('goal_execution_source_lineage_invalid'));
      };
      expectLineageBlock((candidate) => { delete candidate.sourceLineage; });
      expectLineageBlock((candidate) => {
        candidate.logicalSpecSpans[0].sourceSnapshotHash = `sha256:${'0'.repeat(64)}`;
      });
      expectLineageBlock((candidate) => {
        candidate.logicalSpecSpans[0].exactTextHash = `sha256:${'1'.repeat(64)}`;
      });
      expectLineageBlock((candidate) => {
        candidate.obligations[0].sourceRefs = [
          ...candidate.obligations[0].sourceRefs,
          'SPAN-UNKNOWN',
        ];
      });
      for (const field of [
        'sourceRefs',
        'applicableSourceRefs',
        'premiseRefs',
        'sourceDeclarationRefs',
      ]) {
        expectLineageBlock((candidate) => {
          const constraint = candidate.semanticSource.typedExecutionConstraints[0];
          constraint[field] = [...(constraint[field] ?? []), 'SPAN-UNKNOWN'];
        });
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
