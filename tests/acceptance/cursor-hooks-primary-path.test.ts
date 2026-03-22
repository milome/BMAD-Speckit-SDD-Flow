import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime-governance cursor hooks path', () => {
  it('keeps .cursor/hooks.json as the declared primary Cursor host path when present', () => {
    const hooksPath = path.join(process.cwd(), '.cursor', 'hooks.json');
    expect(existsSync(hooksPath)).toBe(true);
    const content = readFileSync(hooksPath, 'utf8');
    expect(content).toContain('runtime-policy-inject.js --cursor-host');
    expect(content).toContain('SessionStart');
    expect(content).toContain('PreToolUse');
    expect(content).toContain('SubagentStart');
  });
});
