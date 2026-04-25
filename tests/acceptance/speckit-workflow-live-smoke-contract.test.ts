import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('speckit-workflow live smoke contract', () => {
  it('exposes a dedicated speckit-workflow smoke entry', () => {
    const packageJson = readFileSync('package.json', 'utf8');
    const script = readFileSync('scripts/live-smoke-speckit-workflow.ts', 'utf8');

    expect(packageJson).toContain('"smoke:speckit-workflow"');
    expect(script).toContain('speckit-smoke:cursor-skill-surface');
    expect(script).toContain('main-agent-orchestration');
    expect(script).toContain('dispatch-plan');
  });
});
