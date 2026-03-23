import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

const repoRoot = process.cwd();

describe('emit-runtime-policy vs resolveRuntimePolicy (stable JSON)', () => {
  it('stdout matches stableStringify(resolveRuntimePolicy) for fixed flow/stage', () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (msg: string | Uint8Array) => {
      chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
      return true;
    };
    try {
      const code = mainEmitRuntimePolicy([
        '--flow',
        'story',
        '--stage',
        'specify',
        '--cwd',
        repoRoot,
      ]);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = origWrite;
    }
    const out = chunks.join('');
    const expected = stableStringifyPolicy(
      resolveRuntimePolicy({ flow: 'story', stage: 'specify' })
    );
    expect(out).toBe(expected);
  });

  it('emit-runtime-policy-cli.js uses explicit runtime identity envs without BMAD_RUNTIME_CONTEXT_FILE', () => {
    const cli = path.join(repoRoot, '_bmad/claude/hooks/emit-runtime-policy-cli.js');
    const r = spawnSync(process.execPath, [cli], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: repoRoot,
        CURSOR_PROJECT_ROOT: repoRoot,
        BMAD_RUNTIME_CWD: repoRoot,
        BMAD_RUNTIME_FLOW: 'story',
        BMAD_RUNTIME_STAGE: 'implement',
        BMAD_RUNTIME_EPIC_ID: 'epic-14',
        BMAD_RUNTIME_STORY_ID: '14.1',
        BMAD_RUNTIME_RUN_ID: 'run-emit-stable',
        BMAD_RUNTIME_CONTEXT_FILE: '',
      },
    });
    expect(r.status).toBe(0);
    const policy = JSON.parse((r.stdout || '').trim());
    expect(policy.flow).toBe('story');
    expect(policy.stage).toBe('implement');
    expect(policy.identity.storyId).toBe('14.1');
    expect(policy.identity.runId).toBe('run-emit-stable');
  });

  it('ignores BMAD_RUNTIME_CONTEXT_FILE when explicit flow/stage are absent and no registry-backed context is available', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-rp-env-ignored-'));
    const ctxFile = path.join(root, 'ctx.json');
    fs.writeFileSync(
      ctxFile,
      JSON.stringify({
        version: 1,
        flow: 'story',
        stage: 'post_audit',
        storyId: 'should-not-be-read',
        updatedAt: new Date().toISOString(),
      })
    );
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    const chunks: string[] = [];
    const errors: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    const origError = console.error;
    process.stdout.write = (msg: string | Uint8Array) => {
      chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
      return true;
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(' '));
    };
    try {
      process.env.BMAD_RUNTIME_CONTEXT_FILE = ctxFile;
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(1);
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      process.stdout.write = origWrite;
      console.error = origError;
      fs.rmSync(root, { recursive: true, force: true });
    }
    expect(chunks.join('')).toBe('');
    expect(errors.join('\n')).toContain('emit-runtime-policy: missing flow/stage');
    expect(errors.join('\n')).not.toContain('should-not-be-read');
  }, 20_000);

  it('emit fails loud when flow/stage are missing and no registry-backed context is available', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-rp-sp-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    const chunks: string[] = [];
    const errors: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    const origError = console.error;
    process.stdout.write = (msg: string | Uint8Array) => {
      chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
      return true;
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(' '));
    };
    try {
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(1);
    } finally {
      process.stdout.write = origWrite;
      console.error = origError;
      fs.rmSync(root, { recursive: true, force: true });
    }
    expect(chunks.join('')).toBe('');
    expect(errors.join('\n')).toContain('emit-runtime-policy: missing flow/stage');
  }, 20_000);
});
