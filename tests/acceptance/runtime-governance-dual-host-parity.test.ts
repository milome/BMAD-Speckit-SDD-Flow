import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { readRuntimeContext } from '../../scripts/runtime-context';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';

describe('runtime-governance dual-host parity', () => {
  it('emits identical canonical policy payload for explicit Cursor and Claude story contexts', () => {
    const contextFile = path.resolve(process.cwd(), 'tests/fixtures/story-runtime-context.json');
    const context = readRuntimeContext(process.cwd(), contextFile);
    process.env.BMAD_RUNTIME_EPIC_ID = context.epicId;
    process.env.BMAD_RUNTIME_STORY_ID = context.storyId;
    process.env.BMAD_RUNTIME_STORY_SLUG = context.storySlug;
    process.env.BMAD_RUNTIME_RUN_ID = context.runId;
    process.env.BMAD_RUNTIME_ARTIFACT_ROOT = context.artifactRoot;
    const claudeCode = mainEmitRuntimePolicy([
      '--flow',
      'story',
      '--stage',
      'implement',
      '--cwd',
      process.cwd(),
    ]);
    const cursorCode = mainEmitRuntimePolicy([
      '--flow',
      'story',
      '--stage',
      'implement',
      '--cwd',
      process.cwd(),
    ]);
    const policy = resolveRuntimePolicy({
      flow: 'story',
      stage: 'implement',
      epicId: context.epicId,
      storyId: context.storyId,
      storySlug: context.storySlug,
      runId: context.runId,
      artifactRoot: context.artifactRoot,
    });
    const expected = stableStringifyPolicy(policy);
    delete process.env.BMAD_RUNTIME_EPIC_ID;
    delete process.env.BMAD_RUNTIME_STORY_ID;
    delete process.env.BMAD_RUNTIME_STORY_SLUG;
    delete process.env.BMAD_RUNTIME_RUN_ID;
    delete process.env.BMAD_RUNTIME_ARTIFACT_ROOT;

    expect(context.storyId).toBe('14.1');
    expect(context.runId).toBe('parity-run-001');
    expect(claudeCode).toBe(0);
    expect(cursorCode).toBe(0);
    expect(policy.identity.storyId).toBe('14.1');
    expect(policy.identity.runId).toBe('parity-run-001');
    expect(expected).toContain('"triggerStage":"speckit_5_2"');
    expect(expected).toContain('"identity":{');
    expect(expected).toContain('"storyId":"14.1"');
    expect(expected).toContain('"runId":"parity-run-001"');
  });
});
