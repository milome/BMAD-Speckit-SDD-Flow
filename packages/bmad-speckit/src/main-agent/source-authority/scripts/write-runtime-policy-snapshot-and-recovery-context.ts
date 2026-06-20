/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveScoringPolicy } from '../packages/scoring/policy';
import { loadPolicyContextFromRegistry, mainEmitRuntimePolicy } from './emit-runtime-policy';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  cwd?: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  outDir?: string;
  locale?: string;
  host?: string;
  generatedAt?: string;
  json?: boolean;
  help?: boolean;
}

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

function sha256Buffer(value: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: JsonObject = {};
  for (const key of Object.keys(value as JsonObject).sort())
    out[key] = sortKeysDeep((value as JsonObject)[key]);
  return out;
}

function stablePolicyHash(value: unknown): string {
  return sha256Buffer(JSON.stringify(sortKeysDeep(value)));
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function captureRuntimePolicy(args: ParsedArgs, root: string): JsonObject {
  const chunks: string[] = [];
  const errors: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origError = console.error;
  process.stdout.write = (msg: string | Uint8Array) => {
    chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
    return true;
  };
  console.error = (...items: unknown[]) => {
    errors.push(items.map((item) => String(item)).join(' '));
  };
  try {
    const emitArgs = ['--cwd', root];
    if (args.recordId) emitArgs.push('--record-id', args.recordId);
    if (args.requirementSetId) emitArgs.push('--requirement-set-id', args.requirementSetId);
    if (args.runId) emitArgs.push('--run-id', args.runId);
    const code = mainEmitRuntimePolicy(emitArgs);
    if (code !== 0) throw new Error(errors.join('\n') || `emit-runtime-policy exited ${code}`);
  } finally {
    process.stdout.write = origWrite;
    console.error = origError;
  }
  return readJsonFromText(chunks.join(''));
}

function readJsonFromText(value: string): JsonObject {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('runtime policy JSON object expected');
  }
  return parsed as JsonObject;
}

function architectureHash(record: JsonObject): string {
  return text(asObject(record.architectureConfirmationState)?.currentArchitectureConfirmationHash);
}

function runtimePolicySnapshotRef(input: {
  root: string;
  record: JsonObject;
  snapshotPath: string;
  snapshotHash: string;
}): JsonObject {
  return {
    eventType: 'artifact_indexed',
    artifactType: 'runtime_policy_snapshot',
    sourceOfTruthRole: 'projection',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    path: normalizePathForRecord(path.relative(input.root, input.snapshotPath)),
    contentHash: input.snapshotHash,
    producer: 'write-runtime-policy-snapshot-and-recovery-context',
    purpose:
      'Requirement-scoped runtime policy snapshot for recovery, audit, hook trust, and closeout context; not a direct control decision source.',
    relatedRequirementIds: ['MUST-026', 'NEG-014', 'OUT-012', 'EVD-026', 'TRACE-019'],
    status: 'active',
    inputVersion: `source=${text(input.record.sourceDocumentHash)};implementation=${text(input.record.implementationConfirmationHash)};architecture=${architectureHash(input.record)}`,
    outputVersion: 'runtime-policy-snapshot/v1',
    traceRows: ['TRACE-019'],
    evidenceRefs: ['EVD-026'],
  };
}

function buildSnapshot(input: {
  record: JsonObject;
  policy: JsonObject;
  resolvedScoringPolicy: JsonObject;
  locale: string;
  host: string;
  generatedAt: string;
}): JsonObject {
  return {
    kind: 'runtime-policy-snapshot',
    schemaVersion: 'runtime-policy-snapshot/v1',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    generatedAt: input.generatedAt,
    sourceDocumentHash: text(input.record.sourceDocumentHash),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(input.record),
    policyHash: stablePolicyHash(input.policy),
    policy: input.policy,
    resolvedScoringPolicy: input.resolvedScoringPolicy,
    locale: input.locale,
    host: input.host,
    stage: text(input.policy.stage),
    strictness: text(input.policy.strictness),
    mandatoryGates: input.policy.mandatoryGate === true ? ['runtime_mandatory_gate'] : [],
    localeIsolation: {
      localeAffectsConfirmationLanguage: false,
      localeAffectsRequirementSemantics: false,
      localeAffectsPassEvidence: false,
      localeAffectsCloseout: false,
    },
  };
}

function buildRecoveryContext(input: {
  record: JsonObject;
  loaded: ReturnType<typeof loadPolicyContextFromRegistry>;
  runtimePolicySnapshotRef: JsonObject;
  generatedAt: string;
}): JsonObject {
  return {
    kind: 'recovery-context',
    schemaVersion: 'recovery-context/v1',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    generatedAt: input.generatedAt,
    resolvedRuntimeContext: input.loaded.resolvedRuntimeContext,
    runtimePolicySnapshotRef: input.runtimePolicySnapshotRef,
    controlSource: 'requirement-record.json',
    legacyRuntimeContextAllowed: false,
  };
}

function resolveScoringPolicyRuleRoot(root: string): string {
  if (fs.existsSync(path.join(root, 'packages', 'scoring', 'rules'))) return root;
  return path.resolve(__dirname, '..');
}

export function mainWriteRuntimePolicySnapshotAndRecoveryContext(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: write-runtime-policy-snapshot-and-recovery-context --record-id <id> --requirement-set-id <id> [--json]'
    );
    return 0;
  }
  const root = path.resolve(args.cwd ?? process.cwd());
  const loaded = loadPolicyContextFromRegistry(root, {
    recordId: args.recordId,
    requirementSetId: args.requirementSetId,
    runId: args.runId,
  });
  const record = readJson(loaded.resolvedContextPath);
  const policy = captureRuntimePolicy(args, root);
  const resolvedScoringPolicy = resolveScoringPolicy({
    root,
    ruleRoot: resolveScoringPolicyRuleRoot(root),
  }) as unknown as JsonObject;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const outDir = path.resolve(
    args.outDir ?? path.dirname(loaded.resolvedRuntimeContext.runtimePolicySnapshotPath)
  );
  const snapshotPath = path.join(outDir, 'runtime-policy-snapshot.json');
  const recoveryContextPath = path.join(outDir, 'recovery-context.json');
  const snapshot = buildSnapshot({
    record,
    policy,
    resolvedScoringPolicy,
    locale: args.locale ?? 'zh-CN',
    host: args.host ?? 'codex',
    generatedAt,
  });
  writeJson(snapshotPath, snapshot);
  const snapshotHash = sha256Buffer(fs.readFileSync(snapshotPath));
  const ref = runtimePolicySnapshotRef({ root, record, snapshotPath, snapshotHash });
  const recoveryContext = buildRecoveryContext({
    record,
    loaded,
    runtimePolicySnapshotRef: ref,
    generatedAt,
  });
  writeJson(recoveryContextPath, recoveryContext);
  const output = {
    ok: true,
    runtimePolicySnapshotPath: normalizePathForRecord(snapshotPath),
    runtimePolicySnapshotHash: snapshotHash,
    recoveryContextPath: normalizePathForRecord(recoveryContextPath),
    runtimePolicySnapshotRef: ref,
  };
  process.stdout.write(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `runtime_policy_snapshot=${snapshotHash}\n`
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = mainWriteRuntimePolicySnapshotAndRecoveryContext(process.argv.slice(2));
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
