import { describe, expect, it } from 'vitest';
import { parseBmadAuditResult } from './parse-bmad-audit-result';

describe('parseBmadAuditResult', () => {
  it('extracts canonical English control fields', () => {
    const result = parseBmadAuditResult(`
status: PASS
reportPath: reports/spec.md
storyPath: _bmad-output/implementation-artifacts/epic-1/story-1/1-1.md
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
      storyPath: '_bmad-output/implementation-artifacts/epic-1/story-1/1-1.md',
      iterationCount: 2,
      requiredFixesCount: 0,
      scoreTriggerPresent: true,
      artifactDocPath: 'specs/epic-1/story-1/spec.md',
      converged: false,
    });
  });

  it('handles FAIL status from canonical English control fields', () => {
    const result = parseBmadAuditResult(`
status: FAIL
reportPath: reports/spec.md
storyPath: _bmad-output/implementation-artifacts/epic-1/story-1/1-1.md
iteration_count: 1
required_fixes_count: 3
score_trigger_present: false
artifactDocPath: specs/epic-1/story-1/spec.md
converged: false
summary: has issues
`);

    expect(result.status).toBe('FAIL');
    expect(result.storyPath).toBe('_bmad-output/implementation-artifacts/epic-1/story-1/1-1.md');
    expect(result.requiredFixesCount).toBe(3);
    expect(result.scoreTriggerPresent).toBe(false);
  });

  it('prefers canonical English control fields when canonical and localized aliases both exist', () => {
    const result = parseBmadAuditResult(`
status: PASS
状态: FAIL
reportPath: reports/canonical.md
报告路径: reports/localized.md
storyPath: specs/story-canonical.md
Story 文档路径: specs/story-localized.md
iteration_count: 2
迭代次数: 99
required_fixes_count: 0
待修复项数: 7
score_trigger_present: true
已检测到评分触发器: false
artifactDocPath: specs/canonical.md
产物文档路径: specs/localized.md
converged: false
是否已收敛: true
`);

    expect(result).toEqual({
      status: 'PASS',
      reportPath: 'reports/canonical.md',
      storyPath: 'specs/story-canonical.md',
      iterationCount: 2,
      requiredFixesCount: 0,
      scoreTriggerPresent: true,
      artifactDocPath: 'specs/canonical.md',
      converged: false,
    });
  });

  it('accepts localized control field aliases as migration compatibility fallback', () => {
    // Canonical contract remains English-keyed control fields and stable anchors.
    // Localized aliases are supported only as migration compatibility fallback.
    const result = parseBmadAuditResult(`
# 审计结果 / Audit Result

状态: PASS
报告路径: reports/tasks-audit.md
Story 文档路径: _bmad-output/implementation-artifacts/epic-1/story-1/1-1.md
迭代次数: 3
待修复项数: 1
已检测到评分触发器: true
产物文档路径: _bmad-output/implementation-artifacts/_orphan/BUGFIX_i18n.md
是否已收敛: true

结论：需要修复 1 个 gap，但流程已收敛。
Conclusion: one gap remains, but the loop converged.
`);

    expect(result).toEqual({
      status: 'PASS',
      reportPath: 'reports/tasks-audit.md',
      storyPath: '_bmad-output/implementation-artifacts/epic-1/story-1/1-1.md',
      iterationCount: 3,
      requiredFixesCount: 1,
      scoreTriggerPresent: true,
      artifactDocPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_i18n.md',
      converged: true,
    });
  });
});
