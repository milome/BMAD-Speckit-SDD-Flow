import { describe, expect, it } from 'vitest';
import { typedActivationProbe } from '../helpers/standalone-goal-typed-activation';

describe('test-only v2 frozen activation and resume', () => {
  it('recompiles a dictionary authority on activation and resume without executing business work', async () => {
    const result = await typedActivationProbe('direct', '', true);
    expect(result.semanticRepresentation).toBe('GoalSemanticDictionary/v1');
    expect(result.error).toBeUndefined();
    expect(result.second.candidateRunId).toBe(result.first.candidateRunId);
    expect(result.resumed).toBeDefined();
  }, 120000);

  it.each(['direct', 'partitioned'] as const)('activates, reuses and resolves %s packages without business execution', async (mode) => {
    const result = await typedActivationProbe(mode);
    expect(result.error).toBeUndefined();
    expect(result.first.executionMode).toBe(mode === 'direct' ? 'direct_goal' : 'partitioned_goal');
    expect(result.second.candidateRunId).toBe(result.first.candidateRunId);
    expect(result.resumed).toBeDefined();
  }, 120000);

  it.each(['ir-content', 'closure-content', 'closure-version', 'binding-source',
    'missing-evidence-resolution', 'swapped-evidence-source'])(
    'rejects independently rehashed %s authority drift', async (mutation) => {
      expect((await typedActivationProbe('direct', mutation)).error).toBe('goal_execution_authority_invalid');
    }, 120000);
});
