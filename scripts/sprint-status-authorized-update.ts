import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { buildEvidenceProvenance, type EvidenceProvenance } from './evidence-provenance';

type ReleaseGateReport = {
  generatedAt?: string;
  evidence_provenance?: EvidenceProvenance;
  critical_failures: number;
  blocked_sprint_status_update: boolean;
  checks?: unknown[];
  blocking_reasons?: string[];
  completion_intent?: {
    token: string;
    storyKey: string;
    contractHash: string;
    gateReportHash: string;
    singleUse: boolean;
    expiresAt: string;
  };
};

type UpdateInput = {
  storyKey: string;
  status: string;
  releaseGateReportPath: string;
  token: string;
  auditPath?: string;
  runId?: string;
  evidenceBundleId?: string;
};

const TOKEN_PREFIX = 'release-gate:pass:';

function parseArgs(argv: string[]): Partial<UpdateInput> {
  const out: Partial<UpdateInput> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--storyKey' && value) {
      out.storyKey = value;
      index += 1;
    } else if (token === '--status' && value) {
      out.status = value;
      index += 1;
    } else if (token === '--releaseGateReportPath' && value) {
      out.releaseGateReportPath = value;
      index += 1;
    } else if (token === '--token' && value) {
      out.token = value;
      index += 1;
    } else if (token === '--auditPath' && value) {
      out.auditPath = value;
      index += 1;
    } else if (token === '--runId' && value) {
      out.runId = value;
      index += 1;
    } else if (token === '--evidenceBundleId' && value) {
      out.evidenceBundleId = value;
      index += 1;
    }
  }
  return out;
}

function requireInput(input: Partial<UpdateInput>): UpdateInput {
  for (const key of ['storyKey', 'status', 'releaseGateReportPath', 'token'] as const) {
    if (!input[key]) {
      throw new Error(`missing required argument: --${key}`);
    }
  }
  return input as UpdateInput;
}

function readReleaseGateReport(root: string, reportPath: string): ReleaseGateReport {
  const fullPath = path.isAbsolute(reportPath) ? reportPath : path.resolve(root, reportPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReleaseGateReport;
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function releaseGateReportHash(report: ReleaseGateReport): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        generatedAt: report.generatedAt,
        checks: report.checks ?? [],
        blocking_reasons: report.blocking_reasons ?? [],
      })
    )
    .digest('hex');
}

function contractHash(root: string): string {
  return sha256File(path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'));
}

function assertAuthorized(root: string, input: UpdateInput): void {
  if (!input.token.startsWith(TOKEN_PREFIX)) {
    throw new Error('sprint-status update denied: invalid release token');
  }
  const reportPath = path.isAbsolute(input.releaseGateReportPath)
    ? input.releaseGateReportPath
    : path.resolve(root, input.releaseGateReportPath);
  const report = readReleaseGateReport(root, reportPath);
  if (report.critical_failures !== 0 || report.blocked_sprint_status_update) {
    throw new Error('sprint-status update denied: release gate did not pass');
  }
  const auditPath =
    input.auditPath ??
    path.join(root, '_bmad-output', 'runtime', 'governance', 'sprint-status-update-audit.json');
  if (fs.existsSync(auditPath)) {
    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as { token?: string };
    if (audit.token === input.token) {
      throw new Error('sprint-status update denied: completion intent token already used');
    }
  }
  const intent = report.completion_intent;
  if (!intent) {
    throw new Error('sprint-status update denied: missing completion intent');
  }
  if (
    intent.token !== input.token ||
    intent.storyKey !== input.storyKey ||
    intent.singleUse !== true ||
    Date.parse(intent.expiresAt) <= Date.now()
  ) {
    throw new Error('sprint-status update denied: completion intent mismatch');
  }
  if (intent.gateReportHash !== releaseGateReportHash(report)) {
    throw new Error('sprint-status update denied: release gate hash mismatch');
  }
  if (intent.contractHash !== contractHash(root)) {
    throw new Error('sprint-status update denied: contract hash mismatch');
  }
}

function sprintStatusPath(root: string): string {
  return path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
}

function updateSprintStatus(root: string, input: UpdateInput): string {
  const target = sprintStatusPath(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const existing = fs.existsSync(target)
    ? fs.readFileSync(target, 'utf8')
    : 'development_status:\n';
  const line = `  ${input.storyKey}: ${input.status}`;
  const next = existing.includes(`${input.storyKey}:`)
    ? existing.replace(new RegExp(`^\\s*${input.storyKey}:.*$`, 'm'), line)
    : `${existing.replace(/\s*$/, '\n')}${line}\n`;
  fs.writeFileSync(target, next, 'utf8');
  return target;
}

function currentStoryStatus(root: string, storyKey: string): string | null {
  const target = sprintStatusPath(root);
  if (!fs.existsSync(target)) return null;
  const match = fs
    .readFileSync(target, 'utf8')
    .match(new RegExp(`^\\s*${storyKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.+?)\\s*$`, 'm'));
  return match?.[1] ?? null;
}

function writeAudit(
  root: string,
  input: UpdateInput,
  targetPath: string,
  fromStatus: string | null
): void {
  const auditPath =
    input.auditPath ??
    path.join(root, '_bmad-output', 'runtime', 'governance', 'sprint-status-update-audit.json');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  const reportPath = path.isAbsolute(input.releaseGateReportPath)
    ? input.releaseGateReportPath
    : path.resolve(root, input.releaseGateReportPath);
  const report = readReleaseGateReport(root, reportPath);
  const evidence_provenance = buildEvidenceProvenance({
    root,
    runId: input.runId ?? report.evidence_provenance?.runId,
    storyKey: input.storyKey,
    evidenceBundleId: input.evidenceBundleId ?? report.evidence_provenance?.evidenceBundleId,
    gateReportHash: report.completion_intent?.gateReportHash ?? releaseGateReportHash(report),
    prefix: 'sprint-status-update',
  });
  fs.writeFileSync(
    auditPath,
    `${JSON.stringify(
      {
        storyKey: input.storyKey,
        status: input.status,
        authorized: true,
        evidence_provenance,
        targetPath,
        releaseGateReportPath: reportPath,
        gateReportHash: report.completion_intent?.gateReportHash ?? releaseGateReportHash(report),
        contractHash: report.completion_intent?.contractHash ?? contractHash(root),
        fromStatus: fromStatus ?? 'missing',
        toStatus: input.status,
        token: input.token,
        singleUse: true,
        expiresAt: report.completion_intent?.expiresAt ?? null,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

export function runSprintStatusAuthorizedUpdate(
  root: string,
  input: UpdateInput
): {
  updated: true;
  sprintStatusPath: string;
} {
  assertAuthorized(root, input);
  const fromStatus = currentStoryStatus(root, input.storyKey);
  const targetPath = updateSprintStatus(root, input);
  writeAudit(root, input, targetPath, fromStatus);
  return { updated: true, sprintStatusPath: targetPath };
}

function main(): number {
  try {
    const input = requireInput(parseArgs(process.argv.slice(2)));
    const result = runSprintStatusAuthorizedUpdate(process.cwd(), input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}
