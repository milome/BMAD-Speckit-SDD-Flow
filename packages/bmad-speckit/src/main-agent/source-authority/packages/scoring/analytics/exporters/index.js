"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCanonicalSamples = exportCanonicalSamples;
const hf_conversational_1 = require("./hf-conversational");
const hf_tool_calling_1 = require("./hf-tool-calling");
const openai_chat_1 = require("./openai-chat");
function exportCanonicalSamples(samples, target) {
    if (target === 'openai_chat') {
        return (0, openai_chat_1.exportOpenAiChatRows)(samples);
    }
    if (target === 'hf_conversational') {
        return (0, hf_conversational_1.exportHfConversationalRows)(samples);
    }
    return (0, hf_tool_calling_1.exportHfToolCallingRows)(samples);
}
