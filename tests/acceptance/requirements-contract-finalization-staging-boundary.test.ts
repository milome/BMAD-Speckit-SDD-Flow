import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractFinalizationSafeWriteCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-finalization-safe-writer';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

function write(root: string, relativePath: string, text: string): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  const text = `${JSON.stringify(value)}\n`;
  write(root, relativePath, text);
  return text;
}

function createFirstRoleFixture(root: string) {
  const requirementSetId = `req-${randomUUID()}`;
  const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
  const requirementRecord = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  const staging = `${BASE}/.finalization-staging/${implementationAttemptId}`;
  const draft = `${staging}/safe-write-receipt-manifest.json`;
  const target = `${BASE}/safe-write-receipt-manifest.json`;
  const receipt = `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`;
  const declarationHash = sha256('staging-boundary-declaration');
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
  const options = {
    cwd: root,
    requirementRecord,
    implementationAttemptId,
    draft,
    target,
    receipt,
    blockedReceiptRoot: `${BASE}/finalization-receipts/blocked`,
    artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
    validationProfile: 'safe-write-receipt-manifest',
    minBytes: 2,
    finalizationDeclarationHash: declarationHash,
    expectedPredecessorReceipt: 'not_applicable',
    json: false,
  };
  return { declarationHash, draft, implementationAttemptId, options, receipt, staging, target };
}

async function expectBlocked(promise: Promise<unknown>, failureCode: string): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(
      new RegExp(`^finalization_safe_write_blocked:([^:]+):${failureCode}$`, 'u')
    );
    expect(match, message).not.toBeNull();
    return match?.[1] ?? '';
  }
  throw new Error('expected finalization safe writer to block');
}

describe('requirements contract finalization staging boundary', () => {
  it('promotes the canonical draft byte-for-byte and preserves the staging root for the next role', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-staging-pass-'));
    try {
      const fixture = createFirstRoleFixture(root);
      const previousTarget = '{"schemaVersion":"previous-safe-write-manifest/v1"}\n';
      const draftText = writeJson(root, fixture.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
      });
      write(root, fixture.target, previousTarget);

      const receipt = await requirementsContractFinalizationSafeWriteCommand(fixture.options);

      expect(receipt).toMatchObject({
        result: 'PASS',
        target: {
          targetExistedBefore: true,
          previousHash: sha256(previousTarget),
          promotedHash: sha256(draftText),
          readbackHash: sha256(draftText),
        },
        draft: {
          path: fixture.draft,
          hash: sha256(draftText),
          bytes: Buffer.byteLength(draftText),
        },
      });
      expect(readFileSync(path.join(root, fixture.target), 'utf8')).toBe(draftText);
      expect(JSON.parse(readFileSync(path.join(root, fixture.receipt), 'utf8'))).toEqual(receipt);
      expect(existsSync(path.join(root, fixture.draft))).toBe(false);
      expect(readdirSync(path.join(root, fixture.staging))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a path alias before promotion and leaves the target, draft, and success path unchanged', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-staging-alias-'));
    try {
      const fixture = createFirstRoleFixture(root);
      const draftText = writeJson(root, fixture.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
      });
      const previousTarget = '{"schemaVersion":"unchanged/v1"}\n';
      write(root, fixture.target, previousTarget);
      const aliasedDraft =
        `${fixture.staging}/../${fixture.implementationAttemptId}` +
        '/safe-write-receipt-manifest.json';

      await expect(
        requirementsContractFinalizationSafeWriteCommand({
          ...fixture.options,
          draft: aliasedDraft,
        })
      ).rejects.toThrow('finalization_safe_write_role_path_mismatch');

      expect(readFileSync(path.join(root, fixture.draft), 'utf8')).toBe(draftText);
      expect(readFileSync(path.join(root, fixture.target), 'utf8')).toBe(previousTarget);
      expect(existsSync(path.join(root, fixture.receipt))).toBe(false);
      expect(existsSync(path.join(root, `${BASE}/finalization-receipts/blocked`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks unexpected active drafts, archives only the selected role, and never promotes the target', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-staging-block-'));
    try {
      const fixture = createFirstRoleFixture(root);
      const draftText = writeJson(root, fixture.draft, {
        schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
        finalizationDeclarationHash: fixture.declarationHash,
        decision: 'PASS',
      });
      const unexpectedDraft = `${fixture.staging}/G15-final-gates.json`;
      const unexpectedText = writeJson(root, unexpectedDraft, {
        schemaVersion: 'requirements-contract-goal-task-evidence/v1',
        decision: 'PASS',
      });

      const blockedPath = await expectBlocked(
        requirementsContractFinalizationSafeWriteCommand(fixture.options),
        'finalization_safe_write_unexpected_active_draft'
      );
      const blocked = JSON.parse(readFileSync(path.join(root, blockedPath), 'utf8'));

      expect(readFileSync(path.join(root, blocked.draft.archivedPath), 'utf8')).toBe(draftText);
      expect(readFileSync(path.join(root, unexpectedDraft), 'utf8')).toBe(unexpectedText);
      expect(blocked.draft.archivedHash).toBe(sha256(draftText));
      expect(existsSync(path.join(root, fixture.target))).toBe(false);
      expect(existsSync(path.join(root, fixture.receipt))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
