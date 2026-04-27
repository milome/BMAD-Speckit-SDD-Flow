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
    storyKey: string;
    contractHash: string;
    gateReportHash: string;
    singleUse: boolean;
    expiresAt: string;
  };
}

interface DualHostEvidence {
  journeyMode: 'mock' | 'real';
  journeyE2EPassed: boolean;
  hostsPassed: Record<'claude' | 'codex', boolean>;
  evidence_provenance?: EvidenceProvenance;
}

interface SoakEvidence {
  mode: 'deterministic_contract' | 'wall_clock';
  run_kind?: 'heartbeat_only' | 'development_run_loop';
  target_duration_ms: number;
  observed_duration_ms: number;
  manual_restarts: number;
  silent_hangs: number;
  false_completions: number;
  recovery_success_rate: number;
  tick_count?: number;
  developmentRun?: {
    tick_count: number;
    completed_ticks: number;
    blocked_ticks: number;
    runLoopInvocations: Array<{
      tick: number;
      runId: string;
      status: 'completed' | 'blocked';
      packetId: string | null;
      taskReportStatus: string | null;
      evidence: string[];
      finalNextAction: string | null;
      tickCommand?: {
        command: string;
        exitCode: number | null;
        stdoutPath: string;
        stderrPath: string;
        diffHashBefore: string;
        diffHashAfter: string;
      };
    }>;
  };
  evidence_provenance?: EvidenceProvenance;
}

interface SprintStatusAuditEvidence {
  storyKey: string;
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
  contractHash?: string;
  gateReportHash?: string;
}

export interface DeliveryTruthGateReport {
  reportType: 'main_agent_delivery_truth_gate';
  generatedAt: string;
  completionAllowed: boolean;
  deliveryStatus: DeliveryStatus;
  completionLanguage: 'complete_allowed' | 'partial_only' | 'blocked_only';
  missingEvidence: string[];
  failedEvidence: string[];
  evidencePaths: Record<string, string | null>;
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
    dualHost: path.join(
      root,
      '_bmad-output',
      'runtime',
      'e2e',
      'dual-host-pr-orchestration-report.json'
    ),
    soak: path.join(root, '_bmad-output', 'runtime', 'soak', 'main-agent-soak-report.json'),
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
      evidence.completion_intent.token !== '' &&
      evidence.completion_intent.storyKey !== '' &&
      evidence.completion_intent.contractHash !== '' &&
      evidence.completion_intent.gateReportHash !== '' &&
      evidence.completion_intent.singleUse === true &&
      Date.parse(evidence.completion_intent.expiresAt) > Date.now(),
    summary: evidence
      ? `critical_failures=${evidence.critical_failures}, blocked_sprint_status_update=${evidence.blocked_sprint_status_update}, completion_intent=${evidence.completion_intent ? 'present' : 'missing'}`
      : 'missing',
  };
}

function checkDualHost(evidence: DualHostEvidence | null): { passed: boolean; summary: string } {
  return {
    passed:
      evidence != null &&
      evidence.journeyMode === 'real' &&
      evidence.journeyE2EPassed === true &&
      evidence.hostsPassed.claude === true &&
      evidence.hostsPassed.codex === true,
    summary: evidence
      ? `mode=${evidence.journeyMode}, passed=${evidence.journeyE2EPassed}, claude=${evidence.hostsPassed.claude}, codex=${evidence.hostsPassed.codex}`
      : 'missing',
  };
}

function checkSoak(evidence: SoakEvidence | null): { passed: boolean; summary: string } {
  return {
    passed:
      evidence != null &&
      evidence.mode === 'wall_clock' &&
      evidence.run_kind === 'development_run_loop' &&
      evidence.target_duration_ms >= 8 * 60 * 60 * 1000 &&
      evidence.observed_duration_ms >= evidence.target_duration_ms &&
      evidence.manual_restarts === 0 &&
      evidence.silent_hangs === 0 &&
      evidence.false_completions === 0 &&
      evidence.recovery_success_rate >= 0.95 &&
      evidence.developmentRun != null &&
      evidence.developmentRun.tick_count === evidence.tick_count &&
      evidence.developmentRun.completed_ticks > 0 &&
      evidence.developmentRun.runLoopInvocations.length === evidence.developmentRun.tick_count &&
      evidence.developmentRun.runLoopInvocations.every(
        (item) => item.runId !== '' && item.packetId !== null && item.taskReportStatus === 'done'
      ) &&
      evidence.developmentRun.runLoopInvocations.some(
        (item) =>
          item.tickCommand != null &&
          item.tickCommand.command !== '' &&
          item.tickCommand.exitCode === 0 &&
          item.tickCommand.stdoutPath !== '' &&
          item.tickCommand.stderrPath !== '' &&
          item.tickCommand.diffHashBefore !== '' &&
          item.tickCommand.diffHashAfter !== ''
      ),
    summary: evidence
      ? `mode=${evidence.mode}, run_kind=${evidence.run_kind ?? 'missing'}, target=${evidence.target_duration_ms}, observed=${evidence.observed_duration_ms}, recovery=${evidence.recovery_success_rate}, development_ticks=${evidence.developmentRun?.tick_count ?? 0}, completed_ticks=${evidence.developmentRun?.completed_ticks ?? 0}, tick_commands=${evidence.developmentRun?.runLoopInvocations.filter((item) => item.tickCommand?.exitCode === 0).length ?? 0}`
      : 'missing',
  };
}

function checkPrTopology(evidence: PrTopology | null): { passed: boolean; summary: string } {
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
      evidence.storyKey !== '' &&
      evidence.releaseGateReportPath != null &&
      evidence.gateReportHash != null &&
      evidence.gateReportHash !== '' &&
      evidence.contractHash != null &&
      evidence.contractHash !== '' &&
      evidence.fromStatus != null &&
      evidence.fromStatus !== '' &&
      evidence.toStatus === evidence.status &&
      evidence.token != null &&
      evidence.token !== '' &&
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
  dualHost: DualHostEvidence | null;
  soak: SoakEvidence | null;
  prTopology: PrTopology | null;
  sprintAudit: SprintStatusAuditEvidence | null;
  qualityGate?: QualityGateEvidence | null;
}): { passed: boolean; summary: string } {
  const entries = [
    ['releaseGate', input.releaseGate?.evidence_provenance],
    ['dualHost', input.dualHost?.evidence_provenance],
    ['soak', input.soak?.evidence_provenance],
    ['prTopology', input.prTopology?.evidence_provenance],
    ['sprintAudit', input.sprintAudit?.evidence_provenance],
    ['qualityGate', input.qualityGate?.evidence_provenance],
  ] as const;
  const present = entries.filter(([, value]) => value != null);
  if (present.length === 0) {
    return { passed: false, summary: 'missing evidence_provenance on all delivery artifacts' };
  }
  if (present.length !== entries.length) {
    return {
      passed: false,
      summary: `partial evidence_provenance: ${present.map(([id]) => id).join(',')}`,
    };
  }
  const first = present[0][1]!;
  const mismatches = present.filter(([, value]) =>
    value == null ||
    value.runId !== first.runId ||
    value.storyKey !== first.storyKey ||
    value.evidenceBundleId !== first.evidenceBundleId
  );
  return {
    passed: mismatches.length === 0 && first.runId !== '' && first.storyKey !== '' && first.evidenceBundleId !== '',
    summary:
      mismatches.length === 0
        ? `runId=${first.runId}, storyKey=${first.storyKey}, evidenceBundleId=${first.evidenceBundleId}`
        : `provenance mismatch: ${mismatches.map(([id]) => id).join(',')}`,
  };
}

export function evaluateDeliveryTruthGate(input: {
  releaseGate: ReleaseGateEvidence | null;
  dualHost: DualHostEvidence | null;
  soak: SoakEvidence | null;
  prTopology: PrTopology | null;
  sprintAudit: SprintStatusAuditEvidence | null;
  qualityGate?: QualityGateEvidence | null;
  missingEvidence?: string[];
  evidencePaths?: Record<string, string | null>;
}): DeliveryTruthGateReport {
  const checks = [
    { id: 'release-gate', ...checkReleaseGate(input.releaseGate) },
    { id: 'dual-host-real-journey', ...checkDualHost(input.dualHost) },
    { id: 'wall-clock-8h-soak', ...checkSoak(input.soak) },
    { id: 'pr-topology-closed', ...checkPrTopology(input.prTopology) },
    { id: 'authorized-sprint-status-write', ...checkSprintAudit(input.sprintAudit) },
    { id: 'quality-gate', ...checkQualityGate(input.qualityGate ?? null) },
    { id: 'same-run-evidence-provenance', ...checkEvidenceProvenance(input) },
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
    dualHost: args.dualHostPath ?? defaults.dualHost,
    soak: args.soakPath ?? defaults.soak,
    prTopology: args.prTopologyPath ?? defaults.prTopology,
    sprintAudit: args.sprintAuditPath ?? defaults.sprintAudit,
    qualityGate: args.qualityGatePath ?? defaults.qualityGate,
  };
  const releaseGate = readJson<ReleaseGateEvidence>(evidencePaths.releaseGate);
  const dualHost = readJson<DualHostEvidence>(evidencePaths.dualHost);
  const soak = readJson<SoakEvidence>(evidencePaths.soak);
  const prTopology = readJson<PrTopology>(evidencePaths.prTopology);
  const sprintAudit = readJson<SprintStatusAuditEvidence>(evidencePaths.sprintAudit);
  const qualityGate = readJson<QualityGateEvidence>(evidencePaths.qualityGate);
  for (const [id, result] of Object.entries({
    releaseGate,
    dualHost,
    soak,
    prTopology,
    sprintAudit,
    qualityGate,
  })) {
    const evidencePath = evidencePaths[id as keyof typeof evidencePaths];
    if (result.missing) missingEvidence.push(`${id}: ${evidencePath}`);
    if (result.error) missingEvidence.push(`${id}: ${evidencePath}: ${result.error}`);
  }
  const report = evaluateDeliveryTruthGate({
    releaseGate: releaseGate.value,
    dualHost: dualHost.value,
    soak: soak.value,
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
