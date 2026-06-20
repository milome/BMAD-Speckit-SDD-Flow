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
exports.sha256Text = sha256Text;
exports.sha256Json = sha256Json;
exports.readJson = readJson;
exports.writeJsonAtomic = writeJsonAtomic;
exports.eventLogPathForRecord = eventLogPathForRecord;
exports.receiptPathForEvent = receiptPathForEvent;
exports.canonicalizeRequirementRecord = canonicalizeRequirementRecord;
exports.appendControlEventAndReplay = appendControlEventAndReplay;
/* eslint-disable no-console */
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const requirement_record_live_schema_gate_1 = require("./requirement-record-live-schema-gate");
const ZERO_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function objects(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function nested(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function withoutUndefined(value) {
    if (Array.isArray(value))
        return value.map(withoutUndefined);
    if (!value || typeof value !== 'object')
        return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        if (item !== undefined)
            out[key] = withoutUndefined(item);
    }
    return out;
}
function sha256Text(value) {
    return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
function sha256Json(value) {
    return sha256Text(JSON.stringify(withoutUndefined(value)));
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function writeJsonAtomic(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, file);
}
function eventLogPathForRecord(recordPath) {
    return path.join(path.dirname(recordPath), 'events', 'control-events.jsonl');
}
function receiptPathForEvent(recordPath, eventId) {
    return path.join(path.dirname(recordPath), 'events', 'receipts', `${eventId}.json`);
}
function appendJsonl(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}
function readEventLog(file) {
    if (!fs.existsSync(file))
        return [];
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content)
        return [];
    return content.split(/\r?\n/u).map((line) => JSON.parse(line));
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function normalizeSourceOfTruthRole(value) {
    const role = text(value);
    if ([
        'acceptance_oracle',
        'audit_convergence_authority',
        'audit_dispatch_contract',
        'audit_profile_contract',
        'audit_triad_convergence_authority',
        'closeout_oracle',
        'control',
        'evidence',
        'execution_runtime_mode_selection',
        'historical_requirement_context',
        'host_surface_projection',
        'implementation',
        'read_model',
        'runtime_next_action_authority',
        'semantic_coverage_gate_receipt',
        'projection',
    ].includes(role))
        return role;
    if (role === 'derived')
        return 'evidence';
    return 'evidence';
}
function normalizeSourceRefs(value) {
    return objects(value)
        .map((ref) => ({
        sourceType: text(ref.sourceType) || 'controlled_ingest',
        id: text(ref.id) || text(ref.sourceId) || 'unknown',
    }))
        .filter((ref) => text(ref.id));
}
function normalizeCommandRunRef(command, fallback) {
    const commandId = text(command.commandId) || text(command.id) || 'UNKNOWN-COMMAND';
    return {
        commandId,
        command: text(command.command) || commandId,
        runId: text(command.runId) || fallback.runId,
        ...(text(command.closeoutAttemptId)
            ? { closeoutAttemptId: text(command.closeoutAttemptId) }
            : {}),
        exitCode: Number.isInteger(command.exitCode) ? command.exitCode : 0,
        startedAt: text(command.startedAt) || fallback.startedAt,
        completedAt: text(command.completedAt) || fallback.completedAt,
        ...(text(command.outputSummary) ? { outputSummary: text(command.outputSummary) } : {}),
    };
}
function normalizeArtifactRef(artifact, recordId, requirementSetId, fallbackRelatedIds = []) {
    const related = strings(artifact.relatedRequirementIds);
    const fallbackRelated = [
        ...strings(artifact.evidenceRefs),
        ...strings(artifact.traceRows),
        ...fallbackRelatedIds,
        'historical-evidence',
    ].filter(Boolean);
    const hash = text(artifact.contentHash ?? artifact.hash);
    return {
        eventType: text(artifact.eventType) || 'artifact_indexed',
        artifactType: text(artifact.artifactType) || 'historical_artifact',
        sourceOfTruthRole: normalizeSourceOfTruthRole(artifact.sourceOfTruthRole),
        recordId: text(artifact.recordId) || recordId,
        requirementSetId: text(artifact.requirementSetId) || requirementSetId,
        path: normalizePathForRecord(text(artifact.path) || '<missing-path>'),
        ...(hash ? { contentHash: hash } : {}),
        producer: text(artifact.producer) || 'canonical-reducer',
        purpose: text(artifact.purpose) || 'canonicalized historical artifact reference',
        relatedRequirementIds: related.length > 0 ? related : [...new Set(fallbackRelated)],
        status: ['active', 'superseded', 'archived', 'deleted', 'blocked'].includes(text(artifact.status))
            ? text(artifact.status)
            : 'archived',
        inputVersion: text(artifact.inputVersion) || 'pre-artifact-metadata-enforcement',
        outputVersion: text(artifact.outputVersion) || 'archived-historical-artifact',
        traceRows: strings(artifact.traceRows),
        evidenceRefs: strings(artifact.evidenceRefs),
    };
}
function normalizeExecutionIteration(iteration, record, index) {
    const recordId = text(iteration.recordId) || text(record.recordId);
    const requirementSetId = text(iteration.requirementSetId) || text(record.requirementSetId) || recordId;
    const recordedAt = text(iteration.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    const runId = text(iteration.runId) || `historical-run-${index + 1}`;
    const fallback = { runId, startedAt: recordedAt, completedAt: recordedAt };
    const traceRows = strings(iteration.traceRows);
    const evidenceRefs = strings(iteration.evidenceRefs);
    const fallbackRelatedIds = [...traceRows, ...evidenceRefs];
    if (text(iteration.eventType) === 'subagent_evidence_envelope_recorded') {
        return {
            eventType: 'subagent_evidence_envelope_recorded',
            recordId,
            requirementSetId,
            executionIterationId: text(iteration.executionIterationId) || `subagent-envelope-${index + 1}`,
            runId,
            status: ['accepted', 'rejected', 'partial', 'blocked'].includes(text(iteration.status))
                ? text(iteration.status)
                : 'accepted',
            subagentEvidenceEnvelope: nested(iteration.subagentEvidenceEnvelope),
            ...(text(iteration.subagentEvidenceEnvelopeHash)
                ? { subagentEvidenceEnvelopeHash: text(iteration.subagentEvidenceEnvelopeHash) }
                : {}),
            traceRows,
            taskRefs: strings(iteration.taskRefs),
            evidenceRefs,
            coveredRequirementIds: strings(iteration.coveredRequirementIds),
            commandRunRefs: objects(iteration.commandRunRefs).map((command) => normalizeCommandRunRef(command, fallback)),
            evidenceArtifactRefs: objects(iteration.evidenceArtifactRefs).map((artifact) => normalizeArtifactRef(artifact, recordId, requirementSetId, fallbackRelatedIds)),
            sourceRefs: normalizeSourceRefs(iteration.sourceRefs).length
                ? normalizeSourceRefs(iteration.sourceRefs)
                : [
                    {
                        sourceType: 'execution_iteration',
                        id: text(iteration.executionIterationId) || `subagent-envelope-${index + 1}`,
                    },
                ],
            sourceDocumentHash: text(iteration.sourceDocumentHash) || text(record.sourceDocumentHash),
            implementationConfirmationHash: text(iteration.implementationConfirmationHash) ||
                text(record.implementationConfirmationHash),
            architectureConfirmationHash: text(iteration.architectureConfirmationHash) ||
                text(nested(record.architectureConfirmationState).currentArchitectureConfirmationHash),
            recordedAt,
            recordedBy: text(iteration.recordedBy) || 'canonical-reducer',
        };
    }
    return {
        eventType: 'execution_iteration_recorded',
        recordId,
        requirementSetId,
        executionIterationId: text(iteration.executionIterationId) || `execution-${index + 1}`,
        runId,
        status: text(iteration.status) || 'done',
        traceRows,
        taskRefs: strings(iteration.taskRefs),
        evidenceRefs,
        filesChanged: strings(iteration.filesChanged),
        diffSummary: text(iteration.diffSummary),
        commandRunRefs: objects(iteration.commandRunRefs).map((command) => normalizeCommandRunRef(command, fallback)),
        evidenceArtifactRefs: objects(iteration.evidenceArtifactRefs).map((artifact) => normalizeArtifactRef(artifact, recordId, requirementSetId, fallbackRelatedIds)),
        sourceRefs: normalizeSourceRefs(iteration.sourceRefs),
        sourceDocumentHash: text(iteration.sourceDocumentHash) || text(record.sourceDocumentHash),
        implementationConfirmationHash: text(iteration.implementationConfirmationHash) || text(record.implementationConfirmationHash),
        architectureConfirmationHash: text(iteration.architectureConfirmationHash) ||
            text(nested(record.architectureConfirmationState).currentArchitectureConfirmationHash),
        recordedAt,
        recordedBy: text(iteration.recordedBy) || 'canonical-reducer',
    };
}
function normalizeClosure(closure, record) {
    const recordedAt = text(closure.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    return {
        eventType: 'requirement_closure_recorded',
        recordId: text(closure.recordId) || text(record.recordId),
        requirementSetId: text(closure.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
        requirementId: text(closure.requirementId),
        status: ['open', 'pass', 'fail', 'blocked'].includes(text(closure.status))
            ? text(closure.status)
            : 'open',
        traceRows: strings(closure.traceRows),
        evidenceRefs: strings(closure.evidenceRefs),
        commandRunRefs: objects(closure.commandRunRefs).map((command) => normalizeCommandRunRef(command, {
            runId: 'closure-historical-run',
            startedAt: recordedAt,
            completedAt: recordedAt,
        })),
        evidenceArtifactRefs: objects(closure.evidenceArtifactRefs).map((artifact) => normalizeArtifactRef(artifact, text(record.recordId), text(record.requirementSetId) || text(record.recordId))),
        sourceRefs: normalizeSourceRefs(closure.sourceRefs),
        recordedAt,
        recordedBy: text(closure.recordedBy) || 'canonical-reducer',
    };
}
function normalizeGateCheck(check, record) {
    const recordedAt = text(check.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    return {
        eventType: 'gate_check_recorded',
        ...(text(check.checkId) ? { checkId: text(check.checkId) } : {}),
        gate: text(check.gate) || 'unknown_gate',
        decision: ['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy'].includes(text(check.decision))
            ? text(check.decision)
            : 'blocked',
        blockingReasons: strings(check.blockingReasons),
        checks: objects(check.checks),
        ...(text(check.reportPath)
            ? { reportPath: normalizePathForRecord(text(check.reportPath)) }
            : {}),
        sourceRefs: normalizeSourceRefs(check.sourceRefs),
        commandRunRefs: objects(check.commandRunRefs).map((command) => normalizeCommandRunRef(command, {
            runId: 'gate-historical-run',
            startedAt: recordedAt,
            completedAt: recordedAt,
        })),
        recordedAt,
        recordedBy: text(check.recordedBy) || 'canonical-reducer',
    };
}
function normalizeContractCheck(check, record) {
    const recordedAt = text(check.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    return {
        eventType: 'contract_check_recorded',
        ...(text(check.checkId) ? { checkId: text(check.checkId) } : {}),
        contract: text(check.contract) || 'unknown_contract',
        decision: ['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy'].includes(text(check.decision))
            ? text(check.decision)
            : 'blocked',
        sourceRefs: normalizeSourceRefs(check.sourceRefs),
        recordedAt,
        recordedBy: text(check.recordedBy) || 'canonical-reducer',
    };
}
function normalizeExecutionStrategySelection(selection, record) {
    const recordedAt = text(selection.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    return {
        eventType: 'execution_strategy_selected',
        recordId: text(selection.recordId) || text(record.recordId),
        requirementSetId: text(selection.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
        strategyId: text(selection.strategyId) || 'compiled_trace_direct',
        availability: text(selection.availability) === 'available' ? 'available' : text(selection.availability),
        selectedBy: text(selection.selectedBy) === 'user' ? 'user' : 'policy',
        strategyOptionsHash: text(selection.strategyOptionsHash),
        selectedOptionHash: text(selection.selectedOptionHash),
        modelPacketHash: text(selection.modelPacketHash),
        sourceDocumentHash: text(selection.sourceDocumentHash) || text(record.sourceDocumentHash),
        implementationConfirmationHash: text(selection.implementationConfirmationHash) || text(record.implementationConfirmationHash),
        sourceRefs: normalizeSourceRefs(selection.sourceRefs).length
            ? normalizeSourceRefs(selection.sourceRefs)
            : [
                {
                    sourceType: 'execution_strategy_option',
                    id: text(selection.strategyId) || 'compiled_trace_direct',
                },
            ],
        recordedAt,
        recordedBy: text(selection.recordedBy) || 'canonical-reducer',
    };
}
function normalizeArchitectureStatus(value, fallback) {
    const status = text(value);
    return ['active', 'stale', 'blocked', 'missing', 'superseded'].includes(status)
        ? status
        : fallback;
}
function normalizeHashMap(value, fallback = {}) {
    const source = nested(value);
    const out = {};
    for (const [key, item] of Object.entries(source)) {
        const normalized = text(item);
        if (normalized)
            out[key] = normalized;
    }
    if (Object.keys(out).length > 0)
        return out;
    return fallback;
}
function normalizeArchitectureStateCheck(check, record, index) {
    const recordedAt = text(check.checkedAt) ||
        text(check.recordedAt) ||
        text(record.updatedAt) ||
        '2026-01-01T00:00:00.000Z';
    const state = nested(record.architectureConfirmationState);
    const transition = nested(check.stateTransition);
    const resolvedRecipeHash = text(check.resolvedRecipeHash) ||
        text(state.resolvedRecipeHash) ||
        'sha256:0000000000000000000000000000000000000000000000000000000000000000';
    const currentHashes = normalizeHashMap(transition.currentHashes, {
        sourceDocumentHash: text(record.sourceDocumentHash),
        implementationConfirmationHash: text(record.implementationConfirmationHash),
        architectureConfirmationHash: text(state.currentArchitectureConfirmationHash),
        resolvedRecipeHash,
    });
    return {
        eventType: 'architecture_confirmation_state_checked',
        recordId: text(check.recordId) || text(record.recordId),
        requirementSetId: text(check.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
        checkId: text(check.checkId) || `architecture-state:canonicalized-${index + 1}`,
        decision: ['pass', 'fail', 'blocked'].includes(text(check.decision))
            ? text(check.decision)
            : 'blocked',
        resolvedRecipeHash,
        stateTransition: {
            fromStatus: normalizeArchitectureStatus(transition.fromStatus, normalizeArchitectureStatus(transition.toStatus, 'missing')),
            toStatus: normalizeArchitectureStatus(transition.toStatus, normalizeArchitectureStatus(state.status, 'missing')),
            reasonCode: text(transition.reasonCode) || 'canonicalized_historical_state_check',
            previousHashes: normalizeHashMap(transition.previousHashes),
            currentHashes,
            mismatchFields: strings(transition.mismatchFields),
            recipeVersion: 'architecture-confirmation-hash/v1',
        },
        checkedAt: recordedAt,
        checkedBy: text(check.checkedBy) || text(check.recordedBy) || 'canonical-reducer',
    };
}
function normalizeFailureRecord(failure, record, index) {
    const recordedAt = text(failure.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    return {
        eventType: 'failure_recorded',
        failureId: text(failure.failureId) || `failure-${index + 1}`,
        type: text(failure.type) || 'historical_failure',
        status: ['open', 'in_progress', 'resolved', 'blocked', 'superseded'].includes(text(failure.status))
            ? text(failure.status)
            : 'open',
        ...(text(failure.closeoutAttemptId)
            ? { closeoutAttemptId: text(failure.closeoutAttemptId) }
            : {}),
        blockingReasons: strings(failure.blockingReasons),
        sourceRefs: normalizeSourceRefs(failure.sourceRefs).length
            ? normalizeSourceRefs(failure.sourceRefs)
            : [{ sourceType: 'failure_record', id: text(failure.failureId) || `failure-${index + 1}` }],
        recordedAt,
        recordedBy: text(failure.recordedBy) || 'canonical-reducer',
    };
}
function normalizeRcaRecord(rca, record, index) {
    const recordedAt = text(rca.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
    return {
        eventType: 'rca_created',
        rcaId: text(rca.rcaId) || `rca-${index + 1}`,
        type: text(rca.type) || 'historical_rca',
        status: ['open', 'in_progress', 'resolved', 'blocked'].includes(text(rca.status))
            ? text(rca.status)
            : 'open',
        sourceRefs: normalizeSourceRefs(rca.sourceRefs).length
            ? normalizeSourceRefs(rca.sourceRefs)
            : [{ sourceType: 'rca_record', id: text(rca.rcaId) || `rca-${index + 1}` }],
        recordedAt,
        recordedBy: text(rca.recordedBy) || 'canonical-reducer',
    };
}
function normalizeRerunLoop(loop, index) {
    const sourceRefs = objects(loop.sourceRefs)
        .map((ref) => ({
        sourceType: [
            'gate_check',
            'contract_check',
            'audit_iteration',
            'execution_iteration',
            'requirement_closure',
            'failure_record',
        ].includes(text(ref.sourceType))
            ? text(ref.sourceType)
            : 'gate_check',
        id: text(ref.id) || text(ref.sourceId) || `rerun-loop-${index + 1}`,
    }))
        .filter((ref) => text(ref.id));
    return {
        rerunLoopId: text(loop.rerunLoopId) || `rerun-loop-${index + 1}`,
        status: [
            'open',
            'in_progress',
            'no_progress',
            'resolved',
            'blocked',
            'abandoned_by_user_confirmation',
        ].includes(text(loop.status))
            ? text(loop.status)
            : 'open',
        sourceRefs: sourceRefs.length
            ? sourceRefs
            : [{ sourceType: 'gate_check', id: `rerun-loop-${index + 1}` }],
        blockerRefs: normalizeSourceRefs(loop.blockerRefs),
        recheckRefs: normalizeSourceRefs(loop.recheckRefs),
    };
}
function normalizeDeliveryEvidence(deliveryEvidence, record) {
    const delivery = nested(deliveryEvidence);
    if (Object.keys(delivery).length === 0)
        return undefined;
    const recordId = text(record.recordId);
    const requirementSetId = text(record.requirementSetId) || recordId;
    const requiredCommands = objects(delivery.requiredCommands)
        .map((command) => {
        const commandId = text(command.commandId);
        if (!commandId)
            return null;
        const artifactRefs = objects(command.artifactRefs).map((artifact) => normalizeArtifactRef(artifact, recordId, requirementSetId));
        if (artifactRefs.length === 0)
            return null;
        return {
            commandId,
            command: text(command.command) || commandId,
            ...(text(command.commandType) ? { commandType: text(command.commandType) } : {}),
            blockingIfMissing: true,
            ...(typeof command.negativeOrRegression === 'boolean'
                ? { negativeOrRegression: command.negativeOrRegression }
                : {}),
            ...(text(command.closeoutAttemptId)
                ? { closeoutAttemptId: text(command.closeoutAttemptId) }
                : {}),
            ...(nested(command.lastRunRef).commandId
                ? {
                    lastRunRef: {
                        commandId: text(nested(command.lastRunRef).commandId),
                        runId: text(nested(command.lastRunRef).runId) || 'historical-run',
                        closeoutAttemptId: text(nested(command.lastRunRef).closeoutAttemptId) || 'historical-attempt',
                    },
                }
                : {}),
            traceRows: strings(command.traceRows),
            evidenceRefs: strings(command.evidenceRefs),
            artifactRefs,
        };
    })
        .filter((command) => command !== null);
    const historicalRunRefs = objects(delivery.historicalRunRefs)
        .map((run) => ({
        commandId: text(run.commandId),
        runId: text(run.runId) || 'historical-run',
        ...(text(run.closeoutAttemptId) ? { closeoutAttemptId: text(run.closeoutAttemptId) } : {}),
    }))
        .filter((run) => text(run.commandId));
    const normalized = {
        ...(requiredCommands.length ? { requiredCommands } : {}),
        ...(historicalRunRefs.length ? { historicalRunRefs } : {}),
    };
    return Object.keys(normalized).length > 0 ? normalized : undefined;
}
function normalizeCloseout(closeoutValue) {
    const closeout = nested(closeoutValue);
    if (Object.keys(closeout).length === 0)
        return undefined;
    const attempts = objects(closeout.attempts).map((attempt) => ({
        eventType: 'closeout_check_recorded',
        closeoutAttemptId: text(attempt.closeoutAttemptId) || 'historical-closeout-attempt',
        decision: ['pass', 'fail', 'blocked'].includes(text(attempt.decision))
            ? text(attempt.decision)
            : 'blocked',
        blockingReasons: strings(attempt.blockingReasons),
        checks: objects(attempt.checks),
        ...(text(attempt.reportPath)
            ? { reportPath: normalizePathForRecord(text(attempt.reportPath)) }
            : {}),
        ...(text(attempt.evaluatedAt) ? { evaluatedAt: text(attempt.evaluatedAt) } : {}),
        ...(text(attempt.evaluatedBy) ? { evaluatedBy: text(attempt.evaluatedBy) } : {}),
    }));
    const acceptanceRequest = nested(closeout.acceptanceRequest);
    return {
        currentAttemptId: text(closeout.currentAttemptId) ||
            text(attempts.at(-1)?.closeoutAttemptId) ||
            'historical-closeout-attempt',
        ...(text(closeout.decision) ? { decision: text(closeout.decision) } : {}),
        ...(Object.keys(acceptanceRequest).length
            ? {
                acceptanceRequest: {
                    ...acceptanceRequest,
                    status: ['awaiting_user_acceptance', 'user_accepted_closeout'].includes(text(acceptanceRequest.status))
                        ? text(acceptanceRequest.status)
                        : 'awaiting_user_acceptance',
                    closeoutAttemptId: text(acceptanceRequest.closeoutAttemptId) ||
                        text(closeout.currentAttemptId) ||
                        text(attempts.at(-1)?.closeoutAttemptId),
                    ...(text(acceptanceRequest.htmlPath)
                        ? { htmlPath: normalizePathForRecord(text(acceptanceRequest.htmlPath)) }
                        : {}),
                    ...(text(acceptanceRequest.renderReportPath)
                        ? {
                            renderReportPath: normalizePathForRecord(text(acceptanceRequest.renderReportPath)),
                        }
                        : {}),
                    ...(text(acceptanceRequest.summaryPath)
                        ? { summaryPath: normalizePathForRecord(text(acceptanceRequest.summaryPath)) }
                        : {}),
                },
            }
            : {}),
        ...(text(closeout.updatedAt) ? { updatedAt: text(closeout.updatedAt) } : {}),
        attempts,
    };
}
function normalizeHookReconciliation(value) {
    const hook = nested(value);
    if (Object.keys(hook).length === 0)
        return undefined;
    return {
        schemaVersion: 'hook-reconciliation/v1',
        hostKind: ['codex', 'cursor', 'claude', 'unknown'].includes(text(hook.hostKind))
            ? text(hook.hostKind)
            : 'unknown',
        hostMode: ['hooks_enabled', 'no_hooks', 'unknown'].includes(text(hook.hostMode))
            ? text(hook.hostMode)
            : 'unknown',
        hookTrust: ['trusted', 'degraded', 'untrusted', 'unknown'].includes(text(hook.hookTrust))
            ? text(hook.hookTrust)
            : 'unknown',
        fallbackMode: ['none', 'no_hooks', 'bounded_replay', 'blocked'].includes(text(hook.fallbackMode))
            ? text(hook.fallbackMode)
            : 'none',
        closeoutReconciled: hook.closeoutReconciled === true,
        sequenceLedger: {
            status: ['clean', 'reconciled', 'gap', 'missing', 'stale', 'unknown'].includes(text(nested(hook.sequenceLedger).status))
                ? text(nested(hook.sequenceLedger).status)
                : 'unknown',
            ...(Number.isInteger(nested(hook.sequenceLedger).expectedNextSequence)
                ? { expectedNextSequence: nested(hook.sequenceLedger).expectedNextSequence }
                : {}),
            observedSequences: Array.isArray(nested(hook.sequenceLedger).observedSequences)
                ? nested(hook.sequenceLedger).observedSequences.filter((value) => Number.isInteger(value))
                : [],
        },
        missingReceipts: objects(hook.missingReceipts).map((receipt) => ({
            receiptType: text(receipt.receiptType) || 'unknown_receipt',
            expectedEventId: text(receipt.expectedEventId) || 'unknown_event',
            ...(text(receipt.severity) ? { severity: text(receipt.severity) } : {}),
        })),
        hashMismatches: objects(hook.hashMismatches).map((mismatch) => ({
            field: text(mismatch.field) || 'unknown_field',
            expected: text(mismatch.expected) || 'unknown_expected',
            actual: text(mismatch.actual) || 'unknown_actual',
        })),
        noHookFallbackRefs: normalizeSourceRefs(hook.noHookFallbackRefs),
    };
}
function normalizeImplementationEntryGate(value) {
    const gate = nested(value);
    if (Object.keys(gate).length === 0)
        return undefined;
    const rawDecision = text(gate.decision);
    const decision = rawDecision === 'pass' || rawDecision === 'reroute'
        ? rawDecision
        : rawDecision === 'block' || rawDecision === 'blocked' || rawDecision === 'fail'
            ? 'block'
            : 'block';
    return {
        ...gate,
        gateName: 'implementation-readiness',
        decision,
    };
}
function normalizeMentalModel(value) {
    const model = text(value);
    if ([
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
        'execution_closure',
        'audit_review',
        'delivery_confirmation',
    ].includes(model)) {
        return model;
    }
    if (model === 'delivery_closeout')
        return 'delivery_confirmation';
    return undefined;
}
function normalizeModelResult(result, record, model) {
    const recordedAt = text(result.resultRecordedAt) ||
        text(result.recordedAt) ||
        text(record.updatedAt) ||
        new Date().toISOString();
    const status = text(result.status);
    return {
        payloadKind: 'model_result',
        model,
        recordId: text(result.recordId) || text(record.recordId),
        requirementSetId: text(result.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
        sourceDocumentHash: text(result.sourceDocumentHash) || text(record.sourceDocumentHash),
        implementationConfirmationHash: text(result.implementationConfirmationHash) || text(record.implementationConfirmationHash),
        status: [
            'pass',
            'blocked',
            'fail',
            'stale',
            'not_established',
            'awaiting_user_acceptance',
        ].includes(status)
            ? status
            : 'blocked',
        resultRecordedAt: recordedAt,
        resultRecordedBy: text(result.resultRecordedBy) || text(result.recordedBy) || 'canonical-reducer',
        blockingReasons: strings(result.blockingReasons),
        sourceRefs: normalizeSourceRefs(result.sourceRefs),
        currentHashes: nested(result.currentHashes),
        ...(nested(result.readinessReportRef).path
            ? { readinessReportRef: nested(result.readinessReportRef) }
            : {}),
        ...(nested(result.deliveryCloseoutReportRef).path
            ? { deliveryCloseoutReportRef: nested(result.deliveryCloseoutReportRef) }
            : {}),
        ...(nested(result.readinessBaselineMetadata).status
            ? {
                readinessBaselineMetadata: normalizeReadinessBaselineMetadata(result.readinessBaselineMetadata, record),
            }
            : {}),
    };
}
function normalizeSixModelResults(value, record) {
    const results = nested(value);
    if (Object.keys(results).length === 0)
        return undefined;
    const out = {};
    for (const model of [
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
        'execution_closure',
        'audit_review',
        'delivery_confirmation',
    ]) {
        const result = nested(results[model]);
        if (Object.keys(result).length > 0)
            out[model] = normalizeModelResult(result, record, model);
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
function normalizeReadinessBaselineMetadata(value, record) {
    const metadata = nested(value);
    if (Object.keys(metadata).length === 0)
        return undefined;
    const status = text(metadata.status);
    return {
        ...metadata,
        baselineId: text(metadata.baselineId) ||
            `readiness-baseline:${text(record.requirementSetId) || text(record.recordId)}`,
        activationId: text(metadata.activationId) ||
            `readiness-baseline:${text(record.requirementSetId) || text(record.recordId)}:not-established`,
        status: ['current', 'stale', 'blocked', 'not_established'].includes(status)
            ? status
            : 'not_established',
        scoringRunId: text(metadata.scoringRunId) || 'readiness-scoring:not-established',
        scoringRecordPath: text(metadata.scoringRecordPath) ||
            '_bmad-output/runtime/readiness-scoring/not-established.json',
        sourceRequirementRecordHash: text(metadata.sourceRequirementRecordHash) ||
            'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        auditTraceHash: text(metadata.auditTraceHash) ||
            'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        readinessGateRecipeVersion: text(metadata.readinessGateRecipeVersion) || 'implementation-readiness-gate/v1',
    };
}
function canonicalizeRequirementRecord(record) {
    const recordId = text(record.recordId);
    const requirementSetId = text(record.requirementSetId) || recordId;
    const allowedTopLevel = new Set([
        'schemaVersion',
        'recordId',
        'requirementSetId',
        'sourcePath',
        'status',
        'flow',
        'stage',
        'currentStage',
        'entryFlow',
        'entryFlowClass',
        'workflowAdapter',
        'sourceMode',
        'templateId',
        'epicId',
        'storyId',
        'storySlug',
        'runId',
        'artifactRoot',
        'artifactPath',
        'currentMentalModel',
        'mentalModelTransitions',
        'sixModelResults',
        'pendingBlockerIntake',
        'blockerIntakeRuns',
        'reconfirmationRequests',
        'bmadAssociation',
        'sprintStatusUpdateAuthorizations',
        'externalBoardSyncReceipts',
        'implementationEntryGate',
        'contractAuthoringRequired',
        'globalContractTraceabilityPolicy',
        'traceStatusPolicy',
        'runtimePolicySnapshotRef',
        'sourceDocumentHash',
        'implementationConfirmationHash',
        'confirmationPageHash',
        'latestConfirmationProjectionHash',
        'confirmationProjectionHistory',
        'confirmationHistory',
        'architectureConfirmationState',
        'architectureConfirmations',
        'architectureConfirmationStateChecks',
        'executionIterations',
        'executionStrategySelections',
        'requirementClosures',
        'gateChecks',
        'contractChecks',
        'failureRecords',
        'rcaRecords',
        'rerunLoops',
        'closeout',
        'closeoutAcceptance',
        'closeoutAcceptanceHistory',
        'readinessBaselineActivation',
        'readinessBaselineActivationEventType',
        'readinessAuditRequests',
        'readinessAuditResults',
        'readinessScoringRecords',
        'readinessBaselineMetadata',
        'artifactIndex',
        'extensionRefs',
        'deliveryEvidence',
        'implementationReadiness',
        'executionClosures',
        'auditReviews',
        'deliveryConfirmations',
        'externalBoardEvidence',
        'bmadAssociations',
        'postCloseDefectLinks',
        'semanticCoverage',
        'auditReviewDispatchPackets',
        'auditScoringConvergence',
        'sixModelRuntimeDecisions',
        'runtimeModeSelections',
        'taskProgress',
        'auditTriadConvergence',
        'hookReconciliation',
        'latestReviewerCloseout',
        'aiTddContractGate',
        'lastEventType',
        'updatedAt',
        'recordHash',
        'lastAppliedEventId',
        'lastAppliedEventHash',
        'eventChainHead',
        'eventCount',
        'controlStore',
    ]);
    const out = {};
    for (const [key, value] of Object.entries(record)) {
        if (allowedTopLevel.has(key))
            out[key] = value;
    }
    out.recordId = recordId;
    out.requirementSetId = requirementSetId;
    out.status = text(out.status) || 'user_confirmed';
    out.sourcePath = text(out.sourcePath) || 'docs/design/unknown.md';
    out.sourceDocumentHash = text(out.sourceDocumentHash);
    out.implementationConfirmationHash = text(out.implementationConfirmationHash);
    const currentMentalModel = normalizeMentalModel(out.currentMentalModel);
    if (currentMentalModel)
        out.currentMentalModel = currentMentalModel;
    else
        delete out.currentMentalModel;
    const sixModelResults = normalizeSixModelResults(out.sixModelResults, out);
    if (sixModelResults)
        out.sixModelResults = sixModelResults;
    else
        delete out.sixModelResults;
    out.mentalModelTransitions = objects(out.mentalModelTransitions);
    out.pendingBlockerIntake = objects(out.pendingBlockerIntake);
    out.blockerIntakeRuns = objects(out.blockerIntakeRuns);
    out.reconfirmationRequests = objects(out.reconfirmationRequests);
    if (Object.keys(nested(out.bmadAssociation)).length > 0)
        out.bmadAssociation = nested(out.bmadAssociation);
    else
        delete out.bmadAssociation;
    out.sprintStatusUpdateAuthorizations = objects(out.sprintStatusUpdateAuthorizations);
    out.externalBoardSyncReceipts = objects(out.externalBoardSyncReceipts);
    const implementationEntryGate = normalizeImplementationEntryGate(out.implementationEntryGate);
    if (implementationEntryGate)
        out.implementationEntryGate = implementationEntryGate;
    else
        delete out.implementationEntryGate;
    if (out.runtimePolicySnapshotRef) {
        out.runtimePolicySnapshotRef = normalizeArtifactRef(nested(out.runtimePolicySnapshotRef), recordId, requirementSetId);
    }
    const confirmationHistory = objects(out.confirmationHistory);
    out.confirmationHistory =
        confirmationHistory.length > 0
            ? confirmationHistory
            : [
                {
                    eventType: 'confirmation_recorded',
                    recordId,
                    requirementSetId,
                    confirmedAt: text(out.updatedAt) || '2026-01-01T00:00:00.000Z',
                    confirmedBy: 'canonical-reducer',
                    sourcePath: text(out.sourcePath),
                    sourceDocumentHash: text(out.sourceDocumentHash),
                    implementationConfirmationHash: text(out.implementationConfirmationHash),
                    confirmationPageHash: text(out.confirmationPageHash) ||
                        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
                    confirmationText: 'canonicalized historical confirmation baseline',
                    renderReportPath: `_bmad-output/runtime/requirement-records/${recordId}/confirmation/confirmation-render-report.json`,
                    htmlPath: `_bmad-output/runtime/requirement-records/${recordId}/confirmation/confirmation.html`,
                },
            ];
    out.architectureConfirmations = objects(out.architectureConfirmations).map((event) => ({
        ...event,
        eventType: 'architecture_confirmation_recorded',
        artifactRef: event.artifactRef
            ? normalizeArtifactRef(nested(event.artifactRef), recordId, requirementSetId)
            : undefined,
    }));
    out.architectureConfirmationStateChecks = objects(out.architectureConfirmationStateChecks).map((check, index) => normalizeArchitectureStateCheck(check, out, index));
    out.executionIterations = objects(out.executionIterations).map((iteration, index) => normalizeExecutionIteration(iteration, out, index));
    out.executionStrategySelections = objects(out.executionStrategySelections).map((selection) => normalizeExecutionStrategySelection(selection, out));
    out.requirementClosures = objects(out.requirementClosures)
        .map((closure) => normalizeClosure(closure, out))
        .filter((closure) => text(closure.requirementId));
    out.gateChecks = objects(out.gateChecks).map((check) => normalizeGateCheck(check, out));
    out.contractChecks = objects(out.contractChecks).map((check) => normalizeContractCheck(check, out));
    out.failureRecords = objects(out.failureRecords).map((failure, index) => normalizeFailureRecord(failure, out, index));
    out.rcaRecords = objects(out.rcaRecords).map((rca, index) => normalizeRcaRecord(rca, out, index));
    out.rerunLoops = objects(out.rerunLoops).map((loop, index) => normalizeRerunLoop(loop, index));
    const closeout = normalizeCloseout(out.closeout);
    if (closeout)
        out.closeout = closeout;
    else
        delete out.closeout;
    out.artifactIndex = objects(out.artifactIndex).map((artifact) => normalizeArtifactRef(artifact, recordId, requirementSetId));
    out.extensionRefs = objects(out.extensionRefs).map((artifact) => normalizeArtifactRef(artifact, recordId, requirementSetId));
    const deliveryEvidence = normalizeDeliveryEvidence(out.deliveryEvidence, out);
    if (deliveryEvidence)
        out.deliveryEvidence = deliveryEvidence;
    else
        delete out.deliveryEvidence;
    for (const field of [
        'implementationReadiness',
        'executionClosures',
        'auditReviews',
        'deliveryConfirmations',
        'externalBoardEvidence',
        'bmadAssociations',
        'postCloseDefectLinks',
        'semanticCoverage',
        'auditReviewDispatchPackets',
        'auditScoringConvergence',
        'sixModelRuntimeDecisions',
        'runtimeModeSelections',
        'taskProgress',
        'auditTriadConvergence',
    ]) {
        out[field] = objects(out[field]);
    }
    const hookReconciliation = normalizeHookReconciliation(out.hookReconciliation);
    if (hookReconciliation)
        out.hookReconciliation = hookReconciliation;
    else
        delete out.hookReconciliation;
    const readinessBaselineMetadata = normalizeReadinessBaselineMetadata(out.readinessBaselineMetadata, out);
    if (readinessBaselineMetadata)
        out.readinessBaselineMetadata = readinessBaselineMetadata;
    else
        delete out.readinessBaselineMetadata;
    if (!text(out.updatedAt))
        out.updatedAt = new Date().toISOString();
    if (!text(out.lastEventType))
        out.lastEventType = 'canonical_record_reduced';
    return withoutUndefined(out);
}
function latestEventHash(events) {
    return text(events.at(-1)?.eventHash) || ZERO_HASH;
}
function createEvent(input) {
    const payloadHash = sha256Json(input.payload);
    const eventId = `${input.eventType}:${input.recordedAt}:${payloadHash.slice('sha256:'.length, 'sha256:'.length + 12)}`;
    const unsigned = {
        eventId,
        eventType: input.eventType,
        eventSchemaVersion: 'control-event-envelope/v1',
        payloadSchemaVersion: input.payloadSchemaVersion,
        writerId: input.writerId,
        recordId: text(input.record.recordId),
        requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
        recordedAt: input.recordedAt,
        previousEventHash: input.previousEventHash,
        beforeRecordHash: input.beforeRecordHash,
        afterRecordHash: input.afterRecordHash,
        payloadHash,
        payload: input.payload,
    };
    return {
        ...unsigned,
        eventHash: sha256Json(unsigned),
    };
}
function appendControlEventAndReplay(input) {
    const recordPath = path.resolve(input.recordPath);
    const currentRecord = readJson(recordPath);
    const beforeRecord = canonicalizeRequirementRecord(currentRecord);
    const beforeRecordHash = sha256Json(beforeRecord);
    const reducedRecord = canonicalizeRequirementRecord(input.reduce(beforeRecord, input.payload));
    const recordedAt = input.recordedAt ?? new Date().toISOString();
    const eventLogPath = eventLogPathForRecord(recordPath);
    const existingEvents = readEventLog(eventLogPath);
    const event = createEvent({
        eventType: input.eventType,
        writerId: input.writerId,
        record: beforeRecord,
        payload: input.payload,
        recordedAt,
        previousEventHash: latestEventHash(existingEvents),
        beforeRecordHash,
        afterRecordHash: sha256Json(reducedRecord),
        payloadSchemaVersion: input.payloadSchemaVersion ?? `${input.eventType}/v1`,
    });
    const nextRecord = {
        ...reducedRecord,
        schemaVersion: text(reducedRecord.schemaVersion) || 'requirement-record/v1',
        recordHash: event.afterRecordHash,
        lastAppliedEventId: event.eventId,
        lastAppliedEventHash: event.eventHash,
        eventChainHead: event.eventHash,
        eventCount: existingEvents.length + 1,
        controlStore: {
            schemaVersion: 'control-store/v1',
            eventLogPath: normalizePathForRecord(eventLogPath),
            lastEventId: event.eventId,
            lastEventHash: event.eventHash,
            reducer: 'canonical-requirement-record-reducer/v1',
            atomicCommitter: 'requirement-record-control-store/v1',
        },
    };
    const validation = (0, requirement_record_live_schema_gate_1.validateRequirementRecordSchemaObject)(nextRecord);
    if (!input.skipSchemaGate && !validation.ok) {
        throw new Error(`live requirement-record schema gate failed: ${validation.errorCount} errors: ${JSON.stringify(validation.errors.slice(0, 5))}`);
    }
    appendJsonl(eventLogPath, event);
    writeJsonAtomic(recordPath, nextRecord);
    const receipt = {
        receiptType: 'control_event_committed',
        eventId: event.eventId,
        eventHash: event.eventHash,
        eventType: event.eventType,
        writerId: input.writerId,
        recordId: event.recordId,
        requirementSetId: event.requirementSetId,
        eventLogPath: normalizePathForRecord(eventLogPath),
        beforeRecordHash,
        afterRecordHash: event.afterRecordHash,
        schemaGate: { ok: validation.ok, errorCount: validation.errorCount },
        committedAt: recordedAt,
    };
    const receiptPath = receiptPathForEvent(recordPath, event.eventId.replace(/[^a-z0-9_.-]/giu, '_'));
    writeJsonAtomic(receiptPath, receipt);
    return {
        event,
        receiptPath,
        eventLogPath,
        beforeRecordHash,
        afterRecordHash: event.afterRecordHash,
    };
}
