import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bmad state skeleton', () => {
  it('creates progress and runtime skeleton', () => {
    expect(existsSync('.claude/state/bmad-progress.yaml')).toBe(true);
    expect(existsSync('.claude/state/bmad-lock.yaml')).toBe(true);
    const progressContent = readFileSync('.claude/state/bmad-progress.yaml', 'utf8');
    expect(progressContent).toContain('layer:');
    expect(progressContent).toContain('stage:');
    expect(progressContent).toContain('audit_status:');
    expect(progressContent).toContain('artifacts:');
    expect(progressContent).toContain('git_control:');
  });
});
