/**
 * Acceptance: Install to temp consumer 鈫?run CLI (check, version).
 * Covers setup.ps1, setup.sh, npm install, init-to-root flows.
 * Runs in CI (ubuntu-latest).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function run(cmd: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  return execSync(cmd, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}

function runRepoCli(args: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  const cli = `"${process.execPath}" "${join(PKG_ROOT, 'scripts', 'bmad-speckit-cli.js')}" ${args}`;
  return run(cli, cwd, env);
}

describe('install to consumer 鈫?CLI acceptance', () => {
  it('init-to-root deploy 鈫?bmad-speckit check passes', () => {
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
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'))).toBe(
        true
      );
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode.mdc'))).toBe(
        false
      );
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'))
      ).toBe(true);

      const out = runRepoCli('check', target);
      expect(out).toMatch(/Check OK|OK/i);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

  it('init-to-root deploy 鈫?bmad-speckit version runs', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-ver-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      const out = runRepoCli('version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

  it('npm install 鈫?postinstall deploys 鈫?bmad-speckit check passes', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-npm-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );
      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
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
      expect(existsSync(join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'))).toBe(
        true
      );
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode.mdc'))).toBe(
        false
      );
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'emit-runtime-policy.cjs'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'start-runtime-dashboard-server.cjs'))).toBe(false);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'))
      ).toBe(true);

      const out = run('npx bmad-speckit check', target);
      expect(out).toMatch(/Check OK|OK/i);
    } finally {
      rmSync(target, { recursive: true, force: true });
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

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

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

      expect(readFileSync(mirroredTemplate, 'utf8')).not.toBe(readFileSync(canonicalTemplate, 'utf8'));
      expect(existsSync(mirroredScript)).toBe(false);

      run('npx bmad-speckit-init --agent claude-code', target);

      expect(readFileSync(mirroredTemplate, 'utf8')).toBe(readFileSync(canonicalTemplate, 'utf8'));
      expect(readFileSync(mirroredScript, 'utf8')).toBe(readFileSync(canonicalScript, 'utf8'));
    } finally {
      rmSync(target, { recursive: true, force: true });
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

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
      run('npx bmad-speckit-init --agent claude-code', target);

      expect(existsSync(join(target, '.claude', 'hooks', 'session-start.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'hooks', 'party-mode-turn-lock.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.cjs'))).toBe(true);

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
      rmSync(target, { recursive: true, force: true });
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

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
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
      rmSync(target, { recursive: true, force: true });
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

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

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
      rmSync(target, { recursive: true, force: true });
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

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
      run('npx bmad-speckit-init --agent codex', target);

      expect(existsSync(join(target, '.codex', 'commands', 'bmad-help.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-help', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-story-assistant', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-standalone-tasks', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-standalone-tasks-doc-review', 'SKILL.md'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-rca-helper', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'audit-result-schema.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'handoff-schema.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'commit-protocol.md'))).toBe(true);
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

      rmSync(join(target, '.codex', 'skills'), { recursive: true, force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/\.codex\/skills/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'commands', 'bmad-speckit.md'), { force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/bmad-speckit\.md/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'protocols', 'audit-result-schema.md'), { force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/audit-result-schema\.md/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'skills', 'speckit-workflow'), { recursive: true, force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/speckit-workflow/);
    } finally {
      rmSync(target, { recursive: true, force: true });
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

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

      const hooksJson = readFileSync(join(target, '.cursor', 'hooks.json'), 'utf8');
      expect(hooksJson).toContain('runtime-dashboard-session-start.cjs');

      const hookScript = readFileSync(join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'), 'utf8');
      expect(hookScript).toContain('autoStartRuntimeDashboard');

      const sharedHelper = readFileSync(join(target, '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.cjs'), 'utf8');
      expect(sharedHelper).toContain('ensureRuntimeDashboardServer');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

  it('consumer install can opt into runtime MCP layout explicitly', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-with-mcp-'));
    try {
      run(`node scripts/init-to-root.js --full --with-mcp "${target}"`, PKG_ROOT);

      expect(existsSync(join(target, '.mcp.json'))).toBe(true);
      expect(existsSync(join(target, '.runtime-mcp', 'server', 'dist', 'index.cjs'))).toBe(true);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);
});
