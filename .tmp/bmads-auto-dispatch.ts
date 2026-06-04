import * as fs from 'node:fs';
import * as path from 'node:path';

export type PacketState =
  | 'open'
  | 'acknowledged'
  | 'closed'
  | 'cancelled'
  | 'superseded'
  | 'paused_for_change_control';

export type StoryState = 'pending' | 'dispatched' | 'done' | 'failed' | 'cancelled' | 'blocked';

export interface DispatchPacket {
  schemaVersion: 'bmads_auto_dispatch_packet/v1';
  runId: string;
  storyKey: string;
  dispatchPacketId: string;
  dispatchManifestVersion: number;
  allowedWriteScope: string[];
  state: PacketState;
}

export interface DispatchAck {
  schemaVersion: 'bmads_auto_dispatch_ack/v1';
  runId: string;
  dispatchPacketId: string;
  host: string;
  hostSessionId: string;
  ackAt: string;
  manifestVersion: number;
  leaseId: string;
}

export interface TaskReport {
  schemaVersion?: 'bmads_auto_task_report/v1';
  runId: string;
  storyKey: string;
  dispatchPacketId: string;
  dispatchManifestVersion: number;
  host?: string;
  status: 'done' | 'failed' | 'cancelled';
  changedFiles?: string[];
  filesChanged?: string[];
  tests?: Array<{ name: string; exitCode: number }>;
  commands?: Array<{ command: string; exitCode: number }>;
}

export interface DispatchRuntimeProjection {
  schemaVersion: 'bmads_auto_dispatch_runtime_projection/v1';
  packetIndex: Record<string, { packetState: PacketState; storyKey: string; manifestVersion: number }>;
  storyStates: Record<string, StoryState>;
  openLeases: Array<{ leaseId: string; dispatchPacketId: string; state: 'acquired' }>;
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

function packetDir(root: string, dispatchPacketId: string): string {
  return path.join(root, 'packets', dispatchPacketId);
}

function storyDir(root: string, storyKey: string): string {
  return path.join(root, 'stories', storyKey);
}

function packetPath(root: string, dispatchPacketId: string): string {
  return path.join(packetDir(root, dispatchPacketId), 'dispatch-packet.json');
}

function legacyPacketPath(root: string): string {
  return path.join(root, 'dispatch-packet.json');
}

function normalizeScope(scope: string): string {
  return scope.replace(/\\/g, '/').toLowerCase();
}

function changedFiles(report: TaskReport): string[] {
  return report.changedFiles ?? report.filesChanged ?? [];
}

function readPacket(root: string, dispatchPacketId?: string): DispatchPacket {
  if (dispatchPacketId && fs.existsSync(packetPath(root, dispatchPacketId))) {
    return readJson<DispatchPacket>(packetPath(root, dispatchPacketId));
  }
  return readJson<DispatchPacket>(legacyPacketPath(root));
}

function writePacket(root: string, packet: DispatchPacket): void {
  writeJson(packetPath(root, packet.dispatchPacketId), packet);
  writeJson(path.join(storyDir(root, packet.storyKey), 'dispatch-packet.json'), packet);
  writeJson(legacyPacketPath(root), packet);
}

function leaseLogPath(root: string): string {
  return path.join(root, 'lease-log.jsonl');
}

function leaseEvents(root: string): Array<{ event: string; leaseId: string; dispatchPacketId: string }> {
  const target = leaseLogPath(root);
  if (!fs.existsSync(target)) return [];
  return fs
    .readFileSync(target, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeProjection(root: string): DispatchRuntimeProjection {
  const projection = readDispatchRuntimeProjection(root);
  writeJson(path.join(root, 'runtime-projection.json'), projection);
  return projection;
}

export function createDispatchPacket(input: {
  root: string;
  runId: string;
  storyKey: string;
  manifestVersion: number;
  allowedWriteScope: string[];
}): DispatchPacket {
  const packet: DispatchPacket = {
    schemaVersion: 'bmads_auto_dispatch_packet/v1',
    runId: input.runId,
    storyKey: input.storyKey,
    dispatchPacketId: `${input.runId}-${input.storyKey}-packet`,
    dispatchManifestVersion: input.manifestVersion,
    allowedWriteScope: input.allowedWriteScope,
    state: 'open',
  };
  writePacket(input.root, packet);
  writeProjection(input.root);
  return packet;
}

export function acknowledgeDispatch(input: {
  root: string;
  packet: DispatchPacket;
  host: string;
  hostSessionId: string;
}): DispatchAck {
  const ack: DispatchAck = {
    schemaVersion: 'bmads_auto_dispatch_ack/v1',
    runId: input.packet.runId,
    dispatchPacketId: input.packet.dispatchPacketId,
    host: input.host,
    hostSessionId: input.hostSessionId,
    ackAt: new Date().toISOString(),
    manifestVersion: input.packet.dispatchManifestVersion,
    leaseId: `${input.packet.dispatchPacketId}-lease`,
  };
  writePacket(input.root, { ...input.packet, state: 'acknowledged' });
  writeJson(path.join(packetDir(input.root, input.packet.dispatchPacketId), 'dispatch-ack.json'), ack);
  writeJson(path.join(input.root, 'dispatch-ack.json'), ack);
  recordLeaseEvent({
    root: input.root,
    leaseId: ack.leaseId,
    dispatchPacketId: input.packet.dispatchPacketId,
    event: 'lease.acquired',
  });
  return ack;
}

export function recordLeaseEvent(input: {
  root: string;
  leaseId: string;
  dispatchPacketId: string;
  event: 'lease.acquired' | 'lease.released' | 'lease.recovered';
}): void {
  fs.mkdirSync(input.root, { recursive: true });
  fs.appendFileSync(
    leaseLogPath(input.root),
    `${JSON.stringify({
      event: input.event,
      leaseId: input.leaseId,
      dispatchPacketId: input.dispatchPacketId,
    })}\n`,
    'utf8'
  );
  writeProjection(input.root);
}

export function transitionDispatchPacketState(input: {
  root: string;
  dispatchPacketId: string;
  nextState: PacketState;
  storyState?: StoryState;
}): void {
  const packet = readPacket(input.root, input.dispatchPacketId);
  writePacket(input.root, { ...packet, state: input.nextState });
  if (input.storyState) {
    writeJson(path.join(storyDir(input.root, packet.storyKey), 'story-state.json'), {
      storyKey: packet.storyKey,
      storyState: input.storyState,
    });
  }
  writeProjection(input.root);
}

export function ingestTaskReport(input: {
  root: string;
  report: TaskReport;
}): {
  schemaVersion: 'bmads_auto_taskreport_ingest/v1';
  resultCode:
    | 'OK'
    | 'DUPLICATE_ACCEPTED_NOOP'
    | 'REQUIRES_MANUAL_RECONCILE'
    | 'DISCARDED_LATE'
    | 'DISCARDED_CANCELLED_PACKET'
    | 'BLOCKED_CROSS_RUN_REPORT'
    | 'BLOCKED_STALE_REPORT'
    | 'BLOCKED_ACK_REQUIRED'
    | 'BLOCKED_LEASE_REQUIRED'
    | 'BLOCKED_WRITE_SCOPE_VIOLATION'
    | 'BLOCKED_TASKREPORT_INVALID';
  packetState: PacketState;
  storyState: StoryState;
  sideEffectArtifacts: string[];
} {
  const report = input.report;
  const packet = readPacket(input.root, report.dispatchPacketId);
  const receiptPath = path.join(packetDir(input.root, packet.dispatchPacketId), 'taskreport-ingest-receipt.json');
  const result = (
    resultCode: ReturnType<typeof ingestTaskReport>['resultCode'],
    packetState: PacketState,
    storyState: StoryState,
    sideEffectArtifacts: string[] = []
  ) => {
    const value = {
      schemaVersion: 'bmads_auto_taskreport_ingest/v1' as const,
      resultCode,
      packetState,
      storyState,
      sideEffectArtifacts,
    };
    writeJson(receiptPath, value);
    return value;
  };

  if (report.runId !== packet.runId || report.dispatchPacketId !== packet.dispatchPacketId) {
    return result('BLOCKED_CROSS_RUN_REPORT', packet.state, 'blocked');
  }
  if (report.storyKey !== packet.storyKey || report.schemaVersion !== 'bmads_auto_task_report/v1') {
    return result('BLOCKED_TASKREPORT_INVALID', packet.state, 'blocked');
  }
  if (report.dispatchManifestVersion !== packet.dispatchManifestVersion) {
    return result('BLOCKED_STALE_REPORT', packet.state, 'blocked');
  }
  if (packet.state === 'closed') {
    const oldReportPath = path.join(packetDir(input.root, packet.dispatchPacketId), 'taskreport.json');
    if (fs.existsSync(oldReportPath)) {
      const oldReport = readJson<TaskReport>(oldReportPath);
      if (JSON.stringify(changedFiles(oldReport).sort()) !== JSON.stringify(changedFiles(report).sort())) {
        return result('REQUIRES_MANUAL_RECONCILE', packet.state, 'done');
      }
    }
    return result('DUPLICATE_ACCEPTED_NOOP', packet.state, 'done');
  }
  if (packet.state === 'cancelled') return result('DISCARDED_CANCELLED_PACKET', packet.state, 'cancelled');
  if (packet.state === 'superseded') return result('DISCARDED_LATE', packet.state, 'blocked');
  if (packet.state === 'paused_for_change_control') {
    return result('REQUIRES_MANUAL_RECONCILE', packet.state, 'blocked');
  }
  if (packet.state !== 'acknowledged') return result('BLOCKED_ACK_REQUIRED', packet.state, 'blocked');

  const ackPath = path.join(packetDir(input.root, packet.dispatchPacketId), 'dispatch-ack.json');
  if (!fs.existsSync(ackPath)) return result('BLOCKED_ACK_REQUIRED', packet.state, 'blocked');
  const leaseId = `${packet.dispatchPacketId}-lease`;
  const events = leaseEvents(input.root).filter((event) => event.leaseId === leaseId);
  if (!events.some((event) => event.event === 'lease.acquired')) {
    return result('BLOCKED_LEASE_REQUIRED', packet.state, 'blocked');
  }

  const scopeViolation = changedFiles(report).some(
    (file) => !packet.allowedWriteScope.some((scope) => normalizeScope(file).startsWith(normalizeScope(scope)))
  );
  if (scopeViolation) return result('BLOCKED_WRITE_SCOPE_VIOLATION', packet.state, 'blocked');

  const storyState: StoryState =
    report.status === 'done' ? 'done' : report.status === 'cancelled' ? 'cancelled' : 'failed';
  writePacket(input.root, { ...packet, state: 'closed' });
  const reportPath = path.join(packetDir(input.root, packet.dispatchPacketId), 'taskreport.json');
  writeJson(reportPath, report);
  writeJson(path.join(storyDir(input.root, packet.storyKey), 'taskreport.json'), report);
  writeJson(path.join(storyDir(input.root, packet.storyKey), 'story-state.json'), {
    storyKey: packet.storyKey,
    storyState,
  });
  recordLeaseEvent({
    root: input.root,
    leaseId,
    dispatchPacketId: packet.dispatchPacketId,
    event: 'lease.released',
  });
  writeProjection(input.root);
  return result('OK', 'closed', storyState, [reportPath]);
}

export function readDispatchRuntimeProjection(root: string): DispatchRuntimeProjection {
  const packetIndex: DispatchRuntimeProjection['packetIndex'] = {};
  const storyStates: DispatchRuntimeProjection['storyStates'] = {};
  const packetRoot = path.join(root, 'packets');
  if (fs.existsSync(packetRoot)) {
    for (const dispatchPacketId of fs.readdirSync(packetRoot)) {
      const target = packetPath(root, dispatchPacketId);
      if (!fs.existsSync(target)) continue;
      const packet = readJson<DispatchPacket>(target);
      packetIndex[dispatchPacketId] = {
        packetState: packet.state,
        storyKey: packet.storyKey,
        manifestVersion: packet.dispatchManifestVersion,
      };
      storyStates[packet.storyKey] =
        packet.state === 'closed' ? storyStates[packet.storyKey] ?? 'done' : 'dispatched';
    }
  }
  const storiesRoot = path.join(root, 'stories');
  if (fs.existsSync(storiesRoot)) {
    for (const storyKey of fs.readdirSync(storiesRoot)) {
      const statePath = path.join(storiesRoot, storyKey, 'story-state.json');
      if (fs.existsSync(statePath)) {
        storyStates[storyKey] = readJson<{ storyState: StoryState }>(statePath).storyState;
      }
    }
  }
  const events = leaseEvents(root);
  const openLeases = events
    .filter((event) => event.event === 'lease.acquired')
    .filter(
      (event) =>
        !events.some(
          (candidate) =>
            candidate.leaseId === event.leaseId &&
            ['lease.released', 'lease.recovered'].includes(candidate.event)
        )
    )
    .map((event) => ({
      leaseId: event.leaseId,
      dispatchPacketId: event.dispatchPacketId,
      state: 'acquired' as const,
    }));
  return {
    schemaVersion: 'bmads_auto_dispatch_runtime_projection/v1',
    packetIndex,
    storyStates,
    openLeases,
  };
}

export function runDriftDetector(input: {
  root?: string;
  runId?: string;
  scope?: 'pre-dispatch' | 'post-ingest' | 'wave-closeout' | 'resume' | 'change-control';
  baselineHashes: Record<string, string>;
  currentHashes: Record<string, string>;
}): { resultCode: 'OK' | 'BLOCKED_DRIFT_DETECTED'; driftKeys: string[]; scope: string; checkpointPath: string } {
  const driftKeys = Object.keys(input.baselineHashes).filter(
    (key) => input.baselineHashes[key] !== input.currentHashes[key]
  );
  const scope = input.scope ?? 'pre-dispatch';
  const checkpointPath =
    input.root && input.runId
      ? path.join(input.root, 'drift-checkpoints', `${input.runId}.${scope}.json`)
      : '';
  const value = {
    resultCode: driftKeys.length === 0 ? 'OK' as const : 'BLOCKED_DRIFT_DETECTED' as const,
    driftKeys,
    scope,
    checkpointPath,
  };
  if (checkpointPath) writeJson(checkpointPath, value);
  return value;
}

export function recordHostFallback(input: {
  root: string;
  runId: string;
  dispatchPacketId?: string;
  originalPacketId?: string;
  supersedingPacketId?: string;
  fromHost: string;
  toHost: string;
  reason: string;
}): { schemaVersion: 'bmads_auto_host_fallback_receipt/v1'; receiptPath: string } {
  const dispatchPacketId = input.dispatchPacketId ?? input.originalPacketId ?? input.supersedingPacketId;
  if (!dispatchPacketId) throw new Error('dispatchPacketId or originalPacketId is required');
  const receiptPath = path.join(packetDir(input.root, dispatchPacketId), 'host-fallback-receipt.json');
  writeJson(receiptPath, {
    schemaVersion: 'bmads_auto_host_fallback_receipt/v1',
    ...input,
  });
  return { schemaVersion: 'bmads_auto_host_fallback_receipt/v1', receiptPath };
}

export function evaluateWaveCloseout(input: {
  root: string;
  runId: string;
  wave: number;
  expectedStoryKeys: string[];
}): { schemaVersion: 'bmads_auto_wave_closeout/v1'; resultCode: 'OK' | 'BLOCKED_WAVE_CLOSEOUT'; blockers: string[] } {
  const blockers: string[] = [];
  const projection = readDispatchRuntimeProjection(input.root);
  for (const lease of projection.openLeases) blockers.push(`LEASE_OPEN:${lease.leaseId}`);
  for (const storyKey of input.expectedStoryKeys) {
    if (!['done', 'failed', 'cancelled'].includes(projection.storyStates[storyKey])) {
      blockers.push(`STORY_NOT_TERMINAL:${storyKey}`);
    }
  }
  const checkpoint = path.join(input.root, 'drift-checkpoints', `${input.runId}.wave-closeout.json`);
  if (!fs.existsSync(checkpoint)) blockers.push('DRIFT_CHECKPOINT_MISSING:wave-closeout');
  const result = {
    schemaVersion: 'bmads_auto_wave_closeout/v1' as const,
    resultCode: blockers.length === 0 ? 'OK' as const : 'BLOCKED_WAVE_CLOSEOUT' as const,
    blockers,
  };
  writeJson(path.join(input.root, `wave-${input.wave}-closeout-receipt.json`), result);
  return result;
}
