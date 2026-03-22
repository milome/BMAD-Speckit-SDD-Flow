import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('trace language policy', () => {
  it('exposes identity and language policy without altering canonical control fields', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'tasks', storyId: '14.1', runId: 'trace-run-1' } as any);
    expect(policy.identity.storyId).toBe('14.1');
    expect(policy.identity.runId).toBe('trace-run-1');
    expect(policy.language.preserveParserAnchors).toBe(true);
    expect(policy.control.triggerStage).toBe(policy.triggerStage);
  });
});
