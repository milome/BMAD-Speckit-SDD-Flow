import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'2'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-prompt-transaction-manifest.schema.json'
);
const outputRoot =
  '_bmad-output/runtime/requirement-records/order-flow/trace-execution/IMPL-ATTEMPT-001';

function baseManifest() {
  return {
    schemaVersion: 'requirements-contract-prompt-transaction-manifest/v1',
    transactionId: 'TX-001',
    requirementSetId: 'order-flow',
    implementationAttemptId: 'IMPL-ATTEMPT-001',
    attemptSequence: 1,
    sourceHash: HASH,
    sourceAmendmentHashes: [HASH],
    semanticModelHash: HASH,
    contractHash: HASH,
    dispatchInputSetHash: HASH,
    requirementRecordRef: {
      path: '_bmad-output/runtime/requirement-records/order-flow/requirement-record.json',
      hash: HASH,
    },
    attemptContextRef: {
      path: 'docs/plans/evidence/attempt-context.json',
      hash: HASH,
    },
    sourceRef: {
      path: 'docs/requirements/order-flow.md',
      sourceDocumentHash: HASH,
    },
    stageRegistryRef: {
      path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-stage-registry.ts',
      hash: HASH,
    },
    installedStageRegistryRef: {
      path: 'node_modules/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-stage-registry.js',
      hash: HASH,
    },
    confirmationReceiptRefs: {
      requirements: { path: 'docs/evidence/requirements.receipt.json', hash: HASH },
      architecture: { path: 'docs/evidence/architecture.receipt.json', hash: HASH },
    },
    confirmationPageRefs: {
      requirements: { path: 'docs/evidence/requirements.html', hash: HASH },
      architecture: { path: 'docs/evidence/architecture.html', hash: HASH },
    },
    consumerRef: {
      consumerId: 'order-flow-consumer',
      root: 'D:/Dev/order-flow-consumer',
      marker: { path: 'D:/Dev/order-flow-consumer/bmad-speckit-consumer-project.json', hash: HASH },
      profile: {
        path: 'D:/Dev/order-flow-consumer/_bmad-output/runtime/context/consumer-project-profile.json',
        hash: HASH,
      },
      actionBindingManifest: {
        path: 'D:/Dev/order-flow-consumer/node_modules/bmad-speckit/_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
        hash: HASH,
      },
    },
    universeHashes: {
      requirementUniverseHash: HASH,
      acceptanceUniverseHash: HASH,
      traceUniverseHash: HASH,
    },
    capabilityObservationRef: {
      path: `${outputRoot}/observations/consumer-cli-capability.json`,
      hash: HASH,
      readbackHash: HASH,
      readbackVerified: true,
    },
    generatorRef: {
      path: 'node_modules/bmad-speckit/dist/main-agent/source-authority/_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
      hash: HASH,
    },
    runnerRef: {
      path: 'node_modules/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-compiled-prompt-runner.js',
      hash: HASH,
    },
    executionReceipt: {
      exitCode: 0,
      stdoutHash: HASH,
      stderrHash: HASH,
      startedAt: '2026-07-13T05:09:59.000Z',
      completedAt: '2026-07-13T05:10:00.000Z',
    },
    productionArgv: [
      'node',
      'resolved/req-trace/scripts/generate_prompt.js',
      '--requirement-record',
      '_bmad-output/runtime/requirement-records/order-flow/requirement-record.json',
      '--source-document',
      'docs/requirements/order-flow.md',
      '--out-dir',
      outputRoot,
    ],
    productionArgvHash: HASH,
    createdAt: '2026-07-13T05:10:00.000Z',
  };
}

function nativeGoalManifest() {
  return {
    ...baseManifest(),
    transactionStatus: 'pass',
    hostDirective: 'native_goal_document_ref',
    executionDisposition: 'executable',
    outputs: {
      modelPacket: { path: `${outputRoot}/model_packet.json`, hash: HASH },
      transactionManifestPath: `${outputRoot}/transaction-manifest.json`,
      auditReceipt: {
        path: `${outputRoot}/audit_receipt.json`,
        hashApplicability: 'downstream_external',
      },
      humanPrompt: { path: `${outputRoot}/human_prompt.txt`, hash: HASH },
      goalExecution: { path: `${outputRoot}/goal_execution.md`, hash: HASH },
    },
  };
}

function directPromptManifest() {
  const value = nativeGoalManifest();
  value.hostDirective = 'direct_prompt';
  const { goalExecution: _goalExecution, ...outputs } = value.outputs;
  return { ...value, outputs };
}

function blockedManifest() {
  const {
    dispatchInputSetHash: _dispatchInputSetHash,
    capabilityObservationRef: _capabilityObservationRef,
    generatorRef: _generatorRef,
    runnerRef: _runnerRef,
    executionReceipt: _executionReceipt,
    productionArgv: _productionArgv,
    productionArgvHash: _productionArgvHash,
    ...authority
  } = baseManifest();
  return {
    ...authority,
    transactionStatus: 'blocked',
    hostDirective: 'unresolved',
    executionDisposition: 'non_executable',
    blockingReasons: ['current_dispatch_pointer_replay_rejected'],
    failedPhase: 'pointer_replay_preflight',
    outputs: {
      transactionManifestPath: `${outputRoot}/transaction-manifest.json`,
      auditReceipt: {
        path: `${outputRoot}/audit_receipt.json`,
        hashApplicability: 'downstream_external',
      },
    },
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the prompt transaction manifest schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-prompt-transaction-manifest/v1',
  () => {
    it('accepts native-goal, direct-prompt, and BLOCK output applicability', () => {
      const validate = schemaValidator();

      expect(validate(nativeGoalManifest()), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(directPromptManifest()), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(blockedManifest()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('rejects missing or extra goal_execution.md applicability', () => {
      const validate = schemaValidator();
      const nativeWithoutGoal = nativeGoalManifest();
      const { goalExecution: _goalExecution, ...nativeOutputs } = nativeWithoutGoal.outputs;
      nativeWithoutGoal.outputs = nativeOutputs as never;
      const directWithGoal = {
        ...directPromptManifest(),
        outputs: nativeGoalManifest().outputs,
      };

      expect(validate(nativeWithoutGoal)).toBe(false);
      expect(validate(directWithGoal)).toBe(false);
    });

    it('rejects audit receipt hashes, self-hashes, and reverse edges', () => {
      const validate = schemaValidator();
      const auditHashed = nativeGoalManifest();
      auditHashed.outputs.auditReceipt = {
        ...auditHashed.outputs.auditReceipt,
        hash: HASH,
      } as never;
      for (const forbiddenProperty of [
        'transactionManifestHash',
        'auditReceiptHash',
        'auditReceiptReadbackHash',
      ]) {
        const invalid = {
          ...nativeGoalManifest(),
          [forbiddenProperty]: HASH,
        };

        expect(validate(invalid), forbiddenProperty).toBe(false);
      }
      expect(validate(auditHashed)).toBe(false);
    });

    it('rejects executable BLOCK output and shell-string argv reconstruction', () => {
      const validate = schemaValidator();
      const executableBlock = {
        ...blockedManifest(),
        executionDisposition: 'executable',
      };
      const shellString = {
        ...nativeGoalManifest(),
        productionArgv:
          'node generate_prompt.js --requirement-record requirement-record.json' as never,
      };
      const fabricatedExecution = {
        ...blockedManifest(),
        executionReceipt: baseManifest().executionReceipt,
      };

      expect(validate(executableBlock)).toBe(false);
      expect(validate(shellString)).toBe(false);
      expect(validate(fabricatedExecution)).toBe(false);
    });

    it('rejects Stage Five-Star inputs and missing canonical publication bindings', () => {
      const validate = schemaValidator();
      const matrixInput = {
        ...nativeGoalManifest(),
        stageFiveStarMatrixHash: HASH,
      };
      const missingPageRefs = nativeGoalManifest();
      delete (missingPageRefs as Partial<ReturnType<typeof nativeGoalManifest>>)
        .confirmationPageRefs;

      expect(validate(matrixInput)).toBe(false);
      expect(validate(missingPageRefs)).toBe(false);
    });
  }
);
