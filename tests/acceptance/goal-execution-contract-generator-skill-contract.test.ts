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

  it('delegates review convergence to one hash-bound multi-view loop', () => {
    for (const skillRoot of ['_bmad', '.codex']) {
      const generatorSkill = readFileSync(
        join(ROOT, skillRoot, 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
        'utf8'
      );
      const reviewSkill = readFileSync(
        join(ROOT, skillRoot, 'skills', 'multi-view-doc-review-loop', 'SKILL.md'),
        'utf8'
      );

      expect(generatorSkill).toContain(
        'Generate strict frozen /goal execution contract documents from conversation requirements or existing requirement documents using the shared goal-contract template projection.'
      );
      expect(generatorSkill).not.toContain('3 consecutive no-gap');
      expect(generatorSkill).toContain('multi-view-doc-review-loop');
      expect(generatorSkill).toContain('latest-hash three-perspective PASS');
      expect(generatorSkill).toContain('do not run a separate final docs-review');
      expect(generatorSkill).toContain(
        'Preserve any existing final docs-review only for unrelated non-standalone documentation workflows'
      );
      expect(generatorSkill).toContain('check-contract-command-portability.js');

      expect(reviewSkill).toContain('auditEpochId');
      expect(reviewSkill).toContain('targetHash');
      expect(reviewSkill).toContain('MUST NOT edit');
      expect(reviewSkill).toContain('batch fix');
      expect(reviewSkill).toContain('Selective Revalidation Matrix');
      expect(reviewSkill).toContain('180000');
      expect(reviewSkill).toContain('two audit epochs');
      expect(reviewSkill).toContain('single final docs-review');
      expect(reviewSkill).toContain(
        'Existing user authorization remains valid across internal convergence cycles'
      );
      expect(reviewSkill).toContain(
        'keep that perspective local for the remainder of the convergence run'
      );
      expect(reviewSkill).not.toContain('start a new user-authorized convergence cycle');
    }
  });
});
