import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CompiledPromptRef,
  ExecutionDisciplineProfile,
  OrchestrationFlow,
} from './orchestration-dispatch-contract';

export type ConfirmedSourceResolution =
  | { status: 'confirmed'; recordPath: string; sourcePath: string; sourceDocumentHash: string; implementationConfirmationHash: string }
  | { status: 'no_confirmed_source'; reason: string }
  | { status: 'confirmed_source_unresolvable'; reason: string; blockingReasons: string[] };

export interface CompiledPromptRunResult {
  status: 'pass' | 'blocked' | 'no_confirmed_source' | 'confirmed_source_unresolvable';
  confirmedSource: ConfirmedSourceResolution;
  outDir: string | null;
  compiledPromptRef: CompiledPromptRef | null;
  blockingReasons: string[];
  stdoutPath: string | null;
  stderrPath: string | null;
  auditReceiptPath: string | null;
}

const FORBIDDEN_PROFILE_AUTHORITY_FIELDS = [
  'traceRows',
  'covers',
  'requiredCommands',
  'taskList',
  'section7Tasks',
  'legacyPromptBody',
  'sourcePathAuthority',
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function hasForbiddenProfileField(value: unknown, pathPrefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => hasForbiddenProfileField(item, `${pathPrefix}[${index}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const own = FORBIDDEN_PROFILE_AUTHORITY_FIELDS.includes(key) ? [currentPath] : [];
    return [...own, ...hasForbiddenProfileField(item, currentPath)];
  });
}

function writeProfileSnapshot(filePath: string, profile: ExecutionDisciplineProfile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
}

function hasControlledConfirmation(record: Record<string, unknown>): boolean {
  const history = Array.isArray(record.confirmationHistory) ? record.confirmationHistory : [];
  return history.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const event = item as Record<string, unknown>;
    return (
      text(event.eventType) === 'confirmation_recorded' &&
      text(event.sourceDocumentHash) === text(record.sourceDocumentHash) &&
      text(event.implementationConfirmationHash) === text(record.implementationConfirmationHash)
    );
  });
}

export function resolveConfirmedSource(input: {
  projectRoot: string;
  recordPath?: string | null;
  sourcePath?: string | null;
}): ConfirmedSourceResolution {
  if (!input.recordPath || !fs.existsSync(input.recordPath)) {
    return { status: 'no_confirmed_source', reason: 'record_path_missing' };
  }
  const record = readJson(input.recordPath);
  const hasInlineConfirmedImplementation =
    text((record.implementationConfirmation as Record<string, unknown> | undefined)?.status) ===
    'user_confirmed';
  const isRuntimeRegistryBridge = Boolean(record.runtimeRegistryBridge);
  if (isRuntimeRegistryBridge && !hasControlledConfirmation(record) && !hasInlineConfirmedImplementation) {
    return { status: 'no_confirmed_source', reason: 'runtime_registry_bridge_no_confirmed_source' };
  }
  if (
    text(record.status) !== 'user_confirmed' &&
    !hasControlledConfirmation(record) &&
    !hasInlineConfirmedImplementation
  ) {
    return { status: 'no_confirmed_source', reason: 'no_confirmed_source' };
  }
  if (
    text(record.status) === 'user_confirmed' &&
    !hasControlledConfirmation(record) &&
    !hasInlineConfirmedImplementation
  ) {
    return {
      status: 'confirmed_source_unresolvable',
      reason: 'confirmed_source_unresolvable',
      blockingReasons: ['controlled_confirmation_event_missing'],
    };
  }
  const sourcePath = path.resolve(
    input.projectRoot,
    input.sourcePath || text(record.sourcePath) || text(record.artifactPath)
  );
  const blockingReasons: string[] = [];
  if (!fs.existsSync(sourcePath)) blockingReasons.push('source_path_missing');
  const sourceDocumentHash = text(record.sourceDocumentHash);
  const implementationConfirmationHash = text(record.implementationConfirmationHash);
  if (!sourceDocumentHash) blockingReasons.push('source_document_hash_missing');
  if (!implementationConfirmationHash) blockingReasons.push('implementation_confirmation_hash_missing');
  if (blockingReasons.length > 0) {
    return {
      status: 'confirmed_source_unresolvable',
      reason: 'confirmed_source_unresolvable',
      blockingReasons,
    };
  }
  return {
    status: 'confirmed',
    recordPath: input.recordPath,
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
  };
}

function resolveReqTraceSkillDir(projectRoot: string): string {
  const candidates = [
    path.join(projectRoot, '_bmad', 'skills', 'req-trace-matrix-prompt-generator'),
    path.join(projectRoot, '.codex', 'skills', 'req-trace-matrix-prompt-generator'),
    path.join(process.env.HOME || '', '.codex', 'skills', 'req-trace-matrix-prompt-generator'),
    path.join(process.env.USERPROFILE || '', '.codex', 'skills', 'req-trace-matrix-prompt-generator'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'scripts', 'generate_prompt.js')));
  if (!found) throw new Error('req-trace skill generate_prompt.js not found');
  return found;
}

export function runMainAgentCompiledPrompt(input: {
  projectRoot: string;
  recordPath?: string | null;
  sourcePath?: string | null;
  packetId: string;
  flow: OrchestrationFlow;
  executionHost: 'codex' | 'claude-code' | 'cursor-ide' | 'cursor-cli' | 'generic';
  executionDisciplineProfile?: ExecutionDisciplineProfile | null;
  profileRefPath?: string | null;
  goalCommandAvailable?: 'true' | 'false' | 'auto';
  reqTraceSkillDir?: string | null;
}): CompiledPromptRunResult {
  const confirmedSource = resolveConfirmedSource(input);
  if (confirmedSource.status !== 'confirmed') {
    return {
      status: confirmedSource.status,
      confirmedSource,
      outDir: null,
      compiledPromptRef: null,
      blockingReasons:
        confirmedSource.status === 'confirmed_source_unresolvable'
          ? confirmedSource.blockingReasons
          : [],
      stdoutPath: null,
      stderrPath: null,
      auditReceiptPath: null,
    };
  }

  const recordDir = path.dirname(confirmedSource.recordPath);
  const outDir = path.join(recordDir, 'trace-execution', input.packetId);
  fs.mkdirSync(outDir, { recursive: true });
  const profileRefPath =
    input.profileRefPath ?? path.join(outDir, 'execution-discipline-profile.json');
  let expectedProfileHash: string | null = input.executionDisciplineProfile?.profileHash ?? null;
  if (input.executionDisciplineProfile) {
    writeProfileSnapshot(profileRefPath, input.executionDisciplineProfile);
  } else if (input.profileRefPath && fs.existsSync(input.profileRefPath)) {
    expectedProfileHash = text(readJson(input.profileRefPath).profileHash);
  }
  const reqTraceDir = input.reqTraceSkillDir ?? resolveReqTraceSkillDir(input.projectRoot);
  const script = path.join(reqTraceDir, 'scripts', 'generate_prompt.js');
  const stdoutPath = path.join(outDir, 'compiler.stdout.log');
  const stderrPath = path.join(outDir, 'compiler.stderr.log');
  const args = [
    script,
    '--requirement-record',
    confirmedSource.recordPath,
    '--source-document',
    confirmedSource.sourcePath,
    '--out-dir',
    outDir,
    '--execution-host',
    input.executionHost,
    '--prompt-language',
    'auto',
    '--human-prompt-profile',
    'full',
    '--json',
    '--goal-command-available',
    input.goalCommandAvailable ?? 'auto',
  ];
  if (fs.existsSync(profileRefPath)) {
    args.push('--execution-discipline-profile-ref', profileRefPath);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: input.projectRoot,
    encoding: 'utf8',
  });
  fs.writeFileSync(stdoutPath, result.stdout ?? '', 'utf8');
  fs.writeFileSync(stderrPath, result.stderr ?? result.error?.message ?? '', 'utf8');

  const blockingReasons: string[] = [];
  if ((result.status ?? 1) !== 0) blockingReasons.push(`compiler_exit_${result.status ?? 1}`);
  if ((result.stdout ?? '').includes('BLOCK:')) blockingReasons.push('compiler_block');

  const modelPacketPath = path.join(outDir, 'model_packet.json');
  const humanPromptPath = path.join(outDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  for (const [code, filePath] of [
    ['model_packet_missing', modelPacketPath],
    ['human_prompt_missing', humanPromptPath],
    ['audit_receipt_missing', auditReceiptPath],
    ['execution_discipline_profile_missing', profileRefPath],
  ] as const) {
    if (!fs.existsSync(filePath)) blockingReasons.push(code);
  }
  if (blockingReasons.length > 0) {
    return {
      status: 'blocked',
      confirmedSource,
      outDir,
      compiledPromptRef: null,
      blockingReasons,
      stdoutPath,
      stderrPath,
      auditReceiptPath: fs.existsSync(auditReceiptPath) ? auditReceiptPath : null,
    };
  }

  const receipt = readJson(auditReceiptPath);
  const packet = readJson(modelPacketPath);
  const goalExecutionPath = path.join(outDir, 'goal_execution.md');
  const goalMode = text((receipt.goalCommand as Record<string, unknown> | undefined)?.mode);
  const receiptDecision = text(receipt.decision);
  if (receiptDecision !== 'pass') {
    blockingReasons.push(`audit_receipt_${receiptDecision || 'not_pass'}`);
  }
  if (text(packet.artifactRole) !== 'execution_authority') {
    blockingReasons.push('model_packet_not_execution_authority');
  }
  if (text(packet.sourceDocumentHash) !== confirmedSource.sourceDocumentHash) {
    blockingReasons.push('model_packet_source_hash_mismatch');
  }
  if (text(packet.implementationConfirmationHash) !== confirmedSource.implementationConfirmationHash) {
    blockingReasons.push('model_packet_confirmation_hash_mismatch');
  }
  if (expectedProfileHash) {
    const profile = readJson(profileRefPath);
    const declaredHash = text(profile.profileHash);
    const profileForHash = { ...profile };
    delete profileForHash.profileHash;
    const computedProfileHash = sha256Json(profileForHash);
    if (declaredHash && declaredHash !== computedProfileHash) {
      blockingReasons.push('execution_discipline_profile_declared_hash_mismatch');
    }
    if (expectedProfileHash && declaredHash !== expectedProfileHash) {
      blockingReasons.push('execution_discipline_profile_hash_mismatch');
    }
    const receiptProfile = receipt.executionDisciplineProfile as Record<string, unknown> | undefined;
    if (receiptProfile && text(receiptProfile.profileHash) !== declaredHash) {
      blockingReasons.push('audit_receipt_profile_hash_mismatch');
    }
    const forbiddenFields = hasForbiddenProfileField(profile);
    if (forbiddenFields.length > 0) {
      blockingReasons.push(`execution_discipline_profile_forbidden_fields:${forbiddenFields.join(',')}`);
    }
    if (text(profile.flow) !== input.flow) {
      blockingReasons.push('execution_discipline_profile_flow_mismatch');
    }
  }
  if (goalMode === 'native_goal_inline') {
    blockingReasons.push('native_goal_inline_rejected');
  }
  if (
    input.goalCommandAvailable === 'true' &&
    (input.executionHost === 'codex' || input.executionHost === 'claude-code') &&
    goalMode !== 'native_goal_document_ref'
  ) {
    blockingReasons.push(`native_goal_document_ref_required:${goalMode || 'missing'}`);
  }
  if (goalMode === 'native_goal_document_ref' && !fs.existsSync(goalExecutionPath)) {
    blockingReasons.push('goal_execution_missing');
  }
  const receiptGoalHash = text((receipt.goalCommand as Record<string, unknown> | undefined)?.documentHash);
  if (goalMode === 'native_goal_document_ref') {
    const actualGoalHash = fs.existsSync(goalExecutionPath) ? sha256File(goalExecutionPath) : '';
    if (receiptGoalHash && receiptGoalHash !== actualGoalHash) {
      blockingReasons.push('goal_execution_hash_mismatch');
    }
  }
  if (blockingReasons.length > 0) {
    return {
      status: 'blocked',
      confirmedSource,
      outDir,
      compiledPromptRef: null,
      blockingReasons,
      stdoutPath,
      stderrPath,
      auditReceiptPath,
    };
  }

  return {
    status: 'pass',
    confirmedSource,
    outDir,
    compiledPromptRef: {
      modelPacketPath,
      modelPacketHash: sha256File(modelPacketPath),
      humanPromptPath,
      humanPromptHash: sha256File(humanPromptPath),
      auditReceiptPath,
      auditReceiptHash: sha256File(auditReceiptPath),
      goalExecutionPath: fs.existsSync(goalExecutionPath) ? goalExecutionPath : null,
      goalExecutionHash: fs.existsSync(goalExecutionPath) ? sha256File(goalExecutionPath) : null,
      sourceDocumentHash: confirmedSource.sourceDocumentHash,
      implementationConfirmationHash: confirmedSource.implementationConfirmationHash,
    },
    blockingReasons: [],
    stdoutPath,
    stderrPath,
    auditReceiptPath,
  };
}
