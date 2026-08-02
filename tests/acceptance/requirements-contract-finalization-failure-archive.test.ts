import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyRequirementsContractSafeWritePath,
  resolveRequirementsContractSafeWriteTargetSet,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-safe-write-target-registry';
import { requirementsContractFinalizationSafeWriteCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-finalization-safe-writer';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

type Role = {
  artifactRole: string;
  validationProfile: string;
  draft: string;
  target: string;
  receipt: string;
  predecessor: string;
};

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  const text = `${JSON.stringify(value)}\n`;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return text;
}

function createFixture(root: string) {
  const requirementSetId = `req-${randomUUID()}`;
  const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
  const requirementRecord = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  const staging = `${BASE}/.finalization-staging/${implementationAttemptId}`;
  const declarationHash = sha256('failure-archive-declaration');
  writeJson(root, requirementRecord, {
    schemaVersion: 'requirement-record/v1',
    recordId: requirementSetId,
    requirementSetId,
    currentAttemptId: implementationAttemptId,
    status: 'user_confirmed',
    sourcePath: 'source.md',
    sourceDocumentHash: sha256('source'),
    implementationConfirmationHash: sha256('confirmation'),
    confirmationHistory: createRecordedConfirmationHistory({
      recordId: requirementSetId,
      sourcePath: 'source.md',
      sourceDocumentHash: sha256('source'),
      implementationConfirmationHash: sha256('confirmation'),
    }),
    semanticModelHash: sha256('semantic'),
  });
  const first: Role = {
    artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
    validationProfile: 'safe-write-receipt-manifest',
    draft: `${staging}/safe-write-receipt-manifest.json`,
    target: `${BASE}/safe-write-receipt-manifest.json`,
    receipt: `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
    predecessor: 'not_applicable',
  };
  const second: Role = {
    artifactRole: 'EVD-15',
    validationProfile: 'goal-task-evidence',
    draft: `${staging}/G15-final-gates.json`,
    target: `${BASE}/G15-final-gates.json`,
    receipt: `${BASE}/finalization-receipts/G15-final-gates.receipt.json`,
    predecessor: first.receipt,
  };
  const options = (role: Role) => ({
    cwd: root,
    requirementRecord,
    implementationAttemptId,
    draft: role.draft,
    target: role.target,
    receipt: role.receipt,
    blockedReceiptRoot: `${BASE}/finalization-receipts/blocked`,
    artifactRole: role.artifactRole,
    validationProfile: role.validationProfile,
    minBytes: 2,
    finalizationDeclarationHash: declarationHash,
    expectedPredecessorReceipt: role.predecessor,
    json: false,
  });
  return {
    declarationHash,
    first,
    implementationAttemptId,
    options,
    requirementSetId,
    second,
  };
}

async function blockedPath(promise: Promise<unknown>, code: string): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(
      new RegExp(`^finalization_safe_write_blocked:([^:]+):${code}$`, 'u')
    );
    expect(match, message).not.toBeNull();
    return match?.[1] ?? '';
  }
  throw new Error('expected finalization safe writer to block');
}

describe('requirements contract finalization failure archive', () => {
  it('reports a missing canonical draft without masking the input failure as a BLOCK schema error', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-missing-draft-'));
    try {
      const fixture = createFixture(root);

      await expect(
        requirementsContractFinalizationSafeWriteCommand(fixture.options(fixture.first))
      ).rejects.toThrow('finalization_safe_write_draft_missing');
      expect(
        existsSync(
          path.join(
            root,
            `${BASE}/finalization-receipts/blocked/${fixture.implementationAttemptId}`
          )
        )
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('archives exact failed bytes, preserves predecessor evidence, and keeps archive evidence outside the receipt-complete set', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-archive-'));
    try {
      const fixture = createFixture(root);
      writeJson(root, fixture.first.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
      });
      await requirementsContractFinalizationSafeWriteCommand(fixture.options(fixture.first));
      const predecessorPath = path.join(root, fixture.first.receipt);
      const predecessorBytes = readFileSync(predecessorPath, 'utf8');

      const failedDraftBytes = writeJson(root, fixture.second.draft, {
        schemaVersion: 'invalid-goal-task-evidence/v1',
        rejected: true,
      });
      const blockedRelative = await blockedPath(
        requirementsContractFinalizationSafeWriteCommand(fixture.options(fixture.second)),
        'finalization_safe_write_draft_schema_invalid'
      );
      const blockedPathname = path.join(root, blockedRelative);
      const blockedBytes = readFileSync(blockedPathname, 'utf8');
      const blocked = JSON.parse(blockedBytes);
      const archiveBytes = readFileSync(path.join(root, blocked.draft.archivedPath), 'utf8');
      const registryContext = {
        requirementSetId: fixture.requirementSetId,
        implementationAttemptId: fixture.implementationAttemptId,
        bundleRevision: 'BUNDLE-1',
        activationAttemptId: 'ACTIVATION-1',
        sourcePrdPath: 'source.md',
        consumerRegistryPath: '_bmad/shared/requirements-contract/registry.json',
        evidenceRoot: BASE,
        goalExecutionApplicable: false,
        activationOutcome: 'success' as const,
      };

      expect(blocked).toMatchObject({
        result: 'BLOCK',
        artifactRole: 'EVD-15',
        retryRole: 'EVD-15',
        selectedReceiptPath: blockedRelative,
        failure: { code: 'finalization_safe_write_draft_schema_invalid' },
      });
      expect(archiveBytes).toBe(failedDraftBytes);
      expect(blocked.draft.archivedHash).toBe(sha256(archiveBytes));
      expect(readFileSync(predecessorPath, 'utf8')).toBe(predecessorBytes);
      expect(existsSync(path.join(root, fixture.second.target))).toBe(false);
      expect(existsSync(path.join(root, fixture.second.receipt))).toBe(false);
      expect(
        existsSync(
          path.join(root, `${BASE}/finalization-receipts/implementation-evidence.receipt.json`)
        )
      ).toBe(false);
      expect(classifyRequirementsContractSafeWritePath(blockedRelative, registryContext)).toBe(
        'excluded_control_evidence'
      );
      expect(
        classifyRequirementsContractSafeWritePath(blocked.draft.archivedPath, registryContext)
      ).toBe('excluded_control_evidence');
      expect(resolveRequirementsContractSafeWriteTargetSet(registryContext).targets).not.toContain(
        blocked.draft.archivedPath
      );

      const retryDraftBytes = writeJson(root, fixture.second.draft, {
        schemaVersion: 'requirements-contract-goal-task-evidence/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
      });
      const retry = await requirementsContractFinalizationSafeWriteCommand(
        fixture.options(fixture.second)
      );

      expect(retry.result).toBe('PASS');
      expect(readFileSync(path.join(root, fixture.second.target), 'utf8')).toBe(retryDraftBytes);
      expect(readFileSync(predecessorPath, 'utf8')).toBe(predecessorBytes);
      expect(readFileSync(blockedPathname, 'utf8')).toBe(blockedBytes);
      expect(readFileSync(path.join(root, blocked.draft.archivedPath), 'utf8')).toBe(archiveBytes);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a fixed PASS receipt already exists and never rewrites its target or receipt', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-immutable-'));
    try {
      const fixture = createFixture(root);
      writeJson(root, fixture.first.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
      });
      await requirementsContractFinalizationSafeWriteCommand(fixture.options(fixture.first));
      const targetPath = path.join(root, fixture.first.target);
      const receiptPath = path.join(root, fixture.first.receipt);
      const targetBytes = readFileSync(targetPath, 'utf8');
      const receiptBytes = readFileSync(receiptPath, 'utf8');

      const replayDraftBytes = writeJson(root, fixture.first.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
        replay: true,
      });
      const blockedRelative = await blockedPath(
        requirementsContractFinalizationSafeWriteCommand(fixture.options(fixture.first)),
        'finalization_safe_write_success_receipt_immutable'
      );
      const blocked = JSON.parse(readFileSync(path.join(root, blockedRelative), 'utf8'));

      expect(readFileSync(targetPath, 'utf8')).toBe(targetBytes);
      expect(readFileSync(receiptPath, 'utf8')).toBe(receiptBytes);
      expect(readFileSync(path.join(root, blocked.draft.archivedPath), 'utf8')).toBe(
        replayDraftBytes
      );
      expect(blocked).toMatchObject({
        result: 'BLOCK',
        selectedReceiptPath: blockedRelative,
        failure: { code: 'finalization_safe_write_success_receipt_immutable' },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
