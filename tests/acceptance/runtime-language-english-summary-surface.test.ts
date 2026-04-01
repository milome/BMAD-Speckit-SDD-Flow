import { describe, expect, it } from 'vitest';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime language english summary surface', () => {
  it('keeps summary-facing policy serialization machine-safe and english-oriented', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'post_audit', storyId: '14.1', runId: 'run-en-001' } as any);
    const json = stableStringifyPolicy(policy);

    expect(json).toContain('"triggerStage"');
    expect(json).toContain('"runId":"run-en-001"');
    expect(json).toContain('"storyId":"14.1"');
    expect(json).not.toContain('缺少');
    expect(json).not.toContain('未找到');
    expect(json).not.toContain('审计报告');
  });
});
