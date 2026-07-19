/**
 * Acceptance: Install to temp consumer ->run CLI (check, version).
 * Covers setup.ps1, setup.sh, npm install, init-to-root flows.
 * Runs in CI (ubuntu-latest).
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function cleanupTempDir(target: string): void {
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function run(cmd: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  return execSync(cmd, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}

function runRepoCli(args: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  const cli = `"${process.execPath}" "${join(PKG_ROOT, 'scripts', 'bmad-speckit-cli.js')}" ${args}`;
  return run(cli, cwd, env);
}

function runJson(cmd: string, cwd: string, env?: NodeJS.ProcessEnv): any {
  return JSON.parse(run(cmd, cwd, env));
}

function installRootPackageToConsumer(target: string): void {
  const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
  run(`npm install --ignore-scripts --save-dev "file:${pkgPath}"`, target);
  run('npm rebuild bmad-speckit-sdd-flow --foreground-scripts', target);
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

describe('install to consumer ->CLI acceptance', () => {
  it('init-to-root deploy ->bmad-speckit check passes', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-init-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      expect(existsSync(join(target, 'package.json'))).toBe(false);
      expect(existsSync(join(target, '_bmad'))).toBe(true);
      expect(existsSync(join(target, 'specs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'skills', 'encoding-integrity-guardian', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'))
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode.mdc'))).toBe(
        false
      );
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad-output', 'runtime', 'requirement-records', 'index.json'))
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story_story_create')
        )
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story-story_create')
        )
      ).toBe(false);

      const out = runRepoCli('check', target);
      expect(out).toMatch(/Check OK|OK/i);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('init-to-root deploy ->bmad-speckit version runs', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-ver-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      const out = runRepoCli('version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('npm install followed by postinstall rebuild deploys ->bmad-speckit check passes', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-npm-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );
      installRootPackageToConsumer(target);
      expect(existsSync(join(target, '_bmad'))).toBe(true);
      expect(existsSync(join(target, '.cursor'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'npm-public-release', 'SKILL.md'))).toBe(
        true
      );
      expect(existsSync(join(target, '.cursor', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'))
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'))
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode.mdc'))).toBe(
        false
      );
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'emit-runtime-policy.cjs'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'start-runtime-dashboard-server.cjs'))).toBe(false);
      expect(existsSync(join(target, 'scripts'))).toBe(false);
      expect(existsSync(join(target, '_bmad', 'skills', 'large-document-writer', 'SKILL.md'))).toBe(
        true
      );
      expect(
        existsSync(join(target, '_bmad', 'skills', 'large-document-writer', 'agents', 'openai.yaml'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad-output', 'runtime', 'requirement-records', 'index.json'))
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story_story_create')
        )
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story-story_create')
        )
      ).toBe(false);

      const out = run('npx bmad-speckit check', target);
      expect(out).toMatch(/Check OK|OK/i);
      expect(run('npx bmad-speckit large-doc --help', target)).toContain('large-doc');
      expect(existsSync(join(target, 'scripts'))).toBe(false);

      const largeDocTarget = join(target, 'large-doc-smoke.md');
      const init = runJson(
        `npx --no-install bmad-speckit large-doc init --target "${largeDocTarget}" --chunk c1:smoke --require-heading "# Smoke" --min-bytes 20 --json`,
        target
      );
      expect(init.schemaVersion).toBe('large-document-writer-session-init/v1');
      const chunkPath = writeLargeDocChunk(
        target,
        'c1',
        'smoke',
        '# Smoke\n\nlarge document writer smoke content'
      );
      const addChunk = runJson(
        `npx --no-install bmad-speckit large-doc add-chunk --session "${init.sessionDir}" --chunk-id c1 --section-id smoke --content-file "${chunkPath}" --json`,
        target
      );
      expect(addChunk.schemaVersion).toBe('large-document-writer-chunk-receipt/v1');
      const assemble = runJson(
        `npx --no-install bmad-speckit large-doc assemble --session "${init.sessionDir}" --json`,
        target
      );
      expect(assemble.schemaVersion).toBe('large-document-writer-assembly-receipt/v1');
      const validate = runJson(
        `npx --no-install bmad-speckit large-doc validate --session "${init.sessionDir}" --json`,
        target
      );
      expect(validate.schemaVersion).toBe('large-document-writer-validation-receipt/v1');
      expect(validate.ok).toBe(true);
      const promote = runJson(
        `npx --no-install bmad-speckit large-doc promote --session "${init.sessionDir}" --json`,
        target
      );
      expect(promote.schemaVersion).toBe('large-document-writer-promote-receipt/v1');
      expect(readFileSync(largeDocTarget, 'utf8')).toContain('# Smoke');
      const cleanup = runJson(
        `npx --no-install bmad-speckit large-doc cleanup --session "${init.sessionDir}" --policy delete --json`,
        target
      );
      expect(cleanup.schemaVersion).toBe('large-document-writer-cleanup-receipt/v1');
      expect(cleanup.policy).toBe('delete');

      const promoteScript = join(
        target,
        '.cursor',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'promote-draft-large-doc.js'
      );
      const prepareCurrentSourcePromotionScript = join(
        target,
        '.cursor',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'prepare-current-source-promotion.js'
      );
      const writeCriticalAuditorNoNewGapResponseScript = join(
        target,
        '.cursor',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'write-critical-auditor-no-new-gap-response.js'
      );
      const projectionQualityGateScript = join(
        target,
        '.cursor',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'projection_quality_gate.js'
      );
      expect(existsSync(promoteScript)).toBe(true);
      expect(existsSync(prepareCurrentSourcePromotionScript)).toBe(true);
      expect(existsSync(writeCriticalAuditorNoNewGapResponseScript)).toBe(true);
      expect(existsSync(projectionQualityGateScript)).toBe(true);
      expect(readFileSync(projectionQualityGateScript, 'utf8')).toContain(
        'projection_per_must_acceptance_not_independent'
      );
      const draftPath = join(target, 'draft-requirements.md');
      const targetPath = join(target, 'requirements.md');
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
          `"${process.execPath}" "${promoteScript}" --draft "${draftPath}" --target "${targetPath}" --preflight-only --json`,
          target
        )
      );
      expect(promotion.ok).toBe(true);
      expect(existsSync(join(target, 'scripts'))).toBe(false);
    } finally {
      cleanupTempDir(target);
    }
  }, 60_000);

  it('npm install consumer can re-run installed deploy entrypoint to heal .specify mirror drift', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-mirror-heal-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      installRootPackageToConsumer(target);

      const canonicalTemplate = join(target, '_bmad', 'speckit', 'templates', 'tasks-template.md');
      const mirroredTemplate = join(target, '.specify', 'templates', 'tasks-template.md');
      const canonicalScript = join(
        target,
        '_bmad',
        'speckit',
        'scripts',
        'powershell',
        'check-sprint-ready.ps1'
      );
      const mirroredScript = join(target, '.specify', 'scripts', 'check-sprint-ready.ps1');

      expect(existsSync(mirroredTemplate)).toBe(true);
      expect(existsSync(mirroredScript)).toBe(true);

      writeFileSync(mirroredTemplate, '# stale mirror\n', 'utf8');
      rmSync(mirroredScript, { force: true });

      expect(readFileSync(mirroredTemplate, 'utf8')).not.toBe(
        readFileSync(canonicalTemplate, 'utf8')
      );
      expect(existsSync(mirroredScript)).toBe(false);

      run('npx bmad-speckit-init --agent claude-code', target);

      expect(readFileSync(mirroredTemplate, 'utf8')).toBe(readFileSync(canonicalTemplate, 'utf8'));
      expect(readFileSync(mirroredScript, 'utf8')).toBe(readFileSync(canonicalScript, 'utf8'));
    } finally {
      cleanupTempDir(target);
    }
  }, 180_000);

  it('npm install consumer can deploy Claude top-level speckit aliases via installed init entrypoint', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-claude-aliases-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      installRootPackageToConsumer(target);
      run('npx bmad-speckit-init --agent claude-code', target);

      expect(existsSync(join(target, '.claude', 'hooks', 'session-start.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'hooks', 'party-mode-turn-lock.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.claude', 'skills', 'encoding-integrity-guardian', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.cjs'))
      ).toBe(true);

      const aliases = [
        'speckit-specify.md',
        'speckit-plan.md',
        'speckit-gaps.md',
        'speckit-tasks.md',
      ];

      for (const alias of aliases) {
        const canonical = join(target, '_bmad', 'claude', 'agents', alias);
        const runtime = join(target, '.claude', 'agents', alias);

        expect(existsSync(canonical)).toBe(true);
        expect(existsSync(runtime)).toBe(true);
        expect(readFileSync(runtime, 'utf8')).toBe(readFileSync(canonical, 'utf8'));
      }

      expect(existsSync(join(target, '.claude', 'rules', 'bmad-bug-auto-party-mode-rule.md'))).toBe(
        true
      );
      expect(existsSync(join(target, '.claude', 'rules', 'bmad-bug-auto-party-mode.md'))).toBe(
        false
      );
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('npm install consumer deploys Claude facilitator agent mention contract via installed init entrypoint', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-claude-facilitator-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      installRootPackageToConsumer(target);
      run('npx bmad-speckit-init --agent claude-code', target);

      const canonical = join(target, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md');
      const runtime = join(target, '.claude', 'agents', 'party-mode-facilitator.md');

      expect(existsSync(canonical)).toBe(true);
      expect(existsSync(runtime)).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'npm-public-release', 'SKILL.md'))).toBe(
        true
      );
      expect(readFileSync(runtime, 'utf8')).toBe(readFileSync(canonical, 'utf8'));
      expect(readFileSync(runtime, 'utf8')).toContain('name: party-mode-facilitator');
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('npm install consumer preserves prior managed surface when adding a second agent init pass', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-manifest-merge-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      installRootPackageToConsumer(target);

      const manifestPath = join(
        target,
        '_bmad-output',
        'config',
        'bmad-speckit-install-manifest.json'
      );
      const before = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(before.installed_tools).toContain('cursor');
      expect(
        before.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.cursor/'))
      ).toBe(true);

      run('npx bmad-speckit-init --agent claude-code', target);

      const after = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(after.installed_tools).toContain('cursor');
      expect(after.installed_tools).toContain('claude-code');
      expect(
        after.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.cursor/'))
      ).toBe(true);
      expect(
        after.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.claude/'))
      ).toBe(true);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('consumer install can initialize the Codex no-hooks branch', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-codex-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-codex-app', version: '1.0.0', private: true }),
        'utf8'
      );

      installRootPackageToConsumer(target);
      run('npx bmad-speckit-init --agent codex', target);

      expect(existsSync(join(target, '.codex', 'commands', 'bmad-help.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-help', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'skills', 'encoding-integrity-guardian', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(
          join(
            target,
            '.codex',
            'skills',
            'encoding-integrity-guardian',
            'scripts',
            'check-encoding-integrity.js'
          )
        )
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'))).toBe(
        true
      );
      expect(
        readFileSync(
          join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'),
          'utf8'
        ).startsWith('---')
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-story-assistant', 'SKILL.md'))).toBe(
        true
      );
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-standalone-tasks', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-standalone-tasks-doc-review', 'SKILL.md'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-rca-helper', 'SKILL.md'))).toBe(
        true
      );
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'audit-result-schema.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'handoff-schema.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'commit-protocol.md'))).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'shared', 'skill-runtime', 'resolve-bmad-runtime.js'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'README.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'hooks'))).toBe(false);
      const config = JSON.parse(
        readFileSync(join(target, '_bmad-output', 'config', 'bmad-speckit.json'), 'utf8')
      );
      expect(config.selectedAI).toBe('codex');

      const manifest = JSON.parse(
        readFileSync(
          join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'),
          'utf8'
        )
      );
      expect(manifest.installed_tools).toContain('codex');
      expect(
        manifest.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.codex/'))
      ).toBe(true);
      expect(
        manifest.managed_surface.some((entry: { path: string }) =>
          entry.path.startsWith('.codex/protocols')
        )
      ).toBe(true);

      const ok = run('npx bmad-speckit check', target);
      expect(ok).toMatch(/Check OK|OK/i);

      const reqTracePromptScript = join(
        target,
        '.codex',
        'skills',
        'req-trace-matrix-prompt-generator',
        'scripts',
        'generate_prompt.js'
      );
      expect(existsSync(reqTracePromptScript)).toBe(true);
      const reqTraceMissingArgs = spawnSync(process.execPath, [reqTracePromptScript], {
        cwd: target,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      });
      const reqTraceOutput = `${reqTraceMissingArgs.stdout}\n${reqTraceMissingArgs.stderr}`;
      expect(reqTraceMissingArgs.status).toBe(2);
      expect(reqTraceOutput).toContain(
        'Provide exactly one of --source-document, --contract, or --source-file'
      );
      expect(reqTraceOutput).not.toMatch(/large-document-writer helper not found|Cannot resolve js-yaml/u);

      rmSync(join(target, '.codex', 'skills'), { recursive: true, force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/\.codex\/skills/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'commands', 'bmad-speckit.md'), { force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/bmad-speckit\.md/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'protocols', 'audit-result-schema.md'), { force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/audit-result-schema\.md/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'skills', 'speckit-workflow'), {
        recursive: true,
        force: true,
      });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/speckit-workflow/);
      run('npx bmad-speckit-init --agent codex', target);
      writeFileSync(
        join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'),
        '<!-- BLOCK_LABEL_POLICY=B -->\n---\nname: speckit-workflow\n---\n',
        'utf8'
      );
      expect(() => run('npx bmad-speckit check', target)).toThrow(/YAML frontmatter/);
    } finally {
      cleanupTempDir(target);
    }
  }, 180_000);

  it('consumer install syncs runtime dashboard auto-start skeleton for Cursor hooks', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-dashboard-host-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      installRootPackageToConsumer(target);

      const hooksJson = readFileSync(join(target, '.cursor', 'hooks.json'), 'utf8');
      expect(hooksJson).toContain('runtime-dashboard-session-start.cjs');

      const hookScript = readFileSync(
        join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'),
        'utf8'
      );
      expect(hookScript).toContain('autoStartRuntimeDashboard');

      const sharedHelper = readFileSync(
        join(target, '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.cjs'),
        'utf8'
      );
      expect(sharedHelper).toContain('ensureRuntimeDashboardServer');
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('consumer install can opt into runtime MCP layout explicitly', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-with-mcp-'));
    try {
      run(`node scripts/init-to-root.js --full --with-mcp "${target}"`, PKG_ROOT);

      expect(existsSync(join(target, '.mcp.json'))).toBe(true);
      expect(existsSync(join(target, '.runtime-mcp', 'server', 'dist', 'index.cjs'))).toBe(true);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

});
