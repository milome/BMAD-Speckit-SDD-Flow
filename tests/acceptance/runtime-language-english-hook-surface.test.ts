import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime language english hook surface', () => {
  it('keeps fail-loud hook-facing text machine-safe and english-oriented for missing context', () => {
    delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
    delete process.env.BMAD_RUNTIME_FLOW;
    delete process.env.BMAD_RUNTIME_STAGE;

    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-hook-surface-'));
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: any[]) => {
      errors.push(args.join(' '));
    };
    try {
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(1);
    } finally {
      console.error = originalError;
      rmSync(root, { recursive: true, force: true });
    }

    const text = errors.join('\n');
    expect(text).toContain('missing flow/stage');
    expect(text).not.toContain('缺少');
    expect(text).not.toContain('未找到');
    expect(text).not.toContain('中文');
  });
});
