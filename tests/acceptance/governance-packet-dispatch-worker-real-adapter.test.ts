import {
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

function createPacketFixture(hostKind: 'cursor' | 'claude') {
  const root = mkdtempSync(path.join(os.tmpdir(), `gov-dispatch-real-${hostKind}-`));
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
      rmSync(root, { recursive: true, force: true });
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
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_LAUNCH_COMMAND` ]: process.execPath,
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_LAUNCH_ARGS_JSON` ]: JSON.stringify([scriptPath]),
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_LAUNCH_MODE` ]: mode,
    [ `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_STARTUP_TIMEOUT_MS` ]: String(startupTimeoutMs),
  } as NodeJS.ProcessEnv;
}

describe('governance packet dispatch worker real adapter', () => {
  it('accepts packet-stdin launch via a real child process and records launch metadata', async () => {
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

  it('accepts json-stdout launch via a real external wrapper command', async () => {
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
          env: createNodeLaunchEnv('cursor', launcherPath, 'json-stdout', 500),
        }),
      });

      expect(updated?.status).toBe('running');
      expect(updated?.lastLaunch?.externalRunId).toBe('cursor-launch-001');
      expect(updated?.lastLaunch?.metadata?.lane).toBe('wrapper-json');
      expect(existsSync(receiptPath)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns retry_pending when no real host launch command is configured', async () => {
    const fixture = createPacketFixture('cursor');
    try {
      createRecord(fixture.root, 'cursor', fixture.packetPath);
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: {},
        }),
      });

      expect(updated?.status).toBe('retry_pending');
      expect(updated?.lastDispatchError).toContain('no real launch command configured');
      expect(readGovernancePacketExecutionRecord(fixture.root, 'loop-cursor', 1)?.status).toBe('retry_pending');
    } finally {
      fixture.cleanup();
    }
  });

  it('returns retry_pending when the external wrapper explicitly fails', async () => {
    const fixture = createPacketFixture('cursor');
    const launcherPath = path.join(fixture.root, 'json-fail-launcher.cjs');
    try {
      writeFileSync(
        launcherPath,
        "process.stdout.write(JSON.stringify({ kind: 'failed', reason: 'downstream host rejected the packet' }));",
        'utf8'
      );

      createRecord(fixture.root, 'cursor', fixture.packetPath);
      const [updated] = await processPendingExecutionRecords(fixture.root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: createNodeLaunchEnv('cursor', launcherPath, 'json-stdout', 500),
        }),
      });

      expect(updated?.status).toBe('retry_pending');
      expect(updated?.lastDispatchError).toContain('downstream host rejected the packet');
    } finally {
      fixture.cleanup();
    }
  });

  it('returns retry_pending when the external wrapper times out during launch', async () => {
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
