import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('runtime init auto registry bootstrap', () => {
  it('bootstraps registry.json together with project context during init', { timeout: 60000 }, () => {
    const target = mkdtempSync(path.join(os.tmpdir(), 'runtime-init-auto-'));
    try {
      const result = spawnSync(
        process.execPath,
        [path.join(process.cwd(), 'scripts', 'init-to-root.js'), target, '--agent', 'cursor'],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 }
      );

      expect(result.status).toBe(0);

      const registryPath = path.join(target, '_bmad-output', 'runtime', 'registry.json');
      const contextPath = path.join(target, '_bmad-output', 'runtime', 'context', 'project.json');

      expect(existsSync(contextPath)).toBe(true);
      expect(existsSync(registryPath)).toBe(true);

      const registryRaw = readFileSync(registryPath, 'utf8');
      expect(registryRaw).toContain('"scopeType": "project"');
      expect(registryRaw).toContain('"projectContextPath"');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 30_000);
});
