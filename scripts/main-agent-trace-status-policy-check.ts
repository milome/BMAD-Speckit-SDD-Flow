/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  source?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  fullCloseout?: boolean;
  json?: boolean;
  help?: boolean;
}

const ALLOWED_STATUSES = new Set([
  'PENDING',
  'PASS',
  'FAIL',
  'BLOCKED',
  'LINKED_DOWNSTREAM',
  'USER_APPROVED_DEFERRED',
  'USER_APPROVED_OUT_OF_SCOPE',
]);
const FULL_CLOSEOUT_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED']);
const USER_SCOPED_STATUSES = new Set(['LINKED_DOWNSTREAM', 'USER_APPROVED_DEFERRED', 'USER_APPROVED_OUT_OF_SCOPE']);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--full-closeout') out.fullCloseout = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
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

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function extractImplementationConfirmation(sourceText: string): JsonObject | undefined {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) return undefined;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const parsed = asObject(yaml.load(lines.slice(start, end).join('\n')));
  return asObject(parsed?.implementationConfirmation);
}

function requiredFieldsPresent(row: JsonObject, fields: string[]): string[] {
  return fields.filter((field) => {
    const value = row[field];
    if (Array.isArray(value)) return value.length > 0;
    return !text(value);
  });
}

function validatePolicy(policy: JsonObject | undefined): string[] {
  const issues: string[] = [];
  if (!policy) return ['traceStatusPolicy_missing'];
  if (text(policy.schemaVersion) !== 'trace-status-policy/v1') issues.push('traceStatusPolicy_schemaVersion_invalid');
  const allowed = new Set(strings(policy.allowedStatuses));
  for (const status of ALLOWED_STATUSES) {
    if (!allowed.has(status)) issues.push(`traceStatusPolicy_missing_allowed_status:${status}`);
  }
  const terminal = new Set(strings(policy.terminalFullCloseoutStatuses));
  for (const status of FULL_CLOSEOUT_STATUSES) {
    if (!terminal.has(status)) issues.push(`traceStatusPolicy_missing_terminal_status:${status}`);
  }
  for (const status of USER_SCOPED_STATUSES) {
    if (terminal.has(status)) issues.push(`traceStatusPolicy_user_scoped_status_can_full_closeout:${status}`);
  }
  if (policy.bareDeferredForbidden !== true) issues.push('traceStatusPolicy_bareDeferredForbidden_must_be_true');
  if (policy.bareOutOfScopeForbidden !== true) issues.push('traceStatusPolicy_bareOutOfScopeForbidden_must_be_true');
  if (policy.fullCloseoutForUserScopedStatusesForbidden !== true) {
    issues.push('traceStatusPolicy_fullCloseoutForUserScopedStatusesForbidden_must_be_true');
  }
  return issues;
}

function validateTraceRows(
  sourceConfirmation: JsonObject | undefined,
  policy: JsonObject | undefined,
  activeTraceIds: Set<string>,
  fullCloseout: boolean
): { issues: string[]; rows: JsonObject[] } {
  if (!sourceConfirmation) return { issues: ['source_implementationConfirmation_missing'], rows: [] };
  const rows = objects(sourceConfirmation.traceRows).filter((row) => activeTraceIds.has(text(row.id)));
  const issues: string[] = [];
  const linkedFields = strings(policy?.linkedDownstreamRequiredFields);
  const deferredFields = strings(policy?.userApprovedDeferredRequiredFields);
  const outOfScopeFields = strings(policy?.userApprovedOutOfScopeRequiredFields);
  for (const row of rows) {
    const id = text(row.id);
    const status = text(row.status);
    if (!ALLOWED_STATUSES.has(status)) issues.push(`traceRow_status_invalid:${id}:${status || '<missing>'}`);
    if (status === 'DEFERRED') issues.push(`traceRow_bare_deferred_forbidden:${id}`);
    if (status === 'OUT_OF_SCOPE') issues.push(`traceRow_bare_out_of_scope_forbidden:${id}`);
    if (fullCloseout && USER_SCOPED_STATUSES.has(status)) {
      issues.push(`traceRow_user_scoped_status_forbidden_for_full_closeout:${id}:${status}`);
    }
    if (status === 'LINKED_DOWNSTREAM') {
      for (const field of requiredFieldsPresent(row, linkedFields)) {
        issues.push(`traceRow_linked_downstream_field_missing:${id}:${field}`);
      }
    }
    if (status === 'USER_APPROVED_DEFERRED') {
      for (const field of requiredFieldsPresent(row, deferredFields)) {
        issues.push(`traceRow_user_deferred_field_missing:${id}:${field}`);
      }
    }
    if (status === 'USER_APPROVED_OUT_OF_SCOPE') {
      for (const field of requiredFieldsPresent(row, outOfScopeFields)) {
        issues.push(`traceRow_user_out_of_scope_field_missing:${id}:${field}`);
      }
    }
  }
  return {
    issues,
    rows: rows.map((row) => ({
      id: text(row.id),
      status: text(row.status),
      covers: strings(row.covers),
      taskRefs: strings(row.taskRefs),
      evidenceRefs: strings(row.evidenceRefs),
    })),
  };
}

function buildReport(args: ParsedArgs): JsonObject {
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const sourcePath = args.source ? path.resolve(args.source) : '';
  const sourceConfirmation = sourcePath ? extractImplementationConfirmation(fs.readFileSync(sourcePath, 'utf8')) : undefined;
  const policy = asObject(record.traceStatusPolicy);
  const activeTraceIds = new Set(objects(record.executionIterations).flatMap((item) => strings(item.traceRows)));
  const policyIssues = validatePolicy(policy);
  const rowCheck = validateTraceRows(sourceConfirmation, policy, activeTraceIds, args.fullCloseout === true);
  const blockingReasons = [...policyIssues, ...rowCheck.issues];
  const decision: Decision = blockingReasons.length ? 'blocked' : 'pass';
  return {
    reportType: 'main_agent_trace_status_policy_check',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    evaluatedBy: args.evaluatedBy ?? 'agent',
    decision,
    blockingReasons,
    traceStatusPolicy: policy ?? null,
    checkedTraceRows: rowCheck.rows,
    fullCloseoutMode: args.fullCloseout === true,
    recordPath: normalizePathForRecord(recordPath),
    sourcePath: sourcePath ? normalizePathForRecord(sourcePath) : null,
  };
}

export function mainTraceStatusPolicyCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-trace-status-policy-check --requirement-record <json> --source <contract.md> [--full-closeout] [--json]');
    return 0;
  }
  const report = buildReport(args);
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(path.resolve(args.requirementRecord!)), 'trace-status-policy-check.json')
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `trace_status_policy=${report.decision}\n`);
  return report.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainTraceStatusPolicyCheck(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
