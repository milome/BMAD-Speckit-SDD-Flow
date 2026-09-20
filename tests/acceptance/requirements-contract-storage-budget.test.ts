import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as storageModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-storage';
import * as retentionModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-retention-policy';

function requiredFunction<T>(name: string): T {
  const value = Reflect.get(storageModule, name) as T | undefined;
  expect(value, `${name} must be exported`).toBeTypeOf('function');
  if (!value) throw new Error(`${name} missing`);
  return value;
}

describe('requirements durable storage budget', () => {
  it('exposes the bounded retention policy', () => {
    expect(retentionModule.DEFAULT_REQUIREMENTS_CONTRACT_RETENTION_POLICY).toMatchObject({
      warningBytes: 24 * 1024 * 1024,
      maxDurableBytes: 32 * 1024 * 1024,
      orphanTtlMs: 24 * 60 * 60 * 1000,
      retainedPredecessorBuilds: 1,
      retainedFailureSummaries: 1,
      maxJudgeInvocationsPerOperation: 2,
      maxAutomaticRepairsPerOperation: 1,
    });
  });
  it('warns at 24 MiB and blocks projected writes over 32 MiB', () => {
    const evaluate = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      'evaluateRequirementsContractStorageBudget'
    );
    expect(evaluate({ durableBytes: 24 * 1024 * 1024, incomingBytes: 0 })).toMatchObject({ decision: 'warn' });
    expect(evaluate({ durableBytes: 31 * 1024 * 1024, incomingBytes: 2 * 1024 * 1024 })).toMatchObject({ decision: 'block' });
    expect(evaluate({ durableBytes: 10 * 1024 * 1024, incomingBytes: 1 * 1024 * 1024, duplicateContent: true })).toMatchObject({ decision: 'pass', reservedBytes: 0 });
  });

  it('inventories durable and staging bytes and CAS-reserves a write', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-storage-'));
    try {
      const objectPath = path.join(root, 'authoring', 'objects', 'sha256', 'aa', 'blob');
      const stagingPath = path.join(root, 'authoring', '.staging', 'OP-1', 'manifest.json');
      mkdirSync(path.dirname(objectPath), { recursive: true });
      mkdirSync(path.dirname(stagingPath), { recursive: true });
      writeFileSync(objectPath, Buffer.alloc(16));
      writeFileSync(stagingPath, Buffer.alloc(7));
      const inventory = requiredFunction<(recordRoot: string) => Record<string, any>>(
        'inventoryRequirementsRecordStorage'
      )(root);
      expect(inventory).toMatchObject({ objectBytes: 16, stagingBytes: 7 });
      const reserve = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
        'reserveRequirementsRecordStorage'
      );
      expect(reserve({
        recordRoot: root,
        operationId: 'OP-1',
        expectedInventoryHash: inventory.inventoryHash,
        requestedUniqueBytes: 11,
        requestedMetadataBytes: 5,
      })).toMatchObject({ reservedBytes: 16, operationId: 'OP-1' });
      expect(() => reserve({
        recordRoot: root,
        operationId: 'OP-2',
        expectedInventoryHash: inventory.inventoryHash,
        requestedUniqueBytes: 1,
        requestedMetadataBytes: 0,
      })).toThrow('requirements_storage_reservation_inventory_changed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
