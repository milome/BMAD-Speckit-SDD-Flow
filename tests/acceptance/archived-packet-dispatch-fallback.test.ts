import {
  mkdtempSync,
  mkdirSync,
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
import { processPendingExecutionRecords } from '../../scripts/governance-packet-dispatch-worker';
import { createGovernanceHostDispatchAdapter } from '../../scripts/governance-host-dispatch-adapter';

function createWrapper(root: string, fileName: string, payload: string): string {
  const file = path.join(root, fileName);
  writeFileSync(file, payload, 'utf8');
  return file;
}

function createPacket(root: string, hostKind: 'cursor' | 'claude'): string {
  const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', `attempt-1.${hostKind}-packet.md`);
  mkdirSync(path.dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `# ${hostKind} packet\n`, 'utf8');
  return packetPath;
}

describe.skip('legacy archived: packet dispatch fallback path', () => {
  it('falls back to the next host when the authoritative host rejects launch in the archived dispatch path', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-dispatch-fallback-'));
    try {
      const cursorPacket = createPacket(root, 'cursor');
      const claudePacket = createPacket(root, 'claude');
      const cursorLauncher = createWrapper(
        root,
        'cursor-launcher.cjs',
        "process.stdout.write(JSON.stringify({ kind: 'rejected', reason: 'cursor unavailable' }));"
      );
      const claudeLauncher = createWrapper(
        root,
        'claude-launcher.cjs',
        "process.stdout.write(JSON.stringify({ kind: 'accepted', externalRunId: 'claude-fallback-run', metadata: { lane: 'fallback' } }));"
      );

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-fallback-1',
        loopStateId: 'loop-fallback',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: {
          cursor: cursorPacket,
          claude: claudePacket,
        },
        authoritativeHost: 'cursor',
        fallbackHosts: ['claude'],
      });

      const [updated] = await processPendingExecutionRecords(root, {
        adapter: createGovernanceHostDispatchAdapter({
          env: {
            BMAD_GOVERNANCE_CURSOR_LAUNCH_COMMAND: process.execPath,
            BMAD_GOVERNANCE_CURSOR_LAUNCH_ARGS_JSON: JSON.stringify([cursorLauncher]),
            BMAD_GOVERNANCE_CURSOR_LAUNCH_MODE: 'json-stdout',
            BMAD_GOVERNANCE_CLAUDE_LAUNCH_COMMAND: process.execPath,
            BMAD_GOVERNANCE_CLAUDE_LAUNCH_ARGS_JSON: JSON.stringify([claudeLauncher]),
            BMAD_GOVERNANCE_CLAUDE_LAUNCH_MODE: 'json-stdout',
          },
        }),
      });

      expect(updated?.status).toBe('running');
      expect(updated?.dispatchAttemptCount).toBe(2);
      expect(updated?.lastLaunch?.externalRunId).toBe('claude-fallback-run');
      expect(updated?.lastLaunch?.metadata?.dispatchedHost).toBe('claude');
      expect(updated?.lastLaunch?.metadata?.fallbackUsed).toBe(true);
      expect(updated?.history.some((entry) => entry.kind === 'dispatch-rejected' && entry.note?.includes('cursor unavailable'))).toBe(true);
      expect(updated?.history.some((entry) => entry.kind === 'dispatch-accepted' && entry.note?.includes('fallback claude accepted'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('escalates after exhausting authoritative and fallback dispatch attempts in the archived dispatch path', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-dispatch-fallback-escalate-'));
    try {
      const cursorPacket = createPacket(root, 'cursor');
      const claudePacket = createPacket(root, 'claude');
      const cursorLauncher = createWrapper(
        root,
        'cursor-fail-launcher.cjs',
        "process.stdout.write(JSON.stringify({ kind: 'failed', reason: 'cursor transport failed' }));"
      );
      const claudeLauncher = createWrapper(
        root,
        'claude-fail-launcher.cjs',
        "process.stdout.write(JSON.stringify({ kind: 'failed', reason: 'claude transport failed' }));"
      );

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-fallback-2',
        loopStateId: 'loop-fallback-escalate',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: {
          cursor: cursorPacket,
          claude: claudePacket,
        },
        authoritativeHost: 'cursor',
        fallbackHosts: ['claude'],
      });

      const [updated] = await processPendingExecutionRecords(root, {
        maxDispatchAttempts: 2,
        adapter: createGovernanceHostDispatchAdapter({
          env: {
            BMAD_GOVERNANCE_CURSOR_LAUNCH_COMMAND: process.execPath,
            BMAD_GOVERNANCE_CURSOR_LAUNCH_ARGS_JSON: JSON.stringify([cursorLauncher]),
            BMAD_GOVERNANCE_CURSOR_LAUNCH_MODE: 'json-stdout',
            BMAD_GOVERNANCE_CLAUDE_LAUNCH_COMMAND: process.execPath,
            BMAD_GOVERNANCE_CLAUDE_LAUNCH_ARGS_JSON: JSON.stringify([claudeLauncher]),
            BMAD_GOVERNANCE_CLAUDE_LAUNCH_MODE: 'json-stdout',
          },
        }),
      });

      expect(updated?.status).toBe('escalated');
      expect(updated?.dispatchAttemptCount).toBe(2);
      expect(updated?.lastDispatchError).toContain('claude transport failed');
      expect(updated?.history.some((entry) => entry.kind === 'escalated')).toBe(true);
      expect(readGovernancePacketExecutionRecord(root, 'loop-fallback-escalate', 1)?.status).toBe('escalated');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
