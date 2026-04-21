import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TEMP_ROOTS: string[] = [];

function makeTarget(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'init-to-root-party-mode-helper-'));
  TEMP_ROOTS.push(target);
  return target;
}

describe('init-to-root critical party-mode helper sync', () => {
  afterEach(() => {
    while (TEMP_ROOTS.length > 0) {
      fs.rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
    }
  });

  it('force-syncs party-mode-read-current-session helper into both _bmad/runtime/hooks and .cursor/hooks', () => {
    const target = makeTarget();
    const sourceHelper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');

    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'init-to-root.js'), target, '--agent', 'cursor'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);

    const runtimeHelper = path.join(target, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const cursorHelper = path.join(target, '.cursor', 'hooks', 'party-mode-read-current-session.cjs');

    expect(fs.existsSync(runtimeHelper)).toBe(true);
    expect(fs.existsSync(cursorHelper)).toBe(true);
    expect(fs.readFileSync(runtimeHelper, 'utf8')).toBe(fs.readFileSync(sourceHelper, 'utf8'));
    expect(fs.readFileSync(cursorHelper, 'utf8')).toBe(fs.readFileSync(sourceHelper, 'utf8'));
  }, 120000);
});
