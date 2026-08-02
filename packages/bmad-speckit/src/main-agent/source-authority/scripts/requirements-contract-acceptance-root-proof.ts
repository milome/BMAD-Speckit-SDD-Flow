import { sha256Stable } from './requirements-contract-semantic-resolver';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

export interface RequirementsContractAcceptanceRoot {
  acceptanceRootId: string;
  sourcePath: string;
  sourceSpan: { startLine: number; endLine: number };
  sourceHash: string;
  authorityClass: string;
  authorityProofRefs: string[];
  applicability: {
    decision: 'applicable' | 'not_applicable' | 'unresolved' | 'invalid';
    reasonCode: string;
    proofRefs: string[];
  };
  requirementRefs: string[];
  rootPayloadHash: string;
}

export function createRequirementsContractAcceptanceRootProofManifest(input: {
  requirementSetId: string;
  canonicalParserHash: string;
  sourceAuthorityHash: string;
  decisionReceiptSetHash: string;
  roots: RequirementsContractAcceptanceRoot[];
}) {
  const seen = new Set<string>();
  for (const root of input.roots) {
    if (seen.has(root.acceptanceRootId)) {
      throw new Error(`acceptance_root_duplicate:${root.acceptanceRootId}`);
    }
    seen.add(root.acceptanceRootId);
    if (
      root.sourceSpan.startLine < 1 ||
      root.sourceSpan.endLine < root.sourceSpan.startLine
    ) {
      throw new Error(`acceptance_root_source_span_invalid:${root.acceptanceRootId}`);
    }
    if (
      !SHA256.test(root.sourceHash) ||
      !SHA256.test(root.rootPayloadHash) ||
      root.authorityProofRefs.length === 0 ||
      root.applicability.proofRefs.length === 0 ||
      root.requirementRefs.length === 0
    ) {
      throw new Error(`acceptance_root_authority_invalid:${root.acceptanceRootId}`);
    }
  }
  if (input.roots.length === 0) throw new Error('acceptance_root_manifest_empty');

  const roots = [...input.roots].sort((left, right) =>
    left.acceptanceRootId.localeCompare(right.acceptanceRootId)
  );
  const orderedRootIds = roots.map((root) => root.acceptanceRootId);
  return {
    schemaVersion: 'requirements-contract-acceptance-root-proof-manifest/v1' as const,
    canonicalFileName: 'acceptance-root-proof-manifest.json' as const,
    requirementSetId: input.requirementSetId,
    canonicalParserHash: input.canonicalParserHash,
    sourceAuthorityHash: input.sourceAuthorityHash,
    decisionReceiptSetHash: input.decisionReceiptSetHash,
    rootCount: roots.length,
    orderedRootIds,
    rootSetHash: sha256Stable(
      roots.map((root) => ({
        acceptanceRootId: root.acceptanceRootId,
        rootPayloadHash: root.rootPayloadHash,
      }))
    ),
    roots,
  };
}
