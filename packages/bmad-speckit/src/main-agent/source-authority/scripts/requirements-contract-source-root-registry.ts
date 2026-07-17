import type { ProductionSemanticSourceRootCandidate } from './requirements-contract-production-semantic-pipeline';
import {
  parseRequirementsContractSourceText,
  type RequirementsContractSourceBlock,
  type RequirementsContractSourceDocument,
} from './requirements-contract-source-parser';
import {
  REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
  SOURCE_ROOT_CLASS_REGISTRY_HASH,
  SOURCE_ROOT_CLASS_REGISTRY_VERSION,
  type RequirementsContractSourceRootClassDefinition,
} from './requirements-contract-source-root-class-registry';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';

export {
  REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
  SOURCE_ROOT_CLASS_REGISTRY_HASH,
  SOURCE_ROOT_CLASS_REGISTRY_VERSION,
};

export interface RegisteredSourceRootInventoryResult {
  decision: 'pass' | 'block';
  expectedRootIds: string[];
  observedRootIds: string[];
  missingRootIds: string[];
  extraRootIds: string[];
  rootClassMismatchIds: string[];
  payloadMismatchIds: string[];
}

export interface RegisteredSourceRootLineageWitness {
  sourceRootId: string;
  sourcePath: string;
  sourceSpan: {
    startLine: number;
    endLine: number;
  };
  authorityClass: 'source_extracted' | 'unresolved_authority';
}

const REFERENCE_ID = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/gu;
const PROJECTION_EXCLUDED_MARKER = '<canonical-projection-excluded>';
export const CANONICAL_GENERATED_DEFINITION_OF_DONE_SECTION = [
  '## Definition of Done',
  '',
  '- The implementation readiness stage audit passes for the current source, implementationConfirmation, and confirmation page hashes.',
  '- The AI-TDD pre-implementation gate is ready before implementation dispatch, with every ACC/E2E row bound to expected-red proof or controlled red proof execution.',
  '- Every confirmed MUST/NEG trace row keeps requirement, evidence, command, acceptance, failure-path, edge-case, target-path, and artifact closure.',
  '- Delivery readiness, closeout readiness, merge readiness, or launch readiness remain false until current-attempt implementation evidence is recorded through controlled runtime fields.',
].join('\n');

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function normalizedColumnName(value: string): string {
  return normalized(value).toLowerCase();
}

function authoritySnapshotFromParsedSource(
  sourceText: string,
  document: RequirementsContractSourceDocument
): { sourceContent: string; sourceHash: string } {
  const lines = sourceText.replace(/\r\n?/gu, '\n').split('\n');
  const coordinateLines = [...lines];
  for (const block of [...document.yamlRootBlocks].sort(
    (left, right) => right.startLine - left.startLine
  )) {
    const lineCount = block.endLine - block.startLine + 1;
    lines.splice(block.startLine - 1, lineCount);
    coordinateLines.splice(
      block.startLine - 1,
      lineCount,
      `implementationConfirmation: ${PROJECTION_EXCLUDED_MARKER}`,
      ...Array.from({ length: Math.max(0, lineCount - 1) }, () => '')
    );
  }
  const authorityContent = lines
    .join('\n')
    .replace(CANONICAL_GENERATED_DEFINITION_OF_DONE_SECTION, '')
    .replace(/\s*$/u, '');
  const coordinateContent = coordinateLines.join('\n');
  const definitionOfDoneStart = coordinateContent.indexOf(
    CANONICAL_GENERATED_DEFINITION_OF_DONE_SECTION
  );
  if (definitionOfDoneStart >= 0) {
    const startLine = coordinateContent.slice(0, definitionOfDoneStart).split('\n').length - 1;
    const lineCount = CANONICAL_GENERATED_DEFINITION_OF_DONE_SECTION.split('\n').length;
    coordinateLines.splice(
      startLine,
      lineCount,
      ...Array.from({ length: lineCount }, () => '')
    );
  }
  const canonicalCoordinateContent = coordinateLines.join('\n').replace(/\s*$/u, '');
  const sourceContent =
    document.yamlRootBlocks.length > 0
      ? `${canonicalCoordinateContent}\n`
      : `${canonicalCoordinateContent}\n\nimplementationConfirmation: ${PROJECTION_EXCLUDED_MARKER}\n`;
  const authorityHashContent = `${authorityContent}\n\nimplementationConfirmation: ${PROJECTION_EXCLUDED_MARKER}\n`;
  return {
    sourceContent,
    sourceHash: sha256Text(authorityHashContent),
  };
}

export function createRegisteredSourceAuthoritySnapshot(input: {
  sourcePath: string;
  sourceText: string;
}): { sourceContent: string; sourceHash: string } {
  const parsed = parseRequirementsContractSourceText(input.sourceText, {
    sourcePath: input.sourcePath,
  });
  if (!parsed.ok) {
    throw new Error(
      `Registered Source Root authority snapshot failed: ${parsed.issues
        .map((issue) => `${issue.code}@${issue.startLine}-${issue.endLine}`)
        .join(', ')}`
    );
  }
  return authoritySnapshotFromParsedSource(input.sourceText, parsed.document);
}

function tableCell(block: RequirementsContractSourceBlock, aliases: readonly string[]): string {
  const cells = block.table?.cells ?? {};
  const valuesByColumn = new Map(
    Object.entries(cells).map(([key, value]) => [normalizedColumnName(key), normalized(value)])
  );
  for (const alias of aliases) {
    const value = valuesByColumn.get(normalizedColumnName(alias));
    if (value) return value;
  }
  return '';
}

function sourceIdentifier(block: RequirementsContractSourceBlock): string {
  return tableCell(block, ['ID', 'Requirement ID', 'Req ID']).toUpperCase();
}

function sourceSection(block: RequirementsContractSourceBlock): string {
  return normalized(block.headingPath[block.headingPath.length - 1]);
}

function rootIdentifier(
  definition: RequirementsContractSourceRootClassDefinition,
  sourceId: string
): string {
  const prefix = `${definition.sourceIdPrefix}-`;
  if (!sourceId.startsWith(prefix)) {
    throw new Error(`Source Root ID ${sourceId} does not match ${definition.sourceIdPrefix}`);
  }
  return `${definition.rootIdPrefix}-${sourceId.slice(prefix.length)}`;
}

function canonicalRequirementRef(value: string): string {
  if (/^FR-\d{3}$/u.test(value)) return `MUST-${value}`;
  if (/^NFR-\d{3}$/u.test(value)) return `MUST-${value}`;
  return value;
}

function sourceReferences(
  block: RequirementsContractSourceBlock,
  definition: RequirementsContractSourceRootClassDefinition
): string[] {
  return [
    ...new Set(
      definition.relatedRefColumns
        .flatMap((mapping) => tableCell(block, mapping.sourceColumns).match(REFERENCE_ID) ?? [])
        .map((value) => canonicalRequirementRef(value.toUpperCase()))
    ),
  ].sort();
}

function bodyFields(
  block: RequirementsContractSourceBlock,
  definition: RequirementsContractSourceRootClassDefinition
): Record<string, string> | null {
  const fields: Record<string, string> = {};
  for (const mapping of definition.fields) {
    const value = tableCell(block, mapping.sourceColumns);
    if (mapping.required && !value) return null;
    if (value) fields[mapping.bodyField] = value;
  }
  return fields;
}

function requirementBody(input: {
  definition: RequirementsContractSourceRootClassDefinition;
  sourceId: string;
  rootId: string;
  sourcePath: string;
  sourceHash: string;
  block: RequirementsContractSourceBlock;
  fields: Record<string, string>;
  references: string[];
}): Record<string, unknown> {
  return createDirectV2RequirementSemanticBody({
    id: input.rootId,
    kind: input.definition.requirementKind,
    text:
      input.fields.text ??
      input.fields.negativeAssertion ??
      input.fields.boundaryAssertion ??
      Object.values(input.fields)[0],
    sourcePath: input.sourcePath,
    sourceHash: input.sourceHash,
    sourceSpan: {
      startLine: input.block.startLine,
      endLine: input.block.endLine,
    },
    sourceRequirementId: input.sourceId,
    headingPath: input.block.headingPath,
    sourceFields: input.fields,
    references: input.references,
  });
}

export function createDirectV2RequirementSemanticBody(input: {
  id: string;
  kind: RequirementsContractSourceRootClassDefinition['requirementKind'];
  text: string;
  sourcePath: string;
  sourceHash: string;
  sourceSpan: {
    startLine: number;
    endLine: number;
  };
  sourceRequirementId: string;
  headingPath?: readonly string[];
  sourceFields?: Readonly<Record<string, string>>;
  references?: readonly string[];
}): Record<string, unknown> {
  if (!input.kind) {
    throw new Error(`Direct V2 requirement ${input.id} requires a requirement kind`);
  }
  const fields: Record<string, string> = {
    text: input.text,
    ...(input.sourceFields ?? {}),
  };
  const references = [...new Set(input.references ?? [])].sort();
  const text =
    fields.text ??
    fields.negativeAssertion ??
    fields.boundaryAssertion ??
    Object.values(fields)[0];
  const commandRefs = references.filter((ref) => /^(?:CMD|E2E)-/u.test(ref));
  const expectedObservationRefs = references.filter((ref) =>
    /^(?:ACC|E2E)-/u.test(ref)
  );
  return {
    id: input.id,
    kind: input.kind,
    schemaVersion: 'requirement-contract-requirement/v2',
    text,
    source: {
      sourcePath: input.sourcePath,
      sourceSpan: input.sourceSpan,
      sourceHash: input.sourceHash,
      sourceRequirementId: input.sourceRequirementId,
      headingPath: [...(input.headingPath ?? [])],
    },
    semantics: {
      actor: fields.actor ?? null,
      trigger: fields.trigger ?? null,
      preconditions: [],
      action: text,
      postconditions: fields.blockingCondition ? [fields.blockingCondition] : [],
      invariants: [
        ...(fields.negativeAssertion ? [fields.negativeAssertion] : []),
        ...(fields.boundaryAssertion ? [fields.boundaryAssertion] : []),
      ],
      thresholds: fields.measurement ? [fields.measurement] : [],
    },
    authority: {
      authorityState: 'source_grounded',
      derivation: 'copied_from_source',
      decisionReceiptRef: null,
    },
    applicability: {
      state: 'applicable',
      reasonCode: 'source_declared',
    },
    unresolved: [],
    verification: {
      method: fields.oracle ? 'source_declared_oracle' : 'source_declared',
      oracleRef: fields.oracle ?? null,
      commandRefs,
      expectedObservationRefs,
    },
    bindings: {
      targetRefs: references.filter((ref) => /^PATH-/u.test(ref)),
      artifactRefs: [],
      traceEdgeRefs: references.filter((ref) => /^TRACE-/u.test(ref)),
    },
  };
}

function genericBody(input: {
  definition: RequirementsContractSourceRootClassDefinition;
  sourceId: string;
  rootId: string;
  sourcePath: string;
  sourceHash: string;
  block: RequirementsContractSourceBlock;
  fields: Record<string, string>;
}): Record<string, unknown> {
  return {
    id: input.rootId,
    schemaVersion: input.definition.bodySchemaVersion,
    sourceRequirementId: input.sourceId,
    ...input.fields,
    source: {
      sourcePath: input.sourcePath,
      sourceSpan: {
        startLine: input.block.startLine,
        endLine: input.block.endLine,
      },
      sourceHash: input.sourceHash,
      headingPath: input.block.headingPath,
    },
  };
}

function candidateForDefinition(input: {
  definition: RequirementsContractSourceRootClassDefinition;
  block: RequirementsContractSourceBlock;
  sourceId: string;
  sourcePath: string;
  sourceHash: string;
  sourceText: string;
}): ProductionSemanticSourceRootCandidate | null {
  const fields = bodyFields(input.block, input.definition);
  if (!fields) return null;
  const sourceRootId = rootIdentifier(input.definition, input.sourceId);
  const relatedRequirementRefs = sourceReferences(input.block, input.definition);
  const semanticBody =
    input.definition.projectionKind === 'requirement_v2'
      ? requirementBody({
          definition: input.definition,
          sourceId: input.sourceId,
          rootId: sourceRootId,
          sourcePath: input.sourcePath,
          sourceHash: input.sourceHash,
          block: input.block,
          fields,
          references: relatedRequirementRefs,
        })
      : genericBody({
          definition: input.definition,
          sourceId: input.sourceId,
          rootId: sourceRootId,
          sourcePath: input.sourcePath,
          sourceHash: input.sourceHash,
          block: input.block,
          fields,
        });
  return {
    sourceRootId,
    rootClass: input.definition.rootClass,
    nodeType: input.definition.nodeType,
    bodySchemaVersion: input.definition.bodySchemaVersion,
    semanticBody,
    sourcePath: input.sourcePath,
    sourceContent: input.sourceText,
    sourceSpan: {
      startLine: input.block.startLine,
      endLine: input.block.endLine,
    },
    proposedAuthorityClass:
      input.definition.rootClass === 'unresolved_decision'
        ? 'unresolved_authority'
        : 'source_extracted',
    ...(relatedRequirementRefs.length > 0 ? { relatedRequirementRefs } : {}),
  };
}

export function extractRegisteredSourceRootCandidates(input: {
  sourcePath: string;
  sourceText: string;
}): ProductionSemanticSourceRootCandidate[] {
  const parsed = parseRequirementsContractSourceText(input.sourceText, {
    sourcePath: input.sourcePath,
  });
  if (!parsed.ok) {
    throw new Error(
      `Registered Source Root extraction failed: ${parsed.issues
        .map((issue) => `${issue.code}@${issue.startLine}-${issue.endLine}`)
        .join(', ')}`
    );
  }
  const authoritySnapshot = authoritySnapshotFromParsedSource(
    input.sourceText,
    parsed.document
  );
  const candidates: ProductionSemanticSourceRootCandidate[] = [];
  for (const block of parsed.document.blocks) {
    if (block.kind !== 'table_row') continue;
    const id = sourceIdentifier(block);
    const section = sourceSection(block);
    for (const definition of REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY) {
      if (
        definition.sourceSection !== section ||
        !id.startsWith(`${definition.sourceIdPrefix}-`)
      ) {
        continue;
      }
      const candidate = candidateForDefinition({
        definition,
        block,
        sourceId: id,
        sourcePath: input.sourcePath,
        sourceHash: authoritySnapshot.sourceHash,
        sourceText: authoritySnapshot.sourceContent,
      });
      if (candidate) candidates.push(candidate);
    }
  }
  const duplicateIds = candidates
    .map((candidate) => candidate.sourceRootId)
    .filter((id, index, values) => values.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(`Registered Source Root IDs must be unique: ${[...new Set(duplicateIds)]}`);
  }
  return candidates.sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId));
}

export function extractRegisteredSourceRootLineageWitnesses(input: {
  sourcePath: string;
  sourceText: string;
}): RegisteredSourceRootLineageWitness[] {
  const parsed = parseRequirementsContractSourceText(input.sourceText, {
    sourcePath: input.sourcePath,
  });
  if (!parsed.ok) {
    throw new Error(
      `Registered Source Root lineage witness extraction failed: ${parsed.issues
        .map((issue) => `${issue.code}@${issue.startLine}-${issue.endLine}`)
        .join(', ')}`
    );
  }
  const witnesses: RegisteredSourceRootLineageWitness[] = [];
  for (const block of parsed.document.blocks) {
    if (block.kind !== 'table_row') continue;
    const id = sourceIdentifier(block);
    const section = sourceSection(block);
    for (const definition of REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY) {
      if (
        definition.sourceSection !== section ||
        !id.startsWith(`${definition.sourceIdPrefix}-`) ||
        !bodyFields(block, definition)
      ) {
        continue;
      }
      witnesses.push({
        sourceRootId: rootIdentifier(definition, id),
        sourcePath: input.sourcePath,
        sourceSpan: {
          startLine: block.startLine,
          endLine: block.endLine,
        },
        authorityClass:
          definition.rootClass === 'unresolved_decision'
            ? 'unresolved_authority'
            : 'source_extracted',
      });
    }
  }
  const duplicateIds = witnesses
    .map((witness) => witness.sourceRootId)
    .filter((id, index, values) => values.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Registered Source Root lineage witness IDs must be unique: ${[...new Set(duplicateIds)]}`
    );
  }
  return witnesses.sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId));
}

export function validateRegisteredSourceRootInventory(input: {
  sourcePath: string;
  sourceText: string;
  sourceRoots: ProductionSemanticSourceRootCandidate[];
}): RegisteredSourceRootInventoryResult {
  const expected = extractRegisteredSourceRootCandidates({
    sourcePath: input.sourcePath,
    sourceText: input.sourceText,
  });
  const expectedById = new Map(expected.map((root) => [root.sourceRootId, root]));
  const observedById = new Map(input.sourceRoots.map((root) => [root.sourceRootId, root]));
  const missingRootIds = [...expectedById.keys()]
    .filter((id) => !observedById.has(id))
    .sort();
  const extraRootIds = [...observedById.keys()]
    .filter((id) => !expectedById.has(id))
    .sort();
  const rootClassMismatchIds = [...expectedById.entries()]
    .filter(([id, expectedRoot]) => observedById.get(id)?.rootClass !== expectedRoot.rootClass)
    .map(([id]) => id)
    .sort();
  const payloadMismatchIds = [...expectedById.entries()]
    .filter(([id, expectedRoot]) => {
      const observed = observedById.get(id);
      return observed && sha256Stable(observed.semanticBody) !== sha256Stable(expectedRoot.semanticBody);
    })
    .map(([id]) => id)
    .sort();
  const decision =
    missingRootIds.length === 0 &&
    extraRootIds.length === 0 &&
    rootClassMismatchIds.length === 0 &&
    payloadMismatchIds.length === 0
      ? 'pass'
      : 'block';
  return {
    decision,
    expectedRootIds: [...expectedById.keys()].sort(),
    observedRootIds: [...observedById.keys()].sort(),
    missingRootIds,
    extraRootIds,
    rootClassMismatchIds,
    payloadMismatchIds,
  };
}
