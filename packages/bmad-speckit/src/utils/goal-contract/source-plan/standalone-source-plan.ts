const { createHash } = require('node:crypto');
const fs = require('node:fs');

const modulePath = (relativePath: string): string =>
  `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
const { hashControlPlaneValue } = require(modulePath('../control-plane/canonical-hash'));
const { validateGoalContractSchema } = require(modulePath('../control-plane/schema-registry'));
const { parseStandaloneSourcePlan } = require(modulePath('./parser'));
const { loadStandaloneSourcePlanProfile } = require(modulePath('./profile'));
const { extractSourceObligations } = require(modulePath('../source-obligation-extractor'));
const { compileSourceSnapshot } = require(modulePath('../control-plane/source-snapshot'));

type PlainRecord = Record<string, unknown>;

interface SourcePlanFence {
  data: unknown;
  exactTextHash: string;
  fenceType: 'metadata' | 'node';
  lineStart: number;
  lineEnd: number;
  startByte: number;
  endByteExclusive: number;
  parseError: string | null;
  spanId: string;
}

interface ParsedSourcePlan {
  sourceText: string;
  sourceBytes: number;
  sourceHash: string;
  sourceArtifactId: string;
  fences: SourcePlanFence[];
}

const RELATION_TYPES: Record<string, string> = {
  ownerRef: 'owned_by',
  requirementRefs: 'applies_to_requirement',
  taskRefs: 'implemented_by',
  acceptanceRefs: 'accepted_by',
  pathRefs: 'uses_path',
  commandRefs: 'validated_by',
  evidenceRefs: 'evidenced_by',
  artifactRefs: 'produces_artifact',
  dependencyRefs: 'depends_on',
  stopRefs: 'guarded_by',
  producerRef: 'produced_by',
  consumerRefs: 'consumed_by',
  commandSetRefs: 'includes_command',
  globalAuthorityRef: 'globally_authorized_by',
};

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function strings(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .filter((item, index, values) => values.indexOf(item) === index)
    .sort();
}

function nonEmpty(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

function issueFor(
  parsed: ParsedSourcePlan,
  fence: SourcePlanFence | undefined,
  failureClass: string,
  repairHint: string,
  details: { offendingId?: string; field?: string } = {}
): PlainRecord {
  const located = fence ?? {
    lineStart: 1,
    lineEnd: 1,
    startByte: 0,
    endByteExclusive: Math.min(parsed.sourceBytes, 1),
    exactTextHash: sha256(parsed.sourceText.slice(0, 1)),
  };
  return {
    failureClass,
    sourceArtifactId: parsed.sourceArtifactId,
    sourceSnapshotHash: parsed.sourceHash,
    lineStart: located.lineStart,
    lineEnd: located.lineEnd,
    startByte: located.startByte,
    endByteExclusive: located.endByteExclusive,
    excerptHash: located.exactTextHash,
    ...(details.offendingId ? { offendingId: details.offendingId } : {}),
    ...(details.field ? { field: details.field } : {}),
    repairHint,
  };
}

function canonicalKindForId(id: string): string {
  return id.split('-')[0] || '';
}

function domainFor(id: string): string {
  const parts = id.split('-');
  parts.shift();
  if (/^S\d{2}$/u.test(parts.at(-1) ?? '')) parts.pop();
  parts.pop();
  return parts.join('-');
}

function semanticGraphHash(graph: PlainRecord): string {
  const { graphHash: _graphHash, ...graphPayload } = graph;
  const nodes = (graph.nodes as PlainRecord[]).map(({ sourceSpanRefs: _ignored, ...node }) => node);
  const relations = (graph.relations as PlainRecord[]).map(({ sourceSpanRefs: _ignored, ...relation }) => relation);
  const aliases = (graph.aliases as PlainRecord[]).map(({ sourceSpanRefs: _ignored, ...alias }) => alias);
  return hashControlPlaneValue({ ...graphPayload, nodes, relations, aliases });
}

function relationId(type: string, fromRef: string, toRef: string, scope: string): string {
  return `REL-${sha256(`${type}:${fromRef}:${toRef}:${scope}`).slice(7, 23).toUpperCase()}`;
}

function normalizeLegacyPurposeClaims(semanticObligations: PlainRecord[]): PlainRecord[] {
  const goalContractConflict = [
    /\b(?:must\s+not|shall\s+not|do\s+not|never|prohibit(?:ed)?)\s+(?:the\s+)?(?:generat(?:e|ion)|creat(?:e|ion)|compil(?:e|ation)|produc(?:e|tion))(?:\s+of)?\s+(?:a\s+)?goal\s+contracts?\b/iu,
    /\bgoal\s+contracts?\s+(?:generat(?:e|ion)|creat(?:e|ion)|compil(?:e|ation)|produc(?:e|tion))\s+(?:is|are|must\s+be|shall\s+be)?\s*(?:forbidden|prohibited|not\s+allowed)\b/iu,
    /(?:不得|禁止|不应)\s*(?:生成|创建|编译|产出)\s*(?:Goal|目标)\s*合同/iu,
    /(?:不得|禁止|不应)\s*(?:Goal|目标)\s*合同(?:的)?\s*(?:生成|创建|编译|产出)/iu,
    /\b(?:must\s+contain\s+no|no)\s+executable\s+requirements?\b/iu,
    /(?:不得|禁止|不应)\s*(?:包含|存在)\s*可执行需求/u,
  ];
  return semanticObligations.flatMap((obligation) => {
    const clauses = Array.isArray(obligation.normativeClauses)
      ? obligation.normativeClauses.filter(isRecord)
      : [];
    return clauses.flatMap((clause) => {
      const text = String(clause.text ?? '');
      const modalities = strings(clause.modalities);
      const prohibited = clause.polarity === 'forbidden' || modalities.includes('forbidden');
      if (!prohibited || !goalContractConflict.some((pattern) => pattern.test(text))) return [];
      const conditions = Array.isArray(clause.conditions)
        ? clause.conditions.filter(isRecord)
        : [];
      return [{
        action: 'prohibit',
        target: 'goal_contract_generation',
        polarity: 'forbidden',
        applicability: conditions.some((condition) =>
          condition.kind === 'source_confirmation_gate'
        ) ? 'pre_confirmation_only' : 'active',
        sourceClause: clause,
        sourceObligationId: String(obligation.id ?? ''),
      }];
    });
  });
}

function legacySemanticKind(id: string): 'requirement' | 'task' | 'acceptance' | 'command' | 'evidence' | 'other' {
  if (/^(?:REQ|NFR|FIX)-/u.test(id)) return 'requirement';
  if (/^(?:TASK|WORK)-/u.test(id)) return 'task';
  if (/^AC-/u.test(id)) return 'acceptance';
  if (/^CMD-/u.test(id)) return 'command';
  if (/^EVD-/u.test(id)) return 'evidence';
  return 'other';
}

function validateLegacyAuthorityClosure(
  sourceObligations: PlainRecord[],
  sourceBlocks: PlainRecord[],
  sourceRelations: PlainRecord[]
): PlainRecord[] {
  const declaredBlocks = sourceBlocks.filter((block) =>
    typeof block.declaredId === 'string' && block.declaredId.length > 0
  );
  const blockById = new Map(sourceBlocks.map((block) => [String(block.id ?? ''), block]));
  const declarationById = new Map<string, PlainRecord>();
  for (const block of declaredBlocks) {
    const id = String(block.declaredId);
    if (!declarationById.has(id)) declarationById.set(id, block);
  }
  const declaredIds = new Set(declarationById.keys());
  const adjacency = new Map([...declaredIds].map((id) => [id, new Set<string>()]));
  const connect = (left: string, right: string): void => {
    if (left === right || !adjacency.has(left) || !adjacency.has(right)) return;
    adjacency.get(left)!.add(right);
    adjacency.get(right)!.add(left);
  };
  for (const relation of sourceRelations) {
    connect(String(relation.fromId ?? ''), String(relation.toId ?? ''));
  }
  for (const block of declaredBlocks) {
    const id = String(block.declaredId);
    for (const parentBlockRef of strings(block.parentBlockRefs)) {
      const parentId = String(blockById.get(parentBlockRef)?.declaredId ?? '');
      if (parentId) connect(id, parentId);
    }
  }

  const neighbors = (id: string): string[] => [...(adjacency.get(id) ?? [])].sort();
  const acceptanceComponent = (startId: string): Set<string> => {
    const visited = new Set<string>();
    const pending = [startId];
    while (pending.length > 0) {
      const current = pending.shift()!;
      if (visited.has(current) || legacySemanticKind(current) !== 'acceptance') continue;
      visited.add(current);
      for (const next of neighbors(current)) {
        if (legacySemanticKind(next) === 'acceptance' && !visited.has(next)) pending.push(next);
      }
    }
    return visited;
  };
  const relatedThroughAcceptance = (id: string, targetKind: string): string[] => {
    const direct = neighbors(id).filter((candidate) => legacySemanticKind(candidate) === targetKind);
    const acceptanceIds = legacySemanticKind(id) === 'acceptance'
      ? [...acceptanceComponent(id)]
      : neighbors(id).filter((candidate) => legacySemanticKind(candidate) === 'acceptance')
        .flatMap((candidate) => [...acceptanceComponent(candidate)]);
    const viaAcceptance = acceptanceIds.flatMap((acceptanceId) =>
      neighbors(acceptanceId).filter((candidate) => legacySemanticKind(candidate) === targetKind)
    );
    return [...new Set([...direct, ...viaAcceptance])].sort();
  };

  const actionTasks = sourceObligations.filter((obligation) =>
    obligation.declaredId === true && obligation.executionRole === 'action' &&
    legacySemanticKind(String(obligation.id ?? '')) === 'task'
  );
  const requirementIds = [...declaredIds].filter((id) => legacySemanticKind(id) === 'requirement');
  const acceptanceIds = [...declaredIds].filter((id) => legacySemanticKind(id) === 'acceptance');
  const verificationIds = [...declaredIds].filter((id) =>
    ['command', 'evidence'].includes(legacySemanticKind(id))
  );
  const issues: PlainRecord[] = [];
  const addIssue = (
    failureClass: string,
    offendingId: string,
    field: string,
    repairHint: string
  ): void => {
    if (issues.some((issue) => issue.failureClass === failureClass && issue.offendingId === offendingId)) return;
    issues.push({ failureClass, offendingId, field, repairHint });
  };

  if (requirementIds.length === 0 || actionTasks.length === 0 || acceptanceIds.length === 0) {
    addIssue(
      'legacy_source_plan_authority_missing',
      requirementIds[0] ?? String(actionTasks[0]?.id ?? acceptanceIds[0] ?? ''),
      'authorityClosure',
      'Provide declared requirement, executable task, acceptance, and verification authority in one connected legacy source graph.'
    );
  }
  for (const task of actionTasks) {
    const taskId = String(task.id);
    if (relatedThroughAcceptance(taskId, 'requirement').length === 0) {
      addIssue(
        'source_semantic_owner_missing',
        taskId,
        'requirementRefs',
        'Bind the executable task to a declared REQ, NFR, or FIX through an explicit source relation.'
      );
    }
    const verificationRefs = [...strings(task.commandRefs), ...strings(task.evidenceRefs)];
    const typedVerification = relatedThroughAcceptance(taskId, 'command')
      .concat(relatedThroughAcceptance(taskId, 'evidence'));
    if (verificationRefs.length === 0 && typedVerification.length === 0) {
      addIssue(
        'legacy_source_evidence_closure_missing',
        taskId,
        'commandRefs',
        'Bind the executable task or its acceptance owner to a declared command or evidence requirement.'
      );
    }
  }
  for (const requirementId of requirementIds.filter((id) => /^FIX-/u.test(id))) {
    if (relatedThroughAcceptance(requirementId, 'task').length === 0) {
      addIssue(
        'legacy_source_requirement_orphaned',
        requirementId,
        'taskRefs',
        'Bind each legacy FIX owner to an executable task directly or through its acceptance scenarios.'
      );
    }
  }
  for (const acceptanceId of acceptanceIds) {
    if (relatedThroughAcceptance(acceptanceId, 'task').length === 0) {
      addIssue(
        'source_semantic_owner_missing',
        acceptanceId,
        'ownerRef',
        'Bind each legacy acceptance owner to an executable task using an explicit relation or declared acceptance ancestry.'
      );
    }
  }
  for (const verificationId of verificationIds) {
    if (relatedThroughAcceptance(verificationId, 'task').length === 0 &&
      relatedThroughAcceptance(verificationId, 'acceptance').length === 0) {
      addIssue(
        'source_semantic_owner_missing',
        verificationId,
        'ownerRef',
        'Bind each declared command or evidence node to a task or acceptance owner.'
      );
    }
  }
  return issues.sort((left, right) =>
    String(left.offendingId).localeCompare(String(right.offendingId)) ||
    String(left.failureClass).localeCompare(String(right.failureClass))
  ).map((issue) => ({ ...issue, sourceNode: declarationById.get(String(issue.offendingId)) }));
}

function legacySourceFence(value: PlainRecord | undefined): SourcePlanFence | undefined {
  if (!value) return undefined;
  const sourceRef = isRecord(value.sourceRef) ? value.sourceRef : value;
  const lineStart = Number(sourceRef.lineStart);
  const lineEnd = Number(sourceRef.lineEnd);
  const startByte = Number(sourceRef.startByte);
  const endByteExclusive = Number(sourceRef.endByteExclusive);
  const exactTextHash = String(sourceRef.exactTextHash ?? '');
  if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd) ||
    !Number.isInteger(startByte) || !Number.isInteger(endByteExclusive) ||
    !/^sha256:[0-9a-f]{64}$/u.test(exactTextHash)) return undefined;
  return {
    data: {},
    exactTextHash,
    fenceType: 'node',
    lineStart,
    lineEnd,
    startByte,
    endByteExclusive,
    parseError: null,
    spanId: '',
  };
}

function legacyFailureFence(
  parsed: ParsedSourcePlan,
  offendingId: string
): SourcePlanFence | undefined {
  if (!offendingId) return undefined;
  const normalized = parsed.sourceText.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
  const lines = normalized.split('\n');
  const lineIndex = lines.findIndex((line) => line.includes(offendingId));
  if (lineIndex < 0) return undefined;
  const prefix = lines.slice(0, lineIndex).join('\n');
  const line = lines[lineIndex];
  const startByte = Buffer.byteLength(prefix + (lineIndex > 0 ? '\n' : ''), 'utf8');
  const endByteExclusive = startByte + Buffer.byteLength(line, 'utf8');
  return {
    data: {},
    exactTextHash: sha256(line),
    fenceType: 'node',
    lineStart: lineIndex + 1,
    lineEnd: lineIndex + 1,
    startByte,
    endByteExclusive,
    parseError: null,
    spanId: '',
  };
}

function lintLegacySourcePlan(
  parsed: ParsedSourcePlan,
  baseResult: PlainRecord,
  profile: PlainRecord
): PlainRecord {
  try {
    const normalized = extractSourceObligations({
      snapshot: compileSourceSnapshot({
        sourceKind: 'source_plan',
        sourceArtifactId: parsed.sourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: 'PRIMARY',
        sourceOrder: 0,
        pathOrSegmentId: String(baseResult.sourcePath),
        rawBytes: Buffer.from(parsed.sourceText, 'utf8'),
      }),
    }) as PlainRecord;
    const semanticObligations = Array.isArray(normalized.semanticObligations)
      ? normalized.semanticObligations.filter(isRecord)
      : [];
    const sourceObligations = Array.isArray(normalized.sourceObligations)
      ? normalized.sourceObligations.filter(isRecord)
      : [];
    const sourceRelations = Array.isArray(normalized.sourceRelations)
      ? normalized.sourceRelations.filter(isRecord)
      : [];
    const sourceBlocks = Array.isArray(normalized.sourceBlocks)
      ? normalized.sourceBlocks.filter(isRecord)
      : [];
    const purpose = isRecord(profile.purpose) ? profile.purpose : {};
    const conflictingTargets = new Set(strings(purpose.conflictingTargets));
    const purposeIssues = normalizeLegacyPurposeClaims(semanticObligations)
      .filter((claim) => claim.applicability === 'active' &&
        conflictingTargets.has(String(claim.target ?? '')))
      .map((claim) => {
        const sourceClause = isRecord(claim.sourceClause) ? claim.sourceClause : undefined;
        return issueFor(
          parsed,
          legacySourceFence(sourceClause),
          'source_plan_purpose_conflict',
          'Remove the prohibition against authorized Goal contract generation.',
          {
            offendingId: String(claim.sourceObligationId ?? ''),
            field: 'purpose',
          }
        );
      });
    const authorityIssues = validateLegacyAuthorityClosure(
      sourceObligations,
      sourceBlocks,
      sourceRelations
    ).map((authorityIssue) => issueFor(
      parsed,
      legacySourceFence(isRecord(authorityIssue.sourceNode) ? authorityIssue.sourceNode : undefined),
      String(authorityIssue.failureClass),
      String(authorityIssue.repairHint),
      {
        offendingId: String(authorityIssue.offendingId ?? ''),
        field: String(authorityIssue.field ?? ''),
      }
    ));
    const issues = [...purposeIssues, ...authorityIssues]
      .sort((left, right) => Number(left.lineStart) - Number(right.lineStart) ||
        String(left.failureClass).localeCompare(String(right.failureClass)));
    if (issues.length > 0) {
      const result = {
        ...baseResult,
        ok: false,
        detectedSourcePlanVersion: 'legacy/unversioned',
        normalizationState: 'rejected',
        nodeCount: semanticObligations.length,
        relationCount: sourceRelations.length,
        issueCount: issues.length,
        issues,
        canonicalGraphHash: null,
        canonicalGraph: null,
      };
      validateGoalContractSchema('standalone-source-plan-lint-result.schema.json', result);
      return Object.freeze(result);
    }
    const result = {
      ...baseResult,
      ok: true,
      detectedSourcePlanVersion: 'legacy/unversioned',
      normalizationState: 'legacy_normalized',
      nodeCount: semanticObligations.length,
      relationCount: sourceRelations.length,
      issueCount: 0,
      issues: [],
      canonicalGraphHash: String(normalized.sourceObligationGraphHash ?? '') || null,
      canonicalGraph: null,
    };
    validateGoalContractSchema('standalone-source-plan-lint-result.schema.json', result);
    return Object.freeze(result);
  } catch (error) {
    const failure = isRecord(error) ? error : {};
    const duplicateIds = strings(failure.duplicateIds);
    const offendingId = duplicateIds[0] ?? String(failure.sourceId ?? '');
    const failureClass = String(
      failure.failureClass ?? 'legacy_source_plan_normalization_failed'
    );
    const issue = {
      ...issueFor(
      parsed,
      legacyFailureFence(parsed, offendingId),
      failureClass,
      typeof failure.repairHint === 'string'
        ? failure.repairHint
        : 'Resolve the located legacy identity, ownership, or semantic ambiguity before Goal compilation.',
      { ...(offendingId ? { offendingId } : {}) }
      ),
      ...(typeof failure.sourceId === 'string' ? { sourceId: failure.sourceId } : {}),
      ...(typeof failure.matchedPhrase === 'string'
        ? { matchedPhrase: failure.matchedPhrase }
        : {}),
      ...(typeof failure.sourceExcerpt === 'string'
        ? { sourceExcerpt: failure.sourceExcerpt }
        : {}),
    };
    const result = {
      ...baseResult,
      ok: false,
      detectedSourcePlanVersion: 'legacy/unversioned',
      normalizationState: 'rejected',
      nodeCount: 0,
      relationCount: 0,
      issueCount: 1,
      issues: [issue],
      canonicalGraphHash: null,
      canonicalGraph: null,
    };
    validateGoalContractSchema('standalone-source-plan-lint-result.schema.json', result);
    return Object.freeze(result);
  }
}

function lintStandaloneSourcePlan(input: {
  sourcePath: string;
  sourceText?: string;
  rawBytes?: Buffer;
}): PlainRecord {
  const { profile } = loadStandaloneSourcePlanProfile();
  const parsed = parseStandaloneSourcePlan(input) as ParsedSourcePlan;
  const metadataFences = parsed.fences.filter((fence) => fence.fenceType === 'metadata');
  const nodeFences = parsed.fences.filter((fence) => fence.fenceType === 'node');
  const issues: PlainRecord[] = [];
  const baseResult = {
    schemaVersion: 'StandaloneSourcePlanLintResult/v1',
    entryScenario: 'standalone_goal_contract',
    sourcePath: input.sourcePath.replace(/\\/gu, '/'),
    sourceBytes: parsed.sourceBytes,
    sourceHash: parsed.sourceHash,
    sourceArtifactId: parsed.sourceArtifactId,
    profileHash: profile.profileHash,
    templateHash: profile.templateHash,
  };

  if (metadataFences.length === 0 && !/sourcePlanVersion\s*:/u.test(parsed.sourceText)) {
    return lintLegacySourcePlan(parsed, baseResult, profile);
  }

  if (metadataFences.length !== 1) {
    issues.push(issueFor(parsed, metadataFences[1] ?? metadataFences[0], 'source_plan_metadata_invalid', 'Declare exactly one standalone-source-plan metadata fence.'));
  }
  for (const fence of parsed.fences.filter((item) => item.parseError)) {
    issues.push(issueFor(parsed, fence, 'source_plan_yaml_invalid', 'Repair the located fenced YAML block.'));
  }
  const metadata = isRecord(metadataFences[0]?.data) ? metadataFences[0].data : {};
  if (metadata.sourcePlanVersion !== profile.sourcePlanVersion) {
    issues.push(issueFor(parsed, metadataFences[0], 'source_plan_version_unsupported', 'Use sourcePlanVersion: standalone-source-plan/v1.', { field: 'sourcePlanVersion' }));
  }
  for (const field of profile.metadataRequired) {
    if (!nonEmpty(metadata[field]) && typeof metadata[field] !== 'boolean') {
      issues.push(issueFor(parsed, metadataFences[0], 'source_plan_metadata_invalid', `Declare metadata field ${field}.`, { field }));
    }
  }
  const purpose = profile.purpose as PlainRecord;
  if (metadata.intendedConsumer !== purpose.intendedConsumer || metadata.purpose !== purpose.allowedPurpose) {
    issues.push(issueFor(parsed, metadataFences[0], 'source_plan_purpose_conflict', 'Use the declared standalone Goal compilation consumer and purpose.'));
  }

  const nodeEntries = nodeFences.map((fence) => ({ fence, data: isRecord(fence.data) ? fence.data : {} }));
  const nodesById = new Map<string, { fence: SourcePlanFence; data: PlainRecord }>();
  const identity = profile.identity as PlainRecord;
  const normalization = profile.normalization as PlainRecord;
  const canonicalPattern = new RegExp(String(identity.canonicalPattern), 'u');
  const sourcePlanIdPattern = new RegExp(String(identity.sourcePlanIdPattern), 'u');
  const legacyAliasPattern = new RegExp(String(identity.legacyAliasPattern), 'u');
  const provenanceOnlyPrefixes = strings(identity.provenanceOnlyPrefixes);
  const normativeStrengthValues = strings(normalization.normativeStrengthValues);
  const polarityValues = strings(normalization.polarityValues);
  if (!sourcePlanIdPattern.test(String(metadata.sourcePlanId ?? ''))) {
    issues.push(issueFor(parsed, metadataFences[0], 'source_plan_id_invalid', 'Use PLAN-<DOMAIN>-NNN.', { field: 'sourcePlanId' }));
  }

  for (const entry of nodeEntries) {
    const { data, fence } = entry;
    const id = String(data.id ?? '');
    const kind = String(data.kind ?? '');
    for (const field of profile.commonNodeRequiredFields) {
      if (!nonEmpty(data[field])) issues.push(issueFor(parsed, fence, 'source_semantic_field_missing', `Declare ${field} on ${id || 'the node'}.`, { offendingId: id, field }));
    }
    if (!profile.nodeKinds.includes(kind) || !canonicalPattern.test(id) || canonicalKindForId(id) !== kind) {
      issues.push(issueFor(parsed, fence, 'source_semantic_id_invalid', 'Use the canonical kind/domain/sequence ID grammar.', { offendingId: id, field: 'id' }));
    }
    if (!normativeStrengthValues.includes(String(data.normativeStrength ?? ''))) {
      issues.push(issueFor(parsed, fence, 'source_semantic_normative_strength_invalid', 'Use MUST, SHOULD, or MAY as normativeStrength.', { offendingId: id, field: 'normativeStrength' }));
    }
    if (!polarityValues.includes(String(data.polarity ?? ''))) {
      issues.push(issueFor(parsed, fence, 'source_semantic_polarity_invalid', 'Use a polarity declared by the Source Plan profile.', { offendingId: id, field: 'polarity' }));
    }
    if (!['local', 'global'].includes(String(data.scope ?? ''))) {
      issues.push(issueFor(parsed, fence, 'source_semantic_scope_invalid', 'Use scope local or global.', { offendingId: id, field: 'scope' }));
    }
    if (strings(metadata.declaredDomains).length > 0 && !strings(metadata.declaredDomains).includes(domainFor(id))) {
      issues.push(issueFor(parsed, fence, 'source_semantic_id_domain_undeclared', 'Declare the node domain in metadata.declaredDomains.', { offendingId: id, field: 'id' }));
    }
    if (nodesById.has(id)) {
      issues.push(issueFor(parsed, fence, 'source_semantic_id_duplicate', 'Assign one unique canonical ID per semantic node.', { offendingId: id, field: 'id' }));
    } else if (id) nodesById.set(id, entry);
    for (const field of profile.requiredFieldsByKind[kind] ?? []) {
      if (!nonEmpty(data[field])) issues.push(issueFor(parsed, fence, 'source_semantic_field_missing', `Declare ${field} on ${id}.`, { offendingId: id, field }));
    }
    if (kind === 'TASK') {
      const executionClass = String(data.executionClass ?? '');
      const allowedExecutionClasses = strings(normalization.taskExecutionClassValues);
      const ownedPaths = strings(data.ownedProductionPaths);
      if (
        !allowedExecutionClasses.includes(executionClass) ||
        (executionClass === 'executable_child' && ownedPaths.length === 0) ||
        (executionClass === 'aggregate_only' &&
          (data.ownedProductionPaths !== 'none' ||
            !['post_child_execution', 'final_aggregate'].includes(String(data.aggregateGatePhase ?? '')) ||
            strings(data.aggregateValidationCommands).length === 0))
      ) {
        issues.push(issueFor(parsed, fence, 'source_task_execution_invalid', 'Declare a complete executable_child or aggregate_only execution contract.', { offendingId: id, field: 'executionClass' }));
      }
    }
    if (kind === 'CMD') {
      const declarationClass = String(data.commandDeclarationClass ?? 'executable_expression');
      const commandRefs = strings(data.commandSetRefs);
      const allowedDeclarationClasses = strings(normalization.commandDeclarationClasses);
      if (!allowedDeclarationClasses.includes(declarationClass)) {
        issues.push(issueFor(parsed, fence, 'source_command_declaration_class_invalid', `Use ${allowedDeclarationClasses.join(', ')}.`, { offendingId: id, field: 'commandDeclarationClass' }));
      } else if (declarationClass === 'source_command_set') {
        if (commandRefs.length === 0) {
          issues.push(issueFor(parsed, fence, 'source_command_set_members_missing', 'Declare one or more commandSetRefs for a source_command_set.', { offendingId: id, field: 'commandSetRefs' }));
        }
        if (nonEmpty(data.command)) {
          issues.push(issueFor(parsed, fence, 'source_command_set_expression_forbidden', 'A source_command_set references commands and must not declare a synthetic command expression.', { offendingId: id, field: 'command' }));
        }
      } else if (declarationClass === 'conditional_selector') {
        if (!nonEmpty(data.selectionRule) || !nonEmpty(data.selectionTarget)) {
          issues.push(issueFor(parsed, fence, 'source_command_selector_rule_missing', 'Declare both selectionRule and selectionTarget for a conditional_selector.', { offendingId: id, field: 'selectionRule' }));
        }
        if (nonEmpty(data.command)) {
          issues.push(issueFor(parsed, fence, 'source_command_selector_expression_forbidden', 'A conditional_selector preserves a rule and must not declare a synthetic command expression.', { offendingId: id, field: 'command' }));
        }
        if (commandRefs.length > 0) {
          issues.push(issueFor(parsed, fence, 'source_command_selector_members_forbidden', 'A conditional_selector must not pretend that unresolved selections are fixed commandSetRefs.', { offendingId: id, field: 'commandSetRefs' }));
        }
        if ((!isRecord(data.applicability) ? undefined : data.applicability.mode) !== 'conditional') {
          issues.push(issueFor(parsed, fence, 'source_command_selector_applicability_invalid', 'A conditional_selector requires conditional applicability.', { offendingId: id, field: 'applicability' }));
        }
      } else if (!nonEmpty(data.command)) {
        issues.push(issueFor(parsed, fence, 'source_command_expression_missing', 'Declare the exact command expression for executable_expression.', { offendingId: id, field: 'command' }));
      }
    }
    const applicability = isRecord(data.applicability) ? data.applicability : {};
    if (!['always', 'conditional'].includes(String(applicability.mode ?? '')) || (applicability.mode === 'conditional' && !nonEmpty(applicability.condition))) {
      issues.push(issueFor(parsed, fence, 'source_semantic_applicability_invalid', 'Use mode always, or conditional with a deterministic condition.', { offendingId: id, field: 'applicability' }));
    }
    if (strings(data.prohibits).some((target) => (purpose.conflictingTargets as string[]).includes(target))) {
      issues.push(issueFor(parsed, fence, 'source_plan_purpose_conflict', 'Remove the prohibition against authorized Goal contract generation.', { offendingId: id, field: 'prohibits' }));
    }
  }

  const aliasOwners = new Map<string, string>();
  for (const { data, fence } of nodeEntries) {
    const id = String(data.id ?? '');
    const kind = String(data.kind ?? '');
    const ownerRef = typeof data.ownerRef === 'string' ? data.ownerRef : null;
    if (profile.ownedNodeKinds.includes(kind)) {
      const ownerKind = nodesById.get(ownerRef ?? '')?.data.kind;
      if (!ownerRef || !ownerKind || !(profile.ownerRules[kind] ?? []).includes(String(ownerKind))) {
        issues.push(issueFor(parsed, fence, 'source_semantic_owner_missing', 'Declare one existing type-compatible ownerRef.', { offendingId: id, field: 'ownerRef' }));
      }
    }
    for (const [field, allowedKinds] of Object.entries(
      profile.referenceFields as Record<string, string[]>
    )) {
      for (const reference of strings(data[field])) {
        if (reference === '*') {
          issues.push(issueFor(parsed, fence, 'source_global_fanout_invalid', 'Replace wildcard refs with explicit refs.', { offendingId: id, field }));
          continue;
        }
        const targetKind = nodesById.get(reference)?.data.kind;
        if (!targetKind) {
          if (field !== 'ownerRef') issues.push(issueFor(parsed, fence, 'source_reference_missing', 'Reference an existing canonical node.', { offendingId: id, field }));
        } else if (!allowedKinds.includes(String(targetKind))) {
          issues.push(issueFor(parsed, fence, 'source_reference_type_invalid', 'Reference a node kind allowed by the profile.', { offendingId: id, field }));
        }
      }
    }
    for (const alias of strings(data.aliases)) {
      if (!legacyAliasPattern.test(alias) || provenanceOnlyPrefixes.some((prefix) => alias.startsWith(prefix))) {
        issues.push(issueFor(parsed, fence, 'source_alias_invalid', 'Use a declared legacy semantic ID; provenance IDs cannot be aliases.', { offendingId: id, field: 'aliases' }));
        continue;
      }
      const prior = aliasOwners.get(alias);
      if ((prior && prior !== id) || nodesById.has(alias)) {
        issues.push(issueFor(parsed, fence, 'source_alias_conflict', 'Bind each legacy alias to exactly one canonical node.', { offendingId: id, field: 'aliases' }));
      } else aliasOwners.set(alias, id);
    }
    if (data.scope === 'global') {
      const allowed = metadata.globalBindingsAllowed === true;
      const authorityRef = typeof data.globalAuthorityRef === 'string' ? data.globalAuthorityRef : '';
      const authorities = strings(metadata.globalAuthorityRefs);
      if (!allowed || !authorityRef || !authorities.includes(authorityRef)) {
        issues.push(issueFor(parsed, fence, 'source_global_fanout_invalid', 'Declare an authorized globalAuthorityRef in metadata.', { offendingId: id, field: 'globalAuthorityRef' }));
      }
    } else if (nonEmpty(data.globalAuthorityRef)) {
      issues.push(issueFor(parsed, fence, 'source_global_fanout_invalid', 'Use globalAuthorityRef only with scope global.', { offendingId: id, field: 'globalAuthorityRef' }));
    }
  }

  const globalAuthorityKinds = profile.referenceFields.globalAuthorityRef ?? [];
  for (const authorityRef of strings(metadata.globalAuthorityRefs)) {
    const authorityKind = nodesById.get(authorityRef)?.data.kind;
    if (
      metadata.globalBindingsAllowed !== true ||
      !authorityKind ||
      !globalAuthorityKinds.includes(String(authorityKind))
    ) {
      issues.push(issueFor(parsed, metadataFences[0], 'source_global_fanout_invalid', 'Declare each global authority as an existing requirement owner.', { offendingId: authorityRef, field: 'globalAuthorityRefs' }));
    }
  }

  const dedupedIssues = [...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values()]
    .sort((left, right) => Number(left.lineStart) - Number(right.lineStart) || String(left.failureClass).localeCompare(String(right.failureClass)));
  let canonicalGraph: PlainRecord | null = null;
  if (dedupedIssues.length === 0) canonicalGraph = buildCanonicalGraph(metadata, nodeEntries, profile.referenceFields);
  const result = {
    ...baseResult,
    ok: dedupedIssues.length === 0,
    detectedSourcePlanVersion: metadata.sourcePlanVersion === profile.sourcePlanVersion ? profile.sourcePlanVersion : 'unsupported',
    normalizationState: dedupedIssues.length === 0 ? 'canonical_graph_ready' : 'rejected',
    nodeCount: canonicalGraph ? (canonicalGraph.nodes as unknown[]).length : nodeEntries.length,
    relationCount: canonicalGraph ? (canonicalGraph.relations as unknown[]).length : 0,
    issueCount: dedupedIssues.length,
    issues: dedupedIssues,
    canonicalGraphHash: canonicalGraph?.graphHash ?? null,
    canonicalGraph,
  };
  validateGoalContractSchema('standalone-source-plan-lint-result.schema.json', result);
  return Object.freeze(result);
}

function buildCanonicalGraph(metadata: PlainRecord, entries: { fence: SourcePlanFence; data: PlainRecord }[], referenceFields: Record<string, string[]>): PlainRecord {
  const nodes = entries.map(({ data, fence }) => {
    const references = Object.fromEntries(Object.keys(referenceFields).filter((field) => !['ownerRef'].includes(field) && strings(data[field]).length > 0).map((field) => [field, strings(data[field])]));
    const excluded = new Set(['kind', 'id', 'title', 'statement', 'normativeStrength', 'polarity', 'applicability', 'scope', 'aliases', 'ownerRef', ...Object.keys(referenceFields)]);
    const attributes = Object.fromEntries(Object.entries(data).filter(([field]) => !excluded.has(field)));
    return { id: data.id, kind: data.kind, title: data.title, statement: data.statement, normativeStrength: data.normativeStrength, polarity: data.polarity, applicability: data.applicability, scope: data.scope, aliases: strings(data.aliases), ownerRef: typeof data.ownerRef === 'string' ? data.ownerRef : null, references, attributes, sourceSpanRefs: [fence.spanId] };
  }).sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const relations = entries.flatMap(({ data, fence }) => Object.keys(referenceFields).flatMap((field) => strings(data[field]).map((toRef) => ({ id: relationId(RELATION_TYPES[field], String(data.id), toRef, String(data.scope)), type: RELATION_TYPES[field], fromRef: data.id, toRef, scope: data.scope, sourceSpanRefs: [fence.spanId] })))).sort((left, right) => left.id.localeCompare(right.id));
  const aliases = entries.flatMap(({ data, fence }) => strings(data.aliases).map((alias) => ({ alias, canonicalRef: data.id, sourceSpanRefs: [fence.spanId] }))).sort((left, right) => left.alias.localeCompare(right.alias));
  const graph: PlainRecord = { schemaVersion: 'CanonicalRequirementGraph/v1', sourcePlanId: metadata.sourcePlanId, sourcePlanVersion: metadata.sourcePlanVersion, goal: metadata.goal, scope: strings(metadata.scope), nonGoals: strings(metadata.nonGoals), nodes, relations, aliases, graphHash: '' };
  graph.graphHash = semanticGraphHash(graph);
  validateGoalContractSchema('canonical-requirement-graph.schema.json', graph);
  return graph;
}

function lintStandaloneSourcePlanFile(sourcePath: string): PlainRecord {
  return lintStandaloneSourcePlan({ sourcePath, rawBytes: fs.readFileSync(sourcePath) });
}

module.exports = {
  lintStandaloneSourcePlan,
  lintStandaloneSourcePlanFile,
};
