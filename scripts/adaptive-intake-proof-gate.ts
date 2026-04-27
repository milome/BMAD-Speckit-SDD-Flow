/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  isActiveUserStoryMappingStatus,
  readUserStoryMappingIndexOrDefault,
  writeUserStoryMappingIndex,
  type UserStoryMappingFlow,
  type UserStoryMappingIndex,
  type UserStoryMappingItem,
} from './user-story-mapping';

export interface AdaptiveIntakeProofReport {
  reportType: 'adaptive_intake_proof_gate';
  critical_failures: number;
  checks: Array<{
    id: string;
    passed: boolean;
    summary: string;
  }>;
  orphanTaskCount: number;
  coveredFlows: UserStoryMappingFlow[];
}

const REQUIRED_FLOWS: UserStoryMappingFlow[] = ['story', 'bugfix', 'standalone_tasks'];

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function isMapped(item: UserStoryMappingItem): boolean {
  return (
    normalizeText(item.requirementId) !== '' &&
    normalizeText(item.epicId) !== '' &&
    normalizeText(item.storyId) !== '' &&
    normalizeText(item.sprintId) !== '' &&
    item.allowedWriteScope.length > 0
  );
}

function queueSyncPath(projectRoot: string, requirementId: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'adaptive-intake-queue-sync',
    `${requirementId}.json`
  );
}

function hasQueueSync(projectRoot: string, item: UserStoryMappingItem): boolean {
  const file = queueSyncPath(projectRoot, item.requirementId);
  if (!fs.existsSync(file)) {
    return false;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      decision?: {
        route?: {
          requirementId?: string;
          storyId?: string;
          allowedWriteScope?: string[];
        } | null;
        applied?: boolean;
      };
    };
    return (
      parsed.decision?.applied === true &&
      parsed.decision.route?.requirementId === item.requirementId &&
      parsed.decision.route?.storyId === item.storyId &&
      Array.isArray(parsed.decision.route?.allowedWriteScope) &&
      parsed.decision.route.allowedWriteScope.length > 0
    );
  } catch {
    return false;
  }
}

export function evaluateAdaptiveIntakeProof(
  projectRoot: string,
  index: UserStoryMappingIndex = readUserStoryMappingIndexOrDefault(projectRoot)
): AdaptiveIntakeProofReport {
  const activeItems = index.items.filter((item) => isActiveUserStoryMappingStatus(item.status));
  const orphanItems = activeItems.filter((item) => !isMapped(item));
  const coveredFlows = REQUIRED_FLOWS.filter((flow) =>
    activeItems.some((item) => item.flow === flow && isMapped(item))
  );
  const missingFlows = REQUIRED_FLOWS.filter((flow) => !coveredFlows.includes(flow));
  const missingQueueSync = activeItems.filter((item) => !hasQueueSync(projectRoot, item));

  const checks = [
    {
      id: 'orphan-task-zero',
      passed: orphanItems.length === 0,
      summary:
        orphanItems.length === 0
          ? 'orphan-task=0'
          : `orphan-task=${orphanItems.length}: ${orphanItems
              .map((item) => item.requirementId)
              .join(', ')}`,
    },
    {
      id: 'three-flow-coverage',
      passed: missingFlows.length === 0,
      summary:
        missingFlows.length === 0
          ? 'story/bugfix/standalone_tasks covered'
          : `missing flows: ${missingFlows.join(', ')}`,
    },
    {
      id: 'queue-sync-dependency-proof',
      passed: missingQueueSync.length === 0,
      summary:
        missingQueueSync.length === 0
          ? 'all active mappings have applied queue-sync artifacts'
          : `missing queue-sync: ${missingQueueSync
              .map((item) => item.requirementId)
              .join(', ')}`,
    },
  ];

  return {
    reportType: 'adaptive_intake_proof_gate',
    critical_failures: checks.filter((check) => !check.passed).length,
    checks,
    orphanTaskCount: orphanItems.length,
    coveredFlows,
  };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--cwd' && argv[index + 1]) {
      out.cwd = argv[++index];
    } else if (token === '--contract-fixture') {
      out.contractFixture = 'true';
    }
  }
  return out;
}

function fixtureItem(flow: UserStoryMappingFlow): UserStoryMappingItem {
  return {
    requirementId: `REQ-${flow}`,
    sourceType: flow === 'bugfix' ? 'bugfix' : flow === 'standalone_tasks' ? 'standalone' : 'prd',
    epicId: `E-${flow}`,
    storyId: `S-${flow}`,
    flow,
    sprintId: 'SPRINT-CONTRACT',
    allowedWriteScope: [`src/${flow}/**`],
    status: 'planned',
  };
}

function writeFixtureQueueSync(projectRoot: string, item: UserStoryMappingItem): void {
  const file = queueSyncPath(projectRoot, item.requirementId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        decision: {
          applied: true,
          route: {
            requirementId: item.requirementId,
            storyId: item.storyId,
            allowedWriteScope: item.allowedWriteScope,
          },
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

function createContractFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-proof-'));
  const items = REQUIRED_FLOWS.map((flow) => fixtureItem(flow));
  writeUserStoryMappingIndex(root, {
    version: 1,
    updatedAt: '2026-04-27T00:00:00.000Z',
    source: '_bmad-output/runtime/governance/user_story_mapping.json',
    items,
  });
  for (const item of items) {
    writeFixtureQueueSync(root, item);
  }
  return root;
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const fixtureRoot = args.contractFixture === 'true' ? createContractFixtureRoot() : null;
  const root = fixtureRoot ?? path.resolve(args.cwd ?? process.cwd());
  try {
    const report = evaluateAdaptiveIntakeProof(root);
    console.log(JSON.stringify(report, null, 2));
    return report.critical_failures === 0 ? 0 : 1;
  } finally {
    if (fixtureRoot) {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
