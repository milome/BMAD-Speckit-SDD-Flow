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
const SOURCE_PATH = path.join(
  REPO_ROOT,
  'docs',
  'plans',
  '2026-08-01-goal-contract-generator-hardening-effective-revision-source-plan.md'
);
const EXPECTED_SOURCE_HASH =
  'sha256:fa8300f3cd19ff8d4a25f37472dd988db790135e44929d5716fb046aea4dc645';
const PROFILE_PATH = path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-profile.json'
);
const PROVENANCE_PATH = path.join(
  REPO_ROOT,
  'docs',
  'plans',
  '2026-08-01-goal-contract-generator-hardening-effective-revision-provenance.json'
);

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

describe('generator hardening effective revision source coverage', () => {
  it('materializes every frozen requirement, correction, task, and task dependency', () => {
    const sourceBytes = fs.readFileSync(SOURCE_PATH);
    assert.equal(sha256(sourceBytes), EXPECTED_SOURCE_HASH);

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
    const expectedRequirementIds = Array.from(
      { length: 11 },
      (_, index) => `GH-R${String(index + 1).padStart(2, '0')}`
    );
    const expectedTaskIds = Array.from(
      { length: 11 },
      (_, index) => `GH-T${String(index + 1).padStart(2, '0')}`
    );
    const expectedCorrectionIds = [
      'ER-GH-001',
      'ER-GH-002',
      'ER-GH-003',
      'ER-GH-004',
    ];

    for (const declaredId of [
      ...expectedRequirementIds,
      ...expectedCorrectionIds,
      ...expectedTaskIds,
    ]) {
      assert.equal(
        declaredIds.filter((candidate) => candidate === declaredId).length,
        1,
        `${declaredId} must be materialized exactly once`
      );
    }

    const dependencies = Object.fromEntries(
      extracted.sourceObligations
        .filter((obligation) => expectedTaskIds.includes(obligation.id))
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

    for (const taskId of expectedTaskIds) {
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
        obligation.lineStart === 733 &&
        obligation.exactText.startsWith('Steps:')
    );
    const ghT10Acceptance = extracted.sourceObligations.find(
      (obligation) =>
        obligation.lineStart === 738 &&
        obligation.exactText.startsWith(
          'Acceptance: only registered projections change'
        )
    );
    assert.equal(ghT10Steps.lineEnd, 736);
    assert.match(ghT10Steps.exactText, /encoding gate\.$/u);
    assert.equal(ghT10Acceptance.lineEnd, 739);
    assert.equal(
      ghT10Acceptance.exactText,
      [
        'Acceptance: only registered projections change; p25 binding projections remain',
        'semantically conserved; all declared commands exit zero with nonzero test counts.',
      ].join('\n')
    );
  });

  it('maps every GH-R and ER obligation to task, acceptance, command, evidence, and stop authority', () => {
    const sourceBytes = fs.readFileSync(SOURCE_PATH);
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
    const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
    assert.equal(
      provenance.schemaVersion,
      'goal-contract-generator-hardening-provenance/v1'
    );
    assert.equal(
      provenance.baselineCommit,
      '3b7af1e3a6ddbe664ac62f097838130bcf856430'
    );
    assert.equal(provenance.successorSource.hash, EXPECTED_SOURCE_HASH);
    assert.deepEqual(
      provenance.predecessorInputs.map(({ hash }) => hash),
      [
        'sha256:39a8deedd100f9f7de7840cc079ca31de87946cbd5448291397175a639b89b39',
        'sha256:94c95b9e3a1a735b6934ceb02ef1cfe6f53b6c509a35b7c289c794d3582ffb72',
        'sha256:8bf717111b186b5095226382cef6d3166494e77fc85a35a2f03c874c03fbb55b',
        'sha256:0a1a32e8bfc0f5f09903733d450604e87db73fd44f721cd714ef01ff331f5c8c',
      ]
    );
    assert.equal(provenance.judgeBoundary.policy, 'byte_and_behavior_conserved');
    assert.equal(provenance.judgeBoundary.runtimeActionBindings.length, 5);
    for (const binding of provenance.judgeBoundary.runtimeActionBindings) {
      const target = path.join(REPO_ROOT, ...binding.path.split('/'));
      assert.equal(sha256(fs.readFileSync(target)), binding.hash, binding.path);
    }
    assert.equal(
      verifyGoalContractGeneratorHardeningProvenance({
        provenance,
        repositoryRoot: REPO_ROOT,
        baselineCommit: '3b7af1e3a6ddbe664ac62f097838130bcf856430',
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
          baselineCommit: '3b7af1e3a6ddbe664ac62f097838130bcf856430',
        }),
      (error) =>
        error.failureClass === 'predecessor_provenance_mismatch' &&
        error.path === stale.predecessorInputs[0].path
    );
  });
});
