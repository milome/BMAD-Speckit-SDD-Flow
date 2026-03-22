import { describe, expect, it } from 'vitest';
import schema from '../../docs/reference/runtime-context.schema.json';
import {
  defaultRuntimeContextFile,
  resolveRuntimeContextPath,
} from '../../scripts/runtime-context';

describe('runtime-context schema', () => {
  it('accepts story-scoped identity fields', () => {
    const props = (schema as any).properties;
    expect(props.epicId).toBeDefined();
    expect(props.storyId).toBeDefined();
    expect(props.storySlug).toBeDefined();
    expect(props.runId).toBeDefined();
    expect(props.artifactRoot).toBeDefined();
    expect(props.contextScope).toBeDefined();
  });

  it('accepts contextScope enum with project and story', () => {
    const contextScope = (schema as any).properties.contextScope;
    expect(contextScope.enum).toContain('project');
    expect(contextScope.enum).toContain('story');
  });

  it('default runtime context preserves explicit story-scoped overrides', () => {
    const ctx = defaultRuntimeContextFile({
      epicId: '14',
      storyId: '14.1',
      storySlug: 'runtimegovanceValidator',
      runId: 'run-001',
      artifactRoot:
        '_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator',
      contextScope: 'story',
    });

    expect(ctx.epicId).toBe('14');
    expect(ctx.storyId).toBe('14.1');
    expect(ctx.storySlug).toBe('runtimegovanceValidator');
    expect(ctx.runId).toBe('run-001');
    expect(ctx.artifactRoot).toContain('story-14-1-runtimegovanceValidator');
    expect(ctx.contextScope).toBe('story');
  });

  it('requires an explicit BMAD_RUNTIME_CONTEXT_FILE instead of defaulting to root runtime-context.json', () => {
    delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
    expect(() => resolveRuntimeContextPath(process.cwd())).toThrow(
      'runtime-context explicit file required: set BMAD_RUNTIME_CONTEXT_FILE'
    );
  });
});
