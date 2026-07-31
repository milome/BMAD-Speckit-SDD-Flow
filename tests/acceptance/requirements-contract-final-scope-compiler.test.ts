import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractFinalScopeManifest,
  validateRequirementsContractFinalScopeManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-scope-compiler';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function closure(partitionId: string) {
  return {
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    partitionId,
    childContractHash: hash(`${partitionId}:child`),
    receiptHash: hash(`${partitionId}:closure`),
    governedFileManifestHash: hash(`${partitionId}:files`),
    subcontractEvidenceHash: hash(`${partitionId}:evidence`),
    productionReachabilityReceiptHash: hash(`${partitionId}:reachability`),
    dependencyClosureHash: hash(`${partitionId}:deps`),
    decision: 'pass',
  };
}

function validInput() {
  const expectedPartitionIds = ['partition-a', 'partition-b', 'partition-c'];
  return {
    campaignId: 'goal-campaign-001',
    attemptId: 'attempt-001',
    partitionManifestHash: hash('manifest'),
    partitionSetHash: hash('partition-set'),
    sourceAuthorityBundleHash: hash('source-authority'),
    sourceCompositionPolicyHash: hash('source-policy'),
    expectedPartitionIds,
    childClosureReceipts: [closure('partition-b'), closure('partition-a'), closure('partition-c')],
    governedPathRefs: ['src/a.ts', 'src/b.ts'],
    taskReportProvenanceRefs: ['task-report/p01', 'task-report/p02'],
    priorFindingRefs: ['finding/legacy-1'],
    deliverySurfaceRefs: ['surface/codex', 'surface/cursor'],
    policyRefs: ['policy/fail-closed', 'policy/no-budget-scaling'],
    currentImplementationLineage: {
      current: true,
      decision: 'pass',
      partitionManifestHash: hash('manifest'),
      partitionSetHash: hash('partition-set'),
      implementationLineageHash: hash('lineage'),
    },
  };
}

describe('requirements contract final scope compiler', () => {
  it('compiles one canonical campaign scope from current closed child lineage', () => {
    const manifest = compileRequirementsContractFinalScopeManifest(validInput());
    const reversed = compileRequirementsContractFinalScopeManifest({
      ...validInput(),
      childClosureReceipts: [...validInput().childClosureReceipts].reverse(),
    });
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-parent-goal-campaign-scope-manifest.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(reversed).toEqual(manifest);
    expect(manifest.childClosureCount).toBe(3);
    expect(manifest.childClosures.map((item) => item.partitionId)).toEqual([
      'partition-a',
      'partition-b',
      'partition-c',
    ]);
    expect(validate(manifest), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractFinalScopeManifest(manifest, {
        campaignId: manifest.campaignId,
        attemptId: manifest.attemptId,
        partitionManifestHash: manifest.partitionManifestHash,
        partitionSetHash: manifest.partitionSetHash,
        implementationLineageHash: manifest.implementationLineageHash,
        campaignLineageKey: manifest.campaignLineageKey,
      })
    ).toBe(manifest);
  });

  it.each([
    [
      'missing child closure',
      { childClosureReceipts: [closure('partition-a')] },
      'campaign_scope_child_closure_missing',
    ],
    [
      'duplicate expected id',
      { expectedPartitionIds: ['partition-a', 'partition-a'] },
      'campaign_scope_expected_partitions_invalid',
    ],
    [
      'extra child closure',
      {
        childClosureReceipts: [
          closure('partition-a'),
          closure('partition-b'),
          closure('partition-x'),
        ],
      },
      'campaign_scope_child_closure_mismatch',
    ],
    [
      'stale lineage',
      { currentImplementationLineage: { current: false, decision: 'pass' } },
      'campaign_scope_lineage_stale',
    ],
    [
      'not closed lineage',
      { currentImplementationLineage: { current: true, decision: 'open' } },
      'campaign_scope_lineage_not_closed',
    ],
    ['missing governed bytes', { governedPathRefs: [] }, 'campaign_scope_governed_bytes_missing'],
    [
      'missing provenance',
      { taskReportProvenanceRefs: [] },
      'campaign_scope_task_report_provenance_missing',
    ],
    [
      'missing delivery surface',
      { deliverySurfaceRefs: [] },
      'campaign_scope_delivery_surface_missing',
    ],
    ['missing policy', { policyRefs: [] }, 'campaign_scope_policy_missing'],
    ['fallback', { fallbackScope: true }, 'campaign_scope_forbidden_authority_field'],
    [
      'budget scaling',
      { partitionCountBudgetScaling: true },
      'campaign_scope_forbidden_authority_field',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractFinalScopeManifest({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects scope manifest tampering', () => {
    const manifest = compileRequirementsContractFinalScopeManifest(validInput());

    expect(() =>
      validateRequirementsContractFinalScopeManifest(
        { ...manifest, childClosureCount: 99 },
        {
          campaignId: manifest.campaignId,
          attemptId: manifest.attemptId,
          partitionManifestHash: manifest.partitionManifestHash,
          partitionSetHash: manifest.partitionSetHash,
          implementationLineageHash: manifest.implementationLineageHash,
          campaignLineageKey: manifest.campaignLineageKey,
        }
      )
    ).toThrow('campaign_scope_manifest_hash_mismatch');
  });
});
