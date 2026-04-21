import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readRuntimeContextRegistry,
  syncAuditIndexFromAllReports,
  writeRuntimeContextRegistry,
  defaultRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('runtime audit index', () => {
  it('indexes structured bugfix/tasks audit reports into runtime registry auditIndex', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-audit-index-'));
    try {
      const registry = defaultRuntimeContextRegistry(root);
      writeRuntimeContextRegistry(root, registry);

      const bugfixDoc = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'BUGFIX_login_loop.md'
      );
      const tasksDoc = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        '_orphan',
        'TASKS_checkout_hardening.md'
      );
      mkdirSync(path.dirname(bugfixDoc), { recursive: true });
      writeFileSync(bugfixDoc, '# BUGFIX\n', 'utf8');
      writeFileSync(tasksDoc, '# TASKS\n', 'utf8');

      writeFileSync(
        bugfixDoc.replace(/\.md$/i, '.audit.md'),
        [
          'status: PASS',
          `reportPath: ${bugfixDoc.replace(/\.md$/i, '.audit.md').replace(/\\/g, '/')}`,
          'iteration_count: 1',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${bugfixDoc.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );
      writeFileSync(
        tasksDoc.replace(/\.md$/i, '.audit.md'),
        [
          'status: FAIL',
          `reportPath: ${tasksDoc.replace(/\.md$/i, '.audit.md').replace(/\\/g, '/')}`,
          'iteration_count: 2',
          'required_fixes_count: 3',
          'score_trigger_present: false',
          `artifactDocPath: ${tasksDoc.replace(/\\/g, '/')}`,
          'converged: false',
        ].join('\n'),
        'utf8'
      );

      syncAuditIndexFromAllReports(root);
      const loaded = readRuntimeContextRegistry(root);

      expect(loaded.auditIndex.bugfix[path.normalize(bugfixDoc)]?.status).toBe('PASS');
      expect(loaded.auditIndex.standalone_tasks[path.normalize(tasksDoc)]?.status).toBe('FAIL');
      expect(loaded.auditIndex.bugfix[path.normalize(bugfixDoc)]?.artifactDocPath).toBe(
        bugfixDoc.replace(/\\/g, '/')
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
