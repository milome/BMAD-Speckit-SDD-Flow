import { describe, expect, it } from 'vitest';
import { evaluateAuditTriadConvergence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  createFixtureAuditTriadPlan,
  createFixtureAuditTriadRound,
} from '../helpers/audit-triad-fixture-runtime';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

describe('Audit triad reset on reconfirmation', () => {
  it('rejects stale convergence receipts after source or confirmation hash changes', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createFixtureAuditTriadPlan({
        fixture,
        compiled,
        attemptId: 'audit-current',
      });
      const staleSourceRound = createFixtureAuditTriadRound(plan, 'r1', {
        perspectiveResults: {
          product_intent: { agentId: 'p1', validGaps: [] },
          model_projection: { agentId: 'm1', validGaps: [] },
          main_agent_execution: { agentId: 'e1', validGaps: [] },
        },
        sourceDocumentHash: 'sha256:stale-source',
        scoreReceiptRefs: ['score.json'],
        runAuditorHostReceiptRefs: ['host.json'],
      });
      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          staleSourceRound,
          { ...staleSourceRound, roundId: 'r2' },
          { ...staleSourceRound, roundId: 'r3' },
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_1_source_hash_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
