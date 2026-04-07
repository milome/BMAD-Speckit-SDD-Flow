import { describe, expect, it } from 'vitest';
import schema from '../../docs/reference/runtime-context.schema.json';
import { defaultRuntimeContextFile, projectContextPath } from '../../scripts/runtime-context';

describe('runtime-context schema', () => {
  it('accepts story-scoped identity fields', () => {
    const props = (schema as any).properties;
    expect(props.workflow).toBeDefined();
    expect(props.step).toBeDefined();
    expect(props.epicId).toBeDefined();
    expect(props.storyId).toBeDefined();
    expect(props.storySlug).toBeDefined();
    expect(props.runId).toBeDefined();
    expect(props.artifactRoot).toBeDefined();
    expect(props.artifactPath).toBeDefined();
    expect(props.contextScope).toBeDefined();
    expect(props.languagePolicy).toBeDefined();
  });

  it('accepts contextScope enum with project and story', () => {
    const contextScope = (schema as any).properties.contextScope;
    expect(contextScope.enum).toContain('project');
    expect(contextScope.enum).toContain('story');
  });

  it('default runtime context preserves explicit story-scoped overrides', () => {
    const ctx = defaultRuntimeContextFile({
      stage: 'epics',
      workflow: 'bmad-create-epics-and-stories',
      step: 'step-03-create-stories',
      epicId: '14',
      storyId: '14.1',
      storySlug: 'runtimegovanceValidator',
      runId: 'run-001',
      artifactRoot:
        '_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator',
      artifactPath: '_bmad-output/planning-artifacts/feature-x/epics.md',
      contextScope: 'story',
    });

    expect(ctx.stage).toBe('epics');
    expect(ctx.workflow).toBe('bmad-create-epics-and-stories');
    expect(ctx.step).toBe('step-03-create-stories');
    expect(ctx.epicId).toBe('14');
    expect(ctx.storyId).toBe('14.1');
    expect(ctx.storySlug).toBe('runtimegovanceValidator');
    expect(ctx.runId).toBe('run-001');
    expect(ctx.artifactRoot).toContain('story-14-1-runtimegovanceValidator');
    expect(ctx.artifactPath).toContain('planning-artifacts');
    expect(ctx.contextScope).toBe('story');
  });

  it('includes planning stages in the schema enum', () => {
    const stageEnum = (schema as any).properties.stage.enum;
    expect(stageEnum).toContain('prd');
    expect(stageEnum).toContain('arch');
    expect(stageEnum).toContain('epics');
  });

  it('uses the project runtime-context path under _bmad-output/runtime/context/project.json', () => {
    expect(projectContextPath(process.cwd())).toContain('_bmad-output');
    expect(projectContextPath(process.cwd())).toContain('runtime');
    expect(projectContextPath(process.cwd())).toContain('context');
    expect(projectContextPath(process.cwd())).toContain('project.json');
  });
});
