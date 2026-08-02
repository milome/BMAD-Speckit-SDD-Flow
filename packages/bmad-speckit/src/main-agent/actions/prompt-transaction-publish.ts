import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  requirementsContractPromptTransactionPublishCommand,
  type PromptTransactionPublisherDeps,
} from '../source-authority/scripts/requirements-contract-prompt-transaction-publisher';
import type { PromptTransactionPublishOptions } from '../source-authority/scripts/requirements-contract-prompt-transaction-authority';
import { fileHash } from '../source-authority/scripts/requirements-contract-governed-write';
import type { MainAgentActionContext } from './source-authority-main-action';

type JsonRecord = Record<string, unknown>;

const ACTION = 'requirements-contract-prompt-transaction-publish';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const DERIVED_ARGUMENTS = [
  'outDir',
  'promptLanguage',
  'humanPromptProfile',
  'packetId',
  'taskReportPath',
  'stageRegistry',
  'requirementsConfirmationReceipt',
  'architectureConfirmationReceipt',
  'consumerRoot',
  'currentDispatchPointer',
  'evidenceOut',
] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonObject(filePath: string, label: string): JsonRecord {
  const resolved = path.resolve(filePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `${label}_invalid:${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}_invalid`);
  }
  return parsed as JsonRecord;
}

function refPath(value: unknown, cwd: string, label: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}_missing`);
  }
  const declaredPath = text((value as JsonRecord).path);
  if (!declaredPath) throw new Error(`${label}_missing`);
  return path.isAbsolute(declaredPath) ? path.resolve(declaredPath) : path.resolve(cwd, declaredPath);
}

function verifiedRef(
  value: unknown,
  cwd: string,
  label: string
): { path: string; hash: string } {
  const resolved = refPath(value, cwd, label);
  const declaredHash =
    value && typeof value === 'object' && !Array.isArray(value)
      ? text((value as JsonRecord).hash)
      : '';
  if (!HASH_PATTERN.test(declaredHash)) throw new Error(`${label}_hash_invalid`);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label}_missing`);
  }
  if (fileHash(resolved) !== declaredHash) throw new Error(`${label}_hash_mismatch`);
  return { path: resolved, hash: declaredHash };
}

function assertContained(root: string, candidate: string, label: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_consumer_root`);
  }
}

function resolveInstalledStageRegistry(
  cwd: string,
  attempt: JsonRecord,
  consumerRoot: string
): string {
  const profileRef = verifiedRef(
    attempt.consumerProjectProfileRef,
    cwd,
    'consumer_project_profile_ref'
  );
  assertContained(consumerRoot, profileRef.path, 'consumer_project_profile_ref');
  const profile = readJsonObject(profileRef.path, 'consumer_project_profile');
  const manifestRef = verifiedRef(
    profile.packageRuntimeActionBindingManifestRef,
    cwd,
    'package_runtime_action_binding_manifest_ref'
  );
  assertContained(consumerRoot, manifestRef.path, 'package_runtime_action_binding_manifest_ref');
  const manifest = readJsonObject(
    manifestRef.path,
    'package_runtime_action_binding_manifest'
  );
  const bindings = Array.isArray(manifest.actions)
    ? manifest.actions.filter(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          text((entry as JsonRecord).actionId) === ACTION
      )
    : [];
  if (bindings.length !== 1) {
    throw new Error('prompt_publication_action_binding_not_unique');
  }
  const binding = bindings[0] as JsonRecord;
  const stageRegistryRefs = Array.isArray(binding.runtimeRefs)
    ? binding.runtimeRefs.filter(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          text((entry as JsonRecord).role) === 'installed-stage-registry'
      )
    : [];
  if (stageRegistryRefs.length !== 1) {
    throw new Error('installed_stage_registry_binding_not_unique');
  }
  const stageRegistryRef = stageRegistryRefs[0] as JsonRecord;
  const packagePath = text(stageRegistryRef.packagePath);
  const declaredHash = text(stageRegistryRef.hash);
  if (!packagePath || !HASH_PATTERN.test(declaredHash)) {
    throw new Error('installed_stage_registry_binding_invalid');
  }
  const installedPackageRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  const stageRegistryPath = path.resolve(installedPackageRoot, packagePath);
  assertContained(installedPackageRoot, stageRegistryPath, 'installed_stage_registry');
  if (!/^requirements-contract-stage-registry\.(?:ts|js)$/u.test(path.basename(stageRegistryPath))) {
    throw new Error('stage_registry_identity_mismatch');
  }
  if (!fs.existsSync(stageRegistryPath) || !fs.statSync(stageRegistryPath).isFile()) {
    throw new Error('installed_stage_registry_missing');
  }
  if (fileHash(stageRegistryPath) !== declaredHash) {
    throw new Error('installed_stage_registry_hash_mismatch');
  }
  return stageRegistryPath;
}

function derivePublishOptions(context: MainAgentActionContext): PromptTransactionPublishOptions {
  const args = context.args ?? {};
  const callerOverrides = DERIVED_ARGUMENTS.filter((key) => text(args[key]) !== '');
  if (callerOverrides.length > 0) {
    throw new Error(
      `prompt_transaction_publish_caller_override_forbidden:${callerOverrides.join(',')}`
    );
  }

  const requirementRecordArg = text(args.requirementRecord ?? args.recordPath);
  const attemptContextArg = text(args.attemptContext);
  const missing = [
    requirementRecordArg ? '' : 'requirementRecord',
    attemptContextArg ? '' : 'attemptContext',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`prompt_transaction_publish_authority_input_missing:${missing.join(',')}`);
  }

  const cwd = path.resolve(context.cwd);
  const requirementRecord = path.resolve(cwd, requirementRecordArg);
  const attemptContext = path.resolve(cwd, attemptContextArg);
  const record = readJsonObject(requirementRecord, 'requirement_record');
  const attempt = readJsonObject(attemptContext, 'attempt_context');
  const requirementSetId = text(record.requirementSetId) || text(record.recordId);
  const implementationAttemptId =
    text(record.currentAttemptId) ||
    text(record.implementationAttemptId) ||
    text(record.runId);
  if (!requirementSetId || !implementationAttemptId) {
    throw new Error('prompt_transaction_publish_record_identity_incomplete');
  }

  const consumerMarker = verifiedRef(
    attempt.consumerMarkerRef,
    cwd,
    'consumer_marker_ref'
  ).path;
  const consumerRoot = path.dirname(consumerMarker);
  const evidenceRoot = path.join(
    cwd,
    'docs',
    'plans',
    'evidence',
    'loop-engineering-remediation'
  );
  return {
    cwd,
    requirementRecord,
    outDir: path.join(
      path.dirname(requirementRecord),
      'trace-execution',
      implementationAttemptId
    ),
    promptLanguage: 'auto',
    humanPromptProfile: 'full',
    packetId: implementationAttemptId,
    taskReportPath: path.join(
      cwd,
      '_bmad-output',
      'runtime',
      'governance',
      'task-reports',
      requirementSetId,
      `${implementationAttemptId}.json`
    ),
    attemptContext,
    stageRegistry: resolveInstalledStageRegistry(cwd, attempt, consumerRoot),
    requirementsConfirmationReceipt: refPath(
      attempt.requirementsConfirmationReceiptRef,
      cwd,
      'requirements_confirmation_receipt_ref'
    ),
    architectureConfirmationReceipt: refPath(
      attempt.architectureConfirmationReceiptRef,
      cwd,
      'architecture_confirmation_receipt_ref'
    ),
    consumerRoot,
    currentDispatchPointer: path.join(
      evidenceRoot,
      'current-dispatch-pointer-receipt.json'
    ),
    evidenceOut: path.join(evidenceRoot, 'G09-prompt-transaction.json'),
    json: true,
  };
}

function parseJsonOutput(output: string): JsonRecord | null {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
    } catch {
      // Preserve non-JSON diagnostics in the returned runtime proof.
    }
  }
  return null;
}

async function capturePublisher(
  run: () => Promise<number>
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (typeof callback === 'function') callback();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (typeof callback === 'function') callback();
    return true;
  }) as typeof process.stderr.write;
  try {
    return {
      exitCode: await run(),
      stdout,
      stderr,
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

function blockedResult(message: string, result: JsonRecord | null = null) {
  return {
    status: 'prompt_transaction_publication_blocked',
    exitCode: 1,
    result,
    errors: [{ code: 'prompt_transaction_publication_blocked', message }],
  };
}

export async function promptTransactionPublishAction(
  context: MainAgentActionContext,
  deps: PromptTransactionPublisherDeps = {}
) {
  let options: PromptTransactionPublishOptions;
  try {
    options = derivePublishOptions(context);
  } catch (error) {
    return blockedResult(error instanceof Error ? error.message : String(error));
  }

  const captured = await capturePublisher(() =>
    requirementsContractPromptTransactionPublishCommand(options, deps)
  );
  const result = parseJsonOutput(captured.stdout) ?? parseJsonOutput(captured.stderr);
  if (captured.exitCode !== 0) {
    return blockedResult(
      text(result?.error) ||
        captured.stderr.trim() ||
        captured.stdout.trim() ||
        `${ACTION}_failed`,
      result
    );
  }
  if (result?.decision !== 'PASS') {
    return blockedResult('prompt_transaction_publication_pass_evidence_missing', result);
  }
  return {
    status: 'prompt_transaction_published',
    exitCode: 0,
    result,
    sourceAuthorityRuntimeProof: {
      mode: 'in_process_source_authority',
      action: ACTION,
      stdout: captured.stdout,
      stderr: captured.stderr,
    },
    errors: [],
  };
}
