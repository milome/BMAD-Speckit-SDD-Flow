/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  actualFilesChanged: string[];
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
  return JSON.parse(readStrictUtf8JsonText(packetPath, { allowUtf8Bom: true })) as Packet;
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
  return role
    .replace(/\\/g, '/')
    .replace(/\.toml$/u, '')
    .replace(/^\/+/u, '');
}

function resolveCodexAgentSpec(
  projectRoot: string,
  role: string
): { path: string; content: string } | null {
  const normalized = safeAgentName(role);
  const candidates = [
    path.join(projectRoot, '.codex', 'agents', `${normalized}.toml`),
    path.join(projectRoot, '.codex', 'agents', `${normalized.replace(/\//g, '__')}.toml`),
    path.join(projectRoot, '_bmad', 'codex', 'agents', `${normalized}.toml`),
    path.join(projectRoot, '_bmad', 'codex', 'agents', `${normalized.replace(/\//g, '__')}.toml`),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const roots = [
      path.resolve(projectRoot, '.codex', 'agents'),
      path.resolve(projectRoot, '_bmad', 'codex', 'agents'),
    ];
    if (
      roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)) &&
      fs.existsSync(resolved)
    ) {
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
  codexWritableTaskReportPath: string;
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
      ? ['--- Codex Agent TOML ---', input.agentSpec.content, '--- End Codex Agent TOML ---'].join(
          '\n'
        )
      : '',
    `Read dispatch packet: ${input.packetPath}`,
    `Packet ID: ${input.packet.packetId}`,
    `Allowed write scope: ${packetAllowedWriteScope(input.packet).join(', ') || '(none)'}`,
    `Expected delta: ${packetExpectedDelta(input.packet)}`,
    smokeLine,
    `When finished, write a JSON TaskReport to: ${input.codexWritableTaskReportPath}`,
    input.codexWritableTaskReportPath === input.taskReportPath
      ? ''
      : `The BMAD evidence path is ${input.taskReportPath}; the adapter will copy your report there after Codex exits.`,
    'TaskReport schema: { packetId, status, filesChanged, validationsRun, evidence, downstreamContext, driftFlags? }.',
    'The TaskReport file must be UTF-8 without BOM and strict JSON only. Do not wrap it in Markdown.',
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
  const parsed = JSON.parse(
    readStrictUtf8JsonText(taskReportPath, { allowUtf8Bom: false })
  ) as TaskReport;
  return normalizeTaskReport(parsed);
}

function readStrictUtf8JsonText(filePath: string, options: { allowUtf8Bom: boolean }): string {
  const raw = fs.readFileSync(filePath);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    throw new Error(`strict JSON must be UTF-8 no BOM: ${filePath}`);
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    throw new Error(`strict JSON must be UTF-8 no BOM: ${filePath}`);
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    if (!options.allowUtf8Bom) {
      throw new Error(`strict JSON must be UTF-8 no BOM: ${filePath}`);
    }
    return raw.subarray(3).toString('utf8');
  }
  return raw.toString('utf8');
}

function normalizeTaskReport(report: TaskReport): TaskReport {
  const status = String(report.status);
  return {
    ...report,
    status: status === 'completed' ? 'done' : status === 'failed' ? 'blocked' : report.status,
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

function listGitVisibleFiles(projectRoot: string): string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: projectRoot,
      encoding: 'buffer',
      shell: process.platform === 'win32',
    }
  );
  if ((result.status ?? 1) !== 0) {
    return [];
  }
  return result.stdout
    .toString('utf8')
    .split('\0')
    .map((file) => normalizePath(file.trim()))
    .filter(Boolean);
}

function listFilesystemVisibleFiles(projectRoot: string): string[] {
  const out: string[] = [];
  const ignored = new Set(['.git', 'node_modules']);
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        out.push(normalizePath(path.relative(projectRoot, absolute)));
      }
    }
  };
  walk(projectRoot);
  return out.sort();
}

function snapshotGitVisibleFiles(projectRoot: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  const files = listGitVisibleFiles(projectRoot);
  for (const file of files.length > 0 ? files : listFilesystemVisibleFiles(projectRoot)) {
    const absolute = path.join(projectRoot, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const digest = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    snapshot.set(file, digest);
  }
  return snapshot;
}

function diffFileSnapshots(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed = new Set<string>();
  for (const [file, digest] of after.entries()) {
    if (before.get(file) !== digest) {
      changed.add(file);
    }
  }
  for (const file of before.keys()) {
    if (!after.has(file)) {
      changed.add(file);
    }
  }
  return [...changed].sort();
}

function isAdapterOwnedPath(
  projectRoot: string,
  candidate: string,
  ownedPaths: Array<string | null>
): boolean {
  const normalized = normalizePath(candidate);
  return ownedPaths.some((owned) => {
    if (!owned) return false;
    return normalizePath(path.relative(projectRoot, owned)) === normalized;
  });
}

function writeTaskReport(taskReportPath: string, report: TaskReport): void {
  fs.mkdirSync(path.dirname(taskReportPath), { recursive: true });
  fs.writeFileSync(taskReportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

function resolveCodexWritableTaskReportPath(projectRoot: string, taskReportPath: string): string {
  const root = path.resolve(projectRoot);
  const requested = path.resolve(taskReportPath);
  if (requested === root || requested.startsWith(`${root}${path.sep}`)) {
    return requested;
  }
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'codex',
    'task-reports',
    path.basename(path.dirname(requested)),
    path.basename(requested)
  );
}

function copyTaskReportIfNeeded(sourcePath: string, targetPath: string): void {
  if (path.resolve(sourcePath) === path.resolve(targetPath) || !fs.existsSync(sourcePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
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
  const codexWritableTaskReportPath = resolveCodexWritableTaskReportPath(
    projectRoot,
    taskReportPath
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
      actualFilesChanged: [],
    };
  }
  const runtimeGovernance = resolveRuntimeGovernanceBlock(projectRoot);
  if (
    runtimeGovernance.status === 'blocked' &&
    !(input.smoke && input.allowPolicyFailureForSmoke)
  ) {
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
      actualFilesChanged: [],
    };
  }
  const prompt = buildPrompt({
    packet,
    packetPath,
    taskReportPath,
    codexWritableTaskReportPath,
    smokeTargetPath: input.smoke ? smokeTargetPath : null,
    agentRole,
    agentSpec,
    runtimeGovernance: runtimeGovernance.content,
  });

  let exitCode = 0;
  let stdinPath: string | null = null;
  let stdoutPath: string | null = null;
  let stderrPath: string | null = null;
  const allowCodexBinaryOverride = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE === 'true';
  if (
    !input.smoke &&
    (input.codexBinary || process.env.CODEX_WORKER_ADAPTER_BIN) &&
    !allowCodexBinaryOverride
  ) {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-binary-override-denied'],
      evidence: ['Codex binary override requires MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE=true'],
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: ['codex-binary-override-denied'],
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: 'codex_exec',
      codexCommand: [],
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
      actualFilesChanged: [],
    };
  }
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

  const beforeFileSnapshot = snapshotGitVisibleFiles(projectRoot);

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

  copyTaskReportIfNeeded(codexWritableTaskReportPath, taskReportPath);
  let taskReportStrictJsonError: string | null = null;
  const taskReport = fs.existsSync(taskReportPath)
    ? (() => {
        try {
          return readTaskReport(taskReportPath);
        } catch (error) {
          taskReportStrictJsonError = error instanceof Error ? error.message : String(error);
          return {
            packetId: packet.packetId,
            status: 'blocked',
            filesChanged: [],
            validationsRun: ['codex-worker-adapter-strict-task-report'],
            evidence: [`TaskReport strict JSON validation failed: ${taskReportStrictJsonError}`],
            downstreamContext: [packetExpectedDelta(packet)],
            driftFlags: ['codex-task-report-strict-json-invalid'],
          } satisfies TaskReport;
        }
      })()
    : {
        packetId: packet.packetId,
        status: 'blocked',
        filesChanged: [],
        validationsRun: ['codex-worker-adapter'],
        evidence: ['codex did not produce task report'],
        downstreamContext: [packetExpectedDelta(packet)],
      };
  const actualFilesChanged = diffFileSnapshots(
    beforeFileSnapshot,
    snapshotGitVisibleFiles(projectRoot)
  ).filter(
    (file) =>
      !isAdapterOwnedPath(projectRoot, file, [
        taskReportPath,
        codexWritableTaskReportPath,
        stdinPath,
        stdoutPath,
        stderrPath,
      ])
  );
  if (!fs.existsSync(taskReportPath)) {
    writeTaskReport(taskReportPath, taskReport);
  } else {
    writeTaskReport(taskReportPath, taskReport);
  }
  const validationErrors = [
    ...(taskReportStrictJsonError
      ? [`TaskReport strict JSON validation failed: ${taskReportStrictJsonError}`]
      : []),
    ...validateTaskReport(taskReport, packet, scopes),
    ...actualFilesChanged
      .filter((changed) => !pathMatchesScope(changed, scopes))
      .map((changed) => `actual file outside allowedWriteScope: ${changed}`),
  ];
  const scopePassed = validationErrors.length === 0;
  if (!scopePassed && taskReport.status === 'done') {
    taskReport.status = 'blocked';
    taskReport.evidence = [...taskReport.evidence, ...validationErrors];
    writeTaskReport(taskReportPath, taskReport);
  }
  if (!scopePassed && taskReport.status !== 'done') {
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
    actualFilesChanged,
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
      path.join(
        report.projectRoot,
        '_bmad-output',
        'runtime',
        'codex',
        'worker-adapter-report.json'
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  return report.exitCode === 0 && report.scopePassed && report.taskReport.status === 'done' ? 0 : 1;
}

function isDirectMainAgentCodexWorkerAdapterCli(entry: string | undefined): boolean {
  return /(^|[\\/])main-agent-codex-worker-adapter(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

if (require.main === module && isDirectMainAgentCodexWorkerAdapterCli(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
