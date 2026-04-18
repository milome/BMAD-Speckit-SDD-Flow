import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const tempRoots: string[] = [];

function makeMinimalRuntimeStepStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-step-state-glob-'));
  tempRoots.push(root);

  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad', '_config', 'continue-gate-routing.yaml'),
    'routes: []\n',
    'utf8'
  );

  fs.mkdirSync(path.join(root, 'specs', 'epic-1', 'story-1-1'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'specs', 'epic-1', 'story-1-1', 'spec.md'),
    '# Sample spec\n',
    'utf8'
  );

  return root;
}

describe('runtime step state glob resolution', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it('does not throw when resolving default specs/**/*.md artifact globs', () => {
    const root = makeMinimalRuntimeStepStateRoot();
    const hookModule = require(path.join(
      repoRoot,
      '_bmad',
      'runtime',
      'hooks',
      'runtime-step-state.cjs'
    )) as {
      resolveRuntimeStepState: (projectRoot: string, options?: Record<string, unknown>) => {
        artifactPath: string | null;
        workflow: string;
      };
    };

    const state = hookModule.resolveRuntimeStepState(root, {});

    expect(state.workflow).toBe('');
    expect(String(state.artifactPath || '').replace(/\\/g, '/')).toContain(
      '/specs/epic-1/story-1-1/spec.md'
    );
  });
});
