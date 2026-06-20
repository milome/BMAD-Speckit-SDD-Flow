"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invokeRuntimeMcpTool = invokeRuntimeMcpTool;
exports.runRuntimeMcpServer = runRuntimeMcpServer;
const live_server_1 = require("./live-server");
const runtime_query_1 = require("./runtime-query");
const SERVER_INFO = {
    name: 'bmad-runtime-dashboard',
    version: '2.0.2',
};
function writeMessage(payload) {
    const body = JSON.stringify(payload);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}
function buildTools() {
    return [
        {
            name: 'get_current_run_summary',
            description: 'Return the selected runtime run summary, current stage, and health score.',
            inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        },
        {
            name: 'get_stage_status',
            description: 'Return the current stage timeline for the selected run.',
            inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        },
        {
            name: 'get_score_gate_result',
            description: 'Return score gate summary including veto count and latest score detail.',
            inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        },
        {
            name: 'preview_sft',
            description: 'Return the current SFT candidate summary preview.',
            inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        },
        {
            name: 'export_sft',
            description: 'Return export guidance for the current SFT dataset surface.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    target: { type: 'string' },
                },
            },
        },
        {
            name: 'open_dashboard',
            description: 'Return the live dashboard URL.',
            inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        },
        {
            name: 'get_runtime_service_health',
            description: 'Return the MCP/live-dashboard/shared-core health summary.',
            inputSchema: { type: 'object', additionalProperties: false, properties: {} },
        },
    ];
}
function buildToolResult(text, structuredContent) {
    return {
        content: [{ type: 'text', text }],
        structuredContent,
    };
}
async function invokeRuntimeMcpTool(toolName, toolArgs, dashboardUrl, options) {
    const snapshot = (0, runtime_query_1.queryRuntimeDashboard)(options);
    const sftSummary = (0, runtime_query_1.hydrateSftSummaryFromLatestBundle)(snapshot.sft_summary);
    switch (toolName) {
        case 'get_current_run_summary':
            return buildToolResult(`run=${snapshot.selection.run_id ?? 'N/A'} status=${snapshot.overview.status} stage=${snapshot.runtime_context.current_stage ?? 'N/A'} execution=${snapshot.execution_state.execution_status ?? 'N/A'} reviewer=${snapshot.runtime_context.reviewer_contract?.reviewerIdentity ?? 'N/A'}`, {
                run_id: snapshot.selection.run_id,
                status: snapshot.overview.status,
                current_stage: snapshot.runtime_context.current_stage,
                health_score: snapshot.overview.health_score,
                execution_state: snapshot.execution_state,
                reviewer_contract: snapshot.runtime_context.reviewer_contract ?? null,
            });
        case 'get_stage_status':
            return buildToolResult(`timeline_entries=${snapshot.stage_timeline.length} reviewer_route=${snapshot.execution_state.reviewer_route_explainability?.[0]?.activeAuditConsumer?.profile ?? 'N/A'}`, {
                current_stage: snapshot.runtime_context.current_stage,
                timeline: snapshot.stage_timeline,
                execution_state: snapshot.execution_state,
                reviewer_route_explainability: snapshot.execution_state.reviewer_route_explainability ?? null,
            });
        case 'get_score_gate_result':
            return buildToolResult(`health=${snapshot.overview.health_score ?? 'N/A'} veto=${snapshot.overview.veto_count}`, {
                health_score: snapshot.overview.health_score,
                veto_count: snapshot.overview.veto_count,
                score_detail: snapshot.score_detail,
            });
        case 'preview_sft':
            return buildToolResult(`accepted=${sftSummary.accepted} rejected=${sftSummary.rejected} redacted=${sftSummary.redaction_status_counts.redacted} blocked=${sftSummary.redaction_status_counts.blocked}`, sftSummary);
        case 'export_sft': {
            const target = toolArgs && typeof toolArgs.target === 'string' ? toolArgs.target : 'openai_chat';
            const availability = sftSummary.target_availability[target];
            return buildToolResult(`target=${target} compatible=${availability?.compatible ?? 0} incompatible=${availability?.incompatible ?? 0}`, {
                target,
                compatible_samples: availability?.compatible ?? 0,
                incompatible_samples: availability?.incompatible ?? 0,
                last_bundle_id: sftSummary.last_bundle?.bundle_id ?? null,
                last_bundle: sftSummary.last_bundle,
                global_last_bundle: sftSummary.global_last_bundle,
                rejection_reasons: sftSummary.rejection_reasons,
                redaction_status_counts: sftSummary.redaction_status_counts,
                redaction_applied_rules: sftSummary.redaction_applied_rules,
                redaction_finding_kinds: sftSummary.redaction_finding_kinds,
                redaction_preview: sftSummary.redaction_preview,
            });
        }
        case 'open_dashboard':
            return buildToolResult(`dashboard_url=${dashboardUrl ?? 'N/A'}`, {
                dashboard_url: dashboardUrl,
            });
        case 'get_runtime_service_health':
            return buildToolResult(`shared core healthy reviewer=${snapshot.runtime_context.reviewer_contract?.reviewerIdentity ?? 'N/A'}`, {
                mcp: 'up',
                shared_core: 'up',
                dashboard_url: dashboardUrl,
                dashboard_source: options.dashboardSource ?? 'mcp_owned',
                reviewer_registry_version: snapshot.runtime_context.reviewer_contract?.registryVersion ?? null,
                reviewer_identity: snapshot.runtime_context.reviewer_contract?.reviewerIdentity ?? null,
            });
        default:
            return buildToolResult(`unknown tool: ${toolName}`, {
                error: 'unknown_tool',
            });
    }
}
function tryParseMessage(buffer) {
    const separatorIndex = buffer.indexOf('\r\n\r\n');
    if (separatorIndex === -1) {
        return { request: null, consumed: 0 };
    }
    const header = buffer.slice(0, separatorIndex);
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
        throw new Error(`missing content-length header: ${header}`);
    }
    const contentLength = Number(match[1]);
    const bodyStart = separatorIndex + 4;
    if (buffer.length < bodyStart + contentLength) {
        return { request: null, consumed: 0 };
    }
    const body = buffer.slice(bodyStart, bodyStart + contentLength);
    return {
        request: JSON.parse(body),
        consumed: bodyStart + contentLength,
    };
}
async function runRuntimeMcpServer(options = {}) {
    let liveServer = null;
    let dashboardUrl = options.dashboardUrl ?? null;
    let dashboardSource = options.dashboardSource ?? (options.dashboardUrl ? 'external_url' : 'mcp_owned');
    if (!dashboardUrl) {
        liveServer = await (0, live_server_1.startLiveDashboardServer)({
            root: options.root,
            dataPath: options.dataPath,
            host: options.host,
            port: options.dashboardPort ?? 43123,
            strategy: options.strategy,
            epic: options.epic,
            story: options.story,
            windowHours: options.windowHours,
        });
        dashboardUrl = liveServer.url;
        dashboardSource = 'mcp_owned';
    }
    const cleanup = async () => {
        if (liveServer) {
            await liveServer.close();
        }
    };
    process.once('SIGINT', () => {
        cleanup().finally(() => process.exit(0));
    });
    process.once('SIGTERM', () => {
        cleanup().finally(() => process.exit(0));
    });
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
        buffer += chunk;
        while (buffer.length > 0) {
            const parsed = tryParseMessage(buffer);
            if (!parsed.request) {
                return;
            }
            buffer = buffer.slice(parsed.consumed);
            const request = parsed.request;
            if (request.method === 'initialize') {
                writeMessage({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {},
                        },
                        serverInfo: SERVER_INFO,
                    },
                });
                continue;
            }
            if (request.method === 'notifications/initialized') {
                continue;
            }
            if (request.method === 'tools/list') {
                writeMessage({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        tools: buildTools(),
                    },
                });
                continue;
            }
            if (request.method === 'tools/call') {
                const toolName = typeof request.params?.name === 'string' ? request.params.name : '';
                const toolArgs = request.params && typeof request.params.arguments === 'object'
                    ? request.params.arguments
                    : undefined;
                const result = await invokeRuntimeMcpTool(toolName, toolArgs, dashboardUrl, {
                    ...options,
                    dashboardSource,
                });
                writeMessage({
                    jsonrpc: '2.0',
                    id: request.id,
                    result,
                });
                continue;
            }
            writeMessage({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32601,
                    message: `unknown method: ${request.method}`,
                },
            });
        }
    });
}
