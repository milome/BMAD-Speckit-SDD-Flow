import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { sha256Stable } from './requirements-contract-semantic-resolver';

interface CompactTraceMatrix {
  acceptanceRootIds: string[];
  acceptanceRootCount: number;
  acceptanceRootBindings: Array<{
    acceptanceRootRef: string;
    decision: string;
    traceRefs?: string[];
    proofRefs: string[];
  }>;
  atomicRows: Array<{
    traceId: string;
    edgeId: string;
    edgeType: string;
    requirementRef: string;
    factRefs: string[];
    mustRefs: string[];
    atomRefs: string[];
    originSpecSpanRefs: string[];
    evidenceClaimRefs: string[];
    fromRef: { id: string };
    toRef: { id: string };
    bundleBinding: unknown;
    acceptanceManifestBinding: unknown;
    acceptanceRootProofManifestBinding: unknown;
    dimensions: {
      acceptance: { state: string; refs?: string[]; reasonCode?: string };
      evidenceRequirement: { state: string; refs?: string[]; reasonCode?: string };
    };
  }>;
  fullPathRows: Array<{
    pathTraceId: string;
    criticalPathRef: string;
    orderedAtomicTraceIds: string[];
    orderedEdgeIds: string[];
  }>;
  bundleBinding: unknown;
  acceptanceManifestBinding: unknown;
  acceptanceRootProofManifestBinding: unknown;
  projectionHash: string;
  [key: string]: unknown;
}

function validateMatrix(value: unknown): value is CompactTraceMatrix {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-compact-trace-matrix.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value) as boolean;
}

function cell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}

function duplicateCount(values: string[]): number {
  return values.length - new Set(values).size;
}

function sameBinding(left: unknown, right: unknown): boolean {
  return sha256Stable(left) === sha256Stable(right);
}

export function renderRequirementsContractCompactTraceMatrixProjection(input: unknown) {
  if (!validateMatrix(input)) throw new Error('Compact Trace Matrix schema validation failed');
  const traceRowsById = new Map(input.atomicRows.map((row) => [row.traceId, row]));
  const traceIds = new Set(traceRowsById.keys());
  const edgeIds = new Set(input.atomicRows.map((row) => row.edgeId));
  const acceptanceRootIds = new Set(input.acceptanceRootIds);
  const acceptanceRootBindingRefs = input.acceptanceRootBindings.map(
    (binding) => binding.acceptanceRootRef
  );
  const missingAcceptanceRootCount = input.acceptanceRootIds.filter(
    (rootId) =>
      !input.acceptanceRootBindings.some((binding) => binding.acceptanceRootRef === rootId)
  ).length;
  const extraAcceptanceRootCount = acceptanceRootBindingRefs.filter(
    (rootRef) => !acceptanceRootIds.has(rootRef)
  ).length;
  const duplicateAcceptanceRootBindingCount = duplicateCount(acceptanceRootBindingRefs);
  const danglingAcceptanceTraceRefCount = input.acceptanceRootBindings
    .flatMap((binding) => binding.traceRefs ?? [])
    .filter((traceRef) => !traceIds.has(traceRef)).length;
  const danglingPathTraceRefCount = input.fullPathRows
    .flatMap((row) => row.orderedAtomicTraceIds)
    .filter((traceRef) => !traceIds.has(traceRef)).length;
  const danglingPathEdgeRefCount = input.fullPathRows
    .flatMap((row) => row.orderedEdgeIds)
    .filter((edgeRef) => !edgeIds.has(edgeRef)).length;
  const pathTraceEdgeMismatchCount = input.fullPathRows.reduce((count, pathRow) => {
    const pairCount = Math.min(pathRow.orderedAtomicTraceIds.length, pathRow.orderedEdgeIds.length);
    let rowMismatchCount = Math.abs(
      pathRow.orderedAtomicTraceIds.length - pathRow.orderedEdgeIds.length
    );
    for (let index = 0; index < pairCount; index += 1) {
      const atomicRow = traceRowsById.get(pathRow.orderedAtomicTraceIds[index]);
      if (atomicRow && atomicRow.edgeId !== pathRow.orderedEdgeIds[index]) {
        rowMismatchCount += 1;
      }
    }
    return count + rowMismatchCount;
  }, 0);
  const duplicateAtomicTraceIdCount = duplicateCount(input.atomicRows.map((row) => row.traceId));
  const duplicateAtomicEdgeIdCount = duplicateCount(input.atomicRows.map((row) => row.edgeId));
  const acceptanceRootDriftCount =
    input.acceptanceRootCount === input.acceptanceRootIds.length ? 0 : 1;
  const artifactBindingMismatchCount = input.atomicRows.filter(
    (row) =>
      !sameBinding(row.bundleBinding, input.bundleBinding) ||
      !sameBinding(row.acceptanceManifestBinding, input.acceptanceManifestBinding) ||
      !sameBinding(row.acceptanceRootProofManifestBinding, input.acceptanceRootProofManifestBinding)
  ).length;
  const acceptanceRootRows = input.acceptanceRootBindings.map(
    (binding) =>
      `| ${cell(binding.acceptanceRootRef)} | ${cell(binding.decision)} | ${cell((binding.traceRefs ?? []).join(', '))} | ${cell(binding.proofRefs.join(', '))} |`
  );
  const atomicRows = input.atomicRows.map((row) => {
    const acceptance =
      row.dimensions.acceptance.state === 'bound'
        ? (row.dimensions.acceptance.refs ?? []).join(', ')
        : `not_applicable:${row.dimensions.acceptance.reasonCode ?? 'unspecified'}`;
    const evidenceRequirement =
      row.dimensions.evidenceRequirement.state === 'bound'
        ? (row.dimensions.evidenceRequirement.refs ?? []).join(', ')
        : `not_applicable:${row.dimensions.evidenceRequirement.reasonCode ?? 'unspecified'}`;
    return `| ${cell(row.traceId)} | ${cell(row.edgeId)} | ${cell(row.edgeType)} | ${cell(row.requirementRef)} | ${cell(row.factRefs.join(', '))} | ${cell(row.mustRefs.join(', '))} | ${cell(row.atomRefs.join(', '))} | ${cell(row.originSpecSpanRefs.join(', '))} | ${cell(row.evidenceClaimRefs.join(', '))} | ${cell(row.fromRef.id)} | ${cell(row.toRef.id)} | ${cell(acceptance)} | ${cell(evidenceRequirement)} |`;
  });
  const fullPathRows = input.fullPathRows.map(
    (row) =>
      `| ${cell(row.pathTraceId)} | ${cell(row.criticalPathRef)} | ${cell(row.orderedAtomicTraceIds.join(' -> '))} | ${cell(row.orderedEdgeIds.join(' -> '))} |`
  );
  const markdown = [
    '## Acceptance Roots',
    '',
    '| Acceptance root | Decision | Atomic traces | Proofs |',
    '|---|---|---|---|',
    ...acceptanceRootRows,
    '',
    '## Atomic Trace Rows',
    '',
    '| Trace | Edge | Type | Requirement | Facts | MUSTs | Atoms | Origin spec spans | Evidence claims | From | To | Acceptance | Evidence requirements |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...atomicRows,
    '',
    '## Full Path Rows',
    '',
    '| Path trace | Critical path | Atomic traces | Edges |',
    '|---|---|---|---|',
    ...fullPathRows,
    '',
  ].join('\n');
  const decision =
    acceptanceRootDriftCount === 0 &&
    missingAcceptanceRootCount === 0 &&
    extraAcceptanceRootCount === 0 &&
    duplicateAcceptanceRootBindingCount === 0 &&
    danglingAcceptanceTraceRefCount === 0 &&
    danglingPathTraceRefCount === 0 &&
    danglingPathEdgeRefCount === 0 &&
    pathTraceEdgeMismatchCount === 0 &&
    duplicateAtomicTraceIdCount === 0 &&
    duplicateAtomicEdgeIdCount === 0 &&
    artifactBindingMismatchCount === 0
      ? ('pass' as const)
      : ('block' as const);
  return {
    schemaVersion: 'requirements-contract-compact-trace-matrix-projection/v1',
    jsonProjection: structuredClone(input),
    markdown,
    projectionHash: input.projectionHash,
    atomicTraceRowCount: input.atomicRows.length,
    fullPathRowCount: input.fullPathRows.length,
    acceptanceRootCount: input.acceptanceRootCount,
    missingAcceptanceRootCount,
    extraAcceptanceRootCount,
    duplicateAcceptanceRootBindingCount,
    acceptanceRootDriftCount,
    danglingAcceptanceTraceRefCount,
    danglingPathTraceRefCount,
    danglingPathEdgeRefCount,
    pathTraceEdgeMismatchCount,
    duplicateAtomicTraceIdCount,
    duplicateAtomicEdgeIdCount,
    artifactBindingMismatchCount,
    decision,
  };
}
