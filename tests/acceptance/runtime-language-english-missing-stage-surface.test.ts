import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('runtime language english missing-context surface', () => {
  it('stderr for registry without scoped context file is english-oriented and free of legacy wording', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-missing-context-'));
    const registry = defaultRuntimeContextRegistry(root);
    writeRuntimeContextRegistry(root, registry);
    // Intentionally omit project.json — activeScope points at missing file.

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
      rmSync(root, { recursive: true, force: true });
    }

    const text = errors.join('\n');
    expect(text).toContain('emit-runtime-policy:');
    expect(text).toContain('runtime-context missing');
    expect(text).not.toContain('legacy stage-source string');
    expect(text).not.toContain('缺少');
    expect(text).not.toContain('未找到');
  });
});
