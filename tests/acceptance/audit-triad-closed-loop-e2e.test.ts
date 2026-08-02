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

describe('Audit triad closed-loop e2e', () => {
  it('passes only after three current all-perspective no-gap rounds with receipts', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createFixtureAuditTriadPlan({
        fixture,
        compiled,
        attemptId: 'audit-current',
      });
      const round = (roundId: string) => createFixtureAuditTriadRound(plan, roundId);
      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r1'), round('r2'), round('r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(decision.ok).toBe(true);
      expect(decision.convergenceReceipt).toMatchObject({
        validNoGapRounds: 3,
      });
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
