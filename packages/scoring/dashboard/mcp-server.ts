import { startLiveDashboardServer, type LiveDashboardServerHandle } from './live-server';
import { queryRuntimeDashboard, type RuntimeDashboardQueryOptions } from './runtime-query';

export interface RuntimeMcpServerOptions extends RuntimeDashboardQueryOptions {
  host?: string;
  dashboardUrl?: string;
  dashboardPort?: number;
  dashboardSource?: 'state_reused' | 'mcp_owned' | 'external_url';
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const SERVER_INFO = {
  name: 'bmad-runtime-dashboard',
  version: '0.1.0',
};

function writeMessage(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function buildTools(): ToolDefinition[] {
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

function buildToolResult(
  text: string,
  structuredContent: Record<string, unknown>
): Record<string, unknown> {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  };
}

export async function invokeRuntimeMcpTool(
  toolName: string,
  toolArgs: Record<string, unknown> | undefined,
  dashboardUrl: string | null,
  options: RuntimeMcpServerOptions & { dashboardSource?: 'state_reused' | 'mcp_owned' | 'external_url' }
): Promise<Record<string, unknown>> {
  const snapshot = queryRuntimeDashboard(options);

  switch (toolName) {
    case 'get_current_run_summary':
      return buildToolResult(
        `run=${snapshot.selection.run_id ?? 'N/A'} status=${snapshot.overview.status} stage=${snapshot.runtime_context.current_stage ?? 'N/A'} execution=${snapshot.execution_state.execution_status ?? 'N/A'} reviewer=${snapshot.runtime_context.reviewer_contract?.reviewerIdentity ?? 'N/A'}`,
        {
          run_id: snapshot.selection.run_id,
          status: snapshot.overview.status,
          current_stage: snapshot.runtime_context.current_stage,
          health_score: snapshot.overview.health_score,
          execution_state: snapshot.execution_state,
          reviewer_contract: snapshot.runtime_context.reviewer_contract ?? null,
        }
      );
    case 'get_stage_status':
      return buildToolResult(
        `timeline_entries=${snapshot.stage_timeline.length} reviewer_route=${snapshot.execution_state.reviewer_route_explainability?.[0]?.activeAuditConsumer?.profile ?? 'N/A'}`,
        {
          current_stage: snapshot.runtime_context.current_stage,
          timeline: snapshot.stage_timeline,
          execution_state: snapshot.execution_state,
          reviewer_route_explainability:
            snapshot.execution_state.reviewer_route_explainability ?? null,
        }
      );
    case 'get_score_gate_result':
      return buildToolResult(
        `health=${snapshot.overview.health_score ?? 'N/A'} veto=${snapshot.overview.veto_count}`,
        {
          health_score: snapshot.overview.health_score,
          veto_count: snapshot.overview.veto_count,
          score_detail: snapshot.score_detail,
        }
      );
    case 'preview_sft':
      return buildToolResult(
        `accepted=${snapshot.sft_summary.accepted} rejected=${snapshot.sft_summary.rejected} redacted=${snapshot.sft_summary.redaction_status_counts.redacted} blocked=${snapshot.sft_summary.redaction_status_counts.blocked}`,
        snapshot.sft_summary as unknown as Record<string, unknown>
      );
    case 'export_sft':
      {
        const target =
          toolArgs && typeof toolArgs.target === 'string'
            ? toolArgs.target
            : 'openai_chat';
        const availability =
          snapshot.sft_summary.target_availability[
            target as keyof typeof snapshot.sft_summary.target_availability
          ];
        return buildToolResult(
          `target=${target} compatible=${availability?.compatible ?? 0} incompatible=${availability?.incompatible ?? 0}`,
          {
            target,
            compatible_samples: availability?.compatible ?? 0,
            incompatible_samples: availability?.incompatible ?? 0,
            last_bundle_id: snapshot.sft_summary.last_bundle?.bundle_id ?? null,
            last_bundle: snapshot.sft_summary.last_bundle,
            global_last_bundle: snapshot.sft_summary.global_last_bundle,
            rejection_reasons: snapshot.sft_summary.rejection_reasons,
            redaction_status_counts: snapshot.sft_summary.redaction_status_counts,
            redaction_applied_rules: snapshot.sft_summary.redaction_applied_rules,
            redaction_finding_kinds: snapshot.sft_summary.redaction_finding_kinds,
            redaction_preview: snapshot.sft_summary.redaction_preview,
          }
        );
      }
    case 'open_dashboard':
      return buildToolResult(`dashboard_url=${dashboardUrl ?? 'N/A'}`, {
        dashboard_url: dashboardUrl,
      });
    case 'get_runtime_service_health':
      return buildToolResult(
        `shared core healthy reviewer=${snapshot.runtime_context.reviewer_contract?.reviewerIdentity ?? 'N/A'}`,
        {
        mcp: 'up',
        shared_core: 'up',
        dashboard_url: dashboardUrl,
        dashboard_source: options.dashboardSource ?? 'mcp_owned',
        reviewer_registry_version:
          snapshot.runtime_context.reviewer_contract?.registryVersion ?? null,
        reviewer_identity:
          snapshot.runtime_context.reviewer_contract?.reviewerIdentity ?? null,
      });
    default:
      return buildToolResult(`unknown tool: ${toolName}`, {
        error: 'unknown_tool',
      });
  }
}

function tryParseMessage(buffer: string): {
  request: JsonRpcRequest | null;
  consumed: number;
} {
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
    request: JSON.parse(body) as JsonRpcRequest,
    consumed: bodyStart + contentLength,
  };
}

export async function runRuntimeMcpServer(
  options: RuntimeMcpServerOptions = {}
): Promise<void> {
  let liveServer: LiveDashboardServerHandle | null = null;
  let dashboardUrl = options.dashboardUrl ?? null;
  let dashboardSource: 'state_reused' | 'mcp_owned' | 'external_url' = options.dashboardSource ?? (options.dashboardUrl ? 'external_url' : 'mcp_owned');

  if (!dashboardUrl) {
    liveServer = await startLiveDashboardServer({
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
  process.stdin.on('data', async (chunk: string) => {
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
        const toolArgs =
          request.params && typeof request.params.arguments === 'object'
            ? (request.params.arguments as Record<string, unknown>)
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
