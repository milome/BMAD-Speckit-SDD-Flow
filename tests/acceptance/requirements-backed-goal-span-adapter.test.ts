import { describe, expect, it } from 'vitest';
import { projectRequirementsToGoalObligations } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';

function semanticIr() {
  return {
    semanticPayload: {
      semantics: {
        requirements: [
          {
            id: 'MUST-001',
            text: 'Implement export.',
            oracle: 'exported',
            requirementKind: 'functional',
            polarity: 'positive',
          },
          {
            id: 'FR-001',
            text: 'Expose the export command.',
            oracle: 'command works',
            requirementKind: 'functional',
            polarity: 'positive',
          },
          {
            id: 'NFR-001',
            text: 'Complete within ten seconds.',
            oracle: 'duration <= 10s',
            requirementKind: 'nonfunctional',
            polarity: 'positive',
          },
          {
            id: 'NEG-001',
            text: 'Must not overwrite source.',
            oracle: 'source unchanged',
            requirementKind: 'negative',
            polarity: 'negative',
          },
          {
            id: 'OUT-001',
            text: 'Do not migrate storage.',
            oracle: 'storage unchanged',
            requirementKind: 'negative',
            polarity: 'negative',
          },
        ],
        atoms: [
          {
            id: 'MUST-001-A1',
            requirementRef: 'MUST-001',
            action: 'Implement export.',
            oracle: 'exported',
          },
        ],
        acceptanceCriteria: [
          { id: 'AC-001', text: 'Export is usable.', oracle: 'consumer passes' },
        ],
        failureModes: [{ id: 'FAIL-001', text: 'Export process fails.', oracle: 'error is typed' }],
        edgeCases: [{ id: 'EDGE-001', text: 'Empty export.', oracle: 'empty result' }],
      },
      semanticProvenance: {
        'MUST-001': 'source:MUST-001',
      },
      specSpanRegistry: [
        {
          specSpanId: 'SPAN-MUST-001',
          boundObligationIds: ['MUST-001'],
          evidenceClaimRefs: ['EVD-001'],
        },
      ],
    },
  };
}

describe('requirements-backed Goal obligation adapter', () => {
  it('preserves every closed obligation category with exact source aliases', () => {
    const obligations = projectRequirementsToGoalObligations(semanticIr());

    expect(Object.fromEntries(obligations.map((row) => [row.obligationId, row.kind]))).toEqual({
      'AC-001': 'ACCEPTANCE',
      'EDGE-001': 'EDGE',
      'FAIL-001': 'FAILURE',
      'FR-001': 'FR',
      'MUST-001': 'MUST',
      'NEG-001': 'NEG',
      'NFR-001': 'NFR',
      'OUT-001': 'OUT',
    });
    expect(obligations.find((row) => row.obligationId === 'MUST-001')).toMatchObject({
      atomRefs: ['MUST-001-A1'],
      evidenceClaimRefs: ['EVD-001'],
      sourceRefs: ['MUST-001', 'source:MUST-001', 'SPAN-MUST-001'],
    });
  });

  it('fails closed when two semantic categories reuse the same obligation identity', () => {
    const input = semanticIr();
    input.semanticPayload.semantics.acceptanceCriteria[0].id = 'MUST-001';

    expect(() => projectRequirementsToGoalObligations(input)).toThrowError(
      'requirements_successor_required:goal_obligation_identity'
    );
  });
});
