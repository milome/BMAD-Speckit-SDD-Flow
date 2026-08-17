import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  linkSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireControlPlaneGenerationLock,
  releaseControlPlaneGenerationLock,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/control-plane-generation-lock';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const MODULE = path.join(
  ROOT,
  'packages/bmad-speckit/src/utils/goal-contract/control-plane/control-plane-generation-lock.ts'
);
const PRELOAD = path.join(ROOT, 'tests/fixtures/control-plane-lock-preload.cjs');
const roots: string[] = [];
const RUNNER = [
  'const fs = require("node:fs");',
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));',
  'const wait = (target) => { const deadline = Date.now() + 10000; while (!fs.existsSync(target)) { if (Date.now() >= deadline) throw new Error(`runner_timeout:${target}`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); } };',
  'let handle;',
  'try {',
  '  if (input.startPath) wait(input.startPath);',
  '  handle = runtime.acquireControlPlaneGenerationLock(input.options);',
  '  const ticket = handle.ticket;',
  '  let descriptor;',
  '  try { descriptor = fs.openSync(input.criticalPath, "wx"); } catch (error) { fs.writeFileSync(input.violationPath, error.code || "overlap", "utf8"); throw error; }',
  '  fs.appendFileSync(input.eventsPath, `enter:${process.pid}\n`, "utf8");',
  '  if (input.enteredPath) { fs.writeFileSync(input.enteredPath, "", "utf8"); wait(input.resumePath); }',
  '  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, input.holdMs || 50);',
  '  fs.appendFileSync(input.eventsPath, `exit:${process.pid}\n`, "utf8");',
  '  fs.closeSync(descriptor); fs.rmSync(input.criticalPath, { force: true });',
  '  if (input.releaseBeforeOutput) { runtime.releaseControlPlaneGenerationLock(handle); handle = undefined; }',
  '  process.stdout.write(JSON.stringify({ ok: true, ticket }));',
  '} catch (error) { process.stdout.write(JSON.stringify({ ok: false, issueCode: error.message })); process.exitCode = 1; }',
  'finally { if (handle) runtime.releaseControlPlaneGenerationLock(handle); }',
].join('\n');

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'control-plane-generation-lock-'));
  roots.push(root);
  return root;
}

function options(lockPath: string, timeoutMs = 2_000) {
  return {
    lockPath,
    lockSchemaVersion: 'TestControlPlaneLock/v1',
    legacyLockSchemaVersions: ['TestControlPlaneLock/v0'],
    timeoutMs,
    pollMs: 5,
    leaseMs: 30_000,
    conflictIssueCode: 'test_control_plane_lock_conflict',
  };
}

function runChild(input: Record<string, unknown>, env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ status: number | null; output: Record<string, unknown> }>((resolve) => {
    const child = spawn(
      process.execPath,
      [TSX, '-e', RUNNER, MODULE, Buffer.from(JSON.stringify(input)).toString('base64')],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${PRELOAD}`]
            .filter(Boolean)
            .join(' '),
          ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.on('close', (status) =>
      resolve({ status, output: stdout ? JSON.parse(stdout) : Object.create(null) })
    );
  });
}

async function waitForPath(targetPath: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(targetPath)) {
    if (Date.now() >= deadline) throw new Error(`test_timeout:${targetPath}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function concurrencyFrom(eventsPath: string): number {
  let active = 0;
  let maximum = 0;
  for (const event of readFileSync(eventsPath, 'utf8').trim().split('\n')) {
    active += event.startsWith('enter:') ? 1 : -1;
    maximum = Math.max(maximum, active);
  }
  return maximum;
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

function flatMarkerNames(lockPath: string): string[] {
  const prefix = `${path.basename(lockPath)}.owner-`;
  return readdirSync(path.dirname(lockPath))
    .filter(
      (name) => name.startsWith(prefix) && (name.endsWith('.choosing') || name.endsWith('.ticket'))
    )
    .sort();
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('control-plane generation lock', () => {
  it('publishes the canonical guard when the lock parent does not exist yet', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'nested', 'runtime', 'control.lock');

    const handle = acquireControlPlaneGenerationLock(options(lockPath));
    releaseControlPlaneGenerationLock(handle);

    expect(existsSync(lockPath)).toBe(true);
  });

  it('serializes simultaneous contenders with bounded progress', async () => {
    const root = temporaryRoot();
    const startPath = path.join(root, 'start');
    const shared = {
      options: options(path.join(root, 'control.lock')),
      startPath,
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const contenders = [runChild(shared), runChild(shared)];
    writeFileSync(startPath, '', 'utf8');
    const completed = await Promise.all(contenders);

    expect(completed).toEqual([
      { status: 0, output: { ok: true, ticket: expect.any(String) } },
      { status: 0, output: { ok: true, ticket: expect.any(String) } },
    ]);
    expect(existsSync(shared.violationPath)).toBe(false);
    expect(concurrencyFrom(shared.eventsPath)).toBe(1);
    expect(existsSync(shared.options.lockPath)).toBe(true);
    const guardBytes = readFileSync(shared.options.lockPath, 'utf8');
    expect(JSON.parse(guardBytes)).toMatchObject({
      schemaVersion: 'ControlPlaneGenerationLockGuard/v1',
      lockSchemaVersion: 'TestControlPlaneLock/v1',
      canonicalLockName: 'control.lock',
      guardIdentity: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    const reused = acquireControlPlaneGenerationLock(shared.options);
    releaseControlPlaneGenerationLock(reused);
    expect(readFileSync(shared.options.lockPath, 'utf8')).toBe(guardBytes);
  });

  it('permanently fences late v1 writers during and after a v2 critical section', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const enteredPath = path.join(root, 'entered');
    const resumePath = path.join(root, 'resume');
    const owner = runChild({
      options: options(lockPath),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
      enteredPath,
      resumePath,
    });
    await waitForPath(enteredPath);
    const whileOwned = lateV1CanAcquire(lockPath);
    writeFileSync(resumePath, '', 'utf8');
    expect((await owner).status).toBe(0);
    const afterRelease = lateV1CanAcquire(lockPath);

    expect([whileOwned, afterRelease]).toEqual([false, false]);
  });

  it('atomically publishes one of two concurrent guard candidates and reuses it', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const stagePath = path.join(root, 'guard-fsynced');
    const resumePath = path.join(root, 'guard-resume');
    const shared = {
      options: options(lockPath),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const publisher = runChild(shared, {
      BMAD_LOCK_HOLD_PATH_INCLUDES: lockPath,
      BMAD_LOCK_HOLD_STAGE: stagePath,
      BMAD_LOCK_HOLD_RESUME: resumePath,
    });
    await waitForPath(stagePath);
    const follower = await runChild(shared);
    expect(follower.status).toBe(0);
    writeFileSync(resumePath, '', 'utf8');
    const completed = await publisher;

    expect(completed.status).toBe(0);
    expect(concurrencyFrom(shared.eventsPath)).toBe(1);
    expect(JSON.parse(readFileSync(lockPath, 'utf8'))).toMatchObject({
      schemaVersion: 'ControlPlaneGenerationLockGuard/v1',
      lockSchemaVersion: 'TestControlPlaneLock/v1',
    });
  });

  it.each([
    ['corrupt', 'not-json\n'],
    [
      'wrong guard schema',
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockGuard/v0' })}\n`,
    ],
    [
      'wrong lock schema',
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockGuard/v1', lockSchemaVersion: 'OtherControlPlaneLock/v1', canonicalLockName: 'control.lock', guardIdentity: '0'.repeat(32) })}\n`,
    ],
  ])('fails closed for a %s canonical protocol guard', (_caseName, bytes) => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    writeFileSync(lockPath, bytes, 'utf8');

    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(readFileSync(lockPath, 'utf8')).toBe(bytes);
  });

  it('serializes contenders after concurrent choosing publication', async () => {
    const root = temporaryRoot();
    const resumePath = path.join(root, 'resume');
    const eventsPath = path.join(root, 'preload-events');
    const shared = {
      options: options(path.join(root, 'control.lock')),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const stages = [path.join(root, 'choosing-a'), path.join(root, 'choosing-b')];
    const contenders = stages.map((stagePath) =>
      runChild(shared, {
        BMAD_LOCK_EVENT_PATH: eventsPath,
        BMAD_LOCK_LINK_HOLD_PATH_INCLUDES: `${shared.options.lockPath}.owner-`,
        BMAD_LOCK_LINK_HOLD_PATH_ENDS_WITH: '.choosing',
        BMAD_LOCK_LINK_HOLD_STAGE: stagePath,
        BMAD_LOCK_LINK_HOLD_RESUME: resumePath,
        BMAD_LOCK_TRACK_PATH_INCLUDES: '.owner-',
      })
    );
    await Promise.all(stages.map(waitForPath));
    writeFileSync(resumePath, '', 'utf8');
    const completed = await Promise.all(contenders);
    const concurrency = concurrencyFrom(shared.eventsPath);
    if (concurrency !== 1 || existsSync(shared.violationPath)) {
      throw new Error(
        JSON.stringify({
          completed,
          concurrency,
          criticalViolation: existsSync(shared.violationPath)
            ? readFileSync(shared.violationPath, 'utf8')
            : null,
          criticalEvents: readFileSync(shared.eventsPath, 'utf8').trim().split('\n'),
          markerEvents: existsSync(eventsPath)
            ? readFileSync(eventsPath, 'utf8').trim().split('\n')
            : [],
          remainingMarkers: flatMarkerNames(shared.options.lockPath),
        })
      );
    }

    expect(completed.every(({ status }) => status === 0)).toBe(true);
    expect(completed.every(({ output }) => /^[1-9][0-9]*$/u.test(String(output.ticket)))).toBe(
      true
    );
    expect(existsSync(shared.violationPath)).toBe(false);
    expect(concurrency).toBe(1);
  });

  it('uses the token tie-break when same-ticket choosing markers are replaced', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const choosingResume = path.join(root, 'resume-choosing');
    const lowerEntered = path.join(root, 'winner-entered');
    const lowerResume = path.join(root, 'resume-winner');
    const shared = {
      options: options(lockPath, 20_000),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const contenders = ['a', 'b'].map((name) => {
      const choosingStage = path.join(root, `${name}-choosing`);
      const beforeOpenStageBase = path.join(root, `${name}-before-open`);
      const beforeOpenResumeBase = path.join(root, `${name}-resume-open`);
      const readdirStage = path.join(root, `${name}-snapshot`);
      const readdirResume = path.join(root, `${name}-resume-snapshot`);
      const preloadEvents = path.join(root, `${name}-preload-events`);
      return {
        choosingStage,
        beforeOpenStageBase,
        beforeOpenResumeBase,
        readdirStage,
        readdirResume,
        preloadEvents,
        ticketName: '',
        ownerToken: '',
        completed: runChild(
          { ...shared, enteredPath: lowerEntered, resumePath: lowerResume },
          {
            BMAD_LOCK_HOLD_PATH_INCLUDES: '.choosing',
            BMAD_LOCK_HOLD_STAGE: choosingStage,
            BMAD_LOCK_HOLD_RESUME: choosingResume,
            BMAD_LOCK_HOLD_BEFORE_OPEN_PATH_ENDS_WITH: '.ticket',
            BMAD_LOCK_HOLD_BEFORE_OPEN_STAGE_BASE: beforeOpenStageBase,
            BMAD_LOCK_HOLD_BEFORE_OPEN_RESUME_BASE: beforeOpenResumeBase,
            BMAD_LOCK_READDIR_HOLD_PATH_INCLUDES: root,
            BMAD_LOCK_READDIR_HOLD_STAGE: readdirStage,
            BMAD_LOCK_READDIR_HOLD_RESUME: readdirResume,
            BMAD_LOCK_EVENT_PATH: preloadEvents,
          }
        ),
      };
    });
    await Promise.all(contenders.map(({ choosingStage }) => waitForPath(choosingStage)));
    writeFileSync(choosingResume, '', 'utf8');
    for (const contender of contenders) {
      const prefix = `${path.basename(contender.beforeOpenStageBase)}-`;
      while (!readdirSync(root).some((name) => name.startsWith(prefix))) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      contender.ticketName = readdirSync(root)
        .find((name) => name.startsWith(prefix))!
        .slice(prefix.length);
      contender.ownerToken = /-00000000000000000001-([0-9a-f]{32})\.ticket$/u.exec(
        contender.ticketName
      )![1];
    }
    expect(
      contenders.every(({ ticketName }) => ticketName.includes('.owner-00000000000000000001-'))
    ).toBe(true);
    const [lower, higher] = contenders.sort((left, right) =>
      left.ownerToken.localeCompare(right.ownerToken, 'en')
    );
    writeFileSync(`${higher.beforeOpenResumeBase}-${higher.ticketName}`, '', 'utf8');
    const higherProgress = await Promise.race([
      waitForPath(higher.readdirStage).then(() => ({ kind: 'snapshot' as const })),
      higher.completed.then((result) => ({ kind: 'completed' as const, result })),
    ]);
    if (higherProgress.kind === 'completed') {
      throw new Error(
        JSON.stringify({
          higherResult: higherProgress.result,
          lowerTicketName: lower.ticketName,
          higherTicketName: higher.ticketName,
          names: readdirSync(root).sort(),
          ownerNames: flatMarkerNames(lockPath),
          lowerEvents: existsSync(lower.preloadEvents)
            ? readFileSync(lower.preloadEvents, 'utf8').trim().split('\n')
            : [],
          higherEvents: existsSync(higher.preloadEvents)
            ? readFileSync(higher.preloadEvents, 'utf8').trim().split('\n')
            : [],
        })
      );
    }
    writeFileSync(`${lower.beforeOpenResumeBase}-${lower.ticketName}`, '', 'utf8');
    const lowerProgress = await Promise.race([
      waitForPath(lower.readdirStage).then(() => ({ kind: 'snapshot' as const })),
      lower.completed.then((result) => ({ kind: 'completed' as const, result })),
    ]);
    if (lowerProgress.kind === 'completed') {
      throw new Error(
        JSON.stringify({
          lowerResult: lowerProgress.result,
          lowerTicketName: lower.ticketName,
          higherTicketName: higher.ticketName,
          names: readdirSync(root).sort(),
          ownerNames: flatMarkerNames(lockPath),
          lowerEvents: existsSync(lower.preloadEvents)
            ? readFileSync(lower.preloadEvents, 'utf8').trim().split('\n')
            : [],
          higherEvents: existsSync(higher.preloadEvents)
            ? readFileSync(higher.preloadEvents, 'utf8').trim().split('\n')
            : [],
        })
      );
    }
    writeFileSync(lower.readdirResume, '', 'utf8');
    await waitForPath(lowerEntered);
    writeFileSync(higher.readdirResume, '', 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 50));
    writeFileSync(lowerResume, '', 'utf8');
    const completed = await Promise.all(contenders.map(({ completed: result }) => result));

    expect(completed.every(({ status }) => status === 0)).toBe(true);
    expect(existsSync(shared.violationPath)).toBe(false);
    expect(concurrencyFrom(shared.eventsPath)).toBe(1);
  });

  it('rejects an owners directory symlink or junction without writing through it', () => {
    const root = temporaryRoot();
    const outside = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    symlinkSync(outside, `${lockPath}.owners`, process.platform === 'win32' ? 'junction' : 'dir');

    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(readdirSync(outside)).toEqual([]);
  });

  it('rejects an owners directory identity swap before marker publication', async () => {
    const root = temporaryRoot();
    const outside = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const ownersPath = `${lockPath}.owners`;
    const originalOwnersPath = `${ownersPath}.original`;
    const stageBase = path.join(root, 'before-marker-open');
    const resumeBase = path.join(root, 'resume-marker-open');
    const completed = runChild(
      {
        options: options(lockPath),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_HOLD_BEFORE_OPEN_PATH_ENDS_WITH: '.choosing',
        BMAD_LOCK_HOLD_BEFORE_OPEN_STAGE_BASE: stageBase,
        BMAD_LOCK_HOLD_BEFORE_OPEN_RESUME_BASE: resumeBase,
      }
    );
    const prefix = `${path.basename(stageBase)}-`;
    while (!readdirSync(root).some((name) => name.startsWith(prefix))) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const stagedName = readdirSync(root).find((name) => name.startsWith(prefix))!;
    const markerName = stagedName.slice(prefix.length);
    renameSync(ownersPath, originalOwnersPath);
    symlinkSync(outside, ownersPath, process.platform === 'win32' ? 'junction' : 'dir');
    writeFileSync(`${resumeBase}-${markerName}`, '', 'utf8');

    const result = await completed;

    expect(result.output).toEqual({ ok: false, issueCode: 'test_control_plane_lock_conflict' });
    expect(readdirSync(outside)).toEqual([]);
  });

  it('never publishes an authoritative marker through the owners directory path', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const completed = await runChild(
      {
        options: options(lockPath),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      { BMAD_LOCK_REJECT_LINK_DESTINATION_INCLUDES: `${lockPath}.owners` }
    );

    expect(completed).toEqual({
      status: 0,
      output: { ok: true, ticket: expect.any(String) },
    });
  });

  it('waits for a live choosing marker before entering', async () => {
    const root = temporaryRoot();
    const stagePath = path.join(root, 'choosing-published');
    const resumePath = path.join(root, 'resume');
    const shared = {
      options: options(path.join(root, 'control.lock')),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const paused = runChild(shared, {
      BMAD_LOCK_HOLD_PATH_INCLUDES: '.choosing',
      BMAD_LOCK_HOLD_STAGE: stagePath,
      BMAD_LOCK_HOLD_RESUME: resumePath,
    });
    await waitForPath(stagePath);
    const follower = runChild(shared);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(existsSync(shared.criticalPath)).toBe(false);
    writeFileSync(resumePath, '', 'utf8');
    const completed = await Promise.all([paused, follower]);
    expect(completed.every(({ status }) => status === 0)).toBe(true);
    expect(concurrencyFrom(shared.eventsPath)).toBe(1);
  });

  it('keeps a deterministic late follower outside until the entered owner releases', async () => {
    const root = temporaryRoot();
    const enteredPath = path.join(root, 'owner-entered');
    const resumePath = path.join(root, 'owner-resume');
    const shared = {
      options: options(path.join(root, 'control.lock')),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const owner = runChild({ ...shared, enteredPath, resumePath });
    await waitForPath(enteredPath);
    const follower = runChild(shared);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      readFileSync(shared.eventsPath, 'utf8')
        .split('\n')
        .filter((event) => event.startsWith('enter:')).length
    ).toBe(1);
    writeFileSync(resumePath, '', 'utf8');
    const completed = await Promise.all([owner, follower]);

    expect(completed.every(({ status }) => status === 0)).toBe(true);
    expect(concurrencyFrom(shared.eventsPath)).toBe(1);
  });

  it.each(['writeFileSync', 'fsyncSync', 'closeSync'] as const)(
    'removes an incomplete canonical protocol guard after %s fails',
    async (operation) => {
      const root = temporaryRoot();
      const lockPath = path.join(root, 'control.lock');
      const completed = await runChild(
        {
          options: options(lockPath),
          criticalPath: path.join(root, 'critical'),
          violationPath: path.join(root, 'violation'),
          eventsPath: path.join(root, 'events'),
        },
        {
          BMAD_LOCK_FAULT_OPERATION: operation,
          BMAD_LOCK_FAULT_PATH_INCLUDES: '.guard-candidate-',
        }
      );
      const faultName =
        operation === 'fsyncSync' ? 'fsync' : operation === 'closeSync' ? 'close' : 'write';

      expect(completed.output.issueCode).toBe(`injected_lock_${faultName}_failure`);
      expect(existsSync(lockPath)).toBe(false);
      expect(existsSync(`${lockPath}.owners`)).toBe(false);
      expect(readdirSync(root).some((name) => name.includes('.guard-candidate-'))).toBe(false);
    }
  );

  it('cleans a dead expired guard candidate left by a hard crash', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const crashed = await runChild(
      {
        options: options(lockPath),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_FAULT_OPERATION: 'exitAfterFsync',
        BMAD_LOCK_FAULT_PATH_INCLUDES: '.guard-candidate-',
      }
    );
    const [candidateName] = readdirSync(root).filter((name) => name.includes('.guard-candidate-'));
    const candidatePath = path.join(root, candidateName);
    expect(crashed.status).toBe(137);
    expect(existsSync(candidatePath)).toBe(true);
    utimesSync(candidatePath, new Date(0), new Date(0));

    const handle = acquireControlPlaneGenerationLock(options(lockPath));
    releaseControlPlaneGenerationLock(handle);

    expect(existsSync(candidatePath)).toBe(false);
  });

  it('preserves live, recent, and malformed guard candidate files', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const livePath = `${lockPath}.guard-candidate-${process.pid}-${'a'.repeat(32)}`;
    const recentPath = `${lockPath}.guard-candidate-2147483647-${'b'.repeat(32)}`;
    const malformedPath = `${lockPath}.guard-candidate-not-a-pid-${'c'.repeat(32)}`;
    for (const candidatePath of [livePath, recentPath, malformedPath]) {
      writeFileSync(candidatePath, 'candidate\n', 'utf8');
    }
    utimesSync(livePath, new Date(0), new Date(0));
    utimesSync(malformedPath, new Date(0), new Date(0));

    const handle = acquireControlPlaneGenerationLock(options(lockPath));
    releaseControlPlaneGenerationLock(handle);

    expect([livePath, recentPath, malformedPath].every(existsSync)).toBe(true);
  });

  it('preserves a dead expired guard candidate that is a symlink', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const targetPath = path.join(root, 'old-regular-target.txt');
    const candidatePath = `${lockPath}.guard-candidate-2147483647-${'d'.repeat(32)}`;
    writeFileSync(targetPath, 'target\n', 'utf8');
    utimesSync(targetPath, new Date(0), new Date(0));
    symlinkSync(targetPath, candidatePath, 'file');
    expect(lstatSync(candidatePath).isSymbolicLink()).toBe(true);

    const handle = acquireControlPlaneGenerationLock(options(lockPath));
    releaseControlPlaneGenerationLock(handle);

    expect(existsSync(candidatePath)).toBe(true);
    expect(readFileSync(targetPath, 'utf8')).toBe('target\n');
  });

  it.each([
    ['choosing', 'writeFileSync'],
    ['choosing', 'fsyncSync'],
    ['choosing', 'closeSync'],
    ['ticket', 'writeFileSync'],
    ['ticket', 'fsyncSync'],
  ] as const)('closes and removes its %s marker after %s fails', async (markerKind, operation) => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const eventsPath = path.join(root, 'fault-events');
    const completed = await runChild(
      {
        options: options(lockPath),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_FAULT_OPERATION: operation,
        BMAD_LOCK_FAULT_PATH_INCLUDES: `.${markerKind}`,
        BMAD_LOCK_EVENT_PATH: eventsPath,
      }
    );
    const faultName =
      operation === 'fsyncSync' ? 'fsync' : operation === 'closeSync' ? 'close' : 'write';
    expect(completed.output.issueCode).toBe(`injected_lock_${faultName}_failure`);
    const events = readFileSync(eventsPath, 'utf8');
    expect(events).toContain('fault:');
    expect(events).not.toContain('leaked:');
    expect(readdirSync(`${lockPath}.owners`)).toEqual([]);
  });

  it('reclaims a dead expired marker but fails closed on an unknown marker', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const deadPath = `${lockPath}.owner-00000000000000000001-dead.ticket`;
    writeFileSync(
      deadPath,
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: 2147483647, ownerProcessStartIdentity: 'linux-start-ticks:0', ownerToken: 'dead', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );
    utimesSync(deadPath, new Date(0), new Date(0));
    const unknownPath = `${lockPath}.owner-00000000000000000002-unknown.ticket`;
    writeFileSync(unknownPath, '{}\n', 'utf8');
    utimesSync(unknownPath, new Date(0), new Date(0));

    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(existsSync(deadPath)).toBe(false);
    expect(existsSync(unknownPath)).toBe(true);
  });

  it('does not reclaim an expired marker while its recorded owner pid is alive', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const markerPath = `${lockPath}.owner-00000000000000000001-live.ticket`;
    const unrelatedProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
      stdio: 'ignore',
    });
    try {
      writeFileSync(
        markerPath,
        `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: unrelatedProcess.pid, ownerProcessStartIdentity: 'unavailable:00000000000000000000000000000000', ownerToken: 'live', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
        'utf8'
      );
      utimesSync(markerPath, new Date(0), new Date(0));

      expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
        'test_control_plane_lock_conflict'
      );
      expect(existsSync(markerPath)).toBe(true);
    } finally {
      unrelatedProcess.kill();
    }
  });

  it('reclaims an expired marker when its live pid belongs to a different process generation', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const markerPath = `${lockPath}.owner-00000000000000000001-reused.ticket`;
    const unrelatedProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
      stdio: 'ignore',
    });
    try {
      writeFileSync(
        markerPath,
        `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: unrelatedProcess.pid, ownerProcessStartIdentity: 'linux-start-ticks:0', ownerToken: 'reused', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
        'utf8'
      );
      utimesSync(markerPath, new Date(0), new Date(0));

      const handle = acquireControlPlaneGenerationLock(options(lockPath, 5_000));
      releaseControlPlaneGenerationLock(handle);
      expect(existsSync(markerPath)).toBe(false);
    } finally {
      unrelatedProcess.kill();
    }
  });

  it('reclaims an expired marker when a live pid has a different exact process identity', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const markerPath = `${lockPath}.owner-00000000000000000001-reused-exact.ticket`;
    const unrelatedProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
      stdio: 'ignore',
    });
    try {
      writeFileSync(
        markerPath,
        `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: unrelatedProcess.pid, ownerProcessStartIdentity: 'linux-start-ticks:0', ownerToken: 'reused-exact', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
        'utf8'
      );
      utimesSync(markerPath, new Date(0), new Date(0));

      const handle = acquireControlPlaneGenerationLock(options(lockPath, 5_000));
      releaseControlPlaneGenerationLock(handle);
      expect(existsSync(markerPath)).toBe(false);
    } finally {
      unrelatedProcess.kill();
    }
  });

  it('does not follow a replacement ticket symlink when starting its heartbeat', async () => {
    const root = temporaryRoot();
    const outside = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const stagePath = path.join(root, 'ticket-linked');
    const resumePath = path.join(root, 'resume-ticket-link');
    const outsidePath = path.join(outside, 'outside.txt');
    writeFileSync(outsidePath, 'outside\n', 'utf8');
    utimesSync(outsidePath, new Date(1_000), new Date(1_000));
    const before = statSync(outsidePath).mtimeMs;
    const completed = runChild(
      {
        options: options(lockPath, 250),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_LINK_HOLD_PATH_INCLUDES: `${lockPath}.owner-`,
        BMAD_LOCK_LINK_HOLD_PATH_ENDS_WITH: '.ticket',
        BMAD_LOCK_LINK_HOLD_STAGE: stagePath,
        BMAD_LOCK_LINK_HOLD_RESUME: resumePath,
      }
    );
    const publication = await Promise.race([
      waitForPath(stagePath).then(() => ({ kind: 'published' as const })),
      completed.then((result) => ({ kind: 'completed' as const, result })),
    ]);
    if (publication.kind === 'completed') {
      throw new Error(`ticket_publication_failed:${JSON.stringify(publication.result)}`);
    }
    const [ticketName] = flatMarkerNames(lockPath).filter((name) => name.endsWith('.ticket'));
    const ticketPath = path.join(root, ticketName);
    rmSync(ticketPath);
    symlinkSync(outsidePath, ticketPath, 'file');
    writeFileSync(resumePath, '', 'utf8');

    const result = await completed;

    expect(result.output).toEqual({ ok: false, issueCode: 'test_control_plane_lock_conflict' });
    expect(statSync(outsidePath).mtimeMs).toBe(before);
    expect(readFileSync(outsidePath, 'utf8')).toBe('outside\n');
  });

  it('keeps the durable ticket inode when its candidate pathname is replaced before link', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const stagePath = path.join(root, 'ticket-durable');
    const resumePath = path.join(root, 'resume-ticket-durable');
    const outsidePath = path.join(root, 'outside.txt');
    writeFileSync(outsidePath, 'outside\n', 'utf8');
    utimesSync(outsidePath, new Date(1_000), new Date(1_000));
    const before = statSync(outsidePath).mtimeMs;
    const completed = runChild(
      {
        options: options(lockPath, 250),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_HOLD_PATH_INCLUDES: '.marker-candidate-',
        BMAD_LOCK_HOLD_PATH_ENDS_WITH: '.ticket',
        BMAD_LOCK_HOLD_STAGE: stagePath,
        BMAD_LOCK_HOLD_RESUME: resumePath,
      }
    );
    await waitForPath(stagePath);
    const [candidateName] = readdirSync(root).filter(
      (name) => name.includes('.marker-candidate-') && name.endsWith('.ticket')
    );
    const candidatePath = path.join(root, candidateName);
    renameSync(candidatePath, `${candidatePath}.original`);
    linkSync(outsidePath, candidatePath);
    writeFileSync(resumePath, '', 'utf8');

    const result = await completed;

    expect(result.output).toEqual({ ok: false, issueCode: 'test_control_plane_lock_conflict' });
    expect(statSync(outsidePath).mtimeMs).toBe(before);
    expect(readFileSync(outsidePath, 'utf8')).toBe('outside\n');
  });

  it('closes the retained ticket descriptor when candidate cleanup fails', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const eventsPath = path.join(root, 'fault-events');
    const completed = await runChild(
      {
        options: options(lockPath),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_FAULT_OPERATION: 'rmSync',
        BMAD_LOCK_FAULT_PATH_INCLUDES: '.marker-candidate-',
        BMAD_LOCK_FAULT_PATH_ENDS_WITH: '.ticket',
        BMAD_LOCK_EVENT_PATH: eventsPath,
      }
    );

    expect(completed.output.issueCode).toBe('injected_lock_remove_failure');
    expect(readFileSync(eventsPath, 'utf8')).not.toContain('leaked:');
    expect(flatMarkerNames(lockPath)).toEqual([]);
  });

  it('cleans a retained ticket after close fails during an unreturned acquisition', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const blockerPath = `${lockPath}.owner-00000000000000000001-blocker.ticket`;
    const eventsPath = path.join(root, 'fault-events');
    writeFileSync(
      blockerPath,
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: process.pid, ownerProcessStartIdentity: 'unavailable:00000000000000000000000000000000', ownerToken: 'blocker', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );
    const completed = await runChild(
      {
        options: options(lockPath, 100),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_FAULT_OPERATION: 'closeSync',
        BMAD_LOCK_FAULT_PATH_INCLUDES: '.marker-candidate-',
        BMAD_LOCK_FAULT_PATH_ENDS_WITH: '.ticket',
        BMAD_LOCK_FAULT_HEARTBEAT_CLOSE: '1',
        BMAD_LOCK_EVENT_PATH: eventsPath,
      }
    );

    expect(completed.output.issueCode).toBe('injected_lock_close_failure');
    expect(readFileSync(eventsPath, 'utf8')).not.toContain('leaked:');
    expect(flatMarkerNames(lockPath)).toEqual([path.basename(blockerPath)]);
  });

  it('retries canonical ticket removal before returning an acquisition failure', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const blockerPath = `${lockPath}.owner-00000000000000000001-blocker.ticket`;
    writeFileSync(
      blockerPath,
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: process.pid, ownerProcessStartIdentity: 'unavailable:00000000000000000000000000000000', ownerToken: 'blocker', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );
    const completed = await runChild(
      {
        options: options(lockPath, 100),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_FAULT_OPERATION: 'rmSync',
        BMAD_LOCK_FAULT_PATH_INCLUDES: `${lockPath}.owner-`,
        BMAD_LOCK_FAULT_PATH_ENDS_WITH: '.ticket',
      }
    );

    expect(completed.output.issueCode).toBe('test_control_plane_lock_conflict');
    expect(flatMarkerNames(lockPath)).toEqual([path.basename(blockerPath)]);
  });

  it('fails the process closed when an unreturned canonical ticket cannot be removed', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const blockerPath = `${lockPath}.owner-00000000000000000001-blocker.ticket`;
    writeFileSync(
      blockerPath,
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: process.pid, ownerProcessStartIdentity: 'unavailable:00000000000000000000000000000000', ownerToken: 'blocker', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );
    const completed = await runChild(
      {
        options: options(lockPath, 100),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
      },
      {
        BMAD_LOCK_FAULT_OPERATION: 'rmSync',
        BMAD_LOCK_FAULT_PATH_INCLUDES: `${lockPath}.owner-`,
        BMAD_LOCK_FAULT_PATH_ENDS_WITH: '.ticket',
        BMAD_LOCK_FAULT_ALWAYS: '1',
      }
    );

    expect(completed.status).not.toBe(0);
    expect(completed.output).toEqual({});
  });

  it('fails the process closed when heartbeat shutdown cannot be confirmed', async () => {
    const root = temporaryRoot();
    const completed = await runChild(
      {
        options: options(path.join(root, 'control.lock')),
        criticalPath: path.join(root, 'critical'),
        violationPath: path.join(root, 'violation'),
        eventsPath: path.join(root, 'events'),
        releaseBeforeOutput: true,
      },
      { BMAD_LOCK_FAKE_STUCK_HEARTBEAT: '1' }
    );

    expect(completed.status).not.toBe(0);
    expect(Object.keys(completed.output)).toEqual([]);
  });

  it('keeps a malformed marker with a live owner after its mtime lease expires', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const markerPath = `${lockPath}.owner-00000000000000000001-unknown.ticket`;
    writeFileSync(
      markerPath,
      `${JSON.stringify({ schemaVersion: 'ControlPlaneGenerationLockMarker/v1', lockSchemaVersion: 'TestControlPlaneLock/v1', markerKind: 'ticket', ownerPid: process.pid, ownerToken: 'unknown', ticket: '1', acquiredAtMs: 0, leaseExpiresAtMs: 'invalid' })}\n`,
      'utf8'
    );

    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(existsSync(markerPath)).toBe(true);
    utimesSync(markerPath, new Date(0), new Date(0));
    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(existsSync(markerPath)).toBe(true);
  });

  it('renews a live owner generation beyond its lease duration', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const enteredPath = path.join(root, 'entered');
    const resumePath = path.join(root, 'resume');
    const owner = runChild({
      options: { ...options(lockPath, 2_000), leaseMs: 90 },
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
      enteredPath,
      resumePath,
    });
    await waitForPath(enteredPath);
    const [ticketName] = flatMarkerNames(lockPath).filter((name) => name.endsWith('.ticket'));
    const ticketPath = path.join(root, ticketName);
    const beforeHeartbeat = statSync(ticketPath).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 250));
    const afterHeartbeat = statSync(ticketPath).mtimeMs;

    expect(afterHeartbeat).toBeGreaterThan(beforeHeartbeat);
    expect(() =>
      acquireControlPlaneGenerationLock({ ...options(lockPath, 100), leaseMs: 90 })
    ).toThrowError('test_control_plane_lock_conflict');
    writeFileSync(resumePath, '', 'utf8');
    expect((await owner).status).toBe(0);
  });

  it('treats a fresh partial legacy quarantine record as corrupt', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const quarantinePath = `${lockPath}.quarantine-partial`;
    writeFileSync(
      quarantinePath,
      `${JSON.stringify({ schemaVersion: 'TestControlPlaneLock/v0', ownerPid: 2147483647, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );

    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(existsSync(quarantinePath)).toBe(true);
  });

  it('treats a fresh schema-specific partial legacy quarantine record as corrupt', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'active-run.lock');
    const ownerToken = 'partial-active-run-owner';
    const quarantinePath = `${lockPath}.quarantine-${ownerToken}`;
    writeFileSync(
      quarantinePath,
      `${JSON.stringify({ schemaVersion: 'GoalContractActiveRunLock/v1', ownerPid: 2_147_483_647, ownerToken, acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );
    const activeRunOptions = {
      ...options(lockPath, 2_000),
      legacyLockSchemaVersions: ['GoalContractActiveRunLock/v1'],
    };

    expect(() => acquireControlPlaneGenerationLock(activeRunOptions)).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(existsSync(quarantinePath)).toBe(true);

    utimesSync(quarantinePath, new Date(0), new Date(0));
    const handle = acquireControlPlaneGenerationLock(activeRunOptions);
    releaseControlPlaneGenerationLock(handle);
    expect(existsSync(quarantinePath)).toBe(false);
  });

  it('treats a legacy quarantine record with a mismatched owner name as corrupt', () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const quarantinePath = `${lockPath}.quarantine-path-owner`;
    writeFileSync(
      quarantinePath,
      `${JSON.stringify({ schemaVersion: 'TestControlPlaneLock/v0', ownerPid: 2_147_483_647, ownerToken: 'record-owner', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
      'utf8'
    );

    expect(() => acquireControlPlaneGenerationLock(options(lockPath, 50))).toThrowError(
      'test_control_plane_lock_conflict'
    );
    expect(existsSync(quarantinePath)).toBe(true);
  });

  it('keeps an entered owner authoritative across canonical and barrier ABA', async () => {
    const root = temporaryRoot();
    const lockPath = path.join(root, 'control.lock');
    const enteredPath = path.join(root, 'entered');
    const resumePath = path.join(root, 'resume');
    const shared = {
      options: options(lockPath),
      criticalPath: path.join(root, 'critical'),
      violationPath: path.join(root, 'violation'),
      eventsPath: path.join(root, 'events'),
    };
    const owner = runChild({ ...shared, enteredPath, resumePath });
    await waitForPath(enteredPath);
    for (const legacyPath of [lockPath, `${lockPath}.reclaim`]) {
      writeFileSync(legacyPath, 'generation-a\n', 'utf8');
      rmSync(legacyPath, { force: true });
      writeFileSync(legacyPath, 'generation-b\n', 'utf8');
      rmSync(legacyPath, { force: true });
    }
    const liveOrphanPaths = [
      `${lockPath}.quarantine-live-orphan`,
      `${lockPath}.reclaim.quarantine-live-orphan`,
    ];
    for (const orphanPath of liveOrphanPaths) {
      const reclaim = orphanPath.includes('.reclaim.quarantine-');
      writeFileSync(
        orphanPath,
        `${JSON.stringify({ schemaVersion: reclaim ? 'GoalExecutionReclaimBarrier/v1' : 'TestControlPlaneLock/v0', ownerPid: process.pid, ownerToken: 'live-orphan', acquiredAtMs: Date.now(), leaseExpiresAtMs: Date.now() + 60_000 })}\n`,
        'utf8'
      );
    }
    const contender = await runChild({ ...shared, options: options(lockPath, 100) });
    expect(contender.output).toEqual({
      ok: false,
      issueCode: 'test_control_plane_lock_conflict',
    });
    expect(existsSync(shared.violationPath)).toBe(false);
    writeFileSync(resumePath, '', 'utf8');
    expect((await owner).status).toBe(0);
    expect((await runChild({ ...shared, options: options(lockPath, 100) })).output).toEqual({
      ok: false,
      issueCode: 'test_control_plane_lock_conflict',
    });
    for (const orphanPath of liveOrphanPaths) rmSync(orphanPath, { force: true });
    const staleOrphanPaths = [
      `${lockPath}.quarantine-dead-orphan`,
      `${lockPath}.reclaim.quarantine-dead-orphan`,
    ];
    for (const orphanPath of staleOrphanPaths) {
      const reclaim = orphanPath.includes('.reclaim.quarantine-');
      writeFileSync(
        orphanPath,
        `${JSON.stringify({ schemaVersion: reclaim ? 'GoalExecutionReclaimBarrier/v1' : 'TestControlPlaneLock/v0', ownerPid: 2147483647, ownerToken: 'dead-orphan', acquiredAtMs: 0, leaseExpiresAtMs: 1 })}\n`,
        'utf8'
      );
    }
    expect((await runChild(shared)).status).toBe(0);
    expect(staleOrphanPaths.some(existsSync)).toBe(false);
  });

  it('rejects a forged release path without deleting it', () => {
    const root = temporaryRoot();
    const handle = acquireControlPlaneGenerationLock(options(path.join(root, 'control.lock')));
    const ticketPath = handle.ticketPath;
    const outsidePath = path.join(root, 'outside.txt');
    writeFileSync(outsidePath, 'preserve\n', 'utf8');
    const forged = { ...handle, ticketPath: outsidePath };

    expect(() => releaseControlPlaneGenerationLock(forged)).toThrowError(
      'control_plane_generation_lock_handle_invalid'
    );
    expect(readFileSync(outsidePath, 'utf8')).toBe('preserve\n');
    expect(handle.ticketPath).toBe(ticketPath);
    expect(Object.isFrozen(handle)).toBe(true);
    releaseControlPlaneGenerationLock(handle);
  });

  it('rejects a cloned branded handle without deleting the real owner ticket', () => {
    const root = temporaryRoot();
    const handle = acquireControlPlaneGenerationLock(options(path.join(root, 'control.lock')));
    const clone = { ...handle };

    expect(() => releaseControlPlaneGenerationLock(clone)).toThrowError(
      'control_plane_generation_lock_handle_invalid'
    );
    expect(existsSync(handle.ticketPath)).toBe(true);
    releaseControlPlaneGenerationLock(handle);
  });

  it('retains ownership when release validation fails so cleanup can be retried', () => {
    const root = temporaryRoot();
    const handle = acquireControlPlaneGenerationLock(options(path.join(root, 'control.lock')));
    const markerBytes = readFileSync(handle.ticketPath);
    writeFileSync(handle.ticketPath, '{}\n', 'utf8');

    expect(() => releaseControlPlaneGenerationLock(handle)).toThrowError(
      'control_plane_generation_lock_handle_invalid'
    );
    writeFileSync(handle.ticketPath, markerBytes);
    expect(() => releaseControlPlaneGenerationLock(handle)).not.toThrow();
    expect(existsSync(handle.ticketPath)).toBe(false);
  });
});
