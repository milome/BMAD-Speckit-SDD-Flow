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

  it('emit-runtime-policy-cli.js reads BMAD_RUNTIME_CONTEXT_FILE', () => {
    const ctxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-rp-'));
    const ctxFile = path.join(ctxDir, 'ctx.json');
    fs.writeFileSync(
      ctxFile,
      JSON.stringify({
        version: 1,
        flow: 'story',
        stage: 'specify',
        updatedAt: new Date().toISOString(),
      })
    );
    try {
      const cli = path.join(repoRoot, '_bmad/claude/hooks/emit-runtime-policy-cli.js');
      const r = spawnSync(process.execPath, [cli], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          // Isolate from host shell CLAUDE_PROJECT_DIR / CURSOR_PROJECT_ROOT pointing elsewhere
          CLAUDE_PROJECT_DIR: repoRoot,
          CURSOR_PROJECT_ROOT: repoRoot,
          BMAD_RUNTIME_CONTEXT_FILE: ctxFile,
          BMAD_RUNTIME_CWD: repoRoot,
        },
      });
      expect(r.status).toBe(0);
      const policy = JSON.parse((r.stdout || '').trim());
      expect(policy.flow).toBe('story');
      expect(policy.stage).toBe('specify');
      const expected = stableStringifyPolicy(
        resolveRuntimePolicy({ flow: 'story', stage: 'specify' })
      );
      expect(stableStringifyPolicy(policy)).toBe(expected);
    } finally {
      fs.rmSync(ctxDir, { recursive: true, force: true });
    }
  });

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
