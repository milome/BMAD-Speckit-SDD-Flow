import { createHash } from 'node:crypto';
import type { StandaloneGoalConstraintBinding, StandaloneGoalSemanticInput } from '../control-plane/standalone-goal-semantic-ir';

const modulePath = (relativePath: string): string =>
  `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
const { hashControlPlaneValue } = require(modulePath('../control-plane/canonical-hash'));
const { parseStandaloneSourcePlan } = require(modulePath('./parser'));
const { lintStandaloneSourcePlan } = require(modulePath('./standalone-source-plan'));

type JsonObject = Record<string, unknown>;

const SEMANTIC_KINDS = new Set(['REQ', 'NFR', 'NEG', 'OUT', 'TASK', 'AC']);
const CONSTRAINT_KINDS = new Set(['PATH', 'CMD', 'EVD', 'ART', 'STOP']);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const objects = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
const sha256 = (value: Buffer | string): string => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function snapshotBytes(snapshot: JsonObject): Buffer {
  if (typeof snapshot.frozenBytesBase64 !== 'string') throw new Error('source_snapshot_bytes_missing');
  const bytes = Buffer.from(snapshot.frozenBytesBase64, 'base64');
  if (sha256(bytes) !== snapshot.sourceSnapshotHash) throw new Error('source_snapshot_hash_mismatch');
  return bytes;
}

function firstFailure(result: JsonObject): never {
  const issue = objects(result.issues)[0] ?? { failureClass: 'source_plan_lint_failed' };
  throw Object.assign(new Error(text(issue.failureClass) || 'source_plan_lint_failed'), issue, {
    failureClass: text(issue.failureClass) || 'source_plan_lint_failed',
    sourcePlanLint: result,
  });
}

export function isCanonicalSourcePlanSnapshot(snapshot: JsonObject): boolean {
  const bytes = snapshotBytes(snapshot);
  const parsed = parseStandaloneSourcePlan({ rawBytes: bytes }) as JsonObject;
  return objects(parsed.fences).some((fence) => fence.fenceType === 'metadata') ||
    bytes.includes(Buffer.from('sourcePlanVersion: standalone-source-plan/', 'utf8'));
}

function executionRole(node: JsonObject): string {
  const strength = text(node.normativeStrength).toLowerCase();
  if (strength === 'should' || strength === 'may') return 'guidance';
  return ({ REQ: 'requirement', NFR: 'requirement', NEG: 'boundary', OUT: 'boundary', TASK: 'action', AC: 'acceptance' } as Record<string, string>)[text(node.kind)] ?? 'definition';
}

function canonicalPolarity(node: JsonObject): string {
  return node.polarity === 'excluded' ? 'forbidden' : text(node.polarity);
}

function classification(node: JsonObject): string {
  if (node.kind === 'OUT') return 'boundary';
  if (node.kind === 'NEG' || node.polarity === 'forbidden') return 'negative';
  if (node.kind === 'AC') return 'evidence';
  return 'positive';
}

function lineAt(snapshot: JsonObject, byteOffset: number, previous = false): number {
  const offset = previous && byteOffset > 0 ? byteOffset - 1 : byteOffset;
  const line = objects(snapshot.lineIndex).find((candidate, index, rows) =>
    offset >= Number(candidate.startByte) &&
    (offset < Number(candidate.endByteExclusive) || (index === rows.length - 1 && offset === Number(candidate.endByteExclusive)))
  );
  return Number(line?.lineNumber ?? 1);
}

function sourceDocumentGraph(snapshot: JsonObject, bytes: Buffer, fences: JsonObject[]): JsonObject {
  const ordered = [...fences].sort((left, right) => Number(left.startByte) - Number(right.startByte));
  const ranges: Array<{ start: number; end: number; fence?: JsonObject }> = [];
  let cursor = 0;
  for (const fence of ordered) {
    const start = Number(fence.startByte);
    const end = Number(fence.endByteExclusive);
    if (cursor < start) ranges.push({ start: cursor, end: start });
    ranges.push({ start, end, fence });
    cursor = end;
  }
  if (cursor < bytes.length) ranges.push({ start: cursor, end: bytes.length });
  const spans = ranges.map(({ start, end, fence }) => {
    const exact = bytes.subarray(start, end);
    const identity = sha256(`${snapshot.sourceSnapshotHash}:${start}:${end}`).slice(7, 23);
    return {
      id: `clause-${identity}`,
      sourceBlockId: fence ? text(fence.spanId) : `source-block-${identity}`,
      disposition: fence?.fenceType === 'metadata' ? 'metadata' : fence?.fenceType === 'node' ? 'semantic_declaration' : 'background',
      semanticRef: fence?.fenceType === 'node' ? text(object(fence.data).id) : null,
      startByte: start,
      endByteExclusive: end,
      lineStart: lineAt(snapshot, start),
      lineEnd: lineAt(snapshot, end, true),
      exactTextHash: sha256(exact),
    };
  });
  return {
    schemaVersion: 'SourceDocumentGraph/v1',
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    sourceBytes: bytes.length,
    coveredBytes: spans.reduce((sum, span) => sum + span.endByteExclusive - span.startByte, 0),
    spans,
    graphHash: hashControlPlaneValue(spans),
  };
}

function normativeClauses(node: JsonObject, spanRef: string): JsonObject[] {
  const attributes = object(node.attributes);
  const declaredClauses = objects(attributes.clauses);
  if (declaredClauses.length > 0) {
    return declaredClauses.map((clause, index) => ({
      ...structuredClone(clause),
      id: text(clause.clauseRef) || `clause-${text(node.id).toLowerCase()}-${String(index + 1).padStart(3, '0')}`,
      sourceRefs: unique([spanRef, ...strings(clause.sourceRefs)]),
    }));
  }
  const rows: Array<[string, unknown]> = [['statement', node.statement]];
  for (const field of ['condition', 'predicate', 'given', 'when', 'then', 'pass', 'fail', 'blocked', 'trigger', 'requiredState', 'passCriteria']) {
    if (attributes[field] !== undefined) rows.push([field, attributes[field]]);
  }
  for (const [index, step] of strings(attributes.steps).entries()) rows.push([`step_${index + 1}`, step]);
  return rows.filter(([, value]) => text(value)).map(([kind, value], index) => ({
    id: `clause-${text(node.id).toLowerCase()}-${String(index + 1).padStart(3, '0')}`,
    kind,
    text: text(value),
    sourceRefs: [spanRef],
  }));
}

function typedRefs(node: JsonObject, relations: JsonObject[]): JsonObject[] {
  return relations.filter((relation) => relation.fromRef === node.id).map((relation) => ({
    kind: text(relation.type),
    targetId: text(relation.toRef),
    relation: 'declared',
    sourceBlockRefs: strings(relation.sourceSpanRefs),
  }));
}

function expandCommandRefs(refs: string[], byId: Map<string, JsonObject>, relations: JsonObject[]): string[] {
  const resolved = new Set<string>();
  const visiting = new Set<string>();
  const visit = (ref: string): void => {
    if (visiting.has(ref)) throw new Error('canonical_source_command_set_cycle');
    const node = byId.get(ref);
    if (!node || node.kind !== 'CMD') throw new Error('canonical_source_command_missing');
    const declarationClass = text(object(node.attributes).commandDeclarationClass) || 'executable_expression';
    if (declarationClass === 'conditional_selector') return;
    if (declarationClass !== 'source_command_set') {
      resolved.add(ref);
      return;
    }
    visiting.add(ref);
    const members = relations.filter((relation) => relation.type === 'includes_command' && relation.fromRef === ref)
      .map((relation) => text(relation.toRef));
    if (members.length === 0) throw new Error('canonical_source_command_set_empty');
    for (const member of members) visit(member);
    visiting.delete(ref);
  };
  for (const ref of refs) visit(ref);
  return [...resolved].sort();
}

function commandDeclaration(node: JsonObject, fence: JsonObject, snapshot: JsonObject): JsonObject {
  const attributes = object(node.attributes);
  return {
    id: node.id,
    invocation: attributes.command,
    passCriteria: attributes.passCriteria,
    workingDirectory: attributes.workingDirectory,
    sourceRef: {
      sourceArtifactId: snapshot.sourceArtifactId,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
      startByte: fence.startByte,
      endByteExclusive: fence.endByteExclusive,
      lineStart: fence.lineStart,
      lineEnd: fence.lineEnd,
      exactTextHash: fence.exactTextHash,
    },
    executionStatus: 'source_declared_not_executed',
  };
}

export function extractCanonicalSourcePlanModel(input: { snapshot: JsonObject }) {
  const snapshot = input.snapshot;
  const bytes = snapshotBytes(snapshot);
  const sourcePath = text(snapshot.sourcePath) || text(snapshot.pathOrSegmentId);
  const lint = lintStandaloneSourcePlan({ sourcePath, rawBytes: bytes }) as JsonObject;
  if (!lint.ok || lint.detectedSourcePlanVersion !== 'standalone-source-plan/v1') firstFailure(lint);
  const parsed = parseStandaloneSourcePlan({ rawBytes: bytes }) as JsonObject;
  const graph = object(lint.canonicalGraph);
  const nodes = objects(graph.nodes);
  const relations = objects(graph.relations);
  const fences = objects(parsed.fences);
  const fenceBySpan = new Map(fences.map((fence) => [text(fence.spanId), fence]));
  const nodeById = new Map(nodes.map((node) => [text(node.id), node]));
  const commandById = new Map(nodes.filter((node) => node.kind === 'CMD').map((node) => [text(node.id), node]));
  const documentGraph = sourceDocumentGraph(snapshot, bytes, fences);
  const sourceObligations = nodes.filter((node) => SEMANTIC_KINDS.has(text(node.kind))).map((node) => {
    const spanRef = strings(node.sourceSpanRefs)[0];
    const fence = fenceBySpan.get(spanRef);
    if (!fence) throw new Error('canonical_source_span_missing');
    const references = object(node.references);
    const ownerRef = text(node.ownerRef);
    const relatedCommandRefs = expandCommandRefs(unique(strings(references.commandRefs)), nodeById, relations);
    const commandDeclarations = relatedCommandRefs.map((ref) => {
      const command = commandById.get(ref);
      const commandFence = command ? fenceBySpan.get(strings(command.sourceSpanRefs)[0]) : undefined;
      if (!command || !commandFence) throw new Error('canonical_source_command_missing');
      return commandDeclaration(command, commandFence, snapshot);
    });
    const applicableRefs = unique([
      ...strings(references.requirementRefs),
      ...(SEMANTIC_KINDS.has(text(nodeById.get(ownerRef)?.kind)) ? [ownerRef] : []),
    ]);
    const conditions = object(node.applicability).mode === 'conditional' ? [{
      kind: 'source_condition',
      text: text(object(node.applicability).condition),
      state: 'unevaluated',
      sourceRefs: [spanRef],
    }] : [];
    const applicability = applicableRefs.length > 0 ? {
      scope: 'obligations', sourceRefs: [spanRef], obligationRefs: applicableRefs,
    } : {
      scope: 'source_scope', sourceRefs: [spanRef],
      sourceScope: { kind: node.scope === 'global' ? 'canonical_global_node' : 'canonical_local_node', ownerId: node.id, ownerBlockRefs: [spanRef] },
    };
    const clauses = normativeClauses(node, spanRef);
    const role = executionRole(node);
    const attributes = object(node.attributes);
    const ownedPaths = Array.isArray(attributes.ownedProductionPaths)
      ? strings(attributes.ownedProductionPaths).join(', ')
      : text(attributes.ownedProductionPaths);
    return {
      id: node.id,
      declaredId: true,
      sourcePlanPath: sourcePath,
      kind: text(node.kind),
      exactText: text(node.statement),
      headingPath: [text(node.id), text(node.title)],
      startByte: fence.startByte,
      endByteExclusive: fence.endByteExclusive,
      lineStart: fence.lineStart,
      lineEnd: fence.lineEnd,
      dependencyRefs: [],
      classification: classification(node),
      normativeStrength: text(node.normativeStrength).toLowerCase(),
      polarity: canonicalPolarity(node),
      required: node.normativeStrength === 'MUST' && !['permitted', 'descriptive'].includes(text(node.polarity)),
      executionRole: role,
      conditions,
      applicability,
      applicabilityState: conditions.length > 0 ? 'conditional' : 'applicable',
      normativeClauses: clauses,
      provenanceRefs: [spanRef],
      sourceBlockRefs: [spanRef],
      clauseRefs: clauses.map((clause) => text(clause.id)),
      typedRefs: typedRefs(node, relations),
      taskRefs: unique([...strings(references.taskRefs), ...(text(node.kind) === 'AC' && text(nodeById.get(ownerRef)?.kind) === 'TASK' ? [ownerRef] : [])]),
      acceptanceRefs: strings(references.acceptanceRefs),
      commandRefs: relatedCommandRefs,
      evidenceRefs: strings(references.evidenceRefs),
      atomicGroupRefs: [],
      commandDeclarations,
      ...(role === 'action' ? {
        taskExecution: {
          executionClass: attributes.executionClass,
          ownedProductionPaths: ownedPaths,
          sourceRefs: [spanRef],
          ...(attributes.aggregateGatePhase ? { aggregateGatePhase: attributes.aggregateGatePhase } : {}),
          ...(strings(attributes.aggregateValidationCommands).length ? { aggregateValidationCommands: strings(attributes.aggregateValidationCommands) } : {}),
        },
      } : {}),
    };
  });
  const clauseSpans = objects(documentGraph.spans).map((span) => ({
    id: span.id,
    sourceBlockId: span.sourceBlockId,
    startByte: span.startByte,
    endByteExclusive: span.endByteExclusive,
    exactTextHash: span.exactTextHash,
  }));
  const sourceClauseCoverageSummary = {
    schemaVersion: 'goal-contract-source-clause-coverage/v1',
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    clauseCount: clauseSpans.length,
    clauseSetHash: hashControlPlaneValue(clauseSpans),
    clauseSpans,
  };
  return {
    sourcePlanPath: sourcePath,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourcePlanHash: snapshot.aggregateHash,
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceRole: snapshot.sourceRole,
    namespace: snapshot.namespace,
    sourceOrder: snapshot.sourceOrder,
    sourceBytes: snapshot.sourceBytes,
    sourceLines: snapshot.sourceLines,
    sourceObligations,
    semanticObligations: sourceObligations,
    sourceObligationGraph: graph,
    sourceObligationGraphHash: graph.graphHash,
    canonicalRequirementGraph: graph,
    sourceDocumentGraph: documentGraph,
    sourceBlocks: [],
    sourceRelations: relations,
    sourceCoverage: { coveredBytes: documentGraph.coveredBytes, uncoveredBytes: 0 },
    sourceClauseCoverage: objects(documentGraph.spans),
    sourceClauseCoverageSummary,
    diagnostics: {
      obligationCount: sourceObligations.length,
      semanticObligationCount: sourceObligations.length,
      sourceClauseCount: clauseSpans.length,
      semanticClauseCount: sourceObligations.reduce((count, row) => count + objects(row.normativeClauses).length, 0),
      excludedDeclarationCount: nodes.length - sourceObligations.length,
    },
  };
}

function ownerClosure(node: JsonObject, byId: Map<string, JsonObject>, semanticIds: Set<string>): string[] {
  const seen = new Set<string>();
  const queue = [text(node.ownerRef), ...strings(object(node.references).requirementRefs)];
  while (queue.length > 0) {
    const ref = queue.shift()!;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const owner = byId.get(ref);
    if (!owner) continue;
    queue.push(text(owner.ownerRef), ...strings(object(owner.references).requirementRefs));
  }
  return [...seen].filter((ref) => semanticIds.has(ref)).sort();
}

export function canonicalSourcePlanTechnicalSnapshot(source: JsonObject, semanticRows: JsonObject[]): StandaloneGoalSemanticInput['technicalSnapshot'] {
  const graph = object(source.canonicalRequirementGraph);
  const documentGraph = object(source.sourceDocumentGraph);
  const nodes = objects(graph.nodes);
  const byId = new Map(nodes.map((node) => [text(node.id), node]));
  const rowById = new Map(semanticRows.map((row) => [text(row.id), row]));
  const semanticIds = new Set(rowById.keys());
  const spanBySemanticRef = new Map(objects(documentGraph.spans).filter((span) => text(span.semanticRef)).map((span) => [text(span.semanticRef), span]));
  const constraints: StandaloneGoalConstraintBinding[] = [];
  const constrained = nodes.filter((node) => CONSTRAINT_KINDS.has(text(node.kind)) &&
    !(node.kind === 'CMD' && ['source_command_set', 'conditional_selector'].includes(text(object(node.attributes).commandDeclarationClass))));
  for (const node of constrained) {
    const owners = ownerClosure(node, byId, semanticIds);
    const global = node.scope === 'global';
    const mustRefs = unique(global
      ? [...owners, ...semanticRows.filter((row) => row.executionRole === 'action').map((row) => text(row.id))]
      : owners);
    if (mustRefs.length === 0) throw new Error('source_semantic_owner_missing');
    const atomRefs = mustRefs.filter((ref) => rowById.get(ref)?.executionRole === 'action').map((ref) => `${ref}-A1`);
    const ownerSourceRefs = unique(mustRefs.flatMap((ref) => strings(rowById.get(ref)?.specSpanRefs)));
    const declaration = spanBySemanticRef.get(text(node.id));
    if (!declaration || ownerSourceRefs.length === 0) throw new Error('canonical_source_constraint_span_missing');
    const sourceRefs = unique([...ownerSourceRefs, text(declaration.id)]);
    const kind = text(node.kind);
    const executableCommand = kind !== 'CMD' || !['prohibited', 'template'].includes(text(object(node.attributes).executionMode));
    const coverageRole = ['CMD', 'EVD'].includes(kind)
      ? atomRefs.length > 0 && executableCommand ? 'action_trace' as const : 'non_action_declaration' as const
      : undefined;
    constraints.push({
      constraintId: text(node.id),
      sourceRefs,
      premiseRefs: ownerSourceRefs,
      applicableMustRefs: mustRefs,
      applicableAtomRefs: atomRefs,
      scope: global ? 'global' : 'declared',
      sourceDeclarationRefs: [text(node.id), text(declaration.sourceBlockId)],
      declarationSource: {
        schemaVersion: 'standalone-source-declaration-set/v1',
        sourceSnapshotHash: source.sourceSnapshotHash,
        sourceBlockRefs: [text(declaration.sourceBlockId)],
        startByte: declaration.startByte,
        endByteExclusive: declaration.endByteExclusive,
      },
      ...(coverageRole ? {
        coverageRole,
        declarationRole: kind === 'CMD'
          ? global ? 'global_verification_command' : 'verification_command'
          : 'evidence_requirement',
      } : kind === 'STOP' ? { declarationRole: 'stop_condition' } : {}),
    });
  }
  const attributes = (node: JsonObject): JsonObject => object(node.attributes);
  const paths = constrained.filter((node) => node.kind === 'PATH');
  const commands = constrained.filter((node) => node.kind === 'CMD');
  const artifacts = constrained.filter((node) => node.kind === 'ART');
  const evidence = constrained.filter((node) => node.kind === 'EVD');
  const stops = constrained.filter((node) => node.kind === 'STOP');
  return {
    targetPaths: paths.map((node) => text(attributes(node).path)),
    pathRecords: paths.map((node) => ({ pathId: text(node.id), logicalPath: text(attributes(node).path) })),
    commandRecords: commands.map((node) => ({ commandId: text(node.id), invocation: text(attributes(node).command) })),
    artifactRecords: artifacts.map((node) => ({ artifactId: text(node.id), logicalPath: text(attributes(node).path) })),
    evidenceRecords: evidence.map((node) => ({ evidenceContractId: text(node.id), requirement: text(node.statement) })),
    stopRecords: stops.map((node) => ({ stopId: text(node.id), trigger: text(attributes(node).trigger) || text(node.statement) })),
    forbiddenPaths: [],
    isolationMode: 'consumer_worktree',
    constraintBindings: constraints,
  };
}

module.exports = {
  canonicalSourcePlanTechnicalSnapshot,
  extractCanonicalSourcePlanModel,
  isCanonicalSourcePlanSnapshot,
};
