import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileStandaloneGoalExecution, compileStandaloneGoalSemanticIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { resolveStandaloneGoalSemanticPayload } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-representation';
import { runStandaloneGoalInternalSemanticGate } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-internal-semantic-gate';
import { normativeRoleInput } from '../helpers/standalone-goal-normative-roles';

function repeatedInput() {
  const input = normativeRoleInput();
  input.sourceObligations[0].exactText = 'Implement export with all declared constraints. '.repeat(3000);
  return input;
}

describe('standalone semantic representation production consumers', () => {
  it('keeps small v2 payloads plain and deterministically restores large payloads without dropping fields', () => {
    const small = compileStandaloneGoalSemanticIR(normativeRoleInput());
    expect(small.semanticPayload.schemaVersion).toBeUndefined();
    const input = repeatedInput();
    const first = compileStandaloneGoalSemanticIR(input);
    const second = compileStandaloneGoalSemanticIR(input);
    expect(first.semanticPayload.schemaVersion).toBe('GoalSemanticDictionary/v1');
    expect(stableStringify(second)).toBe(stableStringify(first));
    const restored = resolveStandaloneGoalSemanticPayload(first);
    const expected = structuredClone(resolveStandaloneGoalSemanticPayload(small));
    (expected.obligations as Array<Record<string, unknown>>).find((row) => row.obligationId === 'MUST-001')!.text = input.sourceObligations[0].exactText;
    (expected.atoms as Array<Record<string, unknown>>)[0].action = input.sourceObligations[0].exactText;
    expect(restored).toEqual(expected);
    expect(Buffer.byteLength(stableStringify(first), 'utf8')).toBeLessThan(1048576);
  });

  it('compiles the restored authority and closure through the real execution compiler', () => {
    const input = repeatedInput();
    const result = compileStandaloneGoalExecution(input);
    expect(result.goalJudgeDispatchCount).toBe(0);
    expect(result.internalSemanticGate.decision).toBe('pass');
    expect(result.goalExecutionIr.obligations.find((row) => row.obligationId === 'MUST-001')!.text)
      .toBe(input.sourceObligations[0].exactText);
    expect(result.goalExecutionIr.obligations).toHaveLength(4);
    expect(result.goalExecutionIr.coExecutionConstraints).toEqual([]);
    expect(result.closure.goalExecutionIRHash).toBe(result.goalExecutionIr.goalExecutionIRHash);
  });

  it('rejects representation/version confusion and tampering in the internal gate', () => {
    const input = repeatedInput();
    const candidate = compileStandaloneGoalSemanticIR(repeatedInput());
    expect(() => resolveStandaloneGoalSemanticPayload({ ...candidate, schemaVersion: 'StandaloneGoalSemanticIR/v1' }))
      .toThrow('standalone_goal_semantic_representation_version_mismatch');
    const tampered = { ...candidate, semanticPayload: { ...candidate.semanticPayload,
      expandedHash: `sha256:${'0'.repeat(64)}` } };
    expect(() => runStandaloneGoalInternalSemanticGate(input, tampered)).toThrow('goal_semantic_dictionary_');
  });
});
