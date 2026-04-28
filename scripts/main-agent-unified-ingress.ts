/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from './main-agent-orchestration';
import { updateOrchestrationState } from './orchestration-state';
import type { RuntimeFlowId } from './runtime-governance';

export type MainAgentHostMode = 'hooks_enabled' | 'no_hooks';
export type MainAgentHostKind = 'cursor' | 'claude' | 'codex';
export type MainAgentOrchestrationEntry = 'hook_ingress' | 'cli_ingress';
export type MainAgentDegradationLevel =
  | 'none'
  | 'hook_lost'
  | 'transport_degraded'
  | 'host_partial'
  | 'cli_forced';

export interface MainAgentDegradationReason {
  code: string;
  hostKind: MainAgentHostKind;
  hookPath: string | null;
  reason: string;
  detected_at: string;
  failed_capability:
    | 'runtime_policy_hook'
    | 'hook_ingress'
    | 'operator_override'
    | 'host_capability'
    | 'transport';
  fallback_entry: MainAgentOrchestrationEntry;
  expected_behavior_change: string;
}

export interface MainAgentHostRecovery {
  degradation_cleared_at: string | null;
  recovery_probe_count: number;
  required_probe_count: number;
  recovered_host_mode: MainAgentHostMode | null;
  recovered_orchestration_entry: MainAgentOrchestrationEntry | null;
  before_parity_snapshot: {
    hostMode: MainAgentHostMode;
    orchestrationEntry: MainAgentOrchestrationEntry;
    degradationLevel: MainAgentDegradationLevel;
    inspect: {
      status: 'completed' | 'blocked';
      packetId: string | null;
      resolvedHost: string | null;
      finalNextAction: string | null;
      pendingPacketStatus: string;
    } | null;
  };
  after_parity_snapshot: {
    hostMode: MainAgentHostMode | null;
    orchestrationEntry: MainAgentOrchestrationEntry | null;
    degradationLevel: MainAgentDegradationLevel;
    inspect: {
      status: 'completed' | 'blocked';
      packetId: string | null;
      resolvedHost: string | null;
      finalNextAction: string | null;
      pendingPacketStatus: string;
    } | null;
  };
  parity_diff: {
    hostModeChanged: boolean;
    orchestrationEntryChanged: boolean;
    degradationCleared: boolean;
  };
  recovery_log_path: string | null;
}

export interface UnifiedIngressReceipt {
  reportType: 'main_agent_unified_ingress';
  generatedAt: string;
  projectRoot: string;
  hostKind: MainAgentHostKind;
  hostMode: MainAgentHostMode;
  orchestrationEntry: MainAgentOrchestrationEntry;
  hookAvailable: boolean;
  degradationLevel: MainAgentDegradationLevel;
  degradationReason: MainAgentDegradationReason | null;
  hostRecovery: MainAgentHostRecovery;
  controlPlane: 'main-agent-orchestration';
  flow: RuntimeFlowId;
  stage: string;
  runLoop: {
    runId: string;
    sessionId: string | null;
    status: 'completed' | 'blocked';
    packetId: string | null;
    resolvedHost: string | null;
    finalNextAction: string | null;
    pendingPacketStatus: string;
  };
  sameControlPlane: true;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--') && argv[index + 1]) {
      out[token.slice(2)] = argv[++index];
    }
  }
  return out;
}

function hookPathFor(root: string, hostKind: MainAgentHostKind): string | null {
  if (hostKind === 'cursor') return path.join(root, '.cursor', 'hooks.json');
  if (hostKind === 'claude')
    return path.join(root, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
  return null;
}

function resolveEntry(input: {
  projectRoot: string;
  hostKind: MainAgentHostKind;
  forceNoHooks?: boolean;
  forceHostPartial?: boolean;
  forceTransportDegraded?: boolean;
}): Pick<
  UnifiedIngressReceipt,
  'hostMode' | 'orchestrationEntry' | 'hookAvailable' | 'degradationLevel' | 'degradationReason'
> {
  const hookPath = hookPathFor(input.projectRoot, input.hostKind);
  const hookAvailable = hookPath != null && fs.existsSync(hookPath);
  const detectedAt = new Date().toISOString();
  if (input.forceTransportDegraded) {
    return {
      hostMode: 'no_hooks',
      orchestrationEntry: 'cli_ingress',
      hookAvailable,
      degradationLevel: 'transport_degraded',
      degradationReason: {
        code: 'transport_degraded',
        hostKind: input.hostKind,
        hookPath,
        reason: 'transport probe reported degraded host transport; using cli_ingress',
        detected_at: detectedAt,
        failed_capability: 'transport',
        fallback_entry: 'cli_ingress',
        expected_behavior_change:
          'Main agent records degraded transport and requires clean recovery evidence before completion claims.',
      },
    };
  }
  if (input.forceHostPartial) {
    return {
      hostMode: input.hostKind === 'codex' ? 'no_hooks' : hookAvailable ? 'hooks_enabled' : 'no_hooks',
      orchestrationEntry: input.hostKind === 'codex' || !hookAvailable ? 'cli_ingress' : 'hook_ingress',
      hookAvailable,
      degradationLevel: 'host_partial',
      degradationReason: {
        code: 'host_partial',
        hostKind: input.hostKind,
        hookPath,
        reason: 'host capability probe reported partial support',
        detected_at: detectedAt,
        failed_capability: 'host_capability',
        fallback_entry: input.hostKind === 'codex' || !hookAvailable ? 'cli_ingress' : 'hook_ingress',
        expected_behavior_change:
          'Host remains on the main-agent control plane with partial capability recorded until parity evidence is restored.',
      },
    };
  }
  if (input.hostKind === 'codex') {
    return {
      hostMode: 'no_hooks',
      orchestrationEntry: 'cli_ingress',
      hookAvailable,
      degradationLevel: 'none',
      degradationReason: null,
    };
  }
  if (input.forceNoHooks) {
    return {
      hostMode: 'no_hooks',
      orchestrationEntry: 'cli_ingress',
      hookAvailable,
      degradationLevel: 'cli_forced',
      degradationReason: {
        code: 'forced_no_hooks',
        hostKind: input.hostKind,
        hookPath,
        reason: 'forceNoHooks requested; using cli_ingress',
        detected_at: detectedAt,
        failed_capability: 'operator_override',
        fallback_entry: 'cli_ingress',
        expected_behavior_change:
          'Host remains on the main-agent control plane but bypasses hook-triggered policy injection until recovery is confirmed.',
      },
    };
  }
  if (hookAvailable) {
    return {
      hostMode: 'hooks_enabled',
      orchestrationEntry: 'hook_ingress',
      hookAvailable,
      degradationLevel: 'none',
      degradationReason: null,
    };
  }
  return {
    hostMode: 'no_hooks',
    orchestrationEntry: 'cli_ingress',
    hookAvailable,
    degradationLevel: 'hook_lost',
    degradationReason: {
      code: 'hook_unavailable',
      hostKind: input.hostKind,
      hookPath,
      reason: 'hook unavailable; degraded to cli_ingress',
      detected_at: detectedAt,
      failed_capability: 'runtime_policy_hook',
      fallback_entry: 'cli_ingress',
      expected_behavior_change:
        'Runtime governance continues through CLI ingress; hook-only automation is unavailable until recovery probes pass.',
    },
  };
}

function probeHostRecovery(input: {
  projectRoot: string;
  hostKind: MainAgentHostKind;
  flow: RuntimeFlowId;
  stage: string;
  entry: Pick<UnifiedIngressReceipt, 'hostMode' | 'orchestrationEntry' | 'degradationLevel'>;
  runLoop?: Pick<
    ReturnType<typeof runMainAgentAutomaticLoop>,
    'status' | 'dispatchInstruction' | 'finalSurface'
  >;
}): MainAgentHostRecovery {
  const requiredProbeCount = 2;
  const toInspectSnapshot = (
    runLoop: Pick<
      ReturnType<typeof runMainAgentAutomaticLoop>,
      'status' | 'dispatchInstruction' | 'finalSurface'
    > | undefined
  ) =>
    runLoop
    ? {
        status: runLoop.status,
        packetId: runLoop.dispatchInstruction?.packetId ?? null,
        resolvedHost: runLoop.dispatchInstruction?.host ?? null,
        finalNextAction: runLoop.finalSurface.mainAgentNextAction,
        pendingPacketStatus: runLoop.finalSurface.pendingPacketStatus,
      }
    : null;
  const beforeInspectSnapshot = toInspectSnapshot(input.runLoop);
  const before = {
    hostMode: input.entry.hostMode,
    orchestrationEntry: input.entry.orchestrationEntry,
    degradationLevel: input.entry.degradationLevel,
    inspect: beforeInspectSnapshot,
  };
  if (input.entry.degradationLevel === 'none') {
    return {
      degradation_cleared_at: null,
      recovery_probe_count: 0,
      required_probe_count: 0,
      recovered_host_mode: null,
      recovered_orchestration_entry: null,
      before_parity_snapshot: before,
      after_parity_snapshot: {
        hostMode: input.entry.hostMode,
        orchestrationEntry: input.entry.orchestrationEntry,
        degradationLevel: input.entry.degradationLevel,
        inspect: beforeInspectSnapshot,
      },
      parity_diff: {
        hostModeChanged: false,
        orchestrationEntryChanged: false,
        degradationCleared: false,
      },
      recovery_log_path: null,
    };
  }
  const hookPath = hookPathFor(input.projectRoot, input.hostKind);
  const runHookHealthProbe = () => {
    if (!hookPath || !fs.existsSync(hookPath)) {
      return { hookAvailable: false, hookExecutable: false };
    }
    if (input.hostKind === 'claude') {
      try {
        // Health probe loads the runtime hook module; file existence alone is not sufficient.
        delete require.cache[require.resolve(hookPath)];
        require(hookPath);
        return { hookAvailable: true, hookExecutable: true };
      } catch {
        return { hookAvailable: true, hookExecutable: false };
      }
    }
    if (input.hostKind === 'cursor') {
      try {
        JSON.parse(fs.readFileSync(hookPath, 'utf8'));
        return { hookAvailable: true, hookExecutable: true };
      } catch {
        return { hookAvailable: true, hookExecutable: false };
      }
    }
    return { hookAvailable: false, hookExecutable: false };
  };
  const probes = Array.from({ length: requiredProbeCount }, (_, index) => ({
    index: index + 1,
    checked_at: new Date().toISOString(),
    hookPath,
    ...runHookHealthProbe(),
  }));
  const recovered = probes.length === requiredProbeCount && probes.every((probe) => probe.hookExecutable);
  const afterRunLoop = recovered
    ? runMainAgentAutomaticLoop({
        projectRoot: input.projectRoot,
        flow: input.flow,
        stage: input.stage,
        host: input.hostKind,
        args: {
          reportEvidence: `recovery-probe:${input.hostKind}`,
        },
        executor:
          input.hostKind === 'codex'
            ? undefined
            : ({ projectRoot: runRoot, instruction, args }) => {
                const reportPath = writeMainAgentRunLoopTaskReport(runRoot, instruction, args);
                return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
              },
      })
    : undefined;
  const afterInspectSnapshot = toInspectSnapshot(afterRunLoop);
  const inspectParityPassed =
    beforeInspectSnapshot != null &&
    afterInspectSnapshot != null &&
    beforeInspectSnapshot.status === 'completed' &&
    afterInspectSnapshot.status === 'completed' &&
    beforeInspectSnapshot.resolvedHost === input.hostKind &&
    afterInspectSnapshot.resolvedHost === input.hostKind &&
    beforeInspectSnapshot.pendingPacketStatus === 'completed' &&
    afterInspectSnapshot.pendingPacketStatus === 'completed';
  const backSwitchAllowed = recovered && inspectParityPassed;
  const after = {
    hostMode: backSwitchAllowed ? ('hooks_enabled' as MainAgentHostMode) : null,
    orchestrationEntry: backSwitchAllowed ? ('hook_ingress' as MainAgentOrchestrationEntry) : null,
    degradationLevel: backSwitchAllowed ? ('none' as MainAgentDegradationLevel) : input.entry.degradationLevel,
    inspect: afterInspectSnapshot,
  };
  const recovery: MainAgentHostRecovery = {
    degradation_cleared_at: backSwitchAllowed ? new Date().toISOString() : null,
    recovery_probe_count: probes.length,
    required_probe_count: requiredProbeCount,
    recovered_host_mode: after.hostMode,
    recovered_orchestration_entry: after.orchestrationEntry,
    before_parity_snapshot: before,
    after_parity_snapshot: after,
    parity_diff: {
      hostModeChanged: backSwitchAllowed && before.hostMode !== after.hostMode,
      orchestrationEntryChanged: backSwitchAllowed && before.orchestrationEntry !== after.orchestrationEntry,
      degradationCleared: backSwitchAllowed && before.degradationLevel !== after.degradationLevel,
    },
    recovery_log_path: null,
  };
  const logPath = path.join(
    input.projectRoot,
    '_bmad-output',
    'runtime',
    'ingress',
    'recovery',
    `${input.hostKind}-${input.entry.degradationLevel}-${Date.now()}.json`
  );
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        reportType: 'main_agent_host_recovery_probe',
        generatedAt: new Date().toISOString(),
        hostKind: input.hostKind,
        required_probe_count: requiredProbeCount,
        probes,
        before_parity_snapshot: recovery.before_parity_snapshot,
        after_parity_snapshot: recovery.after_parity_snapshot,
        parity_diff: recovery.parity_diff,
        recovered,
        inspect_parity_passed: inspectParityPassed,
        back_switch_allowed: backSwitchAllowed,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  recovery.recovery_log_path = logPath;
  return recovery;
}

export function runUnifiedIngress(input: {
  projectRoot: string;
  hostKind: MainAgentHostKind;
  flow: RuntimeFlowId;
  stage: string;
  forceNoHooks?: boolean;
  forceHostPartial?: boolean;
  forceTransportDegraded?: boolean;
  forceStateWriteFailure?: boolean;
  recoveryInspectHostOverride?: MainAgentHostKind;
}): UnifiedIngressReceipt {
  const projectRoot = path.resolve(input.projectRoot);
  const entry = resolveEntry({
    projectRoot,
    hostKind: input.hostKind,
    forceNoHooks: input.forceNoHooks,
    forceHostPartial: input.forceHostPartial,
    forceTransportDegraded: input.forceTransportDegraded,
  });
  const runLoop = runMainAgentAutomaticLoop({
    projectRoot,
    flow: input.flow,
    stage: input.stage,
    host: input.hostKind,
    args: {
      reportEvidence: `${entry.orchestrationEntry}:${input.hostKind}`,
    },
    executor:
      input.hostKind === 'codex'
        ? undefined
        : ({ projectRoot: runRoot, instruction, args }) => {
            const reportPath = writeMainAgentRunLoopTaskReport(runRoot, instruction, args);
            return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          },
  });
  const hostRecovery = probeHostRecovery({
    projectRoot,
    hostKind: input.hostKind,
    flow: input.flow,
    stage: input.stage,
    entry,
    runLoop: input.recoveryInspectHostOverride
      ? {
          ...runLoop,
          dispatchInstruction: runLoop.dispatchInstruction
            ? {
                ...runLoop.dispatchInstruction,
                host: input.recoveryInspectHostOverride,
              }
            : runLoop.dispatchInstruction,
        }
      : runLoop,
  });
  if (runLoop.dispatchInstruction?.sessionId) {
    if (input.forceStateWriteFailure) {
      throw new Error('host recovery state write failed: forced failure');
    }
    updateOrchestrationState(projectRoot, runLoop.dispatchInstruction.sessionId, (current) => ({
        ...current,
        hostRecovery: {
          degradation_level: entry.degradationLevel,
          active_host_mode: entry.hostMode,
          orchestration_entry: entry.orchestrationEntry,
          recovered_host_mode: hostRecovery.recovered_host_mode,
          recovered_orchestration_entry: hostRecovery.recovered_orchestration_entry,
          recovery_log_path: hostRecovery.recovery_log_path,
          updated_at: new Date().toISOString(),
        },
        longRun: current.longRun
          ? {
              ...current.longRun,
              degradation_level: entry.degradationLevel,
              active_host_mode: entry.hostMode,
            }
          : current.longRun,
    }));
  }
  return {
    reportType: 'main_agent_unified_ingress',
    generatedAt: new Date().toISOString(),
    projectRoot,
    hostKind: input.hostKind,
    ...entry,
    hostRecovery,
    controlPlane: 'main-agent-orchestration',
    flow: input.flow,
    stage: input.stage,
    runLoop: {
      runId: runLoop.runId,
      sessionId: runLoop.dispatchInstruction?.sessionId ?? null,
      status: runLoop.status,
      packetId: runLoop.dispatchInstruction?.packetId ?? null,
      resolvedHost: runLoop.dispatchInstruction?.host ?? null,
      finalNextAction: runLoop.finalSurface.mainAgentNextAction,
      pendingPacketStatus: runLoop.finalSurface.pendingPacketStatus,
    },
    sameControlPlane: true,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const hostKind: MainAgentHostKind =
    args.hostKind === 'claude' || args.hostKind === 'codex' ? args.hostKind : 'cursor';
  const receipt = runUnifiedIngress({
    projectRoot: path.resolve(args.cwd ?? process.cwd()),
    hostKind,
    flow: (args.flow as RuntimeFlowId | undefined) ?? 'story',
    stage: args.stage ?? 'implement',
    forceNoHooks: args.forceNoHooks === 'true',
    forceHostPartial: args.forceHostPartial === 'true',
    forceTransportDegraded: args.forceTransportDegraded === 'true',
    forceStateWriteFailure: args.forceStateWriteFailure === 'true',
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        receipt.projectRoot,
        '_bmad-output',
        'runtime',
        'ingress',
        `${hostKind}-${receipt.orchestrationEntry}.json`
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ reportPath, ...receipt }, null, 2));
  return receipt.runLoop.status === 'completed' ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
