const path = require('node:path');
const { sha256Text, stableStringify } = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);
const { compileOrderedSourceSnapshotSet, compileSourceSnapshot } = require(
  __filename.endsWith('.ts')
    ? './control-plane/source-snapshot.ts'
    : './control-plane/source-snapshot'
);
const { compileSpecSpanRegistry } = require(
  __filename.endsWith('.ts')
    ? './control-plane/spec-span-registry.ts'
    : './control-plane/spec-span-registry'
);
const { validateDeterministicSourceObligations } = require(
  __filename.endsWith('.ts')
    ? './non-deterministic-source-validator.ts'
    : './non-deterministic-source-validator'
);
const { compileSourceBlocks, typedIdKind } = require(
  __filename.endsWith('.ts') ? './source-normative-blocks.ts' : './source-normative-blocks'
);
const { attachSourceExecutionSemantics } = require(
  __filename.endsWith('.ts') ? './source-execution-semantics.ts' : './source-execution-semantics'
);

export type GoalContractSourceObligationExtractorModule = never;

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function normalizeLineEndings(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function frozenSnapshotBytes(snapshot) {
  if (typeof snapshot?.frozenBytesBase64 === 'string') {
    return Buffer.from(snapshot.frozenBytesBase64, 'base64');
  }
  if (snapshot?.segments?.length === 1) {
    return Buffer.from(snapshot.segments[0].content, 'utf8');
  }
  throw failure('source_snapshot_invalid', {
    reason: 'frozen_source_bytes_missing',
  });
}

function canonicalSnapshotSet(snapshot) {
  const rawBytes = frozenSnapshotBytes(snapshot);
  return compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: snapshot.sourceKind || 'source_plan',
        sourceArtifactId: snapshot.sourceArtifactId || snapshot.sourcePath,
        sourceRole: snapshot.sourceRole || 'primary_implementation_authority',
        namespace: snapshot.namespace || 'PRIMARY',
        sourceOrder: snapshot.sourceOrder ?? 0,
        pathOrSegmentId: snapshot.pathOrSegmentId || snapshot.sourcePath,
        rawBytes,
        sourcePlanSemanticHash: snapshot.sourcePlanSemanticHash,
      },
    ],
  });
}

function lineText(snapshot, lineNumber, sourceBytes) {
  const line = snapshot.lineIndex[lineNumber - 1];
  if (!line) {
    throw failure('source_obligation_range_invalid', { lineNumber });
  }
  return sourceBytes.subarray(line.startByte, line.contentEndByte).toString('utf8');
}

function sourceByteRange(snapshot, sourceBytes, base) {
  const firstLine = snapshot.lineIndex[base.lineStart - 1];
  const lastLine = snapshot.lineIndex[base.lineEnd - 1];
  if (!firstLine || !lastLine) {
    throw failure('source_obligation_range_invalid', {
      lineStart: base.lineStart,
      lineEnd: base.lineEnd,
    });
  }
  if (base.lineStart !== base.lineEnd) {
    const startByte = firstLine.startByte;
    const endByteExclusive = lastLine.contentEndByte;
    return {
      startByte,
      endByteExclusive,
      authorityText: normalizeLineEndings(
        sourceBytes.subarray(startByte, endByteExclusive).toString('utf8')
      ).trim(),
    };
  }
  const exactLine = lineText(snapshot, base.lineStart, sourceBytes);
  const needle = String(base.text).trim();
  const characterOffset = exactLine.indexOf(needle);
  if (characterOffset < 0) {
    const authorityText = exactLine.trim();
    const authorityCharacterOffset = exactLine.indexOf(authorityText);
    const startByte =
      firstLine.startByte + Buffer.byteLength(exactLine.slice(0, authorityCharacterOffset), 'utf8');
    return {
      startByte,
      endByteExclusive: startByte + Buffer.byteLength(authorityText, 'utf8'),
      authorityText,
    };
  }
  const startByte =
    firstLine.startByte + Buffer.byteLength(exactLine.slice(0, characterOffset), 'utf8');
  return {
    startByte,
    endByteExclusive: startByte + Buffer.byteLength(needle, 'utf8'),
    authorityText: needle,
  };
}

function classifyHeading(headingPath) {
  const nearest = String(headingPath.at(-1) || '').toLowerCase();
  if (/file map|files? to (add|modify)|path list/u.test(nearest)) return 'file_map';
  if (/completion evidence|completion criteria|acceptance criteria/u.test(nearest))
    return 'completion_criteria';
  if (/release|public release/u.test(nearest)) return 'release_gate';
  if (/risk|failure|rollback|stop condition|recovery/u.test(nearest)) return 'failure_handling';
  if (/observability|receipt|evidence|log/u.test(nearest)) return 'observability';
  if (/public[- ]surface|install surface|skill surface/u.test(nearest))
    return 'public_surface_scan';
  if (/\btasks?\b|implementation (?:rules?|steps?|tasks?)|task breakdown/u.test(nearest)) {
    return 'heading_execution_segment';
  }
  return 'heading_requirement';
}

function classifyText(text, headingPath) {
  const lower = `${headingPath.at(-1) || ''} ${text}`.toLowerCase();
  if (/```|npm |npx |node |pwsh|powershell|vitest|rg /u.test(lower)) return 'command_block';
  if (/file map|create `|modify `|path|packages\/|_bmad\/|tests\//u.test(lower)) return 'file_map';
  if (/completion evidence|completion criteria|acceptance|must exist|done/u.test(lower))
    return 'completion_criteria';
  if (/release|publication|publish/u.test(lower)) return 'release_gate';
  if (/risk|fail|failure|stop|rollback|recover|blocked/u.test(lower)) return 'failure_handling';
  if (/observability|receipt|evidence|log|hash/u.test(lower)) return 'observability';
  if (/surface|install|consumer|codex|cursor|claude/u.test(lower)) return 'public_surface_scan';
  return classifyHeading(headingPath);
}

function isTaskExecutionMetadataLine(text) {
  return /^\s*\*{0,2}(?:Execution Class|Owned Production Paths|Aggregate Gate Phase|Aggregate Validation Commands)\*{0,2}\s*[:：]/iu.test(
    text
  );
}

function isReadinessSupersessionLine(text) {
  return (
    /\bE04\b/iu.test(text) &&
    /supersed|historical evidence|latest-hash|执行效力|历史证据|不得继续作为|不得继续授权/iu.test(
      text
    )
  );
}

function parseDeclaredId(text) {
  const listMatch = /^(?:[-*]|\d+\.)\s+(\[[ xX]\]\s*)?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b(.*)$/u.exec(
    text
  );
  if (listMatch && (listMatch[1] || /^\s*[:：]/u.test(listMatch[3]))) {
    return listMatch[2];
  }
  const taskHeadingMatch = /^Task\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(text);
  if (taskHeadingMatch) return taskHeadingMatch[1];
  const declaredHeadingMatch =
    /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\s*[:：]\s*\S/u.exec(text);
  return declaredHeadingMatch?.[1] || null;
}

function classifyDeclaredObligation(text, headingPath, fallbackKind) {
  const declaredId = parseDeclaredId(text);
  if (typedIdKind(declaredId || '') === 'task') return 'declared_execution_task';
  if (/^AC-/u.test(declaredId || '')) return 'acceptance_condition';
  if (/^EVD-/u.test(declaredId || '')) return 'evidence_contract';
  if (/^CMD-/u.test(declaredId || '')) return 'verification_command';
  if (
    declaredId &&
    (new RegExp(
      `^Task\\s+${declaredId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`,
      'u'
    ).test(text) ||
      new RegExp(
        `^${declaredId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*[:：]`,
        'u'
      ).test(text)) &&
    /-T\d+[A-Z]?$/u.test(declaredId)
  ) {
    return 'declared_execution_task';
  }
  const nearestHeading = String(headingPath.at(-1) || '').toLowerCase();
  if (/^task\s+[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/u.test(nearestHeading)) {
    return 'declared_execution_task';
  }
  if (/\bacceptance\b/u.test(nearestHeading)) return 'acceptance_condition';
  if (/\bcommands?\b/u.test(nearestHeading)) return 'verification_command';
  if (/\bevidence\b|\breceipt\b/u.test(nearestHeading)) {
    return 'evidence_contract';
  }
  if (/\btasks?\b|\bimplementation\b/u.test(nearestHeading)) {
    return 'declared_execution_task';
  }
  const normalizedText = text.toLowerCase();
  if (/\bacceptance\b/u.test(normalizedText)) return 'acceptance_condition';
  if (/\bcommands?\b|\brun\b/u.test(normalizedText)) {
    return 'verification_command';
  }
  if (/\bevidence\b|\breceipt\b/u.test(normalizedText)) {
    return 'evidence_contract';
  }
  return fallbackKind;
}

function isExplicitTaskHeading(obligation) {
  if (!obligation.declaredId) return false;
  if (typedIdKind(obligation.id) === 'task') return true;
  const escapedId = obligation.id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return (
    new RegExp(`^Task\\s+${escapedId}\\b`, 'u').test(obligation.exactText) ||
    (/-T\d+[A-Z]?$/u.test(obligation.id) &&
      new RegExp(`^${escapedId}\\s*[:：]`, 'u').test(obligation.exactText))
  );
}

function extractReferencedIds(text, declaredId) {
  return [
    ...new Set(
      [...text.matchAll(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/gu)]
        .map((match) => match[0])
        .filter((id) => id !== declaredId)
    ),
  ].sort();
}

function extractDependencyRefs(text, declaredId) {
  const relationPatterns = [
    /\bdepends?\s+on\s+([^.;\n]+)/giu,
    /\bdependencies?\s*:\s*([^.;\n]+)/giu,
    /(?:前置(?:任务)?|依赖)\s*[:：]\s*([^。；\n]+)/gu,
  ];
  return [
    ...new Set(
      relationPatterns.flatMap((pattern) =>
        [...text.matchAll(pattern)].flatMap((match) => extractReferencedIds(match[1], declaredId))
      )
    ),
  ].sort();
}

function arrowTaskDependencyMap(sourceObligations) {
  const taskIdPattern = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\\d+[A-Z]?';
  const chainPattern = new RegExp(
    `^\\s*(${taskIdPattern}(?:\\s*(?:->|→|=>)\\s*${taskIdPattern})+)\\s*$`,
    'u'
  );
  const taskPattern = new RegExp(taskIdPattern, 'gu');
  const knownTaskIds = new Set(
    sourceObligations
      .filter(
        (obligation) =>
          obligation.declaredId &&
          obligation.kind === 'declared_execution_task'
      )
      .map((obligation) => obligation.id)
  );
  const dependenciesByTaskId = new Map(
    [...knownTaskIds].map((taskId) => [taskId, []])
  );
  const unknownDependencies = [];
  for (const obligation of sourceObligations) {
    for (const line of String(obligation.exactText || '').split(/\r?\n/gu)) {
      const chain = chainPattern.exec(line);
      if (!chain) continue;
      const taskIds = [...chain[1].matchAll(taskPattern)].map(
        (match) => match[0]
      );
      for (let index = 1; index < taskIds.length; index += 1) {
        const dependencyId = taskIds[index - 1];
        const sourceId = taskIds[index];
        if (
          !knownTaskIds.has(sourceId) ||
          !knownTaskIds.has(dependencyId)
        ) {
          unknownDependencies.push({ sourceId, dependencyId });
          continue;
        }
        dependenciesByTaskId.set(
          sourceId,
          [
            ...new Set([
              ...(dependenciesByTaskId.get(sourceId) || []),
              dependencyId,
            ]),
          ].sort()
        );
      }
    }
  }
  if (unknownDependencies.length > 0) {
    throw failure('source_obligation_dependency_unknown', {
      unknownDependencies: unknownDependencies.sort(
        (left, right) =>
          left.sourceId.localeCompare(right.sourceId, 'en') ||
          left.dependencyId.localeCompare(right.dependencyId, 'en')
      ),
    });
  }
  return dependenciesByTaskId;
}

function projectArrowTaskDependencies(sourceObligations) {
  const dependenciesByTaskId = arrowTaskDependencyMap(sourceObligations);
  return sourceObligations.map((obligation) => {
    const arrowDependencies = dependenciesByTaskId.get(obligation.id) || [];
    if (arrowDependencies.length === 0) return obligation;
    return {
      ...obligation,
      dependencyRefs: [
        ...new Set([...obligation.dependencyRefs, ...arrowDependencies]),
      ].sort(),
    };
  });
}

function materializeLeadingCorrectionObligations(sourceObligations) {
  const materializedIds = new Set();
  return sourceObligations.map((obligation) => {
    const match =
      /^`(ER-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)`\s+(?:is\b|requires\b)/u.exec(
        obligation.exactText
      );
    const correctionId = match?.[1];
    if (!correctionId || materializedIds.has(correctionId)) {
      return obligation;
    }
    materializedIds.add(correctionId);
    const withoutSelf = (values) =>
      values.filter((value) => value !== correctionId);
    return {
      ...obligation,
      id: correctionId,
      declaredId: true,
      taskRefs: withoutSelf(obligation.taskRefs),
      acceptanceRefs: withoutSelf(obligation.acceptanceRefs),
      commandRefs: withoutSelf(obligation.commandRefs),
      evidenceRefs: withoutSelf(obligation.evidenceRefs),
      dependencyRefs: withoutSelf(obligation.dependencyRefs),
      atomicGroupRefs: withoutSelf(obligation.atomicGroupRefs),
    };
  });
}

function deterministicValidationKind(kind) {
  return (
    {
      declared_execution_task: 'heading_execution_segment',
      acceptance_condition: 'completion_criteria',
      verification_command: 'command_block',
      evidence_contract: 'observability',
    }[kind] || kind
  );
}

function validateStructuredSourceObligations(sourceObligations) {
  const validationObligations = sourceObligations.filter((obligation) => obligation.normativeStrength === 'must').map((obligation) => ({
    ...obligation,
    kind: deterministicValidationKind(obligation.kind),
  }));
  try {
    validateDeterministicSourceObligations(validationObligations);
  } catch (error) {
    const original = sourceObligations.find((obligation) => obligation.id === error.sourceId);
    if (original) error.sourceExcerpt = original.text.slice(0, 500);
    throw error;
  }
}

function makeObligation(index, base, snapshot, legacyIds) {
  const exactText = normalizeLineEndings(base.text).trim();
  const text = exactText;
  const identityText = normalizeLineEndings(base.authorityText || exactText).trim();
  const textHash = sha256Text(text);
  const sourceRef = `${base.sourcePlanPath}:${base.lineStart}-${base.lineEnd}`;
  const declaredId = legacyIds ? null : base.declaredId || parseDeclaredId(text);
  const refsOfKind = (kind) => [...new Set((base.typedRefs || [])
    .filter((ref) => ref.kind === kind).map((ref) => ref.targetId))].sort();
  const id = declaredId
    ? declaredId
    : legacyIds
      ? `SRC${String(index + 1).padStart(3, '0')}`
      : `SRC-${sha256Text(`${snapshot.aggregateHash}:${base.lineStart}:${identityText}`)
          .slice(7, 19)
          .toUpperCase()}`;
  return {
    id,
    declaredId: Boolean(declaredId),
    kind: declaredId ? classifyDeclaredObligation(text, base.headingPath, base.kind) : base.kind,
    normativeStrength: base.semanticSummary.normativeStrength,
    polarity: base.semanticSummary.polarity,
    sourcePlanPath: base.sourcePlanPath,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourcePlanHash: snapshot.aggregateHash,
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceRole: snapshot.sourceRole,
    namespace: snapshot.namespace,
    sourceOrder: snapshot.sourceOrder,
    lineStart: base.lineStart,
    lineEnd: base.lineEnd,
    startByte: base.startByte,
    endByteExclusive: base.endByteExclusive,
    headingPath: base.headingPath,
    textHash,
    exactText,
    applicabilityState: base.semanticSummary.applicabilityState,
    taskRefs: refsOfKind('task'),
    acceptanceRefs: refsOfKind('acceptance'),
    commandRefs: refsOfKind('command'),
    evidenceRefs: refsOfKind('evidence'),
    dependencyRefs: base.dependencyRefs || extractDependencyRefs(text, declaredId),
    atomicGroupRefs: refsOfKind('atomic_group'),
    releaseRelevance: base.kind === 'release_gate',
    text,
    summary: `sourceRef=${sourceRef}; sourceKind=${base.kind}; sourceTextHash=${textHash}`,
    required: base.semanticSummary.required,
    semanticResolution: base.semanticSummary.semanticResolution,
    sourceBlockRefs: base.sourceBlockRefs || [],
    clauseRefs: base.clauseRefs || [],
    typedRefs: base.typedRefs || [],
  };
}

function aggregateBlockSemantics(block) {
  const clauses = block.clauses;
  const unresolved = clauses.some((clause) => clause.polarity === 'unresolved') || block.disposition === 'unresolved';
  const conditional = clauses.some((clause) => clause.conditions.some((condition) =>
    ['source_condition', 'source_confirmation_gate', 'current_authoring_round'].includes(condition.kind)));
  const modes = [...new Set(clauses.map((clause) => clause.polarity))];
  const polarity = unresolved ? 'unresolved' : modes.length > 1 ? 'mixed' : modes[0]
    || (typedIdKind(block.declaredId || '') === 'task' ? 'required' : 'descriptive');
  const strength = unresolved ? 'unresolved' : polarity === 'mixed' ? 'mixed'
    : polarity === 'descriptive' ? 'descriptive' : /\bshould\b|建议/iu.test(block.text) ? 'should'
      : polarity === 'permitted' ? 'may' : 'must';
  const applicabilityState = unresolved ? 'unresolved' : conditional ? 'conditional' : 'applicable';
  return { polarity, normativeStrength: strength, applicabilityState,
    required: strength === 'must' && applicabilityState === 'applicable',
    semanticResolution: { status: unresolved ? 'unresolved' : polarity === 'mixed' ? 'mixed' : 'source_backed',
      sourceBlockRefs: [block.id], clauseRefs: clauses.map((clause) => clause.id),
      ruleId: clauses.length ? 'aggregate-source-clause-modalities/v1' : 'declared-source-identity/v1' } };
}

function canonicalSourceObligationGraph({
  sourceSnapshotHash,
  sourceObligations,
  specSpanRegistryHash,
  sourceCoverage = undefined,
  sourceRelations = undefined,
}) {
  if (typeof sourceSnapshotHash !== 'string' || !Array.isArray(sourceObligations)) {
    throw failure('source_obligation_graph_invalid');
  }
  const obligationRegistryHashes = [
    ...new Set(
      sourceObligations.map((obligation) => obligation.specSpanRegistryHash).filter(Boolean)
    ),
  ];
  if (obligationRegistryHashes.length > 1) {
    throw failure('source_obligation_graph_invalid', {
      reason: 'multiple_spec_span_registries',
    });
  }
  const effectiveSpecSpanRegistryHash = specSpanRegistryHash || obligationRegistryHashes[0];
  return {
    schemaVersion: 'goal-contract-source-obligation-graph/v1',
    sourceSnapshotHash,
    ...(effectiveSpecSpanRegistryHash
      ? { specSpanRegistryHash: effectiveSpecSpanRegistryHash }
      : {}),
    ...(sourceCoverage ? { sourceCoverage } : {}),
    ...(sourceRelations ? { sourceRelationsHash: sha256Text(stableStringify(sourceRelations)) } : {}),
    obligations: sourceObligations
      .map((obligation) => {
        const sourceBinding = obligation.sourceArtifactId
          ? {
              sourceArtifactId: obligation.sourceArtifactId,
              sourceRole: obligation.sourceRole,
              namespace: obligation.namespace,
              sourceOrder: obligation.sourceOrder,
              startByte: obligation.startByte,
              endByteExclusive: obligation.endByteExclusive,
              exactTextHash: obligation.exactTextHash,
              normalizedTextHash: obligation.normalizedTextHash,
              specSpanRefs: [...obligation.specSpanRefs].sort(),
              specSpanRegistryHash: obligation.specSpanRegistryHash,
            }
          : {};
        return {
          id: obligation.id,
          declaredId: obligation.declaredId,
          kind: obligation.kind,
          normativeStrength: obligation.normativeStrength,
          polarity: obligation.polarity,
          semanticResolution: obligation.semanticResolution,
          sourcePlanPath: obligation.sourcePlanPath,
          lineStart: obligation.lineStart,
          lineEnd: obligation.lineEnd,
          headingPath: [...obligation.headingPath],
          textHash: obligation.textHash,
          applicabilityState: obligation.applicabilityState,
          taskRefs: [...obligation.taskRefs].sort(),
          acceptanceRefs: [...obligation.acceptanceRefs].sort(),
          commandRefs: [...obligation.commandRefs].sort(),
          evidenceRefs: [...obligation.evidenceRefs].sort(),
          dependencyRefs: [...obligation.dependencyRefs].sort(),
          atomicGroupRefs: [...obligation.atomicGroupRefs].sort(),
          releaseRelevance: obligation.releaseRelevance,
          sourceBlockRefs: [...(obligation.sourceBlockRefs || [])].sort(),
          clauseRefs: [...(obligation.clauseRefs || [])].sort(),
          typedRefs: obligation.typedRefs || [],
          ...sourceBinding,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function hashSourceObligationGraph(graph) {
  return sha256Text(stableStringify(graph));
}

type CanonicalSourceSnapshot = ReturnType<typeof compileSourceSnapshot>;

function extractSourceObligations(
  input: {
    snapshot?: CanonicalSourceSnapshot;
    sourcePath?: string;
    sourceText?: string;
  } = {}
) {
  const legacyIds = !input.snapshot;
  let snapshot = input.snapshot;
  if (!snapshot) {
    if (typeof input.sourcePath !== 'string' || input.sourcePath.trim() === '') {
      throw new Error('sourcePath is required');
    }
    if (typeof input.sourceText !== 'string') {
      throw new Error('sourceText is required');
    }
    snapshot = compileSourceSnapshot({
      sourceKind: 'source_plan',
      sourceArtifactId: input.sourcePath.split(path.sep).join('/'),
      sourceRole: 'primary_implementation_authority',
      namespace: 'PRIMARY',
      sourceOrder: 0,
      pathOrSegmentId: input.sourcePath,
      rawBytes: Buffer.from(input.sourceText, 'utf8'),
    });
  }
  if (
    snapshot.sourceType !== 'source_plan' ||
    !snapshot.aggregateHash ||
    !Array.isArray(snapshot.segments) ||
    snapshot.segments.length !== 1
  ) {
    throw failure('source_snapshot_invalid');
  }

  const snapshotSet = canonicalSnapshotSet(snapshot);
  snapshot = snapshotSet.sourceSnapshots[0];
  const sourceBytes = frozenSnapshotBytes(snapshot);
  const sourcePlanPath = snapshot.sourcePath.split(path.sep).join('/');
  const { sourceBlocks, sourceRelations, sourceCoverage, sourceClauseCoverage, sourceClauseCoverageSummary } = compileSourceBlocks({ snapshot, sourceBytes });
  const excluded = new Set(['metadata', 'layout', 'example', 'background', 'baseline_fact', 'observed_deviation',
    'observed_user_issue', 'historical_evidence', 'review_pending']);
  const rawObligations = sourceBlocks.filter((block) => !excluded.has(block.disposition)
    && (block.disposition !== 'structure' || block.declaredId)).map((block) => {
    const text = block.kind === 'heading' ? block.text.trim().replace(/^#+\s+/u, '') : block.text.trim();
    let kind = block.disposition === 'command_declaration' ? block.kind === 'fence' ? 'command_block' : 'verification_command'
      : block.kind === 'fence' ? 'normative_content' : classifyText(text, block.headingPath);
    if (block.kind === 'blockquote') kind = 'heading_requirement';
    if (isTaskExecutionMetadataLine(text)) kind = 'task_execution_role';
    if (isReadinessSupersessionLine(text)) kind = 'authority_supersession';
    const base = { sourcePlanPath, kind, text, declaredId: block.declaredId, headingPath: block.headingPath,
      lineStart: block.sourceRef.lineStart, lineEnd: block.sourceRef.lineEnd,
      sourceBlockRefs: [block.id], clauseRefs: block.clauses.map((clause) => clause.id), typedRefs: block.typedRefs,
      semanticSummary: aggregateBlockSemantics(block),
      dependencyRefs: block.fieldRole === 'dependencies' ? block.typedRefs.filter((ref) => ref.kind === 'dependency').map((ref) => ref.targetId) : undefined };
    return { ...base, ...sourceByteRange(snapshot, sourceBytes, base) };
  });

  let sourceObligations = rawObligations
    .filter((item) => item.text && item.text.trim())
    .map((item, index) => makeObligation(index, item, snapshot, legacyIds));
  sourceObligations =
    materializeLeadingCorrectionObligations(sourceObligations);
  if (sourceObligations.some(isExplicitTaskHeading)) {
    sourceObligations = sourceObligations.map((obligation) =>
      obligation.kind === 'declared_execution_task' && !isExplicitTaskHeading(obligation)
        ? {
            ...obligation,
            kind: classifyText(obligation.exactText, obligation.headingPath),
          }
        : obligation
    );
  }
  sourceObligations = projectArrowTaskDependencies(sourceObligations);
  const refArrays = { task: 'taskRefs', acceptance: 'acceptanceRefs', command: 'commandRefs',
    evidence: 'evidenceRefs', dependency: 'dependencyRefs', atomic_group: 'atomicGroupRefs' };
  sourceObligations = sourceObligations.map((obligation) => {
    const edges = sourceRelations.filter((edge) => edge.fromType === 'obligation' && edge.fromId === obligation.id);
    const typedRefs = [...obligation.typedRefs];
    for (const edge of edges) {
      const ref = { kind: edge.kind, targetId: edge.toId, sourceBlockRefs: edge.sourceBlockRefs,
        relation: edge.relation || 'declared', ...(edge.pathRole ? { pathRole: edge.pathRole } : {}),
        ...(edge.declaredCommandRef ? { declaredCommandRef: edge.declaredCommandRef } : {}) };
      if (!typedRefs.some((item) => stableStringify(item) === stableStringify(ref))) typedRefs.push(ref);
    }
    const updated = { ...obligation, typedRefs };
    for (const [kind, field] of Object.entries(refArrays)) {
      updated[field] = [...new Set([...obligation[field], ...edges.filter((edge) => edge.kind === kind).map((edge) => edge.toId)])].sort();
    }
    const resolvedCommandAliases = new Set(typedRefs.filter((ref) => ref.kind === 'command' && ref.declaredCommandRef)
      .map((ref) => ref.declaredCommandRef));
    updated.commandRefs = updated.commandRefs.filter((id) => !resolvedCommandAliases.has(id));
    return updated;
  });

  const declaredIds = sourceObligations.filter((item) => item.declaredId).map((item) => item.id);
  const duplicateIds = [
    ...new Set(declaredIds.filter((id, index) => declaredIds.indexOf(id) !== index)),
  ].sort();
  if (duplicateIds.length > 0) {
    throw failure('source_obligation_id_duplicate', { duplicateIds });
  }
  const knownIds = new Set(sourceObligations.map((item) => item.id));
  const unknownDependencies = sourceObligations.flatMap((item) =>
    item.dependencyRefs
      .filter((dependencyId) => !knownIds.has(dependencyId))
      .map((dependencyId) => ({ sourceId: item.id, dependencyId }))
  );
  if (unknownDependencies.length > 0) {
    throw failure('source_obligation_dependency_unknown', {
      unknownDependencies,
    });
  }

  try {
    validateStructuredSourceObligations(sourceObligations);
  } catch (error) {
    if (!legacyIds && error.failureClass === 'non_deterministic_source_obligation') {
      throw failure('source_obligation_classification_ambiguous', {
        sourceId: error.sourceId,
        lineStart: error.lineStart,
        lineEnd: error.lineEnd,
        matchedPhrase: error.matchedPhrase,
        sourceExcerpt: error.sourceExcerpt,
        repairHint: error.repairHint,
      });
    }
    throw error;
  }

  const specSpanRegistry = compileSpecSpanRegistry({
    orderedSourceSnapshotSet: snapshotSet,
    spans: sourceObligations.map((obligation) => ({
      sourceArtifactId: snapshot.sourceArtifactId,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
      namespace: snapshot.namespace,
      startByte: obligation.startByte,
      endByteExclusive: obligation.endByteExclusive,
      headingPath: obligation.headingPath,
      sourceObligationIds: [obligation.id],
    })),
  });
  const spanByObligationId = new Map(
    specSpanRegistry.specSpans.flatMap((span) => span.sourceObligationIds.map((id) => [id, span]))
  );
  const boundSourceObligations = attachSourceExecutionSemantics(sourceObligations.map((obligation) => {
    const span = spanByObligationId.get(obligation.id);
    if (!span) {
      throw failure('source_obligation_spec_span_missing', {
        sourceObligationId: obligation.id,
      });
    }
    return {
      ...obligation,
      exactTextHash: span.exactTextHash,
      normalizedTextHash: span.normalizedTextHash,
      specSpanRefs: [span.specSpanId],
      specSpanRegistryHash: specSpanRegistry.specSpanRegistryHash,
      sourceReference: {
        sourceArtifactId: snapshot.sourceArtifactId,
        sourceSnapshotHash: snapshot.sourceSnapshotHash,
        specSpanRegistryHash: specSpanRegistry.specSpanRegistryHash,
      },
    };
  }), sourceBlocks);
  // Source blocks and typed declarations remain lossless, but relationship-only
  // declarations are not independent goal obligations. Keep them available for
  // command/path/evidence binding while exposing the sparse semantic view to
  // authority compilers.
  const semanticObligations = boundSourceObligations.filter((obligation) =>
    !['binding', 'definition'].includes(obligation.executionRole)
  );
  const sourceObligationGraph = canonicalSourceObligationGraph({
    sourceSnapshotHash: snapshot.aggregateHash,
      sourceObligations: boundSourceObligations,
    specSpanRegistryHash: specSpanRegistry.specSpanRegistryHash,
    sourceCoverage,
    sourceRelations,
  });
  return {
    sourcePlanPath,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourcePlanHash: snapshot.aggregateHash,
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceRole: snapshot.sourceRole,
    namespace: snapshot.namespace,
    sourceOrder: snapshot.sourceOrder,
    sourceBytes: snapshot.sourceBytes,
    sourceLines: snapshot.sourceLines,
    sourceObligations: boundSourceObligations,
    semanticObligations,
    specSpanRegistry,
    specSpanRegistryHash: specSpanRegistry.specSpanRegistryHash,
    sourceObligationGraph,
    sourceObligationGraphHash: hashSourceObligationGraph(sourceObligationGraph),
    sourceBlocks,
    sourceRelations,
    sourceCoverage,
    sourceClauseCoverage,
    sourceClauseCoverageSummary,
    diagnostics: {
      obligationCount: sourceObligations.length,
      semanticObligationCount: semanticObligations.length,
      sourceClauseCount: sourceClauseCoverage.length,
      semanticClauseCount: semanticObligations.reduce((count, obligation) => count + (obligation.normativeClauses || []).length, 0),
      excludedDeclarationCount: sourceObligations.length - semanticObligations.length,
    },
  };
}

module.exports = {
  canonicalSourceObligationGraph,
  classifyHeading,
  classifyText,
  extractSourceObligations,
  hashSourceObligationGraph,
  normalizeLineEndings,
};
