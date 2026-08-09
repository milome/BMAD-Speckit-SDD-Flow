import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const manifestInput = require('../fixtures/test-portfolio/run-manifest-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { createRunManifestPlan } = require('../../tools/ci/write-ci-run-manifest.cjs');
const {
  buildShardSemanticIndex,
  validateShardSemanticIndex,
} = require('../../tools/ci/build-shard-semantic-index.cjs');

const COVERAGE_ROWS = [
  {
    obligationId: 'audit_review/fail_closed',
    model: 'audit_review',
    transition: 'fail_closed',
  },
  {
    obligationId: 'requirement_confirmation/state_entry',
    model: 'requirement_confirmation',
    transition: 'state_entry',
  },
];

function rehashPlan(plan: any) {
  plan.selectionHash = sha256Bytes(canonicalJsonBytes(plan.selection));
  const { shardPlanHash: _oldHash, ...body } = plan;
  plan.shardPlanHash = sha256Bytes(canonicalJsonBytes(body));
  return plan;
}

function fixture() {
  const coverageReport = {
    schemaVersion: 'six-model-coverage-gap-report/v1',
    obligations: structuredClone(COVERAGE_ROWS),
  };
  const selection = structuredClone(manifestInput.shardPlan.selection);
  selection.coverageReportHash = sha256Bytes(canonicalJsonBytes(coverageReport));
  selection.selected[0].coveredObligationIds = [
    'audit_review/fail_closed',
    'requirement_confirmation/state_entry',
  ];
  selection.selected[1].coveredObligationIds = ['audit_review/fail_closed'];
  const shardPlan = buildShardPlan({
    selection,
    timingSummary: manifestInput.timingSummary,
    policy: manifestInput.policy,
    expectedCommitSha: manifestInput.repository.commitSha,
    expectedEnvironmentClass: manifestInput.shardPlan.timingBinding.expectedEnvironmentClass,
  });
  const catalog = {
    schemaVersion: 'test-catalog/v1',
    tests: selection.selected.map((item: any, index: number) => ({
      identityKey: item.identityKey,
      executableIdentity: item.identityKey,
      testPath: item.testPath,
      targetRefs: index === 0 ? ['src/requirement.ts'] : ['src/shared.ts'],
    })),
  };
  return {
    selection,
    shardPlan,
    coverageReport,
    catalog,
    changedPaths: ['src/requirement.ts'],
  };
}

function executionProjection(input: ReturnType<typeof fixture>) {
  const manifest = createRunManifestPlan({
    ...manifestInput,
    selectionHash: input.shardPlan.selectionHash,
    shardPlan: input.shardPlan,
  });
  return {
    selected: input.selection.selected.map(({ identityKey, lane }: any) => ({
      identityKey,
      lane,
    })),
    shards: input.shardPlan.shards.map(({ lane, shardId, identityKeys }: any) => ({
      lane,
      shardId,
      identityKeys: [...identityKeys],
    })),
    matrix: structuredClone(manifest.matrix),
    shardPlanHash: input.shardPlan.shardPlanHash,
  };
}

describe('deterministic CI shard semantic index', () => {
  it('derives canonical multi-model coverage without changing execution membership', () => {
    const input = fixture();
    const first = buildShardSemanticIndex(input);
    const second = buildShardSemanticIndex(structuredClone(input));

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(first).toMatchObject({
      schemaVersion: 'ci-shard-semantic-index/v1',
      selectionHash: input.shardPlan.selectionHash,
      shardPlanHash: input.shardPlan.shardPlanHash,
      coverageReportHash: input.selection.coverageReportHash,
    });
    expect(first.tests).toHaveLength(input.selection.selected.length);
    expect(first.tests[0]).toMatchObject({
      identityKey: 'vitest::tests/core-a.test.ts',
      modelRefs: ['audit_review', 'requirement_confirmation'],
      obligationRefs: ['audit_review/fail_closed', 'requirement_confirmation/state_entry'],
      transitionRefs: ['fail_closed', 'state_entry'],
      targetRefs: ['src/requirement.ts'],
      changedPaths: ['src/requirement.ts'],
    });
    expect(first.shards.flatMap((shard: any) => shard.identityKeys)).toEqual(
      input.shardPlan.shards.flatMap((shard: any) => shard.identityKeys)
    );
    expect(first.shards[0].modelCoverage).toMatchObject({
      audit_review: { testCount: 1, obligationCount: 1 },
      requirement_confirmation: { testCount: 1, obligationCount: 1 },
    });
    expect(validateShardSemanticIndex(first, input)).toEqual(first);
  });

  it('leaves selection, shard allocation, matrix, and shardPlanHash unchanged', () => {
    const input = fixture();
    const before = executionProjection(input);

    buildShardSemanticIndex(input);

    expect(executionProjection(input)).toStrictEqual(before);
  });

  it('carries validated uncovered obligations for diagnostics', () => {
    const input = fixture();
    input.coverageReport.obligations.push({
      obligationId: 'delivery_confirmation/record_closed_final_transition',
      model: 'delivery_confirmation',
      transition: 'record_closed_final_transition',
    });
    input.selection.selectionStatus = 'blocked';
    input.selection.blockingGapCount = 1;
    input.selection.uncoveredObligationIds = [
      'delivery_confirmation/record_closed_final_transition',
    ];
    input.selection.coverageReportHash = sha256Bytes(canonicalJsonBytes(input.coverageReport));
    input.shardPlan = buildShardPlan({
      selection: input.selection,
      timingSummary: manifestInput.timingSummary,
      policy: manifestInput.policy,
      expectedCommitSha: manifestInput.repository.commitSha,
      expectedEnvironmentClass: manifestInput.shardPlan.timingBinding.expectedEnvironmentClass,
    });

    expect(buildShardSemanticIndex(input).uncoveredObligationRefs).toEqual([
      'delivery_confirmation/record_closed_final_transition',
    ]);
  });

  it('preserves explicit model and transition bindings for journey obligations', () => {
    const input = fixture();
    input.coverageReport.obligations.push({
      obligationId: 'journey/audit-rejection-path',
      model: 'audit_review',
      transition: 'authority_rejection',
    });
    input.selection.selected[0].coveredObligationIds.push('journey/audit-rejection-path');
    input.selection.selected[0].coveredObligationIds.sort();
    input.selection.coverageReportHash = sha256Bytes(canonicalJsonBytes(input.coverageReport));
    input.shardPlan = buildShardPlan({
      selection: input.selection,
      timingSummary: manifestInput.timingSummary,
      policy: manifestInput.policy,
      expectedCommitSha: manifestInput.repository.commitSha,
      expectedEnvironmentClass: manifestInput.shardPlan.timingBinding.expectedEnvironmentClass,
    });

    expect(buildShardSemanticIndex(input).obligationBindings).toContainEqual({
      obligationId: 'journey/audit-rejection-path',
      modelRef: 'audit_review',
      transitionRef: 'authority_rejection',
    });
  });

  it('rejects unknown and duplicate shard identities', () => {
    const unknown = fixture();
    unknown.shardPlan.shards[0].identityKeys[0] = 'vitest::tests/unknown.test.ts';
    rehashPlan(unknown.shardPlan);
    expect(() => buildShardSemanticIndex(unknown)).toThrow('CI_SEMANTIC_INDEX_UNKNOWN_IDENTITY');

    const duplicate = fixture();
    duplicate.shardPlan.shards[1].identityKeys.push(duplicate.shardPlan.shards[0].identityKeys[0]);
    duplicate.shardPlan.shards[1].identityKeys.sort();
    rehashPlan(duplicate.shardPlan);
    expect(() => buildShardSemanticIndex(duplicate)).toThrow(
      'CI_SEMANTIC_INDEX_DUPLICATE_IDENTITY'
    );

    const omitted = fixture();
    omitted.shardPlan.shards[0].identityKeys.shift();
    rehashPlan(omitted.shardPlan);
    expect(() => buildShardSemanticIndex(omitted)).toThrow('CI_SEMANTIC_INDEX_IDENTITY_OMITTED');
  });

  it('rejects obligations that do not exist in the coverage report', () => {
    const input = fixture();
    input.selection.selected[0].coveredObligationIds = ['audit_review/not_declared'];
    input.shardPlan.selection = structuredClone(input.selection);
    rehashPlan(input.shardPlan);

    expect(() => buildShardSemanticIndex(input)).toThrow('CI_SEMANTIC_INDEX_OBLIGATION_UNKNOWN');

    const uncovered = fixture();
    uncovered.selection.selectionStatus = 'blocked';
    uncovered.selection.blockingGapCount = 1;
    uncovered.selection.uncoveredObligationIds = ['audit_review/not_declared'];
    uncovered.shardPlan.selection = structuredClone(uncovered.selection);
    rehashPlan(uncovered.shardPlan);
    expect(() => buildShardSemanticIndex(uncovered)).toThrow(
      'CI_SEMANTIC_INDEX_OBLIGATION_UNKNOWN'
    );
  });

  it('rejects selection, coverage, and derived-index hash mismatches', () => {
    const shardPlanMismatch = fixture();
    shardPlanMismatch.shardPlan.shardPlanHash = `sha256:${'0'.repeat(64)}`;
    expect(() => buildShardSemanticIndex(shardPlanMismatch)).toThrow(
      'CI_SEMANTIC_INDEX_SHARD_PLAN_HASH_MISMATCH'
    );

    const selectionMismatch = fixture();
    selectionMismatch.selection.selected[0].lane = 'feature';
    expect(() => buildShardSemanticIndex(selectionMismatch)).toThrow(
      'CI_SEMANTIC_INDEX_SELECTION_MISMATCH'
    );

    const coverageMismatch = fixture();
    coverageMismatch.coverageReport.obligations[0].transition = 'changed';
    expect(() => buildShardSemanticIndex(coverageMismatch)).toThrow(
      'CI_SEMANTIC_INDEX_COVERAGE_HASH_MISMATCH'
    );

    const validInput = fixture();
    const tampered = buildShardSemanticIndex(validInput);
    tampered.shards[0].modelRefs = [];
    expect(() => validateShardSemanticIndex(tampered, validInput)).toThrow(
      'CI_SEMANTIC_INDEX_DERIVATION_MISMATCH'
    );
  });
});
