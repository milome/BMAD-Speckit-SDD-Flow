import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  compileRequirementsJudgeRemediationReceipt,
  validateRequirementsJudgeRemediationReceipt,
  writeRequirementsJudgeRemediationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-remediation-store';

const h = (label: string) => sha256Stable({ label });

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'judge-remediation-'));
  try {
    return run(dir);
  } finally {
    if (dir.startsWith(tmpdir())) rmSync(dir, { recursive: true, force: true });
  }
}

function completeInput(overrides: Record<string, unknown> = {}) {
  return {
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    batchId: 'requirements-remediation-batch-001',
    attemptKeyHash: h('attempt'),
    scopeManifestHash: h('scope'),
    requirementsAuditAggregateHash: h('requirements-audit-aggregate'),
    auditUnitSetHash: h('audit-unit-set'),
    previousLedgerEntryHash: h('previous-ledger'),
    currentAuthority: {
      attemptKeyHash: h('attempt'),
      scopeManifestHash: h('scope'),
      requirementsAuditAggregateHash: h('requirements-audit-aggregate'),
      auditUnitSetHash: h('audit-unit-set'),
      previousLedgerEntryHash: h('previous-ledger'),
    },
    validatedGaps: [
      {
        gapId: 'gap-auth-001',
        auditUnitRef: 'unit-auth',
        requirementRef: 'REQ-AUTH',
        sourceRef: 'SRC-AUTH',
        sourceHash: h('source-auth'),
        evidenceRef: 'EVD-AUTH',
      },
      {
        gapId: 'gap-retry-002',
        auditUnitRef: 'unit-retry',
        requirementRef: 'REQ-RETRY',
        sourceRef: 'SRC-RETRY',
        sourceHash: h('source-retry'),
        evidenceRef: 'EVD-RETRY',
      },
    ],
    dispositions: [
      {
        gapId: 'gap-auth-001',
        disposition: 'source_repair_required',
        dispositionReasonHash: h('auth-disposition'),
      },
      {
        gapId: 'gap-retry-002',
        disposition: 'source_repair_required',
        dispositionReasonHash: h('retry-disposition'),
      },
    ],
    sourceRepairActions: [
      {
        gapId: 'gap-auth-001',
        actionKind: 'edit_source',
        targetPath: 'docs/requirements/auth.md',
        sourceRef: 'SRC-AUTH',
        repairActionHash: h('auth-repair'),
      },
      {
        gapId: 'gap-retry-002',
        actionKind: 'add_evidence',
        targetPath: 'tests/acceptance/retry.test.ts',
        sourceRef: 'SRC-RETRY',
        repairActionHash: h('retry-repair'),
      },
    ],
    priorFindingRefs: ['prior-auth', 'prior-retry'],
    currentDispositionRefs: ['prior-retry', 'prior-auth'],
    ...overrides,
  };
}

describe('requirements judge remediation store', () => {
  it('persists one complete remediation batch atomically with one disposition and action per origin', () => {
    withTempDir((dir) => {
      const receiptPath = path.join(dir, 'remediation.receipt.json');
      const receipt = writeRequirementsJudgeRemediationReceipt({
        receiptPath,
        input: completeInput(),
      });

      expect(existsSync(receiptPath)).toBe(true);
      expect(receipt).toMatchObject({
        schemaVersion: 'requirements-contract-judge-remediation-receipt/v1',
        actorClass: 'requirements_critical_auditor_judge',
        judgeRole: 'requirements_critical_auditor',
        ledgerNamespace: 'requirements',
        gapCount: 2,
        perGapModelInvocationCount: 0,
        readonlyAuditorInvocationCount: 0,
        writer: 'package_owned_requirements_remediation_store',
        writeSemantics: 'create_only',
        decision: 'recorded',
      });
      expect(receipt.remediationEntries.map((entry) => entry.origin.gapId).sort()).toEqual([
        'gap-auth-001',
        'gap-retry-002',
      ]);
      expect(receipt.currentDispositionRefs).toEqual(['prior-auth', 'prior-retry']);
      expect(validateRequirementsJudgeRemediationReceipt(receipt)).toEqual(receipt);
      expect(() =>
        writeRequirementsJudgeRemediationReceipt({ receiptPath, input: completeInput() })
      ).toThrow('requirements_judge_remediation_receipt_exists');
    });
  });

  it('does not leave a partial receipt when required origin disposition is missing', () => {
    withTempDir((dir) => {
      const receiptPath = path.join(dir, 'missing-disposition.receipt.json');

      expect(() =>
        writeRequirementsJudgeRemediationReceipt({
          receiptPath,
          input: completeInput({
            dispositions: [
              {
                gapId: 'gap-auth-001',
                disposition: 'source_repair_required',
                dispositionReasonHash: h('auth-disposition'),
              },
            ],
          }),
        })
      ).toThrow('requirements_judge_gap_disposition_incomplete');
      expect(existsSync(receiptPath)).toBe(false);
    });
  });

  it('rejects cross-role, stale replay, caller authority injection, and per-gap model seams', () => {
    expect(() =>
      compileRequirementsJudgeRemediationReceipt(
        completeInput({
          actorClass: 'final_acceptance_judge',
          judgeRole: 'final_acceptance_judge',
        })
      )
    ).toThrow('requirements_judge_remediation_cross_role');

    expect(() =>
      compileRequirementsJudgeRemediationReceipt(
        completeInput({
          currentAuthority: {
            attemptKeyHash: h('attempt'),
            scopeManifestHash: h('different-scope'),
            requirementsAuditAggregateHash: h('requirements-audit-aggregate'),
            auditUnitSetHash: h('audit-unit-set'),
            previousLedgerEntryHash: h('previous-ledger'),
          },
        })
      )
    ).toThrow('requirements_judge_remediation_replay_or_stale_scope');

    expect(() =>
      compileRequirementsJudgeRemediationReceipt(completeInput({ expectedDispositionRefs: [] }))
    ).toThrow('requirements_judge_remediation_caller_authority_injection');

    expect(() =>
      compileRequirementsJudgeRemediationReceipt(
        completeInput({
          perGapModelInvocations: [{ gapId: 'gap-auth-001', model: 'readonly-auditor' }],
        })
      )
    ).toThrow('requirements_judge_remediation_model_seam_rejected');
  });

  it('requires current disposition for every prior finding', () => {
    expect(() =>
      compileRequirementsJudgeRemediationReceipt(
        completeInput({
          priorFindingRefs: ['prior-auth', 'prior-retry'],
          currentDispositionRefs: ['prior-auth'],
        })
      )
    ).toThrow('requirements_judge_prior_finding_disposition_incomplete');
  });
});
