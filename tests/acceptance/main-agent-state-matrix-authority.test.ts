import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
} from '../../scripts/main-agent-orchestration';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

describe('Main Agent state matrix authority', () => {
  it('dispatches audit only after execution_closure pass and closeout only after audit_review pass', () => {
    const auditFixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      writeCompiledImplementPacket({ root: auditFixture.root, fixture: auditFixture });
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: auditFixture.root,
        recordId: auditFixture.recordId,
        requirementSetId: auditFixture.requirementSetId,
        runId: auditFixture.runId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        hydratePacket: true,
        preferredPacketId: 'audit-current',
      });
      expect(instruction?.taskType).toBe('audit');

      const closeoutFixture = materializeRequirementFixture({
        currentMentalModel: 'audit_review',
        sixModelResults: {
          requirement_confirmation: { status: 'pass' },
          architecture_confirmation: { status: 'pass' },
          implementation_readiness: { status: 'pass' },
          execution_closure: { status: 'pass' },
          audit_review: { status: 'pass' },
        },
      });
      try {
        const closeoutSurface = resolveMainAgentOrchestrationSurface({
          projectRoot: closeoutFixture.root,
          recordId: closeoutFixture.recordId,
          requirementSetId: closeoutFixture.requirementSetId,
          runId: closeoutFixture.runId,
          flow: 'standalone_tasks',
          stage: 'implement',
        });
        expect(closeoutSurface.mainAgentNextAction).toBe('run_closeout');
        expect(
          buildMainAgentDispatchInstruction({
            projectRoot: closeoutFixture.root,
            recordId: closeoutFixture.recordId,
            requirementSetId: closeoutFixture.requirementSetId,
            runId: closeoutFixture.runId,
            flow: 'standalone_tasks',
            stage: 'implement',
          })
        ).toBeNull();
      } finally {
        cleanupRequirementWorkspace(closeoutFixture.root);
      }

      const blockedLoopFixture = materializeRequirementFixture({
        currentMentalModel: 'implementation_readiness',
        sixModelResults: {
          requirement_confirmation: { status: 'pass' },
          architecture_confirmation: { status: 'pass' },
          implementation_readiness: { status: 'pass' },
        },
      });
      try {
        const result = runMainAgentAutomaticLoop({
          projectRoot: blockedLoopFixture.root,
          recordId: blockedLoopFixture.recordId,
          requirementSetId: blockedLoopFixture.requirementSetId,
          runId: blockedLoopFixture.runId,
          flow: 'standalone_tasks',
          stage: 'implement',
        });
        expect(result.status).toBe('blocked');
        expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
        const matrixDir = path.join(
          blockedLoopFixture.root,
          '_bmad-output',
          'runtime',
          'requirement-records',
          blockedLoopFixture.recordId,
          'decision-matrix'
        );
        expect(fs.existsSync(matrixDir)).toBe(true);
      } finally {
        cleanupRequirementWorkspace(blockedLoopFixture.root);
      }
    } finally {
      cleanupRequirementWorkspace(auditFixture.root);
    }
  });
});
