import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  governanceCurrentRunPath,
  governancePendingQueueFilePath,
  type GovernanceRuntimeQueueItem,
} from '../../scripts/governance-runtime-queue';

export interface AutonomousFallbackDisabledFixture {
  root: string;
  configPath: string;
  currentRunPath: string;
  cleanup: () => void;
}

export function createAutonomousFallbackDisabledFixture(
  prefix: string,
  options: { packagedWorker?: boolean } = {}
): AutonomousFallbackDisabledFixture {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), prefix));

  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });

  if (options.packagedWorker) {
    cpSync(
      path.join(repoRoot, 'packages', 'runtime-emit', 'dist'),
      path.join(root, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'runtime-emit', 'dist'),
      { recursive: true }
    );
  }

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
      '  id: hard-cut-test-provider',
      'execution:',
      '  enabled: true',
      '  interactiveMode: main-agent',
      '  fallbackAutonomousMode: true',
      '  authoritativeHost: cursor',
      '  fallbackHosts: []',
    ].join('\n'),
    'utf8'
  );

  return {
    root,
    configPath,
    currentRunPath: governanceCurrentRunPath(root),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export function writePendingGovernanceQueueItem(
  root: string,
  itemId: string,
  item?: Partial<GovernanceRuntimeQueueItem>
): string {
  const queuePath = governancePendingQueueFilePath(root, itemId);
  mkdirSync(path.dirname(queuePath), { recursive: true });
  writeFileSync(
    queuePath,
    JSON.stringify(
      {
        id: itemId,
        type: 'governance-remediation-rerun',
        timestamp: '2026-04-25T00:00:00.000Z',
        payload: {
          projectRoot: root,
        },
        ...(item ?? {}),
      } satisfies GovernanceRuntimeQueueItem,
      null,
      2
    ),
    'utf8'
  );
  return queuePath;
}

export function queueStillPending(queuePath: string): boolean {
  return existsSync(queuePath);
}
