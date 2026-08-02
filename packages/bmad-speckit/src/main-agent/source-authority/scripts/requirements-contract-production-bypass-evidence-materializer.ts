import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalJson,
  fileHash,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;
type IssueValue = string | number | boolean | null;

export interface RequirementsContractProductionBypassEvidenceMaterializerInput {
  requirementRecordPath: string;
  transactionId: string;
  implementationAttemptId: string;
  attemptContextPath: string;
  pointerReceiptPath: string;
  implementationEvidencePath: string;
  evidenceRoot: string;
  contractHash: string;
  sourceHash: string;
  semanticModelHash: string;
}

export interface RequirementsContractProductionBypassEvidenceMaterializeCommandOptions extends RequirementsContractProductionBypassEvidenceMaterializerInput {
  json?: boolean;
}

export type ProductionBypassMaterializerIssue = {
  code: string;
  role?: string;
  aggregateFile?: string;
  sourcePath?: string;
  field?: string;
  expected?: IssueValue;
  actual?: IssueValue;
};

type ReadbackRef = {
  role: string;
  path: string;
  status: 'accepted' | 'missing' | 'invalid';
  hash: string | null;
  readbackHash: string | null;
  readbackVerified: boolean;
  observedDecision: string | null;
};

type SourceEvidenceRef = {
  path: string;
  hash: string;
  readbackHash: string;
  readbackVerified: true;
  producer: string;
  action: string;
  transactionId: string;
  implementationAttemptId: string;
  decision: 'PASS';
};

type AggregateRef = {
  aggregateFile: string;
  path: string;
  hash: string;
  readbackHash: string;
  readbackVerified: true;
  producer: string;
  action: string;
  transactionId: string;
  implementationAttemptId: string;
  decision: 'PASS';
  sourceEvidenceRef: SourceEvidenceRef;
};

export interface RequirementsContractProductionBypassEvidenceMaterializerReport {
  schemaVersion: 'requirements-contract-production-bypass-evidence-materializer-report/v1';
  producer: 'requirements-contract-production-bypass-evidence-materializer';
  action: 'requirements-contract-production-bypass-evidence-materialize';
  transactionId: string;
  implementationAttemptId: string;
  contractHash: string;
  sourceHash: string;
  semanticModelHash: string;
  inputRefs: ReadbackRef[];
  aggregateRefs: AggregateRef[];
  issueCount: number;
  issues: ProductionBypassMaterializerIssue[];
  decision: 'PASS' | 'BLOCK';
}

type StableJson = {
  document: JsonRecord;
  ref: ReadbackRef;
};

type PreparedAggregate = {
  aggregateFile: string;
  targetPath: string;
  document: JsonRecord;
  sourceEvidenceRef: SourceEvidenceRef;
};

const PRODUCER = 'requirements-contract-production-bypass-evidence-materializer';
const ACTION = 'requirements-contract-production-bypass-evidence-materialize';
const REPORT_FILE = 'production-bypass-evidence-materializer-report.json';
const SOURCE_SPECS = [
  {
    aggregateFile: 'checkpoint-semantic-validation-receipts.json',
    metrics: [
      'checkpointReceiptWithoutSemanticValidatorCount',
      'checkpointSemanticValidatorCoverage',
    ],
  },
  {
    aggregateFile: 'checkpoint-progress-consistency-report.json',
    metrics: ['blockedCheckpointMarkedCompletedCount'],
  },
  {
    aggregateFile: 'source-prd-lint-state-transition-report.json',
    metrics: ['sourcePrdLintBypassProgressionCount'],
  },
  {
    aggregateFile: 'runtime-status-authority-report.json',
    metrics: ['explicitSixModelStatusPassAuthorityCount', 'architectureHashOnlyPassCount'],
  },
  {
    aggregateFile: 'command-execution-receipt-bundle.json',
    metrics: [
      'taskReportCommandSuccessSynthesisCount',
      'taskReportRequirementClosureCount',
      'commandIdSubstringCoverageCount',
      'commandReceiptCoverage',
    ],
  },
  {
    aggregateFile: 'evidence-artifact-readback-report.json',
    metrics: [
      'missingArtifactAcceptedCount',
      'artifactCurrentAttemptMismatchCount',
      'artifactReadbackCoverage',
    ],
  },
  {
    aggregateFile: 'critical-auditor-independence-report.json',
    metrics: [
      'syntheticCriticalAuditorNoGapCount',
      'criticalAuditorProviderIdentityMismatchCount',
      'criticalAuditorProjectionCoverage',
    ],
  },
] as const;
const POINTER_AGGREGATE_FILE = 'current-dispatch-pointer-receipt.json';

function object(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedDecision(value: unknown): string | null {
  const normalized = text(value).toUpperCase();
  return normalized || null;
}

function decisionOf(document: JsonRecord): string | null {
  return normalizedDecision(
    document.decision ?? document.correctnessDecision ?? document.result ?? document.status
  );
}

function passDecisionOf(document: JsonRecord): 'PASS' | null {
  const decision = decisionOf(document);
  return decision === 'PASS' ? decision : null;
}

function schemaValidator(name: string) {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', name);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

function issue(
  issues: ProductionBypassMaterializerIssue[],
  code: string,
  details: Omit<ProductionBypassMaterializerIssue, 'code'> = {}
): void {
  issues.push({ code, ...details });
}

function issueValue(value: unknown): IssueValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
}

function fixturePath(candidatePath: string): boolean {
  const normalized = slash(path.resolve(candidatePath)).toLowerCase();
  const segments = normalized.split('/');
  const basename = path.basename(normalized);
  return (
    segments.some((segment) =>
      ['fixture', 'fixtures', '__fixture__', '__fixtures__'].includes(segment)
    ) || /(^|[._-])fixture([._-]|$)/u.test(basename)
  );
}

function missingRef(role: string, resolvedPath: string): ReadbackRef {
  return {
    role,
    path: slash(resolvedPath),
    status: 'missing',
    hash: null,
    readbackHash: null,
    readbackVerified: false,
    observedDecision: null,
  };
}

function invalidRef(role: string, resolvedPath: string): ReadbackRef {
  return {
    ...missingRef(role, resolvedPath),
    status: 'invalid',
  };
}

function readStableJson(input: {
  role: string;
  declaredPath: string;
  missingCode: string;
  invalidCode: string;
  issues: ProductionBypassMaterializerIssue[];
  rejectFixture?: boolean;
}): StableJson | { document: null; ref: ReadbackRef } {
  const resolvedPath = path.resolve(input.declaredPath);
  if (input.rejectFixture !== false && fixturePath(resolvedPath)) {
    issue(input.issues, 'production_bypass_materializer_fixture_path_forbidden', {
      role: input.role,
      sourcePath: slash(resolvedPath),
    });
    return { document: null, ref: invalidRef(input.role, resolvedPath) };
  }
  if (!fs.existsSync(resolvedPath)) {
    issue(input.issues, input.missingCode, {
      role: input.role,
      sourcePath: slash(resolvedPath),
    });
    return { document: null, ref: missingRef(input.role, resolvedPath) };
  }
  try {
    if (fs.lstatSync(resolvedPath).isSymbolicLink() || !fs.statSync(resolvedPath).isFile()) {
      throw new Error('not_regular_file');
    }
    const first = fs.readFileSync(resolvedPath);
    const second = fs.readFileSync(resolvedPath);
    const hash = fileHash(resolvedPath);
    const readbackHash = fileHash(resolvedPath);
    if (!first.equals(second) || hash !== readbackHash) {
      issue(input.issues, 'production_bypass_materializer_readback_mismatch', {
        role: input.role,
        sourcePath: slash(resolvedPath),
      });
      return { document: null, ref: invalidRef(input.role, resolvedPath) };
    }
    const document = object(JSON.parse(first.toString('utf8')));
    return {
      document,
      ref: {
        role: input.role,
        path: slash(resolvedPath),
        status: 'accepted',
        hash,
        readbackHash,
        readbackVerified: true,
        observedDecision: decisionOf(document),
      },
    };
  } catch {
    issue(input.issues, input.invalidCode, {
      role: input.role,
      sourcePath: slash(resolvedPath),
    });
    return { document: null, ref: invalidRef(input.role, resolvedPath) };
  }
}

function nestedContains(value: unknown, expected: string, depth = 0): boolean {
  if (depth > 4) return false;
  if (typeof value === 'string') return value === expected;
  if (Array.isArray(value)) {
    return value.some((entry) => nestedContains(entry, expected, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as JsonRecord).some((entry) =>
      nestedContains(entry, expected, depth + 1)
    );
  }
  return false;
}

function hashBindingMatches(
  document: JsonRecord,
  aliases: string[],
  bindingField: string,
  expected: string
): boolean {
  const direct = aliases.map((alias) => text(document[alias])).filter(Boolean);
  if (direct.length > 0) return direct.every((value) => value === expected);
  return nestedContains(document[bindingField], expected);
}

function validateIdentity(
  role: string,
  document: JsonRecord,
  input: RequirementsContractProductionBypassEvidenceMaterializerInput,
  issues: ProductionBypassMaterializerIssue[],
  requirementRecord = false
): void {
  const actualAttempt = requirementRecord
    ? text(document.currentAttemptId) || text(document.implementationAttemptId)
    : text(document.implementationAttemptId) || text(document.currentAttemptId);
  if (actualAttempt !== input.implementationAttemptId) {
    issue(issues, 'production_bypass_materializer_stale_attempt', {
      role,
      field: requirementRecord ? 'currentAttemptId' : 'implementationAttemptId',
      expected: input.implementationAttemptId,
      actual: actualAttempt || null,
    });
  }
  const bindings: Array<[string, boolean, string, string]> = [
    [
      'transactionId',
      text(document.transactionId) === input.transactionId,
      input.transactionId,
      text(document.transactionId),
    ],
    [
      'contractHash',
      text(document.contractHash) === input.contractHash,
      input.contractHash,
      text(document.contractHash),
    ],
    [
      'sourceHash',
      hashBindingMatches(
        document,
        ['sourceHash', 'sourceDocumentHash', 'sourcePlanHash', 'sourceAuthorityHash'],
        'sourceHashBindings',
        input.sourceHash
      ),
      input.sourceHash,
      text(
        document.sourceHash ??
          document.sourceDocumentHash ??
          document.sourcePlanHash ??
          document.sourceAuthorityHash
      ),
    ],
    [
      'semanticModelHash',
      hashBindingMatches(
        document,
        ['semanticModelHash'],
        'semanticModelHashBindings',
        input.semanticModelHash
      ),
      input.semanticModelHash,
      text(document.semanticModelHash),
    ],
  ];
  for (const [field, matches, expected, actual] of bindings) {
    if (!matches) {
      issue(issues, 'production_bypass_materializer_binding_mismatch', {
        role,
        field,
        expected,
        actual: actual || null,
      });
    }
  }
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function validateDeclaredRef(
  ownerRole: string,
  field: string,
  value: unknown,
  expectedPath: string,
  actualRef: ReadbackRef,
  issues: ProductionBypassMaterializerIssue[]
): void {
  const declared = object(value);
  if (Object.keys(declared).length === 0) return;
  const declaredPath = text(declared.path);
  const declaredHash = text(declared.hash);
  const declaredReadbackHash = text(declared.readbackHash);
  const checks: Array<[string, boolean, IssueValue, IssueValue]> = [
    [
      `${field}.path`,
      Boolean(declaredPath) && samePath(declaredPath, expectedPath),
      expectedPath,
      declaredPath || null,
    ],
    [`${field}.hash`, declaredHash === actualRef.hash, actualRef.hash, declaredHash || null],
  ];
  if (declared.readbackHash !== undefined) {
    checks.push([
      `${field}.readbackHash`,
      declaredReadbackHash === actualRef.readbackHash,
      actualRef.readbackHash,
      declaredReadbackHash || null,
    ]);
  }
  if (declared.readbackVerified !== undefined) {
    checks.push([
      `${field}.readbackVerified`,
      declared.readbackVerified === true && actualRef.readbackVerified,
      true,
      declared.readbackVerified === true,
    ]);
  }
  for (const [refField, matches, expected, actual] of checks) {
    if (!matches) {
      issue(issues, 'production_bypass_materializer_binding_mismatch', {
        role: ownerRole,
        field: refField,
        expected,
        actual,
      });
    }
  }
}

function finiteMetric(
  document: JsonRecord,
  metric: string,
  aggregateFile: string,
  issues: ProductionBypassMaterializerIssue[]
): number | null {
  const value = document[metric];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  issue(issues, 'production_bypass_materializer_metric_missing', {
    aggregateFile,
    field: metric,
    actual: issueValue(value),
  });
  return null;
}

function sourceEvidenceRef(
  source: StableJson,
  document: JsonRecord,
  input: RequirementsContractProductionBypassEvidenceMaterializerInput
): SourceEvidenceRef | null {
  const producer = text(document.producer);
  const action = text(document.action);
  const decision = passDecisionOf(document);
  if (
    !source.ref.hash ||
    !source.ref.readbackHash ||
    !source.ref.readbackVerified ||
    !producer ||
    !action ||
    !decision
  ) {
    return null;
  }
  return {
    path: source.ref.path,
    hash: source.ref.hash,
    readbackHash: source.ref.readbackHash,
    readbackVerified: true,
    producer,
    action,
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    decision,
  };
}

function prepareIndexedAggregate(input: {
  descriptor: JsonRecord;
  aggregateFile: string;
  metrics: readonly string[];
  materializerInput: RequirementsContractProductionBypassEvidenceMaterializerInput;
  evidenceRoot: string;
  issues: ProductionBypassMaterializerIssue[];
}): PreparedAggregate | null {
  const sourcePath = text(input.descriptor.path);
  if (!sourcePath) {
    issue(input.issues, 'production_bypass_materializer_aggregate_missing', {
      aggregateFile: input.aggregateFile,
      field: 'path',
    });
    return null;
  }
  const source = readStableJson({
    role: `aggregate:${input.aggregateFile}`,
    declaredPath: sourcePath,
    missingCode: 'production_bypass_materializer_aggregate_missing',
    invalidCode: 'production_bypass_materializer_aggregate_invalid',
    issues: input.issues,
  });
  if (!source.document) return null;
  validateIdentity(
    `aggregate:${input.aggregateFile}`,
    source.document,
    input.materializerInput,
    input.issues
  );
  validateIdentity(
    `aggregate-index:${input.aggregateFile}`,
    input.descriptor,
    input.materializerInput,
    input.issues
  );
  const actualHash = source.ref.hash;
  if (text(input.descriptor.hash ?? input.descriptor.contentHash) !== actualHash) {
    issue(input.issues, 'production_bypass_materializer_aggregate_hash_mismatch', {
      aggregateFile: input.aggregateFile,
      sourcePath: source.ref.path,
      expected: actualHash,
      actual: text(input.descriptor.hash ?? input.descriptor.contentHash) || null,
    });
  }
  if (
    input.descriptor.readbackVerified !== true ||
    text(input.descriptor.readbackHash) !== source.ref.readbackHash
  ) {
    issue(input.issues, 'production_bypass_materializer_aggregate_readback_mismatch', {
      aggregateFile: input.aggregateFile,
      sourcePath: source.ref.path,
      expected: source.ref.readbackHash,
      actual: text(input.descriptor.readbackHash) || null,
    });
  }
  for (const field of ['producer', 'action', 'decision'] as const) {
    const expected =
      field === 'decision' ? decisionOf(source.document) : text(source.document[field]);
    const actual =
      field === 'decision'
        ? normalizedDecision(input.descriptor[field])
        : text(input.descriptor[field]);
    if (!expected || expected !== actual) {
      issue(input.issues, 'production_bypass_materializer_aggregate_binding_mismatch', {
        aggregateFile: input.aggregateFile,
        field,
        expected,
        actual,
      });
    }
  }
  if (decisionOf(source.document) !== 'PASS') {
    issue(input.issues, 'production_bypass_materializer_aggregate_non_pass', {
      aggregateFile: input.aggregateFile,
      actual: decisionOf(source.document),
    });
  }
  const metrics: Record<string, number> = {};
  for (const metric of input.metrics) {
    const value = finiteMetric(source.document, metric, input.aggregateFile, input.issues);
    if (value !== null) metrics[metric] = value;
  }
  const sourceRef = sourceEvidenceRef(
    source as StableJson,
    source.document,
    input.materializerInput
  );
  if (!sourceRef) {
    issue(input.issues, 'production_bypass_materializer_aggregate_binding_mismatch', {
      aggregateFile: input.aggregateFile,
      field: 'sourceEvidenceRef',
    });
    return null;
  }
  const targetPath = path.resolve(input.evidenceRoot, input.aggregateFile);
  if (samePath(source.ref.path, targetPath)) {
    issue(input.issues, 'production_bypass_materializer_source_target_collision', {
      aggregateFile: input.aggregateFile,
      sourcePath: source.ref.path,
    });
  }
  return {
    aggregateFile: input.aggregateFile,
    targetPath,
    sourceEvidenceRef: sourceRef,
    document: {
      schemaVersion: 'requirements-contract-production-bypass-evidence-aggregate/v1',
      producer: PRODUCER,
      action: ACTION,
      aggregateFile: input.aggregateFile,
      transactionId: input.materializerInput.transactionId,
      implementationAttemptId: input.materializerInput.implementationAttemptId,
      contractHash: input.materializerInput.contractHash,
      sourceHash: input.materializerInput.sourceHash,
      semanticModelHash: input.materializerInput.semanticModelHash,
      sourceEvidenceRef: sourceRef,
      ...metrics,
      decision: sourceRef.decision,
    },
  };
}

function preparePointerAggregate(input: {
  pointer: StableJson;
  materializerInput: RequirementsContractProductionBypassEvidenceMaterializerInput;
  evidenceRoot: string;
  issues: ProductionBypassMaterializerIssue[];
}): PreparedAggregate | null {
  const selectionMetrics = object(input.pointer.document.selectionMetrics);
  const metricMap = {
    historicalPacketSelectionCount: 'historicalFallbackCount',
    packetWithoutTransactionBindingCount: 'missingBindingCount',
    currentDispatchPointerCoverage: 'currentDispatchPointerCoverage',
  } as const;
  const metrics: Record<string, number> = {};
  for (const [targetMetric, pointerMetric] of Object.entries(metricMap)) {
    const value = finiteMetric(
      selectionMetrics,
      pointerMetric,
      POINTER_AGGREGATE_FILE,
      input.issues
    );
    if (value !== null) metrics[targetMetric] = value;
  }
  if (decisionOf(input.pointer.document) !== 'PASS') {
    issue(input.issues, 'production_bypass_materializer_aggregate_non_pass', {
      aggregateFile: POINTER_AGGREGATE_FILE,
      actual: decisionOf(input.pointer.document),
    });
  }
  const sourceRef = sourceEvidenceRef(
    input.pointer,
    input.pointer.document,
    input.materializerInput
  );
  if (!sourceRef) {
    issue(input.issues, 'production_bypass_materializer_aggregate_binding_mismatch', {
      aggregateFile: POINTER_AGGREGATE_FILE,
      field: 'sourceEvidenceRef',
    });
    return null;
  }
  return {
    aggregateFile: POINTER_AGGREGATE_FILE,
    targetPath: path.resolve(input.evidenceRoot, POINTER_AGGREGATE_FILE),
    sourceEvidenceRef: sourceRef,
    document: {
      schemaVersion: 'requirements-contract-production-bypass-evidence-aggregate/v1',
      producer: PRODUCER,
      action: ACTION,
      aggregateFile: POINTER_AGGREGATE_FILE,
      transactionId: input.materializerInput.transactionId,
      implementationAttemptId: input.materializerInput.implementationAttemptId,
      contractHash: input.materializerInput.contractHash,
      sourceHash: input.materializerInput.sourceHash,
      semanticModelHash: input.materializerInput.semanticModelHash,
      sourceEvidenceRef: sourceRef,
      ...metrics,
      decision: sourceRef.decision,
    },
  };
}

function targetConflict(
  prepared: PreparedAggregate,
  issues: ProductionBypassMaterializerIssue[]
): boolean {
  if (!fs.existsSync(prepared.targetPath)) return false;
  try {
    if (
      fs.lstatSync(prepared.targetPath).isSymbolicLink() ||
      !fs.statSync(prepared.targetPath).isFile()
    ) {
      throw new Error('not_regular_file');
    }
    const existing = object(JSON.parse(fs.readFileSync(prepared.targetPath, 'utf8')));
    if (canonicalJson(existing) === canonicalJson(prepared.document)) return false;
  } catch {
    // Fall through to the deterministic conflict issue.
  }
  issue(issues, 'production_bypass_materializer_target_conflict', {
    aggregateFile: prepared.aggregateFile,
    sourcePath: slash(prepared.targetPath),
  });
  return true;
}

function materializerReport(
  input: RequirementsContractProductionBypassEvidenceMaterializerInput,
  inputRefs: ReadbackRef[],
  aggregateRefs: AggregateRef[],
  issues: ProductionBypassMaterializerIssue[]
): RequirementsContractProductionBypassEvidenceMaterializerReport {
  return {
    schemaVersion: 'requirements-contract-production-bypass-evidence-materializer-report/v1',
    producer: PRODUCER,
    action: ACTION,
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    contractHash: input.contractHash,
    sourceHash: input.sourceHash,
    semanticModelHash: input.semanticModelHash,
    inputRefs,
    aggregateRefs,
    issueCount: issues.length,
    issues,
    decision: issues.length === 0 ? 'PASS' : 'BLOCK',
  };
}

function persistReport(
  evidenceRoot: string,
  report: RequirementsContractProductionBypassEvidenceMaterializerReport
): void {
  const validate = schemaValidator(
    'requirements-contract-production-bypass-evidence-materializer-report.schema.json'
  );
  if (!validate(report)) {
    throw new Error(
      `production_bypass_materializer_report_schema_invalid:${JSON.stringify(
        validate.errors ?? []
      )}`
    );
  }
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const reportPath = path.join(evidenceRoot, REPORT_FILE);
  const write = writeGovernedJson(reportPath, report);
  const readback = object(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
  if (
    !validate(readback) ||
    canonicalJson(readback) !== canonicalJson(report) ||
    write.targetRef.hash !== write.targetRef.readbackHash
  ) {
    throw new Error('production_bypass_materializer_report_readback_invalid');
  }
}

export function materializeRequirementsContractProductionBypassEvidence(
  input: RequirementsContractProductionBypassEvidenceMaterializerInput
): RequirementsContractProductionBypassEvidenceMaterializerReport {
  const validateInput = schemaValidator(
    'requirements-contract-production-bypass-evidence-materializer-input.schema.json'
  );
  if (!validateInput(input)) {
    throw new Error(
      `production_bypass_materializer_input_schema_invalid:${JSON.stringify(
        validateInput.errors ?? []
      )}`
    );
  }
  const evidenceRoot = path.resolve(input.evidenceRoot);
  if (fixturePath(evidenceRoot)) {
    throw new Error('production_bypass_materializer_evidence_root_fixture_forbidden');
  }
  const issues: ProductionBypassMaterializerIssue[] = [];
  const requirementRecord = readStableJson({
    role: 'requirementRecord',
    declaredPath: input.requirementRecordPath,
    missingCode: 'production_bypass_materializer_requirement_record_missing',
    invalidCode: 'production_bypass_materializer_requirement_record_invalid',
    issues,
  });
  const attemptContext = readStableJson({
    role: 'attemptContext',
    declaredPath: input.attemptContextPath,
    missingCode: 'production_bypass_materializer_attempt_context_missing',
    invalidCode: 'production_bypass_materializer_attempt_context_invalid',
    issues,
  });
  const pointer = readStableJson({
    role: 'pointerReceipt',
    declaredPath: input.pointerReceiptPath,
    missingCode: 'production_bypass_materializer_pointer_receipt_missing',
    invalidCode: 'production_bypass_materializer_pointer_receipt_invalid',
    issues,
  });
  const implementationEvidence = readStableJson({
    role: 'implementationEvidence',
    declaredPath: input.implementationEvidencePath,
    missingCode: 'production_bypass_materializer_implementation_evidence_missing',
    invalidCode: 'production_bypass_materializer_implementation_evidence_invalid',
    issues,
  });
  const inputRefs = [
    requirementRecord.ref,
    attemptContext.ref,
    pointer.ref,
    implementationEvidence.ref,
  ];

  if (requirementRecord.document) {
    validateIdentity('requirementRecord', requirementRecord.document, input, issues, true);
  }
  if (attemptContext.document) {
    validateIdentity('attemptContext', attemptContext.document, input, issues);
  }
  if (pointer.document) {
    validateIdentity('pointerReceipt', pointer.document, input, issues);
    validateDeclaredRef(
      'pointerReceipt',
      'requirementRecordRef',
      pointer.document.requirementRecordRef,
      input.requirementRecordPath,
      requirementRecord.ref,
      issues
    );
    validateDeclaredRef(
      'pointerReceipt',
      'attemptContextRef',
      pointer.document.attemptContextRef,
      input.attemptContextPath,
      attemptContext.ref,
      issues
    );
  }
  if (implementationEvidence.document) {
    validateIdentity('implementationEvidence', implementationEvidence.document, input, issues);
    validateDeclaredRef(
      'implementationEvidence',
      'requirementRecordRef',
      implementationEvidence.document.requirementRecordRef,
      input.requirementRecordPath,
      requirementRecord.ref,
      issues
    );
    validateDeclaredRef(
      'implementationEvidence',
      'attemptContextRef',
      implementationEvidence.document.attemptContextRef,
      input.attemptContextPath,
      attemptContext.ref,
      issues
    );
    validateDeclaredRef(
      'implementationEvidence',
      'pointerReceiptRef',
      implementationEvidence.document.pointerReceiptRef,
      input.pointerReceiptPath,
      pointer.ref,
      issues
    );
    if (decisionOf(implementationEvidence.document) !== 'PASS') {
      issue(issues, 'production_bypass_materializer_implementation_evidence_non_pass', {
        actual: decisionOf(implementationEvidence.document),
      });
    }
  }

  const prepared: PreparedAggregate[] = [];
  if (implementationEvidence.document) {
    const descriptors = Array.isArray(implementationEvidence.document.aggregateSources)
      ? implementationEvidence.document.aggregateSources.map(object)
      : [];
    const expectedFiles = new Set(SOURCE_SPECS.map((entry) => entry.aggregateFile));
    const byFile = new Map<string, JsonRecord>();
    for (const descriptor of descriptors) {
      const aggregateFile = text(descriptor.aggregateFile);
      if (!expectedFiles.has(aggregateFile as (typeof SOURCE_SPECS)[number]['aggregateFile'])) {
        issue(issues, 'production_bypass_materializer_aggregate_unexpected', {
          aggregateFile: aggregateFile || undefined,
        });
        continue;
      }
      if (byFile.has(aggregateFile)) {
        issue(issues, 'production_bypass_materializer_aggregate_duplicate', {
          aggregateFile,
        });
        continue;
      }
      byFile.set(aggregateFile, descriptor);
    }
    for (const spec of SOURCE_SPECS) {
      const descriptor = byFile.get(spec.aggregateFile);
      if (!descriptor) {
        issue(issues, 'production_bypass_materializer_aggregate_missing', {
          aggregateFile: spec.aggregateFile,
          sourcePath: implementationEvidence.ref.path,
        });
        continue;
      }
      const aggregate = prepareIndexedAggregate({
        descriptor,
        aggregateFile: spec.aggregateFile,
        metrics: spec.metrics,
        materializerInput: input,
        evidenceRoot,
        issues,
      });
      if (aggregate) prepared.push(aggregate);
    }
  }
  if (pointer.document) {
    const aggregate = preparePointerAggregate({
      pointer: pointer as StableJson,
      materializerInput: input,
      evidenceRoot,
      issues,
    });
    if (aggregate) prepared.push(aggregate);
  }
  if (prepared.length !== SOURCE_SPECS.length + 1 && issues.length === 0) {
    issue(issues, 'production_bypass_materializer_aggregate_set_incomplete', {
      expected: SOURCE_SPECS.length + 1,
      actual: prepared.length,
    });
  }
  for (const aggregate of prepared) targetConflict(aggregate, issues);
  if (issues.length > 0) {
    const report = materializerReport(input, inputRefs, [], issues);
    persistReport(evidenceRoot, report);
    return report;
  }

  const aggregateRefs: AggregateRef[] = [];
  for (const aggregate of prepared) {
    try {
      let hash: string;
      let readbackHash: string;
      if (fs.existsSync(aggregate.targetPath)) {
        hash = fileHash(aggregate.targetPath);
        readbackHash = fileHash(aggregate.targetPath);
      } else {
        const write = writeGovernedJson(aggregate.targetPath, aggregate.document);
        hash = write.targetRef.hash;
        readbackHash = write.targetRef.readbackHash;
      }
      const readback = object(JSON.parse(fs.readFileSync(aggregate.targetPath, 'utf8')));
      if (canonicalJson(readback) !== canonicalJson(aggregate.document) || hash !== readbackHash) {
        issue(issues, 'production_bypass_materializer_aggregate_output_readback_mismatch', {
          aggregateFile: aggregate.aggregateFile,
          sourcePath: slash(aggregate.targetPath),
        });
        break;
      }
      aggregateRefs.push({
        aggregateFile: aggregate.aggregateFile,
        path: slash(aggregate.targetPath),
        hash,
        readbackHash,
        readbackVerified: true,
        producer: PRODUCER,
        action: ACTION,
        transactionId: input.transactionId,
        implementationAttemptId: input.implementationAttemptId,
        decision: aggregate.sourceEvidenceRef.decision,
        sourceEvidenceRef: aggregate.sourceEvidenceRef,
      });
    } catch {
      issue(issues, 'production_bypass_materializer_aggregate_output_write_failed', {
        aggregateFile: aggregate.aggregateFile,
        sourcePath: slash(aggregate.targetPath),
      });
      break;
    }
  }
  const report = materializerReport(input, inputRefs, aggregateRefs, issues);
  persistReport(evidenceRoot, report);
  return report;
}

export function requirementsContractProductionBypassEvidenceMaterializeCommand(
  options: RequirementsContractProductionBypassEvidenceMaterializeCommandOptions
): number {
  const { json, ...input } = options;
  const report = materializeRequirementsContractProductionBypassEvidence(input);
  const exitCode = report.decision === 'PASS' ? 0 : 2;
  const summary = {
    schemaVersion: 'requirements-contract-production-bypass-evidence-materialize-summary/v1',
    command: ACTION,
    decision: report.decision,
    exitCode,
    issueCount: report.issueCount,
    aggregateCount: report.aggregateRefs.length,
    reportPath: slash(path.resolve(input.evidenceRoot, REPORT_FILE)),
  };
  process.stdout.write(
    json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : `production_bypass_evidence_materialization=${report.decision}\n`
  );
  return exitCode;
}
