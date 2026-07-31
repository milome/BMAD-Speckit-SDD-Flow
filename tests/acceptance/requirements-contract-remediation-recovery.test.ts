import { describe, expect, it } from 'vitest';
import { runRequirementsContractRepairUnitTransactions } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/governance-remediation-runner';
import {
  recoverRequirementsContractRemediationJournal,
  validateRequirementsContractRemediationRecoveryReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-recovery';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function unit() {
  return {
    schemaVersion: 'requirements-contract-repair-unit/v1',
    unitId: 'unit-a',
    originIds: [hash('origin-a')],
    dependencyUnitIds: [],
    conflictUnitIds: [],
    rootCauseRef: 'root/unit-a',
    semanticRegionRef: 'region/unit-a',
    rollbackBoundaryRef: 'rollback/unit-a',
    postconditionRef: 'post/unit-a',
    atomicGroupId: hash('unit-a'),
    authorizedPaths: ['packages/bmad-speckit/src/unit-a.ts'],
    preconditionHashes: [hash('pre-a')],
    closurePredicates: ['predicate-a'],
    verificationRefs: ['verify-a'],
    modelSuggestionRefs: [],
    selfHash: hash('unit-a:self'),
  };
}

function transactionResult() {
  return runRequirementsContractRepairUnitTransactions({
    transactionManifest: {
      schemaVersion: 'requirements-contract-repair-transaction-manifest/v1',
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('attempt-1'),
      repairUnits: [unit()],
      graph: { graphHash: hash('graph') },
      manifestHash: hash('manifest'),
      decision: 'pass',
    },
    workspaceReceipt: {
      schemaVersion: 'requirements-contract-remediation-workspace-receipt/v1',
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      baselineManifestHash: hash('baseline'),
      workspaceRoot: '.artifacts/remediation-shadow/workspace-001',
      isolated: true,
      governedByteParity: { reproducedPathHashes: [hash('reproduced')], decision: 'pass' },
      userChangePreservationProof: { untouchedUnrelatedPathHashes: [], decision: 'pass' },
      hostOperationSafety: {
        staged: false,
        committed: false,
        reset: false,
        overwrittenUserChanges: false,
      },
      decision: 'pass',
      workspaceReceiptHash: hash('workspace'),
    },
    executionPlan: [
      {
        unitId: 'unit-a',
        writes: [{ path: 'packages/bmad-speckit/src/unit-a.ts', contentHash: hash('after-a') }],
        guards: { path: 'pass', parse: 'pass', directTest: 'fail', closurePredicate: 'pass' },
      },
    ],
    liveWorktreeOperations: [],
  });
}

describe('requirements contract remediation recovery', () => {
  it('recovers from trusted hash chain without rerunning unknown writes', () => {
    const result = transactionResult();
    const recovery = recoverRequirementsContractRemediationJournal({
      journalEntries: result.journalEntries,
      trustedHeadHash: result.journalEntries.at(-1)?.entryHash,
      knownWriteHashes: result.journalEntries.map((entry) => entry.payloadHash),
      rerunUnknownWrites: false,
    });

    expect(recovery.decision).toBe('pass');
    expect(recovery.replayedUnknownWriteCount).toBe(0);
    expect(recovery.recoveredJournalHeadHash).toBe(result.journalEntries.at(-1)?.entryHash);
    expect(
      validateRequirementsContractRemediationRecoveryReceipt(recovery, {
        recoveryReceiptHash: recovery.recoveryReceiptHash,
        recoveredJournalHeadHash: recovery.recoveredJournalHeadHash,
      })
    ).toBe(recovery);
  });

  it.each([
    [
      'trusted hash mismatch',
      { trustedHeadHash: hash('wrong') },
      'remediation_recovery_trusted_hash_mismatch',
    ],
    [
      'unknown write rerun',
      { knownWriteHashes: [], rerunUnknownWrites: true },
      'remediation_recovery_unknown_write_rerun_forbidden',
    ],
    ['broken hash chain', { tamper: true }, 'remediation_recovery_hash_chain_invalid'],
  ])('fails closed for %s', (_name, patch, code) => {
    const result = transactionResult();
    const journalEntries = patch.tamper
      ? result.journalEntries.map((entry, index) =>
          index === 1 ? { ...entry, previousEntryHash: hash('tampered-prev') } : entry
        )
      : result.journalEntries;

    expect(() =>
      recoverRequirementsContractRemediationJournal({
        journalEntries,
        trustedHeadHash: patch.trustedHeadHash ?? result.journalEntries.at(-1)?.entryHash,
        knownWriteHashes:
          patch.knownWriteHashes ?? result.journalEntries.map((entry) => entry.payloadHash),
        rerunUnknownWrites: patch.rerunUnknownWrites ?? false,
      })
    ).toThrow(code);
  });

  it('rejects recovery receipt tampering', () => {
    const result = transactionResult();
    const recovery = recoverRequirementsContractRemediationJournal({
      journalEntries: result.journalEntries,
      trustedHeadHash: result.journalEntries.at(-1)?.entryHash,
      knownWriteHashes: result.journalEntries.map((entry) => entry.payloadHash),
      rerunUnknownWrites: false,
    });

    expect(() =>
      validateRequirementsContractRemediationRecoveryReceipt(
        { ...recovery, replayedUnknownWriteCount: 99 },
        {
          recoveryReceiptHash: recovery.recoveryReceiptHash,
          recoveredJournalHeadHash: recovery.recoveredJournalHeadHash,
        }
      )
    ).toThrow('remediation_recovery_receipt_hash_mismatch');
  });
});
