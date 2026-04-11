import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('bmad-help entry surface contract', () => {
  it('aligns help workflows and catalog rows to state-aware routing', () => {
    const skillWorkflow = readRepoFile('_bmad/skills/bmad-help/workflow.md');
    const coreWorkflow = readRepoFile('_bmad/core/skills/bmad-help/workflow.md');
    const skillCard = readRepoFile('_bmad/skills/bmad-help/SKILL.md');
    const coreSkillCard = readRepoFile('_bmad/core/skills/bmad-help/SKILL.md');
    const coreTask = readRepoFile('_bmad/core/tasks/help.md');
    const command = readRepoFile('_bmad/commands/bmad-help.md');
    const catalog = readRepoFile('_bmad/_config/bmad-help.csv');
    const moduleHelp = readRepoFile('_bmad/core/module-help.csv');
    const taskManifest = readRepoFile('_bmad/_config/task-manifest.csv');

    for (const doc of [skillWorkflow, coreWorkflow, coreTask]) {
      expect(doc).toContain('contextMaturity');
      expect(doc).toContain('implementationReadinessStatus');
      expect(doc).toContain('最多 1 到 2 个关键问题');
      expect(doc).toContain('recommended');
      expect(doc).toContain('allowed but not recommended');
      expect(doc).toContain('blocked');
      expect(doc).toContain('implementation-readiness');
    }

    expect(command).toMatch(/LOAD.*bmad-help.*SKILL\.md/);
    expect(command).toContain('contextMaturity');
    expect(command).toContain('implementationReadinessStatus');
    expect(command).toContain('recommended / allowed but not recommended / blocked');

    for (const doc of [skillCard, coreSkillCard]) {
      expect(doc).toContain('contextMaturity');
      expect(doc).toContain('implementationReadinessStatus');
      expect(doc).toContain('complexity');
    }

    expect(moduleHelp).toContain('contextMaturity');
    expect(moduleHelp).toContain('implementationReadinessStatus');
    expect(taskManifest).toContain('state-aware');

    expect(catalog).toContain('contextMaturity');
    expect(catalog).toContain('implementationReadinessStatus');
    expect(catalog).toContain('BUGFIX 文档审计');
    expect(catalog).toContain('TASKS/BUGFIX 文档前置审计');
    expect(catalog).toContain('high complexity');
  });
});
