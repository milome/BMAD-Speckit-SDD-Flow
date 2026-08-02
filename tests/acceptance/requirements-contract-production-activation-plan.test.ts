import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawnSync: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })),
}));

vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }));

import { requirementsContractProductionActivateCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-activate';

const CONTRACT =
  'docs/plans/2026-07-18-loop-engineering-evidence-closure-remediation-amend13-goal-execution-plan.md';
const CONTRACT_HASH = '38d6301646351efb04dff330ac05b3bf5daa667ef31f1630f0b68031cddda90a';
const COMMAND_HASHES = [
  'sha256:be8d1023f85ca4896a5afd5ddcadbf4727a692bcf1333325e7e81e938966fee7',
  'sha256:2e2f1acca90ae7dc9cdde9216deaaf4147ca9e91d771e2a8dae14746b90fbdf8',
  'sha256:4a2f774c965628a78a45e4aa296ee30c9babd801161f47b3f0c8a3fdaf31c392',
  'sha256:e66312385762855ca5ec0965cfa226b421fff8472b2f48ca45e2466314a80dee',
];
const roots: string[] = [];

function write(root: string, relativePath: string, value: unknown): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'production-activation-plan-'));
  roots.push(root);
  const requirementSetId = `req-${randomUUID()}`;
  const attemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
  const record = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  const registry =
    '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
  write(root, record, {
    schemaVersion: 'requirement-record/v1',
    requirementSetId,
    currentAttemptId: attemptId,
  });
  write(root, registry, {
    schemaVersion: 'requirements-contract-consumer-registry/v1',
    requirementSetId,
    shadowOutputEnabled: true,
    v1OutputEnabled: true,
    productionReadModelVersion: 'v1',
  });
  write(root, 'packages/bmad-speckit/bin/bmad-speckit.js', {});
  mkdirSync(path.dirname(path.join(root, CONTRACT)), { recursive: true });
  copyFileSync(path.resolve(CONTRACT), path.join(root, CONTRACT));
  return { root, record, registry };
}

function activate(value: ReturnType<typeof fixture>) {
  return requirementsContractProductionActivateCommand({
    cwd: value.root,
    requirementRecord: value.record,
    registry: value.registry,
    activationPlanDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plans',
    activationPlanWriteReceiptDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plan-write-receipts',
    successReceipt:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json',
    blockedAttemptDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-attempts',
  });
}

afterEach(() => {
  mocks.spawnSync.mockClear();
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

it('binds the activation plan to the frozen AMEND-13 command text hashes', async () => {
  const value = fixture();
  const copiedContract = readFileSync(path.join(value.root, CONTRACT));
  expect(createHash('sha256').update(copiedContract).digest('hex')).toBe(CONTRACT_HASH);

  const receipt = await activate(value);
  const plan = JSON.parse(readFileSync(path.join(value.root, receipt.activationPlan.path), 'utf8'));

  expect(plan.nestedCommands.map((command: { argvHash: string }) => command.argvHash)).toEqual(
    COMMAND_HASHES
  );
  expect(mocks.spawnSync).toHaveBeenCalledTimes(4);
});

it('persists the plan promotion as a real large-document-writer receipt', async () => {
  const value = fixture();
  const receipt = await activate(value);
  const promotion = JSON.parse(
    readFileSync(path.join(value.root, receipt.activationPlan.promotionReceiptPath), 'utf8')
  );

  expect(promotion).toMatchObject({
    schemaVersion: 'large-document-writer-safe-write/v1',
    targetPath: path.join(value.root, receipt.activationPlan.path),
    mode: 'create',
    tempHash: receipt.activationPlan.hash,
    backupPath: null,
    originalHash: null,
    backupHash: null,
    finalHash: receipt.activationPlan.hash,
  });
  expect(promotion.tempPath).toBeTypeOf('string');
  expect(Date.parse(promotion.writtenAt)).not.toBeNaN();
});
