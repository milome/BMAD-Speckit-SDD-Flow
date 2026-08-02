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
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveCanonicalPackageTarball } from '../helpers/canonical-package-artifact';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const ROOT_PACKAGE_VERSION = JSON.parse(
  readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')
).version;

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'safe.directory',
      GIT_CONFIG_VALUE_0: PKG_ROOT,
      npm_config_loglevel: 'error',
    },
  });
}

function runJson(cmd: string, cwd: string): any {
  return JSON.parse(run(cmd, cwd));
}

function writeLargeDocChunk(
  target: string,
  chunkId: string,
  sectionId: string,
  body: string
): string {
  const chunkPath = join(target, `${chunkId}-${sectionId}.md`);
  writeFileSync(
    chunkPath,
    [
      `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} begin -->`,
      body.trimEnd(),
      `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} end -->`,
      '',
    ].join('\n'),
    'utf8'
  );
  return chunkPath;
}

function findFirstExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function expectFirstExistingPath(candidates: string[]): string {
  const found = findFirstExistingPath(candidates);
  expect(found, `Expected one existing path from: ${candidates.join(', ')}`).toBeTruthy();
  return found!;
}

describe('npm pack root package → clean install → CLI', () => {
  it('canonical tgz → install → version + sync + ensure-run', () => {
    const tgzPath = resolveCanonicalPackageTarball(PKG_ROOT);

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
      expect(
        existsSync(join(rootInstallDir, '_bmad', 'skills', 'large-document-writer', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(
          join(rootInstallDir, '_bmad', 'skills', 'large-document-writer', 'agents', 'openai.yaml')
        )
      ).toBe(true);
      expect(
        expectFirstExistingPath([
          join(rootInstallDir, 'node_modules', 'bmad-speckit', 'dist', 'commands', 'large-doc.js'),
          join(rootInstallDir, 'packages', 'bmad-speckit', 'dist', 'commands', 'large-doc.js'),
          join(rootInstallDir, 'dist', 'commands', 'large-doc.js'),
        ])
      ).toBeTruthy();
      expectFirstExistingPath([
        join(
          rootInstallDir,
          'node_modules',
          'bmad-speckit',
          'dist',
          'utils',
          'large-document-writer',
          'index.js'
        ),
        join(
          rootInstallDir,
          'packages',
          'bmad-speckit',
          'dist',
          'utils',
          'large-document-writer',
          'index.js'
        ),
        join(rootInstallDir, 'dist', 'utils', 'large-document-writer', 'index.js'),
      ]);
      expect(run('npx bmad-speckit large-doc --help', consumer)).toContain('large-doc');
      expect(existsSync(join(consumer, 'scripts'))).toBe(false);

      const largeDocTarget = join(consumer, 'large-doc-smoke.md');
      const init = runJson(
        `npx --no-install bmad-speckit large-doc init --target "${largeDocTarget}" --chunk c1:smoke --require-heading "# Smoke" --min-bytes 20 --json`,
        consumer
      );
      expect(init.schemaVersion).toBe('large-document-writer-session-init/v1');
      const chunkPath = writeLargeDocChunk(
        consumer,
        'c1',
        'smoke',
        '# Smoke\n\nlarge document writer smoke content'
      );
      const addChunk = runJson(
        `npx --no-install bmad-speckit large-doc add-chunk --session "${init.sessionDir}" --chunk-id c1 --section-id smoke --content-file "${chunkPath}" --json`,
        consumer
      );
      expect(addChunk.schemaVersion).toBe('large-document-writer-chunk-receipt/v1');
      const assemble = runJson(
        `npx --no-install bmad-speckit large-doc assemble --session "${init.sessionDir}" --json`,
        consumer
      );
      expect(assemble.schemaVersion).toBe('large-document-writer-assembly-receipt/v1');
      const validate = runJson(
        `npx --no-install bmad-speckit large-doc validate --session "${init.sessionDir}" --json`,
        consumer
      );
      expect(validate.schemaVersion).toBe('large-document-writer-validation-receipt/v1');
      expect(validate.ok).toBe(true);
      const promote = runJson(
        `npx --no-install bmad-speckit large-doc promote --session "${init.sessionDir}" --json`,
        consumer
      );
      expect(promote.schemaVersion).toBe('large-document-writer-promote-receipt/v1');
      expect(readFileSync(largeDocTarget, 'utf8')).toContain('# Smoke');
      const cleanup = runJson(
        `npx --no-install bmad-speckit large-doc cleanup --session "${init.sessionDir}" --policy delete --json`,
        consumer
      );
      expect(cleanup.schemaVersion).toBe('large-document-writer-cleanup-receipt/v1');
      expect(cleanup.policy).toBe('delete');

      const installedPromoteScript = join(
        rootInstallDir,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'promote-draft-large-doc.js'
      );
      const installedManifestScript = join(
        rootInstallDir,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'generate-draft-manifest.js'
      );
      const installedNormalizeScript = join(
        rootInstallDir,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'normalize-draft-markdown.js'
      );
      const installedPrepareCurrentSourcePromotionScript = join(
        rootInstallDir,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'prepare-current-source-promotion.js'
      );
      const installedWriteCriticalAuditorNoNewGapResponseScript = join(
        rootInstallDir,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'write-critical-auditor-no-new-gap-response.js'
      );
      const installedProjectionQualityGateScript = join(
        rootInstallDir,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'projection_quality_gate.js'
      );
      expect(existsSync(installedPromoteScript)).toBe(true);
      expect(existsSync(installedManifestScript)).toBe(true);
      expect(existsSync(installedNormalizeScript)).toBe(true);
      expect(existsSync(installedPrepareCurrentSourcePromotionScript)).toBe(true);
      expect(existsSync(installedWriteCriticalAuditorNoNewGapResponseScript)).toBe(true);
      expect(existsSync(installedProjectionQualityGateScript)).toBe(true);
      expect(readFileSync(installedProjectionQualityGateScript, 'utf8')).toContain(
        'projection_per_must_acceptance_not_independent'
      );
      expect(run(`"${process.execPath}" "${installedPromoteScript}" --help`, consumer)).toContain(
        '--preflight-only'
      );
      const draftPath = join(consumer, 'draft-requirements.md');
      const targetPath = join(consumer, 'requirements.md');
      writeFileSync(
        draftPath,
        [
          '# Draft',
          '',
          'implementationConfirmation:',
          '  status: draft',
          '  must:',
          '    - id: MUST-001',
          '      text: "The consumer install can run the skill-local promotion preflight."',
          '',
        ].join('\n'),
        'utf8'
      );
      const promotion = JSON.parse(
        run(
          `"${process.execPath}" "${installedPromoteScript}" --draft "${draftPath}" --target "${targetPath}" --preflight-only --json`,
          consumer
        )
      );
      expect(promotion.ok).toBe(true);

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
      expect(bundledRe).toBeTruthy();
      expect(existsSync(reEmit)).toBe(true);
      expect(existsSync(reResolve)).toBe(true);

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
        [
          '# Tasks',
          '',
          '- [ ] T001 Implement runtime flow in packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context.ts',
        ].join('\n'),
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
        `npx bmad-speckit ralph record-phase --tasksPath "${tasksPath.replace(/\\/g, '/')}" --userStoryId "US-001" --title "T001 Implement runtime flow in packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context.ts" --phase TDD-RED --detail "T001 vitest tests/runtime.test.ts => 1 failed"`,
        consumer
      );
      expect(ralphRecord).toContain('Recorded Ralph phase TDD-RED');

      run(
        `npx bmad-speckit ralph record-phase --tasksPath "${tasksPath.replace(/\\/g, '/')}" --userStoryId "US-001" --title "T001 Implement runtime flow in packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context.ts" --phase TDD-GREEN --detail "T001 vitest tests/runtime.test.ts => 1 passed"`,
        consumer
      );
      run(
        `npx bmad-speckit ralph record-phase --tasksPath "${tasksPath.replace(/\\/g, '/')}" --userStoryId "US-001" --title "T001 Implement runtime flow in packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context.ts" --phase TDD-REFACTOR --detail "T001 no refactor needed"`,
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
      expect(resolveRun.status, resolveRun.stderr || resolveRun.stdout).toBe(0);
      expect((resolveRun.stdout || '').trim()).toMatch(/"resolvedMode"\s*:\s*"en"/);
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  }, 360_000);
});
