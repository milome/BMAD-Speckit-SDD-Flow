import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractBuildManifest,
  createRequirementsContractCheckpointManifest,
  validateRequirementsContractBuildManifest,
  validateRequirementsContractCheckpointManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { atomicNoClobberPublish } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-atomic-no-clobber-publisher';
import {
  assertRequirementsAuthorityRouteTransition,
  commitRequirementsContractAuthorityPublication,
  type RequirementsActiveAuthorityTuple,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authority-publication-committer';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { createRequirementsContractSourceBindingCapsule } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import { requirementsContractDomainHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;
const artifact = { role: 'semantic_ir' as const, schemaVersion: 'requirements-contract-semantic-ir/v1', artifactId: 'SEM-001', recordRelativePath: 'authoring/semantic-revisions/SEM-001/semantic-ir.json', artifactHash: hash('1') };

function checkpoint(overrides: Record<string, unknown> = {}) {
  return createRequirementsContractCheckpointManifest({
    authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', checkpointId: 'cp01', checkpointOrdinal: 1,
    stage: 'cp01', status: 'passed', inputManifestHash: hash('2'),
    previousCheckpointManifestRef: { checkpointId: 'cp00', checkpointOrdinal: 0, path: 'authoring/staging/ATTEMPT-001/manifests/0-cp00.json', hash: hash('3') },
    latestValidPredecessorCheckpoint: 'cp00', compilerIdentity: 'compiler-v1', artifactEntries: [artifact], decisionReceiptRefs: [], baseAuthorityRef: null,
    ...overrides,
  } as never);
}

function authorityTuple(
  semanticRevisionId: string,
  scopeSemanticHash: string,
  bindingRevisionId: string,
  sourceBindingHash: string,
  attemptId = 'ATTEMPT-001'
): RequirementsActiveAuthorityTuple {
  return {
    activeSemanticRevisionId: semanticRevisionId,
    activeSemanticIrPath: `authoring/semantic-revisions/${semanticRevisionId}/semantic-ir.json`,
    activeScopeSemanticHash: scopeSemanticHash,
    activeBindingRevisionId: bindingRevisionId,
    activeSourceBindingPath: `authoring/source-bindings/${bindingRevisionId}/source-binding.json`,
    activeSourceBindingHash: sourceBindingHash,
    activeAuthoringAttemptId: attemptId,
    activeBuildManifestPath: `authoring/staging/${attemptId}/contract-build-manifest.json`,
    activeBuildManifestHash: hash('9'),
  };
}

describe('authoring checkpoint and build manifests', () => {
  it('normalizes closed typed entries and validates predecessor lineage', () => {
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', checkpointId: 'cp00', checkpointOrdinal: 0,
      stage: 'cp00', status: 'passed', inputManifestHash: hash('2'), previousCheckpointManifestRef: null,
      latestValidPredecessorCheckpoint: null, compilerIdentity: 'compiler/v1', artifactEntries: [artifact], decisionReceiptRefs: [], baseAuthorityRef: null,
    });
    expect(validateRequirementsContractCheckpointManifest(manifest)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(manifest.checkpointManifestHash).toMatch(/^sha256:/u);
    expect(validateRequirementsContractCheckpointManifest({ ...manifest, unknown: true }).decision).toBe('block');
  });

  it('builds a closed final manifest only from typed authority refs', () => {
    const manifest = createRequirementsContractBuildManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', inputManifestHash: hash('2'),
      terminalCheckpointManifestRef: { checkpointId: 'cp08', checkpointOrdinal: 8, path: 'authoring/staging/ATTEMPT-001/manifests/8-cp08.json', hash: hash('3') },
      semanticAuthorityRef: { semanticRevisionId: 'SEM-001', path: 'authoring/semantic-revisions/SEM-001/semantic-ir.json', hash: hash('4') },
      bindingAuthorityRef: { bindingRevisionId: 'BIND-001', path: 'authoring/source-bindings/BIND-001/source-binding.json', hash: hash('5') },
      artifactEntries: [artifact], decisionReceiptRefs: [], auditPacketRef: { artifactId: 'AUDIT-001', path: 'authoring/staging/ATTEMPT-001/judge-audit-packet.json', hash: hash('6') }, projectionReportRefs: [],
    });
    expect(manifest.schemaVersion).toBe('requirements-contract-build-manifest/v1');
    expect(manifest.buildManifestHash).toMatch(/^sha256:/u);
  });

  it('publishes immutable canonical bytes with exact reuse and stable conflict', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-no-clobber-'));
    try {
      const targetPath = path.join(root, 'manifest.json');
      expect(atomicNoClobberPublish({ targetPath, value: { id: 'one' } }).disposition).toBe('published');
      expect(atomicNoClobberPublish({ targetPath, value: { id: 'one' } }).disposition).toBe('reused');
      expect(() => atomicNoClobberPublish({ targetPath, value: { id: 'two' } })).toThrow('atomic_no_clobber_conflict');
      expect(JSON.parse(fs.readFileSync(targetPath, 'utf8'))).toEqual({ id: 'one' });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('fails closed for missing fields, non-closed status and broken checkpoint lineage', () => {
    const valid = checkpoint();
    const { status: _status, ...missingStatus } = valid;
    expect(validateRequirementsContractCheckpointManifest(missingStatus).issueCodes).toContain(
      'authoring_checkpoint_manifest_required_field_missing'
    );
    expect(() => checkpoint({ status: 'complete' })).toThrow('authoring_checkpoint_status_invalid');
    expect(() => checkpoint({
      previousCheckpointManifestRef: {
        checkpointId: 'cp00', checkpointOrdinal: 0,
        path: 'authoring/staging/OTHER-ATTEMPT/manifests/0-cp00.json', hash: hash('3'),
      },
    })).toThrow('authoring_checkpoint_previous_path_identity_mismatch');
    expect(() => checkpoint({ latestValidPredecessorCheckpoint: 'cp99' })).toThrow(
      'authoring_checkpoint_latest_predecessor_mismatch'
    );
  });

  it('fails closed for incomplete build manifests and semantic/binding path mismatches', () => {
    const valid = createRequirementsContractBuildManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', inputManifestHash: hash('2'),
      terminalCheckpointManifestRef: { checkpointId: 'cp08', checkpointOrdinal: 8, path: 'authoring/staging/ATTEMPT-001/manifests/8-cp08.json', hash: hash('3') },
      semanticAuthorityRef: { semanticRevisionId: 'SEM-001', path: 'authoring/semantic-revisions/SEM-001/semantic-ir.json', hash: hash('4') },
      bindingAuthorityRef: { bindingRevisionId: 'BIND-001', path: 'authoring/source-bindings/BIND-001/source-binding.json', hash: hash('5') },
      artifactEntries: [artifact], decisionReceiptRefs: [], auditPacketRef: { artifactId: 'AUDIT-001', path: 'authoring/staging/ATTEMPT-001/judge-audit-packet.json', hash: hash('6') }, projectionReportRefs: [],
    });
    const { decisionReceiptRefs: _refs, ...missingRefs } = valid;
    expect(validateRequirementsContractBuildManifest(missingRefs).issueCodes).toContain(
      'authoring_build_manifest_required_field_missing'
    );
    expect(() => createRequirementsContractBuildManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', inputManifestHash: hash('2'),
      terminalCheckpointManifestRef: valid.terminalCheckpointManifestRef,
      semanticAuthorityRef: { ...valid.semanticAuthorityRef, path: 'authoring/semantic-revisions/OTHER/semantic-ir.json' },
      bindingAuthorityRef: valid.bindingAuthorityRef, artifactEntries: valid.artifactEntries,
      decisionReceiptRefs: valid.decisionReceiptRefs, auditPacketRef: valid.auditPacketRef,
      projectionReportRefs: valid.projectionReportRefs,
    })).toThrow('authoring_build_semantic_path_identity_mismatch');
  });

  it('rejects non-canonical and duplicate set-like manifest refs', () => {
    const decisions = [
      { decisionReceiptId: 'DEC-2', path: 'authoring/decisions/DEC-2.json', hash: hash('2') },
      { decisionReceiptId: 'DEC-1', path: 'authoring/decisions/DEC-1.json', hash: hash('1') },
    ];
    const validCheckpoint = checkpoint({ decisionReceiptRefs: decisions });
    const { checkpointManifestHash: _checkpointHash, ...checkpointPayload } = validCheckpoint;
    const unsortedCheckpointPayload = { ...checkpointPayload, decisionReceiptRefs: [...validCheckpoint.decisionReceiptRefs].reverse() };
    const unsortedCheckpoint = {
      ...unsortedCheckpointPayload,
      checkpointManifestHash: requirementsContractDomainHash(
        'requirements-contract-authoring-checkpoint-manifest/v1', unsortedCheckpointPayload
      ),
    };
    expect(validateRequirementsContractCheckpointManifest(unsortedCheckpoint).issueCodes).toContain(
      'authoring_manifest_decision_ref_order_invalid'
    );
    expect(() => checkpoint({ decisionReceiptRefs: [decisions[0], decisions[0]] })).toThrow(
      'authoring_manifest_decision_ref_duplicate'
    );

    const build = createRequirementsContractBuildManifest({
      authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', inputManifestHash: hash('2'),
      terminalCheckpointManifestRef: { checkpointId: 'cp08', checkpointOrdinal: 8, path: 'authoring/staging/ATTEMPT-001/manifests/8-cp08.json', hash: hash('3') },
      semanticAuthorityRef: { semanticRevisionId: 'SEM-001', path: 'authoring/semantic-revisions/SEM-001/semantic-ir.json', hash: hash('4') },
      bindingAuthorityRef: { bindingRevisionId: 'BIND-001', path: 'authoring/source-bindings/BIND-001/source-binding.json', hash: hash('5') },
      artifactEntries: [], decisionReceiptRefs: decisions,
      auditPacketRef: { artifactId: 'AUDIT-001', path: 'authoring/staging/ATTEMPT-001/judge-audit-packet.json', hash: hash('6') },
      projectionReportRefs: [
        { artifactId: 'PROJ-2', path: 'authoring/staging/ATTEMPT-001/projections/PROJ-2.json', hash: hash('8') },
        { artifactId: 'PROJ-1', path: 'authoring/staging/ATTEMPT-001/projections/PROJ-1.json', hash: hash('7') },
      ],
    });
    const { buildManifestHash: _buildHash, ...buildPayload } = build;
    const unsortedBuildPayload = { ...buildPayload, projectionReportRefs: [...build.projectionReportRefs].reverse() };
    const unsortedBuild = {
      ...unsortedBuildPayload,
      buildManifestHash: requirementsContractDomainHash(
        'requirements-contract-build-manifest/v1', unsortedBuildPayload
      ),
    };
    expect(validateRequirementsContractBuildManifest(unsortedBuild).issueCodes).toContain(
      'authoring_build_projection_ref_order_invalid'
    );
    expect(() => createRequirementsContractBuildManifest({
      ...buildPayload,
      projectionReportRefs: [build.projectionReportRefs[0]!, build.projectionReportRefs[0]!],
    })).toThrow('authoring_build_projection_ref_duplicate');
  });

  it('survives each publication crash window without overwriting canonical bytes', () => {
    const phases = ['temp_created', 'temp_fsynced', 'temp_readback_verified', 'before_publish', 'after_publish'] as const;
    for (const phase of phases) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `requirements-no-clobber-${phase}-`));
      const targetPath = path.join(root, 'manifest.json');
      try {
        expect(() => atomicNoClobberPublish({
          targetPath,
          value: { id: 'one' },
          onPhase(current) { if (current === phase) throw new Error(`crash:${phase}`); },
        })).toThrow(`crash:${phase}`);
        const recovered = atomicNoClobberPublish({ targetPath, value: { id: 'one' } });
        expect(['published', 'reused']).toContain(recovered.disposition);
        expect(JSON.parse(fs.readFileSync(targetPath, 'utf8'))).toEqual({ id: 'one' });
        expect(fs.readdirSync(root).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
      } finally { fs.rmSync(root, { recursive: true, force: true }); }
    }
  });

  it('enforces all nine authority fields for each repair route', () => {
    const current = authorityTuple('SEM-001', hash('1'), 'BIND-001', hash('2'), 'ATTEMPT-001');
    const projection = {
      ...current,
      activeAuthoringAttemptId: 'ATTEMPT-002',
      activeBuildManifestPath: 'authoring/staging/ATTEMPT-002/contract-build-manifest.json',
      activeBuildManifestHash: hash('3'),
    };
    expect(() => assertRequirementsAuthorityRouteTransition({ route: 'projection_repair', current, next: projection })).not.toThrow();
    expect(() => assertRequirementsAuthorityRouteTransition({
      route: 'projection_repair', current,
      next: {
        ...projection,
        activeBindingRevisionId: 'BIND-002',
        activeSourceBindingPath: 'authoring/source-bindings/BIND-002/source-binding.json',
      },
    })).toThrow('requirements_projection_repair_authority_mutation_forbidden');
    const binding = {
      ...current,
      activeBindingRevisionId: 'BIND-002',
      activeSourceBindingPath: 'authoring/source-bindings/BIND-002/source-binding.json',
      activeSourceBindingHash: hash('4'),
    };
    expect(() => assertRequirementsAuthorityRouteTransition({ route: 'binding_refresh', current, next: binding })).not.toThrow();
    expect(() => assertRequirementsAuthorityRouteTransition({ route: 'binding_refresh', current, next: { ...binding, activeBuildManifestHash: hash('5') } })).toThrow('requirements_binding_refresh_authority_mutation_forbidden');
    expect(() => assertRequirementsAuthorityRouteTransition({ route: 'semantic_repair', current, next: { ...current, activeSemanticRevisionId: 'SEM-002', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-002/semantic-ir.json' } })).toThrow('requirements_semantic_repair_requires_full_replacement');
  });

  it('readbacks all authority groups before publishing the build tuple', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-authority-commit-'));
    try {
      const semantic = createRequirementsContractSemanticIr({
        recordId: 'REQ-001', requestId: 'REQUEST-001', parentSemanticRevisionId: null,
        compilerVersion: 'compiler-v1', semantics: { title: 'One' }, evidenceClaims: [],
        specSpanRegistry: [], executionConstraints: [], semanticProvenance: {},
      });
      const binding = createRequirementsContractSourceBindingCapsule({
        recordId: 'REQ-001', semanticRevisionId: semantic.semanticRevisionId,
        scopeSemanticHash: semantic.scopeSemanticHash, parentBindingRevisionId: null,
        resolverIdentity: 'resolver-v1', sourceArtifacts: [], sourceSpans: [], evidenceClaimBindings: [],
      });
      const build = createRequirementsContractBuildManifest({
        authoringRequestId: 'REQUEST-001', authoringAttemptId: 'ATTEMPT-001', inputManifestHash: hash('2'),
        terminalCheckpointManifestRef: { checkpointId: 'cp08', checkpointOrdinal: 8, path: 'authoring/staging/ATTEMPT-001/manifests/8-cp08.json', hash: hash('3') },
        semanticAuthorityRef: { semanticRevisionId: semantic.semanticRevisionId, path: `authoring/semantic-revisions/${semantic.semanticRevisionId}/semantic-ir.json`, hash: semantic.scopeSemanticHash },
        bindingAuthorityRef: { bindingRevisionId: binding.bindingRevisionId, path: `authoring/source-bindings/${binding.bindingRevisionId}/source-binding.json`, hash: binding.sourceBindingHash },
        artifactEntries: [], decisionReceiptRefs: [], auditPacketRef: { artifactId: 'AUDIT-001', path: 'authoring/staging/ATTEMPT-001/judge-audit-packet.json', hash: hash('6') }, projectionReportRefs: [],
      });
      const next = {
        ...authorityTuple(semantic.semanticRevisionId, semantic.scopeSemanticHash, binding.bindingRevisionId, binding.sourceBindingHash),
        activeBuildManifestHash: build.buildManifestHash,
      };
      for (const [relativePath, value] of [[next.activeSemanticIrPath, semantic], [next.activeSourceBindingPath, binding]] as const) {
        const absolutePath = path.join(root, ...relativePath.split('/'));
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, JSON.stringify(value));
      }
      const targetPath = path.join(root, ...next.activeBuildManifestPath.split('/'));
      expect(commitRequirementsContractAuthorityPublication({
        route: 'initial', current: null, next, recordRootPath: root,
        buildManifestTargetPath: targetPath, buildManifest: build,
        compareAndSwapAuthorityTuple: () => true,
      }).activeAuthority).toEqual(next);
      fs.writeFileSync(path.join(root, ...next.activeSemanticIrPath.split('/')), JSON.stringify({ ...semantic, scopeSemanticHash: hash('7') }));
      expect(() => commitRequirementsContractAuthorityPublication({
        route: 'initial', current: null, next, recordRootPath: root,
        buildManifestTargetPath: targetPath, buildManifest: build,
        compareAndSwapAuthorityTuple: () => true,
      })).toThrow();
      expect(() => commitRequirementsContractAuthorityPublication({
        route: 'initial', current: null, next, recordRootPath: root,
        buildManifestTargetPath: path.join(root, 'wrong.json'), buildManifest: build,
        compareAndSwapAuthorityTuple: () => true,
      })).toThrow('requirements_authority_build_manifest_target_mismatch');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
