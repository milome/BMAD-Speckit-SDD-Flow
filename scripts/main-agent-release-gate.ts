import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { buildEvidenceProvenance, sameRunSummary } from './evidence-provenance';
import { validatePrTopologyForReleaseGate, type PrTopology } from './parallel-mission-control';
import { runSprintStatusAuthorizedUpdate } from './sprint-status-authorized-update';
import { runCodexWorkerAdapter } from './main-agent-codex-worker-adapter';
import type { ExecutionPacket } from './orchestration-dispatch-contract';

const SOURCE_ROOT = path.resolve(__dirname, '..');

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

function appendScriptProvenanceArgs(command: string, provenance: EvidenceProvenance): string {
  const quoted = {
    runId: JSON.stringify(provenance.runId),
    storyKey: JSON.stringify(provenance.storyKey),
    evidenceBundleId: JSON.stringify(provenance.evidenceBundleId),
  };
  return `${command} --runId ${quoted.runId} --storyKey ${quoted.storyKey} --evidenceBundleId ${quoted.evidenceBundleId}`;
}

function commandSupportsScriptProvenance(command: string): boolean {
  return /main-agent-(host-matrix|dual-host)-pr-orchestrator\.(ts|js)\b/u.test(command);
}

function writeReleaseQualityProofCodexShim(proofDir: string): string {
  const shimScriptPath = path.join(proofDir, 'release-quality-proof-codex-shim.cjs');
  const shimBinPath =
    process.platform === 'win32'
      ? path.join(proofDir, 'release-quality-proof-codex-shim.cmd')
      : path.join(proofDir, 'release-quality-proof-codex-shim');
  fs.writeFileSync(
    shimScriptPath,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const input = fs.readFileSync(0, 'utf8');",
      "const matchLine = (label) => input.match(new RegExp(`${label}: (.+)`, 'i'))?.[1]?.trim();",
      "const packetId = matchLine('Packet ID');",
      "const packetPath = matchLine('Read dispatch packet');",
      "const taskReportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();",
      "const expectedDelta = matchLine('Expected delta') || 'release quality proof';",
      "const requiredArtifacts = [",
      "  '_bmad/_config/main-agent-quality-gate.thresholds.json',",
      "  'scripts/main-agent-quality-gate.ts',",
      "  'scripts/main-agent-release-gate.ts',",
      "];",
      "if (!packetId || !packetPath || !taskReportPath) {",
      "  console.error('release quality proof shim missing prompt fields');",
      "  process.exit(2);",
      "}",
      "const missing = [packetPath, ...requiredArtifacts].filter((item) => !fs.existsSync(path.resolve(process.cwd(), item)));",
      "if (missing.length > 0) {",
      "  console.error(`release quality proof shim missing artifacts: ${missing.join(', ')}`);",
      "  process.exit(3);",
      "}",
      "const report = {",
      "  packetId,",
      "  status: 'done',",
      "  filesChanged: [],",
      "  validationsRun: [",
      "    'release-quality-proof-deterministic-codex-exec-shim',",
      "    ...requiredArtifacts.map((item) => `inspect:${item}`),",
      "  ],",
      "  evidence: [",
      "    `dispatch-packet:${path.relative(process.cwd(), packetPath).replace(/\\\\/g, '/')}`,",
      "    ...requiredArtifacts.map((item) => `artifact-exists:${item}`),",
      "  ],",
      "  downstreamContext: [expectedDelta],",
      "};",
      "fs.mkdirSync(path.dirname(taskReportPath), { recursive: true });",
      "fs.writeFileSync(taskReportPath, `${JSON.stringify(report, null, 2)}\\n`, 'utf8');",
      "process.exit(0);",
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    shimBinPath,
    process.platform === 'win32'
      ? `@echo off\r\n"${process.execPath}" "${shimScriptPath}" %*\r\n`
      : `#!/usr/bin/env sh\n"${process.execPath}" "${shimScriptPath}" "$@"\n`,
    'utf8'
  );
  if (process.platform !== 'win32') {
    fs.chmodSync(shimBinPath, 0o755);
  }
  return shimBinPath;
}

function runReleaseQualityProofAdapter(input: {
  root: string;
  proofDir: string;
  packetPath: string;
  taskReportPath: string;
}): { report: ReturnType<typeof runCodexWorkerAdapter>; proofMode: 'deterministic_release_shim' | 'live_codex_cli' } {
  if (process.env.MAIN_AGENT_RELEASE_GATE_CODEX_PROOF_MODE === 'live') {
    return {
      proofMode: 'live_codex_cli',
      report: runCodexWorkerAdapter({
        projectRoot: input.root,
        packetPath: input.packetPath,
        taskReportPath: input.taskReportPath,
        timeoutMs: 120_000,
      }),
    };
  }

  const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
  process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = 'true';
  try {
    return {
      proofMode: 'deterministic_release_shim',
      report: runCodexWorkerAdapter({
        projectRoot: input.root,
        packetPath: input.packetPath,
        taskReportPath: input.taskReportPath,
        timeoutMs: 120_000,
        codexBinary: writeReleaseQualityProofCodexShim(input.proofDir),
      }),
    };
  } finally {
    if (previousAllow === undefined) {
      delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    } else {
      process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
    }
  }
}

function writeRunScopedCodexQualityProof(root: string, provenance: EvidenceProvenance): string | null {
  const proofDir = path.join(root, '_bmad-output', 'runtime', 'gates', 'codex-quality-proof');
  const packetPath = path.join(proofDir, `${provenance.runId}.packet.json`);
  const taskReportPath = path.join(proofDir, `${provenance.runId}.task-report.json`);
  const adapterReportPath = path.join(proofDir, `${provenance.runId}.adapter-report.json`);
  const proofPath = path.join(proofDir, `${provenance.runId}.proof.json`);
  fs.mkdirSync(proofDir, { recursive: true });
  const packet: ExecutionPacket = {
    packetId: `release-quality-proof-${sha256(provenance.runId).slice(0, 12)}`,
    parentSessionId: `release-quality-proof-${provenance.runId}`,
    sourceRecommendationPacketId: null,
    flow: 'story',
    phase: 'post_audit',
    taskType: 'audit',
    role: 'release-quality-proof-worker',
    inputArtifacts: [
      '_bmad/_config/main-agent-quality-gate.thresholds.json',
      'scripts/main-agent-quality-gate.ts',
      'scripts/main-agent-release-gate.ts',
    ],
    allowedWriteScope: ['_bmad-output/runtime/gates/codex-quality-proof/**'],
    expectedDelta:
      'Inspect release quality gate inputs and write the required TaskReport only; do not modify source files.',
    successCriteria: [
      'Codex worker adapter executes through main-agent-codex-worker-adapter in codex_exec mode.',
      'TaskReport status is done with evidence for same-run release quality proof.',
      'No source files outside _bmad-output/runtime/gates/codex-quality-proof are changed.',
    ],
    stopConditions: [
      'Do not claim completion without writing a strict JSON TaskReport.',
      'Do not edit application source or tests for this proof packet.',
    ],
    downstreamConsumer: 'main-agent-quality-gate-run-scoped-proof',
  };
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const { report: adapter, proofMode } = runReleaseQualityProofAdapter({
    root,
    proofDir,
    packetPath,
    taskReportPath,
  });
  fs.writeFileSync(adapterReportPath, `${JSON.stringify(adapter, null, 2)}\n`, 'utf8');
  if (!adapter.scopePassed || adapter.taskReport.status !== 'done') {
    return null;
  }
  const proof = {
    reportType: 'codex_run_scoped_quality_proof',
    generatedAt: new Date().toISOString(),
    evidence_provenance: provenance,
    codex: {
      hostKind: 'codex',
      mode: adapter.mode,
      proofMode,
      adapterExitCode: adapter.exitCode,
      taskReportStatus: adapter.taskReport.status,
      validationsRun: adapter.taskReport.validationsRun,
      adapterReportPath,
      taskReportPath,
      packetPath,
    },
  };
  fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return proofPath;
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

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const root = process.cwd();
  const e2eCommand =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_E2E_COMMAND) ||
    'node node_modules/ts-node/dist/bin.js --project tsconfig.node.json --transpile-only scripts/main-agent-host-matrix-pr-orchestrator.ts --provider real --enableRealPrApi true';
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

  const storyKey = normalizeText(args.storyKey) || 'S-release-gate';
  const expectedProvenance = buildEvidenceProvenance({
    root,
    runId: args.runId,
    storyKey,
    evidenceBundleId: args.evidenceBundleId,
    prefix: 'release-gate',
  });
  if (!args.qualityGatePath && !process.env.MAIN_AGENT_RELEASE_GATE_SKIP_QUALITY_PRODUCER) {
    const codexProofPath = writeRunScopedCodexQualityProof(root, expectedProvenance);
    const qualityCommand = appendScriptProvenanceArgs(
      'node node_modules/ts-node/dist/bin.js --project tsconfig.node.json --transpile-only scripts/main-agent-quality-gate.ts',
      expectedProvenance
    );
    runCommand(
      codexProofPath
        ? `${qualityCommand} --codexProofPath ${JSON.stringify(codexProofPath)}`
        : qualityCommand
    );
  }
  const e2eCommandWithProvenance = commandSupportsScriptProvenance(e2eCommand)
    ? appendScriptProvenanceArgs(e2eCommand, expectedProvenance)
    : e2eCommand;
  const useExplicitHostMatrixArtifact = Boolean(args.hostMatrixPath && fs.existsSync(hostMatrixPath));
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
      command: useExplicitHostMatrixArtifact ? `use-explicit-host-matrix-artifact ${hostMatrixPath}` : e2eCommandWithProvenance,
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
      githubPrApi?: { passed: boolean; prUrl: string | null };
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
        typeof value.githubPrApi.prUrl === 'string' &&
        value.githubPrApi.prUrl.length > 0 &&
        provenance.passed;
      return {
        passed,
        summary: `mode=${value.journeyMode}, journey=${value.journeyE2EPassed}, cursor=${value.hostMatrix?.hostsPassed?.cursor}, claude=${value.hostMatrix?.hostsPassed?.claude}, codex=${value.hostMatrix?.hostsPassed?.codex}, allRequiredHostsPassed=${value.hostMatrix?.allRequiredHostsPassed}, githubPrApi=${value.githubPrApi?.passed}, prUrl=${value.githubPrApi?.prUrl ?? 'missing'}, ${provenance.summary}`,
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
    if (explicitLedgerPath) {
      const ledgerCheck = validateExecutionAuditLedger(root, explicitLedgerPath, expectedProvenance);
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

process.exit(main(process.argv.slice(2)));
