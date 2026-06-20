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
exports.EXECUTION_STRATEGY_SELECTION_WRITER_REGISTRY_ENTRY = exports.EXECUTION_STRATEGY_SELECTION_GOVERNANCE_EVENT_REGISTRY_ENTRY = exports.EXECUTION_STRATEGY_SELECTION_WRITER_ID = exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE = void 0;
exports.sha256Stable = sha256Stable;
exports.buildExecutionStrategyOptions = buildExecutionStrategyOptions;
exports.exactExecutionStrategySelectionPhrase = exactExecutionStrategySelectionPhrase;
exports.selectExecutionStrategy = selectExecutionStrategy;
exports.validateExecutionStrategySelectionEvent = validateExecutionStrategySelectionEvent;
exports.toExecutionStrategySelectionEvent = toExecutionStrategySelectionEvent;
exports.appendExecutionStrategySelection = appendExecutionStrategySelection;
exports.appendBlockedExecutionStrategyAttempt = appendBlockedExecutionStrategyAttempt;
const crypto = __importStar(require("node:crypto"));
const requirement_record_control_store_1 = require("./requirement-record-control-store");
exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE = 'execution_strategy_selected';
exports.EXECUTION_STRATEGY_SELECTION_WRITER_ID = 'main-agent-execution-strategy-selection';
exports.EXECUTION_STRATEGY_SELECTION_GOVERNANCE_EVENT_REGISTRY_ENTRY = {
    eventType: exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
    payloadKind: 'strategy_selection',
    writesControlFields: ['executionStrategySelections'],
    canAffectControlFlow: true,
    payloadContract: {
        requiredFields: [
            'eventType',
            'recordId',
            'requirementSetId',
            'strategyId',
            'availability',
            'selectedBy',
            'strategyOptionsHash',
            'selectedOptionHash',
            'modelPacketHash',
            'sourceDocumentHash',
            'implementationConfirmationHash',
            'sourceRefs',
            'recordedAt',
            'recordedBy',
        ],
        forbiddenFields: ['traceRows', 'requiredCommands', 'requirementScopeDecision', 'recordClosed'],
        requiredSourceRefs: true,
        allowedControlWriteMode: 'control',
    },
};
exports.EXECUTION_STRATEGY_SELECTION_WRITER_REGISTRY_ENTRY = {
    writerId: exports.EXECUTION_STRATEGY_SELECTION_WRITER_ID,
    eventType: exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
    writesControlFields: ['executionStrategySelections'],
    writeMode: 'append_only_control_event',
    directRequirementRecordWrite: false,
};
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const objectValue = value;
    return `{${Object.keys(objectValue)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
        .join(',')}}`;
}
function sha256Stable(value) {
    return `sha256:${crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function strategyOption(input) {
    const hashInput = {
        strategyId: input.strategyId,
        availability: input.availability,
        blockingReasons: input.blockingReasons,
        modelPacketHash: input.modelPacketHash,
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
    };
    return {
        strategyId: input.strategyId,
        availability: input.availability,
        blockingReasons: input.blockingReasons,
        optionHash: sha256Stable(hashInput),
    };
}
function buildExecutionStrategyOptions(input) {
    const ref = input.compiledPromptRef ?? null;
    const blockingReasons = [];
    if (!ref)
        blockingReasons.push('model_packet_ref_missing');
    if (input.modelPacketGateDecision !== 'pass')
        blockingReasons.push('model_packet_gate_not_pass');
    const modelPacketHash = text(ref?.modelPacketHash);
    const sourceDocumentHash = text(ref?.sourceDocumentHash);
    const implementationConfirmationHash = text(ref?.implementationConfirmationHash);
    if (!SHA256_PATTERN.test(modelPacketHash))
        blockingReasons.push('model_packet_hash_missing_or_invalid');
    if (!SHA256_PATTERN.test(sourceDocumentHash))
        blockingReasons.push('source_document_hash_missing_or_invalid');
    if (!SHA256_PATTERN.test(implementationConfirmationHash)) {
        blockingReasons.push('implementation_confirmation_hash_missing_or_invalid');
    }
    if (blockingReasons.length > 0) {
        return {
            status: 'blocked',
            strategyOptionsHash: sha256Stable({ blockingReasons }),
            modelPacketHash,
            sourceDocumentHash,
            implementationConfirmationHash,
            options: [],
            blockingReasons,
        };
    }
    const common = { modelPacketHash, sourceDocumentHash, implementationConfirmationHash };
    const options = [
        strategyOption({
            strategyId: 'compiled_trace_direct',
            availability: 'available',
            blockingReasons: [],
            ...common,
        }),
        strategyOption({
            strategyId: 'compiled_trace_with_sdd_artifacts',
            availability: 'blocked_until_artifact_realization_lane',
            blockingReasons: ['blocked_until_artifact_realization_lane'],
            ...common,
        }),
        strategyOption({
            strategyId: 'governed_skill_adapter',
            availability: 'blocked_until_adapter_certification_gate',
            blockingReasons: ['blocked_until_adapter_certification_gate'],
            ...common,
        }),
        strategyOption({
            strategyId: 'governed_skill_prompt',
            availability: 'blocked_until_prompt_equivalence_gate',
            blockingReasons: ['blocked_until_prompt_equivalence_gate'],
            ...common,
        }),
    ];
    return {
        status: 'pass',
        strategyOptionsHash: sha256Stable({
            modelPacketHash,
            sourceDocumentHash,
            implementationConfirmationHash,
            options,
        }),
        modelPacketHash,
        sourceDocumentHash,
        implementationConfirmationHash,
        options,
        blockingReasons: [],
    };
}
function exactExecutionStrategySelectionPhrase(input) {
    return [
        `确认执行策略=${input.strategyId}`,
        `strategyOptionsHash=${input.strategyOptionsHash}`,
        `modelPacketHash=${input.modelPacketHash}`,
        `sourceDocumentHash=${input.sourceDocumentHash}`,
        `implementationConfirmationHash=${input.implementationConfirmationHash}`,
    ].join('\n');
}
function selectExecutionStrategy(input) {
    if (input.optionsResult.status !== 'pass') {
        throw new Error(`strategy options are not available: ${input.optionsResult.blockingReasons.join(',')}`);
    }
    const option = input.optionsResult.options.find((item) => item.strategyId === input.strategyId);
    if (!option)
        throw new Error(`unknown execution strategy: ${input.strategyId}`);
    if (option.availability !== 'available') {
        throw new Error(`execution strategy is not available: ${input.strategyId}:${option.availability}`);
    }
    if (input.selectedBy === 'user') {
        const expected = exactExecutionStrategySelectionPhrase({
            strategyId: input.strategyId,
            strategyOptionsHash: input.optionsResult.strategyOptionsHash,
            modelPacketHash: input.optionsResult.modelPacketHash,
            sourceDocumentHash: input.optionsResult.sourceDocumentHash,
            implementationConfirmationHash: input.optionsResult.implementationConfirmationHash,
        });
        if (input.exactPhrase !== expected) {
            throw new Error('execution strategy exact phrase mismatch');
        }
    }
    if (input.selectedBy === 'policy' && input.policyDefaultAllowed !== true) {
        throw new Error('policy default execution strategy selection is not allowed');
    }
    return {
        eventType: exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
        strategyId: option.strategyId,
        availability: 'available',
        selectedBy: input.selectedBy,
        strategyOptionsHash: input.optionsResult.strategyOptionsHash,
        selectedOptionHash: option.optionHash,
        modelPacketHash: input.optionsResult.modelPacketHash,
        sourceDocumentHash: input.optionsResult.sourceDocumentHash,
        implementationConfirmationHash: input.optionsResult.implementationConfirmationHash,
    };
}
function validateExecutionStrategySelectionEvent(event) {
    const issues = [];
    if (event.eventType !== exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE)
        issues.push('event_type_invalid');
    if (!text(event.recordId))
        issues.push('record_id_missing');
    if (!text(event.requirementSetId))
        issues.push('requirement_set_id_missing');
    if (!text(event.strategyId))
        issues.push('strategy_id_missing');
    if (event.availability !== 'available')
        issues.push('strategy_availability_not_available');
    if (event.selectedBy !== 'user' && event.selectedBy !== 'policy')
        issues.push('selected_by_invalid');
    for (const field of [
        'strategyOptionsHash',
        'selectedOptionHash',
        'modelPacketHash',
        'sourceDocumentHash',
        'implementationConfirmationHash',
    ]) {
        if (!SHA256_PATTERN.test(text(event[field])))
            issues.push(`${field}_missing_or_invalid`);
    }
    if (!Array.isArray(event.sourceRefs) || event.sourceRefs.length === 0)
        issues.push('source_refs_missing');
    if (!text(event.recordedAt))
        issues.push('recorded_at_missing');
    if (!text(event.recordedBy))
        issues.push('recorded_by_missing');
    return issues;
}
function toExecutionStrategySelectionEvent(input) {
    return {
        ...input.selection,
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        sourceRefs: input.sourceRefs,
        recordedAt: input.recordedAt,
        recordedBy: input.recordedBy,
    };
}
function appendExecutionStrategySelection(input) {
    const issues = validateExecutionStrategySelectionEvent(input.event);
    if (issues.length > 0) {
        throw new Error(`invalid execution_strategy_selected event: ${issues.join(',')}`);
    }
    return (0, requirement_record_control_store_1.appendControlEventAndReplay)({
        recordPath: input.recordPath,
        writerId: input.writerId ?? exports.EXECUTION_STRATEGY_SELECTION_WRITER_ID,
        eventType: exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
        payload: input.event,
        recordedAt: input.event.recordedAt,
        reduce: (record) => ({
            ...record,
            executionStrategySelections: [
                ...(Array.isArray(record.executionStrategySelections)
                    ? record.executionStrategySelections
                    : []),
                input.event,
            ],
            lastEventType: exports.EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
            updatedAt: input.event.recordedAt,
        }),
    });
}
function appendBlockedExecutionStrategyAttempt(input) {
    const check = {
        eventType: 'contract_check_recorded',
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        checkId: `execution-strategy-selection:${input.strategyId}`,
        contract: 'execution_strategy_selection',
        decision: 'blocked',
        sourceRefs: input.sourceRefs,
        blockingReasons: input.blockingReasons,
        recordedAt: input.recordedAt,
        recordedBy: input.recordedBy,
    };
    return (0, requirement_record_control_store_1.appendControlEventAndReplay)({
        recordPath: input.recordPath,
        writerId: input.writerId ?? exports.EXECUTION_STRATEGY_SELECTION_WRITER_ID,
        eventType: 'contract_check_recorded',
        payload: check,
        recordedAt: input.recordedAt,
        reduce: (record) => ({
            ...record,
            contractChecks: [
                ...(Array.isArray(record.contractChecks) ? record.contractChecks : []),
                check,
            ],
            lastEventType: 'contract_check_recorded',
            updatedAt: input.recordedAt,
        }),
    });
}
