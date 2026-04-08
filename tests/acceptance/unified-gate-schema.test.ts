import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = join(import.meta.dirname, '..', '..');

describe('unified gate schema', () => {
  it('covers planning and implementation gate families in one schema', () => {
    const raw = yaml.load(readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8')) as any;
    expect(raw.schema).toBe('unified_gate_v1');

    const gateSets = raw.gate_sets;
    expect(gateSets.architecture_contract_gate).toBeTruthy();
    expect(gateSets.brief_contract_gate).toBeTruthy();
    expect(gateSets.prd_contract_gate).toBeTruthy();
    expect(gateSets.readiness_blocker_gate).toBeTruthy();
    expect(gateSets.epics_contract_gate).toBeTruthy();
    expect(gateSets.create_story_gate).toBeTruthy();
    expect(gateSets.dev_story_gate).toBeTruthy();
  });
});
