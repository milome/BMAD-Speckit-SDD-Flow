import { describe, expect, it } from 'vitest';
import {
  evaluateRequirementsAuthoringLimits,
  REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-authoring-limits';

describe('requirements authoring capacity limits', () => {
  it('limits source, nodes, spans, projections and Judge payload with exact issue codes', () => {
    const result = evaluateRequirementsAuthoringLimits(
      { sourceBytes: 11, semanticNodeCount: 3, sourceSpanCount: 4, projectionCount: 5, judgePayloadBytes: 6, judgeTokenEstimate: 7 },
      { maxSourceBytes: 10, maxSemanticNodes: 2, maxSourceSpans: 3, maxProjections: 4, maxJudgePayloadBytes: 5, maxJudgeTokens: 6 }
    );
    expect(result.issueCodes).toEqual(REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES);
    expect(result.decision).toBe('block');
  });

  it('does not expose storage retention or GC as authoring limits', () => {
    expect(Object.keys(REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES).join(' ')).not.toMatch(/gc|retention|delete|storage_count/iu);
  });
});
