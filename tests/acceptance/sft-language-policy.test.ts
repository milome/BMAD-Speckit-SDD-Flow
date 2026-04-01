import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('sft language policy', () => {
  it('retains canonical machine keys for SFT-facing policy output', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'implement' });
    expect(policy.language.preserveMachineKeys).toBe(true);
    expect(typeof policy.triggerStage).toBe('string');
    expect(typeof policy.reason).toBe('string');
  });
});
