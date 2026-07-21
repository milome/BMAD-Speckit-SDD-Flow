import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  ingestMainAgentTaskReport,
  resolveMainAgentOrchestrationSurface,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { resolveSixModelRuntimeDecision } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/six-model-runtime-decision';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
} from '../helpers/requirement-fixture-runtime';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('Six mental model decision matrix', () => {
  it('forces execution_closure gate after TaskReport.done and rejects stale nextAction authority', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'implementation_readiness',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
      },
      orchestrationNextAction: 'dispatch_review',
      pendingPacket: {
        packetId: 'implement-current',
        packetKind: 'execution',
        status: 'completed',
      },
      lastTaskReport: {
        packetId: 'implement-current',
        status: 'done',
      },
    });
    try {
      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        requirementSetId: fixture.requirementSetId,
        runId: fixture.runId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(surface.mainAgentNextAction).toBe('run_execution_closure_gate');
      expect(surface.sixModelRuntimeDecision?.nextAction).toBe('run_execution_closure_gate');
      expect(surface.sixModelRuntimeDecision?.allowedDispatchTaskType).toBeNull();
      expect(surface.splitBrainBlockerPath).toBeTruthy();
      const blocker = readJson<{
        blockerId: string;
        orchestrationStateNextAction: string;
        matrixNextAction: string;
      }>(surface.splitBrainBlockerPath!);
      expect(blocker).toMatchObject({
        blockerId: 'split_brain_orchestration_state_next_action',
        orchestrationStateNextAction: 'dispatch_review',
        matrixNextAction: 'run_execution_closure_gate',
      });
      expect(
        buildMainAgentDispatchInstruction({
          projectRoot: fixture.root,
          recordId: fixture.recordId,
          requirementSetId: fixture.requirementSetId,
          runId: fixture.runId,
          flow: 'standalone_tasks',
          stage: 'implement',
        })
      ).toBeNull();

      const state = ingestMainAgentTaskReport(fixture.root, fixture.requirementSetId, {
        packetId: 'implement-current',
        status: 'done',
        filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'],
        validationsRun: ['vitest'],
        evidence: ['task-report.json'],
        downstreamContext: ['implementation iteration complete'],
      });
      expect(state.nextAction).toBe('run_execution_closure_gate');
      const matrixPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'decision-matrix',
        'implement-current',
        'six-model-runtime-decision.json'
      );
      expect(fs.existsSync(matrixPath)).toBe(true);
      const matrix = readJson<{ nextAction: string }>(matrixPath);
      expect(matrix.nextAction).toBe('run_execution_closure_gate');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('treats a closed record as terminal instead of reopening pre-confirmation flow', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'delivery_confirmation',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
        audit_review: { status: 'pass' },
        delivery_confirmation: { status: 'pass' },
      },
    });
    try {
      const record = readJson<
        Record<string, unknown> & {
          status: string;
          currentMentalModel?: string;
          currentStage?: string;
        }
      >(fixture.recordPath);
      const closeoutAttemptId = 'closeout-current';
      const closeoutConfirmationPageHash = `sha256:${'c'.repeat(64)}`;
      const deliveryCloseoutReportHash = `sha256:${'d'.repeat(64)}`;
      const acceptedAt = '2026-05-30T00:02:00.000Z';
      const acceptedBy = 'test-user';
      record.status = 'closed';
      record.currentAttemptId = closeoutAttemptId;
      record.currentMentalModel = 'delivery_confirmation';
      record.currentStage = 'delivery_confirmation';
      record.lastEventType = 'record_closed';
      record.lastAppliedEventId = `record_closed:${closeoutAttemptId}`;
      record.closeout = {
        currentAttemptId: closeoutAttemptId,
        decision: 'pass',
        acceptanceRequest: {
          status: 'user_accepted_closeout',
          closeoutAttemptId,
          htmlPath: 'confirmation/closeout-confirmation-current.html',
          renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
          closeoutConfirmationPageHash,
          deliveryCloseoutReportHash,
          acceptedAt,
          acceptedBy,
        },
        attempts: [
          {
            eventType: 'closeout_check_recorded',
            closeoutAttemptId,
            decision: 'pass',
          },
        ],
      };
      record.closeoutAcceptance = {
        status: 'user_accepted_closeout',
        confirmedAt: acceptedAt,
        confirmedBy: acceptedBy,
        closeoutAttemptId,
        closeoutConfirmationPageHash,
        deliveryCloseoutReportHash,
        renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
      };
      record.closeoutAcceptanceHistory = [
        {
          eventType: 'closeout_acceptance_confirmed',
          recordId: fixture.recordId,
          requirementSetId: fixture.requirementSetId,
          sourceDocumentHash: record.sourceDocumentHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
          confirmedAt: acceptedAt,
          confirmedBy: acceptedBy,
          closeoutAttemptId,
          closeoutConfirmationPageHash,
          deliveryCloseoutReportHash,
          renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
          htmlPath: 'confirmation/closeout-confirmation-current.html',
          machineCloseoutEventType: 'record_closed',
          beforeRecordHash: `sha256:${'a'.repeat(64)}`,
          afterRecordHash: `sha256:${'b'.repeat(64)}`,
        },
      ];
      fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const matrix = resolveSixModelRuntimeDecision({
        record: readJson(fixture.recordPath),
        attemptId: fixture.runId,
      });
      expect(matrix.nextAction).toBe('record_closed');
      expect(matrix.ready).toBe(true);
      expect(matrix.transitionMode).toBe('auto_after_controlled_ingest');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('does not treat delivery machine pass as terminal before controlled user acceptance', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'delivery_confirmation',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
        audit_review: { status: 'pass' },
        delivery_confirmation: { status: 'awaiting_user_acceptance' },
      },
    });
    try {
      const record = readJson<Record<string, any>>(fixture.recordPath);
      record.status = 'awaiting_user_acceptance';
      record.currentMentalModel = 'delivery_confirmation';
      record.currentStage = 'delivery_confirmation';
      record.lastEventType = 'delivery_confirmation_user_acceptance_requested';
      record.closeout = {
        currentAttemptId: 'closeout-awaiting-user',
        decision: 'pass',
        acceptanceRequest: {
          status: 'awaiting_user_acceptance',
          closeoutAttemptId: 'closeout-awaiting-user',
          htmlPath: 'confirmation/closeout-confirmation-current.html',
          renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
          closeoutConfirmationPageHash: `sha256:${'c'.repeat(64)}`,
          deliveryCloseoutReportHash: `sha256:${'d'.repeat(64)}`,
        },
        attempts: [
          {
            eventType: 'closeout_check_recorded',
            closeoutAttemptId: 'closeout-awaiting-user',
            decision: 'pass',
          },
        ],
      };

      const matrix = resolveSixModelRuntimeDecision({
        record,
        attemptId: fixture.runId,
      });

      expect(matrix.nextAction).toBe('await_user_acceptance');
      expect(matrix.ready).toBe(false);
      expect(matrix.transitionMode).toBe('requires_user_or_gate');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects a machine-authored delivery pass without controlled closeout acceptance', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'delivery_confirmation',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
        audit_review: { status: 'pass' },
        delivery_confirmation: { status: 'pass' },
      },
    });
    try {
      const record = readJson<Record<string, any>>(fixture.recordPath);
      record.status = 'user_confirmed';
      record.currentMentalModel = 'delivery_confirmation';
      record.currentStage = 'delivery_confirmation';
      record.lastEventType = 'delivery_confirmation_result_recorded';
      record.closeout = {
        currentAttemptId: fixture.runId,
        decision: 'pass',
        attempts: [
          {
            eventType: 'closeout_check_recorded',
            closeoutAttemptId: fixture.runId,
            decision: 'pass',
          },
        ],
      };

      const matrix = resolveSixModelRuntimeDecision({
        record,
        attemptId: fixture.runId,
      });

      expect(matrix.nextAction).toBe('run_closeout');
      expect(matrix.nextAction).not.toBe('record_closed');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('does not treat a controlled closeout as terminal after a newer execution attempt', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'delivery_confirmation',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
        audit_review: { status: 'pass' },
        delivery_confirmation: { status: 'pass' },
      },
    });
    try {
      const record = readJson<Record<string, any>>(fixture.recordPath);
      const closeoutAttemptId = 'closeout-current';
      const acceptedAt = '2026-05-30T00:02:00.000Z';
      const pageHash = `sha256:${'c'.repeat(64)}`;
      const reportHash = `sha256:${'d'.repeat(64)}`;
      record.status = 'closed';
      record.currentAttemptId = closeoutAttemptId;
      record.currentMentalModel = 'delivery_confirmation';
      record.currentStage = 'delivery_confirmation';
      record.lastEventType = 'record_closed';
      record.lastAppliedEventId = `record_closed:${closeoutAttemptId}`;
      record.closeout = {
        currentAttemptId: closeoutAttemptId,
        decision: 'pass',
        acceptanceRequest: {
          status: 'user_accepted_closeout',
          closeoutAttemptId,
          htmlPath: 'confirmation/closeout-confirmation-current.html',
          renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
          closeoutConfirmationPageHash: pageHash,
          deliveryCloseoutReportHash: reportHash,
          acceptedAt,
          acceptedBy: 'test-user',
        },
        attempts: [
          {
            eventType: 'closeout_check_recorded',
            closeoutAttemptId,
            decision: 'pass',
            evaluatedAt: acceptedAt,
          },
        ],
      };
      record.closeoutAcceptance = {
        status: 'user_accepted_closeout',
        confirmedAt: acceptedAt,
        confirmedBy: 'test-user',
        closeoutAttemptId,
        closeoutConfirmationPageHash: pageHash,
        deliveryCloseoutReportHash: reportHash,
        renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
      };
      record.closeoutAcceptanceHistory = [
        {
          eventType: 'closeout_acceptance_confirmed',
          recordId: fixture.recordId,
          requirementSetId: fixture.requirementSetId,
          sourceDocumentHash: record.sourceDocumentHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
          confirmedAt: acceptedAt,
          confirmedBy: 'test-user',
          closeoutAttemptId,
          closeoutConfirmationPageHash: pageHash,
          deliveryCloseoutReportHash: reportHash,
          renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
          htmlPath: 'confirmation/closeout-confirmation-current.html',
          machineCloseoutEventType: 'record_closed',
          beforeRecordHash: `sha256:${'a'.repeat(64)}`,
          afterRecordHash: `sha256:${'b'.repeat(64)}`,
        },
      ];
      record.executionIterations = [
        {
          eventType: 'execution_iteration_recorded',
          attemptId: 'implementation-newer',
          recordedAt: '2026-05-30T00:03:00.000Z',
        },
      ];

      const matrix = resolveSixModelRuntimeDecision({
        record,
        attemptId: fixture.runId,
      });

      expect(matrix.nextAction).toBe('run_closeout');
      expect(matrix.ready).toBe(false);
      expect(matrix.transitionMode).toBe('blocked');
      expect(matrix.blockingReasonRefs).toContainEqual({
        sourceType: 'closeout_acceptance',
        id: 'terminal_closeout_stale_or_invalid',
      });
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
