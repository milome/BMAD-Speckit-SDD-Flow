import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runArchitectureDriftCheck } from '../../scripts/architecture-drift-check';

const ROOT = process.cwd();

describe('architecture drift guard', () => {
  it('keeps TASKS_v1 aligned with the orchestration ADR control-plane model', () => {
    const adr = fs.readFileSync(
      path.join(ROOT, 'docs/design/2026-04-24-orchestration-recommended-architecture-adr.md'),
      'utf8'
    );
    const tasks = fs.readFileSync(path.join(ROOT, 'docs/plans/TASKS_v1.md'), 'utf8');

    for (const invariant of [
      'main-agent',
      'orchestration',
      'control plane',
      'contract',
      'user_story_mapping',
    ]) {
      expect(`${adr}\n${tasks}`).toContain(invariant);
    }
    expect(tasks).toContain('CP0 -> CP1 -> CP2 -> CP3 -> CP4 -> CP5 -> CP6');
  });

  it('exposes the ADR drift guard as an executable release check', () => {
    const result = runArchitectureDriftCheck(ROOT);
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
