/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;
type ProductionLoopDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  reportPath?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  json?: boolean;
  help?: boolean;
}

const REQUIRED_SUBSYSTEM_IDS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'main_agent_orchestration',
  'execution_tracking',
  'audit_review',
  'delivery_closeout',
  'observability',
  'rca_improvement',
  'data_production',
  'eval_sft',
  'governance',
  'coach',
  'dashboard_read_model',
  'scoring',
  'prompt_packet_generation',
];

const REQUIRED_EXTENSION_ARRAYS = [
  'canaryPlan',
  'sloTargets',
  'errorRateMetrics',
  'performanceMetrics',
  'businessMetrics',
  'alerts',
  'rollbackConditions',
];

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
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
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

function appendJsonl(file: string, value: JsonObject): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function artifactHash(ref: JsonObject): string {
  return text(ref.hash ?? ref.contentHash);
}

function extensionRefs(record: JsonObject): JsonObject[] {
  return objects(record.extensionRefs).filter(
    (ref) =>
      text(ref.artifactType) === 'observability_extension' ||
      strings(ref.relatedRequirementIds).some((id) => ['MUST-011', 'MUST-017', 'EVD-010'].includes(id))
  );
}

function resolveArtifactPath(recordPath: string, artifactPath: string): string {
  return path.isAbsolute(artifactPath) ? artifactPath : path.resolve(path.dirname(recordPath), '..', '..', '..', '..', artifactPath);
}

function latestActiveExtension(record: JsonObject): JsonObject | null {
  const refs = extensionRefs(record).filter((ref) => text(ref.status) === 'active');
  return refs.length > 0 ? refs[refs.length - 1] : null;
}

function hasCompleteArtifactRef(ref: JsonObject | null): boolean {
  if (!ref) return false;
  return Boolean(
    text(ref.path) &&
      isSha256(artifactHash(ref)) &&
      text(ref.producer) &&
      text(ref.purpose) &&
      text(ref.sourceOfTruthRole) === 'evidence' &&
      strings(ref.relatedRequirementIds).length > 0 &&
      text(ref.inputVersion) &&
      text(ref.outputVersion)
  );
}

function nested(obj: JsonObject, key: string): JsonObject {
  const value = obj[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function extensionIdentityIssues(record: JsonObject, extension: JsonObject): string[] {
  const issues: string[] = [];
  if (text(extension.recordId) !== text(record.recordId)) issues.push('extension_record_id_mismatch');
  if (text(extension.requirementSetId) !== text(record.requirementSetId)) {
    issues.push('extension_requirement_set_id_mismatch');
  }
  if (text(extension.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
    issues.push('extension_source_document_hash_mismatch');
  }
  if (text(extension.implementationConfirmationHash) !== text(record.implementationConfirmationHash)) {
    issues.push('extension_implementation_confirmation_hash_mismatch');
  }
  const architectureState = nested(record, 'architectureConfirmationState');
  if (text(extension.architectureConfirmationHash) !== text(architectureState.currentArchitectureConfirmationHash)) {
    issues.push('extension_architecture_confirmation_hash_mismatch');
  }
  return issues;
}

function observabilityIssues(extension: JsonObject): string[] {
  const issues: string[] = [];
  for (const key of REQUIRED_EXTENSION_ARRAYS) {
    if (objects(extension[key]).length === 0) issues.push(`observability_${key}_missing`);
  }
  const feedbackRouting = nested(extension, 'feedbackRouting');
  if (strings(feedbackRouting.failureRecordEventTypes).length === 0) {
    issues.push('feedback_failure_record_event_types_missing');
  }
  if (strings(feedbackRouting.rcaRecordEventTypes).length === 0) {
    issues.push('feedback_rca_record_event_types_missing');
  }
  if (strings(feedbackRouting.sampleRouteOutputs).length === 0) {
    issues.push('feedback_sample_route_outputs_missing');
  }
  return issues;
}

function subsystemIssues(extension: JsonObject): string[] {
  const issues: string[] = [];
  const coverage = objects(extension.subsystemReadiness);
  const byId = new Map(coverage.map((item) => [text(item.subsystemId), item]));
  for (const subsystemId of REQUIRED_SUBSYSTEM_IDS) {
    const subsystem = byId.get(subsystemId);
    if (!subsystem) {
      issues.push(`subsystem_missing:${subsystemId}`);
      continue;
    }
    if (strings(subsystem.inputRefs).length === 0) issues.push(`subsystem_input_refs_missing:${subsystemId}`);
    if (strings(subsystem.outputRefs).length === 0) issues.push(`subsystem_output_refs_missing:${subsystemId}`);
    if (!text(subsystem.status)) issues.push(`subsystem_status_missing:${subsystemId}`);
    if (strings(subsystem.evidenceRefs).length === 0) issues.push(`subsystem_evidence_refs_missing:${subsystemId}`);
    if (!isSha256(text(subsystem.hash))) issues.push(`subsystem_hash_missing:${subsystemId}`);
    const failureHandling = nested(subsystem, 'failureHandling');
    if (strings(failureHandling.failureModes).length === 0) {
      issues.push(`subsystem_failure_modes_missing:${subsystemId}`);
    }
    if (strings(failureHandling.recordEventTypes).length === 0) {
      issues.push(`subsystem_failure_event_types_missing:${subsystemId}`);
    }
    if (strings(failureHandling.recoveryActions).length === 0) {
      issues.push(`subsystem_recovery_actions_missing:${subsystemId}`);
    }
  }
  return issues;
}

function evaluate(record: JsonObject, recordPath: string): {
  decision: ProductionLoopDecision;
  blockingReasons: string[];
  checks: JsonObject[];
  extensionRef: JsonObject | null;
  extension: JsonObject | null;
} {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const extensionRef = latestActiveExtension(record);
  const extensionRefComplete = hasCompleteArtifactRef(extensionRef);
  checks.push({ id: 'observability-extension-ref-present', passed: Boolean(extensionRef) });
  checks.push({ id: 'observability-extension-ref-pass-grade', passed: extensionRefComplete });
  if (!extensionRef) blockingReasons.push('observability_extension_ref_missing');
  if (extensionRef && !extensionRefComplete) blockingReasons.push('observability_extension_ref_incomplete');

  let extension: JsonObject | null = null;
  if (extensionRef && extensionRefComplete) {
    const resolvedPath = resolveArtifactPath(recordPath, text(extensionRef.path));
    const exists = fs.existsSync(resolvedPath);
    const hashMatches = exists && sha256File(resolvedPath) === artifactHash(extensionRef);
    checks.push({ id: 'observability-extension-file-exists', passed: exists, path: normalizePathForRecord(resolvedPath) });
    checks.push({ id: 'observability-extension-hash-current', passed: hashMatches });
    if (!exists) blockingReasons.push('observability_extension_file_missing');
    if (exists && !hashMatches) blockingReasons.push('observability_extension_hash_mismatch');
    if (exists && hashMatches) extension = readJson(resolvedPath);
  }

  if (extension) {
    const identityIssues = extensionIdentityIssues(record, extension);
    const observationIssues = observabilityIssues(extension);
    const subsystemReadinessIssues = subsystemIssues(extension);
    checks.push({ id: 'observability-extension-identity-current', passed: identityIssues.length === 0, issues: identityIssues });
    checks.push({ id: 'observability-plan-complete', passed: observationIssues.length === 0, issues: observationIssues });
    checks.push({
      id: 'sixteen-subsystems-machine-readable',
      passed: subsystemReadinessIssues.length === 0,
      expectedCount: REQUIRED_SUBSYSTEM_IDS.length,
      actualCount: objects(extension.subsystemReadiness).length,
      issues: subsystemReadinessIssues,
    });
    blockingReasons.push(...identityIssues, ...observationIssues, ...subsystemReadinessIssues);
  } else {
    checks.push({ id: 'observability-extension-identity-current', passed: false });
    checks.push({ id: 'observability-plan-complete', passed: false });
    checks.push({ id: 'sixteen-subsystems-machine-readable', passed: false, expectedCount: REQUIRED_SUBSYSTEM_IDS.length });
  }

  return {
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: [...new Set(blockingReasons)],
    checks,
    extensionRef,
    extension,
  };
}

function updateRecord(
  record: JsonObject,
  input: {
    decision: ProductionLoopDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject {
  const checkId = `production-loop-ready:${input.evaluatedAt}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId,
    gate: 'Production Loop Ready Check',
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    sourceRefs: [
      { sourceType: 'requirement_record', id: text(record.recordId) },
      { sourceType: 'evidence', id: 'EVD-010' },
      { sourceType: 'requirement', id: 'MUST-011' },
      { sourceType: 'requirement', id: 'MUST-017' },
    ],
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  return {
    ...record,
    gateChecks: [...objects(record.gateChecks), gateCheck],
    lastEventType: 'production_loop_ready_check_recorded',
    updatedAt: input.evaluatedAt,
  };
}

export function mainProductionLoopReadyCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-production-loop-ready-check --requirement-record <json> [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const reportPath = path.resolve(args.reportPath ?? path.join(path.dirname(recordPath), 'production-loop-ready-report.json'));
  const evaluation = evaluate(record, recordPath);
  const report = {
    reportType: 'production_loop_ready_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    extensionRef: evaluation.extensionRef,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const nextRecord = updateRecord(record, {
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    reportPath,
    evaluatedAt,
    evaluatedBy,
  });
  fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');
  appendJsonl(path.join(path.dirname(recordPath), 'data', 'mentor-events.jsonl'), nextRecord.gateChecks.at(-1) as JsonObject);
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `production_loop_ready=${evaluation.decision}\n`);
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainProductionLoopReadyCheck(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
