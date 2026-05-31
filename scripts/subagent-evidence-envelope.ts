/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ExecutionPacket,
  RecommendationPacket,
  ResumePacket,
  TaskReport,
} from './orchestration-dispatch-contract';

type JsonObject = Record<string, unknown>;
type Packet = ExecutionPacket | RecommendationPacket | ResumePacket;

export interface SubagentEvidenceEnvelopeValidation {
  ok: boolean;
  status: 'accepted' | 'rejected' | 'partial' | 'blocked';
  mismatches: string[];
  sourceRefs: JsonObject[];
  evidenceArtifactRefs: JsonObject[];
  envelopeHash?: string;
}

export interface SubagentEvidenceEnvelopeValidationOptions {
  record?: JsonObject;
  projectRoot?: string;
  indexedArtifactRefs?: JsonObject[];
  expectedParentCloseoutAttemptId?: string;
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const ENVELOPE_VERSION = 'subagent-evidence-envelope/v1';
const ACCEPTANCE_SCHEMA_VERSION = 'subagent-evidence-envelope-acceptance/v1';

const REQUIRED_FIELDS = [
  'envelopeVersion',
  'recordId',
  'requirementSetId',
  'parentRunId',
  'parentCloseoutAttemptId',
  'subtaskId',
  'packetId',
  'packetKind',
  'executorKind',
  'executorRole',
  'decisionAuthority',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'architectureConfirmationHash',
  'traceRows',
  'coveredRequirementIds',
  'taskRefs',
  'allowedWriteScope',
  'actualFilesChanged',
  'diffHash',
  'workspaceRef',
  'commandRuns',
  'artifactRefs',
  'hookReceipts',
  'transportRefs',
  'status',
  'failureRecords',
] as const;

const FORBIDDEN_FIELDS = ['result', 'decision', 'closeoutDecision', 'requirementDecision'] as const;
const DIRECT_CONTROL_FIELDS = [
  'confirmationHistory',
  'architectureConfirmationState',
  'gateChecks',
  'contractChecks',
  'requirementClosures',
  'auditIterations',
  'rerunLoops',
  'closeout',
  'record_closed',
  'recordClosed',
] as const;
const ALLOWED_PACKET_KINDS = new Set([
  'execution',
  'resume',
  'recommendation',
  'remediation',
  'audit',
  'parallel_node',
  'authoring',
  'research',
  'hook_summary',
]);
const ALLOWED_EXECUTOR_KINDS = new Set([
  'cursor_mcp_task',
  'cursor_task',
  'claude_agent_tool',
  'codex_worker_adapter',
  'codex_spawn_agent',
  'generic_prompt_packet',
  'auditor_host',
  'hook_summary',
  'parallel_mission_node',
  'party_mode_facilitator',
  'research_subagent',
  'authoring_subagent',
  'reviewer_subagent',
  'external_host_dispatch',
]);
const ALLOWED_WORKSPACE_KINDS = new Set(['main_workspace', 'worktree', 'external_host']);
const ALLOWED_STATUSES = new Set(['accepted', 'rejected', 'partial', 'blocked']);
const WORKSPACE_REF_REQUIRED_FIELDS = ['kind', 'path', 'commitBefore', 'commitAfter'] as const;
const COMMAND_RUN_REQUIRED_FIELDS = [
  'commandId',
  'command',
  'exitCode',
  'startedAt',
  'completedAt',
  'outputSummary',
  'artifactRefs',
  'closeoutAttemptId',
] as const;

export const SUBAGENT_EVIDENCE_ENVELOPE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://bmad-speckit.local/schemas/subagent-evidence-envelope.schema.json',
  title: 'Subagent Evidence Envelope',
  type: 'object',
  additionalProperties: false,
  required: [...REQUIRED_FIELDS],
  properties: {
    envelopeVersion: { const: ENVELOPE_VERSION },
    recordId: { type: 'string', minLength: 1 },
    requirementSetId: { type: 'string', minLength: 1 },
    parentRunId: { type: 'string', minLength: 1 },
    parentCloseoutAttemptId: { type: 'string', minLength: 1 },
    subtaskId: { type: 'string', minLength: 1 },
    packetId: { type: 'string', minLength: 1 },
    packetKind: { enum: [...ALLOWED_PACKET_KINDS] },
    executorKind: { enum: [...ALLOWED_EXECUTOR_KINDS] },
    executorRole: { type: 'string', minLength: 1 },
    decisionAuthority: { const: 'none' },
    sourceDocumentHash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    implementationConfirmationHash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    architectureConfirmationHash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    traceRows: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
    coveredRequirementIds: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
    taskRefs: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
    allowedWriteScope: { type: 'array', items: { type: 'string', minLength: 1 } },
    actualFilesChanged: { type: 'array', items: { type: 'string', minLength: 1 } },
    diffHash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    workspaceRef: {
      type: 'object',
      additionalProperties: false,
      required: [...WORKSPACE_REF_REQUIRED_FIELDS],
      properties: {
        kind: { enum: [...ALLOWED_WORKSPACE_KINDS] },
        path: { type: 'string', minLength: 1 },
        commitBefore: { type: 'string', minLength: 1 },
        commitAfter: { type: 'string', minLength: 1 },
      },
    },
    commandRuns: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [...COMMAND_RUN_REQUIRED_FIELDS],
        properties: {
          commandId: { type: 'string', minLength: 1 },
          command: { type: 'string', minLength: 1 },
          exitCode: { type: 'integer' },
          startedAt: { type: 'string', minLength: 1 },
          completedAt: { type: 'string', minLength: 1 },
          outputSummary: { type: 'string', minLength: 1 },
          artifactRefs: { type: 'array', minItems: 1, items: { $ref: '#/$defs/artifactRef' } },
          closeoutAttemptId: { type: 'string', minLength: 1 },
        },
      },
    },
    artifactRefs: { type: 'array', minItems: 1, items: { $ref: '#/$defs/artifactRef' } },
    hookReceipts: { type: 'array', items: { type: 'object' } },
    transportRefs: { type: 'array', items: { type: 'object' } },
    status: { enum: [...ALLOWED_STATUSES] },
    failureRecords: { type: 'array', items: { type: 'object' } },
  },
  not: {
    anyOf: [
      ...FORBIDDEN_FIELDS.map((field) => ({ required: [field] })),
      ...DIRECT_CONTROL_FIELDS.map((field) => ({ required: [field] })),
    ],
  },
  $defs: {
    artifactRef: {
      type: 'object',
      additionalProperties: true,
      required: [
        'artifactType',
        'sourceOfTruthRole',
        'path',
        'producer',
        'purpose',
        'relatedRequirementIds',
        'status',
        'inputVersion',
        'outputVersion',
      ],
      properties: {
        artifactType: { type: 'string', minLength: 1 },
        sourceOfTruthRole: { enum: ['evidence', 'projection', 'read_model', 'control'] },
        path: { type: 'string', minLength: 1 },
        hash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        contentHash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        producer: { type: 'string', minLength: 1 },
        purpose: { type: 'string', minLength: 1 },
        relatedRequirementIds: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        status: { type: 'string', minLength: 1 },
        inputVersion: { type: 'string', minLength: 1 },
        outputVersion: { type: 'string', minLength: 1 },
      },
      anyOf: [{ required: ['hash'] }, { required: ['contentHash'] }],
    },
  },
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const objectValue = value as JsonObject;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

export function sha256Object(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

export function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function absoluteArtifactPath(projectRoot: string, artifactPath: string): string {
  return path.isAbsolute(artifactPath) ? artifactPath : path.resolve(projectRoot, artifactPath);
}

function artifactHash(artifact: JsonObject): string {
  return text(artifact.hash ?? artifact.contentHash);
}

function artifactKey(artifact: JsonObject): string {
  return `${normalizePathForRecord(text(artifact.path))}#${artifactHash(artifact)}`;
}

function addRecursiveFieldHits(
  value: unknown,
  fields: readonly string[],
  prefix: string,
  out: string[]
): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) addRecursiveFieldHits(item, fields, prefix, out);
    return;
  }
  const objectValue = value as JsonObject;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(objectValue, field)) out.push(`${prefix}:${field}`);
  }
  for (const item of Object.values(objectValue)) addRecursiveFieldHits(item, fields, prefix, out);
}

function globToRegExp(glob: string): RegExp {
  const normalized = normalizePathForRecord(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`, 'u');
}

function pathMatchesScope(filePath: string, scopes: string[]): boolean {
  const normalized = normalizePathForRecord(filePath);
  return scopes.some((scope) => globToRegExp(scope).test(normalized));
}

function validateArtifactRef(artifact: JsonObject, index: number, projectRoot: string): string[] {
  const mismatches: string[] = [];
  const prefix = `subagent_envelope_artifact_ref_${index}`;
  const artifactPath = text(artifact.path);
  const hash = artifactHash(artifact);
  if (!text(artifact.artifactType)) mismatches.push(`${prefix}_artifact_type_missing`);
  if (text(artifact.sourceOfTruthRole) !== 'evidence')
    mismatches.push(`${prefix}_source_of_truth_role_not_evidence`);
  if (!artifactPath) mismatches.push(`${prefix}_path_missing`);
  if (!hash || !SHA256_PATTERN.test(hash)) mismatches.push(`${prefix}_hash_missing_or_invalid`);
  if (!text(artifact.producer)) mismatches.push(`${prefix}_producer_missing`);
  if (!text(artifact.purpose)) mismatches.push(`${prefix}_purpose_missing`);
  if (strings(artifact.relatedRequirementIds).length === 0)
    mismatches.push(`${prefix}_related_requirement_ids_missing`);
  if (!text(artifact.status)) mismatches.push(`${prefix}_status_missing`);
  if (!text(artifact.inputVersion)) mismatches.push(`${prefix}_input_version_missing`);
  if (!text(artifact.outputVersion)) mismatches.push(`${prefix}_output_version_missing`);
  const absolute = artifactPath ? absoluteArtifactPath(projectRoot, artifactPath) : '';
  if (absolute && fs.existsSync(absolute) && hash && sha256File(absolute) !== hash) {
    mismatches.push(`${prefix}_hash_mismatch:${normalizePathForRecord(artifactPath)}`);
  }
  return mismatches;
}

function recordArchitectureHash(record?: JsonObject): string {
  const state = isObject(record?.architectureConfirmationState)
    ? (record?.architectureConfirmationState as JsonObject)
    : {};
  return text(state.currentArchitectureConfirmationHash);
}

export function validateSubagentEvidenceEnvelope(
  rawEnvelope: unknown,
  options: SubagentEvidenceEnvelopeValidationOptions = {}
): SubagentEvidenceEnvelopeValidation {
  const mismatches: string[] = [];
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  if (!isObject(rawEnvelope)) {
    return {
      ok: false,
      status: 'rejected',
      mismatches: ['subagent_evidence_envelope_missing_or_invalid'],
      sourceRefs: [],
      evidenceArtifactRefs: [],
    };
  }

  const envelope = rawEnvelope;
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(envelope, field)) {
      mismatches.push(`subagent_envelope_required_field_missing:${field}`);
    }
  }
  addRecursiveFieldHits(
    envelope,
    FORBIDDEN_FIELDS,
    'subagent_envelope_forbidden_field_present',
    mismatches
  );
  addRecursiveFieldHits(
    envelope,
    DIRECT_CONTROL_FIELDS,
    'subagent_envelope_direct_control_field_forbidden',
    mismatches
  );

  if (text(envelope.envelopeVersion) !== ENVELOPE_VERSION)
    mismatches.push('subagent_envelope_version_invalid');
  if (text(envelope.decisionAuthority) !== 'none')
    mismatches.push('subagent_envelope_decision_authority_not_none');
  if (!ALLOWED_PACKET_KINDS.has(text(envelope.packetKind))) {
    mismatches.push(
      `subagent_envelope_packet_kind_invalid:${text(envelope.packetKind) || '<missing>'}`
    );
  }
  if (!ALLOWED_EXECUTOR_KINDS.has(text(envelope.executorKind))) {
    mismatches.push(
      `subagent_envelope_executor_kind_invalid:${text(envelope.executorKind) || '<missing>'}`
    );
  }
  if (!ALLOWED_STATUSES.has(text(envelope.status))) {
    mismatches.push(`subagent_envelope_status_invalid:${text(envelope.status) || '<missing>'}`);
  }

  const record = options.record;
  if (record) {
    if (text(envelope.recordId) !== text(record.recordId))
      mismatches.push('subagent_envelope_record_id_mismatch');
    if (text(envelope.requirementSetId) !== text(record.requirementSetId)) {
      mismatches.push('subagent_envelope_requirement_set_id_mismatch');
    }
    if (text(envelope.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
      mismatches.push('subagent_envelope_source_document_hash_mismatch');
    }
    if (
      text(envelope.implementationConfirmationHash) !== text(record.implementationConfirmationHash)
    ) {
      mismatches.push('subagent_envelope_implementation_confirmation_hash_mismatch');
    }
    if (text(envelope.architectureConfirmationHash) !== recordArchitectureHash(record)) {
      mismatches.push('subagent_envelope_architecture_confirmation_hash_mismatch');
    }
  }

  if (
    options.expectedParentCloseoutAttemptId &&
    text(envelope.parentCloseoutAttemptId) !== options.expectedParentCloseoutAttemptId
  ) {
    mismatches.push('subagent_envelope_parent_closeout_attempt_id_mismatch');
  }

  for (const [field, values] of [
    ['traceRows', strings(envelope.traceRows)],
    ['coveredRequirementIds', strings(envelope.coveredRequirementIds)],
    ['taskRefs', strings(envelope.taskRefs)],
    ['commandRuns', objects(envelope.commandRuns)],
    ['artifactRefs', objects(envelope.artifactRefs)],
  ] as const) {
    if (values.length === 0) mismatches.push(`subagent_envelope_${field}_empty`);
  }

  const workspaceRef = isObject(envelope.workspaceRef) ? envelope.workspaceRef : {};
  if (!isObject(envelope.workspaceRef)) mismatches.push('subagent_envelope_workspace_ref_invalid');
  for (const field of WORKSPACE_REF_REQUIRED_FIELDS) {
    if (!text(workspaceRef[field]))
      mismatches.push(`subagent_envelope_workspace_ref_missing:${field}`);
  }
  if (!ALLOWED_WORKSPACE_KINDS.has(text(workspaceRef.kind))) {
    mismatches.push(
      `subagent_envelope_workspace_kind_invalid:${text(workspaceRef.kind) || '<missing>'}`
    );
  }

  const allowedScope = strings(envelope.allowedWriteScope);
  for (const changed of strings(envelope.actualFilesChanged)) {
    if (!pathMatchesScope(changed, allowedScope)) {
      mismatches.push(`subagent_envelope_actual_file_outside_allowed_scope:${changed}`);
    }
  }

  const artifactRefs = objects(envelope.artifactRefs);
  artifactRefs.forEach((artifact, index) =>
    mismatches.push(...validateArtifactRef(artifact, index, projectRoot))
  );
  const envelopeArtifactKeys = new Set(artifactRefs.map(artifactKey));

  const indexedArtifactKeys = new Set(objects(options.indexedArtifactRefs).map(artifactKey));
  if (indexedArtifactKeys.size > 0) {
    for (const artifact of artifactRefs) {
      if (!indexedArtifactKeys.has(artifactKey(artifact))) {
        mismatches.push(
          `subagent_envelope_artifact_refs_not_indexed:${normalizePathForRecord(text(artifact.path))}`
        );
      }
    }
  }

  for (const [index, run] of objects(envelope.commandRuns).entries()) {
    for (const field of COMMAND_RUN_REQUIRED_FIELDS) {
      if (field === 'artifactRefs') {
        if (objects(run.artifactRefs).length === 0)
          mismatches.push(`subagent_envelope_command_run_missing:${index}:${field}`);
      } else if (field === 'exitCode') {
        if (typeof run.exitCode !== 'number')
          mismatches.push(`subagent_envelope_command_run_missing:${index}:${field}`);
      } else if (!text(run[field])) {
        mismatches.push(`subagent_envelope_command_run_missing:${index}:${field}`);
      }
    }
    if (text(run.closeoutAttemptId) !== text(envelope.parentCloseoutAttemptId)) {
      mismatches.push(
        `subagent_envelope_command_run_closeout_attempt_mismatch:${text(run.commandId) || index}`
      );
    }
    for (const artifact of objects(run.artifactRefs)) {
      if (!envelopeArtifactKeys.has(artifactKey(artifact))) {
        mismatches.push(
          `subagent_envelope_command_artifact_not_in_envelope:${normalizePathForRecord(text(artifact.path))}`
        );
      }
    }
  }

  const status = ALLOWED_STATUSES.has(text(envelope.status))
    ? (text(envelope.status) as SubagentEvidenceEnvelopeValidation['status'])
    : 'rejected';
  if (status === 'accepted' && mismatches.length > 0) {
    mismatches.push('subagent_envelope_status_accepted_with_validation_errors');
  }

  const sourceRefs = [
    { sourceType: 'subagent_evidence_envelope', id: text(envelope.subtaskId) },
    ...strings(envelope.traceRows).map((id) => ({ sourceType: 'trace_row', id })),
    ...strings(envelope.coveredRequirementIds).map((id) => ({
      sourceType: 'covered_requirement',
      id,
    })),
  ].filter((ref) => text(ref.id));

  return {
    ok: mismatches.length === 0 && status === 'accepted',
    status,
    mismatches: [...new Set(mismatches)],
    sourceRefs,
    evidenceArtifactRefs: artifactRefs,
    envelopeHash: sha256Object(envelope),
  };
}

function packetKind(packet: Packet): string {
  if ('taskType' in packet) return 'execution';
  if ('resumeReason' in packet) return 'resume';
  return 'recommendation';
}

export function buildSubagentEvidenceEnvelopeFromTaskReport(input: {
  packet: Packet;
  taskReport: TaskReport;
  recordId: string;
  requirementSetId: string;
  parentRunId: string;
  parentCloseoutAttemptId: string;
  executorKind: string;
  executorRole: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  architectureConfirmationHash: string;
  traceRows: string[];
  coveredRequirementIds: string[];
  taskRefs: string[];
  actualFilesChanged: string[];
  diffHash?: string;
  workspaceRef: JsonObject;
  commandRuns: JsonObject[];
  artifactRefs: JsonObject[];
  hookReceipts?: JsonObject[];
  transportRefs?: JsonObject[];
  failureRecords?: JsonObject[];
}): JsonObject {
  const status =
    input.taskReport.status === 'done'
      ? 'accepted'
      : input.taskReport.status === 'partial'
        ? 'partial'
        : 'blocked';
  return {
    envelopeVersion: ENVELOPE_VERSION,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    parentRunId: input.parentRunId,
    parentCloseoutAttemptId: input.parentCloseoutAttemptId,
    subtaskId: input.packet.packetId,
    packetId: input.packet.packetId,
    packetKind: packetKind(input.packet),
    executorKind: input.executorKind,
    executorRole: input.executorRole,
    decisionAuthority: 'none',
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    architectureConfirmationHash: input.architectureConfirmationHash,
    traceRows: input.traceRows,
    coveredRequirementIds: input.coveredRequirementIds,
    taskRefs: input.taskRefs,
    allowedWriteScope: Array.isArray(input.packet.allowedWriteScope)
      ? input.packet.allowedWriteScope
      : [],
    actualFilesChanged: input.actualFilesChanged,
    diffHash: input.diffHash ?? sha256Object(input.actualFilesChanged),
    workspaceRef: input.workspaceRef,
    commandRuns: input.commandRuns,
    artifactRefs: input.artifactRefs,
    hookReceipts: input.hookReceipts ?? [],
    transportRefs: input.transportRefs ?? [],
    status,
    failureRecords: input.failureRecords ?? [],
  };
}

export function validateTaskReportLegacyBoundary(
  taskReport: unknown,
  envelope?: unknown
): SubagentEvidenceEnvelopeValidation {
  if (!isObject(taskReport)) {
    return {
      ok: false,
      status: 'rejected',
      mismatches: ['task_report_missing_or_invalid'],
      sourceRefs: [],
      evidenceArtifactRefs: [],
    };
  }
  if (text(taskReport.status) === 'done' && envelope === undefined) {
    return {
      ok: false,
      status: 'rejected',
      mismatches: ['task_report_done_without_subagent_evidence_envelope'],
      sourceRefs: [],
      evidenceArtifactRefs: [],
    };
  }
  return validateSubagentEvidenceEnvelope(envelope);
}

export function artifactRefForPath(input: {
  projectRoot: string;
  artifactPath: string;
  artifactType: string;
  producer: string;
  purpose: string;
  relatedRequirementIds: string[];
  inputVersion: string;
  outputVersion: string;
}): JsonObject {
  const absolute = absoluteArtifactPath(input.projectRoot, input.artifactPath);
  return {
    artifactType: input.artifactType,
    sourceOfTruthRole: 'evidence',
    path: normalizePathForRecord(
      path.isAbsolute(input.artifactPath) ? input.artifactPath : input.artifactPath
    ),
    contentHash: fs.existsSync(absolute)
      ? sha256File(absolute)
      : sha256Object({ missingArtifactPath: input.artifactPath }),
    producer: input.producer,
    purpose: input.purpose,
    relatedRequirementIds: input.relatedRequirementIds,
    status: fs.existsSync(absolute) ? 'active' : 'blocked',
    inputVersion: input.inputVersion,
    outputVersion: input.outputVersion,
  };
}

function parseArgs(argv: string[]): Record<string, string | boolean | undefined> {
  const out: Record<string, string | boolean | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      out[arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!isObject(parsed)) throw new Error(`JSON object expected: ${file}`);
  return parsed;
}

export function writeSubagentEvidenceEnvelopeSchema(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(SUBAGENT_EVIDENCE_ENVELOPE_SCHEMA, null, 2)}\n`, 'utf8');
}

export function runSubagentEvidenceEnvelopeAcceptance(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: subagent-evidence-envelope --envelope <json> --requirement-record <json> --schema-out <json> --report-out <json> [--project-root <dir>] [--json]'
    );
    return 0;
  }
  const envelopePath = text(args.envelope);
  const recordPath = text(args.requirementRecord);
  const schemaOut = text(args.schemaOut);
  const reportOut = text(args.reportOut);
  if (!envelopePath || !recordPath || !schemaOut || !reportOut) {
    throw new Error('missing required args: envelope, requirement-record, schema-out, report-out');
  }

  const projectRoot = path.resolve(text(args.projectRoot) || process.cwd());
  const envelope = readJson(path.resolve(envelopePath));
  const record = readJson(path.resolve(recordPath));
  writeSubagentEvidenceEnvelopeSchema(path.resolve(schemaOut));
  const validation = validateSubagentEvidenceEnvelope(envelope, {
    record,
    projectRoot,
    indexedArtifactRefs: objects(envelope.artifactRefs),
  });
  const report = {
    reportType: 'subagent_evidence_envelope_acceptance',
    schemaVersion: ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    decision: validation.ok ? 'pass' : 'blocked',
    status: validation.status,
    envelopeHash: validation.envelopeHash,
    schemaPath: normalizePathForRecord(schemaOut),
    sourceRefs: validation.sourceRefs,
    evidenceArtifactRefs: validation.evidenceArtifactRefs,
    mismatches: validation.mismatches,
    controlWrite: 'forbidden_use_controlled_ingest',
  };
  fs.mkdirSync(path.dirname(path.resolve(reportOut)), { recursive: true });
  fs.writeFileSync(path.resolve(reportOut), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(
    args.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : `subagent_evidence_envelope=${report.decision}\n`
  );
  return validation.ok ? 0 : 3;
}

if (
  require.main === module &&
  /(^|[\\/])subagent-evidence-envelope(\.[cm]?js|\.ts)?$/iu.test(process.argv[1] ?? '')
) {
  try {
    process.exitCode = runSubagentEvidenceEnvelopeAcceptance(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
