import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  appendRequirementsJudgeFalsePositiveLedgerEntry,
  compileRequirementsJudgeFalsePositiveLedgerEntry,
  readRequirementsJudgeFalsePositiveLedger,
  validateRequirementsJudgeFalsePositiveLedgerEntry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-false-positive-ledger';

const h = (label: string) => sha256Stable({ label });

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'judge-false-positive-ledger-'));
  try {
    return run(dir);
  } finally {
    if (dir.startsWith(tmpdir())) rmSync(dir, { recursive: true, force: true });
  }
}

function entryInput(overrides: Record<string, unknown> = {}) {
  return {
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    entryId: 'fp-gap-auth-001',
    attemptKeyHash: h('attempt'),
    scopeManifestHash: h('scope'),
    findingId: 'gap-auth-001',
    origin: {
      gapId: 'gap-auth-001',
      auditUnitRef: 'unit-auth',
      requirementRef: 'REQ-AUTH',
      sourceRef: 'SRC-AUTH',
      sourceHash: h('source-auth'),
      evidenceRef: 'EVD-AUTH',
    },
    disposition: {
      disposition: 'accepted_false_positive',
      dispositionReasonHash: h('false-positive-rationale'),
      sourceAuthorityHash: h('source-authority'),
      evidenceHash: h('false-positive-evidence'),
    },
    previousLedgerEntryHash: null,
    currentAuthority: {
      attemptKeyHash: h('attempt'),
      scopeManifestHash: h('scope'),
    },
    ...overrides,
  };
}

describe('requirements judge false-positive ledger', () => {
  it('appends requirements-only entries with a verified hash chain', () => {
    withTempDir((dir) => {
      const ledgerPath = path.join(dir, 'false-positive-ledger.jsonl');
      const first = appendRequirementsJudgeFalsePositiveLedgerEntry({
        ledgerPath,
        input: entryInput(),
      });
      const second = appendRequirementsJudgeFalsePositiveLedgerEntry({
        ledgerPath,
        input: entryInput({
          entryId: 'fp-gap-retry-002',
          findingId: 'gap-retry-002',
          previousLedgerEntryHash: first.ledgerEntryHash,
          origin: {
            gapId: 'gap-retry-002',
            auditUnitRef: 'unit-retry',
            requirementRef: 'REQ-RETRY',
            sourceRef: 'SRC-RETRY',
            sourceHash: h('source-retry'),
            evidenceRef: 'EVD-RETRY',
          },
        }),
      });

      expect(first.previousLedgerEntryHash).toBeNull();
      expect(second.previousLedgerEntryHash).toBe(first.ledgerEntryHash);
      expect(validateRequirementsJudgeFalsePositiveLedgerEntry(second)).toEqual(second);
      expect(readRequirementsJudgeFalsePositiveLedger(ledgerPath)).toEqual([first, second]);
      expect(readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/u)).toHaveLength(2);
    });
  });

  it('rejects missing disposition, cross-role copy, stale scope replay, and model seams', () => {
    expect(() =>
      compileRequirementsJudgeFalsePositiveLedgerEntry(
        entryInput({ disposition: { disposition: 'source_repair_required' } })
      )
    ).toThrow('requirements_judge_false_positive_disposition_invalid');

    expect(() =>
      compileRequirementsJudgeFalsePositiveLedgerEntry(
        entryInput({
          actorClass: 'final_acceptance_judge',
          judgeRole: 'final_acceptance_judge',
        })
      )
    ).toThrow('requirements_judge_false_positive_cross_role');

    expect(() =>
      compileRequirementsJudgeFalsePositiveLedgerEntry(
        entryInput({
          currentAuthority: {
            attemptKeyHash: h('attempt'),
            scopeManifestHash: h('different-scope'),
          },
        })
      )
    ).toThrow('requirements_judge_false_positive_replay_or_stale_scope');

    expect(() =>
      compileRequirementsJudgeFalsePositiveLedgerEntry(
        entryInput({ perGapModelInvocationReceiptHash: h('model') })
      )
    ).toThrow('requirements_judge_false_positive_model_seam_rejected');
  });

  it('fails closed when the caller supplies a broken previous hash', () => {
    withTempDir((dir) => {
      const ledgerPath = path.join(dir, 'false-positive-ledger.jsonl');
      appendRequirementsJudgeFalsePositiveLedgerEntry({
        ledgerPath,
        input: entryInput(),
      });

      expect(() =>
        appendRequirementsJudgeFalsePositiveLedgerEntry({
          ledgerPath,
          input: entryInput({
            entryId: 'fp-gap-retry-002',
            findingId: 'gap-retry-002',
            previousLedgerEntryHash: h('wrong-previous'),
          }),
        })
      ).toThrow('requirements_judge_false_positive_hash_chain_broken');
    });
  });
});
