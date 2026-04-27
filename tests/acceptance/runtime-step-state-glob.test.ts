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

function makeWorktreeRuntimeStepStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-step-state-worktree-'));
  tempRoots.push(root);

  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad', '_config', 'continue-gate-routing.yaml'),
    [
      'version: 1',
      'schema: continue_gate_routing_v1',
      'routes:',
      '  - workflow: bmad-create-epics-and-stories',
      '    aliases: [create-epics-and-stories]',
      '    flow: epic',
      '    stage: epics',
      '    steps:',
      '      step-03-create-stories: epics-contract-gate',
    ].join('\n'),
    'utf8'
  );

  const gitDir = path.join(root, '.git-worktrees', 'feature-runtime-path');
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(root, '.git'), `gitdir: ${gitDir}\n`, 'utf8');
  fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/feature/runtime-path\n', 'utf8');

  fs.mkdirSync(path.join(root, '_bmad-output', 'planning-artifacts', 'feature-runtime-path'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'planning-artifacts', 'feature-runtime-path', 'epics.md'),
    '# branch scoped epics\n',
    'utf8'
  );
  fs.mkdirSync(path.join(root, '_bmad-output', 'planning-artifacts'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'planning-artifacts', 'epics.md'),
    '# flat legacy epics that must not be read\n',
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
    const hookModule = require(
      path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs')
    ) as {
      resolveRuntimeStepState: (
        projectRoot: string,
        options?: Record<string, unknown>
      ) => {
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

  it('uses branch-scoped epics.md for worktree-style .git files without flat fallback', () => {
    const root = makeWorktreeRuntimeStepStateRoot();
    const hookModule = require(
      path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs')
    ) as {
      resolveRuntimeStepState: (
        projectRoot: string,
        options?: Record<string, unknown>
      ) => {
        artifactPath: string | null;
        branch: string;
        workflow: string;
      };
    };

    const state = hookModule.resolveRuntimeStepState(root, {
      workflow: 'bmad-create-epics-and-stories',
      step: 'step-03-create-stories',
    });

    expect(state.workflow).toBe('bmad-create-epics-and-stories');
    expect(state.branch).toBe('feature-runtime-path');
    expect(String(state.artifactPath || '').replace(/\\/g, '/')).toContain(
      '/_bmad-output/planning-artifacts/feature-runtime-path/epics.md'
    );
  });

  it('does not resolve flat epics.md when branch-scoped epics.md is missing', () => {
    const root = makeWorktreeRuntimeStepStateRoot();
    fs.rmSync(
      path.join(root, '_bmad-output', 'planning-artifacts', 'feature-runtime-path', 'epics.md')
    );
    const hookModule = require(
      path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs')
    ) as {
      resolveRuntimeStepState: (
        projectRoot: string,
        options?: Record<string, unknown>
      ) => {
        artifactPath: string | null;
        branch: string;
        workflow: string;
      };
    };

    const state = hookModule.resolveRuntimeStepState(root, {
      workflow: 'bmad-create-epics-and-stories',
      step: 'step-03-create-stories',
    });

    expect(state.workflow).toBe('bmad-create-epics-and-stories');
    expect(state.branch).toBe('feature-runtime-path');
    expect(state.artifactPath).toBeNull();
  });
});
