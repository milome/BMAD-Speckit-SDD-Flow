import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

/** Consumer-like root: `_bmad` + hoisted `node_modules` (workspace @bmad-speckit/runtime-emit); no project-root `scripts/`. */
function makeEmitReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-inject-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'specify' });
  return tempRoot;
}

describe('runtime-policy-inject (dual host entry)', () => {
  it('Cursor path: --cursor-host + stdin', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: '{}',
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).toContain('"flow"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('Cursor path: agent_message 请用英文 → systemMessage 含 resolvedMode en', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        agent_message: '请用英文回答',
        tool_name: 'Read',
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toMatch(/"resolvedMode":\s*"en"/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Claude path: PreToolUse Agent stdin', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const stdin = JSON.stringify({ tool_name: 'Agent', tool_input: { description: 'x' } });
      const r = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('quietly skips injection when no BMAD/Speckit context is active and emit only reports missing flow/stage', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'non-bmad-hook-'));
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: tempRoot,
        input: JSON.stringify({ cwd: tempRoot }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      expect((r.stderr || '').trim()).toBe('');
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage || '').not.toContain('emit-runtime-policy FAILED');
      expect(out.systemMessage || '').not.toContain('missing flow/stage');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not fall back to root .bmad/runtime-context.json when no explicit context file is provided', () => {
    const emit = path.join(repoRoot, 'scripts', 'emit-runtime-policy.ts');
    const r = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--transpile-only',
        emit,
        '--cwd',
        repoRoot,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env },
      }
    );

    const stderr = r.stderr ?? '';
    expect(stderr).not.toContain('.bmad/runtime-context.json');
    if (r.status !== 0) {
      expect(stderr).toMatch(/emit-runtime-policy:/);
    } else {
      expect((r.stdout ?? '').trim()).toContain('"triggerStage"');
    }
  });
});
