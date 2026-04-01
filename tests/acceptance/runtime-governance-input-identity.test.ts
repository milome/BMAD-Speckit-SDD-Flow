import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime-governance input identity', () => {
  it('surfaces story/run identity in policy reason and identity substructure', () => {
    const config = loadConfig();
    const policy = resolveRuntimePolicy({
      flow: 'story',
      stage: 'implement',
      config,
      epicId: '14',
      storyId: '14.1',
      storySlug: 'runtimegovanceValidator',
      runId: 'run-001',
      artifactRoot:
        '_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator',
      contextSource: 'story-scoped',
    } as any);

    expect(policy.identity.epicId).toBe('14');
    expect(policy.identity.storyId).toBe('14.1');
    expect(policy.identity.storySlug).toBe('runtimegovanceValidator');
    expect(policy.identity.runId).toBe('run-001');
    expect(policy.identity.artifactRoot).toContain('story-14-1-runtimegovanceValidator');
    expect(policy.reason).toContain('storyId=14.1');
    expect(policy.reason).toContain('runId=run-001');
    expect(policy.reason).toContain('contextSource=story-scoped');
  });
});
