import { describe, expect, it } from 'vitest';
import {
  resolveImplementationEntryGate,
  type ImplementationEntryEvidenceSources,
} from '../../scripts/runtime-governance';
import './main-agent-entryflow-traceability-check.test';

const EVIDENCE_SOURCES: ImplementationEntryEvidenceSources = {
  readinessReportPath:
    '_bmad-output/runtime/requirement-records/REQ-ENTRYFLOW/implementation-readiness-report.json',
  remediationArtifactPath: null,
  executionRecordPath:
    '_bmad-output/runtime/requirement-records/REQ-ENTRYFLOW/requirement-record.json',
  authoritativeAuditReportPath: null,
};

describe('requirement entry flow resolver', () => {
  it('passes the selected implementation entry flow only after readiness is clean', () => {
    const gate = resolveImplementationEntryGate({
      requestedFlow: 'story',
      readinessStatus: 'ready_clean',
      complexity: 'medium',
      evidenceSources: EVIDENCE_SOURCES,
      semanticFingerprint:
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      evaluatedAt: '2026-05-28T00:00:00.000Z',
    });

    expect(gate).toMatchObject({
      gateName: 'implementation-readiness',
      requestedFlow: 'story',
      recommendedFlow: 'story',
      decision: 'pass',
      rerouteRequired: false,
      rerouteReason: null,
    });
  });

  it('blocks every implementation entry flow while readiness evidence is missing', () => {
    const gate = resolveImplementationEntryGate({
      requestedFlow: 'bugfix',
      readinessStatus: 'missing',
      complexity: 'low',
      evidenceSources: EVIDENCE_SOURCES,
      evaluatedAt: '2026-05-28T00:00:00.000Z',
    });

    expect(gate.decision).toBe('block');
    expect(gate.recommendedFlow).toBe('bugfix');
    expect(gate.rerouteRequired).toBe(false);
    expect(gate.blockerCodes).toContain('missing_readiness_evidence');
  });

  it('reroutes high-complexity standalone tasks to story after readiness is clean', () => {
    const gate = resolveImplementationEntryGate({
      requestedFlow: 'standalone_tasks',
      readinessStatus: 'repair_closed',
      complexity: 'high',
      evidenceSources: EVIDENCE_SOURCES,
      evaluatedAt: '2026-05-28T00:00:00.000Z',
    });

    expect(gate).toMatchObject({
      requestedFlow: 'standalone_tasks',
      recommendedFlow: 'story',
      decision: 'reroute',
      rerouteRequired: true,
      rerouteReason: 'standalone_tasks_high_complexity',
    });
  });
});
