import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry';

const mocks = vi.hoisted(() => ({
  spawnSync: vi.fn((_command: string, _options: { cwd: string }) => ({
    status: 0,
    stdout: '',
    stderr: '',
  })),
}));

vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }));

import { requirementsContractProductionActivateCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-activate';

const mutableFs = createRequire(path.resolve('package.json'))(
  'node:fs'
) as typeof import('node:fs');
const REGISTRY = '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
const LOCK =
  '_bmad/shared/requirements-contract/.requirements-contract-consumer-registry.activation.lock';
const CONTRACT =
  'docs/plans/2026-07-18-loop-engineering-evidence-closure-remediation-amend13-goal-execution-plan.md';
const roots: string[] = [];

function write(root: string, relativePath: string, value: string): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'production-activation-snapshot-'));
  roots.push(root);
  const requirementSetId = `req-${randomUUID()}`;
  const attemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
  const record = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  write(root, record, `${JSON.stringify({ requirementSetId, currentAttemptId: attemptId })}\n`);
  write(
    root,
    REGISTRY,
    `${JSON.stringify({
      schemaVersion: 'requirements-contract-consumer-registry/v1',
      requirementSetId,
      shadowOutputEnabled: true,
      v1OutputEnabled: true,
      productionReadModelVersion: 'v1',
    })}\n`
  );
  write(root, 'package.json', '{"name":"candidate"}\n');
  write(root, 'src/candidate.ts', 'export const candidate = true;\n');
  write(root, 'config/candidate.json', '{"enabled":true}\n');
  write(root, 'packages/bmad-speckit/bin/bmad-speckit.js', '#!/usr/bin/env node\n');
  const registeredStatusFacade = REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS.find(
    (definition) =>
      definition.roles.includes('status_facade') && definition.canonicalPath.endsWith('.ts')
  );
  if (!registeredStatusFacade) {
    throw new Error('registered status facade fixture is unavailable');
  }
  write(
    root,
    registeredStatusFacade.canonicalPath,
    'export const facadeBinding = resolveVerifiedSixModelStatus;\n'
  );
  mkdirSync(path.dirname(path.join(root, CONTRACT)), { recursive: true });
  copyFileSync(path.resolve(CONTRACT), path.join(root, CONTRACT));
  return {
    root,
    record,
    registeredStatusFacadePath: registeredStatusFacade.canonicalPath,
  };
}

function files(root: string, current = root): string[] {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(current, entry.name);
    return entry.isDirectory()
      ? files(root, target)
      : [path.relative(root, target).replace(/\\/g, '/')];
  });
}

function activate(value: ReturnType<typeof fixture>, json = false) {
  return requirementsContractProductionActivateCommand({
    cwd: value.root,
    requirementRecord: value.record,
    registry: REGISTRY,
    activationPlanDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plans',
    activationPlanWriteReceiptDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plan-write-receipts',
    successReceipt:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json',
    blockedAttemptDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-attempts',
    json,
  });
}

afterEach(() => {
  mocks.spawnSync.mockReset();
  mocks.spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
  while (roots.length) {
    rmSync(roots.pop()!, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  }
});

it('tests complete candidate code and exact ARTIFACT-12 bytes inside the plan-bound snapshot', async () => {
  const value = fixture();
  const receipt = await activate(value);
  const plan = JSON.parse(readFileSync(path.join(value.root, receipt.activationPlan.path), 'utf8'));
  const snapshot = path.join(value.root, plan.plannedSnapshotPath);
  const manifest = JSON.parse(readFileSync(path.join(snapshot, 'snapshot-manifest.json'), 'utf8'));

  expect(readFileSync(path.join(snapshot, 'src/candidate.ts'), 'utf8')).toContain('candidate');
  expect(readFileSync(path.join(snapshot, 'config/candidate.json'), 'utf8')).toContain('enabled');
  expect(manifest).toMatchObject({
    activationPlanPath: receipt.activationPlan.path,
    activationPlanHash: receipt.activationPlan.hash,
  });
  expect(mocks.spawnSync.mock.calls.map((call) => path.resolve(call[1].cwd))).toEqual(
    Array(4).fill(path.resolve(snapshot))
  );
  const snapshotRegistry = readFileSync(path.join(snapshot, REGISTRY));
  expect(snapshotRegistry.equals(readFileSync(path.join(value.root, REGISTRY)))).toBe(true);
  expect(`sha256:${createHash('sha256').update(snapshotRegistry).digest('hex')}`).toBe(
    plan.registry.targetArtifact12Hash
  );
  const activatedRegistry = JSON.parse(snapshotRegistry.toString('utf8'));
  expect(activatedRegistry.sixModelConsumerInventory).toMatchObject({
    schemaVersion: 'requirements-contract-six-model-consumer-inventory/v1',
    missingConsumerPaths: [],
    directAuthorityReadPaths: [],
    unregisteredConsumerCount: 0,
    directAuthorityReadCount: 0,
  });
  expect(activatedRegistry.sixModelConsumerInventory.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: value.registeredStatusFacadePath,
        canonicalPath: value.registeredStatusFacadePath,
        pathHash: `sha256:${createHash('sha256')
          .update(readFileSync(path.join(value.root, value.registeredStatusFacadePath)))
          .digest('hex')}`,
      }),
    ])
  );
  const snapshotFiles = files(snapshot);
  expect(snapshotFiles.some((file) => file.startsWith('docs/plans/evidence/'))).toBe(false);
  expect(snapshotFiles.some((file) => file.endsWith('.safe-write-receipt.json'))).toBe(false);
});

it('blocks before planning when dynamic discovery finds an unregistered six-model consumer', async () => {
  const value = fixture();
  const registryPath = path.join(value.root, REGISTRY);
  const registryPreimage = readFileSync(registryPath);
  const unregisteredConsumerPath = `packages/runtime-${randomUUID()}/src/status-reader.ts`;
  write(
    value.root,
    unregisteredConsumerPath,
    'export const readStatus = (record) => record.sixModelResults;\n'
  );

  await expect(activate(value)).rejects.toMatchObject({
    code: 'scope_amendment_required',
    missingConsumerPaths: [unregisteredConsumerPath],
    unregisteredConsumerCount: 1,
  });
  expect(readFileSync(registryPath).equals(registryPreimage)).toBe(true);
  expect(mocks.spawnSync).not.toHaveBeenCalled();
});

it('blocks when a passing nested command changes the tested snapshot ARTIFACT-12 bytes', async () => {
  const value = fixture();
  const liveRegistry = path.join(value.root, REGISTRY);
  const preimage = readFileSync(liveRegistry);
  mocks.spawnSync.mockImplementation((_command, options) => {
    if (mocks.spawnSync.mock.calls.length === 1) {
      writeFileSync(path.join(options.cwd, REGISTRY), '{"drift":true}\n', 'utf8');
    }
    return { status: 0, stdout: '', stderr: '' };
  });

  const receipt = await activate(value);

  expect(receipt).toMatchObject({
    activationOutcome: 'blocked',
    failure: { code: 'candidate_artifact12_mismatch', phase: 'candidate_snapshot' },
    compareAndSwap: { decision: 'blocked' },
  });
  expect(readFileSync(liveRegistry).equals(preimage)).toBe(true);
  expect(
    existsSync(`${path.join(value.root, receipt.selectedReceiptPath)}.safe-write-receipt.json`)
  ).toBe(false);
});

it('publishes the success receipt only after releasing the activation lock', async () => {
  const value = fixture();
  let lockHeldAtPublish: boolean | undefined;
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    if (String(chunk).includes('"activationOutcome":"success"')) {
      lockHeldAtPublish = existsSync(path.join(value.root, LOCK));
    }
    return true;
  }) as typeof process.stdout.write);
  try {
    const receipt = await activate(value, true);
    expect(receipt.activationOutcome).toBe('success');
  } finally {
    stdout.mockRestore();
  }

  expect(lockHeldAtPublish).toBe(false);
  expect(existsSync(path.join(value.root, LOCK))).toBe(false);
});

it('does not overwrite an external registry update when compare-and-swap blocks', async () => {
  const value = fixture();
  const liveRegistry = path.join(value.root, REGISTRY);
  const concurrentBytes = '{"externalUpdate":true}\n';
  mocks.spawnSync.mockImplementation(() => {
    if (mocks.spawnSync.mock.calls.length === 1) {
      writeFileSync(liveRegistry, concurrentBytes, 'utf8');
    }
    return { status: 0, stdout: '', stderr: '' };
  });

  const receipt = await activate(value);

  expect(receipt).toMatchObject({
    activationOutcome: 'blocked',
    failure: { code: 'registry_preimage_mismatch', phase: 'compare_and_swap' },
    compareAndSwap: { decision: 'blocked' },
  });
  expect(readFileSync(liveRegistry, 'utf8')).toBe(concurrentBytes);
  expect(receipt.restoration.restoredRegistryHash).toBe(
    `sha256:${createHash('sha256').update(concurrentBytes).digest('hex')}`
  );
});

it('rolls back its own registry write under lock when the success receipt collides', async () => {
  const value = fixture();
  const liveRegistry = path.join(value.root, REGISTRY);
  const preimage = readFileSync(liveRegistry);
  const successReceipt =
    'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json';
  write(value.root, successReceipt, '{"existing":true}\n');
  let lockHeldAtRollback: boolean | undefined;
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    if (String(chunk).includes('"activationOutcome":"blocked"')) {
      lockHeldAtRollback = existsSync(path.join(value.root, LOCK));
    }
    return true;
  }) as typeof process.stdout.write);
  try {
    const receipt = await activate(value, true);
    expect(receipt).toMatchObject({
      activationOutcome: 'blocked',
      failure: { code: 'success_receipt_already_exists', phase: 'receipt' },
      restoration: { registryRestored: true, decision: 'pass' },
    });
  } finally {
    stdout.mockRestore();
  }

  expect(lockHeldAtRollback).toBe(true);
  expect(readFileSync(liveRegistry).equals(preimage)).toBe(true);
});

it('reacquires the activation lock and rolls back when success receipt publication loses a race', async () => {
  const value = fixture();
  const liveRegistry = path.join(value.root, REGISTRY);
  const preimage = readFileSync(liveRegistry);
  const successReceipt =
    'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json';
  const successReceiptPath = path.join(value.root, successReceipt);
  const lockPath = path.join(value.root, LOCK);
  const originalExistsSync = mutableFs.existsSync;
  let collisionInjected = false;
  let lockHeldAtCollision: boolean | undefined;
  const exists = vi.spyOn(mutableFs, 'existsSync').mockImplementation((candidate) => {
    if (
      !collisionInjected &&
      path.resolve(String(candidate)) === path.resolve(successReceiptPath) &&
      !originalExistsSync(lockPath)
    ) {
      collisionInjected = true;
      lockHeldAtCollision = false;
      mkdirSync(path.dirname(successReceiptPath), { recursive: true });
      writeFileSync(successReceiptPath, '{"external":true}\n', 'utf8');
      return true;
    }
    return originalExistsSync(candidate);
  });
  let lockHeldAtRollback: boolean | undefined;
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    if (String(chunk).includes('"activationOutcome":"blocked"')) {
      lockHeldAtRollback = existsSync(path.join(value.root, LOCK));
    }
    return true;
  }) as typeof process.stdout.write);
  try {
    const receipt = await activate(value, true);
    expect(receipt).toMatchObject({
      activationOutcome: 'blocked',
      failure: { code: 'success_receipt_already_exists', phase: 'receipt' },
      restoration: { registryRestored: true, decision: 'pass' },
    });
    expect(existsSync(path.join(value.root, receipt.selectedReceiptPath))).toBe(true);
  } finally {
    exists.mockRestore();
    stdout.mockRestore();
  }

  expect(lockHeldAtCollision).toBe(false);
  expect(lockHeldAtRollback).toBe(true);
  expect(readFileSync(liveRegistry).equals(preimage)).toBe(true);
  expect(readFileSync(path.join(value.root, successReceipt), 'utf8')).toBe('{"external":true}\n');
  expect(existsSync(path.join(value.root, LOCK))).toBe(false);
});
