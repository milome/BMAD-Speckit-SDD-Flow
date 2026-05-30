import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
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

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/gu, '/');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function writeModelPacket(filePath: string, input: Record<string, unknown> = {}): string {
  writeJson(filePath, {
    schemaVersion: 'model-packet-fixture/v1',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    requirements: {
      must: [
        {
          id: 'MUST-001',
          text: 'MUST-001 requires current attempt command, artifact, test result, and closure.',
          riskLevel: 'critical',
          evidenceRefs: ['EVD-001'],
          coveredByTraceRows: ['TRACE-001'],
        },
      ],
    },
    traceSlices: [
      {
        traceId: 'TRACE-001',
        requirementRefs: ['MUST-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-DELIVERY'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-DELIVERY',
        command: 'node verify-delivery.js',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    ...input,
  });
  return filePath;
}

function writeDeliveryTruthReport(root: string, overrides: Record<string, unknown> = {}): string {
  const reportPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'gates',
    'main-agent-delivery-truth-gate-report.json'
  );
  writeJson(reportPath, {
    reportType: 'main_agent_delivery_truth_gate',
    generatedAt: '2026-05-19T00:00:00.000Z',
    completionAllowed: true,
    deliveryStatus: 'complete',
    completionLanguage: 'complete_allowed',
    missingEvidence: [],
    failedEvidence: [],
    evidencePaths: {},
    checks: [
      {
        id: 'release-gate',
        passed: true,
        summary: 'critical_failures=0, blocked_sprint_status_update=false, completion_intent=present',
      },
    ],
    ...overrides,
  });
  return reportPath;
}

function cleanupTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function recordText(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? (record[key] as string) : '';
}

function currentArchitectureHash(record: Record<string, unknown>): string {
  const state = record.architectureConfirmationState as Record<string, unknown> | undefined;
  return typeof state?.currentArchitectureConfirmationHash === 'string' ? state.currentArchitectureConfirmationHash : HASH;
}

function modelResult(model: string, status = 'pass'): Record<string, unknown> {
  return modelResultWithHashes(model, HASH, HASH, status);
}

function modelResultWithHashes(
  model: string,
  sourceDocumentHash: string,
  implementationConfirmationHash: string,
  status = 'pass'
): Record<string, unknown> {
  return {
    payloadKind: 'model_result',
    model,
    recordId: 'REQ-CLOSEOUT',
    requirementSetId: 'REQ-CLOSEOUT',
    sourceDocumentHash,
    implementationConfirmationHash,
    status,
    resultRecordedAt: '2026-05-19T00:00:00.000Z',
    resultRecordedBy: 'test-agent',
    blockingReasons: status === 'pass' ? [] : [`${model}_${status}`],
    sourceRefs: [{ sourceType: 'fixture', id: model }],
    currentHashes: {
      sourceDocumentHash,
      implementationConfirmationHash,
    },
  };
}

function artifact(filePath: string, artifactType: string): Record<string, unknown> {
  return {
    artifactType,
    path: filePath.replace(/\\/gu, '/'),
    hash: sha256File(filePath),
  };
}

function concreteArtifactRef(id: string): Record<string, unknown> {
  return {
    artifactType: 'acceptance_evidence',
    sourceOfTruthRole: 'evidence',
    path: `_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/evidence/${id}.json`,
    hash: HASH,
    producer: 'main-agent-delivery-closeout-gate-record.test',
    purpose: `prove concrete evidence for ${id}`,
    relatedRequirementIds: ['MUST-039', 'MUST-040', 'MUST-041', 'EVD-039', 'EVD-040', 'EVD-041'],
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
        closeoutAttemptId: 'current-attempt-evidence',
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
        eventHash: HASH,
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

function subsystem(record: Record<string, unknown>, subsystemId: string): Record<string, unknown> {
  return {
    subsystemId,
    inputRefs: [`input:${subsystemId}`],
    outputRefs: [`output:${subsystemId}`],
    status: 'ready',
    evidenceRefs: ['EVD-010', 'EVD-009'],
    hash: sha256Text(subsystemId),
    failureHandling: {
      failureModes: [
        `${subsystemId}_unavailable`,
        `${subsystemId}_stale_hash`,
        `${subsystemId}_missing_evidence`,
      ],
      recordEventTypes: ['failure_recorded', 'gate_check_recorded', 'rca_created'],
      recoveryActions: ['record_failure', 'open_rca', 'rerun_current_trace', 'block_closeout'],
    },
    currentHashBinding: {
      sourceDocumentHash: recordText(record, 'sourceDocumentHash'),
      implementationConfirmationHash: recordText(record, 'implementationConfirmationHash'),
      architectureConfirmationHash: currentArchitectureHash(record),
    },
    functionalParity: {
      userVisibleBehaviorPreserved: true,
      regressionEvidenceRefs: ['EVD-040'],
    },
    ...concreteEvidence(`subsystem-${subsystemId}`),
  };
}

function subsystemAcceptance(subsystemId: string): Record<string, unknown> {
  return {
    subsystemId,
    passCriteria: [
      'machine_readable_inputs_outputs_status_evidence_hash',
      'failure_handling_declared',
      'no_user_visible_regression',
    ],
    requiredEvidenceRefs: ['EVD-010', 'EVD-009'],
    requiredCommands: ['CMD-PRODUCTION-SUBSYSTEM-ACCEPTANCE', 'CMD-DATASET-RELEASE-GATE'],
    requiredFailureCases: [
      `${subsystemId}_unavailable`,
      `${subsystemId}_stale_hash`,
      `${subsystemId}_missing_evidence`,
    ],
    recordEventTypes: ['failure_recorded', 'gate_check_recorded', 'rca_created'],
    recoveryActions: ['record_failure', 'open_rca', 'rerun_current_trace', 'block_closeout'],
    functionalParity: {
      userVisibleBehaviorPreserved: true,
      replacementScripts: [
        'scripts/main-agent-production-loop-ready-check.ts',
        'scripts/main-agent-dataset-release-gate.ts',
      ],
      replacementArtifacts: [
        'production-loop-16-subsystems-extension.json',
        'dataset-manifest.json',
        'dataset-release-gate-report.json',
      ],
    },
  };
}

function writeProductionArtifacts(
  root: string,
  base: string,
  record: Record<string, unknown>
): {
  extensionRef: Record<string, unknown>;
  productionReportArtifact: Record<string, unknown>;
} {
  const recordId = recordText(record, 'recordId');
  const requirementSetId = recordText(record, 'requirementSetId') || recordId;
  const sourceDocumentHash = recordText(record, 'sourceDocumentHash');
  const implementationConfirmationHash = recordText(record, 'implementationConfirmationHash');
  const architectureConfirmationHash = currentArchitectureHash(record);
  const extensionPath = path.join(base, 'extensions', 'production-loop-16-subsystems-extension.json');
  const productionSubsystemAcceptanceRegistry = {
    registryVersion: 'production-subsystem-acceptance/v1',
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash,
    subsystemAcceptance: SUBSYSTEM_IDS.map(subsystemAcceptance),
  };
  const extension = {
    recordId,
    requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash,
    canaryPlan: [{ stage: 'internal', rolloutPercent: 10, rollbackOn: 'production_loop_ready_blocked' }],
    sloTargets: [{ name: 'delivery_closeout_gate_latency', target: '<= 5000ms' }],
    errorRateMetrics: [{ name: 'gate_failure_rate', threshold: '<= 1%' }],
    performanceMetrics: [{ name: 'production_loop_ready_eval_duration_ms', threshold: '<= 5000' }],
    businessMetrics: [{ name: 'requirement_reopen_rate', threshold: '<= 5%' }],
    alerts: [{ name: 'production_loop_blocked', owner: 'main-agent' }],
    rollbackConditions: [{ condition: 'hash_mismatch_or_missing_subsystem_readiness', action: 'block_closeout_and_open_rca' }],
    feedbackRouting: {
      failureRecordEventTypes: ['failure_recorded', 'gate_check_recorded'],
      rcaRecordEventTypes: ['rca_created', 'rca_action_recorded'],
      sampleRouteOutputs: ['sample-routes.jsonl', 'mentor-events.jsonl', 'canonical-samples.jsonl'],
    },
    subsystemReadiness: SUBSYSTEM_IDS.map((id) => subsystem(record, id)),
    currentHashBinding: {
      sourceDocumentHash,
      implementationConfirmationHash,
      architectureConfirmationHash,
    },
    productionSubsystemAcceptanceRegistry,
    productionSubsystemAcceptanceRegistryHash: sha256Text(JSON.stringify(productionSubsystemAcceptanceRegistry)),
    functionalParity: {
      userVisibleBehaviorPreserved: true,
      replacementScripts: [
        'scripts/main-agent-production-loop-ready-check.ts',
        'scripts/main-agent-dataset-release-gate.ts',
      ],
      replacementArtifacts: [
        'production-loop-16-subsystems-extension.json',
        'dataset-manifest.json',
        'dataset-release-gate-report.json',
      ],
      regressionTests: [
        'tests/acceptance/main-agent-production-loop-ready-check.test.ts',
        'tests/acceptance/main-agent-dataset-release-gate.test.ts',
      ],
      evidenceRefs: ['EVD-039', 'EVD-040', 'EVD-043'],
    },
  };
  writeJson(extensionPath, extension);

  const datasetId = `${recordId}-governed-sft`.toLowerCase();
  const datasetRoot = path.join(root, '_bmad-output', 'runtime', 'datasets', datasetId, 'v1');
  const trainPath = path.join(datasetRoot, 'exports', 'train.jsonl');
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
  writeText(trainPath, '{"sample_id":"sample-001","messages":[]}\n');
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
      requirementSetId,
      sourceDocumentHash,
      implementationConfirmationHash,
      architectureConfirmationHash,
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
      subsystems: SUBSYSTEM_IDS.length,
    },
  });
  writeJson(releaseReportPath, {
    reportType: 'dataset_release_gate_report',
    recordId,
    requirementSetId,
    decision: 'pass',
    blockingIssues: [],
    checks: [
      { id: 'source-manifest-current', passed: true },
      { id: 'training-run-bound', passed: true },
      { id: 'post-training-eval-bound', passed: true },
      { id: 'sixteen-subsystems-machine-readable', passed: true, expectedCount: 16, actualCount: 16 },
    ],
    manifestHash: sha256File(manifestPath),
  });

  const extensionRef = {
    eventType: 'artifact_indexed',
    artifactType: 'observability_extension',
    sourceOfTruthRole: 'evidence',
    recordId,
    requirementSetId,
    path: extensionPath.replace(/\\/gu, '/'),
    contentHash: sha256File(extensionPath),
    producer: 'main-agent-delivery-closeout-gate-record.test',
    purpose: 'prove current 16-subsystem production loop readiness extension',
    relatedRequirementIds: ['MUST-017', 'MUST-039', 'MUST-040', 'MUST-043', 'EVD-039', 'EVD-040', 'EVD-043'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'production-loop-16-subsystems-extension-v1',
  };
  const productionReadyReportPath = path.join(base, 'production-loop-ready-report.json');
  writeJson(productionReadyReportPath, {
    reportType: 'production_loop_ready_report',
    generatedAt: '2026-05-19T00:00:00.000Z',
    recordId,
    requirementSetId,
    decision: 'pass',
    blockingReasons: [],
    checks: [
      { id: 'governed-dataset-release-complete', passed: true },
      { id: 'sixteen-subsystems-machine-readable', passed: true, expectedCount: 16, actualCount: 16 },
    ],
    extensionRef,
  });

  return {
    extensionRef,
    productionReportArtifact: {
      eventType: 'artifact_indexed',
      artifactType: 'production_subsystem_acceptance_report',
      sourceOfTruthRole: 'evidence',
      recordId,
      requirementSetId,
      path: productionReadyReportPath.replace(/\\/gu, '/'),
      contentHash: sha256File(productionReadyReportPath),
      producer: 'main-agent-delivery-closeout-gate-record.test',
      purpose: 'prove Production Loop Ready passes current 16-subsystem acceptance gate',
      relatedRequirementIds: ['MUST-039', 'MUST-040', 'MUST-043', 'NEG-028', 'NEG-030', 'NEG-031', 'EVD-039', 'EVD-040'],
      status: 'active',
      inputVersion: 'source-v1',
      outputVersion: 'production-subsystem-acceptance-report-v1',
    },
  };
}

function writeRecord(root: string, record: Record<string, unknown>): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT');
  mkdirSync(base, { recursive: true });
  writeDeliveryTruthReport(root);
  if (typeof record.sourcePath === 'string' && record.sourcePath && !readMaybeExists(record.sourcePath)) {
    writeText(
      record.sourcePath,
      [
        'implementationConfirmation:',
        '  status: user_confirmed',
        '  must: []',
        '  notDone: []',
        '  mustNot: []',
        '  evidence: []',
        '  traceRows: []',
        '',
      ].join('\n')
    );
  }
  const coveragePath = path.join(base, 'evidence', 'failure-case-coverage.json');
  mkdirSync(path.dirname(coveragePath), { recursive: true });
  writeFileSync(
    coveragePath,
    `${JSON.stringify(
      {
        reportType: 'failure_case_coverage',
        resumeFailureCaseRegistryCoverage: {
          failureCases: 2,
          failureCaseExercisedCount: 2,
          unexercisedCases: [],
          issues: [],
          caseEvidence: [
            {
              caseId: 'sourceDocumentHash_changed',
              ...concreteEvidence('failure-case-sourceDocumentHash_changed'),
            },
            {
              caseId: 'missing_required_artifact',
              ...concreteEvidence('failure-case-missing_required_artifact'),
            },
          ],
        },
        blockingIssues: [],
      },
      null,
      2
    )}\n`,
      'utf8'
  );
  const production = writeProductionArtifacts(root, base, record);
  const recordWithCoverage = {
    ...record,
    extensionRefs: [
      ...(((record.extensionRefs as unknown[]) ?? []) as Record<string, unknown>[]),
      production.extensionRef,
    ],
    artifactIndex: [
      ...(((record.artifactIndex as unknown[]) ?? []) as Record<string, unknown>[]),
      {
        artifactType: 'failure_case_coverage',
        sourceOfTruthRole: 'evidence',
        path: coveragePath,
        hash: sha256File(coveragePath),
        producer: 'main-agent-delivery-closeout-gate-record.test',
        purpose: 'prove complete failure-case coverage for closeout fixture',
        relatedRequirementIds: ['MUST-041', 'NEG-029', 'EVD-041'],
        status: 'active',
        inputVersion: 'source-v1',
        outputVersion: 'failure-case-coverage-v1',
      },
      production.productionReportArtifact,
    ],
  };
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(recordPath, `${JSON.stringify(recordWithCoverage, null, 2)}\n`, 'utf8');
  return recordPath;
}

function readMaybeExists(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function evidenceArtifactRef(pathValue = '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/execution/evidence.json') {
  return {
    artifactType: 'implementation_evidence',
    sourceOfTruthRole: 'evidence',
    path: pathValue,
    hash: HASH,
    producer: 'main-agent-delivery-closeout-gate-record.test',
    purpose: 'prove current closeout attempt delivery evidence',
    relatedRequirementIds: ['MUST-007', 'NEG-008'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
  };
}

function writeAiTddSource(root: string, testPath: string): string {
  const sourcePath = path.join(root, 'ai-tdd-source.md');
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  must:',
      '    - id: MUST-001',
      '      text: Must pass closeout acceptance.',
      '      evidenceRefs: [EVD-001]',
      '      coveredByTraceRows: [TRACE-001]',
      '  notDone:',
      '    - id: NEG-001',
      '      text: Missing AI-TDD acceptance cannot close.',
      '      evidenceRefs: [EVD-001]',
      '      oracle: negative control oracle',
      '      coveredByTraceRows: [TRACE-001]',
      '  mustNot:',
      '    - id: OUT-001',
      '      text: Do not self-certify closeout.',
      '  evidence:',
      '    - id: EVD-001',
      '      text: Current attempt acceptance evidence.',
      '      oracle: current-attempt command with artifact evidence',
      '      requiredCommandRefs: [CMD-AI-TDD]',
      '      artifactRefs: [ART-AI-TDD]',
      '  traceRows:',
      '    - id: TRACE-001',
      '      covers: [MUST-001, NEG-001]',
      '      evidenceRefs: [EVD-001]',
      '      deliveryEvidenceCommandRefs: [CMD-AI-TDD]',
      '      acceptanceRefs: [ACC-AI-TDD]',
      '  requiredCommands:',
      '    - id: CMD-AI-TDD',
      `      command: npx vitest run ${testPath.replace(/\\/gu, '/')}`,
      '      oracle: current-attempt command with artifact evidence',
      '  acceptanceTests:',
      '    - id: ACC-AI-TDD',
      `      file: ${testPath.replace(/\\/gu, '/')}`,
      '      covers: [MUST-001, NEG-001]',
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '      commandRefs: [CMD-AI-TDD]',
      '      expectedPreImplementationState: expected_red',
      '      oracle: current-attempt command with artifact evidence',
      '  artifactAutomationPlan:',
      '    - id: ART-AI-TDD',
      '      artifactType: report',
      '      path: _bmad-output/runtime/requirement-records/REQ-CLOSEOUT/evidence/ai-tdd.json',
      '      producer: ai-tdd-fixture',
      '      sourceOfTruthRole: evidence',
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '  currentTargetMap:',
      '    canonicalArtifacts: []',
      '    pathRegistry: []',
      '    existingArtifacts: []',
      '  applicability:',
      '    governanceEvents: { applies: false, reasonCode: not_applicable }',
      '    runtimeRecovery: { applies: false, reasonCode: not_applicable }',
      '    scoringDashboardSft: { applies: false, reasonCode: not_applicable }',
      '    currentTargetMap: { applies: false, reasonCode: not_applicable }',
      '    scriptsAndHooks: { applies: false, reasonCode: not_applicable }',
      '    aiTddContractGate: { applies: false, reasonCode: not_applicable }',
      '',
    ].join('\n')
  );
  return sourcePath;
}

function confirmationHashesForSource(sourcePath: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const sourceText = readFileSync(sourcePath, 'utf8');
  const blockText = sourceText;
  const semanticConfirmation = {
    acceptanceTests: [
      {
        commandRefs: ['CMD-AI-TDD'],
        covers: ['MUST-001', 'NEG-001'],
        evidenceRefs: ['EVD-001'],
        expectedPreImplementationState: 'expected_red',
        file: sourceText.match(/file: (.+)/u)?.[1] ?? '',
        id: 'ACC-AI-TDD',
        oracle: 'current-attempt command with artifact evidence',
        traceRows: ['TRACE-001'],
      },
    ],
    artifactAutomationPlan: [
      {
        artifactType: 'report',
        evidenceRefs: ['EVD-001'],
        id: 'ART-AI-TDD',
        path: '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/evidence/ai-tdd.json',
        producer: 'ai-tdd-fixture',
        sourceOfTruthRole: 'evidence',
        traceRows: ['TRACE-001'],
      },
    ],
    applicability: {
      aiTddContractGate: { applies: false, reasonCode: 'not_applicable' },
      currentTargetMap: { applies: false, reasonCode: 'not_applicable' },
      governanceEvents: { applies: false, reasonCode: 'not_applicable' },
      runtimeRecovery: { applies: false, reasonCode: 'not_applicable' },
      scoringDashboardSft: { applies: false, reasonCode: 'not_applicable' },
      scriptsAndHooks: { applies: false, reasonCode: 'not_applicable' },
    },
    currentTargetMap: {
      canonicalArtifacts: [],
      existingArtifacts: [],
      pathRegistry: [],
    },
    evidence: [
      {
        artifactRefs: ['ART-AI-TDD'],
        id: 'EVD-001',
        oracle: 'current-attempt command with artifact evidence',
        requiredCommandRefs: ['CMD-AI-TDD'],
        text: 'Current attempt acceptance evidence.',
      },
    ],
    must: [
      {
        coveredByTraceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        id: 'MUST-001',
        text: 'Must pass closeout acceptance.',
      },
    ],
    mustNot: [
      {
        id: 'OUT-001',
        text: 'Do not self-certify closeout.',
      },
    ],
    notDone: [
      {
        coveredByTraceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        id: 'NEG-001',
        oracle: 'negative control oracle',
        text: 'Missing AI-TDD acceptance cannot close.',
      },
    ],
    requiredCommands: [
      {
        command: sourceText.match(/command: (.+)/u)?.[1] ?? '',
        id: 'CMD-AI-TDD',
        oracle: 'current-attempt command with artifact evidence',
      },
    ],
    traceRows: [
      {
        acceptanceRefs: ['ACC-AI-TDD'],
        covers: ['MUST-001', 'NEG-001'],
        deliveryEvidenceCommandRefs: ['CMD-AI-TDD'],
        evidenceRefs: ['EVD-001'],
        id: 'TRACE-001',
      },
    ],
  };
  const implementationConfirmationHash = sha256Text(stableStringify(semanticConfirmation));
  const normalizedBlock = `implementationConfirmation:${stableStringify(semanticConfirmation)}`;
  return {
    sourceDocumentHash: sha256Text(sourceText.replace(blockText, normalizedBlock)),
    implementationConfirmationHash,
  };
}

function baseRecord(): Record<string, unknown> {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  return {
    recordId: 'REQ-CLOSEOUT',
    requirementSetId: 'REQ-CLOSEOUT',
    status: 'user_confirmed',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    currentMentalModel: 'audit_review',
    sixModelResults: {
      requirement_confirmation: modelResult('requirement_confirmation'),
      architecture_confirmation: modelResult('architecture_confirmation'),
      implementation_readiness: modelResult('implementation_readiness'),
      execution_closure: modelResult('execution_closure'),
      audit_review: modelResult('audit_review'),
    },
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: 'arch-run-001',
      currentArchitectureConfirmationHash: HASH,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
      staleInputs: {
        sourceDocumentHash: HASH,
        implementationConfirmationHash: HASH,
        currentArtifactHash: HASH,
        resolvedRecipeHash: recipe.resolvedRecipeHash,
      },
    },
    architectureConfirmationStateChecks: [
      {
        eventType: 'architecture_confirmation_recorded',
        recordId: 'REQ-CLOSEOUT',
        requirementSetId: 'REQ-CLOSEOUT',
        checkId: 'architecture-state:2026-05-19T00:00:00.000Z',
        decision: 'pass',
        resolvedRecipeHash: recipe.resolvedRecipeHash,
        stateTransition: {
          fromStatus: 'active',
          toStatus: 'active',
          reasonCode: 'hash_match',
          previousHashes: {
            sourceDocumentHash: HASH,
            implementationConfirmationHash: HASH,
            currentArtifactHash: HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          currentHashes: {
            sourceDocumentHash: HASH,
            implementationConfirmationHash: HASH,
            currentArtifactHash: HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          mismatchFields: [],
          recipeVersion: recipe.recipeVersion,
        },
        checkedAt: '2026-05-19T00:00:00.000Z',
        checkedBy: 'test-agent',
      },
    ],
    artifactIndex: [
      evidenceArtifactRef(),
    ],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      },
    ],
  };
}

describe('requirement-scoped delivery closeout gate', () => {
  it('creates a blocked immutable attempt when required commands are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-missing-'));
    try {
      const recordPath = writeRecord(root, baseRecord());
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe('closeout-001');
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'deliveryEvidence.requiredCommands_missing'
      );
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Delivery Closeout Gate',
        decision: 'blocked',
      });
      expect(record.failureRecords.at(-1)).toMatchObject({
        eventType: 'failure_recorded',
        type: 'delivery_closeout_blocked',
        status: 'open',
        closeoutAttemptId: 'closeout-001',
      });
      expect(record.failureRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'closeout_attempt', id: 'closeout-001' },
          { sourceType: 'gate_check', id: 'delivery-closeout:closeout-001' },
        ])
      );
      expect(record.rcaRecords.at(-1)).toMatchObject({
        eventType: 'rca_created',
        rcaId: 'rca:closeout-001',
        type: 'closeout_blocker',
        status: 'open',
      });
      expect(record.rcaRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'failure_record', id: 'failure:closeout-001' },
          { sourceType: 'closeout_attempt', id: 'closeout-001' },
        ])
      );
      expect(record.lastEventType).toBe('delivery_confirmation_result_recorded');
      expect(record.lastAppliedEventId).toContain('delivery_confirmation_result_recorded');
      expect(record.sixModelResults.delivery_confirmation).toMatchObject({
        payloadKind: 'model_result',
        model: 'delivery_confirmation',
        recordId: 'REQ-CLOSEOUT',
        requirementSetId: 'REQ-CLOSEOUT',
        status: 'blocked',
        blockingReasons: expect.arrayContaining([
          'deliveryEvidence.requiredCommands_missing',
          'negative_or_regression_command_missing',
        ]),
      });
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('passes only when current attempt required commands, artifacts, and closures are satisfied', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-pass-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-pass',
              artifactRefs: [
                evidenceArtifactRef(
                  '_bmad-output\\runtime\\requirement-records\\REQ-CLOSEOUT\\execution\\evidence.json'
                ),
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-pass',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-pass',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.status).toBe('awaiting_user_acceptance');
      expect(record.currentMentalModel).toBe('delivery_confirmation');
      expect(record.currentStage).toBe('delivery_confirmation');
      expect(record.sixModelResults.delivery_confirmation.status).toBe('awaiting_user_acceptance');
      expect(record.closeout.currentAttemptId).toBe('closeout-pass');
      expect(record.closeout).not.toHaveProperty('eventType');
      expect(record.closeout.decision).toBe('pass');
      expect(record.lastEventType).toBe('delivery_confirmation_user_acceptance_requested');
      expect(record.controlStore.eventLogPath).toContain('events/control-events.jsonl');
      expect(record.lastAppliedEventId).toContain('delivery_confirmation_user_acceptance_requested');
      expect(record.closeout.acceptanceRequest).toMatchObject({
        status: 'awaiting_user_acceptance',
        closeoutAttemptId: 'closeout-pass',
      });
      expect(record.closeout.acceptanceRequest.closeoutConfirmInstruction).toContain(
        '确认最终验收并关闭需求'
      );
      expect(readMaybeExists(path.join(path.dirname(recordPath), record.closeout.acceptanceRequest.htmlPath))).toContain(
        '确认最终验收并关闭需求'
      );
      expect(readMaybeExists(path.join(path.dirname(recordPath), record.closeout.acceptanceRequest.renderReportPath))).toContain(
        'closeoutDeliveryVerdict'
      );
      expect(record.closeout.attempts[0]).toMatchObject({
        closeoutAttemptId: 'closeout-pass',
        decision: 'pass',
      });
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('prefers canonical record source over stale synthetic closeout source when rendering acceptance request', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-source-'));
    try {
      const sourcePath = writeAiTddSource(root, path.join(root, 'tests', 'acceptance', 'ai-tdd.test.ts'));
      const sourceHashes = confirmationHashesForSource(sourcePath);
      const syntheticSourcePath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-CLOSEOUT',
        'confirmation',
        'closeout-confirmation-source.md'
      );
      writeText(
        syntheticSourcePath,
        [
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  must: []',
          '  notDone: []',
          '  mustNot: []',
          '  evidence: []',
          '  traceRows: []',
          '',
        ].join('\n')
      );
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
        sourcePath,
        sourceDocumentHash: sourceHashes.sourceDocumentHash,
        implementationConfirmationHash: sourceHashes.implementationConfirmationHash,
        sixModelResults: {
          ...((baseRecord().sixModelResults as Record<string, unknown>) ?? {}),
          execution_closure: modelResultWithHashes(
            'execution_closure',
            sourceHashes.sourceDocumentHash,
            sourceHashes.implementationConfirmationHash
          ),
          audit_review: modelResultWithHashes(
            'audit_review',
            sourceHashes.sourceDocumentHash,
            sourceHashes.implementationConfirmationHash
          ),
        },
        architectureConfirmationState: {
          ...(baseRecord().architectureConfirmationState as Record<string, unknown>),
          currentArchitectureConfirmationHash: HASH,
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-pass',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-pass',
                exitCode: 0,
                sourceDocumentHash: sourceHashes.sourceDocumentHash,
                implementationConfirmationHash: sourceHashes.implementationConfirmationHash,
                architectureConfirmationHash: HASH,
              },
            ],
          },
        ],
        requirementClosures: [
          {
            requirementId: 'MUST-001',
            status: 'pass',
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
            sourceDocumentHash: sourceHashes.sourceDocumentHash,
            implementationConfirmationHash: sourceHashes.implementationConfirmationHash,
            architectureConfirmationHash: HASH,
            closeoutAttemptId: 'closeout-pass',
          },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        syntheticSourcePath,
        '--attempt-id',
        'closeout-pass',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const acceptanceRequest = record.closeout.acceptanceRequest;
      const report = JSON.parse(
        readFileSync(path.join(path.dirname(recordPath), acceptanceRequest.renderReportPath), 'utf8')
      );

      expect(path.resolve(report.sourcePath)).toBe(path.resolve(sourcePath));
      expect(report.deliveryReadiness.currentPassTraceRows).toBe(1);
      expect(report.deliveryReadiness.totalTraceRows).toBe(1);
      expect(report.renderedSections).toContain('trace-matrix');
      expect(acceptanceRequest.ingestCommand).toContain(normalizeSlashes(sourcePath));
      expect(acceptanceRequest.ingestCommand).not.toContain('closeout-confirmation-source.md');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when audit_review is not current pass', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-audit-prereq-'));
    try {
      const base = baseRecord();
      const recordPath = writeRecord(root, {
        ...base,
        sixModelResults: {
          ...(base.sixModelResults as Record<string, unknown>),
          audit_review: modelResult('audit_review', 'not_established'),
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-audit-prereq',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-audit-prereq',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-audit-prereq',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining(['audit_review_not_passed:not_established'])
      );
      expect(record.lastEventType).toBe('delivery_confirmation_result_recorded');
      expect(record.sixModelResults.delivery_confirmation.status).toBe('blocked');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('fails closed when compiled model packet MUSTs lack per-MUST closure evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-per-must-blocked-'));
    try {
      const modelPacketPath = writeModelPacket(path.join(root, 'trace-execution', 'model_packet.json'));
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify-delivery.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-per-must-blocked',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-per-must-blocked',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [],
      });
      const reportPath = path.join(root, 'closeout', 'delivery-closeout-report.json');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--model-packet',
        modelPacketPath,
        '--attempt-id',
        'closeout-per-must-blocked',
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.blockingReasons).toEqual(
        expect.arrayContaining([
          'per_must_closure_evidence_index_not_passed',
          'closure_missing:MUST-001',
        ])
      );
      expect(report.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'per-must-closure-evidence-index',
            passed: false,
          }),
        ])
      );
      const indexPath = path.join(root, 'closeout', 'per-must-closure-evidence-index.json');
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      expect(index.rows[0]).toMatchObject({
        mustId: 'MUST-001',
        status: 'blocked',
        closureStatus: 'missing',
      });
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('fails closed when compiled execution strategy exists but no model packet can be resolved', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-per-must-missing-packet-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        executionStrategySelections: [
          {
            eventType: 'execution_strategy_selected',
            strategyId: 'compiled_trace_direct',
            availability: 'available',
            selectedBy: 'policy',
            strategyOptionsHash: HASH,
            selectedOptionHash: HASH,
            modelPacketHash: HASH,
            sourceDocumentHash: HASH,
            implementationConfirmationHash: HASH,
            sourceRefs: [{ sourceType: 'model_packet', id: HASH }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify-delivery.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-missing-model-packet',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-missing-model-packet',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          {
            requirementId: 'MUST-001',
            status: 'pass',
          },
        ],
      });

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-missing-model-packet',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'per_must_closure_evidence_index_not_passed',
          'model_packet_not_available',
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('passes compiled model packet closeout only after every MUST has command, artifact, test result, and pass closure', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-per-must-pass-'));
    try {
      const modelPacketPath = writeModelPacket(path.join(root, 'trace-execution', 'model_packet.json'));
      const reportPath = path.join(root, 'closeout', 'delivery-closeout-report.json');
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify-delivery.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-per-must-pass',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                command: 'node verify-delivery.js',
                runId: 'run-delivery',
                closeoutAttemptId: 'closeout-per-must-pass',
                exitCode: 0,
                startedAt: '2026-05-19T00:00:00.000Z',
                completedAt: '2026-05-19T00:00:01.000Z',
                outputSummary: 'delivery command passed',
              },
            ],
            evidenceArtifactRefs: [evidenceArtifactRef()],
          },
        ],
        requirementClosures: [
          {
            requirementId: 'MUST-001',
            status: 'pass',
            recordedAt: '2026-05-19T00:00:01.000Z',
          },
        ],
      });

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--model-packet',
        modelPacketPath,
        '--attempt-id',
        'closeout-per-must-pass',
        '--report-path',
        reportPath,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);

      expect(code).toBe(0);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'per-must-closure-evidence-index',
            passed: true,
            counts: { total: 1, pass: 1, blocked: 0 },
          }),
        ])
      );
      const index = JSON.parse(
        readFileSync(path.join(root, 'closeout', 'per-must-closure-evidence-index.json'), 'utf8')
      );
      expect(index.decision).toBe('pass');
      expect(index.rows[0].closureStatus).toBe('pass');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('does not require production subsystem or SFT artifacts when source applicability excludes them', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-scoped-applicability-'));
    try {
      const sourcePath = path.join(root, 'source.md');
      writeText(
        sourcePath,
        [
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  applicability:',
          '    runtimeRecovery:',
          '      requiresFunctionalResumeFailureCaseRegistry: true',
          '    productionSubsystems:',
          '      applies: false',
          '    scoringDashboardSft:',
          '      applies: false',
          '',
        ].join('\n')
      );
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
        sourcePath,
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-scoped',
              artifactRefs: [
                evidenceArtifactRef(
                  '_bmad-output\\runtime\\requirement-records\\REQ-CLOSEOUT\\execution\\evidence.json'
                ),
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-scoped',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.extensionRefs = [];
      record.artifactIndex = record.artifactIndex.filter(
        (artifact: Record<string, unknown>) =>
          ![
            'observability_extension',
            'production_subsystem_acceptance_report',
            'production_loop_ready_report',
            'dataset_release_manifest',
            'dataset_manifest',
            'dataset_release_gate_report',
          ].includes(String(artifact.artifactType))
      );
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        'closeout-scoped',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.decision).toBe('pass');
      expect(nextRecord.lastEventType).toBe('delivery_confirmation_user_acceptance_requested');
      expect(nextRecord.status).toBe('awaiting_user_acceptance');
      expect(nextRecord.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'production-subsystem-extension-current', required: false }),
          expect.objectContaining({ id: 'production-loop-ready-report-current', required: false }),
          expect.objectContaining({ id: 'dataset-release-artifacts-current', required: false }),
          expect.objectContaining({ id: 'failure-case-coverage-complete', required: true }),
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout by default for confirmed AI-TDD source with missing acceptance evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-ai-tdd-'));
    try {
      const missingTestPath = path.join(root, 'tests', 'acceptance', 'missing-ai-tdd.test.ts');
      const sourcePath = writeAiTddSource(root, missingTestPath);
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        sourcePath,
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-ai-tdd',
              artifactRefs: [
                evidenceArtifactRef(
                  '_bmad-output\\runtime\\requirement-records\\REQ-CLOSEOUT\\execution\\evidence.json'
                ),
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-ai-tdd',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        'closeout-ai-tdd',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'ai_tdd_contract_gate_not_passed'
      );
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'acceptance_test_file_missing'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks strict closeout contract when the current attempt lacks strict proof command evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-strict-missing-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
        sourcePath: path.join(root, 'failure-case-required-source.md'),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-strict-missing',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            traceRows: ['TRACE-040'],
            evidenceRefs: ['EVD-052'],
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-strict-missing',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: 'MUST-054', status: 'pass', evidenceRefs: ['EVD-052'] },
          { requirementId: 'NEG-042', status: 'pass', evidenceRefs: ['EVD-054'] },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-strict-missing',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'strict-closeout-proof-gate-current-attempt',
            passed: false,
          }),
        ])
      );
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'strict_closeout_proof_current_attempt_command_missing',
          'strict_closeout_proof_gate_not_passed',
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('uses latest requirement closure state instead of blocking on historical open events', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-latest-closure-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-latest-closure',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-latest-closure',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: 'MUST-001', status: 'open' },
          { requirementId: 'MUST-001', status: 'pass' },
          { requirementId: 'TRACE-001', status: 'open' },
          { requirementId: 'TRACE-001', status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-latest-closure',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'requirement-closures-terminal',
            passed: true,
            openCount: 0,
          }),
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('requires explicit current-attempt required command selection', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-attempt-selection-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-other-attempt',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-attempt-selection',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-attempt-selection',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'deliveryEvidence.requiredCommands_current_attempt_missing'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('accepts required command selection through lastRunRef closeoutAttemptId', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-last-run-ref-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              lastRunRef: {
                commandId: 'CMD-DELIVERY',
                runId: 'run-001',
                closeoutAttemptId: 'closeout-last-run-ref',
              },
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-last-run-ref',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-last-run-ref',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when architecture state check is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-arch-state-missing-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        architectureConfirmationStateChecks: [],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-arch-missing',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-arch-missing',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'architecture_confirmation_state_check_not_current'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when implementation readiness has not passed even if delivery evidence is green', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-no-readiness-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        gateChecks: [
          {
            eventType: 'gate_check_recorded',
            gate: 'Quality Gate',
            decision: 'pass',
          },
          {
            eventType: 'gate_check_recorded',
            gate: 'Release Gate',
            decision: 'pass',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-no-readiness',
              artifactRefs: [
                evidenceArtifactRef(),
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-no-readiness',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-no-readiness',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'implementation_readiness_gate_not_passed'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when failure-case coverage artifact is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-failure-case-missing-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        artifactIndex: [],
        aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
        sourcePath: path.join(root, 'failure-case-required-source.md'),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-failure-case-missing',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-failure-case-missing',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      writeText(
        path.join(root, 'failure-case-required-source.md'),
        [
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  applicability:',
          '    runtimeRecovery:',
          '      requiresFunctionalResumeFailureCaseRegistry: true',
          '',
        ].join('\n')
      );
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.artifactIndex = record.artifactIndex.filter(
        (artifact: Record<string, unknown>) => artifact.artifactType !== 'failure_case_coverage'
      );
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        path.join(root, 'failure-case-required-source.md'),
        '--attempt-id',
        'closeout-failure-case-missing',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toContain(
        'failure_case_coverage_artifact_missing'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when failure-case coverage has unexercised cases', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-failure-case-incomplete-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
        sourcePath: path.join(root, 'dataset-required-source.md'),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-failure-case-incomplete',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-failure-case-incomplete',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const coverage = record.artifactIndex.find(
        (artifact: Record<string, unknown>) => artifact.artifactType === 'failure_case_coverage'
      );
      writeFileSync(
        coverage.path,
        `${JSON.stringify(
          {
            reportType: 'failure_case_coverage',
            resumeFailureCaseRegistryCoverage: {
              failureCases: 2,
              failureCaseExercisedCount: 1,
              unexercisedCases: ['sourceDocumentHash_changed'],
              issues: [],
            },
            blockingIssues: [],
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      coverage.hash = sha256File(coverage.path);
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-failure-case-incomplete',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'failure_case_coverage_incomplete:1/2',
          'failure_case_unexercised:sourceDocumentHash_changed',
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when subsystem count is 16 but registry acceptance criteria are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-subsystem-count-only-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
        sourcePath: path.join(root, 'dataset-required-source.md'),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-subsystem-count-only',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-subsystem-count-only',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionRef = record.extensionRefs.at(-1);
      const extension = JSON.parse(readFileSync(extensionRef.path, 'utf8'));
      extension.productionSubsystemAcceptanceRegistry.subsystemAcceptance = [];
      extension.productionSubsystemAcceptanceRegistryHash = sha256Text(JSON.stringify(extension.productionSubsystemAcceptanceRegistry));
      writeJson(extensionRef.path, extension);
      extensionRef.contentHash = sha256File(extensionRef.path);
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-subsystem-count-only',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'production_subsystem_acceptance_registry_missing',
          'subsystem_acceptance_missing:requirement_confirmation',
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when production subsystem extension hash is stale', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-stale-extension-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-stale-extension',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-stale-extension',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionRef = record.extensionRefs.at(-1);
      const extension = JSON.parse(readFileSync(extensionRef.path, 'utf8'));
      extension.sourceDocumentHash = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
      writeJson(extensionRef.path, extension);

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-stale-extension',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toContain(
        'production_subsystem_extension_hash_mismatch'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when dataset release manifest hash is stale', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-stale-dataset-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-stale-dataset',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-stale-dataset',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      writeText(
        path.join(root, 'dataset-required-source.md'),
        [
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  applicability:',
          '    scoringDashboardSft:',
          '      applies: true',
          '',
        ].join('\n')
      );
      const manifestPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'datasets',
        'req-closeout-governed-sft',
        'v1',
        'dataset-manifest.json'
      );
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.source.sourceDocumentHash = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
      writeJson(manifestPath, manifest);

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        path.join(root, 'dataset-required-source.md'),
        '--attempt-id',
        'closeout-stale-dataset',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining(['dataset_manifest_source_document_hash_mismatch', 'dataset_release_manifest_hash_mismatch'])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when global functional parity regresses', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-functional-parity-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-functional-parity',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-functional-parity',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionRef = record.extensionRefs.at(-1);
      const extension = JSON.parse(readFileSync(extensionRef.path, 'utf8'));
      extension.functionalParity.userVisibleBehaviorPreserved = false;
      writeJson(extensionRef.path, extension);
      extensionRef.contentHash = sha256File(extensionRef.path);
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-functional-parity',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toContain(
        'production_subsystem_functional_parity_not_preserved'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when a per-subsystem functional parity regression is present', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-subsystem-parity-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-subsystem-parity',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-subsystem-parity',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionRef = record.extensionRefs.at(-1);
      const extension = JSON.parse(readFileSync(extensionRef.path, 'utf8'));
      extension.subsystemReadiness[0].functionalParity.userVisibleBehaviorPreserved = false;
      writeJson(extensionRef.path, extension);
      extensionRef.contentHash = sha256File(extensionRef.path);
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-subsystem-parity',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toContain(
        'subsystem_functional_parity_not_preserved:requirement_confirmation'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('rejects attempts that would overwrite an existing closeout attempt', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-duplicate-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        closeout: {
          currentAttemptId: 'closeout-001',
          attempts: [{ closeoutAttemptId: 'closeout-001', decision: 'blocked' }],
        },
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
      ]);
      expect(code).toBe(2);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].decision).toBe('blocked');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('allows explicit re-evaluation of an existing attempt when requested', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-reeval-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        closeout: {
          currentAttemptId: 'closeout-001',
          attempts: [{ closeoutAttemptId: 'closeout-001', decision: 'blocked' }],
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-001',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-001',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
        '--allow-existing-attempt',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe('closeout-001');
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts).toHaveLength(1);
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when the current delivery truth gate report does not allow completion', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-truth-gate-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-truth-gate-blocked',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-truth-gate-blocked',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      writeDeliveryTruthReport(root, {
        completionAllowed: false,
        deliveryStatus: 'partial',
        completionLanguage: 'partial_only',
        failedEvidence: ['release-gate: completion_intent=expired'],
      });

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-truth-gate-blocked',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'delivery-truth-gate-current',
            passed: false,
            completionAllowed: false,
            deliveryStatus: 'partial',
            failedEvidenceCount: 1,
          }),
        ])
      );
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'delivery_truth_gate_not_passed',
          'delivery_truth_gate_completion_not_allowed',
          'delivery_truth_gate_status_not_complete:partial',
          'delivery_truth_gate_failed_evidence:release-gate: completion_intent=expired',
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when evidence artifacts are projections or missing pass-grade metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-artifact-metadata-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        artifactIndex: [
          {
            ...evidenceArtifactRef(),
            sourceOfTruthRole: 'projection',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-bad-artifact',
              artifactRefs: [
                {
                  path: '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/execution/evidence.json',
                  hash: HASH,
                },
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-bad-artifact',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-bad-artifact',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('required_command_artifact_incomplete'),
          expect.stringContaining('required_command_not_satisfied:CMD-DELIVERY'),
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when an RCA action is still open', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-open-rca-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rcaRecords: [
          {
            eventType: 'rca_created',
            rcaId: 'rca-open-001',
            type: 'closeout_blocker',
            status: 'open',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-open-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-open-rca',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-open-rca',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-open-rca',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toContain('open_rca_action_exists');
      expect(record.failureRecords.at(-1)).toMatchObject({
        type: 'delivery_closeout_blocked',
        status: 'open',
      });
      expect(record.rcaRecords).toHaveLength(1);
      expect(record.rcaRecords[0].rcaId).toBe('rca-open-001');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('uses latest failure and RCA status instead of blocking on resolved historical entries', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-latest-failure-rca-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure-closeout-001',
            type: 'delivery_closeout_blocked',
            status: 'open',
            sourceRefs: [{ sourceType: 'closeout_attempt', id: 'closeout-old' }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
          {
            eventType: 'failure_recorded',
            failureId: 'failure-closeout-001',
            type: 'delivery_closeout_blocked',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'closeout_attempt', id: 'closeout-old' }],
            recordedAt: '2026-05-19T00:01:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        rcaRecords: [
          {
            eventType: 'rca_created',
            rcaId: 'rca-closeout-001',
            type: 'closeout_blocker',
            status: 'open',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-closeout-001' }],
          },
          {
            eventType: 'rca_created',
            rcaId: 'rca-closeout-001',
            type: 'closeout_blocker',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-closeout-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-latest-failure-rca',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-latest-failure-rca',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-latest-failure-rca',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('ignores open closeout-blocker RCA records from superseded attempts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-superseded-rca-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rcaRecords: [
          {
            eventType: 'rca_created',
            rcaId: 'rca:closeout-old',
            type: 'closeout_blocker',
            status: 'open',
            sourceRefs: [
              { sourceType: 'failure_record', id: 'failure:closeout-old' },
              { sourceType: 'closeout_attempt', id: 'closeout-old' },
            ],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-current',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-current',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-current',
        '--evaluated-at',
        '2026-05-19T00:01:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('pass');
      expect(record.lastEventType).toBe('delivery_confirmation_user_acceptance_requested');
      expect(record.status).toBe('awaiting_user_acceptance');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('does not self-lock a repaired current closeout attempt on its previous blocked failure', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-current-attempt-repaired-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure:closeout-current-repaired',
            type: 'delivery_closeout_blocked',
            status: 'open',
            closeoutAttemptId: 'closeout-current-repaired',
            blockingReasons: ['strict_closeout_proof_gate_not_passed'],
            sourceRefs: [
              { sourceType: 'closeout_attempt', id: 'closeout-current-repaired' },
              { sourceType: 'gate_check', id: 'delivery-closeout:closeout-current-repaired' },
            ],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-current-repaired',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-current-repaired',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-current-repaired',
        '--evaluated-at',
        '2026-05-19T00:01:00.000Z',
      ]);
      expect(code).toBe(0);
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('still blocks when the current attempt has a non-closeout open failure', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-current-attempt-other-failure-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure-other-current',
            type: 'release_gate_failed',
            status: 'open',
            closeoutAttemptId: 'closeout-current-other-failure',
            blockingReasons: ['release_gate_failed'],
            sourceRefs: [{ sourceType: 'gate_check', id: 'release-gate' }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-current-other-failure',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-current-other-failure',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-current-other-failure',
        '--evaluated-at',
        '2026-05-19T00:01:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain('open_failure_record_exists');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when rerun loops remain open and keeps source refs as authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-pending-rerun-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rerunLoops: [
          {
            rerunLoopId: 'rerun-001',
            status: 'in_progress',
            sourceRefs: [{ sourceType: 'gate_check', id: 'gate-failed-001' }],
            blockerRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-pending-rerun',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-pending-rerun',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-pending-rerun',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain('pending_rerun_exists');
      expect(record.rerunLoops[0]).not.toHaveProperty('decision');
      expect(record.rerunLoops[0]).not.toHaveProperty('result');
      expect(record.failureRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'rerun_loop', id: 'rerun-001' },
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('allows closeout when the latest event for the same rerun loop is resolved', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-resolved-rerun-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rerunLoops: [
          {
            rerunLoopId: 'rerun-001',
            status: 'in_progress',
            sourceRefs: [{ sourceType: 'gate_check', id: 'gate-failed-001' }],
            blockerRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
          {
            rerunLoopId: 'rerun-001',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
            blockerRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-resolved-rerun',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-resolved-rerun',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-resolved-rerun',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts[0].blockingReasons).not.toContain('pending_rerun_exists');
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when rerun loops use trigger-only or non-authoritative source refs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-invalid-rerun-source-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rerunLoops: [
          {
            rerunLoopId: 'rerun-invalid-001',
            status: 'resolved',
            trigger: 'score_evaluation_failed',
            sourceRefs: [{ sourceType: 'artifact_ref', id: 'score.json' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-invalid-rerun-source',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-invalid-rerun-source',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-invalid-rerun-source',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'rerun_loop_source_ref_type_invalid:rerun-invalid-001:artifact_ref'
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('blocks closeout when trusted hooks have unreconciled receipt gaps without no-hook fallback', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-hook-reconciliation-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        hookReconciliation: {
          schemaVersion: 'hook-reconciliation/v1',
          hostKind: 'codex',
          hostMode: 'hooks_enabled',
          hookTrust: 'degraded',
          fallbackMode: 'none',
          closeoutReconciled: false,
          sequenceLedger: {
            status: 'gap',
            expectedNextSequence: 3,
            observedSequences: [1, 3],
          },
          missingReceipts: [
            {
              receiptType: 'PostToolUse',
              severity: 'high',
              expectedEventId: 'tool-write-001',
            },
          ],
          hashMismatches: [
            {
              field: 'runtimePolicySnapshotHash',
              expected: HASH,
              actual: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
            },
          ],
          noHookFallbackRefs: [],
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-hook-gap',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-hook-gap',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-hook-gap',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'hook_trust_not_trusted:degraded',
          'hook_fallback_mode_missing_for_untrusted:no_hooks_or_bounded_replay_required',
          'hook_sequence_ledger_gap',
          'hook_missing_receipt:PostToolUse:tool-write-001',
          'hook_hash_mismatch:runtimePolicySnapshotHash',
          'hook_closeout_not_reconciled',
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('allows closeout when degraded hooks are reconciled by no-hook fallback evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-hook-fallback-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        hookReconciliation: {
          schemaVersion: 'hook-reconciliation/v1',
          hostKind: 'codex',
          hostMode: 'hooks_enabled',
          hookTrust: 'degraded',
          fallbackMode: 'bounded_replay',
          closeoutReconciled: true,
          sequenceLedger: {
            status: 'reconciled',
            expectedNextSequence: 4,
            observedSequences: [1, 2, 3],
          },
          missingReceipts: [],
          hashMismatches: [],
          noHookFallbackRefs: [{ sourceType: 'execution_iteration', id: 'exec-fallback-001' }],
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-hook-fallback',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-hook-fallback',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-hook-fallback',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'hook-reconciliation-valid', passed: true }),
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });
});
