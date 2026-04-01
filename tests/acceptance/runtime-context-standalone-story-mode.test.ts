import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureProjectRuntimeContext } from '../../scripts/runtime-context';

describe('runtime-context standalone_story mode', () => {
  it('detectRuntimeSourceMode resolves standalone_story when hasStoryOnly hint', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-mode-'));
    try {
      const ctx = ensureProjectRuntimeContext(root, {
        sourceMode: 'standalone_story',
      });
      expect(ctx.sourceMode).toBe('standalone_story');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
