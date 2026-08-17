import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  acquireGoalExecutionRunLease,
  deriveGoalExecutionInvalidationSet,
  GOAL_EXECUTION_ATTEMPT_POINTER_PATH,
  prepareGoalExecutionAttempt,
  readGoalExecutionAttemptPointer,
  releaseGoalExecutionRunLease,
  transitionGoalExecutionAttempt,
  type GoalExecutionAttemptAuthority,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-execution-attempt';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-hash';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { materializeGoalRunExecutionAdapter } from '../helpers/goal-run-execution-adapter-fixture';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const roots: string[] = [];
const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const ACTIVATION_MODULE = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-activation.ts'
);
const ATTEMPT_MODULE = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'main-agent-goal-execution-attempt.ts'
);
const LOCK_PRELOAD = path.join(ROOT, 'tests', 'fixtures', 'control-plane-lock-preload.cjs');
const RUNTIME_RUNNER = [
  'const fs = require("node:fs");',
  'const runtime = require(process.argv[1]);',
  'const payload = JSON.parse(Buffer.from(process.argv[3], "base64").toString("utf8"));',
  'const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")).map(([key, child]) => [key, canonicalize(child)])) : value;',
  'const writeCanonical = (targetPath, value) => fs.writeFileSync(targetPath, `${JSON.stringify(canonicalize(value))}\\n`, "utf8");',
  'const secondArgument = {};',
  'if (payload.beforeAttemptCommitWrite) secondArgument.beforeAttemptCommit = () => writeCanonical(payload.beforeAttemptCommitWrite.path, payload.beforeAttemptCommitWrite.value);',
  'try {',
  '  const result = runtime[process.argv[2]](payload.input, secondArgument);',
  '  process.stdout.write(JSON.stringify({ ok: true, result }));',
  '} catch (error) {',
  '  process.stdout.write(JSON.stringify({ ok: false, issueCode: error.failureClass || error.message }));',
  '  process.exitCode = 1;',
  '}',
].join('\n');

interface AttemptRuntimeScenario {
  beforeAttemptCommitWrite?: { path: string; value: unknown };
  lockFault?: {
    operation: 'writeFileSync' | 'fsyncSync';
    pathIncludes: string;
    pathEndsWith?: '.choosing' | '.ticket';
    eventPath: string;
  };
  lockHold?: {
    pathIncludes: string;
    stagePath: string;
    resumePath: string;
  };
  lockPublishHold?: {
    pathIncludes: string;
    pathEndsWith: '.choosing' | '.ticket';
    stagePath: string;
    resumePath: string;
  };
  criticalHold?: {
    pathIncludes: string;
    stagePath: string;
    resumePath: string;
  };
}

function callRuntime<T>(
  modulePath: string,
  exportName: string,
  input: unknown,
  scenario: AttemptRuntimeScenario = {}
) {
  const env = runtimeEnvironment(scenario);
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      RUNTIME_RUNNER,
      modulePath,
      exportName,
      Buffer.from(JSON.stringify({ input, ...scenario }), 'utf8').toString('base64'),
    ],
    { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return {
    ...completed,
    output: JSON.parse(completed.stdout) as
      | { ok: true; result: T }
      | { ok: false; issueCode: string },
  };
}

function runtimeEnvironment(scenario: AttemptRuntimeScenario) {
  return {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${LOCK_PRELOAD}`].filter(Boolean).join(' '),
    ...(scenario.lockFault
      ? {
          BMAD_LOCK_FAULT_OPERATION: scenario.lockFault.operation,
          BMAD_LOCK_FAULT_PATH_INCLUDES: scenario.lockFault.pathIncludes,
          ...(scenario.lockFault.pathEndsWith
            ? { BMAD_LOCK_FAULT_PATH_ENDS_WITH: scenario.lockFault.pathEndsWith }
            : {}),
          BMAD_LOCK_EVENT_PATH: scenario.lockFault.eventPath,
        }
      : {}),
    ...(scenario.lockHold
      ? {
          BMAD_LOCK_HOLD_PATH_INCLUDES: scenario.lockHold.pathIncludes,
          BMAD_LOCK_HOLD_STAGE: scenario.lockHold.stagePath,
          BMAD_LOCK_HOLD_RESUME: scenario.lockHold.resumePath,
        }
      : {}),
    ...(scenario.lockPublishHold
      ? {
          BMAD_LOCK_LINK_HOLD_PATH_INCLUDES: scenario.lockPublishHold.pathIncludes,
          BMAD_LOCK_LINK_HOLD_PATH_ENDS_WITH: scenario.lockPublishHold.pathEndsWith,
          BMAD_LOCK_LINK_HOLD_STAGE: scenario.lockPublishHold.stagePath,
          BMAD_LOCK_LINK_HOLD_RESUME: scenario.lockPublishHold.resumePath,
        }
      : {}),
    ...(scenario.criticalHold
      ? {
          BMAD_LOCK_CRITICAL_PATH_INCLUDES: scenario.criticalHold.pathIncludes,
          BMAD_LOCK_CRITICAL_STAGE: scenario.criticalHold.stagePath,
          BMAD_LOCK_CRITICAL_RESUME: scenario.criticalHold.resumePath,
        }
      : {}),
  };
}

function callRuntimeAsync<T>(
  modulePath: string,
  exportName: string,
  input: unknown,
  scenario: AttemptRuntimeScenario
) {
  return new Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
    output: { ok: true; result: T } | { ok: false; issueCode: string };
  }>((resolve) => {
    const child = spawn(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        modulePath,
        exportName,
        Buffer.from(JSON.stringify({ input, ...scenario }), 'utf8').toString('base64'),
      ],
      { cwd: ROOT, env: runtimeEnvironment(scenario), stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => {
      resolve({
        status,
        stdout,
        stderr,
        output: JSON.parse(stdout) as { ok: true; result: T } | { ok: false; issueCode: string },
      });
    });
  });
}

async function waitForPath(targetPath: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(targetPath)) {
    if (Date.now() >= deadline) throw new Error(`lock_test_timeout:${targetPath}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function lateV1CanAcquire(lockPath: string): boolean {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(lockPath, 'wx');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
    }
  }
}

function requireRuntime<T>(
  modulePath: string,
  exportName: string,
  input: unknown,
  scenario: AttemptRuntimeScenario = {}
): T {
  const completed = callRuntime<T>(modulePath, exportName, input, scenario);
  if (!completed.output.ok) throw new Error(completed.output.issueCode);
  return completed.output.result;
}

function temporaryOutRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'goal-execution-attempt-'));
  roots.push(root);
  return path.join(root, 'goal-run');
}

function writeCanonical(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function writeGenerationTicket(input: {
  lockPath: string;
  lockSchemaVersion: string;
  ownerPid: number;
  ownerToken: string;
  acquiredAtMs: number;
  leaseExpiresAtMs: number;
}): string {
  const ticketPath = `${input.lockPath}.owner-00000000000000000001-${input.ownerToken}.ticket`;
  writeCanonical(ticketPath, {
    schemaVersion: 'ControlPlaneGenerationLockMarker/v1',
    lockSchemaVersion: input.lockSchemaVersion,
    markerKind: 'ticket',
    ownerPid: input.ownerPid,
    ownerProcessStartIdentity:
      input.ownerPid === process.pid
        ? 'unavailable:00000000000000000000000000000000'
        : 'linux-start-ticks:0',
    ownerToken: input.ownerToken,
    ticket: '1',
    acquiredAtMs: input.acquiredAtMs,
    leaseExpiresAtMs: input.leaseExpiresAtMs,
  });
  return ticketPath;
}

function writeClosure(
  outRoot: string,
  authorityOrId: GoalExecutionAttemptAuthority | string,
  suffix = ''
) {
  const executionAuthority =
    typeof authorityOrId === 'string' ? authority(authorityOrId) : authorityOrId;
  const activeRunPath = path.join(outRoot, 'goal', 'runtime', 'active-run.json');
  const active = existsSync(activeRunPath)
    ? JSON.parse(readFileSync(activeRunPath, 'utf8'))
    : { activeRunPointerHash: HASH_A, activationRecordHash: HASH_B };
  const payload = {
    schemaVersion: 'GoalExecutionAuthorityClosure/v1',
    profile: executionAuthority.profile,
    candidateRunId: executionAuthority.candidateRunId,
    activeRunPointerHash: active.activeRunPointerHash,
    activationRecordHash: active.activationRecordHash,
    executionAuthorityId: executionAuthority.executionAuthorityId,
    executionAuthorityHash: executionAuthority.executionAuthorityHash,
    executionPackageHash: executionAuthority.executionPackageHash,
    evidenceRef: { path: 'goal/runtime/evidence.json', hash: `sha256:${'e'.repeat(64)}` },
    dependencyClosureRefs: [],
    changedPaths: [],
    commitProof: { kind: 'not_applicable' },
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    decision: 'pass',
  };
  const closure = { ...payload, closureHash: hashControlPlaneValue(payload) };
  const relativePath = `goal/runtime/closures/${executionAuthority.executionAuthorityId}${suffix}.json`;
  writeCanonical(path.join(outRoot, ...relativePath.split('/')), closure);
  return {
    executionAuthorityId: executionAuthority.executionAuthorityId,
    path: relativePath,
    hash: closure.closureHash,
  };
}

function authority(executionAuthorityId: string, input: Record<string, unknown> = {}) {
  return {
    profile: 'requirements_backed',
    candidateRunId: 'RUN-AAAAAAAAAAAAAAAA',
    executionAuthorityId,
    executionAuthorityHash: `sha256:${'c'.repeat(64)}`,
    executionPackageHash: `sha256:${'d'.repeat(64)}`,
    dependencyExecutionAuthorityIds: [],
    ownedPaths: [`src/${executionAuthorityId.toLowerCase()}.ts`],
    ...input,
  };
}

function committedAttemptInput(outRoot: string) {
  const projectRoot = path.dirname(outRoot);
  const activeRunPointerPath = path.join(outRoot, 'goal', 'runtime', 'active-run.json');
  if (!existsSync(activeRunPointerPath)) {
    const fixture = materializeImplementationReadinessFixture({ root: projectRoot });
    produceImplementationReadiness({ projectRoot, requestId: fixture.requestId });
    const generated = compileRequirementsBackedGoal({
      projectRoot,
      requirementRecordPath: fixture.runtimeRecordPath,
      outRoot,
    });
    materializeGoalRunExecutionAdapter(outRoot);
    requireRuntime(ACTIVATION_MODULE, 'activateFrozenGoalAuthority', {
      projectRoot,
      goalAuthorityPath: generated.activeAuthorityRef.path,
    });
  }
  const committed = requireRuntime<{
    outRoot: string;
    activeRunPointer: Record<string, unknown>;
    activationRecord: Record<string, unknown>;
    orderedExecutionAuthorityIds: string[];
    executionAuthorities: Array<Record<string, unknown>>;
  }>(ACTIVATION_MODULE, 'resolveCommittedActiveRun', { projectRoot, activeRunPointerPath });
  const executionAuthorities = committed.executionAuthorities.map((entry) => ({
    profile: String(entry.profile),
    candidateRunId: String(entry.candidateRunId),
    executionAuthorityId: String(entry.executionAuthorityId),
    executionAuthorityHash: String(entry.executionAuthorityHash),
    executionPackageHash: String(entry.executionPackageHash),
    dependencyExecutionAuthorityIds: Array.isArray(entry.dependencyExecutionAuthorityIds)
      ? entry.dependencyExecutionAuthorityIds.map(String)
      : [],
    ownedPaths: Array.isArray(entry.ownedPaths) ? entry.ownedPaths.map(String) : [],
  }));
  return {
    projectRoot,
    outRoot: committed.outRoot,
    activeRunPointerHash: String(committed.activeRunPointer.activeRunPointerHash),
    activationRecordHash: String(committed.activationRecord.activationRecordHash),
    orderedExecutionAuthorityIds: [...committed.orderedExecutionAuthorityIds],
    executionAuthorities,
  };
}

function prepareAttemptInput(
  input: ReturnType<typeof committedAttemptInput>,
  scenario: AttemptRuntimeScenario = {}
) {
  return requireRuntime<ReturnType<typeof prepareGoalExecutionAttempt>>(
    ATTEMPT_MODULE,
    'prepareGoalExecutionAttempt',
    input,
    scenario
  );
}

function prepareAttempt(outRoot: string, scenario: AttemptRuntimeScenario = {}) {
  return prepareAttemptInput(committedAttemptInput(outRoot), scenario);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('GoalExecutionAttemptPointer/v1', () => {
  it('invalidates the union of every stale root and all transitive dependents', () => {
    expect(
      deriveGoalExecutionInvalidationSet(
        [
          authority('AUTH-001'),
          authority('AUTH-002'),
          authority('AUTH-003', { dependencyExecutionAuthorityIds: ['AUTH-001'] }),
          authority('AUTH-004', { dependencyExecutionAuthorityIds: ['AUTH-002'] }),
        ],
        ['AUTH-001', 'AUTH-002']
      )
    ).toEqual(['AUTH-001', 'AUTH-002', 'AUTH-003', 'AUTH-004']);
  });

  it('allows only one live execution lease for the mutation and publication interval', () => {
    const outRoot = temporaryOutRoot();
    const lease = acquireGoalExecutionRunLease(outRoot);
    try {
      expect(() => acquireGoalExecutionRunLease(outRoot)).toThrowError(
        'goal_execution_attempt_in_progress'
      );
    } finally {
      releaseGoalExecutionRunLease(lease);
    }
    const nextLease = acquireGoalExecutionRunLease(outRoot);
    releaseGoalExecutionRunLease(nextLease);
  });

  it('does not execute caller callbacks passed as a prepare second argument', () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const sentinelPath = path.join(outRoot, 'goal', 'runtime', 'callback-sentinel.json');

    const completed = callRuntime<ReturnType<typeof prepareGoalExecutionAttempt>>(
      ATTEMPT_MODULE,
      'prepareGoalExecutionAttempt',
      attemptInput,
      {
        beforeAttemptCommitWrite: {
          path: sentinelPath,
          value: { callbackExecuted: true },
        },
      }
    );

    expect(completed.output.ok).toBe(true);
    expect(existsSync(sentinelPath)).toBe(false);
  });

  it.each(['writeFileSync', 'fsyncSync'] as const)(
    'closes and removes a control choosing generation after %s fails',
    (operation) => {
      const outRoot = temporaryOutRoot();
      const attemptInput = committedAttemptInput(outRoot);
      const lockPath = path.join(outRoot, 'goal', 'runtime', 'execution-control.lock');
      const eventPath = path.join(outRoot, 'goal', 'runtime', `writer-${operation}.events`);

      const completed = callRuntime(ATTEMPT_MODULE, 'prepareGoalExecutionAttempt', attemptInput, {
        lockFault: {
          operation,
          pathIncludes: lockPath,
          pathEndsWith: '.choosing',
          eventPath,
        },
      });
      const events = readFileSync(eventPath, 'utf8').trim().split('\n');

      expect(completed.output).toEqual({
        ok: false,
        issueCode:
          operation === 'writeFileSync'
            ? 'injected_lock_write_failure'
            : 'injected_lock_fsync_failure',
      });
      expect(events.some((event) => event.startsWith('close:'))).toBe(true);
      expect(JSON.parse(readFileSync(lockPath, 'utf8'))).toMatchObject({
        schemaVersion: 'ControlPlaneGenerationLockGuard/v1',
        lockSchemaVersion: 'GoalExecutionControlLock/v2',
      });
      expect(readdirSync(`${lockPath}.owners`)).toEqual([]);
    }
  );

  it.each(['writeFileSync', 'fsyncSync'] as const)(
    'closes and removes a control ticket generation after %s fails',
    (operation) => {
      const outRoot = temporaryOutRoot();
      const attemptInput = committedAttemptInput(outRoot);
      const lockPath = path.join(outRoot, 'goal', 'runtime', 'execution-control.lock');
      const eventPath = path.join(outRoot, 'goal', 'runtime', `ticket-${operation}.events`);

      const completed = callRuntime(ATTEMPT_MODULE, 'prepareGoalExecutionAttempt', attemptInput, {
        lockFault: {
          operation,
          pathIncludes: lockPath,
          pathEndsWith: '.ticket',
          eventPath,
        },
      });
      const events = readFileSync(eventPath, 'utf8').trim().split('\n');

      expect(completed.output).toEqual({
        ok: false,
        issueCode:
          operation === 'writeFileSync'
            ? 'injected_lock_write_failure'
            : 'injected_lock_fsync_failure',
      });
      expect(events.some((event) => event.startsWith('close:'))).toBe(true);
      expect(readdirSync(`${lockPath}.owners`)).toEqual([]);
    }
  );

  it.each([
    ['choosing', 'writeFileSync'],
    ['choosing', 'fsyncSync'],
    ['ticket', 'writeFileSync'],
    ['ticket', 'fsyncSync'],
  ] as const)(
    'closes and removes an attempt %s generation after %s fails',
    (markerKind, operation) => {
      const outRoot = temporaryOutRoot();
      const attemptInput = committedAttemptInput(outRoot);
      const targetPath = path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
      const lockPath = `${targetPath}.lock`;
      const eventPath = path.join(
        outRoot,
        'goal',
        'runtime',
        `attempt-${markerKind}-${operation}.events`
      );

      const completed = callRuntime(ATTEMPT_MODULE, 'prepareGoalExecutionAttempt', attemptInput, {
        lockFault: {
          operation,
          pathIncludes: lockPath,
          pathEndsWith: `.${markerKind}`,
          eventPath,
        },
      });

      expect(completed.output).toEqual({
        ok: false,
        issueCode:
          operation === 'writeFileSync'
            ? 'injected_lock_write_failure'
            : 'injected_lock_fsync_failure',
      });
      expect(readFileSync(eventPath, 'utf8')).toContain('close:');
      expect(readdirSync(`${lockPath}.owners`)).toEqual([]);
      expect(
        readdirSync(`${path.join(outRoot, 'goal', 'runtime', 'execution-control.lock')}.owners`)
      ).toEqual([]);
    }
  );

  it('fails closed on an expired unknown-schema generation without deleting it', () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const lockPath = path.join(outRoot, 'goal', 'runtime', 'execution-control.lock');
    const unknownPath = `${lockPath}.owner-00000000000000000001-unknown.ticket`;
    writeCanonical(unknownPath, { schemaVersion: 'UnknownExecutionControlLock/v0' });
    utimesSync(unknownPath, new Date(0), new Date(0));

    expect(() => prepareAttemptInput(attemptInput)).toThrowError(
      'goal_execution_attempt_cas_conflict'
    );
    expect(existsSync(unknownPath)).toBe(true);
  });

  it('fails closed on a legacy reclaim generation without quarantining it', () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const barrierPath = path.join(outRoot, 'goal', 'runtime', 'execution-control.lock.reclaim');
    const legacyBarrier = {
      schemaVersion: 'GoalExecutionReclaimBarrier/v1',
      ownerPid: 2_147_483_647,
      ownerToken: 'stale-generation-a',
      acquiredAtMs: 0,
      leaseExpiresAtMs: 1,
    };
    writeCanonical(barrierPath, legacyBarrier);

    const completed = callRuntime(ATTEMPT_MODULE, 'prepareGoalExecutionAttempt', attemptInput);
    const quarantineNames = readdirSync(path.dirname(barrierPath)).filter((name) =>
      name.startsWith(`${path.basename(barrierPath)}.quarantine-`)
    );

    expect(completed.output).toEqual({
      ok: false,
      issueCode: 'goal_execution_attempt_cas_conflict',
    });
    expect(JSON.parse(readFileSync(barrierPath, 'utf8'))).toEqual(legacyBarrier);
    expect(quarantineNames).toEqual([]);
  });

  it('prepares one opaque attempt and recovers the same active attempt without clobbering', () => {
    const outRoot = temporaryOutRoot();
    const first = prepareAttempt(outRoot);
    const recovered = prepareAttempt(outRoot);
    const [executionAuthorityId] = first.pointer.orderedExecutionAuthorityIds;

    expect(first.recovered).toBe(false);
    expect(recovered).toEqual({ pointer: first.pointer, recovered: true });
    expect(first.pointer).toMatchObject({
      schemaVersion: 'GoalExecutionAttemptPointer/v1',
      executionAttemptId: expect.stringMatching(/^ATTEMPT-[A-F0-9]{16}$/u),
      pointerVersion: 1,
      phase: 'prepared',
      nextExecutionAuthorityId: executionAuthorityId,
      validClosureRefs: [],
      blockedIssueCode: null,
      attemptPointerHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect(readGoalExecutionAttemptPointer({ outRoot })).toEqual(first.pointer);
    expect(GOAL_EXECUTION_ATTEMPT_POINTER_PATH).toBe('goal/runtime/current-execution-attempt.json');
    expect(() =>
      prepareGoalExecutionAttempt({
        projectRoot: path.dirname(outRoot),
        outRoot,
        activeRunPointerHash: HASH_B,
        activationRecordHash: HASH_A,
        orderedExecutionAuthorityIds: ['AUTH-OTHER'],
        executionAuthorities: [authority('AUTH-OTHER')],
      })
    ).toThrowError('goal_execution_attempt_cas_conflict');
  });

  it('enforces CAS and legal phase transitions', () => {
    const outRoot = temporaryOutRoot();
    const prepared = prepareAttempt(outRoot);
    const [executionAuthorityId] = prepared.pointer.orderedExecutionAuthorityIds;
    const executing = transitionGoalExecutionAttempt({
      outRoot,
      expectedPointerHash: prepared.pointer.attemptPointerHash,
      expectedPointerVersion: prepared.pointer.pointerVersion,
      phase: 'executing',
      nextExecutionAuthorityId: executionAuthorityId,
      validClosureRefs: [],
      blockedIssueCode: null,
    });

    expect(executing.pointer).toMatchObject({ phase: 'executing', pointerVersion: 2 });
    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: prepared.pointer.attemptPointerHash,
        expectedPointerVersion: prepared.pointer.pointerVersion,
        phase: 'blocked',
        nextExecutionAuthorityId: executionAuthorityId,
        validClosureRefs: [],
        blockedIssueCode: 'executor_failed',
      })
    ).toThrowError('goal_execution_attempt_cas_conflict');
    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: executing.pointer.attemptPointerHash,
        expectedPointerVersion: executing.pointer.pointerVersion,
        phase: 'closed',
        nextExecutionAuthorityId: null,
        validClosureRefs: [],
        blockedIssueCode: null,
      })
    ).toThrowError('goal_execution_attempt_transition_invalid');
  });

  it('rejects closure progress before execution has started', () => {
    const outRoot = temporaryOutRoot();
    const prepared = prepareAttempt(outRoot);
    const [executionAuthority] = prepared.pointer.executionAuthorities;
    const closure = writeClosure(outRoot, executionAuthority);

    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: prepared.pointer.attemptPointerHash,
        expectedPointerVersion: prepared.pointer.pointerVersion,
        phase: 'blocked',
        nextExecutionAuthorityId: null,
        validClosureRefs: [closure],
        blockedIssueCode: 'executor_failed',
      })
    ).toThrowError('goal_execution_attempt_transition_invalid');
  });

  it('rejects closure progress on the first transition into executing', () => {
    const outRoot = temporaryOutRoot();
    const executionAuthorities = [authority('AUTH-001'), authority('AUTH-002')];
    const payload = {
      schemaVersion: 'GoalExecutionAttemptPointer/v1' as const,
      pointerVersion: 1,
      executionAttemptId: 'ATTEMPT-AAAAAAAAAAAAAAAA',
      activeRunPointerHash: HASH_A,
      activationRecordHash: HASH_B,
      orderedExecutionAuthorityIds: ['AUTH-001', 'AUTH-002'],
      executionAuthorities,
      executionStarted: false,
      phase: 'prepared' as const,
      nextExecutionAuthorityId: 'AUTH-001',
      validClosureRefs: [],
      blockedIssueCode: null,
    };
    const pointer = { ...payload, attemptPointerHash: hashControlPlaneValue(payload) };
    writeCanonical(path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/')), pointer);
    const firstClosure = writeClosure(outRoot, executionAuthorities[0]);

    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: pointer.attemptPointerHash,
        expectedPointerVersion: pointer.pointerVersion,
        phase: 'executing',
        nextExecutionAuthorityId: 'AUTH-002',
        validClosureRefs: [firstClosure],
        blockedIssueCode: null,
      })
    ).toThrowError('goal_execution_attempt_transition_invalid');
  });

  it('does not write control artifacts before committed authority preflight succeeds', () => {
    const committedOutRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(committedOutRoot);
    const rejectedOutRoot = temporaryOutRoot();

    expect(() =>
      prepareGoalExecutionAttempt({
        ...attemptInput,
        outRoot: rejectedOutRoot,
      })
    ).toThrowError('goal_execution_attempt_cas_conflict');
    expect(existsSync(path.join(rejectedOutRoot, 'goal'))).toBe(false);
  });

  it('keeps valid closure refs as an immutable prefix during ordinary transitions', () => {
    const outRoot = temporaryOutRoot();
    const prepared = prepareAttempt(outRoot);
    const [executionAuthority] = prepared.pointer.executionAuthorities;
    const executing = transitionGoalExecutionAttempt({
      outRoot,
      expectedPointerHash: prepared.pointer.attemptPointerHash,
      expectedPointerVersion: prepared.pointer.pointerVersion,
      phase: 'executing',
      nextExecutionAuthorityId: executionAuthority.executionAuthorityId,
      validClosureRefs: [],
      blockedIssueCode: null,
    });
    const firstClosure = writeClosure(outRoot, executionAuthority);
    const advanced = transitionGoalExecutionAttempt({
      outRoot,
      expectedPointerHash: executing.pointer.attemptPointerHash,
      expectedPointerVersion: executing.pointer.pointerVersion,
      phase: 'closure_pending',
      nextExecutionAuthorityId: null,
      validClosureRefs: [firstClosure],
      blockedIssueCode: null,
    });

    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: advanced.pointer.attemptPointerHash,
        expectedPointerVersion: advanced.pointer.pointerVersion,
        phase: 'closure_pending',
        nextExecutionAuthorityId: null,
        validClosureRefs: [],
        blockedIssueCode: null,
      })
    ).toThrowError('goal_execution_attempt_closure_history_conflict');
  });

  it('accepts an ordered surviving closure subsequence and selects the earliest missing authority', () => {
    const outRoot = temporaryOutRoot();
    const secondClosure = writeClosure(outRoot, 'AUTH-002');
    const payload = {
      schemaVersion: 'GoalExecutionAttemptPointer/v1' as const,
      pointerVersion: 4,
      executionAttemptId: 'ATTEMPT-AAAAAAAAAAAAAAAA',
      activeRunPointerHash: HASH_A,
      activationRecordHash: HASH_B,
      orderedExecutionAuthorityIds: ['AUTH-001', 'AUTH-002', 'AUTH-003'],
      executionAuthorities: ['AUTH-001', 'AUTH-002', 'AUTH-003'].map((authorityId) =>
        authority(authorityId)
      ),
      executionStarted: true,
      phase: 'blocked' as const,
      nextExecutionAuthorityId: 'AUTH-001',
      validClosureRefs: [secondClosure],
      blockedIssueCode: 'selective_remediation_required',
    };
    const pointer = { ...payload, attemptPointerHash: hashControlPlaneValue(payload) };
    writeCanonical(path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/')), pointer);

    expect(readGoalExecutionAttemptPointer({ outRoot })).toEqual(pointer);
  });

  it('reclaims a stale dead-owner generation but preserves a live writer generation', () => {
    const outRoot = temporaryOutRoot();
    const targetPath = path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
    const lockPath = `${targetPath}.lock`;
    const staleTicketPath = writeGenerationTicket({
      lockPath,
      lockSchemaVersion: 'GoalExecutionAttemptPointerLock/v2',
      ownerPid: 2_147_483_647,
      ownerToken: 'stale-owner',
      acquiredAtMs: 0,
      leaseExpiresAtMs: 1,
    });
    utimesSync(staleTicketPath, new Date(0), new Date(0));

    expect(prepareAttempt(outRoot).pointer.phase).toBe('prepared');
    expect(existsSync(staleTicketPath)).toBe(false);

    const liveOutRoot = temporaryOutRoot();
    const liveTargetPath = path.join(
      liveOutRoot,
      ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/')
    );
    const liveLockPath = `${liveTargetPath}.lock`;
    const liveTicketPath = writeGenerationTicket({
      lockPath: liveLockPath,
      lockSchemaVersion: 'GoalExecutionAttemptPointerLock/v2',
      ownerPid: process.pid,
      ownerToken: 'live-owner',
      acquiredAtMs: Date.now(),
      leaseExpiresAtMs: Date.now() + 60_000,
    });
    expect(() => prepareAttempt(liveOutRoot)).toThrowError('goal_execution_attempt_cas_conflict');
    expect(existsSync(liveTicketPath)).toBe(true);
  });

  it('fails closed on legacy reclaim barriers left by crashed reclaimers', () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const targetPath = path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
    const staleBarrier = {
      schemaVersion: 'GoalExecutionReclaimBarrier/v1',
      ownerPid: 2_147_483_647,
      ownerToken: 'crashed-reclaimer',
      acquiredAtMs: 0,
      leaseExpiresAtMs: 1,
    };
    writeCanonical(`${targetPath}.lock.reclaim`, staleBarrier);
    writeCanonical(
      path.join(outRoot, 'goal', 'runtime', 'execution-control.lock.reclaim'),
      staleBarrier
    );

    expect(() => prepareAttemptInput(attemptInput)).toThrowError(
      'goal_execution_attempt_cas_conflict'
    );
    expect(existsSync(`${targetPath}.lock.reclaim`)).toBe(true);
    expect(
      existsSync(path.join(outRoot, 'goal', 'runtime', 'execution-control.lock.reclaim'))
    ).toBe(true);
  });

  it('hard-cut fences late v1 writers on the attempt-pointer production lock', async () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const targetPath = path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
    const lockPath = `${targetPath}.lock`;
    const stagePath = path.join(outRoot, 'goal', 'runtime', 'attempt-critical-entered');
    const resumePath = path.join(outRoot, 'goal', 'runtime', 'attempt-critical-resume');
    const running = callRuntimeAsync<ReturnType<typeof prepareGoalExecutionAttempt>>(
      ATTEMPT_MODULE,
      'prepareGoalExecutionAttempt',
      attemptInput,
      {
        criticalHold: { pathIncludes: targetPath, stagePath, resumePath },
      }
    );
    await waitForPath(stagePath);
    const whileOwned = lateV1CanAcquire(lockPath);
    writeFileSync(resumePath, '', 'utf8');
    const completed = await running;
    const afterRelease = lateV1CanAcquire(lockPath);

    expect(completed.status, completed.stderr || completed.stdout).toBe(0);
    expect([whileOwned, afterRelease]).toEqual([false, false]);
  });

  it('hard-cut fences late v1 writers on the execution-control production lock', async () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const targetPath = path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
    const lockPath = path.join(outRoot, 'goal', 'runtime', 'execution-control.lock');
    const stagePath = path.join(outRoot, 'goal', 'runtime', 'control-critical-entered');
    const resumePath = path.join(outRoot, 'goal', 'runtime', 'control-critical-resume');
    const running = callRuntimeAsync<ReturnType<typeof prepareGoalExecutionAttempt>>(
      ATTEMPT_MODULE,
      'prepareGoalExecutionAttempt',
      attemptInput,
      {
        criticalHold: { pathIncludes: targetPath, stagePath, resumePath },
      }
    );
    await waitForPath(stagePath);
    const whileOwned = lateV1CanAcquire(lockPath);
    writeFileSync(resumePath, '', 'utf8');
    const completed = await running;
    const afterRelease = lateV1CanAcquire(lockPath);

    expect(completed.status, completed.stderr || completed.stdout).toBe(0);
    expect([whileOwned, afterRelease]).toEqual([false, false]);
  });

  it('rejects prepare when the committed active run changes after control-lock publication', async () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const successorPayload = {
      schemaVersion: 'GoalContractActiveRunPointer/v1',
      pointerVersion: 2,
      candidateRunId: 'RUN-BBBBBBBBBBBBBBBB',
      activationRecordRef: 'goal/runtime/runs/RUN-BBBBBBBBBBBBBBBB/activation.json',
      activationRecordHash: HASH_A,
    };
    const successor = {
      ...successorPayload,
      activeRunPointerHash: hashControlPlaneValue(successorPayload),
    };

    const stagePath = path.join(outRoot, 'goal', 'runtime', 'control-lock-published');
    const resumePath = path.join(outRoot, 'goal', 'runtime', 'resume-control-lock');
    const running = callRuntimeAsync<ReturnType<typeof prepareGoalExecutionAttempt>>(
      ATTEMPT_MODULE,
      'prepareGoalExecutionAttempt',
      attemptInput,
      {
        lockPublishHold: {
          pathIncludes: 'execution-control.lock.owner-',
          pathEndsWith: '.ticket',
          stagePath,
          resumePath,
        },
      }
    );
    await waitForPath(stagePath);
    writeCanonical(path.join(outRoot, 'goal', 'runtime', 'active-run.json'), successor);
    writeFileSync(resumePath, '', 'utf8');
    const completed = await running;

    expect(completed.output).toEqual({
      ok: false,
      issueCode: 'goal_execution_attempt_cas_conflict',
    });
    expect(readGoalExecutionAttemptPointer({ outRoot })).toBeNull();
  });

  it('fails closed without rewriting a legacy writer lock', () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const targetPath = path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/'));
    const lockPath = `${targetPath}.lock`;
    writeCanonical(lockPath, {
      schemaVersion: 'GoalExecutionAttemptPointerLock/v1',
      ownerPid: 2_147_483_647,
      ownerToken: 'stale-owner',
      acquiredAtMs: 0,
      leaseExpiresAtMs: 1,
    });
    expect(() => prepareAttemptInput(attemptInput)).toThrowError(
      'goal_execution_attempt_cas_conflict'
    );
    expect(JSON.parse(readFileSync(lockPath, 'utf8'))).toEqual({
      schemaVersion: 'GoalExecutionAttemptPointerLock/v1',
      ownerPid: 2_147_483_647,
      ownerToken: 'stale-owner',
      acquiredAtMs: 0,
      leaseExpiresAtMs: 1,
    });
  });

  it('binds surviving closures to the committed authority package, dependencies, and owned paths', () => {
    const outRoot = temporaryOutRoot();
    const attemptInput = committedAttemptInput(outRoot);
    const [committedAuthority] = attemptInput.executionAuthorities;
    const prepared = prepareAttemptInput(attemptInput);
    const executing = transitionGoalExecutionAttempt({
      outRoot,
      expectedPointerHash: prepared.pointer.attemptPointerHash,
      expectedPointerVersion: prepared.pointer.pointerVersion,
      phase: 'executing',
      nextExecutionAuthorityId: committedAuthority.executionAuthorityId,
      validClosureRefs: [],
      blockedIssueCode: null,
    });
    const invalidClosure = writeClosure(outRoot, committedAuthority, '-invalid');
    const closurePath = path.join(outRoot, ...invalidClosure.path.split('/'));
    const closure = JSON.parse(readFileSync(closurePath, 'utf8'));
    closure.executionPackageHash = HASH_A;
    closure.changedPaths = ['src/not-owned.ts'];
    delete closure.closureHash;
    closure.closureHash = hashControlPlaneValue(closure);
    writeCanonical(closurePath, closure);
    invalidClosure.hash = closure.closureHash;

    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: executing.pointer.attemptPointerHash,
        expectedPointerVersion: executing.pointer.pointerVersion,
        phase: 'closure_pending',
        nextExecutionAuthorityId: null,
        validClosureRefs: [invalidClosure],
        blockedIssueCode: null,
      })
    ).toThrowError('goal_execution_attempt_closure_ref_invalid');
  });

  it('rejects a closure ref that escapes through a junction', () => {
    const outRoot = temporaryOutRoot();
    const outsideRoot = temporaryOutRoot();
    const outsideClosure = writeClosure(outsideRoot, 'AUTH-001');
    const linkPath = path.join(outRoot, 'goal', 'runtime', 'outside-link');
    mkdirSync(path.dirname(linkPath), { recursive: true });
    symlinkSync(
      path.dirname(path.join(outsideRoot, ...outsideClosure.path.split('/'))),
      linkPath,
      'junction'
    );
    const escapedRef = {
      ...outsideClosure,
      path: `goal/runtime/outside-link/${path.basename(outsideClosure.path)}`,
    };
    const payload = {
      schemaVersion: 'GoalExecutionAttemptPointer/v1' as const,
      pointerVersion: 2,
      executionAttemptId: 'ATTEMPT-AAAAAAAAAAAAAAAA',
      activeRunPointerHash: HASH_A,
      activationRecordHash: HASH_B,
      orderedExecutionAuthorityIds: ['AUTH-001'],
      executionAuthorities: [authority('AUTH-001')],
      executionStarted: true,
      phase: 'closure_pending' as const,
      nextExecutionAuthorityId: null,
      validClosureRefs: [escapedRef],
      blockedIssueCode: null,
    };
    const pointer = { ...payload, attemptPointerHash: hashControlPlaneValue(payload) };
    writeCanonical(path.join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/')), pointer);

    expect(() => readGoalExecutionAttemptPointer({ outRoot })).toThrowError(
      'goal_execution_attempt_closure_ref_invalid'
    );
  });
});
