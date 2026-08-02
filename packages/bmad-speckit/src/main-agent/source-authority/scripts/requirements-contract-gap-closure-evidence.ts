/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { resolvePackageBmadRoot } from '../../runtime/package-bmad-root';
import {
  distRuntimeHashFor,
  packageRuntimeHashFor,
} from './requirements-contract-package-runtime-index';
import {
  validateRequirementsContractCommandExecutionReceiptArtifact,
  type RequirementsContractCommandExecutionReceipt,
} from './requirements-contract-command-execution-receipt';
import { assertRuntimeBuildAuthorityCurrent } from './requirements-contract-runtime-build-authority';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  requirementRecord?: string;
  candidate?: string;
  auditorCommand?: string;
  json?: boolean;
  help?: boolean;
}

interface ReadonlyAuditorAuthority {
  command: string[];
  adapterPath: string;
  adapterHash: string;
  actionBindingManifestPath: string;
  actionBindingManifestHash: string;
  canonicalAssetsManifestPath: string;
  canonicalAssetsManifestHash: string;
  criticalAuditorProfilePath: string;
  criticalAuditorProfileHash: string;
  criticalAuditorProfileDeclaredHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const GAP_ID = /^[A-Za-z][A-Za-z0-9_-]{1,63}$/u;
const READONLY_AUDITOR_ACTION_ID =
  'requirements-contract-gap-closure-readonly-auditor-adapter';
const FORBIDDEN_CANDIDATE_FIELDS = new Set([
  'closureDecision',
  'independentAuditDecision',
  'independentOracleDoesNotImportProductionHelpers',
  'independentOracleImplementation',
  'cleanMaterializationReproducible',
  'forbiddenSeamScanResult',
  'hardcodedIdentityScanResult',
  'mainAgentSuppliedClosureDecision',
  'noHardcodedMachineIdentity',
  'noProductionTestInjection',
]);
const FORBIDDEN_PRODUCTION_PATTERNS = [
  /\bM\d{2}(?:_[A-Z0-9]+){2,}\b/u,
  /\bE2E-\d{3,}\b/u,
  /\bMUST-\d{3,}\b/u,
  /fixture[_-]?only/iu,
  /test[_-]?only/iu,
  /substitutionCounts\s*[:=]\s*0/iu,
  /decision\s*[:=]\s*['"]PASS['"](?!\s*\|)/u,
];
const FORBIDDEN_AUTHORITY_RESULT_INJECTION_PATTERNS = [
  /\bAuditJudgeExecutor\b/u,
  /\bauditJudgeExecutor\b/u,
  /\bjudgeResultExecutor\b/u,
  /\bjudgeVerdictExecutor\b/u,
  /\btaskReportProvider\b/u,
  /\bproviderEvidenceProvider\b/u,
  /\bhostReceiptProvider\b/u,
  /\bscoreReceiptProvider\b/u,
  /\bfinalizationReceiptProvider\b/u,
  /\bcompletionDecisionReceiptProvider\b/u,
];
const COMMAND_EXECUTION_PRODUCER_ID =
  'requirements-contract-command-execution-producer/v1';
let cleanMaterializationReceiptValidator:
  | (((value: unknown) => boolean) & { errors?: unknown })
  | null = null;

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`unexpected positional argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    (args as Record<string, string | boolean | undefined>)[key] = value;
    index += 1;
  }
  return args;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function readJson(filePath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`json_object_required:${filePath}`);
  }
  return parsed as JsonObject;
}

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sha256File(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function sha256Json(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as JsonObject;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function stableHash(value: unknown): string {
  return sha256(stableStringify(value));
}

function validateCleanMaterializationReceiptSchema(value: unknown): boolean {
  if (!cleanMaterializationReceiptValidator) {
    const schemaPath = path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-clean-materialization-receipt.schema.json'
    );
    cleanMaterializationReceiptValidator = new Ajv2020({
      allErrors: true,
      strict: false,
      validateFormats: false,
    }).compile(readJson(schemaPath));
  }
  return cleanMaterializationReceiptValidator(value);
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sameResolvedPath(left: string, right: string): boolean {
  const normalizedLeft = normalizePath(path.resolve(left));
  const normalizedRight = normalizePath(path.resolve(right));
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function parseAuditorCommand(value: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('gap_closure_auditor_command_invalid');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some((item) => typeof item !== 'string' || !item.trim())
  ) {
    throw new Error('gap_closure_auditor_command_invalid');
  }
  return parsed.map((item) => item.trim());
}

function commandIdentity(command: string[]): string[] {
  return command.map((entry, index) => {
    if (index > 1 || (!path.isAbsolute(entry) && !entry.includes(path.sep))) {
      return entry;
    }
    const resolved = path.resolve(entry);
    return process.platform === 'win32'
      ? normalizePath(resolved).toLowerCase()
      : normalizePath(resolved);
  });
}

function singleObjectBy(
  values: JsonObject[],
  field: string,
  expected: string,
  code: string
): JsonObject {
  const matches = values.filter((value) => text(value[field]) === expected);
  if (matches.length !== 1) throw new Error(code);
  return matches[0];
}

function packageOwnedRefPath(
  packageRoot: string,
  reference: JsonObject,
  pathField: string,
  hashField: string,
  code: string
): { path: string; hash: string } {
  const relativePath = text(reference[pathField]);
  const expectedHash = text(reference[hashField]);
  const resolved = resolveInside(packageRoot, relativePath);
  if (
    !resolved ||
    !relativePath ||
    !SHA256.test(expectedHash) ||
    !fs.existsSync(resolved) ||
    !fs.statSync(resolved).isFile() ||
    sha256File(resolved) !== expectedHash
  ) {
    throw new Error(code);
  }
  return { path: resolved, hash: expectedHash };
}

function resolveReadonlyAuditorAuthority(root: string): ReadonlyAuditorAuthority {
  const packageBmadRoot = resolvePackageBmadRoot();
  const packageRoot = path.dirname(packageBmadRoot);
  const actionBindingManifestPath = path.join(
    packageBmadRoot,
    'shared',
    'requirements-contract',
    'requirements-contract-package-runtime-action-binding-manifest.json'
  );
  const canonicalAssetsManifestPath = path.join(
    packageBmadRoot,
    'shared',
    'requirements-contract',
    'requirements-contract-canonical-assets-manifest.json'
  );
  const criticalAuditorProfilePath = path.join(
    packageBmadRoot,
    'shared',
    'critical-auditor-profile',
    'critical-auditor-profile.json'
  );
  for (const requiredPath of [
    actionBindingManifestPath,
    canonicalAssetsManifestPath,
    criticalAuditorProfilePath,
  ]) {
    if (!fs.existsSync(requiredPath) || !fs.statSync(requiredPath).isFile()) {
      throw new Error('gap_closure_auditor_authority_asset_missing');
    }
  }

  const actionBindingManifest = readJson(actionBindingManifestPath);
  if (
    text(actionBindingManifest.schemaVersion) !==
      'requirements-contract-package-runtime-action-binding-manifest/v2' ||
    text(actionBindingManifest.decision) !== 'pass'
  ) {
    throw new Error('gap_closure_auditor_action_binding_manifest_invalid');
  }
  const binding = singleObjectBy(
    objects(actionBindingManifest.actions),
    'actionId',
    READONLY_AUDITOR_ACTION_ID,
    'gap_closure_auditor_action_binding_not_unique'
  );
  const semanticGate = object(binding.semanticGate);
  if (
    !semanticGate ||
    text(semanticGate.sourceSymbol) !==
      'requirementsContractGapClosureReadonlyAuditorAdapterCommand' ||
    text(semanticGate.distSymbol) !==
      'requirementsContractGapClosureReadonlyAuditorAdapterCommand'
  ) {
    throw new Error('gap_closure_auditor_semantic_gate_invalid');
  }
  const packageDistRef = object(binding.packageDistRef);
  const distHandlerRef = object(binding.distHandlerRef);
  const sourceHandlerRef = object(binding.sourceHandlerRef);
  if (!packageDistRef || !distHandlerRef || !sourceHandlerRef) {
    throw new Error('gap_closure_auditor_binding_ref_missing');
  }
  const adapter = packageOwnedRefPath(
    packageRoot,
    packageDistRef,
    'path',
    'hash',
    'gap_closure_auditor_adapter_ref_invalid'
  );
  if (text(distHandlerRef.hash) !== adapter.hash) {
    throw new Error('gap_closure_auditor_dist_hash_mismatch');
  }

  const canonicalAssetsManifest = readJson(canonicalAssetsManifestPath);
  if (
    text(canonicalAssetsManifest.schemaVersion) !==
    'requirements-contract-canonical-assets-manifest/v2'
  ) {
    throw new Error('gap_closure_auditor_canonical_assets_manifest_invalid');
  }
  const adapterAsset = singleObjectBy(
    objects(canonicalAssetsManifest.assets),
    'assetId',
    'gap_closure_readonly_auditor_adapter',
    'gap_closure_auditor_canonical_asset_not_unique'
  );
  if (text(adapterAsset.sha256) !== text(sourceHandlerRef.hash)) {
    throw new Error('gap_closure_auditor_source_hash_mismatch');
  }
  const profileAsset = singleObjectBy(
    objects(canonicalAssetsManifest.assets),
    'assetId',
    'critical_auditor_profile',
    'gap_closure_auditor_profile_asset_not_unique'
  );
  const criticalAuditorProfileHash = sha256File(criticalAuditorProfilePath);
  if (text(profileAsset.sha256) !== criticalAuditorProfileHash) {
    throw new Error('gap_closure_auditor_profile_hash_mismatch');
  }
  const criticalAuditorProfile = readJson(criticalAuditorProfilePath);
  const profileMetadata = object(criticalAuditorProfile.metadata);
  const criticalAuditorProfileDeclaredHash = text(profileMetadata?.profileHash);
  if (
    text(profileMetadata?.schemaVersion) !== 'critical-auditor-profile/v1' ||
    text(profileMetadata?.profileId) !==
      'main-agent-six-mental-model-critical-auditor' ||
    !SHA256.test(criticalAuditorProfileDeclaredHash)
  ) {
    throw new Error('gap_closure_auditor_profile_invalid');
  }
  return {
    command: [process.execPath, adapter.path, '--project-root', path.resolve(root)],
    adapterPath: adapter.path,
    adapterHash: adapter.hash,
    actionBindingManifestPath,
    actionBindingManifestHash: sha256File(actionBindingManifestPath),
    canonicalAssetsManifestPath,
    canonicalAssetsManifestHash: sha256File(canonicalAssetsManifestPath),
    criticalAuditorProfilePath,
    criticalAuditorProfileHash,
    criticalAuditorProfileDeclaredHash,
  };
}

function isTrustedReadonlyAuditorCommand(
  requestedCommand: string[] | null,
  authority: ReadonlyAuditorAuthority
): boolean {
  return requestedCommand === null ||
    JSON.stringify(commandIdentity(requestedCommand)) ===
      JSON.stringify(commandIdentity(authority.command));
}

function isInside(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function projectRootForRecordPath(recordPath: string): string {
  const resolved = path.resolve(recordPath);
  const marker = `${path.sep}_bmad-output${path.sep}`;
  const markerIndex = resolved.lastIndexOf(marker);
  if (markerIndex <= 0) throw new Error('gap_closure_record_not_under_runtime_root');
  return resolved.slice(0, markerIndex);
}

function resolveInside(root: string, candidate: string): string | null {
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  return isInside(root, resolved) ? resolved : null;
}

function sourceSnapshotHash(root: string, files: string[]): string {
  const entries = files
    .map((file) => {
      const absolute = resolveInside(root, file);
      if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        throw new Error(`gap_closure_production_file_missing:${file}`);
      }
      return `${normalizePath(path.relative(root, absolute))}:${sha256File(absolute)}`;
    })
    .sort();
  return sha256(entries.join('\n'));
}

function isProductionPath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  return (
    normalized.startsWith('packages/bmad-speckit/src/') ||
    normalized.startsWith('packages/bmad-speckit/bin/') ||
    normalized.startsWith('_bmad/skills/') ||
    normalized.startsWith('_bmad/shared/') ||
    normalized === 'packages/bmad-speckit/package.json'
  );
}

function gitOutput(root: string, args: string[]): string | null {
  const execution = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 5 * 1024 * 1024,
  });
  if (execution.error || execution.status !== 0) return null;
  return execution.stdout ?? '';
}

function nulSeparatedPaths(value: string): string[] {
  return value
    .split('\0')
    .map((entry) => normalizePath(entry.trim()))
    .filter(Boolean);
}

function deriveGitObservedProductionChanges(root: string): {
  files: string[];
  blockingReasons: string[];
} {
  const topLevel = gitOutput(root, ['rev-parse', '--show-toplevel']);
  if (!topLevel) {
    return {
      files: [],
      blockingReasons: ['production_change_authority_unavailable'],
    };
  }
  if (path.resolve(topLevel.trim()) !== path.resolve(root)) {
    return {
      files: [],
      blockingReasons: ['production_change_authority_root_mismatch'],
    };
  }
  const tracked = gitOutput(root, [
    'diff',
    '--name-only',
    '-z',
    '--diff-filter=ACMRTUXB',
    'HEAD',
    '--',
  ]);
  const untracked = gitOutput(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
  ]);
  const deleted = gitOutput(root, [
    'diff',
    '--name-only',
    '-z',
    '--diff-filter=D',
    'HEAD',
    '--',
  ]);
  if (tracked === null || untracked === null || deleted === null) {
    return {
      files: [],
      blockingReasons: ['production_change_authority_unavailable'],
    };
  }
  const deletedProductionFiles = nulSeparatedPaths(deleted).filter(isProductionPath);
  const files = [
    ...nulSeparatedPaths(tracked),
    ...nulSeparatedPaths(untracked),
  ]
    .filter(isProductionPath)
    .filter((filePath) => {
      const absolute = resolveInside(root, filePath);
      return Boolean(
        absolute &&
        fs.existsSync(absolute) &&
        fs.statSync(absolute).isFile()
      );
    });
  return {
    files: [...new Set(files)].sort(),
    blockingReasons:
      deletedProductionFiles.length > 0
        ? ['production_change_deletion_detected']
        : [],
  };
}

function productionScan(root: string, files: string[]): {
  forbiddenSeamScanResult: 'pass' | 'fail';
  hardcodedIdentityScanResult: 'pass' | 'fail';
  noProductionTestInjection: boolean;
  blockingReasons: string[];
} {
  const blockingReasons: string[] = [];
  for (const file of files) {
    const absolute = resolveInside(root, file);
    if (!absolute || !isProductionPath(normalizePath(file))) {
      blockingReasons.push(`production_file_path_invalid:${normalizePath(file)}`);
      continue;
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      blockingReasons.push(`production_file_missing:${normalizePath(file)}`);
      continue;
    }
    const content = fs.readFileSync(absolute, 'utf8');
    if (FORBIDDEN_PRODUCTION_PATTERNS.some((pattern) => pattern.test(content))) {
      blockingReasons.push('hardcoded_test_identity_detected');
    }
    if (/\b[A-Za-z]:[\\/]/u.test(content)) {
      blockingReasons.push('hardcoded_absolute_path_detected');
    }
    if (
      FORBIDDEN_AUTHORITY_RESULT_INJECTION_PATTERNS.some((pattern) =>
        pattern.test(content)
      )
    ) {
      blockingReasons.push('production_authority_result_injection_detected');
    }
  }
  const uniqueReasons = [...new Set(blockingReasons)];
  const invalidProductionPath = uniqueReasons.some((reason) =>
    reason.startsWith('production_file_')
  );
  const productionInjectionDetected = uniqueReasons.includes(
    'production_authority_result_injection_detected'
  );
  return {
    forbiddenSeamScanResult:
      invalidProductionPath || productionInjectionDetected ? 'fail' : 'pass',
    hardcodedIdentityScanResult: uniqueReasons.some((reason) =>
      reason.includes('hardcoded_')
    )
      ? 'fail'
      : 'pass',
    noProductionTestInjection: !productionInjectionDetected,
    blockingReasons: uniqueReasons,
  };
}

function validateHashBoundPaths(input: {
  root: string;
  freshnessRoot: string;
  paths: string[];
  hashes: string[];
  label: string;
  freshnessTimestamp: number;
}): string[] {
  const blockingReasons: string[] = [];
  if (input.paths.length !== input.hashes.length || input.paths.length === 0) {
    return [`${input.label}_paths_or_hashes_invalid`];
  }
  for (let index = 0; index < input.paths.length; index += 1) {
    const rawPath = input.paths[index];
    const absolute = resolveInside(input.root, rawPath);
    if (!absolute || !isInside(input.freshnessRoot, absolute)) {
      blockingReasons.push(`${input.label}_path_outside_freshness_root`);
      continue;
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      blockingReasons.push(`${input.label}_missing`);
      continue;
    }
    if (sha256File(absolute) !== input.hashes[index]) {
      blockingReasons.push(`${input.label}_hash_mismatch`);
    }
    if (fs.statSync(absolute).mtimeMs < input.freshnessTimestamp) {
      blockingReasons.push(`${input.label}_stale`);
    }
  }
  return [...new Set(blockingReasons)];
}

function normalizedCommand(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function validateProducerReceipts(input: {
  root: string;
  record: JsonObject;
  candidate: JsonObject;
  freshnessRoot: string;
  freshnessTimestamp: number;
}): string[] {
  const receiptPaths = strings(input.candidate.producerReceiptPaths);
  const receiptHashes = strings(input.candidate.producerReceiptHashes);
  const negativeCommands = strings(input.candidate.negativeCommands);
  const negativeRunIds = strings(input.candidate.negativeRunIds);
  const negativeResults = objects(input.candidate.negativeResults);
  const negativeLogPaths = strings(input.candidate.negativeLogPaths);
  const expectedRuns = [
    {
      runId: text(input.candidate.positiveRunId),
      command: text(input.candidate.positiveCommand),
      exitCode: Number(input.candidate.positiveExitCode),
      decision: 'pass',
      logPath: text(input.candidate.positiveLogPath),
      failureClass: '',
    },
    ...negativeRunIds.map((runId, index) => ({
      runId,
      command: negativeCommands[index] ?? '',
      exitCode: Number(negativeResults[index]?.exitCode),
      decision: 'block',
      logPath: negativeLogPaths[index] ?? '',
      failureClass: text(negativeResults[index]?.failureClass),
    })),
  ];
  const blockingReasons: string[] = [];
  if (receiptPaths.length !== expectedRuns.length || receiptHashes.length !== expectedRuns.length) {
    blockingReasons.push('producer_receipt_count_mismatch');
  }
  const observedRunIds = new Set<string>();
  for (let index = 0; index < receiptPaths.length; index += 1) {
    const validation = validateRequirementsContractCommandExecutionReceiptArtifact({
      projectRoot: input.root,
      receiptPath: receiptPaths[index],
      expectedProducer: {
        executorClass: 'controlled_detached_executor',
        executorId: 'requirements-contract-command-execution-producer/v1',
        writer: 'requirements-contract-command-execution-producer/v1',
      },
    });
    if (!validation.receipt) {
      blockingReasons.push(
        validation.issueCodes.includes('command_execution_receipt_schema_invalid')
          ? 'producer_receipt_schema_invalid'
          : 'producer_receipt_invalid'
      );
      continue;
    }
    if (
      validation.issueCodes.length > 0 ||
      validation.receiptHash !== receiptHashes[index]
    ) {
      blockingReasons.push('producer_receipt_integrity_invalid');
    }
    const receipt = validation.receipt as RequirementsContractCommandExecutionReceipt;
    if (observedRunIds.has(receipt.commandRunId)) {
      blockingReasons.push('producer_receipt_run_id_duplicate');
    }
    observedRunIds.add(receipt.commandRunId);
    const expected = expectedRuns.find((run) => run.runId === receipt.commandRunId);
    if (
      !expected ||
      normalizedCommand(receipt.command) !== normalizedCommand(expected.command) ||
      receipt.exitCode !== expected.exitCode ||
      receipt.decision !== expected.decision ||
      receipt.requirementSetId !== text(input.record.requirementSetId) ||
      receipt.inputSnapshotHash !== text(input.candidate.sourceSnapshotHash)
    ) {
      blockingReasons.push('producer_receipt_candidate_binding_invalid');
      continue;
    }
    const expectedLogPath = resolveInside(input.root, expected.logPath);
    const stdoutPath = resolveInside(input.root, receipt.stdoutPath);
    const stderrPath = resolveInside(input.root, receipt.stderrPath);
    if (
      !expectedLogPath ||
      (!sameResolvedPath(expectedLogPath, stdoutPath ?? '') &&
        !sameResolvedPath(expectedLogPath, stderrPath ?? ''))
    ) {
      blockingReasons.push('producer_receipt_log_binding_invalid');
    } else if (
      expected.failureClass &&
      !fs.readFileSync(expectedLogPath, 'utf8').includes(expected.failureClass)
    ) {
      blockingReasons.push('producer_receipt_failure_class_unobserved');
    }
    if (
      !validation.receiptPath ||
      !isInside(input.freshnessRoot, validation.receiptPath) ||
      fs.statSync(validation.receiptPath).mtimeMs < input.freshnessTimestamp
    ) {
      blockingReasons.push('producer_receipt_freshness_invalid');
    }
  }
  for (const expected of expectedRuns) {
    if (!observedRunIds.has(expected.runId)) {
      blockingReasons.push('producer_receipt_expected_run_missing');
    }
  }
  return [...new Set(blockingReasons)];
}

interface CleanMaterializationValidation {
  blockingReasons: string[];
  receiptPath: string;
  receiptFileHash: string;
  receiptAuthorityHash: string;
  reproducible: boolean;
}

function validateCleanMaterializationCommandReceipt(input: {
  role: 'INSTALL' | 'BUILD';
  receiptPath: string;
  expectedFileHash: string;
  materializationRoot: string;
  evidenceRoot: string;
  materializationRunId: string;
  sourceManifestHash: string;
  record: JsonObject;
  candidate: JsonObject;
  freshnessTimestamp: number;
}): string[] {
  const blockingReasons: string[] = [];
  const receiptPath = path.resolve(input.receiptPath);
  if (
    !input.receiptPath ||
    !isInside(input.evidenceRoot, receiptPath) ||
    !fs.existsSync(receiptPath) ||
    !fs.statSync(receiptPath).isFile()
  ) {
    return [`clean_materialization_${input.role.toLowerCase()}_receipt_missing`];
  }
  if (
    !SHA256.test(input.expectedFileHash) ||
    sha256File(receiptPath) !== input.expectedFileHash
  ) {
    blockingReasons.push(
      `clean_materialization_${input.role.toLowerCase()}_receipt_hash_mismatch`
    );
  }
  if (fs.statSync(receiptPath).mtimeMs < input.freshnessTimestamp) {
    blockingReasons.push(
      `clean_materialization_${input.role.toLowerCase()}_receipt_stale`
    );
  }
  const validation = validateRequirementsContractCommandExecutionReceiptArtifact({
    projectRoot: input.materializationRoot,
    receiptPath,
    expectedProducer: {
      executorClass: 'controlled_detached_executor',
      executorId: COMMAND_EXECUTION_PRODUCER_ID,
      writer: COMMAND_EXECUTION_PRODUCER_ID,
    },
  });
  if (!validation.receipt || validation.issueCodes.length > 0) {
    blockingReasons.push(
      `clean_materialization_${input.role.toLowerCase()}_receipt_invalid`
    );
    return [...new Set(blockingReasons)];
  }
  const receipt = validation.receipt as RequirementsContractCommandExecutionReceipt;
  const suffix = input.materializationRunId.replace(/^RUN-/u, '');
  if (
    receipt.commandRunId !== `RUN-${input.role}-${suffix}` ||
    receipt.commandId !== `CMD-MATERIALIZATION-${input.role}-${suffix}` ||
    receipt.decision !== 'pass' ||
    receipt.inputSnapshotHash !== input.sourceManifestHash ||
    receipt.requirementSetId !== text(input.record.requirementSetId) ||
    receipt.contractHash !== text(input.candidate.sourceDocumentHash)
  ) {
    blockingReasons.push(
      `clean_materialization_${input.role.toLowerCase()}_receipt_binding_invalid`
    );
  }
  return [...new Set(blockingReasons)];
}

function validateCleanMaterializationReceipt(input: {
  root: string;
  record: JsonObject;
  candidate: JsonObject;
  productionFiles: string[];
  freshnessRoot: string;
  freshnessTimestamp: number;
}): CleanMaterializationValidation {
  const blockingReasons: string[] = [];
  const rawReceiptPath = text(input.candidate.cleanMaterializationReceiptPath);
  const expectedFileHash = text(input.candidate.cleanMaterializationReceiptHash);
  const receiptPath = resolveInside(input.root, rawReceiptPath);
  if (
    !receiptPath ||
    !isInside(input.freshnessRoot, receiptPath) ||
    !fs.existsSync(receiptPath) ||
    !fs.statSync(receiptPath).isFile()
  ) {
    return {
      blockingReasons: ['clean_materialization_receipt_missing'],
      receiptPath: receiptPath ?? '',
      receiptFileHash: '',
      receiptAuthorityHash: '',
      reproducible: false,
    };
  }
  const receiptFileHash = sha256File(receiptPath);
  if (!SHA256.test(expectedFileHash) || receiptFileHash !== expectedFileHash) {
    blockingReasons.push('clean_materialization_receipt_hash_mismatch');
  }
  if (fs.statSync(receiptPath).mtimeMs < input.freshnessTimestamp) {
    blockingReasons.push('clean_materialization_receipt_stale');
  }
  let receipt: JsonObject;
  try {
    receipt = readJson(receiptPath);
  } catch {
    return {
      blockingReasons: [
        ...new Set([...blockingReasons, 'clean_materialization_receipt_invalid']),
      ],
      receiptPath,
      receiptFileHash,
      receiptAuthorityHash: '',
      reproducible: false,
    };
  }
  if (!validateCleanMaterializationReceiptSchema(receipt)) {
    blockingReasons.push('clean_materialization_receipt_schema_invalid');
  }
  const receiptAuthorityHash = text(receipt.receiptHash);
  const { receiptHash: _ignoredReceiptHash, ...receiptPayload } = receipt;
  if (
    !SHA256.test(receiptAuthorityHash) ||
    receiptAuthorityHash !== stableHash(receiptPayload)
  ) {
    blockingReasons.push('clean_materialization_receipt_authority_hash_invalid');
  }
  const expectedProductionFiles = [...input.productionFiles].map(normalizePath).sort();
  const sourceSnapshotPaths = strings(receipt.sourceSnapshotPaths)
    .map(normalizePath)
    .sort();
  if (
    JSON.stringify(sourceSnapshotPaths) !== JSON.stringify(expectedProductionFiles) ||
    text(receipt.sourceSnapshotHash) !== text(input.candidate.sourceSnapshotHash)
  ) {
    blockingReasons.push('clean_materialization_source_snapshot_hash_mismatch');
  }
  const materializationRoot = path.resolve(text(receipt.materializationRoot));
  if (
    !text(receipt.materializationRoot) ||
    isInside(input.root, materializationRoot) ||
    isInside(materializationRoot, input.root) ||
    !fs.existsSync(materializationRoot) ||
    !fs.statSync(materializationRoot).isDirectory()
  ) {
    blockingReasons.push('clean_materialization_root_invalid');
  }
  const materializationRunId = text(receipt.materializationRunId);
  const evidenceRoot = path.join(
    materializationRoot,
    '.bmad-materialization',
    materializationRunId
  );
  const sourceManifestPath = path.resolve(text(receipt.sourceManifestPath));
  let sourceManifestHash = '';
  if (
    !text(receipt.sourceManifestPath) ||
    !isInside(evidenceRoot, sourceManifestPath) ||
    !fs.existsSync(sourceManifestPath) ||
    !fs.statSync(sourceManifestPath).isFile()
  ) {
    blockingReasons.push('clean_materialization_source_manifest_missing');
  } else {
    try {
      const sourceManifest = readJson(sourceManifestPath);
      const entries = Array.isArray(sourceManifest.entries)
        ? sourceManifest.entries
        : [];
      sourceManifestHash = text(sourceManifest.manifestHash);
      if (
        !SHA256.test(sourceManifestHash) ||
        sourceManifestHash !== stableHash(entries) ||
        sourceManifestHash !== text(receipt.sourceManifestHash) ||
        Number(receipt.sourceFileCount) !== entries.length
      ) {
        blockingReasons.push('clean_materialization_source_manifest_invalid');
      }
    } catch {
      blockingReasons.push('clean_materialization_source_manifest_invalid');
    }
  }
  if (receipt.sourceWasCleanOfBuildOutputs !== true) {
    blockingReasons.push('clean_materialization_source_not_clean');
  }
  const startedAt = Date.parse(text(receipt.startedAt));
  const completedAt = Date.parse(text(receipt.completedAt));
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    startedAt > completedAt ||
    completedAt < input.freshnessTimestamp
  ) {
    blockingReasons.push('clean_materialization_timestamp_invalid');
  }
  blockingReasons.push(
    ...validateCleanMaterializationCommandReceipt({
      role: 'INSTALL',
      receiptPath: text(receipt.installReceiptPath),
      expectedFileHash: text(receipt.installReceiptHash),
      materializationRoot,
      evidenceRoot,
      materializationRunId,
      sourceManifestHash,
      record: input.record,
      candidate: input.candidate,
      freshnessTimestamp: input.freshnessTimestamp,
    }),
    ...validateCleanMaterializationCommandReceipt({
      role: 'BUILD',
      receiptPath: text(receipt.buildReceiptPath),
      expectedFileHash: text(receipt.buildReceiptHash),
      materializationRoot,
      evidenceRoot,
      materializationRunId,
      sourceManifestHash,
      record: input.record,
      candidate: input.candidate,
      freshnessTimestamp: input.freshnessTimestamp,
    })
  );
  const runtimeBuildAuthorityReceiptPath = path.resolve(
    text(receipt.runtimeBuildAuthorityReceiptPath)
  );
  const freshPackageRoot = path.join(materializationRoot, 'packages', 'bmad-speckit');
  const expectedRuntimeBuildAuthorityReceiptPath = path.join(
    freshPackageRoot,
    'dist',
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  if (
    !text(receipt.runtimeBuildAuthorityReceiptPath) ||
    !sameResolvedPath(
      runtimeBuildAuthorityReceiptPath,
      expectedRuntimeBuildAuthorityReceiptPath
    ) ||
    !fs.existsSync(runtimeBuildAuthorityReceiptPath) ||
    !fs.statSync(runtimeBuildAuthorityReceiptPath).isFile() ||
    sha256File(runtimeBuildAuthorityReceiptPath) !==
      text(receipt.runtimeBuildAuthorityReceiptHash)
  ) {
    blockingReasons.push('clean_materialization_runtime_authority_receipt_invalid');
  } else {
    try {
      const runtimeAuthority = assertRuntimeBuildAuthorityCurrent({
        receipt: readJson(runtimeBuildAuthorityReceiptPath),
        packageRoot: freshPackageRoot,
        runtimeAssetManifestPath: path.join(
          freshPackageRoot,
          'dist',
          'main-agent',
          'runtime-asset-manifest.json'
        ),
        buildScriptPath: path.join(
          freshPackageRoot,
          'scripts',
          'build-main-agent-dist.cjs'
        ),
        dependencyLockPath: path.join(materializationRoot, 'package-lock.json'),
      });
      if (
        runtimeAuthority.distRuntimeHash !== text(receipt.freshDistHash) ||
        runtimeAuthority.packageRuntimeHash !== text(receipt.freshPackageHash)
      ) {
        blockingReasons.push('clean_materialization_runtime_authority_binding_invalid');
      }
    } catch {
      blockingReasons.push('clean_materialization_runtime_authority_receipt_invalid');
    }
  }
  if (
    text(receipt.currentDistHash) !== text(input.candidate.distHash) ||
    text(receipt.currentPackageHash) !== text(input.candidate.packageHash) ||
    text(receipt.freshDistHash) !== text(receipt.currentDistHash) ||
    text(receipt.freshPackageHash) !== text(receipt.currentPackageHash) ||
    receipt.distParity !== true ||
    receipt.packageParity !== true ||
    text(receipt.decision) !== 'pass'
  ) {
    blockingReasons.push('clean_materialization_runtime_parity_invalid');
  }
  const uniqueReasons = [...new Set(blockingReasons)];
  return {
    blockingReasons: uniqueReasons,
    receiptPath,
    receiptFileHash,
    receiptAuthorityHash,
    reproducible: uniqueReasons.length === 0,
  };
}

function validateCandidate(input: {
  candidate: JsonObject;
  candidateHash: string;
  candidatePath: string;
  record: JsonObject;
  root: string;
}): {
  hardFailureReasons: string[];
  blockingReasons: string[];
  productionFiles: string[];
  freshnessRoot: string;
  freshnessTimestamp: number;
  candidateHash: string;
  cleanMaterialization: CleanMaterializationValidation;
} {
  const candidate = input.candidate;
  const hardFailureReasons: string[] = [];
  const blockingReasons: string[] = [];
  for (const field of FORBIDDEN_CANDIDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(candidate, field)) {
      hardFailureReasons.push(`candidate_field_forbidden:${field}`);
    }
  }
  const gapId = text(candidate.gapId);
  if (!GAP_ID.test(gapId)) hardFailureReasons.push('gap_id_invalid');
  if (!['Open', 'Implemented'].includes(text(candidate.status))) {
    hardFailureReasons.push('candidate_status_invalid');
  }
  const requiredTextFields = [
    'sourceSnapshotHash',
    'productionEntry',
    'positiveCommand',
    'positiveRunId',
    'positiveLogPath',
    'positiveLogHash',
    'independentOracleId',
    'sourceDocumentHash',
    'semanticModelHash',
    'projectionSetHash',
    'distHash',
    'packageHash',
    'cleanMaterializationReceiptPath',
    'cleanMaterializationReceiptHash',
    'freshnessRoot',
    'freshnessTimestamp',
  ];
  for (const field of requiredTextFields) {
    if (!text(candidate[field])) hardFailureReasons.push(`candidate_${field}_missing`);
  }
  const candidateProductionFiles = strings(candidate.changedProductionFiles)
    .map(normalizePath)
    .sort();
  if (candidateProductionFiles.length === 0) {
    hardFailureReasons.push('candidate_changed_production_files_missing');
  }
  const observedChanges = deriveGitObservedProductionChanges(input.root);
  blockingReasons.push(...observedChanges.blockingReasons);
  const productionFiles =
    observedChanges.files.length > 0
      ? observedChanges.files
      : candidateProductionFiles;
  if (
    observedChanges.files.length > 0 &&
    JSON.stringify(candidateProductionFiles) !== JSON.stringify(observedChanges.files)
  ) {
    blockingReasons.push('changed_production_files_mismatch');
  }
  if (objects(candidate.productionCallChain).length > 0 || strings(candidate.productionCallChain).length === 0) {
    hardFailureReasons.push('candidate_production_call_chain_invalid');
  }
  const numericFields = ['positiveExitCode', 'positivePassed', 'positiveFailed', 'positiveSkipped'];
  for (const field of numericFields) {
    if (typeof candidate[field] !== 'number' || !Number.isFinite(candidate[field])) {
      hardFailureReasons.push(`candidate_${field}_invalid`);
    }
  }
  if (candidate.positiveExitCode !== 0) blockingReasons.push('positive_exit_code_not_zero');
  if (candidate.positivePassed !== undefined && Number(candidate.positivePassed) <= 0) {
    blockingReasons.push('positive_pass_count_missing');
  }
  if (candidate.positiveFailed !== 0) blockingReasons.push('positive_failed_count_not_zero');
  const negativeCommands = strings(candidate.negativeCommands);
  const negativeRunIds = strings(candidate.negativeRunIds);
  const negativeResults = objects(candidate.negativeResults);
  const negativeLogPaths = strings(candidate.negativeLogPaths);
  if (
    negativeCommands.length === 0 ||
    negativeCommands.length !== negativeRunIds.length ||
    negativeCommands.length !== negativeResults.length ||
    negativeCommands.length !== negativeLogPaths.length
  ) {
    hardFailureReasons.push('negative_controls_invalid');
  }
  if (hasDuplicates(negativeCommands)) blockingReasons.push('negative_command_duplicate');
  if (hasDuplicates(negativeRunIds)) blockingReasons.push('negative_run_id_duplicate');
  if (hasDuplicates(negativeLogPaths)) blockingReasons.push('negative_log_path_duplicate');
  if (
    negativeResults.some(
      (result) => !text(result.failureClass) || typeof result.exitCode !== 'number' || result.exitCode === 0
    )
  ) {
    hardFailureReasons.push('negative_control_result_invalid');
  }
  const freshnessRoot = resolveInside(input.root, text(candidate.freshnessRoot));
  if (!freshnessRoot || !fs.existsSync(freshnessRoot) || !fs.statSync(freshnessRoot).isDirectory()) {
    hardFailureReasons.push('freshness_root_invalid');
  }
  const freshnessTimestamp = Date.parse(text(candidate.freshnessTimestamp));
  if (!Number.isFinite(freshnessTimestamp)) hardFailureReasons.push('freshness_timestamp_invalid');
  if (Number.isFinite(freshnessTimestamp)) {
    const candidateMtime = fs.statSync(input.candidatePath).mtimeMs;
    if (
      freshnessTimestamp < candidateMtime - 5 * 60_000 ||
      freshnessTimestamp > candidateMtime + 30_000
    ) {
      blockingReasons.push('freshness_timestamp_out_of_window');
    }
  }
  const producerReceiptPaths = strings(candidate.producerReceiptPaths);
  const producerReceiptHashes = strings(candidate.producerReceiptHashes);
  if (hasDuplicates(producerReceiptPaths)) {
    blockingReasons.push('producer_receipt_path_duplicate');
  }
  if (hasDuplicates(producerReceiptHashes)) {
    blockingReasons.push('producer_receipt_hash_duplicate');
  }
  if (
    !SHA256.test(text(candidate.sourceSnapshotHash)) ||
    !SHA256.test(text(candidate.positiveLogHash)) ||
    !SHA256.test(text(candidate.sourceDocumentHash)) ||
    !SHA256.test(text(candidate.semanticModelHash)) ||
    !SHA256.test(text(candidate.projectionSetHash)) ||
    !SHA256.test(text(candidate.distHash)) ||
    !SHA256.test(text(candidate.packageHash)) ||
    !SHA256.test(text(candidate.cleanMaterializationReceiptHash))
  ) {
    hardFailureReasons.push('candidate_hash_invalid');
  }
  try {
    const packageRoot = path.dirname(resolvePackageBmadRoot());
    if (text(candidate.distHash) !== distRuntimeHashFor(packageRoot)) {
      blockingReasons.push('dist_hash_not_current');
    }
    if (text(candidate.packageHash) !== packageRuntimeHashFor(packageRoot)) {
      blockingReasons.push('package_hash_not_current');
    }
  } catch {
    blockingReasons.push('package_runtime_hash_authority_unavailable');
  }
  if (text(candidate.sourceDocumentHash) !== text(input.record.sourceDocumentHash)) {
    blockingReasons.push('source_document_hash_not_current');
  }
  if (text(input.record.semanticModelHash) && text(candidate.semanticModelHash) !== text(input.record.semanticModelHash)) {
    blockingReasons.push('semantic_model_hash_not_current');
  }
  if (
    text(input.record.projectionSetHash) &&
    text(candidate.projectionSetHash) !== text(input.record.projectionSetHash)
  ) {
    blockingReasons.push('projection_set_hash_not_current');
  }
  if (hardFailureReasons.length === 0 && freshnessRoot) {
    try {
      if (sourceSnapshotHash(input.root, productionFiles) !== text(candidate.sourceSnapshotHash)) {
        blockingReasons.push('source_snapshot_hash_mismatch');
      }
    } catch (error) {
      blockingReasons.push(error instanceof Error ? error.message : String(error));
    }
    blockingReasons.push(
      ...validateHashBoundPaths({
        root: input.root,
        freshnessRoot,
        paths: [text(candidate.positiveLogPath)],
        hashes: [text(candidate.positiveLogHash)],
        label: 'positive_log',
        freshnessTimestamp,
      }),
      ...validateHashBoundPaths({
        root: input.root,
        freshnessRoot,
        paths: negativeLogPaths,
        hashes: negativeLogPaths.map((filePath) => {
          const absolute = resolveInside(input.root, filePath);
          return absolute && fs.existsSync(absolute) ? sha256File(absolute) : '';
        }),
        label: 'negative_log',
        freshnessTimestamp,
      }),
      ...validateHashBoundPaths({
        root: input.root,
        freshnessRoot,
        paths: producerReceiptPaths,
        hashes: producerReceiptHashes,
        label: 'producer_receipt',
        freshnessTimestamp,
      }),
      ...validateProducerReceipts({
        root: input.root,
        record: input.record,
        candidate,
        freshnessRoot,
        freshnessTimestamp,
      })
    );
    const scan = productionScan(input.root, productionFiles);
    blockingReasons.push(...scan.blockingReasons);
  }
  const cleanMaterialization =
    hardFailureReasons.length === 0 && freshnessRoot
      ? validateCleanMaterializationReceipt({
          root: input.root,
          record: input.record,
          candidate,
          productionFiles,
          freshnessRoot,
          freshnessTimestamp,
        })
      : {
          blockingReasons: ['clean_materialization_candidate_invalid'],
          receiptPath: '',
          receiptFileHash: '',
          receiptAuthorityHash: '',
          reproducible: false,
        };
  blockingReasons.push(...cleanMaterialization.blockingReasons);
  return {
    hardFailureReasons: [...new Set(hardFailureReasons)],
    blockingReasons: [...new Set(blockingReasons)],
    productionFiles,
    freshnessRoot: freshnessRoot ?? '',
    freshnessTimestamp,
    candidateHash: input.candidateHash,
    cleanMaterialization,
  };
}

interface ProtectedFileSnapshot {
  path: string;
  hash: string;
}

function snapshotProtectedFiles(filePaths: string[]): ProtectedFileSnapshot[] {
  return [...new Set(filePaths.map((filePath) => path.resolve(filePath)))]
    .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
    .map((filePath) => ({
      path: filePath,
      hash: sha256File(filePath),
    }));
}

function changedProtectedFiles(snapshots: ProtectedFileSnapshot[]): string[] {
  return snapshots
    .filter(
      (snapshot) =>
        !fs.existsSync(snapshot.path) ||
        !fs.statSync(snapshot.path).isFile() ||
        sha256File(snapshot.path) !== snapshot.hash
    )
    .map((snapshot) => normalizePath(snapshot.path));
}

function validateProviderInvocation(input: {
  value: JsonObject | null;
  root: string;
  freshnessRoot: string;
  freshnessTimestamp: number;
}): {
  blockingReasons: string[];
  implementationPath: string;
  implementationHash: string;
} {
  const blockingReasons: string[] = [];
  const provider = input.value;
  if (!provider) {
    return {
      blockingReasons: ['independent_auditor_provider_invocation_missing'],
      implementationPath: '',
      implementationHash: '',
    };
  }
  if (
    text(provider.transport) !== 'codex_cli' ||
    text(provider.sandboxMode) !== 'read-only' ||
    provider.ephemeral !== true ||
    Number(provider.exitCode) !== 0 ||
    !Number.isInteger(provider.eventCount) ||
    Number(provider.eventCount) <= 0 ||
    text(provider.eventLogPath) !== text(provider.stdoutPath) ||
    text(provider.eventLogHash) !== text(provider.stdoutHash)
  ) {
    blockingReasons.push('independent_auditor_provider_invocation_invalid');
  }
  if (
    !Number.isFinite(Date.parse(text(provider.startedAt))) ||
    !Number.isFinite(Date.parse(text(provider.completedAt)))
  ) {
    blockingReasons.push('independent_auditor_provider_timestamp_invalid');
  }
  const implementationPath = path.resolve(text(provider.implementationPath));
  const implementationHash = text(provider.implementationHash);
  if (
    !text(provider.implementationPath) ||
    !SHA256.test(implementationHash) ||
    !fs.existsSync(implementationPath) ||
    !fs.statSync(implementationPath).isFile() ||
    sha256File(implementationPath) !== implementationHash
  ) {
    blockingReasons.push('independent_auditor_provider_implementation_invalid');
  }
  const artifactFields = [
    ['stdoutPath', 'stdoutHash'],
    ['stderrPath', 'stderrHash'],
    ['rawResponsePath', 'rawResponseHash'],
  ] as const;
  const artifactPaths: string[] = [];
  for (const [pathField, hashField] of artifactFields) {
    const rawPath = text(provider[pathField]);
    const expectedHash = text(provider[hashField]);
    const artifactPath = resolveInside(input.root, rawPath);
    if (
      !artifactPath ||
      !isInside(input.freshnessRoot, artifactPath) ||
      !SHA256.test(expectedHash) ||
      !fs.existsSync(artifactPath) ||
      !fs.statSync(artifactPath).isFile()
    ) {
      blockingReasons.push('independent_auditor_provider_artifact_invalid');
      continue;
    }
    artifactPaths.push(normalizePath(artifactPath));
    if (sha256File(artifactPath) !== expectedHash) {
      blockingReasons.push('independent_auditor_provider_artifact_hash_mismatch');
    }
    if (fs.statSync(artifactPath).mtimeMs < input.freshnessTimestamp) {
      blockingReasons.push('independent_auditor_provider_artifact_stale');
    }
  }
  if (hasDuplicates(artifactPaths)) {
    blockingReasons.push('independent_auditor_provider_artifact_reused');
  }
  return {
    blockingReasons: [...new Set(blockingReasons)],
    implementationPath:
      fs.existsSync(implementationPath) && fs.statSync(implementationPath).isFile()
        ? implementationPath
        : '',
    implementationHash,
  };
}

function validateAuditReceipt(input: {
  receiptPath: string;
  candidate: JsonObject;
  candidateHash: string;
  root: string;
  freshnessRoot: string;
  freshnessTimestamp: number;
}): { decision: 'PASS' | 'FAIL'; blockingReasons: string[]; receipt: JsonObject | null } {
  if (!fs.existsSync(input.receiptPath)) {
    return { decision: 'FAIL', blockingReasons: ['independent_audit_receipt_missing'], receipt: null };
  }
  let receipt: JsonObject;
  try {
    receipt = readJson(input.receiptPath);
  } catch (error) {
    return {
      decision: 'FAIL',
      blockingReasons: [error instanceof Error ? error.message : String(error)],
      receipt: null,
    };
  }
  const blockingReasons: string[] = [];
  if (text(receipt.schemaVersion) !== 'gap-closure-independent-audit-receipt/v1') {
    blockingReasons.push('independent_audit_receipt_schema_invalid');
  }
  if (text(receipt.gapId) !== text(input.candidate.gapId)) {
    blockingReasons.push('independent_audit_gap_id_mismatch');
  }
  if (text(receipt.candidateHash) !== input.candidateHash) {
    blockingReasons.push('independent_audit_candidate_hash_mismatch');
  }
  if (text(receipt.auditorRole) !== 'readonly_independent_auditor') {
    blockingReasons.push('independent_audit_role_invalid');
  }
  if (text(receipt.transport) !== 'external_process') {
    blockingReasons.push('independent_audit_transport_invalid');
  }
  if (!text(receipt.auditorRunId)) blockingReasons.push('independent_audit_run_id_missing');
  if (!Number.isFinite(Date.parse(text(receipt.auditedAt)))) {
    blockingReasons.push('independent_audit_timestamp_invalid');
  }
  if (text(receipt.decision) !== 'PASS' && text(receipt.decision) !== 'FAIL') {
    blockingReasons.push('independent_audit_decision_invalid');
  }
  const receiptFindings = objects(receipt.findings);
  for (const finding of receiptFindings) {
    const code = text(finding.code);
    if (code) blockingReasons.push(code);
  }
  if (text(receipt.decision) === 'PASS' && receiptFindings.length > 0) {
    blockingReasons.push('independent_audit_pass_with_findings_forbidden');
  }
  const verifiedConditions = object(receipt.verifiedConditions);
  if (verifiedConditions?.noProductionTestInjection !== true) {
    blockingReasons.push('independent_audit_no_production_test_injection_not_verified');
  }
  if (verifiedConditions?.noHardcodedMachineIdentity !== true) {
    blockingReasons.push('independent_audit_no_hardcoded_machine_identity_not_verified');
  }
  if (verifiedConditions?.cleanMaterializationReproducible !== true) {
    blockingReasons.push('independent_audit_clean_materialization_not_verified');
  }
  let authority: ReadonlyAuditorAuthority | null = null;
  try {
    authority = resolveReadonlyAuditorAuthority(input.root);
  } catch {
    blockingReasons.push('independent_auditor_authority_unavailable');
  }
  if (
    !authority ||
    !sameResolvedPath(
      text(receipt.auditorImplementationPath),
      authority.adapterPath
    ) ||
    text(receipt.auditorImplementationHash) !== authority.adapterHash ||
    text(receipt.actionBindingManifestHash) !== authority.actionBindingManifestHash ||
    text(receipt.canonicalAssetsManifestHash) !== authority.canonicalAssetsManifestHash ||
    text(receipt.criticalAuditorProfileHash) !== authority.criticalAuditorProfileHash ||
    text(receipt.criticalAuditorProfileDeclaredHash) !==
      authority.criticalAuditorProfileDeclaredHash
  ) {
    blockingReasons.push('independent_auditor_adapter_authority_invalid');
  }
  const providerValidation = validateProviderInvocation({
    value: object(receipt.providerInvocation),
    root: input.root,
    freshnessRoot: input.freshnessRoot,
    freshnessTimestamp: input.freshnessTimestamp,
  });
  blockingReasons.push(...providerValidation.blockingReasons);
  if (
    !providerValidation.implementationPath ||
    !sameResolvedPath(
      text(receipt.independentOracleImplementationPath),
      providerValidation.implementationPath
    ) ||
    text(receipt.independentOracleImplementationHash) !==
      providerValidation.implementationHash
  ) {
    blockingReasons.push('independent_oracle_implementation_invalid');
  } else if (
    isInside(input.root, providerValidation.implementationPath) ||
    isInside(input.freshnessRoot, providerValidation.implementationPath)
  ) {
    blockingReasons.push('independent_oracle_candidate_selection_forbidden');
  } else if (
    /\.(?:c?js|mjs|ts)$/iu.test(providerValidation.implementationPath) &&
    fs.statSync(providerValidation.implementationPath).size <= 5 * 1024 * 1024
  ) {
    const implementationSource = fs.readFileSync(
      providerValidation.implementationPath,
      'utf8'
    );
    if (
      /packages[\\/]bmad-speckit[\\/]src[\\/]main-agent/iu.test(implementationSource) ||
      /source-authority[\\/]scripts/iu.test(implementationSource)
    ) {
      blockingReasons.push('independent_oracle_imports_production_helper');
    }
  }
  const requestPath = resolveInside(input.root, text(receipt.requestPath));
  let request: JsonObject | null = null;
  if (
    !requestPath ||
    !isInside(input.freshnessRoot, requestPath) ||
    !fs.existsSync(requestPath) ||
    !fs.statSync(requestPath).isFile()
  ) {
    blockingReasons.push('independent_audit_request_invalid');
  } else {
    try {
      request = readJson(requestPath);
      const requestHash = text(request.requestHash);
      const { requestHash: _ignoredRequestHash, ...requestPayload } = request;
      if (
        requestHash !== sha256Json(requestPayload) ||
        requestHash !== text(receipt.requestHash) ||
        text(request.candidateHash) !== input.candidateHash ||
        text(request.gapId) !== text(input.candidate.gapId) ||
        text(request.cleanMaterializationReceiptPath) !==
          text(input.candidate.cleanMaterializationReceiptPath) ||
        text(request.cleanMaterializationReceiptHash) !==
          text(input.candidate.cleanMaterializationReceiptHash) ||
        (authority !== null &&
          (text(request.auditorAdapterHash) !== authority.adapterHash ||
            text(request.actionBindingManifestHash) !==
              authority.actionBindingManifestHash ||
            text(request.canonicalAssetsManifestHash) !==
              authority.canonicalAssetsManifestHash ||
            text(request.criticalAuditorProfileHash) !==
              authority.criticalAuditorProfileHash))
      ) {
        blockingReasons.push('independent_audit_request_binding_invalid');
      }
    } catch {
      blockingReasons.push('independent_audit_request_invalid');
    }
  }
  const invocationReceiptPath = resolveInside(input.root, text(receipt.invocationReceiptPath));
  if (
    !invocationReceiptPath ||
    !isInside(input.freshnessRoot, invocationReceiptPath) ||
    !fs.existsSync(invocationReceiptPath) ||
    sha256File(invocationReceiptPath) !== text(receipt.invocationReceiptHash)
  ) {
    blockingReasons.push('independent_audit_invocation_receipt_invalid');
  } else {
    if (fs.statSync(invocationReceiptPath).mtimeMs < input.freshnessTimestamp) {
      blockingReasons.push('independent_audit_invocation_receipt_stale');
    }
    let invocationReceipt: JsonObject | null = null;
    try {
      invocationReceipt = readJson(invocationReceiptPath);
    } catch {
      blockingReasons.push('independent_audit_invocation_receipt_invalid');
    }
    if (invocationReceipt) {
      const invocationReceiptHash = text(invocationReceipt.receiptHash);
      const { receiptHash: _ignoredReceiptHash, ...invocationPayload } = invocationReceipt;
      if (
        text(invocationReceipt.schemaVersion) !==
          'gap-closure-audit-host-invocation-receipt/v1' ||
        text(invocationReceipt.executorIdentity) !==
          'main-agent-controlled-external-auditor/v1' ||
        text(invocationReceipt.candidateHash) !== input.candidateHash ||
        Number(invocationReceipt.exitCode) !== 0 ||
        text(invocationReceipt.authorityTrusted) !== 'true' &&
          invocationReceipt.authorityTrusted !== true ||
        text(invocationReceipt.requestHash) !== text(receipt.requestHash) ||
        !SHA256.test(text(invocationReceipt.stdoutHash)) ||
        !SHA256.test(text(invocationReceipt.stderrHash)) ||
        !SHA256.test(text(invocationReceipt.responseHash)) ||
        text(invocationReceipt.responseHash) !== text(receipt.responseHash) ||
        text(invocationReceipt.auditorImplementationPath) !==
          text(receipt.auditorImplementationPath) ||
        text(invocationReceipt.auditorImplementationHash) !==
          text(receipt.auditorImplementationHash) ||
        text(invocationReceipt.actionBindingManifestHash) !==
          text(receipt.actionBindingManifestHash) ||
        text(invocationReceipt.canonicalAssetsManifestHash) !==
          text(receipt.canonicalAssetsManifestHash) ||
        text(invocationReceipt.criticalAuditorProfileHash) !==
          text(receipt.criticalAuditorProfileHash) ||
        text(invocationReceipt.providerInvocationHash) !==
          sha256Json(object(receipt.providerInvocation)) ||
        invocationReceiptHash !== sha256Json(invocationPayload)
      ) {
        blockingReasons.push('independent_audit_invocation_receipt_not_controlled');
      }
    }
  }
  if (fs.statSync(input.receiptPath).mtimeMs < input.freshnessTimestamp) {
    blockingReasons.push('independent_audit_receipt_stale');
  }
  return {
    decision: text(receipt.decision) === 'PASS' ? 'PASS' : 'FAIL',
    blockingReasons: [...new Set(blockingReasons)],
    receipt,
  };
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

function executeIndependentAudit(input: {
  root: string;
  recordPath: string;
  record: JsonObject;
  candidatePath: string;
  candidate: JsonObject;
  candidateHash: string;
  productionFiles: string[];
  freshnessRoot: string;
  freshnessTimestamp: number;
  auditorCommand?: string;
}): string {
  const authority = resolveReadonlyAuditorAuthority(input.root);
  const requestedCommand = input.auditorCommand
    ? parseAuditorCommand(input.auditorCommand)
    : null;
  const command = authority.command;
  const auditorImplementationPath = authority.adapterPath;
  const evidenceRoot = path.dirname(input.candidatePath);
  const requestPath = path.join(evidenceRoot, 'independent-audit-request.json');
  const invocationReceiptPath = path.join(
    evidenceRoot,
    'audit-host-invocation-receipt.json'
  );
  const auditReceiptPath = path.join(evidenceRoot, 'independent-audit-receipt.json');
  if (
    [requestPath, invocationReceiptPath, auditReceiptPath].some((filePath) =>
      fs.existsSync(filePath)
    )
  ) {
    throw new Error('gap_closure_audit_artifact_replay_forbidden');
  }
  const requestPayload = {
    schemaVersion: 'gap-closure-independent-audit-request/v1',
    gapId: text(input.candidate.gapId),
    candidatePath: normalizePath(input.candidatePath),
    candidateHash: input.candidateHash,
    requirementRecordPath: normalizePath(input.recordPath),
    requirementRecordHash: sha256File(input.recordPath),
    projectRoot: normalizePath(input.root),
    freshnessRoot: normalizePath(input.freshnessRoot),
    sourceSnapshotHash: text(input.candidate.sourceSnapshotHash),
    sourceDocumentHash: text(input.candidate.sourceDocumentHash),
    semanticModelHash: text(input.candidate.semanticModelHash),
    projectionSetHash: text(input.candidate.projectionSetHash),
    productionEntry: text(input.candidate.productionEntry),
    productionCallChain: strings(input.candidate.productionCallChain),
    changedProductionFiles: input.productionFiles,
    positiveCommand: text(input.candidate.positiveCommand),
    positiveRunId: text(input.candidate.positiveRunId),
    positiveLogPath: text(input.candidate.positiveLogPath),
    positiveLogHash: text(input.candidate.positiveLogHash),
    negativeCommands: strings(input.candidate.negativeCommands),
    negativeRunIds: strings(input.candidate.negativeRunIds),
    negativeResults: objects(input.candidate.negativeResults),
    negativeLogPaths: strings(input.candidate.negativeLogPaths),
    producerReceiptPaths: strings(input.candidate.producerReceiptPaths),
    producerReceiptHashes: strings(input.candidate.producerReceiptHashes),
    distHash: text(input.candidate.distHash),
    packageHash: text(input.candidate.packageHash),
    cleanMaterializationReceiptPath: text(
      input.candidate.cleanMaterializationReceiptPath
    ),
    cleanMaterializationReceiptHash: text(
      input.candidate.cleanMaterializationReceiptHash
    ),
    auditorAdapterPath: normalizePath(authority.adapterPath),
    auditorAdapterHash: authority.adapterHash,
    actionBindingManifestPath: normalizePath(authority.actionBindingManifestPath),
    actionBindingManifestHash: authority.actionBindingManifestHash,
    canonicalAssetsManifestPath: normalizePath(authority.canonicalAssetsManifestPath),
    canonicalAssetsManifestHash: authority.canonicalAssetsManifestHash,
    criticalAuditorProfilePath: normalizePath(authority.criticalAuditorProfilePath),
    criticalAuditorProfileHash: authority.criticalAuditorProfileHash,
    criticalAuditorProfileDeclaredHash: authority.criticalAuditorProfileDeclaredHash,
    requestedAt: new Date().toISOString(),
  };
  const request = {
    ...requestPayload,
    requestHash: sha256Json(requestPayload),
  };
  writeJsonAtomic(requestPath, request);
  if (!isTrustedReadonlyAuditorCommand(requestedCommand, authority)) {
    const rejectedAt = new Date().toISOString();
    const responseHash = sha256('');
    const hostPayload = {
      schemaVersion: 'gap-closure-audit-host-invocation-receipt/v1',
      executorIdentity: 'main-agent-controlled-external-auditor/v1',
      candidateHash: input.candidateHash,
      requestPath: normalizePath(requestPath),
      requestHash: request.requestHash,
      auditorCommand: command,
      auditorCommandHash: sha256Json(command),
      requestedAuditorCommand: requestedCommand,
      requestedAuditorCommandHash:
        requestedCommand === null ? null : sha256Json(requestedCommand),
      auditorImplementationPath: normalizePath(auditorImplementationPath),
      auditorImplementationHash: authority.adapterHash,
      actionBindingManifestPath: normalizePath(authority.actionBindingManifestPath),
      actionBindingManifestHash: authority.actionBindingManifestHash,
      canonicalAssetsManifestPath: normalizePath(authority.canonicalAssetsManifestPath),
      canonicalAssetsManifestHash: authority.canonicalAssetsManifestHash,
      criticalAuditorProfilePath: normalizePath(authority.criticalAuditorProfilePath),
      criticalAuditorProfileHash: authority.criticalAuditorProfileHash,
      criticalAuditorProfileDeclaredHash: authority.criticalAuditorProfileDeclaredHash,
      startedAt: rejectedAt,
      completedAt: rejectedAt,
      exitCode: 126,
      signal: null,
      stdoutHash: sha256(''),
      stderrHash: sha256('independent_auditor_authority_untrusted'),
      responseHash,
      providerInvocationHash: null,
      readonlyBoundaryViolations: [],
      authorityTrusted: false,
      failureClass: 'independent_auditor_authority_untrusted',
    };
    const hostReceipt = {
      ...hostPayload,
      receiptHash: sha256Json(hostPayload),
    };
    writeJsonAtomic(invocationReceiptPath, hostReceipt);
    const auditReceipt = {
      schemaVersion: 'gap-closure-independent-audit-receipt/v1',
      gapId: text(input.candidate.gapId),
      candidateHash: input.candidateHash,
      auditorRole: 'readonly_independent_auditor',
      transport: 'external_process',
      auditorRunId: `audit-run-rejected-${sha256Json(hostReceipt).slice(-16)}`,
      auditedAt: rejectedAt,
      decision: 'FAIL',
      verifiedConditions: {
        noProductionTestInjection: false,
        noHardcodedMachineIdentity: false,
        cleanMaterializationReproducible: false,
      },
      findings: [{ code: 'independent_auditor_authority_untrusted' }],
      auditorImplementationPath: normalizePath(auditorImplementationPath),
      auditorImplementationHash: authority.adapterHash,
      independentOracleImplementationPath: '',
      independentOracleImplementationHash: '',
      providerInvocation: null,
      actionBindingManifestPath: normalizePath(authority.actionBindingManifestPath),
      actionBindingManifestHash: authority.actionBindingManifestHash,
      canonicalAssetsManifestPath: normalizePath(authority.canonicalAssetsManifestPath),
      canonicalAssetsManifestHash: authority.canonicalAssetsManifestHash,
      criticalAuditorProfilePath: normalizePath(authority.criticalAuditorProfilePath),
      criticalAuditorProfileHash: authority.criticalAuditorProfileHash,
      criticalAuditorProfileDeclaredHash: authority.criticalAuditorProfileDeclaredHash,
      requestPath: normalizePath(requestPath),
      requestHash: request.requestHash,
      responseHash,
      invocationReceiptPath: normalizePath(invocationReceiptPath),
      invocationReceiptHash: sha256File(invocationReceiptPath),
    };
    writeJsonAtomic(auditReceiptPath, auditReceipt);
    return auditReceiptPath;
  }
  const protectedFiles = snapshotProtectedFiles([
    input.recordPath,
    input.candidatePath,
    requestPath,
    auditorImplementationPath,
    authority.actionBindingManifestPath,
    authority.canonicalAssetsManifestPath,
    authority.criticalAuditorProfilePath,
    ...[
      resolveInside(
        input.root,
        text(input.candidate.cleanMaterializationReceiptPath)
      ),
    ].filter((filePath): filePath is string => Boolean(filePath)),
    ...input.productionFiles
      .map((filePath) => resolveInside(input.root, filePath))
      .filter((filePath): filePath is string => Boolean(filePath)),
  ]);
  const startedAt = new Date().toISOString();
  const execution = spawnSync(
    command[0],
    [...command.slice(1), '--request', requestPath, '--json'],
    {
      cwd: input.root,
      encoding: 'utf8',
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^BMAD_GAP_CLOSURE_(?:VERDICT|RESULT|RECEIPT)$/u.test(key)
        )
      ),
      shell: false,
      timeout: 120_000,
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
    }
  );
  const completedAt = new Date().toISOString();
  const stdout = execution.stdout ?? '';
  const stderr = `${execution.stderr ?? ''}${execution.error?.message ?? ''}`;
  const changedFiles = changedProtectedFiles(protectedFiles);
  let response: JsonObject | null = null;
  try {
    const parsed = JSON.parse(stdout.trim()) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      response = parsed as JsonObject;
    }
  } catch {
    response = null;
  }
  const responseHash = response ? sha256Json(response) : sha256(stdout);
  const implementationHash = sha256File(auditorImplementationPath);
  const responseVerifiedConditions = response
    ? object(response.verifiedConditions)
    : null;
  const responseFindings = response ? objects(response.findings) : [];
  const responseVerificationRuns = response ? objects(response.verificationRuns) : [];
  const providerInvocation = response ? object(response.providerInvocation) : null;
  const providerValidation = validateProviderInvocation({
    value: providerInvocation,
    root: input.root,
    freshnessRoot: input.freshnessRoot,
    freshnessTimestamp: input.freshnessTimestamp,
  });
  const responseBindingReasons = [...providerValidation.blockingReasons];
  if (
    response === null ||
    text(response.schemaVersion) !== 'gap-closure-independent-audit-result/v1' ||
    text(response.requestHash) !== request.requestHash ||
    text(response.gapId) !== text(input.candidate.gapId) ||
    text(response.candidateHash) !== input.candidateHash ||
    text(response.auditorRole) !== 'readonly_independent_auditor' ||
    !['PASS', 'FAIL'].includes(text(response.decision)) ||
    !text(response.rationale) ||
    responseVerificationRuns.length === 0
  ) {
    responseBindingReasons.push('independent_auditor_response_binding_invalid');
  }
  if (
    providerInvocation &&
    text(response?.auditorRunId) !==
      `audit-run-${sha256Json(providerInvocation).slice(-24)}`
  ) {
    responseBindingReasons.push('independent_auditor_run_id_invalid');
  }
  if (
    text(response?.decision) === 'PASS' &&
    (responseFindings.length > 0 ||
      responseVerifiedConditions?.noProductionTestInjection !== true ||
      responseVerifiedConditions?.noHardcodedMachineIdentity !== true ||
      responseVerifiedConditions?.cleanMaterializationReproducible !== true)
  ) {
    responseBindingReasons.push('independent_auditor_pass_conditions_invalid');
  }
  const responseBindingValid = responseBindingReasons.length === 0;
  const exitCode = execution.status ?? (execution.error ? 1 : 0);
  const hostPayload = {
    schemaVersion: 'gap-closure-audit-host-invocation-receipt/v1',
    executorIdentity: 'main-agent-controlled-external-auditor/v1',
    candidateHash: input.candidateHash,
    requestPath: normalizePath(requestPath),
    requestHash: request.requestHash,
    auditorCommand: command,
    auditorCommandHash: sha256Json(command),
    auditorImplementationPath: normalizePath(auditorImplementationPath),
    auditorImplementationHash: implementationHash,
    actionBindingManifestPath: normalizePath(authority.actionBindingManifestPath),
    actionBindingManifestHash: authority.actionBindingManifestHash,
    canonicalAssetsManifestPath: normalizePath(authority.canonicalAssetsManifestPath),
    canonicalAssetsManifestHash: authority.canonicalAssetsManifestHash,
    criticalAuditorProfilePath: normalizePath(authority.criticalAuditorProfilePath),
    criticalAuditorProfileHash: authority.criticalAuditorProfileHash,
    criticalAuditorProfileDeclaredHash: authority.criticalAuditorProfileDeclaredHash,
    startedAt,
    completedAt,
    exitCode,
    signal: execution.signal ?? null,
    stdoutHash: sha256(stdout),
    stderrHash: sha256(stderr),
    responseHash,
    providerInvocationHash:
      providerInvocation === null ? null : sha256Json(providerInvocation),
    responseBindingReasons: [...new Set(responseBindingReasons)],
    readonlyBoundaryViolations: changedFiles,
    authorityTrusted: true,
    failureClass: responseBindingValid ? null : 'independent_auditor_response_binding_invalid',
  };
  const hostReceipt = {
    ...hostPayload,
    receiptHash: sha256Json(hostPayload),
  };
  writeJsonAtomic(invocationReceiptPath, hostReceipt);
  const processSucceeded =
    exitCode === 0 && responseBindingValid && changedFiles.length === 0;
  const auditReceipt = {
    schemaVersion: 'gap-closure-independent-audit-receipt/v1',
    gapId: text(input.candidate.gapId),
    candidateHash: input.candidateHash,
    auditorRole: 'readonly_independent_auditor',
    transport: 'external_process',
    auditorRunId:
      response && text(response.auditorRunId),
    auditedAt: completedAt,
    decision: processSucceeded ? text(response?.decision) : 'FAIL',
    verifiedConditions: {
      noProductionTestInjection:
        responseVerifiedConditions?.noProductionTestInjection === true,
      noHardcodedMachineIdentity:
        responseVerifiedConditions?.noHardcodedMachineIdentity === true,
      cleanMaterializationReproducible:
        responseVerifiedConditions?.cleanMaterializationReproducible === true,
    },
    findings: [
      ...responseFindings,
      ...[...new Set(responseBindingReasons)].map((code) => ({ code })),
      ...(exitCode !== 0
        ? [{ code: 'independent_auditor_process_failed', exitCode }]
        : []),
      ...changedFiles.map((filePath) => ({
        code: 'independent_auditor_write_boundary_violation',
        filePath,
      })),
    ],
    auditorImplementationPath: normalizePath(auditorImplementationPath),
    auditorImplementationHash: implementationHash,
    independentOracleImplementationPath: providerValidation.implementationPath
      ? normalizePath(providerValidation.implementationPath)
      : '',
    independentOracleImplementationHash: providerValidation.implementationHash,
    providerInvocation,
    actionBindingManifestPath: normalizePath(authority.actionBindingManifestPath),
    actionBindingManifestHash: authority.actionBindingManifestHash,
    canonicalAssetsManifestPath: normalizePath(authority.canonicalAssetsManifestPath),
    canonicalAssetsManifestHash: authority.canonicalAssetsManifestHash,
    criticalAuditorProfilePath: normalizePath(authority.criticalAuditorProfilePath),
    criticalAuditorProfileHash: authority.criticalAuditorProfileHash,
    criticalAuditorProfileDeclaredHash: authority.criticalAuditorProfileDeclaredHash,
    requestPath: normalizePath(requestPath),
    requestHash: request.requestHash,
    responseHash,
    invocationReceiptPath: normalizePath(invocationReceiptPath),
    invocationReceiptHash: sha256File(invocationReceiptPath),
  };
  writeJsonAtomic(auditReceiptPath, auditReceipt);
  return auditReceiptPath;
}

export function mainGapClosureEvidence(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: gap-closure-evidence --requirement-record <json> --candidate <json> [--auditor-command <package-derived-json-argv>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord || !args.candidate) {
    throw new Error('gap_closure_required_args_missing');
  }
  const recordPath = path.resolve(args.requirementRecord);
  const root = projectRootForRecordPath(recordPath);
  if (!sameResolvedPath(root, process.cwd())) {
    throw new Error('gap_closure_record_root_mismatch');
  }
  const record = readJson(recordPath);
  const candidatePath = resolveInside(root, args.candidate);
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    throw new Error('gap_closure_candidate_missing_or_outside_root');
  }
  const candidate = readJson(candidatePath);
  const candidateValidation = validateCandidate({
    candidate,
    candidateHash: sha256File(candidatePath),
    candidatePath,
    record,
    root,
  });
  if (candidateValidation.hardFailureReasons.length > 0) {
    const output = {
      ok: false,
      status: 'Open',
      gapId: text(candidate.gapId),
      blockingReasons: candidateValidation.hardFailureReasons,
    };
    process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : 'gap_closure=Open\n');
    return 1;
  }
  const auditReceiptPath = executeIndependentAudit({
    root,
    recordPath,
    record,
    candidatePath,
    candidate,
    candidateHash: candidateValidation.candidateHash,
    productionFiles: candidateValidation.productionFiles,
    freshnessRoot: candidateValidation.freshnessRoot,
    freshnessTimestamp: candidateValidation.freshnessTimestamp,
    auditorCommand: args.auditorCommand,
  });
  const auditValidation = validateAuditReceipt({
    receiptPath: auditReceiptPath,
    candidate,
    candidateHash: candidateValidation.candidateHash,
    root,
    freshnessRoot: candidateValidation.freshnessRoot,
    freshnessTimestamp: candidateValidation.freshnessTimestamp,
  });
  let finalCandidateValidation = candidateValidation;
  const postAuditRevalidationReasons: string[] = [];
  try {
    finalCandidateValidation = validateCandidate({
      candidate,
      candidateHash: candidateValidation.candidateHash,
      candidatePath,
      record,
      root,
    });
  } catch {
    postAuditRevalidationReasons.push(
      'post_audit_candidate_revalidation_failed'
    );
  }
  const blockingReasons = [
    ...candidateValidation.blockingReasons,
    ...finalCandidateValidation.hardFailureReasons,
    ...finalCandidateValidation.blockingReasons,
    ...postAuditRevalidationReasons,
    ...auditValidation.blockingReasons,
  ];
  if (auditValidation.decision !== 'PASS') blockingReasons.push('independent_audit_not_pass');
  const closureDecision = blockingReasons.length === 0 ? 'Verified Closed' : 'Implemented';
  const gapId = text(candidate.gapId);
  const outputPath = path.join(path.dirname(recordPath), 'gap-evidence', gapId, 'closure-evidence.json');
  const scan = productionScan(root, finalCandidateValidation.productionFiles);
  const auditVerifiedConditions = auditValidation.receipt
    ? object(auditValidation.receipt.verifiedConditions)
    : null;
  const packet = {
    schemaVersion: 'gap-closure-evidence/v1',
    ...candidate,
    status: closureDecision,
    candidatePath: normalizePath(candidatePath),
    candidateHash: candidateValidation.candidateHash,
    independentAuditReceiptPath: normalizePath(auditReceiptPath ?? ''),
    independentAuditReceiptHash:
      fs.existsSync(auditReceiptPath) ? sha256File(auditReceiptPath) : '',
    independentAuditDecision: auditValidation.decision,
    cleanMaterializationReceiptPath: normalizePath(
      finalCandidateValidation.cleanMaterialization.receiptPath
    ),
    cleanMaterializationReceiptHash:
      finalCandidateValidation.cleanMaterialization.receiptFileHash,
    cleanMaterializationReceiptAuthorityHash:
      finalCandidateValidation.cleanMaterialization.receiptAuthorityHash,
    independentOracleImplementation:
      auditValidation.receipt &&
      text(auditValidation.receipt.independentOracleImplementationPath),
    independentOracleImplementationHash:
      auditValidation.receipt &&
      text(auditValidation.receipt.independentOracleImplementationHash),
    independentOracleDoesNotImportProductionHelpers: !auditValidation.blockingReasons.includes(
      'independent_oracle_imports_production_helper'
    ),
    closureDecision,
    forbiddenSeamScanResult: scan.forbiddenSeamScanResult,
    hardcodedIdentityScanResult: scan.hardcodedIdentityScanResult,
    noProductionTestInjection:
      scan.noProductionTestInjection &&
      auditVerifiedConditions?.noProductionTestInjection === true,
    noHardcodedMachineIdentity:
      scan.hardcodedIdentityScanResult === 'pass' &&
      auditVerifiedConditions?.noHardcodedMachineIdentity === true,
    cleanMaterializationReproducible:
      postAuditRevalidationReasons.length === 0 &&
      finalCandidateValidation.cleanMaterialization.reproducible,
    blockingReasons: [...new Set(blockingReasons)],
    reducedAt: new Date().toISOString(),
    reducedBy: 'gap-closure-evidence-reducer',
  };
  writeJsonAtomic(outputPath, packet);
  const output = {
    ok: closureDecision === 'Verified Closed',
    gapId,
    status: closureDecision,
    closureDecision,
    evidencePath: normalizePath(outputPath),
    evidenceHash: sha256File(outputPath),
    blockingReasons: packet.blockingReasons,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `gap_closure=${closureDecision}\n`);
  return closureDecision === 'Verified Closed' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainGapClosureEvidence(process.argv.slice(2));
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
