import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const BMADS_AUTO_QUARANTINE_FILES = [
  '_bmad/commands/bmads-auto.md',
  '.codex/commands/bmads-auto.md',
  '.cursor/commands/bmads-auto.md',
  '.claude/commands/bmads-auto.md',
  '_bmad/skills/bmads-auto/SKILL.md',
];

function existingBmadsAutoFiles(): string[] {
  return BMADS_AUTO_QUARANTINE_FILES.filter((file) => fs.existsSync(path.join(root, file)));
}

describe('bmad-auto deprecation guard', () => {
  it('routes bmads automation guidance directly to Main Agent, not bmad-auto', () => {
    const rootSkill = read('_bmad/skills/bmad-speckit/SKILL.md');
    const bmadsCommand = read('_bmad/commands/bmads.md');

    expect(rootSkill).toContain('main-agent-orchestration --action inspect');
    expect(rootSkill).toContain('main-agent-orchestration --action dispatch-plan');
    expect(rootSkill).toContain('main-agent-orchestration --action run-loop');
    expect(rootSkill).toContain('main-agent:release-gate');
    expect(rootSkill).toContain('main-agent:delivery-truth-gate');
    expect(rootSkill).toContain('Do not route through `bmads-auto`');
    expect(rootSkill).not.toContain('use `bmads-auto`');
    expect(bmadsCommand).toContain('main-agent orchestration artifacts');
  });

  it.skipIf(existingBmadsAutoFiles().length === 0)(
    'keeps bmads-auto quarantined instead of executable as automation runtime',
    () => {
      for (const file of existingBmadsAutoFiles()) {
        const content = read(file);
        expect(content).toContain('Deprecated');
        expect(content).toContain('main-agent-orchestration --action inspect');
        expect(content).toContain('main-agent-orchestration --action run-loop');
        expect(content).not.toContain('Load and follow `{project-root}/_bmad/skills/bmads-auto/SKILL.md`');
        expect(content).not.toContain('This entry continues BMAD-Speckit automation');
      }
    }
  );

  it('removes bmads-auto runtime protection tests from default acceptance discovery', () => {
    const acceptanceFiles = fs.readdirSync(path.join(root, 'tests', 'acceptance'));
    expect(acceptanceFiles.filter((file) => /^bmads-auto-.*\.test\.ts$/.test(file))).toEqual([]);
    const quarantinedFiles = [
      'bmads-auto-contract-index.quarantined.ts',
      'bmads-auto-traceability.quarantined.ts',
      'bmads-auto-gap-registry.quarantined.ts',
    ].filter((file) => fs.existsSync(path.join(root, 'tests', 'acceptance', file)));
    for (const file of quarantinedFiles) {
      expect(acceptanceFiles).toContain(file);
    }
  });
});
