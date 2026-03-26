/**
 * CLI: sync runtime registry + project context from sprint-status.yaml (bmad-speckit subcommand).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseStoryKey } from './cli';
import { ensureStoryRuntimeContext, writeRuntimeContextFromSprintStatus } from './context';
import { buildProjectRegistryFromSprintStatus, writeRuntimeContextRegistry } from './registry';

export interface SyncFromSprintCliOptions {
  cwd?: string;
  /** When set, after project sync also scopes story context (S10). */
  storyKey?: string;
}

export function runSyncRuntimeContextFromSprintCli(opts: SyncFromSprintCliOptions = {}): void {
  const root = opts.cwd ?? process.cwd();
  const sprintPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
  if (!fs.existsSync(sprintPath)) {
    throw new Error(`sprint-status not found: ${sprintPath}`);
  }

  const registry = buildProjectRegistryFromSprintStatus(root, sprintPath);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContextFromSprintStatus(root, sprintPath);

  const sk = opts.storyKey?.trim();
  if (sk) {
    const parsed = parseStoryKey(sk);
    ensureStoryRuntimeContext(root, {
      epicId: parsed.epicId,
      storyId: sk,
      sourceMode: 'full_bmad',
    });
  }

  // eslint-disable-next-line no-console -- CLI contract (tasks S8–S10; workflows verify this line prefix)
  console.log('OK: registry and project context synced');
  // eslint-disable-next-line no-console
  console.log('activeEpicIds:', registry.project.activeEpicIds);
  // eslint-disable-next-line no-console
  console.log('activeStoryIds count:', registry.project.activeStoryIds.length);
}
