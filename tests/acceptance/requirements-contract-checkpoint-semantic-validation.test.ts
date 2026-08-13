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
    blockers: Array<{ code: string; message: string; refs: string[] }>;
  };
};

function checkpointReceiptValidator() {
  const schemaPath = path.resolve(
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-checkpoint-semantic-validation-receipt.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract checkpoint semantic validation', () => {
  it('keeps cp-02 deterministic and excludes Critical Auditor outcome authority', () => {
    const root = createTempRoot('requirements-contract-checkpoint-cp02-no-auditor-');
    try {
      const sourcePath = path.join(root, 'source.md');
      const authoringDir = path.join(root, 'authoring');
      const progressPath = path.join(authoringDir, 'semantic-checkpoint-progress.json');
      const semanticKernelPath = path.join(authoringDir, 'semantic-kernel.json');
      mkdirSync(authoringDir, { recursive: true });
      writeFileSync(sourcePath, '# Source\n', 'utf8');
      writeFileSync(semanticKernelPath, '{}\n', 'utf8');

      const observation = checkpointSemanticValidationObservation({
        sourcePath,
        checkpointId: 'cp-02-deterministic-atomic-closure',
        progressPath,
      });

      expect(REQUIREMENTS_CONTRACT_CHECKPOINT_IDS[2]).toBe(
        'cp-02-deterministic-atomic-closure'
      );
      expect(observation.decision).toBe('block');
      expect(observation.validatedInputs).toContainEqual({
        role: 'semantic_kernel',
        path: semanticKernelPath.replace(/\\/gu, '/'),
        hash: fileHash(semanticKernelPath),
      });
      expect(
        observation.validatedInputs.some(({ role }) => /auditor/iu.test(role))
      ).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('persists a schema-valid fail-closed receipt before any input is accepted', () => {
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
    expect(checkpointReceiptValidator()(receipt)).toBe(true);
    expect(receipt.validatedInputs).toEqual([]);
    expect(receipt.decision).toBe('block');
  });

  it('fails closed when requirement model bytes diverge from compiler closure', () => {
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

  it('rejects every cp02 atom authority and execution closure break', () => {
    const root = createTempRoot('requirements-contract-checkpoint-cp02-closure-');
    installJudgeRuntimeConfig(root);
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor('checkpoint-cp02-closure');
      const materialized = writeLintReadyMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-cp02-closure.md',
        descriptor
      );
      const recordId = 'REQ-CHECKPOINT-CP02-CLOSURE';
      const requirementSetId = `${recordId}-SET`;
      runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
      });
      const paths = artifacts(root, recordId, requirementSetId);
      const packetPath = path.join(paths.authoring, 'must_decomposition_packet.json');
      const original = readJson<Record<string, any>>(packetPath);
      const packet = original.must_decomposition_packet;
      packet.executionRegistry = {
        entries: [{
          kind: 'CMD',
          id: 'checkpoint-targeted-test',
          value: 'npm test -- checkpoint-cp02-closure.test.ts',
        }],
      };
      for (const mustPacket of packet.mustPackets) {
        for (const atom of mustPacket.mustAtomicTasks) {
          const spanRef = `SPAN-${mustPacket.mustRef}`;
          atom.action = atom.text || atom.primaryObservableBehaviors?.[0] || mustPacket.mustIntent;
          atom.oracle = atom.primaryAcceptanceOracles?.[0] || atom.redProofPlan;
          atom.dependencies = [];
          atom.originBindings = [{ sourceRootId: mustPacket.mustRef, sourceSpanRef: spanRef }];
          atom.authorityRefs = [mustPacket.mustRef];
          atom.spanRefs = [spanRef];
          atom.executionConstraintRefs = ['CMD:checkpoint-targeted-test'];
        }
      }
      writeFileSync(packetPath, `${JSON.stringify(original, null, 2)}\n`, 'utf8');
      expect(checkpointSemanticValidationObservation({
        sourcePath: paths.draftSourcePreview,
        checkpointId: 'cp-02-deterministic-atomic-closure',
        progressPath: paths.progress,
      }).decision).toBe('pass');

      const cases = [
        ['action', (atom: Record<string, any>) => { atom.action = ''; },
          'requirements_cp02_atom_action_invalid'],
        ['oracle', (atom: Record<string, any>) => { atom.oracle = ''; },
          'requirements_cp02_atom_oracle_invalid'],
        ['dependency', (atom: Record<string, any>) => { atom.dependencies = ['ATOM-UNKNOWN']; },
          'requirements_cp02_atom_dependency_unknown'],
        ['dependency cycle', (atom: Record<string, any>) => { atom.dependencies = [atom.id]; },
          'requirements_cp02_atom_dependency_cycle'],
        ['origin', (atom: Record<string, any>) => { atom.originBindings = []; },
          'requirements_cp02_atom_origin_binding_invalid'],
        ['authority', (atom: Record<string, any>) => { atom.authorityRefs = []; },
          'requirements_cp02_atom_authority_ref_invalid'],
        ['span', (atom: Record<string, any>) => { atom.spanRefs = []; },
          'requirements_cp02_atom_span_ref_invalid'],
        ['execution', (atom: Record<string, any>) => {
          atom.executionConstraintRefs = ['CMD:missing'];
        }, 'requirements_cp02_execution_constraint_unknown'],
      ] as const;
      for (const [label, corrupt, issueCode] of cases) {
        const damaged = structuredClone(original);
        corrupt(damaged.must_decomposition_packet.mustPackets[0].mustAtomicTasks[0]);
        writeFileSync(packetPath, `${JSON.stringify(damaged, null, 2)}\n`, 'utf8');
        const observation = checkpointSemanticValidationObservation({
          sourcePath: paths.draftSourcePreview,
          checkpointId: 'cp-02-deterministic-atomic-closure',
          progressPath: paths.progress,
        });
        expect(observation.decision, label).toBe('block');
        expect(observation.blockers.map((blocker) => blocker.code), label).toContain(issueCode);
      }
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed before receipts when implementationAttemptId is missing', () => {
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

  it('fails closed at refresh when the current source binding is missing', () => {
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
