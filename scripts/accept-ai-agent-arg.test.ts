import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('init-to-root agent target support', () => {
  it('supports explicit ai agent target arguments', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('--agent');
    expect(script).toContain('cursor');
    expect(script).toContain('claude-code');
  });
});
