"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportOpenAiChatRows = exportOpenAiChatRows;
const validation_report_1 = require("../validation-report");
function toOpenAiMessage(message) {
    const content = (0, validation_report_1.normalizeMessageContent)(message.content);
    const row = {
        role: message.role,
    };
    if (content.length > 0) {
        row.content = content;
    }
    if (message.tool_call_id) {
        row.tool_call_id = message.tool_call_id;
    }
    if (message.tool_calls && message.tool_calls.length > 0) {
        row.tool_calls = message.tool_calls;
    }
    if (message.weight != null) {
        row.weight = message.weight;
    }
    return row;
}
function exportOpenAiChatRows(samples) {
    const accumulator = (0, validation_report_1.createValidationAccumulator)();
    for (const sample of samples) {
        accumulator.seenSamples.push(sample);
        const decision = (0, validation_report_1.assessSampleForTarget)(sample, 'openai_chat');
        if (!decision.exportable) {
            accumulator.rejectedSamples.push((0, validation_report_1.createRejectedSampleReport)(sample, decision));
            continue;
        }
        const row = {
            messages: sample.messages.map(toOpenAiMessage),
            parallel_tool_calls: false,
            metadata: {
                sample_id: sample.sample_id,
                run_id: sample.source.run_id,
                split: sample.split.assignment,
                acceptance_decision: sample.quality.acceptance_decision,
                ...(0, validation_report_1.buildExportRowRedactionMetadata)(sample),
            },
            ...(sample.tools && sample.tools.length > 0 ? { tools: sample.tools } : {}),
        };
        accumulator.exportedSamples.push(sample);
        (0, validation_report_1.pushRowBySplit)(accumulator.rowsBySplit, sample.split.assignment, row);
    }
    return {
        target: 'openai_chat',
        rowsBySplit: accumulator.rowsBySplit,
        validationReport: (0, validation_report_1.finalizeValidationReport)('openai_chat', accumulator),
    };
}
