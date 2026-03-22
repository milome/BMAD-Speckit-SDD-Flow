import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('scoring language policy', () => {
  it('keeps scoringEnabled and triggerStage stable under language policy', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'implement' });
    expect(policy.control.scoringEnabled).toBe(policy.scoringEnabled);
    expect(policy.control.triggerStage).toBe(policy.triggerStage);
    expect(policy.language.preserveMachineKeys).toBe(true);
  });
});
