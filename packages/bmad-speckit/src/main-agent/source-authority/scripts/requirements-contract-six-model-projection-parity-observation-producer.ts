import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

export const SIX_MODEL_PARITY_OBSERVATION_SCHEMA_VERSION =
  'requirements-contract-six-model-projection-parity-observation/v1';
export const SIX_MODEL_PARITY_COMMAND_RECEIPT_SCHEMA_VERSION =
  'requirements-contract-six-model-projection-parity-observation-command-receipt/v1';
export const SIX_MODEL_PARITY_AUTHORITY_SCHEMA_VERSION =
  'requirements-contract-six-model-projection-parity-authority/v1';
export const SIX_MODEL_PARITY_OBSERVATION_PRODUCER =
  'requirements-contract-six-model-projection-parity-observation-producer';
export const SIX_MODEL_PARITY_OBSERVATION_ACTION =
  'requirements-contract-six-model-projection-parity-observe';
export const SIX_MODEL_PARITY_CASE_PRODUCER =
  'requirements-contract-six-model-projection-parity-case-runner';
export const SIX_MODEL_PARITY_SURFACES = [
  'source',
  'package-dist',
  'codex',
  'cursor',
  'claude',
  'installed',
  'generated-dist',
  'packed-package',
  'root-host',
] as const;
export const SIX_MODEL_PARITY_CASES = [
  'valid_receipt',
  'missing_receipt',
  'missing_projection',
  'projection_mismatch',
  'stale_attempt',
  'blocked_receipt',
  'synthetic_bridge',
  'complete_panorama',
] as const;
export const SIX_MODEL_PARITY_MODEL_ORDER = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

type JsonRecord = Record<string, any>;
type Surface = (typeof SIX_MODEL_PARITY_SURFACES)[number];

export interface ProduceRequirementsContractSixModelProjectionParityObservationOptions {
  evidenceRoot: string;
  surface: string;
  observedAt?: string;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)])
  );
}

export function canonicalSixModelParityJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sixModelParityHash(value: Buffer | string): string {
  return sha256(value);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is missing`);
  }
  return value;
}

function resolveInside(root: string, relativePath: unknown, label: string): string {
  const supplied = requireText(relativePath, `${label} path`);
  if (path.isAbsolute(supplied)) throw new Error(`${label} path must be relative`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, supplied);
  if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} path escapes evidence root`);
  }
  if (fs.existsSync(resolved)) {
    try {
      const realRoot = fs.realpathSync.native(resolvedRoot);
      const realTarget = fs.realpathSync.native(resolved);
      if (realTarget === realRoot || !realTarget.startsWith(`${realRoot}${path.sep}`)) {
        throw new Error(`${label} path escapes evidence root`);
      }
    } catch (error) {
      if (error instanceof Error && error.message === `${label} path escapes evidence root`) {
        throw error;
      }
      throw new Error(`${label} path escapes evidence root`);
    }
  }
  return resolved;
}

function relativeRefPath(root: string, target: string): string {
  return slash(path.relative(path.resolve(root), path.resolve(target)));
}

function fileRef(root: string, relativePath: unknown, label: string): JsonRecord {
  const target = resolveInside(root, relativePath, label);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`${label} file is missing: ${relativeRefPath(root, target)}`);
  }
  const bytes = fs.readFileSync(target);
  const hash = sha256(bytes);
  const readbackBytes = fs.readFileSync(target);
  const readbackHash = sha256(readbackBytes);
  if (!readbackBytes.equals(bytes) || readbackHash !== hash) {
    throw new Error(`${label} readback mismatch`);
  }
  return {
    path: relativeRefPath(root, target),
    hash,
    readbackHash,
    readbackVerified: true,
  };
}

function readJson(target: string, label: string): JsonRecord {
  try {
    return object(JSON.parse(fs.readFileSync(target, 'utf8')));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function resolveWriteInside(root: string, relativePath: unknown, label: string): string {
  const supplied = requireText(relativePath, `${label} path`);
  if (path.isAbsolute(supplied)) throw new Error(`${label} path must be relative`);
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, supplied);
  if (
    resolvedTarget === resolvedRoot ||
    !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(`${label} path escapes evidence root`);
  }
  try {
    const realRoot = fs.realpathSync.native(resolvedRoot);
    let existing = resolvedTarget;
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) throw new Error(`${label} path escapes evidence root`);
      existing = parent;
    }
    const realExisting = fs.realpathSync.native(existing);
    if (
      realExisting !== realRoot &&
      !realExisting.startsWith(`${realRoot}${path.sep}`)
    ) {
      throw new Error(`${label} path escapes evidence root`);
    }
  } catch (error) {
    if (error instanceof Error && error.message === `${label} path escapes evidence root`) {
      throw error;
    }
    throw new Error(`${label} path escapes evidence root`);
  }
  return resolvedTarget;
}

function atomicWriteJson(
  root: string,
  relativePath: unknown,
  label: string,
  value: unknown
): { target: string; hash: string } {
  const resolvedTarget = resolveWriteInside(root, relativePath, label);
  const parent = path.dirname(resolvedTarget);
  fs.mkdirSync(parent, { recursive: true });
  resolveWriteInside(root, relativePath, label);
  const temporary = path.join(
    parent,
    `.${path.basename(resolvedTarget)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  );
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, payload, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    resolveWriteInside(root, relativePath, label);
    fs.renameSync(temporary, resolvedTarget);
    const readback = fs.readFileSync(resolvedTarget);
    if (!readback.equals(Buffer.from(payload, 'utf8'))) {
      throw new Error(`atomic write readback mismatch: ${resolvedTarget}`);
    }
    return { target: resolvedTarget, hash: sha256(readback) };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function schema(name: string): JsonRecord {
  return readJson(path.join(__dirname, '..', 'schemas', name), `${name} schema`);
}

function validator(name: string, dependencies: JsonRecord[] = []) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const dependency of dependencies) ajv.addSchema(dependency);
  return ajv.compile(schema(name));
}

function validateTimestamp(value: unknown, label: string): string {
  const timestamp = requireText(value, label);
  if (!Number.isFinite(new Date(timestamp).getTime())) throw new Error(`${label} is invalid`);
  return timestamp;
}

function validateAuthority(authority: JsonRecord): void {
  if (authority.schemaVersion !== SIX_MODEL_PARITY_AUTHORITY_SCHEMA_VERSION) {
    throw new Error('parity authority schemaVersion mismatch');
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(requireText(authority.contractHash, 'contractHash'))) {
    throw new Error('parity authority contractHash mismatch');
  }
  if (authority.producer !== SIX_MODEL_PARITY_OBSERVATION_PRODUCER) {
    throw new Error('parity authority producer mismatch');
  }
  if (authority.action !== SIX_MODEL_PARITY_OBSERVATION_ACTION) {
    throw new Error('parity authority action mismatch');
  }
  if (authority.caseProducer !== SIX_MODEL_PARITY_CASE_PRODUCER) {
    throw new Error('parity authority case producer mismatch');
  }
  requireText(authority.requirementSetId, 'parity authority requirementSetId');
  requireText(authority.implementationAttemptId, 'parity authority implementationAttemptId');
  if (!/^TX-[A-Za-z0-9._-]+$/u.test(requireText(authority.transactionId, 'transactionId'))) {
    throw new Error('parity authority transactionId mismatch');
  }
  for (const field of ['architectureAuditAttemptId', 'activePhaseAuditAttemptId']) {
    if (!/^AUDIT-[A-Za-z0-9._-]+$/u.test(requireText(authority[field], field))) {
      throw new Error(`parity authority ${field} mismatch`);
    }
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(requireText(authority.inputSnapshotHash, 'inputSnapshotHash'))) {
    throw new Error('parity authority inputSnapshotHash mismatch');
  }
  const commandBinding = object(authority.commandBinding);
  const executorIdentity = object(commandBinding.executorIdentity);
  if (
    !/^CMD-[0-9]+$/u.test(requireText(commandBinding.commandId, 'commandBinding.commandId')) ||
    strings(commandBinding.argvPrefix).length === 0 ||
    strings(commandBinding.acceptanceRefs).length === 0 ||
    strings(commandBinding.traceRefs).length === 0 ||
    executorIdentity.class !== 'goal_controlled_executor' ||
    requireText(executorIdentity.id, 'commandBinding.executorIdentity.id').length === 0
  ) {
    throw new Error('parity authority command binding mismatch');
  }
  requireText(commandBinding.cwd, 'commandBinding.cwd');
  if (!sameStrings(strings(authority.modelOrder), SIX_MODEL_PARITY_MODEL_ORDER)) {
    throw new Error('parity authority model order mismatch');
  }
  if (!sameStrings(strings(authority.exactCases), SIX_MODEL_PARITY_CASES)) {
    throw new Error('parity authority exact case set mismatch');
  }
  if (!sameStrings(strings(authority.surfaces), SIX_MODEL_PARITY_SURFACES)) {
    throw new Error('parity authority surface set mismatch');
  }
  if (
    !Number.isFinite(authority.maxObservationAgeMs) ||
    authority.maxObservationAgeMs <= 0 ||
    !Number.isFinite(authority.maxClockSkewMs) ||
    authority.maxClockSkewMs < 0
  ) {
    throw new Error('parity authority freshness policy mismatch');
  }
  const cells = Array.isArray(authority.cells) ? authority.cells.map((entry) => object(entry)) : [];
  if (
    cells.length !== SIX_MODEL_PARITY_SURFACES.length ||
    !sameStrings(
      cells.map((cell) => String(cell.surface || '')),
      SIX_MODEL_PARITY_SURFACES
    )
  ) {
    throw new Error('parity authority cells are not exact or ordered');
  }
  for (const cell of cells) {
    const applicability = object(cell.applicability);
    if (applicability.applicable !== true) continue;
    requireText(cell.artifactPath, `${cell.surface} artifactPath`);
    requireText(cell.proofRoot, `${cell.surface} proofRoot`);
    requireText(cell.controlledReceiptRoot, `${cell.surface} controlledReceiptRoot`);
    requireText(cell.behaviorObservationRoot, `${cell.surface} behaviorObservationRoot`);
    if (strings(cell.readerPaths).length === 0 || strings(cell.writerPaths).length === 0) {
      throw new Error(`${cell.surface} reader/writer inventory is empty`);
    }
  }
}

function validateProof(
  proof: JsonRecord,
  authority: JsonRecord,
  surface: Surface,
  caseId: string,
  evidenceRoot: string,
  cell: JsonRecord
): void {
  const expected = {
    schemaVersion: 'requirements-contract-six-model-projection-parity-case-proof/v2',
    producer: authority.caseProducer,
    action: `run:${caseId}`,
    surface,
    caseId,
    contractHash: authority.contractHash,
    requirementSetId: authority.requirementSetId,
    implementationAttemptId: authority.implementationAttemptId,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (proof[key] !== value) throw new Error(`${surface} ${caseId} proof ${key} mismatch`);
  }
  validateTimestamp(proof.observedAt, `${surface} ${caseId} proof observedAt`);
  const observationSchema = schema(
    'requirements-contract-six-model-projection-parity-observation.schema.json'
  );
  const validate = validator(
    'requirements-contract-six-model-projection-parity-case-proof.schema.json',
    [observationSchema]
  );
  if (!validate(proof)) {
    throw new Error(
      `${surface} ${caseId} proof schema invalid: ${JSON.stringify(validate.errors)}`
    );
  }
  const controlledReceiptPath = slash(
    path.join(requireText(cell.controlledReceiptRoot, `${surface} controlledReceiptRoot`), `${caseId}.json`)
  );
  const behaviorObservationPath = slash(
    path.join(
      requireText(cell.behaviorObservationRoot, `${surface} behaviorObservationRoot`),
      `${caseId}.json`
    )
  );
  const expectedControlledReceiptRef = fileRef(
    evidenceRoot,
    controlledReceiptPath,
    `${surface} ${caseId} controlled command Receipt`
  );
  const expectedBehaviorObservationRef = fileRef(
    evidenceRoot,
    behaviorObservationPath,
    `${surface} ${caseId} behavior observation`
  );
  if (
    canonicalSixModelParityJson(proof.controlledCommandReceiptRef) !==
      canonicalSixModelParityJson(expectedControlledReceiptRef) ||
    canonicalSixModelParityJson(proof.behaviorObservationRef) !==
      canonicalSixModelParityJson(expectedBehaviorObservationRef)
  ) {
    throw new Error(`${surface} ${caseId} proof evidence binding mismatch`);
  }
}

export function produceRequirementsContractSixModelProjectionParityObservation(
  options: ProduceRequirementsContractSixModelProjectionParityObservationOptions
): JsonRecord {
  const evidenceRoot = path.resolve(options.evidenceRoot);
  const surface = options.surface as Surface;
  if (!SIX_MODEL_PARITY_SURFACES.includes(surface)) {
    throw new Error(`unknown parity surface: ${options.surface}`);
  }
  const authorityPath = resolveInside(
    evidenceRoot,
    'parity-authority.json',
    'parity authority'
  );
  if (!fs.existsSync(authorityPath)) throw new Error('parity authority is missing');
  const authority = readJson(authorityPath, 'parity authority');
  validateAuthority(authority);
  const observedAt = validateTimestamp(options.observedAt ?? new Date().toISOString(), 'observedAt');
  const cell = object(
    (authority.cells as JsonRecord[]).find((entry) => object(entry).surface === surface)
  );
  if (cell.surface !== surface) throw new Error(`parity authority cell missing: ${surface}`);
  const applicability = object(cell.applicability);
  if (
    typeof applicability.applicable !== 'boolean' ||
    (applicability.applicable === true && applicability.reason !== null) ||
    (applicability.applicable === false &&
      (typeof applicability.reason !== 'string' || applicability.reason.trim().length === 0))
  ) {
    throw new Error(`parity authority applicability mismatch: ${surface}`);
  }

  const authorityRef = fileRef(evidenceRoot, 'parity-authority.json', 'parity authority');
  let artifactRef: JsonRecord | null = null;
  let readers: JsonRecord[] = [];
  let writers: JsonRecord[] = [];
  let caseProofs: JsonRecord[] = [];
  if (applicability.applicable) {
    artifactRef = fileRef(evidenceRoot, cell.artifactPath, `${surface} artifact`);
    readers = strings(cell.readerPaths).map((entry, index) =>
      fileRef(evidenceRoot, entry, `${surface} reader ${index}`)
    );
    writers = strings(cell.writerPaths).map((entry, index) =>
      fileRef(evidenceRoot, entry, `${surface} writer ${index}`)
    );
    if (readers.length === 0 || writers.length === 0) {
      throw new Error(`${surface} reader/writer inventory is empty`);
    }
    const proofRoot = requireText(cell.proofRoot, `${surface} proofRoot`);
    caseProofs = SIX_MODEL_PARITY_CASES.map((caseId) => {
      const proofRelativePath = slash(path.join(proofRoot, `${caseId}.json`));
      const ref = fileRef(evidenceRoot, proofRelativePath, `${surface} ${caseId} proof`);
      const proof = readJson(
        resolveInside(evidenceRoot, proofRelativePath, `${surface} ${caseId} proof`),
        `${surface} ${caseId} proof`
      );
      validateProof(proof, authority, surface, caseId, evidenceRoot, cell);
      return { caseId, ...ref };
    });
  }

  const readerInventoryHash = sha256(canonicalSixModelParityJson(readers));
  const writerInventoryHash = sha256(canonicalSixModelParityJson(writers));
  const caseProofSetHash = sha256(canonicalSixModelParityJson(caseProofs));
  const commandReceipt = {
    schemaVersion: SIX_MODEL_PARITY_COMMAND_RECEIPT_SCHEMA_VERSION,
    producer: SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
    action: SIX_MODEL_PARITY_OBSERVATION_ACTION,
    surface,
    contractHash: authority.contractHash,
    requirementSetId: authority.requirementSetId,
    implementationAttemptId: authority.implementationAttemptId,
    observedAt,
    applicability,
    authorityRef,
    artifactRef,
    readerInventoryHash,
    writerInventoryHash,
    caseProofSetHash,
    decision: 'observed',
    exitCode: 0,
    readbackVerified: true,
  };
  const observationSchema = schema(
    'requirements-contract-six-model-projection-parity-observation.schema.json'
  );
  const validateCommandReceipt = validator(
    'requirements-contract-six-model-projection-parity-observation-command-receipt.schema.json',
    [observationSchema]
  );
  if (!validateCommandReceipt(commandReceipt)) {
    throw new Error(
      `observation command Receipt schema invalid: ${JSON.stringify(validateCommandReceipt.errors)}`
    );
  }
  const commandReceiptWrite = atomicWriteJson(
    evidenceRoot,
    slash(path.join('command-receipts', `${surface}.json`)),
    `${surface} command Receipt`,
    commandReceipt
  );
  const commandReceiptPath = commandReceiptWrite.target;
  const commandReceiptRef = fileRef(
    evidenceRoot,
    relativeRefPath(evidenceRoot, commandReceiptPath),
    `${surface} command Receipt`
  );
  const observation = {
    schemaVersion: SIX_MODEL_PARITY_OBSERVATION_SCHEMA_VERSION,
    surface,
    producer: SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
    action: SIX_MODEL_PARITY_OBSERVATION_ACTION,
    contractHash: authority.contractHash,
    requirementSetId: authority.requirementSetId,
    implementationAttemptId: authority.implementationAttemptId,
    observedAt,
    applicability,
    authorityRef,
    commandReceiptRef,
    artifactRef,
    inventory: {
      readers,
      writers,
      readerInventoryHash,
      writerInventoryHash,
    },
    caseProofs,
    caseProofSetHash,
  };
  const validateObservation = validator(
    'requirements-contract-six-model-projection-parity-observation.schema.json'
  );
  if (!validateObservation(observation)) {
    throw new Error(`observation schema invalid: ${JSON.stringify(validateObservation.errors)}`);
  }
  const observationWrite = atomicWriteJson(
    evidenceRoot,
    slash(path.join('observations', `${surface}.json`)),
    `${surface} observation`,
    observation
  );
  const observationPath = observationWrite.target;
  return {
    schemaVersion: SIX_MODEL_PARITY_OBSERVATION_SCHEMA_VERSION,
    surface,
    path: relativeRefPath(evidenceRoot, observationPath),
    hash: observationWrite.hash,
    readbackHash: sha256(fs.readFileSync(observationPath)),
    readbackVerified: true,
  };
}
