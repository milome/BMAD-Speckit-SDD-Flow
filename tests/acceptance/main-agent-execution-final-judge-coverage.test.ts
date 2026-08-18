import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { mergeMainAgentExecutionFinalJudgeCampaign } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';

const HASH = `sha256:${'1'.repeat(64)}`;

const COVERAGE_PAIRS = [
  ['requiredDimensionIds', 'coveredDimensionIds'],
  ['requiredArtifactIds', 'coveredArtifactIds'],
  ['requiredObligationIds', 'coveredObligationIds'],
  ['requiredExecutionResultIds', 'coveredExecutionResultIds'],
  ['requiredCommandIds', 'coveredCommandIds'],
  ['requiredEvidenceIds', 'coveredEvidenceIds'],
  ['requiredDeliveryClaimIds', 'coveredDeliveryClaimIds'],
] as const;

function executionFinalCandidate() {
  return {
    schemaVersion: 'ExecutionFinalCandidate/v1',
    profile: 'standalone',
    requiredDimensionIds: ['execution_closure', 'delivery_confirmation'],
    requiredArtifactIds: ['ART-001', 'ART-002'],
    requiredObligationIds: ['OBL-001', 'OBL-002'],
    requiredExecutionResultIds: ['RESULT-001', 'RESULT-002'],
    requiredCommandIds: ['CMD-001', 'CMD-002'],
    requiredEvidenceIds: ['EVD-001', 'EVD-002'],
    requiredDeliveryClaimIds: ['CLAIM-001', 'CLAIM-002'],
  };
}

function cleanReviewer() {
  return {
    sourceLedgerHash: HASH,
    terminalOutcome: 'clean' as const,
    findingIds: [],
  };
}

function coveringFinalJudge() {
  return {
    sourceLedgerHash: HASH,
    auditDecision: 'pass' as const,
    verdict: 'coverage_satisfied' as const,
    findingIds: [],
    coveredDimensionIds: ['delivery_confirmation', 'execution_closure'],
    coveredArtifactIds: ['ART-002', 'ART-001'],
    coveredObligationIds: ['OBL-002', 'OBL-001'],
    coveredExecutionResultIds: ['RESULT-002', 'RESULT-001'],
    coveredCommandIds: ['CMD-002', 'CMD-001'],
    coveredEvidenceIds: ['EVD-002', 'EVD-001'],
    coveredDeliveryClaimIds: ['CLAIM-002', 'CLAIM-001'],
    findings: [],
  };
}

describe('Execution Final Judge coverage', () => {
  it('ships the closed Judge result schema with all seven covered sets', () => {
    const schemaPath = path.join(
      process.cwd(),
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-execution-final-judge-result.schema.json'
    );
    expect(fs.existsSync(schemaPath)).toBe(true);
    if (!fs.existsSync(schemaPath)) return;
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, any>;
    expect(schema).toMatchObject({
      title: 'Execution Final Judge Result',
      type: 'object',
      additionalProperties: false,
    });
    expect(schema.required).toEqual(
      expect.arrayContaining(COVERAGE_PAIRS.map(([, coveredKey]) => coveredKey))
    );
    expect(schema.required).toContain('findings');
  });

  it('accepts all seven required and covered sets when they match exactly', () => {
    const campaign = {
      candidate: executionFinalCandidate(),
      reviewer: cleanReviewer(),
      finalJudge: coveringFinalJudge(),
    };
    const result = mergeMainAgentExecutionFinalJudgeCampaign(campaign);

    expect(result.status).toBe('effective_pass_ready');
  });

  it.each(COVERAGE_PAIRS)(
    'blocks when %s contains an item missing from %s',
    (requiredKey, coveredKey) => {
      const candidate = executionFinalCandidate();
      const finalJudge = {
        ...coveringFinalJudge(),
        [coveredKey]: candidate[requiredKey].slice(0, 1),
      };

      const campaign = {
        candidate,
        reviewer: cleanReviewer(),
        finalJudge,
      };
      const result = mergeMainAgentExecutionFinalJudgeCampaign(campaign);

      expect(result.status).toBe('blocked');
    }
  );

  it.each(COVERAGE_PAIRS)(
    'blocks when %s contains an item absent from %s',
    (requiredKey, coveredKey) => {
      const candidate = executionFinalCandidate();
      const finalJudge = {
        ...coveringFinalJudge(),
        [coveredKey]: [...candidate[requiredKey], `EXTRA-${coveredKey}`],
      };

      const campaign = {
        candidate,
        reviewer: cleanReviewer(),
        finalJudge,
      };
      const result = mergeMainAgentExecutionFinalJudgeCampaign(campaign);

      expect(result.status).toBe('blocked');
    }
  );
});
