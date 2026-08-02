import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { qualifyRequirementsContractRed } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-red-qualification';

const HASH = `sha256:${'5'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-red-qualification.schema.json'
);

function input() {
  return {
    requirementId: 'MUST-FR-001',
    testId: 'RED-001',
    semanticModelHash: HASH,
    baselineSnapshotHash: HASH,
    testSourceHash: HASH,
    fixtureHash: HASH,
    oracleHash: HASH,
    exitCode: 1,
    failurePhase: 'assertion' as const,
    assertionSiteMatched: true,
    expectedFailure: 'expected ledger write',
    observedFailure: 'ledger write missing',
  };
}

describe('requirements contract RED qualification', () => {
  it('accepts only assertion-site expected RED failures', () => {
    const result = qualifyRequirementsContractRed(input());
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8'))
    );

    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    expect(result.classification).toBe('EXPECTED_RED');
    expect(result.blockingReasons).toEqual([]);
    expect(result.qualificationHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it.each(['compile', 'fixture', 'environment', 'setup'] as const)(
    'rejects %s failures as invalid RED',
    (failurePhase) => {
      const result = qualifyRequirementsContractRed({
        ...input(),
        failurePhase,
        assertionSiteMatched: false,
      });

      expect(result.classification).toBe('INVALID_RED');
      expect(result.blockingReasons).toContain(`invalid_red_failure_phase:${failurePhase}`);
    }
  );

  it('distinguishes already-green and inconclusive failures', () => {
    expect(qualifyRequirementsContractRed({ ...input(), exitCode: 0 }).classification).toBe(
      'ALREADY_GREEN'
    );
    expect(
      qualifyRequirementsContractRed({
        ...input(),
        failurePhase: 'assertion',
        assertionSiteMatched: false,
      }).classification
    ).toBe('INCONCLUSIVE');
  });
});
