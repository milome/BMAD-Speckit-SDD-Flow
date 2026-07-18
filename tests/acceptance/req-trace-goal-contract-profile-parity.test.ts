import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VERIFY_GOAL_PROFILE = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'verify-goal-contract-profile.js'
);

describe('req-trace goal contract profile parity', () => {
  it('verifies both _bmad and .codex goal contract reference projections', () => {
    const stdout = execFileSync(process.execPath, [VERIFY_GOAL_PROFILE], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.checkedReferences).toEqual(
      expect.arrayContaining([
        '_bmad/skills/goal-execution-contract-generator/references/goal-execution-contract-template.md',
        '_bmad/skills/goal-execution-contract-generator/references/goal-contract-profile.json',
        '.codex/skills/goal-execution-contract-generator/references/goal-execution-contract-template.md',
        '.codex/skills/goal-execution-contract-generator/references/goal-contract-profile.json',
      ])
    );
  });
});
