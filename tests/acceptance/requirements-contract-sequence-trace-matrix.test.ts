import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequirementsContractSequenceTraceMatrix } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-trace-matrix';

const HASH = `sha256:${'9'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-sequence-trace-matrix.schema.json'
);

function binding(stepId: string) {
  const suffix = stepId.replace('STEP-', '');
  return {
    stepId,
    requirementRefs: ['MUST-FR-001'],
    scenarioRefs: ['SCN-001'],
    branchRefs: ['BR-001'],
    targetRefs: [`TARGET-${suffix}`],
    symbolRefs: [`payments.step${suffix}`],
    taskRefs: [`TASK-${suffix}`],
    redRefs: [`RED-${suffix}`],
    oracleRefs: [`ORACLE-${suffix}`],
    commandRefs: [`CMD-${suffix}`],
    evidenceRefs: [`EVD-${suffix}`],
    proofRefs: [`PROOF-${suffix}`],
  };
}

describe('requirements contract Sequence Trace Matrix', () => {
  it('binds every critical Step to the full requirement-specific execution chain', () => {
    const matrix = createRequirementsContractSequenceTraceMatrix({
      requirementSetId: 'payments',
      sequenceContractHash: HASH,
      semanticModelHash: HASH,
      steps: [
        {
          stepId: 'STEP-001',
          order: 1,
          participantRef: 'PARTICIPANT-API',
          critical: true,
          sideEffect: 'none',
        },
        {
          stepId: 'STEP-002',
          order: 2,
          participantRef: 'PARTICIPANT-LEDGER',
          critical: true,
          sideEffect: 'ledger_write',
        },
      ],
      bindings: [binding('STEP-001'), binding('STEP-002')],
    });
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8'))
    );

    expect(validate(matrix), JSON.stringify(validate.errors)).toBe(true);
    expect(matrix.rows.map((row) => row.stepId)).toEqual(['STEP-001', 'STEP-002']);
    expect(matrix.criticalStepCount).toBe(2);
    expect(matrix.matrixHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects missing critical bindings and all-to-all Step binding reuse', () => {
    expect(() =>
      createRequirementsContractSequenceTraceMatrix({
        requirementSetId: 'payments',
        sequenceContractHash: HASH,
        semanticModelHash: HASH,
        steps: [
          {
            stepId: 'STEP-001',
            order: 1,
            participantRef: 'PARTICIPANT-API',
            critical: true,
            sideEffect: 'none',
          },
        ],
        bindings: [],
      })
    ).toThrow('sequence_trace_binding_missing:STEP-001');
    expect(() =>
      createRequirementsContractSequenceTraceMatrix({
        requirementSetId: 'payments',
        sequenceContractHash: HASH,
        semanticModelHash: HASH,
        steps: [
          {
            stepId: 'STEP-001',
            order: 1,
            participantRef: 'PARTICIPANT-API',
            critical: true,
            sideEffect: 'none',
          },
          {
            stepId: 'STEP-002',
            order: 2,
            participantRef: 'PARTICIPANT-LEDGER',
            critical: true,
            sideEffect: 'ledger_write',
          },
        ],
        bindings: [binding('STEP-001'), { ...binding('STEP-001'), stepId: 'STEP-002' }],
      })
    ).toThrow('sequence_trace_all_to_all_binding:STEP-002');
  });
});
