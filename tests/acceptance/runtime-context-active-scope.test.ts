import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  resolveActiveScope,
  resolveContextPathFromActiveScope,
} from '../../scripts/runtime-context-registry';

describe('runtime-context active scope', () => {
  it('prefers run over story over epic over project', () => {
    const registry = defaultRuntimeContextRegistry('D:/Work/MyApp');

    registry.epicContexts['epic-14'] = { path: '_bmad-output/runtime/context/epics/epic-14.json' };
    registry.storyContexts['14-1-runtime-context-refactor'] = {
      path: '_bmad-output/runtime/context/stories/epic-14/14-1-runtime-context-refactor.json',
      epicId: 'epic-14',
    };
    registry.runContexts['run-001'] = {
      path: '_bmad-output/runtime/context/runs/epic-14/14-1-runtime-context-refactor/run-001.json',
      storyId: '14-1-runtime-context-refactor',
      stage: 'post_audit',
    };

    const runScope = resolveActiveScope(registry, {
      scopeType: 'run',
      runId: 'run-001',
      storyId: '14-1-runtime-context-refactor',
      epicId: 'epic-14',
    });
    expect(runScope.scopeType).toBe('run');
    expect(resolveContextPathFromActiveScope(registry, runScope)).toContain('run-001.json');

    const storyScope = resolveActiveScope(registry, {
      scopeType: 'story',
      storyId: '14-1-runtime-context-refactor',
      epicId: 'epic-14',
    });
    expect(storyScope.scopeType).toBe('story');
    expect(resolveContextPathFromActiveScope(registry, storyScope)).toContain(
      '14-1-runtime-context-refactor.json'
    );

    const epicScope = resolveActiveScope(registry, {
      scopeType: 'epic',
      epicId: 'epic-14',
    });
    expect(epicScope.scopeType).toBe('epic');
    expect(resolveContextPathFromActiveScope(registry, epicScope)).toContain('epic-14.json');

    const projectScope = resolveActiveScope(registry, {
      scopeType: 'project',
    });
    expect(projectScope.scopeType).toBe('project');
    expect(resolveContextPathFromActiveScope(registry, projectScope)).toContain('project.json');
  });
});
