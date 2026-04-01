import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime language en outputs', () => {
  it('preserves canonical machine fields while documenting english-only narrative mode for output surfaces', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'post_audit' });

    expect(policy.language.preserveMachineKeys).toBe(true);
    expect(policy.language.preserveParserAnchors).toBe(true);
    expect(policy.language.preserveTriggerStage).toBe(true);
    expect(typeof policy.triggerStage).toBe('string');
    expect(typeof policy.reason).toBe('string');
  });
});
