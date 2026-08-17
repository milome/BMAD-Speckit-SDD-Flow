import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stableControlPlaneStringify } from './canonical-hash';

const MARKER_SCHEMA = 'ControlPlaneGenerationLockMarker/v1';
const GUARD_SCHEMA = 'ControlPlaneGenerationLockGuard/v1';
const LOCK_SLEEP = new Int32Array(new SharedArrayBuffer(4));
const ACTIVE_HANDLES = new WeakMap<object, ActiveGenerationLock>();
let currentProcessStartIdentity: string | undefined;

interface GenerationMarker {
  schemaVersion: typeof MARKER_SCHEMA;
  lockSchemaVersion: string;
  markerKind: 'choosing' | 'ticket';
  ownerPid: number;
  ownerProcessStartIdentity: string;
  ownerToken: string;
  ticket: string | null;
  acquiredAtMs: number;
  leaseExpiresAtMs: number;
}

interface ProtocolGuard {
  schemaVersion: typeof GUARD_SCHEMA;
  lockSchemaVersion: string;
  canonicalLockName: string;
  guardIdentity: string;
}

interface LiveMarker {
  marker: GenerationMarker | null;
  markerPath: string;
}

interface GenerationLease {
  ticketDescriptor: number | null;
}

interface OwnerDirectoryIdentity {
  realPath: string;
  device: bigint;
  inode: bigint;
}

interface ActiveGenerationLock extends ControlPlaneGenerationLockHandle {
  lease: GenerationLease;
}

export interface ControlPlaneGenerationLockOptions {
  lockPath: string;
  lockSchemaVersion: string;
  legacyLockSchemaVersions?: readonly string[];
  timeoutMs: number;
  pollMs: number;
  leaseMs: number;
  conflictIssueCode: string;
}

export interface ControlPlaneGenerationLockHandle {
  lockPath: string;
  lockSchemaVersion: string;
  ownerToken: string;
  ticket: string;
  ticketPath: string;
}

const HANDLE_BRAND = Symbol('ControlPlaneGenerationLockHandle');
type BrandedControlPlaneGenerationLockHandle = ControlPlaneGenerationLockHandle & {
  readonly [HANDLE_BRAND]: true;
};

function ownerAlive(ownerPid: number): boolean {
  if (!Number.isInteger(ownerPid) || ownerPid <= 0) return false;
  try {
    process.kill(ownerPid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function exactProcessStartIdentity(ownerPid: number): string | null {
  if (process.platform === 'linux') {
    try {
      const stat = fs.readFileSync(`/proc/${ownerPid}/stat`, 'utf8');
      const commandEnd = stat.lastIndexOf(')');
      if (commandEnd < 0) return null;
      const fields = stat
        .slice(commandEnd + 2)
        .trim()
        .split(/\s+/u);
      const startTicks = fields[19];
      return /^\d+$/u.test(startTicks ?? '') ? `linux-start-ticks:${startTicks}` : null;
    } catch {
      return null;
    }
  }
  const command =
    process.platform === 'win32'
      ? {
          file: 'pwsh.exe',
          args: [
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `([DateTime](Get-Process -Id ${ownerPid} -ErrorAction Stop).StartTime).ToUniversalTime().Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)`,
          ],
        }
      : null;
  if (!command) return null;
  try {
    const result = spawnSync(command.file, command.args, {
      encoding: 'utf8',
      timeout: 2_000,
      windowsHide: true,
    });
    if (result.status !== 0 || result.error) return null;
    const value = result.stdout.trim();
    return /^\d+$/u.test(value)
      ? `${process.platform === 'win32' ? 'windows-start-ticks' : 'process-start'}:${value}`
      : null;
  } catch {
    return null;
  }
}

function ownProcessStartIdentity(): string {
  currentProcessStartIdentity ??=
    exactProcessStartIdentity(process.pid) ?? `unavailable:${randomBytes(16).toString('hex')}`;
  return currentProcessStartIdentity;
}

function ownerGenerationAlive(ownerPid: number, ownerProcessStartIdentity: string): boolean {
  if (!ownerAlive(ownerPid)) return false;
  if (ownerProcessStartIdentity.startsWith('unavailable:')) return true;
  const currentProcessIdentity =
    ownerPid === process.pid ? ownProcessStartIdentity() : exactProcessStartIdentity(ownerPid);
  if (currentProcessIdentity === null) return true;
  return currentProcessIdentity === ownerProcessStartIdentity;
}

function ownerDirectory(lockPath: string): string {
  return `${lockPath}.owners`;
}

function controlPlaneBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function closeOwnedDescriptorOrAbort(descriptor: number): unknown | null {
  try {
    fs.closeSync(descriptor);
    return null;
  } catch (error) {
    try {
      fs.closeSync(descriptor);
      return error;
    } catch {
      process.abort();
    }
  }
}

function durablePublish(
  artifactPath: string,
  value: unknown,
  retainDescriptor = false
): number | null {
  const descriptor = fs.openSync(artifactPath, 'wx');
  let durable = false;
  let operationError: unknown;
  let closeError: unknown;
  try {
    fs.writeFileSync(descriptor, controlPlaneBytes(value));
    fs.fsyncSync(descriptor);
    durable = true;
  } catch (error) {
    operationError = error;
  }
  if (!retainDescriptor || operationError) {
    closeError = closeOwnedDescriptorOrAbort(descriptor);
  }
  if (!durable || operationError || closeError) {
    try {
      fs.rmSync(artifactPath, { force: true });
    } catch (cleanupError) {
      if (!operationError && !closeError) throw cleanupError;
    }
  }
  if (operationError) throw operationError;
  if (closeError) throw closeError;
  return retainDescriptor ? descriptor : null;
}

function normalizedGuardLockPath(lockPath: string): string {
  const resolved = path.resolve(lockPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function expectedProtocolGuard(options: ControlPlaneGenerationLockOptions): ProtocolGuard {
  const normalizedLockPath = normalizedGuardLockPath(options.lockPath);
  return {
    schemaVersion: GUARD_SCHEMA,
    lockSchemaVersion: options.lockSchemaVersion,
    canonicalLockName: path.basename(normalizedLockPath),
    guardIdentity: createHash('sha256')
      .update(`${normalizedLockPath}\0${options.lockSchemaVersion}`, 'utf8')
      .digest('hex'),
  };
}

function protocolGuardMatches(
  options: ControlPlaneGenerationLockOptions,
  expectedBytes = controlPlaneBytes(expectedProtocolGuard(options))
): boolean {
  try {
    return fs.readFileSync(options.lockPath).equals(expectedBytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function guardCandidateOwnerPid(lockName: string, candidateName: string): number | null {
  const prefix = `${lockName}.guard-candidate-`;
  if (!candidateName.startsWith(prefix)) return null;
  const match = /^([1-9][0-9]*)-([0-9a-f]{32})$/u.exec(candidateName.slice(prefix.length));
  if (!match) return null;
  const ownerPid = Number(match[1]);
  return Number.isSafeInteger(ownerPid) ? ownerPid : null;
}

function cleanupStaleGuardCandidates(options: ControlPlaneGenerationLockOptions): void {
  const directory = path.dirname(options.lockPath);
  const lockName = path.basename(options.lockPath);
  const now = Date.now();
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  for (const name of names) {
    const ownerPid = guardCandidateOwnerPid(lockName, name);
    if (ownerPid === null || ownerAlive(ownerPid)) continue;
    const candidatePath = path.join(directory, name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(candidatePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile() || stat.mtimeMs + options.leaseMs > now) continue;
    fs.rmSync(candidatePath, { force: true });
  }
}

function ensureProtocolGuard(options: ControlPlaneGenerationLockOptions): void {
  cleanupStaleGuardCandidates(options);
  const guard = expectedProtocolGuard(options);
  const expectedBytes = controlPlaneBytes(guard);
  const candidatePath = `${options.lockPath}.guard-candidate-${process.pid}-${randomBytes(16).toString('hex')}`;
  try {
    durablePublish(candidatePath, guard);
    try {
      fs.linkSync(candidatePath, options.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (!protocolGuardMatches(options, expectedBytes)) fail(options);
    }
  } finally {
    fs.rmSync(candidatePath, { force: true });
  }
  if (!protocolGuardMatches(options, expectedBytes)) fail(options);
}

function isKnownMarker(
  value: unknown,
  expectedLockSchemaVersion: string
): value is GenerationMarker {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.schemaVersion === MARKER_SCHEMA &&
    marker.lockSchemaVersion === expectedLockSchemaVersion &&
    (marker.markerKind === 'choosing' || marker.markerKind === 'ticket') &&
    typeof marker.ownerPid === 'number' &&
    Number.isInteger(marker.ownerPid) &&
    marker.ownerPid > 0 &&
    typeof marker.ownerProcessStartIdentity === 'string' &&
    /^(?:linux-start-ticks|windows-start-ticks|process-start|unavailable):[a-z0-9-]+$/u.test(
      marker.ownerProcessStartIdentity
    ) &&
    typeof marker.ownerToken === 'string' &&
    marker.ownerToken.length > 0 &&
    (marker.ticket === null ||
      (typeof marker.ticket === 'string' && /^[1-9][0-9]*$/u.test(marker.ticket))) &&
    typeof marker.acquiredAtMs === 'number' &&
    Number.isFinite(marker.acquiredAtMs) &&
    typeof marker.leaseExpiresAtMs === 'number' &&
    Number.isFinite(marker.leaseExpiresAtMs) &&
    marker.leaseExpiresAtMs >= marker.acquiredAtMs &&
    (marker.markerKind === 'choosing' ? marker.ticket === null : marker.ticket !== null)
  );
}

function markerNamePrefix(options: ControlPlaneGenerationLockOptions): string {
  return `${path.basename(options.lockPath)}.owner-`;
}

function expectedMarkerName(
  marker: GenerationMarker,
  options: ControlPlaneGenerationLockOptions
): string {
  const prefix = markerNamePrefix(options);
  if (marker.markerKind === 'choosing') return `${prefix}${marker.ownerToken}.choosing`;
  return `${prefix}${marker.ticket!.padStart(20, '0')}-${marker.ownerToken}.ticket`;
}

function publishMarker(
  artifactPath: string,
  value: unknown,
  options: ControlPlaneGenerationLockOptions,
  retainDescriptor = false
): number | null {
  const lockDirectory = path.dirname(artifactPath);
  const lockName = path.basename(artifactPath).split('.owner-', 1)[0];
  const candidatePath = path.join(
    lockDirectory,
    `${lockName}.marker-candidate-${process.pid}-${randomBytes(16).toString('hex')}-${path.basename(artifactPath)}`
  );
  let descriptor: number | undefined;
  try {
    descriptor = durablePublish(candidatePath, value, retainDescriptor) ?? undefined;
    let candidateIdentity: fs.BigIntStats | null = null;
    if (descriptor !== undefined) {
      candidateIdentity = fs.fstatSync(descriptor, { bigint: true });
      if (!candidateIdentity.isFile()) fail(options);
    }
    fs.linkSync(candidatePath, artifactPath);
    if (candidateIdentity) {
      const markerIdentity = fs.lstatSync(artifactPath, { bigint: true });
      if (
        !markerIdentity.isFile() ||
        markerIdentity.isSymbolicLink() ||
        markerIdentity.dev !== candidateIdentity.dev ||
        markerIdentity.ino !== candidateIdentity.ino
      ) {
        fail(options);
      }
    }
    fs.rmSync(candidatePath, { force: true });
    const retainedDescriptor = descriptor ?? null;
    descriptor = undefined;
    return retainedDescriptor;
  } catch (error) {
    try {
      fs.rmSync(candidatePath, { force: true });
    } catch {
      // Preserve the publication error after attempting descriptor-safe cleanup.
    }
    if (descriptor !== undefined) closeOwnedDescriptorOrAbort(descriptor);
    throw error;
  }
}

function removeUnreturnedAuthoritativeMarkerOrAbort(markerPath: string): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.rmSync(markerPath, { force: true });
    } catch {
      // Confirm absence independently because Windows can surface transient removal failures.
    }
    try {
      fs.lstatSync(markerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    }
    if (attempt < 2) Atomics.wait(LOCK_SLEEP, 0, 0, 5);
  }
  process.abort();
}

function readLiveMarker(
  markerPath: string,
  options: ControlPlaneGenerationLockOptions,
  now: number
): LiveMarker | null {
  let stat: fs.Stats;
  let value: unknown;
  try {
    stat = fs.lstatSync(markerPath);
    if (!stat.isFile()) return { marker: null, markerPath };
    value = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    try {
      stat = fs.lstatSync(markerPath);
    } catch (statError) {
      if ((statError as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw statError;
    }
    value = null;
  }
  const marker = isKnownMarker(value, options.lockSchemaVersion) ? value : null;
  const nameMatches = marker && path.basename(markerPath) === expectedMarkerName(marker, options);
  const stale =
    marker && nameMatches
      ? Math.max(Number(marker.leaseExpiresAtMs), stat.mtimeMs + options.leaseMs) <= now &&
        !ownerGenerationAlive(marker.ownerPid, marker.ownerProcessStartIdentity)
      : false;
  if (stale) {
    fs.rmSync(markerPath, { force: true });
    return null;
  }
  return { marker: nameMatches ? marker : null, markerPath };
}

function scanLiveMarkers(options: ControlPlaneGenerationLockOptions): LiveMarker[] | null {
  const markerDirectory = path.dirname(options.lockPath);
  const markerPrefix = markerNamePrefix(options);
  const now = Date.now();
  const live: LiveMarker[] = [];
  let namesBefore: string[];
  try {
    namesBefore = fs
      .readdirSync(markerDirectory)
      .filter(
        (name) =>
          name.startsWith(markerPrefix) && (name.endsWith('.choosing') || name.endsWith('.ticket'))
      )
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return live;
    throw error;
  }
  for (const name of namesBefore) {
    const marker = readLiveMarker(path.join(markerDirectory, name), options, now);
    if (marker) live.push(marker);
  }
  const namesAfter = fs
    .readdirSync(markerDirectory)
    .filter(
      (name) =>
        name.startsWith(markerPrefix) && (name.endsWith('.choosing') || name.endsWith('.ticket'))
    )
    .sort();
  return namesBefore.length === live.length && namesBefore.join('\0') === namesAfter.join('\0')
    ? live
    : null;
}

function legacyRecordIsStale(
  artifactPath: string,
  expectedOwnerToken: string,
  allowedSchemas: readonly string[],
  leaseMs: number
): boolean {
  let stat: fs.Stats;
  let value: unknown;
  try {
    stat = fs.statSync(artifactPath);
    value = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    try {
      stat = fs.statSync(artifactPath);
    } catch (statError) {
      if ((statError as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw statError;
    }
    value = null;
  }
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (
    record &&
    typeof record.schemaVersion === 'string' &&
    allowedSchemas.includes(record.schemaVersion) &&
    typeof record.ownerPid === 'number' &&
    Number.isInteger(record.ownerPid) &&
    record.ownerPid > 0 &&
    typeof record.ownerToken === 'string' &&
    record.ownerToken.length > 0 &&
    record.ownerToken === expectedOwnerToken &&
    typeof record.acquiredAtMs === 'number' &&
    Number.isFinite(record.acquiredAtMs) &&
    typeof record.leaseExpiresAtMs === 'number' &&
    Number.isFinite(record.leaseExpiresAtMs) &&
    record.leaseExpiresAtMs >= record.acquiredAtMs &&
    (record.schemaVersion !== 'GoalContractActiveRunLock/v1' ||
      (typeof record.expectedBeforeHash === 'string' &&
        /^sha256:[0-9a-f]{64}$/u.test(record.expectedBeforeHash) &&
        typeof record.expectedBeforeVersion === 'number' &&
        Number.isSafeInteger(record.expectedBeforeVersion) &&
        record.expectedBeforeVersion >= 0 &&
        typeof record.candidateRunId === 'string' &&
        /^RUN-[0-9A-F]{16}$/u.test(record.candidateRunId)))
  ) {
    return record.leaseExpiresAtMs <= Date.now() && !ownerAlive(record.ownerPid);
  }
  return stat.mtimeMs + leaseMs <= Date.now();
}

function legacyArtifactsAllowEntry(options: ControlPlaneGenerationLockOptions): boolean {
  if (fs.existsSync(`${options.lockPath}.reclaim`)) return false;
  const directory = path.dirname(options.lockPath);
  const lockName = path.basename(options.lockPath);
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
  for (const name of names) {
    const reclaimQuarantine = name.startsWith(`${lockName}.reclaim.quarantine-`);
    const lockQuarantine = name.startsWith(`${lockName}.quarantine-`);
    if (!reclaimQuarantine && !lockQuarantine) continue;
    const artifactPath = path.join(directory, name);
    const quarantinePrefix = reclaimQuarantine
      ? `${lockName}.reclaim.quarantine-`
      : `${lockName}.quarantine-`;
    const expectedOwnerToken = name.slice(quarantinePrefix.length);
    const allowedSchemas = reclaimQuarantine
      ? ['GoalExecutionReclaimBarrier/v1']
      : (options.legacyLockSchemaVersions ?? []);
    if (!legacyRecordIsStale(artifactPath, expectedOwnerToken, allowedSchemas, options.leaseMs))
      return false;
    fs.rmSync(artifactPath, { force: true });
  }
  return true;
}

function waitForNextPoll(pollMs: number): void {
  Atomics.wait(LOCK_SLEEP, 0, 0, pollMs);
}

function fail(options: ControlPlaneGenerationLockOptions): never {
  throw new Error(options.conflictIssueCode);
}

function ensureOwnerDirectory(
  ownersPath: string,
  options: ControlPlaneGenerationLockOptions
): OwnerDirectoryIdentity {
  try {
    fs.mkdirSync(ownersPath, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return readOwnerDirectoryIdentity(ownersPath, options);
}

function readOwnerDirectoryIdentity(
  ownersPath: string,
  options: ControlPlaneGenerationLockOptions
): OwnerDirectoryIdentity {
  let stat: fs.BigIntStats;
  let realParent: string;
  let realOwners: string;
  try {
    stat = fs.lstatSync(ownersPath, { bigint: true });
    realParent = fs.realpathSync.native(path.dirname(ownersPath));
    realOwners = fs.realpathSync.native(ownersPath);
  } catch {
    return fail(options);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(options);
  const expectedOwners = path.join(realParent, path.basename(ownersPath));
  if (normalizedGuardLockPath(realOwners) !== normalizedGuardLockPath(expectedOwners)) {
    return fail(options);
  }
  return {
    realPath: normalizedGuardLockPath(realOwners),
    device: stat.dev,
    inode: stat.ino,
  };
}

function ownerDirectoryIdentityMatches(
  ownersPath: string,
  identity: OwnerDirectoryIdentity,
  options: ControlPlaneGenerationLockOptions
): boolean {
  try {
    const current = readOwnerDirectoryIdentity(ownersPath, options);
    return (
      current.realPath === identity.realPath &&
      current.device === identity.device &&
      current.inode === identity.inode
    );
  } catch {
    return false;
  }
}

function assertOwnerDirectoryIdentity(
  ownersPath: string,
  identity: OwnerDirectoryIdentity,
  options: ControlPlaneGenerationLockOptions
): void {
  if (!ownerDirectoryIdentityMatches(ownersPath, identity, options)) fail(options);
}

function startGenerationLease(
  ticketDescriptor: number,
  options: ControlPlaneGenerationLockOptions
): GenerationLease {
  try {
    fs.fstatSync(ticketDescriptor);
    const now = new Date();
    fs.futimesSync(ticketDescriptor, now, now);
  } catch {
    const closeError = closeOwnedDescriptorOrAbort(ticketDescriptor);
    if (closeError) throw closeError;
    return fail(options);
  }
  return { ticketDescriptor };
}

function stopGenerationLease(lease: GenerationLease): void {
  if (lease.ticketDescriptor !== null) {
    const closeError = closeOwnedDescriptorOrAbort(lease.ticketDescriptor);
    lease.ticketDescriptor = null;
    if (closeError) throw closeError;
  }
}

export function acquireControlPlaneGenerationLock(
  options: ControlPlaneGenerationLockOptions
): ControlPlaneGenerationLockHandle {
  const ownerProcessStartIdentity = ownProcessStartIdentity();
  const deadline = Date.now() + options.timeoutMs;
  fs.mkdirSync(path.dirname(options.lockPath), { recursive: true });
  ensureProtocolGuard(options);
  const ownersPath = ownerDirectory(options.lockPath);
  const ownerToken = randomBytes(16).toString('hex');
  const acquiredAtMs = Date.now();
  const markerBase = {
    schemaVersion: MARKER_SCHEMA,
    lockSchemaVersion: options.lockSchemaVersion,
    ownerPid: process.pid,
    ownerProcessStartIdentity,
    ownerToken,
    acquiredAtMs,
    leaseExpiresAtMs: acquiredAtMs + options.leaseMs,
  } as const;
  const ownerDirectoryIdentity = ensureOwnerDirectory(ownersPath, options);
  const choosingPath = path.join(
    path.dirname(options.lockPath),
    `${markerNamePrefix(options)}${ownerToken}.choosing`
  );
  let ticketPath = '';
  let ticketDescriptor: number | null = null;
  let lease: GenerationLease | null = null;
  try {
    publishMarker(choosingPath, { ...markerBase, markerKind: 'choosing', ticket: null }, options);
    let ticket: bigint | null = null;
    while (ticket === null && Date.now() < deadline) {
      const live = scanLiveMarkers(options);
      if (live && live.every(({ marker }) => marker !== null)) {
        ticket =
          live.reduce(
            (maximum, { marker }) =>
              marker?.markerKind === 'ticket' && BigInt(marker.ticket!) > maximum
                ? BigInt(marker.ticket!)
                : maximum,
            0n
          ) + 1n;
        break;
      }
      waitForNextPoll(options.pollMs);
    }
    if (ticket === null) fail(options);
    const ticketText = ticket.toString();
    ticketPath = path.join(
      path.dirname(options.lockPath),
      `${markerNamePrefix(options)}${ticketText.padStart(20, '0')}-${ownerToken}.ticket`
    );
    ticketDescriptor = publishMarker(
      ticketPath,
      {
        ...markerBase,
        markerKind: 'ticket',
        ticket: ticketText,
      },
      options,
      true
    );
    if (ticketDescriptor === null) fail(options);
    const leaseDescriptor = ticketDescriptor;
    ticketDescriptor = null;
    lease = startGenerationLease(leaseDescriptor, options);
    removeUnreturnedAuthoritativeMarkerOrAbort(choosingPath);

    while (Date.now() < deadline) {
      const live = scanLiveMarkers(options);
      if (!live) {
        waitForNextPoll(options.pollMs);
        continue;
      }
      const blocked = live.some(({ marker, markerPath }) => {
        if (markerPath === ticketPath) {
          return (
            !marker ||
            marker.markerKind !== 'ticket' ||
            marker.ownerToken !== ownerToken ||
            marker.ticket !== ticketText
          );
        }
        if (!marker || marker.markerKind === 'choosing') return true;
        const otherTicket = BigInt(marker.ticket!);
        return otherTicket < ticket! || (otherTicket === ticket && marker.ownerToken < ownerToken);
      });
      if (!blocked) {
        assertOwnerDirectoryIdentity(ownersPath, ownerDirectoryIdentity, options);
        if (!protocolGuardMatches(options)) fail(options);
        if (!legacyArtifactsAllowEntry(options)) fail(options);
        assertOwnerDirectoryIdentity(ownersPath, ownerDirectoryIdentity, options);
        const handle = Object.freeze({
          lockPath: options.lockPath,
          lockSchemaVersion: options.lockSchemaVersion,
          ownerToken,
          ticket: ticketText,
          ticketPath,
          [HANDLE_BRAND]: true,
        }) as BrandedControlPlaneGenerationLockHandle;
        ACTIVE_HANDLES.set(handle, {
          lockPath: handle.lockPath,
          lockSchemaVersion: handle.lockSchemaVersion,
          ownerToken: handle.ownerToken,
          ticket: handle.ticket,
          ticketPath: handle.ticketPath,
          lease,
        });
        return handle;
      }
      waitForNextPoll(options.pollMs);
    }
    fail(options);
  } catch (error) {
    let cleanupError: unknown;
    try {
      removeUnreturnedAuthoritativeMarkerOrAbort(choosingPath);
    } catch (error) {
      cleanupError = error;
    }
    if (ticketDescriptor !== null) {
      const closeError = closeOwnedDescriptorOrAbort(ticketDescriptor);
      if (!cleanupError && closeError) cleanupError = closeError;
    }
    if (lease) {
      try {
        stopGenerationLease(lease);
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (ticketPath) {
      try {
        removeUnreturnedAuthoritativeMarkerOrAbort(ticketPath);
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (cleanupError) throw cleanupError;
    throw error;
  }
  return fail(options);
}

export function releaseControlPlaneGenerationLock(handle: ControlPlaneGenerationLockHandle): void {
  const ownership = ACTIVE_HANDLES.get(handle);
  if (!ownership) throw new Error('control_plane_generation_lock_handle_invalid');
  const expectedDirectory = path.resolve(path.dirname(ownership.lockPath));
  const expectedName = `${path.basename(ownership.lockPath)}.owner-${ownership.ticket.padStart(20, '0')}-${ownership.ownerToken}.ticket`;
  if (
    (handle as Partial<BrandedControlPlaneGenerationLockHandle>)[HANDLE_BRAND] !== true ||
    handle.lockPath !== ownership.lockPath ||
    handle.lockSchemaVersion !== ownership.lockSchemaVersion ||
    handle.ownerToken !== ownership.ownerToken ||
    handle.ticket !== ownership.ticket ||
    handle.ticketPath !== ownership.ticketPath ||
    path.dirname(path.resolve(ownership.ticketPath)) !== expectedDirectory ||
    path.basename(ownership.ticketPath) !== expectedName
  ) {
    throw new Error('control_plane_generation_lock_handle_invalid');
  }
  stopGenerationLease(ownership.lease);
  if (!fs.existsSync(ownership.ticketPath)) {
    throw new Error('control_plane_generation_lock_handle_invalid');
  }
  let marker: unknown;
  try {
    marker = JSON.parse(fs.readFileSync(ownership.ticketPath, 'utf8')) as unknown;
  } catch {
    throw new Error('control_plane_generation_lock_handle_invalid');
  }
  if (
    !isKnownMarker(marker, ownership.lockSchemaVersion) ||
    marker.markerKind !== 'ticket' ||
    marker.ownerToken !== ownership.ownerToken ||
    marker.ticket !== ownership.ticket
  ) {
    throw new Error('control_plane_generation_lock_handle_invalid');
  }
  fs.rmSync(ownership.ticketPath);
  ACTIVE_HANDLES.delete(handle);
}
