import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  prepareRequirementsContractRemediationWorkspace,
  validateRequirementsContractRemediationWorkspaceReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-workspace';
import { compileRequirementsContractDirtyBaselineManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-baseline';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function baseline() {
  return compileRequirementsContractDirtyBaselineManifest({
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    repairTransactionManifest: {
      schemaVersion: 'requirements-contract-repair-transaction-manifest/v1',
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('attempt-1'),
      repairUnits: [
        {
          unitId: 'repair-unit-a',
          authorizedPaths: ['packages/bmad-speckit/src/a.ts'],
        },
      ],
      graph: { graphHash: hash('graph') },
      manifestHash: hash('repair-manifest'),
      decision: 'pass',
    },
    headTreeHash: hash('head-tree'),
    indexHash: hash('index'),
    governedWorkingBytes: [
      {
        path: 'packages/bmad-speckit/src/a.ts',
        status: 'modified',
        mode: '100644',
        headHash: hash('a-head'),
        workingHash: hash('a-working'),
      },
    ],
    renameRecords: [],
    deletionRecords: [],
    symlinkRecords: [],
    submoduleRecords: [],
    unrelatedDirtyFiles: [
      {
        path: 'docs/user-notes.md',
        workingHash: hash('user-notes'),
      },
    ],
    gitOperationPlan: {
      stage: false,
      commit: false,
      reset: false,
      overwriteUserChanges: false,
    },
  });
}

function validInput(overrides = {}) {
  const dirtyBaseline = baseline();
  return {
    baselineManifest: dirtyBaseline,
    workspaceRoot: '.artifacts/remediation-shadow/workspace-001',
    reproducedBytes: dirtyBaseline.governedWorkingBytes.map((entry) => ({
      path: entry.path,
      reproducedHash: entry.workingHash,
      mode: entry.mode,
    })),
    untouchedUnrelatedPathHashes:
      dirtyBaseline.userChangePreservationProof.untouchedUnrelatedPathHashes,
    hostOperations: {
      staged: false,
      committed: false,
      reset: false,
      overwrittenUserChanges: false,
    },
    ...overrides,
  };
}

describe('requirements contract remediation workspace', () => {
  it('prepares one isolated shadow workspace with governed-byte parity', () => {
    const receipt = prepareRequirementsContractRemediationWorkspace(validInput());
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-remediation-workspace-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(receipt.isolated).toBe(true);
    expect(receipt.governedByteParity.decision).toBe('pass');
    expect(receipt.userChangePreservationProof.decision).toBe('pass');
    expect(receipt.hostOperationSafety).toEqual({
      staged: false,
      committed: false,
      reset: false,
      overwrittenUserChanges: false,
    });
    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractRemediationWorkspaceReceipt(receipt, {
        campaignId: receipt.campaignId,
        campaignLineageKey: receipt.campaignLineageKey,
        baselineManifestHash: receipt.baselineManifestHash,
        workspaceReceiptHash: receipt.workspaceReceiptHash,
      })
    ).toBe(receipt);
  });

  it.each([
    ['workspace traversal', { workspaceRoot: '../escape' }, 'remediation_workspace_path_escape'],
    [
      'baseline mismatch',
      {
        reproducedBytes: [
          { path: 'packages/bmad-speckit/src/a.ts', reproducedHash: hash('wrong'), mode: '100644' },
        ],
      },
      'remediation_workspace_baseline_mismatch',
    ],
    [
      'unknown reproduced file',
      {
        reproducedBytes: [
          ...validInput().reproducedBytes,
          {
            path: 'packages/bmad-speckit/src/unknown.ts',
            reproducedHash: hash('unknown'),
            mode: '100644',
          },
        ],
      },
      'remediation_workspace_unknown_path',
    ],
    [
      'unrelated user change touched',
      { untouchedUnrelatedPathHashes: [hash('other')] },
      'remediation_workspace_user_change_modified',
    ],
    [
      'host staging requested',
      {
        hostOperations: {
          staged: true,
          committed: false,
          reset: false,
          overwrittenUserChanges: false,
        },
      },
      'remediation_workspace_host_operation_forbidden',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      prepareRequirementsContractRemediationWorkspace({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects workspace receipt tampering', () => {
    const receipt = prepareRequirementsContractRemediationWorkspace(validInput());

    expect(() =>
      validateRequirementsContractRemediationWorkspaceReceipt(
        { ...receipt, isolated: false },
        {
          campaignId: receipt.campaignId,
          campaignLineageKey: receipt.campaignLineageKey,
          baselineManifestHash: receipt.baselineManifestHash,
          workspaceReceiptHash: receipt.workspaceReceiptHash,
        }
      )
    ).toThrow('remediation_workspace_receipt_hash_mismatch');
  });
});
