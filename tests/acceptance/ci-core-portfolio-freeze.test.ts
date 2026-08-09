import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import '../fixtures/test-portfolio/ci-six-model-coverage-gap-report.contract';

const require = createRequire(import.meta.url);
const {
  buildSelectorOutcome,
  freezeCorePortfolio,
  main: runFreezeCli,
  parseCliArgs: parseFreezeCliArgs,
} = require('../../tools/ci/freeze-core-portfolio.cjs');
const factsFixture = require('../fixtures/test-portfolio/catalog-facts.json');
const policyFixture = structuredClone(require('../fixtures/test-portfolio/catalog-policy.json'));
policyFixture.protectedCapabilities[0].survivalEvidenceRefs = ['target:src/state-machine.ts'];
const {
  catalogFactsHash,
  catalogPolicyHash,
  projectTestCatalog,
} = require('../../tools/ci/generate-test-catalog.cjs');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');
const temporaryPaths: string[] = [];

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0)) {
    rmSync(temporaryPath, { recursive: true, force: true });
  }
});

function test(
  identityKey: string,
  capabilityRefs: string[],
  overrides: Record<string, unknown> = {}
) {
  const { classifications: classificationOverrides = {}, ...remainingOverrides } = overrides;
  return {
    identityKey,
    runnerId: 'vitest',
    testPath: identityKey.replace(/^vitest::/u, ''),
    executableIdentity: identityKey,
    lifecycleState: 'retained_on_demand',
    capabilityRefs,
    failureModeRefs: [],
    selectionRefs: capabilityRefs.map((capabilityRef) =>
      capabilityRef === 'six-model-state-machine' ? 'script:test:ci:codex' : 'script:test:cli'
    ),
    targetRefs: [
      ...(capabilityRefs.includes('six-model-state-machine')
        ? ['src/main-agent-state-machine.ts']
        : []),
      ...(capabilityRefs.includes('cli-startup') ? ['src/cli-startup.ts'] : []),
    ],
    traceRefs: [],
    featureRefs: [],
    fixtureRefs: [],
    behaviorEvidence: {
      ...(capabilityRefs.includes('six-model-state-machine')
        ? {
            'selection:script:test:ci:codex': 'direct',
            'target:src/main-agent-state-machine.ts': 'direct',
          }
        : {}),
      ...(capabilityRefs.includes('cli-startup')
        ? {
            'selection:script:test:cli': 'direct',
            'target:src/cli-startup.ts': 'direct',
          }
        : {}),
    },
    behaviorOracleAuthority: {},
    packageId: 'root',
    releaseGateMembership: 'none',
    durationSummary: {
      durationMs: identityKey.includes('state-machine') ? 100 : 50,
      source: 'observed',
    },
    classifications: {
      oracleEffectiveness: 'effective',
      protectedCapabilityRefs: capabilityRefs,
      ...(classificationOverrides as Record<string, unknown>),
    },
    evidenceRefs: [],
    ...remainingOverrides,
  };
}

function policy(corePermanentCount = 120) {
  return {
    schemaVersion: 'test-portfolio-policy/v1',
    budgets: {
      executableTestCount: 1200,
      corePermanentCount,
      prP95Minutes: 10,
    },
    profiles: [
      'pr-fast',
      'pr-full',
      'nightly-deep',
      'release-verify',
      'nightly-full',
      'release-full',
    ],
    semanticObligations: [
      {
        model: 'requirement_confirmation',
        applicability: 'applicable',
        minimumEvidenceKind: 'direct',
        requiredBehaviors: [
          'state_entry',
          'applicability_or_not_applicable',
          'successful_promotion',
          'fail_closed',
          'invalidation',
          'reconfirmation',
          'evidence_binding',
          'authority_rejection',
          'stale_evidence_rejection',
        ],
      },
      {
        model: 'architecture_confirmation',
        applicability: 'not_applicable',
        minimumEvidenceKind: 'direct',
        requiredBehaviors: [
          'state_entry',
          'applicability_or_not_applicable',
          'successful_promotion',
          'fail_closed',
          'invalidation',
          'reconfirmation',
          'evidence_binding',
          'authority_rejection',
          'stale_evidence_rejection',
        ],
      },
      {
        model: 'implementation_readiness',
        applicability: 'not_applicable',
        minimumEvidenceKind: 'direct',
        requiredBehaviors: [
          'state_entry',
          'applicability_or_not_applicable',
          'successful_promotion',
          'fail_closed',
          'invalidation',
          'reconfirmation',
          'evidence_binding',
          'authority_rejection',
          'stale_evidence_rejection',
        ],
      },
      {
        model: 'execution_closure',
        applicability: 'not_applicable',
        minimumEvidenceKind: 'direct',
        requiredBehaviors: [
          'state_entry',
          'applicability_or_not_applicable',
          'successful_promotion',
          'fail_closed',
          'invalidation',
          'reconfirmation',
          'evidence_binding',
          'authority_rejection',
          'stale_evidence_rejection',
        ],
      },
      {
        model: 'audit_review',
        applicability: 'not_applicable',
        minimumEvidenceKind: 'direct',
        requiredBehaviors: [
          'state_entry',
          'applicability_or_not_applicable',
          'successful_promotion',
          'fail_closed',
          'invalidation',
          'reconfirmation',
          'evidence_binding',
          'authority_rejection',
          'stale_evidence_rejection',
          'reverse_audit_execution',
          'judge_continuation',
        ],
      },
      {
        model: 'delivery_confirmation',
        applicability: 'not_applicable',
        minimumEvidenceKind: 'direct',
        requiredBehaviors: [
          'state_entry',
          'applicability_or_not_applicable',
          'successful_promotion',
          'fail_closed',
          'invalidation',
          'reconfirmation',
          'evidence_binding',
          'authority_rejection',
          'stale_evidence_rejection',
          'record_closed_final_transition',
        ],
      },
    ],
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
    protectedCapabilities: [
      {
        capabilityId: 'six-model-state-machine',
        selectionRefs: ['script:test:ci:codex'],
        survivalEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
        requiredBehaviors: {
          'requirement_confirmation/*': {
            anyOfEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
            evidenceKind: 'direct',
          },
        },
      },
      {
        capabilityId: 'cli-startup',
        selectionRefs: ['script:test:cli'],
        survivalEvidenceRefs: ['target:src/cli-startup.ts'],
        requiredBehaviors: {},
      },
    ],
    classification: {
      directoryRules: [
        {
          ruleId: 'tests',
          pattern: 'tests/**',
          state: 'retained_on_demand',
        },
      ],
      exceptions: [],
    },
    selection: {
      expansionOrder: ['trace_capability', 'feature', 'package'],
      highDiffusionPathRules: ['packages/bmad-speckit/src/utils/main-agent/**'],
      releaseSurfacePathRules: ['package.json'],
      productSurvivalCapabilityRefs: ['six-model-state-machine'],
      releaseCapabilityRefs: ['six-model-state-machine'],
      releaseRequiredBindingKinds: [
        'package_install',
        'cli_bin',
        'consumer_compatibility',
        'packaged_runtime',
        'security_encoding_persistence',
        'protected_acceptance_or_proof',
      ],
    },
    timing: {
      unknownDurationMs: 60_000,
      maxShardDurationMs: 480_000,
      maxShardsPerLane: 8,
    },
    deletion: {
      optimizationUseForbidden: true,
      requiredReviewMode: 'manual_exception',
      minimumApprovals: 2,
      maxBatchSize: 10,
      deterministicReasonCodes: [
        'EXACT_DUPLICATE',
        'TARGET_REMOVED',
        'SELF_PROVING_ORACLE',
        'REPLACED_BY_CONTRACT_TEST',
      ],
      localReview: {
        maxCandidates: 10,
        maxCalls: 1,
        retries: 0,
        timeoutMs: 120_000,
      },
    },
  };
}

function completeCatalog(tests: Record<string, unknown>[], policyValue: Record<string, any>) {
  const facts = authorityFacts(tests);
  const protectedCapabilityIds = policyValue.protectedCapabilities.map(
    (capability: any) => capability.capabilityId
  );
  const missingProtected = protectedCapabilityIds.filter(
    (capabilityId: string) =>
      !tests.some((entry: any) =>
        entry.classifications.protectedCapabilityRefs.includes(capabilityId)
      )
  );
  return {
    schemaVersion: 'test-catalog/v1',
    repository: { root: '.' },
    policyHash: catalogPolicyHash(policyValue),
    factsHash: catalogFactsHash(facts),
    generatedPath: '.artifacts/test-portfolio/test-catalog.json',
    tests,
    gates: {
      catalogIdentityDuplicateCount: 0,
      unexplainedRunnerOnlyCount: 0,
      unexplainedCandidateOnlyCount: 0,
      unclassifiedTestCount: 0,
      protectedCapabilityWithoutCoreTestCount: missingProtected.length,
      executableTestCount: tests.length,
      executableTestBudget: policyValue.budgets.executableTestCount,
      executableBudgetStatus:
        tests.length > policyValue.budgets.executableTestCount ? 'over_budget' : 'within_budget',
      corePermanentCount: 0,
      reconciliationErrorCount: 0,
    },
  };
}

function authorityFacts(tests: Record<string, unknown>[]) {
  return {
    schemaVersion: 'test-portfolio-audit-facts/v1',
    repository: { root: '.' },
    inventory: {
      tests: tests.map((entry: any) => ({
        identityKey: entry.identityKey,
        runnerId: entry.runnerId,
        testPath: entry.testPath,
      })),
    },
    analyzerResults: [
      {
        dimension: 'criticality',
        findings: tests.map((entry: any) => ({
          identityKey: entry.identityKey,
          value: entry.selectionRefs.length > 0 ? 'critical' : 'non_critical',
          confidence: 'high',
          bindings: entry.selectionRefs.map((selectionRef: string, index: number) => ({
            kind: 'protected_acceptance_or_proof',
            selectionRef,
            evidenceRef: `source:${entry.testPath}#selection-${index}`,
          })),
        })),
      },
      {
        dimension: 'targetValidity',
        findings: tests.flatMap((entry: any) =>
          entry.targetRefs.map((targetRef: string) => ({
            identityKey: entry.identityKey,
            targetRef,
            value:
              entry.behaviorEvidence[`target:${targetRef}`] === 'ambiguous'
                ? 'ambiguous'
                : 'active',
            confidence: 'high',
          }))
        ),
      },
      {
        dimension: 'oracleEffectiveness',
        findings: tests.map((entry: any) => ({
          identityKey: entry.identityKey,
          value: entry.classifications.oracleEffectiveness,
          confidence: 'high',
          evidenceRefs: Object.values(entry.behaviorOracleAuthority || {}).flatMap(
            (authority: any) => authority.evidenceRefs || []
          ),
          issueCodes: [],
        })),
      },
    ],
  };
}

function freshTimingSummary(
  commitSha: string,
  durations: Record<string, number>,
  environmentClass = 'win32-x64-node22'
) {
  return summarizeTimingEvents({
    commitSha,
    environmentClass,
    observedAt: '2026-07-29T00:00:00.000Z',
    provenance: 'runner_observed',
    artifactHashes: [`sha256:${'f'.repeat(64)}`],
    events: Object.entries(durations).map(([identityKey, durationMs]) => {
      const [runnerId, testPath] = identityKey.split('::');
      return {
        eventId: sha256Bytes(canonicalJsonBytes({ commitSha, identityKey })),
        identityKey,
        testPath,
        runnerId,
        durationMs,
        outcome: 'passed',
      };
    }),
  });
}

function runCliCase(catalog: Record<string, unknown>, policyValue: Record<string, unknown>) {
  const scratchRoot = join(process.cwd(), '.codex-tmp');
  mkdirSync(scratchRoot, { recursive: true });
  const inputRoot = mkdtempSync(join(scratchRoot, 'core-freeze-cli-'));
  const outputRoot = join(
    process.cwd(),
    '.artifacts',
    'test-portfolio',
    `core-freeze-cli-${basename(inputRoot)}`
  );
  mkdirSync(outputRoot, { recursive: true });
  temporaryPaths.push(inputRoot, outputRoot);

  const catalogPath = join(inputRoot, 'catalog.json');
  const policyPath = join(inputRoot, 'policy.json');
  const factsPath = join(inputRoot, 'facts.json');
  const timingSummaryPath = join(inputRoot, 'timing-summary.json');
  const outputPath = join(outputRoot, 'core-freeze.json');
  const complete =
    catalog.schemaVersion === 'test-catalog/v1'
      ? catalog
      : completeCatalog(catalog.tests as Record<string, unknown>[], policyValue);
  const commitSha = 'a'.repeat(40);
  const timingSummary = freshTimingSummary(
    commitSha,
    Object.fromEntries(
      (complete.tests as any[]).map((entry) => [
        entry.executableIdentity,
        entry.durationSummary.durationMs,
      ])
    )
  );
  writeFileSync(catalogPath, `${JSON.stringify(complete)}\n`, 'utf8');
  writeFileSync(policyPath, `${JSON.stringify(policyValue)}\n`, 'utf8');
  writeFileSync(factsPath, `${JSON.stringify(authorityFacts(complete.tests as any[]))}\n`, 'utf8');
  writeFileSync(timingSummaryPath, `${JSON.stringify(timingSummary)}\n`, 'utf8');

  const exitCode = runFreezeCli([
    '--catalog',
    relative(process.cwd(), catalogPath),
    '--policy',
    relative(process.cwd(), policyPath),
    '--facts',
    relative(process.cwd(), factsPath),
    '--timing-summary',
    relative(process.cwd(), timingSummaryPath),
    '--commit-sha',
    commitSha,
    '--environment-class',
    'win32-x64-node22',
    '--output',
    relative(process.cwd(), outputPath),
  ]);

  return {
    exitCode,
    artifact: JSON.parse(readFileSync(outputPath, 'utf8')),
  };
}

describe('dynamic permanent core freeze', () => {
  it('requires an explicit authoritative Facts input for the standalone Freeze CLI', () => {
    expect(() =>
      parseFreezeCliArgs([
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--policy',
        'repo-governance/ci/test-policy.json',
        '--output',
        '.artifacts/test-portfolio/core-freeze.json',
      ])
    ).toThrow('CORE_FREEZE_CLI_ARGS_INVALID');
  });

  it('requires timing summary, commit, and environment as one fail-closed CLI binding', () => {
    expect(() =>
      parseFreezeCliArgs([
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--facts',
        '.artifacts/test-portfolio/test-catalog-facts.json',
        '--policy',
        'repo-governance/ci/test-policy.json',
        '--output',
        '.artifacts/test-portfolio/core-freeze.json',
      ])
    ).toThrow('CORE_FREEZE_CLI_ARGS_INVALID');
  });

  it('rejects a partial hand-written Catalog before semantic selection', () => {
    expect(() =>
      freezeCorePortfolio({
        catalog: {
          tests: [
            test('vitest::tests/state-machine.test.ts', ['six-model-state-machine']),
            test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
          ],
        },
        policy: policy(),
      })
    ).toThrow('CATALOG_SCHEMA_VERSION_INVALID');
  });

  it('rejects a complete Catalog bound to a different policy hash', () => {
    const changedPolicy = structuredClone(policyFixture);
    changedPolicy.timing.unknownDurationMs += 1;
    const catalog = projectTestCatalog({ facts: factsFixture, policy: policyFixture });

    expect(() =>
      freezeCorePortfolio({ catalog, facts: factsFixture, policy: changedPolicy })
    ).toThrow('CORE_FREEZE_POLICY_HASH_MISMATCH');
  });

  it('rejects a complete Catalog whose protected authority was forged after projection', () => {
    const catalog = projectTestCatalog({ facts: factsFixture, policy: policyFixture });
    const forged = catalog.tests.find(
      (entry: any) => entry.identityKey === 'vitest#tests/on-demand/platform.test.ts'
    );
    forged.selectionRefs = ['script:test:core-state-machine'];
    forged.classifications.protectedCapabilityRefs = ['state-machine'];
    forged.capabilityRefs = ['state-machine'];
    forged.behaviorEvidence['selection:script:test:core-state-machine'] = 'direct';

    expect(() =>
      freezeCorePortfolio({ catalog, facts: factsFixture, policy: policyFixture })
    ).toThrow('CORE_FREEZE_CATALOG_AUTHORITY_MISMATCH');
  });

  it('retains authoritative candidate diagnostics for unmapped obligations', () => {
    const outcome = buildSelectorOutcome({
      obligations: [
        {
          obligationId: 'requirement_confirmation/state_entry',
          applicability: 'applicable',
          minimumEvidenceKind: 'direct',
        },
      ],
      candidates: [
        {
          identityKey: 'vitest::tests/indirect.test.ts',
          obligationEvidence: {
            'requirement_confirmation/state_entry': 'indirect',
          },
          oracleIndependence: 'independent',
          estimatedDurationMs: 1,
          timingProvenance: 'observed',
          timingFreshness: 'fresh',
          flakePenaltyMs: 0,
          fragileFixturePenaltyMs: 0,
          redundancyPenaltyMs: 0,
          directEvidenceQualityBonusMs: 0,
          independentOracleBonusMs: 0,
          stabilityScore: 1,
        },
      ],
      defaultDurationMs: 60_000,
    });

    expect(outcome.result.candidateEvidence).toEqual([
      {
        identityKey: 'vitest::tests/indirect.test.ts',
        obligationEvidence: {
          'requirement_confirmation/state_entry': 'indirect',
        },
        obligationOracleIndependence: {},
        oracleIndependence: 'independent',
      },
    ]);
    expect(outcome.result.coverage[0].evidenceDiagnostics).toEqual([
      expect.objectContaining({
        identityKey: 'vitest::tests/indirect.test.ts',
        evidenceKind: 'indirect',
        eligibleForCoverage: false,
      }),
    ]);
  });

  it('retains the deterministic minimal selection for mapped obligations when other obligations gap', () => {
    const outcome = buildSelectorOutcome({
      obligations: [
        {
          obligationId: 'requirement_confirmation/state_entry',
          applicability: 'applicable',
          minimumEvidenceKind: 'direct',
        },
        {
          obligationId: 'requirement_confirmation/reconfirmation',
          applicability: 'applicable',
          minimumEvidenceKind: 'direct',
        },
      ],
      candidates: [
        {
          identityKey: 'vitest::tests/state-entry.test.ts',
          obligationEvidence: {
            'requirement_confirmation/state_entry': 'direct',
          },
          oracleIndependence: 'independent',
          estimatedDurationMs: 1,
          timingProvenance: 'observed',
          timingFreshness: 'fresh',
          flakePenaltyMs: 0,
          fragileFixturePenaltyMs: 0,
          redundancyPenaltyMs: 0,
          directEvidenceQualityBonusMs: 0,
          independentOracleBonusMs: 0,
          stabilityScore: 1,
        },
      ],
      defaultDurationMs: 60_000,
    });

    expect(outcome.result.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/state-entry.test.ts',
    ]);
    expect(outcome.result.gates.unmappedApplicableObligationCount).toBe(1);
    expect(outcome.gaps).toEqual([
      {
        obligationId: 'requirement_confirmation/reconfirmation',
        reason: 'missing_test',
      },
    ]);
  });

  it('uses weighted semantic cover and emits no static identity policy patch', () => {
    const policyValue = policy();
    const tests = [
      test('vitest::tests/state-machine.test.ts', ['six-model-state-machine']),
      test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
      test('vitest::tests/release-descendant.test.ts', [], {
        releaseGateMembership: 'release',
      }),
    ];
    const result = freezeCorePortfolio({
      catalog: completeCatalog(tests, policyValue),
      facts: authorityFacts(tests),
      policy: policyValue,
    });

    expect(result.schemaVersion).toBe('test-portfolio-core-freeze/v2');
    expect(result).not.toHaveProperty('coreIdentityKeys');
    expect(result).not.toHaveProperty('policyPatch');
    expect(result.gaps).toEqual([]);
    expect(result.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/cli-startup.test.ts',
      'vitest::tests/state-machine.test.ts',
    ]);
    expect(result.selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identityKey: 'vitest::tests/cli-startup.test.ts',
          coveredObligationIds: ['survival/cli-startup'],
          estimatedDurationMs: 50,
          timingProvenance: 'observed',
          timingFreshness: 'fresh',
          totalCostMs: 50,
        }),
      ])
    );
    expect(result.candidateEvidence.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/cli-startup.test.ts',
      'vitest::tests/release-descendant.test.ts',
      'vitest::tests/state-machine.test.ts',
    ]);
    expect(result.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationId: 'requirement_confirmation/state_entry',
          status: 'covered',
          selectedEvidence: [
            {
              identityKey: 'vitest::tests/state-machine.test.ts',
              evidenceKind: 'direct',
            },
          ],
        }),
        expect.objectContaining({
          obligationId: 'survival/cli-startup',
          status: 'covered',
          selectedEvidence: [
            {
              identityKey: 'vitest::tests/cli-startup.test.ts',
              evidenceKind: 'direct',
            },
          ],
        }),
      ])
    );
    expect(result.hashes).toEqual({
      catalogSha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      factsSha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      policySha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      selectorInputSha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      selectorOutcomeSha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
  });

  it('uses exact-commit fresh timing instead of Catalog policy defaults for set-cover cost', () => {
    const policyValue = policy();
    const slowIdentity = 'vitest::tests/a-slow-state-machine.test.ts';
    const fastIdentity = 'vitest::tests/z-fast-state-machine.test.ts';
    const tests = [
      test(slowIdentity, ['six-model-state-machine'], {
        durationSummary: { durationMs: 60_000, source: 'policy_default' },
      }),
      test(fastIdentity, ['six-model-state-machine'], {
        durationSummary: { durationMs: 60_000, source: 'policy_default' },
      }),
      test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
    ];
    const commitSha = 'a'.repeat(40);
    const timingSummary = freshTimingSummary(commitSha, {
      [slowIdentity]: 4_000,
      [fastIdentity]: 40,
      'vitest::tests/cli-startup.test.ts': 20,
    });

    const result = freezeCorePortfolio({
      catalog: completeCatalog(tests, policyValue),
      facts: authorityFacts(tests),
      policy: policyValue,
      timingSummary,
      timingContext: {
        expectedCommitSha: commitSha,
        expectedEnvironmentClass: 'win32-x64-node22',
      },
    });

    expect(result.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/cli-startup.test.ts',
      fastIdentity,
    ]);
    expect(result.selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identityKey: fastIdentity,
          estimatedDurationMs: 40,
          timingProvenance: 'runner_observed',
          timingFreshness: 'fresh',
        }),
      ])
    );
    expect(result.timingBinding).toMatchObject({
      status: 'fresh',
      freshTimingCount: 3,
      fallbackTimingCount: 0,
      staleTimingCount: 0,
    });
    expect(result.hashes.timingSnapshotSha256).toBe(timingSummary.timingSnapshotHash);
  });

  it('uses target behavior evidence without requiring protected capability membership', () => {
    const policyValue = policy();
    const tests = [
      test('vitest::tests/target-backed-state-machine.test.ts', [], {
        targetRefs: ['src/main-agent-state-machine.ts'],
        behaviorEvidence: {
          'target:src/main-agent-state-machine.ts': 'direct',
        },
        classifications: { protectedCapabilityRefs: [] },
      }),
      test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
    ];
    const result = freezeCorePortfolio({
      catalog: completeCatalog(tests, policyValue),
      facts: authorityFacts(tests),
      policy: policyValue,
    });

    expect(result.gaps).toEqual([]);
    expect(result.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::tests/target-backed-state-machine.test.ts'
    );
    expect(
      result.candidateEvidence.find(
        (item: any) => item.identityKey === 'vitest::tests/target-backed-state-machine.test.ts'
      ).obligationEvidence
    ).toEqual(
      expect.objectContaining({
        'requirement_confirmation/state_entry': 'direct',
        'survival/six-model-state-machine': 'direct',
      })
    );
  });

  it('preserves observed direct evidence when the obligation minimum permits indirect evidence', () => {
    const policyValue = policy();
    policyValue.semanticObligations[0].minimumEvidenceKind = 'indirect';
    policyValue.protectedCapabilities[0].requiredBehaviors = {
      'requirement_confirmation/state_entry': {
        anyOfEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
        evidenceKind: 'indirect',
      },
    };
    const tests = [
      test('vitest::tests/direct-state-machine.test.ts', [], {
        targetRefs: ['src/main-agent-state-machine.ts'],
        behaviorEvidence: {
          'target:src/main-agent-state-machine.ts': 'direct',
        },
        classifications: { protectedCapabilityRefs: [] },
      }),
      test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
    ];

    const result = freezeCorePortfolio({
      catalog: completeCatalog(tests, policyValue),
      facts: authorityFacts(tests),
      policy: policyValue,
    });

    expect(
      result.candidateEvidence.find(
        (item: any) => item.identityKey === 'vitest::tests/direct-state-machine.test.ts'
      ).obligationEvidence['requirement_confirmation/state_entry']
    ).toBe('direct');
    expect(
      result.coverage.find(
        (item: any) => item.obligationId === 'requirement_confirmation/state_entry'
      ).status
    ).toBe('covered');
  });

  it('does not treat selection membership as behavior or survival evidence', () => {
    const policyValue = policy();
    const tests = [
      test('vitest::tests/selection-only.test.ts', ['six-model-state-machine'], {
        targetRefs: [],
        behaviorEvidence: {
          'selection:script:test:ci:codex': 'direct',
        },
      }),
    ];
    const result = freezeCorePortfolio({
      catalog: completeCatalog(tests, policyValue),
      facts: authorityFacts(tests),
      policy: policyValue,
    });

    expect(result.candidateEvidence[0].obligationEvidence).toEqual({});
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationId: 'survival/six-model-state-machine',
          reason: 'missing_test',
        }),
      ])
    );
  });

  it.each(['release', 'explicit', 'inherited', 'mixed'])(
    'does not treat %s release gate membership as semantic core evidence',
    (releaseGateMembership) => {
      const policyValue = policy();
      const tests = [
        test(`vitest::tests/${releaseGateMembership}.test.ts`, [], {
          releaseGateMembership,
          selectionRefs: [],
          targetRefs: [],
          behaviorEvidence: {},
          classifications: { protectedCapabilityRefs: [] },
        }),
      ];
      const result = freezeCorePortfolio({
        catalog: completeCatalog(tests, policyValue),
        facts: authorityFacts(tests),
        policy: policyValue,
      });

      expect(result.candidateEvidence[0].obligationEvidence).toEqual({});
      expect(result.selected).toEqual([]);
    }
  );

  it('requires an independent oracle for every frozen identity', () => {
    const catalog = {
      tests: [
        test('vitest::tests/state-machine.test.ts', ['six-model-state-machine'], {
          classifications: { oracleEffectiveness: 'ineffective_candidate' },
        }),
        test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
      ],
    };

    const policyValue = policy();
    const result = freezeCorePortfolio({
      catalog: completeCatalog(catalog.tests, policyValue),
      facts: authorityFacts(catalog.tests),
      policy: policyValue,
    });
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationId: 'requirement_confirmation/state_entry',
          reason: 'missing_independent_oracle',
        }),
      ])
    );
  });

  it('uses evidence-scoped Oracle authority without promoting the entire test file', () => {
    const policyValue = policy();
    policyValue.protectedCapabilities[0].requiredBehaviors = {
      'requirement_confirmation/state_entry': {
        anyOfEvidenceRefs: ['trace:six-model/requirement-confirmation/state-entry'],
        evidenceKind: 'direct',
      },
      'requirement_confirmation/fail_closed': {
        anyOfEvidenceRefs: ['trace:six-model/requirement-confirmation/fail-closed'],
        evidenceKind: 'direct',
      },
    };
    policyValue.semanticEvidenceBindings = [
      {
        runnerId: 'vitest',
        testPath: 'tests/scoped-oracle.test.ts',
        bindings: [
          {
            evidenceRef: 'trace:six-model/requirement-confirmation/state-entry',
            evidenceKind: 'direct',
            oracleAuthority: {
              independence: 'independent',
              evidenceRefs: [
                'source:tests/scoped-oracle.test.ts#test:rejects%20invalid%20state:case:1:assertion:1',
              ],
            },
          },
          {
            evidenceRef: 'trace:six-model/requirement-confirmation/fail-closed',
            evidenceKind: 'direct',
          },
        ],
      },
    ];
    const scoped = test('vitest::tests/scoped-oracle.test.ts', [], {
      behaviorEvidence: {
        'trace:six-model/requirement-confirmation/state-entry': 'direct',
        'trace:six-model/requirement-confirmation/fail-closed': 'direct',
      },
      behaviorOracleAuthority: {
        'trace:six-model/requirement-confirmation/state-entry': {
          oracleIndependence: 'independent',
          evidenceRefs: [
            'source:tests/scoped-oracle.test.ts#test:rejects%20invalid%20state:case:1:assertion:1',
          ],
        },
      },
      classifications: {
        oracleEffectiveness: 'ineffective_candidate',
        protectedCapabilityRefs: [],
      },
    });
    const result = freezeCorePortfolio({
      catalog: completeCatalog([scoped], policyValue),
      facts: authorityFacts([scoped]),
      policy: policyValue,
    });

    expect(
      result.coverage.find(
        (item: any) => item.obligationId === 'requirement_confirmation/state_entry'
      )
    ).toMatchObject({ status: 'covered' });
    expect(
      result.coverage.find(
        (item: any) => item.obligationId === 'requirement_confirmation/fail_closed'
      )
    ).toMatchObject({
      status: 'missing_test',
      evidenceDiagnostics: [
        expect.objectContaining({
          identityKey: scoped.identityKey,
          oracleIndependence: 'dependent',
          eligibleForCoverage: false,
        }),
      ],
    });
  });

  it('fails when a protected capability has no independently closable core test', () => {
    const catalog = {
      tests: [test('vitest::tests/state-machine.test.ts', ['six-model-state-machine'])],
    };

    const policyValue = policy();
    const result = freezeCorePortfolio({
      catalog: completeCatalog(catalog.tests, policyValue),
      facts: authorityFacts(catalog.tests),
      policy: policyValue,
    });
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationId: 'survival/cli-startup',
          reason: 'missing_test',
        }),
      ])
    );
  });

  it('fails rather than increasing the permanent core budget', () => {
    const catalog = {
      tests: [
        test('vitest::tests/state-machine.test.ts', ['six-model-state-machine']),
        test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
      ],
    };

    const policyValue = policy(0);
    const result = freezeCorePortfolio({
      catalog: completeCatalog(catalog.tests, policyValue),
      facts: authorityFacts(catalog.tests),
      policy: policyValue,
    });
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'core_budget_exceeded',
        }),
      ])
    );
    expect(result.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/cli-startup.test.ts',
      'vitest::tests/state-machine.test.ts',
    ]);
    expect(
      result.coverage.every(
        (item: any) =>
          item.status === 'not_applicable' ||
          ['covered', 'indirectly_covered'].includes(item.status)
      )
    ).toBe(true);
  });

  it('fails closed when the executable test budget is exceeded', () => {
    const policyValue = policy();
    const tests = [
      test('vitest::tests/state-machine.test.ts', ['six-model-state-machine']),
      test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
      ...Array.from({ length: policyValue.budgets.executableTestCount - 1 }, (_value, index) =>
        test(`vitest::tests/non-core-${String(index).padStart(3, '0')}.test.ts`, [], {
          selectionRefs: [],
          behaviorEvidence: {},
          classifications: { protectedCapabilityRefs: [] },
        })
      ),
    ];
    const result = freezeCorePortfolio({
      catalog: completeCatalog(tests, policyValue),
      facts: authorityFacts(tests),
      policy: policyValue,
    });

    expect(result.gaps).toContainEqual({
      reason: 'executable_budget_exceeded',
      actual: policyValue.budgets.executableTestCount + 1,
      budget: policyValue.budgets.executableTestCount,
    });
    expect(result.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/cli-startup.test.ts',
      'vitest::tests/state-machine.test.ts',
    ]);
    expect(
      result.coverage.every(
        (item: any) =>
          item.status === 'not_applicable' ||
          ['covered', 'indirectly_covered'].includes(item.status)
      )
    ).toBe(true);
  });

  it.each([
    [
      'missing test',
      () => ({
        catalog: {
          tests: [test('vitest::tests/state-machine.test.ts', ['six-model-state-machine'])],
        },
        policy: policy(),
        reason: 'missing_test',
      }),
    ],
    [
      'ambiguous evidence',
      () => ({
        catalog: {
          tests: [
            test('vitest::tests/state-machine.test.ts', ['six-model-state-machine'], {
              behaviorEvidence: {
                'selection:script:test:ci:codex': 'direct',
                'target:src/main-agent-state-machine.ts': 'ambiguous',
              },
            }),
            test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
          ],
        },
        policy: policy(),
        reason: 'ambiguous',
      }),
    ],
    [
      'dependent oracle',
      () => ({
        catalog: {
          tests: [
            test('vitest::tests/state-machine.test.ts', ['six-model-state-machine'], {
              classifications: { oracleEffectiveness: 'ineffective_candidate' },
            }),
            test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
          ],
        },
        policy: policy(),
        reason: 'missing_independent_oracle',
      }),
    ],
    [
      'core budget',
      () => ({
        catalog: {
          tests: [
            test('vitest::tests/state-machine.test.ts', ['six-model-state-machine']),
            test('vitest::tests/cli-startup.test.ts', ['cli-startup']),
          ],
        },
        policy: policy(0),
        reason: 'core_budget_exceeded',
      }),
    ],
  ] as const)('returns exit 1 for a %s gap', (_label, createCase) => {
    const input = createCase();
    const result = runCliCase(input.catalog, input.policy);

    expect(result.exitCode).toBe(1);
    expect(result.artifact.gaps).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: input.reason })])
    );
  });
});
