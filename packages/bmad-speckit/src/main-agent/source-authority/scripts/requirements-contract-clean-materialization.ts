import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  requirementsContractCommandExecutionProducerCommand,
  validateRequirementsContractCommandExecutionReceiptArtifact,
} from './requirements-contract-command-execution-receipt';
import {
  distRuntimeHashFor,
  packageRuntimeHashFor,
} from './requirements-contract-package-runtime-index';
import { assertRuntimeBuildAuthorityCurrent } from './requirements-contract-runtime-build-authority';

type JsonRecord = Record<string, unknown>;

export interface RequirementsContractCleanMaterializationOptions {
  cwd?: string;
  projectRoot: string;
  request: string;
  json?: boolean;
}

const INPUT_SCHEMA =
  'requirements-contract-clean-materialization-input.schema.json';
const RECEIPT_SCHEMA =
  'requirements-contract-clean-materialization-receipt.schema.json';
const PRODUCER_ID = 'requirements-contract-command-execution-producer/v1';
let inputValidator: ValidateFunction | null = null;
let receiptValidator: ValidateFunction | null = null;

function validator(schemaName: string): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(
    JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'schemas', schemaName), 'utf8')
    )
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableHash(value: unknown): string {
  return sha256(stableStringify(value));
}

function fileHash(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function isInside(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

function resolveInside(root: string, candidate: string): string | null {
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  return isInside(root, resolved) ? resolved : null;
}

function gitOutput(root: string, args: string[]): string {
  const execution = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (execution.error || execution.status !== 0) {
    throw new Error(
      `clean_materialization_git_failed:${execution.status}:${
        execution.stderr ?? execution.error?.message ?? ''
      }`
    );
  }
  return execution.stdout ?? '';
}

function excludedSourcePath(relativePath: string): boolean {
  const normalized = slash(relativePath);
  const segments = normalized.split('/');
  return (
    segments.some((segment) =>
      [
        '.git',
        '.codex-tmp',
        '_bmad-output',
        'node_modules',
        'dist',
        'coverage',
        'test-results',
      ].includes(segment)
    ) ||
    normalized.endsWith('.tgz') ||
    normalized.endsWith('.tar.gz')
  );
}

function visibleSourceFiles(root: string): string[] {
  return [
    ...new Set(
      gitOutput(root, [
        'ls-files',
        '-z',
        '--cached',
        '--others',
        '--exclude-standard',
      ])
        .split('\0')
        .map((entry) => slash(entry.trim()))
        .filter(Boolean)
        .filter((entry) => !excludedSourcePath(entry))
        .filter((entry) => {
          const absolute = path.resolve(root, entry);
          return (
            isInside(root, absolute) &&
            fs.existsSync(absolute) &&
            fs.lstatSync(absolute).isFile()
          );
        })
    ),
  ].sort();
}

function sourceSnapshotHash(root: string, relativePaths: string[]): string {
  return sha256(
    [...relativePaths]
      .sort()
      .map((relativePath) => {
        const absolute = resolveInside(root, relativePath);
        if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
          throw new Error(`clean_materialization_source_snapshot_missing:${relativePath}`);
        }
        return `${slash(relativePath)}:${fileHash(absolute)}`;
      })
      .join('\n')
  );
}

function materializeSource(input: {
  sourceRoot: string;
  materializationRoot: string;
  files: string[];
}): { entries: Array<{ path: string; hash: string }>; manifestHash: string } {
  const entries = input.files.map((relativePath) => {
    const source = path.resolve(input.sourceRoot, relativePath);
    const target = path.resolve(input.materializationRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.chmodSync(target, fs.statSync(source).mode);
    const sourceHash = fileHash(source);
    if (fileHash(target) !== sourceHash) {
      throw new Error(`clean_materialization_copy_hash_mismatch:${relativePath}`);
    }
    return { path: slash(relativePath), hash: sourceHash };
  });
  return {
    entries,
    manifestHash: stableHash(entries),
  };
}

function npmCliPath(): string {
  const candidates = [
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.npm_execpath ?? '',
  ].filter(Boolean);
  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
  if (!resolved) throw new Error('clean_materialization_npm_cli_unavailable');
  return path.resolve(resolved);
}

function writeJsonCreateOnly(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function runMaterializationCommand(input: {
  projectRoot: string;
  evidenceRoot: string;
  runSuffix: string;
  commandRole: 'INSTALL' | 'BUILD';
  argv: string[];
  context: JsonRecord;
  sourceManifestHash: string;
}): Promise<{ receiptPath: string; receiptHash: string; decision: string }> {
  const role = input.commandRole.toLowerCase();
  const requestPath = path.join(input.evidenceRoot, `${role}-request.json`);
  const receiptPath = path.join(input.evidenceRoot, `${role}-receipt.json`);
  writeJsonCreateOnly(requestPath, {
    schemaVersion: 'requirements-contract-command-execution-producer-input/v1',
    commandRunId: `RUN-${input.commandRole}-${input.runSuffix}`,
    commandId: `CMD-MATERIALIZATION-${input.commandRole}-${input.runSuffix}`,
    argv: input.argv,
    cwd: input.projectRoot,
    stdoutPath: path.join(input.evidenceRoot, `${role}.stdout.log`),
    stderrPath: path.join(input.evidenceRoot, `${role}.stderr.log`),
    receiptPath,
    requirementSetId: text(input.context.requirementSetId),
    requirementRefs: strings(input.context.requirementRefs),
    transactionId: text(input.context.transactionId),
    implementationAttemptId: text(input.context.implementationAttemptId),
    architectureAuditAttemptId: text(input.context.architectureAuditAttemptId),
    activePhaseAuditAttemptId: text(input.context.activePhaseAuditAttemptId),
    contractHash: text(input.context.contractHash),
    inputSnapshotHash: input.sourceManifestHash,
    acceptanceRefs: strings(input.context.acceptanceRefs),
    traceRefs: strings(input.context.traceRefs),
  });
  const receipt = await requirementsContractCommandExecutionProducerCommand({
    projectRoot: input.projectRoot,
    request: requestPath,
  });
  const validation = validateRequirementsContractCommandExecutionReceiptArtifact({
    projectRoot: input.projectRoot,
    receiptPath,
    expectedProducer: {
      executorClass: 'controlled_detached_executor',
      executorId: PRODUCER_ID,
      writer: PRODUCER_ID,
    },
  });
  if (validation.issueCodes.length > 0) {
    throw new Error(
      `clean_materialization_command_receipt_invalid:${input.commandRole}:${validation.issueCodes.join(
        ','
      )}`
    );
  }
  return {
    receiptPath,
    receiptHash: fileHash(receiptPath),
    decision: receipt.decision,
  };
}

export async function requirementsContractCleanMaterializationCommand(
  options: RequirementsContractCleanMaterializationOptions
): Promise<JsonRecord> {
  const sourceRoot = path.resolve(options.projectRoot || options.cwd || process.cwd());
  const requestPath = resolveInside(sourceRoot, options.request);
  if (!requestPath || !fs.existsSync(requestPath) || !fs.statSync(requestPath).isFile()) {
    throw new Error('clean_materialization_request_missing_or_outside_root');
  }
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8')) as unknown;
  inputValidator ??= validator(INPUT_SCHEMA);
  if (!inputValidator(request) || !isRecord(request)) {
    throw new Error(
      `clean_materialization_request_schema_invalid:${JSON.stringify(
        inputValidator.errors ?? []
      )}`
    );
  }
  const materializationRoot = path.resolve(text(request.materializationRoot));
  if (
    isInside(sourceRoot, materializationRoot) ||
    isInside(materializationRoot, sourceRoot) ||
    fs.existsSync(materializationRoot)
  ) {
    throw new Error('clean_materialization_root_not_fresh_or_isolated');
  }
  const receiptPath = resolveInside(sourceRoot, text(request.receiptPath));
  if (!receiptPath || fs.existsSync(receiptPath)) {
    throw new Error('clean_materialization_receipt_path_invalid');
  }
  const sourceSnapshotPaths = strings(request.sourceSnapshotPaths).map(slash).sort();
  const currentSourceSnapshotHash = sourceSnapshotHash(
    sourceRoot,
    sourceSnapshotPaths
  );
  if (currentSourceSnapshotHash !== text(request.sourceSnapshotHash)) {
    throw new Error('clean_materialization_source_snapshot_hash_mismatch');
  }
  const currentPackageRoot = path.join(sourceRoot, 'packages', 'bmad-speckit');
  const currentRuntimeManifestPath = path.join(
    currentPackageRoot,
    'dist',
    'main-agent',
    'runtime-asset-manifest.json'
  );
  const currentBuildReceiptPath = path.join(
    currentPackageRoot,
    'dist',
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  assertRuntimeBuildAuthorityCurrent({
    receipt: JSON.parse(fs.readFileSync(currentBuildReceiptPath, 'utf8')),
    packageRoot: currentPackageRoot,
    runtimeAssetManifestPath: currentRuntimeManifestPath,
    buildScriptPath: path.join(
      currentPackageRoot,
      'scripts',
      'build-main-agent-dist.cjs'
    ),
    dependencyLockPath: path.join(sourceRoot, 'package-lock.json'),
  });
  const currentDistHash = distRuntimeHashFor(currentPackageRoot);
  const currentPackageHash = packageRuntimeHashFor(currentPackageRoot);
  const startedAt = new Date().toISOString();
  fs.mkdirSync(materializationRoot, { recursive: false });
  const sourceFiles = visibleSourceFiles(sourceRoot);
  const sourceManifest = materializeSource({
    sourceRoot,
    materializationRoot,
    files: sourceFiles,
  });
  const evidenceRoot = path.join(
    materializationRoot,
    '.bmad-materialization',
    text(request.materializationRunId)
  );
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const sourceManifestPath = path.join(evidenceRoot, 'source-manifest.json');
  writeJsonCreateOnly(sourceManifestPath, {
    schemaVersion: 'requirements-contract-clean-materialization-source-manifest/v1',
    entries: sourceManifest.entries,
    manifestHash: sourceManifest.manifestHash,
  });
  const sourceWasCleanOfBuildOutputs = [
    path.join(materializationRoot, 'node_modules'),
    path.join(materializationRoot, '_bmad-output'),
    path.join(materializationRoot, 'packages', 'bmad-speckit', 'dist'),
  ].every((candidate) => !fs.existsSync(candidate));
  if (!sourceWasCleanOfBuildOutputs) {
    throw new Error('clean_materialization_stale_output_copied');
  }
  const runSuffix = text(request.materializationRunId).replace(/^RUN-/u, '');
  const commandContext: JsonRecord = {
    requirementSetId: request.requirementSetId,
    requirementRefs: request.requirementRefs,
    transactionId: request.transactionId,
    implementationAttemptId: request.implementationAttemptId,
    architectureAuditAttemptId: request.architectureAuditAttemptId,
    activePhaseAuditAttemptId: request.activePhaseAuditAttemptId,
    contractHash: request.contractHash,
    acceptanceRefs: request.acceptanceRefs,
    traceRefs: request.traceRefs,
  };
  const npmCli = npmCliPath();
  const install = await runMaterializationCommand({
    projectRoot: materializationRoot,
    evidenceRoot,
    runSuffix,
    commandRole: 'INSTALL',
    argv: [process.execPath, npmCli, 'ci', '--offline'],
    context: commandContext,
    sourceManifestHash: sourceManifest.manifestHash,
  });
  const build =
    install.decision === 'pass'
      ? await runMaterializationCommand({
          projectRoot: materializationRoot,
          evidenceRoot,
          runSuffix,
          commandRole: 'BUILD',
          argv: [process.execPath, npmCli, 'run', 'build'],
          context: commandContext,
          sourceManifestHash: sourceManifest.manifestHash,
        })
      : null;
  const freshPackageRoot = path.join(
    materializationRoot,
    'packages',
    'bmad-speckit'
  );
  const freshRuntimeManifestPath = path.join(
    freshPackageRoot,
    'dist',
    'main-agent',
    'runtime-asset-manifest.json'
  );
  const freshBuildReceiptPath = path.join(
    freshPackageRoot,
    'dist',
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  let freshDistHash = '';
  let freshPackageHash = '';
  let runtimeBuildAuthorityReceiptHash = '';
  let runtimeBuildAuthorityCurrent = false;
  if (
    build?.decision === 'pass' &&
    fs.existsSync(freshBuildReceiptPath) &&
    fs.existsSync(freshRuntimeManifestPath)
  ) {
    const freshAuthorityModule = require(path.join(
      freshPackageRoot,
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'requirements-contract-runtime-build-authority.js'
    )) as {
      assertRuntimeBuildAuthorityCurrent: typeof assertRuntimeBuildAuthorityCurrent;
    };
    freshAuthorityModule.assertRuntimeBuildAuthorityCurrent({
      receipt: JSON.parse(fs.readFileSync(freshBuildReceiptPath, 'utf8')),
      packageRoot: freshPackageRoot,
      runtimeAssetManifestPath: freshRuntimeManifestPath,
      buildScriptPath: path.join(
        freshPackageRoot,
        'scripts',
        'build-main-agent-dist.cjs'
      ),
      dependencyLockPath: path.join(materializationRoot, 'package-lock.json'),
    });
    const freshIndexModule = require(path.join(
      freshPackageRoot,
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'requirements-contract-package-runtime-index.js'
    )) as {
      distRuntimeHashFor: typeof distRuntimeHashFor;
      packageRuntimeHashFor: typeof packageRuntimeHashFor;
    };
    freshDistHash = freshIndexModule.distRuntimeHashFor(freshPackageRoot);
    freshPackageHash = freshIndexModule.packageRuntimeHashFor(freshPackageRoot);
    runtimeBuildAuthorityReceiptHash = fileHash(freshBuildReceiptPath);
    runtimeBuildAuthorityCurrent = true;
  }
  const distParity = freshDistHash === currentDistHash;
  const packageParity = freshPackageHash === currentPackageHash;
  const decision =
    sourceWasCleanOfBuildOutputs &&
    install.decision === 'pass' &&
    build?.decision === 'pass' &&
    runtimeBuildAuthorityCurrent &&
    distParity &&
    packageParity
      ? 'pass'
      : 'block';
  const completedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 'requirements-contract-clean-materialization-receipt/v1',
    materializationRunId: text(request.materializationRunId),
    sourceSnapshotPaths,
    sourceSnapshotHash: currentSourceSnapshotHash,
    sourceManifestPath: slash(sourceManifestPath),
    sourceManifestHash: sourceManifest.manifestHash,
    sourceFileCount: sourceManifest.entries.length,
    materializationRoot: slash(materializationRoot),
    sourceWasCleanOfBuildOutputs,
    installReceiptPath: slash(install.receiptPath),
    installReceiptHash: install.receiptHash,
    buildReceiptPath: build ? slash(build.receiptPath) : null,
    buildReceiptHash: build?.receiptHash ?? null,
    runtimeBuildAuthorityReceiptPath: runtimeBuildAuthorityCurrent
      ? slash(freshBuildReceiptPath)
      : null,
    runtimeBuildAuthorityReceiptHash: runtimeBuildAuthorityCurrent
      ? runtimeBuildAuthorityReceiptHash
      : null,
    currentDistHash,
    freshDistHash: freshDistHash || null,
    currentPackageHash,
    freshPackageHash: freshPackageHash || null,
    distParity,
    packageParity,
    startedAt,
    completedAt,
    decision,
  };
  const receipt = {
    ...payload,
    receiptHash: stableHash(payload),
  };
  receiptValidator ??= validator(RECEIPT_SCHEMA);
  if (!receiptValidator(receipt)) {
    throw new Error(
      `clean_materialization_receipt_schema_invalid:${JSON.stringify(
        receiptValidator.errors ?? []
      )}`
    );
  }
  writeJsonCreateOnly(receiptPath, receipt);
  const readback = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  const readbackRecord = isRecord(readback) ? readback : null;
  const readbackReceiptHash = text(readbackRecord?.receiptHash);
  if (
    !readbackRecord ||
    !receiptValidator(readbackRecord) ||
    readbackReceiptHash !== receipt.receiptHash
  ) {
    throw new Error('clean_materialization_receipt_readback_invalid');
  }
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
