import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { ensureScoringBuild } from '../helpers/ensure-scoring-build';

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
      proc.stdout.off('data', onData);
      resolve(JSON.parse(body) as JsonRpcMessage);
    };

    proc.stdout.on('data', onData);
    proc.once('error', reject);
  });
}

describe('runtime dashboard sft tab integration', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Windows may transiently keep git temp files locked after child exit.
      }
    }
  });

  it('surfaces canonical SFT builder state consistently across live dashboard API, UI tab, and MCP tools', async () => {
    const fixture = await createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
    });
    roots.push(fixture.root);

    const server = await startLiveDashboardServer({
      root: fixture.root,
      host: '127.0.0.1',
      port: 0,
      dataPath: fixture.dataPath,
    });

    try {
      const sftSummary = await (await fetch(`${server.url}/api/sft-summary`)).json() as {
        total_candidates: number;
        accepted: number;
        rejected: number;
        last_bundle?: { bundle_id: string } | null;
        target_availability?: Record<string, { compatible: number; incompatible: number }>;
      };
      const appJs = await (await fetch(`${server.url}/app.js`)).text();

      expect(sftSummary).toEqual(
        expect.objectContaining({
          total_candidates: 2,
          accepted: 1,
          rejected: 1,
          last_bundle: expect.objectContaining({
            bundle_id: fixture.lastBundleId,
          }),
          target_availability: expect.objectContaining({
            openai_chat: expect.objectContaining({
              compatible: 1,
            }),
            hf_tool_calling: expect.objectContaining({
              compatible: 0,
            }),
          }),
        })
      );
      expect(appJs).toContain('Last Bundle');
      expect(appJs).toContain('Target Availability');

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
        await readMessage(proc);

        proc.stdin.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'preview_sft',
              arguments: {},
            },
          })
        );
        const previewResponse = await readMessage(proc);

        proc.stdin.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'export_sft',
              arguments: {
                target: 'openai_chat',
              },
            },
          })
        );
        const exportResponse = await readMessage(proc);

        expect(previewResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            total_candidates: 2,
            accepted: 1,
            rejected: 1,
          })
        );
        expect(exportResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            target: 'openai_chat',
            compatible_samples: 1,
            last_bundle_id: fixture.lastBundleId,
          })
        );
      } finally {
        if (!proc.killed) {
          proc.kill();
        }
        await new Promise((resolve) => proc.once('exit', resolve));
      }
    } finally {
      await server.close();
    }
  }, 40000);
});
