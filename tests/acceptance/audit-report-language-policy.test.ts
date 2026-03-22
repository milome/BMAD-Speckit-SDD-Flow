import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';

describe('audit-report language policy', () => {
  it('preserves canonical machine-readable surfaces while language policy is present', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'post_audit' });
    const json = JSON.parse(stableStringifyPolicy(policy));

    expect(json.triggerStage).toBe(policy.triggerStage);
    expect(json.language.preserveMachineKeys).toBe(true);
  });
});
