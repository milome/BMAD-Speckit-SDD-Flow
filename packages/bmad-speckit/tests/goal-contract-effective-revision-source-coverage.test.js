const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  buildSourceSnapshot,
} = require('../src/utils/goal-contract/dual-view-derivation.ts');
const {
  extractSourceObligations,
} = require('../src/utils/goal-contract/source-obligation-extractor.ts');
const {
  normalizeGoalContractSourceCoverageMappings,
  verifyGoalContractGeneratorHardeningProvenance,
} = require('../src/utils/goal-contract/control-plane/goal-contract-compiler.ts');
const {
  buildSlotData,
} = require('../src/utils/goal-contract/slot-data-builder.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SOURCE_PATH =
  'packages/bmad-speckit/tests/fixtures/goal-contract-effective-revision-source.md';
const PROFILE_PATH = path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-profile.json'
);
const REQUIREMENT_IDS = Array.from(
  { length: 11 },
  (_, index) => `GH-R${String(index + 1).padStart(2, '0')}`
);
const CORRECTION_IDS = Array.from(
  { length: 4 },
  (_, index) => `ER-GH-${String(index + 1).padStart(3, '0')}`
);
const TASK_IDS = Array.from(
  { length: 11 },
  (_, index) => `GH-T${String(index + 1).padStart(2, '0')}`
);
const SOURCE_TEXT = [
  '# Goal Contract Generator Hardening Effective Revision',
  '',
  '## Canonical Requirements',
  '',
  ...REQUIREMENT_IDS.flatMap((id) => [
    `### ${id}: Deterministic requirement`,
    '',
    `${id} MUST retain deterministic task, acceptance, command, evidence, and stop authority.`,
    '',
  ]),
  '## Effective Corrections',
  '',
  ...CORRECTION_IDS.flatMap((id) => [
    `### ${id}: Deterministic correction`,
    '',
    `${id} MUST remain a distinct governed correction.`,
    '',
  ]),
  '## Task Dependency Chain',
  '',
  TASK_IDS.join(' -> '),
  '',
  '## Implementation Tasks',
  '',
  ...TASK_IDS.flatMap((id) => [
    `### ${id}: Deterministic task`,
    '',
    ...(id === 'GH-T10'
      ? [
          'Steps: run package build and host projection commands; validate the required',
          'encoding gate.',
          '',
          'Acceptance: only registered projections change; all declared commands exit',
          'zero with nonzero test counts.',
        ]
      : [
          `Steps: execute ${id} with deterministic inputs and outputs.`,
          '',
          `Acceptance: ${id} preserves acceptance, command, and evidence coverage.`,
        ]),
    '',
  ]),
].join('\n');
const SOURCE_BYTES = Buffer.from(SOURCE_TEXT, 'utf8');
const BASELINE_COMMIT = '3b7af1e3a6ddbe664ac62f097838130bcf856430';
const PREDECESSOR_PATHS = [
  'packages/bmad-speckit/tests/goal-contract-compiler.test.js',
  'packages/bmad-speckit/tests/goal-contract-release-gate.test.js',
  'packages/bmad-speckit/tests/goal-contract-partition-command.test.js',
  'packages/bmad-speckit/tests/goal-contract-source-obligation-extractor.test.js',
];
const RUNTIME_ACTION_PATHS = [
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-package-runtime-action-binding-manifest.schema.json',
  '_bmad/shared/goal-contract/goal-contract-profile.json',
  'packages/bmad-speckit/src/utils/goal-contract/source-obligation-extractor.ts',
  'packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-contract-compiler.ts',
  'packages/bmad-speckit/src/utils/goal-contract/slot-data-builder.ts',
];

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function repositoryBinding(relativePath) {
  return {
    path: relativePath,
    hash: sha256(fs.readFileSync(path.join(REPO_ROOT, ...relativePath.split('/')))),
  };
}

function provenanceFixture() {
  return {
    schemaVersion: 'goal-contract-generator-hardening-provenance/v1',
    baselineCommit: BASELINE_COMMIT,
    successorSource: repositoryBinding(
      'packages/bmad-speckit/tests/goal-contract-effective-revision-source-coverage.test.js'
    ),
    successorGoalContract: repositoryBinding(
      '_bmad/shared/goal-contract/goal-contract-profile.json'
    ),
    predecessorInputs: PREDECESSOR_PATHS.map(repositoryBinding),
    judgeBoundary: {
      policy: 'byte_and_behavior_conserved',
      runtimeActionBindings: RUNTIME_ACTION_PATHS.map(repositoryBinding),
    },
  };
}

describe('generator hardening effective revision source coverage', () => {
  it('materializes every frozen requirement, correction, task, and task dependency', () => {
    const sourceBytes = SOURCE_BYTES;

    const extracted = extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: SOURCE_PATH,
        rawBytes: sourceBytes,
      }),
    });
    const declaredIds = extracted.sourceObligations
      .filter((obligation) => obligation.declaredId)
      .map((obligation) => obligation.id);
    for (const declaredId of [
      ...REQUIREMENT_IDS,
      ...CORRECTION_IDS,
      ...TASK_IDS,
    ]) {
      assert.equal(
        declaredIds.filter((candidate) => candidate === declaredId).length,
        1,
        `${declaredId} must be materialized exactly once`
      );
    }

    const dependencies = Object.fromEntries(
      extracted.sourceObligations
        .filter((obligation) => TASK_IDS.includes(obligation.id))
        .map((obligation) => [obligation.id, obligation.dependencyRefs])
    );
    assert.deepEqual(dependencies, {
      'GH-T01': [],
      'GH-T02': ['GH-T01'],
      'GH-T03': ['GH-T02'],
      'GH-T04': ['GH-T03'],
      'GH-T05': ['GH-T04'],
      'GH-T06': ['GH-T05'],
      'GH-T07': ['GH-T06'],
      'GH-T08': ['GH-T07'],
      'GH-T09': ['GH-T08'],
      'GH-T10': ['GH-T09'],
      'GH-T11': ['GH-T10'],
    });

    for (const taskId of TASK_IDS) {
      const steps = extracted.sourceObligations.find(
        (obligation) =>
          obligation.exactText.startsWith('Steps:') &&
          obligation.lineStart > 0 &&
          obligation.headingPath.some((heading) =>
            heading.includes(taskId)
          )
      );
      assert.ok(steps, `${taskId} must retain its Steps paragraph`);
      assert.ok(
        steps.lineEnd >= steps.lineStart,
        `${taskId} Steps must retain a valid source span`
      );
      assert.equal(
        steps.exactText.startsWith('Steps:'),
        true,
        `${taskId} Steps must retain its normative label`
      );
    }

    const ghT10Steps = extracted.sourceObligations.find(
      (obligation) =>
        obligation.headingPath.some((heading) => heading.includes('GH-T10')) &&
        obligation.exactText.startsWith('Steps:')
    );
    const ghT10Acceptance = extracted.sourceObligations.find(
      (obligation) =>
        obligation.headingPath.some((heading) => heading.includes('GH-T10')) &&
        obligation.exactText.startsWith(
          'Acceptance: only registered projections change'
        )
    );
    assert.equal(ghT10Steps.lineEnd, ghT10Steps.lineStart + 1);
    assert.match(ghT10Steps.exactText, /encoding gate\.$/u);
    assert.equal(ghT10Acceptance.lineEnd, ghT10Acceptance.lineStart + 1);
    assert.equal(
      ghT10Acceptance.exactText,
      [
        'Acceptance: only registered projections change; all declared commands exit',
        'zero with nonzero test counts.',
      ].join('\n')
    );
  });

  it('maps every GH-R and ER obligation to task, acceptance, command, evidence, and stop authority', () => {
    const sourceBytes = SOURCE_BYTES;
    const sourceHash = sha256(sourceBytes);
    const extracted = extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: SOURCE_PATH,
        rawBytes: sourceBytes,
      }),
    });
    const built = buildSlotData({
      source: {
        sourcePlanPath: SOURCE_PATH.replace(/\\/gu, '/'),
        sourcePlanHash: sourceHash,
        sourceBytes: sourceBytes.length,
        sourceLines: sourceBytes.toString('utf8').split(/\r?\n/u).length,
        sourceObligations: normalizeGoalContractSourceCoverageMappings(
          extracted.sourceObligations
        ),
      },
      profile: JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8')),
      outPath: 'docs/plans/effective-revision-test-goal.md',
      coverageReceiptPath:
        'docs/plans/.effective-revision-test-goal.coverage.json',
      generationReceiptPath:
        'docs/plans/.effective-revision-test-goal.generation.json',
      generatedAt: '1970-01-01T00:00:00.000Z',
    });
    const requiredRows = normalizeGoalContractSourceCoverageMappings(
      built.registries.sourceObligations
    ).filter(({ id }) => /^(?:GH-R\d{2}|ER-GH-\d{3})$/u.test(id));
    const expectedTaskAuthority = {
      'GH-R01': ['GH-T01', 'GH-T02'],
      'GH-R02': ['GH-T03'],
      'GH-R03': ['GH-T04'],
      'GH-R04': ['GH-T05'],
      'GH-R05': ['GH-T05'],
      'GH-R06': ['GH-T09'],
      'GH-R07': ['GH-T06'],
      'GH-R08': ['GH-T07', 'GH-T08'],
      'GH-R09': ['GH-T08'],
      'GH-R10': ['GH-T08', 'GH-T10'],
      'GH-R11': ['GH-T10', 'GH-T11'],
      'ER-GH-001': ['GH-T05'],
      'ER-GH-002': ['GH-T09'],
      'ER-GH-003': ['GH-T06', 'GH-T07'],
      'ER-GH-004': ['GH-T08'],
    };

    assert.equal(requiredRows.length, 15);
    for (const row of requiredRows) {
      assert.deepEqual(row.goalTaskRefs, expectedTaskAuthority[row.id], row.id);
      for (const field of [
        'acceptanceRefs',
        'commandRefs',
        'evidenceRefs',
        'stopConditionRefs',
      ]) {
        assert.ok(row[field].length > 0, `${row.id} missing ${field}`);
      }
    }
  });

  it('binds predecessor, merge-plan, baseline commit, and Judge boundary provenance', () => {
    const provenance = provenanceFixture();
    assert.equal(
      provenance.schemaVersion,
      'goal-contract-generator-hardening-provenance/v1'
    );
    assert.equal(provenance.baselineCommit, BASELINE_COMMIT);
    assert.equal(provenance.predecessorInputs.length, PREDECESSOR_PATHS.length);
    assert.equal(provenance.judgeBoundary.policy, 'byte_and_behavior_conserved');
    assert.equal(
      provenance.judgeBoundary.runtimeActionBindings.length,
      RUNTIME_ACTION_PATHS.length
    );
    for (const binding of provenance.judgeBoundary.runtimeActionBindings) {
      const target = path.join(REPO_ROOT, ...binding.path.split('/'));
      assert.equal(sha256(fs.readFileSync(target)), binding.hash, binding.path);
    }
    assert.equal(
      verifyGoalContractGeneratorHardeningProvenance({
        provenance,
        repositoryRoot: REPO_ROOT,
        baselineCommit: BASELINE_COMMIT,
      }).decision,
      'pass'
    );
    const stale = structuredClone(provenance);
    stale.predecessorInputs[0].hash = `sha256:${'f'.repeat(64)}`;
    assert.throws(
      () =>
        verifyGoalContractGeneratorHardeningProvenance({
          provenance: stale,
          repositoryRoot: REPO_ROOT,
          baselineCommit: BASELINE_COMMIT,
        }),
      (error) =>
        error.failureClass === 'predecessor_provenance_mismatch' &&
        error.path === stale.predecessorInputs[0].path
    );
  });
});
