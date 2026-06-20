"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileGovernanceExecutionRecords = reconcileGovernanceExecutionRecords;
const fs = require("node:fs");
const path = require("node:path");
const governance_remediation_config_1 = require("./governance-remediation-config");
const governance_packet_execution_store_1 = require("./governance-packet-execution-store");
function nowIso(now = new Date()) {
    return now.toISOString();
}
function listPacketFiles(root) {
    if (!fs.existsSync(root)) {
        return [];
    }
    const results = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) {
            results.push(...listPacketFiles(full));
        }
        else if (entry.isFile() &&
            /\.((cursor|claude|codex|generic)-packet)\.md$/i.test(entry.name)) {
            results.push(full);
        }
    }
    return results.sort((left, right) => left.localeCompare(right));
}
function isExpired(expiresAt, now) {
    if (!expiresAt) {
        return false;
    }
    const value = Date.parse(expiresAt);
    return Number.isFinite(value) && value <= now.getTime();
}
function reconcileGovernanceExecutionRecords(projectRoot, now = new Date()) {
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(projectRoot);
    const updatedRecordIds = [];
    const records = (0, governance_packet_execution_store_1.listGovernancePacketExecutionRecords)(projectRoot);
    const executionIds = new Set(records.map((record) => record.executionId));
    const packetPaths = new Set(records.flatMap((record) => Object.values(record.packetPaths).filter(Boolean)));
    for (const record of records) {
        if (record.status === 'leased' && isExpired(record.leaseExpiresAt, now)) {
            (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
                ...current,
                status: 'retry_pending',
                leaseOwner: null,
                leaseAcquiredAt: null,
                leaseExpiresAt: null,
                history: [
                    ...current.history,
                    {
                        at: nowIso(now),
                        kind: 'reconciled',
                        note: 'expired lease moved back to retry_pending',
                    },
                ],
            }));
            updatedRecordIds.push(record.executionId);
            continue;
        }
        if (record.status === 'running') {
            const updatedAt = Date.parse(record.updatedAt);
            const timeoutMs = (config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000;
            if ((Number.isFinite(updatedAt) && updatedAt + timeoutMs <= now.getTime()) ||
                isExpired(record.leaseExpiresAt, now)) {
                (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
                    ...current,
                    status: 'retry_pending',
                    leaseOwner: null,
                    leaseAcquiredAt: null,
                    leaseExpiresAt: null,
                    history: [
                        ...current.history,
                        {
                            at: nowIso(now),
                            kind: 'reconciled',
                            note: 'stale running execution moved back to retry_pending',
                        },
                    ],
                }));
                updatedRecordIds.push(record.executionId);
                continue;
            }
        }
        if (record.status === 'awaiting_rerun_gate' &&
            record.rerunGateSchedule?.scheduledAt &&
            Date.parse(record.rerunGateSchedule.scheduledAt) +
                (config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000 <=
                now.getTime()) {
            (0, governance_packet_execution_store_1.updateGovernancePacketExecutionRecord)(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
                ...current,
                status: 'retry_pending',
                history: [
                    ...current.history,
                    {
                        at: nowIso(now),
                        kind: 'reconciled',
                        note: 'awaiting_rerun_gate timed out and moved back to retry_pending',
                    },
                ],
            }));
            updatedRecordIds.push(record.executionId);
        }
    }
    const orphanPacketPaths = listPacketFiles(path.join(projectRoot, '_bmad-output')).filter((file) => !packetPaths.has(file));
    const orphanExecutionRecordIds = (0, governance_packet_execution_store_1.listGovernancePacketExecutionRecords)(projectRoot)
        .filter((record) => Object.values(record.packetPaths).some((packetPath) => packetPath && !fs.existsSync(packetPath)))
        .map((record) => record.executionId);
    fs.mkdirSync((0, governance_packet_execution_store_1.governanceExecutionStoreDir)(projectRoot), { recursive: true });
    fs.writeFileSync(path.join((0, governance_packet_execution_store_1.governanceExecutionStoreDir)(projectRoot), 'reconciliation-report.json'), JSON.stringify({
        reconciledAt: nowIso(now),
        updatedRecordIds,
        orphanPacketPaths,
        orphanExecutionRecordIds,
        trackedExecutionIds: [...executionIds].sort(),
    }, null, 2) + '\n', 'utf8');
    return {
        reconciledAt: nowIso(now),
        updatedRecordIds,
        orphanPacketPaths,
        orphanExecutionRecordIds,
    };
}
function main() {
    if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
        return;
    }
    if (require.main !== module) {
        return;
    }
    const projectRoot = process.argv[2] || process.cwd();
    process.stdout.write(JSON.stringify(reconcileGovernanceExecutionRecords(projectRoot), null, 2));
}
main();
