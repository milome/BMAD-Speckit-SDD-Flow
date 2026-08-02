/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validatePrTopologyForReleaseGate, type PrTopology } from './parallel-mission-control';

type DeliveryStatus = 'complete' | 'partial' | 'blocked';

interface ReleaseGateEvidence {
  critical_failures: number;
  blocked_sprint_status_update: boolean;
  evidence_provenance?: EvidenceProvenance;
  completion_intent?: {
    token: string;
    runId: string;
    storyKey: string;
    evidenceBundleId: string;
    attemptId: string;
    contractHash: string;
    gateReportHash: string;
    singleUse: boolean;
    expiresAt: string;
  };
}

interface HostMatrixEvidence {
  journeyMode: 'mock' | 'real';
  journeyE2EPassed: boolean;
  hostMatrix?: {
    matrixType: 'main_agent_multi_host_matrix';
    requiredHosts: Array<'cursor' | 'claude' | 'codex'>;
    hostsPassed: Record<'cursor' | 'claude' | 'codex', boolean>;
    allRequiredHostsPassed: boolean;
    legacyDualHostPassed?: boolean;
  };
  githubPrApi?: {
    attempted?: boolean;
    passed: boolean;
    prUrl: string | null;
    steps?: Array<{ id: string; exitCode: number; detail: string }>;
  };
  evidence_provenance?: EvidenceProvenance;
}

interface SprintStatusAuditEvidence {
  runId?: string;
  storyKey: string;
  evidenceBundleId?: string;
  attemptId?: string;
  status: string;
  authorized: boolean;
  releaseGateReportPath?: string;
  gateReportHash?: string;
  contractHash?: string;
  fromStatus?: string;
  toStatus?: string;
  token?: string;
  singleUse?: boolean;
  expiresAt?: string;
  evidence_provenance?: EvidenceProvenance;
}

interface QualityGateEvidence {
  critical_failures: number;
  evidence_provenance?: EvidenceProvenance;
}

interface EvidenceProvenance {
  runId: string;
  storyKey: string;
  evidenceBundleId: string;
  contractHash: string;
  gateReportHash: string;
  completionToken: string;
  attemptId: string;
  expiresAt: string;
}

export type DeliveryArtifactBinding = EvidenceProvenance;

export interface DeliveryTruthGateReport {
  reportType: 'main_agent_delivery_truth_gate';
  generatedAt: string;
  completionAllowed: boolean;
  deliveryStatus: DeliveryStatus;
  completionLanguage: 'complete_allowed' | 'partial_only' | 'blocked_only';
  missingEvidence: string[];
  failedEvidence: string[];
  evidencePaths: Record<string, string | null>;
  evidenceBinding: DeliveryArtifactBinding | null;
  checks: Array<{ id: string; passed: boolean; summary: string }>;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--') && argv[index + 1]) {
      out[token.slice(2)] = argv[++index];
    }
  }
  return out;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function readJson<T>(filePath: string | undefined): {
  value: T | null;
  missing: boolean;
  error?: string;
} {
  if (!filePath) return { value: null, missing: true };
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return { value: null, missing: true };
  try {
    return { value: JSON.parse(fs.readFileSync(resolved, 'utf8')) as T, missing: false };
  } catch (error) {
    return {
      value: null,
      missing: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function defaultEvidencePaths(root: string): Record<string, string> {
  return {
    releaseGate: path.join(
      root,
      '_bmad-output',
      'runtime',
      'gates',
      'main-agent-release-gate-report.json'
    ),
    hostMatrix: path.join(
      root,
      '_bmad-output',
      'runtime',
      'e2e',
      'multi-host-pr-orchestration-report.json'
    ),
    prTopology: path.join(root, '_bmad-output', 'runtime', 'pr', 'pr_topology.json'),
    sprintAudit: path.join(
      root,
      '_bmad-output',
      'runtime',
      'governance',
      'sprint-status-update-audit.json'
    ),
    qualityGate: path.join(
      root,
      '_bmad-output',
      'runtime',
      'gates',
      'main-agent-quality-gate-report.json'
    ),
  };
}

function checkReleaseGate(evidence: ReleaseGateEvidence | null): {
  passed: boolean;
  summary: string;
} {
  return {
    passed:
      evidence != null &&
      evidence.critical_failures === 0 &&
      evidence.blocked_sprint_status_update === false &&
      evidence.completion_intent != null &&
      nonEmptyString(evidence.completion_intent.token) &&
      nonEmptyString(evidence.completion_intent.runId) &&
      nonEmptyString(evidence.completion_intent.storyKey) &&
      nonEmptyString(evidence.completion_intent.evidenceBundleId) &&
      nonEmptyString(evidence.completion_intent.attemptId) &&
      nonEmptyString(evidence.completion_intent.contractHash) &&
      nonEmptyString(evidence.completion_intent.gateReportHash) &&
      evidence.completion_intent.singleUse === true &&
      Date.parse(evidence.completion_intent.expiresAt) > Date.now(),
    summary: evidence
      ? `critical_failures=${evidence.critical_failures}, blocked_sprint_status_update=${evidence.blocked_sprint_status_update}, completion_intent=${evidence.completion_intent ? 'present' : 'missing'}`
      : 'missing',
  };
}

function checkHostMatrix(evidence: HostMatrixEvidence | null): {
  passed: boolean;
  summary: string;
} {
  const requiredHosts = new Set(evidence?.hostMatrix?.requiredHosts ?? []);
  const hasAllRequiredHosts =
    requiredHosts.has('cursor') && requiredHosts.has('claude') && requiredHosts.has('codex');
  const structuralPassed =
    evidence != null &&
    evidence.journeyMode === 'real' &&
    evidence.journeyE2EPassed === true &&
    evidence.hostMatrix?.matrixType === 'main_agent_multi_host_matrix' &&
    hasAllRequiredHosts &&
    evidence.hostMatrix.hostsPassed.cursor === true &&
    evidence.hostMatrix.hostsPassed.claude === true &&
    evidence.hostMatrix.hostsPassed.codex === true &&
    evidence.hostMatrix.allRequiredHostsPassed === true;
  const githubPreflightPassed =
    evidence?.githubPrApi == null ? true : evidence.githubPrApi.passed === true;
  const failureLabel =
    evidence?.githubPrApi?.passed === false
      ? 'github_auth_not_verified'
      : 'host_matrix_real_preflight_failed';
  return {
    passed: structuralPassed && githubPreflightPassed,
    summary: evidence
      ? `mode=${evidence.journeyMode}, journey=${evidence.journeyE2EPassed}, cursor=${evidence.hostMatrix?.hostsPassed.cursor}, claude=${evidence.hostMatrix?.hostsPassed.claude}, codex=${evidence.hostMatrix?.hostsPassed.codex}, allRequiredHostsPassed=${evidence.hostMatrix?.allRequiredHostsPassed}, githubPreflight=${evidence.githubPrApi?.passed ?? 'not_recorded'}, ${structuralPassed && githubPreflightPassed ? 'host_matrix_real_preflight_passed' : failureLabel}`
      : 'missing',
  };
}

function checkPrTopology(evidence: PrTopology | null): { passed: boolean; summary: string } {
  if (evidence == null) {
    return {
      passed: true,
      summary: 'not_required_pre_delivery',
    };
  }
  const validation = evidence ? validatePrTopologyForReleaseGate(evidence) : { passed: false };
  const allClosed =
    evidence?.required_nodes.every((node) =>
      ['merged', 'closed_not_needed'].includes(node.state)
    ) === true;
  return {
    passed:
      evidence != null && validation.passed && evidence.all_affected_stories_passed && allClosed,
    summary: evidence
      ? `all_affected_stories_passed=${evidence.all_affected_stories_passed}, nodes=${evidence.required_nodes
          .map((node) => `${node.node_id}:${node.state}`)
          .join(',')}`
      : 'missing',
  };
}

function checkSprintAudit(evidence: SprintStatusAuditEvidence | null): {
  passed: boolean;
  summary: string;
} {
  return {
    passed:
      evidence != null &&
      evidence.authorized === true &&
      nonEmptyString(evidence.runId) &&
      nonEmptyString(evidence.storyKey) &&
      nonEmptyString(evidence.evidenceBundleId) &&
      nonEmptyString(evidence.attemptId) &&
      nonEmptyString(evidence.releaseGateReportPath) &&
      nonEmptyString(evidence.gateReportHash) &&
      nonEmptyString(evidence.contractHash) &&
      nonEmptyString(evidence.fromStatus) &&
      evidence.toStatus === evidence.status &&
      nonEmptyString(evidence.token) &&
      evidence.singleUse === true &&
      evidence.expiresAt != null &&
      Date.parse(evidence.expiresAt) > Date.now(),
    summary: evidence
      ? `storyKey=${evidence.storyKey}, status=${evidence.status}, authorized=${evidence.authorized}, strongAudit=${Boolean(evidence.gateReportHash && evidence.contractHash && evidence.singleUse)}`
      : 'missing',
  };
}

function checkQualityGate(evidence: QualityGateEvidence | null): {
  passed: boolean;
  summary: string;
} {
  return {
    passed: evidence != null && evidence.critical_failures === 0,
    summary: evidence ? `critical_failures=${evidence.critical_failures}` : 'missing',
  };
}

function checkEvidenceProvenance(input: {
  releaseGate: ReleaseGateEvidence | null;
  hostMatrix: HostMatrixEvidence | null;
  prTopology: PrTopology | null;
  sprintAudit: SprintStatusAuditEvidence | null;
  qualityGate?: QualityGateEvidence | null;
}): { passed: boolean; summary: string; binding: DeliveryArtifactBinding | null } {
  const entries: Array<[string, EvidenceProvenance | undefined]> = [
    ['releaseGate', input.releaseGate?.evidence_provenance],
    ['hostMatrix', input.hostMatrix?.evidence_provenance],
    ['sprintAudit', input.sprintAudit?.evidence_provenance],
    ['qualityGate', input.qualityGate?.evidence_provenance],
  ];
  if (input.prTopology) {
    entries.push([
      'prTopology',
      input.prTopology.evidence_provenance as EvidenceProvenance | undefined,
    ]);
  }
  const present = entries.filter(([, value]) => value != null);
  if (present.length === 0) {
    return {
      passed: false,
      summary: 'missing evidence_provenance on all delivery artifacts',
      binding: null,
    };
  }
  if (present.length !== entries.length) {
    return {
      passed: false,
      summary: `partial evidence_provenance: ${present.map(([id]) => id).join(',')}`,
      binding: null,
    };
  }
  const first = present[0][1]!;
  const bindingKeys = [
    'runId',
    'storyKey',
    'evidenceBundleId',
    'contractHash',
    'gateReportHash',
    'completionToken',
    'attemptId',
    'expiresAt',
  ] as const satisfies readonly (keyof DeliveryArtifactBinding)[];
  const missingBindings = bindingKeys.filter((key) => !nonEmptyString(first[key]));
  const mismatches = present.filter(
    ([, value]) =>
      value == null ||
      bindingKeys.some((key) => value[key] !== first[key])
  );
  const releaseIntent = input.releaseGate?.completion_intent;
  const releaseIntentMismatch =
    releaseIntent == null ||
    releaseIntent.runId !== first.runId ||
    releaseIntent.storyKey !== first.storyKey ||
    releaseIntent.evidenceBundleId !== first.evidenceBundleId ||
    releaseIntent.contractHash !== first.contractHash ||
    releaseIntent.gateReportHash !== first.gateReportHash ||
    releaseIntent.token !== first.completionToken ||
    releaseIntent.attemptId !== first.attemptId ||
    releaseIntent.expiresAt !== first.expiresAt;
  const sprintAudit = input.sprintAudit;
  const sprintAuditMismatch =
    sprintAudit == null ||
    sprintAudit.runId !== first.runId ||
    sprintAudit.storyKey !== first.storyKey ||
    sprintAudit.evidenceBundleId !== first.evidenceBundleId ||
    sprintAudit.contractHash !== first.contractHash ||
    sprintAudit.gateReportHash !== first.gateReportHash ||
    sprintAudit.token !== first.completionToken ||
    sprintAudit.attemptId !== first.attemptId ||
    sprintAudit.expiresAt !== first.expiresAt;
  const expiryValid = Number.isFinite(Date.parse(first.expiresAt)) &&
    Date.parse(first.expiresAt) > Date.now();
  const mismatchLabels = [
    ...mismatches.map(([id]) => id),
    ...(releaseIntentMismatch ? ['releaseGate.completion_intent'] : []),
    ...(sprintAuditMismatch ? ['sprintAudit.binding'] : []),
    ...(!expiryValid ? ['expiry'] : []),
  ];
  const passed =
    missingBindings.length === 0 &&
    mismatchLabels.length === 0;
  return {
    passed,
    summary: passed
      ? `runId=${first.runId}, storyKey=${first.storyKey}, evidenceBundleId=${first.evidenceBundleId}, attemptId=${first.attemptId}, contractHash=present, gateReportHash=present, completionToken=present, expiry=current`
      : `provenance mismatch: ${[
          ...missingBindings.map((key) => `missing:${key}`),
          ...mismatchLabels,
        ].join(',')}`,
    binding: passed ? { ...first } : null,
  };
}

export function evaluateDeliveryTruthGate(input: {
  releaseGate: ReleaseGateEvidence | null;
  hostMatrix?: HostMatrixEvidence | null;
  dualHost?: unknown;
  prTopology: PrTopology | null;
  sprintAudit: SprintStatusAuditEvidence | null;
  qualityGate?: QualityGateEvidence | null;
  missingEvidence?: string[];
  evidencePaths?: Record<string, string | null>;
  env?: NodeJS.ProcessEnv;
}): DeliveryTruthGateReport {
  const env = input.env ?? process.env;
  const provenanceCheck = checkEvidenceProvenance({
    ...input,
    hostMatrix: input.hostMatrix ?? null,
  });
  const checks = [
    { id: 'release-gate', ...checkReleaseGate(input.releaseGate) },
    { id: 'multi-host-host-matrix', ...checkHostMatrix(input.hostMatrix ?? null) },
    { id: 'pr-topology-closed', ...checkPrTopology(input.prTopology) },
    { id: 'authorized-sprint-status-write', ...checkSprintAudit(input.sprintAudit) },
    { id: 'quality-gate', ...checkQualityGate(input.qualityGate ?? null) },
    {
      id: 'same-run-evidence-provenance',
      passed: provenanceCheck.passed,
      summary: provenanceCheck.summary,
    },
    {
      id: 'test-dev-seams-disabled',
      passed:
        env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT !== 'true' &&
        env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE !== 'true',
      summary:
        env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true' ||
        env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE === 'true'
          ? `unsafe seam enabled: MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT=${env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT ?? 'unset'}, MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE=${env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE ?? 'unset'}`
          : 'test/dev seams disabled',
    },
  ];
  const failedEvidence = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.id}: ${check.summary}`);
  const missingEvidence = input.missingEvidence ?? [];
  const completionAllowed = failedEvidence.length === 0 && missingEvidence.length === 0;
  const deliveryStatus: DeliveryStatus = completionAllowed
    ? 'complete'
    : missingEvidence.length > 0
      ? 'blocked'
      : 'partial';
  return {
    reportType: 'main_agent_delivery_truth_gate',
    generatedAt: new Date().toISOString(),
    completionAllowed,
    deliveryStatus,
    completionLanguage: completionAllowed
      ? 'complete_allowed'
      : deliveryStatus === 'partial'
        ? 'partial_only'
        : 'blocked_only',
    missingEvidence,
    failedEvidence,
    evidencePaths: input.evidencePaths ?? {},
    evidenceBinding: provenanceCheck.binding,
    checks,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const root = path.resolve(args.cwd ?? process.cwd());
  const defaults = defaultEvidencePaths(root);
  const missingEvidence: string[] = [];
  const evidencePaths = {
    releaseGate: args.releaseGatePath ?? defaults.releaseGate,
    hostMatrix: args.hostMatrixPath ?? defaults.hostMatrix,
    prTopology: args.prTopologyPath ?? defaults.prTopology,
    sprintAudit: args.sprintAuditPath ?? defaults.sprintAudit,
    qualityGate: args.qualityGatePath ?? defaults.qualityGate,
  };
  const releaseGate = readJson<ReleaseGateEvidence>(evidencePaths.releaseGate);
  const hostMatrix = readJson<HostMatrixEvidence>(evidencePaths.hostMatrix);
  const prTopology = readJson<PrTopology>(evidencePaths.prTopology);
  const sprintAudit = readJson<SprintStatusAuditEvidence>(evidencePaths.sprintAudit);
  const qualityGate = readJson<QualityGateEvidence>(evidencePaths.qualityGate);
  for (const [id, result] of Object.entries({
    releaseGate,
    hostMatrix,
    prTopology,
    sprintAudit,
    qualityGate,
  })) {
    const evidencePath = evidencePaths[id as keyof typeof evidencePaths];
    if (result.missing && id !== 'prTopology') missingEvidence.push(`${id}: ${evidencePath}`);
    if (result.error) missingEvidence.push(`${id}: ${evidencePath}: ${result.error}`);
  }
  const report = evaluateDeliveryTruthGate({
    releaseGate: releaseGate.value,
    hostMatrix: hostMatrix.value,
    prTopology: prTopology.value,
    sprintAudit: sprintAudit.value,
    qualityGate: qualityGate.value,
    missingEvidence,
    evidencePaths,
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        root,
        '_bmad-output',
        'runtime',
        'gates',
        'main-agent-delivery-truth-gate-report.json'
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  return report.completionAllowed || args.allowPartialExitZero === 'true' ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
