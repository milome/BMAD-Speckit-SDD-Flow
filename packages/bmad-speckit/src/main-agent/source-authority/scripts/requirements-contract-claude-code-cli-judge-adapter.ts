import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { readRequirementsContractJudgeCredentialSecret } from './requirements-contract-judge-credential-resolver';

type JsonRecord = Record<string, unknown>;
type ClaudeCodeCliExecutorKind = 'native_spawn' | 'injected_test_transport';

export interface ClaudeCodeCliCommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  stdoutPath?: string;
  stderrPath?: string;
  transcriptPath?: string;
}

export interface ClaudeCodeCliCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  processId?: number;
}

export interface ClaudeCodeCliJudgeAdapterDependencies {
  executeCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
}

interface AdapterInput {
  providerRef?: string;
  provider: JsonRecord;
  credential?: unknown;
  payload?: unknown;
}

interface ExecutionContext {
  projectRoot: string;
  requestPath: string;
  outputDir: string;
}

interface SnapshotEntry {
  path: string;
  hash: string;
  bytes: number;
  roles: string[];
}

export interface SnapshotReadSegment {
  path: string;
  hash: string;
  bytes: number;
  startByte: number;
  endByteExclusive: number;
}

export interface SnapshotReadPlanEntry {
  sourcePath: string;
  sourceHash: string;
  sourceBytes: number;
  segments: SnapshotReadSegment[];
}

interface EvidenceSnapshot {
  snapshotRoot: string;
  manifestPath: string;
  snapshotHash: string;
  entries: SnapshotEntry[];
  readPlan: SnapshotReadPlanEntry[];
}

interface ExecutionSnapshot {
  cwd: string;
  dispose: () => void;
}

interface CredentialBinding {
  env: NodeJS.ProcessEnv;
  credentialRevision: number;
  credentialEnvironmentVariable: 'ANTHROPIC_API_KEY' | 'ANTHROPIC_AUTH_TOKEN' | null;
}

const HASH_PREFIX = 'sha256:';
const MAX_STDOUT_BYTES = 32 * 1024 * 1024;
const MAX_STDERR_BYTES = 4 * 1024 * 1024;
const MAX_READ_SEGMENT_BYTES = 32 * 1024;
const WINDOWS_LEGACY_PATH_LIMIT = 260;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_TOOLS = ['Read'] as const;
const ASSESSMENT_VERDICTS = [
  'no_new_valid_gap',
  'no_new_confirmation_blocking_gap',
  'new_valid_gap',
  'insufficient_audit',
  'blocked',
] as const;
const DEFAULT_STRUCTURED_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'findings', 'challengeRequests', 'evidenceRefs'],
  properties: {
    decision: { enum: ['pass', 'block', 'inconclusive'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['schemaVersion', 'verdict'],
        properties: {
          schemaVersion: { const: 'critical-auditor-judge-assessment/v1' },
          verdict: { enum: ASSESSMENT_VERDICTS },
        },
      },
    },
    challengeRequests: { type: 'array', items: { type: 'object' } },
    evidenceRefs: {
      type: 'array',
      uniqueItems: true,
      items: { type: 'string', minLength: 1 },
    },
  },
} as const;

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function requiredText(value: unknown, code: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(code);
  return normalized;
}

function sha256(value: string | Buffer): string {
  return `${HASH_PREFIX}${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as JsonRecord)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
    .join(',')}}`;
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveWithin(root: string, value: string, code: string): string {
  const resolved = path.resolve(root, value);
  if (!isWithin(root, resolved)) throw new Error(code);
  return resolved;
}

function assertWritablePathWithinRoot(root: string, target: string, code: string): void {
  const rootRealPath = fs.realpathSync(root);
  let existingPath = path.resolve(target);
  while (!fs.existsSync(existingPath)) {
    const parentPath = path.dirname(existingPath);
    if (parentPath === existingPath) throw new Error(code);
    existingPath = parentPath;
  }
  if (fs.lstatSync(existingPath).isSymbolicLink()) throw new Error(code);
  if (!isWithin(rootRealPath, fs.realpathSync(existingPath))) throw new Error(code);
}

function writeTextAtomic(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, target);
}

function writeJsonAtomic(target: string, value: unknown): void {
  writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
}

function validateInvocationReceipt(receipt: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-invocation-receipt.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(receipt)) {
    throw new Error(
      `claude_code_cli_judge_invocation_receipt_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const unsigned = { ...receipt };
  delete unsigned.receiptHash;
  if (receipt.receiptHash !== sha256(stableStringify(unsigned))) {
    throw new Error('claude_code_cli_judge_invocation_receipt_hash_mismatch');
  }
}

function writeInvocationReceipt(input: {
  outputDir: string;
  startedAt: string;
  completedAt: string;
  providerRef: string;
  transport: string;
  providerRequestId: string;
  decision: 'pass' | 'block' | 'inconclusive';
  normalizedResponseHash: string;
  transportEvidenceHash: string;
}): JsonRecord {
  const payload: JsonRecord = {
    schemaVersion: 'requirements-contract-judge-invocation-receipt/v1',
    invocationId: randomUUID(),
    providerRef: input.providerRef,
    transport: input.transport,
    adapterRef: 'ClaudeCodeCliJudgeAdapter',
    providerRequestId: input.providerRequestId,
    outcome: 'decided',
    decision: input.decision,
    unknownOutcomeReason: null,
    automaticSemanticRetry: false,
    maximumAttempts: 1,
    attemptOrdinal: 1,
    normalizedResponseHash: input.normalizedResponseHash,
    transportEvidenceHash: input.transportEvidenceHash,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
  const receipt = {
    ...payload,
    receiptHash: sha256(stableStringify(payload)),
  };
  validateInvocationReceipt(receipt);
  writeJsonAtomic(path.join(input.outputDir, 'judge-invocation-receipt.json'), receipt);
  return receipt;
}

function pathLikeKey(key: string): boolean {
  return /(?:path|ref|document|report|receipt|artifact|log)$/iu.test(key);
}

function collectReferencedFiles(
  value: unknown,
  projectRoot: string,
  outputDir: string,
  key = '',
  files = new Map<string, Set<string>>()
): Map<string, Set<string>> {
  if (typeof value === 'string') {
    if (!pathLikeKey(key)) return files;
    const candidate = path.resolve(projectRoot, value);
    if (!isWithin(projectRoot, candidate)) {
      throw new Error('claude_code_cli_judge_evidence_path_escape');
    }
    if (
      !isWithin(outputDir, candidate) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      const roles = files.get(candidate) ?? new Set<string>();
      roles.add(key || 'referencedArtifact');
      files.set(candidate, roles);
    }
    return files;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferencedFiles(item, projectRoot, outputDir, key, files);
    }
    return files;
  }
  if (!value || typeof value !== 'object') return files;
  for (const [childKey, childValue] of Object.entries(value as JsonRecord)) {
    collectReferencedFiles(childValue, projectRoot, outputDir, childKey, files);
  }
  return files;
}

function snapshotSegmentPath(sourcePath: string, segmentIndex: number): string {
  const sourceKey = createHash('sha256').update(sourcePath, 'utf8').digest('hex');
  return `_judge-read-segments/${sourceKey}/${String(segmentIndex + 1).padStart(4, '0')}.part`;
}

function snapshotPathRequiresSegment(relativePath: string, sourceBytes: number): boolean {
  if (sourceBytes > MAX_READ_SEGMENT_BYTES) return true;
  if (process.platform !== 'win32') return false;
  return (
    path.join(tmpdir(), 'j-XXXXXX', path.normalize(relativePath)).length >=
    WINDOWS_LEGACY_PATH_LIMIT
  );
}

function boundedUtf8SegmentEnd(content: Buffer, startByte: number): number {
  let endByte = Math.min(content.byteLength, startByte + MAX_READ_SEGMENT_BYTES);
  while (
    endByte < content.byteLength &&
    endByte > startByte &&
    (content[endByte] & 0xc0) === 0x80
  ) {
    endByte -= 1;
  }
  if (endByte <= startByte) {
    throw new Error('claude_code_cli_judge_evidence_segment_invalid');
  }
  return endByte;
}

function materializeSnapshotFile(input: {
  projectRoot: string;
  snapshotRoot: string;
  sourcePath: string;
  roles: string[];
}): { entries: SnapshotEntry[]; readPlan: SnapshotReadPlanEntry } {
  const projectRealRoot = fs.realpathSync(input.projectRoot);
  const sourceRealPath = fs.realpathSync(input.sourcePath);
  if (!isWithin(projectRealRoot, sourceRealPath)) {
    throw new Error('claude_code_cli_judge_evidence_realpath_escape');
  }
  const relativePath = slash(path.relative(input.projectRoot, input.sourcePath));
  const sourceContent = fs.readFileSync(input.sourcePath);
  const sourceHash = sha256(sourceContent);
  const sourceRoles = [...new Set(input.roles)].sort();
  const useReadSegments = snapshotPathRequiresSegment(relativePath, sourceContent.byteLength);
  const segments: SnapshotReadSegment[] = [];
  const entries: SnapshotEntry[] = [];
  let startByte = 0;
  let segmentIndex = 0;

  do {
    const endByteExclusive =
      sourceContent.byteLength <= MAX_READ_SEGMENT_BYTES
        ? sourceContent.byteLength
        : boundedUtf8SegmentEnd(sourceContent, startByte);
    const segmentPath = useReadSegments
      ? snapshotSegmentPath(relativePath, segmentIndex)
      : relativePath;
    const target = path.resolve(input.snapshotRoot, segmentPath);
    if (!isWithin(input.snapshotRoot, target)) {
      throw new Error('claude_code_cli_judge_snapshot_path_escape');
    }
    const segmentContent = sourceContent.subarray(startByte, endByteExclusive);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, segmentContent);
    const segmentHash = sha256(segmentContent);
    entries.push({
      path: segmentPath,
      hash: segmentHash,
      bytes: segmentContent.byteLength,
      roles: !useReadSegments
        ? sourceRoles
        : [...new Set([...sourceRoles, 'judgeReadSegment'])].sort(),
    });
    segments.push({
      path: segmentPath,
      hash: segmentHash,
      bytes: segmentContent.byteLength,
      startByte,
      endByteExclusive,
    });
    startByte = endByteExclusive;
    segmentIndex += 1;
  } while (startByte < sourceContent.byteLength);

  return {
    entries,
    readPlan: {
      sourcePath: relativePath,
      sourceHash,
      sourceBytes: sourceContent.byteLength,
      segments,
    },
  };
}

function materializeEvidenceSnapshot(input: {
  context: ExecutionContext;
  request: JsonRecord;
}): EvidenceSnapshot {
  const projectRoot = path.resolve(input.context.projectRoot);
  const outputDir = resolveWithin(
    projectRoot,
    input.context.outputDir,
    'claude_code_cli_judge_output_path_escape'
  );
  assertWritablePathWithinRoot(
    projectRoot,
    outputDir,
    'claude_code_cli_judge_output_path_realpath_escape'
  );
  const requestPath = resolveWithin(
    projectRoot,
    input.context.requestPath,
    'claude_code_cli_judge_request_path_escape'
  );
  if (!fs.existsSync(requestPath) || !fs.statSync(requestPath).isFile()) {
    throw new Error('claude_code_cli_judge_request_path_missing');
  }
  const sourceDocument = requiredText(
    input.request.sourceDocument,
    'claude_code_cli_judge_source_document_missing'
  );
  const sourcePath = resolveWithin(
    projectRoot,
    sourceDocument,
    'claude_code_cli_judge_source_document_path_escape'
  );
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error('claude_code_cli_judge_source_document_missing');
  }
  const sourceRealPath = fs.realpathSync(sourcePath);
  if (!isWithin(fs.realpathSync(projectRoot), sourceRealPath)) {
    throw new Error('claude_code_cli_judge_source_document_realpath_escape');
  }
  const sourceBytesHash = requiredText(
    input.request.sourceBytesHash,
    'claude_code_cli_judge_source_bytes_hash_missing'
  );
  if (!/^sha256:[a-f0-9]{64}$/u.test(sourceBytesHash)) {
    throw new Error('claude_code_cli_judge_source_bytes_hash_invalid');
  }
  if (sha256(fs.readFileSync(sourcePath)) !== sourceBytesHash) {
    throw new Error('claude_code_cli_judge_source_bytes_hash_mismatch');
  }
  const snapshotRoot = path.join(outputDir, 's');
  if (fs.existsSync(snapshotRoot)) {
    throw new Error('claude_code_cli_judge_snapshot_already_exists');
  }
  fs.mkdirSync(snapshotRoot, { recursive: true });
  assertWritablePathWithinRoot(
    projectRoot,
    snapshotRoot,
    'claude_code_cli_judge_output_path_realpath_escape'
  );
  const files = collectReferencedFiles(input.request, projectRoot, outputDir);
  const requestRoles = files.get(requestPath) ?? new Set<string>();
  requestRoles.add('judgeRequest');
  files.set(requestPath, requestRoles);
  const materializedFiles = [...files.entries()]
    .sort(([left], [right]) => slash(left).localeCompare(slash(right)))
    .map(([sourcePath, roles]) =>
      materializeSnapshotFile({
        projectRoot,
        snapshotRoot,
        sourcePath,
        roles: [...roles],
      })
    );
  const entries = materializedFiles.flatMap((materialized) => materialized.entries);
  const readPlan = materializedFiles.map((materialized) => materialized.readPlan);
  const sourceRelativePath = slash(path.relative(projectRoot, sourcePath));
  const sourceReadPlan = readPlan.find((entry) => entry.sourcePath === sourceRelativePath);
  if (!sourceReadPlan || sourceReadPlan.sourceHash !== sourceBytesHash) {
    throw new Error('claude_code_cli_judge_source_snapshot_binding_mismatch');
  }
  const snapshotHash = sha256(JSON.stringify({ entries, readPlan }));
  const manifestPath = path.join(snapshotRoot, 'snapshot-manifest.json');
  const requestBinding = {
    requestPath: slash(path.relative(projectRoot, requestPath)),
    requestContentHash: sha256(fs.readFileSync(requestPath)),
    requestHash: requiredText(
      input.request.requestHash,
      'claude_code_cli_judge_request_hash_missing'
    ),
    sourceDocumentHash: requiredText(
      input.request.sourceDocumentHash,
      'claude_code_cli_judge_source_document_hash_missing'
    ),
    sourceBytesHash,
    semanticModelHash: requiredText(
      input.request.semanticModelHash,
      'claude_code_cli_judge_semantic_model_hash_missing'
    ),
    projectionSetHash: requiredText(
      input.request.projectionSetHash,
      'claude_code_cli_judge_projection_set_hash_missing'
    ),
  };
  writeJsonAtomic(manifestPath, {
    schemaVersion: 'requirements-contract-judge-evidence-snapshot/v2',
    entries,
    readPlan,
    requestBinding,
    snapshotHash,
  });
  return { snapshotRoot, manifestPath, snapshotHash, entries, readPlan };
}

function materializeExecutionSnapshot(snapshot: EvidenceSnapshot): ExecutionSnapshot {
  const canonicalPaths = [
    snapshot.snapshotRoot,
    ...snapshot.entries.map((entry) => path.resolve(snapshot.snapshotRoot, entry.path)),
  ];
  if (
    process.platform !== 'win32' ||
    canonicalPaths.every((candidate) => candidate.length < WINDOWS_LEGACY_PATH_LIMIT)
  ) {
    return {
      cwd: snapshot.snapshotRoot,
      dispose: () => undefined,
    };
  }

  // Keep the execution root short enough for production requirement-record paths on Windows.
  const executionRoot = fs.mkdtempSync(path.join(tmpdir(), 'j-'));
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    fs.rmSync(executionRoot, { recursive: true, force: true });
  };

  try {
    for (const entry of snapshot.entries) {
      const source = path.resolve(snapshot.snapshotRoot, entry.path);
      const target = path.resolve(executionRoot, entry.path);
      if (!isWithin(snapshot.snapshotRoot, source) || !isWithin(executionRoot, target)) {
        throw new Error('claude_code_cli_judge_execution_snapshot_path_escape');
      }
      if (target.length >= WINDOWS_LEGACY_PATH_LIMIT) {
        throw new Error('claude_code_cli_judge_execution_snapshot_path_too_long');
      }
      const content = fs.readFileSync(source);
      if (content.byteLength !== entry.bytes || sha256(content) !== entry.hash) {
        throw new Error('claude_code_cli_judge_canonical_snapshot_changed');
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      const copiedContent = fs.readFileSync(target);
      if (copiedContent.byteLength !== entry.bytes || sha256(copiedContent) !== entry.hash) {
        throw new Error('claude_code_cli_judge_execution_snapshot_copy_mismatch');
      }
    }
    return { cwd: executionRoot, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function executionContext(payload: JsonRecord): ExecutionContext {
  const context = record(
    payload.executionContext,
    'claude_code_cli_judge_execution_context_missing'
  );
  return {
    projectRoot: requiredText(context.projectRoot, 'claude_code_cli_judge_project_root_missing'),
    requestPath: requiredText(context.requestPath, 'claude_code_cli_judge_request_path_missing'),
    outputDir: requiredText(context.outputDir, 'claude_code_cli_judge_output_dir_missing'),
  };
}

function configuredRequestedModel(provider: JsonRecord): string | null {
  const endpoint = record(provider.endpoint, 'claude_code_cli_judge_endpoint_invalid');
  if (endpoint.upstreamVersioning === 'cli_managed') {
    return requiredText(provider.model, 'claude_code_cli_judge_model_missing');
  }
  if (endpoint.upstreamVersioning === 'gateway_managed') {
    if (provider.model !== undefined && provider.model !== null) {
      throw new Error('claude_code_cli_judge_gateway_model_forbidden');
    }
    return null;
  }
  throw new Error('claude_code_cli_judge_endpoint_invalid');
}

function assertProvider(provider: JsonRecord): void {
  const legacyBinding = provider.transport === 'claude-code-cli';
  const configuredBinding =
    provider.transport === 'cli' && provider.adapterRef === 'ClaudeCodeCliJudgeAdapter';
  if ((!legacyBinding && !configuredBinding) || provider.apiStyle !== 'cli') {
    throw new Error('claude_code_cli_judge_provider_binding_invalid');
  }
  const endpoint = record(provider.endpoint, 'claude_code_cli_judge_endpoint_invalid');
  const command = requiredText(endpoint.command, 'claude_code_cli_judge_command_missing');
  if (
    (legacyBinding && command !== 'claude') ||
    endpoint.resolutionMode !== 'path_search' ||
    endpoint.routingOwnership !== 'transport_adapter' ||
    endpoint.explicitOperationPath !== null
  ) {
    throw new Error('claude_code_cli_judge_endpoint_invalid');
  }
  configuredRequestedModel(provider);
  const authentication = record(
    provider.authentication,
    'claude_code_cli_judge_authentication_invalid'
  );
  if (authentication.type === 'claude_code_session') {
    if (
      endpoint.upstreamVersioning !== 'cli_managed' ||
      endpoint.baseUrl !== undefined ||
      authentication.sensitivity !== 'host_managed' ||
      authentication.arbitraryNonEmptyValueAllowed !== false ||
      !Number.isInteger(Number(authentication.sessionRevision)) ||
      Number(authentication.sessionRevision) < 1
    ) {
      throw new Error('claude_code_cli_judge_authentication_invalid');
    }
  } else {
    const baseUrl = requiredText(
      endpoint.baseUrl,
      'claude_code_cli_judge_gateway_base_url_missing'
    );
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      throw new Error('claude_code_cli_judge_gateway_base_url_invalid');
    }
    if (
      !['http:', 'https:'].includes(parsedBaseUrl.protocol) ||
      endpoint.upstreamVersioning !== 'gateway_managed' ||
      !['bearer', 'api_key'].includes(String(authentication.type)) ||
      authentication.sensitivity !== 'secret' ||
      authentication.arbitraryNonEmptyValueAllowed !== false ||
      authentication.sessionRevision !== undefined
    ) {
      throw new Error('claude_code_cli_judge_authentication_invalid');
    }
  }
  const auditPolicy = record(provider.auditPolicy, 'claude_code_cli_judge_audit_policy_invalid');
  const allowedTools = Array.isArray(auditPolicy.allowedTools)
    ? auditPolicy.allowedTools.map(String)
    : [];
  if (
    auditPolicy.blindReview !== true ||
    auditPolicy.allowPassAuthority !== false ||
    auditPolicy.toolsAllowed !== true ||
    auditPolicy.implementationWritesAllowed !== false ||
    JSON.stringify(allowedTools) !== JSON.stringify(ALLOWED_TOOLS)
  ) {
    throw new Error('claude_code_cli_judge_audit_policy_invalid');
  }
}

function credentialBinding(input: {
  providerRef: string;
  provider: JsonRecord;
  credential: unknown;
}): CredentialBinding {
  const endpoint = record(input.provider.endpoint, 'claude_code_cli_judge_endpoint_invalid');
  const authentication = record(
    input.provider.authentication,
    'claude_code_cli_judge_authentication_invalid'
  );
  const env = { ...process.env };
  for (const key of [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_FOUNDRY',
    'CLAUDE_CODE_USE_VERTEX',
  ]) {
    delete env[key];
  }
  if (authentication.type === 'claude_code_session') {
    if (input.credential !== undefined && input.credential !== null) {
      throw new Error('claude_code_cli_judge_credential_injection_forbidden');
    }
    return {
      env,
      credentialRevision: Number(authentication.sessionRevision),
      credentialEnvironmentVariable: null,
    };
  }
  const credential = record(input.credential, 'claude_code_cli_judge_credential_required');
  const credentialRevision = Number(credential.credentialRevision);
  if (
    credential.providerRef !== input.providerRef ||
    credential.credentialRef !== input.provider.credentialRef ||
    credential.authenticationType !== authentication.type ||
    !Number.isInteger(credentialRevision) ||
    credentialRevision < 1
  ) {
    throw new Error('claude_code_cli_judge_credential_binding_invalid');
  }
  const baseUrl = requiredText(endpoint.baseUrl, 'claude_code_cli_judge_gateway_base_url_missing');
  const secret = readRequirementsContractJudgeCredentialSecret(input.credential);
  const credentialEnvironmentVariable =
    authentication.type === 'bearer' ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY';
  env.ANTHROPIC_BASE_URL = baseUrl;
  env[credentialEnvironmentVariable] = secret;
  return {
    env,
    credentialRevision,
    credentialEnvironmentVariable,
  };
}

export function buildClaudeCodeCliJudgePrompt(
  systemPrompt: string,
  request: JsonRecord,
  readPlan: SnapshotReadPlanEntry[]
): string {
  const readAllowlist = readPlan
    .flatMap((entry) => entry.segments.map((segment) => segment.path))
    .sort();
  return [
    systemPrompt.trim(),
    'The current working directory is an isolated frozen evidence snapshot.',
    'Use Read as the only evidence-access tool inside that directory.',
    'Do not access parent directories, external directories, networks, shells, or write-capable tools.',
    'Read only the exact snapshot-relative paths listed below.',
    'Do not call Read with any value that is absent from this allowlist.',
    'Pass each allowlisted path to Read exactly as written; do not prepend a working directory or convert it to an absolute path.',
    'Read every allowlisted file completely before producing a decision.',
    'If Read reports a partial or truncated view, continue reading the same path from the first unread line until EOF.',
    'Do not call StructuredOutput while any allowlisted file still has unread lines.',
    `Before calling StructuredOutput, verify that the set of successfully and completely read paths equals the ${readAllowlist.length}-entry allowlist.`,
    'Never pass readPlan.sourcePath or a path found inside judge-request-json to Read unless that exact string is also present in judge-read-allowlist-json.',
    'No allowlisted path is optional, including stdout logs, stderr logs, receipts, prior-round artifacts, and evidence that appears redundant.',
    'A source file may be represented by multiple exact byte segments in the read plan.',
    'Read every segment in ascending startByte order; concatenating those segments exactly reconstructs sourcePath.',
    'Use sourcePath rather than segment paths when returning evidence references or source spans.',
    'Treat requirement refs, projection refs, group IDs, rule codes, hashes, and receipt IDs as opaque data, not file paths.',
    'After reading the evidence, call the system-provided StructuredOutput tool exactly once to return the final schema-bound decision.',
    `Assessment verdict must be exactly one of: ${ASSESSMENT_VERDICTS.join(', ')}.`,
    '<judge-read-allowlist-json>',
    JSON.stringify(readAllowlist),
    '</judge-read-allowlist-json>',
    '<judge-read-plan-json>',
    JSON.stringify(readPlan),
    '</judge-read-plan-json>',
    '<judge-request-json>',
    JSON.stringify(request),
    '</judge-request-json>',
  ].join('\n');
}

export function buildClaudeCodeCliJudgeArgs(input: {
  provider: JsonRecord;
  systemPrompt: string;
  structuredOutputSchema?: JsonRecord;
}): string[] {
  const requestPolicy = record(
    input.provider.requestPolicy,
    'claude_code_cli_judge_request_policy_invalid'
  );
  const configuredModel = configuredRequestedModel(input.provider);
  const args = ['--print', '--effort', 'xhigh', '--bare'];
  if (configuredModel !== null) {
    args.push('--model', configuredModel);
  }
  args.push(
    '--tools',
    ALLOWED_TOOLS.join(','),
    '--permission-mode',
    'dontAsk',
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    JSON.stringify(input.structuredOutputSchema ?? DEFAULT_STRUCTURED_OUTPUT_SCHEMA),
    '--no-session-persistence',
    '--strict-mcp-config',
    '--mcp-config',
    JSON.stringify({ mcpServers: {} }),
    '--system-prompt',
    input.systemPrompt
  );
  const maxBudgetUsd = Number(requestPolicy.maxBudgetUsd);
  if (Number.isFinite(maxBudgetUsd) && maxBudgetUsd > 0) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }
  return args;
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams): void {
  const processId = child.pid;
  if (!processId) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(processId), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(-processId, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function executeCommand(
  invocation: ClaudeCodeCliCommandInvocation
): Promise<ClaudeCodeCliCommandResult> {
  if (process.platform === 'win32' && invocation.cwd.length >= 260) {
    return Promise.reject(new Error('claude_code_cli_judge_cwd_path_too_long'));
  }
  return new Promise((resolve, reject) => {
    const streamTargets = [
      invocation.stdoutPath,
      invocation.stderrPath,
      invocation.transcriptPath,
    ].filter((value): value is string => Boolean(value));
    try {
      for (const target of streamTargets) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '', 'utf8');
      }
    } catch (error) {
      reject(
        new Error(
          `claude_code_cli_judge_log_target_initialization_failed:${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
      return;
    }
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(invocation.command, invocation.args, {
        cwd: invocation.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
        env: invocation.env,
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      reject(
        new Error(
          `claude_code_cli_judge_spawn_failed:${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
      return;
    }
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminalError: Error | null = null;
    let terminationFallback: NodeJS.Timeout | null = null;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (terminationFallback) clearTimeout(terminationFallback);
      callback();
    };
    const terminate = (error: Error): void => {
      if (terminalError) return;
      terminalError = error;
      terminateProcessTree(child);
      terminationFallback = setTimeout(() => {
        finish(() => reject(error));
      }, 5_000);
      terminationFallback.unref();
    };
    const fail = (code: string, error: NodeJS.ErrnoException): void => {
      terminate(new Error(`${code}:${error.code ?? 'unknown'}`));
    };
    const timeout = setTimeout(() => {
      terminate(new Error('claude_code_cli_judge_timeout'));
    }, invocation.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      stdoutBytes += Buffer.byteLength(chunk, 'utf8');
      if (invocation.stdoutPath) fs.appendFileSync(invocation.stdoutPath, chunk, 'utf8');
      if (invocation.transcriptPath) fs.appendFileSync(invocation.transcriptPath, chunk, 'utf8');
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        terminate(new Error('claude_code_cli_judge_stdout_limit_exceeded'));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      stderrBytes += Buffer.byteLength(chunk, 'utf8');
      if (invocation.stderrPath) fs.appendFileSync(invocation.stderrPath, chunk, 'utf8');
      if (stderrBytes > MAX_STDERR_BYTES) {
        terminate(new Error('claude_code_cli_judge_stderr_limit_exceeded'));
      }
    });
    child.stdout.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_stdout_stream_failed', error)
    );
    child.stderr.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_stderr_stream_failed', error)
    );
    child.stdin.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_stdin_stream_failed', error)
    );
    child.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_spawn_failed', error)
    );
    child.once('close', (exitCode) => {
      finish(() => {
        if (terminalError) {
          reject(terminalError);
          return;
        }
        resolve({ exitCode: exitCode ?? -1, stdout, stderr, processId: child.pid });
      });
    });
    child.stdin.end(invocation.stdin);
  });
}

function parseTranscript(stdout: string): {
  events: JsonRecord[];
  result: JsonRecord;
} {
  const lines = stdout.split(/\r?\n/gu).filter((line) => line.trim().length > 0);
  const events = lines.map((line) => {
    try {
      return record(JSON.parse(line), 'claude_code_cli_judge_transcript_invalid');
    } catch {
      throw new Error('claude_code_cli_judge_transcript_invalid');
    }
  });
  const result = [...events].reverse().find((event) => event.type === 'result');
  if (!result) throw new Error('claude_code_cli_judge_result_missing');
  return { events, result };
}

function validatedTranscriptModelBinding(
  events: JsonRecord[],
  modelUsage: JsonRecord,
  executorKind: ClaudeCodeCliExecutorKind
): {
  initModel: string | null;
  returnedModel: string;
  modelUsageModels: string[];
} {
  const initModels = events
    .filter((event) => event.type === 'system' && event.subtype === 'init')
    .map((event) => requiredText(event.model, 'claude_code_cli_judge_init_model_missing'));
  const assistantModels = events
    .filter((event) => event.type === 'assistant')
    .map((event) =>
      requiredText(
        record(event.message, 'claude_code_cli_judge_assistant_message_invalid').model,
        'claude_code_cli_judge_assistant_model_missing'
      )
    );
  const structuredOutputModels = events.flatMap((event) => {
    if (event.type !== 'assistant') return [];
    const message = record(event.message, 'claude_code_cli_judge_assistant_message_invalid');
    const content = Array.isArray(message.content) ? message.content : [];
    const producedStructuredOutput = content.some((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const block = entry as JsonRecord;
      return block.type === 'tool_use' && block.name === 'StructuredOutput';
    });
    return producedStructuredOutput
      ? [requiredText(message.model, 'claude_code_cli_judge_assistant_model_missing')]
      : [];
  });
  const uniqueStructuredOutputModels = [...new Set(structuredOutputModels)];
  if (
    executorKind === 'native_spawn' &&
    (initModels.length !== 1 || uniqueStructuredOutputModels.length !== 1)
  ) {
    throw new Error('claude_code_cli_judge_returned_model_mismatch');
  }
  const rawUsageModels = Object.keys(modelUsage);
  const normalizedUsageModels = rawUsageModels.map((model) => model.trim());
  if (
    normalizedUsageModels.length === 0 ||
    normalizedUsageModels.some((model, index) => !model || model !== rawUsageModels[index]) ||
    new Set(normalizedUsageModels).size !== normalizedUsageModels.length
  ) {
    throw new Error('claude_code_cli_judge_returned_model_mismatch');
  }
  const modelUsageModels = [...normalizedUsageModels].sort();
  const returnedModel =
    uniqueStructuredOutputModels.at(-1) ??
    assistantModels.at(-1) ??
    (modelUsageModels.length === 1 ? modelUsageModels[0] : '');
  const initModel = initModels.length === 1 ? initModels[0] : null;
  if (
    !returnedModel ||
    (executorKind === 'native_spawn' && (!initModel || !modelUsageModels.includes(initModel)))
  ) {
    throw new Error('claude_code_cli_judge_returned_model_mismatch');
  }
  return {
    initModel,
    returnedModel,
    modelUsageModels,
  };
}

function structuredDecision(value: unknown): {
  decision: 'pass' | 'block' | 'inconclusive';
  findings: JsonRecord[];
  challengeRequests: JsonRecord[];
  evidenceRefs: string[];
} {
  const parsed = record(value, 'claude_code_cli_judge_structured_output_invalid');
  const allowedKeys = new Set(['decision', 'findings', 'challengeRequests', 'evidenceRefs']);
  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  if (!['pass', 'block', 'inconclusive'].includes(String(parsed.decision))) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  if (
    !Array.isArray(parsed.findings) ||
    !Array.isArray(parsed.challengeRequests) ||
    !Array.isArray(parsed.evidenceRefs)
  ) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  const findings = parsed.findings.map((finding) =>
    record(finding, 'claude_code_cli_judge_structured_output_invalid')
  );
  const challengeRequests = parsed.challengeRequests.map((request) =>
    record(request, 'claude_code_cli_judge_structured_output_invalid')
  );
  const evidenceRefs = parsed.evidenceRefs.map((reference) =>
    requiredText(reference, 'claude_code_cli_judge_structured_output_invalid')
  );
  if (new Set(evidenceRefs).size !== evidenceRefs.length) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  return {
    decision: parsed.decision as 'pass' | 'block' | 'inconclusive',
    findings,
    challengeRequests,
    evidenceRefs,
  };
}

function validateExecutionReceipt(receipt: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-cli-judge-execution-receipt.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(receipt)) {
    throw new Error(
      `claude_code_cli_judge_execution_receipt_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
}

export function createClaudeCodeCliJudgeAdapter(
  dependencies: ClaudeCodeCliJudgeAdapterDependencies = {}
) {
  const run = dependencies.executeCommand ?? executeCommand;
  const executorKind = dependencies.executeCommand ? 'injected_test_transport' : 'native_spawn';
  return {
    judge: async (input: AdapterInput): Promise<JsonRecord> => {
      const provider = record(input.provider, 'claude_code_cli_judge_provider_invalid');
      assertProvider(provider);
      const providerRef = requiredText(
        input.providerRef,
        'claude_code_cli_judge_provider_ref_missing'
      );
      const credential = credentialBinding({
        providerRef,
        provider,
        credential: input.credential,
      });
      const payload = record(input.payload, 'claude_code_cli_judge_payload_invalid');
      const systemPrompt = requiredText(
        payload.systemPrompt,
        'claude_code_cli_judge_system_prompt_missing'
      );
      const request = record(payload.request, 'claude_code_cli_judge_request_invalid');
      const structuredOutputSchema =
        payload.structuredOutputSchema === undefined
          ? undefined
          : record(
              payload.structuredOutputSchema,
              'claude_code_cli_judge_structured_output_schema_invalid'
            );
      const context = executionContext(payload);
      const snapshot = materializeEvidenceSnapshot({ context, request });
      const prompt = buildClaudeCodeCliJudgePrompt(systemPrompt, request, snapshot.readPlan);
      const args = buildClaudeCodeCliJudgeArgs({
        provider,
        systemPrompt,
        ...(structuredOutputSchema ? { structuredOutputSchema } : {}),
      });
      const requestPolicy = record(
        provider.requestPolicy,
        'claude_code_cli_judge_request_policy_invalid'
      );
      const timeoutMs = Number(requestPolicy.timeoutMs);
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error('claude_code_cli_judge_timeout_invalid');
      }
      const endpoint = record(provider.endpoint, 'claude_code_cli_judge_endpoint_invalid');
      const command = requiredText(endpoint.command, 'claude_code_cli_judge_command_missing');
      const outputDir = path.resolve(context.outputDir);
      const stdoutPath = path.join(outputDir, 'claude-code-cli-stdout.jsonl');
      const stderrPath = path.join(outputDir, 'claude-code-cli-stderr.log');
      const transcriptPath = path.join(outputDir, 'claude-code-cli-transcript.jsonl');
      const executionSnapshot = materializeExecutionSnapshot(snapshot);
      const startedAt = new Date().toISOString();
      try {
        const execution = await run({
          command,
          args,
          cwd: executionSnapshot.cwd,
          stdin: prompt,
          timeoutMs,
          env: credential.env,
          stdoutPath,
          stderrPath,
          transcriptPath,
        });
        writeTextAtomic(stdoutPath, execution.stdout);
        writeTextAtomic(stderrPath, execution.stderr);
        if (execution.exitCode !== 0) {
          throw new Error(`claude_code_cli_judge_process_failed:${execution.exitCode}`);
        }
        const transcript = parseTranscript(execution.stdout);
        writeTextAtomic(
          transcriptPath,
          `${transcript.events.map((event) => JSON.stringify(event)).join('\n')}\n`
        );
        const result = transcript.result;
        if (
          result.subtype !== 'success' ||
          result.is_error === true ||
          !UUID_V4_PATTERN.test(
            requiredText(result.session_id, 'claude_code_cli_judge_session_invalid')
          )
        ) {
          throw new Error('claude_code_cli_judge_result_invalid');
        }
        const permissionDenials = result.permission_denials;
        if (!Array.isArray(permissionDenials) || permissionDenials.length > 0) {
          throw new Error('claude_code_cli_judge_permission_denied');
        }
        const modelUsage = record(result.modelUsage, 'claude_code_cli_judge_model_usage_missing');
        const model = configuredRequestedModel(provider);
        const modelBinding = validatedTranscriptModelBinding(
          transcript.events,
          modelUsage,
          executorKind
        );
        const returnedModel = modelBinding.returnedModel;
        const normalizedDecision = structuredDecision(result.structured_output);
        const transportEvidence = {
          schemaVersion: 'requirements-contract-cli-judge-execution-receipt/v1',
          adapterRef: 'ClaudeCodeCliJudgeAdapter',
          protocol: 'claude_stream_json',
          command,
          argv: args,
          commandResolution:
            executorKind === 'native_spawn'
              ? 'process_spawn_path_search'
              : 'injected_test_transport',
          launchCommand: executorKind === 'native_spawn' ? command : null,
          launchCommandHash:
            executorKind === 'native_spawn' ? sha256(JSON.stringify(command)) : null,
          launchArgv: executorKind === 'native_spawn' ? args : null,
          launchEntryPath: null,
          launchEntryHash: null,
          cwd: executionSnapshot.cwd,
          executorKind,
          processId:
            executorKind === 'native_spawn' &&
            Number.isInteger(execution.processId) &&
            Number(execution.processId) > 0
              ? execution.processId
              : null,
          providerRequestId: result.session_id,
          requestedModel: model,
          observedModel: returnedModel,
          modelObservationSource: 'cli_event',
          decisionBearingModelEvidence: true,
          credentialRevision: credential.credentialRevision,
          credentialEnvironmentVariable: credential.credentialEnvironmentVariable,
          runtimeHomePath: null,
          runtimeConfigHash: null,
          exitCode: execution.exitCode,
          stdoutPath: slash(path.relative(context.projectRoot, stdoutPath)),
          stdoutHash: sha256(execution.stdout),
          stderrPath: slash(path.relative(context.projectRoot, stderrPath)),
          stderrHash: sha256(execution.stderr),
          transcriptPath: slash(path.relative(context.projectRoot, transcriptPath)),
          transcriptHash: sha256(fs.readFileSync(transcriptPath)),
          outputPath: null,
          outputHash: null,
          structuredOutputSchemaPath: null,
          structuredOutputSchemaHash: sha256(
            JSON.stringify(structuredOutputSchema ?? DEFAULT_STRUCTURED_OUTPUT_SCHEMA)
          ),
          snapshotManifestPath: slash(path.relative(context.projectRoot, snapshot.manifestPath)),
          snapshotHash: snapshot.snapshotHash,
          sessionId: result.session_id,
          initModel: modelBinding.initModel,
          modelUsageModels: modelBinding.modelUsageModels,
        };
        validateExecutionReceipt(transportEvidence);
        const normalized = {
          schemaVersion: 'requirements-contract-normalized-judge-response/v1',
          providerRef,
          transport: provider.transport,
          configuredModel: model,
          returnedModel,
          ...normalizedDecision,
          providerRequestId: result.session_id,
          requestHash: sha256(prompt),
          responseHash: sha256(execution.stdout),
          transportEvidence,
        };
        writeInvocationReceipt({
          outputDir,
          startedAt,
          completedAt: new Date().toISOString(),
          providerRef,
          transport: String(provider.transport),
          providerRequestId: result.session_id,
          decision: normalizedDecision.decision,
          normalizedResponseHash: sha256(stableStringify(normalized)),
          transportEvidenceHash: sha256(stableStringify(transportEvidence)),
        });
        return normalized;
      } finally {
        executionSnapshot.dispose();
      }
    },
  } as const;
}

export const ClaudeCodeCliJudgeAdapter = createClaudeCodeCliJudgeAdapter();
