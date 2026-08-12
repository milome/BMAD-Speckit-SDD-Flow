import fs from 'node:fs';
import path from 'node:path';
import {
  atomicNoClobberPublish,
  type AtomicNoClobberPhase,
} from './requirements-contract-atomic-no-clobber-publisher';
import {
  createRequirementsContractCheckpointManifest,
  validateRequirementsContractCheckpointManifest,
  type RequirementsCheckpointManifestRef,
  type RequirementsContractCheckpointManifest,
} from './requirements-contract-authoring-manifest';
import {
  activeAuthoringAttemptPointerHash,
  publishActiveAuthoringAttemptPointer,
  type ActiveAuthoringAttemptPointer,
} from './requirements-contract-active-authoring-attempt-pointer';
import {
  createRequirementsContractCoreArtifactFreeze,
  sha256Stable,
} from './requirements-contract-semantic-resolver';
import { verifyRequirementsContractCoreArtifactReadback } from './requirements-contract-semantic-conservation-verifier';
import { validateRequirementsContractSourceBindingCapsule } from './requirements-contract-source-binding-capsule';

export interface RequirementsContractSourceBindingRefreshPreflightInput {
  semanticRevisionId: string;
  scopeSemanticHash: string;
  beforeSemanticAuthority: Record<string, unknown>;
  afterSemanticAuthority: Record<string, unknown>;
  beforeLocatorHash: string;
  afterLocatorHash: string;
}

export interface RequirementsContractSourceBindingRefreshPreflight {
  schemaVersion: 'requirements-contract-source-binding-refresh-preflight/v1';
  decision: 'no_change' | 'refresh_binding' | 'semantic_recompile';
  semanticRevisionId: string;
  scopeSemanticHash: string;
  beforeSemanticAuthorityHash: string;
  afterSemanticAuthorityHash: string;
  beforeLocatorHash: string;
  afterLocatorHash: string;
  rerunCp00: boolean;
  invalidateConfirmation: boolean;
  triggerGoalCompilation: boolean;
  preflightHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

export function preflightRequirementsContractSourceBindingRefresh(
  input: RequirementsContractSourceBindingRefreshPreflightInput
): RequirementsContractSourceBindingRefreshPreflight {
  if (
    !input.semanticRevisionId?.trim() ||
    !SHA256.test(input.scopeSemanticHash) ||
    !SHA256.test(input.beforeLocatorHash) ||
    !SHA256.test(input.afterLocatorHash)
  ) {
    throw new Error('requirements_source_binding_refresh_identity_invalid');
  }
  const beforeSemanticAuthorityHash = sha256Stable(input.beforeSemanticAuthority);
  const afterSemanticAuthorityHash = sha256Stable(input.afterSemanticAuthority);
  const semanticChanged = beforeSemanticAuthorityHash !== afterSemanticAuthorityHash;
  const locatorChanged = input.beforeLocatorHash !== input.afterLocatorHash;
  const decision = semanticChanged
    ? 'semantic_recompile' as const
    : locatorChanged
      ? 'refresh_binding' as const
      : 'no_change' as const;
  const payload = {
    schemaVersion: 'requirements-contract-source-binding-refresh-preflight/v1' as const,
    decision,
    semanticRevisionId: input.semanticRevisionId.normalize('NFC'),
    scopeSemanticHash: input.scopeSemanticHash,
    beforeSemanticAuthorityHash,
    afterSemanticAuthorityHash,
    beforeLocatorHash: input.beforeLocatorHash,
    afterLocatorHash: input.afterLocatorHash,
    rerunCp00: semanticChanged,
    invalidateConfirmation: semanticChanged,
    triggerGoalCompilation: false,
  };
  return {
    ...payload,
    preflightHash: sha256Stable({
      domain: 'requirements-contract-source-binding-refresh-preflight/v1',
      payload,
    }),
  };
}

function resolveRecordRelativePath(recordRootPath: string, recordRelativePath: string): string {
  const root = path.resolve(recordRootPath);
  const target = path.resolve(root, ...recordRelativePath.split('/'));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('requirements_source_binding_refresh_path_escape');
  }
  return target;
}

function readJsonRecord(filePath: string, code: string): Record<string, unknown> {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
    return value as Record<string, unknown>;
  } catch {
    throw new Error(code);
  }
}

function bindingRevisionId(sourceBindingHash: string): string {
  return `binding-revision-${sourceBindingHash.slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

export function publishRequirementsContractSourceBindingRefresh(input: {
  recordRootPath: string;
  currentAttemptPointer: ActiveAuthoringAttemptPointer;
  expectedCurrentPointerHash: string;
  preflight: RequirementsContractSourceBindingRefreshPreflight;
  sourceBinding: Record<string, unknown>;
  resolvedEvidenceIndex: Record<string, unknown>;
  authoringRequestId: string;
  authoringAttemptId: string;
  inputManifestHash: string;
  previousCheckpointManifestRef: RequirementsCheckpointManifestRef;
  compilerIdentity: string;
  decisionReceiptRefs: RequirementsContractCheckpointManifest['decisionReceiptRefs'];
  baseAuthorityRef: Record<string, unknown> | null;
  currentAuthority?: {
    semanticIrPath: string;
    sourceBindingPath: string;
  };
  preserveCurrentAttemptPointer?: boolean;
  compareAndSwapAttemptPointer: Parameters<
    typeof publishActiveAuthoringAttemptPointer
  >[0]['compareAndSwap'];
  onArtifactPhase?: (
    role: 'semantic-ir' | 'source-binding' | 'resolved-evidence-index' | 'refresh-receipt',
    phase: AtomicNoClobberPhase
  ) => void;
}) {
  if (
    input.preflight.decision !== 'refresh_binding' ||
    input.preflight.rerunCp00 ||
    input.preflight.invalidateConfirmation ||
    input.preflight.triggerGoalCompilation
  ) {
    throw new Error('requirements_source_binding_refresh_preflight_not_refreshable');
  }
  const currentPointerHash = activeAuthoringAttemptPointerHash(input.currentAttemptPointer);
  if (currentPointerHash !== input.expectedCurrentPointerHash) {
    throw new Error('requirements_source_binding_refresh_pointer_hash_mismatch');
  }
  const currentManifestPath = resolveRecordRelativePath(
    input.recordRootPath,
    input.currentAttemptPointer.attemptManifestPath
  );
  const currentManifest = readJsonRecord(
    currentManifestPath,
    'requirements_source_binding_refresh_current_manifest_invalid'
  ) as unknown as RequirementsContractCheckpointManifest;
  const currentManifestValidation = validateRequirementsContractCheckpointManifest(currentManifest);
  if (currentManifestValidation.decision === 'block') {
    throw new Error(currentManifestValidation.issueCodes[0]);
  }
  if (
    currentManifest.checkpointManifestHash !== input.currentAttemptPointer.attemptManifestHash ||
    currentManifest.authoringAttemptId !== input.currentAttemptPointer.authoringAttemptId ||
    currentManifest.inputManifestHash !== input.currentAttemptPointer.inputManifestHash
  ) {
    throw new Error('requirements_source_binding_refresh_current_manifest_mismatch');
  }
  const manifestSemanticEntry = currentManifest.artifactEntries.find((entry) => entry.role === 'semantic_ir');
  const manifestBindingEntry = currentManifest.artifactEntries.find((entry) => entry.role === 'source_binding');
  if ((!manifestSemanticEntry || !manifestBindingEntry) && !input.currentAuthority) {
    throw new Error('requirements_source_binding_refresh_current_authority_missing');
  }
  const semanticIrPath = resolveRecordRelativePath(
    input.recordRootPath,
    manifestSemanticEntry?.recordRelativePath ?? input.currentAuthority!.semanticIrPath
  );
  const currentBindingPath = resolveRecordRelativePath(
    input.recordRootPath,
    manifestBindingEntry?.recordRelativePath ?? input.currentAuthority!.sourceBindingPath
  );
  const semanticIr = readJsonRecord(
    semanticIrPath,
    'requirements_source_binding_refresh_semantic_readback_invalid'
  );
  const currentBinding = readJsonRecord(
    currentBindingPath,
    'requirements_source_binding_refresh_binding_readback_invalid'
  );
  if (
    semanticIr.semanticRevisionId !== input.preflight.semanticRevisionId ||
    semanticIr.scopeSemanticHash !== input.preflight.scopeSemanticHash ||
    currentBinding.semanticRevisionId !== input.preflight.semanticRevisionId ||
    currentBinding.scopeSemanticHash !== input.preflight.scopeSemanticHash
  ) {
    throw new Error('requirements_source_binding_refresh_semantic_identity_mismatch');
  }
  const semanticFreeze = createRequirementsContractCoreArtifactFreeze({
    stage: 'cp04',
    artifactRole: 'semantic-ir',
    artifact: semanticIr,
  });
  const semanticEntry = manifestSemanticEntry ?? {
    role: 'semantic_ir',
    schemaVersion: String(semanticIr.schemaVersion ?? 'requirements-contract-semantic-ir/v1'),
    artifactId: String(semanticIr.semanticRevisionId ?? ''),
    recordRelativePath: input.currentAuthority!.semanticIrPath,
    artifactHash: semanticFreeze.artifactHash,
  };
  if (semanticFreeze.artifactHash !== semanticEntry.artifactHash) {
    throw new Error('requirements_source_binding_refresh_semantic_manifest_mismatch');
  }
  const semanticIdentity = {
    scopeSemanticHash: input.preflight.scopeSemanticHash,
    semanticRevisionId: input.preflight.semanticRevisionId,
  };
  const canonicalBindingValidation = validateRequirementsContractSourceBindingCapsule(input.sourceBinding);
  const sourceBindingPreimage = { ...input.sourceBinding, ...semanticIdentity };
  const sourceBindingHash = canonicalBindingValidation.decision === 'pass'
    ? String(input.sourceBinding.sourceBindingHash)
    : sha256Stable({
        domain: 'requirements-contract-source-binding-hash/v1',
        sourceBinding: sourceBindingPreimage,
      });
  const bindingIdentity = canonicalBindingValidation.decision === 'pass'
    ? {
        sourceBindingHash,
        bindingRevisionId: String(input.sourceBinding.bindingRevisionId),
      }
    : {
        sourceBindingHash,
        bindingRevisionId: bindingRevisionId(sourceBindingHash),
      };
  const sourceBinding = canonicalBindingValidation.decision === 'pass'
    ? input.sourceBinding
    : { ...sourceBindingPreimage, ...bindingIdentity };
  const resolvedEvidenceIndex = canonicalBindingValidation.decision === 'pass'
    ? input.resolvedEvidenceIndex
    : { ...input.resolvedEvidenceIndex, ...semanticIdentity, ...bindingIdentity };
  const sourceBindingFreeze = createRequirementsContractCoreArtifactFreeze({
    stage: 'cp04', artifactRole: 'source-binding', artifact: sourceBinding,
  });
  const resolvedEvidenceIndexFreeze = createRequirementsContractCoreArtifactFreeze({
    stage: 'cp04', artifactRole: 'resolved-evidence-index', artifact: resolvedEvidenceIndex,
  });
  const relativePaths = {
    semanticIr: semanticEntry.recordRelativePath,
    sourceBinding:
      `authoring/source-bindings/${bindingIdentity.bindingRevisionId}/source-binding.json`,
    resolvedEvidenceIndex:
      `authoring/source-bindings/${bindingIdentity.bindingRevisionId}/resolved-evidence-index.json`,
    refreshReceipt:
      `authoring/source-bindings/${bindingIdentity.bindingRevisionId}/source-binding-refresh-receipt.json`,
    checkpointManifest:
      `authoring/staging/${input.authoringAttemptId}/manifests/4-cp04.json`,
  };
  const paths = Object.fromEntries(
    Object.entries(relativePaths).map(([key, value]) => [
      key,
      resolveRecordRelativePath(input.recordRootPath, value),
    ])
  ) as Record<keyof typeof relativePaths, string>;
  const phase = (
    role: Parameters<NonNullable<typeof input.onArtifactPhase>>[0]
  ) => input.onArtifactPhase
    ? (current: AtomicNoClobberPhase) => input.onArtifactPhase?.(role, current)
    : undefined;
  const publications = {
    semanticIr: atomicNoClobberPublish({
      targetPath: paths.semanticIr,
      value: semanticIr,
      role: 'semantic-ir',
      mediaType: 'application/json',
      onPhase: phase('semantic-ir'),
      validateReadback(value) {
        if (
          !value || typeof value !== 'object' || Array.isArray(value) ||
          !verifyRequirementsContractCoreArtifactReadback({
            freeze: semanticFreeze,
            artifact: value as Record<string, unknown>,
          })
        ) throw new Error('requirements_source_binding_refresh_semantic_readback_mismatch');
      },
    }),
    sourceBinding: atomicNoClobberPublish({
      targetPath: paths.sourceBinding,
      value: sourceBinding,
      role: 'source-binding',
      mediaType: 'application/json',
      onPhase: phase('source-binding'),
      validateReadback(value) {
        if (
          !value || typeof value !== 'object' || Array.isArray(value) ||
          !verifyRequirementsContractCoreArtifactReadback({
            freeze: sourceBindingFreeze,
            artifact: value as Record<string, unknown>,
          })
        ) throw new Error('requirements_source_binding_refresh_binding_readback_mismatch');
      },
    }),
    resolvedEvidenceIndex: atomicNoClobberPublish({
      targetPath: paths.resolvedEvidenceIndex,
      value: resolvedEvidenceIndex,
      role: 'resolved-evidence-index',
      mediaType: 'application/json',
      onPhase: phase('resolved-evidence-index'),
      validateReadback(value) {
        if (
          !value || typeof value !== 'object' || Array.isArray(value) ||
          !verifyRequirementsContractCoreArtifactReadback({
            freeze: resolvedEvidenceIndexFreeze,
            artifact: value as Record<string, unknown>,
          })
        ) throw new Error('requirements_source_binding_refresh_index_readback_mismatch');
      },
    }),
  };
  const refreshReceipt = createRequirementsContractSourceBindingRefreshReceipt({
    semanticRevisionId: semanticIdentity.semanticRevisionId,
    scopeSemanticHash: semanticIdentity.scopeSemanticHash,
    fromBindingRevisionId: String(currentBinding.bindingRevisionId ?? ''),
    toBindingRevisionId: bindingIdentity.bindingRevisionId,
    fromSourceBindingHash: String(currentBinding.sourceBindingHash ?? ''),
    toSourceBindingHash: bindingIdentity.sourceBindingHash,
    fromSnapshotSetHash: String(
      currentBinding.snapshotSetHash ?? sha256Stable(currentBinding.sourceArtifacts)
    ),
    toSnapshotSetHash: String(
      sourceBinding.snapshotSetHash ?? sha256Stable(sourceBinding.sourceArtifacts)
    ),
    fromSourceSpanRegistryHash: String(currentBinding.sourceSpanRegistryHash ?? ''),
    toSourceSpanRegistryHash: String(sourceBinding.sourceSpanRegistryHash ?? ''),
    evidenceClaimRegistryHash: String(
      sourceBinding.evidenceClaimRegistryHash ??
      sourceBinding.evidenceClaimBindingRegistryHash ??
      sha256Stable(sourceBinding.evidenceClaimBindings)
    ),
  });
  const refreshReceiptPublication = atomicNoClobberPublish({
    targetPath: paths.refreshReceipt,
    value: refreshReceipt,
    role: 'source-binding-refresh-receipt',
    mediaType: 'application/json',
    onPhase: phase('refresh-receipt'),
    validateReadback(value) {
      if (
        !value || typeof value !== 'object' || Array.isArray(value) ||
        (value as Record<string, unknown>).receiptHash !== refreshReceipt.receiptHash
      ) throw new Error('requirements_source_binding_refresh_receipt_readback_mismatch');
    },
  });
  const checkpointManifest = input.preserveCurrentAttemptPointer
    ? currentManifest
    : createRequirementsContractCheckpointManifest({
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    checkpointId: 'cp04', checkpointOrdinal: 4, stage: 'cp04', status: 'passed',
    inputManifestHash: input.inputManifestHash,
    previousCheckpointManifestRef: input.previousCheckpointManifestRef,
    latestValidPredecessorCheckpoint: input.previousCheckpointManifestRef.checkpointId,
    compilerIdentity: input.compilerIdentity,
    artifactEntries: [
      semanticEntry,
      {
        role: 'source_binding',
        schemaVersion: String(sourceBinding.schemaVersion ?? 'requirements-contract-source-binding/v1'),
        artifactId: bindingIdentity.bindingRevisionId,
        recordRelativePath: relativePaths.sourceBinding,
        artifactHash: sourceBindingFreeze.artifactHash,
      },
      {
        role: 'resolved_evidence_index',
        schemaVersion: String(
          resolvedEvidenceIndex.schemaVersion ?? 'requirements-contract-resolved-evidence-index/v1'
        ),
        artifactId: `resolved-evidence-index-${bindingIdentity.bindingRevisionId}`,
        recordRelativePath: relativePaths.resolvedEvidenceIndex,
        artifactHash: resolvedEvidenceIndexFreeze.artifactHash,
      },
    ],
    decisionReceiptRefs: input.decisionReceiptRefs,
    baseAuthorityRef: input.baseAuthorityRef,
    });
  const checkpointManifestPublication = input.preserveCurrentAttemptPointer
    ? null
    : atomicNoClobberPublish({
    targetPath: paths.checkpointManifest,
    value: checkpointManifest,
    role: 'requirements_contract_checkpoint_manifest',
    mediaType: 'application/json',
    validateReadback(value) {
      const validation = validateRequirementsContractCheckpointManifest(value);
      if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
    },
  });
  const pointer: ActiveAuthoringAttemptPointer = input.preserveCurrentAttemptPointer
    ? input.currentAttemptPointer
    : {
    schemaVersion: 'ActiveAuthoringAttemptPointer/v1',
    authoringAttemptId: input.authoringAttemptId,
    attemptManifestPath: relativePaths.checkpointManifest,
    attemptManifestHash: checkpointManifest.checkpointManifestHash,
    latestValidPredecessorCheckpoint: checkpointManifest.latestValidPredecessorCheckpoint,
    inputManifestHash: input.inputManifestHash,
    };
  const attemptPointer = input.preserveCurrentAttemptPointer
    ? {
        pointer,
        pointerHash: input.expectedCurrentPointerHash,
      }
    : publishActiveAuthoringAttemptPointer({
    pointer,
    expectedCurrentPointerHash: input.expectedCurrentPointerHash,
    readAttemptManifest(recordRelativePath) {
      if (recordRelativePath !== relativePaths.checkpointManifest) {
        throw new Error('requirements_source_binding_refresh_manifest_path_mismatch');
      }
      return readJsonRecord(
        paths.checkpointManifest,
        'requirements_source_binding_refresh_manifest_readback_invalid'
      );
    },
    compareAndSwap: input.compareAndSwapAttemptPointer,
    });
  return {
    status: 'published' as const,
    semanticIdentity,
    bindingIdentity,
    paths,
    publications: {
      ...publications,
      refreshReceipt: refreshReceiptPublication,
      checkpointManifest: checkpointManifestPublication,
    },
    checkpointManifest,
    refreshReceipt,
    attemptPointer,
    readback: {
      semanticIr: true as const,
      sourceBinding: true as const,
      resolvedEvidenceIndex: true as const,
      refreshReceipt: true as const,
      checkpointManifest: input.preserveCurrentAttemptPointer ? false as const : true as const,
    },
  };
}

export function createRequirementsContractSourceBindingRefreshReceipt(input: {
  semanticRevisionId: string;
  scopeSemanticHash: string;
  fromBindingRevisionId: string;
  toBindingRevisionId: string;
  fromSourceBindingHash: string;
  toSourceBindingHash: string;
  fromSnapshotSetHash: string;
  toSnapshotSetHash: string;
  fromSourceSpanRegistryHash: string;
  toSourceSpanRegistryHash: string;
  evidenceClaimRegistryHash: string;
}) {
  const payload = {
    schemaVersion: 'requirements-source-binding-refresh-receipt/v2' as const,
    ...input,
    resolverDisposition: 'passed' as const,
    conservationDisposition: 'passed' as const,
    citationProjectionRefreshDisposition: 'not_applicable' as const,
    confirmationPromotionReceiptRef: null,
    pageArtifactBytesHash: null,
    pageReadbackDisposition: 'not_applicable' as const,
    pagePromotionDisposition: 'not_applicable' as const,
  };
  const hashes = [
    input.scopeSemanticHash,
    input.fromSourceBindingHash,
    input.toSourceBindingHash,
    input.fromSnapshotSetHash,
    input.toSnapshotSetHash,
    input.fromSourceSpanRegistryHash,
    input.toSourceSpanRegistryHash,
    input.evidenceClaimRegistryHash,
  ];
  if (hashes.some((hash) => !SHA256.test(hash))) {
    throw new Error('requirements_source_binding_refresh_hash_invalid');
  }
  return {
    ...payload,
    receiptHash: sha256Stable({
      domain: 'requirements-source-binding-refresh-receipt/v2',
      payload,
    }),
  };
}
