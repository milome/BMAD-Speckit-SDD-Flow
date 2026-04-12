import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { collectReviewerProjectionDiagnosis } from '../../scripts/diagnose-bmad-state';
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
      });

      const diagnosis = collectReviewerProjectionDiagnosis(root);

      expect(diagnosis.reviewerContract).toMatchObject({
        version: 'reviewer_contract_projection_v1',
        reviewerIdentity: 'bmad_code_reviewer',
        registryVersion: 'reviewer_registry_v1',
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
          '   active consumer: plan -> plan_audit -> auditor-plan -> runAuditorHost',
          '   cursor route: preferred=cursor-task/code-reviewer fallback=mcp_task/generalPurpose',
          '   claude route: preferred=Agent/code-reviewer fallback=Agent/general-purpose',
        ])
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
