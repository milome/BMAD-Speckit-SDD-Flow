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
import {
  governanceEventTypeRegistryPolicyHash,
  governanceEventTypeRegistryHash,
  validateGovernanceTransportEnvelope,
} from '../../scripts/governance-transport-envelope';

const GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY = {
  controlFieldVocabulary: [
    'artifactIndex',
    'closeout',
    'confirmationHistory',
    'contractChecks',
    'executionIterations',
    'failureRecords',
    'gateChecks',
    'hookTrustReceipts',
    'recoveryContext',
    'rerunLoops',
    'runtimePolicySnapshotRef',
  ],
  payloadKindContracts: [
    {
      payloadKind: 'decision',
      requiredFields: ['eventType', 'decision'],
      forbiddenFields: ['result', 'status'],
      allowedControlWriteModes: ['control'],
    },
    {
      payloadKind: 'status',
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      allowedControlWriteModes: ['control'],
    },
    {
      payloadKind: 'artifactRefs',
      requiredFields: ['eventType', 'artifactRefs'],
      forbiddenFields: ['result', 'decision', 'status'],
      allowedControlWriteModes: ['artifact_only'],
    },
  ],
  controlWriteModePolicies: [
    {
      allowedControlWriteMode: 'control',
      allowedWritesControlFields: [
        'executionIterations',
        'gateChecks',
        'hookTrustReceipts',
        'rerunLoops',
      ],
    },
    {
      allowedControlWriteMode: 'artifact_only',
      allowedWritesControlFields: ['artifactIndex'],
    },
  ],
  eventSpecificRequirements: [
    {
      eventType: 'rerun_loop_recorded',
      payloadKind: 'status',
      requiredSourceRefs: true,
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      allowedControlWriteMode: 'control',
    },
  ],
};

const GOVERNANCE_EVENT_TYPE_REGISTRY = [
  {
    eventType: 'execution_iteration_recorded',
    payloadKind: 'status',
    writesControlFields: ['executionIterations'],
    allowedStatusValues: ['pending', 'running', 'done', 'partial', 'blocked', 'failed'],
    payloadContract: {
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      requiredSourceRefs: false,
      allowedControlWriteMode: 'control',
    },
  },
  {
    eventType: 'gate_check_recorded',
    payloadKind: 'decision',
    writesControlFields: ['gateChecks'],
    allowedDecisionValues: ['pass', 'fail', 'blocked'],
    payloadContract: {
      requiredFields: ['eventType', 'decision'],
      forbiddenFields: ['result', 'status'],
      requiredSourceRefs: false,
      allowedControlWriteMode: 'control',
    },
  },
  {
    eventType: 'hook_trust_receipt_recorded',
    payloadKind: 'decision',
    writesControlFields: ['hookTrustReceipts'],
    allowedDecisionValues: ['pass', 'fail', 'blocked'],
    payloadContract: {
      requiredFields: ['eventType', 'decision'],
      forbiddenFields: ['result', 'status'],
      requiredSourceRefs: false,
      allowedControlWriteMode: 'control',
    },
  },
  {
    eventType: 'artifact_indexed',
    payloadKind: 'artifactRefs',
    writesControlFields: ['artifactIndex'],
    payloadContract: {
      requiredFields: ['eventType', 'artifactRefs'],
      forbiddenFields: ['result', 'decision', 'status'],
      requiredSourceRefs: false,
      allowedControlWriteMode: 'artifact_only',
    },
  },
  {
    eventType: 'rerun_loop_recorded',
    payloadKind: 'status',
    writesControlFields: ['rerunLoops'],
    allowedStatusValues: ['open', 'resolved', 'blocked'],
    payloadContract: {
      requiredFields: ['eventType', 'status'],
      forbiddenFields: ['result', 'decision'],
      requiredSourceRefs: true,
      allowedControlWriteMode: 'control',
    },
  },
];

const REGISTRY_BINDING = {
  governanceEventTypeRegistryPolicy: GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY,
  governanceEventTypeRegistry: GOVERNANCE_EVENT_TYPE_REGISTRY,
  registryPolicyHash: governanceEventTypeRegistryPolicyHash(GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY),
  registryHash: governanceEventTypeRegistryHash(GOVERNANCE_EVENT_TYPE_REGISTRY),
  architectureConfirmationHash:
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

describe('governance execution result ingestor', () => {
  it('moves running execution records into awaiting_rerun_gate on successful result', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-exec-result-ingestor-'));
    try {
      const packetPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'attempt-1.cursor-packet.md'
      );
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
      const packetPath = path.join(
        root,
        '_bmad-output',
        'planning-artifacts',
        'attempt-1.codex-packet.md'
      );
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

      const updated = ingestGovernanceTransportEnvelope(
        root,
        {
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
        },
        REGISTRY_BINDING
      );

      expect(updated?.status).toBe('awaiting_rerun_gate');
      expect(updated?.lastExecutionResult?.outcome).toBe('completed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects transport envelopes that carry a generic result field', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
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
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain('envelope_result_forbidden');
  });

  it('requires eventType-specific typed control fields', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
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
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain(
      'envelope_payload_kind_mismatch:gate_check_recorded:status'
    );
    expect(validation.mismatches).toContain(
      'envelope_forbidden_field_present:gate_check_recorded:status'
    );
  });

  it('blocks codex hooks-enabled trust assignment without independent probe receipts and hashes', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
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
          managedHookConfigHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain('codex_hook_trust_receipt_ref_missing');
    expect(validation.mismatches).toContain('codex_runtime_policy_snapshot_hash_missing');
  });

  it('accepts codex hooks-enabled only when capability, receipts, config hash, and runtime policy hash are bound', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
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
          capabilityProbeReceiptRef: {
            path: 'capability-probe.json',
            contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
          sessionStartSmokeReceiptRef: {
            path: 'session-start-smoke.json',
            contentHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          },
          hookTrustReceiptRef: {
            path: 'hook-trust-receipt.json',
            contentHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          },
          managedHookConfigHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimePolicySnapshotHash:
            'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(true);
  });

  it('fails closed without registry binding instead of using hardcoded event sets', () => {
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
    });

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toEqual(
      expect.arrayContaining([
        'envelope_event_registry_missing',
        'envelope_event_registry_hash_missing',
      ])
    );
  });

  it('uses event-specific allowed values from registry', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'governance-execution-result-ingestor',
        runId: 'run-1',
        recordId: 'REQ-TRANSPORT',
        requirementSetId: 'REQ-TRANSPORT',
        stage: 'implement',
        packetId: 'packet-1',
        eventType: 'gate_check_recorded',
        payloadKind: 'decision',
        decision: 'architecture_reaudit_blocked',
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain(
      'envelope_decision_invalid:architecture_reaudit_blocked'
    );
  });

  it('requires artifactRefs only when registry payloadContract declares it', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'governance-execution-result-ingestor',
        runId: 'run-1',
        recordId: 'REQ-TRANSPORT',
        requirementSetId: 'REQ-TRANSPORT',
        stage: 'implement',
        packetId: 'packet-1',
        eventType: 'artifact_indexed',
        payloadKind: 'artifactRefs',
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain(
      'envelope_required_field_missing:artifact_indexed:artifactRefs'
    );
  });

  it('rejects artifact-only events that smuggle control fields in payload', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'governance-execution-result-ingestor',
        runId: 'run-1',
        recordId: 'REQ-TRANSPORT',
        requirementSetId: 'REQ-TRANSPORT',
        stage: 'implement',
        packetId: 'packet-1',
        eventType: 'artifact_indexed',
        payloadKind: 'artifactRefs',
        artifactRefs: [
          {
            path: '_bmad-output/runtime/requirement-records/REQ-TRANSPORT/evidence/artifact.json',
            contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ],
        payload: {
          closeout: { decision: 'pass' },
          gateChecks: [{ id: 'gate-1', decision: 'pass' }],
        },
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toEqual(
      expect.arrayContaining([
        'envelope_control_field_not_authorized:artifact_indexed:closeout',
        'envelope_control_field_not_authorized:artifact_indexed:gateChecks',
      ])
    );
  });

  it('fails closed when this ingestor receives a registered event type it does not own', () => {
    const envelope = {
      hostKind: 'codex',
      hostMode: 'no_hook',
      entry: 'governance-execution-result-ingestor',
      runId: 'run-1',
      recordId: 'REQ-TRANSPORT',
      requirementSetId: 'REQ-TRANSPORT',
      stage: 'implement',
      packetId: 'packet-1',
      eventType: 'artifact_indexed',
      payloadKind: 'artifactRefs',
      artifactRefs: [
        {
          path: '_bmad-output/runtime/requirement-records/REQ-TRANSPORT/evidence/artifact.json',
          contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      ],
    } as const;

    expect(validateGovernanceTransportEnvelope(envelope, REGISTRY_BINDING).ok).toBe(true);
    expect(() =>
      ingestGovernanceTransportEnvelope('/tmp/not-used', envelope as any, REGISTRY_BINDING)
    ).toThrow('unsupported governance-execution-result-ingestor eventType: artifact_indexed');
  });

  it('rejects self-consistent registries whose payloadContract violates policy', () => {
    const invalidRegistry = [
      {
        eventType: 'artifact_indexed',
        payloadKind: 'artifactRefs',
        writesControlFields: ['artifactIndex'],
        payloadContract: {
          requiredFields: ['eventType'],
          forbiddenFields: ['result', 'decision', 'status'],
          requiredSourceRefs: false,
          allowedControlWriteMode: 'artifact_only',
        },
      },
    ];
    const validation = validateGovernanceTransportEnvelope(
      {
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'governance-execution-result-ingestor',
        runId: 'run-1',
        recordId: 'REQ-TRANSPORT',
        requirementSetId: 'REQ-TRANSPORT',
        stage: 'implement',
        packetId: 'packet-1',
        eventType: 'artifact_indexed',
        payloadKind: 'artifactRefs',
      },
      {
        governanceEventTypeRegistryPolicy: GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY,
        governanceEventTypeRegistry: invalidRegistry,
        registryPolicyHash: governanceEventTypeRegistryPolicyHash(
          GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY
        ),
        registryHash: governanceEventTypeRegistryHash(invalidRegistry),
        architectureConfirmationHash: REGISTRY_BINDING.architectureConfirmationHash,
      }
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain(
      'envelope_event_registry_policy_required_field_missing:artifact_indexed:artifactRefs'
    );
  });

  it('requires rerun sourceRefs through payloadContract instead of eventType hardcoding', () => {
    const validation = validateGovernanceTransportEnvelope(
      {
        hostKind: 'codex',
        hostMode: 'no_hook',
        entry: 'governance-execution-result-ingestor',
        runId: 'run-1',
        recordId: 'REQ-TRANSPORT',
        requirementSetId: 'REQ-TRANSPORT',
        stage: 'implement',
        packetId: 'packet-1',
        eventType: 'rerun_loop_recorded',
        payloadKind: 'status',
        status: 'open',
      },
      REGISTRY_BINDING
    );

    expect(validation.ok).toBe(false);
    expect(validation.mismatches).toContain('envelope_source_refs_missing:rerun_loop_recorded');
    expect(validation.mismatches).not.toContain('envelope_rerun_source_refs_missing');
  });
});
