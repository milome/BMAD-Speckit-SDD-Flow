import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('agent-specific dispatch', () => {
  it('separates cursor and claude-code distribution logic through registered profiles', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('REGISTERED_AGENT_PROFILES');
    expect(script).toContain('cursor:');
    expect(script).toContain("'claude-code':");
    expect(script).toContain('agentProfile.sync');
  });
});
