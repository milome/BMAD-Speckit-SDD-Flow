import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('governance single source of truth', () => {
  it('keeps strategy in contract and runtime facts in mapping', () => {
    const contract = yaml.load(
      fs.readFileSync(path.join(ROOT, '_bmad/_config/orchestration-governance.contract.yaml'), 'utf8')
    ) as Record<string, unknown>;
    const mapping = JSON.parse(
      fs.readFileSync(path.join(ROOT, '_bmad-output/runtime/governance/user_story_mapping.json'), 'utf8')
    ) as { items: Array<Record<string, unknown>> };

    expect(contract.sources_of_truth).toMatchObject({
      strategy_contract: '_bmad/_config/orchestration-governance.contract.yaml',
      runtime_index: '_bmad-output/runtime/governance/user_story_mapping.json',
    });
    expect(contract).toHaveProperty('signals');
    expect(contract).toHaveProperty('stage_requirements');
    expect(mapping).not.toHaveProperty('signals');
    expect(mapping).not.toHaveProperty('stage_requirements');
    for (const item of mapping.items) {
      expect(item).not.toHaveProperty('required_signals');
      expect(item).not.toHaveProperty('signal_overrides');
      expect(item).toHaveProperty('requirementId');
      expect(item).toHaveProperty('allowedWriteScope');
    }
  });
});
