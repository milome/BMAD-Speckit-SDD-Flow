import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { mainAuditorPostActions } from '../../scripts/auditor-post-actions';

describe('auditor post-actions runner', () => {
  it('writes score-compatible audit index entry from a structured bugfix audit report without separate CLI orchestration', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'auditor-post-actions-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));

      const artifactDocPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_login_loop.md'
      );
      const reportPath = artifactDocPath.replace(/\.md$/i, '.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const code = mainAuditorPostActions([
        '--projectRoot',
        root,
        '--reportPath',
        reportPath,
        '--stage',
        'implement',
      ]);

      expect(code).toBe(0);
      const registry = readRuntimeContextRegistry(root);
      expect(registry.auditIndex.bugfix[path.normalize(artifactDocPath)]?.status).toBe('PASS');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
