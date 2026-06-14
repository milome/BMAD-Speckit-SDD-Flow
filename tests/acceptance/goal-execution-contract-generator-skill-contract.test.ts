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

    expect(skill).toContain('bmad-speckit goal-contract generate --source <path> --out <path> --json');
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
});
