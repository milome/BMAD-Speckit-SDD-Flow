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
import { describe, expect, it } from 'vitest';
import { requirementsContractBundlePublishCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bundle-publish';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

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

describe('requirements contract Bundle publish command', () => {
  it('commits one complete revision through the Requirement Record control store', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-bundle-publish-'));
    try {
      const requirementSetId = `req-${randomUUID()}`;
      const acceptanceRootId = `AR-${randomUUID()}`;
      const recordRoot = path.join(
        root,
        '_bmad-output/runtime/requirement-records',
        requirementSetId
      );
      const current = path.join(recordRoot, 'authoring/current');
      mkdirSync(path.join(current, 'proofs'), { recursive: true });
      const sourcePath = path.join(root, 'source.md');
      writeFileSync(sourcePath, '# Source\n');
      writeFileSync(
        path.join(recordRoot, 'requirement-record.json'),
        `${JSON.stringify({
          schemaVersion: 'requirement-record/v1',
          recordId: requirementSetId,
          requirementSetId,
          currentAttemptId: `IMP-${randomUUID()}`,
          status: 'user_confirmed',
          sourcePath,
          sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
          implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
          confirmationHistory: createRecordedConfirmationHistory({
            recordId: requirementSetId,
            sourcePath,
            sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
            implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
          }),
          semanticModelHash: `sha256:${'3'.repeat(64)}`,
          recordRevision: 0,
          activeBundleRevision: null,
        })}\n`
      );
      for (const [fileName, schemaVersion] of MEMBERS) {
        const value =
          fileName === 'acceptance-contracts.json'
            ? { schemaVersion, acceptanceRootIds: [acceptanceRootId] }
            : { schemaVersion, id: `${fileName}-${randomUUID()}` };
        writeFileSync(path.join(current, fileName), `${JSON.stringify(value)}\n`);
      }
      writeFileSync(
        path.join(current, 'acceptance-root-proof-manifest.json'),
        `${JSON.stringify({ orderedRootIds: [acceptanceRootId] })}\n`
      );
      for (const proofName of [
        'intake-receipt.json',
        'intent-lineage-ledger.json',
        'semantic-conservation-manifest.json',
      ]) {
        writeFileSync(path.join(current, 'proofs', proofName), `${JSON.stringify({ decision: 'pass' })}\n`);
      }
      const receiptPath = path.join(root, 'bundle-publication-receipt.json');
      const receipt = await requirementsContractBundlePublishCommand({
        cwd: root,
        requirementRecord: path.join(recordRoot, 'requirement-record.json'),
        sourceDocument: sourcePath,
        receipt: receiptPath,
        json: false,
      });

      const record = JSON.parse(readFileSync(path.join(recordRoot, 'requirement-record.json'), 'utf8'));
      const revisionRoot = path.join(recordRoot, 'authoring/revisions', receipt.bundleRevision);
      expect(receipt.result).toBe('pass');
      expect(record.activeBundleRevision).toBe(receipt.bundleRevision);
      expect(record.recordRevision).toBe(1);
      expect(readdirSync(revisionRoot).sort()).toHaveLength(11);
      expect(existsSync(path.join(revisionRoot, 'bundle-manifest.json'))).toBe(true);
      expect(readdirSync(path.join(recordRoot, 'authoring/.staging'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
