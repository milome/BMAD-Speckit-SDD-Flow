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
type MetricKind = 'zero_count' | 'coverage';
type Issue = {
  code: string;
  sourcePath?: string;
  metric?: string;
  expected?: number;
  actual?: number | string | boolean | null;
};

type CorpusCase = {
  caseId: string;
  metric: string;
  kind: MetricKind;
  injectedValue: number;
};

type EvidenceRef = {
  sourcePath: string;
  resolvedPath: string;
  status: 'accepted' | 'missing' | 'invalid';
  hash: string | null;
  readbackHash: string | null;
  readbackVerified: boolean;
  decision: string | null;
};

export interface RequirementsContractProductionBypassVerifyOptions {
  cwd: string;
  evidenceRoot: string;
  corpusPath?: string;
  json?: boolean;
}

const SCHEMA_VERSION = 'requirements-contract-production-bypass-closure-report/v1';
const CORPUS_SCHEMA_VERSION =
  'requirements-contract-production-bypass-closure-corpus/v1';
const PRODUCER = 'requirements-contract-production-bypass-verifier';
const ACTION = 'requirements-contract-production-bypass-verify';
const DEFAULT_CORPUS_PATH =
  'tests/fixtures/requirements-contract/production-bypass-closure-corpus.v1.json';

const ZERO_COUNT_METRICS = [
  'checkpointReceiptWithoutSemanticValidatorCount',
  'blockedCheckpointMarkedCompletedCount',
  'sourcePrdLintBypassProgressionCount',
  'explicitSixModelStatusPassAuthorityCount',
  'architectureHashOnlyPassCount',
  'taskReportCommandSuccessSynthesisCount',
  'taskReportRequirementClosureCount',
  'commandIdSubstringCoverageCount',
  'missingArtifactAcceptedCount',
  'artifactCurrentAttemptMismatchCount',
  'historicalPacketSelectionCount',
  'packetWithoutTransactionBindingCount',
  'packageRuntimeRoutingOnlyActionCount',
  'installedPackageActionBehaviorMismatchCount',
  'syntheticCriticalAuditorNoGapCount',
  'criticalAuditorProviderIdentityMismatchCount',
  'currentAttemptClosureWithoutIndependentOracleCount',
] as const;

const COVERAGE_METRICS = [
  'checkpointSemanticValidatorCoverage',
  'commandReceiptCoverage',
  'artifactReadbackCoverage',
  'currentDispatchPointerCoverage',
  'packageActionSemanticBindingCoverage',
  'criticalAuditorProjectionCoverage',
] as const;

const METRIC_SOURCE_FILES: Record<string, string> = {
  checkpointReceiptWithoutSemanticValidatorCount:
    'checkpoint-semantic-validation-receipts.json',
  checkpointSemanticValidatorCoverage: 'checkpoint-semantic-validation-receipts.json',
  blockedCheckpointMarkedCompletedCount: 'checkpoint-progress-consistency-report.json',
  sourcePrdLintBypassProgressionCount: 'source-prd-lint-state-transition-report.json',
  explicitSixModelStatusPassAuthorityCount: 'runtime-status-authority-report.json',
  architectureHashOnlyPassCount: 'runtime-status-authority-report.json',
  taskReportCommandSuccessSynthesisCount: 'command-execution-receipt-bundle.json',
  taskReportRequirementClosureCount: 'command-execution-receipt-bundle.json',
  commandIdSubstringCoverageCount: 'command-execution-receipt-bundle.json',
  commandReceiptCoverage: 'command-execution-receipt-bundle.json',
  missingArtifactAcceptedCount: 'evidence-artifact-readback-report.json',
  artifactCurrentAttemptMismatchCount: 'evidence-artifact-readback-report.json',
  artifactReadbackCoverage: 'evidence-artifact-readback-report.json',
  historicalPacketSelectionCount: 'current-dispatch-pointer-receipt.json',
  packetWithoutTransactionBindingCount: 'current-dispatch-pointer-receipt.json',
  currentDispatchPointerCoverage: 'current-dispatch-pointer-receipt.json',
  packageRuntimeRoutingOnlyActionCount:
    '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
  installedPackageActionBehaviorMismatchCount:
    '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
  packageActionSemanticBindingCoverage:
    '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
  syntheticCriticalAuditorNoGapCount: 'critical-auditor-independence-report.json',
  criticalAuditorProviderIdentityMismatchCount:
    'critical-auditor-independence-report.json',
  criticalAuditorProjectionCoverage: 'critical-auditor-independence-report.json',
  currentAttemptClosureWithoutIndependentOracleCount: 'G05-trace-graph.json',
};

const FROZEN_METRIC_KINDS = new Map<string, MetricKind>([
  ...ZERO_COUNT_METRICS.map((metric) => [metric, 'zero_count'] as const),
  ...COVERAGE_METRICS.map((metric) => [metric, 'coverage'] as const),
]);

function object(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function normalizedDecision(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value.trim().toUpperCase();
}

function decisionOf(document: JsonRecord): string | null {
  return normalizedDecision(
    document.correctnessDecision ?? document.decision ?? document.result ?? document.status
  );
}

function schemaValidator(name: string) {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', name);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

function sourceTarget(
  cwd: string,
  evidenceRoot: string,
  sourcePath: string
): string {
  return path.resolve(sourcePath.startsWith('_bmad/') ? cwd : evidenceRoot, sourcePath);
}

function packagedCorpusPath(): string {
  return path.resolve(__dirname, '../../../..', DEFAULT_CORPUS_PATH);
}

function defaultCorpusPath(cwd: string): string {
  const projectCorpusPath = path.resolve(cwd, DEFAULT_CORPUS_PATH);
  if (fs.existsSync(projectCorpusPath)) return projectCorpusPath;
  return packagedCorpusPath();
}

function readJsonEvidence(
  cwd: string,
  evidenceRoot: string,
  sourcePath: string,
  issues: Issue[]
): { ref: EvidenceRef; document: JsonRecord | null } {
  const resolvedPath = sourceTarget(cwd, evidenceRoot, sourcePath);
  const baseRef = { sourcePath, resolvedPath: slash(resolvedPath) };
  if (!fs.existsSync(resolvedPath)) {
    issues.push({ code: 'production_bypass_evidence_missing', sourcePath });
    return {
      ref: {
        ...baseRef,
        status: 'missing',
        hash: null,
        readbackHash: null,
        readbackVerified: false,
        decision: null,
      },
      document: null,
    };
  }
  try {
    if (fs.lstatSync(resolvedPath).isSymbolicLink() || !fs.statSync(resolvedPath).isFile()) {
      throw new Error('not_regular_file');
    }
    const first = fs.readFileSync(resolvedPath);
    const second = fs.readFileSync(resolvedPath);
    const hash = fileHash(resolvedPath);
    const readbackHash = fileHash(resolvedPath);
    if (!first.equals(second) || hash !== readbackHash) throw new Error('readback_mismatch');
    const document = object(JSON.parse(first.toString('utf8')));
    const decision = decisionOf(document);
    if (decision !== 'PASS') {
      issues.push({
        code: 'production_bypass_evidence_non_pass',
        sourcePath,
        actual: decision,
      });
    }
    return {
      ref: {
        ...baseRef,
        status: decision === 'PASS' ? 'accepted' : 'invalid',
        hash,
        readbackHash,
        readbackVerified: true,
        decision,
      },
      document,
    };
  } catch {
    issues.push({ code: 'production_bypass_evidence_invalid', sourcePath });
    return {
      ref: {
        ...baseRef,
        status: 'invalid',
        hash: null,
        readbackHash: null,
        readbackVerified: false,
        decision: null,
      },
      document: null,
    };
  }
}

function readCorpus(corpusPath: string, issues: Issue[]): {
  ref: EvidenceRef;
  cases: CorpusCase[];
} {
  const resolvedPath = path.resolve(corpusPath);
  const baseRef = { sourcePath: slash(corpusPath), resolvedPath: slash(resolvedPath) };
  try {
    if (
      !fs.existsSync(resolvedPath) ||
      fs.lstatSync(resolvedPath).isSymbolicLink() ||
      !fs.statSync(resolvedPath).isFile()
    ) {
      throw new Error('missing');
    }
    const first = fs.readFileSync(resolvedPath);
    const second = fs.readFileSync(resolvedPath);
    const canonicalCorpus = fs.readFileSync(packagedCorpusPath());
    const hash = fileHash(resolvedPath);
    const readbackHash = fileHash(resolvedPath);
    if (!first.equals(second) || hash !== readbackHash) throw new Error('readback_mismatch');
    const corpus = object(JSON.parse(first.toString('utf8')));
    const cases = Array.isArray(corpus.cases) ? (corpus.cases as CorpusCase[]) : [];
    const actualKinds = new Map(cases.map((entry) => [entry.metric, entry.kind]));
    const corpusValid =
      corpus.schemaVersion === CORPUS_SCHEMA_VERSION &&
      cases.length === FROZEN_METRIC_KINDS.size &&
      actualKinds.size === FROZEN_METRIC_KINDS.size &&
      first.equals(canonicalCorpus) &&
      [...FROZEN_METRIC_KINDS].every(
        ([metric, kind]) => actualKinds.get(metric) === kind
      );
    if (!corpusValid) {
      issues.push({ code: 'production_bypass_corpus_invalid', sourcePath: baseRef.sourcePath });
    }
    return {
      ref: {
        ...baseRef,
        status: corpusValid ? 'accepted' : 'invalid',
        hash,
        readbackHash,
        readbackVerified: true,
        decision: corpusValid ? 'PASS' : 'BLOCK',
      },
      cases,
    };
  } catch {
    issues.push({ code: 'production_bypass_corpus_missing', sourcePath: baseRef.sourcePath });
    return {
      ref: {
        ...baseRef,
        status: 'missing',
        hash: null,
        readbackHash: null,
        readbackVerified: false,
        decision: null,
      },
      cases: [],
    };
  }
}

export function evaluateProductionBypassClosure(
  options: RequirementsContractProductionBypassVerifyOptions
): JsonRecord {
  const validateInput = schemaValidator(
    'requirements-contract-production-bypass-verification-input.schema.json'
  );
  if (!validateInput(options)) {
    throw new Error(
      `production_bypass_input_schema_invalid:${JSON.stringify(validateInput.errors ?? [])}`
    );
  }
  const cwd = path.resolve(options.cwd);
  const evidenceRoot = path.resolve(options.evidenceRoot);
  const corpusPath = path.resolve(
    options.corpusPath ?? defaultCorpusPath(cwd)
  );
  const issues: Issue[] = [];
  const corpus = readCorpus(corpusPath, issues);
  const sourcePaths = [...new Set(Object.values(METRIC_SOURCE_FILES))];
  const documents = new Map<string, JsonRecord | null>();
  const evidenceRefs = sourcePaths.map((sourcePath) => {
    const evidence = readJsonEvidence(cwd, evidenceRoot, sourcePath, issues);
    documents.set(sourcePath, evidence.document);
    return evidence.ref;
  });
  const metricValues: Record<string, number> = {};
  for (const [metric, kind] of FROZEN_METRIC_KINDS) {
    const sourcePath = METRIC_SOURCE_FILES[metric];
    const actual = documents.get(sourcePath)?.[metric];
    const expected = kind === 'zero_count' ? 0 : 1;
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
      metricValues[metric] = kind === 'zero_count' ? 1 : 0;
      issues.push({
        code: 'production_bypass_metric_invalid',
        sourcePath,
        metric,
        expected,
        actual:
          actual === null ||
          typeof actual === 'string' ||
          typeof actual === 'number' ||
          typeof actual === 'boolean'
            ? actual
            : null,
      });
      continue;
    }
    metricValues[metric] = actual;
    if (actual !== expected) {
      issues.push({
        code: 'production_bypass_metric_failed',
        sourcePath,
        metric,
        expected,
        actual,
      });
    }
  }
  const traceGraph = documents.get('G05-trace-graph.json') ?? {};
  const declaredIndependentOracleClosureCount =
    typeof traceGraph.independentOracleClosureCount === 'number' &&
    Number.isFinite(traceGraph.independentOracleClosureCount) &&
    traceGraph.independentOracleClosureCount >= 0
      ? traceGraph.independentOracleClosureCount
      : 0;
  if (
    traceGraph.independentOracleClosureCount !== undefined &&
    declaredIndependentOracleClosureCount !== traceGraph.independentOracleClosureCount
  ) {
    issues.push({
      code: 'production_bypass_oracle_closure_count_invalid',
      sourcePath: 'G05-trace-graph.json',
      actual:
        traceGraph.independentOracleClosureCount === null ||
        typeof traceGraph.independentOracleClosureCount === 'string' ||
        typeof traceGraph.independentOracleClosureCount === 'number' ||
        typeof traceGraph.independentOracleClosureCount === 'boolean'
          ? traceGraph.independentOracleClosureCount
          : null,
    });
  }
  const independentOracleClosureCount = declaredIndependentOracleClosureCount;
  const productionBypassClosureIssueCount = issues.length;
  const correctnessDecision =
    productionBypassClosureIssueCount === 0 ? 'PASS' : 'BLOCK';
  return {
    schemaVersion: SCHEMA_VERSION,
    producer: PRODUCER,
    action: ACTION,
    corpusRef: corpus.ref,
    evidenceRefs,
    ...metricValues,
    independentOracleClosureCount,
    productionBypassClosureIssueCount,
    issues,
    correctnessDecision,
    efficiencyMetricsApplicable: correctnessDecision === 'PASS',
  };
}

export function requirementsContractProductionBypassVerifyCommand(
  options: RequirementsContractProductionBypassVerifyOptions
): number {
  const report = evaluateProductionBypassClosure(options);
  const validateReport = schemaValidator(
    'requirements-contract-production-bypass-closure-report.schema.json'
  );
  if (!validateReport(report)) {
    throw new Error(
      `production_bypass_report_schema_invalid:${JSON.stringify(validateReport.errors ?? [])}`
    );
  }
  const evidenceRoot = path.resolve(options.evidenceRoot);
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const reportPath = path.join(evidenceRoot, 'production-bypass-closure-report.json');
  const write = writeGovernedJson(reportPath, report);
  const readback = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as JsonRecord;
  if (
    !validateReport(readback) ||
    canonicalJson(readback) !== canonicalJson(report) ||
    write.targetRef.hash !== write.targetRef.readbackHash
  ) {
    throw new Error('production_bypass_report_readback_invalid');
  }
  const exitCode = report.correctnessDecision === 'PASS' ? 0 : 2;
  const summary = {
    schemaVersion: 'requirements-contract-production-bypass-verify-summary/v1',
    command: ACTION,
    decision: report.correctnessDecision,
    exitCode,
    reportRef: write.targetRef,
    safeWriteReceiptRef: write.receiptRef,
  };
  process.stdout.write(
    options.json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : `production_bypass_closure=${report.correctnessDecision}\n`
  );
  return exitCode;
}
