"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUnifiedIngress = runUnifiedIngress;
exports.runUnifiedIngressAsync = runUnifiedIngressAsync;
exports.main = main;
exports.mainAsync = mainAsync;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const main_agent_orchestration_1 = require("./main-agent-orchestration");
const orchestration_state_1 = require("./orchestration-state");
const governance_transport_envelope_1 = require("./governance-transport-envelope");
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith('--') && argv[index + 1]) {
            out[token.slice(2)] = argv[++index];
        }
    }
    return out;
}
function hookPathFor(root, hostKind) {
    if (hostKind === 'cursor')
        return path.join(root, '.cursor', 'hooks.json');
    if (hostKind === 'claude')
        return path.join(root, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
    return path.join(root, '.codex', 'hooks', 'hooks.json');
}
function normalizeRecordId(value, fieldName) {
    const trimmed = value?.trim();
    if (!trimmed)
        throw new Error(`${fieldName} is required for requirement-scoped unified ingress output`);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(trimmed)) {
        throw new Error(`${fieldName} contains unsupported path characters`);
    }
    return trimmed;
}
function requirementScopedIngressDir(root, recordId) {
    return path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'artifacts', 'ingress');
}
function resolveEntry(input) {
    const hookPath = hookPathFor(input.projectRoot, input.hostKind);
    const registryHash = input.governanceEventTypeRegistryHash ??
        (input.governanceEventTypeRegistry
            ? (0, governance_transport_envelope_1.governanceEventTypeRegistryHash)(input.governanceEventTypeRegistry)
            : undefined);
    const registryPolicyHash = input.governanceEventTypeRegistryPolicyHash ??
        (input.governanceEventTypeRegistryPolicy
            ? (0, governance_transport_envelope_1.governanceEventTypeRegistryPolicyHash)(input.governanceEventTypeRegistryPolicy)
            : undefined);
    const codexHookTrustValidation = input.hostKind === 'codex' && input.codexHookTrustEnvelope
        ? (0, governance_transport_envelope_1.validateGovernanceTransportEnvelope)(input.codexHookTrustEnvelope, {
            governanceEventTypeRegistryPolicy: input.governanceEventTypeRegistryPolicy,
            registryPolicyHash,
            governanceEventTypeRegistry: input.governanceEventTypeRegistry,
            registryHash,
            architectureConfirmationHash: input.architectureConfirmationHash,
        })
        : null;
    const codexHookTrustAccepted = input.hostKind === 'codex' &&
        codexHookTrustValidation?.ok === true &&
        input.codexHookTrustEnvelope?.hostMode === 'hooks_enabled';
    const hookAvailable = hookPath != null && (fs.existsSync(hookPath) || codexHookTrustAccepted);
    const detectedAt = new Date().toISOString();
    if (input.forceTransportDegraded) {
        return {
            hostMode: 'no_hooks',
            orchestrationEntry: 'cli_ingress',
            hookAvailable,
            degradationLevel: 'transport_degraded',
            hookTrust: 'degraded',
            hookTrustEnvelopeValidation: null,
            degradationReason: {
                code: 'transport_degraded',
                hostKind: input.hostKind,
                hookPath,
                reason: 'transport probe reported degraded host transport; using cli_ingress',
                detected_at: detectedAt,
                failed_capability: 'transport',
                fallback_entry: 'cli_ingress',
                expected_behavior_change: 'Main agent records degraded transport and requires clean recovery evidence before completion claims.',
            },
        };
    }
    if (input.forceHostPartial) {
        return {
            hostMode: input.hostKind === 'codex' ? 'no_hooks' : hookAvailable ? 'hooks_enabled' : 'no_hooks',
            orchestrationEntry: input.hostKind === 'codex' || !hookAvailable ? 'cli_ingress' : 'hook_ingress',
            hookAvailable,
            degradationLevel: 'host_partial',
            hookTrust: input.hostKind === 'codex' ? 'untrusted' : 'degraded',
            hookTrustEnvelopeValidation: null,
            degradationReason: {
                code: 'host_partial',
                hostKind: input.hostKind,
                hookPath,
                reason: 'host capability probe reported partial support',
                detected_at: detectedAt,
                failed_capability: 'host_capability',
                fallback_entry: input.hostKind === 'codex' || !hookAvailable ? 'cli_ingress' : 'hook_ingress',
                expected_behavior_change: 'Host remains on the main-agent control plane with partial capability recorded until parity evidence is restored.',
            },
        };
    }
    if (input.hostKind === 'codex') {
        if (codexHookTrustAccepted) {
            return {
                hostMode: 'hooks_enabled',
                orchestrationEntry: 'hook_ingress',
                hookAvailable,
                degradationLevel: 'none',
                hookTrust: 'trusted',
                hookTrustEnvelopeValidation: codexHookTrustValidation,
                degradationReason: null,
            };
        }
        return {
            hostMode: 'no_hooks',
            orchestrationEntry: 'cli_ingress',
            hookAvailable,
            degradationLevel: input.codexHookTrustEnvelope ? 'host_partial' : 'none',
            hookTrust: input.codexHookTrustEnvelope ? 'untrusted' : 'not_applicable',
            hookTrustEnvelopeValidation: codexHookTrustValidation,
            degradationReason: input.codexHookTrustEnvelope
                ? {
                    code: 'codex_hook_trust_unverified',
                    hostKind: input.hostKind,
                    hookPath,
                    reason: `Codex hook trust envelope rejected: ${codexHookTrustValidation?.mismatches.join(', ') || 'missing validation'}`,
                    detected_at: detectedAt,
                    failed_capability: 'host_capability',
                    fallback_entry: 'cli_ingress',
                    expected_behavior_change: 'Codex remains on no-hook CLI ingress until capability probe, SessionStart smoke, config hash, runtime policy hash, and trust receipt all pass.',
                }
                : null,
        };
    }
    if (input.forceNoHooks) {
        return {
            hostMode: 'no_hooks',
            orchestrationEntry: 'cli_ingress',
            hookAvailable,
            degradationLevel: 'cli_forced',
            hookTrust: hookAvailable ? 'degraded' : 'not_applicable',
            hookTrustEnvelopeValidation: null,
            degradationReason: {
                code: 'forced_no_hooks',
                hostKind: input.hostKind,
                hookPath,
                reason: 'forceNoHooks requested; using cli_ingress',
                detected_at: detectedAt,
                failed_capability: 'operator_override',
                fallback_entry: 'cli_ingress',
                expected_behavior_change: 'Host remains on the main-agent control plane but bypasses hook-triggered policy injection until recovery is confirmed.',
            },
        };
    }
    if (hookAvailable) {
        return {
            hostMode: 'hooks_enabled',
            orchestrationEntry: 'hook_ingress',
            hookAvailable,
            degradationLevel: 'none',
            hookTrust: 'trusted',
            hookTrustEnvelopeValidation: null,
            degradationReason: null,
        };
    }
    return {
        hostMode: 'no_hooks',
        orchestrationEntry: 'cli_ingress',
        hookAvailable,
        degradationLevel: 'hook_lost',
        hookTrust: 'not_applicable',
        hookTrustEnvelopeValidation: null,
        degradationReason: {
            code: 'hook_unavailable',
            hostKind: input.hostKind,
            hookPath,
            reason: 'hook unavailable; degraded to cli_ingress',
            detected_at: detectedAt,
            failed_capability: 'runtime_policy_hook',
            fallback_entry: 'cli_ingress',
            expected_behavior_change: 'Runtime governance continues through CLI ingress; hook-only automation is unavailable until recovery probes pass.',
        },
    };
}
function probeHostRecovery(input) {
    const requiredProbeCount = 2;
    const toInspectSnapshot = (runLoop) => runLoop
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
            }
            catch {
                return { hookAvailable: true, hookExecutable: false };
            }
        }
        if (input.hostKind === 'cursor') {
            try {
                JSON.parse(fs.readFileSync(hookPath, 'utf8'));
                return { hookAvailable: true, hookExecutable: true };
            }
            catch {
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
        ? (0, main_agent_orchestration_1.runMainAgentAutomaticLoop)({
            projectRoot: input.projectRoot,
            recordId: input.recordId,
            requirementSetId: input.requirementSetId,
            flow: input.flow,
            stage: input.stage,
            host: input.hostKind,
            args: {
                reportEvidence: `recovery-probe:${input.hostKind}`,
            },
            executor: input.hostKind === 'codex'
                ? undefined
                : ({ projectRoot: runRoot, instruction, args }) => {
                    const reportPath = (0, main_agent_orchestration_1.writeMainAgentRunLoopTaskReport)(runRoot, instruction, args);
                    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                },
        })
        : undefined;
    const afterInspectSnapshot = toInspectSnapshot(afterRunLoop);
    const inspectParityPassed = beforeInspectSnapshot != null &&
        afterInspectSnapshot != null &&
        beforeInspectSnapshot.status === 'completed' &&
        afterInspectSnapshot.status === 'completed' &&
        beforeInspectSnapshot.resolvedHost === input.hostKind &&
        afterInspectSnapshot.resolvedHost === input.hostKind &&
        beforeInspectSnapshot.pendingPacketStatus === 'completed' &&
        afterInspectSnapshot.pendingPacketStatus === 'completed';
    const backSwitchAllowed = recovered && inspectParityPassed;
    const after = {
        hostMode: backSwitchAllowed ? 'hooks_enabled' : null,
        orchestrationEntry: backSwitchAllowed ? 'hook_ingress' : null,
        degradationLevel: backSwitchAllowed
            ? 'none'
            : input.entry.degradationLevel,
        inspect: afterInspectSnapshot,
    };
    const recovery = {
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
    const logPath = path.join(requirementScopedIngressDir(input.projectRoot, input.recordId), 'recovery', `${input.hostKind}-${input.entry.degradationLevel}-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify({
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
    }, null, 2) + '\n', 'utf8');
    recovery.recovery_log_path = logPath;
    return recovery;
}
async function probeHostRecoveryAsync(input) {
    const requiredProbeCount = 2;
    const toInspectSnapshot = (runLoop) => runLoop
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
                delete require.cache[require.resolve(hookPath)];
                require(hookPath);
                return { hookAvailable: true, hookExecutable: true };
            }
            catch {
                return { hookAvailable: true, hookExecutable: false };
            }
        }
        if (input.hostKind === 'cursor') {
            try {
                JSON.parse(fs.readFileSync(hookPath, 'utf8'));
                return { hookAvailable: true, hookExecutable: true };
            }
            catch {
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
        ? await (0, main_agent_orchestration_1.runMainAgentAutomaticLoopAsync)({
            projectRoot: input.projectRoot,
            recordId: input.recordId,
            requirementSetId: input.requirementSetId,
            flow: input.flow,
            stage: input.stage,
            host: input.hostKind,
            args: {
                reportEvidence: `recovery-probe:${input.hostKind}`,
            },
            executor: input.hostKind === 'codex'
                ? undefined
                : ({ projectRoot: runRoot, instruction, args }) => {
                    const reportPath = (0, main_agent_orchestration_1.writeMainAgentRunLoopTaskReport)(runRoot, instruction, args);
                    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                },
        })
        : undefined;
    const afterInspectSnapshot = toInspectSnapshot(afterRunLoop);
    const inspectParityPassed = beforeInspectSnapshot != null &&
        afterInspectSnapshot != null &&
        beforeInspectSnapshot.status === 'completed' &&
        afterInspectSnapshot.status === 'completed' &&
        beforeInspectSnapshot.resolvedHost === input.hostKind &&
        afterInspectSnapshot.resolvedHost === input.hostKind &&
        beforeInspectSnapshot.pendingPacketStatus === 'completed' &&
        afterInspectSnapshot.pendingPacketStatus === 'completed';
    const backSwitchAllowed = recovered && inspectParityPassed;
    const after = {
        hostMode: backSwitchAllowed ? 'hooks_enabled' : null,
        orchestrationEntry: backSwitchAllowed ? 'hook_ingress' : null,
        degradationLevel: backSwitchAllowed
            ? 'none'
            : input.entry.degradationLevel,
        inspect: afterInspectSnapshot,
    };
    const recovery = {
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
    const logPath = path.join(requirementScopedIngressDir(input.projectRoot, input.recordId), 'recovery', `${input.hostKind}-${input.entry.degradationLevel}-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify({
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
    }, null, 2) + '\n', 'utf8');
    recovery.recovery_log_path = logPath;
    return recovery;
}
function runUnifiedIngress(input) {
    const projectRoot = path.resolve(input.projectRoot);
    const recordId = normalizeRecordId(input.recordId, 'recordId');
    const requirementSetId = normalizeRecordId(input.requirementSetId ?? input.recordId, 'requirementSetId');
    const entry = resolveEntry({
        projectRoot,
        hostKind: input.hostKind,
        codexHookTrustEnvelope: input.codexHookTrustEnvelope,
        governanceEventTypeRegistryPolicy: input.governanceEventTypeRegistryPolicy,
        governanceEventTypeRegistryPolicyHash: input.governanceEventTypeRegistryPolicyHash,
        governanceEventTypeRegistry: input.governanceEventTypeRegistry,
        governanceEventTypeRegistryHash: input.governanceEventTypeRegistryHash,
        architectureConfirmationHash: input.architectureConfirmationHash,
        forceNoHooks: input.forceNoHooks,
        forceHostPartial: input.forceHostPartial,
        forceTransportDegraded: input.forceTransportDegraded,
    });
    const runLoop = (0, main_agent_orchestration_1.runMainAgentAutomaticLoop)({
        projectRoot,
        recordId,
        requirementSetId,
        flow: input.flow,
        stage: input.stage,
        host: input.hostKind,
        args: {
            reportEvidence: `${entry.orchestrationEntry}:${input.hostKind}`,
        },
        executor: input.hostKind === 'codex'
            ? undefined
            : ({ projectRoot: runRoot, instruction, args }) => {
                const reportPath = (0, main_agent_orchestration_1.writeMainAgentRunLoopTaskReport)(runRoot, instruction, args);
                return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            },
    });
    const hostRecovery = probeHostRecovery({
        projectRoot,
        recordId,
        requirementSetId,
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
        (0, orchestration_state_1.updateOrchestrationState)(projectRoot, runLoop.dispatchInstruction.sessionId, (current) => ({
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
        recordId,
        requirementSetId,
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
async function runUnifiedIngressAsync(input) {
    const projectRoot = path.resolve(input.projectRoot);
    const recordId = normalizeRecordId(input.recordId, 'recordId');
    const requirementSetId = normalizeRecordId(input.requirementSetId ?? input.recordId, 'requirementSetId');
    const entry = resolveEntry({
        projectRoot,
        hostKind: input.hostKind,
        codexHookTrustEnvelope: input.codexHookTrustEnvelope,
        governanceEventTypeRegistryPolicy: input.governanceEventTypeRegistryPolicy,
        governanceEventTypeRegistryPolicyHash: input.governanceEventTypeRegistryPolicyHash,
        governanceEventTypeRegistry: input.governanceEventTypeRegistry,
        governanceEventTypeRegistryHash: input.governanceEventTypeRegistryHash,
        architectureConfirmationHash: input.architectureConfirmationHash,
        forceNoHooks: input.forceNoHooks,
        forceHostPartial: input.forceHostPartial,
        forceTransportDegraded: input.forceTransportDegraded,
    });
    const runLoop = await (0, main_agent_orchestration_1.runMainAgentAutomaticLoopAsync)({
        projectRoot,
        recordId,
        requirementSetId,
        flow: input.flow,
        stage: input.stage,
        host: input.hostKind,
        args: {
            reportEvidence: `${entry.orchestrationEntry}:${input.hostKind}`,
        },
        executor: input.hostKind === 'codex'
            ? undefined
            : ({ projectRoot: runRoot, instruction, args }) => {
                const reportPath = (0, main_agent_orchestration_1.writeMainAgentRunLoopTaskReport)(runRoot, instruction, args);
                return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            },
    });
    const hostRecovery = await probeHostRecoveryAsync({
        projectRoot,
        recordId,
        requirementSetId,
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
        (0, orchestration_state_1.updateOrchestrationState)(projectRoot, runLoop.dispatchInstruction.sessionId, (current) => ({
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
        recordId,
        requirementSetId,
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
function main(argv) {
    const args = parseArgs(argv);
    const hostKind = args.hostKind === 'claude' || args.hostKind === 'codex' ? args.hostKind : 'cursor';
    const projectRoot = path.resolve(args.cwd ?? process.cwd());
    const recordId = normalizeRecordId(args.recordId, 'recordId');
    const requirementSetId = normalizeRecordId(args.requirementSetId ?? args.recordId, 'requirementSetId');
    const receipt = runUnifiedIngress({
        projectRoot,
        recordId,
        requirementSetId,
        hostKind,
        flow: args.flow ?? 'story',
        stage: args.stage ?? 'implement',
        codexHookTrustEnvelope: args.codexHookTrustEnvelopePath
            ? JSON.parse(fs.readFileSync(path.resolve(projectRoot, args.codexHookTrustEnvelopePath), 'utf8'))
            : null,
        governanceEventTypeRegistry: args.governanceEventTypeRegistryPath
            ? JSON.parse(fs.readFileSync(path.resolve(projectRoot, args.governanceEventTypeRegistryPath), 'utf8'))
            : undefined,
        governanceEventTypeRegistryPolicy: args.governanceEventTypeRegistryPolicyPath
            ? JSON.parse(fs.readFileSync(path.resolve(projectRoot, args.governanceEventTypeRegistryPolicyPath), 'utf8'))
            : undefined,
        governanceEventTypeRegistryPolicyHash: args.governanceEventTypeRegistryPolicyHash,
        governanceEventTypeRegistryHash: args.governanceEventTypeRegistryHash,
        architectureConfirmationHash: args.architectureConfirmationHash,
        forceNoHooks: args.forceNoHooks === 'true',
        forceHostPartial: args.forceHostPartial === 'true',
        forceTransportDegraded: args.forceTransportDegraded === 'true',
        forceStateWriteFailure: args.forceStateWriteFailure === 'true',
    });
    const reportPath = path.resolve(args.reportPath ??
        path.join(requirementScopedIngressDir(receipt.projectRoot, receipt.recordId), `${hostKind}-${receipt.orchestrationEntry}.json`));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({ reportPath, ...receipt }, null, 2));
    return receipt.runLoop.status === 'completed' ? 0 : 1;
}
async function mainAsync(argv) {
    const args = parseArgs(argv);
    const hostKind = args.hostKind === 'claude' || args.hostKind === 'codex' ? args.hostKind : 'cursor';
    const projectRoot = path.resolve(args.cwd ?? process.cwd());
    const recordId = normalizeRecordId(args.recordId, 'recordId');
    const requirementSetId = normalizeRecordId(args.requirementSetId ?? args.recordId, 'requirementSetId');
    const receipt = await runUnifiedIngressAsync({
        projectRoot,
        recordId,
        requirementSetId,
        hostKind,
        flow: args.flow ?? 'story',
        stage: args.stage ?? 'implement',
        codexHookTrustEnvelope: args.codexHookTrustEnvelopePath
            ? JSON.parse(fs.readFileSync(path.resolve(projectRoot, args.codexHookTrustEnvelopePath), 'utf8'))
            : null,
        governanceEventTypeRegistry: args.governanceEventTypeRegistryPath
            ? JSON.parse(fs.readFileSync(path.resolve(projectRoot, args.governanceEventTypeRegistryPath), 'utf8'))
            : undefined,
        governanceEventTypeRegistryPolicy: args.governanceEventTypeRegistryPolicyPath
            ? JSON.parse(fs.readFileSync(path.resolve(projectRoot, args.governanceEventTypeRegistryPolicyPath), 'utf8'))
            : undefined,
        governanceEventTypeRegistryPolicyHash: args.governanceEventTypeRegistryPolicyHash,
        governanceEventTypeRegistryHash: args.governanceEventTypeRegistryHash,
        architectureConfirmationHash: args.architectureConfirmationHash,
        forceNoHooks: args.forceNoHooks === 'true',
        forceHostPartial: args.forceHostPartial === 'true',
        forceTransportDegraded: args.forceTransportDegraded === 'true',
        forceStateWriteFailure: args.forceStateWriteFailure === 'true',
    });
    const reportPath = path.resolve(args.reportPath ??
        path.join(requirementScopedIngressDir(receipt.projectRoot, receipt.recordId), `${hostKind}-${receipt.orchestrationEntry}.json`));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({ reportPath, ...receipt }, null, 2));
    return receipt.runLoop.status === 'completed' ? 0 : 1;
}
if (require.main === module) {
    void mainAsync(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
