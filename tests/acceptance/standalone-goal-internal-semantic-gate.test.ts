import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { runStandaloneGoalInternalSemanticGate } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-internal-semantic-gate';
import {
  compileStandaloneGoalSemanticIR,
  type StandaloneGoalConstraintBinding,
  type StandaloneGoalSemanticInput,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';

describe('standalone Goal internal semantic gate relation scale', () => {
  it('accepts source-authorized global fan-out regardless of a fixed edge ratio', () => {
    const obligationIds = Array.from(
      { length: 128 },
      (_, index) => `REQ-SCALE-${String(index + 1).padStart(3, '0')}`
    );
    const sourceObligations = obligationIds.map((id) => ({
      id,
      exactText: `Execute ${id}`,
      requiredOutcome: `${id} is complete`,
      specSpanRefs: ['SPEC-SPAN-SCALE'],
      executionRole: 'action',
      normativeStrength: 'must',
      polarity: 'required',
      conditions: [],
      applicability: {
        scope: 'global',
        sourceRefs: [id, 'SPEC-SPAN-SCALE'],
      },
    }));
    const commandRecords = Array.from(
      { length: 400 },
      (_, index) => ({
        commandId: `CMD-SCALE-${String(index + 1).padStart(3, '0')}`,
        invocation: `verify-scale-${index + 1}`,
      })
    );
    const globalBinding = (constraintId: string): StandaloneGoalConstraintBinding => ({
      constraintId,
      sourceRefs: ['SPEC-SPAN-SCALE'],
      applicableMustRefs: obligationIds,
      premiseRefs: ['SPEC-SPAN-SCALE'],
      scope: 'global',
    });
    const input: StandaloneGoalSemanticInput = {
      sourcePlanHash: sha256Stable('source-plan-scale'),
      sourceSnapshotHash: sha256Stable('source-snapshot-scale'),
      sourceObligations,
      logicalSpecSpans: [{
        specSpanId: 'SPEC-SPAN-SCALE',
        boundObligationIds: obligationIds,
      }],
      technicalSnapshot: {
        targetPaths: ['src/scale.ts'],
        pathRecords: [{ pathId: 'PATH-SCALE-001', logicalPath: 'src/scale.ts' }],
        commandRecords,
        artifactRecords: [],
        evidenceRecords: [],
        forbiddenPaths: [],
        isolationMode: 'source-authorized-global-scale',
        constraintBindings: [
          globalBinding('PATH-SCALE-001'),
          ...commandRecords.map(({ commandId }) => globalBinding(commandId)),
        ],
      },
    };

    const semanticIr = compileStandaloneGoalSemanticIR(input);
    const gate = runStandaloneGoalInternalSemanticGate(input, semanticIr);

    expect(gate.decision).toBe('pass');
    expect(gate.metrics.referenceCount).toBeGreaterThan(100_000);
    expect(gate.issueCodes).not.toContain('semantic_relation_edge_budget_exceeded');
  });
});
