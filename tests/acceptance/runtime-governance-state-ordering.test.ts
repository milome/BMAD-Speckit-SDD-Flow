import { describe, expect, it } from 'vitest';
import { readRuntimeContext } from '../../scripts/runtime-context';

describe('runtime-governance state ordering', () => {
  it('rejects non-monotonic stage transitions against the canonical runtime stage sequence', () => {
    process.env.BMAD_RUNTIME_CONTEXT_FILE = 'tests/fixtures/story-runtime-context.json';
    const context = readRuntimeContext(process.cwd());
    delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
    const stageOrder = [
      'story_create',
      'story_audit',
      'specify',
      'plan',
      'gaps',
      'tasks',
      'implement',
      'post_audit',
    ];
    const canAdvance = (from: string, to: string) =>
      stageOrder.indexOf(to) >= stageOrder.indexOf(from);

    expect(context.stage).toBe('implement');
    expect(context.contextScope).toBe('story');
    expect(canAdvance('plan', 'tasks')).toBe(true);
    expect(canAdvance('tasks', 'implement')).toBe(true);
    expect(canAdvance(context.stage, 'post_audit')).toBe(true);
    expect(canAdvance('post_audit', 'plan')).toBe(false);
  });
});
