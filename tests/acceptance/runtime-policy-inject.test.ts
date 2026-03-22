import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function writeTempContext(): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-inject-'));
  const file = path.join(dir, 'ctx.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      flow: 'story',
      stage: 'specify',
      updatedAt: new Date().toISOString(),
    })
  );
  return { dir, file };
}

describe('runtime-policy-inject (dual host entry)', () => {
  it('Cursor path: --cursor-host + stdin', () => {
    const { dir, file } = writeTempContext();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: '{}',
        encoding: 'utf8',
        env: {
          ...process.env,
          BMAD_HOOK_HOST: 'cursor',
          BMAD_RUNTIME_CONTEXT_FILE: file,
          CURSOR_PROJECT_ROOT: repoRoot,
          CLAUDE_PROJECT_DIR: repoRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).toContain('"flow"');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 15000);

  it('Claude path: PreToolUse Agent stdin', () => {
    const { dir, file } = writeTempContext();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const stdin = JSON.stringify({ tool_name: 'Agent', tool_input: { description: 'x' } });
      const r = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          BMAD_HOOK_HOST: 'claude',
          BMAD_RUNTIME_CONTEXT_FILE: file,
          CLAUDE_PROJECT_DIR: repoRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 15000);

  it('BMAD_POLICY_INJECT=0 skips policy JSON in systemMessage', () => {
    const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
    const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
      cwd: repoRoot,
      input: '{}',
      encoding: 'utf8',
      env: {
        ...process.env,
        BMAD_POLICY_INJECT: '0',
        CURSOR_PROJECT_ROOT: repoRoot,
      },
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout || '{}');
    expect(out.systemMessage).toContain('BMAD_POLICY_INJECT=0');
    expect(out.systemMessage).not.toContain('"auditRequired"');
  }, 15000);

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
          BMAD_HOOK_HOST: 'cursor',
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
          BMAD_RUNTIME_CONTEXT_FILE: '',
          BMAD_RUNTIME_FLOW: '',
          BMAD_RUNTIME_STAGE: '',
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
        env: {
          ...process.env,
          BMAD_RUNTIME_CONTEXT_FILE: '',
          BMAD_RUNTIME_FLOW: '',
          BMAD_RUNTIME_STAGE: '',
        },
      }
    );

    const stderr = r.stderr ?? '';
    expect(r.status).not.toBe(0);
    expect(stderr).toContain('missing flow/stage');
    expect(stderr).not.toContain('.bmad/runtime-context.json');
  });
});
