import { existsSync, readFileSync } from 'node:fs';
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

  it('uses only deterministic standalone generation gates across installed skill surfaces', () => {
    const canonicalSkill = readFileSync(
      join(ROOT, '_bmad', 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
      'utf8'
    );
    const skillRoots = [
      '_bmad',
      '.codex',
      '.cursor',
      '.claude',
      join('packages', 'bmad-speckit', '_bmad'),
    ];

    for (const skillRoot of skillRoots) {
      const generatorSkill = readFileSync(
        join(ROOT, skillRoot, 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
        'utf8'
      );

      expect(generatorSkill).toBe(canonicalSkill);
      expect(generatorSkill).not.toContain('3 consecutive no-gap');
      expect(generatorSkill).not.toContain('exactly one `goal_full` authoring Judge');
      expect(generatorSkill).toContain(
        'The Source Oracle plus deterministic semantic validator is the only standalone semantic gate'
      );
      expect(generatorSkill).toContain('goalJudgeDispatchCount=0');
      expect(generatorSkill).toContain('Do not run any Task 6 authoring Judge');
      expect(generatorSkill).toContain(
        'The post-execution Task 7C Execution Final Judge and execution EffectivePass remain mandatory'
      );
      expect(generatorSkill).toContain(
        'Optional prose review may inspect the Markdown projection only'
      );
      expect(generatorSkill).toContain('check-contract-command-portability.js');
    }
  });

  it('publishes byte-identical Source Plan producer assets to every skill surface', () => {
    const skillRoots = [
      '_bmad',
      '.codex',
      '.cursor',
      '.claude',
      join('packages', 'bmad-speckit', '_bmad'),
    ];

    for (const asset of [
      'standalone-source-plan-template.md',
      'standalone-source-plan-profile.json',
    ]) {
      const canonical = readFileSync(
        join(
          ROOT,
          '_bmad',
          'skills',
          'goal-execution-contract-generator',
          'references',
          asset
        )
      );
      for (const skillRoot of skillRoots) {
        const projected = readFileSync(
          join(
            ROOT,
            skillRoot,
            'skills',
            'goal-execution-contract-generator',
            'references',
            asset
          )
        );
        expect(projected).toEqual(canonical);
      }
    }
  });

  it('does not publish removed standalone authoring Judge schemas', () => {
    const sharedRoots = [
      join(ROOT, '_bmad', 'shared', 'goal-contract'),
      join(ROOT, '.codex', 'shared', 'goal-contract'),
      join(ROOT, '.cursor', 'shared', 'goal-contract'),
      join(ROOT, '.claude', 'shared', 'goal-contract'),
      join(ROOT, 'packages', 'bmad-speckit', '_bmad', 'shared', 'goal-contract'),
    ];
    const removedSchemas = [
      'standalone-goal-authoring-effective-pass.schema.json',
      'standalone-goal-authoring-judge-aggregate.schema.json',
      'standalone-goal-authoring-judge-request.schema.json',
      'standalone-goal-authoring-judge-response.schema.json',
    ];

    for (const sharedRoot of sharedRoots) {
      for (const schema of removedSchemas) {
        expect(existsSync(join(sharedRoot, schema))).toBe(false);
      }
    }
  });
});
