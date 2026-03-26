import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('speckit mirror automation', () => {
  it('ships a repo-level verify command and wires it into CI scripts', () => {
    const root = process.cwd();
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.['test:speckit-mirror-sync']).toBe(
      'node scripts/verify-speckit-mirror-sync.js'
    );
    expect(pkg.scripts?.test).toContain('npm run test:speckit-mirror-sync');
    expect(pkg.scripts?.['test:ci']).toContain('npm run test:speckit-mirror-sync');
  });

  it('uses the shared speckit mirror sync helper in both deployment chains', () => {
    const root = process.cwd();
    const initToRoot = readFileSync(path.join(root, 'scripts', 'init-to-root.js'), 'utf8');
    const syncService = readFileSync(
      path.join(root, 'packages', 'bmad-speckit', 'src', 'services', 'sync-service.js'),
      'utf8'
    );

    expect(initToRoot).toContain('syncSpecifyMirror');
    expect(syncService).toContain('syncSpecifyMirror');
  });

  it('passes the repo-level speckit mirror verification command', () => {
    const root = process.cwd();
    const result = spawnSync('node', ['scripts/verify-speckit-mirror-sync.js'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 20000,
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Speckit .specify mirror is in sync');
  });
});
