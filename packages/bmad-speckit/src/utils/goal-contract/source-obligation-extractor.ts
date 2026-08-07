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
  const validationObligations = sourceObligations.map((obligation) => ({
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

function normativeStrength(text) {
  if (/\b(MUST|SHALL|required)\b|\[[ xX]\]/u.test(text)) return 'must';
  if (/\bSHOULD\b/iu.test(text)) return 'should';
  if (/\bMAY\b/iu.test(text)) return 'may';
  return 'must';
}

function makeObligation(index, base, snapshot, legacyIds) {
  const exactText = normalizeLineEndings(base.text).trim();
  const text = exactText;
  const identityText = normalizeLineEndings(base.authorityText || exactText).trim();
  const textHash = sha256Text(text);
  const sourceRef = `${base.sourcePlanPath}:${base.lineStart}-${base.lineEnd}`;
  const declaredId = legacyIds ? null : parseDeclaredId(text);
  const referencedIds = extractReferencedIds(text, declaredId);
  const lower = text.toLowerCase();
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
    normativeStrength: normativeStrength(text),
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
    applicabilityState: 'applicable',
    taskRefs: /\btask\b/u.test(lower) ? referencedIds : [],
    acceptanceRefs: /\bacceptance\b/u.test(lower) ? referencedIds : [],
    commandRefs: /\bcommand\b|\brun\b/u.test(lower) ? referencedIds : [],
    evidenceRefs: /\bevidence\b|\breceipt\b/u.test(lower) ? referencedIds : [],
    dependencyRefs: extractDependencyRefs(text, declaredId),
    atomicGroupRefs: /\batomic\s+group\b/u.test(lower) ? referencedIds : [],
    releaseRelevance: base.kind === 'release_gate',
    text,
    summary: `sourceRef=${sourceRef}; sourceKind=${base.kind}; sourceTextHash=${textHash}`,
    required: true,
  };
}

function canonicalSourceObligationGraph({
  sourceSnapshotHash,
  sourceObligations,
  specSpanRegistryHash,
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

  const classificationText = snapshot.segments[0].content;
  const snapshotSet = canonicalSnapshotSet(snapshot);
  snapshot = snapshotSet.sourceSnapshots[0];
  const sourceBytes = frozenSnapshotBytes(snapshot);
  const sourceText = classificationText;
  const normalized = normalizeLineEndings(sourceText);
  const lines = normalized.split('\n');
  const sourcePlanPath = snapshot.sourcePath.split(path.sep).join('/');
  const headingStack = [];
  const rawObligations = [];
  let inFence = false;
  let fenceStart = 0;
  let fenceLines = [];
  let proseStart = 0;
  let proseLines = [];

  function currentHeadingPath() {
    return headingStack.map((entry) => entry.title);
  }

  function pushText(lineStart, text, kind = null, lineEnd = lineStart) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const headingPath = currentHeadingPath();
    const base = {
      sourcePlanPath,
      kind: kind || classifyText(trimmed, headingPath),
      lineStart,
      lineEnd,
      headingPath,
      text: trimmed,
    };
    rawObligations.push({
      ...base,
      ...sourceByteRange(snapshot, sourceBytes, base),
    });
  }

  function isExtractableProse(text) {
    return (
      /^\s*\*{0,2}(?:依赖|dependencies?)\s*[:：]\*{0,2}/iu.test(text) ||
      /^\s*Steps\s*[:：]/iu.test(text) ||
      /^\s*Acceptance\s*[:：]/iu.test(text) ||
      /^\s*`ER-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+`\s+(?:is\b|requires\b)/u.test(
        text
      ) ||
      /\b(MUST|must|Run|Create|Modify|Add|Fail|Stop|release|receipt|coverage)\b/u.test(
        text
      )
    );
  }

  function flushProse(lineEnd) {
    if (proseLines.length === 0) return;
    const text = proseLines.join('\n');
    if (isExtractableProse(text)) {
      pushText(proseStart, text, null, lineEnd);
    }
    proseStart = 0;
    proseLines = [];
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const fenceMatch = /^(```|~~~)/u.exec(line.trim());
    if (fenceMatch) {
      flushProse(lineNumber - 1);
      if (!inFence) {
        inFence = true;
        fenceStart = lineNumber;
        fenceLines = [line];
      } else {
        fenceLines.push(line);
        const base = {
          sourcePlanPath,
          kind: 'command_block',
          lineStart: fenceStart,
          lineEnd: lineNumber,
          headingPath: currentHeadingPath(),
          text: fenceLines.join('\n'),
        };
        rawObligations.push({
          ...base,
          ...sourceByteRange(snapshot, sourceBytes, base),
        });
        inFence = false;
        fenceLines = [];
      }
      return;
    }
    if (inFence) {
      fenceLines.push(line);
      return;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      flushProse(lineNumber - 1);
      const level = heading[1].length;
      const title = heading[2].trim();
      while (headingStack.length > 0 && headingStack.at(-1).level >= level) headingStack.pop();
      headingStack.push({ level, title });
      const base = {
        sourcePlanPath,
        kind: classifyHeading(currentHeadingPath()),
        lineStart: lineNumber,
        lineEnd: lineNumber,
        headingPath: currentHeadingPath(),
        text: title,
      };
      rawObligations.push({
        ...base,
        ...sourceByteRange(snapshot, sourceBytes, base),
      });
      return;
    }

    if (line.trim() === '') {
      flushProse(lineNumber - 1);
    } else if (/^\s*>/u.test(line)) {
      flushProse(lineNumber - 1);
      pushText(lineNumber, line, 'heading_requirement');
    } else if (isTaskExecutionMetadataLine(line)) {
      flushProse(lineNumber - 1);
      pushText(lineNumber, line, 'task_execution_role');
    } else if (isReadinessSupersessionLine(line)) {
      flushProse(lineNumber - 1);
      pushText(lineNumber, line, 'authority_supersession');
    } else if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u.test(line)) {
      flushProse(lineNumber - 1);
      pushText(lineNumber, line);
    } else if (/^\s*(?:[-*_]){3,}\s*$|^\s*\|/u.test(line)) {
      flushProse(lineNumber - 1);
    } else {
      if (proseLines.length === 0) proseStart = lineNumber;
      proseLines.push(line);
    }
  });

  flushProse(lines.length);

  if (inFence) {
    const base = {
      sourcePlanPath,
      kind: 'command_block',
      lineStart: fenceStart,
      lineEnd: lines.length,
      headingPath: currentHeadingPath(),
      text: fenceLines.join('\n'),
    };
    rawObligations.push({
      ...base,
      ...sourceByteRange(snapshot, sourceBytes, base),
    });
  }

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
  const boundSourceObligations = sourceObligations.map((obligation) => {
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
  });
  const sourceObligationGraph = canonicalSourceObligationGraph({
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligations: boundSourceObligations,
    specSpanRegistryHash: specSpanRegistry.specSpanRegistryHash,
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
    specSpanRegistry,
    specSpanRegistryHash: specSpanRegistry.specSpanRegistryHash,
    sourceObligationGraph,
    sourceObligationGraphHash: hashSourceObligationGraph(sourceObligationGraph),
    diagnostics: {
      obligationCount: sourceObligations.length,
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
