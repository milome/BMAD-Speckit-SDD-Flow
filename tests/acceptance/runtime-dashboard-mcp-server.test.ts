import { afterEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { ensureScoringBuild } from '../helpers/ensure-scoring-build';

ensureScoringBuild(process.cwd());

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

function encodeMessage(message: JsonRpcMessage): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

async function readMessage(
  proc: ReturnType<typeof spawn>
): Promise<JsonRpcMessage> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const splitIndex = buffer.indexOf('\r\n\r\n');
      if (splitIndex === -1) {
        return;
      }
      const header = buffer.slice(0, splitIndex);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        reject(new Error(`missing content-length header: ${header}`));
        return;
      }
      const length = Number(match[1]);
      const bodyStart = splitIndex + 4;
      if (buffer.length < bodyStart + length) {
        return;
      }
      const body = buffer.slice(bodyStart, bodyStart + length);
      proc.stdout?.off('data', onData);
      resolve(JSON.parse(body) as JsonRpcMessage);
    };

    proc.stdout?.on('data', onData);
    proc.once('error', reject);
  });
}

describe('runtime dashboard mcp server', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('boots over stdio and exposes summary-first runtime tools', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const fixture = await createRuntimeDashboardFixture();
      roots.push(fixture.root);
      ensureScoringBuild(process.cwd());

      const binPath = path.join(process.cwd(), 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
      const proc = spawn('node', [binPath, 'runtime-mcp', '--dashboard-port', '0'], {
        cwd: fixture.root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      try {
        proc.stdin.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'vitest', version: '1.0.0' },
            },
          })
        );
        const initResponse = await readMessage(proc);

        proc.stdin.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
          })
        );
        const toolsResponse = await readMessage(proc);

        proc.stdin.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'get_current_run_summary',
              arguments: {},
            },
          })
        );
        const summaryResponse = await readMessage(proc);

        proc.stdin.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
              name: 'get_runtime_service_health',
              arguments: {},
            },
          })
        );
        const healthResponse = await readMessage(proc);

        expect(initResponse.result?.capabilities).toBeDefined();
        expect(toolsResponse.result?.tools).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'get_current_run_summary' }),
            expect.objectContaining({ name: 'preview_sft' }),
            expect.objectContaining({ name: 'open_dashboard' }),
          ])
        );
        expect(summaryResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            run_id: fixture.runId,
            status: 'running',
            current_stage: 'implement',
          })
        );
        expect(healthResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            dashboard_url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:/),
          })
        );
        expect(consoleSpy.mock.calls.flat().join(' ')).not.toContain(
          'implement stage report has no parseable dimension_scores'
        );
      } finally {
        if (!proc.killed) {
          proc.kill();
        }
        await new Promise((resolve) => proc.once('exit', resolve));
      }
    } finally {
      consoleSpy.mockRestore();
    }
  }, 60000);
});
