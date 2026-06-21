/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;
type IsolationDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

const CONTROL_SOURCE_TYPES = new Set([
  'requirement_record',
  'requirement_confirmation',
  'architecture_confirmation',
  'contract_check',
  'gate_check',
  'failure_record',
  'rca_record',
  'rerun_loop',
  'execution_iteration',
  'requirement_closure',
  'closeout_attempt',
  'trace_row',
  'requirement',
  'evidence',
  'task',
  'command_run',
]);

const NON_CONTROL_SOURCE_TYPES = new Set([
  'artifact_ref',
  'artifact',
  'read_model',
  'projection',
  'dashboard',
  'score',
  'sft',
]);
const READ_MODEL_ARTIFACT_TYPES = new Set([
  'dashboard',
  'dashboard_snapshot',
  'score',
  'score_report',
  'sft_dataset',
  'sft_export',
]);
const PROJECTION_ARTIFACT_TYPES = new Set([
  'bmad_workflow_projection',
  'runtime_resume_projection',
  'confirmation_view',
]);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
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
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function containsForbiddenControlField(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenControlField);
  const obj = value as JsonObject;
  if (Object.prototype.hasOwnProperty.call(obj, 'result')) return true;
  if (text(obj.sourceOfTruthRole) !== 'control') return false;
  return ['pass', 'complete', 'done', 'closed'].some((field) =>
    Object.prototype.hasOwnProperty.call(obj, field)
  );
}

function refsFrom(value: JsonObject): JsonObject[] {
  return [...objects(value.sourceRefs), ...objects(value.blockerRefs)];
}

function sourceRefIssues(refs: JsonObject[], owner: string): string[] {
  return refs.flatMap((ref) => {
    const sourceType = text(ref.sourceType);
    if (!sourceType) return [`${owner}:source_type_missing`];
    if (NON_CONTROL_SOURCE_TYPES.has(sourceType))
      return [`${owner}:non_control_source_ref:${sourceType}`];
    if (!CONTROL_SOURCE_TYPES.has(sourceType))
      return [`${owner}:unknown_control_source_ref:${sourceType}`];
    if (!text(ref.id)) return [`${owner}:source_ref_id_missing:${sourceType}`];
    return [];
  });
}

function artifactIssues(record: JsonObject): string[] {
  const issues: string[] = [];
  for (const artifact of [...objects(record.artifactIndex), ...objects(record.extensionRefs)]) {
    const artifactType = text(artifact.artifactType);
    const role = text(artifact.sourceOfTruthRole);
    const artifactPath = normalizePathForRecord(text(artifact.path));
    if (role === 'control')
      issues.push(`artifact_role_control_forbidden:${artifactPath || artifactType || '<missing>'}`);
    if (
      READ_MODEL_ARTIFACT_TYPES.has(artifactType) &&
      role !== 'read_model' &&
      role !== 'evidence'
    ) {
      issues.push(`read_model_artifact_bad_role:${artifactType}`);
    }
    if (
      PROJECTION_ARTIFACT_TYPES.has(artifactType) &&
      role !== 'projection' &&
      role !== 'evidence'
    ) {
      issues.push(`projection_artifact_bad_role:${artifactType}`);
    }
    if (
      (artifactPath.includes('/dashboard/') ||
        artifactPath.includes('/datasets/') ||
        artifactPath.includes('/scores/')) &&
      role === 'control'
    ) {
      issues.push(`derived_output_as_control:${artifactPath}`);
    }
    if (containsForbiddenControlField(artifact))
      issues.push(`artifact_contains_control_field:${artifactPath || artifactType}`);
  }
  return issues;
}

function gateAndContractIssues(record: JsonObject): string[] {
  const issues: string[] = [];
  for (const [groupName, rows] of [
    ['gate_check', objects(record.gateChecks)],
    ['contract_check', objects(record.contractChecks)],
  ] as const) {
    for (const row of rows) {
      if (!text(row.decision))
        issues.push(
          `${groupName}_decision_missing:${text(row.checkId) || text(row.gate) || text(row.contract)}`
        );
      if (Object.prototype.hasOwnProperty.call(row, 'result'))
        issues.push(`${groupName}_result_forbidden`);
      issues.push(...sourceRefIssues(objects(row.sourceRefs), groupName));
    }
  }
  return issues;
}

function failureAndRerunIssues(record: JsonObject): string[] {
  const issues: string[] = [];
  for (const failure of objects(record.failureRecords)) {
    if (Object.prototype.hasOwnProperty.call(failure, 'result'))
      issues.push('failure_result_forbidden');
    if (Object.prototype.hasOwnProperty.call(failure, 'decision'))
      issues.push('failure_decision_forbidden');
    issues.push(...sourceRefIssues(refsFrom(failure), 'failure_record'));
  }
  for (const rca of objects(record.rcaRecords)) {
    if (Object.prototype.hasOwnProperty.call(rca, 'result')) issues.push('rca_result_forbidden');
    if (Object.prototype.hasOwnProperty.call(rca, 'decision'))
      issues.push('rca_decision_forbidden');
    issues.push(...sourceRefIssues(refsFrom(rca), 'rca_record'));
  }
  for (const loop of objects(record.rerunLoops)) {
    if (Object.prototype.hasOwnProperty.call(loop, 'result')) issues.push('rerun_result_forbidden');
    if (Object.prototype.hasOwnProperty.call(loop, 'decision'))
      issues.push('rerun_decision_forbidden');
    issues.push(...sourceRefIssues(refsFrom(loop), 'rerun_loop'));
  }
  return issues;
}

function closeoutBoundaryIssues(record: JsonObject): string[] {
  const issues: string[] = [];
  const artifacts = [...objects(record.artifactIndex), ...objects(record.extensionRefs)];
  const orphanArtifacts = artifacts.filter(
    (artifact) =>
      text(artifact.status) === 'orphan' || strings(artifact.relatedRequirementIds).length === 0
  );
  const closeout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as JsonObject)
      : {};
  const currentAttemptId = text(closeout.currentAttemptId);
  const currentAttempt = objects(closeout.attempts).find(
    (attempt) => text(attempt.closeoutAttemptId) === currentAttemptId
  );
  if (orphanArtifacts.length === 0) return issues;
  if (!currentAttempt) return issues;
  const decision = text(currentAttempt.decision);
  const reasons = strings(currentAttempt.blockingReasons);
  if (decision === 'pass') issues.push('orphan_artifact_closeout_pass_forbidden');
  if (!reasons.some((reason) => reason.includes('orphan')))
    issues.push('orphan_artifact_missing_closeout_blocking_reason');
  return issues;
}

function rootFieldIssues(record: JsonObject): string[] {
  return ['dashboard', 'score', 'report', 'result']
    .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
    .map((field) => `root_control_field_forbidden:${field}`);
}

function evaluate(record: JsonObject): {
  decision: IsolationDecision;
  blockingReasons: string[];
  checks: JsonObject[];
} {
  const groups = [
    { id: 'root-control-fields-absent', issues: rootFieldIssues(record) },
    { id: 'artifact-roles-non-control', issues: artifactIssues(record) },
    { id: 'gate-contract-decision-authority', issues: gateAndContractIssues(record) },
    { id: 'failure-rca-rerun-lifecycle-only', issues: failureAndRerunIssues(record) },
    { id: 'orphan-only-blocks-at-closeout-boundary', issues: closeoutBoundaryIssues(record) },
  ];
  const checks = groups.map((group) => ({
    id: group.id,
    passed: group.issues.length === 0,
    issues: group.issues,
  }));
  const blockingReasons = [...new Set(groups.flatMap((group) => group.issues))];
  return { decision: blockingReasons.length === 0 ? 'pass' : 'blocked', blockingReasons, checks };
}

export function mainControlPlaneIsolationCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-control-plane-isolation-check --requirement-record <json> [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(recordPath), 'control-plane-isolation-report.json')
  );
  const evaluation = evaluate(record);
  const report = {
    reportType: 'control_plane_isolation_report',
    generatedAt: evaluatedAt,
    evaluatedBy: args.evaluatedBy ?? 'agent',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    controlWrite: 'forbidden_use_controlled_ingest',
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `control_plane_isolation=${evaluation.decision}\n`
  );
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainControlPlaneIsolationCheck(process.argv.slice(2));
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
