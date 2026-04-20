import { describe, expect, it } from 'vitest';
import { resolveImplementationEntryGate } from '../../scripts/runtime-governance';

describe('implementation entry gate matrix', () => {
  const emptySources = {
    readinessReportPath: null,
    remediationArtifactPath: null,
    executionRecordPath: null,
    authoritativeAuditReportPath: null,
  };

  it('passes only when readiness is clean and flow is allowed to execute directly', () => {
    const gate = resolveImplementationEntryGate({
      requestedFlow: 'story',
      readinessStatus: 'ready_clean',
      complexity: 'medium',
      evidenceSources: emptySources,
    });

    expect(gate.decision).toBe('pass');
    expect(gate.recommendedFlow).toBe('story');
    expect(gate.rerouteRequired).toBe(false);
  });

  it('blocks when readiness is stale or otherwise not passable', () => {
    const gate = resolveImplementationEntryGate({
      requestedFlow: 'bugfix',
      readinessStatus: 'stale_after_semantic_change',
      complexity: 'medium',
      evidenceSources: emptySources,
    });

    expect(gate.decision).toBe('block');
    expect(gate.blockerCodes).toContain('stale_after_semantic_change');
  });

  it('reroutes standalone_tasks high complexity to story', () => {
    const gate = resolveImplementationEntryGate({
      requestedFlow: 'standalone_tasks',
      readinessStatus: 'ready_clean',
      complexity: 'high',
      evidenceSources: emptySources,
    });

    expect(gate.decision).toBe('reroute');
    expect(gate.recommendedFlow).toBe('story');
    expect(gate.rerouteRequired).toBe(true);
  });
});
