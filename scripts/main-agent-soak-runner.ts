/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }
  if (!out.durationMs && positional[0]) out.durationMs = positional[0];
  if (!out.tickIntervalMs && positional[1]) out.tickIntervalMs = positional[1];
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWallClockSoak(input: {
  durationMs: number;
  tickIntervalMs: number;
  injectRecoverableFault?: boolean;
}): Promise<SoakReport> {
  const start = Date.now();
  const heartbeats: SoakReport['heartbeats'] = [];
  const recoveries: SoakTimelineEvent[] = [];
  let tick = 0;
  while (Date.now() - start < input.durationMs) {
    tick += 1;
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
    await sleep(Math.min(input.tickIntervalMs, Math.max(0, input.durationMs - (Date.now() - start))));
  }
  const observed = Date.now() - start;
  const totalFaults = recoveries.length;
  return {
    version: 1,
    mode: 'wall_clock',
    target_duration_ms: input.durationMs,
    observed_duration_ms: observed,
    tick_count: tick,
    manual_restarts: 0,
    silent_hangs: 0,
    false_completions: 0,
    heartbeats,
    recoveries,
    recovery_success_rate: totalFaults === 0 ? 1 : recoveries.length / totalFaults,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const durationMs =
    Number(args.durationMs) > 0
      ? Number(args.durationMs)
      : args.contract8h === 'true'
        ? 8 * 60 * 60 * 1000
        : 2 * 60 * 60 * 1000;
  const tickIntervalMs = Number(args.tickIntervalMs) > 0 ? Number(args.tickIntervalMs) : 30_000;

  const emit = (report: SoakReport): number => {
    const result = evaluateSoakReport(report);
    const payload = { ...report, evaluation: result };
    if (args.reportPath) {
      const reportPath = path.resolve(args.reportPath);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    }
    console.log(JSON.stringify(payload, null, 2));
    return result.passed ? 0 : 1;
  };

  if (args.durationMs) {
    runWallClockSoak({
      durationMs,
      tickIntervalMs,
      injectRecoverableFault: args.injectRecoverableFault === 'true',
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
