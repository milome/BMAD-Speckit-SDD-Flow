import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractFinalizationSafeWriteCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-finalization-safe-writer';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

const COMPLETION_SCHEMA_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-completion-evidence.schema.json';

function writeJson(root: string, relativePath: string, value: unknown) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

function completionBundle(implementationAttemptId: string) {
  const hash = sha256('fixture');
  const bundle: Record<string, unknown> = {
    schemaVersion: 'requirements-contract-completion-evidence/v1',
    transactionId: `TX-${randomUUID()}`,
    implementationAttemptId,
    auditAttemptId: `AUD-${randomUUID()}`,
    architectureAuditAttemptId: `AUD-${randomUUID()}`,
    preCandidateAuditAttemptId: `AUD-${randomUUID()}`,
    finalAuditAttemptId: `AUD-${randomUUID()}`,
    evidenceBundleId: `EVIDENCE-${randomUUID()}`,
    contractHash: hash,
    sourcePlanHash: hash,
    sourceAmendmentHashes: Array.from({ length: 10 }, (_, index) =>
      sha256(`fixture-amendment-${index + 1}`)
    ),
    aggregateAmendmentHash: hash,
    semanticModelHash: hash,
    sequenceContractHash: hash,
    closureReportHash: hash,
    coverage: {
      storyIds: ['S001'],
      acceptanceIds: ['AC-01'],
      traceIds: ['TR-01'],
      commandIds: ['CMD-01'],
    },
    criticalMetrics: { mismatchCount: 0 },
    evidenceIndex: Array.from({ length: 17 }, (_, index) => ({
      evidenceId: `EVD-${String(index).padStart(2, '0')}`,
      path: `evidence/${index}.json`,
      hash,
      decision: 'PASS',
    })),
    artifactIndex: Array.from({ length: 53 }, (_, index) => ({
      artifactId: `ARTIFACT-${String(index + 2).padStart(2, '0')}`,
      path: `artifacts/${index + 2}.json`,
      hash,
      decision: 'PASS',
    })),
  };
  const schema = JSON.parse(readFileSync(COMPLETION_SCHEMA_PATH, 'utf8'));
  for (const field of schema.required as string[]) {
    if (field in bundle) continue;
    if (field === 'goalExecutionApplicability') bundle[field] = 'required';
    else if (/(Bytes|Lines)$/u.test(field)) bundle[field] = 1;
    else if (/Authority$/u.test(field)) bundle[field] = `${field}-fixture`;
    else if (field.endsWith('Path')) bundle[field] = `bindings/${field}.json`;
    else if (field.endsWith('Hash')) bundle[field] = hash;
    else throw new Error(`unsupported_completion_fixture_field:${field}`);
  }
  return bundle;
}

describe('requirements contract finalization safe writer', () => {
  it('promotes the exact three-role chain and removes staging only after the final role', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-writer-'));
    const requirementSetId = `req-${randomUUID()}`;
    const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
    const record = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
    const base = 'docs/plans/evidence/loop-engineering-remediation';
    const staging = `${base}/.finalization-staging/${implementationAttemptId}`;
    const declarationHash = sha256('finalization-declaration');
    try {
      writeJson(root, record, {
        schemaVersion: 'requirement-record/v1',
        recordId: requirementSetId,
        requirementSetId,
        currentAttemptId: implementationAttemptId,
        status: 'user_confirmed',
        sourcePath: path.join(root, 'source.md'),
        sourceDocumentHash: sha256('source'),
        implementationConfirmationHash: sha256('confirmation'),
        confirmationHistory: createRecordedConfirmationHistory({
          recordId: requirementSetId,
          sourcePath: path.join(root, 'source.md'),
          sourceDocumentHash: sha256('source'),
          implementationConfirmationHash: sha256('confirmation'),
        }),
        semanticModelHash: sha256('semantic'),
      });
      const roles = [
        {
          artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
          validationProfile: 'safe-write-receipt-manifest',
          draft: `${staging}/safe-write-receipt-manifest.json`,
          target: `${base}/safe-write-receipt-manifest.json`,
          receipt: `${base}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
          predecessor: 'not_applicable',
          value: {
            schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
            finalizationDeclarationHash: declarationHash,
            decision: 'PASS',
          },
        },
        {
          artifactRole: 'EVD-15',
          validationProfile: 'goal-task-evidence',
          draft: `${staging}/G15-final-gates.json`,
          target: `${base}/G15-final-gates.json`,
          receipt: `${base}/finalization-receipts/G15-final-gates.receipt.json`,
          predecessor: `${base}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
          value: {
            schemaVersion: 'requirements-contract-goal-task-evidence/v1',
            finalizationDeclarationHash: declarationHash,
            decision: 'PASS',
          },
        },
        {
          artifactRole: 'ARTIFACT-01',
          validationProfile: 'implementation-evidence-bundle',
          draft: `${staging}/implementation-evidence.json`,
          target: `${base}/implementation-evidence.json`,
          receipt: `${base}/finalization-receipts/implementation-evidence.receipt.json`,
          predecessor: `${base}/finalization-receipts/G15-final-gates.receipt.json`,
          value: completionBundle(implementationAttemptId),
        },
      ] as const;
      for (const [index, role] of roles.entries()) {
        const previousTargetBytes =
          index === 1 ? `${JSON.stringify({ schemaVersion: 'previous-target/v1' })}\n` : null;
        if (previousTargetBytes) {
          writeFileSync(path.join(root, role.target), previousTargetBytes, 'utf8');
        }
        writeJson(root, role.draft, role.value);
        const receipt = await requirementsContractFinalizationSafeWriteCommand({
          cwd: root,
          requirementRecord: record,
          implementationAttemptId,
          draft: role.draft,
          target: role.target,
          receipt: role.receipt,
          blockedReceiptRoot: `${base}/finalization-receipts/blocked`,
          artifactRole: role.artifactRole,
          validationProfile: role.validationProfile,
          minBytes: 2,
          finalizationDeclarationHash: declarationHash,
          expectedPredecessorReceipt: role.predecessor,
          json: false,
        });
        expect(receipt.result).toBe('PASS');
        expect(existsSync(path.join(root, role.target))).toBe(true);
        expect(existsSync(path.join(root, role.draft))).toBe(false);
        expect(existsSync(path.join(root, staging))).toBe(index < roles.length - 1);
        if (previousTargetBytes) {
          expect(receipt.target).toMatchObject({
            targetExistedBefore: true,
            previousHash: sha256(previousTargetBytes),
            backupApplicability: 'required',
            backupHash: sha256(previousTargetBytes),
            nonexistenceProofHash: null,
          });
          expect(receipt.target.backupPath).toEqual(expect.any(String));
          expect(readFileSync(path.join(root, receipt.target.backupPath), 'utf8')).toBe(
            previousTargetBytes
          );
        } else {
          expect(receipt.target).toMatchObject({
            targetExistedBefore: false,
            previousHash: null,
            backupApplicability: 'not_applicable',
            backupPath: null,
            backupHash: null,
            nonexistenceProofHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          });
        }
      }
      const finalReceipt = JSON.parse(readFileSync(path.join(root, roles[2].receipt), 'utf8'));
      expect(finalReceipt.predecessor.receipt.path).toBe(roles[2].predecessor);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('archives a failed role and retries it without rewriting its predecessor PASS receipt', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-retry-'));
    const requirementSetId = `req-${randomUUID()}`;
    const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
    const record = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
    const base = 'docs/plans/evidence/loop-engineering-remediation';
    const staging = `${base}/.finalization-staging/${implementationAttemptId}`;
    const declarationHash = sha256('retry-finalization-declaration');
    const first = {
      artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
      validationProfile: 'safe-write-receipt-manifest',
      draft: `${staging}/safe-write-receipt-manifest.json`,
      target: `${base}/safe-write-receipt-manifest.json`,
      receipt: `${base}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
      predecessor: 'not_applicable',
    };
    const second = {
      artifactRole: 'EVD-15',
      validationProfile: 'goal-task-evidence',
      draft: `${staging}/G15-final-gates.json`,
      target: `${base}/G15-final-gates.json`,
      receipt: `${base}/finalization-receipts/G15-final-gates.receipt.json`,
      predecessor: first.receipt,
    };
    const commandOptions = (role: typeof first | typeof second) => ({
      cwd: root,
      requirementRecord: record,
      implementationAttemptId,
      draft: role.draft,
      target: role.target,
      receipt: role.receipt,
      blockedReceiptRoot: `${base}/finalization-receipts/blocked`,
      artifactRole: role.artifactRole,
      validationProfile: role.validationProfile,
      minBytes: 2,
      finalizationDeclarationHash: declarationHash,
      expectedPredecessorReceipt: role.predecessor,
      json: false,
    });
    try {
      writeJson(root, record, {
        schemaVersion: 'requirement-record/v1',
        recordId: requirementSetId,
        requirementSetId,
        currentAttemptId: implementationAttemptId,
        status: 'user_confirmed',
        sourcePath: path.join(root, 'source.md'),
        sourceDocumentHash: sha256('source'),
        implementationConfirmationHash: sha256('confirmation'),
        confirmationHistory: createRecordedConfirmationHistory({
          recordId: requirementSetId,
          sourcePath: path.join(root, 'source.md'),
          sourceDocumentHash: sha256('source'),
          implementationConfirmationHash: sha256('confirmation'),
        }),
        semanticModelHash: sha256('semantic'),
      });
      writeJson(root, first.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: declarationHash,
        decision: 'PASS',
      });
      await requirementsContractFinalizationSafeWriteCommand(commandOptions(first));
      const predecessorPath = path.join(root, first.receipt);
      const predecessorBytes = readFileSync(predecessorPath, 'utf8');

      writeJson(root, second.draft, { schemaVersion: 'invalid-goal-task-evidence/v1' });
      let blockedPath = '';
      await expect(
        requirementsContractFinalizationSafeWriteCommand(commandOptions(second))
      ).rejects.toSatisfy((error: Error) => {
        const match = error.message.match(
          /^finalization_safe_write_blocked:([^:]+):finalization_safe_write_draft_schema_invalid$/u
        );
        blockedPath = match?.[1] ?? '';
        return Boolean(match);
      });

      const blockedReceipt = JSON.parse(readFileSync(path.join(root, blockedPath), 'utf8'));
      const archivedPath = blockedReceipt.draft.archivedPath;
      expect(blockedReceipt).toMatchObject({
        result: 'BLOCK',
        artifactRole: second.artifactRole,
        retryRole: second.artifactRole,
        predecessor: { expectedReceiptPath: first.receipt },
      });
      expect(existsSync(path.join(root, archivedPath))).toBe(true);
      expect(blockedReceipt.draft.archivedHash).toBe(
        sha256(readFileSync(path.join(root, archivedPath), 'utf8'))
      );
      expect(existsSync(path.join(root, second.draft))).toBe(false);
      expect(existsSync(path.join(root, second.receipt))).toBe(false);
      expect(readFileSync(predecessorPath, 'utf8')).toBe(predecessorBytes);

      writeJson(root, second.draft, {
        schemaVersion: 'requirements-contract-goal-task-evidence/v1',
        finalizationDeclarationHash: declarationHash,
        decision: 'PASS',
      });
      const retryReceipt = await requirementsContractFinalizationSafeWriteCommand(
        commandOptions(second)
      );

      expect(retryReceipt.result).toBe('PASS');
      expect(readFileSync(predecessorPath, 'utf8')).toBe(predecessorBytes);
      expect(existsSync(path.join(root, blockedPath))).toBe(true);
      expect(existsSync(path.join(root, archivedPath))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
