import { describe, expect, it } from 'vitest';
import { hasFourSignalKeywords, loadArchitectureGateConfig } from '../helpers/architecture-gates-test-helpers';
const TARGET_GATE_STEPS = [
  { gateSet: 'brief_contract_gate', step: 'step-02-vision' },
  { gateSet: 'brief_contract_gate', step: 'step-03-users' },
  { gateSet: 'brief_contract_gate', step: 'step-04-metrics' },
  { gateSet: 'brief_contract_gate', step: 'step-05-scope' },
  { gateSet: 'architecture_contract_gate', step: 'step-04-decisions' },
  { gateSet: 'architecture_contract_gate', step: 'step-07-validation' },
  { gateSet: 'readiness_blocker_gate', step: 'step-06-final-assessment' },
  { gateSet: 'epics_contract_gate', step: 'step-02-design-epics' },
  { gateSet: 'epics_contract_gate', step: 'step-03-create-stories' },
  { gateSet: 'create_story_gate', step: 'workflow' },
] as const;

describe('architecture gates four-signal contract', () => {
  it.each(TARGET_GATE_STEPS)(
    '$gateSet/$step includes a gate rule with the unified four-signal required_keywords',
    ({ gateSet: gateSetKey, step: stepKey }) => {
    const config = loadArchitectureGateConfig();
    const gateSet = config.gate_sets?.[gateSetKey];

    expect(gateSet).toBeDefined();

    const rules = gateSet?.steps?.[stepKey]?.gate_rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((rule) => hasFourSignalKeywords(rule))).toBe(true);
    }
  );
});
