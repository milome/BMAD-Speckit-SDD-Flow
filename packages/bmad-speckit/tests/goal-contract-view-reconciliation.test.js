const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  assertNoWeakerResolution,
  reconcileGoalContractViews,
  reconcileStandaloneViews,
} = require('../src/utils/goal-contract/view-reconciliation.ts');

function implementationResult(overrides = {}) {
  return {
    view: {
      tasks: [{ id: 'G00' }],
      traceSlices: [{ id: 'TRACE-001' }],
      productionSymbols: ['goalContractCommand'],
      allowedPaths: ['packages/bmad-speckit/src/commands/goal-contract.ts'],
      commands: {
        direct: ['CMD-04'],
        impacted: ['CMD-05'],
        integration: ['CMD-09'],
        regression: ['CMD-17'],
      },
      dependencies: [],
      commitPolicy: 'exactly_one_atomic_commit',
      closeConditions: ['No unresolved material conflict.'],
      synchronizationObligations: ['package-source'],
      commandEvidenceStrength: { 'CMD-04': 'behavior' },
      ...overrides,
    },
    receipt: {
      viewType: 'implementation',
      inputHash: `sha256:${'a'.repeat(64)}`,
      sessionIdentity: 'implementation-session',
      persistedViewAuthorityFiles: 0,
    },
  };
}

function acceptanceEvidenceResult(overrides = {}) {
  return {
    view: {
      acceptanceItems: [
        {
          id: 'AC-08',
          requiredCommands: ['CMD-04'],
          requiredEvidenceStrength: 'behavior',
        },
      ],
      negativeControls: ['weaker evidence blocks'],
      productionEntryPoints: ['goalContractCommand'],
      manualScenarios: ['Run one reconciliation.'],
      expectedEvidence: [{ id: 'EVD-04', producer: 'CMD-04' }],
      antiCheatRules: ['coverage-only evidence is insufficient'],
      stopConditions: ['RECONFIRM_REQUIRED'],
      ...overrides,
    },
    receipt: {
      viewType: 'acceptance_evidence',
      inputHash: `sha256:${'a'.repeat(64)}`,
      sessionIdentity: 'acceptance-session',
      persistedViewAuthorityFiles: 0,
    },
  };
}

function sourceBoundInput() {
  const sourceSnapshot = {
    aggregateHash: `sha256:${'a'.repeat(64)}`,
  };
  const implementation = implementationResult({
    tasks: [
      {
        id: 'G00',
        sourceIds: ['S-001'],
        atomicGroupRefs: ['AG-1'],
      },
    ],
    traceSlices: [
      {
        id: 'TRACE-001',
        sourceIds: ['S-001'],
        goalIds: ['G00'],
        acceptanceIds: ['AC-08'],
      },
    ],
  });
  const acceptanceEvidence = acceptanceEvidenceResult({
    acceptanceItems: [
      {
        id: 'AC-08',
        sourceIds: ['S-001'],
        goalIds: ['G00'],
        requiredCommands: ['CMD-04'],
        expectedEvidenceIds: ['EVD-04'],
        requiredEvidenceStrength: 'behavior',
        atomicGroupRefs: ['AG-1'],
      },
    ],
  });
  return {
    sourceSnapshot,
    sourceObligationGraph: {
      schemaVersion: 'goal-contract-source-obligation-graph/v1',
      sourceSnapshotHash: sourceSnapshot.aggregateHash,
      obligations: [{ id: 'S-001', applicabilityState: 'applicable' }],
    },
    sourceObligationGraphHash: `sha256:${'b'.repeat(64)}`,
    methodologyProfileHash: `sha256:${'c'.repeat(64)}`,
    semanticModelHash: `sha256:${'d'.repeat(64)}`,
    derivation: {
      mode: 'structured_fast_path',
      implementation,
      acceptanceEvidence,
    },
  };
}

describe('goal-contract view reconciliation', () => {
  it('reconciles compatible views once into one graph input', () => {
    const result = reconcileStandaloneViews({
      implementation: implementationResult(),
      acceptanceEvidence: acceptanceEvidenceResult(),
    });

    assert.equal(result.metrics.reconciliationCount, 1);
    assert.equal(result.metrics.unresolvedMaterialCount, 0);
    assert.equal(result.metrics.weakerResolutionCount, 0);
    assert.match(result.graphInputHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(result.outputInventory.graphInputs, 1);
    assert.equal(result.outputInventory.markdownAuthorities, 1);
    assert.equal(result.outputInventory.persistedViewFiles, 0);
    assert.equal(result.outputInventory.persistedReconciliationFiles, 0);
    assert.equal(result.graphInput.acceptanceItems[0].id, 'AC-08');
  });

  it('retains missing implementation commands as typed material omissions', () => {
    assert.throws(
      () =>
        reconcileStandaloneViews({
          implementation: implementationResult({
            commands: {
              direct: ['CMD-03'],
              impacted: ['CMD-05'],
              integration: ['CMD-09'],
              regression: ['CMD-17'],
            },
          }),
          acceptanceEvidence: acceptanceEvidenceResult(),
        }),
      (error) => {
        assert.equal(error.failureClass, 'reconciliation_material_conflict');
        assert.equal(error.issues[0].issueType, 'omission');
        assert.equal(error.issues[0].material, true);
        assert.equal(error.issues[0].status, 'unresolved');
        return true;
      }
    );
  });

  it('rejects weaker evidence resolution instead of silently accepting it', () => {
    assert.throws(
      () =>
        assertNoWeakerResolution({
          issueId: 'ISSUE-001',
          requiredStrength: 'behavior',
          selectedStrength: 'coverage',
        }),
      (error) => error.failureClass === 'weaker_resolution_forbidden'
    );

    assert.throws(
      () =>
        reconcileStandaloneViews({
          implementation: implementationResult({
            commandEvidenceStrength: { 'CMD-04': 'coverage' },
          }),
          acceptanceEvidence: acceptanceEvidenceResult(),
        }),
      (error) =>
        error.failureClass === 'reconciliation_strength_mismatch' &&
        error.issues[0].issueType === 'strength_mismatch'
    );
  });

  it('reconciles one source-bound candidate universe and rejects material mutations', () => {
    const input = sourceBoundInput();
    const result = reconcileGoalContractViews(input);

    assert.equal(result.graphInput.sourceSnapshotHash, input.sourceSnapshot.aggregateHash);
    assert.equal(result.graphInput.sourceObligationGraphHash, input.sourceObligationGraphHash);
    assert.equal(result.graphInput.methodologyProfileHash, input.methodologyProfileHash);
    assert.equal(result.graphInput.semanticModelHash, input.semanticModelHash);
    assert.deepEqual(result.graphInput.sourceObligations, input.sourceObligationGraph.obligations);
    assert.equal(result.metrics.unresolvedMaterialCount, 0);

    const cases = [
      [
        'reconciliation_source_obligation_omitted',
        (candidate) =>
          candidate.sourceObligationGraph.obligations.push({
            id: 'S-002',
            applicabilityState: 'applicable',
          }),
      ],
      [
        'reconciliation_task_without_source',
        (candidate) => (candidate.derivation.implementation.view.tasks[0].sourceIds = []),
      ],
      [
        'reconciliation_dependency_conflict',
        (candidate) => {
          candidate.derivation.implementation.view.dependencies = [
            { from: 'G00', to: 'G01' },
          ];
          candidate.derivation.acceptanceEvidence.view.acceptanceItems[0].dependencyAssertions =
            [{ from: 'G01', to: 'G00' }];
        },
      ],
      [
        'reconciliation_atomic_group_conflict',
        (candidate) =>
          (candidate.derivation.acceptanceEvidence.view.acceptanceItems[0].atomicGroupRefs =
            ['AG-2']),
      ],
      [
        'reconciliation_acceptance_unreachable',
        (candidate) =>
          Object.assign(
            candidate.derivation.acceptanceEvidence.view.acceptanceItems[0],
            { goalIds: [], requiredCommands: [], expectedEvidenceIds: [] }
          ),
      ],
      [
        'reconciliation_strength_mismatch',
        (candidate) =>
          (candidate.derivation.implementation.view.commandEvidenceStrength['CMD-04'] =
            'coverage'),
      ],
      [
        'reconciliation_authority_field_forbidden',
        (candidate) =>
          (candidate.derivation.implementation.view.tasks[0].partitionId = 'P-1'),
      ],
    ];
    for (const [failureClass, mutate] of cases) {
      const candidate = structuredClone(input);
      mutate(candidate);
      assert.throws(
        () => reconcileGoalContractViews(candidate),
        (error) => error.failureClass === failureClass,
        failureClass
      );
    }
  });
});
