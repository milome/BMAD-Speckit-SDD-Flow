import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('surfaces a real host tool trace fixture consistently across live dashboard API and MCP tools', async () => {
    const fixture = await createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
      withRealToolTraceFixture: true,
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
        redaction_status_counts: { clean: number; redacted: number; blocked: number };
        target_availability?: Record<string, { compatible: number; incompatible: number }>;
        redaction_preview: Array<{ sample_id: string; status: string; run_id: string }>;
      };

      expect(sftSummary).toEqual(
        expect.objectContaining({
          total_candidates: 1,
          accepted: 1,
          redaction_status_counts: {
            clean: 1,
            redacted: 0,
            blocked: 0,
          },
          target_availability: expect.objectContaining({
            openai_chat: expect.objectContaining({
              compatible: 1,
            }),
            hf_tool_calling: expect.objectContaining({
              compatible: 1,
            }),
          }),
        })
      );
      expect(sftSummary.redaction_preview).toEqual([]);

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
                target: 'hf_tool_calling',
              },
            },
          })
        );
        const exportResponse = await readMessage(proc);

        expect(previewResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            total_candidates: 1,
            accepted: 1,
            redaction_status_counts: {
              clean: 1,
              redacted: 0,
              blocked: 0,
            },
            redaction_preview: [],
          })
        );
        expect(exportResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            target: 'hf_tool_calling',
            compatible_samples: 1,
            incompatible_samples: 0,
            redaction_status_counts: {
              clean: 1,
              redacted: 0,
              blocked: 0,
            },
            redaction_preview: [],
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

  it('does not emit implement dimension warning when real host implement fixture is parsed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const fixture = await createRuntimeDashboardFixture({
        withSftDataset: true,
        withRealToolTraceFixture: true,
      });
      roots.push(fixture.root);

      const errorOutput = consoleSpy.mock.calls.flat().join(' ');
      expect(errorOutput).not.toContain('implement stage report has no parseable dimension_scores');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('surfaces real host redacted and blocked tool trace fixtures consistently across live dashboard API and MCP tools', async () => {
    const fixture = await createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
      withRealToolTraceFixture: true,
      realToolTraceVariants: ['clean', 'redacted', 'blocked'],
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
        redaction_status_counts: { clean: number; redacted: number; blocked: number };
        target_availability?: Record<string, { compatible: number; incompatible: number }>;
        rejection_reasons: Array<{ reason: string; count: number }>;
        redaction_preview: Array<{
          run_id: string;
          status: string;
          applied_rules: string[];
          finding_kinds: string[];
          rejection_reasons: string[];
        }>;
      };

      expect(sftSummary).toEqual(
        expect.objectContaining({
          total_candidates: 3,
          accepted: 2,
          rejected: 1,
          redaction_status_counts: {
            clean: 1,
            redacted: 1,
            blocked: 1,
          },
          target_availability: expect.objectContaining({
            openai_chat: expect.objectContaining({
              compatible: 2,
              incompatible: 1,
            }),
            hf_tool_calling: expect.objectContaining({
              compatible: 2,
              incompatible: 1,
            }),
          }),
          rejection_reasons: expect.arrayContaining([
            { reason: 'redaction_blocked', count: 1 },
            { reason: 'secret_detected_unresolved', count: 1 },
          ]),
        })
      );
      expect(sftSummary.redaction_preview).toEqual([
        expect.objectContaining({
          run_id: fixture.runId,
          status: 'blocked',
          applied_rules: ['private-key'],
          finding_kinds: ['private_key'],
          rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
        }),
        expect.objectContaining({
          run_id: fixture.runId,
          status: 'redacted',
          applied_rules: ['secret-token'],
          finding_kinds: ['secret_token'],
          rejection_reasons: [],
        }),
      ]);

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
                target: 'hf_tool_calling',
              },
            },
          })
        );
        const exportResponse = await readMessage(proc);

        expect(previewResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            total_candidates: 3,
            accepted: 2,
            rejected: 1,
            redaction_status_counts: {
              clean: 1,
              redacted: 1,
              blocked: 1,
            },
            redaction_preview: [
              expect.objectContaining({
                run_id: fixture.runId,
                status: 'blocked',
              }),
              expect.objectContaining({
                run_id: fixture.runId,
                status: 'redacted',
              }),
            ],
          })
        );
        expect(exportResponse.result?.structuredContent).toEqual(
          expect.objectContaining({
            target: 'hf_tool_calling',
            compatible_samples: 2,
            incompatible_samples: 1,
            rejection_reasons: expect.arrayContaining([
              { reason: 'redaction_blocked', count: 1 },
              { reason: 'secret_detected_unresolved', count: 1 },
            ]),
            redaction_status_counts: {
              clean: 1,
              redacted: 1,
              blocked: 1,
            },
            redaction_preview: [
              expect.objectContaining({
                run_id: fixture.runId,
                status: 'blocked',
              }),
              expect.objectContaining({
                run_id: fixture.runId,
                status: 'redacted',
              }),
            ],
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
