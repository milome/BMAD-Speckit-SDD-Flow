/**
 * Acceptance: root npm pack → clean consumer dir → npm install .tgz → runtime CLI subcommands.
 * Requires: root `npm run prepublishOnly` so bundleDependencies are synced into the root package tarball.
 * Story 15.2 D: bundled `resolve-for-session.cjs` smoke (no consumer `scripts/`).
 */
import { execSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const ROOT_PACKAGE_VERSION = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version;

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

function findFirstExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

describe('npm pack root package → clean install → CLI', () => {
  it('prepublishOnly → pack → install tgz → version + sync + ensure-run', () => {
    run('npm run prepublishOnly', PKG_ROOT);

    // Pack into an isolated temp dir so parallel vitest workers do not delete each other's tarball.
    const packDir = mkdtempSync(join(tmpdir(), 'bmad-speckit-root-pack-'));
    run(`npm pack --pack-destination "${packDir.replace(/\\/g, '/')}"`, PKG_ROOT);
    const tgzName = readdirSync(packDir).find(
      (f) => f.startsWith('bmad-speckit-sdd-flow-') && f.endsWith('.tgz')
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
      expect(ver).toContain(ROOT_PACKAGE_VERSION);

      const rootInstallDir = join(consumer, 'node_modules', 'bmad-speckit-sdd-flow');
      const bundledRe =
        findFirstExistingPath([
          join(
            rootInstallDir,
            'packages',
            'bmad-speckit',
            'node_modules',
            '@bmad-speckit',
            'runtime-emit',
            'dist'
          ),
          join(
            rootInstallDir,
            'node_modules',
            'bmad-speckit',
            'node_modules',
            '@bmad-speckit',
            'runtime-emit',
            'dist'
          ),
          join(rootInstallDir, 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist'),
        ]) ?? '';
      const reEmit = join(bundledRe, 'emit-runtime-policy.cjs');
      const reResolve = join(bundledRe, 'resolve-for-session.cjs');
      const reGovWorker = join(bundledRe, 'governance-runtime-worker.cjs');
      const reGovRunner = join(bundledRe, 'governance-remediation-runner.cjs');
      expect(bundledRe).toBeTruthy();
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

      const tasksDir = join(consumer, 'specs', 'story-1');
      const tasksPath = join(tasksDir, 'tasks.md');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(
        tasksPath,
        ['# Tasks', '', '- [ ] T001 Implement runtime flow in scripts/runtime-context.ts'].join('\n'),
        'utf8'
      );

      const ralphPrepare = run(
        `npx bmad-speckit ralph prepare --tasksPath "${tasksPath.replace(/\\/g, '/')}"`,
        consumer
      );
      expect(ralphPrepare).toContain('Prepared Ralph tracking');
      expect(existsSync(join(tasksDir, 'prd.tasks.json'))).toBe(true);
      expect(existsSync(join(tasksDir, 'progress.tasks.txt'))).toBe(true);

      const ralphRecord = run(
        `npx bmad-speckit ralph record-phase --tasksPath "${tasksPath.replace(/\\/g, '/')}" --userStoryId "US-001" --title "T001 Implement runtime flow in scripts/runtime-context.ts" --phase TDD-RED --detail "T001 vitest tests/runtime.test.ts => 1 failed"`,
        consumer
      );
      expect(ralphRecord).toContain('Recorded Ralph phase TDD-RED');

      run(
        `npx bmad-speckit ralph record-phase --tasksPath "${tasksPath.replace(/\\/g, '/')}" --userStoryId "US-001" --title "T001 Implement runtime flow in scripts/runtime-context.ts" --phase TDD-GREEN --detail "T001 vitest tests/runtime.test.ts => 1 passed"`,
        consumer
      );
      run(
        `npx bmad-speckit ralph record-phase --tasksPath "${tasksPath.replace(/\\/g, '/')}" --userStoryId "US-001" --title "T001 Implement runtime flow in scripts/runtime-context.ts" --phase TDD-REFACTOR --detail "T001 no refactor needed"`,
        consumer
      );
      const ralphVerify = run(
        `npx bmad-speckit ralph verify --tasksPath "${tasksPath.replace(/\\/g, '/')}"`,
        consumer
      );
      expect(ralphVerify).toContain('Ralph compliance verification passed');

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
