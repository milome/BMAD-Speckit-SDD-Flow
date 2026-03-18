import { describe, expect, it } from 'vitest';
import { parseBmadAuditResult } from './parse-bmad-audit-result';

describe('parseBmadAuditResult', () => {
  it('extracts pass/fail, report path and iteration count', () => {
    const result = parseBmadAuditResult(`
status: PASS
reportPath: reports/spec.md
iteration_count: 2
required_fixes_count: 0
score_trigger_present: true
artifactDocPath: specs/epic-1/story-1/spec.md
converged: false
summary: ok
`);

    expect(result).toEqual({
      status: 'PASS',
      reportPath: 'reports/spec.md',
      iterationCount: 2,
      requiredFixesCount: 0,
      scoreTriggerPresent: true,
      artifactDocPath: 'specs/epic-1/story-1/spec.md',
      converged: false,
    });
  });

  it('handles FAIL status', () => {
    const result = parseBmadAuditResult(`
status: FAIL
reportPath: reports/spec.md
iteration_count: 1
required_fixes_count: 3
score_trigger_present: false
artifactDocPath: specs/epic-1/story-1/spec.md
converged: false
summary: has issues
`);

    expect(result.status).toBe('FAIL');
    expect(result.requiredFixesCount).toBe(3);
    expect(result.scoreTriggerPresent).toBe(false);
  });
});
