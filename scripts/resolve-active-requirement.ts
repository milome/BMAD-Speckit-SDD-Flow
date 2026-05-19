/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StageName } from './bmad-config';
import type { ImplementationEntryGate, RuntimeFlowId } from './runtime-governance';
import type { RuntimeContextFile } from './runtime-context';

const FLOWS = new Set(['story', 'bugfix', 'standalone_tasks', 'epic', 'unknown']);

function isDirectResolveActiveRequirementCli(entry: string | undefined): boolean {
  return /(^|[\\/])resolve-active-requirement(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

export interface ResolveActiveRequirementInput {
  root?: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
}

export interface ResolvedRuntimeContext {
  version: 1;
  kind: 'ResolvedRuntimeContext';
  recordId: string;
  requirementSetId: string;
  runId?: string;
  status: string;
  flow: RuntimeFlowId;
  stage: string;
  entryFlow?: string;
  entryFlowClass?: string;
  workflowAdapter?: string;
  updatedAt?: string;
  sourceMode?: string;
  sourcePath?: string;
  sourceDocumentHash?: string;
  implementationConfirmationHash?: string;
  confirmationPageHash?: string;
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  artifactRoot?: string;
  artifactPath?: string;
  latestReviewerCloseout?: unknown;
  implementationEntryGate?: ImplementationEntryGate;
  indexPath: string | null;
  recordPath: string;
  runtimePolicySnapshotPath: string;
  runtimePolicySnapshotExists: boolean;
  recoveryContextPath: string;
  recoveryContextExists: boolean;
  traceCheckpointRef?: unknown;
  traceRowsCheckpointHash?: string;
  artifactIndexPath: string;
  orchestrationStateDir: string;
  promptPacketsDir: string;
  resolutionSource: 'explicit_args' | 'explicit_args_without_index' | 'index_active' | 'index_match';
  resolvedAt: string;
}

type JsonObject = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function abs(root: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

export function requirementRecordsRoot(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'requirement-records');
}

export function requirementRecordIndexPath(root: string): string {
  return path.join(requirementRecordsRoot(root), 'index.json');
}

function defaultRecordPath(root: string, requirementSetId: string): string {
  return path.join(requirementRecordsRoot(root), requirementSetId, 'requirement-record.json');
}

function nested(obj: JsonObject, key: string): JsonObject | null {
  const value = obj[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return '';
}

function recordEntries(index: JsonObject): JsonObject[] {
  const out: JsonObject[] = [];
  for (const key of ['records', 'requirements', 'requirementRecords']) {
    const value = index[key];
    if (Array.isArray(value)) {
      out.push(...value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object'));
    } else if (value && typeof value === 'object') {
      for (const [id, entry] of Object.entries(value as JsonObject)) {
        if (typeof entry === 'string') {
          out.push({ requirementSetId: id, recordPath: entry });
        } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          out.push({ requirementSetId: id, ...(entry as JsonObject) });
        }
      }
    }
  }
  return out;
}

function pointerToInput(pointer: JsonObject): ResolveActiveRequirementInput {
  return {
    recordId: firstText(pointer.recordId, pointer.id),
    requirementSetId: firstText(pointer.requirementSetId, pointer.requirement_set_id),
    runId: firstText(pointer.runId, pointer.run_id),
    ...(firstText(pointer.recordPath, pointer.path, pointer.controlRecordPath)
      ? { recordPath: firstText(pointer.recordPath, pointer.path, pointer.controlRecordPath) }
      : {}),
  };
}

function activePointer(index: JsonObject): JsonObject | null {
  return (
    nested(index, 'active') ??
    nested(index, 'current') ??
    nested(index, 'activeRequirement') ??
    nested(index, 'currentRequirement') ??
    nested(index, 'currentRequirementRef')
  );
}

function matches(entry: JsonObject, input: ResolveActiveRequirementInput): boolean {
  const recordId = firstText(entry.recordId, entry.id);
  const requirementSetId = firstText(entry.requirementSetId, entry.requirement_set_id);
  const runId = firstText(entry.runId, entry.run_id);
  const entryRecordPath = firstText(entry.recordPath, entry.path, entry.controlRecordPath);
  const inputRecordPath = firstText(
    (input as JsonObject).recordPath,
    (input as JsonObject).path,
    (input as JsonObject).controlRecordPath
  );
  if (input.recordId && recordId !== input.recordId) return false;
  if (input.requirementSetId && requirementSetId !== input.requirementSetId) return false;
  if (input.runId && runId !== input.runId) return false;
  if (
    inputRecordPath &&
    entryRecordPath &&
    path.normalize(inputRecordPath) !== path.normalize(entryRecordPath)
  ) {
    return false;
  }
  return Boolean(input.recordId || input.requirementSetId || input.runId || inputRecordPath);
}

function selectedFromIndex(index: JsonObject, input: ResolveActiveRequirementInput): JsonObject | null {
  const entries = recordEntries(index);
  const explicit = entries.find((entry) => matches(entry, input));
  if (explicit) return { ...explicit, resolutionSource: 'index_match' };
  const pointer = activePointer(index);
  if (!pointer) return null;
  const pointed = entries.find((entry) => matches(entry, pointerToInput(pointer)));
  return { ...(pointed ?? pointer), resolutionSource: 'index_active' };
}

function refPath(record: JsonObject, defaultPathValue: string, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const candidate = text((value as JsonObject).path);
      if (candidate) return candidate;
    }
  }
  return defaultPathValue;
}

function readJsonIfExists(file: string): JsonObject | null {
  if (!fs.existsSync(file)) return null;
  return readJson(file);
}

function resolveRecordPath(root: string, selected: JsonObject | null, requirementSetId: string): string {
  const configured = firstText(selected?.recordPath, selected?.path, selected?.controlRecordPath);
  return configured ? abs(root, configured) : defaultRecordPath(root, requirementSetId);
}

function requireFlow(value: string): RuntimeFlowId {
  if (FLOWS.has(value)) return value as RuntimeFlowId;
  throw new Error(`requirement record flow invalid or missing: ${value || '<missing>'}`);
}

function requireStage(value: string): string {
  if (value) return value;
  throw new Error('requirement record stage invalid or missing');
}

function stageFromConfirmedImplementationEntry(record: JsonObject, flow: RuntimeFlowId): string {
  const status = firstText(record.status);
  const entryFlow = firstText(record.entryFlow, nested(record, 'implementationConfirmation')?.entryFlow);
  const entryFlowClass = firstText(record.entryFlowClass, nested(record, 'implementationConfirmation')?.entryFlowClass);
  const workflowAdapter = firstText(record.workflowAdapter, nested(record, 'implementationConfirmation')?.workflowAdapter);
  const architectureState = nested(record, 'architectureConfirmationState');
  const architectureStatus = firstText(architectureState?.status);
  if (
    flow === 'standalone_tasks' &&
    entryFlow === 'standalone_tasks' &&
    entryFlowClass === 'task_packet_entry' &&
    ['direct', 'legacy'].includes(workflowAdapter) &&
    ['user_confirmed', 'in_progress'].includes(status) &&
    architectureStatus === 'active'
  ) {
    return 'implement';
  }
  return '';
}

function maybeImplementationEntryGate(value: unknown): ImplementationEntryGate | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const gate = value as Partial<ImplementationEntryGate>;
  if (gate.gateName === 'implementation-readiness' && gate.decision) {
    return gate as ImplementationEntryGate;
  }
  return undefined;
}

function assertIdentity(record: JsonObject, input: ResolveActiveRequirementInput, recordPath: string): void {
  if (input.recordId && text(record.recordId) !== input.recordId) {
    throw new Error(`recordId mismatch in ${recordPath}: expected ${input.recordId}, got ${text(record.recordId)}`);
  }
  if (input.requirementSetId && text(record.requirementSetId) !== input.requirementSetId) {
    throw new Error(
      `requirementSetId mismatch in ${recordPath}: expected ${input.requirementSetId}, got ${text(record.requirementSetId)}`
    );
  }
}

export function resolveActiveRequirement(input: ResolveActiveRequirementInput = {}): ResolvedRuntimeContext {
  const root = path.resolve(input.root ?? process.cwd());
  const indexPath = requirementRecordIndexPath(root);
  const hasIndex = fs.existsSync(indexPath);
  const index = hasIndex ? readJson(indexPath) : null;
  if (!index && !input.recordId && !input.requirementSetId) {
    throw new Error(`requirement-record index missing: ${indexPath}`);
  }

  const selected = index ? selectedFromIndex(index, input) : null;
  const requirementSetId =
    input.requirementSetId ??
    firstText(selected?.requirementSetId, selected?.requirement_set_id, selected?.recordId, input.recordId);
  if (!requirementSetId) {
    throw new Error('Unable to resolve requirementSetId from explicit args or requirement index');
  }
  const recordPath = resolveRecordPath(root, selected, requirementSetId);
  if (!fs.existsSync(recordPath)) {
    throw new Error(`requirement record missing: ${recordPath}`);
  }

  const record = readJson(recordPath);
  assertIdentity(record, input, recordPath);
  const recordId = firstText(record.recordId, selected?.recordId, input.recordId);
  if (!recordId) throw new Error(`requirement record recordId missing: ${recordPath}`);
  const finalRequirementSetId = firstText(record.requirementSetId, requirementSetId);
  const base = path.dirname(recordPath);
  const runtimePolicySnapshotPath = abs(
    root,
    refPath(record, path.join(base, 'recovery', 'runtime-policy-snapshot.json'), 'runtimePolicySnapshotRef', 'runtimePolicySnapshotPath')
  );
  const runtimePolicySnapshot = readJsonIfExists(runtimePolicySnapshotPath);
  const runtimePolicySnapshotPolicy = runtimePolicySnapshot ? nested(runtimePolicySnapshot, 'policy') : null;
  const flow = requireFlow(
    firstText(
      record.flow,
      record.entryFlow,
      nested(record, 'implementationConfirmation')?.entryFlow,
      runtimePolicySnapshot?.flow,
      runtimePolicySnapshotPolicy?.flow
    )
  );
  const stage = requireStage(
    firstText(
      record.stage,
      record.currentStage,
      nested(record, 'runtime')?.stage,
      runtimePolicySnapshot?.stage,
      runtimePolicySnapshotPolicy?.stage,
      stageFromConfirmedImplementationEntry(record, flow)
    )
  );
  const recoveryContextPath = abs(
    root,
    refPath(record, path.join(base, 'recovery', 'recovery-context.json'), 'recoveryContextRef', 'recoveryContextPath')
  );

  return {
    version: 1,
    kind: 'ResolvedRuntimeContext',
    recordId,
    requirementSetId: finalRequirementSetId,
    ...(firstText(record.runId, selected?.runId, input.runId) ? { runId: firstText(record.runId, selected?.runId, input.runId) } : {}),
    status: firstText(record.status) || 'unknown',
    flow,
    stage,
    ...(firstText(record.entryFlow) ? { entryFlow: firstText(record.entryFlow) } : {}),
    ...(firstText(record.entryFlowClass) ? { entryFlowClass: firstText(record.entryFlowClass) } : {}),
    ...(firstText(record.workflowAdapter) ? { workflowAdapter: firstText(record.workflowAdapter) } : {}),
    ...(firstText(record.updatedAt, record.lastUpdatedAt, record.confirmedAt) ? { updatedAt: firstText(record.updatedAt, record.lastUpdatedAt, record.confirmedAt) } : {}),
    ...(firstText(record.sourceMode) ? { sourceMode: firstText(record.sourceMode) } : {}),
    ...(firstText(record.sourcePath) ? { sourcePath: firstText(record.sourcePath) } : {}),
    ...(firstText(record.sourceDocumentHash) ? { sourceDocumentHash: firstText(record.sourceDocumentHash) } : {}),
    ...(firstText(record.implementationConfirmationHash) ? { implementationConfirmationHash: firstText(record.implementationConfirmationHash) } : {}),
    ...(firstText(record.confirmationPageHash) ? { confirmationPageHash: firstText(record.confirmationPageHash) } : {}),
    ...(firstText(record.templateId) ? { templateId: firstText(record.templateId) } : {}),
    ...(firstText(record.epicId) ? { epicId: firstText(record.epicId) } : {}),
    ...(firstText(record.storyId) ? { storyId: firstText(record.storyId) } : {}),
    ...(firstText(record.storySlug) ? { storySlug: firstText(record.storySlug) } : {}),
    ...(firstText(record.artifactRoot) ? { artifactRoot: firstText(record.artifactRoot) } : {}),
    ...(firstText(record.artifactPath, record.sourcePath) ? { artifactPath: firstText(record.artifactPath, record.sourcePath) } : {}),
    ...(record.latestReviewerCloseout ? { latestReviewerCloseout: record.latestReviewerCloseout } : {}),
    ...(maybeImplementationEntryGate(record.implementationEntryGate) ? { implementationEntryGate: maybeImplementationEntryGate(record.implementationEntryGate) } : {}),
    indexPath: hasIndex ? indexPath : null,
    recordPath,
    runtimePolicySnapshotPath,
    runtimePolicySnapshotExists: fs.existsSync(runtimePolicySnapshotPath),
    recoveryContextPath,
    recoveryContextExists: fs.existsSync(recoveryContextPath),
    ...(record.traceCheckpointRef ? { traceCheckpointRef: record.traceCheckpointRef } : {}),
    ...(firstText(record.traceRowsCheckpointHash) ? { traceRowsCheckpointHash: firstText(record.traceRowsCheckpointHash) } : {}),
    artifactIndexPath: path.join(requirementRecordsRoot(root), 'artifact-index.jsonl'),
    orchestrationStateDir: path.join(base, 'orchestration', 'orchestration-state'),
    promptPacketsDir: path.join(base, 'prompts', 'prompt-packets'),
    resolutionSource: (selected?.resolutionSource as ResolvedRuntimeContext['resolutionSource']) ?? 'explicit_args_without_index',
    resolvedAt: new Date().toISOString(),
  };
}

export function resolvedRuntimeContextToRuntimeContext(
  resolved: ResolvedRuntimeContext
): RuntimeContextFile & {
  implementationEntryGate?: ImplementationEntryGate;
  resolvedRuntimeContext: ResolvedRuntimeContext;
} {
  return {
    version: 1,
    flow: resolved.flow,
    stage: resolved.stage as StageName,
    sourceMode:
      resolved.sourceMode === 'full_bmad' ||
      resolved.sourceMode === 'seeded_solutioning' ||
      resolved.sourceMode === 'standalone_story'
        ? resolved.sourceMode
        : undefined,
    templateId: resolved.templateId,
    epicId: resolved.epicId,
    storyId: resolved.storyId,
    storySlug: resolved.storySlug,
    runId: resolved.runId,
    artifactRoot: resolved.artifactRoot,
    artifactPath: resolved.artifactPath,
    contextScope: resolved.runId ? 'run' : resolved.storyId ? 'story' : 'project',
    latestReviewerCloseout: resolved.latestReviewerCloseout as RuntimeContextFile['latestReviewerCloseout'],
    updatedAt: resolved.updatedAt ?? resolved.resolvedAt,
    implementationEntryGate: resolved.implementationEntryGate,
    resolvedRuntimeContext: resolved,
  };
}

function parseArgs(argv: string[]): ResolveActiveRequirementInput & { json?: boolean } {
  const out: ResolveActiveRequirementInput & { json?: boolean } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--cwd' && argv[i + 1]) out.root = argv[++i];
    else if (arg === '--record-id' && argv[i + 1]) out.recordId = argv[++i];
    else if (arg === '--requirement-set-id' && argv[i + 1]) out.requirementSetId = argv[++i];
    else if (arg === '--run-id' && argv[i + 1]) out.runId = argv[++i];
    else throw new Error(`Unsupported or incomplete argument: ${arg}`);
  }
  return out;
}

export function mainResolveActiveRequirement(argv: string[]): number {
  try {
    const args = parseArgs(argv);
    const resolved = resolveActiveRequirement(args);
    process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(`resolve-active-requirement: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module && isDirectResolveActiveRequirementCli(process.argv[1])) {
  process.exit(mainResolveActiveRequirement(process.argv.slice(2)));
}
