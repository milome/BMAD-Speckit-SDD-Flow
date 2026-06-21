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
exports.summarizeToolTrace = summarizeToolTrace;
exports.computeTraceCompleteness = computeTraceCompleteness;
exports.resolveToolTracePath = resolveToolTracePath;
exports.readToolTraceArtifact = readToolTraceArtifact;
exports.discoverLatestToolTraceArtifact = discoverLatestToolTraceArtifact;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const hash_1 = require("../utils/hash");
const runtime_1 = require("../runtime");
function summarizeToolTrace(trace) {
    const assistantCalls = trace.messages
        .filter((message) => message.role === 'assistant')
        .flatMap((message) => message.tool_calls ?? []);
    const toolResults = trace.messages.filter((message) => message.role === 'tool');
    const assistantCallIds = assistantCalls.map((call) => call.id);
    const toolResultIds = toolResults
        .map((message) => message.tool_call_id)
        .filter((value) => typeof value === 'string' && value.length > 0);
    const toolResultIdSet = new Set(toolResultIds);
    const assistantCallIdSet = new Set(assistantCallIds);
    const hasOrphanToolCall = assistantCallIds.some((id) => !toolResultIdSet.has(id));
    const hasOrphanToolResult = toolResultIds.some((id) => !assistantCallIdSet.has(id));
    return {
        tool_count: trace.tools.length,
        assistant_call_count: assistantCalls.length,
        tool_result_count: toolResults.length,
        has_orphan_tool_call: hasOrphanToolCall,
        has_orphan_tool_result: hasOrphanToolResult,
        call_result_matched: assistantCalls.length > 0 && !hasOrphanToolCall && !hasOrphanToolResult,
    };
}
function computeTraceCompleteness(trace, options = {}) {
    if (options.blocked) {
        return 'blocked';
    }
    if (!trace) {
        return 'missing';
    }
    const summary = summarizeToolTrace(trace);
    if (summary.assistant_call_count === 0 && summary.tool_result_count === 0) {
        return 'missing';
    }
    return summary.call_result_matched ? 'complete' : 'partial';
}
function isRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}
function isContentPart(value) {
    return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}
function isMessageContent(value) {
    return (typeof value === 'string' ||
        (Array.isArray(value) && value.every((item) => isContentPart(item))));
}
function isToolCall(value) {
    return (isRecord(value) &&
        typeof value.id === 'string' &&
        value.type === 'function' &&
        isRecord(value.function) &&
        typeof value.function.name === 'string' &&
        typeof value.function.arguments === 'string');
}
function isCanonicalMessage(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (!isMessageContent(value.content)) {
        return false;
    }
    if (value.role !== 'assistant' && value.role !== 'tool') {
        return false;
    }
    if (value.role === 'assistant') {
        return (Array.isArray(value.tool_calls) &&
            value.tool_calls.length > 0 &&
            value.tool_calls.every(isToolCall));
    }
    return typeof value.tool_call_id === 'string';
}
function isCanonicalTool(value) {
    return (isRecord(value) &&
        value.type === 'function' &&
        isRecord(value.function) &&
        typeof value.function.name === 'string' &&
        isRecord(value.function.parameters));
}
function resolveToolTracePath(toolTracePath, cwd) {
    return path.isAbsolute(toolTracePath) ? toolTracePath : path.resolve(cwd, toolTracePath);
}
function readToolTraceArtifact(toolTracePath, cwd) {
    const resolved = resolveToolTracePath(toolTracePath, cwd);
    if (!fs.existsSync(resolved)) {
        return null;
    }
    try {
        const content = fs.readFileSync(resolved, 'utf-8');
        const parsed = JSON.parse(content);
        if (!isRecord(parsed)) {
            return null;
        }
        if (!Array.isArray(parsed.tools) ||
            parsed.tools.length === 0 ||
            !parsed.tools.every(isCanonicalTool)) {
            return null;
        }
        if (!Array.isArray(parsed.messages) ||
            parsed.messages.length === 0 ||
            !parsed.messages.every(isCanonicalMessage)) {
            return null;
        }
        const toolNames = new Set(parsed.tools.map((tool) => tool.function.name));
        const calledToolNames = parsed.messages
            .filter((message) => message.role === 'assistant')
            .flatMap((message) => (message.tool_calls ?? []).map((call) => call.function.name));
        if (calledToolNames.some((name) => !toolNames.has(name))) {
            return null;
        }
        return {
            messages: parsed.messages,
            tools: parsed.tools,
            traceRef: `sha256:${(0, hash_1.computeStringHash)(content)}`,
            artifactPath: resolved,
        };
    }
    catch {
        return null;
    }
}
function isToolTraceArtifactEvent(value) {
    return (isRecord(value) &&
        value.event_type === 'artifact.attached' &&
        (value.stage == null || typeof value.stage === 'string') &&
        isRecord(value.payload) &&
        value.payload.kind === 'tool_trace' &&
        typeof value.payload.path === 'string');
}
function discoverLatestToolTraceArtifact(options) {
    const cwd = options.cwd ?? options.root;
    const events = (0, runtime_1.readRuntimeEvents)({ root: options.root }).filter((event) => event.run_id === options.runId && isToolTraceArtifactEvent(event));
    const preferredMatches = options.stage
        ? events.filter((event) => event.stage === options.stage)
        : events;
    const fallbackMatches = preferredMatches.length > 0 ? preferredMatches : events;
    for (let index = fallbackMatches.length - 1; index >= 0; index -= 1) {
        const event = fallbackMatches[index];
        if (!isToolTraceArtifactEvent(event)) {
            continue;
        }
        const loaded = readToolTraceArtifact(event.payload.path, cwd);
        if (loaded != null) {
            return {
                ...loaded,
                attachedAt: event.timestamp,
            };
        }
    }
    return null;
}
