import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_CHECKPOINT_IDS } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-checkpoint-semantic-validation';
import { refreshCurrentSourceCheckpointPersistence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  artifacts,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  installJudgeRuntimeConfig,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

const EXPECTED_CHECKPOINT_SEQUENCE = [
  'cp-00-semantic-kernel',
  'cp-01-must-decomposition-packet',
  'cp-02-atomic-decomposition-loop-convergence',
  'cp-03-packet-to-source-materialization',
  'cp-04-id-freeze',
  'cp-05-implementation-confirmation-core',
  'cp-06-projections',
  'cp-07-human-readable-views',
  'cp-08-pre-render-global-reconciliation',
] as const;

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract checkpoint main lane', () => {
  it('wires checkpoint persistence evidence through the CLI parser', () => {
    const source = readFileSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
      ),
      'utf8'
    );

    expect(source).toContain('--checkpoint-persistence-evidence');
    expect(source).toContain('out.checkpointPersistenceEvidencePath = argv[++index]');
    expect(source).toContain(
      'checkpointPersistenceEvidencePath: args.checkpointPersistenceEvidencePath'
    );
  });

  it('automatically persists checkpoint evidence for checkpoint_required routes', () => {
    const root = createTempRoot('requirements-contract-checkpoint-main-');
    try {
      installJudgeRuntimeConfig(root);
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-main.md',
        createMinimalConsumerRequirementDescriptor('REQ-CHECKPOINT-MAIN')
      );
      const source = materialized.sourcePath;
      const { targetPath, requiredCommand, implementationAttemptId } =
        materialized.authoringOptions;
      let stderr = '';
      let result: ReturnType<typeof runAuthoring> | null = null;
      const originalStderrWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        return true;
      }) as typeof process.stderr.write;
      try {
        result = runAuthoring(root, source, 'REQ-CHECKPOINT-MAIN', {
          ...materialized.authoringOptions,
          criticalAuditorProviderMode: 'external_adapter',
        });
      } finally {
        process.stderr.write = originalStderrWrite;
      }
      const paths = artifacts(root, 'REQ-CHECKPOINT-MAIN', 'REQ-CHECKPOINT-MAIN-SET');
      expect(
        existsSync(paths.checkpointPersistenceEvidence),
        JSON.stringify(
          {
            substate: result?.substate,
            blockingStage: result?.blockingStage,
            blockingIssues: result?.blockingIssues,
          },
          null,
          2
        )
      ).toBe(true);
      const route = readJson<Record<string, unknown>>(paths.scaleRoutingDecision);
      const evidence = readJson<Record<string, unknown>>(paths.checkpointPersistenceEvidence);
      const ref = evidence.checkpointPersistenceRef as Record<string, unknown>;
      const progress = readJson<Record<string, unknown>>(paths.progress);
      const intakeReceipt = readJson<Record<string, unknown>>(paths.intakeReceipt);
      const invocationAuthorityReceipt = readJson<Record<string, unknown>>(
        paths.invocationAuthorityReceipt
      );
      const semanticManifest = readJson<Record<string, unknown>>(
        paths.semanticConservationManifest
      );
      const checkpointIds = [...REQUIREMENTS_CONTRACT_CHECKPOINT_IDS];
      const checkpointValidatorPath = path.resolve(
        '_bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js'
      );

      expect(checkpointIds).toEqual(EXPECTED_CHECKPOINT_SEQUENCE);
      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);
      expect(String(route.decision)).toBe('single_pass_final_allowed');
      expect(route.checkpointPersistenceSatisfied).toBe(true);
      expect(evidence).toMatchObject({
        checkpointPersistenceSatisfiedCandidate: true,
      });
      expect(evidence).not.toHaveProperty('completedCheckpointIds');
      expect(ref.completedCheckpointIds).toEqual(checkpointIds);
      expect(Array.isArray(ref.checkpointReceiptRefs)).toBe(true);
      expect(ref.checkpointReceiptRefs).toHaveLength(checkpointIds.length);
      expect(intakeReceipt).toMatchObject({
        schemaVersion: 'requirements-contract-file-intake-receipt/v1',
        requirementSetId: 'REQ-CHECKPOINT-MAIN-SET',
        entrySource: 'source_prd_draft',
      });
      expect(intakeReceipt).not.toHaveProperty('sessionId');
      expect(invocationAuthorityReceipt).toMatchObject({
        schemaVersion: 'requirements-contract-invocation-authority-receipt/v1',
        requirementSetId: 'REQ-CHECKPOINT-MAIN-SET',
        recordId: 'REQ-CHECKPOINT-MAIN',
        entrySource: 'source_prd_draft',
      });
      expect(invocationAuthorityReceipt.arguments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'target_path',
            value: targetPath,
          }),
          expect.objectContaining({
            kind: 'required_command',
            value: requiredCommand,
          }),
        ])
      );
      for (const [index, checkpointId] of checkpointIds.entries()) {
        const receiptPath = paths.checkpointReceiptPaths[index];
        expect(existsSync(receiptPath)).toBe(true);
        const receipt = readJson<Record<string, unknown>>(receiptPath);
        expect(receipt).toMatchObject({
          schemaVersion:
            'requirements-contract-checkpoint-semantic-validation-receipt/v1',
          checkpointId,
          recordId: 'REQ-CHECKPOINT-MAIN',
          requirementSetId: 'REQ-CHECKPOINT-MAIN-SET',
          implementationAttemptId,
          persistenceStatus: 'committed',
          semanticValidationStatus: 'pass',
          semanticModelHash: semanticManifest.semanticModelHash,
          semanticConservationManifestHash: semanticManifest.manifestHash,
          blockers: [],
          decision: 'pass',
        });
        expect(String(receipt.receiptHash)).toMatch(/^sha256:/u);
      }
      const cp00Receipt = readJson<Record<string, any>>(paths.checkpointReceiptPaths[0]);
      const cp01Receipt = readJson<Record<string, any>>(paths.checkpointReceiptPaths[1]);
      const cp02Receipt = readJson<Record<string, any>>(paths.checkpointReceiptPaths[2]);
      const cp00ArtifactPaths = cp00Receipt.validatedInputs.map(
        (artifact: { path: string }) => artifact.path
      );
      expect(cp00ArtifactPaths).toEqual(
        expect.arrayContaining(
          [
            paths.semanticIr,
            paths.semanticConservationManifest,
            paths.compiledModel,
            paths.compilerClosureReport,
          ].map((artifactPath) => path.relative(root, artifactPath).replace(/\\/gu, '/'))
        )
      );
      expect(cp01Receipt.validatorIdentity).toBe(
        'requirements-contract.must-decomposition-packet.cp-01-must-decomposition-packet'
      );
      expect(cp02Receipt.validatorIdentity).toBe(
        'requirements-contract.critical-auditor-convergence.cp-02-atomic-decomposition-loop-convergence'
      );
      expect(cp01Receipt.validatorHash).toBe(sha256File(checkpointValidatorPath));
      expect(cp02Receipt.validatorHash).toBe(sha256File(checkpointValidatorPath));
      expect(
        cp01Receipt.validatedInputs.map((artifact: { role: string }) => artifact.role)
      ).toEqual(
        expect.arrayContaining([
          'source_document',
          'semantic_kernel',
          'must_decomposition_packet',
        ])
      );
      expect(
        cp02Receipt.validatedInputs.map((artifact: { role: string }) => artifact.role)
      ).toEqual(
        expect.arrayContaining([
          'source_document',
          'semantic_kernel',
          'must_decomposition_packet',
          'critical_auditor_receipt',
        ])
      );
      expect(progress.resumeLedger).toMatchObject({
        schemaVersion: 'requirements-contract-checkpoint-resume-ledger/v1',
        completedCheckpointIds: checkpointIds,
      });
      expect(progress.lastCompletedCheckpoint).toBe('cp-08-pre-render-global-reconciliation');
      expect(progress.currentCheckpoint).toBe(null);
      expect(progress.next).toBe(null);
      expect(ref.progressHash).toBeTruthy();
      expect(ref.preRenderMustDecompositionGateHash).toBeTruthy();
      expect(ref.preRenderGlobalConsistencyHash).toBeTruthy();
      expect(ref.packetSourceReconciliationHash).toBeTruthy();
      expect(stderr).toContain('[requirements-contract-authoring] checkpoint trace start');
      for (const checkpointId of checkpointIds) {
        expect(stderr).toContain(`checkpoint phase=start id=${checkpointId}`);
        expect(stderr).toContain(`checkpoint phase=result id=${checkpointId} result=passed`);
      }
      expect(stderr).toContain(
        'artifact=_bmad-output/runtime/requirement-records/REQ-CHECKPOINT-MAIN/authoring/'
      );
      expect(stderr).toContain('hash=sha256:');
      expect(stderr).toContain('next=cp-01-must-decomposition-packet');
      expect(stderr).toContain('next=checkpoint-persistence-summary');
      expect(stderr).toContain('checkpoint-persistence summary');
      expect(result?.blockingIssues.map((issue) => issue.code)).not.toContain(
        'checkpoint_required_before_source_materialization'
      );
    } finally {
      removeTempRoot(root);
    }
  }, 1_000_000);

  it('restarts checkpoint execution when existing receipt files are stale for the current transaction', () => {
    const root = createTempRoot('requirements-contract-checkpoint-resume-');
    try {
      installJudgeRuntimeConfig(root);
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-resume.md',
        createMinimalConsumerRequirementDescriptor('REQ-CHECKPOINT-RESUME')
      );
      const source = materialized.sourcePath;
      const initialResult = runAuthoring(root, source, 'REQ-CHECKPOINT-RESUME', {
        ...materialized.authoringOptions,
      });
      const paths = artifacts(root, 'REQ-CHECKPOINT-RESUME', 'REQ-CHECKPOINT-RESUME-SET');
      expect(
        refreshCurrentSourceCheckpointPersistence(root, {
          source: paths.draftSourcePreview,
          recordId: 'REQ-CHECKPOINT-RESUME',
          requirementSetId: 'REQ-CHECKPOINT-RESUME-SET',
          implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
          sourceDocumentHash: initialResult.sourceDocumentHash,
          implementationConfirmationHash: initialResult.implementationConfirmationHash,
          forceRefresh: true,
        })
      ).toEqual({ ok: true });
      expect(
        paths.checkpointReceiptPaths.slice(0, 3).every((receiptPath) => existsSync(receiptPath))
      ).toBe(true);
      expect(
        paths.checkpointReceiptPaths.slice(3).some((receiptPath) => existsSync(receiptPath))
      ).toBe(false);
      expect(readJson<Record<string, unknown>>(paths.intakeReceipt)).toMatchObject({
        schemaVersion: 'requirements-contract-file-intake-receipt/v1',
        entrySource: 'source_prd_draft',
      });
      expect(readJson<Record<string, unknown>>(paths.invocationAuthorityReceipt)).toMatchObject({
        schemaVersion: 'requirements-contract-invocation-authority-receipt/v1',
        entrySource: 'source_prd_draft',
      });
      const receiptsBefore = paths.checkpointReceiptPaths.slice(0, 3).map((receiptPath) =>
        readJson<Record<string, unknown>>(receiptPath)
      );
      const cp00Path = paths.checkpointReceiptPaths[0];
      const tamperedCp00 = readJson<Record<string, unknown>>(cp00Path);
      const { receiptHash: _receiptHash, ...tamperedPayload } = {
        ...tamperedCp00,
        sourceDocumentHash: `sha256:${'f'.repeat(64)}`,
      };
      const tamperedReceipt = {
        ...tamperedPayload,
        receiptHash: sha256Stable(tamperedPayload),
      };
      writeFileSync(
        cp00Path,
        `${JSON.stringify(tamperedReceipt, null, 2)}\n`,
        'utf8'
      );
      const tamperedHash = sha256File(cp00Path);

      const result = refreshCurrentSourceCheckpointPersistence(root, {
        source: paths.draftSourcePreview,
        recordId: 'REQ-CHECKPOINT-RESUME',
        requirementSetId: 'REQ-CHECKPOINT-RESUME-SET',
        implementationAttemptId: materialized.authoringOptions.implementationAttemptId,
        sourceDocumentHash: initialResult.sourceDocumentHash,
        implementationConfirmationHash: initialResult.implementationConfirmationHash,
        forceRefresh: false,
      });
      const progress = readJson<Record<string, unknown>>(paths.progress);
      const evidence = readJson<Record<string, unknown>>(paths.checkpointPersistenceEvidence);
      const ref = evidence.checkpointPersistenceRef as Record<string, unknown>;

      const receiptsAfter = paths.checkpointReceiptPaths.slice(0, 3).map((receiptPath) =>
        readJson<Record<string, unknown>>(receiptPath)
      );
      expect(result).toEqual({ ok: true });
      expect(sha256File(cp00Path)).not.toBe(tamperedHash);
      for (const [index, receiptPath] of paths.checkpointReceiptPaths
        .slice(0, 3)
        .entries()) {
        expect(existsSync(receiptPath)).toBe(true);
        expect(receiptsAfter[index].sourceDocumentHash).toBe(initialResult.sourceDocumentHash);
        expect(receiptsAfter[index].semanticModelHash).toBe(
          receiptsBefore[index].semanticModelHash
        );
      }
      expect(
        (progress.resumeLedger as Record<string, unknown>).completedCheckpointIds
      ).toEqual(REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.slice(0, 2));
      expect(ref.checkpointReceiptRefs).toHaveLength(9);
      expect(evidence.checkpointPersistenceSatisfiedCandidate).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);
});
