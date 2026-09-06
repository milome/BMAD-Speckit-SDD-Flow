import { describe, expect, it } from 'vitest';
import { compileStandaloneGoalExecution, compileStandaloneGoalSemanticIR, type StandaloneGoalSemanticInput } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { runStandaloneGoalInternalSemanticGate } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-internal-semantic-gate';
import { standaloneGoalSemanticIRHash } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-hash';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function input(): StandaloneGoalSemanticInput {
  return {
    sourcePlanHash: hash('1'),
    sourceSnapshotHash: hash('2'),
    sourceObligations: [
      {
        id: 'MUST-001',
        classification: 'positive',
        exactText: 'Implement export in src/export.ts, run npm test -- export, write dist/export.js, and retain RED/GREEN output.',
        requiredOutcome: 'export succeeds',
        specSpanRefs: ['SPAN-001'],
        normativeStrength: 'must', polarity: 'required', executionRole: 'action',
        conditions: [], applicability: { scope: 'obligations', obligationRefs: ['MUST-001'], sourceRefs: ['SPAN-001'] },
      },
      {
        id: 'NEG-001',
        classification: 'negative',
        exactText: 'MUST NOT mutate .git/** while implementing export.',
        specSpanRefs: ['SPAN-002'],
        normativeStrength: 'must', polarity: 'forbidden', executionRole: 'boundary',
        conditions: [], applicability: { scope: 'obligations', obligationRefs: ['MUST-001'], sourceRefs: ['SPAN-002'] },
      },
    ],
    logicalSpecSpans: [
      { specSpanId: 'SPAN-001', boundObligationIds: ['MUST-001'], evidenceClaimRefs: [] },
      { specSpanId: 'SPAN-002', boundObligationIds: ['NEG-001'], evidenceClaimRefs: [] },
    ],
    technicalSnapshot: {
      targetPaths: ['src/export.ts'],
      commandRecords: [{ commandId: 'CMD-export', invocation: 'npm test -- export' }],
      artifactRecords: [{ artifactId: 'ART-export', logicalPath: 'dist/export.js' }],
      evidenceRecords: [{ evidenceContractId: 'EVDREQ-export', requirement: 'RED/GREEN output' }],
      forbiddenPaths: ['.git/**'],
      isolationMode: 'consumer_worktree',
      constraintBindings: [
        ...['PATH-standalone-1', 'CMD-export', 'ART-export', 'EVDREQ-export'].map((constraintId) => ({
          constraintId, sourceRefs: ['SPAN-001'], applicableMustRefs: ['MUST-001'], premiseRefs: ['SPAN-001'],
        })),
        { constraintId: 'STOP-standalone-1', sourceRefs: ['SPAN-002'],
          applicableMustRefs: ['MUST-001'], premiseRefs: ['SPAN-002'] },
      ],
    },
  };
}

describe('standalone Goal semantic front-end', () => {
  it('requires the deterministic internal gate and never dispatches a Judge during compilation', () => {
    const result = compileStandaloneGoalExecution(input());

    expect(result.goalJudgeDispatchCount).toBe(0);
    expect(result.standaloneGoalSemanticIr.schemaVersion).toBe('StandaloneGoalSemanticIR/v2');
    expect(result.internalSemanticGate).toMatchObject({
      schemaVersion: 'StandaloneGoalInternalSemanticGate/v1',
      decision: 'pass',
      issueCodes: [],
    });
    expect(result.goalExecutionIr.standaloneLineage?.internalSemanticGateHash)
      .toBe(result.internalSemanticGate.gateHash);
    expect(result.goalExecutionIr.technicalAuthority.internalSemanticGateHash)
      .toBe(result.internalSemanticGate.gateHash);
    expect(result.goalExecutionIr.standaloneLineage).not.toHaveProperty('authoringEffectivePassHash');
    expect(result.goalExecutionIr.technicalAuthority).not.toHaveProperty('authoringEffectivePassHash');
    expect(result.goalExecutionIr.schemaVersion).toBe('GoalExecutionIR/v2');
    expect(result.goalExecutionIr.profile).toBe('standalone');
    expect(result.goalExecutionIr).not.toHaveProperty('requirementsLineage');
    expect(result.goalExecutionIr.obligations.find((row) => row.obligationId === 'NEG-001'))
      .toMatchObject({ executionRole: 'boundary', atomRefs: [] });
    const constraints = result.standaloneGoalSemanticIr.semanticPayload.executionConstraints as Record<string, unknown>[];
    expect(constraints.find((row) => row.constraintId === 'STOP-standalone-1'))
      .toMatchObject({ sourceRefs: ['SPAN-002'], applicableMustRefs: ['MUST-001'], disposition: 'source_declared' });
    expect(result.closure.decision).toBe('pass');
  });

  it('rejects a rehashed semantic relation mutation in the internal gate', () => {
    const source = input();
    const candidate = structuredClone(compileStandaloneGoalSemanticIR(source));
    const constraints = candidate.semanticPayload.executionConstraints as Record<string, unknown>[];
    const command = constraints.find((row) => row.constraintId === 'CMD-export')!;
    command.premiseRefs = [];
    candidate.standaloneGoalSemanticIRHash = standaloneGoalSemanticIRHash(candidate);

    expect(() => runStandaloneGoalInternalSemanticGate(source, candidate)).toThrowError(
      'constraint_provenance_invalid:CMD-export'
    );
  });

  it('keeps non-action declarations non-executable and rejects invented atom bindings', () => {
    const source = input();
    const commandBinding = source.technicalSnapshot.constraintBindings!
      .find((row) => row.constraintId === 'CMD-export')!;
    commandBinding.coverageRole = 'non_action_declaration';
    commandBinding.declarationRole = 'source_reference';
    commandBinding.sourceDeclarationRefs = ['CMD-export'];
    const candidate = structuredClone(compileStandaloneGoalSemanticIR(source));
    const constraints = candidate.semanticPayload.executionConstraints as Record<string, unknown>[];
    const command = constraints.find((row) => row.constraintId === 'CMD-export')!;

    expect(command.applicableAtomRefs).toEqual([]);
    expect(runStandaloneGoalInternalSemanticGate(source, candidate).decision).toBe('pass');

    command.applicableAtomRefs = ['MUST-001-A1'];
    candidate.standaloneGoalSemanticIRHash = standaloneGoalSemanticIRHash(candidate);
    expect(() => runStandaloneGoalInternalSemanticGate(source, candidate)).toThrowError(
      'constraint_atom_ref_invalid:CMD-export'
    );
  });

  it('rejects an invalid semantic authority before GoalExecutionIR publication', () => {
    const invalid = input();
    invalid.sourcePlanHash = 'not-a-hash';

    expect(() => compileStandaloneGoalSemanticIR(invalid)).toThrowError(
      'canonical_schema_invalid'
    );
  });
});
