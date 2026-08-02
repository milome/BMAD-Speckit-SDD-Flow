import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  createCheckpointSemanticValidationReceipt,
  REQUIREMENTS_CONTRACT_CHECKPOINT_IDS,
  validateCheckpointSemanticValidationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-checkpoint-semantic-validation';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  refreshCurrentSourceCheckpointPersistence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  artifacts,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  installJudgeRuntimeConfig,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeLintReadyMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

const require = createRequire(import.meta.url);
const { checkpointSemanticValidationObservation } = require(
  path.resolve('_bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js')
) as {
  checkpointSemanticValidationObservation(input: {
    sourcePath: string;
    checkpointId: string;
    progressPath?: string;
  }): {
    decision: 'pass' | 'block';
    validatedInputs: Array<{ role: string; path: string; hash: string }>;
  };
};

function checkpointReceiptValidator() {
  const schemaPath = path.resolve(
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-checkpoint-semantic-validation-receipt.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

function checkpointReceipts(paths: ReturnType<typeof artifacts>): Array<Record<string, unknown>> {
  return paths.checkpointReceiptPaths
    .filter((receiptPath) => existsSync(receiptPath))
    .map((receiptPath) => readJson<Record<string, unknown>>(receiptPath));
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function refreshDeferredCheckpointPersistence(input: {
  root: string;
  paths: ReturnType<typeof artifacts>;
  recordId: string;
  requirementSetId: string;
  implementationAttemptId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}) {
  return refreshCurrentSourceCheckpointPersistence(input.root, {
    source: input.paths.draftSourcePreview,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    implementationAttemptId: input.implementationAttemptId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    forceRefresh: true,
  });
}

function expectDeferredCriticalAuditorCheckpointState(
  receipts: Array<Record<string, any>>
): void {
  expect(receipts.map((receipt) => receipt.checkpointId)).toEqual(
    REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.slice(0, 3)
  );
  expect(receipts.slice(0, 2).map((receipt) => receipt.decision)).toEqual(['pass', 'pass']);
  expect(receipts[2]).toMatchObject({
    checkpointId: 'cp-02-atomic-decomposition-loop-convergence',
    persistenceStatus: 'committed',
    semanticValidationStatus: 'block',
    decision: 'block',
  });
  expect(
    receipts[2].blockers.map((blocker: { code: string }) => blocker.code)
  ).toContain('critical_auditor_checkpoint_outcome_required');
}

describe('requirements contract checkpoint semantic validation', () => {
  it('hash-binds the Critical Auditor checkpoint outcome even when cp-02 fails closed', () => {
    const root = createTempRoot('requirements-contract-checkpoint-outcome-binding-');
    try {
      const sourcePath = path.join(root, 'source.md');
      const authoringDir = path.join(root, 'authoring');
      const progressPath = path.join(authoringDir, 'semantic-checkpoint-progress.json');
      const semanticKernelPath = path.join(authoringDir, 'semantic-kernel.json');
      const outcomePath = path.join(authoringDir, 'critical-auditor-checkpoint-outcome.json');
      mkdirSync(authoringDir, { recursive: true });
      writeFileSync(sourcePath, '# Source\n', 'utf8');
      writeFileSync(semanticKernelPath, '{}\n', 'utf8');
      writeFileSync(outcomePath, '{}\n', 'utf8');

      const observation = checkpointSemanticValidationObservation({
        sourcePath,
        checkpointId: 'cp-02-atomic-decomposition-loop-convergence',
        progressPath,
      });

      expect(observation.decision).toBe('block');
      expect(observation.validatedInputs).toContainEqual(
        expect.objectContaining({
          role: 'critical_auditor_checkpoint_outcome',
          hash: fileHash(outcomePath),
        })
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('persists a fail-closed receipt when validation stops before any input is accepted', () => {
    const hash = sha256Stable({ phase: 'checkpoint-blocked-before-input-validation' });
    const receipt = createCheckpointSemanticValidationReceipt({
      checkpointId: 'cp-00-semantic-kernel',
      validatorIdentity:
        'requirements-contract.semantic-kernel-source-root.cp-00-semantic-kernel',
      validatorVersion: '1.0.0',
      validatorHash: hash,
      recordId: 'REQ-CHECKPOINT-BLOCKED',
      requirementSetId: 'REQ-CHECKPOINT-BLOCKED-SET',
      implementationAttemptId: 'checkpoint-blocked-attempt',
      sourceDocumentHash: hash,
      implementationConfirmationHash: hash,
      semanticModelHash: hash,
      semanticConservationManifestHash: hash,
      persistenceStatus: 'failed',
      semanticValidationStatus: 'block',
      validatedInputs: [],
      blockers: [
        {
          code: 'checkpoint_semantic_validator_inputs_missing',
          message: 'No input reached semantic validation.',
          refs: [],
        },
      ],
      decision: 'block',
      createdAt: new Date().toISOString(),
    });

    expect(validateCheckpointSemanticValidationReceipt(receipt)).toBe(true);
    expect(receipt.validatedInputs).toEqual([]);
    expect(receipt.decision).toBe('block');
  });

  it('publishes current cp-00 and cp-01 receipts and blocks cp-02 without Auditor authority', () => {
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
      });
      const paths = artifacts(
        root,
        'REQ-CHECKPOINT-SEMANTIC',
        'REQ-CHECKPOINT-SEMANTIC-SET'
      );
      const semanticManifest = readJson<Record<string, unknown>>(
        paths.semanticConservationManifest
      );
      const refreshResult = refreshDeferredCheckpointPersistence({
        root,
        paths,
        recordId: 'REQ-CHECKPOINT-SEMANTIC',
        requirementSetId: 'REQ-CHECKPOINT-SEMANTIC-SET',
        implementationAttemptId: attemptId,
        sourceDocumentHash: result.sourceDocumentHash,
        implementationConfirmationHash: result.implementationConfirmationHash,
      });
      const receipts = checkpointReceipts(paths) as Array<Record<string, any>>;
      const validateReceipt = checkpointReceiptValidator();

      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(refreshResult).toEqual({ ok: true });
      expectDeferredCriticalAuditorCheckpointState(receipts);
      for (const receipt of receipts) {
        expect(validateReceipt(receipt), validateReceipt.errors ?? []).toBe(true);
        expect(receipt).toMatchObject({
          schemaVersion: 'requirements-contract-checkpoint-semantic-validation-receipt/v1',
          recordId: 'REQ-CHECKPOINT-SEMANTIC',
          requirementSetId: 'REQ-CHECKPOINT-SEMANTIC-SET',
          implementationAttemptId: attemptId,
          persistenceStatus: 'committed',
          semanticModelHash: semanticManifest.semanticModelHash,
          semanticConservationManifestHash: semanticManifest.manifestHash,
        });
        expect(String(receipt.validatorIdentity)).toContain(String(receipt.checkpointId));
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

  it('fails closed when requirement model bytes diverge from the compiler closure binding', () => {
    const root = createTempRoot('requirements-contract-checkpoint-model-tamper-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor('checkpoint-model-tamper');
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-model-tamper.md',
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-MODEL-TAMPER';
      const requirementSetId = `${recordId}-SET`;
      const initialResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
      });
      const paths = artifacts(root, recordId, requirementSetId);
      const closureReport = readJson<Record<string, unknown>>(paths.compilerClosureReport);
      const expectedModelHash = String(closureReport.requirementContractModelHash);
      const model = readJson<Record<string, any>>(paths.compiledModel);

      expect(
        initialResult.blockingIssues.map((issue) => issue.code)
      ).not.toContain('semantic_checkpoint_requirement_contract_model_hash_mismatch');
      expect(expectedModelHash).toBe(fileHash(paths.compiledModel));
      expect(model.must).not.toHaveLength(0);
      model.must[0].text = `${String(model.must[0].text)} tampered`;
      writeFileSync(paths.compiledModel, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
      const actualModelHash = fileHash(paths.compiledModel);
      expect(actualModelHash).not.toBe(expectedModelHash);

      const refreshResult = refreshCurrentSourceCheckpointPersistence(root, {
        source: paths.draftSourcePreview,
        recordId,
        requirementSetId,
        implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
        sourceDocumentHash: initialResult.sourceDocumentHash,
        implementationConfirmationHash: initialResult.implementationConfirmationHash,
        forceRefresh: true,
      });
      const cp00Receipt = readJson<Record<string, any>>(paths.checkpointReceiptPaths[0]);

      expect(refreshResult).toMatchObject({
        ok: false,
        issue: {
          code: 'semantic_checkpoint_requirement_contract_model_hash_mismatch',
        },
      });
      if (!refreshResult.ok) {
        expect(refreshResult.issue.refs).toContain(expectedModelHash);
        expect(refreshResult.issue.refs).toContain(actualModelHash);
      }
      expect(cp00Receipt).toMatchObject({
        checkpointId: 'cp-00-semantic-kernel',
        decision: 'block',
        semanticValidationStatus: 'block',
      });
      expect(
        cp00Receipt.blockers.map((blocker: { code: string }) => blocker.code)
      ).toContain('semantic_checkpoint_requirement_contract_model_hash_mismatch');
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
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: `${recordId}-SET`,
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: firstResult.sourceDocumentHash,
          implementationConfirmationHash: firstResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const firstReceipts = checkpointReceipts(paths);
      const nextAttemptId = `${descriptor.attempt.implementationAttemptId}-NEXT`;

      const secondResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        implementationAttemptId: nextAttemptId,
      });
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: `${recordId}-SET`,
          implementationAttemptId: nextAttemptId,
          sourceDocumentHash: secondResult.sourceDocumentHash,
          implementationConfirmationHash: secondResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const secondReceipts = checkpointReceipts(paths);
      const progress = readJson<Record<string, unknown>>(paths.progress);

      expect(firstResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(secondResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expectDeferredCriticalAuditorCheckpointState(
        secondReceipts as Array<Record<string, any>>
      );
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
      });
      const paths = artifacts(root, recordId, firstRequirementSetId);
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: firstRequirementSetId,
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: firstResult.sourceDocumentHash,
          implementationConfirmationHash: firstResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const firstReceipts = checkpointReceipts(paths);

      const secondResult = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        requirementSetId: secondRequirementSetId,
      });
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: secondRequirementSetId,
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: secondResult.sourceDocumentHash,
          implementationConfirmationHash: secondResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const secondReceipts = checkpointReceipts(paths);
      const progress = readJson<Record<string, unknown>>(paths.progress);

      expect(firstResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(secondResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expectDeferredCriticalAuditorCheckpointState(
        secondReceipts as Array<Record<string, any>>
      );
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
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: `${recordId}-SET`,
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: firstResult.sourceDocumentHash,
          implementationConfirmationHash: firstResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
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
      });
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: `${recordId}-SET`,
          implementationAttemptId: changedMaterialization.authoringOptions.implementationAttemptId,
          sourceDocumentHash: secondResult.sourceDocumentHash,
          implementationConfirmationHash: secondResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const secondManifest = readJson<Record<string, unknown>>(
        paths.semanticConservationManifest
      );
      const secondReceipts = checkpointReceipts(paths);

      expect(firstResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(secondResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expectDeferredCriticalAuditorCheckpointState(
        secondReceipts as Array<Record<string, any>>
      );
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

  it('regenerates checkpoints when prior persistence evidence is stale', () => {
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
      });
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: `${recordId}-SET`,
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: firstResult.sourceDocumentHash,
          implementationConfirmationHash: firstResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const firstEvidenceHash = fileHash(paths.checkpointPersistenceEvidence);
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
      });
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId: `${recordId}-SET`,
          implementationAttemptId: changedMaterialization.authoringOptions.implementationAttemptId,
          sourceDocumentHash: secondResult.sourceDocumentHash,
          implementationConfirmationHash: secondResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      const currentEvidence = readJson<Record<string, any>>(
        paths.checkpointPersistenceEvidence
      );
      const currentReceipts = checkpointReceipts(paths);

      expect(firstResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(secondResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(fileHash(paths.checkpointPersistenceEvidence)).not.toBe(firstEvidenceHash);
      expect(currentEvidence.checkpointPersistenceSatisfiedCandidate).toBe(false);
      expect(
        currentEvidence.checkpointPersistenceRef.preRenderGatePolicy
          .auditorConvergenceDeferredToNextRound
      ).toBe(true);
      expectDeferredCriticalAuditorCheckpointState(
        currentReceipts as Array<Record<string, any>>
      );
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
      });
      const paths = artifacts(root, recordId, requirementSetId);
      expect(
        refreshDeferredCheckpointPersistence({
          root,
          paths,
          recordId,
          requirementSetId,
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: initialResult.sourceDocumentHash,
          implementationConfirmationHash: initialResult.implementationConfirmationHash,
        })
      ).toEqual({ ok: true });
      for (const receiptPath of paths.checkpointReceiptPaths.filter((candidate) =>
        existsSync(candidate)
      )) {
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

      expect(initialResult.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(refreshResult).toEqual({ ok: true });
      expectDeferredCriticalAuditorCheckpointState(
        refreshedReceipts as Array<Record<string, any>>
      );
      for (const receipt of refreshedReceipts) {
        expect(receipt.implementationAttemptId).toBe(repairAttemptId);
        expect(receipt.persistenceStatus).toBe('committed');
      }
      expect(progress).toMatchObject({
        implementationAttemptId: repairAttemptId,
        resumeLedger: {
          completedCheckpointIds: REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.slice(0, 2),
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
