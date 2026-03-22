/**
 * Acceptance: init-to-root creates package.json with bmad-speckit when deploying to external target.
 * Covers setup.ps1, setup.sh, and manual init-to-root flows.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

describe('init-to-root package.json creation', () => {
  it(
    'creates package.json with bmad-speckit when target !== source',
    () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-init-pkg-'));
    try {
      execSync(`node scripts/init-to-root.js --full --with-package-json "${target}"`, {
        cwd: PKG_ROOT,
        stdio: 'pipe',
      });
      const pkgPath = join(target, 'package.json');
      expect(existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      expect(pkg.devDependencies?.['bmad-speckit']).toBeDefined();
      expect(pkg.devDependencies['bmad-speckit']).toMatch(/^file:/);
      expect(pkg.scripts?.check).toBe('npx bmad-speckit check');
      expect(pkg.scripts?.speckit).toBe('npx bmad-speckit');
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'write-runtime-context.js'))).toBe(true);
      expect(existsSync(join(target, 'scripts', 'emit-runtime-policy.cjs'))).toBe(false);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  },
    30_000
  );

  it(
    'deploys emit-runtime-policy.cjs and write-runtime-context.js to external target with --no-package-json',
    () => {
      const target = mkdtempSync(join(tmpdir(), 'accept-init-nopkg-'));
      try {
        execSync(`node scripts/init-to-root.js "${target}" --agent claude-code --no-package-json`, {
          cwd: PKG_ROOT,
          stdio: 'pipe',
        });
        expect(existsSync(join(target, '.claude', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
        expect(existsSync(join(target, '.claude', 'hooks', 'write-runtime-context.js'))).toBe(true);
        expect(existsSync(join(target, 'scripts', 'emit-runtime-policy.cjs'))).toBe(false);
      } finally {
        rmSync(target, { recursive: true, force: true });
      }
    },
    30_000
  );
});
