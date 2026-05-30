import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainStrictCloseoutProofGate } from '../../scripts/strict-closeout-proof-gate';
import { implementationConfirmationHash } from '../../scripts/target-artifact-realization-gate';

const EVENT_HASH = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const ZERO_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
const HISTORICAL_HASH = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const BROKEN_HASH = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const REBASELINE_HASH = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const ATTEMPT = 'closeout-strict-001';
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

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function writeSourceDoc(root: string) {
  const confirmation = {
    status: 'user_confirmed',
    artifactAutomationPlan: [],
    currentTargetMap: {
      canonicalArtifacts: [],
      pathRegistry: [],
      existingArtifacts: [],
    },
  };
  const sourcePath = path.join(root, 'source.md');
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  artifactAutomationPlan: []',
      '  currentTargetMap:',
      '    canonicalArtifacts: []',
      '    pathRegistry: []',
      '    existingArtifacts: []',
      '',
    ].join('\n')
  );
  return { sourcePath, implementationHash: implementationConfirmationHash(confirmation) };
}

function writeReceipt(base: string, eventId: string, eventHash: string): void {
  writeJson(
    path.join(base, 'events', 'receipts', `${eventId.replace(/[^a-z0-9_.-]/giu, '_')}.json`),
    {
      eventId,
      eventHash,
    }
  );
}

function artifact(filePath: string, artifactType: string, relatedRequirementIds = ['TRACE-040']) {
  return {
    eventType: 'artifact_indexed',
    artifactType,
    sourceOfTruthRole: 'evidence',
    path: filePath.replace(/\\/gu, '/'),
    contentHash: sha256File(filePath),
    producer: 'strict-closeout-proof-gate.test',
    purpose: `prove ${artifactType}`,
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: `${artifactType}-v1`,
  };
}

function subsystem(subsystemId: string) {
  return {
    subsystemId,
    status: 'ready',
    inputRefs: [`input:${subsystemId}`],
    outputRefs: [`output:${subsystemId}`],
    evidenceRefs: ['EVD-053'],
    failureHandling: {
      recoveryActions: ['block_closeout'],
    },
  };
}

function datasetArtifacts(base: string) {
  const root = path.join(base, 'dataset');
  const train = path.join(root, 'exports', 'train.jsonl');
  const validation = path.join(root, 'exports', 'validation.jsonl');
  const test = path.join(root, 'exports', 'test.jsonl');
  const openai = path.join(root, 'canonical-samples.openai.jsonl');
  const hf = path.join(root, 'canonical-samples.hf.jsonl');
  const quality = path.join(root, 'quality-report.json');
  const redaction = path.join(root, 'redaction-report.json');
  const contamination = path.join(root, 'contamination-report.json');
  const lineage = path.join(root, 'lineage-report.json');
  const evalReport = path.join(root, 'post-training-eval-report.json');
  const training = path.join(root, 'training-run.json');
  writeText(train, '{"sample_id":"1"}\n');
  writeText(validation, '');
  writeText(test, '');
  writeText(openai, '{"custom_id":"1"}\n');
  writeText(hf, '{"sample_id":"1"}\n');
  [quality, redaction, contamination, lineage, evalReport, training].forEach((file) =>
    writeJson(file, { ok: true })
  );
  return {
    train,
    validation,
    test,
    openai,
    hf,
    quality,
    redaction,
    contamination,
    lineage,
    evalReport,
    training,
  };
}

function writeFixture(
  root: string,
  overrides: { omitFailureCommand?: boolean; omitHfProjection?: boolean } = {}
) {
  const source = writeSourceDoc(root);
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT');
  const extensionPath = path.join(base, 'evidence', 'production-loop-16-subsystems-extension.json');
  writeJson(extensionPath, {
    subsystemReadiness: SUBSYSTEM_IDS.map(subsystem),
  });
  const failurePath = path.join(base, 'evidence', 'failure-case-coverage.json');
  writeJson(failurePath, {
    resumeFailureCaseRegistryCoverage: {
      caseEvidence: Array.from({ length: 27 }, (_, index) => ({
        caseId: `case-${index + 1}`,
        sourceRefs: [
          {
            sourceType: 'functionalResumeFailureCaseRegistry.failureCases',
            id: `case-${index + 1}`,
          },
        ],
        expectedRecoveryActions: ['block_closeout'],
      })),
    },
  });
  const dataset = datasetArtifacts(base);
  const manifestPath = path.join(base, 'evidence', 'dataset-manifest.json');
  writeJson(manifestPath, {
    exports: {
      train: { path: dataset.train, hash: sha256File(dataset.train) },
      validation: { path: dataset.validation, hash: sha256File(dataset.validation) },
      test: { path: dataset.test, hash: sha256File(dataset.test) },
    },
    projections: {
      openai: { path: dataset.openai, hash: sha256File(dataset.openai) },
      ...(overrides.omitHfProjection
        ? {}
        : { huggingface: { path: dataset.hf, hash: sha256File(dataset.hf) } }),
    },
    reports: {
      qualityReport: { path: dataset.quality, hash: sha256File(dataset.quality) },
      redactionReport: { path: dataset.redaction, hash: sha256File(dataset.redaction) },
      contaminationReport: { path: dataset.contamination, hash: sha256File(dataset.contamination) },
      lineageReport: { path: dataset.lineage, hash: sha256File(dataset.lineage) },
      postTrainingEvalReport: { path: dataset.evalReport, hash: sha256File(dataset.evalReport) },
    },
    training: {
      trainingRun: { path: dataset.training, hash: sha256File(dataset.training) },
      evalReport: { path: dataset.evalReport, hash: sha256File(dataset.evalReport) },
    },
  });
  const releasePath = path.join(base, 'evidence', 'dataset-release-gate-report.json');
  writeJson(releasePath, { decision: 'pass' });
  const refs = [
    artifact(extensionPath, 'observability_extension'),
    artifact(failurePath, 'failure_case_coverage'),
    artifact(manifestPath, 'dataset_release_manifest'),
    artifact(releasePath, 'dataset_release_gate_report'),
  ];
  const event = {
    eventId: 'implementation_evidence_ingested:strict',
    eventType: 'implementation_evidence_ingested',
    writerId: 'implementation-evidence-ingest',
    previousEventHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    eventHash: EVENT_HASH,
    payload: {
      packet: { closeoutAttemptId: ATTEMPT, artifactRefs: refs.slice(1), extensionRefs: [refs[0]] },
    },
  };
  const eventLogPath = path.join(base, 'events', 'control-events.jsonl');
  mkdirSync(path.dirname(eventLogPath), { recursive: true });
  writeFileSync(eventLogPath, `${JSON.stringify(event)}\n`, 'utf8');
  writeJson(path.join(base, 'events', 'receipts', 'implementation_evidence_ingested_strict.json'), {
    eventId: event.eventId,
    eventHash: EVENT_HASH,
  });
  const commandRunRefs = [
    {
      commandId: 'CMD-PRODUCTION-SUBSYSTEM-ACCEPTANCE',
      closeoutAttemptId: ATTEMPT,
      runId: 'run-prod',
      exitCode: 0,
    },
    ...(!overrides.omitFailureCommand
      ? [
          {
            commandId: 'CMD-FULL-FAILURE-CASE-COVERAGE',
            closeoutAttemptId: ATTEMPT,
            runId: 'run-failure',
            exitCode: 0,
          },
        ]
      : []),
    {
      commandId: 'CMD-STRICT-CLOSEOUT-PROOF-GATE',
      closeoutAttemptId: ATTEMPT,
      runId: 'run-strict',
      exitCode: 0,
    },
  ];
  const record = {
    recordId: 'REQ-CLOSEOUT',
    requirementSetId: 'REQ-CLOSEOUT',
    status: 'user_confirmed',
    sourcePath: source.sourcePath,
    sourceDocumentHash: HASH,
    implementationConfirmationHash: source.implementationHash,
    architectureConfirmationState: { status: 'active', currentArchitectureConfirmationHash: HASH },
    controlStore: {
      eventLogPath: eventLogPath.replace(/\\/gu, '/'),
      reducer: 'canonical-requirement-record-reducer/v1',
      atomicCommitter: 'requirement-record-control-store/v1',
    },
    eventChainHead: EVENT_HASH,
    lastAppliedEventHash: EVENT_HASH,
    eventCount: 1,
    executionIterations: [{ executionIterationId: 'exec-current', commandRunRefs }],
    artifactIndex: refs,
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-STRICT-CLOSEOUT-PROOF-GATE',
          lastRunRef: { closeoutAttemptId: ATTEMPT },
          artifactRefs: [refs[2]],
        },
      ],
    },
  };
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, record);
  return { recordPath, base, sourcePath: source.sourcePath };
}

function writeScopedAiTddFixture(root: string) {
  const base = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-AI-TDD-SCOPED'
  );
  const sourcePath = path.join(root, 'source.md');
  const confirmation = {
    status: 'user_confirmed',
    applicability: {
      runtimeRecovery: {
        applies: true,
        requiresFunctionalResumeFailureCaseRegistry: false,
      },
      scoringDashboardSft: {
        applies: false,
        reasonCode: 'no_scoring_dashboard_sft_dataset_or_read_model_changes',
      },
    },
    artifactAutomationPlan: [],
    currentTargetMap: {
      canonicalArtifacts: [],
      pathRegistry: [],
      existingArtifacts: [],
    },
  };
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  applicability:',
      '    runtimeRecovery:',
      '      applies: true',
      '      requiresFunctionalResumeFailureCaseRegistry: false',
      '    scoringDashboardSft:',
      '      applies: false',
      '      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes',
      '  artifactAutomationPlan: []',
      '  currentTargetMap:',
      '    canonicalArtifacts: []',
      '    pathRegistry: []',
      '    existingArtifacts: []',
      '',
    ].join('\n')
  );
  const event = {
    eventId: 'implementation_evidence_ingested:scoped',
    eventType: 'implementation_evidence_ingested',
    writerId: 'implementation-evidence-ingest',
    previousEventHash: ZERO_HASH,
    eventHash: EVENT_HASH,
    payload: {
      packet: { closeoutAttemptId: ATTEMPT, artifactRefs: [] },
    },
  };
  const eventLogPath = path.join(base, 'events', 'control-events.jsonl');
  mkdirSync(path.dirname(eventLogPath), { recursive: true });
  writeFileSync(eventLogPath, `${JSON.stringify(event)}\n`, 'utf8');
  writeReceipt(base, event.eventId, EVENT_HASH);
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, {
    recordId: 'REQ-AI-TDD-SCOPED',
    requirementSetId: 'REQ-AI-TDD-SCOPED',
    status: 'user_confirmed',
    sourcePath,
    sourceDocumentHash: HASH,
    implementationConfirmationHash: implementationConfirmationHash(confirmation),
    controlStore: {
      eventLogPath: eventLogPath.replace(/\\/gu, '/'),
      reducer: 'canonical-requirement-record-reducer/v1',
      atomicCommitter: 'requirement-record-control-store/v1',
    },
    eventChainHead: EVENT_HASH,
    lastAppliedEventHash: EVENT_HASH,
    eventCount: 1,
    executionIterations: [
      {
        executionIterationId: 'exec-current',
        commandRunRefs: [
          {
            commandId: 'CMD-STRICT-CLOSEOUT-PROOF-GATE',
            closeoutAttemptId: ATTEMPT,
            runId: 'run-strict',
            exitCode: 0,
          },
        ],
      },
    ],
    artifactIndex: [],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-STRICT-CLOSEOUT-PROOF-GATE',
          lastRunRef: { closeoutAttemptId: ATTEMPT },
          artifactRefs: [],
        },
      ],
    },
  });
  return { recordPath, base, sourcePath };
}

function addControlledRebaselineFixture(recordPath: string, base: string) {
  const eventLogPath = path.join(base, 'events', 'control-events.jsonl');
  const original = JSON.parse(readFileSync(eventLogPath, 'utf8').trim());
  const historical = {
    eventId: 'historical:clean',
    eventType: 'implementation_evidence_ingested',
    writerId: 'implementation-evidence-ingest',
    previousEventHash: ZERO_HASH,
    eventHash: HISTORICAL_HASH,
    payload: {},
  };
  const broken = {
    eventId: 'historical:broken',
    eventType: 'closeout_recorded',
    writerId: 'delivery-closeout-gate-writer',
    previousEventHash: EVENT_HASH,
    eventHash: BROKEN_HASH,
    payload: {},
  };
  const rebaseline = {
    eventId: 'control_log_rebaseline_recorded:strict',
    eventType: 'control_log_rebaseline_recorded',
    writerId: 'control-log-rebaseline-writer',
    previousEventHash: BROKEN_HASH,
    eventHash: REBASELINE_HASH,
    payload: {
      rebaseline: {
        controlled: true,
        mode: 'event-log-chain-rebaseline',
        priorEventHash: BROKEN_HASH,
      },
    },
  };
  original.previousEventHash = REBASELINE_HASH;
  writeFileSync(
    eventLogPath,
    [historical, broken, rebaseline, original].map((event) => JSON.stringify(event)).join('\n') +
      '\n',
    'utf8'
  );
  for (const event of [historical, broken, rebaseline])
    writeReceipt(base, event.eventId, event.eventHash);
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  writeJson(recordPath, {
    ...record,
    eventCount: 4,
    eventChainHead: EVENT_HASH,
    lastAppliedEventHash: EVENT_HASH,
  });
}

describe('strict closeout proof gate', () => {
  it('passes only when current attempt joins command, artifact, event, subsystem, failure case, and dataset proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-closeout-pass-'));
    try {
      const { recordPath, base, sourcePath } = writeFixture(root);
      const reportPath = path.join(base, 'strict-report.json');
      const code = mainStrictCloseoutProofGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);
      expect(code).toBe(0);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.decision).toBe('pass');
      expect(report.subsystemEvidence).toHaveLength(16);
      expect(report.failureCaseEvidence).toHaveLength(27);
      expect(report.sftProjectionLineage.ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a current-attempt failure case command or HF projection is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-closeout-blocked-'));
    try {
      const { recordPath, base, sourcePath } = writeFixture(root, {
        omitFailureCommand: true,
        omitHfProjection: true,
      });
      const reportPath = path.join(base, 'strict-report.json');
      const code = mainStrictCloseoutProofGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);
      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.blockingReasons).toContain('failure_case_join_failed:case-1');
      expect(report.blockingReasons).toContain('sft_projection_lineage_failed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows replay from a controlled rebaseline after a broken historical segment', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-closeout-rebaseline-'));
    try {
      const { recordPath, base, sourcePath } = writeFixture(root);
      addControlledRebaselineFixture(recordPath, base);
      const reportPath = path.join(base, 'strict-report.json');
      const code = mainStrictCloseoutProofGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);
      expect(code).toBe(0);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.replayFromEventLog.mode).toBe('event-log-chain-from-rebaseline');
      expect(report.replayFromEventLog.replayStartIndex).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts default dataset release artifacts and typed execution closure writer for current attempts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-closeout-default-dataset-'));
    try {
      const { recordPath, base, sourcePath } = writeFixture(root);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const manifestRef = record.artifactIndex.find(
        (item: Record<string, unknown>) => item.artifactType === 'dataset_release_manifest'
      ) as Record<string, string>;
      const releaseRef = record.artifactIndex.find(
        (item: Record<string, unknown>) => item.artifactType === 'dataset_release_gate_report'
      ) as Record<string, string>;
      const defaultReleaseDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'datasets',
        'req-closeout-governed-sft',
        'v1'
      );
      mkdirSync(defaultReleaseDir, { recursive: true });
      writeFileSync(
        path.join(defaultReleaseDir, 'dataset-manifest.json'),
        readFileSync(manifestRef.path, 'utf8'),
        'utf8'
      );
      writeFileSync(
        path.join(defaultReleaseDir, 'dataset-release-gate-report.json'),
        readFileSync(releaseRef.path, 'utf8'),
        'utf8'
      );
      record.artifactIndex = record.artifactIndex.filter(
        (item: Record<string, unknown>) =>
          item.artifactType !== 'dataset_release_manifest' &&
          item.artifactType !== 'dataset_release_gate_report'
      );
      writeJson(recordPath, record);
      const eventLogPath = path.join(base, 'events', 'control-events.jsonl');
      const event = JSON.parse(readFileSync(eventLogPath, 'utf8'));
      event.writerId = 'execution-closure-gate-writer';
      writeFileSync(eventLogPath, `${JSON.stringify(event)}\n`, 'utf8');

      const reportPath = path.join(base, 'strict-report.json');
      const code = mainStrictCloseoutProofGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);

      expect(code).toBe(0);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.writerRegistryAuthorization.ok).toBe(true);
      expect(report.sftProjectionLineage.ok).toBe(true);
      expect(report.sftProjectionLineage.manifestPath).toContain('req-closeout-governed-sft');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when implementationConfirmationHash exists but --source is omitted', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-closeout-source-missing-'));
    try {
      const { recordPath, base } = writeFixture(root);
      const reportPath = path.join(base, 'strict-report.json');
      const code = mainStrictCloseoutProofGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);
      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.blockingReasons).toContain('target_artifact_source_missing');
      expect(report.blockingReasons).toContain('target_artifact_realization_failed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not require production subsystem or SFT artifacts when source applicability excludes them', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-closeout-scoped-'));
    try {
      const { recordPath, base, sourcePath } = writeScopedAiTddFixture(root);
      const reportPath = path.join(base, 'strict-report.json');
      const code = mainStrictCloseoutProofGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);
      expect(code).toBe(0);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.applicability).toMatchObject({
        productionSubsystemProofRequired: false,
        failureCaseProofRequired: false,
        sftProjectionProofRequired: false,
      });
      expect(report.blockingReasons).not.toContain('sft_projection_lineage_failed');
      expect(report.blockingReasons).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^subsystem_join_failed:/u)])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
