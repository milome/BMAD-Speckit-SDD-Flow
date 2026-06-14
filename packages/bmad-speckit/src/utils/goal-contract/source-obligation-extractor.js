const path = require('node:path');
const { sha256Text } = require('../large-document-writer/receipts');

function normalizeLineEndings(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function classifyHeading(headingPath) {
  const joined = headingPath.join(' > ').toLowerCase();
  if (/file map|files? to (add|modify)|path list/u.test(joined)) return 'file_map';
  if (/completion evidence|completion criteria|acceptance criteria/u.test(joined)) return 'completion_criteria';
  if (/release|public release/u.test(joined)) return 'release_gate';
  if (/risk|failure|rollback|stop condition|recovery/u.test(joined)) return 'failure_handling';
  if (/observability|receipt|evidence|log/u.test(joined)) return 'observability';
  if (/public[- ]surface|install surface|skill surface/u.test(joined)) return 'public_surface_scan';
  if (/task|implementation|breakdown/u.test(joined)) return 'heading_execution_segment';
  return 'heading_requirement';
}

function classifyText(text, headingPath) {
  const lower = `${headingPath.join(' ')} ${text}`.toLowerCase();
  if (/```|npm |npx |node |pwsh|powershell|vitest|rg /u.test(lower)) return 'command_block';
  if (/file map|create `|modify `|path|packages\/|_bmad\/|tests\//u.test(lower)) return 'file_map';
  if (/completion evidence|completion criteria|acceptance|must exist|done/u.test(lower)) return 'completion_criteria';
  if (/release|publication|publish/u.test(lower)) return 'release_gate';
  if (/risk|fail|failure|stop|rollback|recover|blocked/u.test(lower)) return 'failure_handling';
  if (/observability|receipt|evidence|log|hash/u.test(lower)) return 'observability';
  if (/surface|install|consumer|codex|cursor|claude/u.test(lower)) return 'public_surface_scan';
  return classifyHeading(headingPath);
}

function summarize(text) {
  return normalizeLineEndings(text).replace(/\s+/gu, ' ').trim().slice(0, 180);
}

function makeObligation(index, base, sourcePlanHash) {
  const text = normalizeLineEndings(base.text).trim();
  return {
    id: `SRC${String(index + 1).padStart(3, '0')}`,
    kind: base.kind,
    sourcePlanPath: base.sourcePlanPath,
    sourcePlanHash,
    lineStart: base.lineStart,
    lineEnd: base.lineEnd,
    headingPath: base.headingPath,
    textHash: sha256Text(text),
    summary: summarize(text || base.headingPath.at(-1) || base.kind),
    required: true,
  };
}

function extractSourceObligations({ sourcePath, sourceText }) {
  if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
    throw new Error('sourcePath is required');
  }
  if (typeof sourceText !== 'string') {
    throw new Error('sourceText is required');
  }

  const normalized = normalizeLineEndings(sourceText);
  const lines = normalized.split('\n');
  const sourcePlanHash = sha256Text(normalized);
  const sourcePlanPath = sourcePath.split(path.sep).join('/');
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

    if (/^\s*[-*]\s+|\s*\d+\.\s+/u.test(line)) pushText(lineNumber, line);
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
    .map((item, index) => makeObligation(index, item, sourcePlanHash));

  return {
    sourcePlanPath,
    sourcePlanHash,
    sourceBytes: Buffer.byteLength(sourceText, 'utf8'),
    sourceLines: lines.length,
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
