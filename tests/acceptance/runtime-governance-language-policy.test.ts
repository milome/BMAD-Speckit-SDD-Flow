import { describe, expect, it } from 'vitest';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { loadConfig } from '../../scripts/bmad-config';

describe('runtime-governance language policy', () => {
  it('surfaces language substructure as the canonical machine-surface preservation contract', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'tasks', config: loadConfig() });

    expect(policy.language).toBeDefined();
    expect(policy.language.preserveMachineKeys).toBe(true);
    expect(policy.language.preserveParserAnchors).toBe(true);
    expect(policy.language.preserveTriggerStage).toBe(true);
  });
});
