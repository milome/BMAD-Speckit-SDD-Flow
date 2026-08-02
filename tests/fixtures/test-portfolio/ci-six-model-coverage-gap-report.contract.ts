import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { canonicalJsonBytes } = require('../../../tools/test-portfolio-audit/canonical.cjs');
const {
  buildDevRemediationHandoff,
  buildProductFailureRecords,
  buildSixModelCoverageGapReport,
} = require('../../../tools/ci/generate-six-model-coverage-gap-report.cjs');

function policy() {
  return {
    semanticJourneys: [
      {
        journeyId: 'six-model-complete-record-closed',
        model: 'six_model_e2e',
        transition: 'ingress_to_record_closed',
        applicability: 'applicable',
        minimumEvidenceKind: 'direct',
        anyOfEvidenceRefs: ['trace:six-model/full-e2e/record-closed'],
        affectedTargetRefs: ['capability:six-model-state-machine', 'transition:record-closed'],
        remediationOwner: 'dev',
      },
    ],
  };
}

function coreFreeze() {
  return {
    schemaVersion: 'test-portfolio-core-freeze/v2',
    candidateEvidence: [
      {
        identityKey: 'vitest::tests/requirement.test.ts',
        obligationEvidence: {
          'requirement_confirmation/state_entry': 'direct',
        },
        obligationOracleIndependence: {},
        oracleIndependence: 'independent',
      },
    ],
    selected: [
      {
        identityKey: 'vitest::tests/requirement.test.ts',
        coveredObligationIds: ['requirement_confirmation/state_entry'],
      },
    ],
    coverage: [
      {
        obligationId: 'requirement_confirmation/state_entry',
        applicability: 'applicable',
        minimumEvidenceKind: 'indirect',
        status: 'covered',
        selectedEvidence: [
          {
            identityKey: 'vitest::tests/requirement.test.ts',
            evidenceKind: 'direct',
          },
        ],
        evidenceDiagnostics: [
          {
            identityKey: 'vitest::tests/requirement.test.ts',
            evidenceKind: 'direct',
            oracleIndependence: 'independent',
            meetsMinimumEvidenceKind: true,
            eligibleForCoverage: true,
          },
        ],
      },
    ],
    gaps: [],
    hashes: {},
  };
}

function catalog(journeyEvidence?: 'direct' | 'indirect' | 'ambiguous') {
  return {
    schemaVersion: 'test-catalog/v1',
    tests: [
      {
        identityKey: 'vitest::tests/requirement.test.ts',
        runnerId: 'vitest',
        testPath: 'tests/requirement.test.ts',
        targetRefs: ['target:requirement-record'],
        behaviorEvidence: {},
        behaviorOracleAuthority: {},
        classifications: { oracleEffectiveness: 'effective' },
      },
      ...(journeyEvidence
        ? [
            {
              identityKey: 'vitest::tests/full-e2e.test.ts',
              runnerId: 'vitest',
              testPath: 'tests/full-e2e.test.ts',
              targetRefs: ['target:record-closed'],
              behaviorEvidence: {
                'trace:six-model/full-e2e/record-closed': journeyEvidence,
              },
              behaviorOracleAuthority: {},
              classifications: { oracleEffectiveness: 'effective' },
            },
          ]
        : []),
    ],
  };
}

describe('six-model coverage gap report', () => {
  it('keeps a missing full E2E visible without erasing valid atomic coverage', () => {
    const report = buildSixModelCoverageGapReport({
      catalog: catalog(),
      coreFreeze: coreFreeze(),
      policy: policy(),
    });

    expect(report.summary).toMatchObject({
      applicableObligationCount: 2,
      effectivelyCoveredObligationCount: 1,
      ambiguousObligationCount: 0,
      missingTestObligationCount: 1,
      coverageBasisPoints: 5000,
    });
    expect(report.obligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationId: 'requirement_confirmation/state_entry',
          coverageStatus: 'covered',
          selectedTestIdentityRefs: ['vitest::tests/requirement.test.ts'],
          devHandoffRequired: false,
        }),
        expect.objectContaining({
          obligationId: 'journey/six-model-complete-record-closed',
          model: 'six_model_e2e',
          transition: 'ingress_to_record_closed',
          coverageStatus: 'missing_test',
          candidateTestIdentityRefs: [],
          gapReason: 'missing_complete_six_model_e2e',
          devHandoffRequired: true,
        }),
      ])
    );
    expect(report.gates).toEqual({
      unmappedSixModelBehaviorCount: 0,
      unmappedCriticalTransitionCount: 1,
    });
  });

  it('closes the Journey only with direct independent evidence', () => {
    const report = buildSixModelCoverageGapReport({
      catalog: catalog('direct'),
      coreFreeze: coreFreeze(),
      policy: policy(),
    });
    const journey = report.obligations.find(
      (item: { obligationId: string }) =>
        item.obligationId === 'journey/six-model-complete-record-closed'
    );

    expect(journey).toMatchObject({
      coverageStatus: 'covered',
      directEvidenceKind: 'direct',
      oracleIndependence: 'independent',
      candidateTestIdentityRefs: ['vitest::tests/full-e2e.test.ts'],
      selectedTestIdentityRefs: ['vitest::tests/full-e2e.test.ts'],
      devHandoffRequired: false,
    });
    expect(report.summary.coverageBasisPoints).toBe(10_000);
    expect(report.gates.unmappedCriticalTransitionCount).toBe(0);
  });

  it('uses obligation-scoped Oracle authority for atomic and Journey coverage', () => {
    const scopedCoreFreeze = coreFreeze();
    scopedCoreFreeze.candidateEvidence[0].oracleIndependence = 'dependent';
    scopedCoreFreeze.candidateEvidence[0].obligationOracleIndependence = {
      'requirement_confirmation/state_entry': 'independent',
    };
    const scopedCatalog = catalog('direct');
    const journeyTest = scopedCatalog.tests.find(
      (test: { identityKey: string }) => test.identityKey === 'vitest::tests/full-e2e.test.ts'
    );
    journeyTest.classifications.oracleEffectiveness = 'ineffective_candidate';
    journeyTest.behaviorOracleAuthority = {
      'trace:six-model/full-e2e/record-closed': {
        oracleIndependence: 'independent',
        evidenceRefs: ['source:tests/full-e2e.test.ts#assertion:line:10'],
      },
    };

    const report = buildSixModelCoverageGapReport({
      catalog: scopedCatalog,
      coreFreeze: scopedCoreFreeze,
      policy: policy(),
    });

    expect(
      report.obligations.find(
        (item: { obligationId: string }) =>
          item.obligationId === 'requirement_confirmation/state_entry'
      )
    ).toMatchObject({
      coverageStatus: 'covered',
      oracleIndependence: 'independent',
    });
    expect(
      report.obligations.find(
        (item: { obligationId: string }) =>
          item.obligationId === 'journey/six-model-complete-record-closed'
      )
    ).toMatchObject({
      coverageStatus: 'covered',
      oracleIndependence: 'independent',
    });
  });

  it('does not count indirect evidence when the Journey requires direct evidence', () => {
    const report = buildSixModelCoverageGapReport({
      catalog: catalog('indirect'),
      coreFreeze: coreFreeze(),
      policy: policy(),
    });
    const journey = report.obligations.find(
      (item: { obligationId: string }) =>
        item.obligationId === 'journey/six-model-complete-record-closed'
    );

    expect(journey).toMatchObject({
      coverageStatus: 'indirectly_covered',
      directEvidenceKind: 'indirect',
      gapReason: 'minimum_evidence_not_met',
      devHandoffRequired: true,
    });
    expect(report.summary.effectivelyCoveredObligationCount).toBe(1);
  });

  it('creates a compact dev handoff from unresolved coverage rows', () => {
    const report = buildSixModelCoverageGapReport({
      catalog: catalog(),
      coreFreeze: coreFreeze(),
      policy: policy(),
    });
    const handoff = buildDevRemediationHandoff({ coverageReport: report });

    expect(handoff.items).toEqual([
      expect.objectContaining({
        itemKind: 'coverage_gap',
        failureFingerprint: 'MISSING_COMPLETE_SIX_MODEL_E2E',
        selectionRemainsRequired: true,
        blocksPortfolioCorrectness: false,
      }),
    ]);
    expect(canonicalJsonBytes(handoff).length).toBeLessThan(4096);
  });

  it('projects failed Vitest assertions into path-bound product remediation records', () => {
    const productCatalog = catalog();
    productCatalog.tests[0] = {
      ...productCatalog.tests[0],
      executableIdentity: 'vitest::tests/requirement.test.ts',
      identityKey: 'root-vitest#tests/requirement.test.ts',
      testPath: 'tests/requirement.test.ts',
      capabilityRefs: ['six-model-state-machine'],
      traceRefs: ['execution_closure/state_entry'],
      targetRefs: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
    };
    const records = buildProductFailureRecords({
      testReport: {
        testResults: [
          {
            name: 'D:/repo/tests/requirement.test.ts',
            assertionResults: [
              {
                status: 'failed',
                fullName: 'requirement flow rejects stale evidence',
                failureMessages: ['Error: stale evidence was accepted'],
              },
            ],
          },
        ],
      },
      catalog: productCatalog,
      requiredSelectionIdentityKeys: ['vitest::tests/requirement.test.ts'],
      exactCommand: 'npm exec --offline -- vitest run tests/requirement.test.ts --reporter=json',
      exitCode: 1,
      changedProductPaths: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
    });

    expect(records).toEqual([
      expect.objectContaining({
        itemKind: 'product_failure',
        modelRefs: ['execution_closure'],
        transitionRefs: ['state_entry'],
        capabilityRefs: ['six-model-state-machine'],
        traceRefs: ['execution_closure/state_entry'],
        testIdentity: 'root-vitest#tests/requirement.test.ts',
        testPath: 'tests/requirement.test.ts',
        testCaseName: 'requirement flow rejects stale evidence',
        exactCommand: 'npm exec --offline -- vitest run tests/requirement.test.ts --reporter=json',
        exitCode: 1,
        changedProductPaths: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
        suspectedProductOwner: 'packages/bmad-speckit',
        selectionRemainsRequired: true,
        blocksPortfolioCorrectness: false,
      }),
    ]);
    expect(records[0].failureFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('is byte-stable when Catalog input order changes', () => {
    const firstCatalog = catalog('direct');
    const secondCatalog = {
      ...firstCatalog,
      tests: [...firstCatalog.tests].reverse(),
    };

    const first = buildSixModelCoverageGapReport({
      catalog: firstCatalog,
      coreFreeze: coreFreeze(),
      policy: policy(),
    });
    const second = buildSixModelCoverageGapReport({
      catalog: secondCatalog,
      coreFreeze: coreFreeze(),
      policy: policy(),
    });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
  });
});
