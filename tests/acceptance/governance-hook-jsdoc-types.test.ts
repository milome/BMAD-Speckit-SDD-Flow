import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listUnexpectedLegacyConsumerHookFiles } from '../../packages/bmad-speckit/src/services/install-surface-manifest';

const repoRoot = process.cwd();

describe('governance hook jsdoc typing', () => {
  it('annotates governance hook result contracts directly in JS hook entrypoints', () => {
    const cases = [
      {
        file: path.join(repoRoot, '_bmad', 'claude', 'hooks', 'post-tool-use.cjs'),
        typedefs: [
          'GovernanceBackgroundTrigger',
          'GovernancePostToolUseResult',
        ],
        returns: '@returns {GovernancePostToolUseResult | null}',
      },
      {
        file: path.join(repoRoot, '_bmad', 'cursor', 'hooks', 'post-tool-use.cjs'),
        typedefs: [
          'GovernanceBackgroundTrigger',
          'GovernancePostToolUseResult',
        ],
        returns: '@returns {GovernancePostToolUseResult | null}',
      },
      {
        file: path.join(repoRoot, '_bmad', 'claude', 'hooks', 'stop.cjs'),
        typedefs: ['GovernanceStopHookResult', 'GovernanceWorkerResult'],
        returns: '@returns {GovernanceStopHookResult}',
      },
    ];

    for (const testCase of cases) {
      const content = readFileSync(testCase.file, 'utf8');
      expect(content).toContain("// @ts-check");
      for (const typedefName of testCase.typedefs) {
        expect(content).toContain(
          `@typedef {import('../../../scripts/governance-hook-types').${typedefName}} ${typedefName}`
        );
      }
      expect(content).toContain(testCase.returns);
    }
    expect(
      listUnexpectedLegacyConsumerHookFiles(path.join(repoRoot, '_bmad', 'runtime', 'hooks'))
    ).toHaveLength(0);
  });
});
