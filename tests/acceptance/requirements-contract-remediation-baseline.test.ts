import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractDirtyBaselineManifest,
  validateRequirementsContractDirtyBaselineManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-baseline';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function repairManifest() {
  return {
    schemaVersion: 'requirements-contract-repair-transaction-manifest/v1',
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('attempt-1'),
    remediationLedgerHash: hash('ledger'),
    originSetHash: hash('origin-set'),
    repairUnits: [
      {
        unitId: 'repair-unit-a',
        authorizedPaths: ['packages/bmad-speckit/src/a.ts', 'packages/bmad-speckit/src/b.ts'],
      },
    ],
    graph: { graphHash: hash('graph') },
    manifestHash: hash('repair-manifest'),
    decision: 'pass',
  };
}

function validInput(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    repairTransactionManifest: repairManifest(),
    headTreeHash: hash('head-tree'),
    indexHash: hash('index'),
    governedWorkingBytes: [
      {
        path: 'packages/bmad-speckit/src/b.ts',
        status: 'modified',
        mode: '100644',
        headHash: hash('b-head'),
        workingHash: hash('b-working'),
      },
      {
        path: 'packages/bmad-speckit/src/a.ts',
        status: 'untracked',
        mode: '100644',
        workingHash: hash('a-working'),
      },
    ],
    renameRecords: [
      {
        fromPath: 'packages/bmad-speckit/src/old.ts',
        toPath: 'packages/bmad-speckit/src/b.ts',
        fromHash: hash('old-head'),
        toHash: hash('b-working'),
      },
    ],
    deletionRecords: [
      {
        path: 'packages/bmad-speckit/src/deleted.ts',
        headHash: hash('deleted-head'),
      },
    ],
    symlinkRecords: [
      {
        path: 'packages/bmad-speckit/src/link.ts',
        target: 'packages/bmad-speckit/src/a.ts',
        linkHash: hash('link-target'),
      },
    ],
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
    ...overrides,
  };
}

describe('requirements contract remediation baseline', () => {
  it('freezes exact reviewed dirty bytes without capturing unrelated user changes', () => {
    const manifest = compileRequirementsContractDirtyBaselineManifest(validInput());
    const reversed = compileRequirementsContractDirtyBaselineManifest({
      ...validInput(),
      governedWorkingBytes: [...validInput().governedWorkingBytes].reverse(),
    });
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-dirty-baseline-manifest.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(reversed).toEqual(manifest);
    expect(manifest.governedWorkingBytes.map((entry) => entry.path)).toEqual([
      'packages/bmad-speckit/src/a.ts',
      'packages/bmad-speckit/src/b.ts',
    ]);
    expect(manifest.userChangePreservationProof.untouchedUnrelatedPathHashes).toEqual([
      hash('user-notes'),
    ]);
    expect(manifest.gitOperationSafety.stage).toBe(false);
    expect(manifest.gitOperationSafety.commit).toBe(false);
    expect(manifest.gitOperationSafety.reset).toBe(false);
    expect(validate(manifest), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractDirtyBaselineManifest(manifest, {
        campaignId: manifest.campaignId,
        campaignLineageKey: manifest.campaignLineageKey,
        baselineManifestHash: manifest.baselineManifestHash,
      })
    ).toBe(manifest);
  });

  it.each([
    [
      'traversal',
      { governedWorkingBytes: [{ ...validInput().governedWorkingBytes[0], path: '../escape.ts' }] },
      'remediation_baseline_path_escape',
    ],
    [
      'symlink escape',
      {
        symlinkRecords: [
          {
            path: 'packages/bmad-speckit/src/link.ts',
            target: '../outside.ts',
            linkHash: hash('escape'),
          },
        ],
      },
      'remediation_baseline_symlink_escape',
    ],
    [
      'mutable glob',
      {
        governedWorkingBytes: [
          { ...validInput().governedWorkingBytes[0], path: 'packages/**/*.ts' },
        ],
      },
      'remediation_baseline_mutable_glob_forbidden',
    ],
    [
      'unknown governed untracked',
      {
        governedWorkingBytes: [
          {
            path: 'packages/bmad-speckit/src/unknown.ts',
            status: 'untracked',
            mode: '100644',
            workingHash: hash('unknown'),
          },
        ],
      },
      'remediation_baseline_unknown_untracked',
    ],
    [
      'baseline mismatch',
      {
        headTreeHash: hash('other-head-tree'),
        currentAuthority: { headTreeHash: hash('head-tree') },
      },
      'remediation_baseline_mismatch',
    ],
    [
      'unrelated dirty capture',
      {
        governedWorkingBytes: [
          ...validInput().governedWorkingBytes,
          {
            path: 'docs/user-notes.md',
            status: 'modified',
            mode: '100644',
            workingHash: hash('user-notes'),
          },
        ],
      },
      'remediation_baseline_unrelated_dirty_capture',
    ],
    [
      'staging requested',
      {
        gitOperationPlan: { stage: true, commit: false, reset: false, overwriteUserChanges: false },
      },
      'remediation_baseline_git_operation_forbidden',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractDirtyBaselineManifest({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects baseline tampering', () => {
    const manifest = compileRequirementsContractDirtyBaselineManifest(validInput());

    expect(() =>
      validateRequirementsContractDirtyBaselineManifest(
        { ...manifest, indexHash: hash('tampered-index') },
        {
          campaignId: manifest.campaignId,
          campaignLineageKey: manifest.campaignLineageKey,
          baselineManifestHash: manifest.baselineManifestHash,
        }
      )
    ).toThrow('remediation_baseline_manifest_hash_mismatch');
  });
});
