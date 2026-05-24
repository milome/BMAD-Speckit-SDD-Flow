#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('./load-js-yaml');

const INGEST = path.join(__dirname, 'ingest-confirmation-event.js');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    index += 1;
  }
  return args;
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
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed || typeof parsed !== 'object' || !parsed.implementationConfirmation) {
    throw new Error('implementationConfirmation block is not valid YAML');
  }
  return parsed.implementationConfirmation;
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function runtimeRoot(args) {
  return resolvePath(args.runtimeRoot ?? path.join('_bmad-output', 'runtime', 'requirement-records'));
}

function deriveRecordPath(args, recordId) {
  return resolvePath(
    args.requirementRecord ?? path.join(runtimeRoot(args), recordId, 'requirement-record.json')
  );
}

function deriveRenderReportPath(args, confirmation, recordId) {
  const explicit = args.renderReport;
  const fromSource = confirmation?.confirmationRender?.reportPath;
  return resolvePath(
    explicit ??
      fromSource ??
      path.join(runtimeRoot(args), recordId, 'confirmation', 'confirmation-render-report.json')
  );
}

function latestConfirmation(record) {
  return Array.isArray(record.confirmationHistory)
    ? record.confirmationHistory
        .filter((item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded')
        .at(-1)
    : null;
}

function requireArgs(args) {
  if (!args.source) throw new Error('missing required args: source');
  if (!args.confirmationText && !args.confirmationTextFile) {
    throw new Error('missing required args: confirmationText or confirmationTextFile');
  }
  if (args.confirmationText && args.confirmationTextFile) {
    throw new Error('provide only one of confirmationText or confirmationTextFile');
  }
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: node confirm-requirements-scope.js --source <source.md> --confirmation-text <exact text>|--confirmation-text-file <file> [--confirmed-by <user>] [--render-report <json>] [--record-id <id>] [--requirement-record <path>] [--json]'
    );
    return 0;
  }
  requireArgs(args);

  const sourcePath = resolvePath(args.source);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const confirmation = extractImplementationConfirmation(sourceText);
  const recordId = args.recordId ?? confirmation.recordId;
  if (!recordId) throw new Error('missing recordId in args or implementationConfirmation');
  const requirementSetId = args.requirementSetId ?? confirmation.requirementSetId ?? recordId;
  const reportPath = deriveRenderReportPath(args, confirmation, recordId);
  const recordPath = deriveRecordPath(args, recordId);
  const eventLogPath = resolvePath(args.eventLog ?? path.join(runtimeRoot(args), 'mentor-events.jsonl'));
  const artifactIndexPath = resolvePath(
    args.artifactIndex ?? path.join(runtimeRoot(args), 'artifact-index.jsonl')
  );

  const ingestArgs = [
    '--source',
    sourcePath,
    '--render-report',
    reportPath,
    '--confirmed-by',
    args.confirmedBy ?? 'chat_confirmation',
    '--record-id',
    recordId,
    '--requirement-set-id',
    requirementSetId,
    '--requirement-record',
    recordPath,
    '--event-log',
    eventLogPath,
    '--artifact-index',
    artifactIndexPath,
    '--json',
  ];
  if (args.confirmationTextFile) ingestArgs.push('--confirmation-text-file', resolvePath(args.confirmationTextFile));
  else ingestArgs.push('--confirmation-text', args.confirmationText);
  if (args.confirmedAt ?? confirmation.confirmedAt) {
    ingestArgs.push('--confirmed-at', args.confirmedAt ?? confirmation.confirmedAt);
  }
  if (args.updateSource) ingestArgs.push('--update-source', args.updateSource);

  const step = spawnSync(process.execPath, [INGEST, ...ingestArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (step.status !== 0) {
    if (args.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: false,
            internalSteps: [{ label: 'controlled_confirmation_ingest', status: step.status }],
            stdout: step.stdout,
            stderr: step.stderr,
          },
          null,
          2
        )}\n`
      );
    } else {
      process.stdout.write(step.stdout);
      process.stderr.write(step.stderr);
    }
    return step.status ?? 2;
  }

  const report = readJson(reportPath);
  const record = readJson(recordPath);
  const latest = latestConfirmation(record);
  const mismatches = [];
  if (!latest) mismatches.push('confirmation_recorded_missing_after_ingest');
  if (latest && latest.sourceDocumentHash !== report.sourceDocumentHash) {
    mismatches.push('confirmation_recorded_source_hash_mismatch');
  }
  if (latest && latest.implementationConfirmationHash !== report.implementationConfirmationHash) {
    mismatches.push('confirmation_recorded_implementation_hash_mismatch');
  }
  if (mismatches.length) {
    const payload = {
      ok: false,
      mismatches,
      requirementRecordPath: normalizePathForReport(recordPath),
      internalSteps: [{ label: 'controlled_confirmation_ingest', status: step.status }],
    };
    if (args.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else console.error(JSON.stringify(payload, null, 2));
    return 4;
  }

  const ingestOutput = step.stdout.trim() ? JSON.parse(step.stdout) : {};
  const payload = {
    ok: true,
    userFacingNextStep: 'requirement_record_ingested_then_prompt_generation_allowed',
    requirementRecordPath: normalizePathForReport(recordPath),
    renderReportPath: normalizePathForReport(reportPath),
    eventLogPath: normalizePathForReport(eventLogPath),
    artifactIndexPath: normalizePathForReport(artifactIndexPath),
    sourceUpdated: ingestOutput.sourceUpdated === true,
    internalSteps: [
      {
        label: 'controlled_confirmation_ingest',
        status: step.status,
        eventType: ingestOutput.event?.eventType ?? ingestOutput.projectionEvent?.eventType ?? 'confirmation_recorded',
      },
    ],
  };
  if (args.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else console.log(`requirement-record.json=${normalizePathForReport(recordPath)}`);
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
