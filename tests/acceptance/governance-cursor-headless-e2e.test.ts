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
import { spawnSync } from 'node:child_process';
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

const runHeadlessE2E = process.env.BMAD_RUN_CURSOR_HEADLESS_E2E === '1';

function commandExists(command: string, args: string[]): boolean {
  const probe = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  return !probe.error && probe.status === 0;
}

function hasCursorCli(): boolean {
  if (process.env.BMAD_CURSOR_AGENT_COMMAND && process.env.BMAD_CURSOR_AGENT_COMMAND.trim()) {
    return true;
  }
  return (
    commandExists('cursor-agent', ['--version']) ||
    commandExists('cursor', ['--version']) ||
    commandExists('cursor.exe', ['--version'])
  );
}

function waitFor(check: () => boolean, timeoutMs: number, intervalMs = 1000): void {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

describe.skipIf(!runHeadlessE2E || !hasCursorCli())('governance cursor headless e2e', () => {
  it(
    'launches the default cursor authoritative adapter and auto-ingests a completed implementation-resume execution',
    async () => {
      const repoRoot = process.cwd();
      const root = mkdtempSync(path.join(os.tmpdir(), 'gov-cursor-headless-e2e-'));
      try {
        cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
        linkRepoNodeModulesIntoProject(root);

        const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
        mkdirSync(path.dirname(configPath), { recursive: true });
        writeFileSync(
          configPath,
          [
            'version: 2',
            'primaryHost: cursor',
            'packetHosts:',
            '  - cursor',
            'provider:',
            '  mode: stub',
            '  id: cursor-headless-e2e-stub',
            'execution:',
            '  enabled: true',
            '  authoritativeHost: cursor',
            '  fallbackHosts: []',
          ].join('\n'),
          'utf8'
        );

        const packetPath = path.join(
          root,
          '_bmad-output',
          'planning-artifacts',
          'cursor-headless-e2e',
          'attempt-1.cursor-packet.md'
        );
        mkdirSync(path.dirname(packetPath), { recursive: true });
        const outputFile = path.join(root, 'cursor-headless-e2e.txt');
        writeFileSync(
          packetPath,
          [
            '# Governance Resume Original Execution Packet',
            '',
            '## Resume Original Execution',
            '- Requested Flow: story',
            '- Blocked By Gate: implementation-readiness',
            '- Original Tool: Agent',
            '',
            '## Original Blocked Prompt',
            '',
            `Create the file \`${outputFile.replace(/\\/g, '/')}\` with the exact text \`cursor headless e2e ok\`.`,
            'Do not ask follow-up questions. Finish after the file is written.',
          ].join('\n'),
          'utf8'
        );

        const record = createGovernancePacketExecutionRecord({
          projectRoot: root,
          queueItemId: 'cursor-headless-e2e-01',
          loopStateId: 'loop-cursor-headless-e2e',
          attemptNumber: 1,
          rerunGate: 'implementation-resume',
          artifactPath: packetPath.replace(/\.cursor-packet\.md$/i, '.md'),
          packetPaths: { cursor: packetPath },
          authoritativeHost: 'cursor',
          fallbackHosts: [],
        });

        const [updated] = await processPendingExecutionRecords(root, {
          adapter: createGovernanceHostDispatchAdapter(),
          timeoutMinutes: 2,
        });

        expect(updated?.status).toBe('running');
        waitFor(() => {
          const current = readGovernancePacketExecutionRecord(
            root,
            record.loopStateId,
            record.attemptNumber
          );
          return Boolean(current && ['gate_passed', 'escalated', 'retry_pending'].includes(current.status));
        }, 180000, 2000);

        const finished = readGovernancePacketExecutionRecord(
          root,
          record.loopStateId,
          record.attemptNumber
        );
        expect(finished?.status).toBe('gate_passed');
        expect(existsSync(outputFile)).toBe(true);
        expect(readFileSync(outputFile, 'utf8')).toContain('cursor headless e2e ok');

        const receiptPath = path.join(
          root,
          '_bmad-output',
          'runtime',
          'governance',
          'cursor-agent-launches',
          `${record.executionId}.json`
        );
        expect(existsSync(receiptPath)).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    240000
  );
});
