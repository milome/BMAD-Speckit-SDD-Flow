const path = require('node:path');
const { sha256Text } = require(
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

function validateStructuredSourceObligations(sourceObligations) {
  const validationObligations = sourceObligations.map((obligation) => ({
    ...obligation,
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
  const declaredId = parseDeclaredId(text);
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
    kind: base.kind,
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

  return {
    sourcePlanPath,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourcePlanHash: snapshot.aggregateHash,
    sourceBytes: snapshot.sourceBytes,
    sourceLines: snapshot.sourceLines,
    sourceObligations,
    diagnostics: {
      obligationCount: sourceObligations.length,
    },
  };
}

module.exports = {
  classifyHeading,
  classifyText,
  extractSourceObligations,
  normalizeLineEndings,
};
