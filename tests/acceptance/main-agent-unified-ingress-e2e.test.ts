import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runUnifiedIngress,
  type MainAgentHostKind,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-unified-ingress';
import {
  governanceEventTypeRegistryPolicyHash,
  governanceEventTypeRegistryHash,
  type GovernanceTransportEnvelope,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/governance-transport-envelope';
import { readOrchestrationState } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-state';
import { publishImplementationPromptFixture } from './helpers/prompt-transaction-implementation-publication-fixture';

interface PreparedIngressFixture {
  root: string;
  cleanup: () => void;
  pointer: Record<string, unknown>;
  recordId: string;
  requirementSetId: string;
  implementationAttemptId: string;
  transactionId: string;
}

async function prepareRoot(
  hostKind: MainAgentHostKind,
  hookAvailable: boolean
): Promise<PreparedIngressFixture> {
  const published = await publishImplementationPromptFixture({
    configureRecord: (record, fixture) => ({
      ...record,
      transactionId: fixture.identity.transactionId,
      flow: 'story',
      stage: 'implement',
      entryFlow: 'story',
      entryFlowClass: 'full_story_entry',
      workflowAdapter: 'bmad',
      runtimeRegistryBridge: true,
      sourceMode: 'full_bmad',
      storyId: `S-${hostKind}`,
    }),
  });
  const { fixture, pointer } = published;
  const requirementRecordRef = pointer.requirementRecordRef as Record<string, unknown>;
  const publishedRecord = JSON.parse(
    fs.readFileSync(String(requirementRecordRef.path), 'utf8')
  ) as Record<string, unknown>;
  const recordId = String(publishedRecord.recordId);
  const requirementSetId = String(pointer.requirementSetId);
  const implementationAttemptId = String(pointer.implementationAttemptId);
  const transactionId = String(pointer.transactionId);
  if (
    recordId !== fixture.authority.recordId ||
    requirementSetId !== fixture.identity.requirementSetId ||
    implementationAttemptId !== fixture.identity.implementationAttemptId ||
    transactionId !== fixture.identity.transactionId
  ) {
    fixture.cleanup();
    throw new Error('published ingress fixture identity mismatch');
  }
  const root = fixture.root;
  if (hookAvailable && hostKind === 'cursor') {
    fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(root, '.cursor', 'hooks.json'), '{"version":1}\n', 'utf8');
  }
  if (hookAvailable && hostKind === 'claude') {
    fs.mkdirSync(path.join(root, '_bmad', 'claude', 'hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs'),
      'module.exports = {};\n',
      'utf8'
    );
  }
  if (hostKind === 'codex') {
    fs.mkdirSync(path.join(root, '.codex', 'agents'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'agents', 'implementation-worker.toml'),
      [
        'name = "implementation-worker"',
        'description = "Ingress Codex worker"',
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """Follow dispatch packet instructions."""',
        '',
      ].join('\n'),
      'utf8'
    );
  }
  return {
    root,
    cleanup: fixture.cleanup,
    pointer,
    recordId,
    requirementSetId,
    implementationAttemptId,
    transactionId,
  };
}

function ingressInput(fixture: PreparedIngressFixture, hostKind: MainAgentHostKind) {
  return {
    projectRoot: fixture.root,
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    hostKind,
    flow: 'story' as const,
    stage: 'implement',
  };
}

const GOVERNANCE_EVENT_TYPE_REGISTRY = [
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
];
const GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY = {
  controlFieldVocabulary: ['hookTrustReceipts'],
  payloadKindContracts: [
    {
      payloadKind: 'decision',
      requiredFields: ['eventType', 'decision'],
      forbiddenFields: ['result', 'status'],
      allowedControlWriteModes: ['control'],
    },
  ],
  controlWriteModePolicies: [
    {
      allowedControlWriteMode: 'control',
      allowedWritesControlFields: ['hookTrustReceipts'],
    },
  ],
  eventSpecificRequirements: [],
};

const REGISTRY_BINDING = {
  governanceEventTypeRegistryPolicy: GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY,
  governanceEventTypeRegistryPolicyHash: governanceEventTypeRegistryPolicyHash(
    GOVERNANCE_EVENT_TYPE_REGISTRY_POLICY
  ),
  governanceEventTypeRegistry: GOVERNANCE_EVENT_TYPE_REGISTRY,
  governanceEventTypeRegistryHash: governanceEventTypeRegistryHash(GOVERNANCE_EVENT_TYPE_REGISTRY),
  architectureConfirmationHash:
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

function codexHookTrustEnvelope(
  fixture: PreparedIngressFixture,
  overrides: Partial<GovernanceTransportEnvelope> = {}
): GovernanceTransportEnvelope {
  return {
    hostKind: 'codex',
    hostMode: 'hooks_enabled',
    entry: 'codex-session-start-hook',
    runId: fixture.implementationAttemptId,
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    stage: 'implement',
    packetId: fixture.implementationAttemptId,
    eventType: 'hook_trust_receipt_recorded',
    payloadKind: 'decision',
    decision: 'pass',
    payload: {
      hookTrust: 'trusted',
      codexVersion: '0.130.0',
      hooksFeatureStable: true,
      capabilityProbeReceiptRef: {
        path: 'capability-probe.json',
        contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      sessionStartSmokeReceiptRef: {
        path: 'session-start-smoke.json',
        contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      hookTrustReceiptRef: {
        path: 'hook-trust-receipt.json',
        contentHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
      managedHookConfigHash:
        'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      runtimePolicySnapshotHash:
        'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
    ...overrides,
  };
}

describe('main-agent unified ingress e2e', () => {
  it('routes hooks-enabled cursor through hook_ingress and the shared control plane', async () => {
    const root = await prepareRoot('cursor', true);
    try {
      const receipt = runUnifiedIngress(ingressInput(root, 'cursor'));

      expect(receipt.recordId).toBe(root.recordId);
      expect(receipt.requirementSetId).toBe(root.requirementSetId);
      expect(receipt.hostMode).toBe('hooks_enabled');
      expect(receipt.orchestrationEntry).toBe('hook_ingress');
      expect(receipt.degradationLevel).toBe('none');
      expect(receipt.hostRecovery).toMatchObject({
        degradation_cleared_at: null,
        recovery_probe_count: 0,
        recovered_host_mode: null,
        recovered_orchestration_entry: null,
      });
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('blocked');
      expect(receipt.runLoop.pendingPacketStatus).toBe('invalidated');
    } finally {
      root.cleanup();
    }
  });

  it('degrades missing hooks to cli_ingress without changing the control plane', async () => {
    const root = await prepareRoot('claude', false);
    try {
      const receipt = runUnifiedIngress(ingressInput(root, 'claude'));

      expect(receipt.hostMode).toBe('no_hooks');
      expect(receipt.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.degradationLevel).toBe('hook_lost');
      expect(receipt.degradationReason?.code).toBe('hook_unavailable');
      expect(receipt.degradationReason?.reason).toContain('hook unavailable');
      expect(receipt.degradationReason?.detected_at).toEqual(expect.any(String));
      expect(receipt.degradationReason?.failed_capability).toBe('runtime_policy_hook');
      expect(receipt.degradationReason?.fallback_entry).toBe('cli_ingress');
      expect(receipt.degradationReason?.expected_behavior_change).toContain('CLI ingress');
      expect(receipt.hostRecovery.degradation_cleared_at).toBeNull();
      expect(receipt.hostRecovery.recovery_probe_count).toBeGreaterThanOrEqual(
        receipt.hostRecovery.required_probe_count
      );
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.parity_diff.degradationCleared).toBe(false);
      expect(receipt.hostRecovery.before_parity_snapshot.inspect?.status).toBe('blocked');
      expect(receipt.hostRecovery.after_parity_snapshot.inspect).toBeNull();
      expect(receipt.hostRecovery.recovery_log_path).toEqual(expect.any(String));
      expect(fs.existsSync(receipt.hostRecovery.recovery_log_path as string)).toBe(true);
      expect((receipt.hostRecovery.recovery_log_path as string).replace(/\\/g, '/')).toContain(
        `_bmad-output/runtime/requirement-records/${root.recordId}/artifacts/ingress/recovery`
      );
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('blocked');
      expect(receipt.runLoop.pendingPacketStatus).toBe('dispatched');
    } finally {
      root.cleanup();
    }
  });

  it('emits S3f recovery fields and blocks back-switch when execution parity fails', async () => {
    const root = await prepareRoot('cursor', true);
    try {
      const receipt = runUnifiedIngress({
        ...ingressInput(root, 'cursor'),
        forceNoHooks: true,
      });

      expect(receipt.degradationLevel).toBe('cli_forced');
      expect(receipt.degradationReason?.failed_capability).toBe('operator_override');
      expect(receipt.hostRecovery.recovery_probe_count).toBeGreaterThanOrEqual(
        receipt.hostRecovery.required_probe_count
      );
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.degradation_cleared_at).toBeNull();
      expect(receipt.hostRecovery.before_parity_snapshot.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.hostRecovery.after_parity_snapshot.orchestrationEntry).toBeNull();
      expect(receipt.hostRecovery.before_parity_snapshot.inspect?.resolvedHost).toBe('cursor');
      expect(receipt.hostRecovery.before_parity_snapshot.inspect?.pendingPacketStatus).toBe(
        'invalidated'
      );
      expect(receipt.hostRecovery.after_parity_snapshot.inspect).toMatchObject({
        status: 'blocked',
        resolvedHost: 'cursor',
        pendingPacketStatus: 'invalidated',
      });
      expect(receipt.hostRecovery.parity_diff).toMatchObject({
        hostModeChanged: false,
        orchestrationEntryChanged: false,
        degradationCleared: false,
      });
      expect(receipt.hostRecovery.recovery_log_path).toEqual(expect.any(String));
      expect(fs.existsSync(receipt.hostRecovery.recovery_log_path as string)).toBe(true);
      const recoveryLog = JSON.parse(
        fs.readFileSync(receipt.hostRecovery.recovery_log_path as string, 'utf8')
      ) as {
        recovered: boolean;
        inspect_parity_passed: boolean;
        back_switch_allowed: boolean;
      };
      expect(recoveryLog).toMatchObject({
        recovered: true,
        inspect_parity_passed: false,
        back_switch_allowed: false,
      });
      const state = readOrchestrationState(root.root, receipt.runLoop.sessionId!);
      expect(state?.hostRecovery).toMatchObject({
        degradation_level: 'cli_forced',
        active_host_mode: 'no_hooks',
        orchestration_entry: 'cli_ingress',
        recovered_host_mode: null,
        recovered_orchestration_entry: null,
      });
    } finally {
      root.cleanup();
    }
  });

  it('does not back-switch when hook health probe fails despite hook file existing', async () => {
    const root = await prepareRoot('cursor', true);
    try {
      fs.writeFileSync(path.join(root.root, '.cursor', 'hooks.json'), '{not-json}\n', 'utf8');
      const receipt = runUnifiedIngress({
        ...ingressInput(root, 'cursor'),
        forceNoHooks: true,
      });

      expect(receipt.degradationLevel).toBe('cli_forced');
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.parity_diff.degradationCleared).toBe(false);
      const log = JSON.parse(
        fs.readFileSync(receipt.hostRecovery.recovery_log_path as string, 'utf8')
      ) as { probes: Array<{ hookAvailable: boolean; hookExecutable: boolean }> };
      expect(log.probes.every((probe) => probe.hookAvailable)).toBe(true);
      expect(log.probes.every((probe) => probe.hookExecutable)).toBe(false);
      const state = readOrchestrationState(root.root, receipt.runLoop.sessionId!);
      expect(state?.hostRecovery?.degradation_level).toBe('cli_forced');
      expect(state?.hostRecovery?.recovered_host_mode).toBeNull();
    } finally {
      root.cleanup();
    }
  });

  it('emits host_partial and transport_degraded degradation branches', async () => {
    const hostPartialRoot = await prepareRoot('codex', false);
    const transportRoot = await prepareRoot('cursor', true);
    try {
      const hostPartial = runUnifiedIngress({
        ...ingressInput(hostPartialRoot, 'codex'),
        forceHostPartial: true,
      });
      expect(hostPartial.degradationLevel).toBe('host_partial');
      expect(hostPartial.degradationReason?.failed_capability).toBe('host_capability');
      expect(hostPartial.hostRecovery.parity_diff.degradationCleared).toBe(false);

      const transport = runUnifiedIngress({
        ...ingressInput(transportRoot, 'cursor'),
        forceTransportDegraded: true,
      });
      expect(transport.degradationLevel).toBe('transport_degraded');
      expect(transport.degradationReason?.failed_capability).toBe('transport');
      expect(transport.hostRecovery.recovery_log_path).toEqual(expect.any(String));
    } finally {
      hostPartialRoot.cleanup();
      transportRoot.cleanup();
    }
  });

  it('fails closed when host recovery cannot write orchestration state', async () => {
    const root = await prepareRoot('cursor', true);
    try {
      expect(() =>
        runUnifiedIngress({
          ...ingressInput(root, 'cursor'),
          forceNoHooks: true,
          forceStateWriteFailure: true,
        })
      ).toThrow(/host recovery state write failed/u);
    } finally {
      root.cleanup();
    }
  });

  it('blocks S3f back-switch when inspect parity does not match the recovering host', async () => {
    const root = await prepareRoot('cursor', true);
    try {
      const receipt = runUnifiedIngress({
        ...ingressInput(root, 'cursor'),
        forceNoHooks: true,
        recoveryInspectHostOverride: 'codex',
      });
      expect(receipt.hostRecovery.recovered_host_mode).toBeNull();
      expect(receipt.hostRecovery.recovered_orchestration_entry).toBeNull();
      expect(receipt.hostRecovery.degradation_cleared_at).toBeNull();
      expect(receipt.hostRecovery.parity_diff.degradationCleared).toBe(false);

      const logPath = receipt.hostRecovery.recovery_log_path as string;
      const log = JSON.parse(fs.readFileSync(logPath, 'utf8')) as {
        inspect_parity_passed: boolean;
        back_switch_allowed: boolean;
      };
      expect(log.inspect_parity_passed).toBe(false);
      expect(log.back_switch_allowed).toBe(false);
    } finally {
      root.cleanup();
    }
  });

  it('routes Codex no-hooks ingress to current main-session execution', async () => {
    const root = await prepareRoot('codex', false);
    try {
      const receipt = runUnifiedIngress(ingressInput(root, 'codex'));

      expect(receipt.hostMode).toBe('no_hooks');
      expect(receipt.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.degradationLevel).toBe('none');
      expect(receipt.degradationReason).toBeNull();
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('blocked');
      expect(receipt.runLoop.resolvedHost).toBe('codex');
      expect(receipt.runLoop.pendingPacketStatus).toBe('dispatched');
      expect(receipt.runLoop.finalNextAction).toBe('await_native_goal_task_report');
      expect(receipt.sameControlPlane).toBe(true);
    } finally {
      root.cleanup();
    }
  });

  it('allows codex hooks_enabled only with a validated hook trust envelope', async () => {
    const root = await prepareRoot('codex', false);
    try {
      const receipt = runUnifiedIngress({
        ...ingressInput(root, 'codex'),
        codexHookTrustEnvelope: codexHookTrustEnvelope(root),
        ...REGISTRY_BINDING,
      });

      expect(receipt.hostMode).toBe('hooks_enabled');
      expect(receipt.orchestrationEntry).toBe('hook_ingress');
      expect(receipt.hookTrust).toBe('trusted');
      expect(receipt.hookTrustEnvelopeValidation?.ok).toBe(true);
      expect(receipt.degradationReason).toBeNull();
      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('blocked');
      expect(receipt.runLoop.pendingPacketStatus).toBe('dispatched');
      expect(receipt.runLoop.finalNextAction).toBe('await_native_goal_task_report');
    } finally {
      root.cleanup();
    }
  });

  it('degrades codex hook claims to no_hooks when trust proof is incomplete', async () => {
    const root = await prepareRoot('codex', false);
    try {
      const invalid = codexHookTrustEnvelope(root, {
        payload: {
          hookTrust: 'trusted',
          codexVersion: '0.130.0',
          hooksFeatureStable: true,
        },
      });
      const receipt = runUnifiedIngress({
        ...ingressInput(root, 'codex'),
        codexHookTrustEnvelope: invalid,
        ...REGISTRY_BINDING,
      });

      expect(receipt.hostMode).toBe('no_hooks');
      expect(receipt.orchestrationEntry).toBe('cli_ingress');
      expect(receipt.hookTrust).toBe('untrusted');
      expect(receipt.degradationLevel).toBe('host_partial');
      expect(receipt.degradationReason?.code).toBe('codex_hook_trust_unverified');
      expect(receipt.hookTrustEnvelopeValidation?.mismatches).toContain(
        'codex_capability_probe_receipt_ref_missing'
      );
      expect(receipt.hookTrustEnvelopeValidation?.mismatches).toContain(
        'codex_runtime_policy_snapshot_hash_missing'
      );
    } finally {
      root.cleanup();
    }
  });

  it('requires a requirement record id instead of writing legacy global ingress outputs', async () => {
    const root = await prepareRoot('cursor', true);
    try {
      expect(() =>
        runUnifiedIngress({
          projectRoot: root.root,
          recordId: '',
          hostKind: 'cursor',
          flow: 'story',
          stage: 'implement',
        })
      ).toThrow(/recordId is required/u);
      expect(fs.existsSync(path.join(root.root, '_bmad-output', 'runtime', 'ingress'))).toBe(
        false
      );
    } finally {
      root.cleanup();
    }
  });
});
