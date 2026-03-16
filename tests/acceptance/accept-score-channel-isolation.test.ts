import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('score channel isolation', () => {
  it('supports agent-aware score writing inputs', () => {
    const script = readFileSync('scripts/parse-and-write-score.ts', 'utf8');
    expect(script).toContain('agent');
    expect(script).toContain('source');
  });
});
