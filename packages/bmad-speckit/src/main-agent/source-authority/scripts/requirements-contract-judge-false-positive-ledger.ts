import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

const REQUIREMENTS_ACTOR = 'requirements_critical_auditor_judge';
const REQUIREMENTS_ROLE = 'requirements_critical_auditor';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FORBIDDEN_CALLER_FIELDS = new Set([
  'pass',
  'decision',
  'ledgerEntryHash',
  'authorityBindingHash',
  'observationHash',
  'dispositionHash',
  'expectedHash',
  'callerPass',
]);

export interface RequirementsJudgeFalsePositiveLedgerEntry {
  schemaVersion: 'requirements-contract-judge-false-positive-ledger-entry/v1';
  ledgerEntryId: string;
  ledgerNamespace: 'requirements';
  actorClass: typeof REQUIREMENTS_ACTOR;
  judgeRole: typeof REQUIREMENTS_ROLE;
  attemptKeyHash: string;
  scopeManifestHash: string;
  findingId: string;
  origin: {
    gapId: string;
    auditUnitRef: string;
    requirementRef: string;
    sourceRef: string;
    sourceHash: string;
    evidenceRef: string;
  };
  observationHash: string;
  disposition: {
    disposition: 'accepted_false_positive';
    dispositionReasonHash: string;
    sourceAuthorityHash: string;
    evidenceHash: string;
  };
  dispositionHash: string;
  previousLedgerEntryHash: string | null;
  authorityBindingHash: string;
  appendOnly: true;
  perGapModelInvocationCount: 0;
  readonlyAuditorInvocationCount: 0;
  decisionFieldOrigin: 'package_calculated';
  decision: 'recorded';
  ledgerEntryHash: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireText(value: unknown, code: string): string {
  const result = text(value);
  if (!result) throw new Error(code);
  return result;
}

function requireHash(value: unknown, code: string): string {
  const hash = text(value);
  if (!HASH_PATTERN.test(hash)) throw new Error(code);
  return hash;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function schemaValidator() {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-false-positive-ledger-entry.schema.json'
  );
  return new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
}

function rejectForbiddenCallerFields(input: JsonRecord): void {
  const forbidden = Object.keys(input).filter((field) => FORBIDDEN_CALLER_FIELDS.has(field));
  if (forbidden.length > 0) {
    throw new Error(`requirements_judge_false_positive_caller_authority_injection:${forbidden}`);
  }
}

function rejectModelSeams(input: JsonRecord): void {
  const count = Number(input.perGapModelInvocationCount ?? 0);
  const readonlyCount = Number(input.readonlyAuditorInvocationCount ?? 0);
  if (
    count !== 0 ||
    readonlyCount !== 0 ||
    Array.isArray(input.perGapModelInvocations) ||
    Object.hasOwn(input, 'perGapModelInvocationReceiptHash')
  ) {
    throw new Error('requirements_judge_false_positive_model_seam_rejected');
  }
}

function verifyRequirementsRole(input: JsonRecord): void {
  if (input.actorClass !== REQUIREMENTS_ACTOR || input.judgeRole !== REQUIREMENTS_ROLE) {
    throw new Error('requirements_judge_false_positive_cross_role');
  }
}

function verifyCurrentAuthority(input: JsonRecord, currentAuthority: JsonRecord): void {
  if (
    input.attemptKeyHash !== currentAuthority.attemptKeyHash ||
    input.scopeManifestHash !== currentAuthority.scopeManifestHash
  ) {
    throw new Error('requirements_judge_false_positive_replay_or_stale_scope');
  }
}

function parseOrigin(value: unknown): RequirementsJudgeFalsePositiveLedgerEntry['origin'] {
  if (!isRecord(value)) throw new Error('requirements_judge_false_positive_origin_invalid');
  return {
    gapId: requireText(value.gapId, 'requirements_judge_false_positive_origin_invalid'),
    auditUnitRef: requireText(
      value.auditUnitRef,
      'requirements_judge_false_positive_origin_invalid'
    ),
    requirementRef: requireText(
      value.requirementRef,
      'requirements_judge_false_positive_origin_invalid'
    ),
    sourceRef: requireText(value.sourceRef, 'requirements_judge_false_positive_origin_invalid'),
    sourceHash: requireHash(value.sourceHash, 'requirements_judge_false_positive_origin_invalid'),
    evidenceRef: requireText(value.evidenceRef, 'requirements_judge_false_positive_origin_invalid'),
  };
}

function parseDisposition(
  value: unknown
): RequirementsJudgeFalsePositiveLedgerEntry['disposition'] {
  if (!isRecord(value) || value.disposition !== 'accepted_false_positive') {
    throw new Error('requirements_judge_false_positive_disposition_invalid');
  }
  return {
    disposition: 'accepted_false_positive',
    dispositionReasonHash: requireHash(
      value.dispositionReasonHash,
      'requirements_judge_false_positive_disposition_invalid'
    ),
    sourceAuthorityHash: requireHash(
      value.sourceAuthorityHash,
      'requirements_judge_false_positive_disposition_invalid'
    ),
    evidenceHash: requireHash(
      value.evidenceHash,
      'requirements_judge_false_positive_disposition_invalid'
    ),
  };
}

function validateEntry(receipt: unknown): RequirementsJudgeFalsePositiveLedgerEntry {
  if (!isRecord(receipt)) throw new Error('requirements_judge_false_positive_entry_invalid');
  const validate = schemaValidator();
  if (!validate(receipt)) {
    throw new Error(
      `requirements_judge_false_positive_entry_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const { ledgerEntryHash: _ledgerEntryHash, ...payload } = receipt;
  if (receipt.ledgerEntryHash !== sha256Stable(payload)) {
    throw new Error('requirements_judge_false_positive_entry_hash_mismatch');
  }
  return receipt as unknown as RequirementsJudgeFalsePositiveLedgerEntry;
}

function readLedgerEntries(ledgerPath: string): RequirementsJudgeFalsePositiveLedgerEntry[] {
  if (!fs.existsSync(ledgerPath)) return [];
  const content = fs.readFileSync(ledgerPath, 'utf8').trim();
  if (!content) return [];
  return content.split(/\r?\n/u).map((line) => validateEntry(JSON.parse(line)));
}

export function compileRequirementsJudgeFalsePositiveLedgerEntry(
  input: unknown
): RequirementsJudgeFalsePositiveLedgerEntry {
  if (!isRecord(input)) throw new Error('requirements_judge_false_positive_input_invalid');
  rejectForbiddenCallerFields(input);
  rejectModelSeams(input);
  verifyRequirementsRole(input);
  const currentAuthority = isRecord(input.currentAuthority) ? input.currentAuthority : {};
  verifyCurrentAuthority(input, currentAuthority);
  const origin = parseOrigin(input.origin);
  const disposition = parseDisposition(input.disposition);
  if (text(input.findingId) !== origin.gapId) {
    throw new Error('requirements_judge_false_positive_origin_invalid');
  }
  const previousLedgerEntryHash =
    input.previousLedgerEntryHash === null
      ? null
      : requireHash(
          input.previousLedgerEntryHash,
          'requirements_judge_false_positive_previous_invalid'
        );
  const authorityBinding = {
    attemptKeyHash: requireHash(
      input.attemptKeyHash,
      'requirements_judge_false_positive_authority_invalid'
    ),
    scopeManifestHash: requireHash(
      input.scopeManifestHash,
      'requirements_judge_false_positive_authority_invalid'
    ),
  };
  const payload = {
    schemaVersion: 'requirements-contract-judge-false-positive-ledger-entry/v1' as const,
    ledgerEntryId: requireText(
      input.entryId ?? input.ledgerEntryId,
      'requirements_judge_false_positive_entry_missing'
    ),
    ledgerNamespace: 'requirements' as const,
    actorClass: REQUIREMENTS_ACTOR,
    judgeRole: REQUIREMENTS_ROLE,
    ...authorityBinding,
    findingId: requireText(input.findingId, 'requirements_judge_false_positive_entry_missing'),
    origin,
    observationHash: sha256Stable(origin),
    disposition,
    dispositionHash: sha256Stable(disposition),
    previousLedgerEntryHash,
    authorityBindingHash: sha256Stable(authorityBinding),
    appendOnly: true as const,
    perGapModelInvocationCount: 0 as const,
    readonlyAuditorInvocationCount: 0 as const,
    decisionFieldOrigin: 'package_calculated' as const,
    decision: 'recorded' as const,
  };
  return validateEntry({ ...payload, ledgerEntryHash: sha256Stable(payload) });
}

export function appendRequirementsJudgeFalsePositiveLedgerEntry(input: {
  ledgerPath: string;
  input: unknown;
}): RequirementsJudgeFalsePositiveLedgerEntry {
  const resolvedPath = path.resolve(input.ledgerPath);
  const existing = readLedgerEntries(resolvedPath);
  const expectedPrevious =
    existing.length === 0 ? null : existing[existing.length - 1].ledgerEntryHash;
  if (isRecord(input.input) && (input.input.previousLedgerEntryHash ?? null) !== expectedPrevious) {
    throw new Error('requirements_judge_false_positive_hash_chain_broken');
  }
  const entry = compileRequirementsJudgeFalsePositiveLedgerEntry(input.input);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.appendFileSync(resolvedPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
  const readback = readLedgerEntries(resolvedPath);
  if (readback[readback.length - 1]?.ledgerEntryHash !== entry.ledgerEntryHash) {
    throw new Error('requirements_judge_false_positive_readback_mismatch');
  }
  return entry;
}

export function readRequirementsJudgeFalsePositiveLedger(
  ledgerPath: string
): RequirementsJudgeFalsePositiveLedgerEntry[] {
  return readLedgerEntries(path.resolve(ledgerPath));
}

export function validateRequirementsJudgeFalsePositiveLedgerEntry(
  entry: unknown
): RequirementsJudgeFalsePositiveLedgerEntry {
  return validateEntry(entry);
}
