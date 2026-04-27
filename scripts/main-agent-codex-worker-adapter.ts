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
  stdoutPath: string | null;
  stderrPath: string | null;
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
  return JSON.parse(fs.readFileSync(packetPath, 'utf8')) as Packet;
}

function packetExpectedDelta(packet: Packet): string {
  return 'expectedDelta' in packet ? packet.expectedDelta : packet.expectedDelta;
}

function packetAllowedWriteScope(packet: Packet): string[] {
  return Array.isArray(packet.allowedWriteScope) ? packet.allowedWriteScope : [];
}

function buildPrompt(input: {
  packet: Packet;
  packetPath: string;
  taskReportPath: string;
  smokeTargetPath: string | null;
}): string {
  const smokeLine = input.smokeTargetPath
    ? `For this bounded smoke run, write a small proof file at ${input.smokeTargetPath} and do not modify files outside allowedWriteScope.`
    : 'Perform the requested packet work without widening scope.';
  return [
    'You are the Codex no-hooks worker for BMAD-Speckit main-agent orchestration.',
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
  return JSON.parse(fs.readFileSync(taskReportPath, 'utf8')) as TaskReport;
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
}): CodexWorkerAdapterReport {
  const projectRoot = path.resolve(input.projectRoot);
  const packetPath = path.resolve(input.packetPath);
  const packet = readPacket(packetPath);
  const scopes = packetAllowedWriteScope(packet);
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
  const prompt = buildPrompt({
    packet,
    packetPath,
    taskReportPath,
    smokeTargetPath: input.smoke ? smokeTargetPath : null,
  });

  let exitCode = 0;
  let stdoutPath: string | null = null;
  let stderrPath: string | null = null;
  const codexCommand = input.smoke
    ? ['codex', 'worker-adapter-smoke']
    : [
        'codex',
        'exec',
        '--cd',
        projectRoot,
        '--sandbox',
        'workspace-write',
        '--ask-for-approval',
        'never',
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
    const result = spawnSync(codexCommand[0], codexCommand.slice(1), {
      cwd: projectRoot,
      input: prompt,
      encoding: 'utf8',
      timeout: input.timeoutMs ?? 120_000,
      shell: process.platform === 'win32',
    });
    exitCode = result.status ?? (result.error ? 1 : 0);
    const outDir = path.join(projectRoot, '_bmad-output', 'runtime', 'codex', 'logs');
    fs.mkdirSync(outDir, { recursive: true });
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
    stdoutPath,
    stderrPath,
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
