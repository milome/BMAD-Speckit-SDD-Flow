import { sha256Stable } from './requirements-contract-semantic-resolver';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

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
    ? ('semantic_recompile' as const)
    : locatorChanged
      ? ('refresh_binding' as const)
      : ('no_change' as const);
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
  pageEvidence?: {
    confirmationPromotionReceiptRef: { path: string; hash: string };
    pageArtifactBytesHash: string;
    htmlPageArtifactBytesHash: string;
  };
}) {
  const { pageEvidence, ...identity } = input;
  const payload = {
    schemaVersion: 'requirements-source-binding-refresh-receipt/v2' as const,
    ...identity,
    resolverDisposition: 'passed' as const,
    conservationDisposition: 'passed' as const,
    citationProjectionRefreshDisposition: pageEvidence
      ? ('passed' as const)
      : ('not_applicable' as const),
    confirmationPromotionReceiptRef: pageEvidence?.confirmationPromotionReceiptRef ?? null,
    pageArtifactBytesHash: pageEvidence?.pageArtifactBytesHash ?? null,
    htmlPageArtifactBytesHash: pageEvidence?.htmlPageArtifactBytesHash ?? null,
    pageReadbackDisposition: pageEvidence ? ('passed' as const) : ('not_applicable' as const),
    pagePromotionDisposition: pageEvidence ? ('promoted' as const) : ('not_applicable' as const),
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
    ...(pageEvidence
      ? [
          pageEvidence.confirmationPromotionReceiptRef.hash,
          pageEvidence.pageArtifactBytesHash,
          pageEvidence.htmlPageArtifactBytesHash,
        ]
      : []),
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
