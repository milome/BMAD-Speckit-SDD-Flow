import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

describe('runtime language english hook surface', () => {
  it('keeps fail-loud hook-facing text machine-safe and english-oriented for missing context', () => {
    const repoRoot = process.cwd();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-hook-surface-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, { flow: 'story', stage: 'specify' });
    const ctxPath = path.join(root, '_bmad-output', 'runtime', 'context', 'project.json');
    const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8')) as Record<string, unknown>;
    delete raw.flow;
    raw.updatedAt = new Date().toISOString();
    fs.writeFileSync(ctxPath, JSON.stringify(raw, null, 2));

    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    };
    try {
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(1);
    } finally {
      console.error = originalError;
      fs.rmSync(root, { recursive: true, force: true });
    }

    const text = errors.join('\n');
    expect(text).toContain('emit-runtime-policy:');
    expect(text).toMatch(/runtime-context\.flow invalid or missing/);
    expect(text).not.toContain('缺少');
    expect(text).not.toContain('未找到');
    expect(text).not.toContain('中文');
  });
});
