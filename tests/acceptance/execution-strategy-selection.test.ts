import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendBlockedExecutionStrategyAttempt,
  appendExecutionStrategySelection,
  buildExecutionStrategyOptions,
  exactExecutionStrategySelectionPhrase,
  sha256Stable,
  selectExecutionStrategy,
  toExecutionStrategySelectionEvent,
  validateExecutionStrategySelectionEvent,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/execution-strategy-selection';

const HASH_A = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH_B = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const HASH_C = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const HASH_D = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const HASH_E = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const HASH_F = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function writeRecord(root: string): string {
  const recordDir = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-STRATEGY'
  );
  const recordPath = path.join(recordDir, 'requirement-record.json');
  mkdirSync(recordDir, { recursive: true });
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirement-record/v1',
        recordId: 'REQ-STRATEGY',
        requirementSetId: 'REQ-STRATEGY',
        status: 'user_confirmed',
        sourcePath: 'docs/requirements/strategy.md',
        sourceDocumentHash: HASH_B,
        implementationConfirmationHash: HASH_C,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            recordId: 'REQ-STRATEGY',
            requirementSetId: 'REQ-STRATEGY',
            confirmedAt: '2026-05-28T00:00:00.000Z',
            confirmedBy: 'test',
            sourcePath: 'docs/requirements/strategy.md',
            sourceDocumentHash: HASH_B,
            implementationConfirmationHash: HASH_C,
            confirmationPageHash: HASH_D,
            confirmationText: 'confirmed',
            renderReportPath:
              '_bmad-output/runtime/requirement-records/REQ-STRATEGY/confirmation/report.json',
            htmlPath:
              '_bmad-output/runtime/requirement-records/REQ-STRATEGY/confirmation/confirmation.html',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
}

function compiledRef() {
  return {
    modelPacketPath: 'trace-execution/packet/model_packet.json',
    modelPacketHash: HASH_A,
    humanPromptPath: 'trace-execution/packet/human_prompt.txt',
    humanPromptHash: HASH_E,
    auditReceiptPath: 'trace-execution/packet/audit_receipt.json',
    auditReceiptHash: HASH_F,
    goalExecutionPath: null,
    goalExecutionHash: null,
    sourceDocumentHash: HASH_B,
    implementationConfirmationHash: HASH_C,
  };
}

function hashFile(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('execution strategy selection', () => {
  it('renders available direct strategy and blocked future strategies only after model packet gate pass', () => {
    const blocked = buildExecutionStrategyOptions({
      compiledPromptRef: null,
      modelPacketGateDecision: 'blocked',
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.options).toEqual([]);
    expect(blocked.blockingReasons).toContain('model_packet_ref_missing');

    const result = buildExecutionStrategyOptions({
      compiledPromptRef: compiledRef(),
      modelPacketGateDecision: 'pass',
    });
    expect(result.status).toBe('pass');
    expect(result.options.map((option) => [option.strategyId, option.availability])).toEqual([
      ['compiled_trace_direct', 'available'],
      ['compiled_trace_with_sdd_artifacts', 'blocked_until_artifact_realization_lane'],
      ['governed_skill_adapter', 'blocked_until_adapter_certification_gate'],
      ['governed_skill_prompt', 'blocked_until_prompt_equivalence_gate'],
    ]);
    expect(result.strategyOptionsHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('requires exact phrase for user selection and rejects unavailable strategies', () => {
    const optionsResult = buildExecutionStrategyOptions({
      compiledPromptRef: compiledRef(),
      modelPacketGateDecision: 'pass',
    });
    const exactPhrase = exactExecutionStrategySelectionPhrase({
      strategyId: 'compiled_trace_direct',
      strategyOptionsHash: optionsResult.strategyOptionsHash,
      modelPacketHash: optionsResult.modelPacketHash,
      sourceDocumentHash: optionsResult.sourceDocumentHash,
      implementationConfirmationHash: optionsResult.implementationConfirmationHash,
    });
    const selection = selectExecutionStrategy({
      optionsResult,
      strategyId: 'compiled_trace_direct',
      selectedBy: 'user',
      exactPhrase,
    });
    expect(selection).toMatchObject({
      eventType: 'execution_strategy_selected',
      strategyId: 'compiled_trace_direct',
      availability: 'available',
      selectedBy: 'user',
      modelPacketHash: HASH_A,
      sourceDocumentHash: HASH_B,
      implementationConfirmationHash: HASH_C,
    });

    expect(() =>
      selectExecutionStrategy({
        optionsResult,
        strategyId: 'compiled_trace_with_sdd_artifacts',
        selectedBy: 'user',
        exactPhrase: 'wrong',
      })
    ).toThrow(/not available/u);
    expect(() =>
      selectExecutionStrategy({
        optionsResult,
        strategyId: 'compiled_trace_direct',
        selectedBy: 'user',
        exactPhrase: 'wrong',
      })
    ).toThrow(/exact phrase mismatch/u);
  });

  it('defaults policy to the current certified adapter and binds certification drift', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'execution-strategy-certified-'));
    try {
      const packetDir = path.join(root, '_bmad-output', 'runtime', 'trace-execution', 'packet-1');
      const evidenceDir = path.join(
        root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation'
      );
      mkdirSync(packetDir, { recursive: true });
      mkdirSync(evidenceDir, { recursive: true });
      const modelPacketPath = path.join(packetDir, 'model_packet.json');
      const transactionManifestPath = path.join(packetDir, 'prompt-transaction-manifest.json');
      const pointerPath = path.join(evidenceDir, 'current-dispatch-pointer-receipt.json');
      const certificationPath = path.join(
        packetDir,
        'main-agent-goal-source-authority-certification.json'
      );
      const bindingPath = path.join(packetDir, 'campaign-runtime-binding.json');
      const packageRequestPath = path.join(packetDir, 'package-request.json');
      const partitionManifestPath = path.join(packetDir, 'partition-manifest.json');
      const childPath = path.join(packetDir, 'child-1.md');
      const runtimeDependencyPath = path.join(packetDir, 'campaign-runtime-dependencies.cjs');
      const executionPacketPath = path.join(packetDir, 'execution-packet.json');
      writeFileSync(modelPacketPath, '{"packetId":"packet-1"}\n', 'utf8');
      writeFileSync(transactionManifestPath, '{"transactionId":"transaction-1"}\n', 'utf8');
      writeFileSync(childPath, '# Child 1\n', 'utf8');
      writeFileSync(partitionManifestPath, '{"partitions":[]}\n', 'utf8');
      writeFileSync(
        packageRequestPath,
        `${JSON.stringify({
          schemaVersion: 'goal-subcontract-execution-package-request/v1',
          partitionManifest: {
            path: partitionManifestPath,
            hash: hashFile(partitionManifestPath),
          },
        })}\n`,
        'utf8'
      );
      writeFileSync(
        runtimeDependencyPath,
        'module.exports = { compileExecutionPackage() {}, auditExecutionPackage() {}, auditCompletedChild() {}, auditCompletedCampaign() {} };\n',
        'utf8'
      );
      const packageRequestRef = {
        path: packageRequestPath,
        hash: hashFile(packageRequestPath),
      };
      const partitionManifestRef = {
        path: partitionManifestPath,
        hash: hashFile(partitionManifestPath),
      };
      writeFileSync(
        executionPacketPath,
        '{"packetId":"packet-1"}\n',
        'utf8'
      );
      const certificationCore = {
        schemaVersion: 'main-agent-goal-source-authority-certification/v1',
        authorityProfile: 'main_agent_compiled',
        decision: 'PASS',
        transactionManifestHash: hashFile(transactionManifestPath),
        modelPacketBinding: { modelPacketHash: hashFile(modelPacketPath) },
        packetRef: { path: executionPacketPath },
        packageRequestRef,
        partitionManifestRef,
      };
      writeFileSync(
        certificationPath,
        `${JSON.stringify({
          ...certificationCore,
          certifiedAt: '2026-08-06T00:00:00.000Z',
          certificationHash: sha256Stable(certificationCore),
        })}\n`,
        'utf8'
      );
      const dependencyRef = {
        moduleRef: {
          path: runtimeDependencyPath,
          hash: hashFile(runtimeDependencyPath),
        },
      };
      writeFileSync(
        bindingPath,
        `${JSON.stringify({
          schemaVersion: 'main-agent-campaign-runtime-binding/v1',
          pointerRef: { path: pointerPath },
          packetRef: { path: executionPacketPath },
          certificationRef: {
            path: certificationPath,
            hash: hashFile(certificationPath),
          },
          packageRequestRef,
          partitionManifestRef,
          children: [{ partitionId: 'child-1', path: childPath, hash: hashFile(childPath) }],
          runtimeDependencies: {
            compileExecutionPackage: {
              ...dependencyRef,
              exportName: 'compileExecutionPackage',
            },
            auditExecutionPackage: {
              ...dependencyRef,
              exportName: 'auditExecutionPackage',
            },
            auditCompletedChild: {
              ...dependencyRef,
              exportName: 'auditCompletedChild',
            },
            auditCompletedCampaign: {
              ...dependencyRef,
              exportName: 'auditCompletedCampaign',
            },
          },
        })}\n`,
        'utf8'
      );
      const bindingHash = hashFile(bindingPath);
      writeFileSync(
        pointerPath,
        `${JSON.stringify({
          modelPacketRef: { path: modelPacketPath, hash: hashFile(modelPacketPath) },
          transactionManifestRef: {
            path: transactionManifestPath,
            hash: hashFile(transactionManifestPath),
          },
          campaignRuntimeBindingRef: {
            path: bindingPath,
            hash: bindingHash,
            readbackHash: bindingHash,
            readbackVerified: true,
          },
          sourceDocumentHash: HASH_B,
          implementationConfirmationHash: HASH_C,
        })}\n`,
        'utf8'
      );
      const ref = {
        ...compiledRef(),
        modelPacketPath,
        modelPacketHash: hashFile(modelPacketPath),
      };
      const certified = buildExecutionStrategyOptions({
        compiledPromptRef: ref,
        modelPacketGateDecision: 'pass',
      });
      expect(certified.policyDefaultStrategyId).toBe('governed_skill_adapter');
      expect(
        certified.options.find((option) => option.strategyId === 'governed_skill_adapter')
      ).toMatchObject({ availability: 'available' });
      expect(
        selectExecutionStrategy({
          optionsResult: certified,
          strategyId: 'compiled_trace_direct',
          selectedBy: 'policy',
          policyDefaultAllowed: true,
        }).strategyId
      ).toBe('governed_skill_adapter');

      const originalHash = certified.strategyOptionsHash;
      writeFileSync(
        certificationPath,
        `${JSON.stringify({ ...certificationCore, transactionManifestHash: HASH_F })}\n`,
        'utf8'
      );
      const stale = buildExecutionStrategyOptions({
        compiledPromptRef: ref,
        modelPacketGateDecision: 'pass',
      });
      expect(stale.policyDefaultStrategyId).toBeNull();
      expect(stale.strategyOptionsHash).not.toBe(originalHash);
      expect(
        stale.options
          .filter((option) =>
            ['compiled_trace_direct', 'governed_skill_adapter'].includes(option.strategyId)
          )
          .every((option) => option.availability !== 'available')
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('controlled-ingests available strategy selection and schema rejects missing hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'execution-strategy-selection-'));
    try {
      const recordPath = writeRecord(root);
      const optionsResult = buildExecutionStrategyOptions({
        compiledPromptRef: compiledRef(),
        modelPacketGateDecision: 'pass',
      });
      const selection = selectExecutionStrategy({
        optionsResult,
        strategyId: 'compiled_trace_direct',
        selectedBy: 'policy',
        policyDefaultAllowed: true,
      });
      const event = toExecutionStrategySelectionEvent({
        recordId: 'REQ-STRATEGY',
        requirementSetId: 'REQ-STRATEGY',
        selection,
        sourceRefs: [{ sourceType: 'model_packet', id: HASH_A }],
        recordedAt: '2026-05-28T00:01:00.000Z',
        recordedBy: 'test',
      });

      const commit = appendExecutionStrategySelection({ recordPath, event });
      expect(commit.event.eventType).toBe('execution_strategy_selected');
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, any>;
      expect(record.lastEventType).toBe('execution_strategy_selected');
      expect(record.executionStrategySelections).toHaveLength(1);
      expect(record.executionStrategySelections[0].selectedOptionHash).toBe(
        selection.selectedOptionHash
      );

      expect(
        validateExecutionStrategySelectionEvent({
          ...event,
          selectedOptionHash: '',
        })
      ).toContain('selectedOptionHash_missing_or_invalid');
      expect(
        validateExecutionStrategySelectionEvent({
          ...event,
          availability: 'blocked_until_artifact_realization_lane' as never,
        })
      ).toContain('strategy_availability_not_available');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records blocked strategy attempts as contract checks without selection events', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'execution-strategy-blocked-'));
    try {
      const recordPath = writeRecord(root);
      appendBlockedExecutionStrategyAttempt({
        recordPath,
        recordId: 'REQ-STRATEGY',
        requirementSetId: 'REQ-STRATEGY',
        strategyId: 'compiled_trace_with_sdd_artifacts',
        blockingReasons: ['blocked_until_artifact_realization_lane'],
        sourceRefs: [
          { sourceType: 'execution_strategy_option', id: 'compiled_trace_with_sdd_artifacts' },
        ],
        recordedAt: '2026-05-28T00:02:00.000Z',
        recordedBy: 'test',
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, any>;
      expect(record.lastEventType).toBe('contract_check_recorded');
      expect(record.executionStrategySelections ?? []).toHaveLength(0);
      expect(record.contractChecks.at(-1)).toMatchObject({
        eventType: 'contract_check_recorded',
        contract: 'execution_strategy_selection',
        decision: 'blocked',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
