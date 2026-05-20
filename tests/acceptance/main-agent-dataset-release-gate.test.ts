import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDatasetReleaseGate } from '../../scripts/main-agent-dataset-release-gate';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const DATASET_ID = 'req-dataset-release-governed-sft';
const DATASET_VERSION = 'v1';

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

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeJsonl(filePath: string, rows: Record<string, unknown>[]): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '', 'utf8');
}

function concreteArtifactRef(id: string): Record<string, unknown> {
  return {
    artifactType: 'acceptance_evidence',
    sourceOfTruthRole: 'evidence',
    path: `_bmad-output/runtime/requirement-records/REQ-DATASET-RELEASE/evidence/${id}.json`,
    hash: sha256Text(`artifact:${id}`),
    producer: 'main-agent-dataset-release-gate.test',
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

function sample(sampleId: string): Record<string, unknown> {
  return {
    sample_id: sampleId,
    messages: [
      { role: 'system', content: 'Use controlled evidence only.' },
      { role: 'user', content: `Close ${sampleId}.` },
      { role: 'assistant', content: `Evidence for ${sampleId}.` },
    ],
    metadata: { sample_kind: 'implementation' },
    quality: { acceptance_decision: 'accepted', phase_score: 100, training_ready: true },
    provenance: { source_hash: SOURCE_HASH, lineage: [sampleId] },
    split: { assignment: 'train', group_key: 'story-1' },
    redaction: { status: 'clean', findings: [] },
  };
}

function subsystem(subsystemId: string): Record<string, unknown> {
  return {
    subsystemId,
    inputRefs: [`input:${subsystemId}`],
    outputRefs: [`output:${subsystemId}`],
    status: 'ready',
    evidenceRefs: ['EVD-010', 'EVD-014', 'EVD-015'],
    hash: sha256Text(subsystemId),
    failureHandling: {
      failureModes: [`${subsystemId}_unavailable`],
      recordEventTypes: ['failure_recorded', 'rca_created'],
      recoveryActions: ['record_failure', 'route_sample'],
    },
    ...concreteEvidence(`subsystem-${subsystemId}`),
  };
}

function writeFixture(root: string, options: { missingTrainingRun?: boolean; incompleteSubsystems?: boolean } = {}) {
  const recordId = 'REQ-DATASET-RELEASE';
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const dataDir = path.join(base, 'data');
  const governanceDir = path.join(dataDir, 'governance');
  const releaseDir = path.join(root, '_bmad-output', 'runtime', 'datasets', DATASET_ID, DATASET_VERSION);
  const extensionPath = path.join(base, 'extensions', 'production-loop-16-subsystems-extension.json');
  const extension = {
    recordId,
    requirementSetId: recordId,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    subsystemReadiness: SUBSYSTEM_IDS.map(subsystem),
  };
  if (options.incompleteSubsystems) extension.subsystemReadiness = extension.subsystemReadiness.slice(0, 15);
  writeJson(extensionPath, extension);
  const recordPath = path.join(base, 'requirement-record.json');
  const extensionRelativePath = path.relative(root, extensionPath).replace(/\\/gu, '/');
  writeJson(recordPath, {
    recordId,
    requirementSetId: recordId,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
    },
    extensionRefs: [
      {
        artifactType: 'observability_extension',
        sourceOfTruthRole: 'evidence',
        path: extensionRelativePath,
        contentHash: sha256File(extensionPath),
        producer: 'main-agent-dataset-release-gate.test',
        purpose: 'prove all sixteen subsystems are machine readable',
        relatedRequirementIds: ['MUST-017', 'EVD-010'],
        status: 'active',
        inputVersion: 'trace-007',
        outputVersion: 'subsystems-v1',
      },
    ],
  });
  const samples = [sample('sample-a'), sample('sample-b')];
  const routes = [
    { sampleRouteId: 'route-a', mentorEventId: 'event-a', destination: 'sft_positive', sftEligible: true, reasons: [] },
    { sampleRouteId: 'route-holdout', mentorEventId: 'event-holdout', destination: 'eval', sftEligible: false, reasons: ['requirement_not_closed:TRACE-X'] },
  ];
  writeJsonl(path.join(dataDir, 'canonical-samples.jsonl'), samples);
  writeJsonl(path.join(dataDir, 'sample-routes.jsonl'), routes);
  writeJsonl(path.join(dataDir, 'validation.jsonl'), []);
  writeJsonl(path.join(dataDir, 'test.jsonl'), []);
  writeJson(path.join(dataDir, 'dataset-manifest.json'), {
    bundle_id: `${recordId}-governed-data-products`,
    bundle_version: DATASET_VERSION,
    source_snapshot: {
      recordId,
      requirementSetId: recordId,
      sourceDocumentHash: SOURCE_HASH,
      implementationConfirmationHash: IMPLEMENTATION_HASH,
      architectureConfirmationHash: ARCHITECTURE_HASH,
    },
    export_hash: sha256Text(JSON.stringify(samples)),
    counts: { accepted: samples.length, rejected: 1 },
    redaction_summary: { clean: samples.length, blocked: 0 },
    validation_summary: {
      evalFirstRequired: true,
      holdoutRequired: true,
      sampleRoutesRequired: true,
      redactionRequired: true,
      contaminationScanRequired: true,
      withdrawalGovernanceRequired: true,
    },
  });
  for (const [file, body] of Object.entries({
    'split-report.json': { decision: 'pass' },
    'dedup-report.json': { decision: 'pass' },
    'contamination-report.json': { decision: 'pass', hitCount: 0 },
    'holdout-registry.json': { frozen: true, items: [routes[1]] },
    'post-training-eval-report.json': { trainingRunId: null, releaseDecision: 'blocked_until_training_run_bound' },
    'data-governance-gate-report.json': {
      decision: 'pass',
      checks: {
        split: { decision: 'pass' },
        dedup: { decision: 'pass' },
        contamination: { decision: 'pass' },
        postTrainingRegression: { trainingRunId: null },
      },
    },
  })) {
    writeJson(path.join(governanceDir, file), body);
  }
  const trainingRunPath = path.join(root, 'training-run.json');
  const evalReportPath = path.join(root, 'eval-report.json');
  if (!options.missingTrainingRun) {
    writeJson(trainingRunPath, {
      trainingRunId: 'train-001',
      datasetId: DATASET_ID,
      datasetVersion: DATASET_VERSION,
      status: 'completed',
    });
  }
  writeJson(evalReportPath, {
    evalReportId: 'eval-001',
    trainingRunId: 'train-001',
    decision: 'pass',
    trainingLossOnly: false,
    metrics: {
      requirement_adherence: { baseline: 0.9, current: 0.95, decision: 'pass' },
      evidence_completeness: { baseline: 0.9, current: 0.96, decision: 'pass' },
      rerun_rate: { baseline: 0.2, current: 0.1, decision: 'pass' },
      defect_escape_rate: { baseline: 0.1, current: 0.05, decision: 'pass' },
      similar_error_recurrence_rate: { baseline: 0.1, current: 0.02, decision: 'pass' },
    },
  });
  return { recordPath, dataDir, governanceDir, releaseDir, trainingRunPath, evalReportPath };
}

describe('main-agent dataset release gate', () => {
  it('passes only with release artifacts, training lineage, eval report, and all sixteen subsystems', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dataset-release-pass-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const fixture = writeFixture(root);
      const code = mainDatasetReleaseGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--governance-dir',
        fixture.governanceDir,
        '--out-dir',
        fixture.releaseDir,
        '--dataset-id',
        DATASET_ID,
        '--dataset-version',
        DATASET_VERSION,
        '--training-run',
        fixture.trainingRunPath,
        '--eval-report',
        fixture.evalReportPath,
        '--generated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(0);
      for (const file of [
        'dataset-manifest.json',
        'dataset-card.md',
        'quality-report.json',
        'redaction-report.json',
        'contamination-report.json',
        'revoked-samples.json',
        'lineage-report.json',
        'training-run.json',
        'post-training-eval-report.json',
        'dataset-release-gate-report.json',
      ]) {
        expect(existsSync(path.join(fixture.releaseDir, file))).toBe(true);
      }
      const manifest = JSON.parse(readFileSync(path.join(fixture.releaseDir, 'dataset-manifest.json'), 'utf8'));
      expect(manifest.releaseDecision).toBe('pass');
      expect(manifest.source).toMatchObject({
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationHash: ARCHITECTURE_HASH,
      });
      expect(manifest.training.trainingRun.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      const report = JSON.parse(readFileSync(path.join(fixture.releaseDir, 'dataset-release-gate-report.json'), 'utf8'));
      expect(report.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'sixteen-subsystems-machine-readable', passed: true, expectedCount: 16, actualCount: 16 }),
        ])
      );
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks release when training run metadata is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dataset-release-no-training-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const fixture = writeFixture(root, { missingTrainingRun: true });
      const code = mainDatasetReleaseGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--governance-dir',
        fixture.governanceDir,
        '--out-dir',
        fixture.releaseDir,
        '--dataset-id',
        DATASET_ID,
        '--dataset-version',
        DATASET_VERSION,
        '--eval-report',
        fixture.evalReportPath,
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(path.join(fixture.releaseDir, 'dataset-release-gate-report.json'), 'utf8'));
      expect(report.decision).toBe('blocked');
      expect(report.blockingIssues).toContain('training_run_missing');
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks release when any of the sixteen subsystem readiness contracts is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dataset-release-subsystem-missing-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const fixture = writeFixture(root, { incompleteSubsystems: true });
      const code = mainDatasetReleaseGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--governance-dir',
        fixture.governanceDir,
        '--out-dir',
        fixture.releaseDir,
        '--dataset-id',
        DATASET_ID,
        '--dataset-version',
        DATASET_VERSION,
        '--training-run',
        fixture.trainingRunPath,
        '--eval-report',
        fixture.evalReportPath,
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(path.join(fixture.releaseDir, 'dataset-release-gate-report.json'), 'utf8'));
      expect(report.blockingIssues).toContain('subsystem_missing:prompt_packet_generation');
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks release when subsystem readiness only declares status without concrete evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dataset-release-subsystem-declaration-only-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const fixture = writeFixture(root);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
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
      writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDatasetReleaseGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--governance-dir',
        fixture.governanceDir,
        '--out-dir',
        fixture.releaseDir,
        '--dataset-id',
        DATASET_ID,
        '--dataset-version',
        DATASET_VERSION,
        '--training-run',
        fixture.trainingRunPath,
        '--eval-report',
        fixture.evalReportPath,
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(path.join(fixture.releaseDir, 'dataset-release-gate-report.json'), 'utf8'));
      expect(report.blockingIssues).toEqual(
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
});
