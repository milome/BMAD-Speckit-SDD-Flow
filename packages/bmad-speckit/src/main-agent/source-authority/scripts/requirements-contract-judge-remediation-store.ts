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
  'receiptHash',
  'remediationBatchHash',
  'authorityBindingHash',
  'expectedHash',
  'expectedDispositionRefs',
  'expectedCoverageUnitRefs',
  'callerPass',
]);

export type RequirementsJudgeGapDisposition =
  | 'source_repair_required'
  | 'evidence_repair_required'
  | 'requirement_rewrite_required'
  | 'accepted_false_positive';

export interface RequirementsJudgeGapOrigin {
  gapId: string;
  auditUnitRef: string;
  requirementRef: string;
  sourceRef: string;
  sourceHash: string;
  evidenceRef: string;
}

export interface RequirementsJudgeGapDispositionRecord {
  gapId: string;
  disposition: RequirementsJudgeGapDisposition;
  dispositionReasonHash: string;
}

export interface RequirementsJudgeSourceRepairAction {
  gapId: string;
  actionKind:
    | 'edit_source'
    | 'add_evidence'
    | 'update_requirement'
    | 'no_source_change_false_positive';
  targetPath: string;
  sourceRef: string;
  repairActionHash: string;
}

export interface RequirementsJudgeRemediationEntry {
  origin: RequirementsJudgeGapOrigin;
  disposition: RequirementsJudgeGapDispositionRecord;
  sourceRepairAction: RequirementsJudgeSourceRepairAction;
  entryHash: string;
}

export interface RequirementsJudgeRemediationReceipt {
  schemaVersion: 'requirements-contract-judge-remediation-receipt/v1';
  actorClass: typeof REQUIREMENTS_ACTOR;
  judgeRole: typeof REQUIREMENTS_ROLE;
  ledgerNamespace: 'requirements';
  batchId: string;
  attemptKeyHash: string;
  scopeManifestHash: string;
  requirementsAuditAggregateHash: string;
  auditUnitSetHash: string;
  previousLedgerEntryHash: string | null;
  authorityBindingHash: string;
  gapCount: number;
  validatedGapRefs: string[];
  remediationEntries: RequirementsJudgeRemediationEntry[];
  priorFindingRefs: string[];
  currentDispositionRefs: string[];
  remediationBatchHash: string;
  perGapModelInvocationCount: 0;
  readonlyAuditorInvocationCount: 0;
  writeSemantics: 'create_only';
  writer: 'package_owned_requirements_remediation_store';
  decisionFieldOrigin: 'package_calculated';
  decision: 'recorded';
  receiptHash: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(text)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
    : [];
}

function uniqueSorted(value: unknown): string[] {
  const raw = strings(value);
  if (new Set(raw).size !== raw.length) {
    throw new Error('requirements_judge_remediation_duplicate_ref');
  }
  return raw;
}

function requireHash(value: unknown, code: string): string {
  const hash = text(value);
  if (!HASH_PATTERN.test(hash)) throw new Error(code);
  return hash;
}

function requireText(value: unknown, code: string): string {
  const result = text(value);
  if (!result) throw new Error(code);
  return result;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function schemaValidator() {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-remediation-receipt.schema.json'
  );
  return new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
}

function rejectForbiddenCallerFields(input: JsonRecord): void {
  const forbidden = Object.keys(input).filter((field) => FORBIDDEN_CALLER_FIELDS.has(field));
  if (forbidden.length > 0) {
    throw new Error(`requirements_judge_remediation_caller_authority_injection:${forbidden}`);
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
    throw new Error('requirements_judge_remediation_model_seam_rejected');
  }
}

function verifyRequirementsRole(input: JsonRecord): void {
  if (input.actorClass !== REQUIREMENTS_ACTOR || input.judgeRole !== REQUIREMENTS_ROLE) {
    throw new Error('requirements_judge_remediation_cross_role');
  }
}

function verifyCurrentAuthority(input: JsonRecord, currentAuthority: JsonRecord): void {
  const checks: Array<[unknown, unknown]> = [
    [input.attemptKeyHash, currentAuthority.attemptKeyHash],
    [input.scopeManifestHash, currentAuthority.scopeManifestHash],
    [input.requirementsAuditAggregateHash, currentAuthority.requirementsAuditAggregateHash],
    [input.auditUnitSetHash, currentAuthority.auditUnitSetHash],
    [input.previousLedgerEntryHash ?? null, currentAuthority.previousLedgerEntryHash ?? null],
  ];
  if (checks.some(([actual, expected]) => actual !== expected)) {
    throw new Error('requirements_judge_remediation_replay_or_stale_scope');
  }
}

function parseGapOrigin(value: unknown): RequirementsJudgeGapOrigin {
  if (!isRecord(value)) throw new Error('requirements_judge_gap_origin_invalid');
  return {
    gapId: requireText(value.gapId ?? value.id, 'requirements_judge_gap_origin_invalid'),
    auditUnitRef: requireText(value.auditUnitRef, 'requirements_judge_gap_origin_invalid'),
    requirementRef: requireText(value.requirementRef, 'requirements_judge_gap_origin_invalid'),
    sourceRef: requireText(value.sourceRef, 'requirements_judge_gap_origin_invalid'),
    sourceHash: requireHash(value.sourceHash, 'requirements_judge_gap_origin_invalid'),
    evidenceRef: requireText(value.evidenceRef, 'requirements_judge_gap_origin_invalid'),
  };
}

function parseDisposition(value: unknown): RequirementsJudgeGapDispositionRecord {
  if (!isRecord(value)) throw new Error('requirements_judge_gap_disposition_incomplete');
  const disposition = text(value.disposition);
  if (
    disposition !== 'source_repair_required' &&
    disposition !== 'evidence_repair_required' &&
    disposition !== 'requirement_rewrite_required' &&
    disposition !== 'accepted_false_positive'
  ) {
    throw new Error('requirements_judge_gap_disposition_incomplete');
  }
  return {
    gapId: requireText(value.gapId, 'requirements_judge_gap_disposition_incomplete'),
    disposition,
    dispositionReasonHash: requireHash(
      value.dispositionReasonHash,
      'requirements_judge_gap_disposition_incomplete'
    ),
  };
}

function parseAction(value: unknown): RequirementsJudgeSourceRepairAction {
  if (!isRecord(value)) throw new Error('requirements_judge_gap_source_action_incomplete');
  const actionKind = text(value.actionKind);
  if (
    actionKind !== 'edit_source' &&
    actionKind !== 'add_evidence' &&
    actionKind !== 'update_requirement' &&
    actionKind !== 'no_source_change_false_positive'
  ) {
    throw new Error('requirements_judge_gap_source_action_incomplete');
  }
  return {
    gapId: requireText(value.gapId, 'requirements_judge_gap_source_action_incomplete'),
    actionKind,
    targetPath: requireText(value.targetPath, 'requirements_judge_gap_source_action_incomplete'),
    sourceRef: requireText(value.sourceRef, 'requirements_judge_gap_source_action_incomplete'),
    repairActionHash: requireHash(
      value.repairActionHash,
      'requirements_judge_gap_source_action_incomplete'
    ),
  };
}

function byGapId<T extends { gapId: string }>(records: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    if (map.has(record.gapId)) throw new Error('requirements_judge_gap_origin_duplicate');
    map.set(record.gapId, record);
  }
  return map;
}

function validateReceipt(receipt: unknown): RequirementsJudgeRemediationReceipt {
  if (!isRecord(receipt)) throw new Error('requirements_judge_remediation_receipt_invalid');
  const validate = schemaValidator();
  if (!validate(receipt)) {
    throw new Error(
      `requirements_judge_remediation_receipt_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  for (const entry of receipt.remediationEntries as RequirementsJudgeRemediationEntry[]) {
    const { entryHash: _entryHash, ...payload } = entry;
    if (entry.entryHash !== sha256Stable(payload)) {
      throw new Error('requirements_judge_remediation_entry_hash_mismatch');
    }
  }
  const { receiptHash: _receiptHash, ...payload } = receipt;
  if (receipt.receiptHash !== sha256Stable(payload)) {
    throw new Error('requirements_judge_remediation_receipt_hash_mismatch');
  }
  return receipt as unknown as RequirementsJudgeRemediationReceipt;
}

export function compileRequirementsJudgeRemediationReceipt(
  input: unknown
): RequirementsJudgeRemediationReceipt {
  if (!isRecord(input)) throw new Error('requirements_judge_remediation_input_invalid');
  rejectForbiddenCallerFields(input);
  rejectModelSeams(input);
  verifyRequirementsRole(input);
  const currentAuthority = isRecord(input.currentAuthority) ? input.currentAuthority : {};
  verifyCurrentAuthority(input, currentAuthority);

  const origins = Array.isArray(input.validatedGaps) ? input.validatedGaps.map(parseGapOrigin) : [];
  if (origins.length === 0) throw new Error('requirements_judge_gap_set_missing');
  const dispositions = Array.isArray(input.dispositions)
    ? input.dispositions.map(parseDisposition)
    : [];
  const actions = Array.isArray(input.sourceRepairActions)
    ? input.sourceRepairActions.map(parseAction)
    : [];
  const originMap = byGapId(origins);
  const dispositionMap = byGapId(dispositions);
  const actionMap = byGapId(actions);
  const gapIds = [...originMap.keys()].sort((left, right) => left.localeCompare(right));
  if (
    !sameSet(
      gapIds,
      [...dispositionMap.keys()].sort((left, right) => left.localeCompare(right))
    )
  ) {
    throw new Error('requirements_judge_gap_disposition_incomplete');
  }
  if (
    !sameSet(
      gapIds,
      [...actionMap.keys()].sort((left, right) => left.localeCompare(right))
    )
  ) {
    throw new Error('requirements_judge_gap_source_action_incomplete');
  }

  const priorFindingRefs = uniqueSorted(input.priorFindingRefs);
  const currentDispositionRefs = uniqueSorted(input.currentDispositionRefs);
  if (!sameSet(priorFindingRefs, currentDispositionRefs)) {
    throw new Error('requirements_judge_prior_finding_disposition_incomplete');
  }

  const remediationEntries = gapIds.map((gapId) => {
    const payload = {
      origin: originMap.get(gapId)!,
      disposition: dispositionMap.get(gapId)!,
      sourceRepairAction: actionMap.get(gapId)!,
    };
    return { ...payload, entryHash: sha256Stable(payload) };
  });
  const authorityBinding = {
    attemptKeyHash: requireHash(input.attemptKeyHash, 'requirements_judge_authority_invalid'),
    scopeManifestHash: requireHash(input.scopeManifestHash, 'requirements_judge_authority_invalid'),
    requirementsAuditAggregateHash: requireHash(
      input.requirementsAuditAggregateHash,
      'requirements_judge_authority_invalid'
    ),
    auditUnitSetHash: requireHash(input.auditUnitSetHash, 'requirements_judge_authority_invalid'),
    previousLedgerEntryHash:
      input.previousLedgerEntryHash === null
        ? null
        : requireHash(input.previousLedgerEntryHash, 'requirements_judge_authority_invalid'),
  };
  const remediationBatchHash = sha256Stable({
    batchId: requireText(input.batchId, 'requirements_judge_remediation_batch_missing'),
    remediationEntries,
    priorFindingRefs,
    currentDispositionRefs,
  });
  const payload = {
    schemaVersion: 'requirements-contract-judge-remediation-receipt/v1' as const,
    actorClass: REQUIREMENTS_ACTOR,
    judgeRole: REQUIREMENTS_ROLE,
    ledgerNamespace: 'requirements' as const,
    batchId: requireText(input.batchId, 'requirements_judge_remediation_batch_missing'),
    ...authorityBinding,
    authorityBindingHash: sha256Stable(authorityBinding),
    gapCount: remediationEntries.length,
    validatedGapRefs: gapIds,
    remediationEntries,
    priorFindingRefs,
    currentDispositionRefs,
    remediationBatchHash,
    perGapModelInvocationCount: 0 as const,
    readonlyAuditorInvocationCount: 0 as const,
    writeSemantics: 'create_only' as const,
    writer: 'package_owned_requirements_remediation_store' as const,
    decisionFieldOrigin: 'package_calculated' as const,
    decision: 'recorded' as const,
  };
  return validateReceipt({ ...payload, receiptHash: sha256Stable(payload) });
}

export function writeRequirementsJudgeRemediationReceipt(input: {
  receiptPath: string;
  input: unknown;
}): RequirementsJudgeRemediationReceipt {
  const resolvedPath = path.resolve(input.receiptPath);
  if (fs.existsSync(resolvedPath)) {
    throw new Error('requirements_judge_remediation_receipt_exists');
  }
  const receipt = compileRequirementsJudgeRemediationReceipt(input.input);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  const readback = validateReceipt(readJson(resolvedPath));
  if (JSON.stringify(readback) !== JSON.stringify(receipt)) {
    throw new Error('requirements_judge_remediation_receipt_readback_mismatch');
  }
  return readback;
}

export function validateRequirementsJudgeRemediationReceipt(
  receipt: unknown
): RequirementsJudgeRemediationReceipt {
  return validateReceipt(receipt);
}
