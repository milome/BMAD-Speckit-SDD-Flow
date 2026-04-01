import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ALIASES = [
  {
    name: 'speckit-specify',
    canonical: '_bmad/claude/agents/speckit-specify.md',
    runtime: '.claude/agents/speckit-specify.md',
    layer: '.claude/agents/layers/bmad-layer4-speckit-specify.md',
  },
  {
    name: 'speckit-plan',
    canonical: '_bmad/claude/agents/speckit-plan.md',
    runtime: '.claude/agents/speckit-plan.md',
    layer: '.claude/agents/layers/bmad-layer4-speckit-plan.md',
  },
  {
    name: 'speckit-gaps',
    canonical: '_bmad/claude/agents/speckit-gaps.md',
    runtime: '.claude/agents/speckit-gaps.md',
    layer: '.claude/agents/layers/bmad-layer4-speckit-gaps.md',
  },
  {
    name: 'speckit-tasks',
    canonical: '_bmad/claude/agents/speckit-tasks.md',
    runtime: '.claude/agents/speckit-tasks.md',
    layer: '.claude/agents/layers/bmad-layer4-speckit-tasks.md',
  },
];

describe('Claude speckit top-level aliases', () => {
  it('canonical aliases exist and point to Layer 4 canonical bodies', () => {
    for (const alias of ALIASES) {
      expect(existsSync(alias.canonical), `${alias.canonical} should exist`).toBe(true);
      const content = readFileSync(alias.canonical, 'utf8');
      expect(content).toContain('Compatibility Alias');
      expect(content).toContain(alias.layer);
      expect(content).toContain('canonical execution body');
    }
  });

  it('runtime aliases match canonical aliases after init:claude when runtime files exist', () => {
    for (const alias of ALIASES) {
      if (!existsSync(alias.runtime)) {
        continue;
      }

      expect(readFileSync(alias.runtime, 'utf8')).toBe(readFileSync(alias.canonical, 'utf8'));
    }
  });
});
