import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
} from './requirements-contract-governed-write';
import {
  deriveRequirementsContractFrozenUniverse,
  validateRequirementsContractEvidenceUniverse,
} from './requirements-contract-frozen-universe';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractEvidenceVerifyOptions {
  cwd?: string;
  bundle: string;
  json?: boolean;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const SELF_HASH_KEYS = new Set([
  'selfHash',
  'bundleHash',
  'completionEvidenceHash',
  'evidenceBundleHash',
  'implementationEvidenceHash',
]);

function readJson(filePath: string): JsonRecord {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`evidence_verify_json_object_required:${slash(filePath)}`);
  }
  return value as JsonRecord;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`evidence_verify_path_escape:${value}`);
  }
  return resolved;
}

function validateBundleSchema(bundle: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-completion-evidence.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  if (!validate(bundle)) {
    throw new Error(
      `evidence_verify_bundle_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
}

function verifyIndex(
  root: string,
  bundlePath: string,
  entries: unknown,
  idKey: 'artifactId' | 'evidenceId',
  expectedIds: string[]
): number {
  if (!Array.isArray(entries)) throw new Error(`evidence_verify_${idKey}_index_invalid`);
  const actualIds = entries.map((entry) => String(entry?.[idKey] ?? ''));
  if (canonicalJson(actualIds) !== canonicalJson(expectedIds)) {
    throw new Error(`evidence_verify_${idKey}_universe_mismatch`);
  }
  for (const entry of entries) {
    const id = String(entry[idKey]);
    if (entry.decision !== 'PASS') throw new Error(`evidence_verify_non_pass:${id}`);
    if (!SHA256.test(String(entry.hash ?? ''))) {
      throw new Error(`evidence_verify_hash_invalid:${id}`);
    }
    const target = resolveWithin(root, String(entry.path ?? ''));
    if (path.resolve(target) === path.resolve(bundlePath)) {
      throw new Error(`evidence_verify_circular_reference:${id}`);
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error(`evidence_verify_file_missing:${id}`);
    }
    if (fileHash(target) !== entry.hash) throw new Error(`evidence_verify_hash_mismatch:${id}`);
  }
  return entries.length;
}

function verifyCriticalMetrics(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    throw new Error('evidence_verify_critical_metrics_invalid');
  }
  const entries = Object.entries(metrics as JsonRecord);
  if (entries.length === 0) throw new Error('evidence_verify_critical_metrics_empty');
  for (const [key, value] of entries) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value !== 0) {
      throw new Error(`evidence_verify_critical_metric_nonzero:${key}`);
    }
  }
  return entries.length;
}

function verifyNestedBindings(
  root: string,
  bundlePath: string,
  value: unknown,
  seen = new Set<unknown>()
): number {
  if (!value || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.reduce(
      (count, entry) => count + verifyNestedBindings(root, bundlePath, entry, seen),
      0
    );
  }
  const record = value as JsonRecord;
  let verified = 0;
  for (const [key, entry] of Object.entries(record)) {
    if (SELF_HASH_KEYS.has(key)) throw new Error(`evidence_verify_self_hash_forbidden:${key}`);
    if (key.endsWith('Hash') && typeof entry === 'string' && !SHA256.test(entry)) {
      throw new Error(`evidence_verify_hash_invalid:${key}`);
    }
    if (
      typeof entry === 'string' &&
      entry.includes('terminal-command-receipt.json')
    ) {
      throw new Error(`evidence_verify_downstream_terminal_reference:${key}`);
    }
    if (!key.endsWith('Path') || typeof entry !== 'string' || entry === 'not_applicable') {
      verified += verifyNestedBindings(root, bundlePath, entry, seen);
      continue;
    }
    const hashKey = `${key.slice(0, -4)}Hash`;
    if (typeof record[hashKey] !== 'string') continue;
    const target = resolveWithin(root, entry);
    if (path.resolve(target) === path.resolve(bundlePath)) {
      throw new Error(`evidence_verify_circular_reference:${key}`);
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error(`evidence_verify_file_missing:${key}`);
    }
    if (fileHash(target) !== record[hashKey]) {
      throw new Error(`evidence_verify_hash_mismatch:${key}`);
    }
    verified += 1;
  }
  return verified;
}

function exactArgv(options: RequirementsContractEvidenceVerifyOptions): string[] {
  return [
    'node',
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'requirements-contract-evidence-verify',
    '--bundle',
    options.bundle,
    '--json',
  ];
}

function commandId(): string {
  const schema = readJson(
    path.resolve(__dirname, '..', 'schemas', 'requirements-contract-evidence-verify-input.schema.json')
  );
  const value = String(schema.properties?.commandId?.const ?? '');
  if (!value) throw new Error('evidence_verify_command_identity_missing');
  return value;
}

function resolveContractPath(root: string, bundle: JsonRecord): string {
  const receiptPath = bundle.contractPromotionReadbackReceiptPath;
  if (typeof receiptPath !== 'string' || receiptPath.length === 0) {
    throw new Error('evidence_verify_contract_binding_missing');
  }
  const receipt = readJson(resolveWithin(root, receiptPath));
  if (
    receipt.schemaVersion !== 'contract-promotion-readback-receipt/v1' ||
    receipt.decision !== 'pass' ||
    receipt.readbackVerified !== true ||
    typeof receipt.targetPath !== 'string' ||
    receipt.expectedHash !== bundle.contractHash ||
    receipt.observedHash !== bundle.contractHash
  ) {
    throw new Error('evidence_verify_contract_binding_invalid');
  }
  const contractPath = resolveWithin(root, receipt.targetPath);
  if (fileHash(contractPath) !== bundle.contractHash) {
    throw new Error('evidence_verify_contract_hash_mismatch');
  }
  return contractPath;
}

export async function requirementsContractEvidenceVerifyCommand(
  options: RequirementsContractEvidenceVerifyOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const bundlePath = resolveWithin(root, options.bundle);
  const bundle = readJson(bundlePath);
  validateBundleSchema(bundle);
  const universe = deriveRequirementsContractFrozenUniverse(resolveContractPath(root, bundle));
  const auditIds = [
    bundle.auditAttemptId,
    bundle.architectureAuditAttemptId,
    bundle.preCandidateAuditAttemptId,
    bundle.finalAuditAttemptId,
  ];
  if (new Set(auditIds).size !== auditIds.length) {
    throw new Error('evidence_verify_audit_identity_reuse');
  }
  validateRequirementsContractEvidenceUniverse(
    {
      sourceAmendmentHashes: bundle.sourceAmendmentHashes,
      coverage: bundle.coverage,
      evidenceIndex: bundle.evidenceIndex,
      artifactIndex: bundle.artifactIndex,
    },
    universe
  );
  const verifiedArtifactCount = verifyIndex(
    root,
    bundlePath,
    bundle.artifactIndex,
    'artifactId',
    universe.artifactIndexIds
  );
  const verifiedEvidenceCount = verifyIndex(
    root,
    bundlePath,
    bundle.evidenceIndex,
    'evidenceId',
    universe.evidenceIds
  );
  const criticalMetricCount = verifyCriticalMetrics(bundle.criticalMetrics);
  const externalBindingCount = verifyNestedBindings(root, bundlePath, bundle);
  const argv = exactArgv(options);
  const receipt = {
    schemaVersion: 'requirements-contract-evidence-verification-receipt/v1',
    commandId: commandId(),
    exactArgv: argv,
    argvHash: sha256(canonicalJson(argv)),
    bundle: { path: slash(path.relative(root, bundlePath)), hash: fileHash(bundlePath) },
    transactionId: bundle.transactionId,
    implementationAttemptId: bundle.implementationAttemptId,
    auditAttemptIds: auditIds,
    verifiedArtifactCount,
    verifiedEvidenceCount,
    coveredStoryCount: bundle.coverage.storyIds.length,
    coveredAcceptanceCount: bundle.coverage.acceptanceIds.length,
    coveredTraceCount: bundle.coverage.traceIds.length,
    coveredCommandCount: bundle.coverage.commandIds.length,
    criticalMetricCount,
    externalBindingCount,
    decision: 'pass',
  };
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-evidence-verification-receipt.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  if (!validate(receipt)) {
    throw new Error(
      `evidence_verify_receipt_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
