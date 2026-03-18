import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('init summary count', () => {
  it('adds agent-specific sync results into the reported total file count', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('totalFiles += agentProfile.sync');
  });
});
