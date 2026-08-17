import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { materializeGoalRunExecutionAdapter } from '../helpers/goal-run-execution-adapter-fixture';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_loglevel: 'error' },
  });
}

function expectSuccess(result: ReturnType<typeof run>) {
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return result;
}

describe('goal-contract activation installed runtime', () => {
  it('packs the current worktree and activates through a clean consumer install', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'goal-activation-installed-'));
    const packRoot = path.join(root, 'pack');
    const consumerRoot = path.join(root, 'consumer');
    mkdirSync(packRoot, { recursive: true });
    mkdirSync(consumerRoot, { recursive: true });
    try {
      const packed = expectSuccess(
        run(
          NPM,
          ['pack', '--ignore-scripts', '--json', '--pack-destination', packRoot],
          PACKAGE_ROOT
        )
      );
      const packResult = JSON.parse(packed.stdout);
      const tarballPath = path.join(packRoot, packResult[0].filename);
      expect(existsSync(tarballPath)).toBe(true);
      writeFileSync(
        path.join(consumerRoot, 'package.json'),
        `${JSON.stringify({ name: 'goal-activation-consumer', private: true })}\n`,
        'utf8'
      );
      expectSuccess(
        run(NPM, ['install', '--ignore-scripts', '--no-save', tarballPath], consumerRoot)
      );
      const installedBin = path.join(
        consumerRoot,
        'node_modules',
        'bmad-speckit',
        'bin',
        'bmad-speckit.js'
      );
      expect(existsSync(installedBin)).toBe(true);

      const fixture = materializeImplementationReadinessFixture({
        root: path.join(consumerRoot, 'fixture'),
      });
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const outRoot = path.join(fixture.root, 'goal-run');
      const generated = expectSuccess(
        run(
          process.execPath,
          [
            installedBin,
            'goal-contract',
            'generate',
            '--entry',
            'requirements_backed_goal',
            '--requirements-record',
            fixture.runtimeRecordPath,
            '--out',
            outRoot,
            '--json',
          ],
          fixture.root
        )
      );
      expect(JSON.parse(generated.stdout).status).toBe('requirements_backed_goal_ready');
      materializeGoalRunExecutionAdapter(outRoot);

      const activated = expectSuccess(
        run(
          process.execPath,
          [
            installedBin,
            'goal-contract',
            'activate',
            '--cwd',
            fixture.root,
            '--goal-authority',
            path.join(outRoot, 'goal', 'active-authority.json'),
            '--json',
          ],
          fixture.root
        )
      );
      expect(JSON.parse(activated.stdout)).toMatchObject({
        schemaVersion: 'goal-contract-activation-result/v1',
        status: 'activated',
        executionMode: 'direct_goal',
        partitionOutcome: 'not_applicable',
      });
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 300_000);
});
