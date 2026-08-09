import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateControlledGoalCloseoutGate,
  mainDeliveryCloseoutGate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';
import {
  implementationConfirmationHash,
  readImplementationConfirmation,
  sourceDocumentHashForImplementationConfirmation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/target-artifact-realization-gate';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
  type RequirementsContractSixModelId,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import { writePassingSourcePrdLintReport } from '../helpers/source-prd-lint-fixture';

function numberedFixtureId(prefix: string, ordinal: number): string {
  return `${prefix}-${String(ordinal).padStart(3, '0')}`;
}

function namedFixtureId(prefix: string, name: string): string {
  return `${prefix}-${name.toUpperCase().replace(/[^A-Z0-9]+/gu, '-')}`;
}

function closeoutAttemptId(scenario: string): string {
  return `closeout-${scenario}`;
}

const CLOSEOUT_FIXTURE_IDS = Object.freeze({
  recordId: namedFixtureId('REQ', 'closeout'),
  requirementId: numberedFixtureId('MUST', 1),
  negativeRequirementId: numberedFixtureId('NEG', 1),
  outOfScopeId: numberedFixtureId('OUT', 1),
  traceId: numberedFixtureId('TRACE', 1),
  evidenceId: numberedFixtureId('EVD', 1),
  deliveryCommandId: namedFixtureId('CMD', 'delivery'),
  aiTddCommandId: namedFixtureId('CMD', 'ai-tdd'),
  acceptanceId: namedFixtureId('ACC', 'ai-tdd'),
  artifactId: namedFixtureId('ART', 'ai-tdd'),
  passAttemptId: closeoutAttemptId('pass'),
  defaultAttemptId: closeoutAttemptId('001'),
  aiTddAttemptId: closeoutAttemptId('ai-tdd'),
  archMissingAttemptId: closeoutAttemptId('arch-missing'),
  attemptSelectionAttemptId: closeoutAttemptId('attempt-selection'),
  auditPrereqAttemptId: closeoutAttemptId('audit-prereq'),
  badArtifactAttemptId: closeoutAttemptId('bad-artifact'),
  currentCloseoutAttemptId: closeoutAttemptId('current'),
  currentOtherFailureAttemptId: closeoutAttemptId('current-other-failure'),
  currentRepairedAttemptId: closeoutAttemptId('current-repaired'),
  failureCaseIncompleteAttemptId: closeoutAttemptId('failure-case-incomplete'),
  failureCaseMissingAttemptId: closeoutAttemptId('failure-case-missing'),
  functionalParityAttemptId: closeoutAttemptId('functional-parity'),
  hookFallbackAttemptId: closeoutAttemptId('hook-fallback'),
  hookGapAttemptId: closeoutAttemptId('hook-gap'),
  invalidRerunSourceAttemptId: closeoutAttemptId('invalid-rerun-source'),
  lastRunRefAttemptId: closeoutAttemptId('last-run-ref'),
  latestClosureAttemptId: closeoutAttemptId('latest-closure'),
  latestFailureRcaAttemptId: closeoutAttemptId('latest-failure-rca'),
  missingModelPacketAttemptId: closeoutAttemptId('missing-model-packet'),
  noReadinessAttemptId: closeoutAttemptId('no-readiness'),
  oldAttemptId: closeoutAttemptId('old'),
  openRcaAttemptId: closeoutAttemptId('open-rca'),
  otherAttemptId: closeoutAttemptId('other-attempt'),
  pendingRerunAttemptId: closeoutAttemptId('pending-rerun'),
  perMustBlockedAttemptId: closeoutAttemptId('per-must-blocked'),
  perMustPassAttemptId: closeoutAttemptId('per-must-pass'),
  resolvedRerunAttemptId: closeoutAttemptId('resolved-rerun'),
  scopedAttemptId: closeoutAttemptId('scoped'),
  staleDatasetAttemptId: closeoutAttemptId('stale-dataset'),
  staleExtensionAttemptId: closeoutAttemptId('stale-extension'),
  strictMissingAttemptId: closeoutAttemptId('strict-missing'),
  subsystemCountOnlyAttemptId: closeoutAttemptId('subsystem-count-only'),
  subsystemParityAttemptId: closeoutAttemptId('subsystem-parity'),
  truthGateBlockedAttemptId: closeoutAttemptId('truth-gate-blocked'),
});
const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const CURRENT_IMPLEMENTATION_ATTEMPT_ID = namedFixtureId(
  'IMP',
  CLOSEOUT_FIXTURE_IDS.currentCloseoutAttemptId
);
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
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function writeModelPacket(filePath: string, input: Record<string, unknown> = {}): string {
  writeJson(filePath, {
    schemaVersion: 'model-packet-fixture/v1',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    semanticModelHash: HASH,
    requirements: {
      must: [
        {
          id: CLOSEOUT_FIXTURE_IDS.requirementId,
          text: `${CLOSEOUT_FIXTURE_IDS.requirementId} requires current attempt command, artifact, test result, and closure.`,
          riskLevel: 'critical',
          evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
          coveredByTraceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
        },
      ],
    },
    traceSlices: [
      {
        traceId: CLOSEOUT_FIXTURE_IDS.traceId,
        requirementRefs: [CLOSEOUT_FIXTURE_IDS.requirementId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        commandRefs: [CLOSEOUT_FIXTURE_IDS.deliveryCommandId],
      },
    ],
    requiredCommands: [
      {
        id: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
        command: 'node verify-delivery.js',
        traceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
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
        summary:
          'critical_failures=0, blocked_sprint_status_update=false, completion_intent=present',
      },
    ],
    ...overrides,
  });
  return reportPath;
}

function cleanupTempRoot(root: string): void {
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

function recordText(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? (record[key] as string) : '';
}

function currentArchitectureHash(record: Record<string, unknown>): string {
  const state = record.architectureConfirmationState as Record<string, unknown> | undefined;
  return typeof state?.currentArchitectureConfirmationHash === 'string'
    ? state.currentArchitectureConfirmationHash
    : HASH;
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
    recordId: CLOSEOUT_FIXTURE_IDS.recordId,
    requirementSetId: CLOSEOUT_FIXTURE_IDS.recordId,
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
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-production-loop-ready-check.ts',
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-dataset-release-gate.ts',
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
  const extensionPath = path.join(
    base,
    'extensions',
    'production-loop-16-subsystems-extension.json'
  );
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
    canaryPlan: [
      {
        stage: 'internal',
        rolloutPercent: 10,
        rollbackOn: 'production_loop_ready_blocked',
      },
    ],
    sloTargets: [{ name: 'delivery_closeout_gate_latency', target: '<= 5000ms' }],
    errorRateMetrics: [{ name: 'gate_failure_rate', threshold: '<= 1%' }],
    performanceMetrics: [{ name: 'production_loop_ready_eval_duration_ms', threshold: '<= 5000' }],
    businessMetrics: [{ name: 'requirement_reopen_rate', threshold: '<= 5%' }],
    alerts: [{ name: 'production_loop_blocked', owner: 'main-agent' }],
    rollbackConditions: [
      {
        condition: 'hash_mismatch_or_missing_subsystem_readiness',
        action: 'block_closeout_and_open_rca',
      },
    ],
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
    productionSubsystemAcceptanceRegistryHash: sha256Text(
      JSON.stringify(productionSubsystemAcceptanceRegistry)
    ),
    functionalParity: {
      userVisibleBehaviorPreserved: true,
      replacementScripts: [
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-production-loop-ready-check.ts',
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-dataset-release-gate.ts',
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
      {
        id: 'sixteen-subsystems-machine-readable',
        passed: true,
        expectedCount: 16,
        actualCount: 16,
      },
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
    relatedRequirementIds: [
      'MUST-017',
      'MUST-039',
      'MUST-040',
      'MUST-043',
      'EVD-039',
      'EVD-040',
      'EVD-043',
    ],
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
      {
        id: 'sixteen-subsystems-machine-readable',
        passed: true,
        expectedCount: 16,
        actualCount: 16,
      },
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
      relatedRequirementIds: [
        'MUST-039',
        'MUST-040',
        'MUST-043',
        'NEG-028',
        'NEG-030',
        'NEG-031',
        'EVD-039',
        'EVD-040',
      ],
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
  const hasExplicitSourcePath = typeof record.sourcePath === 'string' && record.sourcePath;
  const sourcePath = hasExplicitSourcePath
    ? path.resolve(root, record.sourcePath as string)
    : path.join(root, 'docs', 'requirements', 'delivery-closeout-fixture.md');
  if (
    !readMaybeExists(sourcePath)
  ) {
    writeText(
      sourcePath,
      [
        'implementationConfirmation:',
        '  status: user_confirmed',
        '  must: []',
        '  notDone: []',
        '  mustNot: []',
        '  evidence: []',
        '  traceRows: []',
        '  requiredCommands: []',
        '  artifactAutomationPlan: []',
        '  targetModificationPaths: []',
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
  }
  const confirmedSource = readImplementationConfirmation(sourcePath);
  const sourceDocumentHash =
    sourceDocumentHashForImplementationConfirmation(confirmedSource);
  const implementationHash = implementationConfirmationHash(confirmedSource.confirmation);
  const semanticModelHash = sha256Text(
    stableStringify({
      sourceDocumentHash,
      implementationConfirmationHash: implementationHash,
    })
  );
  const sourceAmendmentHashes = [
    sha256Text(
      stableStringify({
        sourceDocumentHash,
        amendmentRole: 'confirmed-source-baseline',
      })
    ),
  ];
  const bindAuthorityHashes = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(bindAuthorityHashes);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (key === 'sourceDocumentHash') return [key, sourceDocumentHash];
        if (key === 'implementationConfirmationHash') return [key, implementationHash];
        if (key === 'semanticModelHash') return [key, semanticModelHash];
        return [key, bindAuthorityHashes(entry)];
      })
    );
  };
  const boundRecord = bindAuthorityHashes(record) as Record<string, unknown>;
  const recordWithSource = withVerifiedCloseoutPrerequisites({
    ...boundRecord,
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash: implementationHash,
    semanticModelHash,
    sourceAmendmentHashes,
    aiTddContractGate: hasExplicitSourcePath
      ? boundRecord.aiTddContractGate
      : (boundRecord.aiTddContractGate ?? { enforcementMode: 'skipped_by_policy' }),
    confirmationHistory: [
      ...((Array.isArray(boundRecord.confirmationHistory)
        ? boundRecord.confirmationHistory
        : []) as Record<string, unknown>[]),
      {
        eventType: 'confirmation_recorded',
        recordId: recordText(boundRecord, 'recordId'),
        requirementSetId:
          recordText(boundRecord, 'requirementSetId') || recordText(boundRecord, 'recordId'),
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'main-agent-delivery-closeout-gate-record.test',
        sourcePath,
        sourceDocumentHash,
        implementationConfirmationHash: implementationHash,
        confirmationPageHash: sha256Text(`${sourceDocumentHash}:confirmation-page`),
        confirmationText: 'confirmed source authority fixture',
        renderReportPath: normalizeSlashes(
          path.join(path.dirname(sourcePath), 'confirmation-render-report.json')
        ),
        htmlPath: normalizeSlashes(path.join(path.dirname(sourcePath), 'confirmation.html')),
      },
    ],
  });
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
  const production = writeProductionArtifacts(root, base, recordWithSource);
  const recordWithCoverage = {
    ...recordWithSource,
    extensionRefs: [
      ...(((recordWithSource.extensionRefs as unknown[]) ?? []) as Record<string, unknown>[]),
      production.extensionRef,
    ],
    artifactIndex: [
      ...(((recordWithSource.artifactIndex as unknown[]) ?? []) as Record<string, unknown>[]),
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
  writePassingSourcePrdLintReport({
    requirementRecordPath: recordPath,
    sourcePath,
  });
  return recordPath;
}

function readMaybeExists(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function evidenceArtifactRef(
  pathValue = `_bmad-output/runtime/requirement-records/${CLOSEOUT_FIXTURE_IDS.recordId}/execution/evidence.json`
) {
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
      `    - id: ${CLOSEOUT_FIXTURE_IDS.requirementId}`,
      '      text: Must pass closeout acceptance.',
      `      evidenceRefs: [${CLOSEOUT_FIXTURE_IDS.evidenceId}]`,
      `      coveredByTraceRows: [${CLOSEOUT_FIXTURE_IDS.traceId}]`,
      '  notDone:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.negativeRequirementId}`,
      '      text: Missing AI-TDD acceptance cannot close.',
      `      evidenceRefs: [${CLOSEOUT_FIXTURE_IDS.evidenceId}]`,
      '      oracle: negative control oracle',
      `      coveredByTraceRows: [${CLOSEOUT_FIXTURE_IDS.traceId}]`,
      '  mustNot:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.outOfScopeId}`,
      '      text: Do not self-certify closeout.',
      '  evidence:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.evidenceId}`,
      '      text: Current attempt acceptance evidence.',
      '      oracle: current-attempt command with artifact evidence',
      `      requiredCommandRefs: [${CLOSEOUT_FIXTURE_IDS.aiTddCommandId}]`,
      `      artifactRefs: [${CLOSEOUT_FIXTURE_IDS.artifactId}]`,
      '  traceRows:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.traceId}`,
      `      covers: [${CLOSEOUT_FIXTURE_IDS.requirementId}, ${CLOSEOUT_FIXTURE_IDS.negativeRequirementId}]`,
      `      evidenceRefs: [${CLOSEOUT_FIXTURE_IDS.evidenceId}]`,
      `      deliveryEvidenceCommandRefs: [${CLOSEOUT_FIXTURE_IDS.aiTddCommandId}]`,
      `      acceptanceRefs: [${CLOSEOUT_FIXTURE_IDS.acceptanceId}]`,
      '  requiredCommands:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.aiTddCommandId}`,
      `      command: npx vitest run ${testPath.replace(/\\/gu, '/')}`,
      '      oracle: current-attempt command with artifact evidence',
      '  acceptanceTests:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.acceptanceId}`,
      `      file: ${testPath.replace(/\\/gu, '/')}`,
      `      covers: [${CLOSEOUT_FIXTURE_IDS.requirementId}, ${CLOSEOUT_FIXTURE_IDS.negativeRequirementId}]`,
      `      traceRows: [${CLOSEOUT_FIXTURE_IDS.traceId}]`,
      `      evidenceRefs: [${CLOSEOUT_FIXTURE_IDS.evidenceId}]`,
      `      commandRefs: [${CLOSEOUT_FIXTURE_IDS.aiTddCommandId}]`,
      '      expectedPreImplementationState: expected_red',
      '      oracle: current-attempt command with artifact evidence',
      '  artifactAutomationPlan:',
      `    - id: ${CLOSEOUT_FIXTURE_IDS.artifactId}`,
      '      artifactType: report',
      `      path: _bmad-output/runtime/requirement-records/${CLOSEOUT_FIXTURE_IDS.recordId}/evidence/ai-tdd.json`,
      '      producer: ai-tdd-fixture',
      '      sourceOfTruthRole: evidence',
      `      traceRows: [${CLOSEOUT_FIXTURE_IDS.traceId}]`,
      `      evidenceRefs: [${CLOSEOUT_FIXTURE_IDS.evidenceId}]`,
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
        commandRefs: [CLOSEOUT_FIXTURE_IDS.aiTddCommandId],
        covers: [CLOSEOUT_FIXTURE_IDS.requirementId, CLOSEOUT_FIXTURE_IDS.negativeRequirementId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        expectedPreImplementationState: 'expected_red',
        file: sourceText.match(/file: (.+)/u)?.[1] ?? '',
        id: CLOSEOUT_FIXTURE_IDS.acceptanceId,
        oracle: 'current-attempt command with artifact evidence',
        traceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
      },
    ],
    artifactAutomationPlan: [
      {
        artifactType: 'report',
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        id: CLOSEOUT_FIXTURE_IDS.artifactId,
        path: `_bmad-output/runtime/requirement-records/${CLOSEOUT_FIXTURE_IDS.recordId}/evidence/ai-tdd.json`,
        producer: 'ai-tdd-fixture',
        sourceOfTruthRole: 'evidence',
        traceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
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
        artifactRefs: [CLOSEOUT_FIXTURE_IDS.artifactId],
        id: CLOSEOUT_FIXTURE_IDS.evidenceId,
        oracle: 'current-attempt command with artifact evidence',
        requiredCommandRefs: [CLOSEOUT_FIXTURE_IDS.aiTddCommandId],
        text: 'Current attempt acceptance evidence.',
      },
    ],
    must: [
      {
        coveredByTraceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        id: CLOSEOUT_FIXTURE_IDS.requirementId,
        text: 'Must pass closeout acceptance.',
      },
    ],
    mustNot: [
      {
        id: CLOSEOUT_FIXTURE_IDS.outOfScopeId,
        text: 'Do not self-certify closeout.',
      },
    ],
    notDone: [
      {
        coveredByTraceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        id: CLOSEOUT_FIXTURE_IDS.negativeRequirementId,
        oracle: 'negative control oracle',
        text: 'Missing AI-TDD acceptance cannot close.',
      },
    ],
    requiredCommands: [
      {
        command: sourceText.match(/command: (.+)/u)?.[1] ?? '',
        id: CLOSEOUT_FIXTURE_IDS.aiTddCommandId,
        oracle: 'current-attempt command with artifact evidence',
      },
    ],
    traceRows: [
      {
        acceptanceRefs: [CLOSEOUT_FIXTURE_IDS.acceptanceId],
        covers: [CLOSEOUT_FIXTURE_IDS.requirementId, CLOSEOUT_FIXTURE_IDS.negativeRequirementId],
        deliveryEvidenceCommandRefs: [CLOSEOUT_FIXTURE_IDS.aiTddCommandId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        id: CLOSEOUT_FIXTURE_IDS.traceId,
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

function passingCloseoutEvidence(input: {
  attemptId: string;
  artifactRefs?: Record<string, unknown>[];
  sourceDocumentHash?: string;
  implementationConfirmationHash?: string;
}): Record<string, unknown> {
  const sourceDocumentHash = input.sourceDocumentHash ?? HASH;
  const implementationConfirmationHash = input.implementationConfirmationHash ?? HASH;
  return {
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
          blockingIfMissing: true,
          negativeOrRegression: true,
          closeoutAttemptId: input.attemptId,
          artifactRefs: input.artifactRefs ?? [evidenceArtifactRef()],
        },
      ],
    },
    executionIterations: [
      {
        executionIterationId: namedFixtureId('exec', input.attemptId),
        commandRunRefs: [
          {
            commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
            closeoutAttemptId: input.attemptId,
            exitCode: 0,
            sourceDocumentHash,
            implementationConfirmationHash,
            architectureConfirmationHash: HASH,
          },
        ],
      },
    ],
    requirementClosures: [
      {
        requirementId: CLOSEOUT_FIXTURE_IDS.requirementId,
        status: 'pass',
        traceRows: [CLOSEOUT_FIXTURE_IDS.traceId],
        evidenceRefs: [CLOSEOUT_FIXTURE_IDS.evidenceId],
        sourceDocumentHash,
        implementationConfirmationHash,
        architectureConfirmationHash: HASH,
        closeoutAttemptId: input.attemptId,
      },
    ],
  };
}

function baseRecord(): Record<string, unknown> {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  return withVerifiedCloseoutPrerequisites({
    recordId: CLOSEOUT_FIXTURE_IDS.recordId,
    requirementSetId: CLOSEOUT_FIXTURE_IDS.recordId,
    status: 'user_confirmed',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    semanticModelHash: HASH,
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
    artifactIndex: [evidenceArtifactRef()],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      },
    ],
  });
}

function withVerifiedCloseoutPrerequisites(
  input: Record<string, unknown>
): Record<string, unknown> {
  let record: Record<string, unknown> = {
    ...input,
    currentAttemptId: CURRENT_IMPLEMENTATION_ATTEMPT_ID,
  };
  for (const modelId of [
    'requirement_confirmation',
    'architecture_confirmation',
    'implementation_readiness',
    'execution_closure',
    'audit_review',
  ] as const satisfies readonly RequirementsContractSixModelId[]) {
    const existingModel = (
      (record.sixModelResults as Record<string, unknown> | undefined)?.[modelId] ?? {}
    ) as Record<string, unknown>;
    const recordedStatus = recordText(existingModel, 'status');
    const effectiveStatus =
      (
        [
          'pass',
          'blocked',
          'stale',
          'awaiting_user_acceptance',
          'not_established',
        ] as const
      ).find((status) => status === recordedStatus) ?? 'not_established';
    const passed = effectiveStatus === 'pass';
    const update = createRuntimeStatusProjectionUpdate({
      recordId: recordText(record, 'recordId'),
      requirementSetId: recordText(record, 'requirementSetId'),
      modelId,
      implementationAttemptId: CURRENT_IMPLEMENTATION_ATTEMPT_ID,
      sourceDocumentHash: recordText(record, 'sourceDocumentHash'),
      implementationConfirmationHash: recordText(record, 'implementationConfirmationHash'),
      semanticModelHash: recordText(record, 'semanticModelHash'),
      stageInputs: [
        {
          role: 'delivery_closeout_fixture_input',
          path: `fixtures/${modelId}-input.json`,
          hash: HASH,
        },
      ],
      deterministicGateOutputs: [
        {
          role: `${modelId}_gate_output`,
          path: `fixtures/${modelId}-gate.json`,
          hash: HASH,
        },
      ],
      blockerRefs: passed ? [] : [`${modelId}_${effectiveStatus}`],
      evidenceRefs: [`fixtures/${modelId}-gate.json`],
      authorityClass: 'deterministic_gate',
      decision: passed ? 'pass' : 'block',
      effectiveStatus,
      createdAt: '2026-05-19T00:00:00.000Z',
      receiptPath: `runtime/status-decisions/${CURRENT_IMPLEMENTATION_ATTEMPT_ID}/${modelId}.json`,
      projection: modelResultWithHashes(
        modelId,
        recordText(record, 'sourceDocumentHash'),
        recordText(record, 'implementationConfirmationHash'),
        effectiveStatus
      ),
    });
    record = {
      ...record,
      ...runtimeStatusProjectionRecordPatch({
        record,
        modelId,
        update,
      }),
    };
  }
  return record;
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
        CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe(CLOSEOUT_FIXTURE_IDS.defaultAttemptId);
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'deliveryEvidence.requiredCommands_missing'
      );
      expect(record.closeout.attempts[0].blockingReasons).toEqual([
        ...new Set(record.closeout.attempts[0].blockingReasons),
      ]);
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Delivery Closeout Gate',
        decision: 'blocked',
      });
      expect(record.failureRecords.at(-1)).toMatchObject({
        eventType: 'failure_recorded',
        type: 'delivery_closeout_blocked',
        status: 'open',
        closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
      });
      expect(record.failureRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'closeout_attempt', id: CLOSEOUT_FIXTURE_IDS.defaultAttemptId },
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
          { sourceType: 'closeout_attempt', id: CLOSEOUT_FIXTURE_IDS.defaultAttemptId },
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
        semanticModelHash: record.semanticModelHash,
        currentAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
        decisionReceiptRef: expect.any(String),
        decisionReceiptHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(record.sixModelResults.delivery_confirmation.blockingReasons).toEqual([
        ...new Set(record.sixModelResults.delivery_confirmation.blockingReasons),
      ]);
      expect(record.runtimeStatusDecisionReceipts.at(-1)).toMatchObject({
        path: record.sixModelResults.delivery_confirmation.decisionReceiptRef,
        receipt: {
          modelId: 'delivery_confirmation',
          implementationAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
          receiptHash: record.sixModelResults.delivery_confirmation.decisionReceiptHash,
        },
      });
      const decisionReceiptPath = path.resolve(
        path.dirname(recordPath),
        record.sixModelResults.delivery_confirmation.decisionReceiptRef
      );
      expect(existsSync(decisionReceiptPath)).toBe(true);
      expect(JSON.parse(readFileSync(decisionReceiptPath, 'utf8'))).toMatchObject({
        modelId: 'delivery_confirmation',
        implementationAttemptId: record.sixModelResults.delivery_confirmation.currentAttemptId,
        receiptHash: record.sixModelResults.delivery_confirmation.decisionReceiptHash,
      });
      expect(record.runtimeStatusDecisionReceipts.at(-1).receipt.blockerRefs).toEqual([
        ...new Set(record.runtimeStatusDecisionReceipts.at(-1).receipt.blockerRefs),
      ]);
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('passes only when current attempt required commands, artifacts, and closures are satisfied', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-success-'));
    try {
      const artifactPath = [
        '_bmad-output',
        'runtime',
        'requirement-records',
        CLOSEOUT_FIXTURE_IDS.recordId,
        'execution',
        'evidence.json',
      ].join('\\');
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        ...passingCloseoutEvidence({
          attemptId: CLOSEOUT_FIXTURE_IDS.passAttemptId,
          artifactRefs: [evidenceArtifactRef(artifactPath)],
        }),
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.passAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.status).toBe('awaiting_user_acceptance');
      expect(record.currentMentalModel).toBe('delivery_confirmation');
      expect(record.currentStage).toBe('delivery_confirmation');
      expect(record.sixModelResults.delivery_confirmation.status).toBe('awaiting_user_acceptance');
      expect(record.closeout.currentAttemptId).toBe(CLOSEOUT_FIXTURE_IDS.passAttemptId);
      expect(record.closeout).not.toHaveProperty('eventType');
      expect(record.closeout.decision).toBe('pass');
      expect(record.lastEventType).toBe('delivery_confirmation_user_acceptance_requested');
      expect(record.controlStore.eventLogPath).toContain('events/control-events.jsonl');
      expect(record.lastAppliedEventId).toContain(
        'delivery_confirmation_user_acceptance_requested'
      );
      expect(record.closeout.acceptanceRequest).toMatchObject({
        status: 'awaiting_user_acceptance',
        closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.passAttemptId,
      });
      expect(record.closeout.acceptanceRequest.closeoutConfirmInstruction).toContain(
        '确认最终验收并关闭需求'
      );
      expect(
        readMaybeExists(
          path.join(path.dirname(recordPath), record.closeout.acceptanceRequest.htmlPath)
        )
      ).toContain('确认最终验收并关闭需求');
      expect(
        readMaybeExists(
          path.join(path.dirname(recordPath), record.closeout.acceptanceRequest.renderReportPath)
        )
      ).toContain('closeoutDeliveryVerdict');
      expect(record.closeout.attempts[0]).toMatchObject({
        closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.passAttemptId,
        decision: 'pass',
      });
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('prefers canonical record source over stale synthetic closeout source when rendering acceptance request', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-source-'));
    try {
      const sourcePath = writeAiTddSource(
        root,
        path.join(root, 'tests', 'acceptance', 'ai-tdd.test.ts')
      );
      const sourceHashes = confirmationHashesForSource(sourcePath);
      const syntheticSourcePath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        CLOSEOUT_FIXTURE_IDS.recordId,
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
      const recordPath = writeRecord(
        root,
        withVerifiedCloseoutPrerequisites({
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
          ...passingCloseoutEvidence({
            attemptId: CLOSEOUT_FIXTURE_IDS.passAttemptId,
            sourceDocumentHash: sourceHashes.sourceDocumentHash,
            implementationConfirmationHash: sourceHashes.implementationConfirmationHash,
          }),
        })
      );
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        syntheticSourcePath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.passAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const acceptanceRequest = record.closeout.acceptanceRequest;
      const report = JSON.parse(
        readFileSync(
          path.join(path.dirname(recordPath), acceptanceRequest.renderReportPath),
          'utf8'
        )
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.auditPrereqAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.auditPrereqAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.auditPrereqAttemptId,
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
      const modelPacketPath = writeModelPacket(
        path.join(root, 'trace-execution', 'model_packet.json')
      );
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify-delivery.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.perMustBlockedAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.perMustBlockedAttemptId,
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
        CLOSEOUT_FIXTURE_IDS.perMustBlockedAttemptId,
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
          `closure_missing:${CLOSEOUT_FIXTURE_IDS.requirementId}`,
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
        mustId: CLOSEOUT_FIXTURE_IDS.requirementId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify-delivery.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.missingModelPacketAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.missingModelPacketAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          {
            requirementId: CLOSEOUT_FIXTURE_IDS.requirementId,
            status: 'pass',
          },
        ],
      });

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.missingModelPacketAttemptId,
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
      const modelPacketPath = writeModelPacket(
        path.join(root, 'trace-execution', 'model_packet.json')
      );
      const reportPath = path.join(root, 'closeout', 'delivery-closeout-report.json');
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify-delivery.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.perMustPassAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                command: 'node verify-delivery.js',
                runId: 'run-delivery',
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.perMustPassAttemptId,
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
            requirementId: CLOSEOUT_FIXTURE_IDS.requirementId,
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
        CLOSEOUT_FIXTURE_IDS.perMustPassAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.scopedAttemptId,
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
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.scopedAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
        CLOSEOUT_FIXTURE_IDS.scopedAttemptId,
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
          expect.objectContaining({
            id: 'production-subsystem-extension-current',
            required: false,
          }),
          expect.objectContaining({
            id: 'production-loop-ready-report-current',
            required: false,
          }),
          expect.objectContaining({
            id: 'dataset-release-artifacts-current',
            required: false,
          }),
          expect.objectContaining({
            id: 'failure-case-coverage-complete',
            required: true,
          }),
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.aiTddAttemptId,
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
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.aiTddAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.aiTddAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'ai_tdd_contract_gate_not_passed'
      );
      expect(record.closeout.attempts[0].blockingReasons).toContain('acceptance_test_file_missing');
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.strictMissingAttemptId,
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
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.strictMissingAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          {
            requirementId: 'MUST-054',
            status: 'pass',
            evidenceRefs: ['EVD-052'],
          },
          {
            requirementId: 'NEG-042',
            status: 'pass',
            evidenceRefs: ['EVD-054'],
          },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.strictMissingAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.latestClosureAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.latestClosureAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'open' },
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
          { requirementId: CLOSEOUT_FIXTURE_IDS.traceId, status: 'open' },
          { requirementId: CLOSEOUT_FIXTURE_IDS.traceId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.latestClosureAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.otherAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.attemptSelectionAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.attemptSelectionAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              lastRunRef: {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                runId: 'run-001',
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.lastRunRefAttemptId,
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
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.lastRunRefAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.lastRunRefAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
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
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.archMissingAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.archMissingAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.noReadinessAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.noReadinessAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.noReadinessAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.failureCaseMissingAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.failureCaseMissingAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
        CLOSEOUT_FIXTURE_IDS.failureCaseMissingAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.failureCaseIncompleteAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.failureCaseIncompleteAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
        CLOSEOUT_FIXTURE_IDS.failureCaseIncompleteAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.subsystemCountOnlyAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.subsystemCountOnlyAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionRef = record.extensionRefs.at(-1);
      const extension = JSON.parse(readFileSync(extensionRef.path, 'utf8'));
      extension.productionSubsystemAcceptanceRegistry.subsystemAcceptance = [];
      extension.productionSubsystemAcceptanceRegistryHash = sha256Text(
        JSON.stringify(extension.productionSubsystemAcceptanceRegistry)
      );
      writeJson(extensionRef.path, extension);
      extensionRef.contentHash = sha256File(extensionRef.path);
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.subsystemCountOnlyAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.staleExtensionAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.staleExtensionAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const extensionRef = record.extensionRefs.at(-1);
      const extension = JSON.parse(readFileSync(extensionRef.path, 'utf8'));
      extension.sourceDocumentHash =
        'sha256:2222222222222222222222222222222222222222222222222222222222222222';
      writeJson(extensionRef.path, extension);

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.staleExtensionAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.staleDatasetAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.staleDatasetAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
      manifest.source.sourceDocumentHash =
        'sha256:2222222222222222222222222222222222222222222222222222222222222222';
      writeJson(manifestPath, manifest);

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--source',
        path.join(root, 'dataset-required-source.md'),
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.staleDatasetAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'dataset_manifest_source_document_hash_mismatch',
          'dataset_release_manifest_hash_mismatch',
        ])
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.functionalParityAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.functionalParityAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
        CLOSEOUT_FIXTURE_IDS.functionalParityAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.subsystemParityAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.subsystemParityAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
        CLOSEOUT_FIXTURE_IDS.subsystemParityAttemptId,
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
          currentAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
          attempts: [
            { closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId, decision: 'blocked' },
          ],
        },
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
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
          currentAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
          attempts: [
            { closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId, decision: 'blocked' },
          ],
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.defaultAttemptId,
        '--allow-existing-attempt',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe(CLOSEOUT_FIXTURE_IDS.defaultAttemptId);
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.truthGateBlockedAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.truthGateBlockedAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
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
        CLOSEOUT_FIXTURE_IDS.truthGateBlockedAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.badArtifactAttemptId,
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
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.badArtifactAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.badArtifactAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('required_command_artifact_incomplete'),
          expect.stringContaining(
            `required_command_not_satisfied:${CLOSEOUT_FIXTURE_IDS.deliveryCommandId}`
          ),
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.openRcaAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.openRcaAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.openRcaAttemptId,
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
            sourceRefs: [{ sourceType: 'closeout_attempt', id: CLOSEOUT_FIXTURE_IDS.oldAttemptId }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
          {
            eventType: 'failure_recorded',
            failureId: 'failure-closeout-001',
            type: 'delivery_closeout_blocked',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'closeout_attempt', id: CLOSEOUT_FIXTURE_IDS.oldAttemptId }],
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.latestFailureRcaAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.latestFailureRcaAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.latestFailureRcaAttemptId,
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
              { sourceType: 'closeout_attempt', id: CLOSEOUT_FIXTURE_IDS.oldAttemptId },
            ],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentCloseoutAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentCloseoutAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.currentCloseoutAttemptId,
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
            closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentRepairedAttemptId,
            blockingReasons: ['strict_closeout_proof_gate_not_passed'],
            sourceRefs: [
              {
                sourceType: 'closeout_attempt',
                id: CLOSEOUT_FIXTURE_IDS.currentRepairedAttemptId,
              },
              {
                sourceType: 'gate_check',
                id: 'delivery-closeout:closeout-current-repaired',
              },
            ],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentRepairedAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentRepairedAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.currentRepairedAttemptId,
        '--evaluated-at',
        '2026-05-19T00:01:00.000Z',
      ]);
      expect(code).toBe(0);
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('still blocks when the current attempt has a non-closeout open failure', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'delivery-closeout-current-attempt-other-failure-')
    );
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure-other-current',
            type: 'release_gate_failed',
            status: 'open',
            closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentOtherFailureAttemptId,
            blockingReasons: ['release_gate_failed'],
            sourceRefs: [{ sourceType: 'gate_check', id: 'release-gate' }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentOtherFailureAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.currentOtherFailureAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.currentOtherFailureAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.pendingRerunAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.pendingRerunAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.pendingRerunAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain('pending_rerun_exists');
      expect(record.rerunLoops[0]).not.toHaveProperty('decision');
      expect(record.rerunLoops[0]).not.toHaveProperty('result');
      expect(record.failureRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([{ sourceType: 'rerun_loop', id: 'rerun-001' }])
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.resolvedRerunAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.resolvedRerunAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.resolvedRerunAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.invalidRerunSourceAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.invalidRerunSourceAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.invalidRerunSourceAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.hookGapAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.hookGapAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.hookGapAttemptId,
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
              commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.hookFallbackAttemptId,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: CLOSEOUT_FIXTURE_IDS.deliveryCommandId,
                closeoutAttemptId: CLOSEOUT_FIXTURE_IDS.hookFallbackAttemptId,
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: CLOSEOUT_FIXTURE_IDS.requirementId, status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        CLOSEOUT_FIXTURE_IDS.hookFallbackAttemptId,
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'hook-reconciliation-valid',
            passed: true,
          }),
        ])
      );
    } finally {
      cleanupTempRoot(root);
    }
  });

  it('rejects a controlled closeout whose EffectivePass is not current pass', () => {
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        closeoutAttemptId: 'controlled-closeout-001',
        contextHash: HASH,
        closureReceipt: {
          status: 'campaign_closed',
          closeoutAttemptId: 'controlled-closeout-001',
          contextHash: HASH,
          taskReportArtifactHash: HASH,
          receiptHash: HASH,
        },
        taskReportArtifactHash: HASH,
        judgeReviewCampaign: { decision: 'pass', aggregateHash: HASH },
        effectivePassReceipt: { effectivePass: false, effectivePassReceiptHash: HASH },
      })
    ).toThrow('main_agent_goal_task_report_provenance_mismatch');
  });
});
