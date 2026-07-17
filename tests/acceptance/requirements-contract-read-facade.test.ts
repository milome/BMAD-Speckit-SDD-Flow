import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readRequirementsContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade';

const readFacadePath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade.ts'
);

it('publishes RequirementsContractReadFacade as the canonical production semantic read entry', () => {
  expect(existsSync(readFacadePath)).toBe(true);
});

it('blocks before adapter selection when the canonical Consumer Registry is missing', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-read-facade-'));
  try {
    const result = readRequirementsContract({
      projectRoot: root,
      consumerId: 'fixture-consumer',
      mode: 'draft',
      envelope: {
        requirementSetId: 'read-facade-fixture',
        sourcePath: 'docs/requirements/read-facade-fixture.md',
        sourceHash: `sha256:${'a'.repeat(64)}`,
        sourceFormatVersion: 'requirement-contract-model/v2',
        activeBundleRevision: 'BUNDLE-REV-001',
        semanticModelHash: `sha256:${'b'.repeat(64)}`,
        traceGraphHash: `sha256:${'c'.repeat(64)}`,
        cutoverId: 'CUTOVER-001',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      adapterInvoked: false,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(['consumer_registry_missing']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('blocks an unregistered consumer before adapter selection', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-read-facade-'));
  try {
    const registryPath = path.join(
      root,
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
    );
    mkdirSync(path.dirname(registryPath), { recursive: true });
    writeFileSync(
      registryPath,
      `${JSON.stringify({
        schemaVersion: 'requirements-contract-consumer-registry/v1',
        activation: {
          shadowOutputEnabled: false,
          v1OutputEnabled: false,
          productionReadModelVersion: 'v2',
          activationReceiptId: 'ACT-RECEIPT-001',
        },
        consumers: [],
      })}\n`,
      'utf8'
    );

    const result = readRequirementsContract({
      projectRoot: root,
      consumerId: 'unregistered-consumer',
      mode: 'draft',
      envelope: {
        requirementSetId: 'read-facade-fixture',
        sourcePath: 'docs/requirements/read-facade-fixture.md',
        sourceHash: `sha256:${'a'.repeat(64)}`,
        sourceFormatVersion: 'requirement-contract-model/v2',
        activeBundleRevision: 'BUNDLE-REV-001',
        semanticModelHash: `sha256:${'b'.repeat(64)}`,
        traceGraphHash: `sha256:${'c'.repeat(64)}`,
        cutoverId: 'CUTOVER-001',
      },
    });

    expect(result.adapterInvoked).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(['consumer_not_registered']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
