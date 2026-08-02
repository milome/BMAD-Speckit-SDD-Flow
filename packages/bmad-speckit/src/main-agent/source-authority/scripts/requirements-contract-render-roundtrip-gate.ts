import type {
  ProductionSemanticPipelineResult,
  ProductionSemanticSourceRoot,
} from './requirements-contract-production-semantic-pipeline';
import { SOURCE_ROOT_CLASS_REGISTRY_HASH } from './requirements-contract-source-root-class-registry';
import { sha256Stable } from './requirements-contract-semantic-resolver';

interface RoundTripRootProjection {
  rootClass: string;
  nodeType: string;
  bodySchemaVersion: string;
  payloadHash: string;
  authorityClass: string;
  applicabilityHash: string;
}

export interface RequirementsContractRenderRoundTripReport {
  schemaVersion: 'requirements-contract-render-roundtrip-report/v1';
  decision: 'pass' | 'block';
  sourceReadbackHash: string;
  sourceRootClassRegistryHash: string;
  baselineSemanticModelHash: string;
  roundTripSemanticModelHash: string;
  baselineSemanticConservationManifestHash: string;
  roundTripSemanticConservationManifestHash: string;
  baselineDecisionReceiptSetHash: string;
  roundTripDecisionReceiptSetHash: string;
  baselineSourceRootSetHash: string;
  roundTripSourceRootSetHash: string;
  missingRootIds: string[];
  extraRootIds: string[];
  payloadMismatchIds: string[];
  authorityMismatchIds: string[];
  applicabilityMismatchIds: string[];
  missingRootCount: number;
  extraRootCount: number;
  payloadMismatchCount: number;
  authorityMismatchCount: number;
  applicabilityMismatchCount: number;
  decisionReceiptSetMismatchCount: number;
  semanticModelHashMismatchCount: number;
  reportHash: string;
}

function rootProjection(
  result: ProductionSemanticPipelineResult,
  root: ProductionSemanticSourceRoot
): RoundTripRootProjection {
  const node = result.semanticIr.nodes[root.sourceRootId];
  if (!node) {
    throw new Error(`Render round-trip Semantic IR is missing ${root.sourceRootId}`);
  }
  return {
    rootClass: root.rootClass,
    nodeType: root.nodeType,
    bodySchemaVersion: root.bodySchemaVersion,
    payloadHash: sha256Stable(root.semanticBody),
    authorityClass: root.authorityClass,
    applicabilityHash: sha256Stable(node.applicability),
  };
}

function rootInventory(
  result: ProductionSemanticPipelineResult
): Map<string, RoundTripRootProjection> {
  return new Map(
    result.sourceRoots.map((root) => [
      root.sourceRootId,
      rootProjection(result, root),
    ])
  );
}

function rootSetHash(inventory: Map<string, RoundTripRootProjection>): string {
  return sha256Stable(
    [...inventory.entries()]
      .map(([sourceRootId, projection]) => ({ sourceRootId, ...projection }))
      .sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId))
  );
}

export function evaluateRequirementsContractRenderRoundTrip(input: {
  sourceReadbackHash: string;
  baseline: ProductionSemanticPipelineResult;
  roundTrip: ProductionSemanticPipelineResult;
}): RequirementsContractRenderRoundTripReport {
  const baselineRoots = rootInventory(input.baseline);
  const roundTripRoots = rootInventory(input.roundTrip);
  const missingRootIds = [...baselineRoots.keys()]
    .filter((id) => !roundTripRoots.has(id))
    .sort();
  const extraRootIds = [...roundTripRoots.keys()]
    .filter((id) => !baselineRoots.has(id))
    .sort();
  const sharedRootIds = [...baselineRoots.keys()]
    .filter((id) => roundTripRoots.has(id))
    .sort();
  const payloadMismatchIds = sharedRootIds.filter(
    (id) => baselineRoots.get(id)?.payloadHash !== roundTripRoots.get(id)?.payloadHash
  );
  const authorityMismatchIds = sharedRootIds.filter(
    (id) => baselineRoots.get(id)?.authorityClass !== roundTripRoots.get(id)?.authorityClass
  );
  const applicabilityMismatchIds = sharedRootIds.filter(
    (id) =>
      baselineRoots.get(id)?.applicabilityHash !== roundTripRoots.get(id)?.applicabilityHash
  );
  const decisionReceiptSetMismatchCount =
    input.baseline.semanticConservationManifest.decisionReceiptSetHash ===
    input.roundTrip.semanticConservationManifest.decisionReceiptSetHash
      ? 0
      : 1;
  const semanticModelHashMismatchCount =
    input.baseline.semanticIr.semanticModelHash === input.roundTrip.semanticIr.semanticModelHash
      ? 0
      : 1;
  const mismatchCount =
    missingRootIds.length +
    extraRootIds.length +
    payloadMismatchIds.length +
    authorityMismatchIds.length +
    applicabilityMismatchIds.length +
    decisionReceiptSetMismatchCount +
    semanticModelHashMismatchCount;
  const preimage = {
    schemaVersion: 'requirements-contract-render-roundtrip-report/v1' as const,
    decision: mismatchCount === 0 ? ('pass' as const) : ('block' as const),
    sourceReadbackHash: input.sourceReadbackHash,
    sourceRootClassRegistryHash: SOURCE_ROOT_CLASS_REGISTRY_HASH,
    baselineSemanticModelHash: input.baseline.semanticIr.semanticModelHash,
    roundTripSemanticModelHash: input.roundTrip.semanticIr.semanticModelHash,
    baselineSemanticConservationManifestHash:
      input.baseline.semanticConservationManifest.manifestHash,
    roundTripSemanticConservationManifestHash:
      input.roundTrip.semanticConservationManifest.manifestHash,
    baselineDecisionReceiptSetHash:
      input.baseline.semanticConservationManifest.decisionReceiptSetHash,
    roundTripDecisionReceiptSetHash:
      input.roundTrip.semanticConservationManifest.decisionReceiptSetHash,
    baselineSourceRootSetHash: rootSetHash(baselineRoots),
    roundTripSourceRootSetHash: rootSetHash(roundTripRoots),
    missingRootIds,
    extraRootIds,
    payloadMismatchIds,
    authorityMismatchIds,
    applicabilityMismatchIds,
    missingRootCount: missingRootIds.length,
    extraRootCount: extraRootIds.length,
    payloadMismatchCount: payloadMismatchIds.length,
    authorityMismatchCount: authorityMismatchIds.length,
    applicabilityMismatchCount: applicabilityMismatchIds.length,
    decisionReceiptSetMismatchCount,
    semanticModelHashMismatchCount,
  };
  return {
    ...preimage,
    reportHash: sha256Stable(preimage),
  };
}

export function validateRequirementsContractRenderRoundTripReport(
  value: unknown
): value is RequirementsContractRenderRoundTripReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const report = value as RequirementsContractRenderRoundTripReport;
  const expectedKeys = [
    'applicabilityMismatchCount',
    'applicabilityMismatchIds',
    'authorityMismatchCount',
    'authorityMismatchIds',
    'baselineDecisionReceiptSetHash',
    'baselineSemanticConservationManifestHash',
    'baselineSemanticModelHash',
    'baselineSourceRootSetHash',
    'decision',
    'decisionReceiptSetMismatchCount',
    'extraRootCount',
    'extraRootIds',
    'missingRootCount',
    'missingRootIds',
    'payloadMismatchCount',
    'payloadMismatchIds',
    'reportHash',
    'roundTripDecisionReceiptSetHash',
    'roundTripSemanticConservationManifestHash',
    'roundTripSemanticModelHash',
    'roundTripSourceRootSetHash',
    'schemaVersion',
    'semanticModelHashMismatchCount',
    'sourceReadbackHash',
    'sourceRootClassRegistryHash',
  ].sort();
  if (Object.keys(report).sort().join('\n') !== expectedKeys.join('\n')) return false;
  const hashes = [
    report.sourceReadbackHash,
    report.sourceRootClassRegistryHash,
    report.baselineSemanticModelHash,
    report.roundTripSemanticModelHash,
    report.baselineSemanticConservationManifestHash,
    report.roundTripSemanticConservationManifestHash,
    report.baselineDecisionReceiptSetHash,
    report.roundTripDecisionReceiptSetHash,
    report.baselineSourceRootSetHash,
    report.roundTripSourceRootSetHash,
    report.reportHash,
  ];
  if (hashes.some((hash) => !/^sha256:[a-f0-9]{64}$/u.test(hash))) return false;
  const mismatchArrays = [
    [report.missingRootIds, report.missingRootCount],
    [report.extraRootIds, report.extraRootCount],
    [report.payloadMismatchIds, report.payloadMismatchCount],
    [report.authorityMismatchIds, report.authorityMismatchCount],
    [report.applicabilityMismatchIds, report.applicabilityMismatchCount],
  ] as const;
  if (
    mismatchArrays.some(
      ([ids, count]) =>
        !Array.isArray(ids) ||
        ids.some((id) => typeof id !== 'string' || id.length === 0) ||
        new Set(ids).size !== ids.length ||
        !Number.isInteger(count) ||
        count !== ids.length
    )
  ) {
    return false;
  }
  if (
    ![0, 1].includes(report.decisionReceiptSetMismatchCount) ||
    ![0, 1].includes(report.semanticModelHashMismatchCount)
  ) {
    return false;
  }
  const rootMismatchCount =
    report.missingRootCount +
    report.extraRootCount +
    report.payloadMismatchCount +
    report.authorityMismatchCount +
    report.applicabilityMismatchCount;
  if (
    (report.baselineSourceRootSetHash === report.roundTripSourceRootSetHash) !==
    (rootMismatchCount === 0)
  ) {
    return false;
  }
  if (
    (report.baselineDecisionReceiptSetHash === report.roundTripDecisionReceiptSetHash) !==
    (report.decisionReceiptSetMismatchCount === 0)
  ) {
    return false;
  }
  if (
    (report.baselineSemanticModelHash === report.roundTripSemanticModelHash) !==
    (report.semanticModelHashMismatchCount === 0)
  ) {
    return false;
  }
  const totalMismatchCount =
    rootMismatchCount +
    report.decisionReceiptSetMismatchCount +
    report.semanticModelHashMismatchCount;
  if (
    totalMismatchCount === 0 &&
    report.baselineSemanticConservationManifestHash !==
      report.roundTripSemanticConservationManifestHash
  ) {
    return false;
  }
  const { reportHash, ...preimage } = report;
  return (
    report.schemaVersion === 'requirements-contract-render-roundtrip-report/v1' &&
    report.sourceRootClassRegistryHash === SOURCE_ROOT_CLASS_REGISTRY_HASH &&
    reportHash === sha256Stable(preimage) &&
    report.decision === (totalMismatchCount === 0 ? 'pass' : 'block')
  );
}
