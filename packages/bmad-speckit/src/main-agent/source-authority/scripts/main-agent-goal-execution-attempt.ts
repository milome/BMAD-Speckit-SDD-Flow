import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../../utils/goal-contract/control-plane/canonical-hash';
import {
  acquireControlPlaneGenerationLock,
  releaseControlPlaneGenerationLock,
  type ControlPlaneGenerationLockHandle,
} from '../../../utils/goal-contract/control-plane/control-plane-generation-lock';
import { validateGoalContractSchema } from '../../../utils/goal-contract/control-plane/schema-registry';
import { resolveCommittedActiveRun } from '../../../utils/goal-contract/control-plane/frozen-goal-activation';

export const GOAL_EXECUTION_ATTEMPT_POINTER_PATH =
  'goal/runtime/current-execution-attempt.json' as const;

export type GoalExecutionAttemptPhase =
  | 'prepared'
  | 'executing'
  | 'closure_pending'
  | 'blocked'
  | 'closed';

export interface GoalExecutionClosureRef {
  executionAuthorityId: string;
  path: string;
  hash: string;
}

export interface GoalExecutionAttemptAuthority {
  profile: 'requirements_backed' | 'standalone';
  candidateRunId: string;
  executionAuthorityId: string;
  executionAuthorityHash: string;
  executionPackageHash: string;
  dependencyExecutionAuthorityIds: string[];
  ownedPaths: string[];
}

export interface GoalExecutionAttemptPointer {
  schemaVersion: 'GoalExecutionAttemptPointer/v1';
  pointerVersion: number;
  executionAttemptId: string;
  activeRunPointerHash: string;
  activationRecordHash: string;
  orderedExecutionAuthorityIds: string[];
  executionAuthorities: GoalExecutionAttemptAuthority[];
  executionStarted: boolean;
  phase: GoalExecutionAttemptPhase;
  nextExecutionAuthorityId: string | null;
  validClosureRefs: GoalExecutionClosureRef[];
  blockedIssueCode: string | null;
  attemptPointerHash: string;
}

const ATTEMPT_POINTER_SCHEMA = 'goal-execution-attempt-pointer.schema.json';
const AUTHORITY_CLOSURE_SCHEMA = 'goal-execution-authority-closure.schema.json';
const ACTIVE_RUN_POINTER_SCHEMA = 'goal-contract-active-run-pointer.schema.json';
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const ATTEMPT_LOCK_TIMEOUT_MS = 2_000;
const ATTEMPT_LOCK_POLL_MS = 10;
const ATTEMPT_LOCK_LEASE_MS = 30_000;
const EXECUTION_CONTROL_LOCK_PATH = 'goal/runtime/execution-control.lock';
const EXECUTION_RUN_LEASE_PATH = 'goal/runtime/execution-run.lock';
const LEGAL_TRANSITIONS: Record<
  GoalExecutionAttemptPhase,
  ReadonlySet<GoalExecutionAttemptPhase>
> = {
  prepared: new Set(['executing', 'blocked']),
  executing: new Set(['executing', 'closure_pending', 'blocked']),
  closure_pending: new Set(['closure_pending', 'closed', 'blocked']),
  blocked: new Set(['blocked', 'executing', 'closure_pending']),
  closed: new Set(),
};

function fail(issueCode: string): never {
  throw new Error(issueCode);
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function pointerPath(outRoot: string): string {
  return path.join(path.resolve(outRoot), ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
}

function confinedPath(root: string, relativePath: string): string {
  if (
    !relativePath ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath === '..' ||
    relativePath.startsWith('../')
  ) {
    fail('goal_execution_attempt_closure_ref_invalid');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.split('/'));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail('goal_execution_attempt_closure_ref_invalid');
  }
  let existing = resolved;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) fail('goal_execution_attempt_closure_ref_invalid');
    existing = parent;
  }
  try {
    const realRoot = fs.realpathSync.native(resolvedRoot);
    const realExisting = fs.realpathSync.native(existing);
    if (realExisting !== realRoot && !realExisting.startsWith(`${realRoot}${path.sep}`)) {
      fail('goal_execution_attempt_closure_ref_invalid');
    }
  } catch {
    fail('goal_execution_attempt_closure_ref_invalid');
  }
  return resolved;
}

function payloadOf(pointer: GoalExecutionAttemptPointer) {
  const payload = { ...pointer };
  delete (payload as Partial<GoalExecutionAttemptPointer>).attemptPointerHash;
  return payload;
}

function verifyClosureRefs(outRoot: string, pointer: GoalExecutionAttemptPointer): void {
  const authorities = new Map(
    pointer.executionAuthorities.map((authority) => [authority.executionAuthorityId, authority])
  );
  const closedByAuthorityId = new Map<string, GoalExecutionClosureRef>();
  for (const closureRef of pointer.validClosureRefs) {
    const closurePath = confinedPath(outRoot, closureRef.path);
    let closure: Record<string, unknown>;
    try {
      closure = JSON.parse(fs.readFileSync(closurePath, 'utf8')) as Record<string, unknown>;
      validateGoalContractSchema(AUTHORITY_CLOSURE_SCHEMA, closure);
    } catch {
      fail('goal_execution_attempt_closure_ref_invalid');
    }
    const closurePayload = { ...closure };
    delete closurePayload.closureHash;
    const authority = authorities.get(closureRef.executionAuthorityId);
    const dependencyClosureRefs = Array.isArray(closure.dependencyClosureRefs)
      ? closure.dependencyClosureRefs
      : [];
    const expectedDependencyClosureRefs = authority
      ? authority.dependencyExecutionAuthorityIds.map((authorityId) =>
          closedByAuthorityId.get(authorityId)
        )
      : [];
    if (
      !authority ||
      closure.closureHash !== closureRef.hash ||
      hashControlPlaneValue(closurePayload) !== closureRef.hash ||
      closure.executionAuthorityId !== closureRef.executionAuthorityId ||
      closure.activeRunPointerHash !== pointer.activeRunPointerHash ||
      closure.activationRecordHash !== pointer.activationRecordHash ||
      closure.profile !== authority.profile ||
      closure.candidateRunId !== authority.candidateRunId ||
      closure.executionAuthorityHash !== authority.executionAuthorityHash ||
      closure.executionPackageHash !== authority.executionPackageHash ||
      !expectedDependencyClosureRefs.every(Boolean) ||
      stableControlPlaneStringify(dependencyClosureRefs) !==
        stableControlPlaneStringify(expectedDependencyClosureRefs) ||
      !Array.isArray(closure.changedPaths) ||
      closure.changedPaths.some(
        (changedPath) =>
          typeof changedPath !== 'string' || !authority.ownedPaths.includes(changedPath)
      ) ||
      !fs.readFileSync(closurePath).equals(canonicalBytes(closure))
    ) {
      fail('goal_execution_attempt_closure_ref_invalid');
    }
    closedByAuthorityId.set(closureRef.executionAuthorityId, closureRef);
  }
}

function verifyPointerSemantics(outRoot: string, pointer: GoalExecutionAttemptPointer): void {
  if (
    !SHA256.test(pointer.activeRunPointerHash) ||
    !SHA256.test(pointer.activationRecordHash) ||
    pointer.executionAuthorities.length !== pointer.orderedExecutionAuthorityIds.length ||
    stableControlPlaneStringify(
      pointer.executionAuthorities.map((authority) => authority.executionAuthorityId)
    ) !== stableControlPlaneStringify(pointer.orderedExecutionAuthorityIds) ||
    hashControlPlaneValue(payloadOf(pointer)) !== pointer.attemptPointerHash
  ) {
    fail('goal_execution_attempt_pointer_invalid');
  }
  const closureIds = pointer.validClosureRefs.map((ref) => ref.executionAuthorityId);
  let previousAuthorityIndex = -1;
  for (const authorityId of closureIds) {
    const authorityIndex = pointer.orderedExecutionAuthorityIds.indexOf(authorityId);
    if (authorityIndex <= previousAuthorityIndex) {
      fail('goal_execution_attempt_progress_invalid');
    }
    previousAuthorityIndex = authorityIndex;
  }
  const allClosed = closureIds.length === pointer.orderedExecutionAuthorityIds.length;
  const closedAuthorities = new Set(closureIds);
  const expectedNext =
    pointer.orderedExecutionAuthorityIds.find(
      (authorityId) => !closedAuthorities.has(authorityId)
    ) ?? null;
  if (
    (pointer.phase === 'prepared' &&
      (closureIds.length !== 0 || pointer.nextExecutionAuthorityId !== expectedNext)) ||
    ((pointer.phase === 'executing' || pointer.phase === 'blocked') &&
      pointer.nextExecutionAuthorityId !== expectedNext) ||
    ((pointer.phase === 'closure_pending' || pointer.phase === 'closed') &&
      (!allClosed || pointer.nextExecutionAuthorityId !== null)) ||
    (pointer.phase === 'blocked') !== Boolean(pointer.blockedIssueCode)
  ) {
    fail('goal_execution_attempt_progress_invalid');
  }
  if (
    (!pointer.executionStarted && !['prepared', 'blocked'].includes(pointer.phase)) ||
    (!pointer.executionStarted && closureIds.length !== 0) ||
    (pointer.executionStarted && pointer.phase === 'prepared')
  ) {
    fail('goal_execution_attempt_progress_invalid');
  }
  verifyClosureRefs(outRoot, pointer);
}

function parsePointer(outRoot: string, targetPath: string): GoalExecutionAttemptPointer {
  let pointer: GoalExecutionAttemptPointer;
  try {
    pointer = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as GoalExecutionAttemptPointer;
    validateGoalContractSchema(ATTEMPT_POINTER_SCHEMA, pointer);
  } catch {
    fail('goal_execution_attempt_pointer_invalid');
  }
  if (!fs.readFileSync(targetPath).equals(canonicalBytes(pointer))) {
    fail('goal_execution_attempt_pointer_invalid');
  }
  verifyPointerSemantics(outRoot, pointer);
  return pointer;
}

export function readGoalExecutionAttemptPointer(input: {
  outRoot: string;
}): GoalExecutionAttemptPointer | null {
  const targetPath = pointerPath(input.outRoot);
  return fs.existsSync(targetPath) ? parsePointer(path.resolve(input.outRoot), targetPath) : null;
}

function acquireAttemptLock(lockPath: string): ControlPlaneGenerationLockHandle {
  return acquireControlPlaneGenerationLock({
    lockPath,
    lockSchemaVersion: 'GoalExecutionAttemptPointerLock/v2',
    legacyLockSchemaVersions: ['GoalExecutionAttemptPointerLock/v1'],
    timeoutMs: ATTEMPT_LOCK_TIMEOUT_MS,
    pollMs: ATTEMPT_LOCK_POLL_MS,
    leaseMs: ATTEMPT_LOCK_LEASE_MS,
    conflictIssueCode: 'goal_execution_attempt_cas_conflict',
  });
}

function executionControlLockPath(outRoot: string): string {
  return path.join(path.resolve(outRoot), ...EXECUTION_CONTROL_LOCK_PATH.split('/'));
}

function acquireGoalExecutionControlLock(outRoot: string): ControlPlaneGenerationLockHandle {
  const lockPath = executionControlLockPath(outRoot);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  return acquireControlPlaneGenerationLock({
    lockPath,
    lockSchemaVersion: 'GoalExecutionControlLock/v2',
    legacyLockSchemaVersions: ['GoalExecutionControlLock/v1'],
    timeoutMs: ATTEMPT_LOCK_TIMEOUT_MS,
    pollMs: ATTEMPT_LOCK_POLL_MS,
    leaseMs: ATTEMPT_LOCK_LEASE_MS,
    conflictIssueCode: 'goal_execution_attempt_cas_conflict',
  });
}

export type GoalExecutionRunLease = ControlPlaneGenerationLockHandle;

export function acquireGoalExecutionRunLease(outRoot: string): GoalExecutionRunLease {
  const lockPath = path.join(path.resolve(outRoot), ...EXECUTION_RUN_LEASE_PATH.split('/'));
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  return acquireControlPlaneGenerationLock({
    lockPath,
    lockSchemaVersion: 'GoalExecutionRunLease/v1',
    timeoutMs: ATTEMPT_LOCK_TIMEOUT_MS,
    pollMs: ATTEMPT_LOCK_POLL_MS,
    leaseMs: ATTEMPT_LOCK_LEASE_MS,
    conflictIssueCode: 'goal_execution_attempt_in_progress',
  });
}

export function releaseGoalExecutionRunLease(lease: GoalExecutionRunLease): void {
  releaseControlPlaneGenerationLock(lease);
}

function verifyCommittedActiveRun(input: {
  outRoot: string;
  activeRunPointerHash: string;
  activationRecordHash: string;
}): void {
  const activeRunPath = path.join(
    path.resolve(input.outRoot),
    'goal',
    'runtime',
    'active-run.json'
  );
  let pointer: Record<string, unknown>;
  try {
    pointer = JSON.parse(fs.readFileSync(activeRunPath, 'utf8')) as Record<string, unknown>;
    validateGoalContractSchema(ACTIVE_RUN_POINTER_SCHEMA, pointer);
  } catch {
    fail('goal_execution_attempt_cas_conflict');
  }
  const payload = { ...pointer };
  delete payload.activeRunPointerHash;
  if (
    pointer.activeRunPointerHash !== input.activeRunPointerHash ||
    pointer.activationRecordHash !== input.activationRecordHash ||
    hashControlPlaneValue(payload) !== pointer.activeRunPointerHash ||
    !fs.readFileSync(activeRunPath).equals(canonicalBytes(pointer))
  ) {
    fail('goal_execution_attempt_cas_conflict');
  }
}

function authoritySnapshot(
  authorities: GoalExecutionAttemptAuthority[]
): GoalExecutionAttemptAuthority[] {
  return authorities.map((authority) => ({
    profile: authority.profile,
    candidateRunId: authority.candidateRunId,
    executionAuthorityId: authority.executionAuthorityId,
    executionAuthorityHash: authority.executionAuthorityHash,
    executionPackageHash: authority.executionPackageHash,
    dependencyExecutionAuthorityIds: [...authority.dependencyExecutionAuthorityIds],
    ownedPaths: [...authority.ownedPaths].sort(),
  }));
}

function committedAuthoritySnapshot(input: {
  projectRoot: string;
  outRoot: string;
}): GoalExecutionAttemptAuthority[] {
  const committed = resolveCommittedActiveRun({
    projectRoot: input.projectRoot,
    activeRunPointerPath: path.join(input.outRoot, 'goal', 'runtime', 'active-run.json'),
  });
  if (path.resolve(committed.outRoot) !== path.resolve(input.outRoot)) {
    fail('goal_execution_attempt_cas_conflict');
  }
  return authoritySnapshot(committed.executionAuthorities as GoalExecutionAttemptAuthority[]);
}

function verifyAttemptAuthorityInput(input: {
  projectRoot: string;
  outRoot: string;
  activeRunPointerHash: string;
  activationRecordHash: string;
  orderedExecutionAuthorityIds: string[];
  executionAuthorities: GoalExecutionAttemptAuthority[];
}): GoalExecutionAttemptAuthority[] {
  verifyCommittedActiveRun(input);
  const executionAuthorities = committedAuthoritySnapshot(input);
  if (
    stableControlPlaneStringify(authoritySnapshot(input.executionAuthorities)) !==
      stableControlPlaneStringify(executionAuthorities) ||
    stableControlPlaneStringify(
      executionAuthorities.map((authority) => authority.executionAuthorityId)
    ) !== stableControlPlaneStringify(input.orderedExecutionAuthorityIds)
  ) {
    fail('goal_execution_attempt_cas_conflict');
  }
  return executionAuthorities;
}

function commitPointer(input: {
  outRoot: string;
  expectedPointerHash: string | null;
  expectedPointerVersion: number;
  pointer: GoalExecutionAttemptPointer;
}): GoalExecutionAttemptPointer {
  const outRoot = path.resolve(input.outRoot);
  const targetPath = pointerPath(outRoot);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const lockPath = `${targetPath}.lock`;
  const lock = acquireAttemptLock(lockPath);
  let temporaryPath = '';
  try {
    const current = fs.existsSync(targetPath) ? parsePointer(outRoot, targetPath) : null;
    if (
      (current?.attemptPointerHash ?? null) !== input.expectedPointerHash ||
      (current?.pointerVersion ?? 0) !== input.expectedPointerVersion
    ) {
      fail('goal_execution_attempt_cas_conflict');
    }
    validateGoalContractSchema(ATTEMPT_POINTER_SCHEMA, input.pointer);
    verifyPointerSemantics(outRoot, input.pointer);
    const bytes = canonicalBytes(input.pointer);
    temporaryPath = `${targetPath}.candidate-${process.pid}-${Date.now()}-${process.hrtime.bigint()}`;
    const descriptor = fs.openSync(temporaryPath, 'wx');
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, targetPath);
    temporaryPath = '';
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      fail('goal_execution_attempt_pointer_invalid');
    }
    return input.pointer;
  } finally {
    if (temporaryPath && fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    releaseControlPlaneGenerationLock(lock);
  }
}

export function prepareGoalExecutionAttempt(input: {
  outRoot: string;
  projectRoot: string;
  activeRunPointerHash: string;
  activationRecordHash: string;
  orderedExecutionAuthorityIds: string[];
  executionAuthorities: GoalExecutionAttemptAuthority[];
}): { pointer: GoalExecutionAttemptPointer; recovered: boolean } {
  const outRoot = path.resolve(input.outRoot);
  verifyAttemptAuthorityInput({ ...input, outRoot });
  const controlLock = acquireGoalExecutionControlLock(outRoot);
  try {
    const executionAuthorities = verifyAttemptAuthorityInput({ ...input, outRoot });
    const current = readGoalExecutionAttemptPointer({ outRoot });
    let expectedPointerHash: string | null = null;
    let expectedPointerVersion = 0;
    if (current) {
      if (
        current.activeRunPointerHash === input.activeRunPointerHash &&
        current.activationRecordHash === input.activationRecordHash &&
        stableControlPlaneStringify(current.orderedExecutionAuthorityIds) ===
          stableControlPlaneStringify(input.orderedExecutionAuthorityIds) &&
        stableControlPlaneStringify(current.executionAuthorities) ===
          stableControlPlaneStringify(executionAuthorities)
      ) {
        return { pointer: current, recovered: true };
      }
      if (current.phase !== 'closed') fail('goal_execution_attempt_cas_conflict');
      expectedPointerHash = current.attemptPointerHash;
      expectedPointerVersion = current.pointerVersion;
    }
    const payload = {
      schemaVersion: 'GoalExecutionAttemptPointer/v1' as const,
      pointerVersion: 1,
      executionAttemptId: `ATTEMPT-${randomBytes(8).toString('hex').toUpperCase()}`,
      activeRunPointerHash: input.activeRunPointerHash,
      activationRecordHash: input.activationRecordHash,
      orderedExecutionAuthorityIds: [...input.orderedExecutionAuthorityIds],
      executionAuthorities,
      executionStarted: false,
      phase: 'prepared' as const,
      nextExecutionAuthorityId: input.orderedExecutionAuthorityIds[0] ?? null,
      validClosureRefs: [] as GoalExecutionClosureRef[],
      blockedIssueCode: null,
    };
    const pointer = {
      ...payload,
      attemptPointerHash: hashControlPlaneValue(payload),
    };
    verifyCommittedActiveRun(input);
    return {
      pointer: commitPointer({
        outRoot,
        expectedPointerHash,
        expectedPointerVersion,
        pointer,
      }),
      recovered: false,
    };
  } finally {
    releaseControlPlaneGenerationLock(controlLock);
  }
}

export function deriveGoalExecutionInvalidationSet(
  executionAuthorities: GoalExecutionAttemptAuthority[],
  invalidationRoots: readonly string[]
): string[] {
  const authorityIds = new Set(
    executionAuthorities.map((authority) => authority.executionAuthorityId)
  );
  if (
    invalidationRoots.length === 0 ||
    new Set(invalidationRoots).size !== invalidationRoots.length ||
    invalidationRoots.some((authorityId) => !authorityIds.has(authorityId))
  ) {
    fail('goal_execution_remediation_boundary_invalid');
  }
  const invalidated = new Set(invalidationRoots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const authority of executionAuthorities) {
      if (
        !invalidated.has(authority.executionAuthorityId) &&
        authority.dependencyExecutionAuthorityIds.some((dependencyId) =>
          invalidated.has(dependencyId)
        )
      ) {
        invalidated.add(authority.executionAuthorityId);
        changed = true;
      }
    }
  }
  return executionAuthorities
    .map((authority) => authority.executionAuthorityId)
    .filter((authorityId) => invalidated.has(authorityId));
}

export function remediateGoalExecutionAttempt(input: {
  outRoot: string;
  projectRoot: string;
  activeRunPointerHash: string;
  activationRecordHash: string;
  orderedExecutionAuthorityIds: string[];
  executionAuthorities: GoalExecutionAttemptAuthority[];
  remediateFrom: string | readonly string[];
}): { pointer: GoalExecutionAttemptPointer; invalidatedExecutionAuthorityIds: string[] } {
  const outRoot = path.resolve(input.outRoot);
  verifyAttemptAuthorityInput({ ...input, outRoot });
  const controlLock = acquireGoalExecutionControlLock(outRoot);
  try {
    const executionAuthorities = verifyAttemptAuthorityInput({ ...input, outRoot });
    const current = readGoalExecutionAttemptPointer({ outRoot });
    if (
      !current ||
      !current.executionStarted ||
      current.activeRunPointerHash !== input.activeRunPointerHash ||
      current.activationRecordHash !== input.activationRecordHash ||
      stableControlPlaneStringify(current.executionAuthorities) !==
        stableControlPlaneStringify(executionAuthorities)
    ) {
      fail('goal_execution_remediation_boundary_invalid');
    }
    const invalidatedExecutionAuthorityIds = deriveGoalExecutionInvalidationSet(
      executionAuthorities,
      typeof input.remediateFrom === 'string' ? [input.remediateFrom] : input.remediateFrom
    );
    const invalidated = new Set(invalidatedExecutionAuthorityIds);
    const validClosureRefs = current.validClosureRefs.filter(
      (closureRef) => !invalidated.has(closureRef.executionAuthorityId)
    );
    const closedAuthorityIds = new Set(
      validClosureRefs.map((closureRef) => closureRef.executionAuthorityId)
    );
    const nextExecutionAuthorityId = current.orderedExecutionAuthorityIds.find(
      (authorityId) => !closedAuthorityIds.has(authorityId)
    );
    if (!nextExecutionAuthorityId) fail('goal_execution_remediation_boundary_invalid');
    const payload = {
      ...payloadOf(current),
      pointerVersion: current.pointerVersion + 1,
      executionAttemptId: `ATTEMPT-${randomBytes(8).toString('hex').toUpperCase()}`,
      executionStarted: true,
      phase: 'executing' as const,
      nextExecutionAuthorityId,
      validClosureRefs,
      blockedIssueCode: null,
    } as Omit<GoalExecutionAttemptPointer, 'attemptPointerHash'>;
    const pointer = {
      ...payload,
      attemptPointerHash: hashControlPlaneValue(payload),
    };
    verifyCommittedActiveRun(input);
    return {
      pointer: commitPointer({
        outRoot,
        expectedPointerHash: current.attemptPointerHash,
        expectedPointerVersion: current.pointerVersion,
        pointer,
      }),
      invalidatedExecutionAuthorityIds,
    };
  } finally {
    releaseControlPlaneGenerationLock(controlLock);
  }
}

export function transitionGoalExecutionAttempt(input: {
  outRoot: string;
  expectedPointerHash: string;
  expectedPointerVersion: number;
  phase: GoalExecutionAttemptPhase;
  nextExecutionAuthorityId: string | null;
  validClosureRefs: GoalExecutionClosureRef[];
  blockedIssueCode: string | null;
}): { pointer: GoalExecutionAttemptPointer } {
  const outRoot = path.resolve(input.outRoot);
  const current = readGoalExecutionAttemptPointer({ outRoot });
  if (
    !current ||
    current.attemptPointerHash !== input.expectedPointerHash ||
    current.pointerVersion !== input.expectedPointerVersion
  ) {
    fail('goal_execution_attempt_cas_conflict');
  }
  if (!LEGAL_TRANSITIONS[current.phase].has(input.phase)) {
    fail('goal_execution_attempt_transition_invalid');
  }
  const nextClosureByAuthorityId = new Map(
    input.validClosureRefs.map((closureRef) => [closureRef.executionAuthorityId, closureRef])
  );
  if (
    nextClosureByAuthorityId.size !== input.validClosureRefs.length ||
    current.validClosureRefs.some((closureRef) => {
      const retained = nextClosureByAuthorityId.get(closureRef.executionAuthorityId);
      return (
        !retained ||
        stableControlPlaneStringify(closureRef) !== stableControlPlaneStringify(retained)
      );
    })
  ) {
    fail('goal_execution_attempt_closure_history_conflict');
  }
  if (!current.executionStarted && input.validClosureRefs.length !== 0) {
    fail('goal_execution_attempt_transition_invalid');
  }
  const payload = {
    ...payloadOf(current),
    pointerVersion: current.pointerVersion + 1,
    executionStarted:
      current.executionStarted || ['executing', 'closure_pending', 'closed'].includes(input.phase),
    phase: input.phase,
    nextExecutionAuthorityId: input.nextExecutionAuthorityId,
    validClosureRefs: input.validClosureRefs.map((ref) => ({ ...ref })),
    blockedIssueCode: input.blockedIssueCode,
  } as Omit<GoalExecutionAttemptPointer, 'attemptPointerHash'>;
  const pointer = {
    ...payload,
    attemptPointerHash: hashControlPlaneValue(payload),
  };
  try {
    return {
      pointer: commitPointer({
        outRoot,
        expectedPointerHash: input.expectedPointerHash,
        expectedPointerVersion: input.expectedPointerVersion,
        pointer,
      }),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'goal_execution_attempt_progress_invalid') {
      fail('goal_execution_attempt_transition_invalid');
    }
    throw error;
  }
}
