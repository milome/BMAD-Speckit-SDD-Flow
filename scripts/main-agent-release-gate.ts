import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { validatePrTopologyForReleaseGate, type PrTopology } from './parallel-mission-control';
import { runSprintStatusAuthorizedUpdate } from './sprint-status-authorized-update';

interface GateCheckResult {
  id: string;
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  failureReason?: string;
}

interface ReleaseGateReport {
  generatedAt: string;
  gate: 'main-agent-release-gate';
  critical_failures: number;
  blocked_sprint_status_update: boolean;
  checks: GateCheckResult[];
  blocking_reasons: string[];
  completion_intent?: {
    token: string;
    storyKey: string;
    contractHash: string;
    gateReportHash: string;
    singleUse: true;
    expiresAt: string;
  };
}

interface ReleaseGateCliOptions {
  ledgerPath?: string;
  dualHostPath?: string;
  prTopologyPath?: string;
  qualityGatePath?: string;
  runId?: string;
  evidenceBundleId?: string;
  singleSourceCommand?: string;
  rerunGateCommand?: string;
  storyKey?: string;
  skipSprintStatusUpdate?: string;
}

interface EvidenceProvenance {
  runId?: string;
  storyKey?: string;
  evidenceBundleId?: string;
}

interface ExecutionAuditLedgerItem {
  taskId: string;
  status: 'todo' | 'in_progress' | 'pass' | 'partial' | 'fail' | 'blocked';
  updatedAt: string;
  dependsOn?: string[];
  evidenceRefs: string[];
  notes?: string;
}

interface ExecutionAuditLedger {
  version: 1;
  ledgerType: 'execution_audit';
  runId: string;
  taskSetId?: string;
  generatedAt: string;
  items: ExecutionAuditLedgerItem[];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function parseArgs(argv: string[]): ReleaseGateCliOptions {
  const out: ReleaseGateCliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--ledgerPath' && argv[index + 1]) {
      out.ledgerPath = argv[index + 1];
      index += 1;
    } else if (token.startsWith('--') && argv[index + 1]) {
      out[token.slice(2) as keyof ReleaseGateCliOptions] = argv[index + 1];
      index += 1;
    }
  }
  return out;
}

function runCommand(command: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
  });

  return {
    exitCode: result.status ?? (result.error ? 1 : 0),
    stdout: normalizeText(result.stdout),
    stderr: normalizeText(result.stderr || result.error?.message),
  };
}

function writeReport(report: ReleaseGateReport): string {
  const targetPath =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_REPORT_PATH) ||
    path.join(process.cwd(), '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return targetPath;
}

function writeReportAt(report: ReleaseGateReport, targetPath: string): string {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return targetPath;
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function checkJsonFile<T>(
  id: string,
  filePath: string,
  validate: (value: T) => { passed: boolean; summary: string }
): GateCheckResult {
  if (!fs.existsSync(filePath)) {
    return {
      id,
      passed: false,
      command: `read-json ${filePath}`,
      exitCode: 1,
      stdout: '',
      stderr: `missing evidence: ${filePath}`,
      failureReason: `missing evidence: ${id} at ${filePath}`,
    };
  }
  try {
    const result = validate(readJson<T>(filePath));
    return {
      id,
      passed: result.passed,
      command: `validate-json ${filePath}`,
      exitCode: result.passed ? 0 : 1,
      stdout: result.summary,
      stderr: result.passed ? '' : result.summary,
      ...(result.passed
        ? {}
        : { failureReason: `invalid evidence: ${id}: ${result.summary}` }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      id,
      passed: false,
      command: `validate-json ${filePath}`,
      exitCode: 1,
      stdout: '',
      stderr: reason,
      failureReason: `invalid evidence json: ${id}: ${reason}`,
    };
  }
}

function validateEvidenceProvenance(
  value: { evidence_provenance?: EvidenceProvenance },
  expected: { runId?: string; storyKey?: string; evidenceBundleId?: string }
): { passed: boolean; summary: string } {
  if (!expected.runId && !expected.storyKey && !expected.evidenceBundleId) {
    return { passed: true, summary: 'provenance=not-required' };
  }
  const provenance = value.evidence_provenance;
  const mismatches: string[] = [];
  if (!provenance) {
    mismatches.push('missing evidence_provenance');
  } else {
    if (expected.runId && provenance.runId !== expected.runId) {
      mismatches.push(`runId=${provenance.runId ?? 'missing'}`);
    }
    if (expected.storyKey && provenance.storyKey !== expected.storyKey) {
      mismatches.push(`storyKey=${provenance.storyKey ?? 'missing'}`);
    }
    if (expected.evidenceBundleId && provenance.evidenceBundleId !== expected.evidenceBundleId) {
      mismatches.push(`evidenceBundleId=${provenance.evidenceBundleId ?? 'missing'}`);
    }
  }
  return {
    passed: mismatches.length === 0,
    summary:
      mismatches.length === 0
        ? `provenance=matched runId=${expected.runId ?? '*'} storyKey=${expected.storyKey ?? '*'} evidenceBundleId=${expected.evidenceBundleId ?? '*'}`
        : `provenance mismatch: ${mismatches.join(', ')}`,
  };
}

function resolveOptionalPath(root: string, raw: string | undefined): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
}

function executionAuditLedgerSchemaPath(root: string): string {
  return path.join(root, 'docs', 'reference', 'execution-audit-ledger.schema.json');
}

function validateExecutionAuditLedger(
  root: string,
  ledgerPath: string
): { passed: true; summary: string } | { passed: false; reason: string } {
  if (!fs.existsSync(ledgerPath)) {
    return {
      passed: false,
      reason: `execution audit ledger missing: ${ledgerPath}`,
    };
  }

  const schemaPath = executionAuditLedgerSchemaPath(root);
  if (!fs.existsSync(schemaPath)) {
    return {
      passed: false,
      reason: `execution audit ledger schema missing: ${schemaPath}`,
    };
  }

  let ledger: ExecutionAuditLedger;
  let schema: unknown;
  try {
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as ExecutionAuditLedger;
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    return {
      passed: false,
      reason: `execution audit ledger parse failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(ledger)) {
    const details = (validate.errors ?? [])
      .map((item) => `${item.instancePath || '/'} ${item.message || 'invalid'}`)
      .join('; ');
    return {
      passed: false,
      reason: `execution audit ledger schema validation failed: ${details}`,
    };
  }

  const seen = new Set<string>();
  for (const item of ledger.items) {
    if (seen.has(item.taskId)) {
      return {
        passed: false,
        reason: `execution audit ledger contains duplicate taskId: ${item.taskId}`,
      };
    }
    seen.add(item.taskId);
  }

  const taskMap = new Map<string, ExecutionAuditLedgerItem>(
    ledger.items.map((item) => [item.taskId, item])
  );

  for (const item of ledger.items) {
    for (const dep of item.dependsOn ?? []) {
      const upstream = taskMap.get(dep);
      if (!upstream) {
        return {
          passed: false,
          reason: `execution audit ledger dependency missing: ${item.taskId} depends on unknown task ${dep}`,
        };
      }

      if (
        (item.status === 'pass' || item.status === 'in_progress') &&
        (upstream.status === 'fail' || upstream.status === 'blocked')
      ) {
        return {
          passed: false,
          reason: `execution audit ledger inconsistent: downstream ${item.taskId}=${item.status} while upstream ${dep}=${upstream.status}`,
        };
      }
    }
  }

  return {
    passed: true,
    summary: `execution audit ledger validated: ${ledger.items.length} items`,
  };
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const root = process.cwd();
  const e2eCommand =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_E2E_COMMAND) ||
    'npm run test:e2e:dual-host:journey';
  const ledgerPath =
    resolveOptionalPath(root, args.ledgerPath) ??
    resolveOptionalPath(root, process.env.MAIN_AGENT_RELEASE_GATE_LEDGER_PATH) ??
    path.join(root, '_bmad-output', 'runtime', 'governance', 'execution-audit-ledger.json');
  const dualHostPath =
    resolveOptionalPath(root, args.dualHostPath) ??
    path.join(root, '_bmad-output', 'runtime', 'e2e', 'dual-host-pr-orchestration-report.json');
  const prTopologyPath =
    resolveOptionalPath(root, args.prTopologyPath) ??
    path.join(root, '_bmad-output', 'runtime', 'pr', 'pr_topology.json');
  const qualityGatePath =
    resolveOptionalPath(root, args.qualityGatePath) ??
    path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-quality-gate-report.json');

  const e2eResult = runCommand(e2eCommand);
  const storyKey = normalizeText(args.storyKey) || 'S-release-gate';
  const requireSameRunProvenance =
    Boolean(normalizeText(args.runId)) || Boolean(normalizeText(args.evidenceBundleId));
  const expectedProvenance = {
    runId: normalizeText(args.runId) || undefined,
    storyKey: requireSameRunProvenance ? storyKey : undefined,
    evidenceBundleId: normalizeText(args.evidenceBundleId) || undefined,
  };

  const checks: GateCheckResult[] = [
    {
      id: 'dual-host-e2e-journey',
      passed: e2eResult.exitCode === 0,
      command: e2eCommand,
      exitCode: e2eResult.exitCode,
      stdout: e2eResult.stdout,
      stderr: e2eResult.stderr,
      ...(e2eResult.exitCode === 0
        ? {}
        : {
            failureReason: 'dual-host E2E journey failed',
          }),
    },
    checkJsonFile<{
      journeyMode: string;
      journeyE2EPassed: boolean;
      hostsPassed: Record<'claude' | 'codex', boolean>;
      githubPrApi?: { passed: boolean; prUrl: string | null };
      evidence_provenance?: EvidenceProvenance;
    }>('dual-host-real-artifact', dualHostPath, (value) => {
      const provenance = validateEvidenceProvenance(value, expectedProvenance);
      const passed =
        value.journeyMode === 'real' &&
        value.journeyE2EPassed === true &&
        value.hostsPassed?.claude === true &&
        value.hostsPassed?.codex === true &&
        value.githubPrApi?.passed === true &&
        typeof value.githubPrApi.prUrl === 'string' &&
        value.githubPrApi.prUrl.length > 0 &&
        provenance.passed;
      return {
        passed,
        summary: `mode=${value.journeyMode}, journey=${value.journeyE2EPassed}, claude=${value.hostsPassed?.claude}, codex=${value.hostsPassed?.codex}, githubPrApi=${value.githubPrApi?.passed}, prUrl=${value.githubPrApi?.prUrl ?? 'missing'}, ${provenance.summary}`,
      };
    }),
    checkJsonFile<PrTopology & { evidence_provenance?: EvidenceProvenance }>('pr-topology-release-artifact', prTopologyPath, (value) => {
      const provenance = validateEvidenceProvenance(value, expectedProvenance);
      const validation = validatePrTopologyForReleaseGate(value);
      const closed =
        value.all_affected_stories_passed === true &&
        value.required_nodes.every((node) =>
          ['merged', 'closed_not_needed'].includes(node.state)
        );
      return {
        passed: validation.passed && closed && provenance.passed,
        summary: `all_affected_stories_passed=${value.all_affected_stories_passed}, nodes=${value.required_nodes.map((node) => `${node.node_id}:${node.state}`).join(',')}, ${provenance.summary}`,
      };
    }),
    checkJsonFile<{ critical_failures: number; evidence_provenance?: EvidenceProvenance }>('quality-gate-artifact', qualityGatePath, (value) => {
      const provenance = validateEvidenceProvenance(value, expectedProvenance);
      return {
        passed: value.critical_failures === 0 && provenance.passed,
        summary: `critical_failures=${value.critical_failures}, ${provenance.summary}`,
      };
    }),
  ];

  for (const [id, command] of [
    ['single-source-whitelist', args.singleSourceCommand ?? 'npm run validate:single-source-whitelist'],
    ['rerun-gate-e2e-loop', args.rerunGateCommand ?? 'npm run test:main-agent-rerun-gate-e2e-loop'],
  ] as const) {
    const result = runCommand(command);
    checks.push({
      id,
      passed: result.exitCode === 0,
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(result.exitCode === 0
        ? {}
        : { failureReason: `release prerequisite failed: ${id}` }),
    });
  }

  {
    const ledgerCheck = validateExecutionAuditLedger(root, ledgerPath);
    checks.push({
      id: 'execution-audit-ledger',
      passed: ledgerCheck.passed,
      command: `validate-ledger ${ledgerPath}`,
      exitCode: ledgerCheck.passed ? 0 : 1,
      stdout: ledgerCheck.passed ? ledgerCheck.summary : '',
      stderr: ledgerCheck.passed ? '' : ledgerCheck.reason,
      ...(ledgerCheck.passed
        ? {}
        : {
            failureReason: `execution audit ledger failed: ${ledgerCheck.reason}`,
          }),
    });
  }

  const blockingReasons = checks
    .filter((item) => !item.passed)
    .map((item) => item.failureReason ?? `${item.id} failed`);
  const report: ReleaseGateReport = {
    generatedAt: new Date().toISOString(),
    gate: 'main-agent-release-gate',
    critical_failures: blockingReasons.length,
    blocked_sprint_status_update: blockingReasons.length > 0,
    checks,
    blocking_reasons: blockingReasons,
  };
  if (blockingReasons.length === 0) {
    const contractPath = path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const token = `${'release-gate:pass'}:${storyKey}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const gateReportHash = sha256(
      JSON.stringify({
        generatedAt: report.generatedAt,
        checks: report.checks,
        blocking_reasons: report.blocking_reasons,
      })
    );
    report.completion_intent = {
      token,
      storyKey,
      contractHash: sha256File(contractPath),
      gateReportHash,
      singleUse: true,
      expiresAt,
    };
  }
  const reportPath = writeReport(report);
  if (blockingReasons.length === 0 && args.skipSprintStatusUpdate !== 'true') {
    if (!report.completion_intent) {
      throw new Error('release gate passed without completion intent');
    }
    runSprintStatusAuthorizedUpdate(root, {
      storyKey: report.completion_intent.storyKey,
      status: 'done',
      releaseGateReportPath: reportPath,
      token: report.completion_intent.token,
    });
  }
  writeReportAt(report, reportPath);

  process.stdout.write(
    `${JSON.stringify(
      {
        report_path: reportPath,
        critical_failures: report.critical_failures,
        blocked_sprint_status_update: report.blocked_sprint_status_update,
      },
      null,
      2
    )}\n`
  );

  if (blockingReasons.length > 0) {
    process.stderr.write('[main-agent-release-gate] BLOCKED\n');
    for (const reason of blockingReasons) {
      process.stderr.write(`- ${reason}\n`);
    }
    return 1;
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
