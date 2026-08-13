import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractAuthoringIdentity,
  classifyRequirementsContractStaleness,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-identity';
import {
  activeAuthoringAttemptPointerHash,
  publishActiveAuthoringAttemptPointer,
  validateActiveAuthoringAttemptPointer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-active-authoring-attempt-pointer';
import { createRequirementsContractCheckpointManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { createRequirementsContractRemediationDelta } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta';
import {
  createRequirementsContractRemediationPlan,
  requirementsRemediationStepHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-plan';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements authoring identity lifecycle', () => {
  it('keeps public requestId as the authoring request alias and separates every lifecycle identity', () => {
    const plan = createRequirementsContractRemediationPlan({
      remediatesRequestHash: hash('1'), remediationAggregateHash: hash('2'),
      repairSteps: [{ stepId: 'STEP-1', route: 'compiler_gap', findingDispositionRefs: ['F-1'], authorityBasisRefs: ['A-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', expectedChangedArtifactRoles: ['semantic_ir'], initialDisposition: 'authorized' }],
      authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', beforeState: { semanticIrHash: hash('3') }, expectedChangedArtifactRoles: ['semantic_ir'], compilerIdentity: 'compiler/v1',
    });
    const delta = createRequirementsContractRemediationDelta({
      remediationPlanHash: plan.remediationPlanHash, remediatesRequestHash: hash('1'), remediationAggregateHash: hash('2'),
      executedRepairStepRefs: [{ stepId: 'STEP-1', stepHash: requirementsRemediationStepHash(plan.repairSteps[0]!), finalDisposition: 'executed' }], deferredRepairStepRefs: [],
      authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01',
      beforeState: { semanticIrHash: hash('3') }, afterState: { semanticIrHash: hash('4') }, changedArtifactRoles: ['semantic_ir'], compilerIdentity: 'compiler/v1',
    }, {
      remediationPlan: plan,
      readback: {
        authoringAttemptId: 'ATTEMPT-1', stagingRoot: 'authoring/staging/ATTEMPT-1', authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], latestValidPredecessorCheckpoint: 'cp01',
        beforeState: { semanticIrHash: hash('3') }, afterState: { semanticIrHash: hash('4') },
        changedArtifacts: [{ role: 'semantic_ir', recordRelativePath: 'authoring/staging/ATTEMPT-1/semantic-ir.json', artifactHash: hash('4') }],
      },
    });
    const identity = createRequirementsContractAuthoringIdentity({
      recordId: 'REQ-001', requestNonce: 'request-1', grillGraphHash: hash('5'),
      attemptNonce: 'attempt-1', parentSemanticRevisionId: null, scopeSemanticHash: hash('6'),
      compilerVersion: 'compiler/v1', judgeRequestPayload: { packetHash: hash('7') },
      remediationPlan: plan, remediationDelta: delta,
    });
    expect(identity.requestId).toBe(identity.authoringRequestId);
    expect(new Set(Object.values(identity)).size).toBe(Object.values(identity).length - 1);
  });

  it('validates the five-field attempt pointer independently of active authority', () => {
    expect(validateActiveAuthoringAttemptPointer({
      schemaVersion: 'ActiveAuthoringAttemptPointer/v1', authoringAttemptId: 'ATTEMPT-001',
      attemptManifestPath: 'authoring/staging/ATTEMPT-001/manifests/2-cp02.json', attemptManifestHash: hash('1'),
      latestValidPredecessorCheckpoint: 'cp01', inputManifestHash: hash('2'),
    })).toEqual({ decision: 'pass', issueCodes: [] });
  });

  it('distinguishes semantic staleness from locator-only binding staleness', () => {
    expect(classifyRequirementsContractStaleness({ previousScopeSemanticHash: hash('1'), nextScopeSemanticHash: hash('1'), previousSourceBindingHash: hash('2'), nextSourceBindingHash: hash('3') })).toBe('citation_binding_stale');
    expect(classifyRequirementsContractStaleness({ previousScopeSemanticHash: hash('1'), nextScopeSemanticHash: hash('4'), previousSourceBindingHash: hash('2'), nextSourceBindingHash: hash('2') })).toBe('semantic_revision_stale');
  });

  it('recomputes the checkpoint payload hash before pointer CAS', () => {
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', checkpointId: 'cp02', checkpointOrdinal: 2,
      stage: 'cp02', status: 'passed', inputManifestHash: hash('2'),
      previousCheckpointManifestRef: { checkpointId: 'cp01', checkpointOrdinal: 1, path: 'authoring/staging/ATTEMPT-001/manifests/1-cp01.json', hash: hash('3') },
      latestValidPredecessorCheckpoint: 'cp01', compilerIdentity: 'compiler-v1', artifactEntries: [], decisionReceiptRefs: [], baseAuthorityRef: null,
    });
    const pointer = {
      schemaVersion: 'ActiveAuthoringAttemptPointer/v1' as const,
      authoringAttemptId: 'ATTEMPT-001',
      attemptManifestPath: 'authoring/staging/ATTEMPT-001/manifests/2-cp02.json',
      attemptManifestHash: manifest.checkpointManifestHash,
      latestValidPredecessorCheckpoint: 'cp01', inputManifestHash: hash('2'),
    };
    const tampered = { ...manifest, status: 'blocked' };
    expect(() => publishActiveAuthoringAttemptPointer({
      pointer, expectedCurrentPointerHash: null, readAttemptManifest: () => tampered,
      compareAndSwap: () => true,
    })).toThrow('authoring_checkpoint_manifest_hash_mismatch');
  });

  it('rejects path identity, predecessor and CAS conflicts before publication', () => {
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', checkpointId: 'cp02', checkpointOrdinal: 2,
      stage: 'cp02', status: 'passed', inputManifestHash: hash('2'),
      previousCheckpointManifestRef: { checkpointId: 'cp01', checkpointOrdinal: 1, path: 'authoring/staging/ATTEMPT-001/manifests/1-cp01.json', hash: hash('3') },
      latestValidPredecessorCheckpoint: 'cp01', compilerIdentity: 'compiler-v1', artifactEntries: [], decisionReceiptRefs: [], baseAuthorityRef: null,
    });
    const pointer = {
      schemaVersion: 'ActiveAuthoringAttemptPointer/v1' as const,
      authoringAttemptId: 'ATTEMPT-001',
      attemptManifestPath: 'authoring/staging/ATTEMPT-001/manifests/2-cp99.json',
      attemptManifestHash: manifest.checkpointManifestHash,
      latestValidPredecessorCheckpoint: 'cp01', inputManifestHash: hash('2'),
    };
    expect(() => publishActiveAuthoringAttemptPointer({
      pointer, expectedCurrentPointerHash: null, readAttemptManifest: () => manifest,
      compareAndSwap: () => true,
    })).toThrow('active_authoring_attempt_manifest_path_identity_mismatch');
    const validPointer = { ...pointer, attemptManifestPath: 'authoring/staging/ATTEMPT-001/manifests/2-cp02.json' };
    expect(() => publishActiveAuthoringAttemptPointer({
      pointer: { ...validPointer, latestValidPredecessorCheckpoint: 'cp00' },
      expectedCurrentPointerHash: null, readAttemptManifest: () => manifest,
      compareAndSwap: () => true,
    })).toThrow('active_authoring_attempt_predecessor_mismatch');
    expect(() => publishActiveAuthoringAttemptPointer({
      pointer: validPointer, expectedCurrentPointerHash: activeAuthoringAttemptPointerHash(validPointer),
      readAttemptManifest: () => manifest, compareAndSwap: () => false,
    })).toThrow('active_authoring_attempt_pointer_cas_conflict');
  });

  it('binds pointer CAS to the single canonical record target', () => {
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', checkpointId: 'cp02', checkpointOrdinal: 2,
      stage: 'cp02', status: 'passed', inputManifestHash: hash('2'),
      previousCheckpointManifestRef: { checkpointId: 'cp01', checkpointOrdinal: 1, path: 'authoring/staging/ATTEMPT-001/manifests/1-cp01.json', hash: hash('3') },
      latestValidPredecessorCheckpoint: 'cp01', compilerIdentity: 'compiler-v1', artifactEntries: [], decisionReceiptRefs: [], baseAuthorityRef: null,
    });
    const pointer = {
      schemaVersion: 'ActiveAuthoringAttemptPointer/v1' as const, authoringAttemptId: 'ATTEMPT-001',
      attemptManifestPath: 'authoring/staging/ATTEMPT-001/manifests/2-cp02.json', attemptManifestHash: manifest.checkpointManifestHash,
      latestValidPredecessorCheckpoint: 'cp01', inputManifestHash: hash('2'),
    };
    let casTarget = '';
    publishActiveAuthoringAttemptPointer({
      pointer, expectedCurrentPointerHash: null, readAttemptManifest: () => manifest,
      compareAndSwap: (...args: unknown[]) => { casTarget = String(args[0]); return true; },
    });
    expect(casTarget).toBe('record/active-authoring-request.json');
  });
});
