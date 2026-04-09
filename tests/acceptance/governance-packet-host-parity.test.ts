import { describe, expect, it } from 'vitest';
import {
  createGovernanceExecutorPacket,
  renderGovernanceExecutorPacket,
  type GovernanceAttemptLoopState,
} from '../../scripts/governance-remediation-runner';

function normalizeHostSpecificLines(input: string): string {
  return input
    .replace(/- Host Kind: .+/g, '- Host Kind: <host>')
    .replace(/- Execution Mode: .+/g, '- Execution Mode: <mode>');
}

describe('governance packet host parity', () => {
  it('cursor and claude packets are equivalent except for host kind and execution mode', () => {
    const loopState: GovernanceAttemptLoopState = {
      version: 1,
      loopStateId: 'loop-readiness',
      rerunGate: 'implementation-readiness',
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA / readiness reviewer',
      targetArtifacts: ['prd.md', 'architecture.md', 'epics.md'],
      maxAttempts: 3,
      maxNoProgressRepeats: 1,
      attemptCount: 1,
      noProgressRepeatCount: 0,
      status: 'awaiting_rerun',
      lastGateResult: null,
      lastStopReason: null,
      executorRouting: null,
      remediationAuditTraceSummaryLines: [],
      rerunChain: [],
      rerunStageIndex: 0,
      createdAt: '2026-04-09T00:00:00.000Z',
      updatedAt: '2026-04-09T00:00:00.000Z',
      attempts: [],
    };

    const shared = {
      runtimeContext: null,
      runtimePolicy: null,
      loopState,
      currentAttemptNumber: 1,
      rerunGate: 'implementation-readiness',
      artifactMarkdown: '# Governance Remediation Artifact\n\nshared body\n',
      journeyContractHints: [],
      rerunDecision: {
        mode: 'generic' as const,
        signals: [],
        reason: 'generic routing',
      },
      executorRouting: {
        routingMode: 'generic' as const,
        executorRoute: 'default-gate-remediation' as const,
        prioritizedSignals: [],
        packetStrategy: 'default-remediation-packet' as const,
        reason: 'generic routing',
      },
    };

    const cursor = renderGovernanceExecutorPacket(
      createGovernanceExecutorPacket({
        ...shared,
        hostKind: 'cursor',
      })
    );
    const claude = renderGovernanceExecutorPacket(
      createGovernanceExecutorPacket({
        ...shared,
        hostKind: 'claude',
      })
    );

    expect(normalizeHostSpecificLines(cursor)).toBe(normalizeHostSpecificLines(claude));
  });
});
