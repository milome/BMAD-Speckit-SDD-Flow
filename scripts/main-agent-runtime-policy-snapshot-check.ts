/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  snapshotPath?: string;
  reportPath?: string;
  expectedSourceDocumentHash?: string;
  expectedImplementationConfirmationHash?: string;
  expectedArchitectureConfirmationHash?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

const SHA256_RE = /^sha256:[a-f0-9]{64}$/u;
const LOCALES = new Set(['zh-CN', 'en-US', 'bilingual']);
const STRICTNESS = new Set(['strict', 'standard']);
const NON_CONTROL_ROLES = new Set(['evidence', 'projection', 'read_model']);
const LOCALE_ISOLATION_FLAGS = [
  'localeAffectsConfirmationLanguage',
  'localeAffectsRequirementSemantics',
  'localeAffectsPassEvidence',
  'localeAffectsCloseout',
];

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

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
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

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const obj = value as JsonObject;
  const out: JsonObject = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeysDeep(obj[key]);
  return out;
}

function stableHash(value: unknown): string {
  return sha256Text(JSON.stringify(sortKeysDeep(value)));
}

function firstHash(value: JsonObject | undefined): string {
  return text(value?.hash ?? value?.contentHash);
}

function resolveArtifactPath(artifactPath: string, recordPath: string): string {
  if (path.isAbsolute(artifactPath)) return artifactPath;
  const fromCwd = path.resolve(process.cwd(), artifactPath);
  if (fs.existsSync(fromCwd)) return fromCwd;
  return path.resolve(path.dirname(recordPath), artifactPath);
}

function architectureHash(record: JsonObject): string {
  const state = asObject(record.architectureConfirmationState);
  return text(state?.currentArchitectureConfirmationHash);
}

function artifactMatches(ref: JsonObject, artifactPath: string, hash: string): boolean {
  return normalizePathForRecord(text(ref.path)) === normalizePathForRecord(artifactPath) && firstHash(ref) === hash;
}

function findIndexedArtifact(record: JsonObject, artifactPath: string, hash: string): JsonObject | undefined {
  return objects(record.artifactIndex).find((ref) => artifactMatches(ref, artifactPath, hash));
}

function runtimePolicySnapshotRef(record: JsonObject): JsonObject | undefined {
  return asObject(record.runtimePolicySnapshotRef);
}

function validateArtifactRef(input: {
  ref: JsonObject | undefined;
  record: JsonObject;
  recordPath: string;
  snapshotPath?: string;
}): { issues: string[]; artifactPath: string; artifactHash: string; absolutePath: string } {
  const issues: string[] = [];
  const ref = input.ref;
  const explicitSnapshotPath = input.snapshotPath ? normalizePathForRecord(input.snapshotPath) : '';
  const artifactPath = normalizePathForRecord(text(ref?.path) || explicitSnapshotPath);
  const artifactHash = firstHash(ref);
  const absolutePath = artifactPath ? resolveArtifactPath(artifactPath, input.recordPath) : '';

  if (!ref && !input.snapshotPath) issues.push('runtimePolicySnapshotRef_missing');
  if (!artifactPath) issues.push('runtimePolicySnapshotRef_path_missing');
  if (ref) {
    if (text(ref.artifactType) !== 'runtime_policy_snapshot') {
      issues.push(`runtimePolicySnapshotRef_artifactType_invalid:${text(ref.artifactType) || '<missing>'}`);
    }
    if (!NON_CONTROL_ROLES.has(text(ref.sourceOfTruthRole))) {
      issues.push(`runtimePolicySnapshotRef_sourceOfTruthRole_must_not_be_control:${text(ref.sourceOfTruthRole) || '<missing>'}`);
    }
    if (!artifactHash) issues.push('runtimePolicySnapshotRef_hash_missing');
    if (!text(ref.producer)) issues.push('runtimePolicySnapshotRef_producer_missing');
    if (!text(ref.purpose)) issues.push('runtimePolicySnapshotRef_purpose_missing');
    if (strings(ref.relatedRequirementIds).length === 0) issues.push('runtimePolicySnapshotRef_relatedRequirementIds_missing');
    if (!text(ref.status)) issues.push('runtimePolicySnapshotRef_status_missing');
    if (!text(ref.inputVersion)) issues.push('runtimePolicySnapshotRef_inputVersion_missing');
    if (!text(ref.outputVersion)) issues.push('runtimePolicySnapshotRef_outputVersion_missing');
  }
  if (artifactHash && !SHA256_RE.test(artifactHash)) issues.push('runtimePolicySnapshotRef_hash_invalid');
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    issues.push(`runtimePolicySnapshot_missing:${artifactPath || '<missing>'}`);
  } else if (artifactHash && sha256File(absolutePath) !== artifactHash) {
    issues.push(`runtimePolicySnapshot_hash_mismatch:${artifactPath}`);
  }
  if (ref && artifactPath && artifactHash && !findIndexedArtifact(input.record, artifactPath, artifactHash)) {
    issues.push(`runtimePolicySnapshot_not_indexed:${artifactPath}`);
  }
  return { issues, artifactPath, artifactHash, absolutePath };
}

function validateSnapshot(input: {
  snapshot: JsonObject;
  record: JsonObject;
  expectedSourceDocumentHash?: string;
  expectedImplementationConfirmationHash?: string;
  expectedArchitectureConfirmationHash?: string;
}): string[] {
  const { snapshot, record } = input;
  const issues: string[] = [];
  if (text(snapshot.kind) !== 'runtime-policy-snapshot') issues.push('runtimePolicySnapshot_kind_invalid');
  if (text(snapshot.schemaVersion) !== 'runtime-policy-snapshot/v1') {
    issues.push('runtimePolicySnapshot_schemaVersion_invalid');
  }
  if (text(snapshot.recordId) !== text(record.recordId)) issues.push('runtimePolicySnapshot_recordId_mismatch');
  if (text(snapshot.requirementSetId) !== text(record.requirementSetId)) {
    issues.push('runtimePolicySnapshot_requirementSetId_mismatch');
  }

  const expectedHashes: Record<string, string> = {
    sourceDocumentHash: input.expectedSourceDocumentHash ?? text(record.sourceDocumentHash),
    implementationConfirmationHash:
      input.expectedImplementationConfirmationHash ?? text(record.implementationConfirmationHash),
    architectureConfirmationHash:
      input.expectedArchitectureConfirmationHash ?? architectureHash(record),
  };
  for (const [field, expected] of Object.entries(expectedHashes)) {
    const actual = text(snapshot[field]);
    if (!expected) issues.push(`runtimePolicySnapshot_${field}_expected_missing`);
    if (!actual) issues.push(`runtimePolicySnapshot_${field}_missing`);
    if (expected && actual && expected !== actual) issues.push(`runtimePolicySnapshot_${field}_mismatch`);
  }

  const policyHash = text(snapshot.policyHash);
  if (!SHA256_RE.test(policyHash)) issues.push('runtimePolicySnapshot_policyHash_invalid_or_missing');
  const policy = asObject(snapshot.policy);
  if (policy && policyHash && stableHash(policy) !== policyHash) {
    issues.push('runtimePolicySnapshot_policyHash_mismatch');
  }
  if (!LOCALES.has(text(snapshot.locale))) {
    issues.push(`runtimePolicySnapshot_locale_invalid_or_missing:${text(snapshot.locale) || '<missing>'}`);
  }
  if (!text(snapshot.host)) issues.push('runtimePolicySnapshot_host_missing');
  if (!text(snapshot.stage)) issues.push('runtimePolicySnapshot_stage_missing');
  if (!STRICTNESS.has(text(snapshot.strictness))) {
    issues.push(`runtimePolicySnapshot_strictness_invalid_or_missing:${text(snapshot.strictness) || '<missing>'}`);
  }
  if (!Array.isArray(snapshot.mandatoryGates)) issues.push('runtimePolicySnapshot_mandatoryGates_missing');

  const isolation = asObject(snapshot.localeIsolation);
  if (!isolation) {
    issues.push('runtimePolicySnapshot_localeIsolation_missing');
  } else {
    for (const flag of LOCALE_ISOLATION_FLAGS) {
      if (isolation[flag] !== false) issues.push(`runtimePolicySnapshot_localeIsolation_flag_must_be_false:${flag}`);
    }
  }
  return issues;
}

function buildReport(args: ParsedArgs): JsonObject {
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const ref = runtimePolicySnapshotRef(record);
  const artifact = validateArtifactRef({
    ref,
    record,
    recordPath,
    snapshotPath: args.snapshotPath,
  });
  const snapshot = artifact.absolutePath && fs.existsSync(artifact.absolutePath) ? readJson(artifact.absolutePath) : {};
  const snapshotIssues = validateSnapshot({
    snapshot,
    record,
    expectedSourceDocumentHash: args.expectedSourceDocumentHash,
    expectedImplementationConfirmationHash: args.expectedImplementationConfirmationHash,
    expectedArchitectureConfirmationHash: args.expectedArchitectureConfirmationHash,
  });
  const blockingReasons = [...artifact.issues, ...snapshotIssues];
  const decision: Decision = blockingReasons.length ? 'blocked' : 'pass';
  return {
    reportType: 'main_agent_runtime_policy_snapshot_check',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    evaluatedBy: args.evaluatedBy ?? 'agent',
    decision,
    blockingReasons,
    runtimePolicySnapshotRef: ref ?? null,
    runtimePolicySnapshotPath: artifact.artifactPath || null,
    runtimePolicySnapshotHash: artifact.artifactHash || null,
    snapshotSummary: {
      kind: text(snapshot.kind),
      schemaVersion: text(snapshot.schemaVersion),
      policyHash: text(snapshot.policyHash),
      locale: text(snapshot.locale),
      host: text(snapshot.host),
      stage: text(snapshot.stage),
      strictness: text(snapshot.strictness),
      mandatoryGates: Array.isArray(snapshot.mandatoryGates) ? snapshot.mandatoryGates : null,
      localeIsolation: asObject(snapshot.localeIsolation) ?? null,
    },
    recordPath: normalizePathForRecord(recordPath),
  };
}

export function mainRuntimePolicySnapshotCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-runtime-policy-snapshot-check --requirement-record <json> [--report-path <json>] [--json]');
    return 0;
  }
  const report = buildReport(args);
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(path.resolve(args.requirementRecord!)), 'runtime-policy-snapshot-check.json')
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `runtime_policy_snapshot=${report.decision}\n`);
  return report.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainRuntimePolicySnapshotCheck(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
