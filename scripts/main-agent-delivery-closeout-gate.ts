/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveArchitectureConfirmationHashRecipe } from './architecture-confirmation-hash-recipe';
import {
  aiTddContractGateRequired,
  evaluateAiTddContractGate,
} from './ai-tdd-contract-gate';
import { appendControlEventAndReplay } from './requirement-record-control-store';
import { evaluateStrictCloseoutProof } from './strict-closeout-proof-gate';

type JsonObject = Record<string, unknown>;
type CloseoutDecision = 'pass' | 'fail' | 'blocked';
const RERUN_AUTHORITY_SOURCE_TYPES = new Set([
  'gate_check',
  'contract_check',
  'audit_iteration',
  'execution_iteration',
  'requirement_closure',
  'failure_record',
]);

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

const REQUIRED_PRODUCTION_PASS_CRITERIA = [
  'machine_readable_inputs_outputs_status_evidence_hash',
  'failure_handling_declared',
  'no_user_visible_regression',
];
const STRICT_CLOSEOUT_PROOF_COMMAND_ID = 'CMD-STRICT-CLOSEOUT-PROOF-GATE';
const STRICT_CLOSEOUT_PROOF_CONTRACT_IDS = new Set([
  'MUST-053',
  'MUST-054',
  'MUST-055',
  'MUST-056',
  'NEG-041',
  'NEG-042',
  'NEG-043',
  'EVD-052',
  'EVD-053',
  'EVD-054',
  'TRACE-040',
]);

interface ParsedArgs {
  requirementRecord?: string;
  source?: string;
  attemptId?: string;
  reportPath?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  allowExistingAttempt?: boolean;
  json?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--allow-existing-attempt') out.allowExistingAttempt = true;
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function readJsonIfExists(file: string): JsonObject | null {
  if (!fs.existsSync(file)) return null;
  return readJson(file);
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function resolveArtifactPath(recordPath: string, artifactPath: string): string {
  if (path.isAbsolute(artifactPath)) return artifactPath;
  return path.resolve(path.dirname(recordPath), '..', '..', '..', '..', artifactPath);
}

function deliveryEvidence(record: JsonObject): JsonObject {
  return record.deliveryEvidence &&
    typeof record.deliveryEvidence === 'object' &&
    !Array.isArray(record.deliveryEvidence)
    ? (record.deliveryEvidence as JsonObject)
    : {};
}

function commandRunsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(record.executionIterations).flatMap((iteration) =>
    objects(iteration.commandRunRefs)
      .filter((run) => text(run.closeoutAttemptId) === attemptId)
      .map((run) => ({ ...run, executionIterationId: iteration.executionIterationId }))
  );
}

function commandSelectedForAttempt(command: JsonObject, attemptId: string): boolean {
  if (text(command.closeoutAttemptId) === attemptId) return true;
  const lastRunRef = command.lastRunRef;
  if (lastRunRef && typeof lastRunRef === 'object' && !Array.isArray(lastRunRef)) {
    return text((lastRunRef as JsonObject).closeoutAttemptId) === attemptId;
  }
  return false;
}

function requiredCommandsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(deliveryEvidence(record).requiredCommands).filter((command) =>
    commandSelectedForAttempt(command, attemptId)
  );
}

function strictCloseoutProofContractApplies(record: JsonObject): boolean {
  const referencedIds = [
    ...objects(record.requirementClosures).map((closure) => text(closure.requirementId)),
    ...objects(record.executionIterations).flatMap((iteration) => [
      ...strings(iteration.traceRows),
      ...strings(iteration.evidenceRefs),
      ...strings(iteration.coveredRequirementIds),
    ]),
    ...objects(deliveryEvidence(record).requiredCommands).flatMap((command) => [
      text(command.commandId),
      ...strings(command.traceRows),
      ...strings(command.evidenceRefs),
    ]),
  ];
  return referencedIds.some((id) => STRICT_CLOSEOUT_PROOF_CONTRACT_IDS.has(id));
}

function commandAttemptId(command: JsonObject): string {
  const direct = text(command.closeoutAttemptId);
  if (direct) return direct;
  const lastRunRef = command.lastRunRef;
  return lastRunRef && typeof lastRunRef === 'object' && !Array.isArray(lastRunRef)
    ? text((lastRunRef as JsonObject).closeoutAttemptId)
    : '';
}

function attemptedCloseoutIds(record: JsonObject): Set<string> {
  return new Set(
    objects(nested(record.closeout).attempts)
      .map((attempt) => text(attempt.closeoutAttemptId))
      .filter(Boolean)
  );
}

function commandAttemptCompletedAt(command: JsonObject): string {
  const lastRunRef = command.lastRunRef;
  if (lastRunRef && typeof lastRunRef === 'object' && !Array.isArray(lastRunRef)) {
    const completedAt = text((lastRunRef as JsonObject).completedAt);
    if (completedAt) return completedAt;
  }
  return text(command.completedAt);
}

function selectDefaultCloseoutAttemptId(record: JsonObject, fallbackAttemptId: string): string {
  const alreadyAttempted = attemptedCloseoutIds(record);
  const candidates = new Map<string, string>();
  for (const command of objects(deliveryEvidence(record).requiredCommands)) {
    const candidate = commandAttemptId(command);
    if (!candidate) continue;
    const completedAt = commandAttemptCompletedAt(command);
    if (!candidates.has(candidate) || completedAt > (candidates.get(candidate) ?? ''))
      candidates.set(candidate, completedAt);
  }
  const orderedCandidates = [...candidates.entries()]
    .sort((left, right) => right[1].localeCompare(left[1]))
    .map(([candidate]) => candidate);
  for (const candidate of orderedCandidates) {
    if (alreadyAttempted.has(candidate)) continue;
    if (requiredCommandsForAttempt(record, candidate).length === 0) continue;
    if (commandRunsForAttempt(record, candidate).length === 0) continue;
    return candidate;
  }
  for (const attempt of objects(nested(record.closeout).attempts).reverse()) {
    const candidate = text(attempt.closeoutAttemptId);
    if (!candidate || text(attempt.decision) !== 'pass') continue;
    if (requiredCommandsForAttempt(record, candidate).length === 0) continue;
    if (commandRunsForAttempt(record, candidate).length === 0) continue;
    return candidate;
  }
  return fallbackAttemptId;
}

function strictCloseoutProofRequired(record: JsonObject, attemptId: string): boolean {
  return (
    strictCloseoutProofContractApplies(record) ||
    requiredCommandsForAttempt(record, attemptId).some(
      (command) => text(command.commandId) === STRICT_CLOSEOUT_PROOF_COMMAND_ID
    )
  );
}

function latestRequirementClosures(record: JsonObject): JsonObject[] {
  const latestByRequirementId = new Map<string, JsonObject>();
  for (const closure of objects(record.requirementClosures)) {
    const requirementId = text(closure.requirementId);
    if (requirementId) latestByRequirementId.set(requirementId, closure);
  }
  return [...latestByRequirementId.values()];
}

function latestFailureRecords(record: JsonObject): JsonObject[] {
  const latestByFailureId = new Map<string, JsonObject>();
  for (const failure of objects(record.failureRecords)) {
    const failureId = text(failure.failureId);
    if (failureId) latestByFailureId.set(failureId, failure);
  }
  return [...latestByFailureId.values()];
}

function isOpenLifecycleStatus(value: unknown): boolean {
  return ['open', 'in_progress', 'blocked'].includes(text(value));
}

function isSupersededCloseoutFailure(failure: JsonObject, currentAttemptId: string): boolean {
  return (
    text(failure.type) === 'delivery_closeout_blocked' &&
    text(failure.closeoutAttemptId) !== '' &&
    text(failure.closeoutAttemptId) !== currentAttemptId
  );
}

function isCurrentAttemptCloseoutFailure(failure: JsonObject, currentAttemptId: string): boolean {
  return (
    text(failure.type) === 'delivery_closeout_blocked' &&
    text(failure.closeoutAttemptId) === currentAttemptId &&
    text(failure.failureId) === `failure:${currentAttemptId}`
  );
}

function latestRcaRecords(record: JsonObject): JsonObject[] {
  const latestByRcaId = new Map<string, JsonObject>();
  for (const rca of objects(record.rcaRecords)) {
    const rcaId = text(rca.rcaId);
    if (rcaId) latestByRcaId.set(rcaId, rca);
  }
  return [...latestByRcaId.values()];
}

function latestRerunLoops(record: JsonObject): JsonObject[] {
  const latestByRerunLoopId = new Map<string, JsonObject>();
  for (const loop of objects(record.rerunLoops)) {
    const rerunLoopId = text(loop.rerunLoopId);
    if (rerunLoopId) latestByRerunLoopId.set(rerunLoopId, loop);
  }
  return [...latestByRerunLoopId.values()];
}

function artifactCompletenessIssues(artifactRef: unknown): string[] {
  if (!artifactRef || typeof artifactRef !== 'object' || Array.isArray(artifactRef))
    return ['artifact_ref_missing'];
  const ref = artifactRef as JsonObject;
  const issues: string[] = [];
  if (!text(ref.path)) issues.push('path_missing');
  if (!text(ref.hash ?? ref.contentHash)) issues.push('hash_missing');
  if (!text(ref.producer)) issues.push('producer_missing');
  if (!text(ref.purpose)) issues.push('purpose_missing');
  if (strings(ref.relatedRequirementIds).length === 0)
    issues.push('related_requirement_ids_missing');
  if (!text(ref.status)) issues.push('status_missing');
  if (!text(ref.inputVersion)) issues.push('input_version_missing');
  if (!text(ref.outputVersion)) issues.push('output_version_missing');
  if (text(ref.sourceOfTruthRole) !== 'evidence') issues.push('source_of_truth_role_not_evidence');
  return issues;
}

function artifactIndexed(record: JsonObject, artifactRef: unknown): boolean {
  if (!artifactRef || typeof artifactRef !== 'object' || Array.isArray(artifactRef)) return false;
  const ref = artifactRef as JsonObject;
  if (artifactCompletenessIssues(ref).length > 0) return false;
  const refPath = normalizePathForRecord(text(ref.path));
  const refHash = text(ref.hash ?? ref.contentHash);
  return objects(record.artifactIndex).some((item) => {
    if (artifactCompletenessIssues(item).length > 0) return false;
    return (
      normalizePathForRecord(text(item.path)) === refPath &&
      text(item.contentHash ?? item.hash) === refHash &&
      text(item.sourceOfTruthRole) === 'evidence'
    );
  });
}

function concreteEvidenceIssues(item: JsonObject, prefix: string, itemId: string): string[] {
  const issues: string[] = [];
  const commandEvidence = [...objects(item.commandRuns), ...objects(item.commandRunRefs)];
  if (commandEvidence.length === 0) {
    issues.push(`${prefix}_command_evidence_missing:${itemId}`);
  }
  for (const command of commandEvidence) {
    if (!text(command.commandId) && !text(command.command)) {
      issues.push(`${prefix}_command_identity_missing:${itemId}`);
    }
    if (Number.isInteger(command.exitCode) && command.exitCode !== 0) {
      issues.push(`${prefix}_command_failed:${itemId}:${text(command.commandId) || '<missing>'}`);
    }
  }

  const artifactEvidence = [...objects(item.artifactRefs), ...objects(item.evidenceArtifactRefs)];
  if (artifactEvidence.length === 0) {
    issues.push(`${prefix}_artifact_evidence_missing:${itemId}`);
  }
  for (const artifact of artifactEvidence) {
    for (const issue of artifactCompletenessIssues(artifact)) {
      issues.push(`${prefix}_artifact_evidence_incomplete:${itemId}:${issue}`);
    }
  }

  const controlledEventRefs = [
    ...objects(item.controlledEventRefs),
    ...objects(item.controlEventRefs),
  ];
  if (controlledEventRefs.length === 0) {
    issues.push(`${prefix}_controlled_event_evidence_missing:${itemId}`);
  }
  for (const eventRef of controlledEventRefs) {
    if (!text(eventRef.eventId) && !text(eventRef.eventType)) {
      issues.push(`${prefix}_controlled_event_identity_missing:${itemId}`);
    }
  }

  const recoveryEvidence = [
    ...objects(item.recoveryActionEvidence),
    ...objects(item.recoveryActionRefs),
  ];
  if (recoveryEvidence.length === 0) {
    issues.push(`${prefix}_recovery_evidence_missing:${itemId}`);
  }
  for (const recovery of recoveryEvidence) {
    if (!text(recovery.action) && !text(recovery.recoveryAction)) {
      issues.push(`${prefix}_recovery_action_missing:${itemId}`);
    }
  }
  return issues;
}

function latestActiveArtifact(
  record: JsonObject,
  predicate: (artifact: JsonObject) => boolean
): JsonObject | null {
  const artifacts = objects(record.artifactIndex).filter(
    (artifact) =>
      text(artifact.sourceOfTruthRole) === 'evidence' &&
      text(artifact.status) === 'active' &&
      predicate(artifact)
  );
  return artifacts.at(-1) ?? null;
}

function latestFailureCaseCoverageArtifact(record: JsonObject): JsonObject | null {
  return latestActiveArtifact(
    record,
    (artifact) => text(artifact.artifactType) === 'failure_case_coverage'
  );
}

function failureCaseCoverageIssues(record: JsonObject): string[] {
  const artifact = latestFailureCaseCoverageArtifact(record);
  if (!artifact) return ['failure_case_coverage_artifact_missing'];
  if (artifactCompletenessIssues(artifact).length > 0)
    return ['failure_case_coverage_artifact_incomplete'];
  const artifactPath = text(artifact.path);
  const absolute = path.isAbsolute(artifactPath)
    ? artifactPath
    : path.resolve(process.cwd(), artifactPath);
  if (!fs.existsSync(absolute))
    return [`failure_case_coverage_artifact_not_found:${normalizePathForRecord(artifactPath)}`];
  if (sha256File(absolute) !== text(artifact.hash ?? artifact.contentHash)) {
    return ['failure_case_coverage_artifact_hash_mismatch'];
  }
  const report = readJson(absolute);
  const coverage = report.resumeFailureCaseRegistryCoverage as JsonObject | undefined;
  const total = Number(coverage?.failureCases ?? report.failureCaseTotalCount ?? 0);
  const exercised = Number(
    coverage?.failureCaseExercisedCount ?? report.failureCaseExercisedCount ?? 0
  );
  const unexercised = strings(coverage?.unexercisedCases ?? report.unexercisedCases);
  const issues = strings(coverage?.issues ?? report.issues);
  const blockingIssues = strings(report.blockingIssues);
  const out: string[] = [];
  const architectureState = nested(record.architectureConfirmationState);
  if (
    text(report.sourceDocumentHash) &&
    text(report.sourceDocumentHash) !== text(record.sourceDocumentHash)
  ) {
    out.push('failure_case_coverage_source_document_hash_mismatch');
  }
  if (
    text(report.implementationConfirmationHash) &&
    text(report.implementationConfirmationHash) !== text(record.implementationConfirmationHash)
  ) {
    out.push('failure_case_coverage_implementation_hash_mismatch');
  }
  if (
    text(report.architectureConfirmationHash) &&
    text(report.architectureConfirmationHash) !==
      text(architectureState.currentArchitectureConfirmationHash)
  ) {
    out.push('failure_case_coverage_architecture_hash_mismatch');
  }
  if (!total) out.push('failure_case_coverage_total_missing');
  if (total !== exercised) out.push(`failure_case_coverage_incomplete:${exercised}/${total}`);
  for (const caseId of unexercised) out.push(`failure_case_unexercised:${caseId}`);
  if (issues.length > 0) out.push('failure_case_coverage_registry_issues');
  if (blockingIssues.length > 0) out.push('failure_case_coverage_blocking_issues');
  const caseEvidence =
    objects(coverage?.caseEvidence).length > 0
      ? objects(coverage?.caseEvidence)
      : objects(report.caseEvidence);
  if (total > 0 && caseEvidence.length !== total) {
    out.push(`failure_case_evidence_count_mismatch:${caseEvidence.length}/${total}`);
  }
  for (const item of caseEvidence) {
    out.push(
      ...concreteEvidenceIssues(
        item,
        'failure_case',
        text(item.caseId) || text(item.id) || '<missing>'
      )
    );
  }
  return [...new Set(out)];
}

function runtimeRootFromRecordPath(recordPath: string): string {
  return path.dirname(path.dirname(path.dirname(recordPath)));
}

function deliveryTruthGateReportCandidates(recordPath: string): string[] {
  const recordDir = path.dirname(recordPath);
  return [
    path.join(recordDir, 'closeout', 'gates', 'delivery-truth-gate-report.json'),
    path.join(recordDir, 'gates', 'delivery-truth-gate-report.json'),
    path.join(
      runtimeRootFromRecordPath(recordPath),
      'gates',
      'main-agent-delivery-truth-gate-report.json'
    ),
  ];
}

function deliveryTruthGateIssues(recordPath: string): {
  reportPath: string | null;
  issues: string[];
  summary: JsonObject;
} {
  const candidates = deliveryTruthGateReportCandidates(recordPath);
  const reportPath = candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  if (!reportPath) {
    return {
      reportPath: null,
      issues: ['delivery_truth_gate_report_missing'],
      summary: {
        completionAllowed: null,
        deliveryStatus: '',
        failedEvidenceCount: 0,
        missingEvidenceCount: 0,
      },
    };
  }

  const report = readJsonIfExists(reportPath);
  if (!report) {
    return {
      reportPath,
      issues: ['delivery_truth_gate_report_unreadable'],
      summary: {
        completionAllowed: null,
        deliveryStatus: '',
        failedEvidenceCount: 0,
        missingEvidenceCount: 0,
      },
    };
  }

  const failedEvidence = strings(report.failedEvidence);
  const missingEvidence = strings(report.missingEvidence);
  const issues: string[] = [];
  if (text(report.reportType) !== 'main_agent_delivery_truth_gate') {
    issues.push('delivery_truth_gate_report_type_invalid');
  }
  if (report.completionAllowed !== true) {
    issues.push('delivery_truth_gate_completion_not_allowed');
  }
  if (text(report.deliveryStatus) !== 'complete') {
    issues.push(
      `delivery_truth_gate_status_not_complete:${text(report.deliveryStatus) || '<missing>'}`
    );
  }
  if (failedEvidence.length > 0) {
    issues.push(`delivery_truth_gate_failed_evidence:${failedEvidence.join('|')}`);
  }
  if (missingEvidence.length > 0) {
    issues.push(`delivery_truth_gate_missing_evidence:${missingEvidence.join('|')}`);
  }

  return {
    reportPath,
    issues,
    summary: {
      completionAllowed: report.completionAllowed === true,
      deliveryStatus: text(report.deliveryStatus),
      failedEvidenceCount: failedEvidence.length,
      missingEvidenceCount: missingEvidence.length,
      generatedAt: text(report.generatedAt),
    },
  };
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

function artifactHash(ref: JsonObject): string {
  return text(ref.hash ?? ref.contentHash);
}

function currentArchitectureHash(record: JsonObject): string {
  return text(nested(record.architectureConfirmationState).currentArchitectureConfirmationHash);
}

function latestActiveExtensionRef(record: JsonObject): JsonObject | null {
  const refs = objects(record.extensionRefs).filter((ref) => {
    const relatedIds = strings(ref.relatedRequirementIds);
    return (
      text(ref.status) === 'active' &&
      text(ref.sourceOfTruthRole) === 'evidence' &&
      (text(ref.artifactType) === 'observability_extension' ||
        relatedIds.some((id) =>
          ['MUST-017', 'MUST-039', 'MUST-040', 'MUST-043', 'EVD-039'].includes(id)
        ))
    );
  });
  return refs.at(-1) ?? null;
}

function artifactRefIssues(ref: JsonObject | null, prefix: string): string[] {
  if (!ref) return [`${prefix}_missing`];
  const issues: string[] = [];
  if (!text(ref.path)) issues.push(`${prefix}_path_missing`);
  if (!isSha256(artifactHash(ref))) issues.push(`${prefix}_hash_missing`);
  if (!text(ref.producer)) issues.push(`${prefix}_producer_missing`);
  if (!text(ref.purpose)) issues.push(`${prefix}_purpose_missing`);
  if (strings(ref.relatedRequirementIds).length === 0)
    issues.push(`${prefix}_related_requirement_ids_missing`);
  if (!text(ref.inputVersion)) issues.push(`${prefix}_input_version_missing`);
  if (!text(ref.outputVersion)) issues.push(`${prefix}_output_version_missing`);
  if (text(ref.sourceOfTruthRole) !== 'evidence')
    issues.push(`${prefix}_source_of_truth_role_not_evidence`);
  if (text(ref.status) !== 'active') issues.push(`${prefix}_not_active`);
  return issues;
}

function hashBindingIssues(record: JsonObject, binding: JsonObject, prefix: string): string[] {
  const issues: string[] = [];
  if (text(binding.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
    issues.push(`${prefix}_source_document_hash_mismatch`);
  }
  if (
    text(binding.implementationConfirmationHash) !== text(record.implementationConfirmationHash)
  ) {
    issues.push(`${prefix}_implementation_hash_mismatch`);
  }
  if (text(binding.architectureConfirmationHash) !== currentArchitectureHash(record)) {
    issues.push(`${prefix}_architecture_hash_mismatch`);
  }
  return issues;
}

function subsystemAcceptanceIssues(record: JsonObject, extension: JsonObject): string[] {
  const issues: string[] = [];
  const readinessById = new Map(
    objects(extension.subsystemReadiness).map((item) => [text(item.subsystemId), item])
  );
  const registry = nested(extension.productionSubsystemAcceptanceRegistry);
  const registryItems = objects(registry.subsystemAcceptance);
  const registryById = new Map(registryItems.map((item) => [text(item.subsystemId), item]));

  if (!registryItems.length) issues.push('production_subsystem_acceptance_registry_missing');
  issues.push(...hashBindingIssues(record, registry, 'production_subsystem_acceptance_registry'));

  const registryHash = text(extension.productionSubsystemAcceptanceRegistryHash);
  if (!isSha256(registryHash)) {
    issues.push('production_subsystem_acceptance_registry_hash_missing');
  } else if (sha256Text(JSON.stringify(registry)) !== registryHash) {
    issues.push('production_subsystem_acceptance_registry_hash_mismatch');
  }

  for (const subsystemId of REQUIRED_SUBSYSTEM_IDS) {
    const subsystem = readinessById.get(subsystemId);
    const acceptance = registryById.get(subsystemId);
    if (!subsystem) {
      issues.push(`subsystem_missing:${subsystemId}`);
      continue;
    }
    if (strings(subsystem.inputRefs).length === 0)
      issues.push(`subsystem_input_refs_missing:${subsystemId}`);
    if (strings(subsystem.outputRefs).length === 0)
      issues.push(`subsystem_output_refs_missing:${subsystemId}`);
    if (text(subsystem.status) !== 'ready')
      issues.push(`subsystem_status_not_ready:${subsystemId}`);
    if (strings(subsystem.evidenceRefs).length === 0)
      issues.push(`subsystem_evidence_refs_missing:${subsystemId}`);
    if (!isSha256(text(subsystem.hash))) issues.push(`subsystem_hash_missing:${subsystemId}`);
    issues.push(
      ...hashBindingIssues(
        record,
        nested(subsystem.currentHashBinding),
        `subsystem_hash_binding:${subsystemId}`
      )
    );
    issues.push(...concreteEvidenceIssues(subsystem, 'subsystem', subsystemId));

    const failureHandling = nested(subsystem.failureHandling);
    const failureModes = strings(failureHandling.failureModes);
    const recordEventTypes = strings(failureHandling.recordEventTypes);
    const recoveryActions = strings(failureHandling.recoveryActions);
    if (failureModes.length === 0) issues.push(`subsystem_failure_modes_missing:${subsystemId}`);
    if (recordEventTypes.length === 0)
      issues.push(`subsystem_failure_event_types_missing:${subsystemId}`);
    if (recoveryActions.length === 0)
      issues.push(`subsystem_recovery_actions_missing:${subsystemId}`);

    const parity = nested(subsystem.functionalParity);
    if (parity.userVisibleBehaviorPreserved !== true) {
      issues.push(`subsystem_functional_parity_not_preserved:${subsystemId}`);
    }
    if (strings(parity.regressionEvidenceRefs).length === 0) {
      issues.push(`subsystem_functional_parity_regression_evidence_missing:${subsystemId}`);
    }

    if (!acceptance) {
      issues.push(`subsystem_acceptance_missing:${subsystemId}`);
      continue;
    }
    const passCriteria = strings(acceptance.passCriteria);
    for (const criterion of REQUIRED_PRODUCTION_PASS_CRITERIA) {
      if (!passCriteria.includes(criterion))
        issues.push(`subsystem_acceptance_pass_criterion_missing:${subsystemId}:${criterion}`);
    }
    const requiredEvidenceRefs = strings(acceptance.requiredEvidenceRefs);
    if (requiredEvidenceRefs.length === 0)
      issues.push(`subsystem_acceptance_required_evidence_missing:${subsystemId}`);
    for (const evidenceRef of requiredEvidenceRefs) {
      if (!strings(subsystem.evidenceRefs).includes(evidenceRef)) {
        issues.push(`subsystem_acceptance_evidence_not_satisfied:${subsystemId}:${evidenceRef}`);
      }
    }
    if (strings(acceptance.requiredCommands).length === 0) {
      issues.push(`subsystem_acceptance_required_commands_missing:${subsystemId}`);
    }
    for (const failureCase of strings(acceptance.requiredFailureCases)) {
      if (!failureModes.includes(failureCase))
        issues.push(
          `subsystem_acceptance_failure_case_not_satisfied:${subsystemId}:${failureCase}`
        );
    }
    for (const eventType of strings(acceptance.recordEventTypes)) {
      if (!recordEventTypes.includes(eventType))
        issues.push(`subsystem_acceptance_event_type_not_satisfied:${subsystemId}:${eventType}`);
    }
    for (const action of strings(acceptance.recoveryActions)) {
      if (!recoveryActions.includes(action))
        issues.push(`subsystem_acceptance_recovery_action_not_satisfied:${subsystemId}:${action}`);
    }
    const acceptanceParity = nested(acceptance.functionalParity);
    if (acceptanceParity.userVisibleBehaviorPreserved !== true) {
      issues.push(`subsystem_acceptance_functional_parity_not_preserved:${subsystemId}`);
    }
    if (strings(acceptanceParity.replacementScripts).length === 0) {
      issues.push(`subsystem_acceptance_replacement_scripts_missing:${subsystemId}`);
    }
    if (strings(acceptanceParity.replacementArtifacts).length === 0) {
      issues.push(`subsystem_acceptance_replacement_artifacts_missing:${subsystemId}`);
    }
  }

  return issues;
}

function extensionProductionIssues(
  record: JsonObject,
  recordPath: string
): { issues: string[]; extensionRef: JsonObject | null } {
  const issues: string[] = [];
  const extensionRef = latestActiveExtensionRef(record);
  const refIssues = artifactRefIssues(extensionRef, 'production_subsystem_extension_ref');
  issues.push(...refIssues);
  if (!extensionRef || refIssues.length > 0) return { issues: [...new Set(issues)], extensionRef };

  const extensionPath = resolveArtifactPath(recordPath, text(extensionRef.path));
  if (!fs.existsSync(extensionPath)) {
    issues.push('production_subsystem_extension_file_missing');
    return { issues: [...new Set(issues)], extensionRef };
  }
  if (sha256File(extensionPath) !== artifactHash(extensionRef)) {
    issues.push('production_subsystem_extension_hash_mismatch');
    return { issues: [...new Set(issues)], extensionRef };
  }

  const extension = readJson(extensionPath);
  if (text(extension.recordId) !== text(record.recordId))
    issues.push('production_subsystem_extension_record_id_mismatch');
  if (text(extension.requirementSetId) !== text(record.requirementSetId)) {
    issues.push('production_subsystem_extension_requirement_set_id_mismatch');
  }
  issues.push(...hashBindingIssues(record, extension, 'production_subsystem_extension'));
  issues.push(
    ...hashBindingIssues(
      record,
      nested(extension.currentHashBinding),
      'production_subsystem_extension_current_binding'
    )
  );

  for (const key of REQUIRED_EXTENSION_ARRAYS) {
    if (objects(extension[key]).length === 0)
      issues.push(`production_subsystem_observability_${key}_missing`);
  }
  const feedbackRouting = nested(extension.feedbackRouting);
  if (strings(feedbackRouting.failureRecordEventTypes).length === 0) {
    issues.push('production_subsystem_feedback_failure_record_event_types_missing');
  }
  if (strings(feedbackRouting.rcaRecordEventTypes).length === 0) {
    issues.push('production_subsystem_feedback_rca_record_event_types_missing');
  }
  if (strings(feedbackRouting.sampleRouteOutputs).length === 0) {
    issues.push('production_subsystem_feedback_sample_route_outputs_missing');
  }

  const parity = nested(extension.functionalParity);
  if (parity.userVisibleBehaviorPreserved !== true)
    issues.push('production_subsystem_functional_parity_not_preserved');
  if (strings(parity.replacementScripts).length === 0)
    issues.push('production_subsystem_replacement_scripts_missing');
  if (strings(parity.replacementArtifacts).length === 0)
    issues.push('production_subsystem_replacement_artifacts_missing');
  if (strings(parity.regressionTests).length === 0)
    issues.push('production_subsystem_regression_tests_missing');
  if (strings(parity.evidenceRefs).length === 0)
    issues.push('production_subsystem_functional_parity_evidence_missing');

  issues.push(...subsystemAcceptanceIssues(record, extension));
  return { issues: [...new Set(issues)], extensionRef };
}

function productionLoopReadyReportIssues(record: JsonObject, recordPath: string): string[] {
  const artifact = latestActiveArtifact(record, (item) =>
    ['production_subsystem_acceptance_report', 'production_loop_ready_report'].includes(
      text(item.artifactType)
    )
  );
  if (!artifact) return ['production_loop_ready_report_artifact_missing'];
  const issues = artifactRefIssues(artifact, 'production_loop_ready_report_artifact');
  if (issues.length > 0) return issues;
  const reportPath = resolveArtifactPath(recordPath, text(artifact.path));
  if (!fs.existsSync(reportPath)) return ['production_loop_ready_report_missing'];
  if (sha256File(reportPath) !== artifactHash(artifact))
    return ['production_loop_ready_report_hash_mismatch'];
  const report = readJson(reportPath);
  if (text(report.reportType) !== 'production_loop_ready_report')
    issues.push('production_loop_ready_report_type_invalid');
  if (text(report.decision) !== 'pass') issues.push('production_loop_ready_report_not_pass');
  if (text(report.recordId) !== text(record.recordId))
    issues.push('production_loop_ready_report_record_id_mismatch');
  if (text(report.requirementSetId) !== text(record.requirementSetId)) {
    issues.push('production_loop_ready_report_requirement_set_id_mismatch');
  }
  if (strings(report.blockingReasons).length > 0 || objects(report.blockingReasons).length > 0) {
    issues.push('production_loop_ready_report_blocking_reasons_present');
  }
  const checks = objects(report.checks);
  for (const requiredId of [
    'governed-dataset-release-complete',
    'sixteen-subsystems-machine-readable',
  ]) {
    if (!checks.some((check) => text(check.id) === requiredId && check.passed === true)) {
      issues.push(`production_loop_ready_report_check_not_passed:${requiredId}`);
    }
  }
  return [...new Set(issues)];
}

function datasetReleaseIssues(record: JsonObject, recordPath: string): string[] {
  const issues: string[] = [];
  const manifestPath = resolveDefaultDatasetManifest(record, recordPath);
  const reportPath = resolveDefaultDatasetReleaseReport(record, recordPath);
  if (!fs.existsSync(manifestPath)) {
    issues.push('dataset_manifest_missing');
  }
  if (!fs.existsSync(reportPath)) {
    issues.push('dataset_release_report_missing');
  }
  if (issues.length > 0) return issues;

  const manifest = readJson(manifestPath);
  const report = readJson(reportPath);
  const manifestHash = sha256File(manifestPath);
  const reportHash = sha256File(reportPath);

  const manifestArtifact = latestActiveArtifact(
    record,
    (item) =>
      ['dataset_release_manifest', 'dataset_manifest'].includes(text(item.artifactType)) &&
      normalizePathForRecord(text(item.path)) ===
        normalizePathForRecord(path.relative(process.cwd(), manifestPath))
  );
  const reportArtifact = latestActiveArtifact(
    record,
    (item) =>
      text(item.artifactType) === 'dataset_release_gate_report' &&
      normalizePathForRecord(text(item.path)) ===
        normalizePathForRecord(path.relative(process.cwd(), reportPath))
  );
  if (manifestArtifact && artifactHash(manifestArtifact) !== manifestHash)
    issues.push('dataset_manifest_artifact_hash_mismatch');
  if (reportArtifact && artifactHash(reportArtifact) !== reportHash)
    issues.push('dataset_release_report_artifact_hash_mismatch');

  if (text(manifest.manifestType) !== 'dataset_release_manifest')
    issues.push('dataset_manifest_type_invalid');
  if (text(manifest.releaseDecision) !== 'pass')
    issues.push('dataset_manifest_release_decision_not_pass');
  issues.push(...hashBindingIssues(record, nested(manifest.source), 'dataset_manifest'));
  if (Number(nested(manifest.counts).subsystems ?? 0) !== REQUIRED_SUBSYSTEM_IDS.length) {
    issues.push('dataset_manifest_subsystem_count_mismatch');
  }
  if (Number(nested(manifest.counts).blockedIssues ?? 1) !== 0)
    issues.push('dataset_manifest_blocked_issues_present');

  if (text(report.reportType) !== 'dataset_release_gate_report')
    issues.push('dataset_release_report_type_invalid');
  if (text(report.decision) !== 'pass') issues.push('dataset_release_gate_not_pass');
  if (text(report.recordId) !== text(record.recordId))
    issues.push('dataset_release_record_id_mismatch');
  if (text(report.requirementSetId) !== text(record.requirementSetId)) {
    issues.push('dataset_release_requirement_set_id_mismatch');
  }
  if (strings(report.blockingIssues).length > 0 || objects(report.blockingIssues).length > 0) {
    issues.push('dataset_release_blocking_issues_present');
  }
  if (text(report.manifestHash) && text(report.manifestHash) !== manifestHash) {
    issues.push('dataset_release_manifest_hash_mismatch');
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
  return [...new Set(issues)];
}

function productionBlockerIssues(
  record: JsonObject,
  recordPath: string
): { issues: string[]; checks: JsonObject[] } {
  const extension = extensionProductionIssues(record, recordPath);
  const readyReportIssues = productionLoopReadyReportIssues(record, recordPath);
  const datasetIssues = datasetReleaseIssues(record, recordPath);
  const checks = [
    {
      id: 'production-subsystem-extension-current',
      passed: extension.issues.length === 0,
      issueCount: extension.issues.length,
      extensionRefPath: text(extension.extensionRef?.path) || null,
    },
    {
      id: 'production-loop-ready-report-current',
      passed: readyReportIssues.length === 0,
      issueCount: readyReportIssues.length,
    },
    {
      id: 'dataset-release-artifacts-current',
      passed: datasetIssues.length === 0,
      issueCount: datasetIssues.length,
    },
  ];
  return {
    issues: [...new Set([...extension.issues, ...readyReportIssues, ...datasetIssues])],
    checks,
  };
}

function subagentCurrentAttemptRevalidationIssues(
  record: JsonObject,
  attemptId: string
): { issues: string[]; checks: JsonObject[] } {
  const subagentEnvelopeEvents = objects(record.executionIterations).filter(
    (iteration) =>
      text(iteration.eventType) === 'subagent_evidence_envelope_recorded' &&
      text(iteration.status) === 'accepted'
  );
  if (subagentEnvelopeEvents.length === 0) {
    return {
      issues: [],
      checks: [{ id: 'subagent-current-attempt-revalidation', passed: true, required: false }],
    };
  }
  const reports = objects(record.artifactIndex).filter(
    (artifact) =>
      text(artifact.sourceOfTruthRole) === 'evidence' &&
      text(artifact.status) === 'active' &&
      text(artifact.artifactType) === 'subagent_current_attempt_revalidation_report'
  );
  const issues: string[] = [];
  const checks: JsonObject[] = [];
  for (const event of subagentEnvelopeEvents) {
    const envelopeHash = text(event.subagentEvidenceEnvelopeHash);
    const matching = reports.find((artifact) => {
      const artifactPath = text(artifact.path);
      const absolute = artifactPath
        ? path.isAbsolute(artifactPath)
          ? artifactPath
          : path.resolve(process.cwd(), artifactPath)
        : '';
      if (!artifactPath || !fs.existsSync(absolute)) return false;
      if (sha256File(absolute) !== text(artifact.hash ?? artifact.contentHash)) return false;
      const report = readJson(absolute);
      return (
        text(report.schemaVersion) === 'subagent-current-attempt-revalidation/v1' &&
        text(report.decision) === 'pass' &&
        text(report.currentCloseoutAttemptId) === attemptId &&
        text(report.envelopeHash) === envelopeHash
      );
    });
    const passed = Boolean(matching);
    checks.push({
      id: `subagent-current-attempt-revalidation:${text(event.executionIterationId) || envelopeHash || '<missing>'}`,
      passed,
      envelopeHash: envelopeHash || null,
      currentAttemptId: attemptId,
    });
    if (!passed)
      issues.push(
        `subagent_current_attempt_revalidation_missing:${envelopeHash || text(event.executionIterationId) || '<missing>'}`
      );
  }
  return { issues: [...new Set(issues)], checks };
}

function parallelMissionEvidenceRequired(record: JsonObject): boolean {
  const hasParallelCommand = objects(deliveryEvidence(record).requiredCommands).some(
    (command) => text(command.commandId) === 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION'
  );
  const hasTrace037Execution = objects(record.executionIterations).some((iteration) =>
    strings(iteration.traceRows).includes('TRACE-037')
  );
  const hasTrace037Closure = objects(record.requirementClosures).some(
    (closure) =>
      text(closure.requirementId) === 'TRACE-037' ||
      strings(closure.traceRows).includes('TRACE-037')
  );
  const hasParallelArtifact = objects(record.artifactIndex).some(
    (artifact) => text(artifact.artifactType) === 'parallel_mission_evidence_integration_report'
  );
  return hasParallelCommand || hasTrace037Execution || hasTrace037Closure || hasParallelArtifact;
}

function parallelMissionEvidenceIntegrationIssues(
  record: JsonObject,
  attemptId: string
): { issues: string[]; checks: JsonObject[] } {
  if (!parallelMissionEvidenceRequired(record)) {
    return {
      issues: [],
      checks: [
        { id: 'parallel-mission-evidence-integration-current', passed: true, required: false },
      ],
    };
  }
  const artifacts = objects(record.artifactIndex).filter(
    (artifact) =>
      text(artifact.sourceOfTruthRole) === 'evidence' &&
      text(artifact.status) === 'active' &&
      text(artifact.artifactType) === 'parallel_mission_evidence_integration_report'
  );
  if (artifacts.length === 0) {
    return {
      issues: ['parallel_mission_evidence_integration_report_missing'],
      checks: [
        { id: 'parallel-mission-evidence-integration-current', passed: false, issueCount: 1 },
      ],
    };
  }
  const issues: string[] = [];
  const checks: JsonObject[] = [];
  let hasPassingCurrentReport = false;
  for (const artifact of artifacts) {
    const artifactPath = text(artifact.path);
    const absolute = artifactPath
      ? path.isAbsolute(artifactPath)
        ? artifactPath
        : path.resolve(process.cwd(), artifactPath)
      : '';
    const artifactIssues: string[] = [];
    if (!artifactPath) artifactIssues.push('parallel_mission_report_path_missing');
    if (absolute && !fs.existsSync(absolute))
      artifactIssues.push(
        `parallel_mission_report_file_missing:${normalizePathForRecord(artifactPath)}`
      );
    if (
      absolute &&
      fs.existsSync(absolute) &&
      sha256File(absolute) !== text(artifact.hash ?? artifact.contentHash)
    ) {
      artifactIssues.push('parallel_mission_report_hash_mismatch');
    }
    const report = artifactIssues.length === 0 ? readJson(absolute) : {};
    if (text(report.schemaVersion) !== 'parallel-mission-evidence-integration/v1') {
      artifactIssues.push('parallel_mission_report_schema_invalid');
    }
    const isCurrentAttemptReport = text(report.currentCloseoutAttemptId) === attemptId;
    if (artifactIssues.length === 0 && !isCurrentAttemptReport) {
      checks.push({
        id: `parallel-mission-evidence-integration:${normalizePathForRecord(artifactPath) || '<missing>'}`,
        passed: true,
        skippedHistoricalAttempt: text(report.currentCloseoutAttemptId) || null,
        currentAttemptId: attemptId,
      });
      continue;
    }
    if (text(report.decision) !== 'pass') artifactIssues.push('parallel_mission_report_not_pass');
    if (!isCurrentAttemptReport) artifactIssues.push('parallel_mission_report_attempt_mismatch');
    if (strings(report.blockingReasons).length > 0)
      artifactIssues.push('parallel_mission_report_blocking_reasons_present');
    for (const check of objects(report.checks)) {
      if (check.passed !== true)
        artifactIssues.push(
          `parallel_mission_report_check_not_passed:${text(check.id) || '<missing>'}`
        );
    }
    const nodeResults = objects(report.nodeResults);
    if (nodeResults.length === 0)
      artifactIssues.push('parallel_mission_report_node_results_missing');
    for (const node of nodeResults) {
      if (node.passed !== true)
        artifactIssues.push(
          `parallel_mission_node_not_passed:${text(node.node_id) || '<missing>'}`
        );
      if (!text(node.envelopeHash))
        artifactIssues.push(
          `parallel_mission_node_envelope_hash_missing:${text(node.node_id) || '<missing>'}`
        );
    }
    const integratedVerification =
      report.integratedVerification &&
      typeof report.integratedVerification === 'object' &&
      !Array.isArray(report.integratedVerification)
        ? (report.integratedVerification as JsonObject)
        : {};
    if (integratedVerification.passed !== true)
      artifactIssues.push('parallel_mission_integrated_verification_not_passed');
    if (Number(integratedVerification.commandCount ?? 0) <= 0)
      artifactIssues.push('parallel_mission_integrated_verification_command_missing');
    if (Number(integratedVerification.artifactCount ?? 0) <= 0)
      artifactIssues.push('parallel_mission_integrated_verification_artifact_missing');
    const passed = artifactIssues.length === 0;
    if (passed) hasPassingCurrentReport = true;
    checks.push({
      id: `parallel-mission-evidence-integration:${normalizePathForRecord(artifactPath) || '<missing>'}`,
      passed,
      issueCount: artifactIssues.length,
      currentAttemptId: attemptId,
    });
    issues.push(...artifactIssues);
  }
  if (!hasPassingCurrentReport)
    issues.push('parallel_mission_evidence_integration_current_report_missing');
  return { issues: [...new Set(issues)], checks };
}

function hasImplementationReadinessPass(record: JsonObject): boolean {
  return objects(record.gateChecks).some(
    (check) =>
      text(check.gate) === 'Implementation Readiness Gate' && text(check.decision) === 'pass'
  );
}

function latestArchitectureStateCheck(record: JsonObject): JsonObject | null {
  const checks = objects(record.architectureConfirmationStateChecks);
  return checks.length > 0 ? checks[checks.length - 1] : null;
}

function architectureConfirmationRequired(record: JsonObject): boolean {
  if (record.architectureConfirmationRequired === true) return true;
  const state = record.architectureConfirmationState;
  if (state && typeof state === 'object' && !Array.isArray(state)) return true;
  return (
    objects(record.architectureConfirmations).length > 0 ||
    objects(record.architectureConfirmationStateChecks).length > 0
  );
}

function architectureConfirmationIssues(record: JsonObject): string[] {
  if (!architectureConfirmationRequired(record)) return [];
  const state =
    record.architectureConfirmationState &&
    typeof record.architectureConfirmationState === 'object' &&
    !Array.isArray(record.architectureConfirmationState)
      ? (record.architectureConfirmationState as JsonObject)
      : {};
  const issues: string[] = [];
  let resolvedRecipeHash = '';
  try {
    resolvedRecipeHash = resolveArchitectureConfirmationHashRecipe().resolvedRecipeHash;
  } catch {
    issues.push('architecture_hash_recipe_unresolved');
  }
  if (text(state.status) !== 'active' || !text(state.currentArchitectureConfirmationHash)) {
    issues.push('architecture_confirmation_not_active');
  }
  if (!resolvedRecipeHash || text(state.resolvedRecipeHash) !== resolvedRecipeHash) {
    issues.push('architecture_confirmation_resolved_recipe_hash_not_current');
  }
  const stateCheck = latestArchitectureStateCheck(record);
  const transition =
    stateCheck?.stateTransition &&
    typeof stateCheck.stateTransition === 'object' &&
    !Array.isArray(stateCheck.stateTransition)
      ? (stateCheck.stateTransition as JsonObject)
      : {};
  if (
    !stateCheck ||
    text(stateCheck.decision) !== 'pass' ||
    text(transition.toStatus) !== 'active' ||
    text(stateCheck.resolvedRecipeHash) !== resolvedRecipeHash
  ) {
    issues.push('architecture_confirmation_state_check_not_current');
  }
  return [...new Set(issues)];
}

function hasBlockingScoringState(record: JsonObject): boolean {
  const gates = objects(record.gateChecks);
  const latestMaterialization = gates
    .filter((check) => text(check.gate) === 'score_materialization')
    .at(-1);
  const latestEvaluation = gates.filter((check) => text(check.gate) === 'score_evaluation').at(-1);
  const materializationDecision = text(latestMaterialization?.decision);
  const evaluationDecision = text(latestEvaluation?.decision);
  const openScoreFailures = objects(record.failureRecords).filter(
    (failure) =>
      ['score_write_failed', 'score_threshold_or_dimension_failed'].includes(text(failure.type)) &&
      ['open', 'in_progress', 'blocked'].includes(text(failure.status))
  );
  return (
    ['fail', 'blocked'].includes(materializationDecision) ||
    ['fail', 'blocked'].includes(evaluationDecision) ||
    openScoreFailures.length > 0
  );
}

function legacyClosedLoopEvidenceRequired(record: JsonObject): boolean {
  if (objects(record.extensionRefs).length > 0) return true;
  if (
    objects(record.artifactIndex).some((artifact) =>
      [
        'failure_case_coverage',
        'production_subsystem_acceptance_report',
        'production_loop_ready_report',
        'dataset_release_manifest',
        'dataset_manifest',
        'dataset_release_gate_report',
      ].includes(text(artifact.artifactType))
    )
  ) {
    return true;
  }
  const ids = [
    ...objects(record.requirementClosures).map((closure) => text(closure.requirementId)),
    ...objects(record.executionIterations).flatMap((iteration) => [
      ...strings(iteration.traceRows),
      ...strings(iteration.evidenceRefs),
    ]),
    ...objects(deliveryEvidence(record).requiredCommands).flatMap((command) => [
      text(command.commandId),
      ...strings(command.traceRows),
      ...strings(command.evidenceRefs),
    ]),
  ];
  return ids.some(
    (id) =>
      /^TRACE-0(?:0[6-9]|[1-3][0-9]|40)$/u.test(id) ||
      [
        'EVD-039',
        'EVD-040',
        'EVD-041',
        'EVD-044',
        'EVD-045',
        'EVD-046',
        'EVD-047',
        'EVD-049',
        'EVD-050',
        'EVD-051',
        'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION',
        'CMD-PRODUCTION-SUBSYSTEM-ACCEPTANCE',
        'CMD-DATASET-RELEASE-GATE',
      ].includes(id)
  );
}

function rerunLoopSourceIssues(loop: JsonObject): string[] {
  const issues: string[] = [];
  const loopId = text(loop.rerunLoopId) || '<missing>';
  const sourceRefs = objects(loop.sourceRefs);
  if (sourceRefs.length === 0) issues.push(`rerun_loop_source_refs_missing:${loopId}`);
  for (const sourceRef of sourceRefs) {
    const sourceType = text(sourceRef.sourceType);
    if (!RERUN_AUTHORITY_SOURCE_TYPES.has(sourceType)) {
      issues.push(`rerun_loop_source_ref_type_invalid:${loopId}:${sourceType || '<missing>'}`);
    }
    if (!text(sourceRef.id)) issues.push(`rerun_loop_source_ref_id_missing:${loopId}`);
  }
  if (Object.prototype.hasOwnProperty.call(loop, 'result'))
    issues.push(`rerun_loop_result_forbidden:${loopId}`);
  if (Object.prototype.hasOwnProperty.call(loop, 'decision'))
    issues.push(`rerun_loop_decision_forbidden:${loopId}`);
  if (Object.prototype.hasOwnProperty.call(loop, 'trigger') && sourceRefs.length === 0) {
    issues.push(`rerun_loop_trigger_without_source_refs:${loopId}`);
  }
  return issues;
}

function hookReconciliationIssues(record: JsonObject): string[] {
  const reconciliation =
    record.hookReconciliation &&
    typeof record.hookReconciliation === 'object' &&
    !Array.isArray(record.hookReconciliation)
      ? (record.hookReconciliation as JsonObject)
      : null;
  if (!reconciliation) return [];
  const issues: string[] = [];
  const hookTrust = text(reconciliation.hookTrust);
  const fallbackMode = text(reconciliation.fallbackMode);
  const missingReceipts = objects(reconciliation.missingReceipts);
  const hashMismatches = objects(reconciliation.hashMismatches);
  const noHookFallbackRefs = objects(reconciliation.noHookFallbackRefs);
  const sequenceLedger =
    reconciliation.sequenceLedger &&
    typeof reconciliation.sequenceLedger === 'object' &&
    !Array.isArray(reconciliation.sequenceLedger)
      ? (reconciliation.sequenceLedger as JsonObject)
      : null;
  const sequenceStatus = text(sequenceLedger?.status);
  const fallbackModeAllowed = ['no_hooks', 'bounded_replay', 'blocked'].includes(fallbackMode);
  const fallbackEvidenceRequired = ['no_hooks', 'bounded_replay'].includes(fallbackMode);
  const hookTrustReconciled =
    fallbackModeAllowed &&
    (!fallbackEvidenceRequired || noHookFallbackRefs.length > 0) &&
    (sequenceStatus === '' || sequenceStatus === 'clean' || sequenceStatus === 'reconciled') &&
    missingReceipts.length === 0 &&
    hashMismatches.length === 0 &&
    reconciliation.closeoutReconciled === true;

  if (['degraded', 'untrusted'].includes(hookTrust)) {
    if (!hookTrustReconciled) {
      issues.push(`hook_trust_not_trusted:${hookTrust}`);
    }
    if (!fallbackModeAllowed) {
      issues.push('hook_fallback_mode_missing_for_untrusted:no_hooks_or_bounded_replay_required');
    }
    if (fallbackEvidenceRequired && noHookFallbackRefs.length === 0) {
      issues.push('hook_no_hook_fallback_refs_missing');
    }
  }
  if (sequenceStatus && sequenceStatus !== 'clean' && sequenceStatus !== 'reconciled') {
    issues.push(`hook_sequence_ledger_${sequenceStatus}`);
  }
  for (const receipt of missingReceipts) {
    issues.push(
      `hook_missing_receipt:${text(receipt.receiptType) || '<missing>'}:${text(receipt.expectedEventId) || '<missing>'}`
    );
  }
  for (const mismatch of hashMismatches) {
    issues.push(`hook_hash_mismatch:${text(mismatch.field) || '<missing>'}`);
  }
  if (reconciliation.closeoutReconciled !== true) {
    issues.push('hook_closeout_not_reconciled');
  }
  return [...new Set(issues)];
}

function evaluate(
  record: JsonObject,
  recordPath: string,
  attemptId: string,
  sourcePath?: string
): { decision: CloseoutDecision; blockingReasons: string[]; checks: JsonObject[] } {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const readinessPassed = hasImplementationReadinessPass(record);
  checks.push({ id: 'implementation-readiness-gate-passed', passed: readinessPassed });
  if (!readinessPassed) blockingReasons.push('implementation_readiness_gate_not_passed');

  const architectureIssues = architectureConfirmationIssues(record);
  checks.push({
    id: 'architecture-confirmation-current',
    passed: architectureIssues.length === 0,
    issueCount: architectureIssues.length,
  });
  blockingReasons.push(...architectureIssues);

  const allRequiredCommands = objects(deliveryEvidence(record).requiredCommands);
  const requiredCommands = requiredCommandsForAttempt(record, attemptId);
  checks.push({
    id: 'delivery-required-commands-present',
    passed: allRequiredCommands.length > 0,
    count: allRequiredCommands.length,
    currentAttemptCount: requiredCommands.length,
  });
  if (allRequiredCommands.length === 0)
    blockingReasons.push('deliveryEvidence.requiredCommands_missing');
  if (allRequiredCommands.length > 0 && requiredCommands.length === 0) {
    blockingReasons.push('deliveryEvidence.requiredCommands_current_attempt_missing');
  }

  const scoringBlocked = hasBlockingScoringState(record);
  checks.push({ id: 'score-gates-not-blocking-closeout', passed: !scoringBlocked });
  if (scoringBlocked) blockingReasons.push('score_gate_failure_unresolved');

  const hookIssues = hookReconciliationIssues(record);
  checks.push({
    id: 'hook-reconciliation-valid',
    passed: hookIssues.length === 0,
    issueCount: hookIssues.length,
  });
  blockingReasons.push(...hookIssues);

  if (legacyClosedLoopEvidenceRequired(record)) {
    const truthGate = deliveryTruthGateIssues(recordPath);
    checks.push({
      id: 'delivery-truth-gate-current',
      passed: truthGate.issues.length === 0,
      reportPath: truthGate.reportPath ? normalizePathForRecord(truthGate.reportPath) : null,
      ...truthGate.summary,
      issueCount: truthGate.issues.length,
    });
    if (truthGate.issues.length > 0) {
      blockingReasons.push('delivery_truth_gate_not_passed', ...truthGate.issues);
    }

    const failureCaseIssues = failureCaseCoverageIssues(record);
    checks.push({
      id: 'failure-case-coverage-complete',
      passed: failureCaseIssues.length === 0,
      issueCount: failureCaseIssues.length,
    });
    blockingReasons.push(...failureCaseIssues);

    const productionIssues = productionBlockerIssues(record, recordPath);
    checks.push(...productionIssues.checks);
    blockingReasons.push(...productionIssues.issues);
  } else {
    checks.push(
      { id: 'delivery-truth-gate-current', passed: true, required: false },
      { id: 'failure-case-coverage-complete', passed: true, required: false },
      { id: 'production-subsystem-extension-current', passed: true, required: false },
      { id: 'production-loop-ready-report-current', passed: true, required: false },
      { id: 'dataset-release-artifacts-current', passed: true, required: false }
    );
  }

  const subagentRevalidation = subagentCurrentAttemptRevalidationIssues(record, attemptId);
  checks.push(...subagentRevalidation.checks);
  blockingReasons.push(...subagentRevalidation.issues);

  const parallelMissionIntegration = parallelMissionEvidenceIntegrationIssues(record, attemptId);
  checks.push(...parallelMissionIntegration.checks);
  blockingReasons.push(...parallelMissionIntegration.issues);

  const attemptRuns = commandRunsForAttempt(record, attemptId);
  if (strictCloseoutProofRequired(record, attemptId)) {
    const strictProofCommand = requiredCommands.find(
      (command) => text(command.commandId) === STRICT_CLOSEOUT_PROOF_COMMAND_ID
    );
    const strictProofRun = attemptRuns.find(
      (run) => text(run.commandId) === STRICT_CLOSEOUT_PROOF_COMMAND_ID
    );
    const strictProof = evaluateStrictCloseoutProof({
      record,
      recordPath,
      attemptId,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: 'main-agent-delivery-closeout-gate',
      sourcePath: sourcePath
        ? path.resolve(sourcePath)
        : text(record.sourcePath) && fs.existsSync(text(record.sourcePath))
          ? path.resolve(text(record.sourcePath))
          : undefined,
    });
    checks.push({
      id: 'strict-closeout-proof-gate-current-attempt',
      passed:
        Boolean(strictProofCommand) &&
        Boolean(strictProofRun) &&
        text(strictProof.decision) === 'pass',
      runPresent: Boolean(strictProofRun),
      commandSelected: Boolean(strictProofCommand),
      exitCode: strictProofRun?.exitCode ?? null,
      blockingReasons: strings(strictProof.blockingReasons),
    });
    if (!strictProofCommand) blockingReasons.push('strict_closeout_proof_required_command_missing');
    if (!strictProofRun)
      blockingReasons.push('strict_closeout_proof_current_attempt_command_missing');
    if (text(strictProof.decision) !== 'pass') {
      blockingReasons.push(
        ...strings(strictProof.blockingReasons),
        'strict_closeout_proof_gate_not_passed'
      );
    }
  }

  const resolvedAiTddSourcePath = sourcePath
    ? path.resolve(sourcePath)
    : text(record.sourcePath) && fs.existsSync(text(record.sourcePath))
      ? path.resolve(text(record.sourcePath))
      : '';
  if (aiTddContractGateRequired(record, resolvedAiTddSourcePath)) {
    const resolvedSourcePath = sourcePath
      ? path.resolve(sourcePath)
      : text(record.sourcePath) && fs.existsSync(text(record.sourcePath))
        ? path.resolve(text(record.sourcePath))
        : '';
    if (!resolvedSourcePath) {
      checks.push({
        id: 'ai-tdd-contract-gate-closeout',
        passed: false,
        blockingReasons: ['ai_tdd_contract_gate_source_missing'],
      });
      blockingReasons.push('ai_tdd_contract_gate_source_missing');
    } else {
      const aiTddGate = evaluateAiTddContractGate({
        sourcePath: resolvedSourcePath,
        record,
        recordPath,
        mode: 'closeout',
        attemptId,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'main-agent-delivery-closeout-gate',
      });
      checks.push({
        id: 'ai-tdd-contract-gate-closeout',
        passed: text(aiTddGate.decision) === 'pass',
        blockingReasons: strings(aiTddGate.blockingReasons),
      });
      if (text(aiTddGate.decision) !== 'pass') {
        blockingReasons.push(
          'ai_tdd_contract_gate_not_passed',
          ...strings(aiTddGate.blockingReasons)
        );
      }
    }
  }

  for (const command of requiredCommands) {
    const commandId = text(command.commandId);
    const run = attemptRuns.find((candidate) => text(candidate.commandId) === commandId);
    const artifactRefs = objects(command.artifactRefs);
    const artifactIssues = artifactRefs.flatMap((ref) =>
      artifactCompletenessIssues(ref).map(
        (issue) => `required_command_artifact_incomplete:${commandId}:${issue}`
      )
    );
    const artifactsPresent =
      artifactRefs.length > 0 &&
      artifactIssues.length === 0 &&
      artifactRefs.every((ref) => artifactIndexed(record, ref));
    const passed =
      Boolean(run) && run?.exitCode === 0 && artifactsPresent && command.blockingIfMissing === true;
    checks.push({
      id: `required-command:${commandId || '<missing>'}`,
      passed,
      runPresent: Boolean(run),
      exitCode: run?.exitCode ?? null,
      artifactsPresent,
      artifactIssues,
      negativeOrRegression: command.negativeOrRegression === true,
    });
    blockingReasons.push(...artifactIssues);
    if (!passed) blockingReasons.push(`required_command_not_satisfied:${commandId || '<missing>'}`);
  }

  const hasNegative = requiredCommands.some((command) => command.negativeOrRegression === true);
  checks.push({ id: 'negative-or-regression-required', passed: hasNegative });
  if (!hasNegative) blockingReasons.push('negative_or_regression_command_missing');

  const openClosures = latestRequirementClosures(record).filter((closure) =>
    ['open', 'fail', 'blocked'].includes(text(closure.status))
  );
  checks.push({
    id: 'requirement-closures-terminal',
    passed: openClosures.length === 0,
    openCount: openClosures.length,
  });
  if (openClosures.length > 0) blockingReasons.push('requirement_closures_not_terminal');

  const openReruns = latestRerunLoops(record).filter((loop) =>
    ['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status))
  );
  checks.push({
    id: 'rerun-loops-closed',
    passed: openReruns.length === 0,
    openCount: openReruns.length,
  });
  if (openReruns.length > 0) blockingReasons.push('pending_rerun_exists');

  const rerunSourceIssues = objects(record.rerunLoops).flatMap(rerunLoopSourceIssues);
  checks.push({
    id: 'rerun-loops-source-authority-valid',
    passed: rerunSourceIssues.length === 0,
    invalidCount: rerunSourceIssues.length,
  });
  blockingReasons.push(...rerunSourceIssues);

  const canRetireCurrentAttemptCloseoutFailure = blockingReasons.length === 0;
  const openFailureRecords = latestFailureRecords(record).filter(
    (record) =>
      isOpenLifecycleStatus(record.status) &&
      !isSupersededCloseoutFailure(record, attemptId) &&
      !(
        canRetireCurrentAttemptCloseoutFailure && isCurrentAttemptCloseoutFailure(record, attemptId)
      )
  );
  checks.push({
    id: 'failure-records-closed',
    passed: openFailureRecords.length === 0,
    openCount: openFailureRecords.length,
  });
  if (openFailureRecords.length > 0) blockingReasons.push('open_failure_record_exists');

  const openRcaRecords = latestRcaRecords(record).filter((record) =>
    isOpenLifecycleStatus(record.status)
  );
  checks.push({
    id: 'rca-actions-closed',
    passed: openRcaRecords.length === 0,
    openCount: openRcaRecords.length,
  });
  if (openRcaRecords.length > 0) blockingReasons.push('open_rca_action_exists');

  const decision: CloseoutDecision = blockingReasons.length === 0 ? 'pass' : 'blocked';
  return { decision, blockingReasons, checks };
}

function closeoutFailureSourceRefs(
  record: JsonObject,
  attemptId: string,
  gateCheckId: string
): JsonObject[] {
  const refs: JsonObject[] = [
    { sourceType: 'closeout_attempt', id: attemptId },
    { sourceType: 'gate_check', id: gateCheckId },
  ];
  for (const loop of latestRerunLoops(record)) {
    if (['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status))) {
      refs.push({ sourceType: 'rerun_loop', id: text(loop.rerunLoopId) });
    }
  }
  for (const rca of objects(record.rcaRecords)) {
    if (['open', 'in_progress', 'blocked'].includes(text(rca.status))) {
      refs.push({ sourceType: 'rca_record', id: text(rca.rcaId) });
    }
  }
  return refs.filter((ref) => text(ref.id));
}

function failureRecordsForCloseout(
  record: JsonObject,
  input: {
    attemptId: string;
    gateCheckId: string;
    decision: CloseoutDecision;
    blockingReasons: string[];
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject[] {
  if (input.decision === 'pass') return objects(record.failureRecords);
  const existing = objects(record.failureRecords);
  const failureId = `failure:${input.attemptId}`;
  if (existing.some((failure) => text(failure.failureId) === failureId)) return existing;
  const sourceRefs = closeoutFailureSourceRefs(record, input.attemptId, input.gateCheckId);
  return [
    ...existing,
    {
      eventType: 'failure_recorded',
      failureId,
      type: 'delivery_closeout_blocked',
      status: 'open',
      closeoutAttemptId: input.attemptId,
      blockingReasons: uniqueStrings(input.blockingReasons),
      sourceRefs,
      recordedAt: input.evaluatedAt,
      recordedBy: input.evaluatedBy,
    },
  ];
}

function rcaRecordsForCloseout(
  record: JsonObject,
  input: {
    attemptId: string;
    decision: CloseoutDecision;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject[] {
  if (input.decision === 'pass') return objects(record.rcaRecords);
  const existing = objects(record.rcaRecords);
  const openExisting = existing.some((rca) =>
    ['open', 'in_progress', 'blocked'].includes(text(rca.status))
  );
  if (openExisting) return existing;
  const rcaId = `rca:${input.attemptId}`;
  if (existing.some((rca) => text(rca.rcaId) === rcaId)) return existing;
  return [
    ...existing,
    {
      eventType: 'rca_created',
      rcaId,
      type: 'closeout_blocker',
      status: 'open',
      sourceRefs: [
        { sourceType: 'failure_record', id: `failure:${input.attemptId}` },
        { sourceType: 'closeout_attempt', id: input.attemptId },
      ],
      recordedAt: input.evaluatedAt,
      recordedBy: input.evaluatedBy,
    },
  ];
}

function updateRecord(
  record: JsonObject,
  input: {
    attemptId: string;
    decision: CloseoutDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    evaluatedAt: string;
    evaluatedBy: string;
    allowExistingAttempt?: boolean;
  }
): JsonObject {
  const closeout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? { ...(record.closeout as JsonObject) }
      : {};
  const attempts = objects(closeout.attempts);
  const attemptExists = attempts.some(
    (attempt) => text(attempt.closeoutAttemptId) === input.attemptId
  );
  if (attemptExists && input.allowExistingAttempt !== true) {
    throw new Error(`closeout attempt already exists: ${input.attemptId}`);
  }
  const attempt = {
    eventType: 'closeout_check_recorded',
    closeoutAttemptId: input.attemptId,
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: input.evaluatedBy,
  };
  const gateCheckId = `delivery-closeout:${input.attemptId}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId: gateCheckId,
    gate: 'Delivery Closeout Gate',
    decision: input.decision,
    sourceRefs: [{ sourceType: 'closeout_attempt', id: input.attemptId }],
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  const failureRecords = failureRecordsForCloseout(record, {
    ...input,
    gateCheckId,
  });
  const rcaRecords = rcaRecordsForCloseout(record, input);
  const closeoutEventType = input.decision === 'pass' ? 'record_closed' : 'closeout_recorded';
  return {
    ...record,
    closeout: {
      ...closeout,
      currentAttemptId: input.attemptId,
      attempts: attemptExists ? attempts : [...attempts, attempt],
      decision: input.decision,
      updatedAt: input.evaluatedAt,
    },
    gateChecks: [...objects(record.gateChecks), gateCheck],
    failureRecords,
    rcaRecords,
    lastEventType: closeoutEventType,
    updatedAt: input.evaluatedAt,
  };
}

export function mainDeliveryCloseoutGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-delivery-closeout-gate --requirement-record <json> [--attempt-id <id>] [--allow-existing-attempt] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const explicitAttemptId = Boolean(args.attemptId);
  const attemptId =
    args.attemptId ?? selectDefaultCloseoutAttemptId(record, `closeout-${Date.now()}`);
  const existingCloseout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as JsonObject)
      : {};
  const attemptExists = objects(existingCloseout.attempts).some(
    (attempt) => text(attempt.closeoutAttemptId) === attemptId
  );
  if (attemptExists && explicitAttemptId && args.allowExistingAttempt !== true) {
    console.error(
      JSON.stringify({ ok: false, error: `closeout attempt already exists: ${attemptId}` }, null, 2)
    );
    return 2;
  }
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(recordPath), 'delivery-closeout-report.json')
  );
  const evaluation = evaluate(record, recordPath, attemptId, args.source);
  const report = {
    reportType: 'delivery_closeout_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    currentAttemptId: attemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const closeoutPayload = {
    attemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    reportPath,
    evaluatedAt,
    evaluatedBy,
  };
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'delivery-closeout-gate-writer',
    eventType: evaluation.decision === 'pass' ? 'record_closed' : 'closeout_recorded',
    recordedAt: evaluatedAt,
    payload: closeoutPayload,
    reduce: (currentRecord) =>
      updateRecord(currentRecord, {
        ...closeoutPayload,
        allowExistingAttempt:
          attemptExists && (!explicitAttemptId || args.allowExistingAttempt === true),
      }),
  });
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    controlEventId: commit.event.eventId,
    controlEventHash: commit.event.eventHash,
    eventLogPath: normalizePathForRecord(commit.eventLogPath),
    receiptPath: normalizePathForRecord(commit.receiptPath),
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `delivery_closeout=${evaluation.decision}\n`
  );
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainDeliveryCloseoutGate(process.argv.slice(2));
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
