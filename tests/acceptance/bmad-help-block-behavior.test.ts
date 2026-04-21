import { describe, expect, it } from 'vitest';
import {
  readBmadHelpRoutingModel,
} from './helpers/bmad-help-doc-helpers';
import { resolveImplementationEntryGate } from '../../scripts/runtime-governance';

describe('bmad-help implementation block behavior', () => {
  it('prevents implementation-first recommendations when readiness is not clean or repair-closed', () => {
    const routingModel = readBmadHelpRoutingModel();

    expect(routingModel).toContain(
      '只要 `implementationReadinessStatus` 不是 `ready_clean` 或 `repair_closed`，实施入口不得是 `recommended`。'
    );
    expect(routingModel).toContain('- `blocked`: 直接 `Dev Story`');
    expect(routingModel).toContain('- `blocked`: 直接修复实现');
    expect(routingModel).toContain(
      '帮助层只要看到这两类前置尚未通过，就不得把实现入口判成 `recommended`。'
    );

    const evidenceSources = {
      readinessReportPath: null,
      remediationArtifactPath: null,
      executionRecordPath: null,
      authoritativeAuditReportPath: null,
    };

    expect(
      resolveImplementationEntryGate({
        requestedFlow: 'story',
        readinessStatus: 'blocked',
        complexity: 'low',
        evidenceSources,
      }).decision
    ).toBe('block');

    expect(
      resolveImplementationEntryGate({
        requestedFlow: 'story',
        readinessStatus: 'repair_in_progress',
        complexity: 'low',
        evidenceSources,
      }).decision
    ).toBe('block');

    expect(
      resolveImplementationEntryGate({
        requestedFlow: 'story',
        readinessStatus: 'stale_after_semantic_change',
        complexity: 'low',
        evidenceSources,
      }).decision
    ).toBe('block');

    expect(
      resolveImplementationEntryGate({
        requestedFlow: 'story',
        readinessStatus: 'repair_closed',
        complexity: 'low',
        evidenceSources,
      }).decision
    ).toBe('pass');

    const standaloneHighComplexity = resolveImplementationEntryGate({
      requestedFlow: 'standalone_tasks',
      readinessStatus: 'ready_clean',
      complexity: 'high',
      evidenceSources,
    });

    expect(standaloneHighComplexity.decision).toBe('reroute');
    expect(standaloneHighComplexity.recommendedFlow).toBe('story');
    expect(standaloneHighComplexity.rerouteReason).toBe('standalone_tasks_high_complexity');
  });
});
