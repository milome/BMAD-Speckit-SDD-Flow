import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const ACTIVE_RUN_ZERO_HASH = `sha256:${'0'.repeat(64)}`;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function hashControlPlaneValue(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')}`;
}
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function activate(cwd: string, goalAuthorityPath: string) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      SOURCE_RUNNER,
      SOURCE_COMMAND,
      'activate',
      '--cwd',
      cwd,
      '--goal-authority',
      goalAuthorityPath,
      '--json',
    ],
    { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return { ...completed, result: JSON.parse(completed.stdout) };
}

function activateAsync(cwd: string, goalAuthorityPath: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string; result: unknown }>(
    (resolve) => {
      const child = spawn(
        process.execPath,
        [
          TSX,
          '-e',
          SOURCE_RUNNER,
          SOURCE_COMMAND,
          'activate',
          '--cwd',
          cwd,
          '--goal-authority',
          goalAuthorityPath,
          '--json',
        ],
        { cwd, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('close', (status) => {
        resolve({ status, stdout, stderr, result: stdout ? JSON.parse(stdout) : null });
      });
    }
  );
}

function activeRunClaimPath(pointerPath: string, expectedBeforeVersion = 0) {
  return path.join(
    path.dirname(pointerPath),
    'active-run-claims',
    `v${String(expectedBeforeVersion + 1).padStart(16, '0')}.json`
  );
}

function activeRunLockPath(pointerPath: string, nextPointerVersion = 1) {
  return `${pointerPath}.lock-v${String(nextPointerVersion).padStart(16, '0')}`;
}

function artifact(
  result: { artifacts: Array<{ role: string; artifactRef: string; artifactHash: string }> },
  role: string
) {
  return result.artifacts.find((entry) => entry.role === role)!;
}

function failureEnvelope(issueCode: string) {
  const modulePath = path.join(
    ROOT,
    'packages',
    'bmad-speckit',
    'src',
    'utils',
    'goal-contract',
    'control-plane',
    'frozen-goal-activation.ts'
  );
  const runner = [
    'const runtime = require(process.argv[1]);',
    'const issueCode = process.argv[2];',
    'process.stdout.write(JSON.stringify(runtime.goalContractActivationFailureResult({',
    '  failureClass: issueCode,',
    '  executionMode: "partitioned_goal",',
    '  partitionOutcome: issueCode,',
    '})));',
  ].join('\n');
  const completed = spawnSync(process.execPath, [TSX, '-e', runner, modulePath, issueCode], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

function crashWithActiveRunLock(lockPath: string) {
  const runner = [
    'const fs = require("node:fs");',
    'const lockPath = process.argv[1];',
    'fs.writeFileSync(lockPath, JSON.stringify({',
    '  schemaVersion: "GoalContractActiveRunLock/v1",',
    '  ownerPid: process.pid,',
    '  ownerToken: "crashed-test-owner",',
    '  acquiredAtMs: Date.now() - 60000,',
    '  leaseExpiresAtMs: Date.now() - 30000,',
    '}));',
    'process.exit(137);',
  ].join('\n');
  return spawnSync(process.execPath, ['-e', runner, lockPath], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

describe('goal-contract activation recovery', () => {
  it.each(['partition_no_valid_solution', 'partition_search_inconclusive'])(
    'preserves the blocked partition outcome %s in the closed result envelope',
    (issueCode) => {
      expect(failureEnvelope(issueCode)).toEqual({
        schemaVersion: 'goal-contract-activation-result/v1',
        profile: null,
        status: 'blocked',
        issueCode,
        executionMode: 'partitioned_goal',
        partitionOutcome: issueCode,
        artifacts: [],
      });
    }
  );

  it('reconciles a promoted candidate before CAS and reuses the committed activation afterward', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const first = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const pointerPath = artifact(first.result, 'active_run_pointer').artifactRef;
      const candidate = artifact(first.result, 'candidate_run');
      const activationRecord = artifact(first.result, 'activation_record');

      rmSync(pointerPath);
      const recovered = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(recovered.status, recovered.stderr || recovered.stdout).toBe(0);
      expect(recovered.result.status).toBe('activation_reused');
      expect(artifact(recovered.result, 'candidate_run')).toEqual(candidate);
      expect(artifact(recovered.result, 'activation_record')).toEqual(activationRecord);

      const reused = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(reused.status, reused.stderr || reused.stdout).toBe(0);
      expect(reused.result.status).toBe('activation_reused');
      expect(artifact(reused.result, 'candidate_run')).toEqual(candidate);
      expect(
        readdirSync(path.dirname(path.dirname(candidate.artifactRef)), {
          withFileTypes: true,
        }).filter((entry) => entry.isDirectory()).length
      ).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  it('does not reclaim an expired lock while its owner process is alive', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const pointerPath = path.join(fixture.root, 'goal-run', 'goal', 'runtime', 'active-run.json');
      const lockPath = activeRunLockPath(pointerPath);
      mkdirSync(path.dirname(lockPath), { recursive: true });
      writeFileSync(
        lockPath,
        JSON.stringify({
          schemaVersion: 'GoalContractActiveRunLock/v1',
          ownerPid: process.pid,
          ownerToken: 'live-test-owner',
          acquiredAtMs: Date.now() - 60_000,
          leaseExpiresAtMs: Date.now() - 30_000,
        })
      );

      const blocked = activate(fixture.root, compiled.activeAuthorityRef.path);

      expect(blocked.status).toBe(1);
      expect(blocked.result).toMatchObject({
        status: 'blocked',
        issueCode: 'active_run_cas_conflict',
      });
      expect(JSON.parse(readFileSync(lockPath, 'utf8')).ownerToken).toBe('live-test-owner');
    } finally {
      fixture.cleanup();
    }
  });

  it('recovers when a previous reclaimer crashes before deleting the stale lock', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const pointerPath = path.join(fixture.root, 'goal-run', 'goal', 'runtime', 'active-run.json');
      const legacyLockPath = `${pointerPath}.lock`;
      mkdirSync(path.dirname(legacyLockPath), { recursive: true });
      const crashed = crashWithActiveRunLock(legacyLockPath);
      expect(crashed.status).not.toBe(0);
      writeFileSync(
        `${legacyLockPath}.reclaim`,
        JSON.stringify({
          schemaVersion: 'GoalContractActiveRunReclaim/v1',
          ownerPid: 2_147_483_647,
          ownerToken: 'crashed-reclaimer',
        })
      );

      const recovered = activate(fixture.root, compiled.activeAuthorityRef.path);

      expect(recovered.status, recovered.stderr || recovered.stdout).toBe(0);
      expect(recovered.result.status).toBe('activated');
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a different immutable winner claim for the same pointer version', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const pointerPath = path.join(fixture.root, 'goal-run', 'goal', 'runtime', 'active-run.json');
      const claimPath = activeRunClaimPath(pointerPath);
      const nextPointerPayload = {
        schemaVersion: 'GoalContractActiveRunPointer/v1',
        pointerVersion: 1,
        candidateRunId: 'RUN-FFFFFFFFFFFFFFFF',
        activationRecordRef: 'goal/runtime/runs/RUN-FFFFFFFFFFFFFFFF/activation.json',
        activationRecordHash: `sha256:${'f'.repeat(64)}`,
      };
      const claimPayload = {
        schemaVersion: 'GoalContractActiveRunPointerClaim/v1',
        expectedBeforeHash: ACTIVE_RUN_ZERO_HASH,
        expectedBeforeVersion: 0,
        nextPointerVersion: 1,
        candidateRunId: nextPointerPayload.candidateRunId,
        activationRecordRef: nextPointerPayload.activationRecordRef,
        activationRecordHash: nextPointerPayload.activationRecordHash,
        nextActiveRunPointerHash: hashControlPlaneValue(nextPointerPayload),
      };
      const claim = { ...claimPayload, claimHash: hashControlPlaneValue(claimPayload) };
      mkdirSync(path.dirname(claimPath), { recursive: true });
      writeFileSync(claimPath, `${JSON.stringify(canonicalize(claim))}\n`, 'utf8');

      const blocked = activate(fixture.root, compiled.activeAuthorityRef.path);

      expect(blocked.status).toBe(1);
      expect(blocked.result).toMatchObject({
        status: 'blocked',
        issueCode: 'active_run_cas_conflict',
      });
      expect(readFileSync(claimPath, 'utf8')).toBe(`${JSON.stringify(canonicalize(claim))}\n`);
    } finally {
      fixture.cleanup();
    }
  });

  it('blocks package readback corruption without recreating the active pointer', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const first = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const pointerPath = artifact(first.result, 'active_run_pointer').artifactRef;
      const packagePath = artifact(first.result, 'direct_execution_package').artifactRef;
      const tamperedBytes = Buffer.concat([readFileSync(packagePath), Buffer.from('\n')]);
      writeFileSync(packagePath, tamperedBytes);
      rmSync(pointerPath);

      const blocked = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(blocked.status).toBe(1);
      expect(blocked.stderr).toBe('');
      expect(blocked.result).toMatchObject({
        status: 'blocked',
        issueCode: 'goal_execution_package_invalid',
        artifacts: [],
      });
      expect(existsSync(pointerPath)).toBe(false);
      expect(readFileSync(packagePath)).toEqual(tamperedBytes);
    } finally {
      fixture.cleanup();
    }
  });

  it('reuses the immutable active run after a locator-only Goal IR reference refresh', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const first = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const firstCandidate = artifact(first.result, 'candidate_run');
      const firstActivation = artifact(first.result, 'activation_record');

      const authorityPath = compiled.activeAuthorityRef.path;
      const outRoot = path.dirname(path.dirname(authorityPath));
      const authority = JSON.parse(readFileSync(authorityPath, 'utf8')) as Record<
        string,
        unknown
      > & {
        goalExecutionIrRef: { path: string; hash: string };
      };
      const originalIrPath = path.join(outRoot, ...authority.goalExecutionIrRef.path.split('/'));
      const relocatedRef = 'relocated/goal-execution-ir.json';
      const relocatedPath = path.join(outRoot, ...relocatedRef.split('/'));
      mkdirSync(path.dirname(relocatedPath), { recursive: true });
      copyFileSync(originalIrPath, relocatedPath);
      authority.goalExecutionIrRef = { ...authority.goalExecutionIrRef, path: relocatedRef };
      delete authority.activeAuthorityHash;
      authority.activeAuthorityHash = hashControlPlaneValue(authority);
      writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, 'utf8');

      const reused = activate(fixture.root, authorityPath);

      expect(reused.status, reused.stderr || reused.stdout).toBe(0);
      expect(reused.result.status).toBe('activation_reused');
      expect(artifact(reused.result, 'candidate_run')).toEqual(firstCandidate);
      expect(artifact(reused.result, 'activation_record')).toEqual(firstActivation);
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    {
      crashPoint: 'before pointer rename',
      removePointer: true,
      expectedStatus: 'activation_reused',
      expectedLockExists: false,
    },
    {
      crashPoint: 'after pointer rename',
      removePointer: false,
      expectedStatus: 'activation_reused',
      expectedLockExists: true,
    },
  ])(
    'recovers a crashed CAS lock owner $crashPoint',
    ({ removePointer, expectedStatus, expectedLockExists }) => {
      const fixture = materializeImplementationReadinessFixture();
      try {
        produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
        const compiled = compileRequirementsBackedGoal({
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot: path.join(fixture.root, 'goal-run'),
        });
        const first = activate(fixture.root, compiled.activeAuthorityRef.path);
        expect(first.status, first.stderr || first.stdout).toBe(0);
        const pointerPath = artifact(first.result, 'active_run_pointer').artifactRef;
        const lockPath = activeRunLockPath(pointerPath);
        if (removePointer) rmSync(pointerPath);
        const crashed = crashWithActiveRunLock(lockPath);
        expect(crashed.status).not.toBe(0);
        expect(existsSync(lockPath)).toBe(true);

        const recovered = activate(fixture.root, compiled.activeAuthorityRef.path);

        expect(recovered.status, recovered.stderr || recovered.stdout).toBe(0);
        expect(recovered.result.status).toBe(expectedStatus);
        expect(existsSync(pointerPath)).toBe(true);
        expect(existsSync(lockPath)).toBe(expectedLockExists);
      } finally {
        fixture.cleanup();
      }
    }
  );

  it('serializes concurrent recovery of the same stale lock and pointer version', async () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const compiled = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const first = activate(fixture.root, compiled.activeAuthorityRef.path);
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const pointerPath = artifact(first.result, 'active_run_pointer').artifactRef;
      const lockPath = activeRunLockPath(pointerPath);
      rmSync(pointerPath);
      const crashed = crashWithActiveRunLock(lockPath);
      expect(crashed.status).not.toBe(0);

      const contenders = await Promise.all([
        activateAsync(fixture.root, compiled.activeAuthorityRef.path),
        activateAsync(fixture.root, compiled.activeAuthorityRef.path),
      ]);

      expect(contenders.map((entry) => entry.status)).toEqual([0, 0]);
      expect(contenders.map((entry) => (entry.result as { status: string }).status).sort()).toEqual(
        ['activation_reused', 'activation_reused']
      );
      expect(existsSync(activeRunClaimPath(pointerPath))).toBe(true);
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
