import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_CHECKPOINT_IDS } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-checkpoint-semantic-validation';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  refreshCurrentSourceCheckpointPersistence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  installJudgeRuntimeConfig,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeLintReadyMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function checkpointReceiptValidator() {
  const schemaPath = path.resolve(
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-checkpoint-semantic-validation-receipt.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

function checkpointReceipts(paths: ReturnType<typeof artifacts>): Array<Record<string, unknown>> {
  return paths.checkpointReceiptPaths.map((receiptPath) =>
    readJson<Record<string, unknown>>(receiptPath)
  );
}

describe('requirements contract checkpoint semantic validation', () => {
  it('publishes one current schema-valid semantic receipt for each cp-00 through cp-08 validator', () => {
    const root = createTempRoot('requirements-contract-checkpoint-semantic-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-semantic-validation'
      );
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-semantic-validation.md',
        descriptor
      );
      const attemptId = materialized.authoringOptions.implementationAttemptId;
      const result = runAuthoring(root, materialized.sourcePath, 'REQ-CHECKPOINT-SEMANTIC', {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(
        root,
        'REQ-CHECKPOINT-SEMANTIC',
        'REQ-CHECKPOINT-SEMANTIC-SET'
      );
      const semanticManifest = readJson<Record<string, unknown>>(
        paths.semanticConservationManifest
      );
      const validateReceipt = checkpointReceiptValidator();

      expect(result.blockingIssues).toEqual([]);
      expect(paths.checkpointReceiptPaths).toHaveLength(
        REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.length
      );
      for (const [index, checkpointId] of REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.entries()) {
        const receipt = readJson<Record<string, unknown>>(paths.checkpointReceiptPaths[index]);
        expect(validateReceipt(receipt), validateReceipt.errors ?? []).toBe(true);
        expect(receipt).toMatchObject({
          schemaVersion: 'requirements-contract-checkpoint-semantic-validation-receipt/v1',
          checkpointId,
          recordId: 'REQ-CHECKPOINT-SEMANTIC',
          requirementSetId: 'REQ-CHECKPOINT-SEMANTIC-SET',
          implementationAttemptId: attemptId,
          persistenceStatus: 'committed',
          semanticValidationStatus: 'pass',
          semanticModelHash: semanticManifest.semanticModelHash,
          semanticConservationManifestHash: semanticManifest.manifestHash,
          blockers: [],
          decision: 'pass',
        });
        expect(String(receipt.validatorIdentity)).toContain(checkpointId);
        expect(String(receipt.validatorVersion)).toMatch(/^\d+\.\d+\.\d+$/u);
        expect(String(receipt.validatorHash)).toMatch(/^sha256:[0-9a-f]{64}$/u);
        expect(Array.isArray(receipt.validatedInputs)).toBe(true);
        expect(receipt.validatedInputs).not.toHaveLength(0);
        const { receiptHash, ...payload } = receipt;
        expect(receiptHash).toBe(sha256Stable(payload));
      }
    } finally {
      removeTempRoot(root);
    }
  });

  it('invalidates and replaces receipts from a different implementation attempt', () => {
    const root = createTempRoot('requirements-contract-checkpoint-cross-attempt-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor('checkpoint-cross-attempt');
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-cross-attempt.md',
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-CROSS-ATTEMPT';
      const firstResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const firstReceipts = checkpointReceipts(paths);
      const nextAttemptId = `${descriptor.attempt.implementationAttemptId}-NEXT`;

      const secondResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        implementationAttemptId: nextAttemptId,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const secondReceipts = checkpointReceipts(paths);
      const progress = readJson<Record<string, unknown>>(paths.progress);

      expect(firstResult.blockingIssues).toEqual([]);
      expect(secondResult.blockingIssues).toEqual([]);
      expect(progress.implementationAttemptId).toBe(nextAttemptId);
      for (const [index, receipt] of secondReceipts.entries()) {
        expect(receipt.implementationAttemptId).toBe(nextAttemptId);
        expect(receipt.receiptHash).not.toBe(firstReceipts[index].receiptHash);
      }
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('invalidates and replaces receipts from a different requirement set', () => {
    const root = createTempRoot('requirements-contract-checkpoint-cross-requirement-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-cross-requirement'
      );
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-cross-requirement.md',
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-CROSS-REQUIREMENT';
      const firstRequirementSetId = `${recordId}-SET-A`;
      const secondRequirementSetId = `${recordId}-SET-B`;
      const firstResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        requirementSetId: firstRequirementSetId,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, firstRequirementSetId);
      const firstReceipts = checkpointReceipts(paths);

      const secondResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        requirementSetId: secondRequirementSetId,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const secondReceipts = checkpointReceipts(paths);
      const progress = readJson<Record<string, unknown>>(paths.progress);

      expect(firstResult.blockingIssues).toEqual([]);
      expect(secondResult.blockingIssues).toEqual([]);
      expect(progress.requirementSetId).toBe(secondRequirementSetId);
      for (const [index, receipt] of secondReceipts.entries()) {
        expect(receipt.requirementSetId).toBe(secondRequirementSetId);
        expect(receipt.receiptHash).not.toBe(firstReceipts[index].receiptHash);
      }
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('invalidates every receipt when the canonical semantic binding changes', () => {
    const root = createTempRoot('requirements-contract-checkpoint-semantic-change-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-semantic-change'
      );
      const relativeSourcePath = 'docs/plans/checkpoint-semantic-change.md';
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        relativeSourcePath,
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-SEMANTIC-CHANGE';
      const firstResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const firstManifest = readJson<Record<string, unknown>>(
        paths.semanticConservationManifest
      );
      const firstReceipts = checkpointReceipts(paths);
      const changedDescriptor = {
        ...descriptor,
        semantics: {
          ...descriptor.semantics,
          requirement: `${descriptor.semantics.requirement} Preserve the changed semantic binding.`,
        },
      };
      const changedMaterialization = writeLintReadyMinimalConsumerRequirement(
        root,
        relativeSourcePath,
        changedDescriptor
      );

      const secondResult = runAuthoring(root, changedMaterialization.sourcePath, recordId, {
        ...changedMaterialization.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const secondManifest = readJson<Record<string, unknown>>(
        paths.semanticConservationManifest
      );
      const secondReceipts = checkpointReceipts(paths);

      expect(firstResult.blockingIssues).toEqual([]);
      expect(secondResult.blockingIssues).toEqual([]);
      expect(secondManifest.semanticModelHash).not.toBe(firstManifest.semanticModelHash);
      expect(secondManifest.manifestHash).not.toBe(firstManifest.manifestHash);
      for (const [index, receipt] of secondReceipts.entries()) {
        expect(receipt.semanticModelHash).toBe(secondManifest.semanticModelHash);
        expect(receipt.semanticConservationManifestHash).toBe(secondManifest.manifestHash);
        expect(receipt.receiptHash).not.toBe(firstReceipts[index].receiptHash);
      }
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('regenerates checkpoints when explicit persistence evidence is stale', () => {
    const root = createTempRoot('requirements-contract-checkpoint-explicit-stale-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-explicit-stale'
      );
      const relativeSourcePath = 'docs/plans/checkpoint-explicit-stale.md';
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        relativeSourcePath,
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-EXPLICIT-STALE';
      const firstResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const staleEvidencePath = path.join(
        path.dirname(paths.checkpointPersistenceEvidence),
        'checkpoint-persistence-evidence.stale.json'
      );
      writeFileSync(
        staleEvidencePath,
        readFileSync(paths.checkpointPersistenceEvidence, 'utf8'),
        'utf8'
      );
      const firstReceipts = checkpointReceipts(paths);
      const changedMaterialization = writeLintReadyMinimalConsumerRequirement(
        root,
        relativeSourcePath,
        {
          ...descriptor,
          semantics: {
            ...descriptor.semantics,
            requirement: `${descriptor.semantics.requirement} Rebind stale explicit evidence.`,
          },
        }
      );

      const secondResult = runAuthoring(root, changedMaterialization.sourcePath, recordId, {
        ...changedMaterialization.authoringOptions,
        checkpointPersistenceEvidencePath: staleEvidencePath,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const currentEvidence = readJson<Record<string, any>>(
        paths.checkpointPersistenceEvidence
      );
      const currentReceipts = checkpointReceipts(paths);

      expect(firstResult.blockingIssues).toEqual([]);
      expect(secondResult.blockingIssues.map((issue) => issue.code).join('\n')).toBe('');
      expect(currentEvidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
      expect(currentEvidence.semanticModelHash).toBe(
        currentReceipts[0].semanticModelHash
      );
      for (const [index, receipt] of currentReceipts.entries()) {
        expect(receipt.receiptHash).not.toBe(firstReceipts[index].receiptHash);
      }
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('fails closed before checkpoint receipts when implementationAttemptId is missing', () => {
    const root = createTempRoot('requirements-contract-checkpoint-missing-attempt-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-missing-attempt'
      );
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-missing-attempt.md',
        descriptor
      );
      const { implementationAttemptId: _implementationAttemptId, ...authoringOptions } =
        materialized.authoringOptions;
      const recordId = 'REQ-CHECKPOINT-MISSING-ATTEMPT';
      const result = runAuthoring(root, materialized.sourcePath, recordId, {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);

      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'checkpoint_current_attempt_binding_missing'
      );
      expect(paths.checkpointReceiptPaths.some((receiptPath) => existsSync(receiptPath))).toBe(
        false
      );
      expect(existsSync(paths.progress)).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('propagates a new attempt through the production current-source checkpoint refresh boundary', () => {
    const root = createTempRoot('requirements-contract-checkpoint-repair-attempt-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-repair-attempt'
      );
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-repair-attempt.md',
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-REPAIR-ATTEMPT';
      const requirementSetId = `${recordId}-SET`;
      const initialResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, requirementSetId);
      for (const receiptPath of paths.checkpointReceiptPaths) {
        const receipt = readJson<Record<string, any>>(receiptPath);
        receipt.sourceDocumentHash = `sha256:${'7'.repeat(64)}`;
        receipt.implementationConfirmationHash = `sha256:${'8'.repeat(64)}`;
        const { receiptHash: _receiptHash, ...payload } = receipt;
        receipt.receiptHash = sha256Stable(payload);
        writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
      }
      const repairAttemptId = `${descriptor.attempt.implementationAttemptId}-REPAIR`;

      const refreshResult = refreshCurrentSourceCheckpointPersistence(root, {
        source: paths.draftSourcePreview,
        recordId,
        requirementSetId,
        implementationAttemptId: repairAttemptId,
        sourceDocumentHash: initialResult.sourceDocumentHash,
        implementationConfirmationHash: initialResult.implementationConfirmationHash,
        forceRefresh: true,
      });
      const refreshedReceipts = checkpointReceipts(paths);
      const progress = readJson<Record<string, any>>(paths.progress);

      expect(initialResult.blockingIssues).toEqual([]);
      expect(refreshResult).toEqual({ ok: true });
      for (const receipt of refreshedReceipts) {
        expect(receipt.implementationAttemptId).toBe(repairAttemptId);
        expect(receipt.persistenceStatus).toBe('committed');
        expect(receipt.semanticValidationStatus).toBe('pass');
        expect(receipt.decision).toBe('pass');
      }
      expect(progress).toMatchObject({
        implementationAttemptId: repairAttemptId,
        currentCheckpoint: null,
        lastCompletedCheckpoint: 'cp-08-pre-render-global-reconciliation',
        next: null,
        resumeLedger: {
          completedCheckpointIds: REQUIREMENTS_CONTRACT_CHECKPOINT_IDS,
        },
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed at the refresh boundary when the current source binding is missing', () => {
    const root = createTempRoot('requirements-contract-checkpoint-refresh-binding-');
    try {
      const result = refreshCurrentSourceCheckpointPersistence(root, {
        source: '',
        recordId: 'REQ-CHECKPOINT-REFRESH-BINDING',
        requirementSetId: 'REQ-CHECKPOINT-REFRESH-BINDING-SET',
        implementationAttemptId: 'IMPL-ATTEMPT-CHECKPOINT-REFRESH-BINDING',
        sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
        implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
      });

      expect(result).toMatchObject({
        ok: false,
        issue: {
          code: 'checkpoint_current_source_refresh_binding_missing',
        },
      });
    } finally {
      removeTempRoot(root);
    }
  });
});
