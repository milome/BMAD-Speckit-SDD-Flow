const path = require('node:path');
const { sha256Text, stableStringify } = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);
const { buildSourceSnapshot } = require(
  __filename.endsWith('.ts')
    ? './dual-view-derivation.ts'
    : './dual-view-derivation'
);
const {
  findNonDeterministicPhrase,
  validateDeterministicSourceObligations,
} = require(
  __filename.endsWith('.ts')
    ? './non-deterministic-source-validator.ts'
    : './non-deterministic-source-validator'
);

export type GoalContractSourceObligationExtractorModule = never;

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function normalizeLineEndings(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function classifyHeading(headingPath) {
  const nearest = String(headingPath.at(-1) || '').toLowerCase();
  if (/file map|files? to (add|modify)|path list/u.test(nearest)) return 'file_map';
  if (/completion evidence|completion criteria|acceptance criteria/u.test(nearest)) return 'completion_criteria';
  if (/release|public release/u.test(nearest)) return 'release_gate';
  if (/risk|failure|rollback|stop condition|recovery/u.test(nearest)) return 'failure_handling';
  if (/observability|receipt|evidence|log/u.test(nearest)) return 'observability';
  if (/public[- ]surface|install surface|skill surface/u.test(nearest)) return 'public_surface_scan';
  if (
    /\btasks?\b|implementation (?:rules?|steps?|tasks?)|task breakdown/u.test(
      nearest
    )
  ) {
    return 'heading_execution_segment';
  }
  return 'heading_requirement';
}

function classifyText(text, headingPath) {
  const lower = `${headingPath.at(-1) || ''} ${text}`.toLowerCase();
  if (/```|npm |npx |node |pwsh|powershell|vitest|rg /u.test(lower)) return 'command_block';
  if (/file map|create `|modify `|path|packages\/|_bmad\/|tests\//u.test(lower)) return 'file_map';
  if (/completion evidence|completion criteria|acceptance|must exist|done/u.test(lower)) return 'completion_criteria';
  if (/release|publication|publish/u.test(lower)) return 'release_gate';
  if (/risk|fail|failure|stop|rollback|recover|blocked/u.test(lower)) return 'failure_handling';
  if (/observability|receipt|evidence|log|hash/u.test(lower)) return 'observability';
  if (/surface|install|consumer|codex|cursor|claude/u.test(lower)) return 'public_surface_scan';
  return classifyHeading(headingPath);
}

function parseDeclaredId(text) {
  const listMatch =
    /^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(
      text
    );
  if (listMatch) return listMatch[1];
  const taskHeadingMatch =
    /^Task\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(text);
  return taskHeadingMatch?.[1] || null;
}

function classifyDeclaredObligation(text, headingPath, fallbackKind) {
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
        [...text.matchAll(pattern)].flatMap((match) =>
          extractReferencedIds(match[1], declaredId)
        )
      )
    ),
  ].sort();
}

function normalizeDeterministicNormativeLanguage(text) {
  return String(text)
    .replace(/\bmay\b/giu, 'permits')
    .replace(/\bshould\b/giu, 'recommends')
    .replace(/\ballowed values?\b/giu, 'permitted values')
    .replace(/\bis allowed\b/giu, 'is permitted')
    .replace(
      /\boptional(?=\s+`--[^`]+`[^.\n]*(?:otherwise|default))/giu,
      'conditional'
  );
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
    text: findNonDeterministicPhrase(obligation.text)
      ? normalizeDeterministicNormativeLanguage(obligation.text)
      : obligation.text,
  }));
  try {
    validateDeterministicSourceObligations(validationObligations);
  } catch (error) {
    const original = sourceObligations.find(
      (obligation) => obligation.id === error.sourceId
    );
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
  const text = normalizeLineEndings(base.text).trim();
  const textHash = sha256Text(text);
  const sourceRef = `${base.sourcePlanPath}:${base.lineStart}-${base.lineEnd}`;
  const declaredId = legacyIds ? null : parseDeclaredId(text);
  const referencedIds = extractReferencedIds(text, declaredId);
  const lower = text.toLowerCase();
  const id = declaredId
    ? declaredId
    : legacyIds
      ? `SRC${String(index + 1).padStart(3, '0')}`
      : `SRC-${sha256Text(`${snapshot.aggregateHash}:${base.lineStart}:${text}`)
          .slice(7, 19)
          .toUpperCase()}`;
  return {
    id,
    declaredId: Boolean(declaredId),
    kind: declaredId
      ? classifyDeclaredObligation(text, base.headingPath, base.kind)
      : base.kind,
    normativeStrength: normativeStrength(text),
    sourcePlanPath: base.sourcePlanPath,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourcePlanHash: snapshot.aggregateHash,
    lineStart: base.lineStart,
    lineEnd: base.lineEnd,
    headingPath: base.headingPath,
    textHash,
    exactText: text,
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
}) {
  if (
    typeof sourceSnapshotHash !== 'string' ||
    !Array.isArray(sourceObligations)
  ) {
    throw failure('source_obligation_graph_invalid');
  }
  return {
    schemaVersion: 'goal-contract-source-obligation-graph/v1',
    sourceSnapshotHash,
    obligations: sourceObligations
      .map((obligation) => ({
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
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function hashSourceObligationGraph(graph) {
  return sha256Text(stableStringify(graph));
}

function extractSourceObligations(
  input: { snapshot?: any; sourcePath?: string; sourceText?: string } = {}
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
    snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: input.sourcePath,
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

  const sourceText = snapshot.segments[0].content;
  const normalized = normalizeLineEndings(sourceText);
  const lines = normalized.split('\n');
  const sourcePlanPath = snapshot.sourcePath.split(path.sep).join('/');
  const headingStack = [];
  const rawObligations = [];
  let inFence = false;
  let fenceStart = 0;
  let fenceLines = [];

  function currentHeadingPath() {
    return headingStack.map((entry) => entry.title);
  }

  function pushText(lineNumber, text, kind = null) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const headingPath = currentHeadingPath();
    rawObligations.push({
      sourcePlanPath,
      kind: kind || classifyText(trimmed, headingPath),
      lineStart: lineNumber,
      lineEnd: lineNumber,
      headingPath,
      text: trimmed,
    });
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const fenceMatch = /^(```|~~~)/u.exec(line.trim());
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceStart = lineNumber;
        fenceLines = [line];
      } else {
        fenceLines.push(line);
        rawObligations.push({
          sourcePlanPath,
          kind: 'command_block',
          lineStart: fenceStart,
          lineEnd: lineNumber,
          headingPath: currentHeadingPath(),
          text: fenceLines.join('\n'),
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
      const level = heading[1].length;
      const title = heading[2].trim();
      while (headingStack.length > 0 && headingStack.at(-1).level >= level) headingStack.pop();
      headingStack.push({ level, title });
      rawObligations.push({
        sourcePlanPath,
        kind: classifyHeading(currentHeadingPath()),
        lineStart: lineNumber,
        lineEnd: lineNumber,
        headingPath: currentHeadingPath(),
        text: title,
      });
      return;
    }

    if (/^\s*>/u.test(line)) pushText(lineNumber, line, 'heading_requirement');
    else if (/^\s*[-*]\s+|\s*\d+\.\s+/u.test(line)) pushText(lineNumber, line);
    else if (/\b(MUST|must|Run|Create|Modify|Add|Fail|Stop|release|receipt|coverage)\b/u.test(line)) {
      pushText(lineNumber, line);
    }
  });

  if (inFence) {
    rawObligations.push({
      sourcePlanPath,
      kind: 'command_block',
      lineStart: fenceStart,
      lineEnd: lines.length,
      headingPath: currentHeadingPath(),
      text: fenceLines.join('\n'),
    });
  }

  const sourceObligations = rawObligations
    .filter((item) => item.text && item.text.trim())
    .map((item, index) => makeObligation(index, item, snapshot, legacyIds));

  const declaredIds = sourceObligations
    .filter((item) => item.declaredId)
    .map((item) => item.id);
  const duplicateIds = [
    ...new Set(
      declaredIds.filter((id, index) => declaredIds.indexOf(id) !== index)
    ),
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
        matchedPhrase: error.matchedPhrase,
        sourceExcerpt: error.sourceExcerpt,
      });
    }
    throw error;
  }

  const sourceObligationGraph = canonicalSourceObligationGraph({
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligations,
  });
  return {
    sourcePlanPath,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourcePlanHash: snapshot.aggregateHash,
    sourceBytes: snapshot.sourceBytes,
    sourceLines: snapshot.sourceLines,
    sourceObligations,
    sourceObligationGraph,
    sourceObligationGraphHash: hashSourceObligationGraph(
      sourceObligationGraph
    ),
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
