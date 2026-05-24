import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainProductionLoopReadyCheck } from '../../scripts/main-agent-production-loop-ready-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

const SUBSYSTEM_IDS = [
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

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function concreteArtifactRef(id: string): Record<string, unknown> {
  return {
    artifactType: 'acceptance_evidence',
    sourceOfTruthRole: 'evidence',
    path: `_bmad-output/runtime/requirement-records/REQ-PRODUCTION-LOOP/evidence/${id}.json`,
    hash: sha256Text(`artifact:${id}`),
    producer: 'main-agent-production-loop-ready-check.test',
    purpose: `prove concrete subsystem evidence for ${id}`,
    relatedRequirementIds: ['MUST-039', 'MUST-040', 'EVD-039', 'EVD-040'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'concrete-evidence-v1',
  };
}

function concreteEvidence(id: string): Record<string, unknown> {
  return {
    commandRuns: [
      {
        commandId: `CMD-${id.toUpperCase().replace(/[^A-Z0-9]+/gu, '-')}`,
        command: `verify ${id}`,
        runId: `run-${id}`,
        closeoutAttemptId: 'closeout-current',
        exitCode: 0,
        startedAt: '2026-05-19T00:00:00.000Z',
        completedAt: '2026-05-19T00:00:01.000Z',
        outputSummary: `${id} verified`,
      },
    ],
    artifactRefs: [concreteArtifactRef(id)],
    controlledEventRefs: [
      {
        eventId: `event-${id}`,
        eventType: 'implementation_evidence_ingested',
        eventHash: sha256Text(`event:${id}`),
      },
    ],
    recoveryActionEvidence: [
      {
        action: 'block_closeout',
        status: 'verified',
        evidenceRef: `recovery-${id}`,
      },
    ],
  };
}

function subsystem(subsystemId: string) {
  return {
    subsystemId,
    inputRefs: [`input:${subsystemId}`],
    outputRefs: [`output:${subsystemId}`],
    status: 'ready',
    evidenceRefs: ['EVD-010'],
    hash: sha256Text(subsystemId),
    failureHandling: {
      failureModes: [`${subsystemId}_unavailable`],
      recordEventTypes: ['failure_recorded', 'rca_created'],
      recoveryActions: ['record_failure', 'open_rca', 'route_sample'],
    },
    ...concreteEvidence(`subsystem-${subsystemId}`),
  };
}

function extension(recordId: string, requirementSetId: string) {
  return {
    recordId,
    requirementSetId,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    canaryPlan: [{ stage: 'internal', rolloutPercent: 10, rollbackOn: 'slo_violation' }],
    sloTargets: [{ name: 'delivery_closeout_gate_latency', target: '<= 5000ms' }],
    errorRateMetrics: [{ name: 'gate_failure_rate', threshold: '<= 1%' }],
    performanceMetrics: [{ name: 'closeout_eval_duration_ms', threshold: '<= 5000' }],
    businessMetrics: [{ name: 'requirement_reopen_rate', threshold: '<= 5%' }],
    alerts: [{ name: 'production_loop_blocked', owner: 'main-agent' }],
    rollbackConditions: [{ condition: 'hash_mismatch_or_slo_violation', action: 'block_closeout_and_open_rca' }],
    feedbackRouting: {
      failureRecordEventTypes: ['failure_recorded'],
      rcaRecordEventTypes: ['rca_created'],
      sampleRouteOutputs: ['sample-routes.jsonl'],
    },
    subsystemReadiness: SUBSYSTEM_IDS.map(subsystem),
  };
}

function artifact(filePath: string, artifactType: string) {
  return {
    artifactType,
    path: filePath.replace(/\\/gu, '/'),
    hash: sha256File(filePath),
  };
}

function writeDatasetFixture(root: string, recordId: string, options: { onlySftFile?: boolean } = {}) {
  const datasetId = `${recordId}-governed-sft`.toLowerCase();
  const datasetRoot = path.join(root, '_bmad-output', 'runtime', 'datasets', datasetId, 'v1');
  const trainPath = path.join(datasetRoot, 'exports', 'train.jsonl');
  writeText(trainPath, '{"sample_id":"sample-001","messages":[]}\n');
  if (options.onlySftFile) return;

  const validationPath = path.join(datasetRoot, 'exports', 'validation.jsonl');
  const testPath = path.join(datasetRoot, 'exports', 'test.jsonl');
  const qualityReportPath = path.join(datasetRoot, 'quality-report.json');
  const redactionReportPath = path.join(datasetRoot, 'redaction-report.json');
  const contaminationReportPath = path.join(datasetRoot, 'contamination-report.json');
  const revokedSamplesPath = path.join(datasetRoot, 'revoked-samples.json');
  const lineageReportPath = path.join(datasetRoot, 'lineage-report.json');
  const postTrainingEvalPath = path.join(datasetRoot, 'post-training-eval-report.json');
  const trainingRunPath = path.join(datasetRoot, 'training-run.json');
  const manifestPath = path.join(datasetRoot, 'dataset-manifest.json');
  const releaseReportPath = path.join(datasetRoot, 'dataset-release-gate-report.json');

  writeText(validationPath, '');
  writeText(testPath, '');
  writeJson(qualityReportPath, { decision: 'pass' });
  writeJson(redactionReportPath, { decision: 'pass' });
  writeJson(contaminationReportPath, { decision: 'pass' });
  writeJson(revokedSamplesPath, { decision: 'pass' });
  writeJson(lineageReportPath, { decision: 'pass' });
  writeJson(postTrainingEvalPath, { decision: 'pass' });
  writeJson(trainingRunPath, { status: 'completed' });
  writeJson(manifestPath, {
    manifestType: 'dataset_release_manifest',
    datasetId,
    datasetVersion: 'v1',
    releaseDecision: 'pass',
    source: {
      recordId,
      requirementSetId: recordId,
      sourceDocumentHash: SOURCE_HASH,
      implementationConfirmationHash: IMPLEMENTATION_HASH,
      architectureConfirmationHash: ARCHITECTURE_HASH,
    },
    exports: {
      train: artifact(trainPath, 'dataset_export'),
      validation: artifact(validationPath, 'dataset_export'),
      test: artifact(testPath, 'dataset_export'),
    },
    reports: {
      qualityReport: artifact(qualityReportPath, 'dataset_quality_report'),
      redactionReport: artifact(redactionReportPath, 'dataset_redaction_report'),
      contaminationReport: artifact(contaminationReportPath, 'dataset_contamination_report'),
      revokedSamples: artifact(revokedSamplesPath, 'revoked_sample_list'),
      lineageReport: artifact(lineageReportPath, 'dataset_lineage_report'),
      postTrainingEvalReport: artifact(postTrainingEvalPath, 'post_training_eval_report'),
    },
    training: {
      trainingRun: artifact(trainingRunPath, 'training_run_metadata'),
      evalReport: artifact(postTrainingEvalPath, 'post_training_eval_report'),
    },
    counts: {
      canonicalSamples: 1,
      sampleRoutes: 1,
      blockedIssues: 0,
      subsystems: 16,
    },
  });
  writeJson(releaseReportPath, {
    reportType: 'dataset_release_gate_report',
    recordId,
    requirementSetId: recordId,
    decision: 'pass',
    blockingIssues: [],
    checks: [
      { id: 'source-manifest-current', passed: true },
      { id: 'training-run-bound', passed: true },
      { id: 'post-training-eval-bound', passed: true },
      { id: 'sixteen-subsystems-machine-readable', passed: true },
    ],
    manifestHash: sha256File(manifestPath),
  });
}

function writeFixture(root: string, options: { completeExtension?: boolean; onlySftFile?: boolean } = {}) {
  const recordId = 'REQ-PRODUCTION-LOOP';
  writeDatasetFixture(root, recordId, { onlySftFile: options.onlySftFile });
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const extensionDir = path.join(base, 'extensions');
  mkdirSync(extensionDir, { recursive: true });
  const extensionPath = path.join(extensionDir, 'observability-extension.json');
  const extensionValue = extension(recordId, recordId);
  if (options.completeExtension === false) {
    delete (extensionValue as Record<string, unknown>).rollbackConditions;
    extensionValue.subsystemReadiness = extensionValue.subsystemReadiness.slice(0, 11);
  }
  writeJson(extensionPath, extensionValue);
  const recordPath = path.join(base, 'requirement-record.json');
  const relativeExtensionPath = path
    .relative(root, extensionPath)
    .replace(/\\/gu, '/');
  writeJson(
    recordPath,
      {
        recordId,
        requirementSetId: recordId,
        status: 'user_confirmed',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            recordId,
            requirementSetId: recordId,
            confirmedAt: '2026-05-19T00:00:00.000Z',
            confirmedBy: 'user',
            sourcePath: 'docs/design/example.md',
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
            confirmationPageHash:
              'sha256:4444444444444444444444444444444444444444444444444444444444444444',
            confirmationText: 'confirm',
            renderReportPath: 'confirmation-render-report.json',
            htmlPath: 'confirmation.html',
          },
        ],
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
        },
        extensionRefs: [
          {
            eventType: 'artifact_indexed',
            artifactType: 'observability_extension',
            sourceOfTruthRole: 'evidence',
            recordId,
            requirementSetId: recordId,
            path: relativeExtensionPath,
            contentHash: sha256File(extensionPath),
            producer: 'main-agent-production-loop-ready-check.test',
            purpose: 'prove observability extension and sixteen subsystem machine-readable readiness',
            relatedRequirementIds: ['MUST-011', 'MUST-017', 'EVD-010'],
            status: 'active',
            inputVersion: 'trace-007',
            outputVersion: 'observability-extension-v1',
          },
        ],
      }
  );
  return { recordPath };
}

describe('main-agent production loop ready check', () => {
  it('passes only when observability extension and all sixteen subsystem contracts are machine readable', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-ready-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root);
      const reportPath = path.join(path.dirname(recordPath), 'production-loop-ready-report.json');
      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
        '--evaluated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(record.lastEventType).toBeUndefined();
      expect(record.gateChecks).toBeUndefined();
      expect(report).toMatchObject({
        reportType: 'production_loop_ready_report',
        decision: 'pass',
      });
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the extension ref is missing from the controlled requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-no-extension-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root);
      const reportPath = path.join(path.dirname(recordPath), 'production-loop-ready-report.json');
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.extensionRefs = [];
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);

      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(updated.gateChecks).toBeUndefined();
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('observability_extension_ref_missing');
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when observability or subsystem readiness coverage is incomplete', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-incomplete-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root, { completeExtension: false });
      const reportPath = path.join(path.dirname(recordPath), 'production-loop-ready-report.json');

      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);

      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(updated.gateChecks).toBeUndefined();
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('observability_rollbackConditions_missing');
      expect(report.blockingReasons).toContain('subsystem_missing:prompt_packet_generation');
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when subsystem readiness only declares status without concrete evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-declaration-only-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionPath = path.resolve(root, (record.extensionRefs[0].path as string).replace(/\//gu, path.sep));
      const extensionValue = JSON.parse(readFileSync(extensionPath, 'utf8'));
      extensionValue.subsystemReadiness = extensionValue.subsystemReadiness.map((item: Record<string, unknown>) => {
        const { commandRuns, artifactRefs, controlledEventRefs, recoveryActionEvidence, ...rest } = item;
        void commandRuns;
        void artifactRefs;
        void controlledEventRefs;
        void recoveryActionEvidence;
        return rest;
      });
      writeJson(extensionPath, extensionValue);
      record.extensionRefs[0].contentHash = sha256File(extensionPath);
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const reportPath = path.join(path.dirname(recordPath), 'production-loop-ready-report.json');

      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.blockingReasons).toEqual(
        expect.arrayContaining([
          'subsystem_command_evidence_missing:requirement_confirmation',
          'subsystem_artifact_evidence_missing:requirement_confirmation',
          'subsystem_controlled_event_evidence_missing:requirement_confirmation',
          'subsystem_recovery_evidence_missing:requirement_confirmation',
        ])
      );
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when only SFT JSONL exists without governed dataset release artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-sft-only-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root, { onlySftFile: true });
      const reportPath = path.join(path.dirname(recordPath), 'production-loop-ready-report.json');

      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);

      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(updated.gateChecks).toBeUndefined();
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toEqual(
        expect.arrayContaining(['dataset_release_report_missing', 'dataset_manifest_missing'])
      );
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
