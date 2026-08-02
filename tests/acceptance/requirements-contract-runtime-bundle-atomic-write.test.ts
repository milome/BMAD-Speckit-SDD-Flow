import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { requirementsContractBundlePublishCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bundle-publish';

const MEMBERS = [
  ['semantic-ir.json', 'requirement-contract-model/v2'],
  ['trace-graph.json', 'requirements-contract-trace-graph/v1'],
  ['target-bindings.json', 'requirements-contract-target-bindings/v1'],
  ['task-graph.json', 'requirements-contract-task-graph/v1'],
  ['red-contracts.json', 'requirements-contract-red-contracts/v1'],
  ['oracle-registry.json', 'requirements-contract-oracle-registry/v1'],
  ['acceptance-contracts.json', 'requirements-contract-acceptance-manifest/v1'],
  ['evidence-requirements.json', 'requirements-contract-evidence-requirements/v1'],
  ['business-behavior-delta.json', 'requirements-contract-business-behavior-delta/v1'],
  ['implementation-impact-map.json', 'requirements-contract-implementation-impact-map/v1'],
] as const;

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

it('rolls back a promoted Bundle revision when activation cannot acquire the control lock', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-bundle-atomic-'));
  try {
    const requirementSetId = `req-${randomUUID()}`;
    const acceptanceRootId = `AR-${randomUUID()}`;
    const recordRoot = path.join(
      root,
      '_bmad-output/runtime/requirement-records',
      requirementSetId
    );
    const authoringRoot = path.join(recordRoot, 'authoring');
    const currentRoot = path.join(authoringRoot, 'current');
    mkdirSync(path.join(currentRoot, 'proofs'), { recursive: true });
    const sourcePath = path.join(root, 'source.md');
    writeFileSync(sourcePath, '# Source\n', 'utf8');
    const recordPath = path.join(recordRoot, 'requirement-record.json');
    writeJson(recordPath, {
      schemaVersion: 'requirement-record/v1',
      recordId: requirementSetId,
      requirementSetId,
      currentAttemptId: `IMP-${randomUUID()}`,
      status: 'user_confirmed',
      sourcePath,
      sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
      implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
      semanticModelHash: `sha256:${'3'.repeat(64)}`,
      recordRevision: 0,
      activeBundleRevision: null,
    });
    for (const [fileName, schemaVersion] of MEMBERS) {
      writeJson(
        path.join(currentRoot, fileName),
        fileName === 'acceptance-contracts.json'
          ? { schemaVersion, acceptanceRootIds: [acceptanceRootId] }
          : { schemaVersion, id: `${fileName}-${randomUUID()}` }
      );
    }
    writeJson(path.join(currentRoot, 'acceptance-root-proof-manifest.json'), {
      orderedRootIds: [acceptanceRootId],
    });
    for (const proofName of [
      'intake-receipt.json',
      'intent-lineage-ledger.json',
      'semantic-conservation-manifest.json',
    ]) {
      writeJson(path.join(currentRoot, 'proofs', proofName), { decision: 'pass' });
    }

    mkdirSync(path.join(authoringRoot, '.bundle-publish.lock'));
    const receiptPath = path.join(root, 'bundle-publication-receipt.json');
    await expect(
      requirementsContractBundlePublishCommand({
        cwd: root,
        requirementRecord: recordPath,
        sourceDocument: sourcePath,
        receipt: receiptPath,
      })
    ).rejects.toThrow(/EEXIST/u);

    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    expect(record).toMatchObject({ recordRevision: 0, activeBundleRevision: null });
    expect(readdirSync(path.join(authoringRoot, 'revisions'))).toEqual([]);
    expect(readdirSync(path.join(authoringRoot, '.staging'))).toEqual([]);
    expect(existsSync(receiptPath)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
