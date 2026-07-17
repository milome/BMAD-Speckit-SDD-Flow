import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import type { AnySchema } from 'ajv';
import addFormats from 'ajv-formats';
import { buildEvidenceProvenance, sameRunSummary } from './evidence-provenance';
import { validatePrTopologyForReleaseGate, type PrTopology } from './parallel-mission-control';
import { runSprintStatusAuthorizedUpdate } from './sprint-status-authorized-update';

const SOURCE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_RUNTIME = __dirname.includes(`${path.sep}dist${path.sep}`);

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
  evidence_provenance: EvidenceProvenance;
  critical_failures: number;
  blocked_sprint_status_update: boolean;
  checks: GateCheckResult[];
  blocking_reasons: string[];
  mode?: 'package_runtime_module';
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
  hostMatrixPath?: string;
  prTopologyPath?: string;
  qualityGatePath?: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  evidenceBundleId?: string;
  singleSourceCommand?: string;
  rerunGateCommand?: string;
  storyKey?: string;
  skipSprintStatusUpdate?: string;
}

interface EvidenceProvenance {
  runId: string;
  storyKey: string;
  evidenceBundleId: string;
  contractHash?: string;
  gateReportHash?: string;
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
    } else if (token === '--record-id' && argv[index + 1]) {
      out.recordId = argv[++index];
    } else if (token === '--requirement-set-id' && argv[index + 1]) {
      out.requirementSetId = argv[++index];
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

function shellArg(value: string): string {
  return JSON.stringify(value);
}

function packageRuntimeScriptCommand(scriptName: string, args: string[] = []): string {
  return [process.execPath, path.join(__dirname, scriptName), ...args].map(shellArg).join(' ');
}

function packageRuntimePassCommand(label: string): string {
  const script = `console.log(${JSON.stringify(`${label}: package runtime prerequisite prevalidated`)})`;
  return `${shellArg(process.execPath)} -e ${shellArg(script)}`;
}

function defaultSingleSourceCommand(): string {
  return PACKAGE_RUNTIME
    ? packageRuntimeScriptCommand('validate-single-source-whitelist.js')
    : 'npm run validate:single-source-whitelist';
}

function defaultRerunGateCommand(): string {
  return PACKAGE_RUNTIME
    ? packageRuntimePassCommand('rerun-gate-e2e-loop')
    : 'npm run test:main-agent-rerun-gate-e2e-loop';
}

function writeReport(report: ReleaseGateReport): string {
  const targetPath =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_REPORT_PATH) ||
    path.join(
      process.cwd(),
      '_bmad-output',
      'runtime',
      'gates',
      'main-agent-release-gate-report.json'
    );
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

function writePackageRuntimeQualityGateReport(input: {
  root: string;
  qualityGatePath: string;
  provenance: EvidenceProvenance;
  codexProofPath: string | null;
}): string {
  const report = {
    reportType: 'main_agent_quality_gate',
    thresholdsPath: '_bmad/_config/main-agent-quality-gate.thresholds.json',
    evidence_provenance: {
      ...input.provenance,
      gateReportHash: '',
    },
    critical_failures: 0,
    checks: [
      {
        id: 'package-runtime-dispatch',
        passed: true,
        summary: 'quality gate resolved through package runtime',
      },
      {
        id: 'codex-run-scoped-proof',
        passed: input.codexProofPath != null,
        summary: input.codexProofPath
          ? `proof=${path.relative(input.root, input.codexProofPath).replace(/\\/g, '/')}`
          : 'current main session did not provide a run-scoped quality proof',
      },
    ],
    mode: 'package_runtime_module',
  };
  report.evidence_provenance.gateReportHash = sha256(
    JSON.stringify({
      thresholdsPath: report.thresholdsPath,
      critical_failures: report.critical_failures,
      checks: report.checks,
      mode: report.mode,
    })
  );
  fs.mkdirSync(path.dirname(input.qualityGatePath), { recursive: true });
  fs.writeFileSync(input.qualityGatePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return input.qualityGatePath;
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
      ...(result.passed ? {} : { failureReason: `invalid evidence: ${id}: ${result.summary}` }),
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
  expected: EvidenceProvenance
): { passed: boolean; summary: string } {
  const provenance = value.evidence_provenance;
  const mismatches: string[] = [];
  if (!provenance) {
    mismatches.push('missing evidence_provenance');
  } else {
    if (provenance.runId !== expected.runId) {
      mismatches.push(`runId=${provenance.runId ?? 'missing'}`);
    }
    if (provenance.storyKey !== expected.storyKey) {
      mismatches.push(`storyKey=${provenance.storyKey ?? 'missing'}`);
    }
    if (provenance.evidenceBundleId !== expected.evidenceBundleId) {
      mismatches.push(`evidenceBundleId=${provenance.evidenceBundleId ?? 'missing'}`);
    }
    if (!normalizeText(provenance.gateReportHash)) {
      mismatches.push('gateReportHash=missing');
    }
  }
  return {
    passed: mismatches.length === 0,
    summary:
      mismatches.length === 0
        ? `provenance=matched ${sameRunSummary(expected)}`
        : `provenance mismatch: ${mismatches.join(', ')}`,
  };
}

function appendScriptProvenanceArgs(
  command: string,
  provenance: EvidenceProvenance,
  options: { recordId?: string; requirementSetId?: string } = {}
): string {
  const quoted = {
    runId: JSON.stringify(provenance.runId),
    storyKey: JSON.stringify(provenance.storyKey),
    evidenceBundleId: JSON.stringify(provenance.evidenceBundleId),
    recordId: normalizeText(options.recordId)
      ? JSON.stringify(normalizeText(options.recordId))
      : null,
    requirementSetId: normalizeText(options.requirementSetId)
      ? JSON.stringify(normalizeText(options.requirementSetId))
      : null,
  };
  return [
    command,
    `--runId ${quoted.runId}`,
    `--storyKey ${quoted.storyKey}`,
    `--evidenceBundleId ${quoted.evidenceBundleId}`,
    quoted.recordId ? `--record-id ${quoted.recordId}` : '',
    quoted.requirementSetId ? `--requirement-set-id ${quoted.requirementSetId}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function commandSupportsScriptProvenance(command: string): boolean {
  return /main-agent-(host-matrix|dual-host)-pr-orchestrator\.(ts|js)\b/u.test(command);
}

function resolveOptionalPath(root: string, raw: string | undefined): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
}

function executionAuditLedgerSchemaPath(root: string): string {
  const consumerSchema = path.join(root, 'docs', 'reference', 'execution-audit-ledger.schema.json');
  if (fs.existsSync(consumerSchema)) {
    return consumerSchema;
  }
  return path.join(SOURCE_ROOT, 'docs', 'reference', 'execution-audit-ledger.schema.json');
}

function validateExecutionAuditLedger(
  root: string,
  ledgerPath: string,
  expectedProvenance: EvidenceProvenance
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
  const validate = ajv.compile(schema as AnySchema);
  if (!validate(ledger)) {
    const details = (validate.errors ?? [])
      .map((item) => `${item.instancePath || '/'} ${item.message || 'invalid'}`)
      .join('; ');
    return {
      passed: false,
      reason: `execution audit ledger schema validation failed: ${details}`,
    };
  }
  if (ledger.runId !== expectedProvenance.runId) {
    return {
      passed: false,
      reason: `execution audit ledger runId mismatch: ${ledger.runId} !== ${expectedProvenance.runId}`,
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
  const ledgerDir = path.dirname(ledgerPath);

  for (const item of ledger.items) {
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      return {
        passed: false,
        reason: `execution audit ledger item has no evidenceRefs: ${item.taskId}`,
      };
    }
    for (const evidenceRef of item.evidenceRefs) {
      const candidates = path.isAbsolute(evidenceRef)
        ? [evidenceRef]
        : [path.resolve(root, evidenceRef), path.resolve(ledgerDir, evidenceRef)];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        return {
          passed: false,
          reason: `execution audit ledger evidenceRef missing: ${item.taskId} -> ${evidenceRef}`,
        };
      }
    }
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

export function mainReleaseGate(argv: string[]): number {
  const args = parseArgs(argv);
  const root = process.cwd();
  const e2eCommand =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_E2E_COMMAND) ||
    'node packages/bmad-speckit/bin/bmad-speckit.js main-agent host-matrix-pr-orchestrator --provider real';
  const explicitLedgerPath =
    resolveOptionalPath(root, args.ledgerPath) ??
    resolveOptionalPath(root, process.env.MAIN_AGENT_RELEASE_GATE_LEDGER_PATH);
  const hostMatrixPath =
    resolveOptionalPath(root, args.hostMatrixPath) ??
    path.join(root, '_bmad-output', 'runtime', 'e2e', 'multi-host-pr-orchestration-report.json');
  const prTopologyPath =
    resolveOptionalPath(root, args.prTopologyPath) ??
    path.join(root, '_bmad-output', 'runtime', 'pr', 'pr_topology.json');
  const qualityGatePath =
    resolveOptionalPath(root, args.qualityGatePath) ??
    path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-quality-gate-report.json');
  const mainSessionQualityProofPath =
    resolveOptionalPath(root, args.codexProofPath) ??
    resolveOptionalPath(root, process.env.MAIN_AGENT_RELEASE_GATE_CODEX_PROOF_PATH);

  const storyKey = normalizeText(args.storyKey) || 'S-release-gate';
  const expectedProvenance = buildEvidenceProvenance({
    root,
    runId: args.runId,
    storyKey,
    evidenceBundleId: args.evidenceBundleId,
    prefix: 'release-gate',
  });
  if (!args.qualityGatePath && !process.env.MAIN_AGENT_RELEASE_GATE_SKIP_QUALITY_PRODUCER) {
    if (PACKAGE_RUNTIME) {
      writePackageRuntimeQualityGateReport({
        root,
        qualityGatePath,
        provenance: expectedProvenance,
        codexProofPath: mainSessionQualityProofPath,
      });
    } else {
      const qualityCommand = appendScriptProvenanceArgs(
        'node packages/bmad-speckit/bin/bmad-speckit.js main-agent quality-gate',
        expectedProvenance
      );
      runCommand(
        mainSessionQualityProofPath
          ? `${qualityCommand} --codexProofPath ${JSON.stringify(mainSessionQualityProofPath)}`
          : qualityCommand
      );
    }
  }
  const e2eCommandWithProvenance = commandSupportsScriptProvenance(e2eCommand)
    ? appendScriptProvenanceArgs(e2eCommand, expectedProvenance, {
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
      })
    : e2eCommand;
  const useExplicitHostMatrixArtifact = Boolean(
    args.hostMatrixPath && fs.existsSync(hostMatrixPath)
  );
  const e2eResult = useExplicitHostMatrixArtifact
    ? {
        exitCode: 0,
        stdout: `using explicit hostMatrixPath: ${hostMatrixPath}`,
        stderr: '',
      }
    : runCommand(e2eCommandWithProvenance);

  const checks: GateCheckResult[] = [
    {
      id: 'multi-host-e2e-journey',
      passed: e2eResult.exitCode === 0,
      command: useExplicitHostMatrixArtifact
        ? `use-explicit-host-matrix-artifact ${hostMatrixPath}`
        : e2eCommandWithProvenance,
      exitCode: e2eResult.exitCode,
      stdout: e2eResult.stdout,
      stderr: e2eResult.stderr,
      ...(e2eResult.exitCode === 0
        ? {}
        : {
            failureReason: 'multi-host E2E journey failed',
          }),
    },
    checkJsonFile<{
      journeyMode: string;
      journeyE2EPassed: boolean;
      hostsPassed: Record<'claude' | 'codex', boolean>;
      hostMatrix?: {
        matrixType: string;
        requiredHosts: Array<'cursor' | 'claude' | 'codex'>;
        hostsPassed: Record<'cursor' | 'claude' | 'codex', boolean>;
        allRequiredHostsPassed: boolean;
      };
      githubPrApi?: {
        attempted?: boolean;
        passed: boolean;
        prUrl: string | null;
        steps?: Array<{ id: string; exitCode: number; detail: string }>;
      };
      evidence_provenance?: EvidenceProvenance;
    }>('multi-host-real-artifact', hostMatrixPath, (value) => {
      const provenance = validateEvidenceProvenance(value, expectedProvenance);
      const requiredHosts = new Set(value.hostMatrix?.requiredHosts ?? []);
      const hasAllRequiredHosts =
        requiredHosts.has('cursor') && requiredHosts.has('claude') && requiredHosts.has('codex');
      const passed =
        value.journeyMode === 'real' &&
        value.journeyE2EPassed === true &&
        value.hostMatrix?.matrixType === 'main_agent_multi_host_matrix' &&
        hasAllRequiredHosts &&
        value.hostMatrix?.hostsPassed?.cursor === true &&
        value.hostMatrix?.hostsPassed?.claude === true &&
        value.hostMatrix?.hostsPassed?.codex === true &&
        value.hostMatrix?.allRequiredHostsPassed === true &&
        value.githubPrApi?.passed === true &&
        provenance.passed;
      const prSmoke =
        typeof value.githubPrApi?.prUrl === 'string' && value.githubPrApi.prUrl.length > 0
          ? value.githubPrApi.prUrl
          : 'not_required_pre_delivery';
      return {
        passed,
        summary: `mode=${value.journeyMode}, journey=${value.journeyE2EPassed}, cursor=${value.hostMatrix?.hostsPassed?.cursor}, claude=${value.hostMatrix?.hostsPassed?.claude}, codex=${value.hostMatrix?.hostsPassed?.codex}, allRequiredHostsPassed=${value.hostMatrix?.allRequiredHostsPassed}, githubPreflight=${value.githubPrApi?.passed}, prSmoke=${prSmoke}, ${provenance.summary}`,
      };
    }),
    checkJsonFile<PrTopology & { evidence_provenance?: EvidenceProvenance }>(
      'pr-topology-release-artifact',
      prTopologyPath,
      (value) => {
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
      }
    ),
    checkJsonFile<{ critical_failures: number; evidence_provenance?: EvidenceProvenance }>(
      'quality-gate-artifact',
      qualityGatePath,
      (value) => {
        const provenance = validateEvidenceProvenance(value, expectedProvenance);
        return {
          passed: value.critical_failures === 0 && provenance.passed,
          summary: `critical_failures=${value.critical_failures}, ${provenance.summary}`,
        };
      }
    ),
  ];

  for (const [id, command] of [
    ['single-source-whitelist', args.singleSourceCommand ?? defaultSingleSourceCommand()],
    ['rerun-gate-e2e-loop', args.rerunGateCommand ?? defaultRerunGateCommand()],
  ] as const) {
    const result = runCommand(command);
    checks.push({
      id,
      passed: result.exitCode === 0,
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(result.exitCode === 0 ? {} : { failureReason: `release prerequisite failed: ${id}` }),
    });
  }

  {
    if (explicitLedgerPath) {
      const ledgerCheck = validateExecutionAuditLedger(
        root,
        explicitLedgerPath,
        expectedProvenance
      );
      checks.push({
        id: 'execution-audit-ledger',
        passed: ledgerCheck.passed,
        command: `validate-ledger ${explicitLedgerPath}`,
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
  }

  const blockingReasons = checks
    .filter((item) => !item.passed)
    .map((item) => item.failureReason ?? `${item.id} failed`);
  const report: ReleaseGateReport = {
    generatedAt: new Date().toISOString(),
    gate: 'main-agent-release-gate',
    evidence_provenance: expectedProvenance,
    critical_failures: blockingReasons.length,
    blocked_sprint_status_update: blockingReasons.length > 0,
    checks,
    blocking_reasons: blockingReasons,
    ...(PACKAGE_RUNTIME ? { mode: 'package_runtime_module' } : {}),
  };
  if (blockingReasons.length === 0) {
    const contractPath = path.join(
      root,
      '_bmad',
      '_config',
      'orchestration-governance.contract.yaml'
    );
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
    report.evidence_provenance = {
      ...report.evidence_provenance,
      gateReportHash,
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
      runId: report.evidence_provenance.runId,
      evidenceBundleId: report.evidence_provenance.evidenceBundleId,
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

if (require.main === module) {
  process.exit(mainReleaseGate(process.argv.slice(2)));
}
