const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  assertNoWeakerResolution,
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
});
