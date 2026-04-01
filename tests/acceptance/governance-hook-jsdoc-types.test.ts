import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('governance hook jsdoc typing', () => {
  it('annotates governance hook result contracts directly in JS hook entrypoints', () => {
    const cases = [
      {
        file: path.join(repoRoot, '_bmad', 'claude', 'hooks', 'post-tool-use.js'),
        typedefs: [
          'GovernanceBackgroundTrigger',
          'GovernancePostToolUseResult',
        ],
        returns: '@returns {GovernancePostToolUseResult | null}',
      },
      {
        file: path.join(repoRoot, '_bmad', 'cursor', 'hooks', 'post-tool-use.js'),
        typedefs: [
          'GovernanceBackgroundTrigger',
          'GovernancePostToolUseResult',
        ],
        returns: '@returns {GovernancePostToolUseResult | null}',
      },
      {
        file: path.join(repoRoot, '_bmad', 'claude', 'hooks', 'stop.js'),
        typedefs: ['GovernanceStopHookResult', 'GovernanceWorkerResult'],
        returns: '@returns {GovernanceStopHookResult}',
      },
      {
        file: path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'run-bmad-runtime-worker.js'),
        typedefs: ['GovernanceWorkerResult'],
        returns: '@returns {GovernanceWorkerResult}',
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

    const runtimeWorkerContent = readFileSync(
      path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'run-bmad-runtime-worker.js'),
      'utf8'
    );
    expect(runtimeWorkerContent).toContain(
      "@typedef {import('../../../scripts/governance-hook-types').GovernanceWorkerResult} GovernanceWorkerResult"
    );
    expect(runtimeWorkerContent).toContain('* @typedef {{');
    expect(runtimeWorkerContent).toContain('* }} GovernanceWorkerOptions');
    expect(runtimeWorkerContent).toContain('/**\n * @param {GovernanceWorkerOptions} [options]');
    expect(runtimeWorkerContent).toContain('function runWorkerWithRunnerLock(options = {})');
    expect(runtimeWorkerContent).toContain('function runBmadRuntimeWorker(options = {})');
  });
});
