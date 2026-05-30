import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RuntimeContextFile } from './runtime-context';
import type { RuntimeFlowId } from './runtime-governance';

export type UserStoryMappingSourceType = 'brief' | 'prd' | 'bugfix' | 'standalone' | 'churn_in';
export type UserStoryMappingFlow = 'story' | 'bugfix' | 'standalone_tasks';
export type UserStoryMappingStatus = 'planned' | 'in_progress' | 'blocked' | 'done';

export interface UserStoryMappingItem {
  requirementId: string;
  sourceType: UserStoryMappingSourceType;
  epicId: string;
  storyId: string;
  flow: UserStoryMappingFlow;
  sprintId: string;
  allowedWriteScope: string[];
  status: UserStoryMappingStatus;
  acceptanceRefs?: string[];
  lastPacketId?: string | null;
  updatedAt?: string;
}

export interface UserStoryMappingIndex {
  version: 1;
  updatedAt: string;
  source: string;
  items: UserStoryMappingItem[];
}

export function userStoryMappingIndexPath(projectRoot: string): string {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
}

export function defaultUserStoryMappingIndex(): UserStoryMappingIndex {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: '_bmad-output/runtime/requirement-records/index.json',
    items: [],
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/g, '/');
}

function mappingFromRequirementRecord(
  projectRoot: string,
  recordEntry: Record<string, unknown>
): UserStoryMappingItem | null {
  const recordPath = text(recordEntry.recordPath ?? recordEntry.path ?? recordEntry.controlRecordPath);
  const requirementSetId = text(recordEntry.requirementSetId ?? recordEntry.recordId);
  const absoluteRecordPath = recordPath
    ? path.resolve(projectRoot, normalizePathForRecord(recordPath))
    : requirementSetId
      ? path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', requirementSetId, 'requirement-record.json')
      : '';
  if (!absoluteRecordPath || !fs.existsSync(absoluteRecordPath)) return null;
  try {
    const record = JSON.parse(fs.readFileSync(absoluteRecordPath, 'utf8')) as Record<string, unknown>;
    const flow = text(record.flow ?? record.entryFlow);
    if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks') return null;
    const bindings = Array.isArray(record.taskBindings)
      ? record.taskBindings.filter((item): item is Record<string, unknown> => Boolean(object(item)))
      : [];
    const activeBinding =
      bindings.find((item) => ['planned', 'in_progress'].includes(text(item.status))) ??
      bindings[0] ??
      {};
    const artifactRoot = text(record.artifactRoot ?? record.artifactPath ?? record.sourcePath);
    return {
      requirementId: text(record.recordId) || requirementSetId,
      sourceType: flow === 'bugfix' ? 'bugfix' : flow === 'standalone_tasks' ? 'standalone' : 'prd',
      epicId: text(activeBinding.epicId ?? record.epicId) || 'unscoped',
      storyId: text(activeBinding.storyId ?? record.storyId) || text(record.recordId) || requirementSetId || 'unscoped',
      flow,
      sprintId: text(activeBinding.sprintId ?? record.sprintId) || 'unscoped',
      allowedWriteScope:
        Array.isArray(activeBinding.allowedWriteScope) &&
        activeBinding.allowedWriteScope.every((item) => typeof item === 'string')
          ? (activeBinding.allowedWriteScope as string[])
          : artifactRoot
            ? [normalizePathForRecord(artifactRoot), `${normalizePathForRecord(artifactRoot)}/**`]
            : [],
      status: (['planned', 'in_progress', 'blocked', 'done'].includes(text(activeBinding.status))
        ? text(activeBinding.status)
        : text(record.status) === 'closed'
          ? 'done'
          : text(record.status) === 'blocked'
            ? 'blocked'
            : 'planned') as UserStoryMappingStatus,
      acceptanceRefs: Array.isArray(activeBinding.acceptanceRefs)
        ? activeBinding.acceptanceRefs.map(text).filter(Boolean)
        : [],
      lastPacketId: text(activeBinding.lastPacketId) || null,
      updatedAt: text(record.updatedAt),
    };
  } catch {
    return null;
  }
}

function entriesFromRequirementRecordIndex(index: Record<string, unknown>): Record<string, unknown>[] {
  const records = index.records;
  if (Array.isArray(records)) {
    return records.filter((item): item is Record<string, unknown> => Boolean(object(item)));
  }
  if (records && typeof records === 'object') {
    return Object.entries(records as Record<string, unknown>).map(([id, value]) =>
      typeof value === 'string' ? { requirementSetId: id, recordPath: value } : { requirementSetId: id, ...(object(value) ?? {}) }
    );
  }
  return [];
}

function readRequirementRecordBackedIndex(
  projectRoot: string,
  indexPath: string,
  parsed: Record<string, unknown>
): UserStoryMappingIndex {
  const items = entriesFromRequirementRecordIndex(parsed)
    .map((entry) => mappingFromRequirementRecord(projectRoot, entry))
    .filter((item): item is UserStoryMappingItem => item !== null);
  return {
    version: 1,
    updatedAt: text(parsed.updatedAt) || new Date().toISOString(),
    source: path.relative(projectRoot, indexPath).replace(/\\/g, '/'),
    items,
  };
}

export function readUserStoryMappingIndexOrDefault(projectRoot: string): UserStoryMappingIndex {
  const file = userStoryMappingIndexPath(projectRoot);
  if (!fs.existsSync(file)) {
    return defaultUserStoryMappingIndex();
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as UserStoryMappingIndex & Record<string, unknown>;
  if (!Array.isArray(parsed.items)) {
    return readRequirementRecordBackedIndex(projectRoot, file, parsed);
  }
  return {
    ...defaultUserStoryMappingIndex(),
    ...parsed,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    source: '_bmad-output/runtime/requirement-records/index.json',
  };
}

export function writeUserStoryMappingIndex(
  projectRoot: string,
  index: UserStoryMappingIndex
): void {
  const file = userStoryMappingIndexPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload: UserStoryMappingIndex = {
    ...index,
    version: 1,
    updatedAt: new Date().toISOString(),
    source: '_bmad-output/runtime/requirement-records/index.json',
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

export function isActiveUserStoryMappingStatus(status: UserStoryMappingStatus): boolean {
  return status === 'planned' || status === 'in_progress';
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function scoreRuntimeMatch(
  item: UserStoryMappingItem,
  runtimeContext: Partial<RuntimeContextFile> | null,
  flow: UserStoryMappingFlow
): number {
  let score = item.flow === flow ? 50 : 0;
  if (runtimeContext?.storyId && item.storyId === runtimeContext.storyId) {
    score += 200;
  }
  if (runtimeContext?.epicId && item.epicId === runtimeContext.epicId) {
    score += 80;
  }
  if (runtimeContext?.artifactRoot) {
    const artifactRoot = runtimeContext.artifactRoot.toLowerCase();
    score += stringList(item.allowedWriteScope).some((scope) => artifactRoot.includes(scope.toLowerCase()))
      ? 20
      : 0;
  }
  if (runtimeContext?.stage === 'implement' && isActiveUserStoryMappingStatus(item.status)) {
    score += 15;
  }
  return score;
}

export function findMappingsForRequirement(
  index: UserStoryMappingIndex,
  requirementId: string
): UserStoryMappingItem[] {
  return index.items.filter((item) => item.requirementId === requirementId);
}

export function selectBestMappingForRuntimeContext(
  index: UserStoryMappingIndex,
  runtimeContext: Partial<RuntimeContextFile> | null,
  flow: RuntimeFlowId
): UserStoryMappingItem | null {
  if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks') {
    return null;
  }
  return (
    index.items
      .map((item) => ({
        item,
        score: scoreRuntimeMatch(item, runtimeContext, flow),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.item.storyId.localeCompare(right.item.storyId);
      })[0]?.item ?? null
  );
}

export function upsertUserStoryMappingItem(
  index: UserStoryMappingIndex,
  nextItem: UserStoryMappingItem
): UserStoryMappingIndex {
  const now = new Date().toISOString();
  const items = index.items.map((item) => ({ ...item }));
  const matchIndex = items.findIndex(
    (item) => item.requirementId === nextItem.requirementId && item.storyId === nextItem.storyId
  );

  if (matchIndex >= 0) {
    items[matchIndex] = { ...items[matchIndex], ...nextItem, updatedAt: now };
  } else {
    items.push({ ...nextItem, updatedAt: now });
  }

  return {
    ...index,
    updatedAt: now,
    items,
  };
}

export function deactivateSiblingActiveMappings(
  index: UserStoryMappingIndex,
  requirementId: string,
  preservedStoryId: string
): UserStoryMappingIndex {
  const now = new Date().toISOString();
  return {
    ...index,
    updatedAt: now,
    items: index.items.map((item) => {
      if (
        item.requirementId === requirementId &&
        item.storyId !== preservedStoryId &&
        isActiveUserStoryMappingStatus(item.status)
      ) {
        return { ...item, status: 'blocked', updatedAt: now };
      }
      return item;
    }),
  };
}

export function normalizeCandidateId(value: string): string {
  const normalized = normalizeText(value).replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized === '' ? 'unknown-requirement' : normalized;
}
