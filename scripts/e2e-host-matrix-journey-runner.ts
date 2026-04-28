import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as yaml from 'js-yaml';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';
import { defaultRuntimeContextFile, writeRuntimeContext } from './runtime-context';
import { buildMainAgentDispatchInstruction } from './main-agent-orchestration';
import { runCodexWorkerAdapter } from './main-agent-codex-worker-adapter';
import { buildEvidenceProvenance, type EvidenceProvenance } from './evidence-provenance';

type HostId = 'cursor' | 'claude' | 'codex';
type JourneyMode = 'mock' | 'real';

interface RunnerArgs {
  projectRoot: string;
  mode: JourneyMode;
  hosts: HostId[];
  writeSprintStatus: boolean;
  storyKey?: string;
  reportPath?: string;
  runId?: string;
  evidenceBundleId?: string;
}

interface GateCheck {
  id: string;
  passed: boolean;
  detail: string;
}

interface HostJourneyResult {
  host: HostId;
  passed: boolean;
  transportCheck: {
    command: string[];
    exitCode: number;
    stdout: string;
    stderr: string;
  };
  inspectCheck: {
    command: string[];
    exitCode: number;
    stdout: string;
    stderr: string;
    parsed: boolean;
  };
  workerSmoke?: {
    attempted: boolean;
    passed: boolean;
    taskReportPath: string | null;
    detail: string;
  };
}

interface RunnerReport {
  generatedAt: string;
  evidence_provenance: EvidenceProvenance;
  projectRoot: string;
  mode: JourneyMode;
  hosts: HostId[];
  preflight: {
    passed: boolean;
    checks: GateCheck[];
  };
  journeys: HostJourneyResult[];
  sprintStatusUpdate: {
    attempted: boolean;
    applied: boolean;
    storyKey: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    reason: string;
  };
  postflight: {
    passed: boolean;
    checks: GateCheck[];
  };
  finalPassed: boolean;
}

const DEFAULT_REPORT_RELATIVE_PATH = path.join(
  '_bmad-output',
  'runtime',
  'e2e',
  'host-matrix-journey-report.json'
);

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim();
}

function parseHosts(raw: string): HostId[] {
  const items = raw
    .split(',')
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);
  const valid = new Set<HostId>(['cursor', 'claude', 'codex']);
  const deduped = Array.from(new Set(items)).filter((item): item is HostId =>
    valid.has(item as HostId)
  );
  return deduped.length > 0 ? deduped : ['cursor', 'claude', 'codex'];
}

function parseArgs(argv: string[]): RunnerArgs {
  const out: Partial<RunnerArgs> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--project-root' && argv[index + 1]) {
      out.projectRoot = path.resolve(argv[++index]);
    } else if (token === '--mode' && argv[index + 1]) {
      const value = normalizeText(argv[++index]).toLowerCase();
      out.mode = value === 'real' ? 'real' : 'mock';
    } else if (token === '--hosts' && argv[index + 1]) {
      out.hosts = parseHosts(argv[++index]);
    } else if (token === '--write-sprint-status') {
      out.writeSprintStatus = true;
    } else if (token === '--story-key' && argv[index + 1]) {
      out.storyKey = normalizeText(argv[++index]);
    } else if (token === '--report-path' && argv[index + 1]) {
      out.reportPath = path.resolve(argv[++index]);
    } else if (token === '--runId' && argv[index + 1]) {
      out.runId = normalizeText(argv[++index]);
    } else if (token === '--evidenceBundleId' && argv[index + 1]) {
      out.evidenceBundleId = normalizeText(argv[++index]);
    }
  }

  return {
    projectRoot: out.projectRoot ?? process.cwd(),
    mode: out.mode ?? 'mock',
    hosts: out.hosts ?? ['cursor', 'claude', 'codex'],
    writeSprintStatus: out.writeSprintStatus ?? false,
    storyKey: out.storyKey,
    reportPath: out.reportPath,
    runId: out.runId,
    evidenceBundleId: out.evidenceBundleId,
  };
}

function ensureRuntimeBootstrap(projectRoot: string): void {
  const runtimeContextPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'context',
    'project.json'
  );
  const registryPath = path.join(projectRoot, '_bmad-output', 'runtime', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    writeRuntimeContextRegistry(projectRoot, defaultRuntimeContextRegistry(projectRoot));
  }
  if (!fs.existsSync(runtimeContextPath)) {
    writeRuntimeContext(
      projectRoot,
      defaultRuntimeContextFile({
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        contextScope: 'project',
      })
    );
  }
}

function materializeCodexAgents(projectRoot: string): void {
  const sourceRoot = path.resolve(__dirname, '..', '_bmad', 'codex', 'agents');
  const targetRoot = path.join(projectRoot, '.codex', 'agents');
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Codex agent source missing: ${sourceRoot}`);
  }
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.cpSync(sourceRoot, targetRoot, { recursive: true });
}

function loadYamlObject(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`YAML object expected: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

function runContractPreflight(projectRoot: string): { passed: boolean; checks: GateCheck[] } {
  const contractPath = path.join(
    projectRoot,
    '_bmad',
    '_config',
    'orchestration-governance.contract.yaml'
  );
  const sprintStatusPath = path.join(
    projectRoot,
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  );

  const checks: GateCheck[] = [];

  checks.push({
    id: 'contract.exists',
    passed: fs.existsSync(contractPath),
    detail: contractPath,
  });
  checks.push({
    id: 'sprint_status.exists',
    passed: fs.existsSync(sprintStatusPath),
    detail: sprintStatusPath,
  });

  if (fs.existsSync(contractPath)) {
    const contract = loadYamlObject(contractPath);
    const requiredKeys = ['signals', 'stage_requirements', 'mapping_contract'];
    for (const key of requiredKeys) {
      checks.push({
        id: `contract.key.${key}`,
        passed: Object.prototype.hasOwnProperty.call(contract, key),
        detail: `required key: ${key}`,
      });
    }

    const stages = contract.stage_requirements;
    const hasImplementStage =
      !!stages &&
      typeof stages === 'object' &&
      Object.prototype.hasOwnProperty.call(stages as Record<string, unknown>, 'implement');
    checks.push({
      id: 'contract.stage_requirements.implement',
      passed: hasImplementStage,
      detail: 'implement stage must be declared',
    });
  }

  if (fs.existsSync(sprintStatusPath)) {
    const sprintStatus = loadYamlObject(sprintStatusPath);
    const developmentStatus = sprintStatus.development_status;
    const hasMap =
      !!developmentStatus &&
      typeof developmentStatus === 'object' &&
      Object.keys(developmentStatus as Record<string, unknown>).length > 0;
    checks.push({
      id: 'sprint_status.development_status.non_empty',
      passed: hasMap,
      detail: 'development_status must contain at least one epic/story key',
    });
  }

  return {
    passed: checks.every((item) => item.passed),
    checks,
  };
}

function spawnCommand(command: string, args: string[], cwd: string, shell = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell,
  });
  return {
    exitCode: result.status ?? (result.error ? 1 : 0),
    stdout: normalizeText(result.stdout ?? ''),
    stderr: normalizeText(result.stderr ?? result.error?.message ?? ''),
  };
}

function runHostTransportCheck(mode: JourneyMode, host: HostId, projectRoot: string) {
  if (mode === 'mock') {
    const js = `console.log(JSON.stringify({host: process.argv[1], mode: "mock", ok: true}))`;
    return {
      command: [process.execPath, '-e', js, host],
      ...spawnCommand(process.execPath, ['-e', js, host], projectRoot),
    };
  }

  const hostBinary = host === 'claude' ? 'claude' : host === 'codex' ? 'codex' : 'cursor';
  const command = hostBinary;
  return {
    command: [command, '--version'],
    ...spawnCommand(command, ['--version'], projectRoot, process.platform === 'win32'),
  };
}

function runInspectCheck(projectRoot: string) {
  const tsNodeBin = require.resolve('ts-node/dist/bin.js');
  const args = [
    tsNodeBin,
    '--project',
    path.join(process.cwd(), 'tsconfig.node.json'),
    '--transpile-only',
    path.join(process.cwd(), 'scripts', 'main-agent-orchestration.ts'),
    '--cwd',
    projectRoot,
    '--action',
    'inspect',
  ];
  const result = spawnCommand(process.execPath, args, process.cwd());
  let parsed = false;
  if (result.exitCode === 0 && result.stdout) {
    try {
      const parsedOutput = JSON.parse(result.stdout) as Record<string, unknown>;
      parsed = typeof parsedOutput === 'object' && parsedOutput !== null;
    } catch {
      parsed = false;
    }
  }
  return {
    command: [process.execPath, ...args],
    ...result,
    parsed,
  };
}

function runHostJourney(projectRoot: string, mode: JourneyMode, host: HostId): HostJourneyResult {
  const transportCheck = runHostTransportCheck(mode, host, projectRoot);
  const inspectCheck = runInspectCheck(projectRoot);
  let workerSmoke: HostJourneyResult['workerSmoke'];
  if (mode === 'real' && host === 'codex' && transportCheck.exitCode === 0 && inspectCheck.parsed) {
    const smokeRoot = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'host-matrix-codex-smoke',
      `${Date.now()}-${process.pid}`
    );
    fs.mkdirSync(smokeRoot, { recursive: true });
    materializeCodexAgents(smokeRoot);
    writeRuntimeContextRegistry(smokeRoot, defaultRuntimeContextRegistry(smokeRoot));
    writeRuntimeContext(
      smokeRoot,
      defaultRuntimeContextFile({
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        contextScope: 'story',
        storyId: 'host-matrix-codex-smoke',
        runId: 'host-matrix-codex-smoke',
      })
    );
    const instruction = buildMainAgentDispatchInstruction({
      projectRoot: smokeRoot,
      flow: 'story',
      stage: 'implement',
      host: 'codex',
      hydratePacket: true,
    });
    if (instruction) {
      const taskReportPath = path.join(
        smokeRoot,
        '_bmad-output',
        'runtime',
        'codex',
        'host-matrix-smoke',
        `${instruction.packetId}.json`
      );
      const smoke = runCodexWorkerAdapter({
        projectRoot: smokeRoot,
        packetPath: instruction.packetPath,
        taskReportPath,
        smoke: true,
        smokeTargetPath: `src/codex/${instruction.packetId}.md`,
      });
      workerSmoke = {
        attempted: true,
        passed: smoke.exitCode === 0 && smoke.scopePassed && smoke.taskReport.status === 'done',
        taskReportPath,
        detail: `codex worker adapter smoke ${smoke.taskReport.status}`,
      };
    } else {
      workerSmoke = {
        attempted: true,
        passed: false,
        taskReportPath: null,
        detail: 'no dispatch instruction available for codex worker smoke',
      };
    }
  }
  const smokePassed = workerSmoke ? workerSmoke.passed : true;
  return {
    host,
    passed:
      transportCheck.exitCode === 0 && inspectCheck.exitCode === 0 && inspectCheck.parsed && smokePassed,
    transportCheck,
    inspectCheck,
    ...(workerSmoke ? { workerSmoke } : {}),
  };
}

function loadSprintStatusMap(sprintStatusPath: string): Record<string, string> {
  const doc = loadYamlObject(sprintStatusPath) as {
    development_status?: Record<string, string>;
  };
  const map = doc.development_status ?? {};
  return { ...map };
}

function chooseStoryKey(statusMap: Record<string, string>, preferred?: string): string | null {
  if (preferred && statusMap[preferred]) {
    return preferred;
  }
  const candidates = Object.keys(statusMap).filter((key) => !key.startsWith('epic-'));
  return candidates.length > 0 ? candidates[0] : null;
}

function nextStoryStatus(current: string): string {
  const normalized = current.toLowerCase();
  if (normalized === 'backlog' || normalized === 'ready-for-dev') return 'in-progress';
  if (normalized === 'in-progress') return 'review';
  if (normalized === 'review') return 'done';
  return current;
}

function applySprintStatusUpdate(
  projectRoot: string,
  preferredStoryKey: string | undefined,
  gatePassed: boolean
): RunnerReport['sprintStatusUpdate'] {
  const sprintStatusPath = path.join(
    projectRoot,
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  );

  if (!gatePassed) {
    return {
      attempted: true,
      applied: false,
      storyKey: null,
      fromStatus: null,
      toStatus: null,
      reason: 'pre-update contract gate failed',
    };
  }

  const raw = fs.readFileSync(sprintStatusPath, 'utf8');
  const doc = (yaml.load(raw) ?? {}) as {
    development_status?: Record<string, string>;
    [key: string]: unknown;
  };
  const developmentStatus = { ...(doc.development_status ?? {}) };
  const storyKey = chooseStoryKey(developmentStatus, preferredStoryKey);
  if (!storyKey) {
    return {
      attempted: true,
      applied: false,
      storyKey: null,
      fromStatus: null,
      toStatus: null,
      reason: 'no story key available in sprint-status',
    };
  }

  const fromStatus = developmentStatus[storyKey];
  const toStatus = nextStoryStatus(fromStatus);
  if (toStatus === fromStatus) {
    return {
      attempted: true,
      applied: false,
      storyKey,
      fromStatus,
      toStatus,
      reason: 'status unchanged, treated as non-progress',
    };
  }

  developmentStatus[storyKey] = toStatus;
  doc.development_status = developmentStatus;
  fs.writeFileSync(sprintStatusPath, yaml.dump(doc, { lineWidth: 120 }), 'utf8');

  return {
    attempted: true,
    applied: true,
    storyKey,
    fromStatus,
    toStatus,
    reason: 'updated after contract gate and host journey pass',
  };
}

function runPostflightChecks(
  projectRoot: string,
  update: RunnerReport['sprintStatusUpdate']
): { passed: boolean; checks: GateCheck[] } {
  const checks: GateCheck[] = [];
  const sprintStatusPath = path.join(
    projectRoot,
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  );
  const exists = fs.existsSync(sprintStatusPath);
  const statusMap = exists ? loadSprintStatusMap(sprintStatusPath) : {};

  checks.push({
    id: 'postflight.sprint_status.exists',
    passed: exists,
    detail: sprintStatusPath,
  });

  if (update.attempted && update.applied && update.storyKey) {
    checks.push({
      id: 'postflight.story_status.persisted',
      passed: statusMap[update.storyKey] === update.toStatus,
      detail: `${update.storyKey}: expected ${update.toStatus}, got ${statusMap[update.storyKey] ?? 'missing'}`,
    });
  }

  return {
    passed: checks.every((item) => item.passed),
    checks,
  };
}

function writeReport(projectRoot: string, report: RunnerReport, reportPath?: string): string {
  const target = reportPath
    ? path.resolve(reportPath)
    : path.join(projectRoot, DEFAULT_REPORT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return target;
}

export function runHostMatrixJourneyRunner(argv: string[]): number {
  const args = parseArgs(argv);
  ensureRuntimeBootstrap(args.projectRoot);

  const preflight = runContractPreflight(args.projectRoot);
  const journeys = args.hosts.map((host) => runHostJourney(args.projectRoot, args.mode, host));
  const allJourneysPassed = journeys.every((item) => item.passed);

  const sprintStatusUpdate = args.writeSprintStatus
    ? applySprintStatusUpdate(
        args.projectRoot,
        args.storyKey,
        preflight.passed && allJourneysPassed
      )
    : {
        attempted: false,
        applied: false,
        storyKey: null,
        fromStatus: null,
        toStatus: null,
        reason: 'disabled (pass --write-sprint-status to enable)',
      };

  const postflight = runPostflightChecks(args.projectRoot, sprintStatusUpdate);
  const finalPassed = preflight.passed && allJourneysPassed && postflight.passed;

  const report: RunnerReport = {
    generatedAt: new Date().toISOString(),
    evidence_provenance: buildEvidenceProvenance({
      root: args.projectRoot,
      runId: args.runId,
      storyKey: args.storyKey ?? sprintStatusUpdate.storyKey ?? 'S-release-gate',
      evidenceBundleId: args.evidenceBundleId,
      prefix: 'host-matrix-journey',
    }),
    projectRoot: args.projectRoot,
    mode: args.mode,
    hosts: args.hosts,
    preflight,
    journeys,
    sprintStatusUpdate,
    postflight,
    finalPassed,
  };
  const reportFile = writeReport(args.projectRoot, report, args.reportPath);
  process.stdout.write(`${JSON.stringify({ reportFile, finalPassed }, null, 2)}\n`);
  return finalPassed ? 0 : 1;
}

if (require.main === module) {
  process.exit(runHostMatrixJourneyRunner(process.argv.slice(2)));
}

