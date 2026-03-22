import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime-governance lifecycle/workflow stages', () => {
  it('keeps Story lifecycle at the top level and does not let workflow stages replace it', () => {
    const policy = resolveRuntimePolicy({
      flow: 'story',
      stage: 'post_audit',
      config: loadConfig(),
    });

    expect(policy).toBeDefined();
    expect(policy.stage).toBe('post_audit');
    expect(['story_create', 'story_audit', 'dev_story', 'post_audit']).toContain(policy.stage);
    expect(['specify', 'plan', 'gaps', 'tasks', 'implement']).not.toContain(policy.stage);
  });
});
