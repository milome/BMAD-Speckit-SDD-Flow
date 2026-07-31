import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  runRequirementsContractRepairUnitTransactions,
  validateRequirementsContractRepairUnitReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/governance-remediation-runner';
import { validateRequirementsContractRemediationJournalEntry } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-journal';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function unit(unitId: string, overrides = {}) {
  return {
    schemaVersion: 'requirements-contract-repair-unit/v1',
    unitId,
    originIds: [hash(`${unitId}:origin`)],
    dependencyUnitIds: [],
    conflictUnitIds: [],
    rootCauseRef: `root/${unitId}`,
    semanticRegionRef: `region/${unitId}`,
    rollbackBoundaryRef: `rollback/${unitId}`,
    postconditionRef: `post/${unitId}`,
    atomicGroupId: hash(unitId.includes('atomic') ? 'atomic-group' : unitId),
    authorizedPaths: [`packages/bmad-speckit/src/${unitId}.ts`],
    preconditionHashes: [hash(`${unitId}:pre`)],
    closurePredicates: [`${unitId}:predicate`],
    verificationRefs: [`${unitId}:verification`],
    modelSuggestionRefs: [`${unitId}:suggestion`],
    selfHash: hash(`${unitId}:self`),
    ...overrides,
  };
}

function manifest(units = [unit('unit-a'), unit('unit-b', { dependencyUnitIds: ['unit-a'] })]) {
  return {
    schemaVersion: 'requirements-contract-repair-transaction-manifest/v1',
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('attempt-1'),
    remediationLedgerHash: hash('ledger'),
    originSetHash: hash('origin-set'),
    repairUnits: units,
    graph: {
      unitIds: units.map((repairUnit) => repairUnit.unitId).sort(),
      edges: [],
      atomicGroups: [],
      cycleDetected: false,
      decision: 'pass',
      graphHash: hash('graph'),
    },
    permutationHashes: [hash('permutation-a'), hash('permutation-b')],
    decision: 'pass',
    manifestHash: hash('manifest'),
  };
}

function workspace() {
  return {
    schemaVersion: 'requirements-contract-remediation-workspace-receipt/v1',
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    baselineManifestHash: hash('baseline'),
    workspaceRoot: '.artifacts/remediation-shadow/workspace-001',
    isolated: true,
    governedByteParity: {
      reproducedPathHashes: [hash('reproduced-a')],
      decision: 'pass',
    },
    userChangePreservationProof: {
      untouchedUnrelatedPathHashes: [hash('user-note')],
      decision: 'pass',
    },
    hostOperationSafety: {
      staged: false,
      committed: false,
      reset: false,
      overwrittenUserChanges: false,
    },
    decision: 'pass',
    workspaceReceiptHash: hash('workspace'),
  };
}

function validInput(overrides = {}) {
  return {
    transactionManifest: manifest(),
    workspaceReceipt: workspace(),
    executionPlan: [
      {
        unitId: 'unit-a',
        writes: [
          { path: 'packages/bmad-speckit/src/unit-a.ts', contentHash: hash('unit-a:after') },
        ],
        guards: {
          path: 'pass',
          parse: 'pass',
          directTest: 'pass',
          closurePredicate: 'pass',
        },
      },
      {
        unitId: 'unit-b',
        writes: [
          { path: 'packages/bmad-speckit/src/unit-b.ts', contentHash: hash('unit-b:after') },
        ],
        guards: {
          path: 'pass',
          parse: 'pass',
          directTest: 'pass',
          closurePredicate: 'pass',
        },
      },
    ],
    liveWorktreeOperations: [],
    ...overrides,
  };
}

describe('requirements contract repair unit transactions', () => {
  it('runs successful independent transactions and records a hash-chained journal', () => {
    const result = runRequirementsContractRepairUnitTransactions(validInput());
    const receiptSchema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-repair-unit-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const journalSchema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-remediation-journal-entry.schema.json'
        ),
        'utf8'
      )
    );
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validateReceipt = ajv.compile(receiptSchema);
    const validateJournal = ajv.compile(journalSchema);

    expect(result.receipts.map((receipt) => receipt.decision)).toEqual(['pass', 'pass']);
    expect(result.summary.successfulUnitIds).toEqual(['unit-a', 'unit-b']);
    expect(result.summary.liveWorktreeMutated).toBe(false);
    for (const receipt of result.receipts) {
      expect(validateReceipt(receipt), JSON.stringify(validateReceipt.errors ?? [])).toBe(true);
      expect(
        validateRequirementsContractRepairUnitReceipt(receipt, {
          unitId: receipt.unitId,
          receiptHash: receipt.receiptHash,
        })
      ).toBe(receipt);
    }
    for (const entry of result.journalEntries) {
      expect(validateJournal(entry), JSON.stringify(validateJournal.errors ?? [])).toBe(true);
      expect(
        validateRequirementsContractRemediationJournalEntry(entry, {
          entryHash: entry.entryHash,
          transactionManifestHash: result.transactionManifestHash,
        })
      ).toBe(entry);
    }
  });

  it('rolls back a failed unit while preserving successful independent predecessors', () => {
    const result = runRequirementsContractRepairUnitTransactions({
      ...validInput(),
      executionPlan: [
        validInput().executionPlan[0],
        {
          ...validInput().executionPlan[1],
          guards: {
            path: 'pass',
            parse: 'pass',
            directTest: 'fail',
            closurePredicate: 'pass',
          },
        },
      ],
    });

    expect(result.summary.successfulUnitIds).toEqual(['unit-a']);
    expect(result.summary.rolledBackUnitIds).toEqual(['unit-b']);
    expect(result.receipts[1].decision).toBe('rollback');
  });

  it('rolls back the complete atomic group when one member fails', () => {
    const atomicA = unit('atomic-a');
    const atomicB = unit('atomic-b', {
      authorizedPaths: ['packages/bmad-speckit/src/atomic-b.ts'],
    });
    const result = runRequirementsContractRepairUnitTransactions({
      ...validInput(),
      transactionManifest: manifest([atomicA, atomicB]),
      executionPlan: [
        {
          unitId: 'atomic-a',
          writes: [{ path: 'packages/bmad-speckit/src/atomic-a.ts', contentHash: hash('a:after') }],
          guards: { path: 'pass', parse: 'pass', directTest: 'pass', closurePredicate: 'pass' },
        },
        {
          unitId: 'atomic-b',
          writes: [{ path: 'packages/bmad-speckit/src/atomic-b.ts', contentHash: hash('b:after') }],
          guards: { path: 'pass', parse: 'fail', directTest: 'pass', closurePredicate: 'pass' },
        },
      ],
    });

    expect(result.summary.rolledBackUnitIds).toEqual(['atomic-a', 'atomic-b']);
    expect(result.receipts.map((receipt) => receipt.decision)).toEqual(['rollback', 'rollback']);
  });

  it.each([
    [
      'unauthorized path',
      {
        executionPlan: [
          {
            unitId: 'unit-a',
            writes: [{ path: 'packages/bmad-speckit/src/other.ts', contentHash: hash('other') }],
            guards: { path: 'pass', parse: 'pass', directTest: 'pass', closurePredicate: 'pass' },
          },
        ],
      },
      'remediation_runner_unauthorized_path',
    ],
    [
      'unknown write',
      {
        executionPlan: [
          {
            unitId: 'missing-unit',
            writes: [
              { path: 'packages/bmad-speckit/src/missing.ts', contentHash: hash('missing') },
            ],
            guards: { path: 'pass', parse: 'pass', directTest: 'pass', closurePredicate: 'pass' },
          },
        ],
      },
      'remediation_runner_unknown_write',
    ],
    [
      'live destructive command',
      { liveWorktreeOperations: ['git reset --hard'] },
      'remediation_runner_live_worktree_command_forbidden',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      runRequirementsContractRepairUnitTransactions({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects receipt tampering', () => {
    const result = runRequirementsContractRepairUnitTransactions(validInput());

    expect(() =>
      validateRequirementsContractRepairUnitReceipt(
        { ...result.receipts[0], decision: 'rollback' },
        {
          unitId: result.receipts[0].unitId,
          receiptHash: result.receipts[0].receiptHash,
        }
      )
    ).toThrow('repair_unit_receipt_hash_mismatch');
  });
});
