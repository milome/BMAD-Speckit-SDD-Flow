/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  artifactBytesHash,
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import {
  classifyArchitectureConfirmationError,
  deriveArchitectureConfirmationCandidate,
  readCurrentArchitectureConfirmationAcceptance,
  resolveArchitectureConfirmationContext,
  type ArchitectureConfirmationContext,
  type ArchitectureConfirmationCandidate,
} from './prepare-architecture-confirmation';
import {
  createRuntimeStatusDecisionReceipt,
  runtimeStatusProjectionArtifactWrites,
  validateRuntimeStatusDecisionReceipt,
  runtimeStatusProjectionRecordPatch,
  type RuntimeStatusProjectionUpdate,
} from './requirements-contract-runtime-status-decision-receipt';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  readControlStoreAuthoritatively,
  sha256Json,
  sha256Text,
  type ControlArtifactWrite,
  type ControlStoreCommitDeps,
} from './requirement-record-control-store';
import { resolveVerifiedSixModelStatus } from './verified-six-model-status-facade';

type JsonObject = Record<string, unknown>;
type ReadinessStatus =
  | 'implementation_readiness_pass'
  | 'implementation_readiness_reused'
  | 'implementation_readiness_blocked';

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const SHELL_SYNTAX = /[|&;<>`\r\n]/u;
const INFRA_FAILURE =
  /(?:MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|SyntaxError|command not found|is not recognized as an internal|ENOENT|EACCES|EPERM|No test files found|failed to load config|npm ERR!)/iu;
const POLICY = {
  schemaVersion: 'implementation-readiness-policy/v2',
  timeoutMs: 120_000,
  maxOutputBytes: 1_048_576,
  reporter: 'tap',
  shell: false,
  runtimeIsolation: 'isolated-runtime-v1',
  executablePathPolicy: 'controlled-project-node-path-v1',
};
const ALLOWED_EXECUTABLES = new Set(['node', 'npm', 'npx', 'pnpm', 'yarn', 'bun']);
const LOCK_NAMES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
const CONTROL_STORE_ZERO_HASH =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';
const NODE_MODULE_INPUT_OPTIONS = new Set([
  '--require',
  '-r',
  '--import',
  '--loader',
  '--experimental-loader',
]);
const NODE_FILE_INPUT_OPTIONS = new Set([
  '--env-file',
  '--env-file-if-exists',
  '--experimental-policy',
  '--policy',
  '--openssl-config',
  '--experimental-config-file',
  '--build-snapshot-config',
  '--snapshot-blob',
]);
const NODE_VALUE_OPTIONS = new Set([
  '--conditions',
  '-C',
  '--diagnostic-dir',
  '--disable-warning',
  '--dns-result-order',
  '--heap-prof-dir',
  '--heap-prof-interval',
  '--heap-prof-name',
  '--input-type',
  '--inspect-port',
  '--max-http-header-size',
  '--redirect-warnings',
  '--report-dir',
  '--report-filename',
  '--secure-heap',
  '--secure-heap-min',
  '--test-concurrency',
  '--test-name-pattern',
  '--test-reporter',
  '--test-reporter-destination',
  '--test-shard',
  '--test-skip-pattern',
  '--title',
  '--trace-event-categories',
  '--trace-event-file-pattern',
  '--watch-path',
]);
const READINESS_OPERATIONAL_ENV_KEYS = [
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'ComSpec',
  'COMSPEC',
] as const;
const READINESS_RUNTIME_BASE = fs.realpathSync(os.tmpdir());
const READINESS_CANDIDATE_SCHEMA = 'main-agent-implementation-readiness-candidate.schema.json';
let validateReadinessCandidate: ((value: unknown) => boolean) | undefined;

interface ParsedArgs {
  requestId?: string;
  executeRedProof?: boolean;
  json?: boolean;
  help?: boolean;
}

interface NormalizedCommand {
  normalizedCommandHash: string;
  commandIds: string[];
  executable: string;
  args: string[];
  normalizedInvocation: string;
  expectedTestIds: string[];
  expectedFailureSignatures: string[];
}

interface InputArtifact {
  role: 'test' | 'pre_implementation_target' | 'config' | 'lock';
  artifactId: string;
  logicalPath: string;
  bytesHash: string;
}

interface ReadinessOutcome {
  normalizedCommandHash: string;
  commandIds: string[];
  status: 'expected_red_observed';
  exitCode: number;
  failedTestIds: string[];
  expectedFailureSignaturesObserved: string[];
  unrelatedFailureIds: string[];
  negativeControl: {
    runnerCompleted: true;
    tapFailuresObserved: true;
    noUnrelatedFailures: true;
    environmentFailure: false;
  };
  rawLogRef: {
    path: string;
    artifactBytesHash: string;
  };
}

export interface ReadinessCandidate extends JsonObject {
  schemaVersion: 'ImplementationReadinessCandidate/v1';
  requestId: string;
  requirementsLineage: JsonObject;
  architectureConfirmationCandidateHash: string;
  architectureAcceptanceRef: { path: string; artifactBytesHash: string };
  readinessScopedInputDigest: string;
  readinessPolicy: typeof POLICY;
  normalizedCommands: NormalizedCommand[];
  inputArtifacts: InputArtifact[];
  redOutcomes: ReadinessOutcome[];
  implementationReadinessCandidateHash: string;
}

interface ExistingReadinessBundle {
  result: JsonObject;
  candidate: ReadinessCandidate;
  receiptPath: string;
  receipt: JsonObject;
  projectionCurrent: boolean;
}

interface ReadinessCommandRun {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
}

export interface ReadinessProducerDeps {
  runCommand?: (command: NormalizedCommand, projectRoot: string) => ReadinessCommandRun;
  onCommandExecuted?: (command: NormalizedCommand) => void;
  beforePublish?: () => void;
  afterAtomicPublish?: () => void;
  controlStoreCommitDeps?: ControlStoreCommitDeps;
  now?: () => string;
}

export interface ReadinessEvaluationInput {
  projectRoot: string;
  requestId: string;
}

export class ImplementationReadinessBlock extends Error {
  constructor(
    readonly issueCode: string,
    readonly commandExecutionCount = 0,
    readonly writeCount = 0
  ) {
    super(issueCode);
  }
}

export class ImplementationReadinessFailure extends Error {
  constructor(
    readonly issueCode: string,
    readonly commandExecutionCount = 0,
    readonly writeCount = 0
  ) {
    super(issueCode);
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function sha256Bytes(value: Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/gu, '-') || 'unknown';
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') result.help = true;
    else if (token === '--json') result.json = true;
    else if (token === '--execute-red-proof') result.executeRedProof = true;
    else if (token === '--request-id') {
      const requestId = argv[index + 1];
      if (!requestId || requestId.startsWith('--')) throw new Error('request_id_missing');
      result.requestId = requestId;
      index += 1;
    } else if (token.startsWith('--')) {
      throw new Error(`caller_derived_input_forbidden:${token.slice(2)}`);
    } else {
      throw new Error('caller_derived_input_forbidden:positional');
    }
  }
  return result;
}

function emitJson(stream: NodeJS.WriteStream, value: unknown): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function issueCodeFromError(error: unknown): string {
  const issueCode = error instanceof Error ? error.message : String(error);
  return issueCode.startsWith('caller_derived_input_forbidden:')
    ? 'caller_derived_input_forbidden'
    : issueCode;
}

function publicProducerFailureIssueCode(issueCode: string): string {
  return /^(?:implementation_readiness_|red_proof_|readiness_recheck_required:|requirements_successor_required:|architecture_successor_required:|architecture_confirmation_required$)/u.test(
    issueCode
  )
    ? issueCode
    : 'implementation_readiness_production_failure';
}

function classifyReadinessError(error: unknown): { issueCode: string; exitCode: 1 | 2 } {
  const issueCode = issueCodeFromError(error);
  if (error instanceof SyntaxError) {
    return { issueCode: 'implementation_readiness_malformed_input', exitCode: 2 };
  }
  if (issueCode.startsWith('implementation_readiness_') || issueCode.startsWith('red_proof_')) {
    return { issueCode, exitCode: 2 };
  }
  const architectureFailure = classifyArchitectureConfirmationError(error);
  return {
    issueCode: architectureFailure.issueCode,
    exitCode: architectureFailure.exitCode,
  };
}

function projectRelative(projectRoot: string, absolutePath: string): string {
  const relative = path.relative(projectRoot, absolutePath).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('implementation_readiness_physical_path_forbidden');
  }
  return relative;
}

function recordRelative(recordRoot: string, absolutePath: string): string {
  const relative = path.relative(recordRoot, absolutePath).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('implementation_readiness_record_path_invalid');
  }
  return relative;
}

function confinedFile(projectRoot: string, logicalPath: string): string {
  if (!logicalPath || path.isAbsolute(logicalPath)) {
    throw new Error('implementation_readiness_physical_path_forbidden');
  }
  const absolute = path.resolve(projectRoot, logicalPath);
  const relative = path.relative(projectRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('implementation_readiness_physical_path_forbidden');
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`implementation_readiness_input_missing:${logicalPath}`);
  }
  const realProject = fs.realpathSync(projectRoot);
  const realFile = fs.realpathSync(absolute);
  const realRelative = path.relative(realProject, realFile);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('implementation_readiness_physical_path_forbidden');
  }
  return absolute;
}

const LOCAL_MODULE_EXTENSIONS = [
  '',
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.cts',
  '.mts',
  '.jsx',
  '.tsx',
  '.json',
];
const MODULE_SOURCE_EXTENSIONS = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.cts',
  '.mts',
  '.jsx',
  '.tsx',
]);

function executableCodeMask(source: string): Uint8Array {
  const mask = new Uint8Array(source.length);
  let mode: 'code' | 'single' | 'double' | 'template' | 'line_comment' | 'block_comment' = 'code';
  const templateExpressionDepths: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (mode === 'line_comment') {
      if (current === '\n' || current === '\r') mode = 'code';
      continue;
    }
    if (mode === 'block_comment') {
      if (current === '*' && next === '/') {
        index += 1;
        mode = 'code';
      }
      continue;
    }
    if (mode === 'single' || mode === 'double') {
      if (current === '\\') index += 1;
      else if ((mode === 'single' && current === "'") || (mode === 'double' && current === '"')) {
        mode = 'code';
      }
      continue;
    }
    if (mode === 'template') {
      if (current === '\\') index += 1;
      else if (current === '`') mode = 'code';
      else if (current === '$' && next === '{') {
        templateExpressionDepths.push(1);
        index += 1;
        mode = 'code';
      }
      continue;
    }
    if (current === '/' && next === '/') {
      index += 1;
      mode = 'line_comment';
      continue;
    }
    if (current === '/' && next === '*') {
      index += 1;
      mode = 'block_comment';
      continue;
    }
    mask[index] = 1;
    if (current === "'") mode = 'single';
    else if (current === '"') mode = 'double';
    else if (current === '`') mode = 'template';
    else if (templateExpressionDepths.length > 0 && current === '{') {
      templateExpressionDepths[templateExpressionDepths.length - 1] += 1;
    } else if (templateExpressionDepths.length > 0 && current === '}') {
      const last = templateExpressionDepths.length - 1;
      templateExpressionDepths[last] -= 1;
      if (templateExpressionDepths[last] === 0) {
        templateExpressionDepths.pop();
        mode = 'template';
      }
    }
  }
  return mask;
}

function localModuleSpecifiers(filePath: string, allowBunBuiltins = false): string[] {
  if (!MODULE_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return [];
  const source = fs.readFileSync(filePath, 'utf8');
  const codeMask = executableCodeMask(source);
  const specifiers: string[] = [];
  for (const pattern of [
    /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (
        match.index !== undefined &&
        codeMask[match.index] === 1 &&
        !/^(?:node:|data:|https?:)/iu.test(specifier) &&
        !(allowBunBuiltins && (specifier === 'bun' || specifier.startsWith('bun:')))
      ) {
        specifiers.push(specifier);
      }
    }
  }
  return sortedUnique(specifiers);
}

function moduleCandidates(base: string): string[] {
  return [
    ...LOCAL_MODULE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...LOCAL_MODULE_EXTENSIONS.slice(1).map((extension) => path.join(base, `index${extension}`)),
  ];
}

function packageSpecifierParts(
  specifier: string
): { packageName: string; exportSubpath: string } | null {
  if (specifier.startsWith('#')) return null;
  const parts = specifier.split('/');
  const packagePartCount = specifier.startsWith('@') ? 2 : 1;
  if (parts.length < packagePartCount || parts.slice(0, packagePartCount).some((part) => !part)) {
    return null;
  }
  return {
    packageName: parts.slice(0, packagePartCount).join('/'),
    exportSubpath:
      parts.length === packagePartCount ? '.' : `./${parts.slice(packagePartCount).join('/')}`,
  };
}

function packageDescriptorPath(
  projectRoot: string,
  importerPath: string,
  packageName: string,
  resolvedModulePath: string | null
): string | null {
  const root = path.resolve(projectRoot);
  const candidates: string[] = [];
  if (resolvedModulePath) {
    const resolvedSegments = path.relative(root, resolvedModulePath).split(path.sep);
    const packageSegments = packageName.split('/');
    let packageRootSegmentCount = 0;
    for (let index = 0; index < resolvedSegments.length; index += 1) {
      if (
        resolvedSegments[index] === 'node_modules' &&
        packageSegments.every((segment, offset) => resolvedSegments[index + offset + 1] === segment)
      ) {
        packageRootSegmentCount = index + packageSegments.length + 1;
      }
    }
    if (packageRootSegmentCount > 0) {
      candidates.push(
        path.join(root, ...resolvedSegments.slice(0, packageRootSegmentCount), 'package.json')
      );
    }
  }
  const nearestImporterDescriptor = nearestPackageDescriptorPath(root, importerPath);
  if (nearestImporterDescriptor) candidates.push(nearestImporterDescriptor);
  for (const searchRoot of createRequire(importerPath).resolve.paths(packageName) ?? []) {
    candidates.push(path.join(searchRoot, ...packageName.split('/'), 'package.json'));
  }
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const relative = path.relative(root, candidate);
    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !fs.existsSync(candidate) ||
      !fs.statSync(candidate).isFile()
    ) {
      continue;
    }
    let descriptor: JsonObject;
    try {
      descriptor = object(JSON.parse(fs.readFileSync(candidate, 'utf8')));
    } catch {
      throw new Error(
        `implementation_readiness_config_invalid:${projectRelative(root, candidate)}`
      );
    }
    if (text(descriptor.name) === packageName) {
      return confinedFile(root, projectRelative(root, candidate));
    }
  }
  return null;
}

function nearestPackageDescriptorPath(projectRoot: string, importerPath: string): string | null {
  const root = path.resolve(projectRoot);
  let current = path.dirname(importerPath);
  while (current === root || current.startsWith(`${root}${path.sep}`)) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return confinedFile(root, projectRelative(root, candidate));
    }
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current || (parent !== root && !parent.startsWith(`${root}${path.sep}`))) break;
    current = parent;
  }
  return null;
}

function packagePatternSelection(
  entries: Array<[string, unknown]>,
  requestedKey: string
): { matched: boolean; target: unknown; wildcard: string } {
  const matches = entries
    .map(([pattern, target]) => {
      const star = pattern.indexOf('*');
      const wildcard =
        star < 0
          ? requestedKey === pattern
            ? ''
            : null
          : requestedKey.startsWith(pattern.slice(0, star)) &&
              requestedKey.endsWith(pattern.slice(star + 1))
            ? requestedKey.slice(
                star,
                requestedKey.length - (pattern.length - star - 1) || undefined
              )
            : null;
      return wildcard === null ? null : { pattern, target, wildcard, star };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => {
      const leftExact = left.star < 0;
      const rightExact = right.star < 0;
      if (leftExact !== rightExact) return leftExact ? -1 : 1;
      if (left.star !== right.star) return right.star - left.star;
      const leftSuffixLength = left.pattern.length - left.star - 1;
      const rightSuffixLength = right.pattern.length - right.star - 1;
      if (leftSuffixLength !== rightSuffixLength) return rightSuffixLength - leftSuffixLength;
      return left.pattern < right.pattern ? -1 : left.pattern > right.pattern ? 1 : 0;
    });
  return matches[0]
    ? { matched: true, target: matches[0].target, wildcard: matches[0].wildcard }
    : { matched: false, target: null, wildcard: '' };
}

function packageExportSelection(
  exportsValue: unknown,
  exportSubpath: string
): { matched: boolean; target: unknown; wildcard: string } {
  const exportsObject = object(exportsValue);
  const subpathEntries = Object.entries(exportsObject).filter(([key]) => key.startsWith('.'));
  if (subpathEntries.length === 0) {
    return exportSubpath === '.'
      ? { matched: exportsValue !== undefined, target: exportsValue, wildcard: '' }
      : { matched: false, target: null, wildcard: '' };
  }
  return packagePatternSelection(subpathEntries, exportSubpath);
}

function packageExportTargetStrings(target: unknown, wildcard: string): string[] {
  if (typeof target === 'string') return [target.replace(/\*/gu, wildcard)];
  if (Array.isArray(target)) {
    return target.flatMap((entry) => packageExportTargetStrings(entry, wildcard));
  }
  return Object.values(object(target)).flatMap((entry) =>
    packageExportTargetStrings(entry, wildcard)
  );
}

function localPackageExportFiles(input: {
  projectRoot: string;
  importerPath: string;
  specifier: string;
  resolvedModulePath: string | null;
  onConfig?: (configPath: string) => void;
}): string[] {
  const parts = packageSpecifierParts(input.specifier);
  if (!parts) return [];
  const descriptorPath = packageDescriptorPath(
    input.projectRoot,
    input.importerPath,
    parts.packageName,
    input.resolvedModulePath
  );
  if (!descriptorPath) return [];
  const descriptor = object(JSON.parse(fs.readFileSync(descriptorPath, 'utf8')));
  input.onConfig?.(descriptorPath);
  const selection = packageExportSelection(descriptor.exports, parts.exportSubpath);
  if (!selection.matched) return [];
  const packageRoot = path.dirname(descriptorPath);
  const resolved: string[] = [];
  for (const target of packageExportTargetStrings(selection.target, selection.wildcard)) {
    if (!target.startsWith('./')) continue;
    const candidate = moduleCandidates(path.resolve(packageRoot, target)).find(
      (entry) => fs.existsSync(entry) && fs.statSync(entry).isFile()
    );
    if (candidate) {
      resolved.push(confinedFile(input.projectRoot, projectRelative(input.projectRoot, candidate)));
    }
  }
  return sortedUnique(resolved);
}

function localPackageImportFiles(input: {
  projectRoot: string;
  importerPath: string;
  specifier: string;
  resolutionChain: Set<string>;
  onConfig?: (configPath: string) => void;
}): string[] {
  if (!input.specifier.startsWith('#')) return [];
  const descriptorPath = nearestPackageDescriptorPath(input.projectRoot, input.importerPath);
  if (!descriptorPath) return [];
  const descriptor = object(JSON.parse(fs.readFileSync(descriptorPath, 'utf8')));
  const selection = packagePatternSelection(
    Object.entries(object(descriptor.imports)).filter(([key]) => key.startsWith('#')),
    input.specifier
  );
  if (!selection.matched) return [];
  input.onConfig?.(descriptorPath);
  const packageRoot = path.dirname(descriptorPath);
  const resolved: string[] = [];
  for (const target of packageExportTargetStrings(selection.target, selection.wildcard)) {
    if (target.startsWith('./')) {
      const candidate = moduleCandidates(path.resolve(packageRoot, target)).find(
        (entry) => fs.existsSync(entry) && fs.statSync(entry).isFile()
      );
      if (candidate) {
        resolved.push(
          confinedFile(input.projectRoot, projectRelative(input.projectRoot, candidate))
        );
      }
    } else {
      resolved.push(
        ...resolveLocalModule(
          input.projectRoot,
          descriptorPath,
          target,
          input.onConfig,
          input.resolutionChain
        )
      );
    }
  }
  return sortedUnique(resolved);
}

function parseJsonConfig(configPath: string): JsonObject {
  const source = fs.readFileSync(configPath, 'utf8');
  let stripped = '';
  let mode: 'code' | 'string' | 'line_comment' | 'block_comment' = 'code';
  let quote = '';
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (mode === 'line_comment') {
      stripped += current === '\n' || current === '\r' ? current : ' ';
      if (current === '\n' || current === '\r') mode = 'code';
      continue;
    }
    if (mode === 'block_comment') {
      stripped += current === '\n' || current === '\r' ? current : ' ';
      if (current === '*' && next === '/') {
        stripped += ' ';
        index += 1;
        mode = 'code';
      }
      continue;
    }
    if (mode === 'string') {
      stripped += current;
      if (current === '\\') {
        stripped += next ?? '';
        index += 1;
      } else if (current === quote) {
        mode = 'code';
      }
      continue;
    }
    if (current === '/' && next === '/') {
      stripped += '  ';
      index += 1;
      mode = 'line_comment';
      continue;
    }
    if (current === '/' && next === '*') {
      stripped += '  ';
      index += 1;
      mode = 'block_comment';
      continue;
    }
    stripped += current;
    if (current === '"') {
      quote = current;
      mode = 'string';
    }
  }
  let normalized = '';
  mode = 'code';
  quote = '';
  for (let index = 0; index < stripped.length; index += 1) {
    const current = stripped[index];
    if (mode === 'string') {
      normalized += current;
      if (current === '\\') {
        normalized += stripped[index + 1] ?? '';
        index += 1;
      } else if (current === quote) {
        mode = 'code';
      }
      continue;
    }
    if (current === '"') {
      normalized += current;
      quote = current;
      mode = 'string';
      continue;
    }
    if (current === ',') {
      let lookahead = index + 1;
      while (/\s/u.test(stripped[lookahead] ?? '')) lookahead += 1;
      if (stripped[lookahead] === '}' || stripped[lookahead] === ']') continue;
    }
    normalized += current;
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('implementation_readiness_config_invalid');
  }
  return parsed as JsonObject;
}

interface ResolvedTsConfig {
  configPaths: string[];
  baseUrl: string | null;
  paths: JsonObject;
}

function resolveExtendedConfigPath(configPath: string, value: string): string {
  if (!value.startsWith('.') && !path.isAbsolute(value)) {
    throw new Error('implementation_readiness_config_extends_external');
  }
  const base = path.resolve(path.dirname(configPath), value);
  const candidates = [base, `${base}.json`, path.join(base, 'tsconfig.json')];
  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
  if (!resolved) throw new Error('implementation_readiness_config_extends_missing');
  return resolved;
}

function loadTsConfig(configPath: string, seen = new Set<string>()): ResolvedTsConfig {
  const absolute = path.resolve(configPath);
  if (seen.has(absolute)) throw new Error('implementation_readiness_config_extends_cycle');
  seen.add(absolute);
  const config = parseJsonConfig(absolute);
  const extensionValues = Array.isArray(config.extends)
    ? config.extends.filter((value): value is string => typeof value === 'string')
    : typeof config.extends === 'string'
      ? [config.extends]
      : [];
  let inherited: ResolvedTsConfig = { configPaths: [], baseUrl: null, paths: {} };
  for (const extension of extensionValues) {
    const parent = loadTsConfig(resolveExtendedConfigPath(absolute, extension), seen);
    inherited = {
      configPaths: [...inherited.configPaths, ...parent.configPaths],
      baseUrl: parent.baseUrl ?? inherited.baseUrl,
      paths: { ...inherited.paths, ...parent.paths },
    };
  }
  const compilerOptions = object(config.compilerOptions);
  const configuredBaseUrl = text(compilerOptions.baseUrl);
  const ownPaths = object(compilerOptions.paths);
  return {
    configPaths: sortedUnique([...inherited.configPaths, absolute]),
    baseUrl: configuredBaseUrl
      ? path.resolve(path.dirname(absolute), configuredBaseUrl)
      : inherited.baseUrl,
    paths: Object.keys(ownPaths).length > 0 ? ownPaths : inherited.paths,
  };
}

function resolveTsConfigAlias(
  projectRoot: string,
  importerPath: string,
  specifier: string
): {
  matched: boolean;
  resolved: string | null;
  configPaths: string[];
} {
  let current = path.dirname(importerPath);
  const root = path.resolve(projectRoot);
  while (current === root || current.startsWith(`${root}${path.sep}`)) {
    const configPath = ['tsconfig.json', 'jsconfig.json']
      .map((name) => path.join(current, name))
      .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (configPath) {
      let config: ResolvedTsConfig;
      try {
        config = loadTsConfig(configPath);
      } catch {
        throw new Error(
          `implementation_readiness_config_invalid:${projectRelative(root, configPath)}`
        );
      }
      const baseUrl = config.baseUrl ?? path.dirname(configPath);
      const orderedPathMappings = Object.entries(config.paths).sort(([left], [right]) => {
        const leftStar = left.indexOf('*');
        const rightStar = right.indexOf('*');
        const leftExact = leftStar < 0;
        const rightExact = rightStar < 0;
        if (leftExact !== rightExact) return leftExact ? -1 : 1;
        const leftPrefixLength = leftExact ? left.length : leftStar;
        const rightPrefixLength = rightExact ? right.length : rightStar;
        if (leftPrefixLength !== rightPrefixLength) return rightPrefixLength - leftPrefixLength;
        const leftSuffixLength = leftExact ? 0 : left.length - leftStar - 1;
        const rightSuffixLength = rightExact ? 0 : right.length - rightStar - 1;
        if (leftSuffixLength !== rightSuffixLength) return rightSuffixLength - leftSuffixLength;
        return left < right ? -1 : left > right ? 1 : 0;
      });
      for (const [pattern, targets] of orderedPathMappings) {
        const star = pattern.indexOf('*');
        const matches =
          star < 0
            ? specifier === pattern
              ? ''
              : null
            : specifier.startsWith(pattern.slice(0, star)) &&
                specifier.endsWith(pattern.slice(star + 1))
              ? specifier.slice(star, specifier.length - (pattern.length - star - 1) || undefined)
              : null;
        if (matches === null) continue;
        const targetList = Array.isArray(targets)
          ? targets.filter((value) => typeof value === 'string')
          : [];
        for (const target of targetList) {
          const candidate = target.replace('*', matches);
          const resolved = moduleCandidates(path.resolve(baseUrl, candidate)).find(
            (entry) => fs.existsSync(entry) && fs.statSync(entry).isFile()
          );
          if (resolved) return { matched: true, resolved, configPaths: config.configPaths };
        }
        return { matched: true, resolved: null, configPaths: config.configPaths };
      }
      if (config.baseUrl) {
        const resolved = moduleCandidates(path.resolve(config.baseUrl, specifier)).find(
          (entry) => fs.existsSync(entry) && fs.statSync(entry).isFile()
        );
        return { matched: true, resolved: resolved ?? null, configPaths: config.configPaths };
      }
    }
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current || (parent !== root && !parent.startsWith(`${root}${path.sep}`))) break;
    current = parent;
  }
  return { matched: false, resolved: null, configPaths: [] };
}

function resolveLocalModule(
  projectRoot: string,
  importerPath: string,
  specifier: string,
  onConfig?: (configPath: string) => void,
  resolutionChain = new Set<string>()
): string[] {
  const resolutionKey = `${path.resolve(importerPath)}\0${specifier}`;
  if (resolutionChain.has(resolutionKey)) {
    throw new Error(`implementation_readiness_module_resolution_cycle:${specifier}`);
  }
  const nextResolutionChain = new Set(resolutionChain);
  nextResolutionChain.add(resolutionKey);
  const isRelative = specifier.startsWith('.') || specifier.startsWith('file:');
  if (!isRelative) {
    let requireResolved: string | null = null;
    let requireResolutionSucceeded = false;
    try {
      const resolved = createRequire(importerPath).resolve(specifier);
      requireResolutionSucceeded = true;
      if (
        path.isAbsolute(resolved) &&
        resolved.startsWith(`${path.resolve(projectRoot)}${path.sep}`)
      ) {
        requireResolved = confinedFile(projectRoot, projectRelative(projectRoot, resolved));
      }
    } catch {
      requireResolved = null;
    }
    const packageExportFiles = localPackageExportFiles({
      projectRoot,
      importerPath,
      specifier,
      resolvedModulePath: requireResolved,
      onConfig,
    });
    const packageImportFiles = localPackageImportFiles({
      projectRoot,
      importerPath,
      specifier,
      resolutionChain: nextResolutionChain,
      onConfig,
    });
    const resolvedBareModules = sortedUnique([
      ...(requireResolved ? [requireResolved] : []),
      ...packageExportFiles,
      ...packageImportFiles,
    ]);
    if (resolvedBareModules.length > 0) return resolvedBareModules;
    if (requireResolutionSucceeded) return [];
    const alias = resolveTsConfigAlias(projectRoot, importerPath, specifier);
    alias.configPaths.forEach((configPath) => onConfig?.(configPath));
    if (alias.resolved) {
      return [confinedFile(projectRoot, projectRelative(projectRoot, alias.resolved))];
    }
    throw new Error(`implementation_readiness_input_missing:${specifier}`);
  }
  const base = path.resolve(
    path.dirname(importerPath),
    specifier.startsWith('file:') ? fileURLToPath(specifier) : specifier
  );
  const candidates = [...moduleCandidates(base)];
  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
  if (!resolved) {
    throw new Error(`implementation_readiness_input_missing:${specifier}`);
  }
  return [confinedFile(projectRoot, projectRelative(projectRoot, resolved))];
}

export function parseReadinessCommandInvocation(invocation: string): {
  executable: string;
  args: string[];
  normalizedInvocation: string;
  normalizedCommandHash: string;
} {
  if (!invocation || SHELL_SYNTAX.test(invocation)) {
    throw new Error('implementation_readiness_shell_syntax_forbidden');
  }
  const tokens: string[] = [];
  let current = '';
  let quote = '';
  for (const character of invocation.trim()) {
    if (quote) {
      if (character === quote) quote = '';
      else current += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/u.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += character;
    }
  }
  if (quote) throw new Error('implementation_readiness_command_quote_unclosed');
  if (current) tokens.push(current);
  const executable = text(tokens.shift());
  if (!ALLOWED_EXECUTABLES.has(executable.toLowerCase())) {
    throw new Error(`implementation_readiness_executable_unsupported:${executable}`);
  }
  if (executable.toLowerCase() === 'npx' && tokens[0]?.startsWith('-')) {
    throw new Error('implementation_readiness_npx_wrapper_prefix_forbidden');
  }
  const normalizedInvocation = [executable.toLowerCase(), ...tokens].join('\u0000');
  return {
    executable: executable.toLowerCase(),
    args: tokens,
    normalizedInvocation,
    normalizedCommandHash: requirementsContractDomainHash(
      'implementation-readiness-command/v1',
      normalizedInvocation
    ),
  };
}

function semanticOracleMap(context: ArchitectureConfirmationContext): Map<string, string> {
  const semantics = object(context.semanticIr.semanticPayload.semantics);
  const entries = [...objects(semantics.requirements), ...objects(semantics.atoms)];
  return new Map(
    entries
      .map((entry) => [text(entry.id), text(entry.oracle) || text(entry.signature)] as const)
      .filter(([id, oracle]) => Boolean(id && oracle))
  );
}

function normalizedCommandsFor(
  context: ArchitectureConfirmationContext,
  candidate: ArchitectureConfirmationCandidate
): NormalizedCommand[] {
  const oracleMap = semanticOracleMap(context);
  const toolchain = object(candidate.toolchain);
  const byHash = new Map<string, NormalizedCommand>();
  for (const rawCommand of objects(toolchain.commands)) {
    const commandId = text(rawCommand.commandId);
    const parsed = parseReadinessCommandInvocation(text(rawCommand.invocation));
    const constraint = context.semanticIr.semanticPayload.executionConstraints.find(
      (entry) => entry.constraintId === commandId
    );
    const signatures = constraint
      ? sortedUnique([
          ...constraint.applicableMustRefs.map((id) => oracleMap.get(id) ?? ''),
          ...constraint.applicableAtomRefs.map((id) => oracleMap.get(id) ?? ''),
        ])
      : [];
    if (!commandId || signatures.length === 0) {
      throw new Error(`implementation_readiness_oracle_missing:${commandId}`);
    }
    const current = byHash.get(parsed.normalizedCommandHash);
    if (current) {
      current.commandIds = sortedUnique([...current.commandIds, commandId]);
      current.expectedTestIds = sortedUnique([...current.expectedTestIds, commandId]);
      current.expectedFailureSignatures = sortedUnique([
        ...current.expectedFailureSignatures,
        ...signatures,
      ]);
    } else {
      byHash.set(parsed.normalizedCommandHash, {
        ...parsed,
        commandIds: [commandId],
        expectedTestIds: [commandId],
        expectedFailureSignatures: signatures,
      });
    }
  }
  if (byHash.size === 0) throw new Error('implementation_readiness_command_missing');
  return [...byHash.values()].sort((left, right) =>
    left.normalizedCommandHash.localeCompare(right.normalizedCommandHash)
  );
}

function logicalInputPath(token: string): string | null {
  const normalized = token.replace(/\\/gu, '/');
  if (
    normalized.startsWith('-') ||
    path.isAbsolute(normalized) ||
    normalized.toLowerCase() === 'test'
  ) {
    return null;
  }
  if (/(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|(?:test|spec)\.[^.]+$/iu.test(normalized)) {
    return normalized;
  }
  return null;
}

function nodeArgs(command: NormalizedCommand): string[] | null {
  if (command.executable === 'node') return command.args;
  if (command.executable !== 'npx') return null;
  if (command.args[0]?.toLowerCase() === 'node') return command.args.slice(1);
  if (command.args.some((argument) => argument.toLowerCase() === 'node')) {
    throw new Error('implementation_readiness_npx_wrapper_prefix_forbidden');
  }
  return null;
}

function localNodeInputPath(
  projectRoot: string,
  specifier: string,
  failClosed: boolean
): string | null {
  if (/^(?:node:|data:|https?:)/iu.test(specifier)) return null;
  let absolute: string;
  try {
    absolute = specifier.startsWith('file:')
      ? fileURLToPath(specifier)
      : path.resolve(projectRoot, specifier);
  } catch {
    throw new Error(`implementation_readiness_input_missing:${specifier}`);
  }
  const relative = path.relative(projectRoot, absolute).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('implementation_readiness_physical_path_forbidden');
  }
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return relative;
  const localLooking =
    specifier.startsWith('.') ||
    specifier.startsWith('file:') ||
    /\\/u.test(specifier) ||
    /\.(?:c?js|mjs|json|node|tsx?|cts|mts|ya?ml|toml|env)$/iu.test(specifier);
  return failClosed || localLooking ? relative : null;
}

function collectNodeRuntimeInputs(
  command: NormalizedCommand,
  projectRoot: string,
  add: (role: InputArtifact['role'], logicalPath: string) => void
): void {
  const args = nodeArgs(command);
  if (!args) return;
  let testMode = false;
  let entryDisabled = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      if (!testMode && !entryDisabled && args[index + 1]) add('config', args[index + 1]);
      return;
    }
    const equalsIndex = argument.indexOf('=');
    const option = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument;
    const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : '';
    if (NODE_MODULE_INPUT_OPTIONS.has(option) || NODE_FILE_INPUT_OPTIONS.has(option)) {
      const value = inlineValue || args[index + 1];
      if (!value) throw new Error(`implementation_readiness_input_missing:${option}`);
      const logicalPath = localNodeInputPath(
        projectRoot,
        value,
        NODE_FILE_INPUT_OPTIONS.has(option)
      );
      if (logicalPath) add('config', logicalPath);
      if (!inlineValue) index += 1;
      continue;
    }
    if (/^-r.+/u.test(argument)) {
      const logicalPath = localNodeInputPath(projectRoot, argument.slice(2), false);
      if (logicalPath) add('config', logicalPath);
      continue;
    }
    if (argument === '--test' || argument.startsWith('--test=')) {
      testMode = true;
      continue;
    }
    if (['--eval', '-e', '--print', '-p', '--check', '-c'].includes(option)) {
      entryDisabled = true;
      if (!inlineValue && !['--check', '-c'].includes(option)) index += 1;
      continue;
    }
    if (NODE_VALUE_OPTIONS.has(option)) {
      if (!inlineValue) index += 1;
      continue;
    }
    if (argument.startsWith('-')) continue;
    if (!testMode && !entryDisabled) add('config', argument);
    return;
  }
}

function changesCommandScope(command: NormalizedCommand): boolean {
  const nestedNode = nodeArgs(command) !== null;
  return command.args.some((argument) => {
    if (
      /^(?:--prefix|--workspace|--workspaces|--filter|--cwd|--dir|--recursive)(?:=|$)/u.test(
        argument
      )
    ) {
      return true;
    }
    return !nestedNode && /^(?:-w|-C|-r)(?:=|$)/u.test(argument);
  });
}

function collectInputArtifacts(
  context: ArchitectureConfirmationContext,
  candidate: ArchitectureConfirmationCandidate,
  commands: NormalizedCommand[]
): InputArtifact[] {
  const byId = new Map<string, InputArtifact>();
  const add = (role: InputArtifact['role'], logicalPath: string): string => {
    const absolute = confinedFile(context.projectRoot, logicalPath);
    const normalized = projectRelative(context.projectRoot, absolute);
    const artifactId = `${role}:${normalized}`;
    byId.set(artifactId, {
      role,
      artifactId,
      logicalPath: normalized,
      bytesHash: sha256Bytes(fs.readFileSync(absolute)),
    });
    return normalized;
  };
  const dependencySeeds = new Map<
    string,
    {
      role: InputArtifact['role'];
      logicalPath: string;
      allowBunBuiltins: boolean;
    }
  >();
  const addDependencySeed = (
    role: InputArtifact['role'],
    logicalPath: string,
    allowBunBuiltins: boolean
  ): void => {
    const normalized = add(role, logicalPath);
    dependencySeeds.set(`${role}:${normalized}:${allowBunBuiltins ? 'bun' : 'default'}`, {
      role,
      logicalPath: normalized,
      allowBunBuiltins,
    });
  };
  const scope = object(candidate.logicalScope);
  for (const target of Array.isArray(scope.targetPaths) ? scope.targetPaths.map(String) : []) {
    add('pre_implementation_target', target);
  }
  for (const command of commands) {
    if (changesCommandScope(command)) {
      throw new Error('implementation_readiness_command_scope_unclosed');
    }
    const allowBunBuiltins = command.executable === 'bun';
    collectNodeRuntimeInputs(command, context.projectRoot, (role, logicalPath) =>
      addDependencySeed(role, logicalPath, allowBunBuiltins)
    );
    for (const argument of command.args) {
      const equalsConfig = /^--config=(.+)$/u.exec(argument);
      if (equalsConfig) addDependencySeed('config', equalsConfig[1], allowBunBuiltins);
      const testPath = logicalInputPath(argument);
      if (testPath) addDependencySeed('test', testPath, allowBunBuiltins);
    }
    for (let index = 0; index < command.args.length - 1; index += 1) {
      if (command.args[index] === '--config' || command.args[index] === '-c') {
        addDependencySeed('config', command.args[index + 1], allowBunBuiltins);
      }
    }
  }
  const packageJson = path.join(context.projectRoot, 'package.json');
  if (fs.existsSync(packageJson)) add('config', 'package.json');
  for (const configName of ['tsconfig.json', 'jsconfig.json']) {
    if (fs.existsSync(path.join(context.projectRoot, configName))) add('config', configName);
  }
  for (const lockName of LOCK_NAMES) {
    if (fs.existsSync(path.join(context.projectRoot, lockName))) add('lock', lockName);
  }
  const knownPaths = new Set([...byId.values()].map((artifact) => artifact.logicalPath));
  const dependencyQueue = [...dependencySeeds.values()].map((seed) => ({
    role: seed.role,
    absolutePath: confinedFile(context.projectRoot, seed.logicalPath),
    allowBunBuiltins: seed.allowBunBuiltins,
  }));
  const traversed = new Set<string>();
  while (dependencyQueue.length > 0) {
    const current = dependencyQueue.shift()!;
    const traversalKey = `${current.role}:${current.absolutePath}:${current.allowBunBuiltins ? 'bun' : 'default'}`;
    if (traversed.has(traversalKey)) continue;
    traversed.add(traversalKey);
    for (const specifier of localModuleSpecifiers(current.absolutePath, current.allowBunBuiltins)) {
      const dependencyPaths = resolveLocalModule(
        context.projectRoot,
        current.absolutePath,
        specifier,
        (configPath) => {
          const logicalPath = projectRelative(context.projectRoot, configPath);
          if (!knownPaths.has(logicalPath)) {
            add('config', logicalPath);
            knownPaths.add(logicalPath);
          }
        }
      );
      for (const dependencyPath of dependencyPaths) {
        const logicalPath = projectRelative(context.projectRoot, dependencyPath);
        if (!knownPaths.has(logicalPath)) {
          add(current.role, logicalPath);
          knownPaths.add(logicalPath);
        }
        dependencyQueue.push({
          role: current.role,
          absolutePath: dependencyPath,
          allowBunBuiltins: current.allowBunBuiltins,
        });
      }
    }
  }
  if (![...byId.values()].some((entry) => entry.role === 'test')) {
    throw new Error('implementation_readiness_test_input_missing');
  }
  return [...byId.values()].sort((left, right) =>
    `${left.role}:${left.artifactId}`.localeCompare(`${right.role}:${right.artifactId}`)
  );
}

function scopedInputDigest(input: {
  context: ArchitectureConfirmationContext;
  candidate: ArchitectureConfirmationCandidate;
  commands: NormalizedCommand[];
  inputArtifacts: InputArtifact[];
}): string {
  return requirementsContractDomainHash('implementation-readiness-scoped-input/v1', {
    requirementsSemanticIdentity: {
      semanticRevisionId: input.context.semanticIr.semanticRevisionId,
      scopeSemanticHash: input.context.semanticIr.scopeSemanticHash,
      executionConstraintRegistryHash:
        input.context.semanticIr.semanticPayload.executionConstraintRegistryHash,
    },
    architectureConfirmationCandidateHash: input.candidate.architectureConfirmationCandidateHash,
    normalizedCommandIds: input.commands.map((command) => ({
      hash: command.normalizedCommandHash,
      commandIds: command.commandIds,
      testIds: command.expectedTestIds,
    })),
    readinessPolicy: POLICY,
    inputArtifacts: input.inputArtifacts.map((entry) => ({
      role: entry.role,
      artifactId: entry.artifactId,
      bytesHash: entry.bytesHash,
    })),
  });
}

export function computeCurrentReadinessScopedInputDigest(input: {
  context: ArchitectureConfirmationContext;
  architectureCandidate: ArchitectureConfirmationCandidate;
}): string {
  const commands = normalizedCommandsFor(input.context, input.architectureCandidate);
  const inputArtifacts = collectInputArtifacts(
    input.context,
    input.architectureCandidate,
    commands
  );
  return scopedInputDigest({
    context: input.context,
    candidate: input.architectureCandidate,
    commands,
    inputArtifacts,
  });
}

function assertReadinessCurrent(input: {
  projectRoot: string;
  requestId: string;
  context: ArchitectureConfirmationContext;
  architectureCandidate: ArchitectureConfirmationCandidate;
  commands: NormalizedCommand[];
  inputArtifacts: InputArtifact[];
  digest: string;
  executionCount: number;
}): void {
  const currentContext = resolveArchitectureConfirmationContext({
    projectRoot: input.projectRoot,
    requestId: input.requestId,
  });
  if (
    currentContext.semanticIr.semanticRevisionId !== input.context.semanticIr.semanticRevisionId ||
    currentContext.semanticIr.scopeSemanticHash !== input.context.semanticIr.scopeSemanticHash ||
    currentContext.semanticIr.semanticPayload.executionConstraintRegistryHash !==
      input.context.semanticIr.semanticPayload.executionConstraintRegistryHash
  ) {
    throw new ImplementationReadinessBlock(
      'requirements_successor_required:semantic_authority',
      input.executionCount
    );
  }
  const currentArchitecture = deriveArchitectureConfirmationCandidate(currentContext);
  if (
    currentArchitecture.architectureConfirmationCandidateHash !==
    input.architectureCandidate.architectureConfirmationCandidateHash
  ) {
    throw new ImplementationReadinessBlock(
      'architecture_successor_required:toolchain',
      input.executionCount
    );
  }
  if (
    !readCurrentArchitectureConfirmationAcceptance({
      context: currentContext,
      candidate: currentArchitecture,
    })
  ) {
    throw new ImplementationReadinessBlock(
      'architecture_confirmation_required',
      input.executionCount
    );
  }
  const currentCommands = normalizedCommandsFor(currentContext, currentArchitecture);
  const currentInputArtifacts = collectInputArtifacts(
    currentContext,
    currentArchitecture,
    currentCommands
  );
  const currentDigest = scopedInputDigest({
    context: currentContext,
    candidate: currentArchitecture,
    commands: currentCommands,
    inputArtifacts: currentInputArtifacts,
  });
  if (
    currentDigest !== input.digest ||
    canonicalRequirementsJson(currentCommands) !== canonicalRequirementsJson(input.commands) ||
    canonicalRequirementsJson(currentInputArtifacts) !==
      canonicalRequirementsJson(input.inputArtifacts)
  ) {
    throw new ImplementationReadinessBlock(
      'readiness_recheck_required:scoped_input_digest',
      input.executionCount
    );
  }
}

function readinessSpawn(command: NormalizedCommand): { executable: string; args: string[] } | null {
  if (command.executable === 'node') {
    return { executable: process.execPath, args: command.args };
  }
  if (command.executable === 'npx' && command.args[0]?.toLowerCase() === 'node') {
    return { executable: process.execPath, args: command.args.slice(1) };
  }
  if (process.platform !== 'win32') {
    return { executable: command.executable, args: command.args };
  }
  if (command.executable === 'bun') {
    return { executable: 'bun.exe', args: command.args };
  }
  const nodeRoot = path.dirname(process.execPath);
  if (command.executable === 'npm' || command.executable === 'npx') {
    const cliPath = path.join(
      nodeRoot,
      'node_modules',
      'npm',
      'bin',
      `${command.executable}-cli.js`
    );
    return fs.existsSync(cliPath)
      ? { executable: process.execPath, args: [cliPath, ...command.args] }
      : null;
  }
  const corepackPath = path.join(nodeRoot, 'node_modules', 'corepack', 'dist', 'corepack.js');
  return fs.existsSync(corepackPath)
    ? { executable: process.execPath, args: [corepackPath, command.executable, ...command.args] }
    : null;
}

function readinessEnvironment(
  projectRoot: string,
  runtimeHome: string,
  runtimeTemp: string
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    CI: '1',
    NODE_ENV: 'test',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    PATH: [path.join(projectRoot, 'node_modules', '.bin'), path.dirname(process.execPath)].join(
      path.delimiter
    ),
    ...(process.platform === 'win32' ? { PATHEXT: '.COM;.EXE;.BAT;.CMD' } : {}),
    HOME: runtimeHome,
    USERPROFILE: runtimeHome,
    APPDATA: path.join(runtimeHome, 'appdata'),
    LOCALAPPDATA: path.join(runtimeHome, 'local-appdata'),
    TEMP: runtimeTemp,
    TMP: runtimeTemp,
    TMPDIR: runtimeTemp,
    npm_config_audit: 'false',
    npm_config_cache: path.join(runtimeHome, 'npm-cache'),
    npm_config_fund: 'false',
    npm_config_globalconfig: path.join(runtimeHome, 'global-npmrc-disabled'),
    npm_config_offline: 'true',
    npm_config_update_notifier: 'false',
    npm_config_userconfig: path.join(runtimeHome, 'user-npmrc-disabled'),
  };
  for (const key of READINESS_OPERATIONAL_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  return environment;
}

export function runReadinessCommand(
  command: NormalizedCommand,
  projectRoot: string
): ReadinessCommandRun {
  const invocation = readinessSpawn(command);
  if (!invocation) {
    return {
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
      errorCode: `${command.executable}_js_cli_missing`,
    };
  }
  const runtimeRoot = fs.mkdtempSync(path.join(READINESS_RUNTIME_BASE, 'bmad-readiness-'));
  const runtimeHome = path.join(runtimeRoot, 'home');
  const runtimeTemp = path.join(runtimeRoot, 'tmp');
  fs.mkdirSync(path.join(runtimeHome, 'appdata'), { recursive: true });
  fs.mkdirSync(path.join(runtimeHome, 'local-appdata'), { recursive: true });
  fs.mkdirSync(path.join(runtimeHome, 'npm-cache'), { recursive: true });
  fs.mkdirSync(runtimeTemp, { recursive: true });
  fs.writeFileSync(path.join(runtimeHome, 'global-npmrc-disabled'), '', 'utf8');
  fs.writeFileSync(path.join(runtimeHome, 'user-npmrc-disabled'), '', 'utf8');
  try {
    const result = spawnSync(invocation.executable, invocation.args, {
      cwd: projectRoot,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: POLICY.timeoutMs,
      maxBuffer: POLICY.maxOutputBytes,
      env: readinessEnvironment(projectRoot, runtimeHome, runtimeTemp),
    });
    return {
      status: result.status,
      signal: result.signal,
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      ...(result.error
        ? { errorCode: (result.error as NodeJS.ErrnoException).code ?? 'spawn_error' }
        : {}),
    };
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

interface TapFailure {
  name: string;
  diagnostics: string;
}

function tapFailures(output: string): TapFailure[] {
  const lines = output.split(/\r?\n/u);
  const failures: TapFailure[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const failure = /^(\s*)not ok\s+\d+\s+-\s+(.+?)\s*$/u.exec(lines[index]);
    if (!failure) continue;
    const failureIndent = failure[1].length;
    let boundary = index + 1;
    for (; boundary < lines.length; boundary += 1) {
      const next = /^(\s*)((?:not )?ok\s+\d+\s+-|1\.\.)/u.exec(lines[boundary]);
      if (next && next[1].length <= failureIndent) break;
    }
    const body = lines.slice(index + 1, boundary);
    const diagnosticStart = body.findIndex((line) => /^\s+---\s*$/u.test(line));
    const diagnosticEnd =
      diagnosticStart < 0
        ? -1
        : body.findIndex(
            (line, bodyIndex) => bodyIndex > diagnosticStart && /^\s+\.\.\.\s*$/u.test(line)
          );
    failures.push({
      name: failure[2],
      diagnostics:
        diagnosticStart >= 0 && diagnosticEnd > diagnosticStart
          ? body.slice(diagnosticStart + 1, diagnosticEnd).join('\n')
          : '',
    });
    index = boundary - 1;
  }
  return failures;
}

function containsExactIdentity(value: string, identity: string): boolean {
  let offset = value.indexOf(identity);
  while (offset >= 0) {
    const before = value[offset - 1];
    const after = value[offset + identity.length];
    const isIdentityCharacter = (character: string | undefined) =>
      Boolean(character && /[A-Za-z0-9._:-]/u.test(character));
    if (!isIdentityCharacter(before) && !isIdentityCharacter(after)) return true;
    offset = value.indexOf(identity, offset + identity.length);
  }
  return false;
}

function runAndValidate(
  command: NormalizedCommand,
  projectRoot: string,
  runCommand: (command: NormalizedCommand, projectRoot: string) => ReadinessCommandRun,
  executionCount: number
): { outcome: Omit<ReadinessOutcome, 'rawLogRef'>; log: string } {
  const result = runCommand(command, projectRoot);
  const output = `${result.stdout}\n${result.stderr}`;
  const fail = (issueCode: string): never => {
    throw new ImplementationReadinessFailure(issueCode, executionCount);
  };
  if (result.errorCode || result.signal || result.status === null) {
    fail(
      `implementation_readiness_runner_failed:${command.commandIds[0]}:${result.errorCode ?? result.signal ?? 'unknown'}`
    );
  }
  if (Buffer.byteLength(output, 'utf8') > POLICY.maxOutputBytes) {
    fail(`implementation_readiness_output_bound_exceeded:${command.commandIds[0]}`);
  }
  if (INFRA_FAILURE.test(output)) {
    fail(`implementation_readiness_environment_failure:${command.commandIds[0]}`);
  }
  const failures = tapFailures(output);
  if (result.status === 0) {
    throw new ImplementationReadinessBlock(
      `red_proof_not_observed:${command.commandIds[0]}`,
      executionCount
    );
  }
  if (result.status !== 1 || failures.length === 0) {
    fail(`implementation_readiness_red_output_invalid:${command.commandIds[0]}`);
  }
  const failedTestIds = command.expectedTestIds.filter((id) =>
    failures.some((failure) => containsExactIdentity(failure.name, id))
  );
  const unrelatedFailureIds = failures.filter(
    (failure) => !command.expectedTestIds.some((id) => containsExactIdentity(failure.name, id))
  );
  const expectedFailureSignaturesObserved = command.expectedFailureSignatures.filter((signature) =>
    failures.some(
      (failure) =>
        command.expectedTestIds.some((id) => containsExactIdentity(failure.name, id)) &&
        failure.diagnostics.includes(signature)
    )
  );
  if (
    failedTestIds.length !== command.expectedTestIds.length ||
    unrelatedFailureIds.length > 0 ||
    expectedFailureSignaturesObserved.length !== command.expectedFailureSignatures.length
  ) {
    fail(`implementation_readiness_red_identity_invalid:${command.commandIds[0]}`);
  }
  return {
    outcome: {
      normalizedCommandHash: command.normalizedCommandHash,
      commandIds: command.commandIds,
      status: 'expected_red_observed',
      exitCode: result.status,
      failedTestIds: sortedUnique(failedTestIds),
      expectedFailureSignaturesObserved,
      unrelatedFailureIds: unrelatedFailureIds.map((failure) => failure.name),
      negativeControl: {
        runnerCompleted: true,
        tapFailuresObserved: true,
        noUnrelatedFailures: unrelatedFailureIds.length === 0,
        environmentFailure: false,
      },
    },
    log: JSON.stringify(
      {
        schemaVersion: 'implementation-readiness-raw-log/v1',
        commandIds: command.commandIds,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.status,
      },
      null,
      2
    ),
  };
}

function candidateHashPayload(candidate: ReadinessCandidate): JsonObject {
  return {
    schemaVersion: candidate.schemaVersion,
    requestId: candidate.requestId,
    requirementsLineage: candidate.requirementsLineage,
    architectureConfirmationCandidateHash: candidate.architectureConfirmationCandidateHash,
    readinessScopedInputDigest: candidate.readinessScopedInputDigest,
    readinessPolicy: candidate.readinessPolicy,
    normalizedCommands: candidate.normalizedCommands,
    inputArtifacts: candidate.inputArtifacts,
    redOutcomes: candidate.redOutcomes.map((outcome) => {
      const { rawLogRef: _rawLogRef, ...stableOutcome } = outcome;
      return stableOutcome;
    }),
  };
}

export function implementationReadinessCandidateHash(candidate: JsonObject): string {
  return requirementsContractDomainHash(
    'implementation-readiness-candidate/v1',
    candidateHashPayload(candidate as ReadinessCandidate)
  );
}

function candidateRef(projectRoot: string, candidatePath: string, bytes: Buffer) {
  return {
    path: projectRelative(projectRoot, candidatePath),
    artifactBytesHash: artifactBytesHash({
      role: 'implementation_readiness_candidate',
      mediaType: 'application/json',
      bytes,
    }),
  };
}

function readinessCandidateValidator(): (value: unknown) => boolean {
  if (!validateReadinessCandidate) {
    const schemaPath = path.resolve(__dirname, '..', 'schemas', READINESS_CANDIDATE_SCHEMA);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
    validateReadinessCandidate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  }
  return validateReadinessCandidate;
}

function validateReadinessCandidateObject(value: unknown): asserts value is ReadinessCandidate {
  if (!readinessCandidateValidator()(value)) {
    throw new Error('implementation_readiness_published_candidate_invalid');
  }
}

export function verifyImplementationReadinessCandidateArtifact(input: {
  projectRoot: string;
  recordRoot: string;
  candidatePath: string;
  expectedArtifactBytesHash?: string;
}): {
  candidate: ReadinessCandidate;
  candidateRef: { path: string; artifactBytesHash: string };
} {
  const relative = path.relative(path.resolve(input.recordRoot), path.resolve(input.candidatePath));
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !fs.existsSync(input.candidatePath)
  ) {
    throw new Error('implementation_readiness_published_candidate_invalid');
  }
  const candidateBytes = fs.readFileSync(input.candidatePath);
  let candidateValue: unknown;
  try {
    candidateValue = JSON.parse(candidateBytes.toString('utf8')) as unknown;
  } catch {
    throw new Error('implementation_readiness_published_candidate_invalid');
  }
  validateReadinessCandidateObject(candidateValue);
  if (
    candidateValue.schemaVersion !== 'ImplementationReadinessCandidate/v1' ||
    implementationReadinessCandidateHash(candidateValue) !==
      candidateValue.implementationReadinessCandidateHash ||
    !candidateBytes.equals(Buffer.from(`${canonicalRequirementsJson(candidateValue)}\n`, 'utf8'))
  ) {
    throw new Error('implementation_readiness_published_candidate_invalid');
  }
  const artifactRef = candidateRef(input.projectRoot, input.candidatePath, candidateBytes);
  if (
    input.expectedArtifactBytesHash &&
    artifactRef.artifactBytesHash !== input.expectedArtifactBytesHash
  ) {
    throw new Error('implementation_readiness_published_candidate_invalid');
  }
  for (const outcome of candidateValue.redOutcomes) {
    const logPath = path.resolve(input.recordRoot, outcome.rawLogRef.path);
    const logRelative = path.relative(input.recordRoot, logPath);
    if (
      logRelative.startsWith('..') ||
      path.isAbsolute(logRelative) ||
      !fs.existsSync(logPath) ||
      artifactBytesHash({
        role: 'implementation_readiness_raw_log',
        mediaType: 'application/json',
        bytes: fs.readFileSync(logPath),
      }) !== outcome.rawLogRef.artifactBytesHash
    ) {
      throw new Error('implementation_readiness_published_log_invalid');
    }
  }
  return { candidate: candidateValue, candidateRef: artifactRef };
}

function readValidReadinessRuntimeRecord(
  context: ArchitectureConfirmationContext,
  architectureConfirmationCandidateHash: string
): { runtimeRecordPath: string; record: JsonObject } {
  const runtimeRecordPath = path.join(context.recordRoot, 'requirement-record.json');
  if (!fs.existsSync(runtimeRecordPath)) {
    throw new Error('implementation_readiness_runtime_record_missing');
  }
  const record = JSON.parse(fs.readFileSync(runtimeRecordPath, 'utf8')) as JsonObject;
  const currentAttemptId = text(record.currentAttemptId);
  const prerequisites = (['requirement_confirmation', 'architecture_confirmation'] as const).map(
    (modelId) =>
      resolveVerifiedSixModelStatus({
        record,
        modelId,
        currentImplementationAttemptId: currentAttemptId,
      })
  );
  const architectureProjection = object(object(record.sixModelResults).architecture_confirmation);
  if (
    text(record.semanticModelHash) !== context.semanticIr.scopeSemanticHash ||
    prerequisites.some((status) => status.effectiveStatus !== 'pass') ||
    text(object(architectureProjection.currentHashes).architectureConfirmationCandidateHash) !==
      architectureConfirmationCandidateHash
  ) {
    throw new Error('implementation_readiness_runtime_prerequisite_invalid');
  }
  return { runtimeRecordPath, record };
}

function readinessRuntimePublication(input: {
  context: ArchitectureConfirmationContext;
  candidate: ReadinessCandidate;
  receiptPath: string;
  receipt: JsonObject;
}): {
  runtimeRecordPath: string;
  record: JsonObject;
  runtimeStatus: RuntimeStatusProjectionUpdate;
} {
  const { runtimeRecordPath, record } = readValidReadinessRuntimeRecord(
    input.context,
    input.candidate.architectureConfirmationCandidateHash
  );
  const projection = {
    payloadKind: 'model_result',
    model: 'implementation_readiness',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    sourceDocumentHash: input.context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: input.context.semanticIr.scopeSemanticHash,
    status: 'pass',
    resultRecordedAt: text(input.receipt.createdAt) || new Date().toISOString(),
    resultRecordedBy: 'implementation-readiness-gate',
    blockingReasons: [],
    sourceRefs: [
      {
        sourceType: 'implementation_readiness_candidate',
        id: input.candidate.implementationReadinessCandidateHash,
      },
    ],
    currentHashes: {
      semanticModelHash: input.context.semanticIr.scopeSemanticHash,
      architectureConfirmationCandidateHash: input.candidate.architectureConfirmationCandidateHash,
      readinessScopedInputDigest: input.candidate.readinessScopedInputDigest,
      implementationReadinessCandidateHash: input.candidate.implementationReadinessCandidateHash,
    },
    currentAttemptId: text(input.receipt.implementationAttemptId),
    semanticModelHash: text(input.receipt.semanticModelHash),
    readinessScopedInputDigest: input.candidate.readinessScopedInputDigest,
    implementationReadinessCandidateHash: input.candidate.implementationReadinessCandidateHash,
    decisionReceiptRef: input.receiptPath,
    decisionReceiptHash: text(input.receipt.receiptHash),
  };
  const runtimeStatus = {
    projection,
    receiptRef: { path: input.receiptPath, receipt: input.receipt },
    authorityEstablished: true,
    missingAuthorityBindings: [],
  } satisfies RuntimeStatusProjectionUpdate;
  return { runtimeRecordPath, record, runtimeStatus };
}

function hasCommittedStaleReadinessProjection(input: {
  context: ArchitectureConfirmationContext;
  runtimeRecordPath: string;
  architectureConfirmationCandidateHash: string;
  readinessScopedInputDigest: string;
  issueCode: string;
}): boolean {
  try {
    return readControlStoreAuthoritatively(input.runtimeRecordPath, () => {
      const { record } = readValidReadinessRuntimeRecord(
        input.context,
        input.architectureConfirmationCandidateHash
      );
      const projection = object(object(record.sixModelResults).implementation_readiness);
      const currentHashes = object(projection.currentHashes);
      const blockingReasons = Array.isArray(projection.blockingReasons)
        ? projection.blockingReasons
        : [];
      return (
        text(projection.status) === 'stale' &&
        blockingReasons.length === 1 &&
        blockingReasons[0] === input.issueCode &&
        text(currentHashes.architectureConfirmationCandidateHash) ===
          input.architectureConfirmationCandidateHash &&
        (text(projection.readinessScopedInputDigest) ||
          text(currentHashes.readinessScopedInputDigest)) === input.readinessScopedInputDigest &&
        !text(projection.decisionReceiptRef) &&
        !text(projection.decisionReceiptHash) &&
        !text(projection.implementationReadinessCandidateHash)
      );
    });
  } catch {
    return false;
  }
}

function invalidateReadinessRuntimeProjection(input: {
  context: ArchitectureConfirmationContext;
  runtimeRecordPath: string;
  record: JsonObject;
  architectureConfirmationCandidateHash: string;
  readinessScopedInputDigest: string;
  recordedAt: string;
  controlStoreCommitDeps?: ControlStoreCommitDeps;
}): void {
  const issueCode = 'readiness_recheck_required:scoped_input_digest';
  const projection = {
    payloadKind: 'model_result',
    model: 'implementation_readiness',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    sourceDocumentHash: input.context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: input.context.semanticIr.scopeSemanticHash,
    status: 'stale',
    resultRecordedAt: input.recordedAt,
    resultRecordedBy: 'implementation-readiness-gate',
    blockingReasons: [issueCode],
    sourceRefs: [],
    currentHashes: {
      semanticModelHash: input.context.semanticIr.scopeSemanticHash,
      architectureConfirmationCandidateHash: input.architectureConfirmationCandidateHash,
      readinessScopedInputDigest: input.readinessScopedInputDigest,
    },
    currentAttemptId: text(input.record.currentAttemptId),
    semanticModelHash: input.context.semanticIr.scopeSemanticHash,
    readinessScopedInputDigest: input.readinessScopedInputDigest,
  };
  const runtimeStatus = {
    projection,
    receiptRef: null,
    authorityEstablished: false,
    missingAuthorityBindings: ['implementationReadinessCandidateHash'],
  } satisfies RuntimeStatusProjectionUpdate;
  try {
    appendControlEventAndReplay(
      {
        recordPath: input.runtimeRecordPath,
        writerId: 'implementation-readiness-gate-writer',
        eventType: 'implementation_readiness_result_recorded',
        recordedAt: input.recordedAt,
        expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(input.record)),
        payload: {
          eventType: 'implementation_readiness_result_recorded',
          ...projection,
        },
        reduce: (currentRecord) => ({
          ...currentRecord,
          ...runtimeStatusProjectionRecordPatch({
            record: currentRecord,
            modelId: 'implementation_readiness',
            update: runtimeStatus,
          }),
          currentMentalModel: 'implementation_readiness',
          lastEventType: 'implementation_readiness_result_recorded',
          updatedAt: input.recordedAt,
        }),
      },
      input.controlStoreCommitDeps
    );
  } catch (error) {
    if (
      !hasCommittedStaleReadinessProjection({
        context: input.context,
        runtimeRecordPath: input.runtimeRecordPath,
        architectureConfirmationCandidateHash: input.architectureConfirmationCandidateHash,
        readinessScopedInputDigest: input.readinessScopedInputDigest,
        issueCode,
      })
    ) {
      throw error;
    }
  }
}

function isPublishedReadinessRuntimeProjection(input: {
  context: ArchitectureConfirmationContext;
  candidate: ReadinessCandidate;
  receiptPath: string;
  receipt: JsonObject;
}): boolean {
  const { record } = readValidReadinessRuntimeRecord(
    input.context,
    input.candidate.architectureConfirmationCandidateHash
  );
  const currentProjection = object(object(record.sixModelResults).implementation_readiness);
  const currentStatus = resolveVerifiedSixModelStatus({
    record,
    modelId: 'implementation_readiness',
    currentImplementationAttemptId: text(record.currentAttemptId),
  });
  const currentHashes = object(currentProjection.currentHashes);
  const currentDigest =
    text(currentProjection.readinessScopedInputDigest) ||
    text(currentHashes.readinessScopedInputDigest);
  return !(
    currentStatus.effectiveStatus !== 'pass' ||
    text(object(currentProjection.currentHashes).implementationReadinessCandidateHash) !==
      input.candidate.implementationReadinessCandidateHash ||
    text(currentProjection.decisionReceiptHash) !== text(input.receipt.receiptHash) ||
    text(currentProjection.decisionReceiptRef) !== input.receiptPath ||
    currentDigest !== input.candidate.readinessScopedInputDigest
  );
}

function resultPayload(input: {
  status: ReadinessStatus;
  requestId: string;
  candidate?: ReadinessCandidate;
  candidateRef?: { path: string; artifactBytesHash: string };
  reportRef?: { path: string; artifactBytesHash: string };
  decisionReceiptRef?: { path: string; receiptHash: string };
  issueCodes: string[];
  commandExecutionCount: number;
  writeCount: number;
}): JsonObject {
  return {
    schemaVersion: 'implementation-readiness-result/v2',
    status: input.status,
    requestId: input.requestId,
    ...(input.candidate
      ? {
          requirementsLineage: input.candidate.requirementsLineage,
          architectureConfirmationCandidateHash:
            input.candidate.architectureConfirmationCandidateHash,
          readinessScopedInputDigest: input.candidate.readinessScopedInputDigest,
          implementationReadinessCandidateHash:
            input.candidate.implementationReadinessCandidateHash,
          candidateRef: input.candidateRef,
          reportRef: input.reportRef,
          decisionReceiptRef: input.decisionReceiptRef,
        }
      : {}),
    issueCodes: input.issueCodes,
    commandExecutionCount: input.commandExecutionCount,
    writeCount: input.writeCount,
  };
}

function existingBundle(
  input: ReadinessEvaluationInput,
  context: ArchitectureConfirmationContext,
  candidate: ArchitectureConfirmationCandidate,
  digest: string,
  commands: NormalizedCommand[],
  inputArtifacts: InputArtifact[]
): ExistingReadinessBundle | null {
  const recordRoot = context.recordRoot;
  const evaluationRoot = path.join(
    recordRoot,
    'record',
    'readiness',
    'evaluations',
    digest.slice('sha256:'.length)
  );
  const candidatePath = path.join(evaluationRoot, 'implementation-readiness-candidate.json');
  const reportPath = path.join(evaluationRoot, 'implementation-readiness-report.json');
  const receiptPath = path.join(evaluationRoot, 'runtime-status-decision-receipt.json');
  if (!fs.existsSync(evaluationRoot)) return null;
  const publishedFiles = [candidatePath, reportPath, receiptPath].map((artifactPath) =>
    fs.existsSync(artifactPath)
  );
  if (publishedFiles.every((exists) => !exists)) return null;
  if (publishedFiles.some((exists) => !exists)) {
    throw new Error('implementation_readiness_published_bundle_incomplete');
  }
  const verifiedCandidate = verifyImplementationReadinessCandidateArtifact({
    projectRoot: input.projectRoot,
    recordRoot,
    candidatePath,
  });
  const candidateValue = verifiedCandidate.candidate;
  if (
    candidateValue.schemaVersion !== 'ImplementationReadinessCandidate/v1' ||
    candidateValue.requestId !== input.requestId ||
    candidateValue.readinessScopedInputDigest !== digest ||
    candidateValue.architectureConfirmationCandidateHash !==
      candidate.architectureConfirmationCandidateHash ||
    canonicalRequirementsJson(candidateValue.normalizedCommands) !==
      canonicalRequirementsJson(commands) ||
    canonicalRequirementsJson(candidateValue.inputArtifacts) !==
      canonicalRequirementsJson(inputArtifacts) ||
    implementationReadinessCandidateHash(candidateValue) !==
      candidateValue.implementationReadinessCandidateHash
  ) {
    throw new Error('implementation_readiness_published_candidate_invalid');
  }
  const candidateArtifactRef = verifiedCandidate.candidateRef;
  const reportBytes = fs.readFileSync(reportPath);
  const report = JSON.parse(reportBytes.toString('utf8')) as JsonObject;
  const reportCandidateRef = object(report.candidateRef);
  const reportRelativePath = recordRelative(context.recordRoot, reportPath);
  const reportArtifactBytesHash = artifactBytesHash({
    role: 'implementation_readiness_report',
    mediaType: 'application/json',
    bytes: reportBytes,
  });
  if (
    report.schemaVersion !== 'implementation-readiness-report/v1' ||
    report.requestId !== input.requestId ||
    report.status !== 'pass' ||
    report.implementationReadinessCandidateHash !==
      candidateValue.implementationReadinessCandidateHash ||
    report.readinessScopedInputDigest !== digest ||
    !Array.isArray(report.issueCodes) ||
    report.issueCodes.length !== 0 ||
    reportCandidateRef.path !== projectRelative(input.projectRoot, candidatePath) ||
    reportCandidateRef.artifactBytesHash !== candidateArtifactRef.artifactBytesHash
  ) {
    throw new Error('implementation_readiness_published_report_invalid');
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as JsonObject;
  if (!validateRuntimeStatusDecisionReceipt(receipt)) {
    throw new Error('implementation_readiness_published_receipt_invalid');
  }
  const candidateOutputs = receipt.deterministicGateOutputs.filter(
    (binding) => binding.role === 'implementation_readiness_candidate'
  );
  const reportOutputs = receipt.deterministicGateOutputs.filter(
    (binding) => binding.role === 'implementation_readiness_report'
  );
  const candidateRelativePath = recordRelative(recordRoot, candidatePath);
  if (
    receipt.modelId !== 'implementation_readiness' ||
    receipt.decision !== 'pass' ||
    receipt.effectiveStatus !== 'pass' ||
    !receipt.stageInputs.some(
      (binding) => binding.role === 'readiness_scoped_input' && binding.hash === digest
    ) ||
    candidateOutputs.length !== 1 ||
    candidateOutputs[0].path !== candidateRelativePath ||
    candidateOutputs[0].hash !== candidateValue.implementationReadinessCandidateHash ||
    reportOutputs.length !== 1 ||
    reportOutputs[0].path !== reportRelativePath ||
    reportOutputs[0].hash !== reportArtifactBytesHash
  ) {
    throw new Error('implementation_readiness_published_receipt_lineage_invalid');
  }
  const receiptRelativePath = recordRelative(context.recordRoot, receiptPath);
  const projectionCurrent = isPublishedReadinessRuntimeProjection({
    context,
    candidate: candidateValue,
    receiptPath: receiptRelativePath,
    receipt,
  });
  return {
    result: resultPayload({
      status: 'implementation_readiness_reused',
      requestId: input.requestId,
      candidate: candidateValue,
      candidateRef: candidateArtifactRef,
      reportRef: {
        path: projectRelative(input.projectRoot, reportPath),
        artifactBytesHash: artifactBytesHash({
          role: 'implementation_readiness_report',
          mediaType: 'application/json',
          bytes: reportBytes,
        }),
      },
      decisionReceiptRef: {
        path: projectRelative(input.projectRoot, receiptPath),
        receiptHash: receipt.receiptHash,
      },
      issueCodes: [],
      commandExecutionCount: 0,
      writeCount: 0,
    }),
    candidate: candidateValue,
    receiptPath: receiptRelativePath,
    receipt,
    projectionCurrent,
  };
}

function rebindExistingReadinessBundle(input: {
  context: ArchitectureConfirmationContext;
  bundle: ExistingReadinessBundle;
  recordedAt: string;
  controlStoreCommitDeps?: ControlStoreCommitDeps;
}): boolean {
  const publication = readinessRuntimePublication({
    context: input.context,
    candidate: input.bundle.candidate,
    receiptPath: input.bundle.receiptPath,
    receipt: input.bundle.receipt,
  });
  try {
    appendControlEventAndReplay(
      {
        recordPath: publication.runtimeRecordPath,
        writerId: 'implementation-readiness-gate-writer',
        eventType: 'implementation_readiness_result_recorded',
        recordedAt: input.recordedAt,
        expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(publication.record)),
        payload: {
          eventType: 'implementation_readiness_result_recorded',
          ...publication.runtimeStatus.projection,
        },
        reduce: (currentRecord) => ({
          ...currentRecord,
          ...runtimeStatusProjectionRecordPatch({
            record: currentRecord,
            modelId: 'implementation_readiness',
            update: publication.runtimeStatus,
          }),
          currentMentalModel: 'implementation_readiness',
          lastEventType: 'implementation_readiness_result_recorded',
          updatedAt: input.recordedAt,
        }),
      },
      input.controlStoreCommitDeps
    );
  } catch (error) {
    if (
      isPublishedReadinessRuntimeProjection({
        context: input.context,
        candidate: input.bundle.candidate,
        receiptPath: input.bundle.receiptPath,
        receipt: input.bundle.receipt,
      })
    ) {
      return false;
    }
    throw error;
  }
  if (
    !isPublishedReadinessRuntimeProjection({
      context: input.context,
      candidate: input.bundle.candidate,
      receiptPath: input.bundle.receiptPath,
      receipt: input.bundle.receipt,
    })
  ) {
    throw new Error('implementation_readiness_published_projection_invalid');
  }
  return true;
}

export function produceImplementationReadiness(
  input: ReadinessEvaluationInput,
  deps: ReadinessProducerDeps = {}
): JsonObject {
  const projectRoot = path.resolve(input.projectRoot);
  const now = deps.now ?? (() => new Date().toISOString());
  if (!SAFE_REQUEST_ID.test(input.requestId))
    throw new Error('implementation_readiness_request_id_invalid');
  const runtimeRecordPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.requestId,
    'requirement-record.json'
  );
  const authoritative = readControlStoreAuthoritatively(runtimeRecordPath, () => {
    const context = resolveArchitectureConfirmationContext({
      projectRoot,
      requestId: input.requestId,
    });
    const architectureCandidate = deriveArchitectureConfirmationCandidate(context);
    const acceptance = readCurrentArchitectureConfirmationAcceptance({
      context,
      candidate: architectureCandidate,
    });
    if (!acceptance) {
      throw new ImplementationReadinessBlock('architecture_confirmation_required');
    }
    const runtimeState = readValidReadinessRuntimeRecord(
      context,
      architectureCandidate.architectureConfirmationCandidateHash
    );
    const commands = normalizedCommandsFor(context, architectureCandidate);
    const inputArtifacts = collectInputArtifacts(context, architectureCandidate, commands);
    const digest = scopedInputDigest({
      context,
      candidate: architectureCandidate,
      commands,
      inputArtifacts,
    });
    return {
      context,
      architectureCandidate,
      acceptance,
      commands,
      inputArtifacts,
      digest,
      runtimeState,
      invalidateCurrentPass:
        resolveVerifiedSixModelStatus({
          record: runtimeState.record,
          modelId: 'implementation_readiness',
          currentImplementationAttemptId: text(runtimeState.record.currentAttemptId),
        }).effectiveStatus === 'pass' &&
        (text(
          object(object(runtimeState.record.sixModelResults).implementation_readiness)
            .readinessScopedInputDigest
        ) ||
          text(
            object(
              object(object(runtimeState.record.sixModelResults).implementation_readiness)
                .currentHashes
            ).readinessScopedInputDigest
          )) !== digest,
      reused: existingBundle(
        input,
        context,
        architectureCandidate,
        digest,
        commands,
        inputArtifacts
      ),
    };
  });
  const {
    context,
    architectureCandidate,
    acceptance,
    commands,
    inputArtifacts,
    digest,
    runtimeState,
    invalidateCurrentPass,
    reused,
  } = authoritative;
  if (reused) {
    const rebound = reused.projectionCurrent
      ? false
      : rebindExistingReadinessBundle({
          context,
          bundle: reused,
          recordedAt: now(),
          controlStoreCommitDeps: deps.controlStoreCommitDeps,
        });
    return { ...reused.result, writeCount: rebound ? 1 : 0 };
  }
  let staleTransitionWriteCount = 0;
  if (invalidateCurrentPass) {
    invalidateReadinessRuntimeProjection({
      context,
      runtimeRecordPath: runtimeState.runtimeRecordPath,
      record: runtimeState.record,
      architectureConfirmationCandidateHash:
        architectureCandidate.architectureConfirmationCandidateHash,
      readinessScopedInputDigest: digest,
      recordedAt: now(),
      controlStoreCommitDeps: deps.controlStoreCommitDeps,
    });
    staleTransitionWriteCount = 1;
  }
  let executionCount = 0;
  let attemptedPublicationWriteCount = 0;
  const outcomes: Array<Omit<ReadinessOutcome, 'rawLogRef'>> = [];
  const logs: string[] = [];
  try {
    for (const command of commands) {
      executionCount += 1;
      deps.onCommandExecuted?.(command);
      const run = runAndValidate(
        command,
        projectRoot,
        deps.runCommand ?? runReadinessCommand,
        executionCount
      );
      outcomes.push(run.outcome);
      logs.push(run.log);
    }
    const evaluationRoot = path.join(
      context.recordRoot,
      'record',
      'readiness',
      'evaluations',
      digest.slice('sha256:'.length)
    );
    const logRefs = commands.map((command, index) => ({
      path: recordRelative(
        context.recordRoot,
        path.join(evaluationRoot, `logs/${safeSegment(command.normalizedCommandHash)}.json`)
      ),
      artifactBytesHash: artifactBytesHash({
        role: 'implementation_readiness_raw_log',
        mediaType: 'application/json',
        bytes: Buffer.from(logs[index], 'utf8'),
      }),
    }));
    const redOutcomes: ReadinessOutcome[] = outcomes.map((outcome, index) => ({
      ...outcome,
      rawLogRef: logRefs[index],
    }));
    const candidateWithoutHash = {
      schemaVersion: 'ImplementationReadinessCandidate/v1' as const,
      requestId: input.requestId,
      requirementsLineage: {
        recordId: context.record.recordId,
        semanticRevisionId: context.semanticIr.semanticRevisionId,
        scopeSemanticHash: context.semanticIr.scopeSemanticHash,
        executionConstraintRegistryHash:
          context.semanticIr.semanticPayload.executionConstraintRegistryHash,
      },
      architectureConfirmationCandidateHash:
        architectureCandidate.architectureConfirmationCandidateHash,
      architectureAcceptanceRef: acceptance.eventRef,
      readinessScopedInputDigest: digest,
      readinessPolicy: POLICY,
      normalizedCommands: commands,
      inputArtifacts,
      redOutcomes,
      implementationReadinessCandidateHash: '',
    } satisfies ReadinessCandidate;
    const candidate = {
      ...candidateWithoutHash,
      implementationReadinessCandidateHash:
        implementationReadinessCandidateHash(candidateWithoutHash),
    } satisfies ReadinessCandidate;
    const candidateBytes = Buffer.from(`${canonicalRequirementsJson(candidate)}\n`, 'utf8');
    const candidatePath = path.join(evaluationRoot, 'implementation-readiness-candidate.json');
    const reportPath = path.join(evaluationRoot, 'implementation-readiness-report.json');
    const receiptPath = path.join(evaluationRoot, 'runtime-status-decision-receipt.json');
    const report = {
      schemaVersion: 'implementation-readiness-report/v1',
      generatedAt: now(),
      requestId: input.requestId,
      status: 'pass',
      implementationReadinessCandidateHash: candidate.implementationReadinessCandidateHash,
      readinessScopedInputDigest: digest,
      issueCodes: [],
      candidateRef: candidateRef(projectRoot, candidatePath, candidateBytes),
    };
    const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const reportArtifactBytesHash = artifactBytesHash({
      role: 'implementation_readiness_report',
      mediaType: 'application/json',
      bytes: reportBytes,
    });
    const receipt = createRuntimeStatusDecisionReceipt({
      recordId: input.requestId,
      requirementSetId: text(context.record.requirementSetId) || input.requestId,
      modelId: 'implementation_readiness',
      implementationAttemptId: text(context.activeAuthority.activeAuthoringAttemptId),
      sourceDocumentHash: context.semanticIr.scopeSemanticHash,
      implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
      semanticModelHash: context.semanticIr.scopeSemanticHash,
      stageInputs: [
        {
          role: 'requirements_semantic_ir',
          path: text(context.activeAuthority.activeSemanticIrPath),
          hash: context.semanticIr.scopeSemanticHash,
        },
        {
          role: 'architecture_confirmation_candidate',
          path: text(object(acceptance.event.candidateRef).path),
          hash: architectureCandidate.architectureConfirmationCandidateHash,
        },
        { role: 'readiness_scoped_input', path: 'readiness/scoped-input', hash: digest },
      ],
      deterministicGateOutputs: [
        {
          role: 'implementation_readiness_candidate',
          path: recordRelative(context.recordRoot, candidatePath),
          hash: candidate.implementationReadinessCandidateHash,
        },
        {
          role: 'implementation_readiness_report',
          path: recordRelative(context.recordRoot, reportPath),
          hash: reportArtifactBytesHash,
        },
      ],
      blockerRefs: [],
      evidenceRefs: [
        recordRelative(context.recordRoot, candidatePath),
        recordRelative(context.recordRoot, reportPath),
        ...logRefs.map((entry) => entry.path),
      ],
      authorityClass: 'deterministic_gate',
      decision: 'pass',
      effectiveStatus: 'pass',
      createdAt: now(),
    });
    deps.beforePublish?.();
    assertReadinessCurrent({
      projectRoot,
      requestId: input.requestId,
      context,
      architectureCandidate,
      commands,
      inputArtifacts,
      digest,
      executionCount,
    });
    const receiptRelativePath = recordRelative(context.recordRoot, receiptPath);
    const publication = readinessRuntimePublication({
      context,
      candidate,
      receiptPath: receiptRelativePath,
      receipt,
    });
    const noClobberWrite = (artifactPath: string, content: string): ControlArtifactWrite => ({
      path: artifactPath,
      content,
      contentHash: sha256Text(content),
      expectedBeforeHash: CONTROL_STORE_ZERO_HASH,
    });
    const artifactWrites: ControlArtifactWrite[] = [
      noClobberWrite(recordRelative(context.recordRoot, candidatePath), candidateBytes.toString()),
      noClobberWrite(recordRelative(context.recordRoot, reportPath), reportBytes.toString()),
      ...commands.map((command, index) =>
        noClobberWrite(
          recordRelative(
            context.recordRoot,
            path.join(evaluationRoot, `logs/${safeSegment(command.normalizedCommandHash)}.json`)
          ),
          logs[index]
        )
      ),
      ...runtimeStatusProjectionArtifactWrites(publication.runtimeStatus).map((write) => ({
        ...write,
        expectedBeforeHash: CONTROL_STORE_ZERO_HASH,
      })),
    ];
    attemptedPublicationWriteCount = artifactWrites.length + 1;
    appendControlEventAndReplay(
      {
        recordPath: publication.runtimeRecordPath,
        writerId: 'implementation-readiness-gate-writer',
        eventType: 'implementation_readiness_result_recorded',
        recordedAt: text(receipt.createdAt),
        expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(publication.record)),
        payload: {
          eventType: 'implementation_readiness_result_recorded',
          ...publication.runtimeStatus.projection,
        },
        artifactWrites,
        reduce: (currentRecord) => ({
          ...currentRecord,
          ...runtimeStatusProjectionRecordPatch({
            record: currentRecord,
            modelId: 'implementation_readiness',
            update: publication.runtimeStatus,
          }),
          currentMentalModel: 'implementation_readiness',
          lastEventType: 'implementation_readiness_result_recorded',
          updatedAt: text(receipt.createdAt),
        }),
      },
      deps.controlStoreCommitDeps
    );
    deps.afterAtomicPublish?.();
    return resultPayload({
      status: 'implementation_readiness_pass',
      requestId: input.requestId,
      candidate,
      candidateRef: candidateRef(projectRoot, candidatePath, candidateBytes),
      reportRef: {
        path: projectRelative(projectRoot, reportPath),
        artifactBytesHash: artifactBytesHash({
          role: 'implementation_readiness_report',
          mediaType: 'application/json',
          bytes: reportBytes,
        }),
      },
      decisionReceiptRef: {
        path: projectRelative(projectRoot, receiptPath),
        receiptHash: receipt.receiptHash,
      },
      issueCodes: [],
      commandExecutionCount: executionCount,
      writeCount: staleTransitionWriteCount + attemptedPublicationWriteCount,
    });
  } catch (error) {
    if (attemptedPublicationWriteCount > 0) {
      let committed: ExistingReadinessBundle | null = null;
      try {
        committed = readControlStoreAuthoritatively(runtimeState.runtimeRecordPath, () =>
          existingBundle(input, context, architectureCandidate, digest, commands, inputArtifacts)
        );
      } catch {
        committed = null;
      }
      if (committed) {
        return {
          ...committed.result,
          status: 'implementation_readiness_pass',
          commandExecutionCount: executionCount,
          writeCount: staleTransitionWriteCount + attemptedPublicationWriteCount,
        };
      }
    }
    if (error instanceof ImplementationReadinessBlock) {
      throw new ImplementationReadinessBlock(
        error.issueCode,
        error.commandExecutionCount,
        staleTransitionWriteCount + error.writeCount
      );
    }
    if (error instanceof ImplementationReadinessFailure) {
      throw new ImplementationReadinessFailure(
        error.issueCode,
        error.commandExecutionCount,
        staleTransitionWriteCount + error.writeCount
      );
    }
    throw new ImplementationReadinessFailure(
      issueCodeFromError(error),
      executionCount,
      staleTransitionWriteCount
    );
  }
}

function blockedResult(
  requestId: string,
  issueCodes: string[],
  commandExecutionCount = 0,
  writeCount = 0
): JsonObject {
  return resultPayload({
    status: 'implementation_readiness_blocked',
    requestId,
    issueCodes,
    commandExecutionCount,
    writeCount,
  });
}

export function mainImplementationReadinessGateV2(argv: string[]): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    emitJson(process.stderr, blockedResult('unknown', [issueCodeFromError(error)]));
    return 2;
  }
  if (args.help) {
    process.stdout.write(
      'Usage: bmad-speckit main-agent implementation-readiness-gate --request-id <requestId> --execute-red-proof --json\n'
    );
    return 0;
  }
  if (!args.requestId) {
    emitJson(process.stderr, blockedResult('unknown', ['request_id_missing']));
    return 2;
  }
  if (!args.executeRedProof) {
    emitJson(process.stderr, blockedResult(args.requestId, ['execute_red_proof_required']));
    return 2;
  }
  try {
    const result = produceImplementationReadiness({
      projectRoot: process.cwd(),
      requestId: args.requestId,
    });
    emitJson(process.stdout, result);
    return result.status === 'implementation_readiness_blocked' ? 1 : 0;
  } catch (error) {
    if (error instanceof ImplementationReadinessBlock) {
      emitJson(
        process.stderr,
        blockedResult(
          args.requestId,
          [error.issueCode],
          error.commandExecutionCount,
          error.writeCount
        )
      );
      return 1;
    }
    if (error instanceof ImplementationReadinessFailure) {
      emitJson(
        process.stderr,
        blockedResult(
          args.requestId,
          [publicProducerFailureIssueCode(error.issueCode)],
          error.commandExecutionCount,
          error.writeCount
        )
      );
      return 2;
    }
    const failure = classifyReadinessError(error);
    emitJson(process.stderr, blockedResult(args.requestId, [failure.issueCode]));
    return failure.exitCode;
  }
}
