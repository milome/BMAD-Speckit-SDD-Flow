import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateRequirementsContractRedSemanticMutations } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-red-qualification';

const HASH = `sha256:${'8'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-semantic-mutation-report.schema.json'
);

describe('requirements contract RED semantic mutation calibration', () => {
  it('passes only when every mandatory mutation is killed', () => {
    const report = evaluateRequirementsContractRedSemanticMutations({
      qualificationHash: HASH,
      mutations: [
        { mutationId: 'MUT-ORDER-001', mutationType: 'order_reversal', mandatory: true, killed: true },
        { mutationId: 'MUT-SIDE-001', mutationType: 'duplicate_side_effect', mandatory: true, killed: true },
        { mutationId: 'MUT-DIAG-001', mutationType: 'diagnostic_only', mandatory: false, killed: false },
      ],
    });
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8'))
    );

    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
    expect(report).toMatchObject({
      requiredMutationCount: 2,
      killedMutationCount: 2,
      survivingMandatoryMutationIds: [],
      decision: 'pass',
    });
    expect(report.reportHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('blocks and identifies every surviving mandatory mutation', () => {
    const report = evaluateRequirementsContractRedSemanticMutations({
      qualificationHash: HASH,
      mutations: [
        { mutationId: 'MUT-COMP-001', mutationType: 'missing_compensation', mandatory: true, killed: false },
        { mutationId: 'MUT-IDEM-001', mutationType: 'idempotency_violation', mandatory: true, killed: true },
      ],
    });

    expect(report.decision).toBe('block');
    expect(report.survivingMandatoryMutationIds).toEqual(['MUT-COMP-001']);
  });

  it('rejects duplicate mutation identities', () => {
    expect(() =>
      evaluateRequirementsContractRedSemanticMutations({
        qualificationHash: HASH,
        mutations: [
          { mutationId: 'MUT-001', mutationType: 'order_reversal', mandatory: true, killed: true },
          { mutationId: 'MUT-001', mutationType: 'wrong_branch', mandatory: true, killed: true },
        ],
      })
    ).toThrow('semantic_mutation_duplicate_id:MUT-001');
  });
});
