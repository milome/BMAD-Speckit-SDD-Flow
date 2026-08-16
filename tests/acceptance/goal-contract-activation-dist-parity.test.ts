import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const BIN = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

function run(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [BIN, 'goal-contract', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

describe('goal-contract activation dist parity', () => {
  it('generates and activates a frozen Goal through the same-run built package bin', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const outRoot = path.join(fixture.root, 'goal-run');
      const generated = run(fixture.root, [
        'generate',
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        fixture.runtimeRecordPath,
        '--out',
        outRoot,
        '--json',
      ]);
      expect(generated.status, generated.stderr || generated.stdout).toBe(0);

      const activated = run(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        path.join(outRoot, 'goal', 'active-authority.json'),
        '--json',
      ]);

      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      expect(activated.stderr).toBe('');
      const result = JSON.parse(activated.stdout);
      expect(result).toMatchObject({
        schemaVersion: 'goal-contract-activation-result/v1',
        status: 'activated',
        executionMode: 'direct_goal',
        partitionOutcome: 'not_applicable',
      });
      expect(
        result.artifacts.every((artifact: { artifactRef: string }) =>
          existsSync(artifact.artifactRef)
        )
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
