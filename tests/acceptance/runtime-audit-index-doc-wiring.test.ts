import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('runtime audit index doc wiring', () => {
  it('requires auditor-bugfix and auditor-tasks-doc to write audit index after saving the report', () => {
    const bugfix = readRepoFile('_bmad/claude/agents/auditors/auditor-bugfix.md');
    const tasksDoc = readRepoFile('_bmad/claude/agents/auditors/auditor-tasks-doc.md');

    for (const doc of [bugfix, tasksDoc]) {
      expect(doc).toContain('post-actions runner');
      expect(doc).toContain('自动');
      expect(doc).toContain('auditIndex');
      expect(doc).toContain('reportPath');
    }
  });
});
