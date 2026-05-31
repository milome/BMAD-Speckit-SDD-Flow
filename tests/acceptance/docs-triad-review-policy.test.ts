import { describe, expect, it } from 'vitest';
import { createAuditTriadExecutionPlan } from '../../scripts/audit-triad-orchestrator';
import { stageProfileForCallPoint } from '../../scripts/critical-auditor-profile';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
} from '../helpers/requirement-fixture-runtime';

describe('Docs triad review policy', () => {
  it('maps docs-review and grill-with-docs call points to requirements_compiler stage profile', () => {
    const fixture = materializeRequirementFixture();
    try {
      expect(stageProfileForCallPoint('docs_review')).toBe('requirements_compiler');
      expect(stageProfileForCallPoint('grill_with_docs')).toBe('requirements_compiler');
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'docs_review',
        attemptId: 'docs-audit',
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
      });
      expect(plan.stageProfileId).toBe('requirements_compiler');
      expect(plan.subagents).toHaveLength(3);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
