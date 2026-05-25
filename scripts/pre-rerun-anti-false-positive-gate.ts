/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evaluateAiTddContractGate } from './ai-tdd-contract-gate';
import { type JsonObject } from './target-artifact-realization-gate';

interface ParsedArgs {
  source?: string;
  requirementRecord?: string;
  attemptId?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[
        arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())
      ] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`JSON object expected: ${file}`);
  return parsed as JsonObject;
}

function currentAttempt(record: JsonObject, explicit?: string): string {
  if (explicit) return explicit;
  const closeout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as JsonObject)
      : {};
  return text(closeout.currentAttemptId) || 'pre-rerun-attempt';
}

export function evaluatePreRerunAntiFalsePositiveGate(input: {
  sourcePath: string;
  record: JsonObject;
  recordPath: string;
  attemptId?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = input.evaluatedBy ?? 'agent';
  const attemptId = currentAttempt(input.record, input.attemptId);
  const aiTddReport = evaluateAiTddContractGate({
    sourcePath: input.sourcePath,
    record: input.record,
    recordPath: input.recordPath,
    mode: 'pre-rerun',
    attemptId,
    evaluatedAt,
    evaluatedBy,
  });
  const subReports = Array.isArray(aiTddReport.subReports)
    ? (aiTddReport.subReports as JsonObject[])
    : [];
  const blockingReasons = Array.isArray(aiTddReport.blockingReasons)
    ? (aiTddReport.blockingReasons as string[])
    : [];
  return {
    reportType: 'pre_rerun_anti_false_positive_report',
    generatedAt: evaluatedAt,
    generatedBy: evaluatedBy,
    sourcePath: normalizePath(path.resolve(input.sourcePath)),
    recordPath: normalizePath(path.resolve(input.recordPath)),
    currentAttemptId: attemptId,
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    subReports,
    aiTddContractGateReport: aiTddReport,
    mutationPolicy: {
      writesPass: false,
      closesTrace: false,
      writesRecordClosed: false,
      modifiesSourceTraceRows: false,
    },
  };
}

export function mainPreRerunAntiFalsePositiveGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: pre-rerun-anti-false-positive-gate --source <requirement.md> --requirement-record <json> [--attempt-id <id>] [--report-path <json>] [--json]'
    );
    return 0;
  }
  if (!args.source || !args.requirementRecord)
    throw new Error('missing required args: source, requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(path.dirname(recordPath), 'pre-rerun-anti-false-positive-report.json')
  );
  const report = evaluatePreRerunAntiFalsePositiveGate({
    sourcePath: args.source,
    record: readJson(recordPath),
    recordPath,
    attemptId: args.attemptId,
    evaluatedAt: args.evaluatedAt,
    evaluatedBy: args.evaluatedBy,
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePath(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `pre_rerun_anti_false_positive=${report.decision}\n`
  );
  return text(report.decision) === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainPreRerunAntiFalsePositiveGate(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
