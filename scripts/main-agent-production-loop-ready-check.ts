/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;
type ProductionLoopDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  datasetReleaseReport?: string;
  datasetManifest?: string;
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
    else if (arg === '--dry-run') {
      // Accepted for older operator muscle memory; this checker is always read-only.
      continue;
    }
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

function runtimeRootFromRecordPath(recordPath: string): string {
  return path.dirname(path.dirname(path.dirname(recordPath)));
}

function defaultDatasetId(record: JsonObject): string {
  return `${text(record.recordId)}-governed-sft`.toLowerCase();
}

function resolveDefaultDatasetReleaseReport(record: JsonObject, recordPath: string): string {
  return path.join(
    runtimeRootFromRecordPath(recordPath),
    'datasets',
    defaultDatasetId(record),
    'v1',
    'dataset-release-gate-report.json'
  );
}

function resolveDefaultDatasetManifest(record: JsonObject, recordPath: string): string {
  return path.join(
    runtimeRootFromRecordPath(recordPath),
    'datasets',
    defaultDatasetId(record),
    'v1',
    'dataset-manifest.json'
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

function confirmationAuthorityIssues(record: JsonObject): string[] {
  const confirmations = objects(record.confirmationHistory);
  const latest = confirmations.at(-1);
  const issues: string[] = [];
  if (!latest) {
    issues.push('confirmation_history_missing');
    return issues;
  }
  if (text(latest.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
    issues.push('confirmation_source_document_hash_mismatch');
  }
  if (text(latest.implementationConfirmationHash) !== text(record.implementationConfirmationHash)) {
    issues.push('confirmation_implementation_hash_mismatch');
  }
  return issues;
}

function artifactExistsAndMatches(ref: JsonObject): boolean {
  const artifactPath = text(ref.path);
  const hash = text(ref.hash ?? ref.contentHash);
  return Boolean(artifactPath && isSha256(hash) && fs.existsSync(artifactPath) && sha256File(artifactPath) === hash);
}

function datasetManifestIssues(record: JsonObject, manifestPath: string): string[] {
  const issues: string[] = [];
  if (!fs.existsSync(manifestPath)) return ['dataset_manifest_missing'];
  const manifest = readJson(manifestPath);
  if (text(manifest.manifestType) !== 'dataset_release_manifest') issues.push('dataset_manifest_type_invalid');
  if (text(manifest.releaseDecision) !== 'pass') issues.push('dataset_manifest_release_decision_not_pass');
  const source = nested(manifest, 'source');
  const architectureState = nested(record, 'architectureConfirmationState');
  if (text(source.recordId) !== text(record.recordId)) issues.push('dataset_manifest_record_id_mismatch');
  if (text(source.requirementSetId) !== text(record.requirementSetId)) {
    issues.push('dataset_manifest_requirement_set_id_mismatch');
  }
  if (text(source.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
    issues.push('dataset_manifest_source_document_hash_mismatch');
  }
  if (text(source.implementationConfirmationHash) !== text(record.implementationConfirmationHash)) {
    issues.push('dataset_manifest_implementation_hash_mismatch');
  }
  if (text(source.architectureConfirmationHash) !== text(architectureState.currentArchitectureConfirmationHash)) {
    issues.push('dataset_manifest_architecture_hash_mismatch');
  }
  const counts = nested(manifest, 'counts');
  if (Number(counts.canonicalSamples ?? 0) <= 0) issues.push('dataset_manifest_canonical_samples_missing');
  if (Number(counts.sampleRoutes ?? 0) <= 0) issues.push('dataset_manifest_sample_routes_missing');
  if (Number(counts.blockedIssues ?? 1) !== 0) issues.push('dataset_manifest_blocked_issues_present');
  if (Number(counts.subsystems ?? 0) !== REQUIRED_SUBSYSTEM_IDS.length) {
    issues.push('dataset_manifest_subsystem_count_mismatch');
  }

  const refs = [
    nested(nested(manifest, 'exports'), 'train'),
    nested(nested(manifest, 'exports'), 'validation'),
    nested(nested(manifest, 'exports'), 'test'),
    nested(nested(manifest, 'reports'), 'qualityReport'),
    nested(nested(manifest, 'reports'), 'redactionReport'),
    nested(nested(manifest, 'reports'), 'contaminationReport'),
    nested(nested(manifest, 'reports'), 'revokedSamples'),
    nested(nested(manifest, 'reports'), 'lineageReport'),
    nested(nested(manifest, 'reports'), 'postTrainingEvalReport'),
    nested(nested(manifest, 'training'), 'trainingRun'),
    nested(nested(manifest, 'training'), 'evalReport'),
  ];
  refs.forEach((ref, index) => {
    if (!artifactExistsAndMatches(ref)) issues.push(`dataset_manifest_artifact_hash_mismatch:${index}`);
  });
  return issues;
}

function datasetReleaseIssues(record: JsonObject, recordPath: string, args: ParsedArgs): string[] {
  const issues: string[] = [];
  const reportPath = path.resolve(args.datasetReleaseReport ?? resolveDefaultDatasetReleaseReport(record, recordPath));
  const manifestPath = path.resolve(args.datasetManifest ?? resolveDefaultDatasetManifest(record, recordPath));
  if (!fs.existsSync(reportPath)) {
    issues.push('dataset_release_report_missing');
  } else {
    const report = readJson(reportPath);
    if (text(report.reportType) !== 'dataset_release_gate_report') issues.push('dataset_release_report_type_invalid');
    if (text(report.decision) !== 'pass') issues.push('dataset_release_gate_not_pass');
    if (text(report.recordId) !== text(record.recordId)) issues.push('dataset_release_record_id_mismatch');
    if (text(report.requirementSetId) !== text(record.requirementSetId)) {
      issues.push('dataset_release_requirement_set_id_mismatch');
    }
    if (objects(report.blockingIssues).length > 0 || strings(report.blockingIssues).length > 0) {
      issues.push('dataset_release_blocking_issues_present');
    }
    const checks = objects(report.checks);
    for (const requiredId of [
      'source-manifest-current',
      'training-run-bound',
      'post-training-eval-bound',
      'sixteen-subsystems-machine-readable',
    ]) {
      if (!checks.some((check) => text(check.id) === requiredId && check.passed === true)) {
        issues.push(`dataset_release_check_not_passed:${requiredId}`);
      }
    }
    if (text(report.manifestHash) && fs.existsSync(manifestPath) && sha256File(manifestPath) !== text(report.manifestHash)) {
      issues.push('dataset_release_manifest_hash_mismatch');
    }
  }
  issues.push(...datasetManifestIssues(record, manifestPath));
  return issues;
}

function evaluate(record: JsonObject, recordPath: string, args: ParsedArgs = {}): {
  decision: ProductionLoopDecision;
  blockingReasons: string[];
  checks: JsonObject[];
  extensionRef: JsonObject | null;
  extension: JsonObject | null;
} {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const confirmationIssues = confirmationAuthorityIssues(record);
  const datasetIssues = datasetReleaseIssues(record, recordPath, args);
  checks.push({
    id: 'requirement-confirmation-current',
    passed: confirmationIssues.length === 0,
    issues: confirmationIssues,
  });
  checks.push({
    id: 'governed-dataset-release-complete',
    passed: datasetIssues.length === 0,
    issues: datasetIssues,
  });
  blockingReasons.push(...confirmationIssues, ...datasetIssues);
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
  const evaluation = evaluate(record, recordPath, args);
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
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    controlWrite: 'forbidden_use_controlled_ingest',
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
