import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime hooks layering contract', () => {
  it('defines shared runtime hooks plus thin Claude/Cursor adapters', () => {
    const root = process.cwd();
    const sharedCore = path.join(root, '_bmad', 'runtime', 'hooks', 'runtime-policy-inject-core.js');
    const claudeAdapter = path.join(root, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.js');
    const cursorAdapter = path.join(root, '_bmad', 'cursor', 'hooks', 'runtime-policy-inject.js');

    expect(existsSync(sharedCore)).toBe(true);
    expect(existsSync(claudeAdapter)).toBe(true);
    expect(existsSync(cursorAdapter)).toBe(true);

    const claudeSource = readFileSync(claudeAdapter, 'utf8');
    const cursorSource = readFileSync(cursorAdapter, 'utf8');

    expect(claudeSource).toContain('runtime-policy-inject-core');
    expect(cursorSource).toContain('runtime-policy-inject-core');
  });
});
