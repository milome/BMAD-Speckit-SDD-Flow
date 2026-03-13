import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('claude runtime isolation', () => {
  it('creates dedicated claude runtime paths', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('.claude/state');
    expect(script).toContain('.claude/hooks');
  });
});
