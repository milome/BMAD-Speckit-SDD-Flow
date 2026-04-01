import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime language english policy reason surface', () => {
  it('keeps reason output english-oriented and machine-safe under english mode expectations', () => {
    const policy = resolveRuntimePolicy({
      flow: 'story',
      stage: 'post_audit',
      storyId: '14-1-runtime-context-refactor',
      runId: 'run-en-002',
    } as any);

    expect(typeof policy.reason).toBe('string');
    expect(policy.reason).toContain('trigger:');
    expect(policy.reason).toContain('scoringEnabled=');
    expect(policy.reason).toContain('identity:');
    expect(policy.reason).not.toContain('缺少');
    expect(policy.reason).not.toContain('未找到');
    expect(policy.reason).not.toContain('审计');
  });
});
