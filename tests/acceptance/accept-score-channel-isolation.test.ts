import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('score channel isolation', () => {
  it('supports agent-aware score writing inputs', () => {
    const cli = readFileSync('packages/bmad-speckit/bin/bmad-speckit.js', 'utf8');
    const command = readFileSync('packages/bmad-speckit/src/commands/score.ts', 'utf8');

    expect(cli).toContain(".command('score')");
    expect(cli).toContain(".option('--agent <agent>'");
    expect(cli).toContain(".option('--source <source>'");
    expect(cli).toContain("../dist/commands/score");
    expect(command).toContain('const agent = opts.agent');
    expect(command).toContain('const source = opts.source');
  });
});
