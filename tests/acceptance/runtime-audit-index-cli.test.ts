import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { mainUpdateRuntimeAuditIndex } from '../../scripts/update-runtime-audit-index';

describe('runtime audit index cli', () => {
  it('writes bugfix audit result into registry auditIndex from reportPath', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-audit-index-cli-'));
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
          'iteration_count: 2',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      const code = mainUpdateRuntimeAuditIndex(['--projectRoot', root, '--reportPath', reportPath]);

      expect(code).toBe(0);
      const registry = readRuntimeContextRegistry(root);
      expect(registry.auditIndex.bugfix[path.normalize(artifactDocPath)]?.status).toBe('PASS');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
