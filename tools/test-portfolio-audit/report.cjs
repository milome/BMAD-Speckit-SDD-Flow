const fs = require('node:fs');
const path = require('node:path');

const { sha256Bytes } = require('./canonical.cjs');

const AUDIT_FILE_NAME = 'test-portfolio-audit.json';
const SUMMARY_FILE_NAME = 'test-portfolio-summary.md';
const APPROVED_FILE_NAMES = new Set([AUDIT_FILE_NAME, SUMMARY_FILE_NAME]);

function compareText(left, right) {
  const leftText = String(left || '');
  const rightText = String(right || '');
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function finiteDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function priorityRank(row) {
  if (row.criticality === 'critical' && row.oracleEffectiveness === 'ineffective_candidate') {
    return 0;
  }
  if (row.criticality === 'critical' && row.executionMultiplicity === 'duplicate') return 1;
  if (row.parallelSafety === 'safe_candidate' && finiteDuration(row.durationMs) !== undefined) {
    return 2;
  }
  if (row.targetValidity === 'obsolete_candidate') return 3;
  if (row.executionMultiplicity === 'duplicate') return 4;
  return 5;
}

function priorityLabel(row) {
  return [
    'Critical + ineffective',
    'Critical + duplicate',
    'Safe candidate + duration',
    'Obsolete candidate',
    'Duplicate execution',
    'Other',
  ][priorityRank(row)];
}

function comparePriorityRows(left, right) {
  const rankOrder = priorityRank(left) - priorityRank(right);
  if (rankOrder !== 0) return rankOrder;
  const durationOrder =
    (finiteDuration(right.durationMs) || 0) - (finiteDuration(left.durationMs) || 0);
  if (durationOrder !== 0) return durationOrder;
  const pathOrder = compareText(left.testPath, right.testPath);
  if (pathOrder !== 0) return pathOrder;
  return compareText(left.runnerId, right.runnerId);
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function count(totals, field) {
  const value = Number(totals?.[field]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function renderSummary(artifact, { priorityLimit = 20 } = {}) {
  const boundedLimit = Math.min(
    20,
    Math.max(0, Number.isFinite(Number(priorityLimit)) ? Math.floor(Number(priorityLimit)) : 20)
  );
  const rows = [...(artifact?.tests || [])]
    .filter((row) => priorityRank(row) < 5)
    .sort(comparePriorityRows)
    .slice(0, boundedLimit);
  const totals = artifact?.totals || {};
  const lines = [
    '# Test Portfolio Audit',
    '',
    `Status: ${markdownCell(artifact?.status || 'INCOMPLETE')}`,
    `Discovery complete: ${yesNo(artifact?.discovery?.complete)}`,
    `Probe complete: ${yesNo(artifact?.probe?.complete)}`,
    '',
    '## Totals',
    '',
    `- Tests: ${count(totals, 'testCount')}`,
    `- Issues: ${count(totals, 'issueCount')}`,
    `- Duplicate tests: ${count(totals, 'duplicateCount')}`,
    `- Safe candidates: ${count(totals, 'safeCandidateCount')}`,
    `- Estimated duplicate duration: ${count(totals, 'estimatedDuplicateDurationMs')} ms`,
    `- Estimated parallelizable duration: ${count(totals, 'estimatedParallelizableDurationMs')} ms`,
    '',
    '## Priority Findings',
    '',
  ];

  if (rows.length === 0) {
    lines.push('None.', '');
    return `${lines.join('\n')}\n`;
  }

  lines.push(
    '| Priority | Test | Runner | Duration | Issues |',
    '| --- | --- | --- | ---: | --- |'
  );
  for (const row of rows) {
    const duration = finiteDuration(row.durationMs);
    const issueCodes = Array.isArray(row.issueCodes) ? row.issueCodes.join(', ') : '';
    lines.push(
      `| ${priorityLabel(row)} | ${markdownCell(row.testPath)} | ${markdownCell(
        row.runnerId
      )} | ${duration === undefined ? 'unknown' : `${duration} ms`} | ${
        markdownCell(issueCodes) || 'none'
      } |`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

let atomicSequence = 0;

function writeAtomic(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  atomicSequence += 1;
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${atomicSequence}.tmp`
  );
  try {
    fs.writeFileSync(tempPath, bytes);
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
  }
}

function removeUnapprovedEntries(outputDir) {
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (APPROVED_FILE_NAMES.has(entry.name)) continue;
    fs.rmSync(path.join(outputDir, entry.name), { recursive: true, force: true });
  }
}

function writeAuditArtifacts({ outputDir, canonicalBytes, summaryMarkdown }) {
  if (!outputDir) throw new Error('AUDIT_OUTPUT_DIR_REQUIRED');
  if (!Buffer.isBuffer(canonicalBytes)) throw new Error('AUDIT_CANONICAL_BYTES_REQUIRED');
  if (typeof summaryMarkdown !== 'string') throw new Error('AUDIT_SUMMARY_MARKDOWN_REQUIRED');
  const resolvedOutputDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  removeUnapprovedEntries(resolvedOutputDir);
  const auditPath = path.join(resolvedOutputDir, AUDIT_FILE_NAME);
  const summaryPath = path.join(resolvedOutputDir, SUMMARY_FILE_NAME);
  writeAtomic(auditPath, canonicalBytes);
  writeAtomic(summaryPath, Buffer.from(summaryMarkdown, 'utf8'));
  removeUnapprovedEntries(resolvedOutputDir);
  return {
    auditPath,
    summaryPath,
    auditSha256: sha256Bytes(canonicalBytes),
  };
}

module.exports = {
  priorityRank,
  renderSummary,
  writeAuditArtifacts,
};
