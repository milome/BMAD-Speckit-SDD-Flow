import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractRepairTransactionManifest,
  validateRequirementsContractRepairTransactionManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-repair-transaction-compiler';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function originId(findingId: string) {
  return hash(`origin:${findingId}`);
}

function ledger() {
  const sharedA = originId('R-001');
  const sharedB = originId('F-009');
  const isolated = originId('R-002');
  return {
    schemaVersion: 'requirements-contract-campaign-remediation-ledger/v1',
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('attempt-1'),
    blindReviewAggregateHash: hash('blind-aggregate'),
    originCount: 3,
    completeOriginSetHash: hash('origin-set'),
    permutationHashes: [hash('permutation-a'), hash('permutation-b')],
    mergedFindings: [
      {
        mergedFindingId: hash('merged-shared'),
        canonicalObservationHash: hash('shared-symbol'),
        origins: [
          {
            originId: sharedA,
            actorClass: 'bounded_code_reviewer',
            sourceLedgerHash: hash('reviewer-ledger'),
            sourceLineageHash: hash('lineage-a'),
            findingId: 'R-001',
          },
          {
            originId: sharedB,
            actorClass: 'final_acceptance_judge',
            sourceLedgerHash: hash('final-ledger'),
            sourceLineageHash: hash('lineage-b'),
            findingId: 'F-009',
          },
        ],
      },
      {
        mergedFindingId: hash('merged-isolated'),
        canonicalObservationHash: hash('isolated-symbol'),
        origins: [
          {
            originId: isolated,
            actorClass: 'bounded_code_reviewer',
            sourceLedgerHash: hash('reviewer-ledger'),
            sourceLineageHash: hash('lineage-c'),
            findingId: 'R-002',
          },
        ],
      },
    ],
    originPreservationMatrix: [
      {
        originId: sharedA,
        actorClass: 'bounded_code_reviewer',
        sourceLedgerHash: hash('reviewer-ledger'),
        sourceLineageHash: hash('lineage-a'),
        findingId: 'R-001',
        mergedFindingId: hash('merged-shared'),
        disposition: 'accepted',
        dispositionRef: 'disposition/R-001',
      },
      {
        originId: sharedB,
        actorClass: 'final_acceptance_judge',
        sourceLedgerHash: hash('final-ledger'),
        sourceLineageHash: hash('lineage-b'),
        findingId: 'F-009',
        mergedFindingId: hash('merged-shared'),
        disposition: 'accepted',
        dispositionRef: 'disposition/F-009',
      },
      {
        originId: isolated,
        actorClass: 'bounded_code_reviewer',
        sourceLedgerHash: hash('reviewer-ledger'),
        sourceLineageHash: hash('lineage-c'),
        findingId: 'R-002',
        mergedFindingId: hash('merged-isolated'),
        disposition: 'deferred_open_issue',
        dispositionRef: 'disposition/R-002',
      },
    ],
    decision: 'pass',
    ledgerHash: hash('ledger'),
  };
}

function repairUnit(findingIds: string[], overrides = {}) {
  const unitId = `repair-unit-${findingIds.join('-')}`;
  return {
    unitId,
    originIds: findingIds.map(originId),
    dependencyUnitIds: [],
    conflictUnitIds: [],
    rootCauseRef: findingIds.includes('R-001') ? 'root/shared' : 'root/isolated',
    semanticRegionRef: findingIds.includes('R-001') ? 'region/shared-symbol' : 'region/isolated',
    rollbackBoundaryRef: findingIds.includes('R-001') ? 'rollback/shared' : 'rollback/isolated',
    postconditionRef: findingIds.includes('R-001') ? 'post/shared' : 'post/isolated',
    authorizedPaths: findingIds.includes('R-001')
      ? ['packages/bmad-speckit/src/shared-symbol.ts']
      : ['packages/bmad-speckit/src/isolated.ts'],
    preconditionHashes: [hash(`${unitId}:precondition`)],
    closurePredicates: [`${unitId}:predicate`],
    verificationRefs: [`${unitId}:verification`],
    modelSuggestionRefs: [`${unitId}:suggestion`],
    ...overrides,
  };
}

function validInput(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('attempt-1'),
    remediationLedger: ledger(),
    repairUnits: [repairUnit(['R-002']), repairUnit(['R-001', 'F-009'])],
    callerWritePermission: false,
    ...overrides,
  };
}

describe('requirements contract repair transaction compiler', () => {
  it('compiles one canonical acyclic graph and atomic group for shared-symbol findings', () => {
    const manifest = compileRequirementsContractRepairTransactionManifest(validInput());
    const reversed = compileRequirementsContractRepairTransactionManifest({
      ...validInput(),
      repairUnits: [...validInput().repairUnits].reverse(),
    });
    const manifestSchema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-repair-transaction-manifest.schema.json'
        ),
        'utf8'
      )
    );
    const unitSchema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-repair-unit.schema.json'
        ),
        'utf8'
      )
    );
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validateManifest = ajv.compile(manifestSchema);
    const validateUnit = ajv.compile(unitSchema);

    expect(reversed).toEqual(manifest);
    expect(manifest.repairUnits).toHaveLength(2);
    expect(manifest.repairUnits[0].originIds).toEqual(
      [originId('R-001'), originId('F-009')].sort()
    );
    expect(manifest.repairUnits[0].atomicGroupId).toMatch(/^sha256:/u);
    expect(manifest.graph.decision).toBe('pass');
    expect(manifest.graph.cycleDetected).toBe(false);
    expect(validateManifest(manifest), JSON.stringify(validateManifest.errors ?? [])).toBe(true);
    for (const unit of manifest.repairUnits) {
      expect(validateUnit(unit), JSON.stringify(validateUnit.errors ?? [])).toBe(true);
    }
    expect(
      validateRequirementsContractRepairTransactionManifest(manifest, {
        campaignId: manifest.campaignId,
        campaignLineageKey: manifest.campaignLineageKey,
        initialReviewAttemptKey: manifest.initialReviewAttemptKey,
        manifestHash: manifest.manifestHash,
      })
    ).toBe(manifest);
  });

  it.each([
    [
      'uncovered origin',
      { repairUnits: [repairUnit(['R-001', 'F-009'])] },
      'repair_transaction_origin_uncovered',
    ],
    [
      'duplicate origin',
      { repairUnits: [repairUnit(['R-002']), repairUnit(['R-002'])] },
      'repair_transaction_origin_duplicate',
    ],
    [
      'unknown dependency',
      {
        repairUnits: [
          repairUnit(['R-002'], { dependencyUnitIds: ['missing'] }),
          repairUnit(['R-001', 'F-009']),
        ],
      },
      'repair_transaction_dependency_unknown',
    ],
    [
      'unresolved conflict',
      {
        repairUnits: [
          repairUnit(['R-002'], { conflictUnitIds: ['repair-unit-R-001-F-009'] }),
          repairUnit(['R-001', 'F-009']),
        ],
      },
      'repair_transaction_conflict_unresolved',
    ],
    [
      'graph cycle',
      {
        repairUnits: [
          repairUnit(['R-002'], { dependencyUnitIds: ['repair-unit-R-001-F-009'] }),
          repairUnit(['R-001', 'F-009'], { dependencyUnitIds: ['repair-unit-R-002'] }),
        ],
      },
      'repair_transaction_graph_cycle',
    ],
    [
      'ambiguous scope',
      {
        repairUnits: [
          repairUnit(['R-002'], { authorizedPaths: [] }),
          repairUnit(['R-001', 'F-009']),
        ],
      },
      'repair_transaction_scope_ambiguous',
    ],
    [
      'caller write permission',
      { callerWritePermission: true },
      'repair_transaction_write_permission_forbidden',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractRepairTransactionManifest({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects manifest tampering', () => {
    const manifest = compileRequirementsContractRepairTransactionManifest(validInput());

    expect(() =>
      validateRequirementsContractRepairTransactionManifest(
        { ...manifest, graph: { ...manifest.graph, cycleDetected: true } },
        {
          campaignId: manifest.campaignId,
          campaignLineageKey: manifest.campaignLineageKey,
          initialReviewAttemptKey: manifest.initialReviewAttemptKey,
          manifestHash: manifest.manifestHash,
        }
      )
    ).toThrow('repair_transaction_manifest_hash_mismatch');
  });
});
