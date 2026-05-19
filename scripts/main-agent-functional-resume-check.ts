/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  outDir?: string;
  checkpointId?: string;
  expectedSourceDocumentHash?: string;
  expectedImplementationConfirmationHash?: string;
  expectedArchitectureConfirmationHash?: string;
  generatedAt?: string;
  generatedBy?: string;
  json?: boolean;
  help?: boolean;
}

interface Check {
  id: string;
  decision: Decision;
  summary: string;
  details?: JsonObject;
}

const OPEN_RERUN_STATUSES = new Set(['open', 'in_progress', 'no_progress', 'blocked']);
const OPEN_RCA_STATUSES = new Set(['open', 'in_progress', 'blocked']);
const OPEN_FAILURE_STATUSES = new Set(['open', 'in_progress', 'blocked']);
const NON_TERMINAL_CLOSURE_STATUSES = new Set(['open', 'fail', 'blocked']);
const TERMINAL_TRACE_STATUSES = new Set(['PASS', 'PENDING', 'MISSING_EVIDENCE', 'BLOCKED']);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendJsonl(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function architectureHash(record: JsonObject): string {
  const state = record.architectureConfirmationState as JsonObject | undefined;
  return text(state?.currentArchitectureConfirmationHash);
}

function latestBy<T extends JsonObject>(items: T[], key: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    const id = text(item[key]);
    if (id) out.set(id, item);
  }
  return out;
}

function artifactHashMap(record: JsonObject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const artifact of objects(record.artifactIndex)) {
    const artifactPath = normalizePathForRecord(text(artifact.path));
    const hash = text(artifact.hash ?? artifact.contentHash);
    if (artifactPath && hash) out[artifactPath] = hash;
  }
  return out;
}

function checkHashes(record: JsonObject, args: ParsedArgs): Check {
  const expected = {
    sourceDocumentHash: args.expectedSourceDocumentHash ?? text(record.sourceDocumentHash),
    implementationConfirmationHash:
      args.expectedImplementationConfirmationHash ?? text(record.implementationConfirmationHash),
    architectureConfirmationHash:
      args.expectedArchitectureConfirmationHash ?? architectureHash(record),
  };
  const actual = {
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(record),
  };
  const mismatches = Object.entries(expected)
    .filter(([, value]) => value)
    .filter(([key, value]) => actual[key as keyof typeof actual] !== value)
    .map(([key]) => key);
  return {
    id: 'resume-authority-hashes-current',
    decision: mismatches.length === 0 ? 'pass' : 'blocked',
    summary: mismatches.length === 0 ? 'Resume authority hashes match current record' : 'Resume authority hash drift detected',
    details: { expected, actual, mismatches },
  };
}

function checkArchitecture(record: JsonObject): Check {
  const state = record.architectureConfirmationState as JsonObject | undefined;
  const active = text(state?.status) === 'active' && Boolean(text(state?.currentArchitectureConfirmationHash));
  return {
    id: 'architecture-confirmation-active',
    decision: active ? 'pass' : 'blocked',
    summary: active ? 'Architecture confirmation is active for resume' : 'Architecture confirmation is not active',
    details: {
      status: text(state?.status),
      currentArchitectureConfirmationHash: text(state?.currentArchitectureConfirmationHash),
    },
  };
}

function checkControlledSources(record: JsonObject): Check {
  const requiredArrays = [
    'confirmationHistory',
    'executionIterations',
    'gateChecks',
    'requirementClosures',
    'artifactIndex',
  ];
  const missing = requiredArrays.filter((key) => !Array.isArray(record[key]));
  return {
    id: 'controlled-record-sources-present',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary: missing.length === 0 ? 'Required controlled RequirementRecord arrays are present' : 'Required controlled source arrays are missing',
    details: { requiredArrays, missing },
  };
}

function checkBlockers(record: JsonObject): Check {
  const openFailures = objects(record.failureRecords).filter((item) =>
    OPEN_FAILURE_STATUSES.has(text(item.status))
  );
  const openReruns = objects(record.rerunLoops).filter((item) =>
    OPEN_RERUN_STATUSES.has(text(item.status))
  );
  const openRca = objects(record.rcaRecords).filter((item) => OPEN_RCA_STATUSES.has(text(item.status)));
  const latestClosures = [...latestBy(objects(record.requirementClosures), 'requirementId').values()];
  const openClosures = latestClosures.filter((item) =>
    NON_TERMINAL_CLOSURE_STATUSES.has(text(item.status))
  );
  const issues = [
    ...openFailures.map((item) => `open_failure:${text(item.failureId) || '<missing>'}`),
    ...openReruns.map((item) => `pending_rerun:${text(item.rerunLoopId) || '<missing>'}`),
    ...openRca.map((item) => `open_rca:${text(item.rcaId) || '<missing>'}`),
    ...openClosures.map((item) => `non_terminal_closure:${text(item.requirementId) || '<missing>'}`),
  ];
  return {
    id: 'resume-open-blockers-clear',
    decision: issues.length === 0 ? 'pass' : 'blocked',
    summary: issues.length === 0 ? 'No open blocker prevents resume' : 'Open blocker requires fail-closed resume',
    details: { issues },
  };
}

function checkRequiredArtifacts(record: JsonObject): Check {
  const deliveryEvidence = record.deliveryEvidence as JsonObject | undefined;
  const requiredCommands = objects(deliveryEvidence?.requiredCommands);
  const indexed = artifactHashMap(record);
  const missing: string[] = [];
  for (const command of requiredCommands) {
    for (const artifact of objects(command.artifactRefs)) {
      const artifactPath = normalizePathForRecord(text(artifact.path));
      const expectedHash = text(artifact.hash ?? artifact.contentHash);
      if (!artifactPath || !expectedHash) {
        missing.push(`artifact_metadata_missing:${text(command.commandId) || '<missing-command>'}`);
        continue;
      }
      if (indexed[artifactPath] !== expectedHash) {
        missing.push(`artifact_not_indexed_or_hash_mismatch:${artifactPath}`);
      }
    }
  }
  return {
    id: 'resume-required-artifacts-indexed',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary: missing.length === 0 ? 'Required artifacts are indexed with matching hashes' : 'Required artifacts missing or hash mismatched',
    details: { checkedCommands: requiredCommands.length, missing },
  };
}

function traceCheckpoint(record: JsonObject, checkpointId: string, generatedAt: string): JsonObject {
  const executions = objects(record.executionIterations);
  const closures = latestBy(objects(record.requirementClosures), 'requirementId');
  const gateChecks = objects(record.gateChecks);
  const traceRows = [...new Set(executions.flatMap((item) => strings(item.traceRows)))].sort();
  const closedIds = [...closures.entries()]
    .filter(([, item]) => text(item.status) === 'pass')
    .map(([id]) => id)
    .sort();
  const pendingIds = [...closures.entries()]
    .filter(([, item]) => text(item.status) !== 'pass')
    .map(([id]) => id)
    .sort();
  const gateSummary = gateChecks.map((gate) => ({
    checkId: text(gate.checkId),
    gate: text(gate.gate),
    decision: text(gate.decision),
  }));
  const payload = {
    checkpointId,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    generatedAt,
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(record),
    traceRows,
    closedIds,
    pendingIds,
    gateSummary,
    artifactIndexHash: sha256Text(JSON.stringify(artifactHashMap(record))),
    latestExecutionIterationId: text(executions.at(-1)?.executionIterationId),
  };
  return {
    ...payload,
    checkpointHash: sha256Text(JSON.stringify(payload)),
  };
}

function resumePacket(input: {
  checkpoint: JsonObject;
  checks: Check[];
  generatedAt: string;
  generatedBy: string;
}): JsonObject {
  const blockingIssues = input.checks
    .filter((check) => check.decision === 'blocked')
    .flatMap((check) => {
      const detailIssues = Array.isArray(check.details?.issues)
        ? (check.details.issues as string[])
        : Array.isArray(check.details?.missing)
          ? (check.details.missing as string[])
          : Array.isArray(check.details?.mismatches)
            ? (check.details.mismatches as string[])
            : [check.id];
      return detailIssues.map((issue) => `${check.id}:${issue}`);
    });
  const decision: Decision = blockingIssues.length === 0 ? 'pass' : 'blocked';
  return {
    packetType: 'functional_resume_packet',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    decision,
    resumeAllowed: decision === 'pass',
    checkpointId: text(input.checkpoint.checkpointId),
    checkpointHash: text(input.checkpoint.checkpointHash),
    modelChecks: [
      'requirement_confirmation',
      'architecture_confirmation',
      'implementation_readiness',
      'execution_closure',
      'audit_review',
      'delivery_closeout',
    ],
    blockingIssues,
    checks: input.checks,
  };
}

function buildProof(input: {
  record: JsonObject;
  checkpoint: JsonObject;
  packet: JsonObject;
  checkpointPath: string;
  packetPath: string;
  generatedAt: string;
  generatedBy: string;
}): JsonObject {
  return {
    proofType: 'functional_resume_proof',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    decision: text(input.packet.decision),
    resumeAllowed: input.packet.resumeAllowed === true,
    checkpointRef: {
      path: normalizePathForRecord(input.checkpointPath),
      hash: sha256File(input.checkpointPath),
    },
    resumePacketRef: {
      path: normalizePathForRecord(input.packetPath),
      hash: sha256File(input.packetPath),
    },
    coveredMentalModels: input.packet.modelChecks,
    sourceDocumentHash: text(input.record.sourceDocumentHash),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(input.record),
  };
}

export function mainFunctionalResumeCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-functional-resume-check --requirement-record <json> [--out-dir <dir>] [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const generatedBy = args.generatedBy ?? 'agent';
  const checkpointId = args.checkpointId ?? `checkpoint-${Date.now()}`;
  const outDir = path.resolve(args.outDir ?? path.join(path.dirname(recordPath), 'resume'));
  fs.mkdirSync(outDir, { recursive: true });

  const checks = [
    checkHashes(record, args),
    checkArchitecture(record),
    checkControlledSources(record),
    checkBlockers(record),
    checkRequiredArtifacts(record),
  ];
  const checkpoint = traceCheckpoint(record, checkpointId, generatedAt);
  const packet = resumePacket({ checkpoint, checks, generatedAt, generatedBy });
  const checkpointPath = path.join(outDir, 'trace-checkpoints.jsonl');
  const packetPath = path.join(outDir, 'resume-packets.jsonl');
  appendJsonl(checkpointPath, checkpoint);
  appendJsonl(packetPath, packet);
  const proof = buildProof({
    record,
    checkpoint,
    packet,
    checkpointPath,
    packetPath,
    generatedAt,
    generatedBy,
  });
  const proofPath = path.join(outDir, 'functional-resume-proof.json');
  writeJson(proofPath, proof);
  const output = {
    ok: true,
    decision: packet.decision,
    resumeAllowed: packet.resumeAllowed,
    checkpointPath: normalizePathForRecord(checkpointPath),
    resumePacketPath: normalizePathForRecord(packetPath),
    proofPath: normalizePathForRecord(proofPath),
    blockingIssues: packet.blockingIssues,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `functional_resume=${packet.decision}\n`);
  return packet.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainFunctionalResumeCheck(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
