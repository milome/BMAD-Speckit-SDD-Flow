import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('goal-execution-contract-generator skill contract', () => {
  it('routes source-plan contract generation through the package CLI', () => {
    const skill = readFileSync(
      join(ROOT, '_bmad', 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
      'utf8'
    );

    expect(skill).toContain(
      'bmad-speckit goal-contract generate --entry standalone_goal_contract --source <path> --out <path> --json'
    );
    expect(skill).toContain('coverage receipt');
    expect(skill).toContain('large-document-writer is transport only');
    expect(skill).toContain('Codex, Claude Code, and Cursor');
  });

  it('forbids temporary generator scripts as success-path evidence', () => {
    const skill = readFileSync(
      join(ROOT, '_bmad', 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
      'utf8'
    );

    expect(skill).toContain('.tmp/*.cjs generation scripts are failure evidence only');
    expect(skill).toContain('not a success path');
  });

  it('keeps one standalone authoring Judge and forbids duplicate semantic review', () => {
    for (const skillRoot of ['_bmad', '.codex']) {
      const generatorSkill = readFileSync(
        join(ROOT, skillRoot, 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
        'utf8'
      );
      expect(generatorSkill).toContain(
        'Compile standalone source or confirmed Requirements authorities into a frozen GoalExecutionIR/v1 authority and a strict /goal projection.'
      );
      expect(generatorSkill).not.toContain('3 consecutive no-gap');
      expect(generatorSkill).toContain('exactly one `goal_full` authoring Judge');
      expect(generatorSkill).toContain(
        'Do not run a second Task 6 authoring semantic Judge or authoring EffectivePass'
      );
      expect(generatorSkill).toContain(
        'The post-execution Task 7C Execution Final Judge and execution EffectivePass remain mandatory'
      );
      expect(generatorSkill).toContain(
        'Optional prose review may inspect the Markdown projection only'
      );
      expect(generatorSkill).toContain('check-contract-command-portability.js');
    }
  });
});
