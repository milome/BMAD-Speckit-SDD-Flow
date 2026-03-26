import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('speckit canonical source alignment', () => {
  it('documents _bmad/speckit as the canonical workflow asset source', () => {
    const root = process.cwd();
    const readmePath = path.join(root, '_bmad', 'speckit', 'README.md');

    expect(existsSync(readmePath)).toBe(true);

    const content = readFileSync(readmePath, 'utf8');
    expect(content).toContain('single source of truth');
    expect(content).toContain('.specify');
    expect(content).toContain('runtime mirror');
  });

  it('keeps selected .specify files as synced mirrors of canonical speckit assets', () => {
    const root = process.cwd();
    const pairs = [
      ['_bmad/speckit/commands/speckit.specify.md', '.specify/templates/commands/specify.md'],
      ['_bmad/speckit/templates/tasks-template.md', '.specify/templates/tasks-template.md'],
      ['_bmad/speckit/commands/speckit.tasks.md', '.specify/templates/commands/tasks.md'],
      ['_bmad/speckit/commands/speckit.implement.md', '.specify/templates/commands/implement.md'],
      ['_bmad/speckit/commands/speckit.checklist.md', '.specify/templates/commands/checklist.md'],
      [
        '_bmad/speckit/commands/speckit.constitution.md',
        '.specify/templates/commands/constitution.md',
      ],
    ] as const;

    for (const [sourceRel, mirrorRel] of pairs) {
      const sourcePath = path.join(root, sourceRel);
      const mirrorPath = path.join(root, mirrorRel);

      expect(existsSync(sourcePath), sourceRel).toBe(true);
      expect(existsSync(mirrorPath), mirrorRel).toBe(true);
      expect(readFileSync(mirrorPath, 'utf8')).toBe(readFileSync(sourcePath, 'utf8'));
    }
  });
});
