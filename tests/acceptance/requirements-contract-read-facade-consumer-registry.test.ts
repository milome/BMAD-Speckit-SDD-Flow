import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRequirementsContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade';

interface ConsumerRegistry {
  schemaVersion: string;
  consumers: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

const ROOT = process.cwd();
const REGISTRY_RELATIVE_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';

function writeActiveRegistry(root: string): ConsumerRegistry {
  const registry = JSON.parse(
    readFileSync(path.join(ROOT, REGISTRY_RELATIVE_PATH), 'utf8')
  ) as ConsumerRegistry;
  const activeRegistry = {
    ...registry,
    requirementSetId: `read-facade-registry-${randomUUID()}`,
    shadowOutputEnabled: false,
    v1OutputEnabled: false,
    productionReadModelVersion: 'v2',
    activationReceiptId: `ACT-RECEIPT-${randomUUID().toUpperCase()}`,
  };
  const target = path.join(root, REGISTRY_RELATIVE_PATH);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(activeRegistry, null, 2)}\n`, 'utf8');
  return activeRegistry;
}

describe('requirements contract read facade Consumer Registry integration', () => {
  it('accepts the canonical v2 registry contract before source validation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'read-facade-registry-'));
    try {
      const registry = writeActiveRegistry(root);
      const consumer = registry.consumers.find(
        (candidate) => candidate.consumerId === 'source-instance-linter'
      );
      expect(consumer).toBeDefined();

      const result = readRequirementsContract({
        projectRoot: root,
        consumerId: String(consumer?.consumerId),
        mode: 'draft',
        envelope: {
          requirementSetId: `missing-source-${randomUUID()}`,
          sourcePath: 'docs/requirements/missing-source.md',
          sourceHash: `sha256:${'a'.repeat(64)}`,
          sourceFormatVersion: 'requirement-contract-model/v2',
          activeBundleRevision: `BUNDLE-REV-${randomUUID().toUpperCase()}`,
          semanticModelHash: `sha256:${'b'.repeat(64)}`,
          traceGraphHash: `sha256:${'c'.repeat(64)}`,
          cutoverId: `V2-CUTOVER-${randomUUID().toUpperCase()}`,
        },
      });

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        adapterInvoked: false,
      });
      expect(result.issues.map((issue) => issue.code)).toEqual(['source_missing']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a canonical consumer row whose facade binding is mutated', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'read-facade-registry-'));
    try {
      const registry = writeActiveRegistry(root);
      registry.consumers = registry.consumers.map((consumer) =>
        consumer.consumerId === 'source-instance-linter'
          ? { ...consumer, readFacadeRef: 'unregistered-read-facade' }
          : consumer
      );
      const target = path.join(root, REGISTRY_RELATIVE_PATH);
      writeFileSync(target, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

      const result = readRequirementsContract({
        projectRoot: root,
        consumerId: 'source-instance-linter',
        mode: 'draft',
        envelope: {
          requirementSetId: `missing-source-${randomUUID()}`,
          sourcePath: 'docs/requirements/missing-source.md',
          sourceHash: `sha256:${'a'.repeat(64)}`,
          sourceFormatVersion: 'requirement-contract-model/v2',
          activeBundleRevision: `BUNDLE-REV-${randomUUID().toUpperCase()}`,
          semanticModelHash: `sha256:${'b'.repeat(64)}`,
          traceGraphHash: `sha256:${'c'.repeat(64)}`,
          cutoverId: `V2-CUTOVER-${randomUUID().toUpperCase()}`,
        },
      });

      expect(result.adapterInvoked).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toEqual([
        'consumer_contract_mismatch',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
