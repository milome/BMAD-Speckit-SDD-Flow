import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  catalogFactsHash,
  materializeCatalogFacts,
  projectTestCatalog,
  validateTestCatalog,
  writeCatalogFacts,
  writeTestCatalog,
} = require('../../tools/ci/generate-test-catalog.cjs');
const {
  freezeCorePortfolio,
  main: runFreezeCli,
} = require('../../tools/ci/freeze-core-portfolio.cjs');
const { createBootstrapTimingSummary } = require('../../tools/ci/summarize-test-timings.cjs');
const { collectAuditFacts } = require('../../tools/test-portfolio-audit/facts.cjs');

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/test-portfolio');
const TRACKED_POLICY_PATH = join(process.cwd(), 'repo-governance/ci/test-policy.json');
const facts = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'catalog-facts.json'), 'utf8'));
const policy = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'catalog-policy.json'), 'utf8'));
const temporaryRoots: string[] = [];
const INTEGER_GATE_FIELDS = [
  'catalogIdentityDuplicateCount',
  'unexplainedRunnerOnlyCount',
  'unexplainedCandidateOnlyCount',
  'unclassifiedTestCount',
  'protectedCapabilityWithoutCoreTestCount',
  'executableTestCount',
  'executableTestBudget',
  'corePermanentCount',
  'reconciliationErrorCount',
] as const;

function projectFixture(overrides: Record<string, unknown> = {}) {
  return projectTestCatalog({
    facts,
    policy,
    changedPaths: ['tests/feature/new-behavior.test.ts'],
    ...overrides,
  });
}

function overBudgetCatalog() {
  const executableTestBudget = policy.budgets.executableTestCount;
  const generatedTests = Array.from({ length: executableTestBudget }, (_value, index) => ({
    identityKey: `vitest#tests/on-demand/generated-${index}.test.ts`,
    runnerId: 'vitest',
    testPath: `tests/on-demand/generated-${index}.test.ts`,
    executableIdentity: `vitest::tests/on-demand/generated-${index}.test.ts`,
    evidenceRefs: [`source:tests/on-demand/generated-${index}.test.ts`],
  }));
  const inventoryTests = [facts.inventory.tests[0], ...generatedTests];
  const discoveredPaths = inventoryTests.map((test) => test.testPath);
  return projectFixture({
    facts: {
      ...facts,
      inventory: {
        tests: inventoryTests,
      },
      discovery: {
        ...facts.discovery,
        runnerResolved: discoveredPaths,
        candidates: discoveredPaths,
        runnerResolvedCount: discoveredPaths.length,
        candidateCount: discoveredPaths.length,
      },
    },
    changedPaths: [],
  });
}

function corePermanentCatalog(corePermanentCount: number) {
  const catalog = projectFixture();
  const template = catalog.tests[0];
  catalog.tests = Array.from({ length: corePermanentCount }, (_value, index) => ({
    ...structuredClone(template),
    identityKey: `vitest#tests/core/generated-${index}.test.ts`,
    testPath: `tests/core/generated-${index}.test.ts`,
    executableIdentity: `vitest::tests/core/generated-${index}.test.ts`,
    lifecycleState: 'core_permanent',
  }));
  catalog.gates.executableTestCount = corePermanentCount;
  catalog.gates.corePermanentCount = corePermanentCount;
  return catalog;
}

function candidateCatalog(
  kind: 'duplicate' | 'target_removed' | 'self_proving_oracle' | 'generic',
  approved: boolean
) {
  const candidateFacts = structuredClone(facts);
  const identityKey = 'vitest#tests/on-demand/platform.test.ts';
  if (kind === 'generic') {
    candidateFacts.analyzerResults.push({
      analyzerId: 'deterministic-candidate',
      dimension: 'deterministicCandidate',
      status: 'complete',
      findings: [
        {
          identityKey,
          value: 'replacement_candidate',
          confidence: 'high',
          evidenceRefs: ['source:tests/on-demand/platform.test.ts#replacement'],
          issueCodes: ['REPLACEMENT_PROVEN'],
          approved,
          deterministicReasonCode: 'REPLACED_BY_CONTRACT_TEST',
        },
      ],
      issues: [],
    });
  } else {
    const dimensions = {
      duplicate: 'executionMultiplicity',
      target_removed: 'targetValidity',
      self_proving_oracle: 'oracleEffectiveness',
    };
    const result = candidateFacts.analyzerResults.find(
      (entry: any) => entry.dimension === dimensions[kind]
    );
    const finding = result.findings.find((entry: any) => entry.identityKey === identityKey);
    Object.assign(
      finding,
      kind === 'duplicate'
        ? {
            value: 'duplicate',
            confidence: 'high',
            issueCodes: ['DUPLICATE_EFFECTIVE_EXECUTION'],
            approved,
          }
        : kind === 'target_removed'
          ? {
              value: 'obsolete_candidate',
              confidence: 'high',
              issueCodes: ['PRODUCT_TARGET_OBSOLETE_CANDIDATE'],
              approved,
            }
          : {
              value: 'ineffective_candidate',
              confidence: 'medium',
              issueCodes: ['ORACLE_SELF_GENERATED_EXPECTED'],
              approved,
            }
    );
  }
  return projectFixture({ facts: candidateFacts, changedPaths: [] });
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ci-test-catalog-'));
  temporaryRoots.push(root);
  return root;
}

function withObjectPrototypeValues<T>(values: Record<string, unknown>, run: () => T): T {
  const previous = new Map(
    Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(Object.prototype, key)])
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      Object.defineProperty(Object.prototype, key, {
        configurable: true,
        value,
        writable: true,
      });
    }
    return run();
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(Object.prototype, key, descriptor);
      else delete (Object.prototype as Record<string, unknown>)[key];
    }
  }
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('canonical Test Catalog projection', () => {
  it('assigns exactly one lifecycle state by authority precedence', () => {
    const catalog = projectFixture();

    expect(catalog.tests).toHaveLength(4);
    expect(
      Object.fromEntries(catalog.tests.map((test: any) => [test.testPath, test.lifecycleState]))
    ).toEqual({
      'tests/core/state-machine.test.ts': 'retained_on_demand',
      'tests/feature/new-behavior.test.ts': 'feature_working_set',
      'tests/on-demand/platform.test.ts': 'retained_on_demand',
      'tests/redundant/duplicate.test.ts': 'deletion_candidate',
    });
    expect(catalog.tests.every((test: any) => typeof test.lifecycleState === 'string')).toBe(true);
    expect(
      Object.fromEntries(catalog.tests.map((test: any) => [test.testPath, test.executableIdentity]))
    ).toEqual({
      'tests/core/state-machine.test.ts': 'vitest::tests/core/state-machine.test.ts',
      'tests/feature/new-behavior.test.ts': 'vitest::tests/feature/new-behavior.test.ts',
      'tests/on-demand/platform.test.ts': 'vitest::tests/on-demand/platform.test.ts',
      'tests/redundant/duplicate.test.ts': 'vitest::tests/redundant/duplicate.test.ts',
    });
    expect(catalog.gates).toMatchObject({
      catalogIdentityDuplicateCount: 0,
      unexplainedRunnerOnlyCount: 0,
      unexplainedCandidateOnlyCount: 0,
      unclassifiedTestCount: 0,
      protectedCapabilityWithoutCoreTestCount: 0,
      corePermanentCount: 0,
      executableBudgetStatus: 'within_budget',
    });
  });

  it('consumes complete criticality bindings instead of reduced audit rows', () => {
    const core = projectFixture().tests.find(
      (test: any) => test.testPath === 'tests/core/state-machine.test.ts'
    );

    expect(core.capabilityRefs).toEqual(['state-machine']);
    expect(core.selectionRefs).toEqual(['script:test:core-state-machine']);
    expect(core.targetRefs).toEqual(['src/state-machine.ts']);
    expect(core.behaviorEvidence).toEqual({
      'selection:script:test:core-state-machine': 'direct',
      'target:src/state-machine.ts': 'direct',
    });
    expect(core.classifications.criticalBindings).toEqual([
      {
        kind: 'main_agent_core',
        selectionRef: 'script:test:core-state-machine',
        evidenceRef: 'source:package.json#testPortfolioAudit.criticalBindings[0]',
      },
      {
        evidenceRef: 'source:tests/core/state-machine.test.ts#security-boundary',
        kind: 'security_encoding_persistence',
      },
    ]);
    expect(core.evidenceRefs).toEqual(
      expect.arrayContaining([
        'source:package.json#testPortfolioAudit.criticalBindings[0]',
        'source:tests/core/state-machine.test.ts#security-boundary',
      ])
    );
  });

  it('keeps a registered command target active when static target validity lacks inbound evidence', () => {
    const commandFacts = structuredClone(facts);
    const targetValidity = commandFacts.analyzerResults.find(
      (result: any) => result.dimension === 'targetValidity'
    );
    const platformFinding = targetValidity.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/on-demand/platform.test.ts'
    );
    Object.assign(platformFinding, {
      value: 'obsolete_candidate',
      targetRef: 'tools/ci/freeze-core-portfolio.cjs',
    });

    const platform = projectFixture({ facts: commandFacts }).tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );

    expect(platform.targetRefs).toEqual(['tools/ci/freeze-core-portfolio.cjs']);
    expect(platform.behaviorEvidence).toMatchObject({
      'target:tools/ci/freeze-core-portfolio.cjs': 'direct',
    });
  });

  it('propagates registered command targets through non-executable fixture ownership', () => {
    const fixtureFacts = structuredClone(facts);
    fixtureFacts.sourceIndex = {
      testTargetRecords: [
        {
          testPath: 'tests/on-demand/platform.test.ts',
          targetPath: 'tests/fixtures/test-portfolio/coverage.contract.ts',
        },
        {
          testPath: 'tests/fixtures/test-portfolio/coverage.contract.ts',
          targetPath: 'tools/ci/generate-six-model-coverage-gap-report.cjs',
        },
      ],
    };

    const platform = projectFixture({ facts: fixtureFacts }).tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );

    expect(platform.fixtureRefs).toEqual(['tests/fixtures/test-portfolio/coverage.contract.ts']);
    expect(platform.targetRefs).toEqual([
      'src/platform.ts',
      'tools/ci/generate-six-model-coverage-gap-report.cjs',
    ]);
    expect(platform.behaviorEvidence).toMatchObject({
      'target:tools/ci/generate-six-model-coverage-gap-report.cjs': 'direct',
    });
  });

  it.each(['../outside.cjs', '/outside.cjs', 'C:\\outside.cjs'])(
    'rejects a non-repository test target path: %s',
    (targetPath) => {
      const invalidFacts = structuredClone(facts);
      invalidFacts.sourceIndex = {
        testTargetRecords: [
          {
            testPath: 'tests/on-demand/platform.test.ts',
            targetPath,
          },
        ],
      };

      expect(() => projectFixture({ facts: invalidFacts })).toThrow(
        'CATALOG_TEST_TARGET_PATH_INVALID'
      );
    }
  );

  it('rejects incomplete criticality bindings before projecting protected authority', () => {
    const incompleteFacts = structuredClone(facts);
    const criticality = incompleteFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    const coreFinding = criticality.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/core/state-machine.test.ts'
    );
    delete coreFinding.bindings[0].evidenceRef;

    expect(() => projectFixture({ facts: incompleteFacts })).toThrow(
      'CATALOG_CRITICAL_BINDING_INVALID'
    );
  });

  it.each([
    ['source:', 'script:test:core-state-machine'],
    ['source:tests/core/state machine.test.ts', 'script:test:core-state-machine'],
    ['source:tests/core/state-machine.test.ts', 'script:test core-state-machine'],
  ])('rejects non-canonical critical binding refs: %s / %s', (evidenceRef, selectionRef) => {
    const invalidFacts = structuredClone(facts);
    const criticality = invalidFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    const coreFinding = criticality.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/core/state-machine.test.ts'
    );
    coreFinding.bindings[0].evidenceRef = evidenceRef;
    coreFinding.bindings[0].selectionRef = selectionRef;

    expect(() => projectFixture({ facts: invalidFacts })).toThrow(
      'CATALOG_CRITICAL_BINDING_INVALID'
    );
  });

  it('keeps ambiguous target evidence when the same target also has an active finding', () => {
    const conflictingFacts = structuredClone(facts);
    const targetValidity = conflictingFacts.analyzerResults.find(
      (result: any) => result.dimension === 'targetValidity'
    );
    targetValidity.findings.push({
      identityKey: 'vitest#tests/core/state-machine.test.ts',
      targetRef: 'src/state-machine.ts',
      value: 'ambiguous',
      confidence: 'low',
      evidenceRefs: ['source:tests/core/state-machine.test.ts#ambiguous-target'],
      issueCodes: ['TARGET_REFERENCE_AMBIGUOUS'],
    });

    const core = projectFixture({ facts: conflictingFacts }).tests.find(
      (test: any) => test.testPath === 'tests/core/state-machine.test.ts'
    );

    expect(core.behaviorEvidence['target:src/state-machine.ts']).toBe('ambiguous');
  });

  it('does not let policy capability metadata create protected authority', () => {
    const unboundFacts = structuredClone(facts);
    const criticality = unboundFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    const coreFinding = criticality.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/core/state-machine.test.ts'
    );
    coreFinding.bindings = coreFinding.bindings.filter(
      (binding: any) => binding.selectionRef !== 'script:test:core-state-machine'
    );
    const metadataPolicy = structuredClone(policy);
    metadataPolicy.classification.directoryRules[0].capabilityRefs = ['state-machine'];

    const catalog = projectFixture({ facts: unboundFacts, policy: metadataPolicy });
    const core = catalog.tests.find(
      (test: any) => test.testPath === 'tests/core/state-machine.test.ts'
    );

    expect(core.capabilityRefs).toEqual(['state-machine']);
    expect(core.selectionRefs).toEqual([]);
    expect(core.lifecycleState).toBe('retained_on_demand');
    expect(catalog.gates.protectedCapabilityWithoutCoreTestCount).toBe(1);
  });

  it('binds protected capability from direct survival evidence only when explicitly enabled', () => {
    const unboundFacts = structuredClone(facts);
    const criticality = unboundFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    const coreFinding = criticality.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/core/state-machine.test.ts'
    );
    coreFinding.bindings = coreFinding.bindings.filter(
      (binding: any) => binding.selectionRef !== 'script:test:core-state-machine'
    );
    const semanticPolicy = structuredClone(policy);
    semanticPolicy.protectedCapabilities[0].bindTestsBySurvivalEvidence = true;

    const catalog = projectFixture({ facts: unboundFacts, policy: semanticPolicy });
    const core = catalog.tests.find(
      (test: any) => test.testPath === 'tests/core/state-machine.test.ts'
    );

    expect(core.selectionRefs).toEqual([]);
    expect(core.behaviorEvidence).toMatchObject({
      'target:src/state-machine.ts': 'direct',
    });
    expect(core.capabilityRefs).toEqual(['state-machine']);
    expect(core.classifications.protectedCapabilityRefs).toEqual(['state-machine']);
    expect(catalog.gates.protectedCapabilityWithoutCoreTestCount).toBe(0);
  });

  it('keeps policy trace and feature refs as metadata rather than behavior evidence', () => {
    const catalog = projectFixture({
      changedPaths: [],
      featureBindings: {
        'vitest#tests/feature/new-behavior.test.ts': {
          active: true,
          featureRef: 'feature:active-catalog-work',
        },
      },
    });
    const core = catalog.tests.find(
      (test: any) => test.testPath === 'tests/core/state-machine.test.ts'
    );
    const feature = catalog.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );

    expect(core.traceRefs).toEqual(['trace:state-machine']);
    expect(core.behaviorEvidence).not.toHaveProperty('trace:state-machine');
    expect(feature.featureRefs).toEqual([
      'feature:active-catalog-work',
      'feature:catalog-generation',
    ]);
    expect(feature.behaviorEvidence).not.toHaveProperty('feature:active-catalog-work');
    expect(feature.behaviorEvidence).not.toHaveProperty('feature:catalog-generation');
  });

  it('projects only tracked semantic evidence bindings into behavior evidence', () => {
    const semanticPolicy = structuredClone(policy);
    const semanticFacts = structuredClone(facts);
    const semanticOracleEvidenceRef =
      'source:tests/core/state-machine.test.ts#test:rejects%20invalid%20state:case:1:assertion:1';
    const oracleResult = semanticFacts.analyzerResults.find(
      (result: any) => result.dimension === 'oracleEffectiveness'
    );
    const oracleFinding = oracleResult.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/core/state-machine.test.ts'
    );
    oracleFinding.evidenceRefs.push(semanticOracleEvidenceRef);
    semanticPolicy.protectedCapabilities[0].survivalEvidenceRefs = [
      'target:src/main-agent-state-machine.ts',
    ];
    semanticPolicy.protectedCapabilities[0].requiredBehaviors = {
      'requirement_confirmation/state_entry': {
        anyOfEvidenceRefs: ['trace:six-model/requirement-confirmation/state-entry'],
        evidenceKind: 'direct',
      },
    };
    semanticPolicy.semanticEvidenceBindings = [
      {
        runnerId: 'vitest',
        testPath: 'tests/core/state-machine.test.ts',
        bindings: [
          {
            evidenceRef: 'trace:six-model/requirement-confirmation/state-entry',
            evidenceKind: 'direct',
            oracleAuthority: {
              independence: 'independent',
              evidenceRefs: [semanticOracleEvidenceRef],
            },
          },
        ],
      },
    ];

    const catalog = projectFixture({ policy: semanticPolicy, facts: semanticFacts });
    const core = catalog.tests.find(
      (test: any) => test.testPath === 'tests/core/state-machine.test.ts'
    );

    expect(core.behaviorEvidence).toMatchObject({
      'trace:six-model/requirement-confirmation/state-entry': 'direct',
    });
    expect(core.behaviorOracleAuthority).toEqual({
      'trace:six-model/requirement-confirmation/state-entry': {
        evidenceRefs: [semanticOracleEvidenceRef],
        oracleIndependence: 'independent',
      },
    });

    const unresolvedPolicy = structuredClone(semanticPolicy);
    unresolvedPolicy.semanticEvidenceBindings[0].bindings[0].oracleAuthority.evidenceRefs = [
      'source:tests/core/state-machine.test.ts#test:missing%20assertion:case:1:assertion:1',
    ];
    expect(() => projectFixture({ policy: unresolvedPolicy, facts: semanticFacts })).toThrow(
      'CATALOG_SEMANTIC_ORACLE_EVIDENCE_UNRESOLVED'
    );
  });

  it('projects real repository facts with every tracked protected capability binding', async () => {
    const trackedPolicy = JSON.parse(readFileSync(TRACKED_POLICY_PATH, 'utf8'));
    const realFacts = await collectAuditFacts({
      repoRoot: process.cwd(),
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings: {},
    });
    const fixtureAssetPrefix = 'tests/fixtures/';
    expect(
      realFacts.discovery.runnerResolved.some((testPath: string) =>
        testPath.startsWith(fixtureAssetPrefix)
      )
    ).toBe(false);
    expect(
      realFacts.discovery.candidates.some((testPath: string) =>
        testPath.startsWith(fixtureAssetPrefix)
      )
    ).toBe(false);
    expect(
      realFacts.inventory.tests.some((test: any) => test.testPath.startsWith(fixtureAssetPrefix))
    ).toBe(false);
    const criticality = realFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    const bindings = criticality.findings.flatMap((finding: any) => finding.bindings || []);
    const selectionRefs = new Set(
      bindings
        .map((binding: any) => binding.selectionRef)
        .filter((selectionRef: unknown) => typeof selectionRef === 'string')
    );
    expect(
      trackedPolicy.protectedCapabilities
        .filter((capability: any) => capability.bindTestsBySurvivalEvidence !== true)
        .every((capability: any) =>
          capability.selectionRefs.some((selectionRef: string) => selectionRefs.has(selectionRef))
        )
    ).toBe(true);
    expect(
      bindings
        .filter((binding: any) => binding.selectionRef)
        .every((binding: any) =>
          binding.evidenceRef.startsWith('source:package.json#testPortfolioAudit.criticalBindings[')
        )
    ).toBe(true);

    const catalog = projectTestCatalog({ facts: realFacts, policy: trackedPolicy });
    const unboundCapabilities = trackedPolicy.protectedCapabilities
      .filter(
        (capability: any) =>
          !catalog.tests.some((test: any) => test.capabilityRefs.includes(capability.capabilityId))
      )
      .map((capability: any) => capability.capabilityId);
    expect(catalog.tests).toHaveLength(realFacts.inventory.tests.length);
    expect(unboundCapabilities).toEqual([]);
    expect(catalog.gates.reconciliationErrorCount).toBe(0);
    expect(catalog.gates.protectedCapabilityWithoutCoreTestCount).toBe(0);
    expect(catalog.gates.executableBudgetStatus).toBe(
      realFacts.inventory.tests.length > trackedPolicy.budgets.executableTestCount
        ? 'over_budget'
        : 'within_budget'
    );

    const timingSummary = createBootstrapTimingSummary();
    const timingContext = {
      expectedCommitSha: '0000000000000000000000000000000000000000',
      expectedEnvironmentClass: 'test-bootstrap',
    };
    const frozen = freezeCorePortfolio({
      catalog,
      facts: realFacts,
      policy: trackedPolicy,
      timingSummary,
      timingContext,
    });
    expect(frozen.selected.length).toBeGreaterThan(0);
    const uncoveredAtomicBehaviors = frozen.coverage.filter(
      (entry: any) =>
        entry.applicability === 'applicable' &&
        !['covered', 'indirectly_covered'].includes(entry.status)
    );
    expect(uncoveredAtomicBehaviors).toEqual([]);
    const expectedGaps = [
      ...uncoveredAtomicBehaviors.map((entry: any) => ({
        obligationId: entry.obligationId,
        reason: 'missing_test',
      })),
      ...(realFacts.inventory.tests.length > trackedPolicy.budgets.executableTestCount
        ? [
            {
              reason: 'executable_budget_exceeded',
              actual: realFacts.inventory.tests.length,
              budget: trackedPolicy.budgets.executableTestCount,
            },
          ]
        : []),
    ];
    expect(frozen.gaps).toHaveLength(expectedGaps.length);
    expect(frozen.gaps).toEqual(expect.arrayContaining(expectedGaps));

    const scratchRoot = join(process.cwd(), '.codex-tmp');
    mkdirSync(scratchRoot, { recursive: true });
    const inputRoot = mkdtempSync(join(scratchRoot, 'tracked-core-freeze-'));
    const outputRoot = join(
      process.cwd(),
      '.artifacts',
      'test-portfolio',
      `tracked-core-freeze-${basename(inputRoot)}`
    );
    mkdirSync(outputRoot, { recursive: true });
    temporaryRoots.push(inputRoot, outputRoot);
    const catalogPath = join(inputRoot, 'catalog.json');
    const factsPath = join(inputRoot, 'facts.json');
    const timingPath = join(inputRoot, 'timing.json');
    const outputPath = join(outputRoot, 'core-freeze.json');
    writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`, 'utf8');
    writeFileSync(factsPath, `${JSON.stringify(materializeCatalogFacts(realFacts))}\n`, 'utf8');
    writeFileSync(timingPath, `${JSON.stringify(timingSummary)}\n`, 'utf8');

    expect(
      runFreezeCli([
        '--catalog',
        relative(process.cwd(), catalogPath),
        '--policy',
        relative(process.cwd(), TRACKED_POLICY_PATH),
        '--facts',
        relative(process.cwd(), factsPath),
        '--timing-summary',
        relative(process.cwd(), timingPath),
        '--commit-sha',
        timingContext.expectedCommitSha,
        '--environment-class',
        timingContext.expectedEnvironmentClass,
        '--output',
        relative(process.cwd(), outputPath),
      ])
    ).toBe(0);
    const cliFreeze = JSON.parse(readFileSync(outputPath, 'utf8'));
    expect(cliFreeze.gaps).toEqual(frozen.gaps);
    expect(cliFreeze.selected).toEqual(frozen.selected);
  }, 300_000);

  it('keeps higher-authority lifecycle evidence ahead of lower-authority candidates', () => {
    const catalog = projectFixture({
      changedPaths: ['tests/core/state-machine.test.ts', 'tests/redundant/duplicate.test.ts'],
    });
    const states = Object.fromEntries(
      catalog.tests.map((test: any) => [test.testPath, test.lifecycleState])
    );

    expect(states['tests/core/state-machine.test.ts']).toBe('feature_working_set');
    expect(states['tests/redundant/duplicate.test.ts']).toBe('feature_working_set');
  });

  it('uses the most-specific directory rule before an explicit state exception', () => {
    const orderedPolicy = structuredClone(policy);
    orderedPolicy.classification.directoryRules.unshift({
      ruleId: 'all-tests',
      pattern: 'tests/**',
      state: 'deletion_candidate',
    });

    const fromSpecificRule = projectFixture({
      changedPaths: [],
      policy: orderedPolicy,
    }).tests.find((test: any) => test.testPath === 'tests/on-demand/platform.test.ts');
    expect(fromSpecificRule.lifecycleState).toBe('retained_on_demand');

    orderedPolicy.classification.exceptions.push({
      testPath: 'tests/on-demand/platform.test.ts',
      state: 'deletion_candidate',
    });
    const fromException = projectFixture({
      changedPaths: [],
      policy: orderedPolicy,
    }).tests.find((test: any) => test.testPath === 'tests/on-demand/platform.test.ts');
    expect(fromException.lifecycleState).toBe('deletion_candidate');
    expect(fromException.classifications.lifecycleReason.kind).toBe('policy_exception');
  });

  it('keeps release gate membership independent from lifecycle state', () => {
    const onDemand = projectFixture().tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );

    expect(onDemand.releaseGateMembership).toBe('explicit');
    expect(onDemand.lifecycleState).toBe('retained_on_demand');
    expect(onDemand.capabilityRefs).toEqual([]);
    expect(onDemand.behaviorEvidence).toEqual({
      'target:src/platform.ts': 'direct',
    });
  });

  it.each([
    ['duplicate', 'duplicate'],
    ['TARGET_REMOVED', 'target_removed'],
    ['SELF_PROVING_ORACLE', 'self_proving_oracle'],
    ['generic deterministic', 'generic'],
  ] as const)('requires explicit approval for %s deletion candidates', (_label, kind) => {
    const unapproved = candidateCatalog(kind, false).tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );
    const approved = candidateCatalog(kind, true).tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );

    expect(unapproved.lifecycleState).toBe('retained_on_demand');
    expect(approved.lifecycleState).toBe('deletion_candidate');
    expect(approved.classifications.lifecycleReason.kind).toBe('approved_deterministic_candidate');
  });

  it('uses an active feature binding as feature-working authority', () => {
    const catalog = projectFixture({
      changedPaths: [],
      featureBindings: {
        'vitest#tests/feature/new-behavior.test.ts': {
          active: true,
          featureRefs: ['feature:active-catalog-work'],
        },
      },
    });
    const feature = catalog.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );

    expect(feature.lifecycleState).toBe('feature_working_set');
    expect(feature.featureRefs).toEqual([
      'feature:active-catalog-work',
      'feature:catalog-generation',
    ]);
    expect(feature.classifications.lifecycleReason).toEqual({
      kind: 'active_feature_binding',
      refs: ['feature:active-catalog-work'],
    });
  });

  it('fails closed on the four reconciliation and classification gates', () => {
    const catalog = projectFixture();

    for (const issueCode of [
      'CATALOG_RUNNER_ONLY',
      'CATALOG_CANDIDATE_ONLY',
      'CATALOG_IDENTITY_DUPLICATE',
      'CATALOG_TEST_UNCLASSIFIED',
    ]) {
      const invalid = facts.invalidCatalogs[issueCode];
      expect(() =>
        validateTestCatalog({
          ...catalog,
          ...invalid,
          gates: { ...catalog.gates, ...invalid.gates },
        })
      ).toThrow(issueCode);
    }
  });

  it.each([
    [
      'runner-only discovery',
      'CATALOG_RUNNER_ONLY',
      (invalidFacts: any) => {
        invalidFacts.discovery.unexplainedRunnerOnlyCount = 1;
        invalidFacts.discovery.unexplainedRunnerOnly = ['tests/runner-only.test.ts'];
      },
    ],
    [
      'candidate-only discovery',
      'CATALOG_CANDIDATE_ONLY',
      (invalidFacts: any) => {
        invalidFacts.discovery.unexplainedCandidateOnlyCount = 1;
        invalidFacts.discovery.unexplainedCandidateOnly = ['tests/candidate-only.test.ts'];
      },
    ],
    [
      'duplicate inventory identity',
      'CATALOG_IDENTITY_DUPLICATE',
      (invalidFacts: any) => {
        invalidFacts.inventory.tests.push(structuredClone(invalidFacts.inventory.tests[0]));
      },
    ],
    [
      'unclassified inventory identity',
      'CATALOG_TEST_UNCLASSIFIED',
      (invalidFacts: any) => {
        invalidFacts.inventory.tests.push({
          identityKey: 'vitest#uncovered/orphan.test.ts',
          runnerId: 'vitest',
          testPath: 'uncovered/orphan.test.ts',
          executableIdentity: 'vitest::uncovered/orphan.test.ts',
          evidenceRefs: ['source:uncovered/orphan.test.ts'],
        });
      },
    ],
  ])('fails closed from facts for %s', (_label, issueCode, mutate) => {
    const invalidFacts = structuredClone(facts);
    mutate(invalidFacts);

    expect(() => projectFixture({ facts: invalidFacts })).toThrow(issueCode);
  });

  it('preserves a missing protected capability binding as a downstream coverage gap', () => {
    const invalidFacts = structuredClone(facts);
    const criticality = invalidFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    const core = criticality.findings.find(
      (finding: any) => finding.identityKey === 'vitest#tests/core/state-machine.test.ts'
    );
    core.bindings = core.bindings.filter(
      (binding: any) => binding.selectionRef !== 'script:test:core-state-machine'
    );

    const catalog = projectFixture({ facts: invalidFacts });

    expect(catalog.gates.protectedCapabilityWithoutCoreTestCount).toBe(1);
  });

  it('reports a stable error for a malformed inventory identity', () => {
    const invalidFacts = structuredClone(facts);
    invalidFacts.inventory.tests[0] = null;

    expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
  });

  it('fails closed when an inventory executable identity disagrees with its runner and path', () => {
    const invalidFacts = structuredClone(facts);
    invalidFacts.inventory.tests[0].executableIdentity = 'node::tests/core/state-machine.test.ts';

    expect(() => projectFixture({ facts: invalidFacts })).toThrow(
      'CATALOG_EXECUTABLE_IDENTITY_MISMATCH'
    );
  });

  it('rejects an inventory identity whose required fields come from Object.prototype', () => {
    const invalidFacts = structuredClone(facts);
    const inheritedIdentity = invalidFacts.inventory.tests[0];
    invalidFacts.inventory.tests[0] = {};

    withObjectPrototypeValues(inheritedIdentity, () => {
      expect(JSON.stringify(invalidFacts.inventory.tests[0])).toBe('{}');
      expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
    });
  });

  it('rejects optional inventory refs inherited from Object.prototype', () => {
    const invalidFacts = structuredClone(facts);
    delete invalidFacts.inventory.tests[0].capabilityRefs;
    delete invalidFacts.inventory.tests[0].failureModeRefs;

    withObjectPrototypeValues(
      {
        capabilityRefs: ['prototype-capability'],
        failureModeRefs: ['prototype-failure-mode'],
      },
      () => {
        expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
      }
    );
  });

  it.each([
    ['spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
  ])('rejects a whitespace-only failure-mode reference from inventory: %s', (_label, value) => {
    const invalidFacts = structuredClone(facts);
    invalidFacts.inventory.tests[0].failureModeRefs = [value];

    expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
  });

  it.each([
    ['spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
  ])('rejects a whitespace-only capability reference from inventory: %s', (_label, value) => {
    const invalidFacts = structuredClone(facts);
    invalidFacts.inventory.tests[0].capabilityRefs = [value];

    expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
  });

  it.each([
    ['spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
  ])(
    'rejects a whitespace-only failure-mode reference in Catalog validation: %s',
    (_label, value) => {
      const invalidCatalog = structuredClone(projectFixture());
      invalidCatalog.tests[0].failureModeRefs = [value];

      expect(() => validateTestCatalog(invalidCatalog)).toThrow(
        'CATALOG_FAILURE_MODE_REFS_INVALID'
      );
    }
  );

  it.each([
    ['spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
  ])(
    'rejects a whitespace-only capability reference in Catalog validation: %s',
    (_label, value) => {
      const invalidCatalog = structuredClone(projectFixture());
      invalidCatalog.tests[0].capabilityRefs = [value];

      expect(() => validateTestCatalog(invalidCatalog)).toThrow('CATALOG_CAPABILITY_REFS_INVALID');
    }
  );

  it.each([
    [
      'missing discovery',
      (invalidFacts: any) => {
        delete invalidFacts.discovery;
      },
    ],
    [
      'missing discovery completion',
      (invalidFacts: any) => {
        delete invalidFacts.discovery.complete;
      },
    ],
    [
      'incomplete discovery',
      (invalidFacts: any) => {
        invalidFacts.discovery.complete = false;
      },
    ],
    [
      'string count',
      (invalidFacts: any) => {
        invalidFacts.discovery.runnerResolvedCount = '4';
      },
    ],
    [
      'negative count',
      (invalidFacts: any) => {
        invalidFacts.discovery.candidateCount = -1;
      },
    ],
    [
      'string list',
      (invalidFacts: any) => {
        invalidFacts.discovery.unexplainedRunnerOnly = 'tests/runner-only.test.ts';
      },
    ],
    [
      'missing list',
      (invalidFacts: any) => {
        delete invalidFacts.discovery.candidates;
      },
    ],
  ])('rejects invalid discovery facts: %s', (_label, mutate) => {
    const invalidFacts = structuredClone(facts);
    mutate(invalidFacts);

    expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
  });

  it.each([
    ['runnerResolvedCount', 'runnerResolved'],
    ['candidateCount', 'candidates'],
    ['unexplainedRunnerOnlyCount', 'unexplainedRunnerOnly'],
    ['unexplainedCandidateOnlyCount', 'unexplainedCandidateOnly'],
  ] as const)('rejects a discovery %s mismatch with %s', (countField, listField) => {
    const invalidFacts = structuredClone(facts);
    invalidFacts.discovery[countField] += 1;

    expect(invalidFacts.discovery[countField]).not.toBe(invalidFacts.discovery[listField].length);
    expect(() => projectFixture({ facts: invalidFacts })).toThrow('CATALOG_FACTS_INVALID');
  });

  it('produces stable canonical bytes and hashes independent of inventory order', () => {
    const first = projectFixture();
    const second = projectFixture({
      facts: {
        ...facts,
        inventory: { tests: [...facts.inventory.tests].reverse() },
        analyzerResults: [...facts.analyzerResults].reverse(),
      },
    });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(sha256Bytes(canonicalJsonBytes(first))).toBe(sha256Bytes(canonicalJsonBytes(second)));
  });

  it('hashes order-insensitive policy sections by semantic content', () => {
    const reorderedPolicy = structuredClone(policy);
    reorderedPolicy.classification.directoryRules.reverse();

    const first = projectFixture({ policy });
    const second = projectFixture({ policy: reorderedPolicy });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(sha256Bytes(canonicalJsonBytes(first))).toBe(sha256Bytes(canonicalJsonBytes(second)));
  });

  it('normalizes every policy path field before hashing semantic policy content', () => {
    const canonicalPolicy = structuredClone(policy);
    canonicalPolicy.classification.exceptions = [
      {
        testPath: 'tests/on-demand/platform.test.ts',
        traceRefs: ['trace:platform-policy-exception'],
      },
    ];
    canonicalPolicy.selection.highDiffusionPathRules = ['tests/feature/**'];

    const equivalentPolicy = structuredClone(canonicalPolicy);
    equivalentPolicy.classification.directoryRules.find(
      (rule: any) => rule.ruleId === 'core-tests'
    ).pattern = '.\\tests\\core\\**';
    equivalentPolicy.classification.exceptions[0].testPath =
      '.\\tests\\on-demand\\platform.test.ts';
    equivalentPolicy.selection.highDiffusionPathRules = ['.\\tests\\feature\\**'];

    const first = projectFixture({ policy: canonicalPolicy });
    const second = projectFixture({ policy: equivalentPolicy });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(sha256Bytes(canonicalJsonBytes(first))).toBe(sha256Bytes(canonicalJsonBytes(second)));
  });

  it('keeps canonical bytes stable across semantically equivalent analyzer and candidate order', () => {
    const identityKey = 'vitest#tests/on-demand/platform.test.ts';
    const semanticFacts = structuredClone(facts);
    const criticality = semanticFacts.analyzerResults.find(
      (result: any) => result.dimension === 'criticality'
    );
    criticality.findings.push({
      identityKey,
      value: 'standard',
      confidence: 'medium',
      bindings: [
        {
          kind: 'consumer_compatibility',
          evidenceRef: 'source:tests/on-demand/platform.test.ts#compatibility',
        },
        {
          kind: 'active_regression_binding',
          evidenceRef: 'source:tests/on-demand/platform.test.ts#regression',
        },
      ],
      evidenceRefs: [
        'source:tests/on-demand/platform.test.ts#candidate-z',
        'source:tests/on-demand/platform.test.ts#candidate-shared',
      ],
      issueCodes: ['REPLACEMENT_PROVEN', 'REPLACEMENT_INDEPENDENT'],
      approved: true,
      deterministicReasonCode: 'REPLACED_BY_CONTRACT_TEST',
      releaseGateMembership: 'explicit',
    });
    semanticFacts.analyzerResults.push({
      analyzerId: 'replacement-evidence',
      dimension: 'replacementEvidence',
      status: 'complete',
      findings: [
        {
          identityKey,
          value: 'replacement_candidate',
          confidence: 'high',
          bindings: [
            {
              kind: 'consumer_compatibility',
              evidenceRef: 'source:tests/on-demand/platform.test.ts#replacement',
            },
          ],
          evidenceRefs: [
            'source:tests/on-demand/platform.test.ts#candidate-a',
            'source:tests/on-demand/platform.test.ts#candidate-shared',
          ],
          issueCodes: ['REPLACEMENT_INDEPENDENT', 'REPLACEMENT_PROVEN'],
          approved: true,
          deterministicReasonCode: 'REPLACED_BY_CONTRACT_TEST',
        },
      ],
      issues: [],
    });

    const reorderedFacts = structuredClone(semanticFacts);
    reorderedFacts.analyzerResults = reorderedFacts.analyzerResults
      .reverse()
      .map((result: any) => ({
        ...result,
        findings: [...result.findings].reverse().map((finding: any) => ({
          ...finding,
          bindings: [...(finding.bindings || [])].reverse(),
          evidenceRefs: [...(finding.evidenceRefs || [])].reverse(),
          issueCodes: [...(finding.issueCodes || [])].reverse(),
        })),
      }));

    const first = projectFixture({ facts: semanticFacts, changedPaths: [] });
    const second = projectFixture({ facts: reorderedFacts, changedPaths: [] });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(sha256Bytes(canonicalJsonBytes(first))).toBe(sha256Bytes(canonicalJsonBytes(second)));
  });

  it('keeps all executable identities when the migration baseline is over budget', () => {
    const catalog = overBudgetCatalog();
    const expectedTestCount = policy.budgets.executableTestCount + 1;

    expect(catalog.tests).toHaveLength(expectedTestCount);
    expect(catalog.gates.executableTestCount).toBe(expectedTestCount);
    expect(catalog.gates.executableBudgetStatus).toBe('over_budget');
  });

  it('leaves permanent-core budget enforcement to weighted set-cover', () => {
    const lowerBudgetPolicy = structuredClone(policy);
    lowerBudgetPolicy.budgets.corePermanentCount = 0;

    const catalog = projectFixture({ policy: lowerBudgetPolicy });

    expect(catalog.gates.corePermanentCount).toBe(0);
    expect(catalog.tests.every((test: any) => test.lifecycleState !== 'core_permanent')).toBe(true);
  });
});

describe('Test Catalog hard gates', () => {
  it.each(INTEGER_GATE_FIELDS)('requires the %s hard gate field', (field) => {
    const catalog = projectFixture();
    delete catalog.gates[field];

    expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_GATE_INVALID');
  });

  it.each([
    ['null', null],
    ['negative', -1],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects a %s hard gate value', (_label, value) => {
    const catalog = projectFixture();
    catalog.gates.executableTestCount = value;

    expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_GATE_INVALID');
  });

  it.each([
    ['executableTestCount', 3],
    ['corePermanentCount', 1],
    ['reconciliationErrorCount', 1],
  ] as const)('rejects a tampered recomputable %s', (field, value) => {
    const catalog = projectFixture();
    catalog.gates[field] = value;

    expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_GATE_COUNT_MISMATCH');
  });

  it('rejects lifecycle states without their authoritative reason', () => {
    const catalog = projectFixture();
    const missingFeatureAuthority = structuredClone(catalog);
    const feature = missingFeatureAuthority.tests.find(
      (test: any) => test.lifecycleState === 'feature_working_set'
    );
    delete feature.classifications.lifecycleReason;
    expect(() => validateTestCatalog(missingFeatureAuthority)).toThrow(
      'CATALOG_FEATURE_AUTHORITY_MISSING'
    );
  });

  it('rejects multiple or unknown lifecycle states and generated paths outside governance', () => {
    const multiple = structuredClone(projectFixture());
    multiple.tests[0].lifecycleState = ['core_permanent', 'retained_on_demand'];
    expect(() => validateTestCatalog(multiple)).toThrow('CATALOG_LIFECYCLE_STATE_MULTIPLE');

    const unknown = structuredClone(projectFixture());
    unknown.tests[0].lifecycleState = 'archived';
    expect(() => validateTestCatalog(unknown)).toThrow('CATALOG_LIFECYCLE_STATE_UNKNOWN');

    const outside = { ...projectFixture(), generatedPath: '.artifacts/ci/test-catalog.json' };
    expect(() => validateTestCatalog(outside)).toThrow('CATALOG_GENERATED_PATH_OUTSIDE_ROOT');
  });

  it.each([
    ['.artifacts/test-portfolio/other.json', 'CATALOG_GENERATED_PATH_INVALID'],
    ['.artifacts/test-portfolio-other/test-catalog.json', 'CATALOG_GENERATED_PATH_OUTSIDE_ROOT'],
  ] as const)('rejects noncanonical generated path %s', (generatedPath, issueCode) => {
    const catalog = { ...projectFixture(), generatedPath };

    expect(() => validateTestCatalog(catalog)).toThrow(issueCode);
  });

  it('rejects a malformed catalog test before duplicate reconciliation', () => {
    const catalog = projectFixture();
    catalog.tests[0] = null;

    expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_TEST_FIELD_MISSING');
  });

  it('validates a protected capability gap for downstream freeze enforcement', () => {
    const catalog = projectFixture();
    const validated = validateTestCatalog({
      ...catalog,
      gates: {
        ...catalog.gates,
        protectedCapabilityWithoutCoreTestCount: 1,
      },
    });

    expect(validated.gates.protectedCapabilityWithoutCoreTestCount).toBe(1);
  });

  it('recomputes duplicate identities instead of trusting a zero gate', () => {
    const duplicate = structuredClone(projectFixture());
    duplicate.tests.push(structuredClone(duplicate.tests[0]));
    duplicate.gates.catalogIdentityDuplicateCount = 0;

    expect(() => validateTestCatalog(duplicate)).toThrow('CATALOG_IDENTITY_DUPLICATE');
  });

  it('rejects any Catalog that preselects permanent-core tests', () => {
    expect(() => validateTestCatalog(corePermanentCatalog(1))).toThrow(
      'CATALOG_STATIC_CORE_FORBIDDEN'
    );
  });

  it('rejects a Catalog whose required fields come from Object.prototype', () => {
    const inheritedCatalog = projectFixture();

    withObjectPrototypeValues(inheritedCatalog, () => {
      const ownCatalog = {};
      expect(JSON.stringify(ownCatalog)).toBe('{}');
      expect(() => validateTestCatalog(ownCatalog)).toThrow('CATALOG_SCHEMA_VERSION_INVALID');
    });
  });

  it.each(['repository', 'policyHash'])(
    'rejects a Catalog whose required %s comes from Object.prototype',
    (field) => {
      const catalog = projectFixture();
      const inheritedValue = catalog[field];
      delete catalog[field];

      withObjectPrototypeValues({ [field]: inheritedValue }, () => {
        expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_SCHEMA_INVALID');
      });
    }
  );

  it('rejects an executable budget status inherited from Object.prototype', () => {
    const catalog = projectFixture();
    const executableBudgetStatus = catalog.gates.executableBudgetStatus;
    delete catalog.gates.executableBudgetStatus;

    withObjectPrototypeValues({ executableBudgetStatus }, () => {
      expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_GATE_INVALID');
    });
  });

  it('rejects a Catalog test record whose JSON fields are inherited', () => {
    const catalog = projectFixture();
    const inheritedRecord = Object.create(catalog.tests[0]);
    expect(JSON.stringify(inheritedRecord)).toBe('{}');
    catalog.tests[0] = inheritedRecord;

    expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_TEST_FIELD_MISSING');
  });

  it('rejects an own JSON test record whose required fields come from Object.prototype', () => {
    const catalog = projectFixture();
    const inheritedRecord = catalog.tests[0];
    catalog.tests[0] = {};

    withObjectPrototypeValues(inheritedRecord, () => {
      expect(JSON.stringify(catalog.tests[0])).toBe('{}');
      expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_TEST_FIELD_MISSING');
    });
  });

  it('rejects a self-reported executable budget that hides an over-budget catalog', () => {
    const catalog = overBudgetCatalog();
    catalog.gates.executableTestBudget = catalog.gates.executableTestCount;
    catalog.gates.executableBudgetStatus = 'within_budget';

    expect(() => validateTestCatalog(catalog)).toThrow('CATALOG_EXECUTABLE_BUDGET_INVALID');
  });

  it('rejects a self-reported status that hides an over-budget catalog', () => {
    const overBudget = overBudgetCatalog();
    overBudget.gates.executableBudgetStatus = 'within_budget';

    expect(() => validateTestCatalog(overBudget)).toThrow(
      'CATALOG_EXECUTABLE_BUDGET_STATUS_INVALID'
    );

    const withinBudget = projectFixture();
    withinBudget.gates.executableBudgetStatus = 'over_budget';
    expect(() => validateTestCatalog(withinBudget)).toThrow(
      'CATALOG_EXECUTABLE_BUDGET_STATUS_INVALID'
    );
  });
});

describe('Test Catalog writer', () => {
  it('keeps the semantic Facts hash stable across volatile worktree diagnostics', () => {
    const firstFacts = {
      ...facts,
      durations: {
        probeMs: 0,
        staticAnalysisMs: 9691,
        totalMs: 9691,
      },
      sourceIndex: {
        repoRoot: 'D:/tmp/test-portfolio-static-view-first',
      },
    };
    const secondFacts = {
      ...facts,
      durations: {
        probeMs: 1,
        staticAnalysisMs: 10570,
        totalMs: 10571,
      },
      sourceIndex: {
        repoRoot: 'D:/tmp/test-portfolio-static-view-second',
      },
    };

    expect(materializeCatalogFacts(firstFacts).durations).toEqual(firstFacts.durations);
    expect(materializeCatalogFacts(firstFacts).sourceIndex.repoRoot).toBe(
      firstFacts.sourceIndex.repoRoot
    );
    expect(catalogFactsHash(firstFacts)).toBe(catalogFactsHash(secondFacts));
    expect(
      catalogFactsHash({
        ...secondFacts,
        sourceIndex: {
          ...secondFacts.sourceIndex,
          productionEdges: [{ from: 'src/public.ts', to: 'src/internal.ts' }],
        },
      })
    ).not.toBe(catalogFactsHash(secondFacts));
  });

  it('persists the exact canonical Facts authority consumed by Core Freeze and impact selection', () => {
    const repoRoot = temporaryRoot();
    const receipt = writeCatalogFacts({ repoRoot, facts });
    const expectedPath = join(repoRoot, '.artifacts', 'test-portfolio', 'test-catalog-facts.json');
    const expectedBytes = canonicalJsonBytes(materializeCatalogFacts(facts));

    expect(receipt).toEqual({
      path: expectedPath,
      sha256: sha256Bytes(expectedBytes),
    });
    expect(readFileSync(expectedPath)).toEqual(expectedBytes);
  });

  it('writes canonical UTF-8 bytes to the exact governed path and returns its receipt', () => {
    const repoRoot = temporaryRoot();
    const catalog = projectFixture();

    const receipt = writeTestCatalog({ repoRoot, catalog });
    const expectedPath = join(repoRoot, '.artifacts', 'test-portfolio', 'test-catalog.json');
    const expectedBytes = canonicalJsonBytes(catalog);

    expect(receipt).toEqual({
      path: expectedPath,
      sha256: sha256Bytes(expectedBytes),
      testCount: 4,
    });
    expect(readFileSync(expectedPath)).toEqual(expectedBytes);
  });

  it('rejects any requested output outside the exact catalog path', () => {
    const repoRoot = temporaryRoot();
    const outside = join(repoRoot, '.artifacts', 'ci');

    expect(() =>
      writeTestCatalog({
        repoRoot,
        catalog: projectFixture(),
        outputDir: outside,
      })
    ).toThrow();
    expect(existsSync(join(outside, 'test-catalog.json'))).toBe(false);
  });
});
