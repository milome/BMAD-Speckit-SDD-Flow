import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { closeFeaturePortfolio } = require('../../tools/ci/feature-closeout.cjs');
const {
  projectTestCatalog,
  validateTestCatalog,
} = require('../../tools/ci/generate-test-catalog.cjs');

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/test-portfolio/feature-closeout.json'), 'utf8')
);
const catalogFacts = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/test-portfolio/catalog-facts.json'), 'utf8')
);
const catalogPolicy = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/test-portfolio/catalog-policy.json'), 'utf8')
);

function catalog(
  states: Record<string, string>,
  overrides: Record<string, Record<string, unknown>> = {}
) {
  return {
    schemaVersion: 'test-catalog/v1',
    tests: Object.entries(states).map(([identityKey, lifecycleState]) => {
      const [runnerId, testPath] = identityKey.split('::');
      return {
        identityKey,
        testPath,
        runnerId,
        lifecycleState,
        capabilityRefs: [],
        failureModeRefs: [],
        featureRefs: ['feature:test-selection'],
        classifications: { oracleEffectiveness: 'effective' },
        ...overrides[identityKey],
      };
    }),
  };
}

function close(overrides: Record<string, unknown> = {}) {
  return closeFeaturePortfolio({
    catalog: {
      schemaVersion: 'test-catalog/v1',
      tests: structuredClone(fixture.tests),
    },
    policy: structuredClone(fixture.policy),
    featureRef: fixture.featureRef,
    dispositions: {
      'vitest::tests/state-machine.test.ts': {
        action: 'promote_to_core',
        capabilityRef: 'six-model-state-machine',
      },
    },
    ...overrides,
  });
}

describe('Feature Closeout', () => {
  it('requires a disposition for every feature working-set test', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({
          'vitest::tests/a.test.ts': 'feature_working_set',
          'vitest::tests/b.test.ts': 'feature_working_set',
        }),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/a.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_DISPOSITION_MISSING');
  });

  it('does not treat inherited object keys as dispositions', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          { toString: 'feature_working_set' },
          {
            toString: {
              runnerId: 'vitest',
              testPath: 'tests/to-string.test.ts',
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {},
      })
    ).toThrow('FEATURE_CLOSEOUT_DISPOSITION_MISSING');
  });

  it('rejects non-plain disposition containers and records with identical JSON own bytes', () => {
    const identityKey = 'vitest::tests/state-machine.test.ts';
    const inheritedDispositions = Object.create({
      [identityKey]: {
        action: 'promote_to_core',
        capabilityRef: 'six-model-state-machine',
      },
    });
    expect(JSON.stringify(inheritedDispositions)).toBe('{}');
    expect(() => close({ dispositions: inheritedDispositions })).toThrow(
      'FEATURE_CLOSEOUT_DISPOSITIONS_INVALID'
    );

    const inheritedRecord = Object.create({
      action: 'promote_to_core',
      capabilityRef: 'six-model-state-machine',
    });
    const dispositions = { [identityKey]: inheritedRecord };
    expect(JSON.stringify(dispositions)).toBe(`{"${identityKey}":{}}`);
    expect(() => close({ dispositions })).toThrow('FEATURE_CLOSEOUT_DISPOSITION_INVALID');
  });

  it('rejects non-plain Catalog test records with identical JSON own bytes', () => {
    function catalogTest(prototype: Record<string, unknown>) {
      return Object.assign(Object.create(prototype), {
        identityKey: 'vitest::tests/proto.test.ts',
        testPath: 'tests/proto.test.ts',
        capabilityRefs: [],
        failureModeRefs: [],
        classifications: { oracleEffectiveness: 'effective' },
      });
    }

    const active = catalogTest({
      lifecycleState: 'feature_working_set',
      featureRefs: ['feature:test-selection'],
    });
    const inactive = catalogTest({
      lifecycleState: 'retained_on_demand',
      featureRefs: [],
    });
    expect(JSON.stringify(active)).toBe(JSON.stringify(inactive));

    for (const test of [active, inactive]) {
      expect(() =>
        closeFeaturePortfolio({
          catalog: { schemaVersion: 'test-catalog/v1', tests: [test] },
          policy: structuredClone(fixture.policy),
          featureRef: 'feature:test-selection',
          dispositions: {
            'vitest::tests/proto.test.ts': { action: 'retain_on_demand' },
          },
        })
      ).toThrow('FEATURE_CLOSEOUT_CATALOG_TEST_INVALID');
    }
  });

  it('rejects ordinary deletion or downgrade of permanent core tests', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({ 'vitest::tests/core.test.ts': 'core_permanent' }),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/core.test.ts': { action: 'delete_after_closeout' },
        },
      })
    ).toThrow('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW');
  });

  it('promotes only an explicitly protected capability with an independent oracle', () => {
    const result = close();

    expect(result.updatedTests[0]).toMatchObject({
      lifecycleState: 'core_permanent',
      capabilityRefs: ['six-model-state-machine'],
      classifications: {
        oracleEffectiveness: 'effective',
        protectedCapabilityRefs: ['six-model-state-machine'],
        lifecycleReason: {
          kind: 'protected_capability_binding',
          refs: ['six-model-state-machine'],
        },
      },
    });
    expect(result.gates.unclosedFeatureWorkingTestCount).toBe(0);
    expect(result.gates.corePermanentCount).toBeLessThanOrEqual(120);
    expect(result.policyPatch).toEqual({
      classification: {
        exceptions: [
          {
            testPath: 'tests/state-machine.test.ts',
            capabilityRefs: ['six-model-state-machine'],
          },
        ],
      },
    });
  });

  it('rejects a protected capability outside the Product Survival perimeter', () => {
    const policy = structuredClone(fixture.policy);
    policy.protectedCapabilities.push({
      capabilityId: 'governance-proof-round-1',
      selectionRefs: ['script:test:governance-audit:round1'],
    });

    expect(() =>
      close({
        policy,
        dispositions: {
          'vitest::tests/state-machine.test.ts': {
            action: 'promote_to_core',
            capabilityRef: 'governance-proof-round-1',
          },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_CORE_CAPABILITY_NOT_PRODUCT_SURVIVAL');
  });

  it.each([
    [
      'policy',
      () => Object.create(structuredClone(fixture.policy)),
      'FEATURE_CLOSEOUT_POLICY_INVALID',
    ],
    [
      'selection',
      () => {
        const policy = structuredClone(fixture.policy);
        policy.selection = Object.create({
          productSurvivalCapabilityRefs: ['six-model-state-machine'],
        });
        return policy;
      },
      'FEATURE_CLOSEOUT_POLICY_SELECTION_INVALID',
    ],
    [
      'protected capability record',
      () => {
        const policy = structuredClone(fixture.policy);
        policy.protectedCapabilities = [
          Object.assign(Object.create({ capabilityId: 'six-model-state-machine' }), {
            selectionRefs: ['script:test:ci:codex'],
          }),
        ];
        return policy;
      },
      'FEATURE_CLOSEOUT_POLICY_PROTECTED_CAPABILITY_INVALID',
    ],
  ])('rejects prototype-inherited %s data', (_label, policyFactory, issueCode) => {
    expect(() => close({ policy: policyFactory() })).toThrow(issueCode);
  });

  it('rejects accessors without invoking them and remains deterministic across calls', () => {
    const input = {
      policy: structuredClone(fixture.policy),
      featureRef: fixture.featureRef,
      dispositions: {
        'vitest::tests/state-machine.test.ts': {
          action: 'promote_to_core',
          capabilityRef: 'six-model-state-machine',
        },
      },
    } as Record<string, unknown>;
    let reads = 0;
    Object.defineProperty(input, 'catalog', {
      enumerable: true,
      get() {
        reads += 1;
        return {
          schemaVersion: 'test-catalog/v1',
          tests: structuredClone(fixture.tests),
        };
      },
    });

    expect(() => closeFeaturePortfolio(input)).toThrow('FEATURE_CLOSEOUT_JSON_ACCESSOR_INVALID');
    expect(() => closeFeaturePortfolio(input)).toThrow('FEATURE_CLOSEOUT_JSON_ACCESSOR_INVALID');
    expect(reads).toBe(0);
  });

  it.each([
    ['function', () => undefined],
    ['symbol', Symbol('metadata')],
    ['BigInt', 1n],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects a non-JSON %s value before closeout', (_label, invalidValue) => {
    const inputCatalog = {
      schemaVersion: 'test-catalog/v1',
      tests: structuredClone(fixture.tests),
      metadata: invalidValue,
    };

    expect(() => close({ catalog: inputCatalog })).toThrow('FEATURE_CLOSEOUT_JSON_VALUE_INVALID');
  });

  it.each([
    ['featureRefs', 'feature:test-selection', 'FEATURE_CLOSEOUT_FEATURE_REFS_INVALID'],
    ['capabilityRefs', 'six-model-state-machine', 'FEATURE_CLOSEOUT_CAPABILITY_REFS_INVALID'],
    [
      'failureModeRefs',
      'negative:invalid-transition',
      'FEATURE_CLOSEOUT_FAILURE_MODE_REFS_INVALID',
    ],
  ])('rejects a string %s instead of expanding it into characters', (field, value, issueCode) => {
    const inputCatalog = {
      schemaVersion: 'test-catalog/v1',
      tests: structuredClone(fixture.tests),
    };
    inputCatalog.tests[0][field] = value;

    expect(() => close({ catalog: inputCatalog })).toThrow(issueCode);
  });

  it.each(['archived', 'core-permanent', '', null, ['core_permanent']])(
    'rejects a lifecycle state outside the exact four-state contract: %s',
    (lifecycleState) => {
      const inputCatalog = {
        schemaVersion: 'test-catalog/v1',
        tests: structuredClone(fixture.tests),
      };
      inputCatalog.tests[0].lifecycleState = lifecycleState;

      expect(() => close({ catalog: inputCatalog })).toThrow(
        'FEATURE_CLOSEOUT_LIFECYCLE_STATE_INVALID'
      );
    }
  );

  it('rejects a policy classification state outside the exact four-state contract', () => {
    const policy = structuredClone(fixture.policy);
    policy.classification.directoryRules[0].state = 'archived';

    expect(() => close({ policy })).toThrow('FEATURE_CLOSEOUT_POLICY_CLASSIFICATION_INVALID');
  });

  it('does not copy unapproved Catalog test fields into closeout output', () => {
    const inputCatalog = catalog({
      'vitest::tests/state-machine.test.ts': 'feature_working_set',
    });
    inputCatalog.tests[0].unapprovedMetadata = { source: 'caller' };

    const result = closeFeaturePortfolio({
      catalog: inputCatalog,
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/state-machine.test.ts': { action: 'retain_on_demand' },
      },
    });

    expect(result.updatedTests[0]).not.toHaveProperty('unapprovedMetadata');
  });

  it('applies retain and delete dispositions without a redundant retain exception', () => {
    const result = closeFeaturePortfolio({
      catalog: catalog({
        'vitest::tests/a.test.ts': 'feature_working_set',
        'vitest::tests/b.test.ts': 'feature_working_set',
      }),
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/a.test.ts': { action: 'retain_on_demand' },
        'vitest::tests/b.test.ts': { action: 'delete_after_closeout' },
      },
    });

    expect(result.updatedTests.map((test: any) => test.lifecycleState)).toEqual([
      'retained_on_demand',
      'deletion_candidate',
    ]);
    expect(result.gates).toEqual({
      unclosedFeatureWorkingTestCount: 0,
      corePermanentCount: 0,
    });
    expect(result.policyPatch).toEqual({
      classification: {
        exceptions: [
          {
            testPath: 'tests/b.test.ts',
            state: 'deletion_candidate',
          },
        ],
      },
    });
  });

  it('merges an implementation test into an equal-or-higher contract replacement', () => {
    const result = closeFeaturePortfolio({
      catalog: catalog(
        {
          'vitest::tests/old-a.test.ts': 'feature_working_set',
          'vitest::tests/replacement.test.ts': 'feature_working_set',
        },
        {
          'vitest::tests/old-a.test.ts': {
            capabilityRefs: ['capability:a'],
            failureModeRefs: ['negative:a'],
          },
          'vitest::tests/replacement.test.ts': {
            capabilityRefs: ['capability:a', 'capability:contract'],
            failureModeRefs: ['negative:a', 'negative:contract'],
          },
        }
      ),
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/old-a.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/replacement.test.ts',
        },
        'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
      },
    });

    expect(
      Object.fromEntries(
        result.updatedTests.map((test: any) => [test.identityKey, test.lifecycleState])
      )
    ).toEqual({
      'vitest::tests/old-a.test.ts': 'deletion_candidate',
      'vitest::tests/replacement.test.ts': 'retained_on_demand',
    });
    expect(result.gates.unclosedFeatureWorkingTestCount).toBe(0);
    expect(result.policyPatch).toEqual({
      classification: {
        exceptions: [
          {
            testPath: 'tests/old-a.test.ts',
            state: 'deletion_candidate',
          },
        ],
      },
    });
  });

  it.each([
    [
      'an explicitly ineffective oracle',
      { oracleEffectiveness: 'ineffective_candidate' },
      'CONTRACT_TEST_ORACLE_NOT_INDEPENDENT',
    ],
    [
      'an inherited effective oracle',
      Object.create({ oracleEffectiveness: 'effective' }),
      'FEATURE_CLOSEOUT_CATALOG_TEST_INVALID',
    ],
  ])('fails closed when a merge replacement uses %s', (_label, classifications, issueCode) => {
    const portfolio = catalog(
      {
        'vitest::tests/old-a.test.ts': 'feature_working_set',
        'vitest::tests/replacement.test.ts': 'feature_working_set',
      },
      {
        'vitest::tests/old-a.test.ts': {
          capabilityRefs: ['capability:a'],
          failureModeRefs: ['negative:a'],
        },
        'vitest::tests/replacement.test.ts': {
          capabilityRefs: ['capability:a'],
          failureModeRefs: ['negative:a'],
          classifications,
        },
      }
    );

    expect(() =>
      closeFeaturePortfolio({
        catalog: portfolio,
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/old-a.test.ts': {
            action: 'merge_to_contract_test',
            replacementIdentityKey: 'vitest::tests/replacement.test.ts',
          },
          'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow(issueCode);
  });

  it.each([
    [
      'deletes the final replacement',
      {
        'vitest::tests/old-a.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/replacement.test.ts',
        },
        'vitest::tests/replacement.test.ts': { action: 'delete_after_closeout' },
      },
      'CONTRACT_TEST_REPLACEMENT_NOT_RETAINED',
    ],
    [
      'leaves a dangling replacement reference',
      {
        'vitest::tests/old-a.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/replacement.test.ts',
        },
        'vitest::tests/replacement.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/missing.test.ts',
        },
      },
      'CONTRACT_TEST_REPLACEMENT_NOT_FOUND',
    ],
    [
      'creates a replacement cycle',
      {
        'vitest::tests/old-a.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/replacement.test.ts',
        },
        'vitest::tests/replacement.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/old-a.test.ts',
        },
      },
      'CONTRACT_TEST_REPLACEMENT_CYCLE',
    ],
  ])('rejects a contract replacement graph that %s', (_label, dispositions, issueCode) => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/old-a.test.ts': 'feature_working_set',
            'vitest::tests/replacement.test.ts': 'feature_working_set',
          },
          {
            'vitest::tests/old-a.test.ts': {
              capabilityRefs: ['capability:a'],
              failureModeRefs: ['negative:a'],
            },
            'vitest::tests/replacement.test.ts': {
              capabilityRefs: ['capability:a'],
              failureModeRefs: ['negative:a'],
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions,
      })
    ).toThrow(issueCode);
  });

  it('projects closeout capability authority without a static core lifecycle state', () => {
    const policy = structuredClone(catalogPolicy);
    const facts = structuredClone(catalogFacts);
    policy.protectedCapabilities.push({
      capabilityId: 'six-model-state-machine',
      selectionRefs: ['script:test:feature-state-machine'],
      survivalEvidenceRefs: ['target:src/state-machine.ts'],
      requiredBehaviors: {},
    });
    policy.classification.exceptions.push({
      testPath: 'tests/feature/new-behavior.test.ts',
      capabilityRefs: ['six-model-state-machine'],
    });
    facts.analyzerResults
      .find((result: any) => result.dimension === 'criticality')
      .findings.push({
        identityKey: 'vitest#tests/feature/new-behavior.test.ts',
        value: 'critical',
        confidence: 'high',
        bindings: [
          {
            kind: 'main_agent_core',
            selectionRef: 'script:test:feature-state-machine',
            evidenceRef: 'source:tests/feature/new-behavior.test.ts#feature-closeout-core-binding',
          },
        ],
        evidenceRefs: ['source:tests/feature/new-behavior.test.ts#feature-closeout-core-binding'],
        issueCodes: [],
      });

    const projected = projectTestCatalog({
      facts,
      policy,
      changedPaths: [],
    });
    const promoted = projected.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );

    expect(promoted).toMatchObject({
      lifecycleState: 'retained_on_demand',
      capabilityRefs: ['six-model-state-machine'],
      classifications: {
        protectedCapabilityRefs: ['six-model-state-machine'],
        lifecycleReason: {
          kind: 'directory_rule',
          refs: ['feature-tests'],
        },
      },
    });
  });

  it('projects and validates authoritative failureModeRefs in the generated Catalog', () => {
    const facts = structuredClone(catalogFacts);
    const featureIdentity = facts.inventory.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );
    featureIdentity.failureModeRefs = ['negative:feature-transition'];

    const projected = projectTestCatalog({
      facts,
      policy: structuredClone(catalogPolicy),
      changedPaths: ['tests/feature/new-behavior.test.ts'],
    });
    const feature = projected.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );

    expect(feature.failureModeRefs).toEqual(['negative:feature-transition']);
    const missingFailureModes = structuredClone(projected);
    delete missingFailureModes.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    ).failureModeRefs;
    expect(() => validateTestCatalog(missingFailureModes)).toThrow('CATALOG_TEST_FIELD_MISSING');

    const invalidFailureModes = structuredClone(projected);
    invalidFailureModes.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    ).failureModeRefs = [''];
    expect(() => validateTestCatalog(invalidFailureModes)).toThrow(
      'CATALOG_FAILURE_MODE_REFS_INVALID'
    );
  });

  it('conserves generated Catalog failure modes through Feature Closeout', () => {
    const facts = structuredClone(catalogFacts);
    const oldTest = facts.inventory.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );
    const replacement = facts.inventory.tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );
    oldTest.failureModeRefs = ['negative:feature-transition'];
    replacement.failureModeRefs = [];
    const featureRef = 'feature:test-selection';
    const generatedCatalog = projectTestCatalog({
      facts,
      policy: structuredClone(catalogPolicy),
      changedPaths: [oldTest.testPath, replacement.testPath],
      featureBindings: {
        [oldTest.identityKey]: { active: true, featureRefs: [featureRef] },
        [replacement.identityKey]: { active: true, featureRefs: [featureRef] },
      },
    });

    expect(() =>
      closeFeaturePortfolio({
        catalog: generatedCatalog,
        policy: structuredClone(fixture.policy),
        featureRef,
        dispositions: {
          [oldTest.identityKey]: {
            action: 'merge_to_contract_test',
            replacementIdentityKey: replacement.identityKey,
          },
          [replacement.identityKey]: { action: 'retain_on_demand' },
        },
      })
    ).toThrow('CONTRACT_TEST_COVERAGE_NOT_CONSERVED');
  });

  it('blocks generated Catalog consolidation when authoritative facts lack failure-mode evidence', () => {
    const facts = structuredClone(catalogFacts);
    const oldTest = facts.inventory.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );
    const replacement = facts.inventory.tests.find(
      (test: any) => test.testPath === 'tests/on-demand/platform.test.ts'
    );
    const featureRef = 'feature:test-selection';
    const generatedCatalog = projectTestCatalog({
      facts,
      policy: structuredClone(catalogPolicy),
      changedPaths: [oldTest.testPath, replacement.testPath],
      featureBindings: {
        [oldTest.identityKey]: { active: true, featureRefs: [featureRef] },
        [replacement.identityKey]: { active: true, featureRefs: [featureRef] },
      },
    });

    expect(() =>
      closeFeaturePortfolio({
        catalog: generatedCatalog,
        policy: structuredClone(fixture.policy),
        featureRef,
        dispositions: {
          [oldTest.identityKey]: {
            action: 'merge_to_contract_test',
            replacementIdentityKey: replacement.identityKey,
          },
          [replacement.identityKey]: { action: 'retain_on_demand' },
        },
      })
    ).toThrow('CONTRACT_TEST_FAILURE_MODE_EVIDENCE_REQUIRED');
  });

  it.each([
    ['spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
  ])('rejects a whitespace-only failure-mode reference at closeout: %s', (_label, value) => {
    const featureRef = 'feature:test-selection';
    const generatedCatalog = projectTestCatalog({
      facts: structuredClone(catalogFacts),
      policy: structuredClone(catalogPolicy),
      changedPaths: ['tests/feature/new-behavior.test.ts'],
      featureBindings: {
        'vitest#tests/feature/new-behavior.test.ts': {
          active: true,
          featureRefs: [featureRef],
        },
      },
    });
    const featureTest = generatedCatalog.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );
    featureTest.failureModeRefs = [value];

    expect(() =>
      closeFeaturePortfolio({
        catalog: generatedCatalog,
        policy: structuredClone(fixture.policy),
        featureRef,
        dispositions: {
          [featureTest.identityKey]: { action: 'retain_on_demand' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_FAILURE_MODE_REFS_INVALID');
  });

  it.each([
    ['spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
  ])('rejects a whitespace-only capability reference at closeout: %s', (_label, value) => {
    const featureRef = 'feature:test-selection';
    const generatedCatalog = projectTestCatalog({
      facts: structuredClone(catalogFacts),
      policy: structuredClone(catalogPolicy),
      changedPaths: ['tests/feature/new-behavior.test.ts'],
      featureBindings: {
        'vitest#tests/feature/new-behavior.test.ts': {
          active: true,
          featureRefs: [featureRef],
        },
      },
    });
    const featureTest = generatedCatalog.tests.find(
      (test: any) => test.testPath === 'tests/feature/new-behavior.test.ts'
    );
    featureTest.capabilityRefs = [value];

    expect(() =>
      closeFeaturePortfolio({
        catalog: generatedCatalog,
        policy: structuredClone(fixture.policy),
        featureRef,
        dispositions: {
          [featureTest.identityKey]: { action: 'retain_on_demand' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_CAPABILITY_REFS_INVALID');
  });

  it('rejects unknown closeout actions', () => {
    expect(() =>
      close({
        dispositions: {
          'vitest::tests/state-machine.test.ts': { action: 'archive' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_ACTION_INVALID');
  });

  it.each([
    [
      'unprotected capability',
      (input: any) => {
        input.dispositions['vitest::tests/state-machine.test.ts'].capabilityRef =
          'unprotected-capability';
      },
      'FEATURE_CLOSEOUT_CORE_CAPABILITY_NOT_PROTECTED',
    ],
    [
      'non-independent oracle',
      (input: any) => {
        input.catalog.tests[0].classifications.oracleEffectiveness = 'ineffective_candidate';
      },
      'CORE_TEST_ORACLE_NOT_INDEPENDENT',
    ],
    [
      'equivalent core replacement',
      (input: any) => {
        input.catalog.tests.push({
          ...structuredClone(input.catalog.tests[0]),
          identityKey: 'vitest::tests/existing-core.test.ts',
          testPath: 'tests/existing-core.test.ts',
          lifecycleState: 'core_permanent',
          capabilityRefs: ['six-model-state-machine'],
          featureRefs: [],
        });
      },
      'FEATURE_CLOSEOUT_EQUIVALENT_CORE_EXISTS',
    ],
  ])('rejects promotion with %s', (_label, mutate, issueCode) => {
    const input = {
      catalog: {
        schemaVersion: 'test-catalog/v1',
        tests: structuredClone(fixture.tests),
      },
      policy: structuredClone(fixture.policy),
      featureRef: fixture.featureRef,
      dispositions: {
        'vitest::tests/state-machine.test.ts': {
          action: 'promote_to_core',
          capabilityRef: 'six-model-state-machine',
        },
      },
    };
    mutate(input);

    expect(() => closeFeaturePortfolio(input)).toThrow(issueCode);
  });

  it('accepts a final permanent-core count of 120 and rejects 121', () => {
    const promotionPortfolio = (existingCoreCount: number) => {
      const coreTests = Object.fromEntries(
        Array.from({ length: existingCoreCount }, (_value, index) => [
          `vitest::tests/core-${index}.test.ts`,
          'core_permanent',
        ])
      );
      const portfolio = catalog({
        ...coreTests,
        'vitest::tests/state-machine.test.ts': 'feature_working_set',
      });
      portfolio.tests.at(-1).failureModeRefs = ['negative:invalid-transition'];
      return portfolio;
    };

    expect(close({ catalog: promotionPortfolio(119) }).gates.corePermanentCount).toBe(120);
    expect(() => close({ catalog: promotionPortfolio(120) })).toThrow(
      'CORE_PERMANENT_BUDGET_EXCEEDED'
    );
  });

  it('rejects contract-test consolidation that loses a capability or independent failure mode', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/old-a.test.ts': 'feature_working_set',
            'vitest::tests/replacement.test.ts': 'feature_working_set',
          },
          {
            'vitest::tests/old-a.test.ts': {
              capabilityRefs: ['capability:a'],
              failureModeRefs: ['negative:a'],
            },
          }
        ),
        policy: { budgets: { corePermanentCount: 120 }, protectedCapabilities: [] },
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/old-a.test.ts': {
            action: 'merge_to_contract_test',
            replacementIdentityKey: 'vitest::tests/replacement.test.ts',
          },
          'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('CONTRACT_TEST_COVERAGE_NOT_CONSERVED');
  });

  it('rejects a contract replacement that preserves capability but loses a failure mode', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/old-a.test.ts': 'feature_working_set',
            'vitest::tests/replacement.test.ts': 'feature_working_set',
          },
          {
            'vitest::tests/old-a.test.ts': {
              capabilityRefs: ['capability:a'],
              failureModeRefs: ['negative:a'],
            },
            'vitest::tests/replacement.test.ts': {
              capabilityRefs: ['capability:a'],
              failureModeRefs: [],
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/old-a.test.ts': {
            action: 'merge_to_contract_test',
            replacementIdentityKey: 'vitest::tests/replacement.test.ts',
          },
          'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('CONTRACT_TEST_COVERAGE_NOT_CONSERVED');
  });

  it('rejects a contract replacement that preserves failure modes but loses a capability', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/old-a.test.ts': 'feature_working_set',
            'vitest::tests/replacement.test.ts': 'feature_working_set',
          },
          {
            'vitest::tests/old-a.test.ts': {
              capabilityRefs: ['capability:a'],
              failureModeRefs: ['negative:a'],
            },
            'vitest::tests/replacement.test.ts': {
              capabilityRefs: [],
              failureModeRefs: ['negative:a'],
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/old-a.test.ts': {
            action: 'merge_to_contract_test',
            replacementIdentityKey: 'vitest::tests/replacement.test.ts',
          },
          'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('CONTRACT_TEST_COVERAGE_NOT_CONSERVED');
  });

  it('fails closed when contract-test consolidation has no failure-mode evidence', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({
          'vitest::tests/old-a.test.ts': 'feature_working_set',
          'vitest::tests/replacement.test.ts': 'feature_working_set',
        }),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/old-a.test.ts': {
            action: 'merge_to_contract_test',
            replacementIdentityKey: 'vitest::tests/replacement.test.ts',
          },
          'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('CONTRACT_TEST_FAILURE_MODE_EVIDENCE_REQUIRED');
  });

  it('rejects equivalent permanent-core promotions in the same closeout batch', () => {
    const portfolio = catalog(
      {
        'vitest::tests/core-a.test.ts': 'feature_working_set',
        'vitest::tests/core-b.test.ts': 'feature_working_set',
      },
      {
        'vitest::tests/core-a.test.ts': {
          failureModeRefs: ['negative:state-transition'],
        },
        'vitest::tests/core-b.test.ts': {
          failureModeRefs: ['negative:state-transition'],
        },
      }
    );

    expect(() =>
      closeFeaturePortfolio({
        catalog: portfolio,
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/core-a.test.ts': {
            action: 'promote_to_core',
            capabilityRef: 'six-model-state-machine',
          },
          'vitest::tests/core-b.test.ts': {
            action: 'promote_to_core',
            capabilityRef: 'six-model-state-machine',
          },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_EQUIVALENT_CORE_EXISTS');
  });

  it('rejects a path-level promotion that makes an undispositioned runner equivalent core', () => {
    const portfolio = catalog(
      {
        'vitest::tests/shared.test.ts': 'feature_working_set',
        'node::tests/shared.test.ts': 'retained_on_demand',
        'vitest::tests/existing-core.test.ts': 'core_permanent',
      },
      {
        'vitest::tests/shared.test.ts': {
          failureModeRefs: ['negative:shared-path'],
        },
        'node::tests/shared.test.ts': {
          failureModeRefs: ['negative:shared-path'],
          featureRefs: [],
        },
        'vitest::tests/existing-core.test.ts': {
          capabilityRefs: ['capability:existing'],
          failureModeRefs: ['negative:existing'],
          featureRefs: [],
        },
      }
    );
    const policy = structuredClone(fixture.policy);
    policy.budgets.corePermanentCount = 2;

    expect(() =>
      closeFeaturePortfolio({
        catalog: portfolio,
        policy,
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/shared.test.ts': {
            action: 'promote_to_core',
            capabilityRef: 'six-model-state-machine',
          },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_EQUIVALENT_CORE_EXISTS');
  });

  it('rejects conflicting final dispositions for runner identities sharing one test path', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({
          'vitest::tests/shared.test.ts': 'feature_working_set',
          'node::tests/shared.test.ts': 'feature_working_set',
        }),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/shared.test.ts': { action: 'retain_on_demand' },
          'node::tests/shared.test.ts': { action: 'delete_after_closeout' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_PATH_DISPOSITION_CONFLICT');
  });

  it('deduplicates identical policy patches for runner identities sharing one test path', () => {
    const result = closeFeaturePortfolio({
      catalog: catalog({
        'vitest::tests/shared.test.ts': 'feature_working_set',
        'node::tests/shared.test.ts': 'feature_working_set',
      }),
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/shared.test.ts': { action: 'delete_after_closeout' },
        'node::tests/shared.test.ts': { action: 'delete_after_closeout' },
      },
    });

    expect(result.policyPatch).toEqual({
      classification: {
        exceptions: [
          {
            testPath: 'tests/shared.test.ts',
            state: 'deletion_candidate',
          },
        ],
      },
    });
  });

  it('deduplicates equal deletion patches when same-path runners have different capabilities', () => {
    const result = closeFeaturePortfolio({
      catalog: catalog(
        {
          'vitest::tests/shared.test.ts': 'feature_working_set',
          'node::tests/shared.test.ts': 'feature_working_set',
        },
        {
          'vitest::tests/shared.test.ts': {
            capabilityRefs: ['capability:vitest'],
          },
          'node::tests/shared.test.ts': {
            capabilityRefs: ['capability:node'],
          },
        }
      ),
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/shared.test.ts': { action: 'delete_after_closeout' },
        'node::tests/shared.test.ts': { action: 'delete_after_closeout' },
      },
    });

    expect(result.policyPatch).toEqual({
      classification: {
        exceptions: [
          {
            testPath: 'tests/shared.test.ts',
            state: 'deletion_candidate',
          },
        ],
      },
    });
  });

  it('limits policy metadata to the current closeout call', () => {
    const initialCatalog = catalog(
      {
        'vitest::tests/feature-a.test.ts': 'feature_working_set',
        'vitest::tests/feature-b.test.ts': 'feature_working_set',
      },
      {
        'vitest::tests/feature-a.test.ts': {
          featureRefs: ['feature:a'],
        },
        'vitest::tests/feature-b.test.ts': {
          featureRefs: ['feature:b'],
        },
      }
    );
    const first = closeFeaturePortfolio({
      catalog: initialCatalog,
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:a',
      dispositions: {
        'vitest::tests/feature-a.test.ts': { action: 'delete_after_closeout' },
      },
    });

    const second = closeFeaturePortfolio({
      catalog: { ...initialCatalog, tests: first.updatedTests },
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:b',
      dispositions: {
        'vitest::tests/feature-b.test.ts': { action: 'delete_after_closeout' },
      },
    });

    expect(second.policyPatch).toEqual({
      classification: {
        exceptions: [
          {
            testPath: 'tests/feature-b.test.ts',
            state: 'deletion_candidate',
          },
        ],
      },
    });
  });

  it('keeps reused-object and deep-clone closeout results equivalent', () => {
    const initialCatalog = catalog(
      {
        'vitest::tests/feature-a.test.ts': 'feature_working_set',
        'vitest::tests/feature-b.test.ts': 'feature_working_set',
      },
      {
        'vitest::tests/feature-a.test.ts': {
          featureRefs: ['feature:a'],
        },
        'vitest::tests/feature-b.test.ts': {
          featureRefs: ['feature:b'],
        },
      }
    );
    const first = closeFeaturePortfolio({
      catalog: initialCatalog,
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:a',
      dispositions: {
        'vitest::tests/feature-a.test.ts': { action: 'delete_after_closeout' },
      },
    });
    const reusedInput = {
      catalog: { ...initialCatalog, tests: first.updatedTests },
      policy: structuredClone(fixture.policy),
      featureRef: 'feature:b',
      dispositions: {
        'vitest::tests/feature-b.test.ts': { action: 'delete_after_closeout' },
      },
    };
    const clonedInput = structuredClone(reusedInput);

    const reusedResult = closeFeaturePortfolio(reusedInput);
    const clonedResult = closeFeaturePortfolio(clonedInput);

    expect(reusedResult).toEqual(clonedResult);
    expect(JSON.stringify(reusedResult)).toBe(JSON.stringify(clonedResult));
  });

  it('fails closed when same-path consolidation would delete its retained replacement', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/shared.test.ts': 'feature_working_set',
            'node::tests/shared.test.ts': 'retained_on_demand',
          },
          {
            'vitest::tests/shared.test.ts': {
              capabilityRefs: ['capability:shared'],
              failureModeRefs: ['negative:shared'],
            },
            'node::tests/shared.test.ts': {
              capabilityRefs: ['capability:shared'],
              failureModeRefs: ['negative:shared'],
              featureRefs: [],
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/shared.test.ts': {
            action: 'merge_to_contract_test',
            replacementIdentityKey: 'node::tests/shared.test.ts',
          },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_PATH_IDENTITY_UNSAFE');
  });

  it('fails closed when path-level promotion would implicitly promote another runner', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/shared.test.ts': 'feature_working_set',
            'node::tests/shared.test.ts': 'retained_on_demand',
          },
          {
            'vitest::tests/shared.test.ts': {
              failureModeRefs: ['negative:vitest'],
            },
            'node::tests/shared.test.ts': {
              failureModeRefs: ['negative:node'],
              featureRefs: [],
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/shared.test.ts': {
            action: 'promote_to_core',
            capabilityRef: 'six-model-state-machine',
          },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_PATH_IDENTITY_UNSAFE');
  });

  it.each([
    ['missing', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['string', '120'],
    ['negative', -1],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects a %s permanent-core budget', (_label, corePermanentCount) => {
    const policy = structuredClone(fixture.policy);
    policy.budgets.corePermanentCount = corePermanentCount;

    expect(() => close({ policy })).toThrow('CORE_PERMANENT_BUDGET_INVALID');
  });

  it('accepts the authoritative permanent-core budget of 120', () => {
    const policy = structuredClone(fixture.policy);
    policy.budgets.corePermanentCount = 120;

    expect(close({ policy }).gates.corePermanentCount).toBe(1);
  });

  it('rejects a caller-supplied permanent-core budget above 120', () => {
    const policy = structuredClone(fixture.policy);
    policy.budgets.corePermanentCount = 121;

    expect(() => close({ policy })).toThrow('CORE_PERMANENT_BUDGET_INVALID');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('rejects a %s featureRef', (_label, featureRef) => {
    expect(() => close({ featureRef })).toThrow('FEATURE_CLOSEOUT_FEATURE_REF_INVALID');
  });

  it('rejects dispositions for identities outside the current feature working set', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({
          'vitest::tests/current.test.ts': 'feature_working_set',
        }),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/current.test.ts': { action: 'retain_on_demand' },
          'vitest::tests/unknown.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_DISPOSITION_IDENTITY_INVALID');
  });

  it('rejects dispositions for another feature working set', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog(
          {
            'vitest::tests/current.test.ts': 'feature_working_set',
            'vitest::tests/other.test.ts': 'feature_working_set',
          },
          {
            'vitest::tests/other.test.ts': {
              featureRefs: ['feature:other'],
            },
          }
        ),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/current.test.ts': { action: 'retain_on_demand' },
          'vitest::tests/other.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_DISPOSITION_IDENTITY_INVALID');
  });

  it('fails closed when the feature working set is empty', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({
          'vitest::tests/retained.test.ts': 'retained_on_demand',
        }),
        policy: structuredClone(fixture.policy),
        featureRef: 'feature:test-selection',
        dispositions: {},
      })
    ).toThrow('FEATURE_CLOSEOUT_WORKING_SET_EMPTY');
  });
});
