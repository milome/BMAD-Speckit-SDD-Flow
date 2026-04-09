import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { ensureScoringBuild } from '../helpers/ensure-scoring-build';
import {
  createGovernancePacketExecutionRecord,
  updateGovernancePacketExecutionRecord,
} from '../../scripts/governance-packet-execution-store';

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

async function readMessage(proc: ReturnType<typeof spawn>): Promise<JsonRpcMessage> {
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

describe('dashboard execution state', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('surfaces execution-state truth in snapshot, UI bundle, and runtime MCP', async () => {
    const fixture = await createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
    });
    roots.push(fixture.root);

    createGovernancePacketExecutionRecord({
      projectRoot: fixture.root,
      queueItemId: 'queue-dashboard-execution',
      loopStateId: 'loop-15-1-runtime-dashboard-sft',
      attemptNumber: 1,
      rerunGate: 'implementation-readiness',
      artifactPath: path.join(
        fixture.root,
        '_bmad-output',
        'implementation-artifacts',
        'epic-15',
        'story-15-1-runtime-dashboard-sft',
        'attempt-1.md'
      ),
      packetPaths: {
        cursor: path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md'),
        claude: path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'attempt-1.claude-packet.md'),
      },
      authoritativeHost: 'cursor',
      fallbackHosts: ['claude'],
    });
    updateGovernancePacketExecutionRecord(
      fixture.root,
      'loop-15-1-runtime-dashboard-sft',
      1,
      (record) => ({
        ...record,
        status: 'running',
        lastLaunch: {
          externalRunId: 'dashboard-execution-run-001',
          metadata: {
            dispatchedHost: 'claude',
            fallbackUsed: true,
          },
        },
      })
    );
    execSync('npm run build:scoring', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });

    const server = await startLiveDashboardServer({
      root: fixture.root,
      host: '127.0.0.1',
      port: 0,
      dataPath: fixture.dataPath,
    });

    try {
      const snapshot = await (await fetch(`${server.url}/api/snapshot`)).json() as {
        execution_state: {
          execution_status: string;
          configured_authoritative_host: string;
          dispatched_host: string;
          fallback_used: boolean;
        };
      };
      const appJs = await (await fetch(`${server.url}/app.js`)).text();

      expect(snapshot.execution_state).toEqual(
        expect.objectContaining({
          execution_status: 'running',
          configured_authoritative_host: 'cursor',
          dispatched_host: 'claude',
          fallback_used: true,
        })
      );
      expect(appJs).toContain('Execution State');
      expect(appJs).toContain('Execution Host');

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
              name: 'get_current_run_summary',
              arguments: {},
            },
          })
        );
        const summary = await readMessage(proc);

        expect(summary.result?.structuredContent).toEqual(
          expect.objectContaining({
            execution_state: expect.objectContaining({
              execution_status: 'running',
              dispatched_host: 'claude',
            }),
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
  }, 120000);
});
