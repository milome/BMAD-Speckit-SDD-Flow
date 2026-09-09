import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sha256Stable,
  sha256Text,
  stableStringify,
} from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { probeGoalContractRenderability } from './goal-contract-renderability-probe';
import { validateGoalContractSchema } from './schema-registry';
import { compileStandaloneGoalExecution } from './standalone-goal-semantic-ir';
import { standaloneTechnicalSnapshot } from './standalone-goal-technical-snapshot';
import { canonicalSourcePlanTechnicalSnapshot } from '../source-plan/canonical-source-adapter';
import { normalizeGoalExecutionAuthority } from './goal-execution-authority';
import { renderNormativeDetails } from './goal-normative-renderer';
import {
  normalizeCanonicalRequirementGraph,
  type CanonicalRequirementGraphV2,
} from './canonical-requirement-graph';

type JsonObject = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function publishImmutable(targetPath: string, bytes: Buffer): boolean {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(targetPath, bytes, { flag: 'wx' });
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_immutable_artifact_readback_failed');
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_immutable_artifact_conflict');
    }
    return false;
  }
}

function publishActiveAuthority(targetPath: string, value: JsonObject): boolean {
  const bytes = canonicalBytes(value);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_active_authority_conflict');
    }
    return false;
  }
  const temporaryPath = `${targetPath}.candidate-${process.pid}`;
  publishImmutable(temporaryPath, bytes);
  try {
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (fs.existsSync(targetPath) && fs.readFileSync(targetPath).equals(bytes)) {
      fs.rmSync(temporaryPath, { force: true });
      return false;
    }
    throw error;
  }
  if (!fs.readFileSync(targetPath).equals(bytes)) {
    throw new Error('standalone_goal_active_authority_readback_failed');
  }
  return true;
}

function renderParentGoal(ir: JsonObject): string {
  return [
    '# Goal Execution Contract',
    '',
    `Goal Execution IR: ${text(ir.goalExecutionIRHash)}`,
    'Profile: standalone',
    '',
    '## Obligations',
    '',
    ...objects(ir.obligations).flatMap(
      (row) => [`- ${text(row.kind)} ${text(row.obligationId)}: ${text(row.text)}`,
        ...(['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(text(ir.schemaVersion)) ? renderNormativeDetails(row) : [])]
    ),
    '',
    '## Atomic Tasks',
    '',
    ...objects(ir.atomicTasks).map(
      (row) =>
        `- ${text(row.taskId)}: ${text(row.title)} (${String(row.expectedEffortMinutes)}m expected, ${String(row.upperBoundEffortMinutes)}m max)`
    ),
    '',
  ].join('\n');
}

export async function publishStandaloneGoalAuthority(
  input: {
    source: JsonObject;
    canonicalIntentBundle: JsonObject;
    goalContractPath: string;
    projectRoot?: string;
  }
) {
  const rawRows = objects(input.source.sourceObligations);
  const rawById = new Map(rawRows.map((row) => [text(row.id), row]));
  const rawByCoordinate = new Map<string, JsonObject[]>();
  for (const row of rawRows) {
    const coordinate = `${String(row.startByte)}:${String(row.endByteExclusive)}`;
    rawByCoordinate.set(coordinate, [...(rawByCoordinate.get(coordinate) ?? []), row]);
  }
  const canonicalSpanById = new Map(
    objects(
      (input.canonicalIntentBundle.specSpanRegistry as JsonObject | undefined)?.specSpans
    ).map((span) => [text(span.specSpanId), span])
  );
  const canonicalRecords = objects(input.canonicalIntentBundle.canonicalIntentIR).filter(
    (row) => text(row.ownership) === 'owned_obligation'
  );
  const rawSemanticRows = canonicalRecords.map((canonical) => {
    const declaredSourceId = text(canonical.declaredSourceId);
    const spanMatches = strings(canonical.specSpanRefs).flatMap((specSpanRef) => {
      const span = canonicalSpanById.get(specSpanRef);
      if (!span) return [];
      return (
        rawByCoordinate.get(`${String(span.startByte)}:${String(span.endByteExclusive)}`) ?? []
      );
    });
    const uniqueSpanMatches = [...new Map(spanMatches.map((row) => [text(row.id), row])).values()];
    const row = declaredSourceId
      ? rawById.get(declaredSourceId)
      : uniqueSpanMatches.length === 1
        ? uniqueSpanMatches[0]
        : undefined;
    if (!row) throw new Error('standalone_goal_successor_required:canonical_source_mapping');
    const sourceId = text(row.id);
    return {
      id: sourceId,
      classification: text(canonical.classification) || 'positive',
      exactText: text(row.exactText) || text(row.text),
      requiredOutcome: text(canonical.requiredOutcome) || text(row.exactText) || text(row.text),
      headingPath: strings(row.headingPath),
      specSpanRefs: sortedUnique(strings(canonical.specSpanRefs)),
      sourceBlockRefs: strings(row.sourceBlockRefs),
      clauseRefs: strings(row.clauseRefs),
      typedRefs: objects(row.typedRefs),
      normativeStrength: row.normativeStrength,
      polarity: row.polarity,
      executionRole: row.executionRole,
      ...(row.taskExecution ? { taskExecution: structuredClone(row.taskExecution) } : {}),
      conditions: row.conditions,
      applicability: row.applicability,
      normativeClauses: row.normativeClauses,
      provenanceRefs: row.provenanceRefs,
      applicabilityState: row.applicabilityState,
      taskRefs: strings(row.taskRefs),
      acceptanceRefs: strings(row.acceptanceRefs),
      commandRefs: strings(row.commandRefs),
      evidenceRefs: strings(row.evidenceRefs),
      dependencyRefs: strings(row.dependencyRefs),
      atomicGroupRefs: strings(row.atomicGroupRefs),
    };
  });
  const semanticIds = new Set(rawSemanticRows.map((row) => text(row.id)));
  const declaredScopeMembers = new Map<string, Set<string>>();
  for (const row of rawSemanticRows) {
    for (const heading of strings(row.headingPath)) {
      const declaredId = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(heading)?.[1];
      if (!declaredId) continue;
      const members = declaredScopeMembers.get(declaredId) ?? new Set<string>();
      members.add(text(row.id));
      declaredScopeMembers.set(declaredId, members);
    }
  }
  const semanticRows = rawSemanticRows.map((row) => {
    const applicability = row.applicability && typeof row.applicability === 'object'
      ? structuredClone(row.applicability) as JsonObject : {};
    if (applicability.scope !== 'obligations') return row;
    const declaredRefs = strings(applicability.obligationRefs);
    const obligationRefs = sortedUnique(declaredRefs.flatMap((ref) =>
      semanticIds.has(ref) ? [ref] : [...(declaredScopeMembers.get(ref) ?? [])]
    ));
    if (declaredRefs.length === 0 || obligationRefs.length === 0) {
      throw new Error('standalone_goal_applicability_reference_unresolved');
    }
    return { ...row, applicability: { ...applicability, obligationRefs } };
  });
  const technicalSnapshot = input.source.canonicalRequirementGraph
    ? canonicalSourcePlanTechnicalSnapshot(input.source, semanticRows)
    : standaloneTechnicalSnapshot(input.source, semanticRows);
  const documentGraph = input.source.sourceDocumentGraph && typeof input.source.sourceDocumentGraph === 'object'
    ? input.source.sourceDocumentGraph as JsonObject : undefined;
  const sourceCanonicalGraph = input.source.canonicalRequirementGraph &&
    typeof input.source.canonicalRequirementGraph === 'object'
    ? input.source.canonicalRequirementGraph as JsonObject
    : undefined;
  const normalizedCanonicalGraph: CanonicalRequirementGraphV2 | undefined = sourceCanonicalGraph
    ? normalizeCanonicalRequirementGraph({
        sourceAuthority: {
          kind: 'standalone_source_plan',
          schemaVersion: text(sourceCanonicalGraph.sourcePlanVersion),
          authorityId: text(sourceCanonicalGraph.sourcePlanId),
          authorityHash: text(input.source.sourceSnapshotHash),
        },
        standaloneGraph: sourceCanonicalGraph,
      })
    : undefined;
  const documentSpans = objects(documentGraph?.spans);
  const spanByRef = new Map<string, JsonObject>();
  for (const span of documentSpans) {
    const id = text(span.id);
    const sourceBlockId = text(span.sourceBlockId);
    if (id) spanByRef.set(id, span);
    if (sourceBlockId) spanByRef.set(sourceBlockId, span);
  }
  for (const sourceBlock of objects(input.source.sourceBlocks)) {
    const sourceBlockId = text(sourceBlock.id);
    const sourceRef = sourceBlock.sourceRef && typeof sourceBlock.sourceRef === 'object'
      ? sourceBlock.sourceRef as JsonObject
      : undefined;
    if (sourceBlockId && sourceRef) {
      spanByRef.set(sourceBlockId, {
        ...sourceRef,
        id: sourceBlockId,
        sourceBlockId,
      });
    }
  }
  const canonicalSpanRows = objects(
    (input.canonicalIntentBundle.specSpanRegistry as JsonObject | undefined)?.specSpans
  );
  for (const span of canonicalSpanRows) {
    const specSpanId = text(span.specSpanId);
    if (!specSpanId) continue;
    const physical = documentSpans.find((candidate) =>
      Number(candidate.startByte) === Number(span.startByte) &&
      Number(candidate.endByteExclusive) === Number(span.endByteExclusive)
    );
    spanByRef.set(specSpanId, physical ? { ...physical, ...span } : span);
  }
  const logicalSpecSpanById = new Map<string, JsonObject>();
  const addPhysicalSpan = (specSpanId: string, boundRefs: string[], canonicalNodeRefs: string[]) => {
    const physical = spanByRef.get(specSpanId);
    if (!physical) throw new Error('standalone_goal_source_span_missing');
    const current = logicalSpecSpanById.get(specSpanId);
    const boundObligationIds = sortedUnique([...(current ? strings(current.boundObligationIds) : []), ...boundRefs]);
    if (boundObligationIds.length === 0) throw new Error('standalone_goal_source_span_owner_missing');
    logicalSpecSpanById.set(specSpanId, {
      ...(current ?? {}),
      specSpanId,
      sourceArtifactId: text(input.source.sourceArtifactId),
      sourceSnapshotHash: text(input.source.sourceSnapshotHash),
      startByte: Number(physical.startByte),
      endByteExclusive: Number(physical.endByteExclusive),
      lineStart: Number(physical.lineStart ?? physical.startLine),
      lineEnd: Number(physical.lineEnd ?? physical.endLine),
      exactTextHash: text(physical.exactTextHash ?? physical.expectedExactTextHash),
      boundObligationIds,
      canonicalNodeRefs: sortedUnique([...(current ? strings(current.canonicalNodeRefs) : []), ...canonicalNodeRefs]),
      ...(documentGraph?.graphHash ? { sourceDocumentGraphHash: text(documentGraph.graphHash) } : {}),
      ...(normalizedCanonicalGraph
        ? { canonicalRequirementGraphHash: normalizedCanonicalGraph.graphHash } : {}),
      evidenceClaimRefs: [],
    });
  };
  for (const row of semanticRows) {
    const authoritativeRefs = sortedUnique([
      ...strings(row.specSpanRefs),
      ...strings(row.provenanceRefs),
      ...strings(row.sourceBlockRefs),
    ]).filter((ref) => spanByRef.has(ref));
    for (const specSpanId of authoritativeRefs) {
      addPhysicalSpan(specSpanId, [text(row.id)], [text(row.id)]);
    }
  }
  for (const binding of technicalSnapshot.constraintBindings ?? []) {
    const declarationRefs = strings(binding.sourceRefs).filter((ref) => spanByRef.has(ref));
    if (declarationRefs.length === 0) throw new Error('standalone_goal_constraint_source_span_missing');
    const sourceBlockRefs = strings(binding.sourceDeclarationRefs).filter((ref) => spanByRef.has(ref));
    for (const ref of sortedUnique([...declarationRefs, ...sourceBlockRefs])) {
      addPhysicalSpan(ref, strings(binding.applicableMustRefs), [text(binding.constraintId)]);
    }
  }
  const logicalSpecSpans = [...logicalSpecSpanById.values()].sort((left, right) =>
    text(left.specSpanId).localeCompare(text(right.specSpanId))
  );
  const sourceLineageBase = {
    schemaVersion: 'GoalExecutionSourceLineage/v1',
    authorities: [{
      authorityKind: 'standalone_source_document' as const,
      authorityId: text(input.source.sourceArtifactId),
      authorityHash: text(input.source.sourceSnapshotHash),
      sourceSnapshotHash: text(input.source.sourceSnapshotHash),
      ...(documentGraph?.graphHash ? { sourceDocumentGraphHash: text(documentGraph.graphHash) } : {}),
      ...(normalizedCanonicalGraph
        ? {
            canonicalRequirementGraphHash: normalizedCanonicalGraph.graphHash,
            canonicalSemanticHash: normalizedCanonicalGraph.semanticHash,
            upstreamCanonicalRequirementGraphHash:
              normalizedCanonicalGraph.upstreamCanonicalRequirementGraphHash,
          }
        : {}),
      logicalSpecSpanRefs: logicalSpecSpans.map((span) => text(span.specSpanId)),
    }],
    logicalSpecSpanRefs: logicalSpecSpans.map((span) => text(span.specSpanId)),
    logicalSpecSpanSetHash: sha256Stable(logicalSpecSpans),
  };
  const sourceLineage = { ...sourceLineageBase, lineageHash: sha256Stable(sourceLineageBase) };
  const authorityRoot = path.resolve(`${input.goalContractPath}.authority`);
  const compiled = await compileStandaloneGoalExecution({
    sourcePlanHash: text(input.source.sourcePlanHash),
    sourceSnapshotHash: text(input.source.sourceSnapshotHash),
    sourceObligations: semanticRows,
    ...(normalizedCanonicalGraph
      ? { canonicalRequirementGraph: normalizedCanonicalGraph }
      : {}),
    logicalSpecSpans,
    sourceLineage,
    technicalSnapshot,
  });
  const hashId = compiled.goalExecutionIr.goalExecutionIRHash.slice('sha256:'.length);
  const semanticPath = path.join(
    authorityRoot,
    'goal',
    'standalone-semantic',
    compiled.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash.slice(7),
    'standalone-goal-semantic-ir.json'
  );
  const internalGatePath = path.join(
    authorityRoot,
    'goal',
    'standalone-semantic',
    compiled.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash.slice(7),
    'internal-semantic-gate',
    'semantic-gate.json'
  );
  const irPath = path.join(authorityRoot, 'goal', 'ir', hashId, 'goal-execution-ir.json');
  const closurePath = path.join(
    authorityRoot,
    'goal',
    'closures',
    hashId,
    'goal-execution-closure.json'
  );
  const projectionPath = path.join(
    authorityRoot,
    'goal',
    'projections',
    hashId,
    'goal-execution-contract.md'
  );
  const renderabilityPath = path.join(
    authorityRoot,
    'goal',
    'projections',
    hashId,
    'renderability-report.json'
  );
  const sourceBindingPayload = {
    schemaVersion: 'GoalSourceBinding/v1',
    profile: 'standalone',
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    sourcePlanHash: text(input.source.sourcePlanHash),
    sourceSnapshotHash: text(input.source.sourceSnapshotHash),
  };
  const sourceBinding = {
    ...sourceBindingPayload,
    goalSourceBindingHash: sha256Stable(sourceBindingPayload),
  };
  const specSpanIds = new Set(compiled.goalExecutionIr.logicalSpecSpans.map((span) => text(span.specSpanId)));
  const bindingPath = path.join(
    authorityRoot,
    'goal',
    'bindings',
    sourceBinding.goalSourceBindingHash.slice(7),
    'goal-source-binding.json'
  );
  const evidencePayload = {
    schemaVersion: 'GoalContractResolvedEvidenceIndex/v1',
    profile: 'standalone',
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    goalSourceBindingHash: sourceBinding.goalSourceBindingHash,
    resolutions: compiled.goalExecutionIr.obligations.map((obligation) => ({
      goalObligationId: obligation.obligationId,
      logicalSpecSpanRefs: obligation.sourceRefs.filter(
        (ref) => ['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(compiled.goalExecutionIr.schemaVersion) ? specSpanIds.has(ref)
          : ref.startsWith('spec-span-') || ref.startsWith('SPAN-')
      ),
      evidenceClaimRefs: obligation.evidenceClaimRefs,
    })),
  };
  const evidenceIndex = {
    ...evidencePayload,
    resolvedEvidenceIndexHash: sha256Stable(evidencePayload),
  };
  validateGoalContractSchema('goal-source-binding.schema.json', sourceBinding);
  validateGoalContractSchema('goal-contract-resolved-evidence-index.schema.json', evidenceIndex);
  const evidencePath = path.join(
    authorityRoot,
    'goal',
    'bindings',
    sourceBinding.goalSourceBindingHash.slice(7),
    'resolved-evidence-index.json'
  );
  const parentProjection = renderParentGoal(compiled.goalExecutionIr);
  const renderability = probeGoalContractRenderability({
    goalExecutionIr: compiled.goalExecutionIr,
    markdown: parentProjection,
  });
  if (renderability.decision !== 'pass') throw new Error(renderability.issueCodes[0]);
  const renderabilityBytes = canonicalBytes(renderability);
  const activePath = path.join(authorityRoot, 'goal', 'active-authority.json');
  const refs = {
    standaloneSemanticIrRef: {
      path: path.relative(authorityRoot, semanticPath).replace(/\\/gu, '/'),
      hash: compiled.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
    },
    standaloneInternalSemanticGateRef: {
      path: path.relative(authorityRoot, internalGatePath).replace(/\\/gu, '/'),
      hash: compiled.internalSemanticGate.gateHash,
    },
    goalExecutionIrRef: {
      path: path.relative(authorityRoot, irPath).replace(/\\/gu, '/'),
      hash: compiled.goalExecutionIr.goalExecutionIRHash,
    },
    sourceBindingRef: {
      path: path.relative(authorityRoot, bindingPath).replace(/\\/gu, '/'),
      hash: sourceBinding.goalSourceBindingHash,
    },
    resolvedEvidenceIndexRef: {
      path: path.relative(authorityRoot, evidencePath).replace(/\\/gu, '/'),
      hash: evidenceIndex.resolvedEvidenceIndexHash,
    },
    closureRef: {
      path: path.relative(authorityRoot, closurePath).replace(/\\/gu, '/'),
      hash: compiled.closure.goalExecutionClosureHash,
    },
    parentProjectionRef: {
      path: path.relative(authorityRoot, projectionPath).replace(/\\/gu, '/'),
      bytesHash: sha256Text(parentProjection),
    },
    renderabilityReportRef: {
      path: path.relative(authorityRoot, renderabilityPath).replace(/\\/gu, '/'),
      bytesHash: sha256Text(renderabilityBytes.toString('utf8')),
    },
  };
  const activePayload = {
    schemaVersion: 'GoalContractActiveAuthority/v1',
    profile: 'standalone',
    goalId: compiled.goalExecutionIr.goalId,
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    ...refs,
  };
  const active = { ...activePayload, activeAuthorityHash: sha256Stable(activePayload) };
  validateGoalContractSchema('goal-contract-active-authority.schema.json', active);
  const artifacts: Array<[string, Buffer]> = [
    [semanticPath, canonicalBytes(compiled.standaloneGoalSemanticIr)],
    [irPath, canonicalBytes(normalizeGoalExecutionAuthority(compiled.goalExecutionIr))],
    [closurePath, canonicalBytes(compiled.closure)],
    [bindingPath, canonicalBytes(sourceBinding)],
    [evidencePath, canonicalBytes(evidenceIndex)],
    [projectionPath, Buffer.from(parentProjection, 'utf8')],
    [renderabilityPath, renderabilityBytes],
  ];
  let writeCount = 0;
  for (const [artifactPath, bytes] of artifacts) {
    if (publishImmutable(artifactPath, bytes)) writeCount += 1;
  }
  if (publishImmutable(internalGatePath, canonicalBytes(compiled.internalSemanticGate))) writeCount += 1;
  if (publishActiveAuthority(activePath, active)) writeCount += 1;
  return Object.freeze({
    goalRunRoot: authorityRoot,
    goalJudgeDispatchCount: compiled.goalJudgeDispatchCount,
    publicationStatus: writeCount === 0 ? 'reused' : 'published',
    writeCount,
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    internalSemanticGateRef: { path: internalGatePath, hash: refs.standaloneInternalSemanticGateRef.hash },
    standaloneGoalSemanticIrRef: { path: semanticPath, hash: refs.standaloneSemanticIrRef.hash },
    goalExecutionIrRef: { path: irPath, hash: refs.goalExecutionIrRef.hash },
    sourceBindingRef: { path: bindingPath, hash: refs.sourceBindingRef.hash },
    resolvedEvidenceIndexRef: { path: evidencePath, hash: refs.resolvedEvidenceIndexRef.hash },
    closureRef: { path: closurePath, hash: refs.closureRef.hash },
    renderabilityReportRef: {
      path: renderabilityPath,
      bytesHash: refs.renderabilityReportRef.bytesHash,
    },
    activeAuthorityRef: { path: activePath, hash: active.activeAuthorityHash },
  });
}
