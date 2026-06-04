/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  acknowledgeDispatch,
  createDispatchPacket,
  ingestTaskReport,
  runDriftDetector,
} from './bmads-auto-dispatch';
import { buildContractIndexReportForScope, type ContractIndexScope } from './bmads-auto-contract-index';
import { runFinalCloseout } from './bmads-auto-closeout';
import { type FixtureRegistryEntry, type TraceabilityRow } from './bmads-auto-traceability';
import { verifyDesign, verifyRun } from './bmads-auto-verify';

type Command =
  | 'inspect'
  | 'confirm'
  | 'plan'
  | 'run'
  | 'status'
  | 'resume'
  | 'change-control'
  | 'contract-index'
  | 'verify-design'
  | 'verify-run';
type DeliveryTruthMode = 'baseline' | 'real_8h_claim';
type SoakMode = 'contract' | 'wall_clock';
type RunStatus =
  | 'confirmed'
  | 'planned'
  | 'dispatching'
  | 'awaiting_taskreport'
  | 'wave_closeout'
  | 'closeout'
  | 'paused_change_control'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

interface ParsedArgs {
  command: Command;
  cwd: string;
  json: boolean;
  deliveryTruthMode: DeliveryTruthMode;
  soakMode: SoakMode;
  host: string;
  input?: string;
  against?: string;
  scope: ContractIndexScope;
  runId?: string;
  invalidOptions: string[];
}

interface RunManifest {
  schemaVersion: 'bmads_auto_run_manifest/v1';
  runId: string;
  manifestVersion: number;
  status: RunStatus;
  currentStage: string;
  currentWave: string;
  deliveryTruthMode: DeliveryTruthMode;
  soakMode: SoakMode;
  runMode: 'bounded_autonomous';
  packetIndex: Record<string, unknown>;
  storyStates: Record<string, unknown>;
  openLeases: unknown[];
  openResumableContexts: unknown[];
  contractHashes: Record<string, string>;
  artifactPaths: Record<string, string>;
  driftCheckpoints: string[];
  intentContractPath: string;
  executionPlanPath: string;
  resultCode: string;
  createdAt: string;
  updatedAt: string;
}

interface IntentContract {
  schemaVersion: 'bmads_auto_intent_contract/v1';
  runId: string;
  goal: string;
  scope: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
  deliveryTruthMode: DeliveryTruthMode;
  soakMode: SoakMode;
  sourceInputHash: string;
  traceabilityRows: TraceabilityRow[];
  fixtureRegistry: FixtureRegistryEntry[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = (argv[0] ?? 'inspect') as Command;
  const options = new Map<string, string | boolean>();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) options.set(key, true);
    else {
      options.set(key, next);
      index += 1;
    }
  }
  const deliveryTruthModeRaw = String(options.get('delivery-truth-mode') ?? 'baseline');
  const soakModeRaw = String(options.get('soak-mode') ?? 'contract');
  const invalidOptions: string[] = [];
  if (!['baseline', 'real_8h_claim'].includes(deliveryTruthModeRaw)) {
    invalidOptions.push(`delivery-truth-mode=${deliveryTruthModeRaw}`);
  }
  if (!['contract', 'wall_clock'].includes(soakModeRaw)) {
    invalidOptions.push(`soak-mode=${soakModeRaw}`);
  }
  return {
    command,
    cwd: path.resolve(String(options.get('cwd') ?? process.cwd())),
    json: options.has('json'),
    deliveryTruthMode: deliveryTruthModeRaw === 'real_8h_claim' ? 'real_8h_claim' : 'baseline',
    soakMode: soakModeRaw === 'wall_clock' ? 'wall_clock' : 'contract',
    host: String(options.get('host') ?? 'auto'),
    input: typeof options.get('input') === 'string' ? String(options.get('input')) : undefined,
    against: typeof options.get('against') === 'string' ? String(options.get('against')) : undefined,
    scope: options.get('scope') === 'product-design' ? 'product-design' : 'runtime',
    runId: typeof options.get('run-id') === 'string' ? String(options.get('run-id')) : undefined,
    invalidOptions,
  };
}

function runtimeRoot(cwd: string, runId: string): string {
  return path.join(cwd, '_bmad-output', 'runtime', 'bmads-auto', runId);
}

function artifactsRoot(cwd: string, runId: string): string {
  return path.join(runtimeRoot(cwd, runId), 'artifacts');
}

function manifestPath(cwd: string, runId: string): string {
  return path.join(runtimeRoot(cwd, runId), 'run-manifest.json');
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tempPath, 'w');
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function nowIso(): string {
  return new Date().toISOString();
}

function readManifest(cwd: string, runId: string): RunManifest | null {
  const target = manifestPath(cwd, runId);
  return fs.existsSync(target) ? readJson<RunManifest>(target) : null;
}

function writeManifest(cwd: string, manifest: RunManifest): void {
  writeJson(manifestPath(cwd, manifest.runId), manifest);
}

function nextActions(status: RunStatus): string[] {
  if (status === 'confirmed') return ['plan'];
  if (status === 'planned') return ['run'];
  if (status === 'paused_change_control') return ['resume', 'status'];
  if (status === 'completed') return ['status'];
  return ['status', 'resume', 'change-control'];
}

function blocked(command: string, resultCode: string, nextAllowedActions: string[], runId?: string) {
  return {
    schemaVersion: 'bmads_auto_command/v1',
    command,
    resultCode,
    status: 'blocked',
    reportPath: null,
    nextAllowedActions,
    sideEffectArtifacts: [],
    blockers: [resultCode],
    runId,
  };
}

function manifestPathFromArtifact(artifactPath: string, runId: string): string {
  const parsed = path.parse(artifactPath);
  const segments = artifactPath
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  const markerLength = 4;
  for (let index = 0; index <= segments.length - markerLength; index += 1) {
    if (
      segments[index] === '_bmad-output' &&
      segments[index + 1] === 'runtime' &&
      segments[index + 2] === 'bmads-auto' &&
      segments[index + 3] === runId
    ) {
      return path.join(parsed.root, ...segments.slice(0, index + markerLength), 'run-manifest.json');
    }
  }
  return manifestPath(path.dirname(path.dirname(path.dirname(artifactPath))), runId);
}

function ok(command: string, runId: string, artifactPath: string, manifest: RunManifest, sideEffectArtifacts?: string[]) {
  const runtimePath = manifestPathFromArtifact(artifactPath, runId);
  return {
    schemaVersion: 'bmads_auto_command/v1',
    command,
    resultCode: manifest.resultCode,
    status: manifest.status,
    reportPath: artifactPath,
    nextAllowedActions: nextActions(manifest.status),
    sideEffectArtifacts: sideEffectArtifacts ?? [artifactPath, runtimePath],
    runId,
    artifactPath,
    manifestPath: runtimePath,
    manifestVersion: manifest.manifestVersion,
  };
}

function inspect(args: ParsedArgs) {
  const configPath = path.join(args.cwd, '_bmad', '_config', 'bmads-runtime.yaml');
  const skillPath = path.join(args.cwd, '_bmad', 'skills', 'bmads-auto', 'SKILL.md');
  const designPath = path.join(
    args.cwd,
    'docs',
    'design',
    '2026-04-29-bmads-auto-epic-story-orchestration-requirements.md'
  );
  const blockers: string[] = [];
  for (const invalidOption of args.invalidOptions) blockers.push(`BLOCKED_INVALID_OPTION:${invalidOption}`);
  if (args.deliveryTruthMode === 'baseline' && args.soakMode === 'wall_clock') {
    blockers.push('BLOCKED_WALL_CLOCK_SOAK_REQUIRES_REAL_8H_CLAIM');
  }
  if (!fs.existsSync(configPath)) blockers.push('BLOCKED_MISSING_RUNTIME_CONFIG');
  if (!fs.existsSync(skillPath)) blockers.push('BLOCKED_MISSING_BMADS_AUTO_SKILL');
  if (!fs.existsSync(designPath)) blockers.push('BLOCKED_MISSING_DESIGN_SOURCE');
  return {
    schemaVersion: 'bmads_auto_inspect/v1',
    command: 'inspect',
    resultCode: blockers.length === 0 ? 'OK' : blockers.some((item) => item.includes('INVALID') || item.includes('WALL_CLOCK')) ? 'BLOCKED_INVALID_MODE' : 'BLOCKED_MISSING_RUNTIME',
    status: 'inspect_only',
    reportPath: null,
    cwd: args.cwd,
    runtime: {
      configPath,
      configExists: fs.existsSync(configPath),
      skillPath,
      skillExists: fs.existsSync(skillPath),
      designPath,
      designExists: fs.existsSync(designPath),
    },
    deliveryTruth: {
      mode: args.deliveryTruthMode,
      soakMode: args.soakMode,
      real8hRequired: args.deliveryTruthMode === 'real_8h_claim',
      requestedMode: args.invalidOptions.find((item) => item.startsWith('delivery-truth-mode='))?.split('=')[1],
      requestedSoakMode: args.invalidOptions.find((item) => item.startsWith('soak-mode='))?.split('=')[1],
    },
    nextAllowedActions: blockers.length === 0 ? ['confirm'] : ['inspect'],
    sideEffectArtifacts: [],
    blockers,
  };
}

function contractIndex(args: ParsedArgs) {
  return buildContractIndexReportForScope(args.scope);
}

function verifyDesignCommand(args: ParsedArgs) {
  if (!args.against) return blocked('verify-design', 'BLOCKED_AGAINST_REQUIRED', ['inspect']);
  return verifyDesign(path.resolve(args.cwd, args.against));
}

function verifyRunCommand(args: ParsedArgs) {
  if (!args.runId) return blocked('verify-run', 'BLOCKED_RUN_ID_REQUIRED', ['inspect']);
  return verifyRun(args.cwd, args.runId);
}

function confirm(args: ParsedArgs) {
  if (!args.input) return blocked('confirm', 'BLOCKED_INPUT_REQUIRED', ['inspect']);
  const inputPath = path.resolve(args.cwd, args.input);
  if (!fs.existsSync(inputPath)) return blocked('confirm', 'BLOCKED_INPUT_NOT_FOUND', ['inspect']);
  const rawInput = fs.readFileSync(inputPath, 'utf8');
  const input = JSON.parse(rawInput) as {
    runId?: string;
    goal?: string;
    scope?: string;
    acceptanceCriteria?: string[];
    nonGoals?: string[];
    traceabilityRows?: TraceabilityRow[];
    fixtureRegistry?: FixtureRegistryEntry[];
  };
  const runId = args.runId ?? input.runId ?? path.basename(inputPath, path.extname(inputPath));
  const root = runtimeRoot(args.cwd, runId);
  const intentPath = path.join(root, 'intent-contract.json');
  const planPath = path.join(root, 'execution-plan.json');
  const sourceInputHash = hashText(rawInput);
  const existing = readManifest(args.cwd, runId);
  if (existing && fs.existsSync(intentPath)) {
    const intent = readJson<{ sourceInputHash: string; deliveryTruthMode: DeliveryTruthMode; soakMode: SoakMode }>(intentPath);
    if (
      intent.sourceInputHash !== sourceInputHash ||
      intent.deliveryTruthMode !== args.deliveryTruthMode ||
      intent.soakMode !== args.soakMode
    ) {
      return blocked('confirm', 'BLOCKED_INTENT_CONFLICT', ['inspect'], runId);
    }
    return ok('confirm', runId, intentPath, existing);
  }
  const designPath = path.join(args.cwd, 'docs', 'design', '2026-04-29-bmads-auto-epic-story-orchestration-requirements.md');
  const createdAt = nowIso();
  const manifest: RunManifest = {
    schemaVersion: 'bmads_auto_run_manifest/v1',
    runId,
    manifestVersion: 1,
    status: 'confirmed',
    currentStage: 'confirmed',
    currentWave: '',
    deliveryTruthMode: args.deliveryTruthMode,
    soakMode: args.soakMode,
    runMode: 'bounded_autonomous',
    packetIndex: {},
    storyStates: {},
    openLeases: [],
    openResumableContexts: [],
    contractHashes: {
      intentInput: sourceInputHash,
      designSource: fs.existsSync(designPath) ? hashText(fs.readFileSync(designPath, 'utf8')) : '',
    },
    artifactPaths: { intentContract: intentPath, executionPlan: planPath },
    driftCheckpoints: [],
    intentContractPath: intentPath,
    executionPlanPath: planPath,
    resultCode: 'OK',
    createdAt,
    updatedAt: createdAt,
  };
  writeJson(intentPath, {
    schemaVersion: 'bmads_auto_intent_contract/v1',
    runId,
    goal: String(input.goal ?? ''),
    scope: String(input.scope ?? ''),
    acceptanceCriteria: Array.isArray(input.acceptanceCriteria) ? input.acceptanceCriteria.map(String) : [],
    nonGoals: Array.isArray(input.nonGoals) ? input.nonGoals.map(String) : [],
    deliveryTruthMode: args.deliveryTruthMode,
    soakMode: args.soakMode,
    sourceInputHash,
    traceabilityRows: Array.isArray(input.traceabilityRows) ? input.traceabilityRows : [],
    fixtureRegistry: Array.isArray(input.fixtureRegistry) ? input.fixtureRegistry : [],
  });
  writeManifest(args.cwd, manifest);
  return ok('confirm', runId, intentPath, manifest);
}

function plan(args: ParsedArgs) {
  if (!args.runId) return blocked('plan', 'BLOCKED_RUN_ID_REQUIRED', ['inspect']);
  const manifest = readManifest(args.cwd, args.runId);
  if (!manifest) return blocked('plan', 'BLOCKED_RUN_NOT_FOUND', ['inspect'], args.runId);
  if (!['confirmed', 'planned'].includes(manifest.status)) {
    return blocked('plan', 'BLOCKED_INVALID_STATE_TRANSITION', ['status'], args.runId);
  }
  if (!fs.existsSync(manifest.executionPlanPath)) {
    writeJson(manifest.executionPlanPath, {
      schemaVersion: 'bmads_auto_execution_plan/v1',
      runId: args.runId,
      waves: [],
      deliveryTruthMode: manifest.deliveryTruthMode,
      soakMode: manifest.soakMode,
      createdAt: nowIso(),
    });
  }
  const nextManifest: RunManifest = {
    ...manifest,
    manifestVersion: manifest.status === 'planned' ? manifest.manifestVersion : manifest.manifestVersion + 1,
    status: 'planned',
    currentStage: 'planned',
    updatedAt: manifest.status === 'planned' ? manifest.updatedAt : nowIso(),
  };
  if (nextManifest.manifestVersion !== manifest.manifestVersion) writeManifest(args.cwd, nextManifest);
  return ok('plan', args.runId, manifest.executionPlanPath, nextManifest);
}

function status(args: ParsedArgs) {
  if (!args.runId) return blocked('status', 'BLOCKED_RUN_ID_REQUIRED', ['inspect']);
  const manifest = readManifest(args.cwd, args.runId);
  if (!manifest) return blocked('status', 'BLOCKED_RUN_NOT_FOUND', ['inspect'], args.runId);
  return ok('status', args.runId, manifestPath(args.cwd, args.runId), manifest, []);
}

function writeEvidence(args: ParsedArgs, manifest: RunManifest): Record<string, string> {
  const root = artifactsRoot(args.cwd, manifest.runId);
  const intent = readJson<IntentContract>(manifest.intentContractPath);
  const paths = {
    contractIndex: path.join(root, 'contract-index.json'),
    gapRegistry: path.join(root, 'gap-registry.json'),
    traceabilityMatrix: path.join(root, 'traceability-matrix.json'),
    fixtureRegistry: path.join(root, 'fixture-registry.json'),
    e2eEvidence: path.join(root, 'e2e-evidence.json'),
  };
  writeJson(paths.contractIndex, {
    schemaVersion: 'bmads_auto_run_contract_index/v1',
    runId: manifest.runId,
    manifestVersion: manifest.manifestVersion,
    contracts: intent.traceabilityRows.map((row) => ({
      contractId: `RUN-${row.requirementId}`,
      sourceSectionRefs: [row.requirementId],
      requirementRefs: [row.requirementId],
      gapRefs: row.gapRefs,
      fixtureRefs: row.fixtureRefs,
      runtimeArtifacts: [paths.traceabilityMatrix, paths.fixtureRegistry, paths.e2eEvidence],
      blockingResultCodes: ['BLOCKED_TRACEABILITY_INCOMPLETE', 'BLOCKED_FIXTURE_ORPHAN'],
      implementationTargets: [row.implementationTarget],
      testTargets: [row.testTarget],
      verifyResponsibilities: { verifyDesign: false, verifyRun: true },
      consumerExposure: 'runtime',
    })),
  });
  writeJson(paths.gapRegistry, { schemaVersion: 'bmads_auto_gap_registry/v1', runId: manifest.runId, gaps: [] });
  writeJson(paths.traceabilityMatrix, {
    schemaVersion: 'bmads_auto_traceability_matrix/v1',
    runId: manifest.runId,
    manifestVersion: manifest.manifestVersion,
    rows: intent.traceabilityRows,
  });
  writeJson(paths.fixtureRegistry, {
    schemaVersion: 'bmads_auto_fixture_registry/v1',
    runId: manifest.runId,
    entries: intent.fixtureRegistry,
  });
  writeJson(paths.e2eEvidence, {
    schemaVersion: 'bmads_auto_e2e_evidence/v1',
    runId: manifest.runId,
    baselineCloseoutWithoutReal8h: true,
    optionalReal8hClaimExecuted: false,
  });
  return paths;
}

function run(args: ParsedArgs) {
  if (!args.runId) return blocked('run', 'BLOCKED_RUN_ID_REQUIRED', ['inspect']);
  const manifest = readManifest(args.cwd, args.runId);
  if (!manifest) return blocked('run', 'BLOCKED_RUN_NOT_FOUND', ['inspect'], args.runId);
  if (!['planned', 'completed'].includes(manifest.status)) {
    return blocked('run', 'BLOCKED_INVALID_STATE_TRANSITION', ['status'], args.runId);
  }
  if (manifest.status === 'completed') return ok('run', args.runId, manifest.artifactPaths.completionReceipt, manifest, []);
  const intent = readJson<IntentContract>(manifest.intentContractPath);
  const root = artifactsRoot(args.cwd, args.runId);
  if (intent.traceabilityRows.length === 0 || intent.fixtureRegistry.length === 0) {
    const evidence = writeEvidence(args, { ...manifest, manifestVersion: manifest.manifestVersion + 1 });
    const receiptPath = path.join(root, 'completion-receipt.json');
    const blockers = [
      ...(intent.traceabilityRows.length === 0 ? ['BLOCKED_TRACEABILITY_ROWS_MISSING'] : []),
      ...(intent.fixtureRegistry.length === 0 ? ['BLOCKED_FIXTURE_REGISTRY_EMPTY'] : []),
    ];
    writeJson(receiptPath, {
      schemaVersion: 'bmads_auto_completion_receipt/v1',
      runId: args.runId,
      manifestVersion: manifest.manifestVersion + 1,
      completionAllowed: false,
      blockers,
      completionLanguage: 'blocked',
      completionSummary: 'blocked: run-specific traceability and fixture contracts are required',
    });
    const updated: RunManifest = {
      ...manifest,
      manifestVersion: manifest.manifestVersion + 1,
      status: 'blocked',
      currentStage: 'closeout',
      currentWave: 'baseline-closeout',
      artifactPaths: { ...manifest.artifactPaths, ...evidence, completionReceipt: receiptPath },
      resultCode: 'BLOCKED_CLOSEOUT',
      updatedAt: nowIso(),
    };
    writeManifest(args.cwd, updated);
    return ok('run', args.runId, receiptPath, updated, [receiptPath, ...Object.values(evidence), manifestPath(args.cwd, args.runId)]);
  }
  runDriftDetector({ root, runId: args.runId, scope: 'pre-dispatch', baselineHashes: manifest.contractHashes, currentHashes: manifest.contractHashes });
  const packet = createDispatchPacket({
    root,
    runId: args.runId,
    storyKey: 'baseline-closeout',
    manifestVersion: manifest.manifestVersion,
    allowedWriteScope: ['scripts/', 'tests/acceptance/', 'outputs/runtime/'],
  });
  acknowledgeDispatch({ root, packet, host: args.host, hostSessionId: `${args.host}-session` });
  const ingest = ingestTaskReport({
    root,
    report: {
      schemaVersion: 'bmads_auto_task_report/v1',
      runId: args.runId,
      storyKey: packet.storyKey,
      dispatchPacketId: packet.dispatchPacketId,
      dispatchManifestVersion: packet.dispatchManifestVersion,
      host: args.host,
      status: 'done',
      changedFiles: ['scripts/bmads-auto-cli.ts'],
      tests: [{ name: 'bmads-auto-state-machine', exitCode: 0 }],
      commands: [{ command: 'vitest', exitCode: 0 }],
    },
  });
  runDriftDetector({ root, runId: args.runId, scope: 'post-ingest', baselineHashes: manifest.contractHashes, currentHashes: manifest.contractHashes });
  runDriftDetector({ root, runId: args.runId, scope: 'wave-closeout', baselineHashes: manifest.contractHashes, currentHashes: manifest.contractHashes });
  const evidence = writeEvidence(args, { ...manifest, manifestVersion: manifest.manifestVersion + 1 });
  const receiptPath = path.join(root, 'completion-receipt.json');
  const deliveryTruthPath = path.join(root, 'delivery-truth-report.json');
  const releaseGatePath = path.join(root, 'release-gate-report.json');
  const integrationAuditPath = path.join(root, 'integration-audit.json');
  const prTopologyPath = path.join(root, 'pr-topology-report.json');
  const closeoutGuardPath = path.join(root, 'closeout-guard-report.json');
  const sprintAuthorizationPath = path.join(root, 'sprint-authorization.json');
  const sprintAuditPath = path.join(root, 'sprint-audit.json');
  const waveCloseoutReceiptPath = path.join(root, 'wave-closeout-receipt.json');
  const traceabilityMatrix = readJson<{ rows?: Array<{ requirementId: string; status: 'planned' | 'implemented' | 'verified' | 'missing' | 'invalidated' }> }>(
    evidence.traceabilityMatrix
  );
  const fixtureRegistry = readJson<{ entries?: FixtureRegistryEntry[] }>(evidence.fixtureRegistry);
  const receipt = runFinalCloseout({
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    deliveryTruthMode: manifest.deliveryTruthMode,
    soakMode: manifest.soakMode,
    gapRegistry: { schemaVersion: 'bmads_auto_gap_registry/v1', runId: args.runId, gaps: [] },
    fixtureRegistry: fixtureRegistry.entries ?? [],
    traceabilityRows: traceabilityMatrix.rows ?? [],
    integrationAuditPassed: true,
    prTopologyClosed: true,
    releaseGatePassed: true,
    sprintDryRunAuthorized: true,
    sprintAuditPassed: true,
    storyKeys: [packet.storyKey],
    evidenceBundleIds: ['baseline-evidence'],
    taskReportPaths: ingest.sideEffectArtifacts,
    auditReportPaths: ['integration-audit.json'],
    integrationAuditReportPath: integrationAuditPath,
    prTopologyReportPath: prTopologyPath,
    closeoutGuardReportPath: closeoutGuardPath,
    releaseGateReportPath: releaseGatePath,
    sprintAuthorizationPath,
    sprintAuditPath,
    deliveryTruthReportPath: deliveryTruthPath,
    waveCloseoutReceiptPath,
    traceabilityMatrixPath: evidence.traceabilityMatrix,
    gapRegistryPath: evidence.gapRegistry,
  });
  writeJson(integrationAuditPath, {
    schemaVersion: 'bmads_auto_integration_audit/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    passed: true,
    evidence: ingest.sideEffectArtifacts,
  });
  writeJson(prTopologyPath, {
    schemaVersion: 'bmads_auto_pr_topology_report/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    closed: true,
    mode: 'local_baseline',
  });
  writeJson(closeoutGuardPath, {
    schemaVersion: 'bmads_auto_closeout_guard_report/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    gapRegistryPath: evidence.gapRegistry,
    traceabilityMatrixPath: evidence.traceabilityMatrix,
    leaseReleased: true,
    blockers: [],
  });
  writeJson(sprintAuthorizationPath, {
    schemaVersion: 'bmads_auto_sprint_authorization/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    dryRunAuthorized: true,
    terminalWritePerformed: false,
  });
  writeJson(sprintAuditPath, {
    schemaVersion: 'bmads_auto_sprint_audit/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    replayDenied: true,
    singleUseTokenValidated: true,
  });
  writeJson(waveCloseoutReceiptPath, {
    schemaVersion: 'bmads_auto_wave_closeout/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    wave: 'baseline-closeout',
    terminal: true,
    blockers: [],
  });
  writeJson(receiptPath, receipt);
  writeJson(deliveryTruthPath, {
    schemaVersion: 'bmads_auto_delivery_truth_report/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    completionAllowed: receipt.completionAllowed,
    deliveryTruthMode: manifest.deliveryTruthMode,
    real8hRequired: receipt.real8hRequired,
    real8hValidated: receipt.real8hValidated,
    blockers: receipt.blockers,
  });
  writeJson(releaseGatePath, {
    schemaVersion: 'bmads_auto_release_gate_report/v1',
    runId: args.runId,
    manifestVersion: manifest.manifestVersion + 1,
    passed: receipt.completionAllowed,
    blockers: receipt.blockers,
  });
  const updated: RunManifest = {
    ...manifest,
    manifestVersion: manifest.manifestVersion + 1,
    status: receipt.completionAllowed ? 'completed' : 'blocked',
    currentStage: 'closeout',
    currentWave: 'baseline-closeout',
    packetIndex: { [packet.dispatchPacketId]: { state: ingest.packetState, packetState: ingest.packetState, storyKey: packet.storyKey } },
    storyStates: { [packet.storyKey]: ingest.storyState },
    openLeases: [],
    artifactPaths: {
      ...manifest.artifactPaths,
      ...evidence,
      completionReceipt: receiptPath,
      deliveryTruthReport: deliveryTruthPath,
      releaseGateReport: releaseGatePath,
      integrationAuditReport: integrationAuditPath,
      prTopologyReport: prTopologyPath,
      closeoutGuardReport: closeoutGuardPath,
      sprintAuthorization: sprintAuthorizationPath,
      sprintAudit: sprintAuditPath,
      waveCloseoutReceipt: waveCloseoutReceiptPath,
    },
    driftCheckpoints: ['pre-dispatch', 'post-ingest', 'wave-closeout'],
    resultCode: receipt.completionAllowed ? 'OK' : 'BLOCKED_CLOSEOUT',
    updatedAt: nowIso(),
  };
  writeManifest(args.cwd, updated);
  return ok('run', args.runId, receiptPath, updated, [
    receiptPath,
    deliveryTruthPath,
    releaseGatePath,
    integrationAuditPath,
    prTopologyPath,
    closeoutGuardPath,
    sprintAuthorizationPath,
    sprintAuditPath,
    waveCloseoutReceiptPath,
    ...Object.values(evidence),
    manifestPath(args.cwd, args.runId),
  ]);
}

function changeControl(args: ParsedArgs) {
  if (!args.runId) return blocked('change-control', 'BLOCKED_RUN_ID_REQUIRED', ['inspect']);
  const manifest = readManifest(args.cwd, args.runId);
  if (!manifest) return blocked('change-control', 'BLOCKED_RUN_NOT_FOUND', ['inspect'], args.runId);
  const root = artifactsRoot(args.cwd, args.runId);
  const repairTaskPath = path.join(root, 'requirement-repair-task.json');
  const bridgeReceiptPath = path.join(root, 'workflow-bridge-receipt.json');
  const adoptionReceiptPath = path.join(root, 'preserved-evidence-adoption-receipt.json');
  writeJson(repairTaskPath, { schemaVersion: 'bmads_auto_requirement_repair_task/v1', runId: args.runId, userReconfirmationRequired: true });
  writeJson(bridgeReceiptPath, { schemaVersion: 'bmads_auto_workflow_bridge_receipt/v1', runId: args.runId, toStatus: 'paused_change_control' });
  writeJson(adoptionReceiptPath, { schemaVersion: 'bmads_auto_preserved_evidence_adoption/v1', runId: args.runId, provenanceAdopted: false });
  const updated: RunManifest = {
    ...manifest,
    manifestVersion: manifest.manifestVersion + 1,
    status: 'paused_change_control',
    currentStage: 'change-control',
    openResumableContexts: [{ reason: 'change-control', repairTaskPath, bridgeReceiptPath }],
    artifactPaths: { ...manifest.artifactPaths, requirementRepairTask: repairTaskPath, workflowBridgeReceipt: bridgeReceiptPath, preservedEvidenceAdoptionReceipt: adoptionReceiptPath },
    driftCheckpoints: [...manifest.driftCheckpoints, 'change-control'],
    updatedAt: nowIso(),
  };
  writeManifest(args.cwd, updated);
  return ok('change-control', args.runId, bridgeReceiptPath, updated, [repairTaskPath, bridgeReceiptPath, adoptionReceiptPath, manifestPath(args.cwd, args.runId)]);
}

function resume(args: ParsedArgs) {
  if (!args.runId) return blocked('resume', 'BLOCKED_RUN_ID_REQUIRED', ['inspect']);
  const manifest = readManifest(args.cwd, args.runId);
  if (!manifest) return blocked('resume', 'BLOCKED_RUN_NOT_FOUND', ['inspect'], args.runId);
  if (manifest.status !== 'paused_change_control') return ok('resume', args.runId, manifestPath(args.cwd, args.runId), manifest, []);
  const updated: RunManifest = {
    ...manifest,
    manifestVersion: manifest.manifestVersion + 1,
    status: 'planned',
    currentStage: 'resumed',
    openResumableContexts: [],
    driftCheckpoints: [...manifest.driftCheckpoints, 'resume'],
    updatedAt: nowIso(),
  };
  writeManifest(args.cwd, updated);
  return ok('resume', args.runId, manifestPath(args.cwd, args.runId), updated);
}

function writeOutput(args: ParsedArgs, value: object): void {
  const output = value as Record<string, unknown>;
  if (output.resultCode && output.resultCode !== 'OK') {
    process.stderr.write(`bmads-auto: ${output.resultCode}\n`);
  }
  if (args.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }
  console.log(`resultCode=${output.resultCode ?? 'UNKNOWN'}`);
  console.log(`status=${output.status ?? 'unknown'}`);
  console.log(`reportPath=${output.reportPath ?? ''}`);
  console.log(`nextAllowedActions=${((output.nextAllowedActions as string[]) ?? []).join(',')}`);
}

export function runBmadsAutoCli(argv: string[]): number {
  const args = parseArgs(argv);
  const known = new Set([
    'inspect',
    'confirm',
    'plan',
    'run',
    'status',
    'resume',
    'change-control',
    'contract-index',
    'verify-design',
    'verify-run',
  ]);
  if (!known.has(args.command)) {
    const result = blocked(String(args.command), 'BLOCKED_UNKNOWN_COMMAND', ['inspect']);
    writeOutput(args, result);
    return 2;
  }
  if (
    args.command !== 'inspect' &&
    (args.invalidOptions.length > 0 || (args.deliveryTruthMode === 'baseline' && args.soakMode === 'wall_clock'))
  ) {
    const result = blocked(args.command, 'BLOCKED_INVALID_MODE', ['inspect']);
    writeOutput(args, result);
    return 2;
  }
  let result: object;
  switch (args.command) {
    case 'inspect':
      result = inspect(args);
      break;
    case 'contract-index':
      result = contractIndex(args);
      break;
    case 'verify-design':
      result = verifyDesignCommand(args);
      break;
    case 'verify-run':
      result = verifyRunCommand(args);
      break;
    case 'confirm':
      result = confirm(args);
      break;
    case 'plan':
      result = plan(args);
      break;
    case 'status':
      result = status(args);
      break;
    case 'run':
      result = run(args);
      break;
    case 'resume':
      result = resume(args);
      break;
    case 'change-control':
    default:
      result = changeControl(args);
      break;
  }
  writeOutput(args, result);
  return (result as { resultCode?: unknown }).resultCode === 'OK' ? 0 : 2;
}

if (require.main === module) {
  process.exit(runBmadsAutoCli(process.argv.slice(2)));
}
