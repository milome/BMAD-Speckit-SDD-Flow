import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import yaml from 'js-yaml';

export type ResolutionAuthorityClass =
  | 'source_extracted'
  | 'rule_derived'
  | 'repository_derived'
  | 'policy_inherited'
  | 'model_hypothesis'
  | 'business_decision_required';

export type ResolutionAuthorityState = 'source_grounded' | 'derived' | 'unresolved';

export interface SourceResolutionPremise {
  kind: 'source';
  sourcePath: string;
  sourceSpan: { startLine: number; endLine: number };
  excerpt: string;
  hash: string;
}

export interface RepositoryResolutionPremise {
  kind: 'repository';
  artifactPath: string;
  hash: string;
  candidateRef: string;
  candidateValueHash: string;
}

export interface PolicyResolutionPremise {
  kind: 'policy';
  catalogId: string;
  catalogVersion: string;
  catalogHash: string;
  policyId: string;
  policyVersion: string;
  policyValueHash: string;
}

export type SemanticResolutionPremise =
  | SourceResolutionPremise
  | RepositoryResolutionPremise
  | PolicyResolutionPremise;

export interface PolicyPredicate {
  factPath: string;
  operator: 'equals';
  expected: string | number | boolean;
}

export interface RequirementsPolicy {
  policyId: string;
  policyVersion: string;
  fieldKind:
    | 'threshold'
    | 'security_level'
    | 'retention_rule'
    | 'retry_rule'
    | 'idempotency_rule'
    | 'compatibility_rule'
    | 'availability_rule'
    | 'recovery_objective';
  value: string | number | boolean;
  applicability: { all: PolicyPredicate[] };
}

export interface RequirementsPolicyCatalog {
  schemaVersion: 'requirements-contract-policy-catalog/v1';
  catalogId: string;
  catalogVersion: string;
  catalogHash: string;
  signature: {
    algorithm: 'sha256';
    signedCatalogHash: string;
    signatureHash: string;
  };
  policies: RequirementsPolicy[];
}

export interface PolicyApplicabilityInput {
  policyId: string;
  catalogHash: string;
  factsHash: string;
}

export interface TrustedSourceExtraction {
  fieldRef: string;
  sourceSpan: { startLine: number; endLine: number };
  excerptHash: string;
  valueHash: string;
  parserId: string;
  parserHash: string;
  observationHash: string;
}

export interface TrustedSourceSnapshot {
  content: string;
  hash: string;
  extractions: TrustedSourceExtraction[];
}

export interface TrustedRuleEvaluation {
  resolutionId: string;
  fieldRef: string;
  ruleId: string;
  ruleVersion: string;
  ruleHash: string;
  premiseSetHash: string;
  outputValueHash: string;
  evaluationReceiptHash: string;
}

export interface TrustedRepositoryEvidence {
  canonicalPath: string;
  content: string;
  hash: string;
  producerId: string;
  producerHash: string;
  observationId: string;
  resolutionRunId: string;
  candidates: Array<{
    candidateRef: string;
    valueHash: string;
  }>;
  conflictingCandidates: string[];
  candidateUniverseHash: string;
  observationReceiptHash: string;
}

export interface TrustedPolicyCatalogAuthority {
  authorityId: string;
  catalogId: string;
  catalogVersion: string;
  catalogHash: string;
  signatureHash: string;
  approvalReceiptHash: string;
}

export interface TrustedPolicyFacts {
  facts: Record<string, unknown>;
  factsHash: string;
  sourceRefs: string[];
  observerId: string;
  observationReceiptHash: string;
}

export interface TrustedResolverInvocationContext {
  resolverId: string;
  resolutionRunId: string;
  sourceModelBefore: unknown;
}

export type SemanticAuthorityProof =
  | {
      kind: 'source_extraction';
      parserId: string;
      parserHash: string;
      observationHash: string;
    }
  | {
      kind: 'rule_evaluation';
      ruleId: string;
      ruleVersion: string;
      ruleHash: string;
      premiseSetHash: string;
      outputValueHash: string;
      evaluationReceiptHash: string;
    }
  | {
      kind: 'repository_observation';
      canonicalPath: string;
      producerId: string;
      producerHash: string;
      observationId: string;
      candidateUniverseHash: string;
      observationReceiptHash: string;
    }
  | {
      kind: 'policy_evaluation';
      authorityId: string;
      approvalReceiptHash: string;
      factObservationReceiptHash: string;
    };

export interface SemanticResolutionCandidate {
  resolutionId: string;
  fieldRef: string;
  value: unknown;
  semanticKind: string;
  resolutionAuthorityClass: ResolutionAuthorityClass;
  premises: SemanticResolutionPremise[];
  derivationRule: string | null;
  applicabilityProof: PolicyApplicabilityInput | null;
  conflictingCandidates: string[];
  confidence?: number;
}

export interface SemanticResolutionReceipt {
  schemaVersion: 'requirements-contract-semantic-resolution-receipt/v1';
  resolutionId: string;
  fieldRef: string;
  valueHash: string;
  resolutionAuthorityClass: ResolutionAuthorityClass;
  premises: SemanticResolutionPremise[];
  derivationRule: string | null;
  authorityProof: SemanticAuthorityProof;
  applicabilityProof: {
    basis: 'deterministic_policy_predicate';
    result: true;
    policyId: string;
    catalogHash: string;
    factsHash: string;
  } | null;
  conflictingCandidates: string[];
  sourceModelHashBefore: string;
  sourceModelHashAfter: string;
  resolverId: string;
  resolutionRunId: string;
  receiptHash: string;
}

export type SemanticResolutionResult =
  | {
      status: 'authorized';
      authorityState: 'source_grounded' | 'derived';
      blocking: false;
      resolvedValue: unknown;
      reasonCode: null;
      receipt: SemanticResolutionReceipt;
    }
  | {
      status: 'unresolved';
      authorityState: 'unresolved';
      blocking: true;
      resolvedValue: null;
      reasonCode: string;
      receipt: null;
    };

export interface SemanticResolverOptions {
  allowlistedDerivationRules?: readonly string[];
  policyCatalog?: RequirementsPolicyCatalog;
  trustedSourceSnapshots?: Readonly<Record<string, TrustedSourceSnapshot>>;
  trustedRuleEvaluations?: Readonly<Record<string, TrustedRuleEvaluation>>;
  trustedRepositoryEvidence?: Readonly<Record<string, TrustedRepositoryEvidence>>;
  trustedPolicyCatalogAuthority?: TrustedPolicyCatalogAuthority;
  trustedPolicyFacts?: TrustedPolicyFacts;
  trustedInvocationContext?: TrustedResolverInvocationContext;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const CATALOG_SCHEMA = 'requirements-contract-policy-catalog.schema.json';
const RECEIPT_SCHEMA = 'requirements-contract-semantic-resolution-receipt.schema.json';
const RESOLUTION_AUTHORITY_CLASSES = new Set<ResolutionAuthorityClass>([
  'source_extracted',
  'rule_derived',
  'repository_derived',
  'policy_inherited',
  'model_hypothesis',
  'business_decision_required',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const permitted = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => permitted.has(key))
  );
}

export function isCanonicalJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    let valid = true;
    for (let index = 0; index < value.length; index += 1) {
      if (
        !Object.prototype.hasOwnProperty.call(value, index) ||
        !isCanonicalJsonValue(value[index], seen)
      ) {
        valid = false;
        break;
      }
    }
    seen.delete(value);
    return valid;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    seen.delete(value);
    return false;
  }
  const valid = Object.values(value as Record<string, unknown>)
    .every((item) => isCanonicalJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

export function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const FORBIDDEN_MODEL_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function modelPathSegments(fieldRef: string): string[] | null {
  const segments = fieldRef.startsWith('/')
    ? fieldRef
        .slice(1)
        .split('/')
        .map((segment) => {
          if (!/^(?:[^~]|~[01])*$/u.test(segment)) return null;
          return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
        })
    : fieldRef.split('.');
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === null ||
        segment.length === 0 ||
        FORBIDDEN_MODEL_PATH_SEGMENTS.has(segment)
    )
  ) {
    return null;
  }
  return segments as string[];
}

export function semanticFieldRefsOverlap(left: string, right: string): boolean {
  const leftSegments = modelPathSegments(left);
  const rightSegments = modelPathSegments(right);
  if (!leftSegments || !rightSegments) return false;
  const commonLength = Math.min(leftSegments.length, rightSegments.length);
  return leftSegments
    .slice(0, commonLength)
    .every(
      (segment, index) =>
        comparableModelPathSegment(segment) === comparableModelPathSegment(rightSegments[index])
    );
}

function cloneCanonical<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function comparableModelPathSegment(segment: string): string {
  const trimmed = segment.trim();
  if (trimmed.length > 0) {
    const numeric = Number(trimmed);
    if (Number.isSafeInteger(numeric) && numeric >= 0) return `array:${numeric}`;
  }
  return `property:${segment}`;
}

function canonicalArrayIndex(segment: string, allowAppend: boolean): number | '-' | null {
  if (allowAppend && segment === '-') return '-';
  if (!/^(?:0|[1-9]\d*)$/u.test(segment)) return null;
  const index = Number(segment);
  return Number.isSafeInteger(index) ? index : null;
}

export function applySemanticFieldValue(
  sourceModel: unknown,
  fieldRef: string,
  value: unknown
): unknown | null {
  if (
    (!isRecord(sourceModel) && !Array.isArray(sourceModel)) ||
    !isCanonicalJsonValue(sourceModel) ||
    !isNonEmptyString(fieldRef) ||
    !isCanonicalJsonValue(value)
  ) {
    return null;
  }
  const segments = modelPathSegments(fieldRef);
  if (!segments) return null;
  const output = cloneCanonical(sourceModel);
  let cursor = output as Record<string, unknown> | unknown[];
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(cursor)) {
      const index = canonicalArrayIndex(segment, false);
      if (index === null || index === '-' || index >= cursor.length) return null;
      const next = cursor[index];
      if (!next || typeof next !== 'object') return null;
      cursor = next as Record<string, unknown> | unknown[];
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) {
      cursor[segment] = {};
    }
    const next = cursor[segment];
    if (!next || typeof next !== 'object') return null;
    cursor = next as Record<string, unknown> | unknown[];
  }
  const finalSegment = segments.at(-1)!;
  if (Array.isArray(cursor)) {
    const index = canonicalArrayIndex(finalSegment, true);
    if (index === null) return null;
    if (index === '-') {
      cursor.push(cloneCanonical(value));
    } else {
      if (index > cursor.length) return null;
      cursor[index] = cloneCanonical(value);
    }
  } else {
    cursor[finalSegment] = cloneCanonical(value);
  }
  return output;
}

function schemaPath(fileName: string): string {
  return path.resolve(__dirname, '..', 'schemas', fileName);
}

function policyCatalogPayload(catalog: RequirementsPolicyCatalog) {
  return {
    schemaVersion: catalog.schemaVersion,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
    policies: catalog.policies,
  };
}

function catalogFiniteSetsAreDeterministic(catalog: RequirementsPolicyCatalog): boolean {
  const policyIds = new Set<string>();
  for (const policy of catalog.policies) {
    if (policyIds.has(policy.policyId)) return false;
    policyIds.add(policy.policyId);
    const factPaths = new Set<string>();
    for (const predicate of policy.applicability.all) {
      if (factPaths.has(predicate.factPath)) return false;
      factPaths.add(predicate.factPath);
    }
  }
  return true;
}

type CatalogValidationState = 'valid' | 'authority_missing' | 'authority_mismatch' | 'invalid';

function policyCatalogValidationState(
  catalog: unknown,
  trustedAuthority: unknown
): CatalogValidationState {
  try {
    const schema = JSON.parse(readFileSync(schemaPath(CATALOG_SCHEMA), 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    if (!validate(catalog)) return 'invalid';
    const typed = catalog as RequirementsPolicyCatalog;
    if (!catalogFiniteSetsAreDeterministic(typed)) return 'invalid';
    if (typed.catalogHash !== sha256Stable(policyCatalogPayload(typed))) return 'invalid';
    if (typed.signature.signedCatalogHash !== typed.catalogHash) return 'invalid';
    const expectedSignatureHash = sha256Stable({
      algorithm: typed.signature.algorithm,
      catalogHash: typed.catalogHash,
      catalogId: typed.catalogId,
      catalogVersion: typed.catalogVersion,
    });
    if (typed.signature.signatureHash !== expectedSignatureHash) return 'invalid';
    if (!isRecord(trustedAuthority)) return 'authority_missing';
    if (
      !hasExactKeys(trustedAuthority, [
        'authorityId',
        'catalogId',
        'catalogVersion',
        'catalogHash',
        'signatureHash',
        'approvalReceiptHash',
      ]) ||
      !isNonEmptyString(trustedAuthority.authorityId) ||
      !isNonEmptyString(trustedAuthority.catalogId) ||
      !isNonEmptyString(trustedAuthority.catalogVersion) ||
      !isNonEmptyString(trustedAuthority.catalogHash) ||
      !isNonEmptyString(trustedAuthority.signatureHash) ||
      !isNonEmptyString(trustedAuthority.approvalReceiptHash) ||
      trustedAuthority.catalogId !== typed.catalogId ||
      trustedAuthority.catalogVersion !== typed.catalogVersion ||
      trustedAuthority.catalogHash !== typed.catalogHash ||
      trustedAuthority.signatureHash !== typed.signature.signatureHash ||
      !SHA256.test(trustedAuthority.approvalReceiptHash)
    ) {
      return 'authority_mismatch';
    }
    return 'valid';
  } catch {
    return 'invalid';
  }
}

export function validateRequirementsPolicyCatalog(
  catalog: unknown,
  trustedAuthority?: unknown
): catalog is RequirementsPolicyCatalog {
  return policyCatalogValidationState(catalog, trustedAuthority) === 'valid';
}

export function loadRequirementsPolicyCatalog(
  catalogPath: string,
  trustedAuthority?: unknown
): RequirementsPolicyCatalog {
  const parsed = yaml.load(readFileSync(catalogPath, 'utf8')) as unknown;
  if (!validateRequirementsPolicyCatalog(parsed, trustedAuthority)) {
    throw new Error(`requirements policy catalog is invalid: ${catalogPath}`);
  }
  return parsed;
}

function unresolved(reasonCode: string): SemanticResolutionResult {
  return {
    status: 'unresolved',
    authorityState: 'unresolved',
    blocking: true,
    resolvedValue: null,
    reasonCode,
    receipt: null,
  };
}

function isSourcePremise(value: unknown): value is SourceResolutionPremise {
  if (!isRecord(value) || value.kind !== 'source' || !isRecord(value.sourceSpan)) return false;
  return (
    hasExactKeys(value, ['kind', 'sourcePath', 'sourceSpan', 'excerpt', 'hash']) &&
    hasExactKeys(value.sourceSpan, ['startLine', 'endLine']) &&
    isNonEmptyString(value.sourcePath) &&
    Number.isInteger(value.sourceSpan.startLine) &&
    Number.isInteger(value.sourceSpan.endLine) &&
    Number(value.sourceSpan.startLine) >= 1 &&
    Number(value.sourceSpan.endLine) >= Number(value.sourceSpan.startLine) &&
    isNonEmptyString(value.excerpt) &&
    isNonEmptyString(value.hash) &&
    SHA256.test(value.hash)
  );
}

function isRepositoryPremise(value: unknown): value is RepositoryResolutionPremise {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'kind',
      'artifactPath',
      'hash',
      'candidateRef',
      'candidateValueHash',
    ]) &&
    value.kind === 'repository' &&
    isNonEmptyString(value.artifactPath) &&
    isNonEmptyString(value.hash) &&
    isNonEmptyString(value.candidateRef) &&
    isNonEmptyString(value.candidateValueHash) &&
    SHA256.test(value.hash) &&
    SHA256.test(value.candidateValueHash)
  );
}

function isPolicyPremise(value: unknown): value is PolicyResolutionPremise {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'kind',
      'catalogId',
      'catalogVersion',
      'catalogHash',
      'policyId',
      'policyVersion',
      'policyValueHash',
    ]) &&
    value.kind === 'policy' &&
    isNonEmptyString(value.catalogId) &&
    isNonEmptyString(value.catalogVersion) &&
    isNonEmptyString(value.catalogHash) &&
    isNonEmptyString(value.policyId) &&
    isNonEmptyString(value.policyVersion) &&
    isNonEmptyString(value.policyValueHash) &&
    SHA256.test(value.catalogHash) &&
    SHA256.test(value.policyValueHash)
  );
}

export function isResolutionPremise(value: unknown): value is SemanticResolutionPremise {
  return isSourcePremise(value) || isRepositoryPremise(value) || isPolicyPremise(value);
}

export function isPolicyApplicabilityInput(value: unknown): value is PolicyApplicabilityInput {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['policyId', 'catalogHash', 'factsHash']) &&
    isNonEmptyString(value.policyId) &&
    isNonEmptyString(value.catalogHash) &&
    isNonEmptyString(value.factsHash) &&
    SHA256.test(value.catalogHash) &&
    SHA256.test(value.factsHash)
  );
}

function parseSemanticCandidate(value: unknown): SemanticResolutionCandidate | null {
  if (!isRecord(value)) return null;
  if (
    !hasExactKeys(
      value,
      [
        'resolutionId',
        'fieldRef',
        'value',
        'semanticKind',
        'resolutionAuthorityClass',
        'premises',
        'derivationRule',
        'applicabilityProof',
        'conflictingCandidates',
      ],
      ['confidence']
    ) ||
    !isNonEmptyString(value.resolutionId) ||
    !isNonEmptyString(value.fieldRef) ||
    !isCanonicalJsonValue(value.value) ||
    !isNonEmptyString(value.semanticKind) ||
    !isNonEmptyString(value.resolutionAuthorityClass) ||
    !Array.isArray(value.premises) ||
    !value.premises.every(isResolutionPremise) ||
    !(value.derivationRule === null || isNonEmptyString(value.derivationRule)) ||
    !(value.applicabilityProof === null || isPolicyApplicabilityInput(value.applicabilityProof)) ||
    !isStringArray(value.conflictingCandidates) ||
    !(value.confidence === undefined ||
      (typeof value.confidence === 'number' && Number.isFinite(value.confidence)))
  ) {
    return null;
  }
  return value as unknown as SemanticResolutionCandidate;
}

function parseResolverOptions(value: unknown): SemanticResolverOptions {
  return isRecord(value) ? (value as SemanticResolverOptions) : {};
}

function exactLineExcerpt(content: string, startLine: number, endLine: number): string | null {
  const lines: Array<{ body: string; ending: string }> = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match[0] === '' && pattern.lastIndex === content.length) break;
    lines.push({ body: match[1], ending: match[2] });
    if (match[2] === '') break;
  }
  if (startLine < 1 || endLine < startLine || endLine > lines.length) return null;
  return lines
    .slice(startLine - 1, endLine)
    .map((line, index, selected) => line.body + (index < selected.length - 1 ? line.ending : ''))
    .join('');
}

type TrustedProofState = 'valid' | 'missing' | 'mismatch' | 'ambiguous' | 'stale';

function trustedSourceProofState(
  premise: SourceResolutionPremise,
  options: SemanticResolverOptions
): TrustedProofState {
  if (!isRecord(options.trustedSourceSnapshots)) return 'missing';
  const snapshot = options.trustedSourceSnapshots[premise.sourcePath];
  if (
    !isRecord(snapshot) ||
    typeof snapshot.content !== 'string' ||
    !isNonEmptyString(snapshot.hash) ||
    !Array.isArray(snapshot.extractions)
  ) {
    return 'missing';
  }
  if (
    !SHA256.test(snapshot.hash) ||
    snapshot.hash !== sha256Text(snapshot.content) ||
    premise.hash !== snapshot.hash ||
    exactLineExcerpt(
      snapshot.content,
      premise.sourceSpan.startLine,
      premise.sourceSpan.endLine
    ) !== premise.excerpt
  ) {
    return 'mismatch';
  }
  return 'valid';
}

function trustedSourceExtractionProof(
  candidate: SemanticResolutionCandidate,
  premise: SourceResolutionPremise,
  options: SemanticResolverOptions
): SemanticAuthorityProof | null {
  if (!isRecord(options.trustedSourceSnapshots)) return null;
  const snapshot = options.trustedSourceSnapshots[premise.sourcePath];
  if (!isRecord(snapshot) || !Array.isArray(snapshot.extractions)) return null;
  const matches = snapshot.extractions.filter((value) => {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        'fieldRef',
        'sourceSpan',
        'excerptHash',
        'valueHash',
        'parserId',
        'parserHash',
        'observationHash',
      ]) ||
      !isRecord(value.sourceSpan) ||
      !hasExactKeys(value.sourceSpan, ['startLine', 'endLine']) ||
      !isNonEmptyString(value.fieldRef) ||
      !isNonEmptyString(value.excerptHash) ||
      !isNonEmptyString(value.valueHash) ||
      !isNonEmptyString(value.parserId) ||
      !isNonEmptyString(value.parserHash) ||
      !isNonEmptyString(value.observationHash) ||
      !SHA256.test(value.excerptHash) ||
      !SHA256.test(value.valueHash) ||
      !SHA256.test(value.parserHash) ||
      !SHA256.test(value.observationHash)
    ) {
      return false;
    }
    const { observationHash, ...payload } = value;
    return (
      observationHash === sha256Stable(payload) &&
      value.fieldRef === candidate.fieldRef &&
      value.sourceSpan.startLine === premise.sourceSpan.startLine &&
      value.sourceSpan.endLine === premise.sourceSpan.endLine &&
      value.excerptHash === sha256Text(premise.excerpt) &&
      value.valueHash === sha256Stable(candidate.value)
    );
  });
  if (matches.length !== 1) return null;
  const match = matches[0];
  return {
    kind: 'source_extraction',
    parserId: match.parserId,
    parserHash: match.parserHash,
    observationHash: match.observationHash,
  };
}

function trustedInvocationContextState(
  options: SemanticResolverOptions
): TrustedProofState {
  const context = options.trustedInvocationContext;
  if (!isRecord(context)) return 'missing';
  if (
    !hasExactKeys(context, [
      'resolverId',
      'resolutionRunId',
      'sourceModelBefore',
    ]) ||
    !isNonEmptyString(context.resolverId) ||
    !isNonEmptyString(context.resolutionRunId) ||
    !isCanonicalJsonValue(context.sourceModelBefore)
  ) {
    return 'mismatch';
  }
  return 'valid';
}

function trustedRuleEvaluationProof(
  candidate: SemanticResolutionCandidate,
  sources: SourceResolutionPremise[],
  options: SemanticResolverOptions
): SemanticAuthorityProof | null {
  if (!isRecord(options.trustedRuleEvaluations)) return null;
  const evaluation = options.trustedRuleEvaluations[candidate.resolutionId];
  if (
    !isRecord(evaluation) ||
    !hasExactKeys(evaluation, [
      'resolutionId',
      'fieldRef',
      'ruleId',
      'ruleVersion',
      'ruleHash',
      'premiseSetHash',
      'outputValueHash',
      'evaluationReceiptHash',
    ]) ||
    !isNonEmptyString(evaluation.ruleVersion) ||
    !SHA256.test(String(evaluation.ruleHash)) ||
    !SHA256.test(String(evaluation.premiseSetHash)) ||
    !SHA256.test(String(evaluation.outputValueHash)) ||
    !SHA256.test(String(evaluation.evaluationReceiptHash))
  ) {
    return null;
  }
  const { evaluationReceiptHash, ...payload } = evaluation;
  if (
    evaluationReceiptHash !== sha256Stable(payload) ||
    evaluation.resolutionId !== candidate.resolutionId ||
    evaluation.fieldRef !== candidate.fieldRef ||
    evaluation.ruleId !== candidate.derivationRule ||
    evaluation.premiseSetHash !== sha256Stable(sources) ||
    evaluation.outputValueHash !== sha256Stable(candidate.value)
  ) {
    return null;
  }
  return {
    kind: 'rule_evaluation',
    ruleId: evaluation.ruleId,
    ruleVersion: evaluation.ruleVersion,
    ruleHash: evaluation.ruleHash,
    premiseSetHash: evaluation.premiseSetHash,
    outputValueHash: evaluation.outputValueHash,
    evaluationReceiptHash,
  };
}

function trustedRepositoryProofState(
  premise: RepositoryResolutionPremise,
  valueHash: string,
  options: SemanticResolverOptions
): TrustedProofState {
  if (!isRecord(options.trustedRepositoryEvidence)) return 'missing';
  const evidence = options.trustedRepositoryEvidence[premise.artifactPath];
  if (!isRecord(evidence)) return 'missing';
  if (
    !hasExactKeys(evidence, [
      'canonicalPath',
      'content',
      'hash',
      'producerId',
      'producerHash',
      'observationId',
      'resolutionRunId',
      'candidates',
      'conflictingCandidates',
      'candidateUniverseHash',
      'observationReceiptHash',
    ]) ||
    !isNonEmptyString(evidence.canonicalPath) ||
    typeof evidence.content !== 'string' ||
    !isNonEmptyString(evidence.hash) ||
    !isNonEmptyString(evidence.producerId) ||
    !isNonEmptyString(evidence.producerHash) ||
    !isNonEmptyString(evidence.observationId) ||
    !isNonEmptyString(evidence.resolutionRunId) ||
    !isNonEmptyString(evidence.candidateUniverseHash) ||
    !isNonEmptyString(evidence.observationReceiptHash) ||
    evidence.canonicalPath !== premise.artifactPath ||
    evidence.hash !== sha256Text(evidence.content) ||
    evidence.hash !== premise.hash ||
    !SHA256.test(evidence.hash) ||
    !SHA256.test(evidence.producerHash) ||
    !SHA256.test(evidence.candidateUniverseHash) ||
    !SHA256.test(evidence.observationReceiptHash) ||
    !Array.isArray(evidence.candidates) ||
    !isStringArray(evidence.conflictingCandidates) ||
    evidence.conflictingCandidates.length > 0
  ) {
    return 'mismatch';
  }
  const candidates = evidence.candidates.filter(
    (candidate) =>
      isRecord(candidate) &&
      hasExactKeys(candidate, ['candidateRef', 'valueHash']) &&
      isNonEmptyString(candidate.candidateRef) &&
      isNonEmptyString(candidate.valueHash) &&
      SHA256.test(candidate.valueHash)
  );
  if (candidates.length !== evidence.candidates.length) return 'mismatch';
  const canonicalCandidates = [...candidates].sort((left, right) =>
    left.candidateRef === right.candidateRef
      ? left.valueHash.localeCompare(right.valueHash)
      : left.candidateRef.localeCompare(right.candidateRef)
  );
  if (evidence.candidateUniverseHash !== sha256Stable(canonicalCandidates)) return 'mismatch';
  const { observationReceiptHash, ...observationPayload } = evidence;
  if (observationReceiptHash !== sha256Stable(observationPayload)) return 'mismatch';
  if (
    !isRecord(options.trustedInvocationContext) ||
    evidence.resolutionRunId !== options.trustedInvocationContext.resolutionRunId
  ) {
    return 'stale';
  }
  const selected = candidates.filter(
    (candidate) =>
      candidate.candidateRef === premise.candidateRef &&
      candidate.valueHash === valueHash &&
      premise.candidateValueHash === valueHash
  );
  if (candidates.length !== 1 || selected.length !== 1) return 'ambiguous';
  return 'valid';
}

function trustedRepositoryAuthorityProof(
  premise: RepositoryResolutionPremise,
  options: SemanticResolverOptions
): SemanticAuthorityProof | null {
  if (!isRecord(options.trustedRepositoryEvidence)) return null;
  const evidence = options.trustedRepositoryEvidence[premise.artifactPath];
  if (!isRecord(evidence)) return null;
  return {
    kind: 'repository_observation',
    canonicalPath: String(evidence.canonicalPath),
    producerId: String(evidence.producerId),
    producerHash: String(evidence.producerHash),
    observationId: String(evidence.observationId),
    candidateUniverseHash: String(evidence.candidateUniverseHash),
    observationReceiptHash: String(evidence.observationReceiptHash),
  };
}

function receiptAuthorityClassIsConsistent(receipt: Record<string, unknown>): boolean {
  if (!Array.isArray(receipt.premises) || !isRecord(receipt.authorityProof)) return false;
  const premises = receipt.premises;
  switch (receipt.resolutionAuthorityClass) {
    case 'source_extracted':
      return (
        premises.length === 1 &&
        isSourcePremise(premises[0]) &&
        receipt.authorityProof.kind === 'source_extraction' &&
        receipt.derivationRule === null &&
        receipt.applicabilityProof === null
      );
    case 'rule_derived':
      return (
        premises.length > 0 &&
        premises.every(isSourcePremise) &&
        receipt.authorityProof.kind === 'rule_evaluation' &&
        isNonEmptyString(receipt.derivationRule) &&
        receipt.applicabilityProof === null
      );
    case 'repository_derived':
      return (
        premises.length === 1 &&
        isRepositoryPremise(premises[0]) &&
        receipt.authorityProof.kind === 'repository_observation' &&
        receipt.derivationRule === null &&
        receipt.applicabilityProof === null
      );
    case 'policy_inherited':
      return (
        premises.length === 1 &&
        isPolicyPremise(premises[0]) &&
        receipt.authorityProof.kind === 'policy_evaluation' &&
        isNonEmptyString(receipt.derivationRule) &&
        isRecord(receipt.applicabilityProof)
      );
    default:
      return false;
  }
}

export function validateSemanticResolutionReceipt(
  receipt: unknown
): receipt is SemanticResolutionReceipt {
  try {
    const schema = JSON.parse(readFileSync(schemaPath(RECEIPT_SCHEMA), 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    if (!validate(receipt) || !isRecord(receipt) || !isNonEmptyString(receipt.receiptHash)) {
      return false;
    }
    if (!receiptAuthorityClassIsConsistent(receipt)) return false;
    const { receiptHash, ...payload } = receipt;
    return receiptHash === sha256Stable(payload);
  } catch {
    return false;
  }
}

type PredicateResult = true | false | 'missing' | 'ambiguous';

function factAt(facts: Record<string, unknown>, factPath: string): unknown {
  return factPath.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, facts);
}

function evaluatePolicy(policy: RequirementsPolicy, facts: Record<string, unknown>): PredicateResult {
  let result: PredicateResult = true;
  for (const predicate of policy.applicability.all) {
    const actual = factAt(facts, predicate.factPath);
    if (actual === undefined) return 'missing';
    if (actual !== null && typeof actual === 'object') return 'ambiguous';
    if (predicate.operator === 'equals' && actual !== predicate.expected) result = false;
  }
  return result;
}

function trustedPolicyFactsState(
  expectedFactsHash: string,
  options: SemanticResolverOptions
): { state: TrustedProofState; facts?: Record<string, unknown>; receiptHash?: string } {
  const observation = options.trustedPolicyFacts;
  if (!isRecord(observation)) return { state: 'missing' };
  if (
    !hasExactKeys(observation, [
      'facts',
      'factsHash',
      'sourceRefs',
      'observerId',
      'observationReceiptHash',
    ]) ||
    !isRecord(observation.facts) ||
    !isCanonicalJsonValue(observation.facts) ||
    !isNonEmptyString(observation.factsHash) ||
    !isStringArray(observation.sourceRefs) ||
    observation.sourceRefs.length === 0 ||
    !isNonEmptyString(observation.observerId) ||
    !isNonEmptyString(observation.observationReceiptHash) ||
    !SHA256.test(observation.factsHash) ||
    !SHA256.test(observation.observationReceiptHash)
  ) {
    return { state: 'mismatch' };
  }
  const { observationReceiptHash, ...payload } = observation;
  if (
    observation.factsHash !== sha256Stable(observation.facts) ||
    observation.factsHash !== expectedFactsHash ||
    observationReceiptHash !== sha256Stable(payload)
  ) {
    return { state: 'mismatch' };
  }
  return {
    state: 'valid',
    facts: observation.facts,
    receiptHash: observationReceiptHash,
  };
}

function authorize(
  candidate: SemanticResolutionCandidate,
  invocationContext: TrustedResolverInvocationContext,
  sourceModelAfter: unknown,
  authorityState: Exclude<ResolutionAuthorityState, 'unresolved'>,
  premises: SemanticResolutionPremise[],
  authorityProof: SemanticAuthorityProof,
  applicabilityProof: SemanticResolutionReceipt['applicabilityProof']
): SemanticResolutionResult {
  const payload = {
    schemaVersion: 'requirements-contract-semantic-resolution-receipt/v1' as const,
    resolutionId: candidate.resolutionId,
    fieldRef: candidate.fieldRef,
    valueHash: sha256Stable(candidate.value),
    resolutionAuthorityClass: candidate.resolutionAuthorityClass,
    premises,
    derivationRule: candidate.derivationRule,
    authorityProof,
    applicabilityProof,
    conflictingCandidates: candidate.conflictingCandidates,
    sourceModelHashBefore: sha256Stable(invocationContext.sourceModelBefore),
    sourceModelHashAfter: sha256Stable(sourceModelAfter),
    resolverId: invocationContext.resolverId,
    resolutionRunId: invocationContext.resolutionRunId,
  };
  return {
    status: 'authorized',
    authorityState,
    blocking: false,
    resolvedValue: candidate.value,
    reasonCode: null,
    receipt: { ...payload, receiptHash: sha256Stable(payload) },
  };
}

export function resolveSemanticField(
  candidateInput: unknown,
  optionsInput: unknown = {}
): SemanticResolutionResult {
  try {
    const candidate = parseSemanticCandidate(candidateInput);
    if (!candidate) return unresolved('malformed_semantic_candidate');
    const options = parseResolverOptions(optionsInput);
    if (!RESOLUTION_AUTHORITY_CLASSES.has(candidate.resolutionAuthorityClass)) {
      return unresolved('unsupported_resolution_authority_class');
    }
    if (candidate.resolutionAuthorityClass === 'model_hypothesis') {
      return unresolved('model_hypothesis_not_authority');
    }
    if (candidate.resolutionAuthorityClass === 'business_decision_required') {
      return unresolved('business_decision_required');
    }
    if (candidate.conflictingCandidates.length > 0) return unresolved('conflicting_candidates');
    if (
      new Set(candidate.premises.map((premise) => sha256Stable(premise))).size !==
      candidate.premises.length
    ) {
      return unresolved('duplicate_resolution_premise');
    }
    const invocationState = trustedInvocationContextState(options);
    if (invocationState === 'missing') return unresolved('trusted_resolver_context_missing');
    if (invocationState !== 'valid') return unresolved('trusted_resolver_context_mismatch');
    const invocationContext = options.trustedInvocationContext!;
    const sourceModelAfter = applySemanticFieldValue(
      invocationContext.sourceModelBefore,
      candidate.fieldRef,
      candidate.value
    );
    if (sourceModelAfter === null) return unresolved('invalid_semantic_field_ref');
    if (sha256Stable(sourceModelAfter) === sha256Stable(invocationContext.sourceModelBefore)) {
      return unresolved('semantic_noop_forbidden');
    }

    if (candidate.resolutionAuthorityClass === 'source_extracted') {
      if (candidate.premises.length !== 1 || !isSourcePremise(candidate.premises[0])) {
        return unresolved('incomplete_source_proof');
      }
      const sources = [candidate.premises[0]];
      const proofState = trustedSourceProofState(sources[0], options);
      if (proofState === 'missing') return unresolved('trusted_source_snapshot_missing');
      if (proofState !== 'valid') return unresolved('trusted_source_snapshot_mismatch');
      const extractionProof = trustedSourceExtractionProof(candidate, sources[0], options);
      if (!extractionProof) return unresolved('trusted_source_extraction_mismatch');
      return authorize(
        candidate,
        invocationContext,
        sourceModelAfter,
        'source_grounded',
        sources,
        extractionProof,
        null
      );
    }

    if (candidate.resolutionAuthorityClass === 'rule_derived') {
      if (
        !candidate.derivationRule ||
        !Array.isArray(options.allowlistedDerivationRules) ||
        !options.allowlistedDerivationRules.every((rule) => typeof rule === 'string') ||
        !new Set(options.allowlistedDerivationRules).has(candidate.derivationRule)
      ) {
        return unresolved('derivation_rule_not_allowlisted');
      }
      if (
        candidate.premises.length === 0 ||
        !candidate.premises.every(isSourcePremise)
      ) {
        return unresolved('rule_source_premises_incomplete');
      }
      const sources = candidate.premises;
      const proofStates = sources.map((premise) =>
        trustedSourceProofState(premise, options)
      );
      if (proofStates.includes('missing')) return unresolved('trusted_source_snapshot_missing');
      if (proofStates.some((state) => state !== 'valid')) {
        return unresolved('trusted_source_snapshot_mismatch');
      }
      const ruleProof = trustedRuleEvaluationProof(candidate, sources, options);
      if (!ruleProof) return unresolved('trusted_rule_evaluation_missing');
      return authorize(
        candidate,
        invocationContext,
        sourceModelAfter,
        'derived',
        sources,
        ruleProof,
        null
      );
    }

    if (candidate.resolutionAuthorityClass === 'repository_derived') {
      if (candidate.premises.length !== 1 || !isRepositoryPremise(candidate.premises[0])) {
        return unresolved('repository_evidence_not_unique');
      }
      const repository = [candidate.premises[0]];
      const proofState = trustedRepositoryProofState(
        repository[0],
        sha256Stable(candidate.value),
        options
      );
      if (proofState === 'missing') return unresolved('trusted_repository_evidence_missing');
      if (proofState === 'ambiguous') return unresolved('trusted_repository_evidence_ambiguous');
      if (proofState === 'stale') return unresolved('trusted_repository_evidence_stale');
      if (proofState !== 'valid') return unresolved('trusted_repository_readback_invalid');
      const repositoryProof = trustedRepositoryAuthorityProof(repository[0], options);
      if (!repositoryProof) return unresolved('trusted_repository_readback_invalid');
      return authorize(
        candidate,
        invocationContext,
        sourceModelAfter,
        'derived',
        repository,
        repositoryProof,
        null
      );
    }

    if (candidate.premises.length !== 0) return unresolved('policy_premises_invalid');
    const catalog = options.policyCatalog;
    if (!catalog) return unresolved('policy_catalog_invalid');
    const catalogState = policyCatalogValidationState(
      catalog,
      options.trustedPolicyCatalogAuthority
    );
    if (catalogState === 'authority_missing') {
      return unresolved('policy_catalog_authority_missing');
    }
    if (catalogState === 'authority_mismatch') {
      return unresolved('policy_catalog_authority_mismatch');
    }
    if (catalogState !== 'valid') return unresolved('policy_catalog_invalid');
    const proof = candidate.applicabilityProof;
    if (
      !proof ||
      proof.catalogHash !== catalog.catalogHash ||
      proof.policyId !== candidate.derivationRule
    ) {
      return unresolved('policy_applicability_missing');
    }
    const matches = catalog.policies.filter((policy) => policy.policyId === proof.policyId);
    if (matches.length !== 1) return unresolved('policy_candidate_ambiguous');
    const policy = matches[0];
    if (
      policy.fieldKind !== candidate.semanticKind ||
      sha256Stable(policy.value) !== sha256Stable(candidate.value)
    ) {
      return unresolved('policy_value_not_bound');
    }
    const factState = trustedPolicyFactsState(proof.factsHash, options);
    if (factState.state === 'missing') return unresolved('policy_fact_authority_missing');
    if (factState.state !== 'valid' || !factState.facts || !factState.receiptHash) {
      return unresolved('policy_fact_authority_mismatch');
    }
    const applicability = evaluatePolicy(policy, factState.facts);
    if (applicability === 'missing') return unresolved('policy_applicability_missing');
    if (applicability === 'ambiguous') return unresolved('policy_applicability_ambiguous');
    if (!applicability) return unresolved('policy_not_applicable');
    const policyPremise: PolicyResolutionPremise = {
      kind: 'policy',
      catalogId: catalog.catalogId,
      catalogVersion: catalog.catalogVersion,
      catalogHash: catalog.catalogHash,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      policyValueHash: sha256Stable(policy.value),
    };
    const authority = options.trustedPolicyCatalogAuthority!;
    return authorize(
      candidate,
      invocationContext,
      sourceModelAfter,
      'derived',
      [policyPremise],
      {
        kind: 'policy_evaluation',
        authorityId: authority.authorityId,
        approvalReceiptHash: authority.approvalReceiptHash,
        factObservationReceiptHash: factState.receiptHash,
      },
      {
        basis: 'deterministic_policy_predicate',
        result: true,
        policyId: policy.policyId,
        catalogHash: catalog.catalogHash,
        factsHash: proof.factsHash,
      }
    );
  } catch {
    return unresolved('malformed_semantic_candidate');
  }
}
