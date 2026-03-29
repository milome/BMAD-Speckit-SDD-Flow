import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePromptRoutingHintsFromText } from '../../scripts/prompt-routing-hints';

const ROOT = join(import.meta.dirname, '..', '..');

function load(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('wave 1B executableization wiring', () => {
  it('prompt routing rules recognize brief-gate as an explicit role preference', () => {
    const hints = resolvePromptRoutingHintsFromText(
      ROOT,
      '继续 brief blocker，使用 brief-gate 跑 party-mode，把 blocker owner 保持在 PM。'
    );

    expect(hints.explicitRolePreference).toContain('party-mode');
    expect(hints.explicitRolePreference).toContain('brief-gate');
    expect(hints.inferredStage).toBe('brief');
  });

  it('governance routing matrix includes a canonical route for brief blocker remediation', () => {
    const matrix = load('_bmad/bmm/data/governance-executor-routing-matrix.md');

    expect(matrix).toContain('brief-definition-gap');
    expect(matrix).toContain('brief.challenge');
    expect(matrix).toContain('party-mode brief-gate round');
    expect(matrix).toContain('| PM |');
  });

  it('brief workflow P-paths explicitly invoke party-mode with the brief-gate stage profile', () => {
    const stepPaths = [
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-02-vision.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-03-users.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-04-metrics.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-05-scope.md',
      '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-02-vision.md',
      '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-03-users.md',
      '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-04-metrics.md',
      '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-05-scope.md',
    ];

    for (const file of stepPaths) {
      const content = load(file);
      expect(content).toContain('brief-gate');
      expect(content).toContain('party-mode');
      expect(content).toContain('current blocker/gap context');
    }
  });
});
