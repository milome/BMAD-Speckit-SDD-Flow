/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ExecutionPacket,
  RecommendationPacket,
  ResumePacket,
  TaskReport,
} from './orchestration-dispatch-contract';
import { resolveBmadHelpRuntimePolicy } from './bmad-config';
import type { StageName } from './bmad-config';
import { loadPolicyContextFromRegistry } from './emit-runtime-policy';
import type { RuntimeFlowId } from './runtime-governance';
import { stableStringifyPolicy } from './stable-runtime-policy-json';

type Packet = ExecutionPacket | RecommendationPacket | ResumePacket;

export interface CodexWorkerAdapterReport {
  reportType: 'main_agent_codex_worker_adapter';
  generatedAt: string;
  projectRoot: string;
  packetPath: string;
  taskReportPath: string;
  mode: 'smoke' | 'codex_exec';
  codexCommand: string[];
  exitCode: number;
  scopePassed: boolean;
  taskReport: TaskReport;
  stdinPath: string | null;
  stdoutPath: string | null;
  stderrPath: string | null;
  agentRole: string;
  agentSpecPath: string | null;
  runtimeGovernanceStatus: 'resolved' | 'blocked';
  runtimeGovernanceError: string | null;
}

interface RuntimeGovernanceResolution {
  status: 'resolved' | 'blocked';
  content: string;
  error: string | null;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--smoke') {
      out.smoke = 'true';
    } else if (token.startsWith('--') && argv[index + 1]) {
      out[token.slice(2)] = argv[++index];
    }
  }
  return out;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function globToRegExp(glob: string): RegExp {
  const normalized = normalizePath(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`, 'u');
}

function pathMatchesScope(filePath: string, scopes: string[]): boolean {
  const normalized = normalizePath(filePath);
  return scopes.some((scope) => globToRegExp(scope).test(normalized));
}

function readPacket(packetPath: string): Packet {
  return JSON.parse(extractJsonObject(decodeTaskReportBuffer(fs.readFileSync(packetPath)))) as Packet;
}

function packetExpectedDelta(packet: Packet): string {
  return 'expectedDelta' in packet ? packet.expectedDelta : packet.expectedDelta;
}

function packetAllowedWriteScope(packet: Packet): string[] {
  return Array.isArray(packet.allowedWriteScope) ? packet.allowedWriteScope : [];
}

function packetRole(packet: Packet): string {
  return 'role' in packet && packet.role
    ? packet.role
    : 'recommendedRole' in packet && packet.recommendedRole
      ? packet.recommendedRole
      : 'general-purpose';
}

function safeAgentName(role: string): string {
  return role.replace(/\\/g, '/').replace(/\.toml$/u, '').replace(/^\/+/u, '');
}

function resolveCodexAgentSpec(projectRoot: string, role: string): { path: string; content: string } | null {
  const normalized = safeAgentName(role);
  const candidates = [
    path.join(projectRoot, '.codex', 'agents', `${normalized}.toml`),
    path.join(projectRoot, '.codex', 'agents', `${normalized.replace(/\//g, '__')}.toml`),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const root = path.resolve(projectRoot, '.codex', 'agents');
    if ((resolved === root || resolved.startsWith(`${root}${path.sep}`)) && fs.existsSync(resolved)) {
      return { path: resolved, content: fs.readFileSync(resolved, 'utf8') };
    }
  }
  return null;
}

function resolveRuntimeGovernanceBlock(projectRoot: string): RuntimeGovernanceResolution {
  try {
    const loaded = loadPolicyContextFromRegistry(projectRoot);
    const policy = resolveBmadHelpRuntimePolicy({
      flow: loaded.flow as RuntimeFlowId,
      stage: loaded.stage as StageName,
      projectRoot,
      runtimeContext: loaded.runtimeContext,
      runtimeContextPath: loaded.resolvedContextPath,
      ...(loaded.epicId ? { epicId: loaded.epicId } : {}),
      ...(loaded.storyId ? { storyId: loaded.storyId } : {}),
      ...(loaded.storySlug ? { storySlug: loaded.storySlug } : {}),
      ...(loaded.runId ? { runId: loaded.runId } : {}),
      ...(loaded.artifactRoot ? { artifactRoot: loaded.artifactRoot } : {}),
    });
    return {
      status: 'resolved',
      content: stableStringifyPolicy({
        flow: loaded.runtimeContext.flow,
        stage: loaded.runtimeContext.stage,
        runtimeContextPath: loaded.resolvedContextPath,
        ...policy,
      }),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'blocked',
      content: JSON.stringify(
        {
          failClosed: true,
          error: message,
        },
        null,
        2
      ),
      error: message,
    };
  }
}

function buildPrompt(input: {
  packet: Packet;
  packetPath: string;
  taskReportPath: string;
  smokeTargetPath: string | null;
  agentRole: string;
  agentSpec: { path: string; content: string } | null;
  runtimeGovernance: string;
}): string {
  const smokeLine = input.smokeTargetPath
    ? `For this bounded smoke run, write a small proof file at ${input.smokeTargetPath} and do not modify files outside allowedWriteScope.`
    : 'Perform the requested packet work without widening scope.';
  return [
    'You are the Codex no-hooks worker for BMAD-Speckit main-agent orchestration.',
    `Use BMAD Codex custom agent role: ${input.agentRole}`,
    '--- Runtime Governance JSON ---',
    input.runtimeGovernance,
    '--- End Runtime Governance JSON ---',
    input.agentSpec
      ? `Loaded Codex agent spec: ${input.agentSpec.path}`
      : 'No Codex agent spec loaded.',
    input.agentSpec
      ? ['--- Codex Agent TOML ---', input.agentSpec.content, '--- End Codex Agent TOML ---'].join('\n')
      : '',
    `Read dispatch packet: ${input.packetPath}`,
    `Packet ID: ${input.packet.packetId}`,
    `Allowed write scope: ${packetAllowedWriteScope(input.packet).join(', ') || '(none)'}`,
    `Expected delta: ${packetExpectedDelta(input.packet)}`,
    smokeLine,
    `When finished, write a JSON TaskReport to: ${input.taskReportPath}`,
    'TaskReport schema: { packetId, status, filesChanged, validationsRun, evidence, downstreamContext, driftFlags? }.',
    'If blocked, write status=blocked and explain evidence. Do not claim completion without writing the report.',
  ].join('\n');
}

function ensureWithinProject(projectRoot: string, targetPath: string): string {
  const resolved = path.resolve(projectRoot, targetPath);
  const root = path.resolve(projectRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes project root: ${targetPath}`);
  }
  return resolved;
}

function writeSmokeProof(projectRoot: string, relativePath: string, packet: Packet): void {
  const target = ensureWithinProject(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    [
      '# Codex Worker Smoke Proof',
      '',
      `packetId: ${packet.packetId}`,
      `expectedDelta: ${packetExpectedDelta(packet)}`,
      `generatedAt: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8'
  );
}

function readTaskReport(taskReportPath: string): TaskReport {
  const raw = fs.readFileSync(taskReportPath);
  const decoded = decodeTaskReportBuffer(raw);
  const parsed = JSON.parse(extractJsonObject(decoded)) as TaskReport;
  return normalizeTaskReport(parsed);
}

function decodeTaskReportBuffer(raw: Buffer): string {
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    return raw.subarray(2).toString('utf16le');
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    throw new Error('unsupported UTF-16BE TaskReport encoding');
  }
  return raw.toString('utf8').replace(/^\uFEFF/u, '');
}

function extractJsonObject(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');
  if (first < 0 || last <= first) {
    throw new Error('TaskReport does not contain a JSON object');
  }
  return value.slice(first, last + 1);
}

function normalizeTaskReport(report: TaskReport): TaskReport {
  const status = String(report.status);
  return {
    ...report,
    status:
      status === 'completed'
        ? 'done'
        : status === 'failed'
          ? 'blocked'
          : report.status,
    filesChanged: Array.isArray(report.filesChanged) ? report.filesChanged : [],
    validationsRun: Array.isArray(report.validationsRun) ? report.validationsRun : [],
    evidence: Array.isArray(report.evidence) ? report.evidence : [],
    downstreamContext: Array.isArray(report.downstreamContext) ? report.downstreamContext : [],
  };
}

function validateTaskReport(report: TaskReport, packet: Packet, scopes: string[]): string[] {
  const errors: string[] = [];
  if (report.packetId !== packet.packetId) {
    errors.push(`packetId mismatch: ${report.packetId}`);
  }
  if (!['done', 'blocked', 'partial'].includes(report.status)) {
    errors.push(`invalid status: ${String(report.status)}`);
  }
  for (const changed of report.filesChanged ?? []) {
    if (!pathMatchesScope(changed, scopes)) {
      errors.push(`file outside allowedWriteScope: ${changed}`);
    }
  }
  if (!Array.isArray(report.evidence) || report.evidence.length === 0) {
    errors.push('missing evidence');
  }
  return errors;
}

function writeTaskReport(taskReportPath: string, report: TaskReport): void {
  fs.mkdirSync(path.dirname(taskReportPath), { recursive: true });
  fs.writeFileSync(taskReportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

export function runCodexWorkerAdapter(input: {
  projectRoot: string;
  packetPath: string;
  taskReportPath?: string;
  smoke?: boolean;
  smokeTargetPath?: string;
  timeoutMs?: number;
  allowPolicyFailureForSmoke?: boolean;
  codexBinary?: string;
}): CodexWorkerAdapterReport {
  const projectRoot = path.resolve(input.projectRoot);
  const packetPath = path.resolve(input.packetPath);
  const packet = readPacket(packetPath);
  const scopes = packetAllowedWriteScope(packet);
  const agentRole = packetRole(packet);
  const agentSpec = resolveCodexAgentSpec(projectRoot, agentRole);
  const taskReportPath = path.resolve(
    input.taskReportPath ??
      path.join(
        projectRoot,
        '_bmad-output',
        'runtime',
        'codex',
        'task-reports',
        `${packet.packetId}.json`
      )
  );
  const smokeTargetPath = input.smokeTargetPath ?? `src/codex/${packet.packetId}.md`;
  if (!agentSpec) {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-agent-resolution'],
      evidence: [`missing codex agent spec for role=${agentRole}`],
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: ['codex-agent-spec-missing'],
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: input.smoke ? 'smoke' : 'codex_exec',
      codexCommand: input.smoke ? ['codex', 'worker-adapter-smoke'] : [],
      exitCode: 1,
      scopePassed: false,
      taskReport: blockedReport,
      stdinPath: null,
      stdoutPath: null,
      stderrPath: null,
      agentRole,
      agentSpecPath: null,
      runtimeGovernanceStatus: 'blocked',
      runtimeGovernanceError: 'codex agent spec missing',
    };
  }
  const runtimeGovernance = resolveRuntimeGovernanceBlock(projectRoot);
  if (runtimeGovernance.status === 'blocked' && !(input.smoke && input.allowPolicyFailureForSmoke)) {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-runtime-governance'],
      evidence: [`runtime governance blocked: ${runtimeGovernance.error}`],
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: ['codex-runtime-governance-blocked'],
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: input.smoke ? 'smoke' : 'codex_exec',
      codexCommand: input.smoke ? ['codex', 'worker-adapter-smoke'] : [],
      exitCode: 1,
      scopePassed: false,
      taskReport: blockedReport,
      stdinPath: null,
      stdoutPath: null,
      stderrPath: null,
      agentRole,
      agentSpecPath: agentSpec.path,
      runtimeGovernanceStatus: runtimeGovernance.status,
      runtimeGovernanceError: runtimeGovernance.error,
    };
  }
  const prompt = buildPrompt({
    packet,
    packetPath,
    taskReportPath,
    smokeTargetPath: input.smoke ? smokeTargetPath : null,
    agentRole,
    agentSpec,
    runtimeGovernance: runtimeGovernance.content,
  });

  let exitCode = 0;
  let stdinPath: string | null = null;
  let stdoutPath: string | null = null;
  let stderrPath: string | null = null;
  const codexCommand = input.smoke
    ? ['codex', 'worker-adapter-smoke']
    : [
        input.codexBinary ?? process.env.CODEX_WORKER_ADAPTER_BIN ?? 'codex',
        '-a',
        'never',
        'exec',
        '--cd',
        projectRoot,
        '--sandbox',
        'workspace-write',
        '-',
      ];

  if (input.smoke) {
    writeSmokeProof(projectRoot, smokeTargetPath, packet);
    writeTaskReport(taskReportPath, {
      packetId: packet.packetId,
      status: 'done',
      filesChanged: [smokeTargetPath],
      validationsRun: ['codex-worker-adapter-smoke'],
      evidence: [`codex-smoke:${smokeTargetPath}`],
      downstreamContext: [packetExpectedDelta(packet)],
    });
  } else {
    const outDir = path.join(projectRoot, '_bmad-output', 'runtime', 'codex', 'logs');
    fs.mkdirSync(outDir, { recursive: true });
    stdinPath = path.join(outDir, `${packet.packetId}.stdin.prompt.txt`);
    fs.writeFileSync(stdinPath, prompt, 'utf8');
    const result = spawnSync(codexCommand[0], codexCommand.slice(1), {
      cwd: projectRoot,
      input: prompt,
      encoding: 'utf8',
      timeout: input.timeoutMs ?? 120_000,
      shell: process.platform === 'win32',
    });
    exitCode = result.status ?? (result.error ? 1 : 0);
    stdoutPath = path.join(outDir, `${packet.packetId}.stdout.log`);
    stderrPath = path.join(outDir, `${packet.packetId}.stderr.log`);
    fs.writeFileSync(stdoutPath, result.stdout ?? '', 'utf8');
    fs.writeFileSync(stderrPath, result.stderr ?? result.error?.message ?? '', 'utf8');
  }

  const taskReport = fs.existsSync(taskReportPath)
    ? readTaskReport(taskReportPath)
    : {
        packetId: packet.packetId,
        status: 'blocked',
        filesChanged: [],
        validationsRun: ['codex-worker-adapter'],
        evidence: ['codex did not produce task report'],
        downstreamContext: [packetExpectedDelta(packet)],
      };
  if (!fs.existsSync(taskReportPath)) {
    writeTaskReport(taskReportPath, taskReport);
  } else {
    writeTaskReport(taskReportPath, taskReport);
  }
  const validationErrors = validateTaskReport(taskReport, packet, scopes);
  const scopePassed = validationErrors.length === 0;
  if (!scopePassed && taskReport.status === 'done') {
    taskReport.status = 'blocked';
    taskReport.evidence = [...taskReport.evidence, ...validationErrors];
    writeTaskReport(taskReportPath, taskReport);
  }

  return {
    reportType: 'main_agent_codex_worker_adapter',
    generatedAt: new Date().toISOString(),
    projectRoot,
    packetPath,
    taskReportPath,
    mode: input.smoke ? 'smoke' : 'codex_exec',
    codexCommand,
    exitCode,
    scopePassed,
    taskReport,
    stdinPath,
    stdoutPath,
    stderrPath,
    agentRole,
    agentSpecPath: agentSpec.path,
    runtimeGovernanceStatus: runtimeGovernance.status,
    runtimeGovernanceError: runtimeGovernance.error,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (!args.packetPath) {
    console.error('main-agent-codex-worker-adapter: --packetPath is required');
    return 1;
  }
  const report = runCodexWorkerAdapter({
    projectRoot: path.resolve(args.cwd ?? process.cwd()),
    packetPath: path.resolve(args.packetPath),
    taskReportPath: args.taskReportPath ? path.resolve(args.taskReportPath) : undefined,
    smoke: args.smoke === 'true',
    smokeTargetPath: args.smokeTargetPath,
    timeoutMs: Number(args.timeoutMs) > 0 ? Number(args.timeoutMs) : undefined,
    codexBinary: args.codexBinary,
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(report.projectRoot, '_bmad-output', 'runtime', 'codex', 'worker-adapter-report.json')
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  return report.exitCode === 0 && report.scopePassed && report.taskReport.status === 'done'
    ? 0
    : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
