import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalizeRequirementRecord,
} from './requirement-record-control-store';
import { validateRequirementRecordSchemaObject } from './requirement-record-live-schema-gate';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractFinalizationSafeWriteOptions {
  cwd?: string;
  requirementRecord: string;
  implementationAttemptId: string;
  draft: string;
  target: string;
  receipt: string;
  blockedReceiptRoot: string;
  artifactRole: string;
  validationProfile: string;
  minBytes: number;
  finalizationDeclarationHash: string;
  expectedPredecessorReceipt: string;
  json?: boolean;
}

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const BLOCKED_ROOT = `${BASE}/finalization-receipts/blocked`;
const FAILURE_ARCHIVE_ROOT = `${BASE}/finalization-failure-archive`;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;

const ROLES = [
  {
    artifactRole: 'AMEND05-SAFE-WRITE-MANIFEST',
    validationProfile: 'amend05-safe-write-manifest',
    draftName: 'amend05-safe-write-receipt-manifest.json',
    target: `${BASE}/amend05-safe-write-receipt-manifest.json`,
    receipt: `${BASE}/finalization-receipts/amend05-safe-write-receipt-manifest.receipt.json`,
    schemaName: 'requirements-contract-amend05-safe-write-receipt-manifest.schema.json',
    predecessorRole: null,
  },
  {
    artifactRole: 'EVD-15',
    validationProfile: 'goal-task-evidence',
    draftName: 'G15-final-gates.json',
    target: `${BASE}/G15-final-gates.json`,
    receipt: `${BASE}/finalization-receipts/G15-final-gates.receipt.json`,
    schemaName: 'requirements-contract-goal-task-evidence.schema.json',
    predecessorRole: 'AMEND05-SAFE-WRITE-MANIFEST',
  },
  {
    artifactRole: 'ARTIFACT-01',
    validationProfile: 'implementation-evidence-bundle',
    draftName: 'implementation-evidence.json',
    target: `${BASE}/implementation-evidence.json`,
    receipt: `${BASE}/finalization-receipts/implementation-evidence.receipt.json`,
    schemaName: 'requirements-contract-completion-evidence.schema.json',
    predecessorRole: 'EVD-15',
  },
] as const;

function readJson(filePath: string): JsonRecord {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`finalization_safe_write_json_object_required:${slash(filePath)}`);
  }
  return value as JsonRecord;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`finalization_safe_write_path_escape:${value}`);
  }
  return resolved;
}

function validate(value: JsonRecord, schemaName: string, label: string): void {
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(path.resolve(__dirname, '..', 'schemas', schemaName))
  );
  if (!validator(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validator.errors ?? [])}`);
  }
}

function relative(root: string, filePath: string): string {
  return slash(path.relative(root, filePath));
}

function promoteExactBytes(targetPath: string, text: string, identity: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${identity}.tmp`;
  fs.writeFileSync(temporaryPath, text, 'utf8');
  fs.renameSync(temporaryPath, targetPath);
}

function exactArgv(options: RequirementsContractFinalizationSafeWriteOptions): string[] {
  return [
    'node',
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'requirements-contract-finalization-safe-write',
    '--requirement-record',
    options.requirementRecord,
    '--implementation-attempt-id',
    options.implementationAttemptId,
    '--draft',
    options.draft,
    '--target',
    options.target,
    '--receipt',
    options.receipt,
    '--blocked-receipt-root',
    options.blockedReceiptRoot,
    '--artifact-role',
    options.artifactRole,
    '--validation-profile',
    options.validationProfile,
    '--min-bytes',
    String(options.minBytes),
    '--finalization-declaration-hash',
    options.finalizationDeclarationHash,
    '--expected-predecessor-receipt',
    options.expectedPredecessorReceipt,
    '--json',
  ];
}

function assertNoSymlinkEscape(root: string, filePath: string): void {
  const rootReal = fs.realpathSync(root);
  let current = fs.existsSync(filePath) ? filePath : path.dirname(filePath);
  while (!fs.existsSync(current)) current = path.dirname(current);
  const currentReal = fs.realpathSync(current);
  const relativePath = path.relative(rootReal, currentReal);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('finalization_safe_write_symlink_escape');
  }
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error('finalization_safe_write_symlink_forbidden');
  }
}

function predecessor(
  root: string,
  roleIndex: number,
  recordRef: JsonRecord,
  implementationAttemptId: string,
  declarationHash: string,
  expectedPath: string
): JsonRecord {
  if (roleIndex === 0) {
    if (expectedPath !== 'not_applicable') {
      throw new Error('finalization_safe_write_predecessor_not_applicable_required');
    }
    return { applicable: false, expectedReceiptPath: 'not_applicable' };
  }
  const previousRole = ROLES[roleIndex - 1];
  if (expectedPath !== previousRole.receipt) {
    throw new Error('finalization_safe_write_predecessor_path_mismatch');
  }
  const predecessorPath = resolveWithin(root, expectedPath);
  const value = readJson(predecessorPath);
  validate(
    value,
    'requirements-contract-finalization-safe-write-receipt.schema.json',
    'finalization_safe_write_predecessor'
  );
  if (
    value.result !== 'PASS' ||
    value.artifactRole !== previousRole.artifactRole ||
    value.requirementRecord.path !== recordRef.path ||
    value.requirementRecord.hash !== recordRef.hash ||
    value.implementationAttemptId !== implementationAttemptId ||
    value.finalizationDeclarationHash !== declarationHash
  ) {
    throw new Error('finalization_safe_write_predecessor_binding_mismatch');
  }
  if (roleIndex === 2) {
    const firstReceipt = value.predecessor?.receipt;
    if (
      !firstReceipt ||
      firstReceipt.path !== ROLES[0].receipt ||
      fileHash(resolveWithin(root, firstReceipt.path)) !== firstReceipt.hash
    ) {
      throw new Error('finalization_safe_write_predecessor_chain_mismatch');
    }
  }
  return {
    applicable: true,
    expectedReceiptPath: expectedPath,
    receipt: {
      path: expectedPath,
      hash: fileHash(predecessorPath),
      artifactRole: previousRole.artifactRole,
    },
  };
}

export async function requirementsContractFinalizationSafeWriteCommand(
  options: RequirementsContractFinalizationSafeWriteOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const roleIndex = ROLES.findIndex(
    (entry) =>
      entry.artifactRole === options.artifactRole &&
      entry.validationProfile === options.validationProfile
  );
  if (roleIndex < 0) throw new Error('finalization_safe_write_role_profile_forbidden');
  const role = ROLES[roleIndex];
  if (
    slash(options.blockedReceiptRoot) !== BLOCKED_ROOT ||
    options.minBytes !== 2 ||
    !SHA256.test(options.finalizationDeclarationHash)
  ) {
    throw new Error('finalization_safe_write_fixed_contract_mismatch');
  }
  const expectedDraft = `${BASE}/.finalization-staging/${options.implementationAttemptId}/${role.draftName}`;
  if (
    slash(options.draft) !== expectedDraft ||
    slash(options.target) !== role.target ||
    slash(options.receipt) !== role.receipt
  ) {
    throw new Error('finalization_safe_write_role_path_mismatch');
  }
  const recordPath = resolveWithin(root, options.requirementRecord);
  const draftPath = resolveWithin(root, options.draft);
  const targetPath = resolveWithin(root, options.target);
  const receiptPath = resolveWithin(root, options.receipt);
  const record = canonicalizeRequirementRecord(readJson(recordPath));
  const recordValidation = validateRequirementRecordSchemaObject(record);
  if (!recordValidation.ok) {
    throw new Error(
      `finalization_safe_write_requirement_record_invalid:${JSON.stringify(
        recordValidation.errors
      )}`
    );
  }
  if (record.currentAttemptId !== options.implementationAttemptId) {
    throw new Error('finalization_safe_write_active_attempt_mismatch');
  }
  const requirementSetId = String(record.requirementSetId);
  const expectedRecordPath = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  if (relative(root, recordPath) !== expectedRecordPath) {
    throw new Error('finalization_safe_write_requirement_record_path_mismatch');
  }
  assertNoSymlinkEscape(root, draftPath);
  assertNoSymlinkEscape(root, targetPath);
  const finalizationRunId = `FINALIZATION-RUN-${randomUUID().toUpperCase()}`;
  const recordRef = { path: expectedRecordPath, hash: fileHash(recordPath) };
  const argv = exactArgv(options);
  const schemaPath = path.resolve(__dirname, '..', 'schemas', role.schemaName);
  const blocked = (error: unknown): never => {
    const code = String(error instanceof Error ? error.message : error)
      .split(':')[0]
      .replace(/[^a-z0-9_]/giu, '_')
      .toLowerCase();
    let archiveRef: JsonRecord | null = null;
    if (fs.existsSync(draftPath) && fs.statSync(draftPath).isFile()) {
      const archiveRelative = `${FAILURE_ARCHIVE_ROOT}/${options.implementationAttemptId}/${finalizationRunId}/${role.artifactRole}.draft.json`;
      const archivePath = resolveWithin(root, archiveRelative);
      fs.mkdirSync(path.dirname(archivePath), { recursive: true });
      fs.renameSync(draftPath, archivePath);
      archiveRef = { path: archiveRelative, hash: fileHash(archivePath) };
    }
    const blockedRelative = `${BLOCKED_ROOT}/${options.implementationAttemptId}/${finalizationRunId}/${role.artifactRole}.blocked.json`;
    const blockReceipt = {
      schemaVersion: 'requirements-contract-finalization-safe-write-receipt/v1',
      commandId: 'requirements-contract-finalization-safe-write',
      finalizationRunId,
      requirementRecord: recordRef,
      implementationAttemptId: options.implementationAttemptId,
      exactArgv: argv,
      argvHash: sha256(canonicalJson(argv)),
      artifactRole: role.artifactRole,
      validationProfile: role.validationProfile,
      finalizationDeclarationHash: options.finalizationDeclarationHash,
      predecessor: {
        applicable: roleIndex > 0,
        expectedReceiptPath: options.expectedPredecessorReceipt,
      },
      target: {
        path: role.target,
        requiredSchemaVersion: role.schemaName.replace(/\.schema\.json$/u, ''),
        requiredSchemaHash: fileHash(schemaPath),
        minBytes: 2,
      },
      draft: archiveRef
        ? { path: options.draft, archivedPath: archiveRef.path, archivedHash: archiveRef.hash }
        : { path: options.draft },
      writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
      result: 'BLOCK',
      selectedReceiptPath: blockedRelative,
      failure: { code: code || 'finalization_safe_write_failed' },
      retryRole: role.artifactRole,
    };
    validate(
      blockReceipt,
      'requirements-contract-finalization-safe-write-receipt.schema.json',
      'finalization_safe_write_block_receipt'
    );
    writeGovernedJson(resolveWithin(root, blockedRelative), blockReceipt);
    throw new Error(`finalization_safe_write_blocked:${blockedRelative}:${code}`);
  };
  try {
    if (!fs.existsSync(draftPath) || !fs.statSync(draftPath).isFile()) {
      throw new Error('finalization_safe_write_draft_missing');
    }
    const attemptRoot = path.dirname(draftPath);
    const activeDrafts = fs
      .readdirSync(attemptRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    if (canonicalJson(activeDrafts) !== canonicalJson([role.draftName])) {
      throw new Error('finalization_safe_write_unexpected_active_draft');
    }
    if (fs.existsSync(receiptPath)) {
      throw new Error('finalization_safe_write_success_receipt_immutable');
    }
    const draftText = fs.readFileSync(draftPath, 'utf8');
    const draft = readJson(draftPath);
    validate(draft, role.schemaName, 'finalization_safe_write_draft');
    if (
      role.artifactRole === 'ARTIFACT-01' &&
      draft.implementationAttemptId !== options.implementationAttemptId
    ) {
      throw new Error('finalization_safe_write_cross_attempt_draft');
    }
    if (
      draft.finalizationDeclarationHash !== undefined &&
      draft.finalizationDeclarationHash !== options.finalizationDeclarationHash
    ) {
      throw new Error('finalization_safe_write_declaration_hash_mismatch');
    }
    const predecessorRef = predecessor(
      root,
      roleIndex,
      recordRef,
      options.implementationAttemptId,
      options.finalizationDeclarationHash,
      options.expectedPredecessorReceipt
    );
    const draftHash = fileHash(draftPath);
    const draftBytes = fs.statSync(draftPath).size;
    if (draftBytes < options.minBytes) throw new Error('finalization_safe_write_min_bytes');
    const targetExistedBefore = fs.existsSync(targetPath);
    const previousHash = targetExistedBefore ? fileHash(targetPath) : null;
    promoteExactBytes(targetPath, draftText, finalizationRunId);
    const readbackHash = fileHash(targetPath);
    if (readbackHash !== draftHash) throw new Error('finalization_safe_write_readback_mismatch');
    const passReceipt = {
      schemaVersion: 'requirements-contract-finalization-safe-write-receipt/v1',
      commandId: 'requirements-contract-finalization-safe-write',
      finalizationRunId,
      requirementRecord: recordRef,
      implementationAttemptId: options.implementationAttemptId,
      exactArgv: argv,
      argvHash: sha256(canonicalJson(argv)),
      artifactRole: role.artifactRole,
      validationProfile: role.validationProfile,
      finalizationDeclarationHash: options.finalizationDeclarationHash,
      predecessor: predecessorRef,
      target: {
        path: role.target,
        requiredSchemaVersion: String(draft.schemaVersion),
        requiredSchemaHash: fileHash(schemaPath),
        minBytes: 2,
        targetExistedBefore,
        previousHash,
        promotedHash: draftHash,
        readbackHash,
      },
      draft: { path: options.draft, hash: draftHash, bytes: draftBytes },
      writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
      result: 'PASS',
      selectedReceiptPath: role.receipt,
    };
    validate(
      passReceipt,
      'requirements-contract-finalization-safe-write-receipt.schema.json',
      'finalization_safe_write_pass_receipt'
    );
    writeGovernedJson(receiptPath, passReceipt);
    fs.rmSync(draftPath);
    const remaining = fs.readdirSync(path.dirname(draftPath));
    if (roleIndex === ROLES.length - 1) {
      if (remaining.length !== 0) throw new Error('finalization_safe_write_cleanup_mismatch');
      fs.rmdirSync(path.dirname(draftPath));
    }
    if (options.json) process.stdout.write(`${JSON.stringify(passReceipt)}\n`);
    return passReceipt;
  } catch (error) {
    return blocked(error);
  }
}
