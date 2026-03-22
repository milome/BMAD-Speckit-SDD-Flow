import { describe, expect, it } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { readRuntimeContext } from '../../scripts/runtime-context';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';

describe('runtime-governance dual-host parity', () => {
  it('emits identical canonical policy payload for explicit Cursor and Claude story contexts', () => {
    process.env.BMAD_RUNTIME_CONTEXT_FILE = 'tests/fixtures/story-runtime-context.json';
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
    const context = readRuntimeContext(process.cwd(), process.env.BMAD_RUNTIME_CONTEXT_FILE);
    const expected = stableStringifyPolicy(
      resolveRuntimePolicy({
        flow: 'story',
        stage: 'implement',
        epicId: context.epicId,
        storyId: context.storyId,
        storySlug: context.storySlug,
        runId: context.runId,
        artifactRoot: context.artifactRoot,
      })
    );
    delete process.env.BMAD_RUNTIME_CONTEXT_FILE;

    expect(claudeCode).toBe(0);
    expect(cursorCode).toBe(0);
    expect(expected).toContain('"triggerStage":"speckit_5_2"');
    expect(expected).toContain('"storyId":"14.1"');
    expect(expected).toContain('"runId":"parity-run-001"');
  });
});
