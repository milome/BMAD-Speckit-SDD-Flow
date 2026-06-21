"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportHfToolCallingRows = exportHfToolCallingRows;
const validation_report_1 = require("../validation-report");
function exportHfToolCallingRows(samples) {
    const accumulator = (0, validation_report_1.createValidationAccumulator)();
    for (const sample of samples) {
        accumulator.seenSamples.push(sample);
        const decision = (0, validation_report_1.assessSampleForTarget)(sample, 'hf_tool_calling');
        if (!decision.exportable) {
            accumulator.rejectedSamples.push((0, validation_report_1.createRejectedSampleReport)(sample, decision));
            continue;
        }
        if (sample.split.assignment === 'holdout') {
            continue;
        }
        const row = {
            messages: sample.messages.map((message) => ({
                role: message.role,
                content: (0, validation_report_1.normalizeMessageContent)(message.content),
                ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
                ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
            })),
            tools: sample.tools ?? [],
            metadata: {
                sample_id: sample.sample_id,
                run_id: sample.source.run_id,
                split: sample.split.assignment,
                acceptance_decision: sample.quality.acceptance_decision,
                ...(0, validation_report_1.buildExportRowRedactionMetadata)(sample),
            },
        };
        accumulator.exportedSamples.push(sample);
        (0, validation_report_1.pushRowBySplit)(accumulator.rowsBySplit, sample.split.assignment, row);
    }
    return {
        target: 'hf_tool_calling',
        rowsBySplit: accumulator.rowsBySplit,
        validationReport: (0, validation_report_1.finalizeValidationReport)('hf_tool_calling', accumulator),
    };
}
