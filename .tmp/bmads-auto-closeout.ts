import { releaseBlockedByGaps, type GapRegistry } from './bmads-auto-gaps';
import { validateFixtureRegistry, type FixtureRegistryEntry } from './bmads-auto-traceability';

type DeliveryTruthMode = 'baseline' | 'real_8h_claim';
type SoakMode = 'contract' | 'wall_clock';
type ExecutionMode = 'fixture' | 'real_host_cli';
type JourneyMode = 'mock' | 'real';

export interface TraceabilityCloseoutRow {
  requirementId: string;
  status: 'planned' | 'implemented' | 'verified' | 'missing' | 'invalidated';
}

export interface RuntimeRisk {
  riskId: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  status: 'open' | 'mitigated' | 'closed';
}

export interface CloseoutInput {
  runId: string;
  manifestVersion: number;
  deliveryTruthMode: DeliveryTruthMode;
  soakMode: SoakMode;
  executionMode?: ExecutionMode;
  journeyMode?: JourneyMode;
  gapRegistry: GapRegistry;
  fixtureRegistry: FixtureRegistryEntry[];
  traceabilityRows?: TraceabilityCloseoutRow[];
  runtimeRisks?: RuntimeRisk[];
  integrationAuditPassed: boolean;
  prTopologyClosed: boolean;
  releaseGatePassed: boolean;
  sprintDryRunAuthorized: boolean;
  sprintAuditPassed: boolean;
  storyKeys?: string[];
  evidenceBundleIds?: string[];
  taskReportPaths?: string[];
  auditReportPaths?: string[];
  integrationAuditReportPath?: string;
  prTopologyReportPath?: string;
  closeoutGuardReportPath?: string;
  releaseGateReportPath?: string;
  sprintAuthorizationPath?: string;
  sprintAuditPath?: string;
  deliveryTruthReportPath?: string;
  waveCloseoutReceiptPath?: string;
  traceabilityMatrixPath?: string;
  gapRegistryPath?: string;
  gateReportHashes?: Record<string, string>;
  invalidatedArtifacts?: string[];
  driftResultCode?: 'OK' | 'BLOCKED_DRIFT_DETECTED';
  longRunEvidencePath?: string;
}

export interface CompletionReceipt {
  schemaVersion: 'bmads_auto_completion_receipt/v1';
  runId: string;
  manifestVersion: number;
  completionAllowed: boolean;
  deliveryTruthMode: DeliveryTruthMode;
  soakMode: SoakMode;
  executionMode: ExecutionMode;
  journeyMode: JourneyMode;
  real8hRequired: boolean;
  real8hValidated: boolean;
  longRunEvidencePath: string;
  storyKeys: string[];
  evidenceBundleIds: string[];
  taskReportPaths: string[];
  auditReportPaths: string[];
  integrationAuditReportPath: string;
  prTopologyReportPath: string;
  closeoutGuardReportPath: string;
  releaseGateReportPath: string;
  deliveryTruthReportPath: string;
  sprintAuthorizationPath: string;
  sprintAuditPath: string;
  waveCloseoutReceiptPath: string;
  traceabilityMatrixPath: string;
  gapRegistryPath: string;
  gateReportHashes: Record<string, string>;
  invalidatedArtifacts: string[];
  blockedTraceabilityRefs: string[];
  blockedRiskRefs: string[];
  orderedSteps: string[];
  orderedStepArtifacts: Array<{ step: string; path: string }>;
  blockers: string[];
  completionLanguage: 'complete' | 'blocked';
  completionSummary: string;
}

function safeText(value: string | undefined): string {
  return value ?? '';
}

export function runFinalCloseout(input: CloseoutInput): CompletionReceipt {
  const orderedSteps = [
    'integration audit',
    'PR topology',
    'closeout guard and traceability',
    'release gate',
    'sprint-status dry-run authorization and audit',
    'delivery truth gate',
    'terminal sprint-status update only when completionAllowed=true',
    'completion receipt',
  ];
  const blockers: string[] = [];

  if (!input.integrationAuditPassed) blockers.push('BLOCKED_INTEGRATION_AUDIT');
  if (!input.prTopologyClosed) blockers.push('BLOCKED_PR_TOPOLOGY');
  if (releaseBlockedByGaps(input.gapRegistry)) blockers.push('BLOCKED_OPEN_GAPS');

  const fixtureResult = validateFixtureRegistry(input.fixtureRegistry);
  if (fixtureResult.resultCode !== 'OK') blockers.push(...fixtureResult.blockers);

  if (input.deliveryTruthMode === 'baseline' && input.soakMode === 'wall_clock') {
    blockers.push('BLOCKED_BASELINE_WALL_CLOCK_PAIR');
  }
  if (input.deliveryTruthMode === 'real_8h_claim' && input.soakMode !== 'wall_clock') {
    blockers.push('BLOCKED_REAL_8H_SOAK_MODE_REQUIRED');
  }
  const executionMode = input.executionMode ?? 'real_host_cli';
  const journeyMode = input.journeyMode ?? 'real';
  if (executionMode === 'fixture') blockers.push('BLOCKED_FIXTURE_EXECUTION_CANNOT_CLAIM_COMPLETION');
  if (journeyMode === 'mock') blockers.push('BLOCKED_MOCK_JOURNEY_CANNOT_CLAIM_COMPLETION');

  if ((input.taskReportPaths ?? []).length === 0) blockers.push('BLOCKED_TASKREPORT_EVIDENCE_MISSING');
  if (!input.traceabilityMatrixPath) blockers.push('BLOCKED_TRACEABILITY_MATRIX_MISSING');
  if (!input.gapRegistryPath) blockers.push('BLOCKED_GAP_REGISTRY_MISSING');
  if (input.traceabilityRows && input.traceabilityRows.length === 0) {
    blockers.push('BLOCKED_TRACEABILITY_ROWS_MISSING');
  }
  if (input.fixtureRegistry.length === 0) {
    blockers.push('BLOCKED_FIXTURE_REGISTRY_EMPTY');
  }
  if ((input.invalidatedArtifacts ?? []).length > 0) blockers.push('BLOCKED_INVALIDATED_ARTIFACTS');
  const blockedTraceabilityRefs = (input.traceabilityRows ?? [])
    .filter((row) => ['missing', 'planned', 'invalidated'].includes(row.status))
    .map((row) => `${row.requirementId}:${row.status}`);
  if (blockedTraceabilityRefs.length > 0) blockers.push('BLOCKED_TRACEABILITY_STATUS');
  const blockedRiskRefs = (input.runtimeRisks ?? [])
    .filter((risk) => risk.status === 'open' && ['blocker', 'high'].includes(risk.severity))
    .map((risk) => `${risk.riskId}:${risk.severity}`);
  if (blockedRiskRefs.length > 0) blockers.push('BLOCKED_OPEN_RISKS');
  if (input.driftResultCode === 'BLOCKED_DRIFT_DETECTED') blockers.push('BLOCKED_DRIFT_DETECTED');
  if (!input.releaseGatePassed) blockers.push('BLOCKED_RELEASE_GATE');
  if (!input.sprintDryRunAuthorized) blockers.push('BLOCKED_SPRINT_STATUS_AUTHORIZATION');
  if (!input.sprintAuditPassed) blockers.push('BLOCKED_SPRINT_STATUS_AUDIT');

  const real8hRequired = input.deliveryTruthMode === 'real_8h_claim';
  if (real8hRequired && !input.longRunEvidencePath) {
    blockers.push('BLOCKED_REAL_8H_EVIDENCE_MISSING');
  }

  const orderedStepArtifacts = [
    { step: orderedSteps[0], path: safeText(input.integrationAuditReportPath) },
    { step: orderedSteps[1], path: safeText(input.prTopologyReportPath) },
    { step: orderedSteps[2], path: safeText(input.closeoutGuardReportPath) },
    { step: orderedSteps[3], path: safeText(input.releaseGateReportPath) },
    { step: orderedSteps[4], path: [safeText(input.sprintAuthorizationPath), safeText(input.sprintAuditPath)].filter(Boolean).join(' | ') },
    { step: orderedSteps[5], path: safeText(input.deliveryTruthReportPath) },
    { step: orderedSteps[6], path: blockers.length === 0 ? 'authorized-terminal-sprint-update' : 'not-authorized' },
    { step: orderedSteps[7], path: 'completion-receipt.json' },
  ];

  return {
    schemaVersion: 'bmads_auto_completion_receipt/v1',
    runId: input.runId,
    manifestVersion: input.manifestVersion,
    completionAllowed: blockers.length === 0,
    deliveryTruthMode: input.deliveryTruthMode,
    soakMode: input.soakMode,
    executionMode,
    journeyMode,
    real8hRequired,
    real8hValidated: real8hRequired && Boolean(input.longRunEvidencePath),
    longRunEvidencePath: input.longRunEvidencePath ?? '',
    storyKeys: input.storyKeys ?? [],
    evidenceBundleIds: input.evidenceBundleIds ?? [],
    taskReportPaths: input.taskReportPaths ?? [],
    auditReportPaths: input.auditReportPaths ?? [],
    integrationAuditReportPath: input.integrationAuditReportPath ?? '',
    prTopologyReportPath: input.prTopologyReportPath ?? '',
    closeoutGuardReportPath: input.closeoutGuardReportPath ?? '',
    releaseGateReportPath: input.releaseGateReportPath ?? '',
    deliveryTruthReportPath: input.deliveryTruthReportPath ?? '',
    sprintAuthorizationPath: input.sprintAuthorizationPath ?? '',
    sprintAuditPath: input.sprintAuditPath ?? '',
    waveCloseoutReceiptPath: input.waveCloseoutReceiptPath ?? '',
    traceabilityMatrixPath: input.traceabilityMatrixPath ?? '',
    gapRegistryPath: input.gapRegistryPath ?? '',
    gateReportHashes: input.gateReportHashes ?? {},
    invalidatedArtifacts: input.invalidatedArtifacts ?? [],
    blockedTraceabilityRefs,
    blockedRiskRefs,
    orderedSteps,
    orderedStepArtifacts,
    blockers,
    completionLanguage: blockers.length === 0 ? 'complete' : 'blocked',
    completionSummary:
      blockers.length === 0
        ? 'completionAllowed=true: closeout evidence validated and terminal completion wording is allowed'
        : 'blocked: required closeout evidence or gates are missing',
  };
}
