import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  epicContextPath,
  projectContextPath,
  runContextPath,
  storyContextPath,
} from '../../scripts/runtime-context';

describe('runtime-context paths', () => {
  it('builds project, epic, story, and run context paths under _bmad-output/runtime/context', () => {
    const root = 'D:/Work/MyApp';

    expect(projectContextPath(root)).toContain(path.join('_bmad-output', 'runtime', 'context'));
    expect(projectContextPath(root)).toContain('project.json');

    expect(epicContextPath(root, 'epic-14')).toContain(
      path.join('_bmad-output', 'runtime', 'context', 'epics')
    );
    expect(epicContextPath(root, 'epic-14')).toContain('epic-14.json');

    expect(storyContextPath(root, 'epic-14', '14-1-runtime-context-refactor')).toContain(
      path.join('_bmad-output', 'runtime', 'context', 'stories')
    );
    expect(storyContextPath(root, 'epic-14', '14-1-runtime-context-refactor')).toContain(
      '14-1-runtime-context-refactor.json'
    );

    expect(runContextPath(root, 'epic-14', '14-1-runtime-context-refactor', 'run-001')).toContain(
      path.join('_bmad-output', 'runtime', 'context', 'runs')
    );
    expect(runContextPath(root, 'epic-14', '14-1-runtime-context-refactor', 'run-001')).toContain(
      'run-001.json'
    );
  });
});
