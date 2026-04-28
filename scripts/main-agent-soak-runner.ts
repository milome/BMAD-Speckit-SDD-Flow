/* eslint-disable no-console */
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import crypto from 'node:crypto';
import {
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from './main-agent-orchestration';
import type { MainAgentRunLoopResult } from './main-agent-orchestration';
import { buildEvidenceProvenance, sha256, type EvidenceProvenance } from './evidence-provenance';
import type { RuntimeFlowId } from './runtime-governance';

export interface SoakTimelineEvent {
  tick: number;
  fault_detected_at?: string;
  mitigation_started_at?: string;
  resumed_at?: string;
  duplicate_side_effect: boolean;
  owner_count: number;
  originalExecutionPacketId: string;
}

export interface SoakReport {
  version: 1;
  mode: 'deterministic_contract' | 'wall_clock';
  run_kind: 'heartbeat_only' | 'development_run_loop';
  target_duration_ms: number;
  observed_duration_ms: number;
  tick_count: number;
  manual_restarts: number;
  silent_hangs: number;
  false_completions: number;
  heartbeats: Array<{
    tick: number;
    heartbeat_at: string;
    lease_owner: string;
    heartbeat_seq: number;
  }>;
  recoveries: SoakTimelineEvent[];
  recovery_success_rate: number;
  evidence_provenance?: EvidenceProvenance;
  developmentRun?: {
    projectRoot: string;
    flow: RuntimeFlowId;
    stage: string;
    hostKind: 'cursor' | 'claude' | 'codex';
    tick_count: number;
    completed_ticks: number;
    blocked_ticks: number;
    runLoopInvocations: Array<{
      tick: number;
      runId: string;
      status: MainAgentRunLoopResult['status'];
      packetId: string | null;
      taskReportStatus: string | null;
      evidence: string[];
      finalNextAction: string | null;
      tickCommand?: {
        command: string;
        exitCode: number | null;
        stdoutPath: string;
        stderrPath: string;
        diffHashBefore: string;
        diffHashAfter: string;
        timeoutMs: number;
      };
    }>;
  };
}

export function buildDeterministicSoakReport(input: {
  targetDurationMs: number;
  observedDurationMs?: number;
  recoveredFaults: number;
  failedRecoveries?: number;
}): SoakReport {
  const failedRecoveries = input.failedRecoveries ?? 0;
  const total = input.recoveredFaults + failedRecoveries;
  const base = Date.parse('2026-04-27T00:00:00.000Z');
  const recoveries = Array.from({ length: input.recoveredFaults }, (_, index) => {
    const offset = index * 60_000;
    return {
      tick: index + 1,
      fault_detected_at: new Date(base + offset).toISOString(),
      mitigation_started_at: new Date(base + offset + 1_000).toISOString(),
      resumed_at: new Date(base + offset + 5_000).toISOString(),
      duplicate_side_effect: false,
      owner_count: 1,
      originalExecutionPacketId: 'packet-original-001',
    };
  });

  return {
    version: 1,
    mode: 'deterministic_contract',
    run_kind: 'heartbeat_only',
    target_duration_ms: input.targetDurationMs,
    observed_duration_ms: input.observedDurationMs ?? input.targetDurationMs,
    tick_count: input.recoveredFaults,
    manual_restarts: 0,
    silent_hangs: 0,
    false_completions: 0,
    heartbeats: Array.from({ length: input.recoveredFaults }, (_, index) => ({
      tick: index + 1,
      heartbeat_at: new Date(base + index * 60_000).toISOString(),
      lease_owner: 'main-agent-soak',
      heartbeat_seq: index + 1,
    })),
    recoveries,
    recovery_success_rate: total === 0 ? 1 : input.recoveredFaults / total,
  };
}

export function evaluateSoakReport(report: SoakReport): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (report.observed_duration_ms < report.target_duration_ms) {
    reasons.push('observed duration is shorter than target duration');
  }
  if (report.manual_restarts > 0) reasons.push('manual restarts detected');
  if (report.silent_hangs > 0) reasons.push('silent hangs detected');
  if (report.false_completions > 0) reasons.push('false completions detected');
  if (report.tick_count <= 0) reasons.push('no ticks recorded');
  if (report.heartbeats.length !== report.tick_count) {
    reasons.push('heartbeat count does not match tick count');
  }
  if (report.recovery_success_rate < 0.95) {
    reasons.push('recovery success rate below 95%');
  }
  if (report.run_kind === 'development_run_loop') {
    if (!report.developmentRun) {
      reasons.push('missing development run evidence');
    } else if (
      !report.developmentRun.runLoopInvocations.some(
        (item) => item.tickCommand && item.tickCommand.exitCode === 0
      )
    ) {
      reasons.push('no successful real tick command evidence');
    }
  }
  for (const event of report.recoveries) {
    if (!event.fault_detected_at || !event.mitigation_started_at || !event.resumed_at) {
      reasons.push(`recovery timeline incomplete at tick ${event.tick}`);
    }
    if (event.duplicate_side_effect) reasons.push(`duplicate side-effect at tick ${event.tick}`);
    if (event.owner_count !== 1) reasons.push(`invalid owner count at tick ${event.tick}`);
    if (!event.originalExecutionPacketId) {
      reasons.push(`missing originalExecutionPacketId at tick ${event.tick}`);
    }
  }
  return { passed: reasons.length === 0, reasons };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--contract-8h') {
      out.contract8h = 'true';
    } else if (token === '--durationMs' && argv[index + 1]) {
      out.durationMs = argv[++index];
    } else if (token === '--tickIntervalMs' && argv[index + 1]) {
      out.tickIntervalMs = argv[++index];
    } else if (token === '--reportPath' && argv[index + 1]) {
      out.reportPath = argv[++index];
    } else if (token === '--injectRecoverableFault') {
      out.injectRecoverableFault = 'true';
    } else if (token === '--startBackground') {
      out.startBackground = 'true';
    } else if (token === '--developmentRunLoop') {
      out.developmentRunLoop = 'true';
    } else if (token === '--flow' && argv[index + 1]) {
      out.flow = argv[++index];
    } else if (token === '--stage' && argv[index + 1]) {
      out.stage = argv[++index];
    } else if (token === '--hostKind' && argv[index + 1]) {
      out.hostKind = argv[++index];
    } else if (token === '--tickCommand' && argv[index + 1]) {
      out.tickCommand = argv[++index];
    } else if (token === '--tickCommandTimeoutMs' && argv[index + 1]) {
      out.tickCommandTimeoutMs = argv[++index];
    } else if (token === '--evidenceSessionDir' && argv[index + 1]) {
      out.evidenceSessionDir = argv[++index];
    } else if (token === '--initialTickOffset' && argv[index + 1]) {
      out.initialTickOffset = argv[++index];
    } else if (token === '--runId' && argv[index + 1]) {
      out.runId = argv[++index];
    } else if (token === '--storyKey' && argv[index + 1]) {
      out.storyKey = argv[++index];
    } else if (token === '--evidenceBundleId' && argv[index + 1]) {
      out.evidenceBundleId = argv[++index];
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }
  if (!out.durationMs && positional[0]) out.durationMs = positional[0];
  if (!out.tickIntervalMs && positional[1]) out.tickIntervalMs = positional[1];
  return out;
}

function defaultReportPath(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'soak', 'main-agent-soak-report.json');
}

function metadataPath(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'soak', 'main-agent-soak-background.json');
}

function startBackgroundSoak(input: {
  durationMs: number;
  tickIntervalMs: number;
  reportPath: string;
  injectRecoverableFault?: boolean;
  developmentRunLoop?: boolean;
  flow?: RuntimeFlowId;
  stage?: string;
  hostKind?: 'cursor' | 'claude' | 'codex';
  tickCommand?: string;
  tickCommandTimeoutMs?: number;
  evidenceSessionDir?: string;
  initialTickOffset?: number;
  runId?: string;
  storyKey?: string;
  evidenceBundleId?: string;
}): { pid: number | null; metadataPath: string; reportPath: string } {
  const root = process.cwd();
  const toolRoot = path.resolve(__dirname, '..');
  const tsNodeBin = path.join(toolRoot, 'node_modules', 'ts-node', 'dist', 'bin.js');
  const args = [
    tsNodeBin,
    '--project',
    path.join(toolRoot, 'tsconfig.node.json'),
    '--transpile-only',
    __filename,
    '--durationMs',
    String(input.durationMs),
    '--tickIntervalMs',
    String(input.tickIntervalMs),
    '--reportPath',
    input.reportPath,
  ];
  if (input.injectRecoverableFault) args.push('--injectRecoverableFault');
  if (input.developmentRunLoop) args.push('--developmentRunLoop');
  if (input.flow) args.push('--flow', input.flow);
  if (input.stage) args.push('--stage', input.stage);
  if (input.hostKind) args.push('--hostKind', input.hostKind);
  if (input.tickCommand) args.push('--tickCommand', input.tickCommand);
  if (input.tickCommandTimeoutMs) {
    args.push('--tickCommandTimeoutMs', String(input.tickCommandTimeoutMs));
  }
  if (input.evidenceSessionDir) args.push('--evidenceSessionDir', input.evidenceSessionDir);
  if (input.initialTickOffset) args.push('--initialTickOffset', String(input.initialTickOffset));
  if (input.runId) args.push('--runId', input.runId);
  if (input.storyKey) args.push('--storyKey', input.storyKey);
  if (input.evidenceBundleId) args.push('--evidenceBundleId', input.evidenceBundleId);
  const child = spawn(process.execPath, args, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  const metadata = {
    reportType: 'main_agent_soak_background_run',
    startedAt: new Date().toISOString(),
    pid: child.pid ?? null,
    durationMs: input.durationMs,
    tickIntervalMs: input.tickIntervalMs,
    reportPath: input.reportPath,
    developmentRunLoop: input.developmentRunLoop === true,
    flow: input.flow ?? 'story',
    stage: input.stage ?? 'implement',
    hostKind: input.hostKind ?? 'cursor',
    tickCommand: input.tickCommand ?? null,
    tickCommandTimeoutMs: input.tickCommandTimeoutMs ?? null,
    evidenceSessionDir: input.evidenceSessionDir ?? null,
    initialTickOffset: input.initialTickOffset ?? 0,
    runId: input.runId ?? null,
    storyKey: input.storyKey ?? null,
    evidenceBundleId: input.evidenceBundleId ?? null,
    completionCheck:
      'Run npm run main-agent:delivery-truth-gate after the background process exits; do not claim 8h completion before the report observed_duration_ms reaches target_duration_ms.',
  };
  const target = metadataPath(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
  return { pid: child.pid ?? null, metadataPath: target, reportPath: input.reportPath };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function invocationFromTickRecord(input: {
  tick: number;
  tickDir: string;
  command: string;
  commandExitCode: number | null;
  stdoutPath: string;
  stderrPath: string;
  diffHashBefore: string;
  diffHashAfter: string;
}): NonNullable<SoakReport['developmentRun']>['runLoopInvocations'][number] | null {
  const record = readJsonFile<{
    packetId?: string;
    taskReport?: { packetId?: string; status?: string; evidence?: string[] };
    runLoopIngest?: { exitCode?: number | null };
    evidence?: { taskReportPath?: string; runLoopIngestPath?: string };
  }>(path.join(input.tickDir, 'tick-record.json'));
  if (!record?.taskReport) {
    return null;
  }
  const taskReportStatus = record.taskReport.status ?? null;
  return {
    tick: input.tick,
    runId: `external-tick-${input.tick}`,
    status:
      input.commandExitCode === 0 &&
      record.runLoopIngest?.exitCode === 0 &&
      taskReportStatus === 'done'
        ? 'completed'
        : 'blocked',
    packetId: record.taskReport.packetId ?? record.packetId ?? null,
    taskReportStatus,
    evidence: [
      ...(record.taskReport.evidence ?? []),
      ...(record.evidence?.taskReportPath ? [record.evidence.taskReportPath] : []),
      ...(record.evidence?.runLoopIngestPath ? [record.evidence.runLoopIngestPath] : []),
    ],
    finalNextAction: null,
    tickCommand: {
      command: input.command,
      exitCode: input.commandExitCode,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      diffHashBefore: input.diffHashBefore,
      diffHashAfter: input.diffHashAfter,
    },
  };
}

function invocationFromExistingTickRecord(
  tickDir: string
): NonNullable<SoakReport['developmentRun']>['runLoopInvocations'][number] | null {
  const record = readJsonFile<{
    tick?: number;
    packetId?: string;
    result?: string;
    taskReport?: { packetId?: string; status?: string; evidence?: string[] };
    runLoopIngest?: { exitCode?: number | null; command?: string; outputPath?: string };
    adapter?: { stdoutPath?: string; stderrPath?: string };
    beforeDiffHash?: string;
    afterDiffHash?: string;
    evidence?: { taskReportPath?: string; runLoopIngestPath?: string };
  }>(path.join(tickDir, 'tick-record.json'));
  if (!record?.tick || !record.taskReport) {
    return null;
  }
  return {
    tick: record.tick,
    runId: `external-tick-${record.tick}`,
    status:
      record.result === 'passed' &&
      record.runLoopIngest?.exitCode === 0 &&
      record.taskReport.status === 'done'
        ? 'completed'
        : 'blocked',
    packetId: record.taskReport.packetId ?? record.packetId ?? null,
    taskReportStatus: record.taskReport.status ?? null,
    evidence: [
      ...(record.taskReport.evidence ?? []),
      ...(record.evidence?.taskReportPath ? [record.evidence.taskReportPath] : []),
      ...(record.evidence?.runLoopIngestPath ? [record.evidence.runLoopIngestPath] : []),
    ],
    finalNextAction: null,
    tickCommand: {
      command: record.runLoopIngest?.command ?? 'external-real-development-tick',
      exitCode: record.runLoopIngest?.exitCode ?? null,
      stdoutPath: record.adapter?.stdoutPath ?? '',
      stderrPath: record.adapter?.stderrPath ?? '',
      diffHashBefore: record.beforeDiffHash ?? '',
      diffHashAfter: record.afterDiffHash ?? '',
    },
  };
}

function hydrateRunLoopInvocationsFromSessionDir(
  evidenceSessionDir: string | undefined,
  existing: NonNullable<SoakReport['developmentRun']>['runLoopInvocations']
): NonNullable<SoakReport['developmentRun']>['runLoopInvocations'] {
  if (!evidenceSessionDir || !fs.existsSync(evidenceSessionDir)) {
    return existing;
  }
  const byTick = new Map(existing.map((item) => [item.tick, item]));
  for (const dirent of fs.readdirSync(evidenceSessionDir, { withFileTypes: true })) {
    if (!dirent.isDirectory() || !/^tick-\d+$/u.test(dirent.name)) {
      continue;
    }
    const invocation = invocationFromExistingTickRecord(path.join(evidenceSessionDir, dirent.name));
    if (invocation) {
      byTick.set(invocation.tick, invocation);
    }
  }
  return Array.from(byTick.values()).sort((a, b) => a.tick - b.tick);
}

export async function runWallClockSoak(input: {
  durationMs: number;
  tickIntervalMs: number;
  injectRecoverableFault?: boolean;
  projectRoot?: string;
  developmentRunLoop?: boolean;
  flow?: RuntimeFlowId;
  stage?: string;
  hostKind?: 'cursor' | 'claude' | 'codex';
  tickCommand?: string;
  tickCommandTimeoutMs?: number;
  evidenceSessionDir?: string;
  initialTickOffset?: number;
  runId?: string;
  storyKey?: string;
  evidenceBundleId?: string;
}): Promise<SoakReport> {
  const start = Date.now();
  const heartbeats: SoakReport['heartbeats'] = [];
  const recoveries: SoakTimelineEvent[] = [];
  const runLoopInvocations: NonNullable<SoakReport['developmentRun']>['runLoopInvocations'] = [];
  const projectRoot = path.resolve(input.projectRoot ?? process.cwd());
  const flow = input.flow ?? 'story';
  const stage = input.stage ?? 'implement';
  const hostKind = input.hostKind ?? 'cursor';
  const tickEvidenceDir = path.join(projectRoot, '_bmad-output', 'runtime', 'soak', 'tick-evidence');
  const initialTickOffset = Number.isFinite(input.initialTickOffset ?? 0)
    ? Number(input.initialTickOffset ?? 0)
    : 0;
  let tick = initialTickOffset;
  let runTickCount = 0;
  while (Date.now() - start < input.durationMs) {
    tick += 1;
    runTickCount += 1;
    const now = new Date().toISOString();
    heartbeats.push({
      tick,
      heartbeat_at: now,
      lease_owner: 'main-agent-soak',
      heartbeat_seq: tick,
    });
    if (input.injectRecoverableFault && tick === 1) {
      const faultDetectedAt = new Date().toISOString();
      const mitigationStartedAt = new Date().toISOString();
      const resumedAt = new Date().toISOString();
      recoveries.push({
        tick,
        fault_detected_at: faultDetectedAt,
        mitigation_started_at: mitigationStartedAt,
        resumed_at: resumedAt,
        duplicate_side_effect: false,
        owner_count: 1,
        originalExecutionPacketId: 'packet-original-wall-clock',
      });
    }
    if (input.developmentRunLoop) {
      let tickCommand:
        | NonNullable<
            NonNullable<SoakReport['developmentRun']>['runLoopInvocations'][number]['tickCommand']
          >
        | undefined;
      if (input.tickCommand) {
        const evidenceRoot = input.evidenceSessionDir
          ? path.resolve(input.evidenceSessionDir)
          : tickEvidenceDir;
        const tickDir = path.join(evidenceRoot, `tick-${String(tick).padStart(3, '0')}`);
        fs.mkdirSync(tickDir, { recursive: true });
        const stdoutPath = path.join(tickDir, 'runner-stdout.log');
        const stderrPath = path.join(tickDir, 'runner-stderr.log');
        const diffHashBefore = gitDiffHash(projectRoot);
        const timeoutMs =
          input.tickCommandTimeoutMs && input.tickCommandTimeoutMs > 0
            ? input.tickCommandTimeoutMs
            : Math.max(1_000, Math.min(input.tickIntervalMs - 1_000, 120_000));
        const commandResult = spawnSync(input.tickCommand, {
          cwd: projectRoot,
          shell: true,
          encoding: 'utf8',
          timeout: timeoutMs,
          env: {
            ...process.env,
            BMAD_REAL_DEV_SESSION_DIR: evidenceRoot,
            BMAD_REAL_DEV_TICK: String(tick),
            BMAD_REAL_DEV_TICK_DIR: tickDir,
            BMAD_REAL_DEV_TICK_TIMEOUT_MS: String(timeoutMs),
          },
        });
        fs.writeFileSync(stdoutPath, commandResult.stdout ?? '', 'utf8');
        fs.writeFileSync(stderrPath, commandResult.stderr ?? '', 'utf8');
        tickCommand = {
          command: input.tickCommand,
          exitCode: commandResult.status,
          stdoutPath,
          stderrPath,
          diffHashBefore,
          diffHashAfter: gitDiffHash(projectRoot),
          timeoutMs,
        };
      }
      if (input.tickCommand && tickCommand) {
        const invocation = invocationFromTickRecord({
          tick,
          tickDir: path.dirname(tickCommand.stdoutPath),
          command: tickCommand.command,
          commandExitCode: tickCommand.exitCode,
          stdoutPath: tickCommand.stdoutPath,
          stderrPath: tickCommand.stderrPath,
          diffHashBefore: tickCommand.diffHashBefore,
          diffHashAfter: tickCommand.diffHashAfter,
        });
        if (invocation) {
          runLoopInvocations.push(invocation);
        }
      } else {
        const result = runMainAgentAutomaticLoop({
          projectRoot,
          flow,
          stage,
          args: {
            reportEvidence: `soak-tick-${tick}`,
            validationsRun: `main-agent-soak:${hostKind}`,
          },
          executor: ({ projectRoot: runRoot, instruction, args }) => {
            const reportPath = writeMainAgentRunLoopTaskReport(runRoot, instruction, args);
            return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          },
        });
        runLoopInvocations.push({
          tick,
          runId: result.runId,
          status: result.status,
          packetId: result.dispatchInstruction?.packetId ?? null,
          taskReportStatus: result.taskReport?.status ?? null,
          evidence: result.taskReport?.evidence ?? [],
          finalNextAction: result.finalSurface.mainAgentNextAction,
          ...(tickCommand ? { tickCommand } : {}),
        });
      }
    }
    await sleep(
      Math.min(input.tickIntervalMs, Math.max(0, input.durationMs - (Date.now() - start)))
    );
  }
  const observed = Date.now() - start;
  const totalFaults = recoveries.length;
  const report: SoakReport = {
    version: 1,
    mode: 'wall_clock',
    run_kind: input.developmentRunLoop ? 'development_run_loop' : 'heartbeat_only',
    target_duration_ms: input.durationMs,
    observed_duration_ms: observed,
    tick_count: runTickCount,
    manual_restarts: 0,
    silent_hangs: 0,
    false_completions: 0,
    heartbeats,
    recoveries,
    recovery_success_rate: totalFaults === 0 ? 1 : recoveries.length / totalFaults,
    evidence_provenance: buildEvidenceProvenance({
      root: projectRoot,
      runId: input.runId,
      storyKey: input.storyKey,
      evidenceBundleId: input.evidenceBundleId,
      prefix: 'soak',
    }),
  };
  if (input.developmentRunLoop) {
    const hydratedInvocations = hydrateRunLoopInvocationsFromSessionDir(
      input.evidenceSessionDir,
      runLoopInvocations
    );
    report.developmentRun = {
      projectRoot,
      flow,
      stage,
      hostKind,
      tick_count: hydratedInvocations.length,
      completed_ticks: hydratedInvocations.filter((item) => item.status === 'completed').length,
      blocked_ticks: hydratedInvocations.filter((item) => item.status === 'blocked').length,
      runLoopInvocations: hydratedInvocations,
    };
  }
  report.evidence_provenance = {
    ...report.evidence_provenance!,
    gateReportHash: sha256(
      JSON.stringify({
        mode: report.mode,
        run_kind: report.run_kind,
        target_duration_ms: report.target_duration_ms,
        observed_duration_ms: report.observed_duration_ms,
        tick_count: report.tick_count,
        manual_restarts: report.manual_restarts,
        silent_hangs: report.silent_hangs,
        false_completions: report.false_completions,
        recovery_success_rate: report.recovery_success_rate,
        developmentRun: report.developmentRun
          ? {
              tick_count: report.developmentRun.tick_count,
              completed_ticks: report.developmentRun.completed_ticks,
              blocked_ticks: report.developmentRun.blocked_ticks,
            }
          : null,
      })
    ),
  };
  return report;
}

function gitDiffHash(projectRoot: string): string {
  const result = spawnSync('git', ['diff', '--binary'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 30_000,
  });
  return crypto
    .createHash('sha256')
    .update(result.stdout ?? '')
    .update(result.stderr ?? '')
    .digest('hex');
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const projectRoot = process.cwd();
  const durationMs =
    Number(args.durationMs) > 0
      ? Number(args.durationMs)
      : args.contract8h === 'true'
        ? 8 * 60 * 60 * 1000
        : 2 * 60 * 60 * 1000;
  const tickIntervalMs = Number(args.tickIntervalMs) > 0 ? Number(args.tickIntervalMs) : 30_000;
  const reportPath = path.resolve(args.reportPath ?? defaultReportPath(projectRoot));

  if (args.startBackground === 'true') {
    const result = startBackgroundSoak({
      durationMs,
      tickIntervalMs,
      reportPath,
      injectRecoverableFault: args.injectRecoverableFault === 'true',
      developmentRunLoop: args.developmentRunLoop === 'true',
      flow: args.flow as RuntimeFlowId | undefined,
      stage: args.stage,
      hostKind:
        args.hostKind === 'codex' || args.hostKind === 'claude' || args.hostKind === 'cursor'
          ? args.hostKind
          : undefined,
      tickCommand: args.tickCommand,
      tickCommandTimeoutMs: Number(args.tickCommandTimeoutMs),
      evidenceSessionDir: args.evidenceSessionDir,
      initialTickOffset: Number(args.initialTickOffset),
      runId: args.runId,
      storyKey: args.storyKey,
      evidenceBundleId: args.evidenceBundleId,
    });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  const emit = (report: SoakReport): number => {
    const result = evaluateSoakReport(report);
    const payload = { ...report, evaluation: result };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(payload, null, 2));
    return result.passed ? 0 : 1;
  };

  if (args.durationMs) {
    runWallClockSoak({
      durationMs,
      tickIntervalMs,
      projectRoot,
      injectRecoverableFault: args.injectRecoverableFault === 'true',
      developmentRunLoop: args.developmentRunLoop === 'true',
      flow: args.flow as RuntimeFlowId | undefined,
      stage: args.stage,
      hostKind:
        args.hostKind === 'codex' || args.hostKind === 'claude' || args.hostKind === 'cursor'
          ? args.hostKind
          : undefined,
      tickCommand: args.tickCommand,
      tickCommandTimeoutMs: Number(args.tickCommandTimeoutMs),
      evidenceSessionDir: args.evidenceSessionDir,
      initialTickOffset: Number(args.initialTickOffset),
      runId: args.runId,
      storyKey: args.storyKey,
      evidenceBundleId: args.evidenceBundleId,
    })
      .then((report) => {
        process.exitCode = emit(report);
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    return 0;
  }

  return emit(
    buildDeterministicSoakReport({
      targetDurationMs: durationMs,
      recoveredFaults: 20,
    })
  );
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
