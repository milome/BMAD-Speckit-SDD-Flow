/**
 * Acceptance: Install to temp consumer → run CLI (check, version).
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

describe('install to consumer → CLI acceptance', () => {
  it('init-to-root deploy → bmad-speckit check passes', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-init-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      expect(existsSync(join(target, 'package.json'))).toBe(false);
      expect(existsSync(join(target, '_bmad'))).toBe(true);
      expect(existsSync(join(target, 'specs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);

      const out = run('npx bmad-speckit check', target);
      expect(out).toMatch(/Check OK|OK/i);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

  it('init-to-root deploy → bmad-speckit version runs', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-ver-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      const out = run('npx bmad-speckit version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

  it('npm install → postinstall deploys → bmad-speckit check passes', () => {
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
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'emit-runtime-policy.cjs'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'start-runtime-dashboard-server.cjs'))).toBe(false);

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
  }, 90_000);

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
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

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
