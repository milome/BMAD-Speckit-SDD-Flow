import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveGovernanceSkillInventory } from '../../scripts/skill-inventory-provider';

function writeSkill(root: string, relativePath: string, content?: string): void {
  const skillDir = path.join(root, relativePath);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    content ?? `# ${path.basename(skillDir)}`,
    'utf8'
  );
}

describe('skill inventory provider', () => {
  it('prefers project host-installed BMAD skills over workspace and global fallbacks', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'skill-inventory-provider-'));
    const home = path.join(root, 'fake-home');
    mkdirSync(home, { recursive: true });

    try {
      writeSkill(root, '.cursor/skills/bmad-party-mode');
      writeSkill(root, '.cursor/skills/speckit-workflow');
      writeSkill(root, '.agents/skills/requesting-code-review');
      writeSkill(root, 'skills/code-review');
      writeSkill(home, '.cursor/skills/code-reviewer');

      const result = resolveGovernanceSkillInventory({
        projectRoot: root,
        hostKind: 'cursor',
        homeDir: home,
      });

      expect(result.availableSkills).toEqual([
        'bmad-party-mode',
        'speckit-workflow',
        'requesting-code-review',
        'code-reviewer',
      ]);
      expect(result.skillInventory.map((entry) => [entry.skillId, entry.source, entry.priority])).toEqual([
        ['bmad-party-mode', 'project-host', 100],
        ['speckit-workflow', 'project-host', 100],
        ['requesting-code-review', 'project-agents', 90],
        ['code-reviewer', 'global-host', 70],
      ]);
      expect(result.skillPaths).toEqual([
        path.join(root, '.cursor', 'skills', 'bmad-party-mode', 'SKILL.md').replace(/\\/g, '/'),
        path.join(root, '.cursor', 'skills', 'speckit-workflow', 'SKILL.md').replace(/\\/g, '/'),
        path.join(root, '.agents', 'skills', 'requesting-code-review', 'SKILL.md').replace(/\\/g, '/'),
        path.join(home, '.cursor', 'skills', 'code-reviewer', 'SKILL.md').replace(/\\/g, '/'),
      ]);
      expect(result.availableSkills).not.toContain('code-review');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads title, description, and summary from SKILL.md metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'skill-inventory-provider-'));

    try {
      writeSkill(
        root,
        '.codex/skills/aios-architect',
        [
          '---',
          'name: AIOS Architect',
          'description: Design system architecture, APIs, and implementation plans for full-stack features.',
          '---',
          '',
          '# AIOS Architect',
          '',
          'Produce technical designs, architecture reviews, and implementation planning guidance.',
          '',
          '## When To Use',
          '',
          'Use for architecture planning, interface boundaries, and migration strategy.',
          '',
        ].join('\n')
      );

      const result = resolveGovernanceSkillInventory({
        projectRoot: root,
        hostKind: 'codex',
        homeDir: path.join(root, 'empty-home'),
      });

      expect(result.skillInventory).toHaveLength(1);
      expect(result.skillInventory[0]).toEqual(
        expect.objectContaining({
          skillId: 'aios-architect',
          title: 'AIOS Architect',
          description:
            'Design system architecture, APIs, and implementation plans for full-stack features.',
          summary: expect.stringContaining('Produce technical designs, architecture reviews'),
        })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to heading and first paragraph when frontmatter metadata is absent', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'skill-inventory-provider-'));

    try {
      writeSkill(
        root,
        '.codex/skills/party-mode',
        [
          '# Party Mode',
          '',
          'Coordinate multi-role design debate, prompt shaping, and stage-aware review handoff.',
          '',
          '## Workflow',
          '',
          '- Run consensus loops until stable.',
        ].join('\n')
      );

      const result = resolveGovernanceSkillInventory({
        projectRoot: root,
        hostKind: 'codex',
        homeDir: path.join(root, 'empty-home'),
      });

      expect(result.skillInventory).toHaveLength(1);
      expect(result.skillInventory[0]).toEqual(
        expect.objectContaining({
          skillId: 'party-mode',
          title: 'Party Mode',
          summary:
            'Coordinate multi-role design debate, prompt shaping, and stage-aware review handoff.',
        })
      );
      expect(result.skillInventory[0]).not.toHaveProperty('description');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
