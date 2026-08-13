import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context-registry';
import {
  projectContextPath,
  writeRuntimeContext,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context';
import { mainEmitRuntimePolicy } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/emit-runtime-policy';
import { runMainAgentConfirmCloseoutAcceptance } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  serializeRequirementsContractImplementationConfirmation,
  sourceDocumentHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';
import { appendControlEventAndReplay } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { runUnifiedIngress } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-unified-ingress';
import {
  hasCurrentControlledCloseoutAcceptance,
  resolveSixModelRuntimeDecision,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/six-model-runtime-decision';
import { resolveVerifiedSixModelStatus } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/verified-six-model-status-facade';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
} from '../helpers/requirement-fixture-runtime';

type RequirementFixture = ReturnType<typeof materializeRequirementFixture>;
type RuntimeRecord = Record<string, unknown>;
type ResolverOverrides = Omit<
  Parameters<typeof resolveSixModelRuntimeDecision>[0],
  'record' | 'attemptId' | 'statusDecisionReceipts'
>;
type MentalModel =
  | 'requirement_confirmation'
  | 'architecture_confirmation'
  | 'implementation_readiness'
  | 'execution_closure'
  | 'audit_review'
  | 'delivery_confirmation';

const ALL_MODEL_PASSES = {
  requirement_confirmation: { status: 'pass' },
  architecture_confirmation: { status: 'pass' },
  implementation_readiness: { status: 'pass' },
  execution_closure: { status: 'pass' },
  audit_review: { status: 'pass' },
  delivery_confirmation: { status: 'pass' },
};

function readRequirementRecord(fixture: RequirementFixture): RuntimeRecord {
  return JSON.parse(readFileSync(fixture.recordPath, 'utf8')) as RuntimeRecord;
}

function resolveFixtureDecision(
  fixture: RequirementFixture,
  record: RuntimeRecord,
  overrides: ResolverOverrides = {}
) {
  return resolveSixModelRuntimeDecision({
    record,
    attemptId: fixture.runId,
    statusDecisionReceipts: record.runtimeStatusDecisionReceipts as Array<{
      path: string;
      receipt: unknown;
    }>,
    ...overrides,
  });
}

function withRequirementFixture(
  input: NonNullable<Parameters<typeof materializeRequirementFixture>[0]>,
  assertion: (fixture: RequirementFixture, record: RuntimeRecord) => void
): void {
  const fixture = materializeRequirementFixture(input);
  try {
    assertion(fixture, readRequirementRecord(fixture));
  } finally {
    cleanupRequirementWorkspace(fixture.root);
  }
}

function withOpenReconfirmation(
  record: RuntimeRecord,
  requestId: string,
  targetModel: MentalModel
): RuntimeRecord {
  return {
    ...record,
    reconfirmationRequests: [
      {
        requestId,
        targetModel,
        status: 'blocking_open',
        blocking: true,
        sourceRefs: [{ sourceType: 'semantic_drift', id: 'source-document-hash-drift' }],
        requestedAt: '2026-06-01T00:00:00.000Z',
        requestedBy: 'six-model-runtime-bridge-authority-test',
      },
    ],
  };
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hashBytes(value: Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function prepareAwaitingCloseout(
  fixture: RequirementFixture,
  record: RuntimeRecord,
  recordedAt = '2026-06-01T00:00:30.000Z'
) {
  const sourceText = [
    '# Six-model controlled closeout fixture',
    '',
    serializeRequirementsContractImplementationConfirmation({
      contractSchemaVersion: 1,
      status: 'user_confirmed',
      recordId: fixture.recordId,
      requirementSetId: fixture.requirementSetId,
      entryFlow: 'standalone_tasks',
      traceRows: ['TRACE-010', 'TRACE-011', 'TRACE-012'],
    }),
  ].join('\n');
  writeFileSync(fixture.sourcePath, sourceText, 'utf8');
  const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
  const sourceDocumentHash = sourceDocumentHashFor(
    sourceText,
    extracted.blockText,
    extracted.value
  );
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.value);
  const closeoutAttemptId = fixture.runId;
  const closeoutConfirmationPageHash = `sha256:${'c'.repeat(64)}`;
  const deliveryCloseoutReportHash = `sha256:${'d'.repeat(64)}`;
  const confirmationDir = path.join(path.dirname(fixture.recordPath), 'confirmation');
  const reportPath = path.join(confirmationDir, 'closeout-confirmation-current.render-report.json');
  const htmlPath = path.join(confirmationDir, 'closeout-confirmation-current.html');
  const eventLogPath = path.join(
    path.dirname(fixture.recordPath),
    'events',
    'closeout-events.jsonl'
  );
  const artifactIndexPath = path.join(
    path.dirname(fixture.recordPath),
    'closeout-artifact-index.jsonl'
  );
  const report = {
    mode: 'closeout-review',
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
    closeoutConfirmationPageHash,
    deliveryCloseoutReportHash,
    closeoutDeliveryVerdict: {
      currentAttemptId: closeoutAttemptId,
      ready: true,
    },
    finalAcceptanceReview: {
      currentAttemptId: closeoutAttemptId,
      ready: true,
    },
    artifactRef: {
      path: htmlPath,
    },
  };
  writeJson(reportPath, report);
  writeFileSync(htmlPath, '<!doctype html><title>Closeout confirmation</title>\n', 'utf8');

  appendControlEventAndReplay({
    recordPath: fixture.recordPath,
    writerId: 'delivery-closeout-gate-writer',
    eventType: 'delivery_confirmation_user_acceptance_requested',
    recordedAt,
    payload: {
      closeoutAttemptId,
      closeoutConfirmationPageHash,
      deliveryCloseoutReportHash,
      renderReportPath: reportPath,
      htmlPath,
    },
    reduce: () => ({
      ...record,
      status: 'awaiting_user_acceptance',
      currentAttemptId: closeoutAttemptId,
      currentMentalModel: 'delivery_confirmation',
      currentStage: 'delivery_confirmation',
      lastEventType: 'delivery_confirmation_user_acceptance_requested',
      closeout: {
        currentAttemptId: closeoutAttemptId,
        decision: 'pass',
        acceptanceRequest: {
          status: 'awaiting_user_acceptance',
          closeoutAttemptId,
          htmlPath,
          renderReportPath: reportPath,
          closeoutConfirmationPageHash,
          deliveryCloseoutReportHash,
        },
        attempts: [
          {
            eventType: 'closeout_check_recorded',
            closeoutAttemptId,
            decision: 'pass',
            evaluatedAt: recordedAt,
          },
        ],
      },
    }),
  });

  const confirmationText = [
    '确认最终验收并关闭需求',
    `sourceDocumentHash=${sourceDocumentHash}`,
    `implementationConfirmationHash=${implementationConfirmationHash}`,
    `closeoutConfirmationPageHash=${closeoutConfirmationPageHash}`,
    `deliveryCloseoutReportHash=${deliveryCloseoutReportHash}`,
    `closeoutAttemptId=${closeoutAttemptId}`,
  ].join(' ');

  return {
    reportPath,
    eventLogPath,
    artifactIndexPath,
    confirmationText,
    closeoutAttemptId,
  };
}

function confirmFixtureCloseout(
  fixture: RequirementFixture,
  record: RuntimeRecord,
  confirmedAt = '2026-06-01T00:01:00.000Z',
  confirmationTextTransform?: (value: string) => string
) {
  const prepared = prepareAwaitingCloseout(fixture, record);
  const result = runMainAgentConfirmCloseoutAcceptance(fixture.root, {
    source: fixture.sourcePath,
    renderReport: prepared.reportPath,
    confirmationText: confirmationTextTransform
      ? confirmationTextTransform(prepared.confirmationText)
      : prepared.confirmationText,
    confirmedBy: 'six-model-runtime-bridge-authority-test',
    confirmedAt,
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    requirementRecord: fixture.recordPath,
    eventLog: prepared.eventLogPath,
    artifactIndex: prepared.artifactIndexPath,
  });
  return {
    result,
    record: readRequirementRecord(fixture),
    eventLog: readFileSync(prepared.eventLogPath, 'utf8'),
  };
}

function persistResolvedTransition(
  fixture: RequirementFixture,
  fromModel: MentalModel,
  expectedAction: string,
  toModel: MentalModel,
  sequence: number
): RuntimeRecord {
  const record = readRequirementRecord(fixture);
  const decision = resolveFixtureDecision(fixture, record);
  if (
    decision.currentMentalModel !== fromModel ||
    decision.nextAction !== expectedAction ||
    decision.nextMentalModel !== toModel ||
    decision.ready !== true
  ) {
    throw new Error(`unexpected_six_model_transition:${fromModel}:${decision.nextAction}`);
  }
  const recordedAt = `2026-06-01T00:00:0${sequence}.000Z`;
  appendControlEventAndReplay({
    recordPath: fixture.recordPath,
    writerId: 'controlled-six-model-transition-writer',
    eventType: 'mental_model_transition_recorded',
    recordedAt,
    payload: {
      eventType: 'mental_model_transition_recorded',
      recordId: fixture.recordId,
      requirementSetId: fixture.requirementSetId,
      fromModel,
      toModel,
      recordedAt,
      recordedBy: 'six-model-runtime-bridge-authority-test',
      sourceRefs: [{ sourceType: 'six_model_runtime_decision', id: decision.recordHash }],
    },
    reduce: (currentRecord, payload) => {
      if (currentRecord.currentMentalModel !== payload.fromModel) {
        throw new Error('mental_model_transition_from_model_mismatch');
      }
      return {
        ...currentRecord,
        currentMentalModel: payload.toModel,
        currentStage: payload.toModel,
        stage: payload.toModel,
        mentalModelTransitions: [
          ...((currentRecord.mentalModelTransitions as unknown[]) ?? []),
          payload,
        ],
        lastEventType: 'mental_model_transition_recorded',
        updatedAt: recordedAt,
      };
    },
  });
  return readRequirementRecord(fixture);
}

function materializeBridge(stage: 'implement' | 'post_audit') {
  const root = mkdtempSync(path.join(os.tmpdir(), `six-model-runtime-bridge-${stage}-`));
  const configSource = path.join(process.cwd(), '_bmad', '_config');
  const configTarget = path.join(root, '_bmad', '_config');
  mkdirSync(path.dirname(configTarget), { recursive: true });
  cpSync(configSource, configTarget, { recursive: true });

  const contextFile = projectContextPath(root);
  mkdirSync(path.dirname(contextFile), { recursive: true });
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage,
    sourceMode: 'full_bmad',
    contextScope: 'project',
    epicId: 'epic-bridge',
    storyId: `bridge-${stage}`,
    updatedAt: '2026-07-15T00:00:00.000Z',
  });

  const registry = defaultRuntimeContextRegistry(root);
  registry.projectContextPath = path.join('_bmad-output', 'runtime', 'context', 'project.json');
  registry.activeScope = {
    scopeType: 'project',
    resolvedContextPath: registry.projectContextPath,
    reason: 'bridge authority test',
  };
  writeRuntimeContextRegistry(root, registry);

  expect(mainEmitRuntimePolicy(['--cwd', root, '--legacy-registry-bridge'])).toBe(0);
  const indexPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as Record<string, any>;
  const recordPath = path.join(root, String(index.records[0].recordPath).replace(/\//gu, path.sep));
  return {
    root,
    record: JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, any>,
  };
}

describe('requirements contract six-model runtime bridge authority', () => {
  for (const stage of ['implement', 'post_audit'] as const) {
    it(`keeps ${stage} registry state non-authoritative`, () => {
      const fixture = materializeBridge(stage);
      try {
        const projections = Object.values(fixture.record.sixModelResults ?? {}) as Array<
          Record<string, any>
        >;
        expect(projections.length).toBe(6);
        expect(projections.every((projection) => projection.status === 'not_established')).toBe(
          true
        );
        expect(
          projections.every((projection) =>
            projection.blockingReasons?.includes('runtime_registry_bridge_non_authoritative')
          )
        ).toBe(true);
        expect(fixture.record.runtimeStatusDecisionReceipts ?? []).toEqual([]);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }

  describe('architecture lifecycle obligations', () => {
    it('O1 requirement pass enters architecture through enter_architecture_confirmation', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'requirement_confirmation',
          sixModelResults: {
            requirement_confirmation: { status: 'pass' },
          },
        },
        (fixture, record) => {
          const decision = resolveFixtureDecision(fixture, record);

          expect(decision).toMatchObject({
            currentMentalModel: 'requirement_confirmation',
            currentModelStatus: 'pass',
            nextAction: 'enter_architecture_confirmation',
            ready: true,
            nextMentalModel: 'architecture_confirmation',
            transitionMode: 'auto_after_controlled_ingest',
          });
        }
      );
    });

    it('O2 architecture open reconfirmation fails closed before the next model', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'architecture_confirmation',
          sixModelResults: {
            requirement_confirmation: { status: 'pass' },
            architecture_confirmation: { status: 'pass' },
          },
        },
        (fixture, record) => {
          const requestId = 'reconfirm-architecture-open';
          const decision = resolveFixtureDecision(
            fixture,
            withOpenReconfirmation(record, requestId, 'architecture_confirmation')
          );

          expect(decision).toMatchObject({
            currentMentalModel: 'architecture_confirmation',
            currentModelStatus: 'pass',
            nextAction: 'run_pre_confirmation_drilldown',
            ready: false,
            nextMentalModel: null,
            allowedDispatchTaskType: null,
            transitionMode: 'blocked',
          });
          expect(decision.blockingReasonRefs).toContainEqual({
            sourceType: 'reconfirmation_request',
            id: requestId,
          });
        }
      );
    });

    it('O3 architecture receipt from another attempt is detected as stale before readiness', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'architecture_confirmation',
          sixModelResults: {
            requirement_confirmation: { status: 'pass' },
            architecture_confirmation: { status: 'pass' },
          },
        },
        (fixture, record) => {
          const nextAttemptId = `${fixture.runId}-next`;
          const receipts = record.runtimeStatusDecisionReceipts as Array<{
            path: string;
            receipt: unknown;
          }>;
          const verified = resolveVerifiedSixModelStatus({
            record,
            modelId: 'architecture_confirmation',
            currentImplementationAttemptId: nextAttemptId,
            decisionReceipts: receipts,
          });
          const decision = resolveSixModelRuntimeDecision({
            record,
            attemptId: nextAttemptId,
            statusDecisionReceipts: receipts,
          });

          expect(verified.projectionIntegrity).toBe('stale');
          expect(verified.effectiveStatus).toBe('stale');
          expect(decision.currentMentalModel).toBe('architecture_confirmation');
          expect(decision.currentModelStatus).toBe('stale');
          expect(decision.nextAction).toBe('prepare_architecture_confirmation');
          expect(decision.ready).toBe(false);
          expect(decision.nextMentalModel).toBeNull();
          expect(decision.allowedDispatchTaskType).toBeNull();
          expect(decision.transitionMode).toBe('blocked');
          expect(decision.nextAction).not.toBe('run_implementation_readiness_gate');
        }
      );
    });
  });

  describe('model applicability matrix obligations', () => {
    it('O4-O7 routes four applicable models through their production decisions', () => {
      const scenarios: Array<{
        model: MentalModel;
        expectedAction: string;
        expectedReady: boolean;
      }> = [
        {
          model: 'requirement_confirmation',
          expectedAction: 'enter_architecture_confirmation',
          expectedReady: true,
        },
        {
          model: 'implementation_readiness',
          expectedAction: 'dispatch_implement',
          expectedReady: true,
        },
        {
          model: 'audit_review',
          expectedAction: 'run_closeout',
          expectedReady: true,
        },
        {
          model: 'delivery_confirmation',
          expectedAction: 'run_closeout',
          expectedReady: true,
        },
      ];

      for (const scenario of scenarios) {
        withRequirementFixture(
          {
            currentMentalModel: scenario.model,
            sixModelResults: ALL_MODEL_PASSES,
          },
          (fixture, record) => {
            const decision = resolveFixtureDecision(fixture, record);

            expect(decision.currentMentalModel).toBe(scenario.model);
            expect(decision.currentModelStatus).toBe('pass');
            expect(decision.nextAction).toBe(scenario.expectedAction);
            expect(decision.ready).toBe(scenario.expectedReady);
          }
        );
      }
    });
  });

  describe('open reconfirmation chain obligations', () => {
    it('O8 execution_closure reconfirmation blocks audit_review', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'execution_closure',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, record) => {
          const requestId = 'reconfirm-execution-closure-open';
          const decision = resolveFixtureDecision(
            fixture,
            withOpenReconfirmation(record, requestId, 'execution_closure')
          );

          expect(decision.nextAction).toBe('run_pre_confirmation_drilldown');
          expect(decision.nextAction).not.toBe('dispatch_review');
          expect(decision.ready).toBe(false);
          expect(decision.blockingReasonRefs).toContainEqual({
            sourceType: 'reconfirmation_request',
            id: requestId,
          });
        }
      );
    });

    it('O9 audit_review reconfirmation blocks delivery_confirmation', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'audit_review',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, record) => {
          const requestId = 'reconfirm-audit-review-open';
          const decision = resolveFixtureDecision(
            fixture,
            withOpenReconfirmation(record, requestId, 'audit_review')
          );

          expect(decision.nextAction).toBe('run_pre_confirmation_drilldown');
          expect(decision.nextAction).not.toBe('run_closeout');
          expect(decision.ready).toBe(false);
          expect(decision.blockingReasonRefs).toContainEqual({
            sourceType: 'reconfirmation_request',
            id: requestId,
          });
        }
      );
    });

    it('O10 delivery_confirmation reconfirmation blocks controlled closeout', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'delivery_confirmation',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, record) => {
          const requestId = 'reconfirm-delivery-confirmation-open';
          const decision = resolveFixtureDecision(
            fixture,
            withOpenReconfirmation(record, requestId, 'delivery_confirmation')
          );

          expect(decision.nextAction).toBe('run_pre_confirmation_drilldown');
          expect(decision.nextAction).not.toBe('run_closeout');
          expect(decision.ready).toBe(false);
          expect(decision.blockingReasonRefs).toContainEqual({
            sourceType: 'reconfirmation_request',
            id: requestId,
          });
        }
      );
    });
  });

  describe('controlled delivery closure obligation', () => {
    it('O11 confirm-closeout-acceptance writes record_closed and its event evidence', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'delivery_confirmation',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, record) => {
          const closeout = confirmFixtureCloseout(fixture, record);

          expect(closeout.result.ok).toBe(true);
          expect(closeout.record).toMatchObject({
            status: 'closed',
            lastEventType: 'record_closed',
            currentMentalModel: 'delivery_confirmation',
          });
          expect(closeout.eventLog).toContain('"eventType":"closeout_acceptance_confirmed"');
          expect(closeout.eventLog).toContain('"machineCloseoutEventType":"record_closed"');
          expect(hasCurrentControlledCloseoutAcceptance(closeout.record)).toBe(true);
          expect(resolveFixtureDecision(fixture, closeout.record)).toMatchObject({
            currentMentalModel: 'delivery_confirmation',
            nextAction: 'record_closed',
            ready: true,
            nextMentalModel: 'closed',
            allowedDispatchTaskType: 'closeout',
            transitionMode: 'auto_after_controlled_ingest',
          });
        }
      );
    });

    it('O11b controlled Goal acceptance persists exact TaskReport bytes and a completion receipt', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'delivery_confirmation',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, record) => {
          const candidatePath = path.join(fixture.root, 'closeout', 'task-report-candidate.json');
          const finalTaskReportPath = path.join(fixture.root, 'closeout', 'task-report.json');
          const completionReceiptPath = path.join(
            fixture.root,
            'closeout',
            'completion-receipt.json'
          );
          const candidateBytes = Buffer.from('{"z":1,"a":2}\n', 'utf8');
          mkdirSync(path.dirname(candidatePath), { recursive: true });
          writeFileSync(candidatePath, candidateBytes);
          const controlledRecord = {
            ...record,
            nativeGoalHandoff: {
              schemaVersion: 'native-goal-handoff/v1',
              controlledCloseoutIngested: true,
              closeoutAttemptId: fixture.runId,
              taskReportCandidatePath: candidatePath,
              taskReportArtifactHash: hashBytes(candidateBytes),
              taskReportPath: finalTaskReportPath,
              completionReceiptPath,
              controlledCloseout: {
                schemaVersion: 'main-agent-controlled-closeout-handoff/v1',
                closeoutAttemptId: fixture.runId,
                contextHash: `sha256:${'1'.repeat(64)}`,
                compileReceiptHash: `sha256:${'2'.repeat(64)}`,
                childClosureSetHash: `sha256:${'3'.repeat(64)}`,
                campaignReportHash: `sha256:${'4'.repeat(64)}`,
                closureReceiptHash: `sha256:${'5'.repeat(64)}`,
                executionFinalJudgeCampaignHash: `sha256:${'6'.repeat(64)}`,
                effectivePassReceiptHash: `sha256:${'7'.repeat(64)}`,
                deliveryCloseoutGateReceiptHash: `sha256:${'8'.repeat(64)}`,
              },
            },
          };

          const closeout = confirmFixtureCloseout(fixture, controlledRecord);
          const completion = JSON.parse(readFileSync(completionReceiptPath, 'utf8'));

          expect(closeout.result.ok).toBe(true);
          expect(readFileSync(finalTaskReportPath)).toEqual(candidateBytes);
          expect(completion).toMatchObject({
            schemaVersion: 'main-agent-goal-completion-receipt/v1',
            status: 'done',
            closeoutAttemptId: fixture.runId,
            taskReportArtifactHash: hashBytes(candidateBytes),
          });
          expect(closeout.record).toMatchObject({
            status: 'done',
            lastEventType: 'native_goal_completion_recorded',
            controlledGoalCompletion: {
              path: completionReceiptPath,
              completionReceiptHash: completion.completionReceiptHash,
            },
          });
        }
      );
    });

    it('O11c controlled Goal rejection writes no final TaskReport or completion receipt', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'delivery_confirmation',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, record) => {
          const candidatePath = path.join(fixture.root, 'reject-closeout', 'candidate.json');
          const finalTaskReportPath = path.join(fixture.root, 'reject-closeout', 'task-report.json');
          const completionReceiptPath = path.join(
            fixture.root,
            'reject-closeout',
            'completion-receipt.json'
          );
          const candidateBytes = Buffer.from('{"status":"done"}\n', 'utf8');
          mkdirSync(path.dirname(candidatePath), { recursive: true });
          writeFileSync(candidatePath, candidateBytes);
          const controlledRecord = {
            ...record,
            nativeGoalHandoff: {
              controlledCloseoutIngested: true,
              closeoutAttemptId: fixture.runId,
              taskReportCandidatePath: candidatePath,
              taskReportArtifactHash: hashBytes(candidateBytes),
              taskReportPath: finalTaskReportPath,
              completionReceiptPath,
              controlledCloseout: {
                closeoutAttemptId: fixture.runId,
                contextHash: `sha256:${'1'.repeat(64)}`,
                compileReceiptHash: `sha256:${'2'.repeat(64)}`,
                childClosureSetHash: `sha256:${'3'.repeat(64)}`,
                campaignReportHash: `sha256:${'4'.repeat(64)}`,
                closureReceiptHash: `sha256:${'5'.repeat(64)}`,
                executionFinalJudgeCampaignHash: `sha256:${'6'.repeat(64)}`,
                effectivePassReceiptHash: `sha256:${'7'.repeat(64)}`,
                deliveryCloseoutGateReceiptHash: `sha256:${'8'.repeat(64)}`,
              },
            },
          };

          const closeout = confirmFixtureCloseout(
            fixture,
            controlledRecord,
            '2026-06-01T00:02:00.000Z',
            (value) =>
              value.replace('确认最终验收并关闭需求', '拒绝最终验收并保持需求阻塞')
          );

          expect(closeout.result.ok).toBe(true);
          expect(closeout.record.closeoutAcceptance).toMatchObject({
            status: 'user_rejected_closeout',
            closeoutAttemptId: fixture.runId,
          });
          expect(readFileSync(candidatePath)).toEqual(candidateBytes);
          expect(() => readFileSync(finalTaskReportPath)).toThrow();
          expect(() => readFileSync(completionReceiptPath)).toThrow();
        }
      );
    });
  });

  describe('complete governed journey obligation', () => {
    it('O12 resolver-guided synthetic transitions reach controlled record_closed', () => {
      withRequirementFixture(
        {
          currentMentalModel: 'requirement_confirmation',
          sixModelResults: ALL_MODEL_PASSES,
        },
        (fixture, _record) => {
          const ingress = runUnifiedIngress({
            projectRoot: fixture.root,
            recordId: fixture.recordId,
            requirementSetId: fixture.requirementSetId,
            hostKind: 'claude',
            flow: 'standalone_tasks',
            stage: 'implement',
            forceNoHooks: true,
          });

          expect(ingress).toMatchObject({
            recordId: fixture.recordId,
            requirementSetId: fixture.requirementSetId,
            controlPlane: 'main-agent-orchestration',
            sameControlPlane: true,
          });

          persistResolvedTransition(
            fixture,
            'requirement_confirmation',
            'enter_architecture_confirmation',
            'architecture_confirmation',
            1
          );
          persistResolvedTransition(
            fixture,
            'architecture_confirmation',
            'run_implementation_readiness_gate',
            'implementation_readiness',
            2
          );
          persistResolvedTransition(
            fixture,
            'implementation_readiness',
            'dispatch_implement',
            'execution_closure',
            3
          );
          persistResolvedTransition(
            fixture,
            'execution_closure',
            'dispatch_review',
            'audit_review',
            4
          );
          const deliveryRecord = persistResolvedTransition(
            fixture,
            'audit_review',
            'run_closeout',
            'delivery_confirmation',
            5
          );
          const closeout = confirmFixtureCloseout(fixture, deliveryRecord);
          const transitions = closeout.record.mentalModelTransitions as Array<{
            fromModel: string;
            toModel: string;
          }>;

          expect(transitions.map(({ fromModel, toModel }) => `${fromModel}->${toModel}`)).toEqual([
            'requirement_confirmation->architecture_confirmation',
            'architecture_confirmation->implementation_readiness',
            'implementation_readiness->execution_closure',
            'execution_closure->audit_review',
            'audit_review->delivery_confirmation',
          ]);
          expect(closeout.record).toMatchObject({
            recordId: fixture.recordId,
            requirementSetId: fixture.requirementSetId,
            currentAttemptId: fixture.runId,
            status: 'closed',
            currentMentalModel: 'delivery_confirmation',
            lastEventType: 'record_closed',
          });
          expect(resolveFixtureDecision(fixture, closeout.record).nextMentalModel).toBe('closed');
        }
      );
    });
  });
});
