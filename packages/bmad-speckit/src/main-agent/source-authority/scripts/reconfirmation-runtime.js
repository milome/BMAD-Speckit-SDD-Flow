"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_RECONFIRMATION_STATUSES = void 0;
exports.openReconfirmationRequests = openReconfirmationRequests;
exports.hasOpenReconfirmationRequest = hasOpenReconfirmationRequest;
exports.firstOpenReconfirmationRequest = firstOpenReconfirmationRequest;
exports.buildOpenReconfirmationBlockingReasonRefs = buildOpenReconfirmationBlockingReasonRefs;
exports.stableReconfirmationRequestId = stableReconfirmationRequestId;
exports.buildReconfirmationRequestedPayload = buildReconfirmationRequestedPayload;
exports.reduceReconfirmationRequested = reduceReconfirmationRequested;
exports.shouldRollbackForReconfirmation = shouldRollbackForReconfirmation;
exports.rollbackPayloadForReconfirmation = rollbackPayloadForReconfirmation;
exports.reduceMentalModelRollbackForReconfirmation = reduceMentalModelRollbackForReconfirmation;
exports.syncRequirementRecordIndexForRecordPath = syncRequirementRecordIndexForRecordPath;
exports.requestSemanticReconfirmation = requestSemanticReconfirmation;
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const requirement_record_control_store_1 = require("./requirement-record-control-store");
exports.OPEN_RECONFIRMATION_STATUSES = new Set(['blocking_open', 'open', 'in_progress']);
const POST_REQUIREMENT_CONFIRMATION_MODELS = new Set([
    'architecture_confirmation',
    'implementation_readiness',
    'execution_closure',
    'audit_review',
    'delivery_confirmation',
]);
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
function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function repoRelativePath(root, value) {
    const absolute = path.resolve(value);
    const relative = path.relative(root, absolute).replace(/\\/gu, '/');
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
        ? relative
        : normalizePathForRecord(absolute);
}
function runtimeRootForRecord(recordPath) {
    return path.dirname(path.dirname(path.resolve(recordPath)));
}
function projectRootForRecord(recordPath) {
    return path.dirname(path.dirname(path.dirname(runtimeRootForRecord(recordPath))));
}
function openReconfirmationRequests(record) {
    return objects(record?.reconfirmationRequests).filter((request) => exports.OPEN_RECONFIRMATION_STATUSES.has(text(request.status)));
}
function hasOpenReconfirmationRequest(record) {
    return openReconfirmationRequests(record).length > 0;
}
function firstOpenReconfirmationRequest(record) {
    return openReconfirmationRequests(record)[0] ?? null;
}
function buildOpenReconfirmationBlockingReasonRefs(record) {
    return openReconfirmationRequests(record).map((request) => ({
        sourceType: 'reconfirmation_request',
        id: text(request.requestId) || 'open_reconfirmation_request_exists',
    }));
}
function stableReconfirmationRequestId(input) {
    const key = [
        input.recordId,
        input.currentSourceDocumentHash,
        input.currentImplementationConfirmationHash,
        input.latestConfirmedSourceDocumentHash,
        input.latestConfirmedImplementationConfirmationHash,
    ].join('\n');
    return `reconfirm-${sha256(key).slice(0, 24)}`;
}
function buildReconfirmationRequestedPayload(input) {
    const recordId = text(input.record.recordId) || 'requirement-record';
    const requirementSetId = text(input.record.requirementSetId) || recordId;
    const currentSemanticHashes = object(input.classification.currentSemanticHashes);
    const latestConfirmedSemanticHashes = object(input.classification.latestConfirmedSemanticHashes);
    const currentSourceDocumentHash = text(currentSemanticHashes.sourceDocumentHash) || text(input.record.sourceDocumentHash);
    const currentImplementationConfirmationHash = text(currentSemanticHashes.implementationConfirmationHash) ||
        text(input.record.implementationConfirmationHash);
    const latestConfirmedSourceDocumentHash = text(latestConfirmedSemanticHashes.sourceDocumentHash) || text(input.record.sourceDocumentHash);
    const latestConfirmedImplementationConfirmationHash = text(latestConfirmedSemanticHashes.implementationConfirmationHash) ||
        text(input.record.implementationConfirmationHash);
    const requestId = stableReconfirmationRequestId({
        recordId,
        currentSourceDocumentHash,
        currentImplementationConfirmationHash,
        latestConfirmedSourceDocumentHash,
        latestConfirmedImplementationConfirmationHash,
    });
    const blockingReasons = strings(input.classification.blockingReasons);
    return {
        requestId,
        recordId,
        requirementSetId,
        targetModel: 'requirement_confirmation',
        status: 'blocking_open',
        blocking: true,
        currentSemanticHashes: {
            sourceDocumentHash: currentSourceDocumentHash,
            implementationConfirmationHash: currentImplementationConfirmationHash,
        },
        latestConfirmedSemanticHashes: {
            sourceDocumentHash: latestConfirmedSourceDocumentHash,
            implementationConfirmationHash: latestConfirmedImplementationConfirmationHash,
        },
        blockingReasons,
        sourceRefs: [
            {
                sourceType: 'semantic_drift',
                id: blockingReasons.join(',') || 'semantic_confirmation_drift',
            },
            {
                sourceType: 'confirmation_drift_classifier',
                id: text(input.classification.kind) || 'semantic_reconfirmation_required',
            },
        ],
        requestedAt: input.requestedAt,
        requestedBy: input.requestedBy ?? 'main-agent-reconfirmation-router',
    };
}
function reduceReconfirmationRequested(record, payload, recordedAt) {
    const requestId = text(payload.requestId);
    const existingRequests = objects(record.reconfirmationRequests);
    if (existingRequests.some((request) => text(request.requestId) === requestId &&
        exports.OPEN_RECONFIRMATION_STATUSES.has(text(request.status)))) {
        return record;
    }
    return {
        ...record,
        status: 'reconfirm_required',
        reconfirmationRequests: [...existingRequests, payload],
        lastEventType: 'reconfirmation_requested',
        updatedAt: recordedAt,
    };
}
function shouldRollbackForReconfirmation(record) {
    return POST_REQUIREMENT_CONFIRMATION_MODELS.has(text(record.currentMentalModel));
}
function rollbackPayloadForReconfirmation(input) {
    return {
        eventType: 'mental_model_rollback_recorded',
        recordId: text(input.record.recordId),
        requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
        fromModel: text(input.record.currentMentalModel),
        toModel: 'requirement_confirmation',
        reasonCode: 'semantic_drift_reconfirmation_required',
        sourceDocumentHash: text(input.record.sourceDocumentHash),
        implementationConfirmationHash: text(input.record.implementationConfirmationHash),
        sourceRefs: [{ sourceType: 'reconfirmation_request', id: input.requestId }],
        recordedAt: input.recordedAt,
        recordedBy: input.recordedBy ?? 'main-agent-reconfirmation-router',
    };
}
function reduceMentalModelRollbackForReconfirmation(record, payload, recordedAt) {
    const requestId = text(objects(payload.sourceRefs)[0]?.id);
    const openRequest = openReconfirmationRequests(record).some((request) => text(request.requestId) === requestId &&
        text(request.status) === 'blocking_open' &&
        text(request.targetModel) === 'requirement_confirmation');
    if (!openRequest) {
        throw new Error('mental_model_rollback_requires_open_blocking_reconfirmation');
    }
    return {
        ...record,
        currentMentalModel: 'requirement_confirmation',
        currentStage: 'requirement_confirmation',
        mentalModelTransitions: [...objects(record.mentalModelTransitions), payload],
        lastEventType: 'mental_model_rollback_recorded',
        updatedAt: recordedAt,
    };
}
function syncRequirementRecordIndexForRecordPath(recordPath) {
    if (!fs.existsSync(recordPath))
        return null;
    const record = (0, requirement_record_control_store_1.readJson)(recordPath);
    const recordId = text(record.recordId);
    const requirementSetId = text(record.requirementSetId) || recordId;
    if (!recordId || !requirementSetId)
        return null;
    const root = projectRootForRecord(recordPath);
    const indexPath = path.join(runtimeRootForRecord(recordPath), 'index.json');
    let index = {
        version: 1,
        source: '_bmad-output/runtime/requirement-records/index.json',
    };
    if (fs.existsSync(indexPath)) {
        try {
            index = (0, requirement_record_control_store_1.readJson)(indexPath);
        }
        catch {
            index = { version: 1, source: '_bmad-output/runtime/requirement-records/index.json' };
        }
    }
    const updatedAt = text(record.updatedAt) || new Date().toISOString();
    const recordRef = {
        requirementSetId,
        recordId,
        recordPath: repoRelativePath(root, recordPath),
        flow: text(record.flow) || text(record.entryFlow) || 'standalone_tasks',
        status: text(record.status) || 'user_confirmed',
        updatedAt,
    };
    const records = objects(index.records);
    const nextRecords = [
        recordRef,
        ...records.filter((item) => text(item.recordId) !== recordId || text(item.requirementSetId) !== requirementSetId),
    ];
    const items = objects(index.items);
    const itemRef = {
        requirementId: requirementSetId,
        sourceType: 'controlled_requirement_record',
        flow: recordRef.flow,
        status: recordRef.status,
        recordId,
        requirementSetId,
        recordPath: recordRef.recordPath,
        sourcePath: text(record.sourcePath) ? repoRelativePath(root, text(record.sourcePath)) : '',
        sourceDocumentHash: text(record.sourceDocumentHash),
        implementationConfirmationHash: text(record.implementationConfirmationHash),
        confirmationPageHash: text(record.confirmationPageHash),
        updatedAt,
    };
    const nextItems = [
        itemRef,
        ...items.filter((item) => text(item.requirementId) !== requirementSetId || text(item.recordId) !== recordId),
    ];
    const active = object(index.active);
    const nextIndex = {
        ...index,
        version: 1,
        source: '_bmad-output/runtime/requirement-records/index.json',
        updatedAt,
        active: text(active.recordId) === recordId || text(active.requirementSetId) === requirementSetId
            ? {
                ...active,
                requirementSetId,
                recordId,
                recordPath: recordRef.recordPath,
            }
            : active,
        records: nextRecords,
        items: nextItems,
    };
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8');
    return normalizePathForRecord(indexPath);
}
function requestSemanticReconfirmation(input) {
    const recordedAt = input.recordedAt ?? new Date().toISOString();
    const initialRecord = (0, requirement_record_control_store_1.readJson)(input.recordPath);
    const payload = buildReconfirmationRequestedPayload({
        record: initialRecord,
        classification: input.classification,
        requestedAt: recordedAt,
        requestedBy: input.recordedBy,
    });
    const existingOpen = openReconfirmationRequests(initialRecord).find((request) => text(request.requestId) === text(payload.requestId));
    if (existingOpen) {
        const indexPath = syncRequirementRecordIndexForRecordPath(input.recordPath);
        return {
            requestId: text(existingOpen.requestId),
            eventId: null,
            receiptPath: null,
            eventLogPath: path.join(path.dirname(input.recordPath), 'events', 'control-events.jsonl'),
            indexPath,
            rollbackEventId: null,
            reusedExistingRequest: true,
            record: (0, requirement_record_control_store_1.readJson)(input.recordPath),
        };
    }
    const commit = (0, requirement_record_control_store_1.appendControlEventAndReplay)({
        recordPath: input.recordPath,
        writerId: 'main-agent-reconfirmation-router',
        eventType: 'reconfirmation_requested',
        payload,
        payloadSchemaVersion: 'reconfirmation_requested/v1',
        recordedAt,
        reduce: (record) => reduceReconfirmationRequested(record, payload, recordedAt),
    });
    let rollbackCommit = null;
    const afterRequest = (0, requirement_record_control_store_1.readJson)(input.recordPath);
    if (shouldRollbackForReconfirmation(afterRequest)) {
        const rollbackPayload = rollbackPayloadForReconfirmation({
            record: afterRequest,
            requestId: text(payload.requestId),
            recordedAt,
            recordedBy: input.recordedBy,
        });
        rollbackCommit = (0, requirement_record_control_store_1.appendControlEventAndReplay)({
            recordPath: input.recordPath,
            writerId: 'main-agent-reconfirmation-router',
            eventType: 'mental_model_rollback_recorded',
            payload: rollbackPayload,
            payloadSchemaVersion: 'mental_model_rollback_recorded/v1',
            recordedAt,
            reduce: (record) => reduceMentalModelRollbackForReconfirmation(record, rollbackPayload, recordedAt),
        });
    }
    const indexPath = syncRequirementRecordIndexForRecordPath(input.recordPath);
    return {
        requestId: text(payload.requestId),
        eventId: commit.event.eventId,
        receiptPath: commit.receiptPath,
        eventLogPath: commit.eventLogPath,
        indexPath,
        rollbackEventId: rollbackCommit?.event.eventId ?? null,
        reusedExistingRequest: false,
        record: (0, requirement_record_control_store_1.readJson)(input.recordPath),
    };
}
