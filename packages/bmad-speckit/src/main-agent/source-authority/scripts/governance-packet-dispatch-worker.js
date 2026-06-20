"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubGovernanceExecutionAdapter = void 0;
exports.createAcceptedPlaceholderDispatchAdapter = createAcceptedPlaceholderDispatchAdapter;
exports.processPendingExecutionRecords = processPendingExecutionRecords;
const governance_remediation_config_1 = require("./governance-remediation-config");
const governance_packet_execution_store_1 = require("./governance-packet-execution-store");
const governance_host_dispatch_adapter_1 = require("./governance-host-dispatch-adapter");
class StubGovernanceExecutionAdapter {
    outcome;
    constructor(outcome) {
        this.outcome = outcome;
    }
    async launch() {
        return this.outcome;
    }
}
exports.StubGovernanceExecutionAdapter = StubGovernanceExecutionAdapter;
function nowIso(input) {
    return (input ?? new Date()).toISOString();
}
function addSeconds(input, seconds) {
    return new Date(input.getTime() + seconds * 1000).toISOString();
}
function isLeaseActive(record, now) {
    if (!record.leaseOwner || !record.leaseExpiresAt) {
        return false;
    }
    const expiresAt = Date.parse(record.leaseExpiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
function buildLaunchInfo(outcome, metadata = {}) {
    return {
        externalRunId: 'externalRunId' in outcome ? (outcome.externalRunId ?? null) : null,
        note: 'reason' in outcome ? (outcome.reason ?? null) : null,
        metadata: {
            ...('metadata' in outcome && outcome.metadata && typeof outcome.metadata === 'object'
                ? outcome.metadata
                : {}),
            ...metadata,
        },
    };
}
function createAcceptedPlaceholderDispatchAdapter(reason = 'execution accepted into placeholder dispatch lane') {
    return {
        async launch(input) {
            return {
                kind: 'accepted',
                reason,
                externalRunId: `placeholder-${input.executionId}`,
            };
        },
    };
}
async function processPendingExecutionRecords(projectRoot, options = {}) {
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(projectRoot);
    if (config.execution?.fallbackAutonomousMode === false) {
        return [];
    }
    const adapter = options.adapter ??
        (0, governance_host_dispatch_adapter_1.createGovernanceHostDispatchAdapter)({
            env: {
                ...(options.launchEnv ?? process.env),
                BMAD_GOVERNANCE_ALLOW_AUTONOMOUS_FALLBACK: '1',
            },
            startupTimeoutMs: options.startupTimeoutMs,
        });
    const now = options.now ?? new Date();
    const leaseOwner = options.leaseOwner ?? `dispatch-worker-${process.pid}`;
    const records = (0, governance_packet_execution_store_1.listGovernancePacketExecutionRecords)(projectRoot).filter((record) => ['pending_dispatch', 'retry_pending', 'leased'].includes(record.status));
    const updated = [];
    for (const record of records) {
        if (record.status === 'leased' && isLeaseActive(record, now)) {
            continue;
        }
        const leased = (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
            ...current,
            status: 'leased',
            leaseOwner,
            leaseAcquiredAt: nowIso(now),
            leaseExpiresAt: addSeconds(now, options.leaseTimeoutSeconds ?? config.execution?.dispatch.leaseTimeoutSeconds ?? 900),
            history: [
                ...current.history,
                { at: nowIso(now), kind: 'dispatch-lease-acquired', note: leaseOwner },
            ],
        }));
        const observedAt = nowIso(now);
        const maxDispatchAttempts = options.maxDispatchAttempts ?? config.execution?.escalation.afterDispatchFailures ?? 3;
        const hostCandidates = [leased.authoritativeHost, ...leased.fallbackHosts];
        let dispatchAttemptCount = leased.dispatchAttemptCount;
        const history = [...leased.history];
        let lastDispatchError = leased.lastDispatchError ?? null;
        let lastLaunch = leased.lastLaunch ?? null;
        let acceptedRecord = null;
        for (const hostKind of hostCandidates) {
            const packetPath = leased.packetPaths[hostKind];
            dispatchAttemptCount += 1;
            if (!packetPath) {
                lastDispatchError = `missing packet for host ${hostKind}`;
                history.push({
                    at: observedAt,
                    kind: 'dispatch-failed',
                    note: lastDispatchError,
                });
                if (dispatchAttemptCount >= maxDispatchAttempts) {
                    break;
                }
                continue;
            }
            const outcome = await adapter.launch({
                executionId: leased.executionId,
                authoritativeHost: hostKind,
                packetPath,
                leaseOwner,
                timeoutMs: (options.timeoutMinutes ?? config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000,
                projectRoot,
            });
            lastLaunch = buildLaunchInfo(outcome, {
                configuredAuthoritativeHost: leased.authoritativeHost,
                dispatchedHost: hostKind,
                fallbackUsed: hostKind !== leased.authoritativeHost,
                packetPath,
            });
            if (outcome.kind === 'accepted') {
                history.push({
                    at: observedAt,
                    kind: 'dispatch-accepted',
                    note: hostKind === leased.authoritativeHost
                        ? (outcome.reason ?? `accepted by ${hostKind}`)
                        : `fallback ${hostKind} accepted${outcome.reason ? `: ${outcome.reason}` : ''}`,
                });
                acceptedRecord = (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, leased.loopStateId, leased.attemptNumber, (current) => ({
                    ...current,
                    status: 'running',
                    dispatchAttemptCount,
                    lastDispatchError: null,
                    lastLaunch,
                    history,
                }));
                break;
            }
            lastDispatchError = outcome.reason;
            history.push({
                at: observedAt,
                kind: outcome.kind === 'rejected' ? 'dispatch-rejected' : 'dispatch-failed',
                note: hostKind === leased.authoritativeHost
                    ? `${hostKind}: ${outcome.reason}`
                    : `fallback ${hostKind}: ${outcome.reason}`,
            });
            if (dispatchAttemptCount >= maxDispatchAttempts) {
                break;
            }
        }
        if (acceptedRecord) {
            updated.push(acceptedRecord);
            continue;
        }
        const shouldEscalate = dispatchAttemptCount >= maxDispatchAttempts;
        updated.push((0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, leased.loopStateId, leased.attemptNumber, (current) => ({
            ...current,
            status: shouldEscalate ? 'escalated' : 'retry_pending',
            dispatchAttemptCount,
            leaseOwner: null,
            leaseAcquiredAt: null,
            leaseExpiresAt: null,
            lastDispatchError,
            lastLaunch,
            history: [
                ...history,
                ...(shouldEscalate
                    ? [
                        {
                            at: observedAt,
                            kind: 'escalated',
                            note: `dispatch failures reached ${maxDispatchAttempts}`,
                        },
                    ]
                    : []),
            ],
        })));
    }
    return updated;
}
function main() {
    if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
        return;
    }
    if (require.main !== module) {
        return;
    }
    const projectRoot = process.argv[2] || process.cwd();
    void processPendingExecutionRecords(projectRoot)
        .then((records) => {
        process.stdout.write(JSON.stringify(records, null, 2));
    })
        .catch((error) => {
        process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
        process.exitCode = 1;
    });
}
main();
