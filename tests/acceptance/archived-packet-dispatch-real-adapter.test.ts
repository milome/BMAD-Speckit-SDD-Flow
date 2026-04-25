import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createGovernancePacketExecutionRecord,
  readGovernancePacketExecutionRecord,
} from '../../scripts/governance-packet-execution-store';
import {
  processPendingExecutionRecords,
} from '../../scripts/governance-packet-dispatch-worker';
import { createGovernanceHostDispatchAdapter } from '../../scripts/governance-host-dispatch-adapter';
import { linkRepoNodeModulesIntoProject } from '../helpers/runtime-registry-fixture';

function removeDirWithRetry(target: string): void {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  if (lastError) {
    throw lastError;
  }
}

function waitFor(check: () => boolean, timeoutMs: number, intervalMs = 100): void {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

function createPacketFixture(hostKind: 'cursor' | 'claude') {
  const root = mkdtempSync(path.join(os.tmpdir(), `gov-dispatch-real-${hostKind}-`));
  cpSync(path.join(process.cwd(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(root);
  const packetPath = path.join(
    root,
    '_bmad-output',
    'planning-artifacts',
    `attempt-1.${hostKind}-packet.md`
  );
  mkdirSync(path.dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `# packet for ${hostKind}\n`, 'utf8');
  return {
    root,
    packetPath,
    cleanup() {
      removeDirWithRetry(root);
    },
  };
}

function createRecord(
  root: string,
  hostKind: 'cursor' | 'claude',
  packetPath: string,
  loopStateId = `loop-${hostKind}`
) {
  return createGovernancePacketExecutionRecord({
    projectRoot: root,
    queueItemId: `queue-${hostKind}`,
    loopStateId,
    attemptNumber: 1,
    rerunGate: 'implementation-readiness',
    artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
    packetPaths: { [hostKind]: packetPath },
    authoritativeHost: hostKind,
  });
}

function createNodeLaunchEnv(hostKind: 'cursor' | 'claude', scriptPath: string, mode: 'json-stdout' | 'packet-stdin', startupTimeoutMs = 500) {
  return {
    BMAD_GOVERNANCE_ALLOW_AUTONOMOUS_FALLBACK: '1',
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_LAUNCH_COMMAND` ]: process.execPath,
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_LAUNCH_ARGS_JSON` ]: JSON.stringify([scriptPath]),
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_LAUNCH_MODE` ]: mode,
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_STARTUP_TIMEOUT_MS` ]: String(startupTimeoutMs),
  } as NodeJS.ProcessEnv;
}

describe.skip('legacy archived: packet dispatch real-adapter path', () => {
  it('accepts packet-stdin launch via a real child process and records launch metadata in the archived dispatch path', async () => {
    const fixture = createPacketFixture('claude');
    const receiptPath = path.join(fixture.root, 'packet-stdin-receipt.json');
    const launcherPath = path.join(fixture.root, 'packet-stdin-launcher.cjs');
    try {
      writeFileSync(
        launcherPath,
        [
          "const fs = require('node:fs');",
          'let data = "";',
          "process.stdin.setEncoding('utf8');",
          "process.stdin.on('data', (chunk) => { data += chunk; });",
          "process.stdin.on('end', () => {",
          `  fs.writeFileSync(${JSON.stringify(receiptPath)}, JSON.stringify({`,
          "    executionId: process.env.BMAD_GOVERNANCE_EXECUTION_ID,",
          "    packetPath: process.env.BMAD_GOVERNANCE_PACKET_PATH,",
          '    prompt: data',
          "  }, null, 2));",
          '});',
          'setTimeout(() => process.exit(0), 250);',
        ].join('\n'),
        'utf8'
      );

      createRecord(fixture.root, 'claude', fixture.packetPath);
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: createNodeLaunchEnv('claude', launcherPath, 'packet-stdin', 150),
        }),
        leaseOwner: 'real-host-adapter',
      });

      expect(updated?.status).toBe('running');
      expect(updated?.lastLaunch?.externalRunId).toMatch(/^claude:/);
      expect(updated?.lastLaunch?.metadata?.command).toBe(process.execPath);
      expect(existsSync(receiptPath)).toBe(true);
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
        executionId: string;
        packetPath: string;
        prompt: string;
      };
      expect(receipt.executionId).toBe(updated?.executionId);
      expect(receipt.packetPath).toBe(fixture.packetPath);
      expect(receipt.prompt).toContain('# packet for claude');
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      fixture.cleanup();
    }
  });

  it('accepts json-stdout launch via a real external wrapper command in the archived dispatch path', async () => {
    const fixture = createPacketFixture('cursor');
    const receiptPath = path.join(fixture.root, 'json-launch-receipt.json');
    const launcherPath = path.join(fixture.root, 'json-launcher.cjs');
    try {
      writeFileSync(
        launcherPath,
        [
          "const fs = require('node:fs');",
          `fs.writeFileSync(${JSON.stringify(receiptPath)}, JSON.stringify({`,
          "  executionId: process.env.BMAD_GOVERNANCE_EXECUTION_ID,",
          "  packetPath: process.env.BMAD_GOVERNANCE_PACKET_PATH",
          "}, null, 2));",
          "process.stdout.write(JSON.stringify({ kind: 'accepted', externalRunId: 'cursor-launch-001', metadata: { lane: 'wrapper-json' } }));",
        ].join('\n'),
        'utf8'
      );

      createRecord(fixture.root, 'cursor', fixture.packetPath);
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: createNodeLaunchEnv('cursor', launcherPath, 'json-stdout', 2000),
        }),
      });

      expect(['running', 'retry_pending']).toContain(updated?.status);
      expect(updated?.lastLaunch?.externalRunId).toBe('cursor-launch-001');
      expect(updated?.lastLaunch?.metadata?.lane).toBe('wrapper-json');
      expect(existsSync(receiptPath)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('does not infer a cursor wrapper from BMAD_CURSOR_AGENT_* after the hard cut in the archived dispatch path', async () => {
    const fixture = createPacketFixture('cursor');
    try {
      createRecord(fixture.root, 'cursor', fixture.packetPath);
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: {
            BMAD_GOVERNANCE_ALLOW_AUTONOMOUS_FALLBACK: '1',
            BMAD_CURSOR_AGENT_COMMAND: 'definitely-missing-cursor-agent',
          },
        }),
      });

      expect(updated?.status).toBe('retry_pending');
      waitFor(() => {
        const record = readGovernancePacketExecutionRecord(fixture.root, 'loop-cursor', 1);
        return Boolean(record && record.status === 'retry_pending');
      }, 5000, 100);
      const finalRecord = readGovernancePacketExecutionRecord(fixture.root, 'loop-cursor', 1);
      expect(finalRecord?.status).toBe('retry_pending');
      expect(finalRecord?.lastDispatchError).toContain(
        'no real launch command configured for authoritative host cursor'
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('requires explicit BMAD_GOVERNANCE cursor launch config and does not use any implicit launcher wrapper in the archived dispatch path', async () => {
    const fixture = createPacketFixture('cursor');
    const fakeCursorCliPath = path.join(fixture.root, 'fake-cursor-agent.cjs');
    const observedPromptPath = path.join(fixture.root, 'fake-cursor-agent-prompt.txt');
    try {
      writeFileSync(
        fakeCursorCliPath,
        [
          "const fs = require('node:fs');",
          `fs.writeFileSync(${JSON.stringify(observedPromptPath)}, process.argv.at(-1) || '', 'utf8');`,
          "process.stdout.write(JSON.stringify({ ok: true, source: 'fake-cursor-agent' }));",
        ].join('\n'),
        'utf8'
      );

      createRecord(fixture.root, 'cursor', fixture.packetPath, 'loop-cursor-default-wrapper');
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: {
            BMAD_GOVERNANCE_ALLOW_AUTONOMOUS_FALLBACK: '1',
            BMAD_CURSOR_AGENT_COMMAND: process.execPath,
            BMAD_CURSOR_AGENT_ARGS_JSON: JSON.stringify([fakeCursorCliPath]),
          },
        }),
      });

      expect(updated?.status).toBe('retry_pending');
      expect(updated?.lastDispatchError).toContain(
        'no real launch command configured for authoritative host cursor'
      );
      expect(existsSync(observedPromptPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns retry_pending when the external wrapper explicitly fails in the archived dispatch path', async () => {
    const fixture = createPacketFixture('cursor');
    const launcherPath = path.join(fixture.root, 'json-fail-launcher.cjs');
    try {
      writeFileSync(
        launcherPath,
        "process.stdout.write(JSON.stringify({ kind: 'failed', reason: 'downstream host rejected the packet' })); process.exit(0);",
        'utf8'
      );

      createRecord(fixture.root, 'cursor', fixture.packetPath);
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: createNodeLaunchEnv('cursor', launcherPath, 'json-stdout', 2000),
        }),
      });

      expect(updated?.status).toBe('retry_pending');
      expect(updated?.lastDispatchError).toContain('downstream host rejected the packet');
    } finally {
      fixture.cleanup();
    }
  });

  it('returns retry_pending when the external wrapper times out during launch in the archived dispatch path', async () => {
    const fixture = createPacketFixture('cursor');
    const launcherPath = path.join(fixture.root, 'json-timeout-launcher.cjs');
    try {
      writeFileSync(
        launcherPath,
        "setTimeout(() => process.stdout.write(JSON.stringify({ kind: 'accepted', externalRunId: 'late-run' })), 1000);",
        'utf8'
      );

      createRecord(fixture.root, 'cursor', fixture.packetPath, 'loop-cursor-timeout');
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: createNodeLaunchEnv('cursor', launcherPath, 'json-stdout', 50),
        }),
      });

      expect(updated?.status).toBe('retry_pending');
      expect(updated?.lastDispatchError).toContain('timed out');
    } finally {
      fixture.cleanup();
    }
  });
});
