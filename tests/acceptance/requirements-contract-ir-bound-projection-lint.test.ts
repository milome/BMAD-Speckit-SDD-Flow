import { describe, expect, it } from 'vitest';
import {
  createExecutionConstraintRegistry,
  type RequirementsExecutionConstraint,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { projectRequirementsContractCp06ExecutionManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp05-cp08';

const constraint = (
  kind: RequirementsExecutionConstraint['kind'],
  disposition: RequirementsExecutionConstraint['disposition'] = 'proven'
): RequirementsExecutionConstraint => ({
  constraintId: `${kind}-001`,
  kind,
  canonicalValue: `${kind.toLowerCase()}-value`,
  applicableMustRefs: ['MUST-001'],
  applicableAtomRefs: ['ATOM-001'],
  premiseRefs: ['PREMISE-001'],
  derivationReceiptRefs: ['DERIVATION-001'],
  disposition,
});

function cp04Ir(overrides: RequirementsExecutionConstraint[] = []) {
  const execution = createExecutionConstraintRegistry(
    overrides.length > 0
      ? overrides
      : (['PATH', 'CMD', 'ART', 'CTM', 'EVDREQ', 'STOP'] as const).map((kind) => constraint(kind))
  );
  return {
    schemaVersion: 'requirements-contract-semantic-ir/v1' as const,
    semanticRevisionId: 'semantic-revision-001',
    scopeSemanticHash: `sha256:${'a'.repeat(64)}`,
    semanticPayload: execution,
  };
}

describe('IR-bound projection lint', () => {
  it('projects only frozen typed constraints by stable ID without observed evidence', () => {
    const semanticIr = cp04Ir();
    const before = JSON.stringify(semanticIr);

    const result = projectRequirementsContractCp06ExecutionManifest({
      checkpointId: 'cp04',
      checkpointStatus: 'passed',
      readbackVerified: true,
      semanticIr,
      requiredConstraintIds: (['PATH', 'CMD', 'ART', 'CTM', 'EVDREQ', 'STOP'] as const).map(
        (kind) => `${kind}-001`
      ),
    });

    expect(result.decision).toBe('pass');
    expect(result.executionManifest.constraints.map((entry) => entry.constraintId)).toEqual([
      'ART-001',
      'CMD-001',
      'CTM-001',
      'EVDREQ-001',
      'PATH-001',
      'STOP-001',
    ]);
    expect(JSON.stringify(result)).not.toContain('observedEvidence');
    expect(JSON.stringify(result)).not.toContain('artifactBytesHash');
    expect(JSON.stringify(semanticIr)).toBe(before);
  });

  it('routes unresolved or missing typed constraints to cp02 without retrying projection', () => {
    const result = projectRequirementsContractCp06ExecutionManifest({
      checkpointId: 'cp04',
      checkpointStatus: 'passed',
      readbackVerified: true,
      semanticIr: cp04Ir([constraint('PATH', 'unresolved')]),
      requiredConstraintIds: ['PATH-001', 'CMD-001'],
    });

    expect(result).toMatchObject({
      decision: 'block',
      earliestAffectedStage: 'cp02',
      latestValidPredecessorCheckpoint: 'cp01',
      nextAction: 'await_shared_technical_resolver_input_change',
    });
    expect(result.issueCodes).toEqual([
      'requirements_cp06_execution_constraint_missing:CMD-001',
      'requirements_cp06_execution_constraint_unresolved:PATH-001',
    ]);
    expect(result).not.toHaveProperty('repoScan');
    expect(result).not.toHaveProperty('retryCheckpoint');
  });
});
