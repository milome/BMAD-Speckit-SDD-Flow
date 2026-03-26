import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureProjectRuntimeContext } from '../../scripts/runtime-context';
import { readRuntimeContextRegistry } from '../../scripts/runtime-context-registry';

describe('runtime-context seeded_solutioning mode', () => {
  it('ensureProjectRuntimeContext defaults to seeded_solutioning without sprint-status', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'seeded-mode-'));
    try {
      const ctx = ensureProjectRuntimeContext(root, {});
      expect(ctx.sourceMode).toBe('seeded_solutioning');
      const reg = readRuntimeContextRegistry(root);
      expect(reg.activeScope.scopeType).toBe('project');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
