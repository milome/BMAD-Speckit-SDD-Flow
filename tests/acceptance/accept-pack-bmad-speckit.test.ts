/**
 * Acceptance: npm pack → clean consumer dir → npm install .tgz → runtime CLI subcommands.
 * Requires: root `npm run prepublishOnly` so bundleDependencies are synced under packages/bmad-speckit/node_modules.
 * Story 15.2 D: bundled `resolve-for-session.cjs` smoke (no consumer `scripts/`).
 */
import { execSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
    },
  });
}

describe('npm pack bmad-speckit → clean install → CLI', () => {
  it('prepublishOnly → pack → install tgz → version + sync + ensure-run', () => {
    run('npm run prepublishOnly', PKG_ROOT);

    // Pack into an isolated temp dir so parallel vitest workers do not delete each other's tarball under packages/bmad-speckit.
    const packDir = mkdtempSync(join(tmpdir(), 'bmad-speckit-pack-'));
    run(
      `npm pack -w bmad-speckit --pack-destination "${packDir.replace(/\\/g, '/')}"`,
      PKG_ROOT
    );
    const tgzName = readdirSync(packDir).find(
      (f) => f.startsWith('bmad-speckit') && f.endsWith('.tgz')
    );
    expect(tgzName).toBeTruthy();
    const tgzPath = join(packDir, tgzName!);

    const consumer = mkdtempSync(join(tmpdir(), 'accept-pack-'));
    try {
      writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({ name: 'accept-pack-consumer', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install "${tgzPath.replace(/\\/g, '/')}"`, consumer);

      const ver = run('npx bmad-speckit version', consumer);
      expect(ver).toMatch(/0\.1\.0/);

      const bundledRe = join(
        consumer,
        'node_modules',
        'bmad-speckit',
        'node_modules',
        '@bmad-speckit',
        'runtime-emit',
        'dist'
      );
      const reEmit = join(bundledRe, 'emit-runtime-policy.cjs');
      const reResolve = join(bundledRe, 'resolve-for-session.cjs');
      const reGovWorker = join(bundledRe, 'governance-runtime-worker.cjs');
      const reGovRunner = join(bundledRe, 'governance-remediation-runner.cjs');
      expect(existsSync(reEmit)).toBe(true);
      expect(existsSync(reResolve)).toBe(true);
      expect(existsSync(reGovWorker)).toBe(true);
      expect(existsSync(reGovRunner)).toBe(true);

      const sprintDir = join(consumer, '_bmad-output', 'implementation-artifacts');
      const sprintFile = join(sprintDir, 'sprint-status.yaml');
      mkdirSync(sprintDir, { recursive: true });
      writeFileSync(
        sprintFile,
        `development_status:\n  epic-1: backlog\n  1-1-test-story: backlog\n`,
        'utf8'
      );

      const syncOut = run('npx bmad-speckit sync-runtime-context-from-sprint', consumer);
      expect(syncOut).toMatch(/OK: registry and project context synced/);

      const runOut = run(
        'npx bmad-speckit ensure-run-runtime-context --story-key 1-1-test-story --lifecycle dev_story',
        consumer
      );
      expect(runOut).toMatch(/RUN_ID:[0-9a-f-]{36}/);

      cpSync(join(PKG_ROOT, '_bmad'), join(consumer, '_bmad'), { recursive: true });
      writeMinimalRegistryAndProjectContext(consumer, { flow: 'story', stage: 'specify' });
      expect(existsSync(join(consumer, 'scripts'))).toBe(false);
      const stdin = JSON.stringify({
        projectRoot: consumer,
        userMessage: '请用英文回答',
        writeContext: false,
      });
      const resolveRun = spawnSync(process.execPath, [reResolve], {
        cwd: consumer,
        input: stdin,
        encoding: 'utf8',
      });
      expect(resolveRun.status).toBe(0);
      expect((resolveRun.stdout || '').trim()).toMatch(/"resolvedMode"\s*:\s*"en"/);
    } finally {
      rmSync(consumer, { recursive: true, force: true });
      rmSync(packDir, { recursive: true, force: true });
    }
  }, 180_000);
});
