"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestGovernanceExecutionResult = ingestGovernanceExecutionResult;
exports.ingestGovernanceTransportEnvelope = ingestGovernanceTransportEnvelope;
exports.ingestGovernanceRerunGateResult = ingestGovernanceRerunGateResult;
const governance_remediation_config_1 = require("./governance-remediation-config");
const governance_packet_execution_store_1 = require("./governance-packet-execution-store");
const governance_transport_envelope_1 = require("./governance-transport-envelope");
const SUPPORTED_INGEST_ENVELOPE_EVENT_TYPES = new Set([
    'execution_iteration_recorded',
    'gate_check_recorded',
]);
function nowIso() {
    return new Date().toISOString();
}
function countHistoryEntries(record, kind) {
    return record.history.filter((entry) => entry.kind === kind).length;
}
function ingestGovernanceExecutionResult(projectRootOrInput, maybeInput) {
    const projectRoot = typeof projectRootOrInput === 'string' ? projectRootOrInput : projectRootOrInput.projectRoot;
    const input = typeof projectRootOrInput === 'string'
        ? maybeInput
        : projectRootOrInput;
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(projectRoot);
    const maxFailures = config.execution?.escalation.afterExecutionFailures ?? 2;
    return (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, input.loopStateId, input.attemptNumber, (record) => {
        if (!['running', 'pending_dispatch'].includes(record.status)) {
            return record;
        }
        const isSuccess = input.result.outcome === 'completed';
        const completesWithoutRerunGate = isSuccess && record.rerunGate === 'implementation-resume';
        const failureCount = countHistoryEntries(record, 'execution-result') + (isSuccess ? 0 : 1);
        return {
            ...record,
            status: completesWithoutRerunGate
                ? 'gate_passed'
                : isSuccess
                    ? 'awaiting_rerun_gate'
                    : failureCount >= maxFailures
                        ? 'escalated'
                        : 'retry_pending',
            leaseOwner: null,
            leaseAcquiredAt: null,
            leaseExpiresAt: null,
            executionAttemptCount: record.executionAttemptCount + 1,
            lastExecutionResult: input.result,
            rerunGateSchedule: completesWithoutRerunGate
                ? {
                    status: 'completed',
                    scheduledAt: null,
                    observedAt: input.result.observedAt,
                    note: 'implementation resume completed without an additional rerun gate',
                }
                : isSuccess
                    ? {
                        status: config.execution?.rerunGate.autoSchedule ? 'scheduled' : 'pending',
                        scheduledAt: config.execution?.rerunGate.autoSchedule ? nowIso() : null,
                        observedAt: null,
                        note: config.execution?.rerunGate.autoSchedule
                            ? 'rerun gate scheduled after successful execution result ingestion'
                            : 'rerun gate awaiting external scheduling',
                    }
                    : record.rerunGateSchedule,
            history: [
                ...record.history,
                {
                    at: input.result.observedAt,
                    kind: 'execution-result',
                    note: `${input.result.outcome}${input.result.error ? `: ${input.result.error}` : ''}`,
                },
                ...(failureCount >= maxFailures && !isSuccess
                    ? [
                        {
                            at: input.result.observedAt,
                            kind: 'escalated',
                            note: `execution failures reached ${maxFailures}`,
                        },
                    ]
                    : []),
            ],
        };
    });
}
function ingestGovernanceTransportEnvelope(projectRoot, envelope, validationOptions = {}) {
    (0, governance_transport_envelope_1.assertGovernanceTransportEnvelope)(envelope, validationOptions);
    if (!SUPPORTED_INGEST_ENVELOPE_EVENT_TYPES.has(envelope.eventType)) {
        throw new Error(`unsupported governance-execution-result-ingestor eventType: ${envelope.eventType}`);
    }
    if (envelope.eventType === 'execution_iteration_recorded') {
        const payload = envelope.payload;
        return ingestGovernanceExecutionResult({
            projectRoot,
            loopStateId: payload.loopStateId,
            attemptNumber: payload.attemptNumber,
            result: payload.execution,
        });
    }
    const payload = envelope.payload;
    return ingestGovernanceRerunGateResult({
        projectRoot,
        loopStateId: payload.loopStateId,
        attemptNumber: payload.attemptNumber,
        rerunGateResult: payload.rerunGate,
    });
}
function ingestGovernanceRerunGateResult(projectRootOrInput, maybeInput) {
    const projectRoot = typeof projectRootOrInput === 'string' ? projectRootOrInput : projectRootOrInput.projectRoot;
    const input = typeof projectRootOrInput === 'string'
        ? maybeInput
        : projectRootOrInput;
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(projectRoot);
    const target = typeof input.attemptNumber === 'number'
        ? { loopStateId: input.loopStateId, attemptNumber: input.attemptNumber }
        : (0, governance_packet_execution_store_1.findLatestActiveGovernancePacketExecutionRecord)(projectRoot, input.loopStateId);
    if (!target) {
        return null;
    }
    const attemptNumber = 'attemptNumber' in target
        ? target.attemptNumber
        : target.attemptNumber;
    const maxGateFailures = config.execution?.escalation.afterGateFailures ?? 2;
    return (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, input.loopStateId, attemptNumber, (record) => {
        if (!['awaiting_rerun_gate', 'retry_pending', 'pending_dispatch', 'running'].includes(record.status)) {
            return record;
        }
        const isPass = input.rerunGateResult.status === 'pass';
        const failureCount = countHistoryEntries(record, 'rerun-gate-result') + (isPass ? 0 : 1);
        return {
            ...record,
            status: isPass
                ? 'gate_passed'
                : failureCount >= maxGateFailures
                    ? 'escalated'
                    : 'retry_pending',
            leaseOwner: null,
            leaseAcquiredAt: null,
            leaseExpiresAt: null,
            lastRerunGateResult: input.rerunGateResult,
            rerunGateSchedule: {
                ...(record.rerunGateSchedule ?? {
                    status: 'pending',
                    scheduledAt: null,
                    observedAt: null,
                    note: null,
                }),
                status: isPass ? 'completed' : 'failed',
                observedAt: input.rerunGateResult.observedAt ?? nowIso(),
                note: input.rerunGateResult.summary ?? null,
            },
            history: [
                ...record.history,
                {
                    at: input.rerunGateResult.observedAt ?? nowIso(),
                    kind: 'rerun-gate-result',
                    note: `${input.rerunGateResult.status}: ${input.rerunGateResult.summary ?? '(none)'}`,
                },
                ...(!isPass && failureCount >= maxGateFailures
                    ? [
                        {
                            at: input.rerunGateResult.observedAt ?? nowIso(),
                            kind: 'escalated',
                            note: `rerun gate failures reached ${maxGateFailures}`,
                        },
                    ]
                    : []),
            ],
        };
    });
}
function main() {
    if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
        return;
    }
    if (require.main !== module) {
        return;
    }
    const payloadArg = process.argv[2];
    if (!payloadArg) {
        process.stderr.write('Usage: node governance-execution-result-ingestor.cjs <json-payload>\n');
        process.exit(1);
    }
    const payload = JSON.parse(payloadArg);
    const result = payload.kind === 'envelope'
        ? ingestGovernanceTransportEnvelope(payload.projectRoot, payload.envelope)
        : payload.kind === 'execution'
            ? ingestGovernanceExecutionResult(payload.projectRoot, payload)
            : ingestGovernanceRerunGateResult(payload.projectRoot, payload);
    process.stdout.write(JSON.stringify(result, null, 2));
}
main();
