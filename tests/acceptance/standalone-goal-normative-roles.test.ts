import { describe, expect, it } from 'vitest';
import { compileStandaloneGoalSemanticIR, compileStandaloneGoalExecution } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { normativeRoleInput } from '../helpers/standalone-goal-normative-roles';

describe('standalone typed normative roles', () => {
  it.each(['requirement', 'acceptance', 'binding', 'definition'])(
    'preserves a source-scoped %s without converting it into a boundary or action', async (executionRole) => {
      const value = normativeRoleInput();
      const row = value.sourceObligations[1];
      value.technicalSnapshot.forbiddenPaths = [];
      value.technicalSnapshot.constraintBindings = value.technicalSnapshot.constraintBindings!.slice(0, 4);
      Object.assign(row, { executionRole, normativeStrength: executionRole === 'definition' ? 'descriptive' : 'must',
        polarity: executionRole === 'definition' ? 'descriptive' : 'required',
        provenanceRefs: ['source-block-section'],
        applicability: { scope: 'source_scope', sourceRefs: ['SPAN-NEG-001'],
          sourceScope: { kind: 'source_section', ownerId: null, ownerBlockRefs: ['source-block-section'] } } });
      const result = compileStandaloneGoalExecution(value);
      expect(result.goalExecutionIr.obligations.find((item) => item.obligationId === row.id))
        .toMatchObject({ executionRole, polarity: row.polarity, applicability: row.applicability, atomRefs: [] });
      expect(result.goalExecutionIr.atomicTasks).toHaveLength(1);
    });

  it('retains source composite and preserved clauses in execution authority and its hash', async () => {
    const value = normativeRoleInput();
    const row = value.sourceObligations[1];
    const normativeClauses = [{ id: 'clause-test-only', text: 'Retain the API, but caching is permitted.',
      polarity: 'mixed', modalities: ['required', 'permitted'], conditions: [] }];
    Object.assign(row, { executionRole: 'requirement', normativeStrength: 'mixed', polarity: 'mixed', normativeClauses });
    const result = compileStandaloneGoalExecution(value);
    expect(result.goalExecutionIr.obligations.find((item) => item.obligationId === row.id))
      .toMatchObject({ kind: 'COMPOSITE', normativeClauses });
    row.normativeClauses = [{ ...normativeClauses[0], polarity: 'preserve' }];
    expect(compileStandaloneGoalSemanticIR(value).standaloneGoalSemanticIRHash)
      .not.toBe(result.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash);
  });

  it('preserves source-declared task dependencies without treating source ID order as an edge', async () => {
    const value = normativeRoleInput();
    value.sourceObligations.push({ ...structuredClone(value.sourceObligations[0]), id: 'MUST-002',
      specSpanRefs: ['SPAN-MUST-002'], dependencyRefs: ['MUST-001'] });
    value.logicalSpecSpans.push({ specSpanId: 'SPAN-MUST-002', boundObligationIds: ['MUST-002'], evidenceClaimRefs: [] });
    for (const binding of value.technicalSnapshot.constraintBindings!.slice(0, 4)) {
      binding.applicableMustRefs.push('MUST-002');
      binding.applicableAtomRefs!.push('MUST-002-A1');
    }
    const result = compileStandaloneGoalExecution(value);
    expect(result.goalExecutionIr.dependencies).toHaveLength(1);
    const tasks = result.goalExecutionIr.atomicTasks;
    expect(result.goalExecutionIr.dependencies[0]).toMatchObject({
      from: tasks.find((task) => (task.obligationRefs as string[]).includes('MUST-002'))!.taskId,
      to: tasks.find((task) => (task.obligationRefs as string[]).includes('MUST-001'))!.taskId,
    });
  });

  it('establishes an internally consistent action-only compiler baseline', () => {
    const value = normativeRoleInput();
    value.sourceObligations = value.sourceObligations.slice(0, 1);
    value.logicalSpecSpans = value.logicalSpecSpans.slice(0, 1);
    value.technicalSnapshot.forbiddenPaths = [];
    value.technicalSnapshot.constraintBindings = value.technicalSnapshot.constraintBindings!.slice(0, 4);
    expect(() => compileStandaloneGoalSemanticIR(value)).not.toThrow();
  });

  it('accepts guidance and boundaries without inventing execution oracles', () => {
    expect(() => compileStandaloneGoalSemanticIR(normativeRoleInput())).not.toThrow();
  });

  it('does not promote a permission or suggestion even if the source supplies an optional outcome', () => {
    const value = normativeRoleInput();
    for (const row of value.sourceObligations) row.requiredOutcome ??= row.exactText;
    const ir = compileStandaloneGoalSemanticIR(value);
    expect(ir.schemaVersion).toBe('StandaloneGoalSemanticIR/v2');
    const obligations = ir.semanticPayload.obligations as Record<string, unknown>[];
    expect(obligations.find((row) => row.obligationId === 'PERMIT-001')).toMatchObject({ kind: 'PERMISSION',
      normativeStrength: 'may', polarity: 'permitted', executionRole: 'guidance', atomRefs: [] });
    expect(obligations.find((row) => row.obligationId === 'GUIDE-001')).toMatchObject({ kind: 'GUIDANCE',
      normativeStrength: 'should', executionRole: 'guidance', atomRefs: [] });
    expect(obligations.find((row) => row.obligationId === 'NEG-001')).toMatchObject({ kind: 'NEG',
      normativeStrength: 'must', polarity: 'forbidden', executionRole: 'boundary', atomRefs: [] });
    expect((ir.semanticPayload.atoms as Record<string, unknown>[]).map((row) => row.id)).toEqual(['MUST-001-A1']);
  });

  it('creates only the declared action task and retains non-action coverage in closure', async () => {
    const result = compileStandaloneGoalExecution(normativeRoleInput());
    expect(result.goalJudgeDispatchCount).toBe(0);
    expect(result.goalExecutionIr.schemaVersion).toBe('GoalExecutionIR/v2');
    expect(result.goalExecutionIr.atomicTasks.map((row) => row.obligationRefs)).toEqual([['MUST-001']]);
    expect(result.goalExecutionIr.traceSlices.flatMap((row) => row.obligationRefs)).toEqual(['MUST-001']);
    expect(result.goalExecutionIr.obligations).toHaveLength(4);
    expect(result.goalExecutionIr.commands.map((row) => row.commandId)).toEqual(['CMD-export']);
    expect(result.goalExecutionIr.evidenceContracts.map((row) => row.evidenceContractId)).toEqual(['EVDREQ-export']);
    expect(result.closure.coverage.obligationIds).toEqual(['GUIDE-001', 'MUST-001', 'NEG-001', 'PERMIT-001']);
    for (const row of result.goalExecutionIr.obligations.filter((row) => row.executionRole !== 'action')) {
      expect(row).not.toHaveProperty('expectedEffortMinutes');
      expect(row).not.toHaveProperty('upperBoundEffortMinutes');
      expect(row).not.toHaveProperty('oracle');
    }
  });

  it('preserves unevaluated conditions rather than marking them satisfied', async () => {
    const value = normativeRoleInput();
    const conditions = [{ text: 'Only after explicit selection', sourceRefs: ['SPAN-PERMIT-001'], state: 'unevaluated' }];
    value.sourceObligations[3].conditions = conditions;
    const result = compileStandaloneGoalExecution(value);
    expect(result.goalExecutionIr.obligations.find((row) => row.obligationId === 'PERMIT-001')?.conditions).toEqual(conditions);
  });

  it('retains a pure policy semantic authority but never dispatches to activate invented tasks', async () => {
    const value = normativeRoleInput();
    value.sourceObligations = value.sourceObligations.filter((row) => row.id === 'NEG-001');
    value.logicalSpecSpans = value.logicalSpecSpans.filter((row) => row.specSpanId === 'SPAN-NEG-001');
    value.technicalSnapshot.targetPaths = [];
    value.technicalSnapshot.commandRecords = [];
    value.technicalSnapshot.artifactRecords = [];
    value.technicalSnapshot.evidenceRecords = [];
    value.technicalSnapshot.constraintBindings = value.technicalSnapshot.constraintBindings!.slice(-1);
    expect(() => compileStandaloneGoalSemanticIR(value)).not.toThrow();
    expect(() => compileStandaloneGoalExecution(value)).toThrow(
      'standalone_goal_no_executable_actions'
    );
  });
});
