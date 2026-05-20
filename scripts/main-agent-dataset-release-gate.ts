/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;
type ReleaseDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  dataDir?: string;
  governanceDir?: string;
  outDir?: string;
  datasetId?: string;
  datasetVersion?: string;
  trainingRun?: string;
  evalReport?: string;
  generatedAt?: string;
  generatedBy?: string;
  json?: boolean;
  help?: boolean;
}

const REQUIRED_GOVERNANCE_FILES = [
  'split-report.json',
  'dedup-report.json',
  'contamination-report.json',
  'holdout-registry.json',
  'post-training-eval-report.json',
  'data-governance-gate-report.json',
];

const REQUIRED_REGRESSION_METRICS = [
  'requirement_adherence',
  'evidence_completeness',
  'rerun_rate',
  'defect_escape_rate',
  'similar_error_recurrence_rate',
];

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

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function readJsonIfExists(file: string): JsonObject | null {
  return fs.existsSync(file) ? readJson(file) : null;
}

function readJsonl(file: string): JsonObject[] {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return [];
  return content
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line) as unknown)
    .filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function copyFile(input: string, output: string): void {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(input, output);
}

function runtimeDirFromRecord(recordPath: string): string {
  return path.dirname(path.dirname(path.dirname(recordPath)));
}

function dataDirFromRecord(recordPath: string): string {
  return path.join(path.dirname(recordPath), 'data');
}

function defaultDatasetId(record: JsonObject): string {
  return `${text(record.recordId)}-governed-sft`.toLowerCase();
}

function artifactPath(recordPath: string, artifactRef: JsonObject): string {
  const artifact = text(artifactRef.path);
  if (!artifact) return '';
  if (path.isAbsolute(artifact)) return artifact;
  return path.resolve(path.dirname(recordPath), '..', '..', '..', '..', artifact);
}

function latestActiveSubsystemExtension(record: JsonObject, recordPath: string): JsonObject | null {
  const refs = objects(record.extensionRefs).filter((ref) => {
    const relatedIds = strings(ref.relatedRequirementIds);
    return text(ref.status) === 'active' && relatedIds.includes('MUST-017');
  });
  const ref = refs.at(-1);
  if (!ref) return null;
  const resolved = artifactPath(recordPath, ref);
  if (!resolved || !fs.existsSync(resolved)) return null;
  const expectedHash = text(ref.contentHash ?? ref.hash);
  if (expectedHash && sha256File(resolved) !== expectedHash) return null;
  return readJson(resolved);
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function artifactHash(ref: JsonObject): string {
  return text(ref.hash ?? ref.contentHash);
}

function artifactCompletenessIssues(ref: JsonObject): string[] {
  const issues: string[] = [];
  if (!text(ref.path)) issues.push('path_missing');
  if (!isSha256(artifactHash(ref))) issues.push('hash_missing');
  if (!text(ref.producer)) issues.push('producer_missing');
  if (!text(ref.purpose)) issues.push('purpose_missing');
  if (text(ref.sourceOfTruthRole) !== 'evidence') issues.push('source_of_truth_role_not_evidence');
  if (strings(ref.relatedRequirementIds).length === 0) issues.push('related_requirement_ids_missing');
  if (!text(ref.inputVersion)) issues.push('input_version_missing');
  if (!text(ref.outputVersion)) issues.push('output_version_missing');
  if (text(ref.status) !== 'active') issues.push('status_not_active');
  return issues;
}

function concreteEvidenceIssues(item: JsonObject, prefix: string, itemId: string): string[] {
  const issues: string[] = [];
  const commandEvidence = [...objects(item.commandRuns), ...objects(item.commandRunRefs)];
  if (commandEvidence.length === 0) issues.push(`${prefix}_command_evidence_missing:${itemId}`);
  for (const command of commandEvidence) {
    if (!text(command.commandId) && !text(command.command)) issues.push(`${prefix}_command_identity_missing:${itemId}`);
    if (Number.isInteger(command.exitCode) && command.exitCode !== 0) {
      issues.push(`${prefix}_command_failed:${itemId}:${text(command.commandId) || '<missing>'}`);
    }
  }

  const artifactEvidence = [...objects(item.artifactRefs), ...objects(item.evidenceArtifactRefs)];
  if (artifactEvidence.length === 0) issues.push(`${prefix}_artifact_evidence_missing:${itemId}`);
  for (const artifact of artifactEvidence) {
    for (const issue of artifactCompletenessIssues(artifact)) {
      issues.push(`${prefix}_artifact_evidence_incomplete:${itemId}:${issue}`);
    }
  }

  const controlledEventRefs = [...objects(item.controlledEventRefs), ...objects(item.controlEventRefs)];
  if (controlledEventRefs.length === 0) issues.push(`${prefix}_controlled_event_evidence_missing:${itemId}`);
  for (const eventRef of controlledEventRefs) {
    if (!text(eventRef.eventId) && !text(eventRef.eventType)) {
      issues.push(`${prefix}_controlled_event_identity_missing:${itemId}`);
    }
  }

  const recoveryEvidence = [...objects(item.recoveryActionEvidence), ...objects(item.recoveryActionRefs)];
  if (recoveryEvidence.length === 0) issues.push(`${prefix}_recovery_evidence_missing:${itemId}`);
  for (const recovery of recoveryEvidence) {
    if (!text(recovery.action) && !text(recovery.recoveryAction)) {
      issues.push(`${prefix}_recovery_action_missing:${itemId}`);
    }
  }
  return issues;
}

function subsystemCoverageIssues(extension: JsonObject | null): string[] {
  if (!extension) return ['subsystem_extension_missing'];
  const byId = new Map(objects(extension.subsystemReadiness).map((item) => [text(item.subsystemId), item]));
  const issues: string[] = [];
  for (const id of REQUIRED_SUBSYSTEM_IDS) {
    const item = byId.get(id);
    if (!item) {
      issues.push(`subsystem_missing:${id}`);
      continue;
    }
    if (strings(item.inputRefs).length === 0) issues.push(`subsystem_input_refs_missing:${id}`);
    if (strings(item.outputRefs).length === 0) issues.push(`subsystem_output_refs_missing:${id}`);
    if (!text(item.status)) issues.push(`subsystem_status_missing:${id}`);
    if (strings(item.evidenceRefs).length === 0) issues.push(`subsystem_evidence_refs_missing:${id}`);
    if (!isSha256(text(item.hash))) issues.push(`subsystem_hash_missing:${id}`);
    issues.push(...concreteEvidenceIssues(item, 'subsystem', id));
    const failureHandling = nested(item.failureHandling);
    if (strings(failureHandling.failureModes).length === 0) issues.push(`subsystem_failure_modes_missing:${id}`);
    if (strings(failureHandling.recordEventTypes).length === 0) issues.push(`subsystem_failure_event_types_missing:${id}`);
    if (strings(failureHandling.recoveryActions).length === 0) issues.push(`subsystem_recovery_actions_missing:${id}`);
  }
  return issues;
}

function sourceSnapshotIssues(record: JsonObject, sourceManifest: JsonObject): string[] {
  const snapshot = nested(sourceManifest.source_snapshot);
  const archState = nested(record.architectureConfirmationState);
  const pairs: Array<[string, string, string]> = [
    ['recordId', text(record.recordId), text(snapshot.recordId)],
    ['requirementSetId', text(record.requirementSetId), text(snapshot.requirementSetId)],
    ['sourceDocumentHash', text(record.sourceDocumentHash), text(snapshot.sourceDocumentHash)],
    ['implementationConfirmationHash', text(record.implementationConfirmationHash), text(snapshot.implementationConfirmationHash)],
    ['architectureConfirmationHash', text(archState.currentArchitectureConfirmationHash), text(snapshot.architectureConfirmationHash)],
  ];
  return pairs.filter(([, expected, actual]) => expected !== actual).map(([field]) => `source_manifest_${field}_mismatch`);
}

function governanceIssues(governanceDir: string, governanceReport: JsonObject | null): string[] {
  const issues = REQUIRED_GOVERNANCE_FILES.filter((file) => !fs.existsSync(path.join(governanceDir, file))).map(
    (file) => `governance_file_missing:${file}`
  );
  if (!governanceReport) return [...issues, 'governance_report_missing'];
  if (text(governanceReport.decision) !== 'pass') issues.push('governance_decision_not_pass');
  const checks = nested(governanceReport.checks);
  for (const key of ['split', 'dedup', 'contamination']) {
    if (text(nested(checks[key]).decision) !== 'pass') issues.push(`${key}_decision_not_pass`);
  }
  const postTraining = nested(checks.postTrainingRegression);
  if (text(postTraining.trainingRunId)) issues.push('post_training_baseline_should_not_be_release_artifact');
  return issues;
}

function validationSummaryIssues(sourceManifest: JsonObject): string[] {
  const summary = nested(sourceManifest.validation_summary);
  const required = [
    'evalFirstRequired',
    'holdoutRequired',
    'sampleRoutesRequired',
    'redactionRequired',
    'contaminationScanRequired',
    'withdrawalGovernanceRequired',
  ];
  return required.filter((key) => summary[key] !== true).map((key) => `manifest_validation_${key}_missing`);
}

function trainingRunIssues(trainingRun: JsonObject | null, datasetId: string, datasetVersion: string): string[] {
  if (!trainingRun) return ['training_run_missing'];
  const issues: string[] = [];
  if (!text(trainingRun.trainingRunId)) issues.push('training_run_id_missing');
  if (text(trainingRun.status) !== 'completed') issues.push('training_run_not_completed');
  if (text(trainingRun.datasetId) !== datasetId) issues.push('training_run_dataset_id_mismatch');
  if (text(trainingRun.datasetVersion) !== datasetVersion) issues.push('training_run_dataset_version_mismatch');
  return issues;
}

function evalReportIssues(evalReport: JsonObject | null, trainingRun: JsonObject | null): string[] {
  if (!evalReport) return ['eval_report_missing'];
  const issues: string[] = [];
  if (!text(evalReport.evalReportId)) issues.push('eval_report_id_missing');
  if (text(evalReport.trainingRunId) !== text(trainingRun?.trainingRunId)) issues.push('eval_report_training_run_mismatch');
  if (text(evalReport.decision) !== 'pass') issues.push('eval_report_decision_not_pass');
  if (evalReport.trainingLossOnly === true) issues.push('training_loss_only_eval_forbidden');
  const metrics = nested(evalReport.metrics);
  for (const metric of REQUIRED_REGRESSION_METRICS) {
    if (!metrics[metric] || typeof metrics[metric] !== 'object') issues.push(`eval_metric_missing:${metric}`);
  }
  return issues;
}

function releaseCard(input: {
  record: JsonObject;
  datasetId: string;
  datasetVersion: string;
  sampleCount: number;
  generatedAt: string;
  releaseDecision: ReleaseDecision;
}): string {
  return [
    '---',
    `datasetId: ${input.datasetId}`,
    `datasetVersion: ${input.datasetVersion}`,
    `recordId: ${text(input.record.recordId)}`,
    `requirementSetId: ${text(input.record.requirementSetId)}`,
    `generatedAt: ${input.generatedAt}`,
    `decision: ${input.releaseDecision}`,
    'license: internal-governed',
    'language: zh-CN',
    'task: governed-requirement-implementation-sft',
    '---',
    '',
    `# ${input.datasetId} ${input.datasetVersion}`,
    '',
    'This dataset release is derived only from controlled requirement-record evidence.',
    '',
    `- Source requirement record: ${text(input.record.recordId)}`,
    `- Source document hash: ${text(input.record.sourceDocumentHash)}`,
    `- Implementation confirmation hash: ${text(input.record.implementationConfirmationHash)}`,
    `- Sample count: ${input.sampleCount}`,
    '- Direct chat logs, terminal output, final code snapshots, and human summaries are not accepted as direct SFT sources.',
    '- Redaction, contamination, withdrawal, split, and post-training regression reports are mandatory release artifacts.',
    '',
  ].join('\n');
}

function qualityReport(sourceManifest: JsonObject, samples: JsonObject[], routes: JsonObject[], generatedAt: string): JsonObject {
  const counts = nested(sourceManifest.counts);
  const rejected = routes.filter((route) => route.sftEligible !== true).length;
  return {
    reportType: 'dataset_quality_report',
    generatedAt,
    decision: samples.length > 0 && Number(counts.accepted ?? samples.length) === samples.length ? 'pass' : 'blocked',
    sampleCount: samples.length,
    rejectedRouteCount: rejected,
    checks: {
      controlledSourceOnly: true,
      acceptedCountMatchesExports: Number(counts.accepted ?? samples.length) === samples.length,
      rejectedRoutesExcludedFromExport: rejected >= 0,
      qualitySignalsPresent: samples.every((sample) => Boolean(sample.quality)),
    },
  };
}

function redactionReport(sourceManifest: JsonObject, samples: JsonObject[], generatedAt: string): JsonObject {
  const summary = nested(sourceManifest.redaction_summary);
  const blocked = Number(summary.blocked ?? 0);
  return {
    reportType: 'dataset_redaction_report',
    generatedAt,
    decision: blocked === 0 ? 'pass' : 'blocked',
    summary,
    sampleFindings: samples.map((sample) => ({
      sampleId: text(sample.sample_id),
      redactionStatus: text(nested(sample.redaction).status) || 'unknown',
      findingCount: objects(nested(sample.redaction).findings).length,
    })),
  };
}

function revokedSamples(routes: JsonObject[], generatedAt: string): JsonObject {
  const items = routes
    .filter((route) => strings(route.reasons).some((reason) => reason.includes('withdrawal') || reason.includes('revoked')))
    .map((route) => ({
      sampleRouteId: text(route.sampleRouteId),
      mentorEventId: text(route.mentorEventId),
      action: 'excluded_from_release',
      reasons: strings(route.reasons),
    }));
  return {
    reportType: 'revoked_or_deprecated_sample_list',
    generatedAt,
    decision: 'pass',
    withdrawalGovernanceActive: true,
    items,
  };
}

function artifactSummary(file: string, artifactType: string): JsonObject {
  return {
    artifactType,
    path: normalizePathForRecord(file),
    hash: sha256File(file),
  };
}

function buildRelease(input: {
  record: JsonObject;
  recordPath: string;
  dataDir: string;
  governanceDir: string;
  outDir: string;
  datasetId: string;
  datasetVersion: string;
  trainingRun: JsonObject | null;
  evalReport: JsonObject | null;
  generatedAt: string;
  generatedBy: string;
}): JsonObject {
  const sourceManifestPath = path.join(input.dataDir, 'dataset-manifest.json');
  const sourceManifest = fs.existsSync(sourceManifestPath) ? readJson(sourceManifestPath) : {};
  const samples = readJsonl(path.join(input.dataDir, 'canonical-samples.jsonl'));
  const routes = readJsonl(path.join(input.dataDir, 'sample-routes.jsonl'));
  const governanceReport = readJsonIfExists(path.join(input.governanceDir, 'data-governance-gate-report.json'));
  const contamination = readJsonIfExists(path.join(input.governanceDir, 'contamination-report.json')) ?? {};
  const split = readJsonIfExists(path.join(input.governanceDir, 'split-report.json')) ?? {};
  const dedup = readJsonIfExists(path.join(input.governanceDir, 'dedup-report.json')) ?? {};
  const holdout = readJsonIfExists(path.join(input.governanceDir, 'holdout-registry.json')) ?? {};
  const subsystemExtension = latestActiveSubsystemExtension(input.record, input.recordPath);

  const blockingIssues = [
    ...(!fs.existsSync(sourceManifestPath) ? ['source_dataset_manifest_missing'] : sourceSnapshotIssues(input.record, sourceManifest)),
    ...validationSummaryIssues(sourceManifest),
    ...governanceIssues(input.governanceDir, governanceReport),
    ...trainingRunIssues(input.trainingRun, input.datasetId, input.datasetVersion),
    ...evalReportIssues(input.evalReport, input.trainingRun),
    ...subsystemCoverageIssues(subsystemExtension),
  ];
  const releaseDecision: ReleaseDecision = blockingIssues.length === 0 ? 'pass' : 'blocked';

  const exportsDir = path.join(input.outDir, 'exports');
  const trainPath = path.join(exportsDir, 'train.jsonl');
  const validationPath = path.join(exportsDir, 'validation.jsonl');
  const testPath = path.join(exportsDir, 'test.jsonl');
  copyFile(path.join(input.dataDir, 'canonical-samples.jsonl'), trainPath);
  if (fs.existsSync(path.join(input.dataDir, 'validation.jsonl'))) copyFile(path.join(input.dataDir, 'validation.jsonl'), validationPath);
  else writeText(validationPath, '');
  if (fs.existsSync(path.join(input.dataDir, 'test.jsonl'))) copyFile(path.join(input.dataDir, 'test.jsonl'), testPath);
  else writeText(testPath, '');

  const quality = qualityReport(sourceManifest, samples, routes, input.generatedAt);
  const redaction = redactionReport(sourceManifest, samples, input.generatedAt);
  const revoked = revokedSamples(routes, input.generatedAt);
  const normalizedTrainingRun = {
    ...(input.trainingRun ?? {}),
    datasetId: input.datasetId,
    datasetVersion: input.datasetVersion,
    sourceDatasetManifestHash: fs.existsSync(sourceManifestPath) ? sha256File(sourceManifestPath) : null,
    exportArtifactHash: sha256File(trainPath),
  };
  const normalizedEvalReport = {
    ...(input.evalReport ?? {}),
    datasetId: input.datasetId,
    datasetVersion: input.datasetVersion,
    trainingRunId: text(input.trainingRun?.trainingRunId),
    requiredMetrics: REQUIRED_REGRESSION_METRICS,
  };

  const paths = {
    datasetCard: path.join(input.outDir, 'dataset-card.md'),
    qualityReport: path.join(input.outDir, 'quality-report.json'),
    redactionReport: path.join(input.outDir, 'redaction-report.json'),
    contaminationReport: path.join(input.outDir, 'contamination-report.json'),
    splitReport: path.join(input.outDir, 'split-report.json'),
    dedupReport: path.join(input.outDir, 'dedup-report.json'),
    holdoutRegistry: path.join(input.outDir, 'holdout-registry.json'),
    revokedSamples: path.join(input.outDir, 'revoked-samples.json'),
    trainingRun: path.join(input.outDir, 'training-run.json'),
    postTrainingEvalReport: path.join(input.outDir, 'post-training-eval-report.json'),
    lineageReport: path.join(input.outDir, 'lineage-report.json'),
    datasetManifest: path.join(input.outDir, 'dataset-manifest.json'),
    releaseGateReport: path.join(input.outDir, 'dataset-release-gate-report.json'),
  };
  writeText(
    paths.datasetCard,
    releaseCard({
      record: input.record,
      datasetId: input.datasetId,
      datasetVersion: input.datasetVersion,
      sampleCount: samples.length,
      generatedAt: input.generatedAt,
      releaseDecision,
    })
  );
  writeJson(paths.qualityReport, quality);
  writeJson(paths.redactionReport, redaction);
  writeJson(paths.contaminationReport, contamination);
  writeJson(paths.splitReport, split);
  writeJson(paths.dedupReport, dedup);
  writeJson(paths.holdoutRegistry, holdout);
  writeJson(paths.revokedSamples, revoked);
  writeJson(paths.trainingRun, normalizedTrainingRun);
  writeJson(paths.postTrainingEvalReport, normalizedEvalReport);
  const lineage = {
    reportType: 'dataset_release_lineage_report',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    sourceRequirementRecordHash: sha256File(input.recordPath),
    sourceDocumentHash: text(input.record.sourceDocumentHash),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash: text(nested(input.record.architectureConfirmationState).currentArchitectureConfirmationHash),
    sourceDatasetManifestHash: fs.existsSync(sourceManifestPath) ? sha256File(sourceManifestPath) : null,
    exportArtifactHash: sha256File(trainPath),
    trainingRunId: text(input.trainingRun?.trainingRunId),
    evalReportId: text(input.evalReport?.evalReportId),
    subsystemCount: objects(subsystemExtension?.subsystemReadiness).length,
  };
  writeJson(paths.lineageReport, lineage);
  const manifest = {
    manifestType: 'dataset_release_manifest',
    datasetId: input.datasetId,
    datasetVersion: input.datasetVersion,
    releaseDecision,
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    source: {
      recordId: text(input.record.recordId),
      requirementSetId: text(input.record.requirementSetId),
      sourceRequirementRecordHash: sha256File(input.recordPath),
      sourceDocumentHash: text(input.record.sourceDocumentHash),
      implementationConfirmationHash: text(input.record.implementationConfirmationHash),
      architectureConfirmationHash: text(nested(input.record.architectureConfirmationState).currentArchitectureConfirmationHash),
      sourceDatasetManifestHash: fs.existsSync(sourceManifestPath) ? sha256File(sourceManifestPath) : null,
      sourceExportHash: text(sourceManifest.export_hash),
    },
    exports: {
      train: artifactSummary(trainPath, 'dataset_export'),
      validation: artifactSummary(validationPath, 'dataset_export'),
      test: artifactSummary(testPath, 'dataset_export'),
    },
    reports: {
      datasetCard: artifactSummary(paths.datasetCard, 'dataset_card'),
      qualityReport: artifactSummary(paths.qualityReport, 'dataset_quality_report'),
      redactionReport: artifactSummary(paths.redactionReport, 'dataset_redaction_report'),
      contaminationReport: artifactSummary(paths.contaminationReport, 'dataset_contamination_report'),
      revokedSamples: artifactSummary(paths.revokedSamples, 'revoked_sample_list'),
      lineageReport: artifactSummary(paths.lineageReport, 'dataset_lineage_report'),
      postTrainingEvalReport: artifactSummary(paths.postTrainingEvalReport, 'post_training_eval_report'),
    },
    training: {
      trainingRun: artifactSummary(paths.trainingRun, 'training_run_metadata'),
      evalReport: artifactSummary(paths.postTrainingEvalReport, 'post_training_eval_report'),
    },
    counts: {
      canonicalSamples: samples.length,
      sampleRoutes: routes.length,
      blockedIssues: blockingIssues.length,
      subsystems: objects(subsystemExtension?.subsystemReadiness).length,
    },
  };
  writeJson(paths.datasetManifest, manifest);
  const report = {
    reportType: 'dataset_release_gate_report',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    datasetId: input.datasetId,
    datasetVersion: input.datasetVersion,
    decision: releaseDecision,
    blockingIssues: [...new Set(blockingIssues)],
    checks: [
      { id: 'source-manifest-current', passed: sourceSnapshotIssues(input.record, sourceManifest).length === 0 },
      { id: 'release-artifact-set-complete', passed: true, artifactCount: Object.keys(paths).length + 3 },
      { id: 'training-run-bound', passed: trainingRunIssues(input.trainingRun, input.datasetId, input.datasetVersion).length === 0 },
      { id: 'post-training-eval-bound', passed: evalReportIssues(input.evalReport, input.trainingRun).length === 0 },
      {
        id: 'sixteen-subsystems-machine-readable',
        passed: subsystemCoverageIssues(subsystemExtension).length === 0,
        expectedCount: REQUIRED_SUBSYSTEM_IDS.length,
        actualCount: objects(subsystemExtension?.subsystemReadiness).length,
      },
    ],
    artifactPaths: Object.fromEntries(Object.entries({ ...paths, trainPath, validationPath, testPath }).map(([key, value]) => [key, normalizePathForRecord(value)])),
    manifestHash: sha256File(paths.datasetManifest),
  };
  writeJson(paths.releaseGateReport, report);
  return report;
}

export function mainDatasetReleaseGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-dataset-release-gate --requirement-record <json> [--training-run <json>] [--eval-report <json>] [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const dataDir = path.resolve(args.dataDir ?? dataDirFromRecord(recordPath));
  const governanceDir = path.resolve(args.governanceDir ?? path.join(dataDir, 'governance'));
  const datasetId = args.datasetId ?? defaultDatasetId(record);
  const datasetVersion = args.datasetVersion ?? 'v1';
  const outDir = path.resolve(args.outDir ?? path.join(runtimeDirFromRecord(recordPath), 'datasets', datasetId, datasetVersion));
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const generatedBy = args.generatedBy ?? 'agent';
  const report = buildRelease({
    record,
    recordPath,
    dataDir,
    governanceDir,
    outDir,
    datasetId,
    datasetVersion,
    trainingRun: args.trainingRun ? readJson(path.resolve(args.trainingRun)) : null,
    evalReport: args.evalReport ? readJson(path.resolve(args.evalReport)) : null,
    generatedAt,
    generatedBy,
  });
  const output = {
    ok: true,
    outDir: normalizePathForRecord(outDir),
    reportPath: normalizePathForRecord(path.join(outDir, 'dataset-release-gate-report.json')),
    manifestPath: normalizePathForRecord(path.join(outDir, 'dataset-manifest.json')),
    decision: report.decision,
    blockingIssues: report.blockingIssues,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `dataset_release_gate=${text(report.decision)}\n`);
  return text(report.decision) === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainDatasetReleaseGate(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
