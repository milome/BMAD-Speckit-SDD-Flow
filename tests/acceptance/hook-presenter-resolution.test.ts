import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('hook presenter resolution', () => {
  it('uses fallback presenter resolution instead of hard-coded runtime/hooks requires in claude and cursor hook entrypoints', () => {
    const files = [
      path.join(repoRoot, '.claude', 'hooks', 'stop.js'),
      path.join(repoRoot, '.claude', 'hooks', 'post-tool-use.js'),
      path.join(repoRoot, '.cursor', 'hooks', 'post-tool-use.js'),
      path.join(repoRoot, '_bmad', 'claude', 'hooks', 'stop.js'),
      path.join(repoRoot, '_bmad', 'claude', 'hooks', 'post-tool-use.js'),
      path.join(repoRoot, '_bmad', 'cursor', 'hooks', 'post-tool-use.js'),
    ];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('function resolvePresenterModule()');
      expect(content).toContain("path.join(__dirname, 'governance-runner-summary-presenter.js')");
      expect(content).toContain("path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'governance-runner-summary-presenter.js')");
      expect(content).toContain('resolvePresenterModule()');
      expect(content).not.toContain("require('../../runtime/hooks/governance-runner-summary-presenter.js')");
    }
  });
});
