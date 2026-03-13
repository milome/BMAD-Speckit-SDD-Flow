import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('agent-specific dispatch', () => {
  it('separates cursor and claude-code distribution logic', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain("if (agentTarget === 'cursor')");
    expect(script).toContain("if (agentTarget === 'claude-code')");
  });
});
