import { describe, expect, it, vi } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileStandaloneGoalExecution } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function input() {
  return {
    sourcePlanHash: hash('1'),
    sourceSnapshotHash: hash('2'),
    sourceObligations: [
      {
        id: 'MUST-001',
        classification: 'positive',
        exactText: 'Implement export.',
        requiredOutcome: 'export succeeds',
        specSpanRefs: ['SPAN-001'],
      },
      {
        id: 'NEG-001',
        classification: 'negative',
        exactText: 'MUST NOT overwrite source.',
        requiredOutcome: 'source remains unchanged',
        specSpanRefs: ['SPAN-002'],
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
    },
  };
}

describe('standalone Goal semantic front-end', () => {
  function pass(candidateHash: string) {
    const payload = {
      schemaVersion: 'StandaloneGoalAuthoringEffectivePass/v1' as const,
      standaloneGoalSemanticIRHash: candidateHash,
      authoringJudgeAggregateHash: hash('a'),
      decision: 'pass' as const,
    };
    return { ...payload, authoringEffectivePassHash: sha256Stable(payload) };
  }

  it('dispatches one full authoring Judge before the shared GoalExecutionIR compiler', async () => {
    const authoringJudge = vi.fn(async (request) => ({
      authoringEffectivePass: pass(request.candidateHash),
      goalJudgeDispatchCount: 1 as const,
    }));
    const result = await compileStandaloneGoalExecution(input(), { authoringJudge });

    expect(authoringJudge).toHaveBeenCalledTimes(1);
    expect(authoringJudge).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'goal_full',
        candidate: expect.objectContaining({ schemaVersion: 'StandaloneGoalSemanticIR/v1' }),
      })
    );
    expect(result.goalJudgeDispatchCount).toBe(1);
    expect(result.standaloneGoalSemanticIr.schemaVersion).toBe('StandaloneGoalSemanticIR/v1');
    expect(result.authoringEffectivePass).toMatchObject({
      schemaVersion: 'StandaloneGoalAuthoringEffectivePass/v1',
      decision: 'pass',
    });
    expect(result.goalExecutionIr.schemaVersion).toBe('GoalExecutionIR/v1');
    expect(result.goalExecutionIr.profile).toBe('standalone');
    expect(result.goalExecutionIr).not.toHaveProperty('requirementsLineage');
    expect(result.closure.decision).toBe('pass');
  });

  it('does not compile GoalExecutionIR when the single authoring Judge blocks', async () => {
    const authoringJudge = vi.fn(async () => {
      throw new Error('standalone_goal_successor_required:authoring_judge');
    });

    await expect(compileStandaloneGoalExecution(input(), { authoringJudge })).rejects.toThrowError(
      'standalone_goal_successor_required:authoring_judge'
    );
    expect(authoringJudge).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid semantic authority before GoalExecutionIR publication', async () => {
    const invalid = input();
    invalid.sourcePlanHash = 'not-a-hash';
    const authoringJudge = vi.fn(async (request) => ({
      authoringEffectivePass: pass(request.candidateHash),
      goalJudgeDispatchCount: 1 as const,
    }));

    await expect(compileStandaloneGoalExecution(invalid, { authoringJudge })).rejects.toThrowError(
      'canonical_schema_invalid'
    );
    expect(authoringJudge).not.toHaveBeenCalled();
  });
});
