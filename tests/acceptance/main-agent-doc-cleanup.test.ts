import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main-agent doc cleanup', () => {
  it('keeps getting-started on the accepted main-agent path', () => {
    const doc = readFileSync('docs/tutorials/getting-started.md', 'utf8');

    expect(doc).toContain('main-agent-orchestration');
    expect(doc).toContain('runtime-policy-inject.cjs');
    expect(doc).toContain('pre-continue-check.cjs');
    expect(doc).not.toContain('消费项目里真的看到 governance-runtime-worker / governance-remediation-runner 并能执行');
  });

  it('marks the old consumer playbook as archived and removes worker success criteria from the current path', () => {
    const doc = readFileSync('docs/ops/2026-04-09-consumer-governance-validation-playbook.md', 'utf8');

    expect(doc).toContain('历史归档');
    expect(doc).toContain('main-agent-orchestration');
    expect(doc).toContain('不再接受');
    expect(doc).toContain('视为过时');
    expect(doc).toContain('不再是当前 accepted runtime path 的目标');
  });
});
