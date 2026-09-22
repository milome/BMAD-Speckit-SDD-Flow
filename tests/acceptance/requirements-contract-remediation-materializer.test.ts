import { describe, expect, it } from 'vitest';
import {
  materializeRequirementsSemanticRepair,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-materializer';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const HASH = (value: string) => sha256Stable({ value });

function fixture() {
  return createRequirementsContractSemanticIr({
    recordId: 'REC-REPAIR',
    requestId: 'REQ-REPAIR',
    parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v3',
    semantics: {
      requirements: [{
        id: 'MUST-001',
        text: 'Persist the approved request.',
        oracle: 'The request is persisted once.',
        requirementKind: 'functional',
        polarity: 'positive',
      }],
      atoms: [{
        id: 'MUST-001-A1',
        action: 'Persist the request.',
        oracle: 'The request is persisted once.',
        requirementRef: 'MUST-001',
        dependencies: [],
        authorityRefs: ['MUST-001'],
        executionConstraintRefs: ['CMD-test'],
      }],
      decisions: [],
    },
    evidenceClaims: [{
      evidenceClaimId: 'EVIDENCE-CLAIM-MUST-001',
      authorityClass: 'source_grounded',
      normalizedClaimHash: HASH('claim'),
      sourceEvidenceRequired: true,
      decisionReceiptRefs: [],
      premiseRefs: [],
      derivationReceiptRefs: [],
    }],
    specSpanRegistry: [],
    executionConstraints: [{
      constraintId: 'CMD-test',
      kind: 'CMD',
      canonicalValue: 'npm test -- repair.test.ts',
      applicableMustRefs: ['MUST-001'],
      applicableAtomRefs: ['MUST-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    }],
    semanticProvenance: { 'MUST-001': 'MUST-001' },
  });
}

describe('requirements semantic repair materializer', () => {
  it('applies a replace_atom operation and recomputes semantic identity', () => {
    const current = fixture();
    const atom = current.semanticPayload.semantics.atoms[0] as Record<string, unknown>;
    const result = materializeRequirementsSemanticRepair({
      currentSemanticIr: current,
      repairSteps: [{
        findingId: 'F-ATOM',
        classification: 'compiler_gap',
        operation: 'replace_atom',
        targetNodeId: 'MUST-001-A1',
        expectedBeforeHash: sha256Stable(atom),
        replacement: { action: 'Persist the request exactly once.' },
        affectedMustRefs: ['MUST-001'],
        affectedArtifactRefs: ['final-markdown'],
      }],
    });

    expect(result.decision).toBe('publish');
    expect(result.candidateSemanticIr?.scopeSemanticHash).not.toBe(current.scopeSemanticHash);
    expect(result.candidateSemanticIr?.semanticPayload.semantics.atoms).toContainEqual(expect.objectContaining({
      id: 'MUST-001-A1',
      action: 'Persist the request exactly once.',
      requirementRef: 'MUST-001',
      executionConstraintRefs: ['CMD-test'],
    }));
  });

  it('supports replace_oracle and rebind_constraint without dropping conservation refs', () => {
    const current = fixture();
    const atom = current.semanticPayload.semantics.atoms[0] as Record<string, unknown>;
    const constraint = current.semanticPayload.executionConstraints[0];
    const result = materializeRequirementsSemanticRepair({
      currentSemanticIr: current,
      repairSteps: [
        {
          findingId: 'F-ORACLE', classification: 'projection_repair', operation: 'replace_oracle',
          targetNodeId: 'MUST-001-A1', expectedBeforeHash: sha256Stable(atom),
          replacement: { oracle: 'The request is persisted exactly once.' },
          affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['final-markdown'],
        },
        {
          findingId: 'F-CONSTRAINT', classification: 'compiler_gap', operation: 'rebind_constraint',
          targetNodeId: 'CMD-test', expectedBeforeHash: sha256Stable(constraint),
          replacement: { applicableAtomRefs: ['MUST-001-A1'], applicableMustRefs: ['MUST-001'] },
          affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['execution-manifest'],
        },
      ],
    });

    expect(result.decision).toBe('publish');
    expect(result.candidateSemanticIr?.semanticPayload.semantics.atoms[0]).toMatchObject({
      oracle: 'The request is persisted exactly once.',
    });
    expect(result.candidateSemanticIr?.semanticPayload.executionConstraints[0]).toMatchObject({
      constraintId: 'CMD-test', applicableAtomRefs: ['MUST-001-A1'],
    });
  });

  it('splits one atom into deterministic child atoms', () => {
    const current = fixture();
    const atom = current.semanticPayload.semantics.atoms[0] as Record<string, unknown>;
    const result = materializeRequirementsSemanticRepair({
      currentSemanticIr: current,
      repairSteps: [{
        findingId: 'F-SPLIT', classification: 'compiler_gap', operation: 'split_atom',
        targetNodeId: 'MUST-001-A1', expectedBeforeHash: sha256Stable(atom),
        replacement: {
          atoms: [
            { id: 'MUST-001-A1-01', action: 'Validate the request.', oracle: 'Validation passes.' },
            { id: 'MUST-001-A1-02', action: 'Persist the request.', oracle: 'The request is persisted once.', dependencies: ['MUST-001-A1-01'] },
          ],
        },
        affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['trace-matrix'],
      }],
    });

    expect(result.decision).toBe('publish');
    expect(result.candidateSemanticIr?.semanticPayload.semantics.atoms).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'MUST-001-A1-01', requirementRef: 'MUST-001' }),
      expect.objectContaining({ id: 'MUST-001-A1-02', requirementRef: 'MUST-001', dependencies: ['MUST-001-A1-01'] }),
    ]));
  });

  it('blocks unknown operations and before-hash mismatches', () => {
    const current = fixture();
    const atom = current.semanticPayload.semantics.atoms[0] as Record<string, unknown>;
    expect(materializeRequirementsSemanticRepair({
      currentSemanticIr: current,
      repairSteps: [{
        findingId: 'F-UNKNOWN', classification: 'compiler_gap', operation: 'replace_projection',
        targetNodeId: atom.id, expectedBeforeHash: sha256Stable(atom), replacement: {},
      }],
    })).toMatchObject({ decision: 'blocked', issueCodes: ['requirements_remediation_not_materializable'] });
    expect(materializeRequirementsSemanticRepair({
      currentSemanticIr: current,
      repairSteps: [{
        findingId: 'F-STALE', classification: 'compiler_gap', operation: 'replace_atom',
        targetNodeId: atom.id, expectedBeforeHash: HASH('stale'), replacement: { action: 'x' },
      }],
    })).toMatchObject({ decision: 'blocked', issueCodes: ['requirements_remediation_not_materializable'] });
  });
});
