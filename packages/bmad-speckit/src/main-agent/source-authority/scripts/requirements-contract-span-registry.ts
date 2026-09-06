import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import { resolveTypedSourceAuthority, type RequirementsTypedSourceAuthority } from './requirements-contract-typed-source-semantics';

export type RequirementsAuthorityClass = 'source_grounded' | 'human_confirmed' | 'derived';

export interface RequirementsSpecSpan {
  specSpanId: string;
  authorityClass: RequirementsAuthorityClass;
  normalizedClaimHash: string;
  boundSemanticNodeIds: string[];
  boundObligationIds: string[];
  evidenceClaimRefs: string[];
  decisionReceiptRefs: string[];
  derivationReceiptRefs: string[];
  boundTypedSourceGraphHash?: string;
}

export interface RequirementsSourceSpan {
  sourceSpanId: string;
  sourceArtifactId: string;
  sourceSnapshotHash: string;
  startByte: number;
  endByteExclusive: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  exactTextHash: string;
  normalizedTextHash: string;
  structuralAnchor: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const LEGACY_SOURCE_SPAN = /^SOURCE-SPAN-\d+$/u;

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stableId(prefix: string, domain: string, payload: unknown): string {
  return `${prefix}-${requirementsContractDomainHash(domain, payload)
    .slice('sha256:'.length, 'sha256:'.length + 20)
    .toUpperCase()}`;
}

export function canonicalSpecSpanId(input: {
  normalizedClaimHash: string;
  obligationIds: string[];
  boundTypedSourceGraphHash?: string;
}): string {
  return stableId('SPEC-SPAN', input.boundTypedSourceGraphHash ? 'requirements-spec-span-id/v2' : 'requirements-spec-span-id/v1', {
    normalizedClaimHash: input.normalizedClaimHash,
    obligationIds: sortedUnique(input.obligationIds),
    ...(input.boundTypedSourceGraphHash ? { boundTypedSourceGraphHash: input.boundTypedSourceGraphHash } : {}),
  });
}

export function resolveRequirementsSpecSpanSourceNodeIds(span: RequirementsSpecSpan, authority?: RequirementsTypedSourceAuthority): string[] {
  if (span.boundTypedSourceGraphHash === undefined) return [...span.boundObligationIds];
  if (!authority || !SHA256.test(span.boundTypedSourceGraphHash) || span.boundTypedSourceGraphHash !== authority.graphHash ||
    span.normalizedClaimHash !== authority.graphHash || span.authorityClass !== 'source_grounded') {
    throw new Error('requirements_spec_span_typed_graph_binding_invalid');
  }
  const graph = resolveTypedSourceAuthority(authority);
  const actionIds = graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId);
  const sameSet = (left: string[], right: string[]) => canonicalRequirementsJson(sortedUnique(left)) === canonicalRequirementsJson(sortedUnique(right));
  if (!sameSet(span.boundObligationIds, actionIds) ||
    !sameSet(span.boundSemanticNodeIds, [...actionIds, ...actionIds.map((id) => `${id}-A1`)])) {
    throw new Error('requirements_spec_span_typed_direct_projection_mismatch');
  }
  return graph.sourceNodes.map((node) => node.sourceRootId);
}

export function canonicalSourceSpanId(input: {
  sourceArtifactId: string;
  sourceSnapshotHash: string;
  startByte: number;
  endByteExclusive: number;
  exactTextHash: string;
}): string {
  return stableId('SOURCE-SPAN', 'requirements-source-span-id/v1', {
    sourceArtifactId: input.sourceArtifactId,
    sourceSnapshotHash: input.sourceSnapshotHash,
    startByte: input.startByte,
    endByteExclusive: input.endByteExclusive,
    exactTextHash: input.exactTextHash,
  });
}

export function createSpecSpanRegistry(
  spans: Array<Omit<RequirementsSpecSpan, 'specSpanId'> & { specSpanId?: string }>
): RequirementsSpecSpan[] {
  const registry = spans.map((span) => {
    const expectedSpecSpanId = canonicalSpecSpanId({
      normalizedClaimHash: span.normalizedClaimHash,
      obligationIds: span.boundObligationIds,
      ...(span.boundTypedSourceGraphHash ? { boundTypedSourceGraphHash: span.boundTypedSourceGraphHash } : {}),
    });
    const specSpanId = span.specSpanId ?? expectedSpecSpanId;
    if (LEGACY_SOURCE_SPAN.test(specSpanId)) {
      throw new Error('legacy_source_span_identity_forbidden');
    }
    if (!SHA256.test(span.normalizedClaimHash)) {
      throw new Error('spec_span_normalized_claim_hash_invalid');
    }
    if (span.boundTypedSourceGraphHash !== undefined && (!SHA256.test(span.boundTypedSourceGraphHash) ||
      span.boundTypedSourceGraphHash !== span.normalizedClaimHash || span.authorityClass !== 'source_grounded')) {
      throw new Error('requirements_spec_span_typed_graph_binding_invalid');
    }
    if (specSpanId !== expectedSpecSpanId) {
      throw new Error('spec_span_identity_mismatch');
    }
    return {
      ...span,
      specSpanId,
      boundSemanticNodeIds: sortedUnique(span.boundSemanticNodeIds),
      boundObligationIds: sortedUnique(span.boundObligationIds),
      evidenceClaimRefs: sortedUnique(span.evidenceClaimRefs),
      decisionReceiptRefs: sortedUnique(span.decisionReceiptRefs),
      derivationReceiptRefs: sortedUnique(span.derivationReceiptRefs),
    };
  });
  const ids = registry.map((span) => span.specSpanId);
  if (new Set(ids).size !== ids.length) throw new Error('spec_span_identity_duplicate');
  return registry.sort((left, right) => left.specSpanId.localeCompare(right.specSpanId));
}

export function createSourceSpanRegistry(
  spans: Array<Omit<RequirementsSourceSpan, 'sourceSpanId'> & { sourceSpanId?: string }>
): RequirementsSourceSpan[] {
  const registry = spans.map((span) => {
    const expectedSourceSpanId = canonicalSourceSpanId(span);
    const sourceSpanId = span.sourceSpanId ?? expectedSourceSpanId;
    if (sourceSpanId !== expectedSourceSpanId && LEGACY_SOURCE_SPAN.test(sourceSpanId)) {
      throw new Error('legacy_source_span_identity_forbidden');
    }
    if (
      span.startByte < 0 ||
      span.endByteExclusive <= span.startByte ||
      span.startLine < 1 ||
      span.startColumn < 1 ||
      span.endLine < span.startLine ||
      (span.endLine === span.startLine && span.endColumn <= span.startColumn)
    ) {
      throw new Error('source_span_bounds_invalid');
    }
    if (![span.sourceSnapshotHash, span.exactTextHash, span.normalizedTextHash].every((value) => SHA256.test(value))) {
      throw new Error('source_span_hash_invalid');
    }
    if (sourceSpanId !== expectedSourceSpanId) {
      throw new Error('source_span_identity_mismatch');
    }
    return { ...span, sourceSpanId };
  });
  const ids = registry.map((span) => span.sourceSpanId);
  if (new Set(ids).size !== ids.length) throw new Error('source_span_identity_duplicate');
  return registry.sort((left, right) => left.sourceSpanId.localeCompare(right.sourceSpanId));
}

export function resolveEvidenceClaimAuthority(input: {
  evidenceClaimId: string;
  authorityClass: RequirementsAuthorityClass;
  sourceSpanRefs?: string[];
  decisionReceiptRefs?: string[];
  premiseRefs?: string[];
  derivationReceiptRefs?: string[];
}) {
  if (input.authorityClass === 'source_grounded') {
    const issueCodes = input.sourceSpanRefs?.length ? [] : ['source_grounded_span_missing'];
    return { decision: issueCodes.length ? 'block' : 'pass', branch: 'source_span', issueCodes } as const;
  }
  if (input.sourceSpanRefs?.length) {
    return {
      decision: 'block',
      branch: input.authorityClass === 'human_confirmed' ? 'decision_receipt' : 'derivation_chain',
      issueCodes: ['non_source_claim_physical_span_forbidden'],
    } as const;
  }
  if (input.authorityClass === 'human_confirmed') {
    const issueCodes = input.decisionReceiptRefs?.length
      ? []
      : ['human_confirmed_decision_receipt_missing'];
    return { decision: issueCodes.length ? 'block' : 'pass', branch: 'decision_receipt', issueCodes } as const;
  }
  const issueCodes = input.premiseRefs?.length && input.derivationReceiptRefs?.length
    ? []
    : ['derived_premise_chain_missing'];
  return { decision: issueCodes.length ? 'block' : 'pass', branch: 'derivation_chain', issueCodes } as const;
}

export function specSpanRegistryHash(spans: RequirementsSpecSpan[]): string {
  return requirementsContractDomainHash('requirements-spec-span-registry/v1', spans);
}

export function sourceSpanRegistryHash(spans: RequirementsSourceSpan[]): string {
  return requirementsContractDomainHash('requirements-source-span-registry/v1', spans);
}

export function registriesCanonicallyEqual(left: unknown, right: unknown): boolean {
  return canonicalRequirementsJson(left) === canonicalRequirementsJson(right);
}
