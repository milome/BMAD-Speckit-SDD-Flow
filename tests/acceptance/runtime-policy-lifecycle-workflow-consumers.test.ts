import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime-policy lifecycle/workflow consumers', () => {
  it('keeps Story lifecycle at top level and only uses workflowStage within dev_story', () => {
    const config = loadConfig();

    const postAudit = resolveRuntimePolicy({
      flow: 'story',
      stage: 'post_audit',
      config,
    });
    expect(postAudit.stage).toBe('post_audit');
    expect(postAudit.triggerStage).toBe('bmad_story_stage4');

    const implement = resolveRuntimePolicy({
      flow: 'story',
      stage: 'implement',
      config,
    });
    expect(implement.stage).toBe('implement');
    expect(implement.triggerStage).toBe('speckit_5_2');
  });
});
