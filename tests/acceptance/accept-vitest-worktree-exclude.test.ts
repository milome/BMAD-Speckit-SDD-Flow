import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vitest worktree hygiene', () => {
  it('excludes .worktrees from vitest discovery', () => {
    const config = readFileSync('vitest.config.ts', 'utf8');
    expect(config).toContain('.worktrees');
  });

  it('keeps consumer install tests default-excluded but exact-command runnable', () => {
    const config = readFileSync('vitest.config.ts', 'utf8');
    expect(config).toContain('consumerInstallFinalTests');
    expect(config).toContain('explicitlyRequested(file)');
    expect(config).toContain('tests/acceptance/accept-install-consumer-cli.test.ts');
    expect(config).toContain('tests/acceptance/main-agent-dist-consumer-runtime.test.ts');
  });
});
