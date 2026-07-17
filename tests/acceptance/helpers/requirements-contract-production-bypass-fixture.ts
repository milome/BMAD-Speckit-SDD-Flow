import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ZERO_COUNT_METRICS = [
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

export const COVERAGE_METRICS = [
  'checkpointSemanticValidatorCoverage',
  'commandReceiptCoverage',
  'artifactReadbackCoverage',
  'currentDispatchPointerCoverage',
  'packageActionSemanticBindingCoverage',
  'criticalAuditorProjectionCoverage',
] as const;

export const METRIC_SOURCE_FILES: Record<string, string> = {
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

type ProductionBypassFixtureRoots = {
  projectRoot: string;
  evidenceRoot: string;
};

function metricTarget(
  roots: ProductionBypassFixtureRoots,
  metric: string
): string {
  const relativePath = METRIC_SOURCE_FILES[metric];
  if (!relativePath) throw new Error(`unknown production bypass metric: ${metric}`);
  const root = relativePath.startsWith('_bmad/') ? roots.projectRoot : roots.evidenceRoot;
  return path.join(root, relativePath);
}

export function writePassingProductionBypassEvidence(
  roots: ProductionBypassFixtureRoots
): void {
  const documents = new Map<string, Record<string, unknown>>();
  for (const metric of ZERO_COUNT_METRICS) {
    const relativePath = METRIC_SOURCE_FILES[metric];
    const document = documents.get(relativePath) ?? { decision: 'pass' };
    document[metric] = 0;
    documents.set(relativePath, document);
  }
  for (const metric of COVERAGE_METRICS) {
    const relativePath = METRIC_SOURCE_FILES[metric];
    const document = documents.get(relativePath) ?? { decision: 'pass' };
    document[metric] = 1;
    documents.set(relativePath, document);
  }
  for (const [relativePath, document] of documents) {
    const root = relativePath.startsWith('_bmad/') ? roots.projectRoot : roots.evidenceRoot;
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
}

export function injectProductionBypassMetric(
  roots: ProductionBypassFixtureRoots,
  metric: string,
  value: number
): void {
  const target = metricTarget(roots, metric);
  const document = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>;
  document[metric] = value;
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}
