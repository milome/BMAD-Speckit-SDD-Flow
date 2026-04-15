import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
    },
  });
}

describe('root package bmad-speckit bin', () => {
  it('file-installing bmad-speckit-sdd-flow exposes a working npx bmad-speckit entry', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-root-bin-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-root-bin', version: '1.0.0', private: true }),
        'utf8'
      );

      run(`npm install --save-dev "file:${PKG_ROOT.replace(/\\/g, '/')}"`, target);

      const binCmd = join(target, 'node_modules', '.bin', 'bmad-speckit.cmd');
      expect(existsSync(binCmd)).toBe(true);
      const binText = readFileSync(binCmd, 'utf8');
      expect(binText).toContain('bmad-speckit-sdd-flow');
      expect(binText).toContain('scripts\\bmad-speckit-cli.js');

      const out = run('npx bmad-speckit version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120_000);

  it('tarball-installing bmad-speckit-sdd-flow on a clean consumer also exposes npx bmad-speckit', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'accept-root-bin-pack-'));
    const target = mkdtempSync(join(tmpdir(), 'accept-root-bin-tgz-'));
    try {
      run(`npm pack --json --pack-destination "${packDir.replace(/\\/g, '/')}"`, PKG_ROOT);
      const tgz = join(packDir, 'bmad-speckit-sdd-flow-0.1.0.tgz');
      expect(existsSync(tgz)).toBe(true);

      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-root-bin-tgz', version: '1.0.0', private: true }),
        'utf8'
      );

      run(`npm install --save-dev "${tgz.replace(/\\/g, '/')}"`, target);

      const binCmd = join(target, 'node_modules', '.bin', 'bmad-speckit.cmd');
      expect(existsSync(binCmd)).toBe(true);
      const binText = readFileSync(binCmd, 'utf8');
      expect(binText).toContain('bmad-speckit-sdd-flow');
      expect(binText).toContain('scripts\\bmad-speckit-cli.js');

      const out = run('npx bmad-speckit version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(packDir, { recursive: true, force: true });
    }
  }, 240_000);

  it('restores npx bmad-speckit after the package directory is deleted but stale .bin wrappers remain', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-root-bin-repair-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-root-bin-repair', version: '1.0.0', private: true }),
        'utf8'
      );

      run(`npm install --save-dev "file:${PKG_ROOT.replace(/\\/g, '/')}"`, target);

      const binCmd = join(target, 'node_modules', '.bin', 'bmad-speckit.cmd');
      expect(existsSync(binCmd)).toBe(true);
      expect(run('npx bmad-speckit version', target)).toMatch(/\d+\.\d+\.\d+/);

      rmSync(join(target, 'node_modules', 'bmad-speckit-sdd-flow'), {
        recursive: true,
        force: true,
      });

      expect(existsSync(binCmd)).toBe(true);
      expect(() => run('npx bmad-speckit version', target)).toThrowError(
        /Cannot find module|MODULE_NOT_FOUND/
      );

      run(`npm install --no-save --force "file:${PKG_ROOT.replace(/\\/g, '/')}"`, target);

      const out = run('npx bmad-speckit version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 180_000);
});
