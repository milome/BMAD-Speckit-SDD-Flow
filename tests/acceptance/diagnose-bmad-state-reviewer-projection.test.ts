import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import {
  collectReadinessProjectionDiagnosis,
  collectReviewerProjectionDiagnosis,
} from '../../scripts/diagnose-bmad-state';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

describe('diagnose-bmad-state reviewer projection', () => {
  it('explains the active reviewer consumer and cross-host routes from registry-backed runtime context', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnose-reviewer-projection-'));
    try {
      fs.cpSync(path.join(process.cwd(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
      writeMinimalRegistryAndProjectContext(root, {
        flow: 'story',
        stage: 'plan',
        epicId: 'epic-15',
        storyId: '15-1-runtime-dashboard-sft',
        latestReviewerCloseout: {
          updatedAt: '2026-04-13T12:00:00.000Z',
          runner: 'runAuditorHost',
          profile: 'plan_audit',
          stage: 'plan',
          artifactPath: 'specs/epic-15/story-1/plan.md',
          reportPath: 'specs/epic-15/story-1/plan.audit.md',
          auditStatus: 'PASS',
          closeoutApproved: false,
          governanceClosure: {
            implementationReadinessStatusRequired: true,
            implementationReadinessGateName: 'implementation-readiness',
            gatesLoopRequired: true,
            rerunGatesRequired: true,
            packetExecutionClosureRequired: true,
          },
          closeoutEnvelope: {
            resultCode: 'required_fixes',
            requiredFixes: ['Need re-readiness rerun'],
            requiredFixesDetail: [
              { id: 'rf-1', summary: 'Need re-readiness rerun', severity: 'required' },
            ],
            rerunDecision: 'rerun_required',
            scoringFailureMode: 'succeeded',
            packetExecutionClosureStatus: 'awaiting_rerun_gate',
          },
        },
      });

      const diagnosis = collectReviewerProjectionDiagnosis(root);

      expect(diagnosis.reviewerContract).toMatchObject({
        version: 'reviewer_contract_projection_v1',
        reviewerIdentity: 'bmad_code_reviewer',
        registryVersion: 'reviewer_registry_v1',
        sharedCore: {
          version: 'reviewer_shared_core_v1',
          rootPath: '_bmad/core/agents/code-reviewer',
        },
        activeAuditConsumer: {
          entryStage: 'plan',
          profile: 'plan_audit',
          auditorScript: 'auditor-plan',
        },
      });
      expect(diagnosis.lines).toEqual(
        expect.arrayContaining([
          '【诊断项 4】Reviewer Projection:',
          '✅ reviewer contract: bmad_code_reviewer (reviewer_contract_projection_v1)',
          '   shared core: _bmad/core/agents/code-reviewer [reviewer_shared_core_v1]',
          '   active consumer: plan -> plan_audit -> auditor-plan -> runAuditorHost',
          '   cursor carrier: _bmad/cursor/agents/code-reviewer.md -> .cursor/agents/code-reviewer.md',
          '   cursor route: preferred=cursor-task/code-reviewer fallback=mcp_task/generalPurpose',
          '   claude carrier: _bmad/claude/agents/code-reviewer.md -> .claude/agents/code-reviewer.md',
          '   claude route: preferred=Agent/code-reviewer fallback=Agent/general-purpose',
          '   latest closeout: required_fixes / awaiting_rerun_gate / approved=no',
        ])
      );

      const readinessDiagnosis = collectReadinessProjectionDiagnosis(root);
      expect(readinessDiagnosis.lines).toEqual(
        expect.arrayContaining([
          '【诊断项 5】Readiness Projection:',
          '✅ readiness baseline run: (none)',
          '   effective verdict: unknown',
          '   drift severity: none',
        ])
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
