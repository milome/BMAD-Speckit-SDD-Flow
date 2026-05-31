import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('runtime init auto registry bootstrap', () => {
  it('bootstraps registry.json with bootstrap context but no active requirement record during init', () => {
    const target = mkdtempSync(path.join(os.tmpdir(), 'runtime-init-auto-'));
    try {
      const result = spawnSync(
        process.execPath,
        [path.join(process.cwd(), 'scripts', 'init-to-root.js'), target, '--agent', 'cursor'],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 }
      );

      expect(result.status).toBe(0);

      const registryPath = path.join(target, '_bmad-output', 'runtime', 'registry.json');
      const contextPath = path.join(target, '_bmad-output', 'runtime', 'context', 'bootstrap.json');
      const requirementIndexPath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'index.json'
      );
      const legacyDummyRecordPath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-story_story_create',
        'requirement-record.json'
      );

      expect(existsSync(contextPath)).toBe(true);
      expect(existsSync(registryPath)).toBe(true);
      expect(existsSync(requirementIndexPath)).toBe(false);
      expect(existsSync(legacyDummyRecordPath)).toBe(false);

      const registryRaw = readFileSync(registryPath, 'utf8');
      expect(registryRaw).toContain('"scopeType": "project"');
      expect(registryRaw.replace(/\\\\/g, '/')).toContain(
        '_bmad-output/runtime/context/bootstrap.json'
      );
      expect(registryRaw).toContain('bootstrap context only; no active requirement record');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 30_000);
});
