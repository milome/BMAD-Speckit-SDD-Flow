import { describe, expect, it } from 'vitest';
import { compileStandaloneGoalExecution } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { compileGoalExecutionIR, goalExecutionIRHash, validateGoalExecutionIR,
  type GoalExecutionCompilerInput, type GoalExecutionIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { compileGoalExecutionClosure } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-closure';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

async function fixture() {
  const operations = [{ id: 'MUST-001', name: 'alpha' }, { id: 'MUST-002', name: 'beta' }];
  const result = compileStandaloneGoalExecution({
    sourcePlanHash: hash('1'), sourceSnapshotHash: hash('2'),
    sourceObligations: operations.map(({ id, name }) => ({ id, classification: 'positive',
      exactText: `Implement independent operation ${name} in src/${name}.ts, run npm test -- ${name}, write dist/${name}.js, and retain captured ${name} test output.`,
      requiredOutcome: `Operation ${name} succeeds.`, specSpanRefs: [`SPAN-${id}`],
      normativeStrength: 'must', polarity: 'required', executionRole: 'action', conditions: [],
      applicability: { scope: 'obligations', obligationRefs: [id], sourceRefs: [`SPAN-${id}`] } })),
    logicalSpecSpans: operations.map(({ id }) => ({ specSpanId: `SPAN-${id}`,
      boundObligationIds: [id], evidenceClaimRefs: [] })),
    technicalSnapshot: {
      targetPaths: operations.map(({ name }) => `src/${name}.ts`),
      commandRecords: operations.map(({ name }) => ({ commandId: `CMD-${name}`, invocation: `npm test -- ${name}` })),
      artifactRecords: operations.map(({ name }) => ({ artifactId: `ART-${name}`, logicalPath: `dist/${name}.js` })),
      evidenceRecords: operations.map(({ name }) => ({ evidenceContractId: `EVDREQ-${name}`, requirement: `Captured ${name} test output` })),
      forbiddenPaths: [], isolationMode: 'consumer_worktree',
      constraintBindings: operations.flatMap(({ id, name }, index) =>
        [`PATH-standalone-${index + 1}`, `CMD-${name}`, `ART-${name}`, `EVDREQ-${name}`].map((constraintId) => ({
          constraintId, sourceRefs: [`SPAN-${id}`], applicableMustRefs: [id], premiseRefs: [`SPAN-${id}`],
        }))),
    },
  });
  const compilerInput = {
    ...result.standaloneGoalSemanticIr.semanticPayload,
    profile: 'standalone', semanticSource: result.goalExecutionIr.semanticSource,
    standaloneLineage: result.goalExecutionIr.standaloneLineage,
    technicalAuthority: result.goalExecutionIr.technicalAuthority,
  } as GoalExecutionCompilerInput;
  return { result, compilerInput };
}

function withoutCoExecution(ir: GoalExecutionIR): GoalExecutionIR {
  const draft = { ...ir, coExecutionConstraints: [], goalExecutionIRHash: '' };
  return { ...draft, goalExecutionIRHash: goalExecutionIRHash(draft) };
}

describe('standalone empty co-execution contract', () => {
  it('does not invent a universal co-execution constraint for independent requirements', async () => {
    const { result, compilerInput } = await fixture();
    expect(result.goalExecutionIr.coExecutionConstraints).toEqual([]);
    expect(compilerInput.executionConstraints).toHaveLength(8);
    for (const constraint of compilerInput.executionConstraints) {
      const owner = String(constraint.constraintId).endsWith('beta') || constraint.constraintId === 'PATH-standalone-2' ? 'MUST-002' : 'MUST-001';
      expect(constraint).toMatchObject({ applicableMustRefs: [owner], applicableAtomRefs: [`${owner}-A1`],
        sourceRefs: [`SPAN-${owner}`], premiseRefs: [`SPAN-${owner}`], disposition: 'source_declared' });
    }
  });

  it('compiles a standalone graph without a CTM decomposition premise', async () => {
    const { compilerInput } = await fixture();
    compilerInput.executionConstraints = compilerInput.executionConstraints.filter((row) => row.kind !== 'CTM');
    expect(() => compileGoalExecutionIR(compilerInput)).not.toThrow();
  });

  it('validates and closes an explicit empty standalone array without relaxing coverage', async () => {
    const { result } = await fixture();
    const ir = withoutCoExecution(result.goalExecutionIr);
    expect(validateGoalExecutionIR(ir)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(compileGoalExecutionClosure(ir).decision).toBe('pass');
  });

  it('keeps the requirements-backed nonempty CTM rule', async () => {
    const { result } = await fixture();
    const standalone = withoutCoExecution(result.goalExecutionIr);
    const { standaloneLineage: _lineage, ...rest } = standalone;
    const draft = { ...rest, profile: 'requirements_backed' as const,
      requirementsLineage: {}, goalExecutionIRHash: '' };
    const ir = { ...draft, goalExecutionIRHash: goalExecutionIRHash(draft) };
    expect(validateGoalExecutionIR(ir).decision).toBe('block');
  });
});
