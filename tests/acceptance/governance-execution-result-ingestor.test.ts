import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGovernancePacketExecutionRecord } from '../../scripts/governance-packet-execution-store';
import {
  createAcceptedPlaceholderDispatchAdapter,
  processPendingExecutionRecords,
} from '../../scripts/governance-packet-dispatch-worker';
import {
  ingestGovernanceExecutionResult,
  ingestGovernanceTransportEnvelope,
} from '../../scripts/governance-execution-result-ingestor';
import { validateGovernanceTransportEnvelope } from '../../scripts/governance-transport-envelope';

describe('governance execution result ingestor', () => {
  it('moves running execution records into awaiting_rerun_gate on successful result', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-exec-result-ingestor-'));
    try {
      const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md');
      mkdirSync(path.dirname(packetPath), { recursive: true });
      writeFileSync(packetPath, '# packet\n', 'utf8');

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-result',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: { cursor: packetPath },
        authoritativeHost: 'cursor',
      });
      await processPendingExecutionRecords(root, {
        adapter: createAcceptedPlaceholderDispatchAdapter('execution accepted'),
      });

      const updated = ingestGovernanceExecutionResult({
        projectRoot: root,
        loopStateId: 'loop-result',
        attemptNumber: 1,
        result: {
          outcome: 'completed',
          observedAt: '2026-04-09T00:00:00.000Z',
          externalRunId: 'run-1',
        },
      });

      expect(updated.status).toBe('awaiting_rerun_gate');
      expect(updated.rerunGateSchedule?.status).toBe('scheduled');
      expect(updated.lastExecutionResult?.outcome).toBe('completed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ingests no-hook execution status through a typed GovernanceTransportEnvelope', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-exec-envelope-ingestor-'));
    try {
      const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.codex-packet.md');
      mkdirSync(path.dirname(packetPath), { recursive: true });
      writeFileSync(packetPath, '# packet\n', 'utf8');

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-envelope',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: { codex: packetPath },
        authoritativeHost: 'codex',
      });
      await processPendingExecutionRecords(root, {
        adapter: createAcceptedPlaceholderDispatchAdapter('execution accepted'),
      });

      const updated = ingestGovernanceTransportEnvelope(root, {
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'governance-execution-result-ingestor',
        runId: 'run-1',
        recordId: 'REQ-TRANSPORT',
        requirementSetId: 'REQ-TRANSPORT',
        stage: 'implement',
        packetId: 'packet-1',
        eventType: 'execution_iteration_recorded',
        payloadKind: 'status',
        status: 'done',
        payload: {
          loopStateId: 'loop-envelope',
          attemptNumber: 1,
          execution: {
            outcome: 'completed',
            observedAt: '2026-04-09T00:00:00.000Z',
            externalRunId: 'run-1',
          },
        },
      });

      expect(updated?.status).toBe('awaiting_rerun_gate');
      expect(updated?.lastExecutionResult?.outcome).toBe('completed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects transport envelopes that carry a generic result field', () => {
    const validation = validateGovernanceTransportEnvelope({
      hostKind: 'codex',
      hostMode: 'no_hook',
      entry: 'governance-execution-result-ingestor',
      runId: 'run-1',
      recordId: 'REQ-TRANSPORT',
      requirementSetId: 'REQ-TRANSPORT',
      stage: 'implement',
      packetId: 'packet-1',
      eventType: 'execution_iteration_recorded',
      payloadKind: 'status',
      status: 'done',
      result: 'pass',
      payload: {
        loopStateId: 'loop-envelope',
        attemptNumber: 1,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain('envelope_result_forbidden');
  });

  it('requires eventType-specific typed control fields', () => {
    const validation = validateGovernanceTransportEnvelope({
      hostKind: 'codex',
      hostMode: 'no_hook',
      entry: 'governance-execution-result-ingestor',
      runId: 'run-1',
      recordId: 'REQ-TRANSPORT',
      requirementSetId: 'REQ-TRANSPORT',
      stage: 'implement',
      packetId: 'packet-1',
      eventType: 'gate_check_recorded',
      payloadKind: 'status',
      status: 'done',
      decision: 'pass',
    });

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain('envelope_payload_kind_mismatch:gate_check_recorded:status');
    expect(validation.mismatches).toContain('envelope_decision_forbidden_for_status');
  });

  it('blocks codex hooks-enabled trust assignment without independent probe receipts and hashes', () => {
    const validation = validateGovernanceTransportEnvelope({
      hostKind: 'codex',
      hostMode: 'hooks_enabled',
      entry: 'codex-session-start-hook',
      runId: 'run-hooks-1',
      recordId: 'REQ-HOOKS',
      requirementSetId: 'REQ-HOOKS',
      stage: 'implement',
      packetId: 'packet-hooks-1',
      eventType: 'hook_trust_receipt_recorded',
      payloadKind: 'decision',
      decision: 'pass',
      payload: {
        hookTrust: 'trusted',
        codexVersion: '0.130.0',
        hooksFeatureStable: true,
        capabilityProbeReceiptRef: { path: 'capability-probe.json' },
        sessionStartSmokeReceiptRef: { path: 'session-start-smoke.json' },
        managedHookConfigHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain('codex_hook_trust_receipt_ref_missing');
    expect(validation.mismatches).toContain('codex_runtime_policy_snapshot_hash_missing');
  });

  it('accepts codex hooks-enabled only when capability, receipts, config hash, and runtime policy hash are bound', () => {
    const validation = validateGovernanceTransportEnvelope({
      hostKind: 'codex',
      hostMode: 'hooks_enabled',
      entry: 'codex-session-start-hook',
      runId: 'run-hooks-1',
      recordId: 'REQ-HOOKS',
      requirementSetId: 'REQ-HOOKS',
      stage: 'implement',
      packetId: 'packet-hooks-1',
      eventType: 'hook_trust_receipt_recorded',
      payloadKind: 'decision',
      decision: 'pass',
      payload: {
        hookTrust: 'trusted',
        codexVersion: '0.130.0',
        hooksFeatureStable: true,
        capabilityProbeReceiptRef: { path: 'capability-probe.json', contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        sessionStartSmokeReceiptRef: { path: 'session-start-smoke.json', contentHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
        hookTrustReceiptRef: { path: 'hook-trust-receipt.json', contentHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' },
        managedHookConfigHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        runtimePolicySnapshotHash: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
    });

    expect(validation.ok).toBe(true);
  });
});
