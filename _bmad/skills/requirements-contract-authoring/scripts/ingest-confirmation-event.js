#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256(stableStringify(semanticConfirmationForHash(confirmation)));
}

function normalizePathForReport(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractImplementationConfirmation(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = i;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed || typeof parsed !== 'object' || !parsed.implementationConfirmation) {
    throw new Error('implementationConfirmation block is not valid YAML');
  }
  return { start, end, blockText, confirmation: parsed.implementationConfirmation, lines };
}

function parseConfirmationText(text) {
  const values = {};
  for (const key of ['sourceDocumentHash', 'implementationConfirmationHash', 'confirmationPageHash']) {
    const match = String(text ?? '').match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'i'));
    if (!match) throw new Error(`confirmation text missing ${key}`);
    values[key] = match[1];
  }
  return values;
}

function validateArgs(args) {
  const required = ['source', 'renderReport', 'confirmationText', 'confirmedBy'];
  const missing = required.filter((key) => !args[key]);
  if (missing.length) throw new Error(`missing required args: ${missing.join(', ')}`);
}

function updateSourceDocument(sourceText, extracted, update) {
  const nextConfirmation = {
    ...extracted.confirmation,
    status: 'user_confirmed',
    confirmedAt: update.confirmedAt,
    confirmedBy: update.confirmedBy,
    sourceDocumentHash: update.sourceDocumentHash,
    implementationConfirmationHash: update.implementationConfirmationHash,
    reconfirmationRequest: null,
    confirmationRender: {
      ...(extracted.confirmation.confirmationRender ?? {}),
      htmlPath: update.htmlPath,
      summaryPath: update.summaryPath,
      reportPath: update.reportPath,
      htmlHash: update.confirmationPageHash,
      confirmationPhrase: update.confirmationText,
    },
  };
  const dumped = yaml.dump(
    { implementationConfirmation: nextConfirmation },
    { lineWidth: 120, noRefs: true, sortKeys: false }
  ).trimEnd();
  const trailingBlankLines = extracted.blockText.match(/\n+$/u)?.[0].length ?? 0;
  const replacementLines = dumped.split('\n');
  for (let i = 0; i < trailingBlankLines; i += 1) {
    replacementLines.push('');
  }
  const lines = [...extracted.lines];
  lines.splice(extracted.start, extracted.end - extracted.start, ...replacementLines);
  return lines.join('\n');
}

function buildRequirementRecord(existing, event) {
  const record = existing && typeof existing === 'object' ? existing : {};
  const confirmationHistory = Array.isArray(record.confirmationHistory)
    ? [...record.confirmationHistory]
    : [];
  confirmationHistory.push(event);
  return {
    ...record,
    recordId: record.recordId ?? event.recordId,
    requirementSetId: record.requirementSetId ?? event.requirementSetId,
    sourcePath: record.sourcePath ?? event.sourcePath,
    status: 'user_confirmed',
    sourceDocumentHash: event.sourceDocumentHash,
    implementationConfirmationHash: event.implementationConfirmationHash,
    confirmationPageHash: event.confirmationPageHash,
    confirmationHistory,
    lastEventType: 'confirmation_recorded',
    updatedAt: event.confirmedAt,
  };
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(`Usage: node ingest-confirmation-event.js --source <source.md> --render-report <confirmation-render-report.json> --confirmation-text <exact text> --confirmed-by <user> [--record-id <id>] [--requirement-record <path>] [--json]`);
    return 0;
  }
  validateArgs(args);

  const sourcePath = path.resolve(args.source);
  const reportPath = path.resolve(args.renderReport);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  const report = readJson(reportPath);
  const provided = parseConfirmationText(args.confirmationText);
  const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, extracted.confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);

  const mismatches = [];
  if (report.confirmability !== 'confirmable') mismatches.push('render_report_not_confirmable');
  if (report.sourceDocumentHash !== sourceDocumentHash) mismatches.push('render_report_source_hash_mismatch');
  if (report.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('render_report_implementation_confirmation_hash_mismatch');
  }
  if (report.confirmationPageHash !== provided.confirmationPageHash) mismatches.push('confirmation_page_hash_mismatch');
  if (provided.sourceDocumentHash !== sourceDocumentHash) mismatches.push('confirmation_text_source_hash_mismatch');
  if (provided.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('confirmation_text_implementation_hash_mismatch');
  }
  if (mismatches.length) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
    return 3;
  }

  const confirmedAt = args.confirmedAt ?? new Date().toISOString();
  const recordId = args.recordId ?? report.recordId ?? extracted.confirmation.recordId;
  const requirementSetId = args.requirementSetId ?? report.requirementSetId ?? extracted.confirmation.requirementSetId;
  const confirmationPageHash = report.confirmationPageHash;
  const summaryPath = path.join(path.dirname(reportPath), 'confirmation-summary.json');
  const htmlPath = report.artifactRef?.path ?? report.outPath ?? path.join(path.dirname(reportPath), 'confirmation.html');
  const event = {
    eventType: 'confirmation_recorded',
    recordId,
    requirementSetId,
    confirmedAt,
    confirmedBy: args.confirmedBy,
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    sourceDocumentHashScope: report.sourceDocumentHashScope ?? 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash,
    implementationConfirmationHashScope:
      report.implementationConfirmationHashScope ?? 'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash,
    confirmationText: args.confirmationText,
    renderReportPath: normalizePathForReport(reportPath),
    htmlPath: normalizePathForReport(htmlPath),
  };

  if (args.updateSource !== 'false') {
    const nextSource = updateSourceDocument(sourceText, extracted, {
      ...event,
      reportPath: normalizePathForReport(reportPath),
      summaryPath: normalizePathForReport(summaryPath),
    });
    fs.writeFileSync(sourcePath, nextSource, 'utf8');
  }

  const recordPath = path.resolve(
    args.requirementRecord ??
      path.join(
        process.cwd(),
        '_bmad-output',
        'runtime',
        'requirements',
        String(recordId ?? 'unrecorded'),
        'requirement-record.json'
      )
  );
  const existingRecord = fs.existsSync(recordPath) ? readJson(recordPath) : {};
  const nextRecord = buildRequirementRecord(existingRecord, event);
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');

  const eventLogPath = path.resolve(
    args.eventLog ??
      path.join(process.cwd(), '_bmad-output', 'runtime', 'requirements', 'mentor-events.jsonl')
  );
  appendJsonl(eventLogPath, event);

  const artifactIndexPath = path.resolve(
    args.artifactIndex ??
      path.join(process.cwd(), '_bmad-output', 'runtime', 'requirements', 'artifact-index.jsonl')
  );
  appendJsonl(artifactIndexPath, {
    artifactType: 'requirement_record',
    sourceOfTruthRole: 'control',
    recordId,
    requirementSetId,
    path: normalizePathForReport(recordPath),
    eventType: 'confirmation_recorded',
    contentHash: sha256(JSON.stringify(nextRecord)),
  });

  const result = {
    ok: true,
    event,
    requirementRecordPath: normalizePathForReport(recordPath),
    eventLogPath: normalizePathForReport(eventLogPath),
    artifactIndexPath: normalizePathForReport(artifactIndexPath),
    sourceUpdated: args.updateSource !== 'false',
  };
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    console.log(`confirmation_recorded=${recordId}`);
    console.log(`requirement-record.json=${normalizePathForReport(recordPath)}`);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
