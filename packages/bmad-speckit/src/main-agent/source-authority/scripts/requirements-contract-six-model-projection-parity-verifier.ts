import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  SIX_MODEL_PARITY_AUTHORITY_SCHEMA_VERSION,
  SIX_MODEL_PARITY_CASES,
  SIX_MODEL_PARITY_CASE_PRODUCER,
  SIX_MODEL_PARITY_COMMAND_RECEIPT_SCHEMA_VERSION,
  SIX_MODEL_PARITY_MODEL_ORDER,
  SIX_MODEL_PARITY_OBSERVATION_ACTION,
  SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
  SIX_MODEL_PARITY_OBSERVATION_SCHEMA_VERSION,
  SIX_MODEL_PARITY_SURFACES,
  canonicalSixModelParityJson,
} from './requirements-contract-six-model-projection-parity-observation-producer';

interface SafeWriteReceipt {
  schemaVersion: 'large-document-writer-safe-write/v1';
  targetPath: string;
  mode: 'create' | 'replace' | 'upsert';
  tempPath: string;
  tempHash: string;
  backupPath: string | null;
  originalHash: string | null;
  backupHash: string | null;
  finalHash: string;
  writtenAt: string;
}

const { safeWriteJson } = require('../../../utils/large-document-writer') as {
  safeWriteJson(
    targetPath: string,
    value: unknown,
    options: { mode: 'create' | 'replace' | 'upsert' }
  ): SafeWriteReceipt;
};

const REPORT_SCHEMA_VERSION =
  'requirements-contract-six-model-projection-parity-report/v1';
const PUBLICATION_RECEIPT_SCHEMA_VERSION =
  'requirements-contract-six-model-projection-parity-publication-receipt/v1';
const VERIFIER_PRODUCER = 'requirements-contract-six-model-projection-parity-verifier';
const VERIFIER_ACTION = 'requirements-contract-six-model-projection-parity-verify';
const GOVERNED_WRITER = 'large-document-writer-safe-write/v1';
const SURFACES = SIX_MODEL_PARITY_SURFACES;
const CASES = SIX_MODEL_PARITY_CASES;
const COUNT_KEYS = ['facade', 'receipt', 'projection', 'bridge', 'panorama'] as const;
const MODEL_ORDER = SIX_MODEL_PARITY_MODEL_ORDER;

type Surface = (typeof SURFACES)[number];
type CaseId = (typeof CASES)[number];
type CountKey = (typeof COUNT_KEYS)[number];
type Counts = Record<CountKey, number>;
// Parity artifacts are schema-validated before dynamic verification traversal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;
const ZERO_COUNTS = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as Counts;

export interface RequirementsContractSixModelProjectionParityVerifyOptions {
  evidenceRoot: string;
  out: string;
  json?: boolean;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const UNRESOLVED_AUTHORITY_CONTRACT_HASH = sha256(
  'requirements-contract-six-model-projection-parity-authority:unresolved'
);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalSixModelParityJson(left) === canonicalSixModelParityJson(right);
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

function schemaPath(name: string): string {
  return path.join(__dirname, '..', 'schemas', name);
}

function schemaDocument(name: string): JsonRecord {
  return object(JSON.parse(fs.readFileSync(schemaPath(name), 'utf8')));
}

function schemaValidator(name: string, dependencies: JsonRecord[] = []) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const dependency of dependencies) ajv.addSchema(dependency);
  return ajv.compile(schemaDocument(name));
}

function schemaValidator2020(name: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schemaDocument(name));
}

function hashOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function ratio(valid: number, expected: number): number {
  return expected === 0 ? 1 : valid / expected;
}

function relativePath(value: string): string {
  return slash(value.replace(/^\.[/\\]/u, ''));
}

function resolveContained(root: string, supplied: unknown): string | null {
  if (typeof supplied !== 'string' || supplied.length === 0 || path.isAbsolute(supplied)) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, supplied);
  if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) return null;
  if (!fs.existsSync(resolved)) return resolved;
  try {
    const realRoot = fs.realpathSync.native(resolvedRoot);
    const realTarget = fs.realpathSync.native(resolved);
    if (realTarget === realRoot || !realTarget.startsWith(`${realRoot}${path.sep}`)) return null;
  } catch {
    return null;
  }
  return resolved;
}

type RegularFileInspection =
  | { kind: 'file'; bytes: Buffer }
  | { kind: 'missing' | 'broken_link' | 'not_file' | 'io_error'; bytes: null };

function inspectRegularFile(target: string): RegularFileInspection {
  let linkStat: fs.Stats;
  try {
    linkStat = fs.lstatSync(target);
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT'
      ? { kind: 'missing', bytes: null }
      : { kind: 'io_error', bytes: null };
  }
  if (linkStat.isSymbolicLink() && !fs.existsSync(target)) {
    return { kind: 'broken_link', bytes: null };
  }
  try {
    if (!fs.statSync(target).isFile()) return { kind: 'not_file', bytes: null };
  } catch {
    return { kind: 'io_error', bytes: null };
  }
  try {
    return { kind: 'file', bytes: fs.readFileSync(target) };
  } catch {
    return { kind: 'io_error', bytes: null };
  }
}

function reportRef(value: unknown): JsonRecord | null {
  const ref = object(value);
  const hash = hashOrNull(ref.hash);
  const readbackHash = hashOrNull(ref.readbackHash);
  if (
    typeof ref.path !== 'string' ||
    ref.path.length === 0 ||
    hash === null ||
    readbackHash === null ||
    ref.readbackVerified !== true
  ) {
    return null;
  }
  return {
    path: slash(ref.path),
    hash,
    readbackHash,
    readbackVerified: true,
  };
}

function expectedOutcome(caseId: CaseId): JsonRecord {
  const outcomes: Record<CaseId, JsonRecord> = {
    valid_receipt: {
      effectiveStatus: 'pass',
      projectionStatus: 'pass',
      projectionIntegrity: 'valid',
      receiptState: 'valid',
      authorityClass: 'controlled_confirmation',
      syntheticBridgePass: false,
    },
    missing_receipt: {
      effectiveStatus: 'not_established',
      projectionStatus: 'pass',
      projectionIntegrity: 'missing',
      receiptState: 'missing',
      authorityClass: 'none',
      syntheticBridgePass: false,
    },
    missing_projection: {
      effectiveStatus: 'not_established',
      projectionStatus: null,
      projectionIntegrity: 'missing',
      receiptState: 'valid',
      authorityClass: 'none',
      syntheticBridgePass: false,
    },
    projection_mismatch: {
      effectiveStatus: 'blocked',
      projectionStatus: 'blocked',
      projectionIntegrity: 'mismatch',
      receiptState: 'valid',
      authorityClass: 'controlled_confirmation',
      syntheticBridgePass: false,
    },
    stale_attempt: {
      effectiveStatus: 'stale',
      projectionStatus: 'pass',
      projectionIntegrity: 'stale',
      receiptState: 'stale',
      authorityClass: 'controlled_confirmation',
      syntheticBridgePass: false,
    },
    blocked_receipt: {
      effectiveStatus: 'blocked',
      projectionStatus: 'blocked',
      projectionIntegrity: 'valid',
      receiptState: 'blocked',
      authorityClass: 'deterministic_gate',
      syntheticBridgePass: false,
    },
    synthetic_bridge: {
      effectiveStatus: 'not_established',
      projectionStatus: 'not_established',
      projectionIntegrity: 'missing',
      receiptState: 'missing',
      authorityClass: 'none',
      syntheticBridgePass: false,
    },
    complete_panorama: {
      effectiveStatus: 'not_established',
      projectionStatus: null,
      projectionIntegrity: 'missing',
      receiptState: 'missing',
      authorityClass: 'none',
      syntheticBridgePass: false,
      panoramaModelOrder: [...MODEL_ORDER],
      panoramaRowCount: MODEL_ORDER.length,
    },
  };
  return outcomes[caseId];
}

function sanitizedOutcome(value: unknown): JsonRecord | null {
  const outcome = object(value);
  const required = [
    'effectiveStatus',
    'projectionStatus',
    'projectionIntegrity',
    'receiptState',
    'authorityClass',
    'syntheticBridgePass',
  ];
  if (
    required.some((key) => !(key in outcome)) ||
    typeof outcome.effectiveStatus !== 'string' ||
    (outcome.projectionStatus !== null && typeof outcome.projectionStatus !== 'string') ||
    typeof outcome.projectionIntegrity !== 'string' ||
    typeof outcome.receiptState !== 'string' ||
    typeof outcome.authorityClass !== 'string' ||
    typeof outcome.syntheticBridgePass !== 'boolean'
  ) {
    return null;
  }
  const normalized: JsonRecord = {
    effectiveStatus: outcome.effectiveStatus,
    projectionStatus: outcome.projectionStatus,
    projectionIntegrity: outcome.projectionIntegrity,
    receiptState: outcome.receiptState,
    authorityClass: outcome.authorityClass,
    syntheticBridgePass: outcome.syntheticBridgePass,
  };
  if (Array.isArray(outcome.panoramaModelOrder)) {
    normalized.panoramaModelOrder = stringArray(outcome.panoramaModelOrder);
  }
  if (typeof outcome.panoramaRowCount === 'number') {
    normalized.panoramaRowCount = outcome.panoramaRowCount;
  }
  return normalized;
}

function deriveCounts(actual: JsonRecord | null, expected: JsonRecord): Counts {
  if (actual === null) return { ...ZERO_COUNTS };
  return {
    facade:
      actual.effectiveStatus === expected.effectiveStatus &&
      actual.authorityClass === expected.authorityClass
        ? 0
        : 1,
    receipt: actual.receiptState === expected.receiptState ? 0 : 1,
    projection:
      actual.projectionStatus === expected.projectionStatus &&
      actual.projectionIntegrity === expected.projectionIntegrity
        ? 0
        : 1,
    bridge: actual.syntheticBridgePass === expected.syntheticBridgePass ? 0 : 1,
    panorama:
      'panoramaModelOrder' in expected
        ? sameStrings(stringArray(actual.panoramaModelOrder), MODEL_ORDER) &&
          actual.panoramaRowCount === MODEL_ORDER.length
          ? 0
          : 1
        : 0,
  };
}

interface AuthorityState {
  raw: JsonRecord;
  hash: string | null;
  contractHash: string;
  requirementSetId: string;
  implementationAttemptId: string;
  maxObservationAgeMs: number;
  maxClockSkewMs: number;
  cells: Map<Surface, JsonRecord>;
  valid: boolean;
}

interface CoverageStats {
  surfaceValid: number;
  surfaceExpected: number;
  caseValid: number;
  caseExpected: number;
  readerValid: number;
  readerExpected: number;
  writerValid: number;
  writerExpected: number;
}

interface ParityValidators {
  observation: ReturnType<typeof schemaValidator>;
  commandReceipt: ReturnType<typeof schemaValidator>;
  caseProof: ReturnType<typeof schemaValidator>;
  behaviorObservation: ReturnType<typeof schemaValidator>;
  controlledCommandReceipt: ReturnType<typeof schemaValidator2020>;
}

function unresolvedAuthorityState(): AuthorityState {
  return {
    raw: {},
    hash: null,
    contractHash: UNRESOLVED_AUTHORITY_CONTRACT_HASH,
    requirementSetId: 'unresolved',
    implementationAttemptId: 'unresolved',
    maxObservationAgeMs: 0,
    maxClockSkewMs: 0,
    cells: new Map(),
    valid: false,
  };
}

function readAuthority(evidenceRoot: string, blockingReasons: string[]): AuthorityState {
  const target = resolveContained(evidenceRoot, 'parity-authority.json');
  if (target === null) {
    addUnique(blockingReasons, 'path_escape:authority');
    addUnique(blockingReasons, 'authority_identity_invalid');
    return unresolvedAuthorityState();
  }
  const inspection = inspectRegularFile(target);
  if (inspection.kind !== 'file') {
    const reason =
      inspection.kind === 'missing'
        ? 'authority_missing'
        : inspection.kind === 'broken_link'
          ? 'authority_broken_link'
          : inspection.kind === 'not_file'
            ? 'authority_not_file'
            : 'authority_io_error';
    addUnique(blockingReasons, reason);
    addUnique(blockingReasons, 'authority_identity_invalid');
    return unresolvedAuthorityState();
  }
  const bytes = inspection.bytes;
  let raw: JsonRecord;
  try {
    raw = object(JSON.parse(bytes.toString('utf8')));
  } catch {
    addUnique(blockingReasons, 'authority_json_invalid');
    raw = {};
  }
  const candidateContractHash = hashOrNull(raw.contractHash);
  const candidateRequirementSetId = textOrNull(raw.requirementSetId) ?? 'unresolved';
  const candidateImplementationAttemptId =
    textOrNull(raw.implementationAttemptId) ?? 'unresolved';
  const commandBinding = object(raw.commandBinding);
  const executorIdentity = object(commandBinding.executorIdentity);
  const cells = new Map<Surface, JsonRecord>();
  for (const entry of Array.isArray(raw.cells) ? raw.cells : []) {
    const cell = object(entry);
    if (SURFACES.includes(cell.surface as Surface)) cells.set(cell.surface as Surface, cell);
  }
  const checks = [
    raw.schemaVersion === SIX_MODEL_PARITY_AUTHORITY_SCHEMA_VERSION,
    hashOrNull(raw.contractHash) !== null,
    raw.producer === SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
    raw.action === SIX_MODEL_PARITY_OBSERVATION_ACTION,
    raw.caseProducer === SIX_MODEL_PARITY_CASE_PRODUCER,
    candidateRequirementSetId !== 'unresolved',
    candidateImplementationAttemptId !== 'unresolved',
    typeof raw.transactionId === 'string' && /^TX-[A-Za-z0-9._-]+$/u.test(raw.transactionId),
    typeof raw.architectureAuditAttemptId === 'string' &&
      /^AUDIT-[A-Za-z0-9._-]+$/u.test(raw.architectureAuditAttemptId),
    typeof raw.activePhaseAuditAttemptId === 'string' &&
      /^AUDIT-[A-Za-z0-9._-]+$/u.test(raw.activePhaseAuditAttemptId),
    hashOrNull(raw.inputSnapshotHash) !== null,
    typeof commandBinding.commandId === 'string' &&
      /^CMD-[0-9]+$/u.test(commandBinding.commandId),
    stringArray(commandBinding.argvPrefix).length > 0,
    textOrNull(commandBinding.cwd) !== null,
    stringArray(commandBinding.acceptanceRefs).length > 0,
    stringArray(commandBinding.traceRefs).length > 0,
    executorIdentity.class === 'goal_controlled_executor',
    textOrNull(executorIdentity.id) !== null,
    sameStrings(stringArray(raw.modelOrder), MODEL_ORDER),
    sameStrings(stringArray(raw.exactCases), CASES),
    sameStrings(stringArray(raw.surfaces), SURFACES),
    SURFACES.every((surface, index) => object(raw.cells?.[index]).surface === surface),
    SURFACES.every((surface) => {
      const cell = cells.get(surface) ?? {};
      const applicability = validApplicability(cell.applicability);
      return (
        applicability !== null &&
        (applicability.applicable === false ||
          (textOrNull(cell.artifactPath) !== null &&
            stringArray(cell.readerPaths).length > 0 &&
            stringArray(cell.writerPaths).length > 0 &&
            textOrNull(cell.proofRoot) !== null &&
            textOrNull(cell.controlledReceiptRoot) !== null &&
            textOrNull(cell.behaviorObservationRoot) !== null))
      );
    }),
    Number.isFinite(raw.maxObservationAgeMs) && raw.maxObservationAgeMs > 0,
    Number.isFinite(raw.maxClockSkewMs) && raw.maxClockSkewMs >= 0,
  ];
  const valid = checks.every(Boolean);
  if (!valid) addUnique(blockingReasons, 'authority_identity_invalid');
  return {
    raw,
    hash: sha256(bytes),
    contractHash: valid
      ? (candidateContractHash as string)
      : UNRESOLVED_AUTHORITY_CONTRACT_HASH,
    requirementSetId: valid ? candidateRequirementSetId : 'unresolved',
    implementationAttemptId: valid ? candidateImplementationAttemptId : 'unresolved',
    maxObservationAgeMs: numeric(raw.maxObservationAgeMs),
    maxClockSkewMs: numeric(raw.maxClockSkewMs),
    cells,
    valid,
  };
}

function validateFileRef(input: {
  evidenceRoot: string;
  raw: unknown;
  expectedPath: string;
  missingReason: string;
  pathEscapeReason: string;
  pathMismatchReason: string;
  hashReason: string;
  readbackReason: string;
  trustIssues: string[];
  blockingReasons: string[];
}): {
  ref: JsonRecord | null;
  valid: boolean;
  target: string | null;
  bytes: Buffer | null;
} {
  const rawRef = object(input.raw);
  const ref = reportRef(rawRef);
  const fail = (reason: string): void => {
    addUnique(input.trustIssues, reason);
    addUnique(input.blockingReasons, reason);
  };
  if (ref === null) {
    fail(input.missingReason);
    return { ref: null, valid: false, target: null, bytes: null };
  }
  const target = resolveContained(input.evidenceRoot, rawRef.path);
  if (target === null) {
    fail(input.pathEscapeReason);
    return { ref, valid: false, target: null, bytes: null };
  }
  if (relativePath(rawRef.path) !== relativePath(input.expectedPath)) {
    fail(input.pathMismatchReason);
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    fail(input.missingReason);
    return { ref, valid: false, target, bytes: null };
  }
  const bytes = fs.readFileSync(target);
  const actualHash = sha256(bytes);
  if (rawRef.hash !== actualHash) fail(input.hashReason);
  if (
    rawRef.readbackHash !== actualHash ||
    rawRef.readbackVerified !== true ||
    rawRef.hash !== rawRef.readbackHash
  ) {
    fail(input.readbackReason);
  }
  return {
    ref,
    valid:
      relativePath(rawRef.path) === relativePath(input.expectedPath) &&
      rawRef.hash === actualHash &&
      rawRef.readbackHash === actualHash &&
      rawRef.readbackVerified === true,
    target,
    bytes,
  };
}

function validApplicability(value: unknown): JsonRecord | null {
  const applicability = object(value);
  if (applicability.applicable === true && applicability.reason === null) {
    return { applicable: true, reason: null };
  }
  if (
    applicability.applicable === false &&
    typeof applicability.reason === 'string' &&
    applicability.reason.length > 0
  ) {
    return { applicable: false, reason: applicability.reason };
  }
  return null;
}

function freshTimestamp(
  value: unknown,
  authority: AuthorityState,
  now: number
): boolean {
  if (typeof value !== 'string') return false;
  const observed = new Date(value).getTime();
  return (
    Number.isFinite(observed) &&
    now - observed <= authority.maxObservationAgeMs &&
    observed - now <= authority.maxClockSkewMs
  );
}

function hasArgPair(argv: readonly string[], name: string, value: string): boolean {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] === value;
}

function validateControlledOutput(
  evidenceRoot: string,
  rawPath: unknown,
  rawHash: unknown,
  reason: string,
  fail: (reason: string) => void
): string | null {
  const target = resolveContained(evidenceRoot, rawPath);
  if (
    target === null ||
    !fs.existsSync(target) ||
    !fs.statSync(target).isFile() ||
    rawHash !== sha256(fs.readFileSync(target))
  ) {
    fail(reason);
    return null;
  }
  return target;
}

function readControlledCaseEvidence(input: {
  evidenceRoot: string;
  surface: Surface;
  caseId: CaseId;
  cell: JsonRecord;
  proof: JsonRecord;
  authority: AuthorityState;
  validators: ParityValidators;
  trustIssues: string[];
  blockingReasons: string[];
  now: number;
}): {
  valid: boolean;
  outcome: JsonRecord | null;
  controlledCommandReceiptRef: JsonRecord | null;
  behaviorObservationRef: JsonRecord | null;
} {
  const fail = (reason: string): void => {
    addUnique(input.trustIssues, reason);
    addUnique(input.blockingReasons, reason);
  };
  const identityReason = `case_proof_identity_mismatch:${input.surface}:${input.caseId}`;
  if (!input.validators.caseProof(input.proof)) fail(`case_proof_schema_invalid:${input.surface}:${input.caseId}`);
  if (
    input.proof.schemaVersion !== 'requirements-contract-six-model-projection-parity-case-proof/v2' ||
    input.proof.producer !== SIX_MODEL_PARITY_CASE_PRODUCER ||
    input.proof.action !== `run:${input.caseId}` ||
    input.proof.surface !== input.surface ||
    input.proof.caseId !== input.caseId ||
    input.proof.contractHash !== input.authority.contractHash ||
    input.proof.requirementSetId !== input.authority.requirementSetId ||
    input.proof.implementationAttemptId !== input.authority.implementationAttemptId ||
    !freshTimestamp(input.proof.observedAt, input.authority, input.now)
  ) {
    fail(identityReason);
  }

  const controlledCommandReceiptRef = validateFileRef({
    evidenceRoot: input.evidenceRoot,
    raw: input.proof.controlledCommandReceiptRef,
    expectedPath: slash(
      path.join(String(input.cell.controlledReceiptRoot || ''), `${input.caseId}.json`)
    ),
    missingReason: `case_controlled_receipt_missing:${input.surface}:${input.caseId}`,
    pathEscapeReason: `path_escape:${input.surface}:${input.caseId}:controlled_receipt`,
    pathMismatchReason: `case_controlled_receipt_path_mismatch:${input.surface}:${input.caseId}`,
    hashReason: `case_controlled_receipt_hash_mismatch:${input.surface}:${input.caseId}`,
    readbackReason: `case_controlled_receipt_readback_mismatch:${input.surface}:${input.caseId}`,
    trustIssues: input.trustIssues,
    blockingReasons: input.blockingReasons,
  });
  const behaviorObservationRef = validateFileRef({
    evidenceRoot: input.evidenceRoot,
    raw: input.proof.behaviorObservationRef,
    expectedPath: slash(
      path.join(String(input.cell.behaviorObservationRoot || ''), `${input.caseId}.json`)
    ),
    missingReason: `case_behavior_observation_missing:${input.surface}:${input.caseId}`,
    pathEscapeReason: `path_escape:${input.surface}:${input.caseId}:behavior_observation`,
    pathMismatchReason: `case_behavior_observation_path_mismatch:${input.surface}:${input.caseId}`,
    hashReason: `case_behavior_observation_hash_mismatch:${input.surface}:${input.caseId}`,
    readbackReason: `case_behavior_observation_readback_mismatch:${input.surface}:${input.caseId}`,
    trustIssues: input.trustIssues,
    blockingReasons: input.blockingReasons,
  });
  if (
    !controlledCommandReceiptRef.valid ||
    controlledCommandReceiptRef.target === null ||
    controlledCommandReceiptRef.bytes === null ||
    !behaviorObservationRef.valid ||
    behaviorObservationRef.target === null ||
    behaviorObservationRef.bytes === null
  ) {
    return {
      valid: false,
      outcome: null,
      controlledCommandReceiptRef: controlledCommandReceiptRef.ref,
      behaviorObservationRef: behaviorObservationRef.ref,
    };
  }

  let controlledReceipt: JsonRecord;
  let behaviorObservation: JsonRecord;
  try {
    controlledReceipt = object(
      JSON.parse(controlledCommandReceiptRef.bytes.toString('utf8'))
    );
  } catch {
    controlledReceipt = {};
  }
  try {
    behaviorObservation = object(
      JSON.parse(behaviorObservationRef.bytes.toString('utf8'))
    );
  } catch {
    behaviorObservation = {};
  }

  if (!input.validators.controlledCommandReceipt(controlledReceipt)) {
    fail(`case_controlled_receipt_schema_invalid:${input.surface}:${input.caseId}`);
  }
  if (!input.validators.behaviorObservation(behaviorObservation)) {
    fail(`case_behavior_observation_schema_invalid:${input.surface}:${input.caseId}`);
  }
  const binding = object(input.authority.raw.commandBinding);
  const expectedReceiptIdentity = {
    commandId: binding.commandId,
    transactionId: input.authority.raw.transactionId,
    implementationAttemptId: input.authority.implementationAttemptId,
    architectureAuditAttemptId: input.authority.raw.architectureAuditAttemptId,
    activePhaseAuditAttemptId: input.authority.raw.activePhaseAuditAttemptId,
    contractHash: input.authority.contractHash,
    inputSnapshotHash: input.authority.raw.inputSnapshotHash,
  };
  if (
    Object.entries(expectedReceiptIdentity).some(
      ([key, value]) => controlledReceipt[key] !== value
    ) ||
    !sameJson(controlledReceipt.executorIdentity, binding.executorIdentity) ||
    controlledReceipt.exitCode !== 0 ||
    controlledReceipt.decision !== 'pass' ||
    controlledReceipt.passAuthorityScope !== 'command_only' ||
    controlledReceipt.publication?.readbackVerified !== true ||
    controlledReceipt.publication?.explicitUtf8 !== true ||
    controlledReceipt.publication?.createOnly !== true ||
    relativePath(String(controlledReceipt.publication?.targetPath || '')) !==
      relativePath(String(input.proof.controlledCommandReceiptRef?.path || '')) ||
    !sameStrings(stringArray(controlledReceipt.acceptanceRefs), stringArray(binding.acceptanceRefs)) ||
    !sameStrings(stringArray(controlledReceipt.traceRefs), stringArray(binding.traceRefs))
  ) {
    fail(`case_controlled_receipt_binding_mismatch:${input.surface}:${input.caseId}`);
  }

  const argv = stringArray(controlledReceipt.argv);
  const argvPrefix = stringArray(binding.argvPrefix);
  if (
    !sameStrings(argv.slice(0, argvPrefix.length), argvPrefix) ||
    !hasArgPair(argv, '--surface', input.surface) ||
    !hasArgPair(argv, '--case', input.caseId) ||
    controlledReceipt.argvHash !== sha256(canonicalSixModelParityJson(argv)) ||
    path.resolve(String(controlledReceipt.cwd || '')) !==
      path.resolve(String(binding.cwd || '')) ||
    controlledReceipt.hostIdentity?.platform !== process.platform ||
    controlledReceipt.hostIdentity?.architecture !== process.arch ||
    controlledReceipt.hostIdentity?.nodeVersion !== process.version
  ) {
    fail(`case_controlled_receipt_execution_mismatch:${input.surface}:${input.caseId}`);
  }

  const startedAt = new Date(controlledReceipt.startedAt).getTime();
  const endedAt = new Date(controlledReceipt.endedAt).getTime();
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    startedAt > endedAt ||
    controlledReceipt.endedAt !== input.proof.observedAt ||
    !freshTimestamp(controlledReceipt.endedAt, input.authority, input.now)
  ) {
    fail(`case_controlled_receipt_timestamp_mismatch:${input.surface}:${input.caseId}`);
  }

  const stdoutTarget = validateControlledOutput(
    input.evidenceRoot,
    controlledReceipt.stdoutPath,
    controlledReceipt.stdoutHash,
    `case_controlled_receipt_stdout_mismatch:${input.surface}:${input.caseId}`,
    fail
  );
  validateControlledOutput(
    input.evidenceRoot,
    controlledReceipt.stderrPath,
    controlledReceipt.stderrHash,
    `case_controlled_receipt_stderr_mismatch:${input.surface}:${input.caseId}`,
    fail
  );
  if (
    stdoutTarget !== behaviorObservationRef.target ||
    controlledReceipt.stdoutHash !== behaviorObservationRef.ref?.hash
  ) {
    fail(`case_controlled_receipt_observation_mismatch:${input.surface}:${input.caseId}`);
  }
  const children = Array.isArray(controlledReceipt.orderedChildren)
    ? controlledReceipt.orderedChildren.map((entry: unknown) => object(entry))
    : [];
  if (children.length === 0) {
    fail(`case_controlled_receipt_children_missing:${input.surface}:${input.caseId}`);
  }
  for (const child of children) {
    const childArgv = stringArray(child.argv);
    if (
      child.argvHash !== sha256(canonicalSixModelParityJson(childArgv)) ||
      child.exitCode !== 0
    ) {
      fail(`case_controlled_receipt_child_mismatch:${input.surface}:${input.caseId}`);
    }
    validateControlledOutput(
      input.evidenceRoot,
      child.stdoutPath,
      child.stdoutHash,
      `case_controlled_receipt_child_stdout_mismatch:${input.surface}:${input.caseId}`,
      fail
    );
    validateControlledOutput(
      input.evidenceRoot,
      child.stderrPath,
      child.stderrHash,
      `case_controlled_receipt_child_stderr_mismatch:${input.surface}:${input.caseId}`,
      fail
    );
  }

  if (
    behaviorObservation.producer !== SIX_MODEL_PARITY_CASE_PRODUCER ||
    behaviorObservation.action !== `run:${input.caseId}` ||
    behaviorObservation.surface !== input.surface ||
    behaviorObservation.caseId !== input.caseId ||
    behaviorObservation.contractHash !== input.authority.contractHash ||
    behaviorObservation.requirementSetId !== input.authority.requirementSetId ||
    behaviorObservation.implementationAttemptId !== input.authority.implementationAttemptId ||
    behaviorObservation.observedAt !== input.proof.observedAt
  ) {
    fail(`case_behavior_observation_binding_mismatch:${input.surface}:${input.caseId}`);
  }
  const outcome = sanitizedOutcome(behaviorObservation.outcome);
  if (outcome === null) fail(`case_behavior_outcome_invalid:${input.surface}:${input.caseId}`);
  return {
    valid: input.trustIssues.every((issue) => !issue.includes(`:${input.caseId}`)),
    outcome,
    controlledCommandReceiptRef: controlledCommandReceiptRef.ref,
    behaviorObservationRef: behaviorObservationRef.ref,
  };
}

function missingCase(caseId: CaseId): JsonRecord {
  return {
    caseId,
    present: false,
    valid: false,
    proofRef: null,
    controlledCommandReceiptRef: null,
    behaviorObservationRef: null,
    outcome: null,
    derivedCounts: { ...ZERO_COUNTS },
    issues: [],
  };
}

function unavailableObservation(input: {
  surface: Surface;
  applicability: JsonRecord;
  applicable: boolean;
  observationPath: string;
  reason: string;
}): JsonRecord {
  return {
    surface: input.surface,
    present: false,
    valid: false,
    trustValid: false,
    schemaVersion: null,
    producer: null,
    action: null,
    contractHash: null,
    requirementSetId: null,
    implementationAttemptId: null,
    observedAt: null,
    applicability: input.applicability,
    observationPath: input.observationPath,
    observationHash: null,
    authorityRef: null,
    commandReceiptRef: null,
    artifactRef: null,
    readerCount: 0,
    writerCount: 0,
    readerInventoryHash: null,
    writerInventoryHash: null,
    cases: input.applicable ? CASES.map((caseId) => missingCase(caseId)) : [],
    derivedCounts: { ...ZERO_COUNTS },
    issues: [input.reason],
  };
}

function readObservation(
  evidenceRoot: string,
  surface: Surface,
  authority: AuthorityState,
  validators: ParityValidators,
  stats: CoverageStats,
  blockingReasons: string[],
  now: number
): JsonRecord {
  const cell = authority.cells.get(surface) ?? {};
  const expectedApplicability =
    validApplicability(cell.applicability) ?? { applicable: true, reason: null };
  const expectedReaders = stringArray(cell.readerPaths);
  const expectedWriters = stringArray(cell.writerPaths);
  const applicable = expectedApplicability.applicable === true;
  if (applicable) {
    stats.caseExpected += CASES.length;
    stats.readerExpected += expectedReaders.length;
    stats.writerExpected += expectedWriters.length;
  }
  const relativeObservationPath = slash(path.join('observations', `${surface}.json`));
  const observationPath = resolveContained(evidenceRoot, relativeObservationPath);
  if (observationPath === null) {
    const reason = `path_escape:${surface}:observation`;
    addUnique(blockingReasons, reason);
    return unavailableObservation({
      surface,
      applicability: expectedApplicability,
      applicable,
      observationPath: relativeObservationPath,
      reason,
    });
  }
  const inspection = inspectRegularFile(observationPath);
  if (inspection.kind !== 'file') {
    const reason =
      inspection.kind === 'missing'
        ? `missing_surface:${surface}`
        : inspection.kind === 'broken_link'
          ? `surface_broken_link:${surface}`
          : inspection.kind === 'not_file'
            ? `surface_not_file:${surface}`
            : `surface_io_error:${surface}`;
    addUnique(blockingReasons, reason);
    return unavailableObservation({
      surface,
      applicability: expectedApplicability,
      applicable,
      observationPath: relativeObservationPath,
      reason,
    });
  }

  const bytes = inspection.bytes;
  let observation: JsonRecord;
  try {
    observation = object(JSON.parse(bytes.toString('utf8')));
  } catch {
    observation = {};
  }
  const trustIssues: string[] = [];
  const semanticIssues: string[] = [];
  const trust = (reason: string): void => {
    addUnique(trustIssues, reason);
    addUnique(blockingReasons, reason);
  };
  if (!validators.observation(observation)) {
    trust(`untrusted_observation:${surface}:schema_invalid`);
  }
  if (!authority.valid) trust(`authority_untrusted:${surface}`);
  if (observation.schemaVersion !== SIX_MODEL_PARITY_OBSERVATION_SCHEMA_VERSION) {
    trust(`untrusted_observation:${surface}:schema_invalid`);
  }
  if (observation.surface !== surface) trust(`surface_identity_mismatch:${surface}`);
  if (observation.producer !== SIX_MODEL_PARITY_OBSERVATION_PRODUCER) {
    trust(`producer_identity_mismatch:${surface}`);
  }
  if (observation.action !== SIX_MODEL_PARITY_OBSERVATION_ACTION) {
    trust(`action_identity_mismatch:${surface}`);
  }
  if (observation.contractHash !== authority.contractHash) {
    trust(`contract_hash_mismatch:${surface}`);
  }
  if (observation.requirementSetId !== authority.requirementSetId) {
    trust(`requirement_set_mismatch:${surface}`);
  }
  if (observation.implementationAttemptId !== authority.implementationAttemptId) {
    trust(`implementation_attempt_mismatch:${surface}`);
  }
  if (!freshTimestamp(observation.observedAt, authority, now)) {
    trust(`stale_observation:${surface}`);
  }
  const applicability = validApplicability(observation.applicability);
  if (applicability === null || !sameJson(applicability, expectedApplicability)) {
    trust(`applicability_mismatch:${surface}`);
  }

  const authorityRef = validateFileRef({
    evidenceRoot,
    raw: observation.authorityRef,
    expectedPath: 'parity-authority.json',
    missingReason: `authority_ref_missing:${surface}`,
    pathEscapeReason: `path_escape:${surface}:authority`,
    pathMismatchReason: `authority_ref_path_mismatch:${surface}`,
    hashReason: `authority_ref_hash_mismatch:${surface}`,
    readbackReason: `authority_ref_readback_mismatch:${surface}`,
    trustIssues,
    blockingReasons,
  });
  if (authorityRef.ref && authority.hash && authorityRef.ref.hash !== authority.hash) {
    trust(`authority_ref_hash_mismatch:${surface}`);
  }

  let artifactRef: JsonRecord | null = null;
  const readers: JsonRecord[] = Array.isArray(observation.inventory?.readers)
    ? observation.inventory.readers.map((entry: unknown) => object(entry))
    : [];
  const writers: JsonRecord[] = Array.isArray(observation.inventory?.writers)
    ? observation.inventory.writers.map((entry: unknown) => object(entry))
    : [];
  const cases: JsonRecord[] = [];
  const derivedCounts: Counts = { ...ZERO_COUNTS };

  if (applicable) {
    const artifact = validateFileRef({
      evidenceRoot,
      raw: observation.artifactRef,
      expectedPath: String(cell.artifactPath || ''),
      missingReason: `artifact_missing:${surface}`,
      pathEscapeReason: `path_escape:${surface}:artifact`,
      pathMismatchReason: `artifact_path_mismatch:${surface}`,
      hashReason: `artifact_hash_mismatch:${surface}`,
      readbackReason: `artifact_readback_mismatch:${surface}`,
      trustIssues,
      blockingReasons,
    });
    artifactRef = artifact.ref;

    const observedReaderPaths = readers.map((entry) => relativePath(String(entry.path || '')));
    const observedWriterPaths = writers.map((entry) => relativePath(String(entry.path || '')));
    if (!sameStrings(observedReaderPaths, expectedReaders.map(relativePath))) {
      trust(`reader_inventory_path_mismatch:${surface}`);
    }
    if (!sameStrings(observedWriterPaths, expectedWriters.map(relativePath))) {
      trust(`writer_inventory_path_mismatch:${surface}`);
    }
    for (const expectedPath of expectedReaders) {
      const rawRef = readers.find(
        (entry) => relativePath(String(entry.path || '')) === relativePath(expectedPath)
      );
      const result = validateFileRef({
        evidenceRoot,
        raw: rawRef,
        expectedPath,
        missingReason: `reader_missing:${surface}:${relativePath(expectedPath)}`,
        pathEscapeReason: `path_escape:${surface}:reader`,
        pathMismatchReason: `reader_path_mismatch:${surface}:${relativePath(expectedPath)}`,
        hashReason: `reader_hash_mismatch:${surface}:${relativePath(expectedPath)}`,
        readbackReason: `reader_readback_mismatch:${surface}:${relativePath(expectedPath)}`,
        trustIssues,
        blockingReasons,
      });
      if (result.valid) stats.readerValid += 1;
    }
    for (const expectedPath of expectedWriters) {
      const rawRef = writers.find(
        (entry) => relativePath(String(entry.path || '')) === relativePath(expectedPath)
      );
      const result = validateFileRef({
        evidenceRoot,
        raw: rawRef,
        expectedPath,
        missingReason: `writer_missing:${surface}:${relativePath(expectedPath)}`,
        pathEscapeReason: `path_escape:${surface}:writer`,
        pathMismatchReason: `writer_path_mismatch:${surface}:${relativePath(expectedPath)}`,
        hashReason: `writer_hash_mismatch:${surface}:${relativePath(expectedPath)}`,
        readbackReason: `writer_readback_mismatch:${surface}:${relativePath(expectedPath)}`,
        trustIssues,
        blockingReasons,
      });
      if (result.valid) stats.writerValid += 1;
    }
    const readerInventoryHash = sha256(canonicalSixModelParityJson(readers));
    const writerInventoryHash = sha256(canonicalSixModelParityJson(writers));
    if (observation.inventory?.readerInventoryHash !== readerInventoryHash) {
      trust(`reader_inventory_hash_mismatch:${surface}`);
    }
    if (observation.inventory?.writerInventoryHash !== writerInventoryHash) {
      trust(`writer_inventory_hash_mismatch:${surface}`);
    }

    const rawProofRefs = Array.isArray(observation.caseProofs)
      ? observation.caseProofs.map((entry: unknown) => object(entry))
      : [];
    if (
      !sameStrings(
        rawProofRefs.map((entry) => String(entry.caseId || '')),
        CASES
      )
    ) {
      trust(`case_set_mismatch:${surface}`);
    }
    for (const caseId of CASES) {
      const expectedProofPath = slash(path.join(String(cell.proofRoot || ''), `${caseId}.json`));
      const rawProofRef = rawProofRefs.find((entry) => entry.caseId === caseId);
      const proofRef = validateFileRef({
        evidenceRoot,
        raw: rawProofRef,
        expectedPath: expectedProofPath,
        missingReason: `case_proof_missing:${surface}:${caseId}`,
        pathEscapeReason: `path_escape:${surface}:case_proof`,
        pathMismatchReason: `case_proof_path_mismatch:${surface}:${caseId}`,
        hashReason: `case_proof_hash_mismatch:${surface}:${caseId}`,
        readbackReason: `case_proof_readback_mismatch:${surface}:${caseId}`,
        trustIssues,
        blockingReasons,
      });
      if (!proofRef.valid || proofRef.target === null || proofRef.bytes === null) {
        const missing = missingCase(caseId);
        missing.proofRef = proofRef.ref;
        missing.issues = trustIssues.filter((issue) => issue.includes(`:${caseId}`));
        cases.push(missing);
        continue;
      }
      let proof: JsonRecord;
      try {
        proof = object(JSON.parse(proofRef.bytes.toString('utf8')));
      } catch {
        proof = {};
      }
      const controlledEvidence = readControlledCaseEvidence({
        evidenceRoot,
        surface,
        caseId,
        cell,
        proof,
        authority,
        validators,
        trustIssues,
        blockingReasons,
        now,
      });
      const caseCounts = controlledEvidence.valid
        ? deriveCounts(controlledEvidence.outcome, expectedOutcome(caseId))
        : { ...ZERO_COUNTS };
      if (controlledEvidence.valid) stats.caseValid += 1;
      for (const key of COUNT_KEYS) {
        derivedCounts[key] += caseCounts[key];
        if (caseCounts[key] !== 0) {
          const reason = `case_outcome_mismatch:${surface}:${caseId}:${key}`;
          addUnique(semanticIssues, reason);
          addUnique(blockingReasons, reason);
        }
      }
      const caseIssues = [
        ...trustIssues.filter((issue) => issue.includes(`:${caseId}`)),
        ...COUNT_KEYS.filter((key) => caseCounts[key] !== 0).map(
          (key) => `case_outcome_mismatch:${surface}:${caseId}:${key}`
        ),
      ];
      cases.push({
        caseId,
        present: true,
        valid: controlledEvidence.valid && COUNT_KEYS.every((key) => caseCounts[key] === 0),
        proofRef: proofRef.ref,
        controlledCommandReceiptRef: controlledEvidence.controlledCommandReceiptRef,
        behaviorObservationRef: controlledEvidence.behaviorObservationRef,
        outcome: controlledEvidence.outcome,
        derivedCounts: caseCounts,
        issues: Array.from(new Set(caseIssues)),
      });
    }
    const caseProofSetHash = sha256(canonicalSixModelParityJson(rawProofRefs));
    if (observation.caseProofSetHash !== caseProofSetHash) {
      trust(`case_proof_set_hash_mismatch:${surface}`);
    }
  } else if (
    observation.artifactRef !== null ||
    readers.length !== 0 ||
    writers.length !== 0 ||
    (Array.isArray(observation.caseProofs) && observation.caseProofs.length !== 0)
  ) {
    trust(`not_applicable_fact_mismatch:${surface}`);
  }

  const commandReceipt = validateFileRef({
    evidenceRoot,
    raw: observation.commandReceiptRef,
    expectedPath: slash(path.join('command-receipts', `${surface}.json`)),
    missingReason: `command_receipt_missing:${surface}`,
    pathEscapeReason: `path_escape:${surface}:command_receipt`,
    pathMismatchReason: `command_receipt_path_mismatch:${surface}`,
    hashReason: `command_receipt_hash_mismatch:${surface}`,
    readbackReason: `command_receipt_readback_mismatch:${surface}`,
    trustIssues,
    blockingReasons,
  });
  if (commandReceipt.valid && commandReceipt.target && commandReceipt.bytes) {
    let receipt: JsonRecord;
    try {
      receipt = object(JSON.parse(commandReceipt.bytes.toString('utf8')));
    } catch {
      receipt = {};
    }
    if (receipt.producer !== SIX_MODEL_PARITY_OBSERVATION_PRODUCER) {
      trust(`command_receipt_producer_mismatch:${surface}`);
    }
    if (receipt.action !== SIX_MODEL_PARITY_OBSERVATION_ACTION) {
      trust(`command_receipt_action_mismatch:${surface}`);
    }
    if (!validators.commandReceipt(receipt)) {
      trust(`command_receipt_schema_invalid:${surface}`);
    }
    const receiptExpected = {
      schemaVersion: SIX_MODEL_PARITY_COMMAND_RECEIPT_SCHEMA_VERSION,
      producer: SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
      action: SIX_MODEL_PARITY_OBSERVATION_ACTION,
      surface,
      contractHash: authority.contractHash,
      requirementSetId: authority.requirementSetId,
      implementationAttemptId: authority.implementationAttemptId,
      observedAt: observation.observedAt,
      applicability: observation.applicability,
      authorityRef: observation.authorityRef,
      artifactRef: observation.artifactRef,
      readerInventoryHash: observation.inventory?.readerInventoryHash,
      writerInventoryHash: observation.inventory?.writerInventoryHash,
      caseProofSetHash: observation.caseProofSetHash,
      decision: 'observed',
      exitCode: 0,
      readbackVerified: true,
    };
    if (!sameJson(receipt, receiptExpected)) trust(`command_receipt_binding_mismatch:${surface}`);
  }

  const trustValid = trustIssues.length === 0;
  if (trustValid) stats.surfaceValid += 1;
  return {
    surface,
    present: true,
    valid: trustValid && semanticIssues.length === 0,
    trustValid,
    schemaVersion: textOrNull(observation.schemaVersion),
    producer: textOrNull(observation.producer),
    action: textOrNull(observation.action),
    contractHash: hashOrNull(observation.contractHash),
    requirementSetId: textOrNull(observation.requirementSetId),
    implementationAttemptId: textOrNull(observation.implementationAttemptId),
    observedAt: textOrNull(observation.observedAt),
    applicability: applicability ?? expectedApplicability,
    observationPath: relativeObservationPath,
    observationHash: sha256(bytes),
    authorityRef: authorityRef.ref,
    commandReceiptRef: commandReceipt.ref,
    artifactRef,
    readerCount: readers.length,
    writerCount: writers.length,
    readerInventoryHash: hashOrNull(observation.inventory?.readerInventoryHash),
    writerInventoryHash: hashOrNull(observation.inventory?.writerInventoryHash),
    cases,
    derivedCounts,
    issues: [...trustIssues, ...semanticIssues],
  };
}

function collectUnknownSurfaces(evidenceRoot: string): {
  surfaces: string[];
  invalidJsonSurfaces: string[];
  notFileSurfaces: string[];
  brokenLinkSurfaces: string[];
  ioErrorSurfaces: string[];
  identityMismatches: Array<{ fileSurface: string; declaredSurface: string }>;
  pathEscapeSurfaces: string[];
  rootPathEscape: boolean;
} {
  const observationRoot = resolveContained(evidenceRoot, 'observations');
  if (observationRoot === null) {
    return {
      surfaces: [],
      invalidJsonSurfaces: [],
      notFileSurfaces: [],
      brokenLinkSurfaces: [],
      ioErrorSurfaces: [],
      identityMismatches: [],
      pathEscapeSurfaces: [],
      rootPathEscape: true,
    };
  }
  if (!fs.existsSync(observationRoot) || !fs.statSync(observationRoot).isDirectory()) {
    return {
      surfaces: [],
      invalidJsonSurfaces: [],
      notFileSurfaces: [],
      brokenLinkSurfaces: [],
      ioErrorSurfaces: [],
      identityMismatches: [],
      pathEscapeSurfaces: [],
      rootPathEscape: false,
    };
  }
  const expectedFiles = new Set(SURFACES.map((surface) => `${surface}.json`));
  const invalidJsonSurfaces: string[] = [];
  const notFileSurfaces: string[] = [];
  const brokenLinkSurfaces: string[] = [];
  const ioErrorSurfaces: string[] = [];
  const identityMismatches: Array<{ fileSurface: string; declaredSurface: string }> = [];
  const pathEscapeSurfaces: string[] = [];
  const surfaces = Array.from(
    new Set(
      fs
        .readdirSync(observationRoot, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.name.endsWith('.json') &&
            !expectedFiles.has(entry.name)
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
          const fallbackSurface = path.basename(entry.name, '.json');
          const lexicalCandidate = path.join(observationRoot, entry.name);
          let linkStat: fs.Stats;
          try {
            linkStat = fs.lstatSync(lexicalCandidate);
          } catch {
            ioErrorSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          if (linkStat.isSymbolicLink() && !fs.existsSync(lexicalCandidate)) {
            brokenLinkSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          const candidate = resolveContained(
            evidenceRoot,
            slash(path.join('observations', entry.name))
          );
          if (candidate === null) {
            pathEscapeSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          let targetStat: fs.Stats;
          try {
            targetStat = fs.statSync(candidate);
          } catch {
            ioErrorSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          if (!targetStat.isFile()) {
            notFileSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          let bytes: Buffer;
          try {
            bytes = fs.readFileSync(candidate);
          } catch {
            ioErrorSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          let parsed: JsonRecord;
          try {
            parsed = object(JSON.parse(bytes.toString('utf8')));
          } catch {
            invalidJsonSurfaces.push(fallbackSurface);
            return fallbackSurface;
          }
          if (typeof parsed.surface === 'string' && parsed.surface !== fallbackSurface) {
            identityMismatches.push({
              fileSurface: fallbackSurface,
              declaredSurface: parsed.surface,
            });
          }
          return fallbackSurface;
        })
        .filter((surface) => !SURFACES.includes(surface as Surface))
    )
  ).sort();
  return {
    surfaces,
    invalidJsonSurfaces: Array.from(new Set(invalidJsonSurfaces)).sort(),
    notFileSurfaces: Array.from(new Set(notFileSurfaces)).sort(),
    brokenLinkSurfaces: Array.from(new Set(brokenLinkSurfaces)).sort(),
    ioErrorSurfaces: Array.from(new Set(ioErrorSurfaces)).sort(),
    identityMismatches,
    pathEscapeSurfaces: Array.from(new Set(pathEscapeSurfaces)).sort(),
    rootPathEscape: false,
  };
}

function safeWriteMode(target: string): 'create' | 'replace' {
  return fs.existsSync(path.resolve(target)) ? 'replace' : 'create';
}

function writeJsonWithSafeReceipt(
  target: string,
  value: unknown
): {
  writeReceipt: SafeWriteReceipt;
  writeReceiptPath: string;
  writeReceiptRef: JsonRecord;
} {
  const resolvedTarget = path.resolve(target);
  const writeReceipt = safeWriteJson(resolvedTarget, value, {
    mode: safeWriteMode(resolvedTarget),
  });
  const validateSafeWriteReceipt = schemaValidator(
    'requirements-contract-large-document-writer-safe-write-receipt.schema.json'
  );
  const readbackHash = sha256(fs.readFileSync(resolvedTarget));
  if (
    !validateSafeWriteReceipt(writeReceipt) ||
    writeReceipt.schemaVersion !== GOVERNED_WRITER ||
    writeReceipt.targetPath !== resolvedTarget ||
    writeReceipt.finalHash !== readbackHash
  ) {
    throw new Error(`safe writer receipt mismatch: ${resolvedTarget}`);
  }
  const writeReceiptPath = `${resolvedTarget}.safe-write-receipt.json`;
  safeWriteJson(writeReceiptPath, writeReceipt, {
    mode: safeWriteMode(writeReceiptPath),
  });
  const persistedReceiptBytes = fs.readFileSync(writeReceiptPath);
  let persistedReceipt: JsonRecord;
  try {
    persistedReceipt = object(JSON.parse(persistedReceiptBytes.toString('utf8')));
  } catch {
    throw new Error(`safe writer receipt JSON invalid: ${writeReceiptPath}`);
  }
  if (
    !validateSafeWriteReceipt(persistedReceipt) ||
    !sameJson(persistedReceipt, writeReceipt)
  ) {
    throw new Error(`safe writer persisted receipt mismatch: ${writeReceiptPath}`);
  }
  const writeReceiptHash = sha256(persistedReceiptBytes);
  const readbackReceiptBytes = fs.readFileSync(writeReceiptPath);
  const writeReceiptReadbackHash = sha256(readbackReceiptBytes);
  if (
    writeReceiptReadbackHash !== writeReceiptHash ||
    !readbackReceiptBytes.equals(persistedReceiptBytes)
  ) {
    throw new Error(`safe writer receipt readback mismatch: ${writeReceiptPath}`);
  }
  return {
    writeReceipt,
    writeReceiptPath,
    writeReceiptRef: {
      path: slash(writeReceiptPath),
      hash: writeReceiptHash,
      readbackHash: writeReceiptReadbackHash,
      readbackVerified: true,
    },
  };
}

function publishGovernedReport(
  reportPath: string,
  report: JsonRecord,
  identity: {
    contractHash: string;
    requirementSetId: string;
    implementationAttemptId: string;
  }
) {
  const validateReport = schemaValidator(
    'requirements-contract-six-model-projection-parity-report.schema.json'
  );
  if (!validateReport(report)) {
    throw new Error(`parity report schema invalid: ${JSON.stringify(validateReport.errors)}`);
  }
  const resolvedReportPath = path.resolve(reportPath);
  const reportWrite = writeJsonWithSafeReceipt(resolvedReportPath, report);
  const targetExistedBefore = reportWrite.writeReceipt.originalHash !== null;
  const previousHash = reportWrite.writeReceipt.originalHash;
  const reportHash = reportWrite.writeReceipt.finalHash;
  const reportReadbackHash = sha256(fs.readFileSync(resolvedReportPath));
  if (reportReadbackHash !== reportHash) throw new Error('parity report readback hash mismatch');

  const reportSchemaPath = schemaPath(
    'requirements-contract-six-model-projection-parity-report.schema.json'
  );
  const reportSchemaBytes = fs.readFileSync(reportSchemaPath);
  const reportSchemaHash = sha256(reportSchemaBytes);
  const publicationReceipt = {
    schemaVersion: PUBLICATION_RECEIPT_SCHEMA_VERSION,
    producer: VERIFIER_PRODUCER,
    action: VERIFIER_ACTION,
    writer: GOVERNED_WRITER,
    contractHash: identity.contractHash,
    requirementSetId: identity.requirementSetId,
    implementationAttemptId: identity.implementationAttemptId,
    targetPath: slash(resolvedReportPath),
    targetHash: reportHash,
    readbackHash: reportReadbackHash,
    readbackVerified: true,
    safeWriteReceiptRef: reportWrite.writeReceiptRef,
    reportSchema: {
      path: slash(reportSchemaPath),
      schemaVersion: REPORT_SCHEMA_VERSION,
      hash: reportSchemaHash,
      readbackHash: sha256(fs.readFileSync(reportSchemaPath)),
      readbackVerified: true,
    },
    targetExistedBefore,
    previousHash,
    explicitUtf8: true,
    atomicWrite: true,
    createdAt: new Date().toISOString(),
  };
  const validatePublicationReceipt = schemaValidator(
    'requirements-contract-six-model-projection-parity-publication-receipt.schema.json'
  );
  if (!validatePublicationReceipt(publicationReceipt)) {
    throw new Error(
      `parity publication Receipt schema invalid: ${JSON.stringify(
        validatePublicationReceipt.errors
      )}`
    );
  }
  const publicationReceiptPath = `${resolvedReportPath}.publication-receipt.json`;
  const publicationWriteReceipt = safeWriteJson(
    publicationReceiptPath,
    publicationReceipt,
    { mode: safeWriteMode(publicationReceiptPath) }
  );
  const publicationReceiptHash = publicationWriteReceipt.finalHash;
  const publicationReceiptReadbackHash = sha256(
    fs.readFileSync(publicationReceiptPath)
  );
  if (publicationReceiptReadbackHash !== publicationReceiptHash) {
    throw new Error('parity publication Receipt readback hash mismatch');
  }
  return {
    reportPath: resolvedReportPath,
    reportHash,
    reportReadbackHash,
    publicationReceiptPath,
    publicationReceiptHash,
    publicationReceiptReadbackHash,
  };
}

export function requirementsContractSixModelProjectionParityVerifyCommand(
  options: RequirementsContractSixModelProjectionParityVerifyOptions
): number {
  const evidenceRoot = path.resolve(options.evidenceRoot);
  const blockingReasons: string[] = [];
  const authority = readAuthority(evidenceRoot, blockingReasons);
  const observationSchema = schemaDocument(
    'requirements-contract-six-model-projection-parity-observation.schema.json'
  );
  const reportSchema = schemaDocument(
    'requirements-contract-six-model-projection-parity-report.schema.json'
  );
  const validators = {
    observation: schemaValidator(
      'requirements-contract-six-model-projection-parity-observation.schema.json'
    ),
    commandReceipt: schemaValidator(
      'requirements-contract-six-model-projection-parity-observation-command-receipt.schema.json',
      [observationSchema]
    ),
    caseProof: schemaValidator(
      'requirements-contract-six-model-projection-parity-case-proof.schema.json',
      [observationSchema]
    ),
    behaviorObservation: schemaValidator(
      'requirements-contract-six-model-projection-parity-behavior-observation.schema.json',
      [observationSchema, reportSchema]
    ),
    controlledCommandReceipt: schemaValidator2020(
      'requirements-contract-controlled-command-receipt.schema.json'
    ),
  };
  const stats: CoverageStats = {
    surfaceValid: 0,
    surfaceExpected: SURFACES.length,
    caseValid: 0,
    caseExpected: 0,
    readerValid: 0,
    readerExpected: 0,
    writerValid: 0,
    writerExpected: 0,
  };
  const now = Date.now();
  const observations = SURFACES.map((surface) =>
    readObservation(
      evidenceRoot,
      surface,
      authority,
      validators,
      stats,
      blockingReasons,
      now
    )
  );
  const unknownSurfaceScan = collectUnknownSurfaces(evidenceRoot);
  if (unknownSurfaceScan.rootPathEscape) {
    addUnique(blockingReasons, 'path_escape:observations_directory');
  }
  const unknownSurfaces = unknownSurfaceScan.surfaces;
  for (const surface of unknownSurfaces) addUnique(blockingReasons, `unknown_surface:${surface}`);
  for (const surface of unknownSurfaceScan.invalidJsonSurfaces) {
    addUnique(blockingReasons, `unknown_surface_json_invalid:${surface}`);
  }
  for (const surface of unknownSurfaceScan.notFileSurfaces) {
    addUnique(blockingReasons, `unknown_surface_not_file:${surface}`);
  }
  for (const surface of unknownSurfaceScan.brokenLinkSurfaces) {
    addUnique(blockingReasons, `unknown_surface_broken_link:${surface}`);
  }
  for (const surface of unknownSurfaceScan.ioErrorSurfaces) {
    addUnique(blockingReasons, `unknown_surface_io_error:${surface}`);
  }
  for (const mismatch of unknownSurfaceScan.identityMismatches) {
    addUnique(
      blockingReasons,
      `unknown_surface_identity_mismatch:${mismatch.fileSurface}:${mismatch.declaredSurface}`
    );
  }
  for (const surface of unknownSurfaceScan.pathEscapeSurfaces) {
    addUnique(blockingReasons, `path_escape:unknown_surface:${surface}`);
  }
  const counts = Object.fromEntries(
    COUNT_KEYS.map((key) => [
      key,
      observations.reduce(
        (total, observation) => total + numeric(observation.derivedCounts?.[key]),
        0
      ),
    ])
  ) as Counts;
  for (const key of COUNT_KEYS) {
    if (counts[key] !== 0) addUnique(blockingReasons, `derived_nonzero_count:${key}`);
  }
  const caseCompleteness = ratio(stats.caseValid, stats.caseExpected);
  const surfaceCompleteness = ratio(stats.surfaceValid, stats.surfaceExpected);
  const readerInventoryCoverage = ratio(stats.readerValid, stats.readerExpected);
  const writerInventoryCoverage = ratio(stats.writerValid, stats.writerExpected);
  const coverage = Math.min(
    caseCompleteness,
    surfaceCompleteness,
    readerInventoryCoverage,
    writerInventoryCoverage
  );
  if (coverage !== 1) addUnique(blockingReasons, 'coverage_not_one');
  const decision = blockingReasons.length === 0 ? 'PASS' : 'BLOCK';
  const exitCode = decision === 'PASS' ? 0 : 2;
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    producer: VERIFIER_PRODUCER,
    action: VERIFIER_ACTION,
    decision,
    contractHash: authority.contractHash,
    requirementSetId: authority.requirementSetId,
    implementationAttemptId: authority.implementationAttemptId,
    modelOrder: MODEL_ORDER,
    surfaces: SURFACES,
    exactCases: CASES,
    observations,
    unknownSurfaces,
    counts,
    coverage,
    caseCompleteness,
    surfaceCompleteness,
    readerInventoryCoverage,
    writerInventoryCoverage,
    blockingReasons,
  };
  const publication = publishGovernedReport(options.out, report, {
    contractHash: authority.contractHash,
    requirementSetId: authority.requirementSetId,
    implementationAttemptId: authority.implementationAttemptId,
  });
  const summary = {
    schemaVersion: 'requirements-contract-six-model-projection-parity-summary/v1',
    command: VERIFIER_ACTION,
    decision: report.decision,
    exitCode,
    reportPath: slash(publication.reportPath),
    reportHash: publication.reportHash,
    readbackHash: publication.reportReadbackHash,
    readbackVerified: true,
    atomicWrite: true,
    encoding: 'utf8',
    publicationReceiptPath: slash(publication.publicationReceiptPath),
    publicationReceiptHash: publication.publicationReceiptHash,
    publicationReceiptReadbackHash: publication.publicationReceiptReadbackHash,
  };
  process.stdout.write(
    options.json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : `six_model_projection_parity=${report.decision}\n`
  );
  return exitCode;
}
