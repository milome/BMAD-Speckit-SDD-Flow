import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_loglevel: 'error' },
  });
}

describe('consumer uninstall preserves _bmad-output and host shared roots', () => {
  it('root package consumer install -> uninstall removes managed surface but keeps user-owned shared-root content', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-uninstall-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-uninstall-app', version: '1.0.0', private: true }),
        'utf8'
      );

      run(`npm install --save-dev "file:${PKG_ROOT.replace(/\\/g, '/')}"`, target);

      const manifestPath = join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      expect(existsSync(join(target, '_bmad'))).toBe(true);
      expect(existsSync(join(target, '.specify'))).toBe(true);

      const sentinel = join(target, '_bmad-output', 'sentinel.txt');
      const userNote = join(target, '.cursor', 'user-note.txt');
      writeFileSync(sentinel, 'keep-me\n', 'utf8');
      writeFileSync(userNote, 'user-owned\n', 'utf8');

      const summary = run('npx bmad-speckit uninstall', target);
      expect(summary).toContain('"deleted"');

      expect(existsSync(join(target, '_bmad'))).toBe(false);
      expect(existsSync(join(target, '.specify'))).toBe(false);
      expect(existsSync(join(target, '.cursor'))).toBe(true);
      expect(readFileSync(userNote, 'utf8')).toBe('user-owned\n');
      expect(readFileSync(sentinel, 'utf8')).toBe('keep-me\n');
      expect(existsSync(manifestPath)).toBe(false);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-uninstall-report.json'))
      ).toBe(true);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120_000);

  it('package init path can uninstall managed surface and preserve _bmad-output', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'accept-bmad-speckit-pack-'));
    const target = mkdtempSync(join(tmpdir(), 'accept-package-init-uninstall-'));
    const appRoot = join(target, 'app');
    try {
      run(
        `npm pack -w bmad-speckit --pack-destination "${packDir.replace(/\\/g, '/')}"`,
        PKG_ROOT
      );
      const tgz = readdirSync(packDir).find((name) => name.endsWith('.tgz'));
      expect(tgz).toBeTruthy();

      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'package-init-uninstall-root', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install "${join(packDir, tgz!).replace(/\\/g, '/')}"`, target);

      run(
        `npx bmad-speckit init app --ai cursor-agent --yes --bmad-path "${join(PKG_ROOT, '_bmad').replace(/\\/g, '/')}"`,
        target
      );
      const manifestPath = join(appRoot, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      const sentinel = join(appRoot, '_bmad-output', 'sentinel.txt');
      writeFileSync(sentinel, 'keep-me\n', 'utf8');

      run(`npx bmad-speckit uninstall --target "${appRoot.replace(/\\/g, '/')}"`, target);

      expect(existsSync(join(appRoot, '_bmad'))).toBe(false);
      expect(existsSync(join(appRoot, '.specify'))).toBe(false);
      expect(readFileSync(sentinel, 'utf8')).toBe('keep-me\n');
      expect(existsSync(join(appRoot, '_bmad-output', 'config', 'bmad-speckit-uninstall-report.json'))).toBe(
        true
      );
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(packDir, { recursive: true, force: true });
    }
  }, 180_000);
});
