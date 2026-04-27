/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validatePrTopologyForReleaseGate, type PrTopology } from './parallel-mission-control';

type DeliveryStatus = 'complete' | 'partial' | 'blocked';

interface ReleaseGateEvidence {
  critical_failures: number;
  blocked_sprint_status_update: boolean;
}

interface DualHostEvidence {
  journeyMode: 'mock' | 'real';
  journeyE2EPassed: boolean;
  hostsPassed: Record<'claude' | 'codex', boolean>;
}

interface SoakEvidence {
  mode: 'deterministic_contract' | 'wall_clock';
  target_duration_ms: number;
  observed_duration_ms: number;
  manual_restarts: number;
  silent_hangs: number;
  false_completions: number;
  recovery_success_rate: number;
}

interface SprintStatusAuditEvidence {
  storyKey: string;
  status: string;
  authorized: boolean;
}

export interface DeliveryTruthGateReport {
  reportType: 'main_agent_delivery_truth_gate';
  completionAllowed: boolean;
  deliveryStatus: DeliveryStatus;
  completionLanguage: 'complete_allowed' | 'partial_only' | 'blocked_only';
  missingEvidence: string[];
  failedEvidence: string[];
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

function readJson<T>(filePath: string | undefined): { value: T | null; missing: boolean; error?: string } {
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

function checkReleaseGate(evidence: ReleaseGateEvidence | null): { passed: boolean; summary: string } {
  return {
    passed:
      evidence != null &&
      evidence.critical_failures === 0 &&
      evidence.blocked_sprint_status_update === false,
    summary: evidence
      ? `critical_failures=${evidence.critical_failures}, blocked_sprint_status_update=${evidence.blocked_sprint_status_update}`
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
      evidence.target_duration_ms >= 8 * 60 * 60 * 1000 &&
      evidence.observed_duration_ms >= evidence.target_duration_ms &&
      evidence.manual_restarts === 0 &&
      evidence.silent_hangs === 0 &&
      evidence.false_completions === 0 &&
      evidence.recovery_success_rate >= 0.95,
    summary: evidence
      ? `mode=${evidence.mode}, target=${evidence.target_duration_ms}, observed=${evidence.observed_duration_ms}, recovery=${evidence.recovery_success_rate}`
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
    passed: evidence != null && validation.passed && evidence.all_affected_stories_passed && allClosed,
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
    passed: evidence != null && evidence.authorized === true && evidence.storyKey !== '',
    summary: evidence
      ? `storyKey=${evidence.storyKey}, status=${evidence.status}, authorized=${evidence.authorized}`
      : 'missing',
  };
}

export function evaluateDeliveryTruthGate(input: {
  releaseGate: ReleaseGateEvidence | null;
  dualHost: DualHostEvidence | null;
  soak: SoakEvidence | null;
  prTopology: PrTopology | null;
  sprintAudit: SprintStatusAuditEvidence | null;
  missingEvidence?: string[];
}): DeliveryTruthGateReport {
  const checks = [
    { id: 'release-gate', ...checkReleaseGate(input.releaseGate) },
    { id: 'dual-host-real-journey', ...checkDualHost(input.dualHost) },
    { id: 'wall-clock-8h-soak', ...checkSoak(input.soak) },
    { id: 'pr-topology-closed', ...checkPrTopology(input.prTopology) },
    { id: 'authorized-sprint-status-write', ...checkSprintAudit(input.sprintAudit) },
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
    completionAllowed,
    deliveryStatus,
    completionLanguage: completionAllowed
      ? 'complete_allowed'
      : deliveryStatus === 'partial'
        ? 'partial_only'
        : 'blocked_only',
    missingEvidence,
    failedEvidence,
    checks,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const missingEvidence: string[] = [];
  const releaseGate = readJson<ReleaseGateEvidence>(args.releaseGatePath);
  const dualHost = readJson<DualHostEvidence>(args.dualHostPath);
  const soak = readJson<SoakEvidence>(args.soakPath);
  const prTopology = readJson<PrTopology>(args.prTopologyPath);
  const sprintAudit = readJson<SprintStatusAuditEvidence>(args.sprintAuditPath);
  for (const [id, result] of Object.entries({ releaseGate, dualHost, soak, prTopology, sprintAudit })) {
    if (result.missing) missingEvidence.push(id);
    if (result.error) missingEvidence.push(`${id}: ${result.error}`);
  }
  const report = evaluateDeliveryTruthGate({
    releaseGate: releaseGate.value,
    dualHost: dualHost.value,
    soak: soak.value,
    prTopology: prTopology.value,
    sprintAudit: sprintAudit.value,
    missingEvidence,
  });
  if (args.reportPath) {
    const reportPath = path.resolve(args.reportPath);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  return report.completionAllowed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
