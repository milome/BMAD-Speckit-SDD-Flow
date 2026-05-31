import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  ingestMainAgentTaskReport,
  resolveMainAgentOrchestrationSurface,
} from '../../scripts/main-agent-orchestration';
import { resolveSixModelRuntimeDecision } from '../../scripts/six-model-runtime-decision';
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
        filesChanged: ['scripts/main-agent-orchestration.ts'],
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
      record.status = 'closed';
      record.currentMentalModel = 'delivery_confirmation';
      record.currentStage = 'delivery_confirmation';
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
});
