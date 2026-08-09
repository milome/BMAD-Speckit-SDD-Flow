import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  buildSixModelCiDiagnostics,
  buildSixModelPlanningDiagnostics,
  renderSixModelCiDiagnosticsMarkdown,
  validateSixModelCiDiagnostics,
} = require('../../tools/ci/build-six-model-ci-diagnostics.cjs');

function semanticIndex() {
  const tests = [
    {
      identityKey: 'vitest::tests/audit.test.ts',
      lane: 'core',
      shardId: 'core-01',
      modelRefs: ['audit_review'],
      obligationRefs: ['audit_review/fail_closed'],
      transitionRefs: ['fail_closed'],
      targetRefs: ['src/audit.ts'],
      changedPaths: ['src/audit.ts'],
    },
    {
      identityKey: 'vitest::tests/shared.test.ts',
      lane: 'core',
      shardId: 'core-01',
      modelRefs: ['audit_review', 'execution_closure'],
      obligationRefs: ['audit_review/evidence_binding', 'execution_closure/evidence_binding'],
      transitionRefs: ['evidence_binding'],
      targetRefs: ['src/shared.ts'],
      changedPaths: [],
    },
    {
      identityKey: 'vitest::tests/general.test.ts',
      lane: 'feature',
      shardId: 'feature-01',
      modelRefs: [],
      obligationRefs: [],
      transitionRefs: [],
      targetRefs: ['src/general.ts'],
      changedPaths: [],
    },
  ];
  const body = {
    schemaVersion: 'ci-shard-semantic-index/v1',
    selectionHash: `sha256:${'1'.repeat(64)}`,
    shardPlanHash: `sha256:${'2'.repeat(64)}`,
    coverageReportHash: `sha256:${'3'.repeat(64)}`,
    catalogHash: `sha256:${'4'.repeat(64)}`,
    changedPathsHash: `sha256:${'5'.repeat(64)}`,
    uncoveredObligationRefs: ['delivery_confirmation/record_closed_final_transition'],
    obligationBindings: [
      {
        obligationId: 'audit_review/evidence_binding',
        modelRef: 'audit_review',
        transitionRef: 'evidence_binding',
      },
      {
        obligationId: 'audit_review/fail_closed',
        modelRef: 'audit_review',
        transitionRef: 'fail_closed',
      },
      {
        obligationId: 'delivery_confirmation/record_closed_final_transition',
        modelRef: 'delivery_confirmation',
        transitionRef: 'record_closed_final_transition',
      },
      {
        obligationId: 'execution_closure/evidence_binding',
        modelRef: 'execution_closure',
        transitionRef: 'evidence_binding',
      },
    ],
    tests,
    shards: [
      {
        lane: 'core',
        shardId: 'core-01',
        testCount: 2,
        identityKeys: ['vitest::tests/audit.test.ts', 'vitest::tests/shared.test.ts'],
        modelRefs: ['audit_review', 'execution_closure'],
        obligationRefs: [
          'audit_review/evidence_binding',
          'audit_review/fail_closed',
          'execution_closure/evidence_binding',
        ],
        transitionRefs: ['evidence_binding', 'fail_closed'],
        modelCoverage: {
          audit_review: { testCount: 2, obligationCount: 2 },
          execution_closure: { testCount: 1, obligationCount: 1 },
        },
      },
      {
        lane: 'feature',
        shardId: 'feature-01',
        testCount: 1,
        identityKeys: ['vitest::tests/general.test.ts'],
        modelRefs: [],
        obligationRefs: [],
        transitionRefs: [],
        modelCoverage: {},
      },
    ],
  };
  return { ...body, semanticIndexHash: sha256Bytes(canonicalJsonBytes(body)) };
}

function laneResults() {
  return [
    {
      lane: 'core',
      shardId: 'core-01',
      outcome: 'expected_failed',
      executedIdentityKeys: ['vitest::tests/audit.test.ts', 'vitest::tests/shared.test.ts'],
      failedIdentityKeys: ['vitest::tests/audit.test.ts'],
      junitPath: '.artifacts/test-portfolio/lane-results/core-01.junit.xml',
    },
    {
      lane: 'feature',
      shardId: 'feature-01',
      outcome: 'passed',
      executedIdentityKeys: ['vitest::tests/general.test.ts'],
      junitPath: '.artifacts/test-portfolio/lane-results/feature-01.junit.xml',
    },
  ];
}

function statusSnapshot(
  effectiveStatus = 'blocked',
  currentMentalModel = 'audit_review',
  attemptId = 'attempt-7'
) {
  const body = {
    schemaVersion: 'ci-six-model-runtime-status-snapshot/v1',
    recordId: 'record-1',
    attemptId,
    currentMentalModel,
    effectiveStatus,
    sourceDocumentHash: `sha256:${'a'.repeat(64)}`,
    implementationConfirmationHash: `sha256:${'b'.repeat(64)}`,
    semanticModelHash: `sha256:${'c'.repeat(64)}`,
  };
  return { ...body, statusSnapshotHash: sha256Bytes(canonicalJsonBytes(body)) };
}

function expectedAuthorityHashes() {
  return {
    sourceDocumentHash: `sha256:${'a'.repeat(64)}`,
    implementationConfirmationHash: `sha256:${'b'.repeat(64)}`,
    semanticModelHash: `sha256:${'c'.repeat(64)}`,
  };
}

const laneResultRefs = {
  'core\0core-01': '.artifacts/test-portfolio/lane-results/core-01.result.json',
  'feature\0feature-01': '.artifacts/test-portfolio/lane-results/feature-01.result.json',
};

describe('six-model CI diagnostics', () => {
  it('renders blocked planning evidence without claiming tests ran', () => {
    const report = buildSixModelPlanningDiagnostics({ semanticIndex: semanticIndex() });
    const outcomes = report.models.flatMap((model: any) =>
      model.obligations.flatMap((obligation: any) =>
        obligation.shards.flatMap((shard: any) => shard.tests.map((test: any) => test.outcome))
      )
    );

    expect(new Set(outcomes)).toEqual(new Set(['not_run']));
    expect(report.failures).toEqual([]);
    expect(report.uncoveredObligationRefs).toEqual([
      'delivery_confirmation/record_closed_final_transition',
    ]);
  });

  it('projects deterministic model-obligation-shard-test results and failures', () => {
    const first = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
    });
    const secondResults = laneResults().reverse();
    const second = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: secondResults,
      laneResultRefs,
    });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(first.statusProjection).toEqual({
      status: 'unavailable',
      reasonCodes: ['status_projection_unavailable'],
    });
    expect(first.failures).toHaveLength(1);
    expect(first.failures[0]).toMatchObject({
      lane: 'core',
      shardId: 'core-01',
      identityKey: 'vitest::tests/audit.test.ts',
      modelRefs: ['audit_review'],
      obligationRefs: ['audit_review/fail_closed'],
      transitionRefs: ['fail_closed'],
      outcome: 'expected_failed',
      logRef: '.artifacts/test-portfolio/lane-results/core-01.junit.xml',
      targetRefs: ['src/audit.ts'],
      changedPaths: ['src/audit.ts'],
    });
    expect(first.failures[0].failureFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.uncoveredObligationRefs).toEqual([
      'delivery_confirmation/record_closed_final_transition',
    ]);
    expect(first.summary.uncoveredObligationCount).toBe(1);
    expect(first.models[0]).toMatchObject({
      modelId: 'audit_review',
      obligations: expect.arrayContaining([
        expect.objectContaining({
          obligationId: 'audit_review/fail_closed',
          transitionRef: 'fail_closed',
          shards: [
            expect.objectContaining({
              lane: 'core',
              shardId: 'core-01',
              tests: [
                expect.objectContaining({
                  identityKey: 'vitest::tests/audit.test.ts',
                  outcome: 'expected_failed',
                }),
              ],
            }),
          ],
        }),
      ]),
    });
    expect(validateSixModelCiDiagnostics(first)).toEqual(first);
  });

  it('reports unattributed infrastructure failure without blaming every shard test', () => {
    const results = laneResults();
    results[1].outcome = 'failed';
    results[1].evidenceStatus = { junit: 'missing', timing: 'partial' };
    const report = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: results,
      laneResultRefs,
    });

    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lane: 'feature',
          shardId: 'feature-01',
          identityKey: null,
          modelRefs: [],
          obligationRefs: [],
          outcome: 'failed',
          logRef: '.artifacts/test-portfolio/lane-results/feature-01.result.json',
        }),
      ])
    );
    expect(report.summary.unattributedFailureCount).toBe(1);
  });

  it('reports a planned identity omitted by a passing lane as missing', () => {
    const results = laneResults();
    results[0].executedIdentityKeys = ['vitest::tests/shared.test.ts'];
    const report = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: results,
      laneResultRefs,
    });

    expect(report.failures).toContainEqual(
      expect.objectContaining({
        identityKey: 'vitest::tests/audit.test.ts',
        outcome: 'missing',
        modelRefs: ['audit_review'],
      })
    );
  });

  it('projects journey obligations through explicit model and transition bindings', () => {
    const index = semanticIndex();
    index.tests[0].obligationRefs = ['journey/audit-rejection-path'];
    index.tests[0].transitionRefs = ['authority_rejection'];
    index.shards[0].obligationRefs = [
      'audit_review/evidence_binding',
      'execution_closure/evidence_binding',
      'journey/audit-rejection-path',
    ];
    index.shards[0].transitionRefs = ['authority_rejection', 'evidence_binding'];
    index.obligationBindings = index.obligationBindings.filter(
      (binding: any) => binding.obligationId !== 'audit_review/fail_closed'
    );
    index.obligationBindings.push({
      obligationId: 'journey/audit-rejection-path',
      modelRef: 'audit_review',
      transitionRef: 'authority_rejection',
    });
    index.obligationBindings.sort((left: any, right: any) =>
      left.obligationId.localeCompare(right.obligationId, 'en')
    );
    const { semanticIndexHash: _oldHash, ...body } = index;
    index.semanticIndexHash = sha256Bytes(canonicalJsonBytes(body));

    const report = buildSixModelCiDiagnostics({
      semanticIndex: index,
      laneResults: laneResults(),
      laneResultRefs,
      statusSnapshot: statusSnapshot('blocked'),
      expectedAttemptId: 'attempt-7',
      expectedAuthorityHashes: {
        sourceDocumentHash: `sha256:${'a'.repeat(64)}`,
        implementationConfirmationHash: `sha256:${'b'.repeat(64)}`,
        semanticModelHash: `sha256:${'c'.repeat(64)}`,
      },
    });

    expect(report.models[0].obligations).toContainEqual(
      expect.objectContaining({
        obligationId: 'journey/audit-rejection-path',
        transitionRef: 'authority_rejection',
      })
    );
    expect(report.failures[0].diagnosticPriority).toBe('high');
  });

  it('renders a stable high-signal Markdown summary', () => {
    const report = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
    });
    const markdown = renderSixModelCiDiagnosticsMarkdown(report);

    expect(markdown).toContain('# Six-Model CI Diagnostics');
    expect(markdown).toContain('audit_review');
    expect(markdown).toContain('audit_review/fail_closed');
    expect(markdown).toContain('core/core-01');
    expect(markdown).toContain('vitest::tests/audit.test.ts');
    expect(markdown).toContain(report.failures[0].failureFingerprint);
    expect(markdown).toContain('delivery_confirmation/record_closed_final_transition');
    expect(markdown).not.toContain('src/shared.ts');
  });

  it.each([
    ['not_established', ['applicability_or_not_applicable', 'state_entry']],
    ['blocked', ['authority_rejection', 'fail_closed']],
    ['stale', ['invalidation', 'reconfirmation', 'stale_evidence_rejection']],
    ['pass', ['evidence_binding', 'successful_promotion']],
    ['awaiting_user_acceptance', ['delivery_confirmation', 'record_closed_final_transition']],
  ])('projects %s behavior priority without changing execution evidence', (status, behaviors) => {
    const withoutStatus = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
    });
    const withStatus = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
      statusSnapshot: statusSnapshot(status),
      expectedAttemptId: 'attempt-7',
      expectedAuthorityHashes: expectedAuthorityHashes(),
    });

    expect(withStatus.statusProjection).toMatchObject({
      status: 'applied',
      recordId: 'record-1',
      attemptId: 'attempt-7',
      currentMentalModel: 'audit_review',
      effectiveStatus: status,
      expectedBehaviorRefs: behaviors,
    });
    expect(
      withStatus.failures.map(({ diagnosticPriority: _priority, ...failure }: any) => failure)
    ).toEqual(
      withoutStatus.failures.map(({ diagnosticPriority: _priority, ...failure }: any) => failure)
    );
    expect(withStatus.failures[0].diagnosticPriority).toBe(status === 'blocked' ? 'high' : 'model');
  });

  it('rejects stale attempts and tampered snapshots without applying their priority', () => {
    const stale = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
      statusSnapshot: statusSnapshot('blocked', 'audit_review', 'attempt-old'),
      expectedAttemptId: 'attempt-current',
    });
    expect(stale.statusProjection).toEqual({
      status: 'stale',
      reasonCodes: ['status_projection_stale'],
    });
    expect(stale.failures[0].diagnosticPriority).toBe('normal');

    const tamperedSnapshot = statusSnapshot();
    tamperedSnapshot.currentMentalModel = 'execution_closure';
    const invalid = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
      statusSnapshot: tamperedSnapshot,
      expectedAttemptId: 'attempt-7',
    });
    expect(invalid.statusProjection).toEqual({
      status: 'unavailable',
      reasonCodes: ['status_projection_invalid'],
    });
    expect(invalid.failures[0].diagnosticPriority).toBe('normal');
  });

  it('rejects a same-attempt snapshot when any authority hash is stale', () => {
    const expectedHashes = expectedAuthorityHashes();
    expectedHashes.semanticModelHash = `sha256:${'d'.repeat(64)}`;
    const report = buildSixModelCiDiagnostics({
      semanticIndex: semanticIndex(),
      laneResults: laneResults(),
      laneResultRefs,
      statusSnapshot: statusSnapshot(),
      expectedAttemptId: 'attempt-7',
      expectedAuthorityHashes: expectedHashes,
    });

    expect(report.statusProjection).toEqual({
      status: 'stale',
      reasonCodes: ['status_projection_stale'],
    });
    expect(report.failures[0].diagnosticPriority).toBe('normal');
  });
});
