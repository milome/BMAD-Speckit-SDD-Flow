import { describe, expect, it } from 'vitest';
import {
  deriveBmadHelpComplexity,
  deriveImplementationReadinessStatus,
  implementationReadinessPassed,
  shouldUpgradeStandaloneTasksToStory,
} from '../../scripts/runtime-governance';

describe('bmad-help runtime-governance helpers', () => {
  it('blocks story, bugfix, and standalone implementation when document audit is missing', () => {
    expect(
      deriveImplementationReadinessStatus('story', {
        documentAuditPassed: false,
      })
    ).toBe('blocked');

    expect(
      deriveImplementationReadinessStatus('bugfix', {
        documentAuditPassed: false,
      })
    ).toBe('blocked');

    expect(
      deriveImplementationReadinessStatus('standalone_tasks', {
        documentAuditPassed: false,
      })
    ).toBe('blocked');
  });

  it('derives readiness pass states and complexity escalation deterministically', () => {
    expect(
      deriveImplementationReadinessStatus('story', {
        readinessReportPresent: true,
        blockerCount: 0,
      })
    ).toBe('ready_clean');

    expect(
      deriveImplementationReadinessStatus('story', {
        readinessReportPresent: true,
        remediationState: 'closed',
        rerunGateStatus: 'pass',
      })
    ).toBe('repair_closed');

    expect(
      deriveImplementationReadinessStatus('story', {
        readinessReportPresent: true,
        staleAfterSemanticChange: true,
      })
    ).toBe('stale_after_semantic_change');

    const high = deriveBmadHelpComplexity({
      impactSurface: 2,
      sharedContract: 2,
      verificationCost: 2,
      uncertainty: 1,
      rollbackDifficulty: 1,
    });

    expect(high.level).toBe('high');
    expect(implementationReadinessPassed('ready_clean')).toBe(true);
    expect(implementationReadinessPassed('repair_closed')).toBe(true);
    expect(implementationReadinessPassed('blocked')).toBe(false);
    expect(shouldUpgradeStandaloneTasksToStory('standalone_tasks', high.level)).toBe(true);
  });
});
