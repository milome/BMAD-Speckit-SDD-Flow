import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const BUNDLE_MEMBERS = [
  'bundle-manifest.json',
  'semantic-ir.json',
  'trace-graph.json',
  'target-bindings.json',
  'task-graph.json',
  'red-contracts.json',
  'oracle-registry.json',
  'acceptance-contracts.json',
  'evidence-requirements.json',
  'business-behavior-delta.json',
  'implementation-impact-map.json',
] as const;
const TRACE_EXECUTION_MEMBERS = [
  'model_packet.json',
  'transaction-manifest.json',
  'audit_receipt.json',
  'human_prompt.txt',
] as const;
const FIXED_TARGETS = [
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json',
  `${BASE}/G09-prompt-transaction.json`,
  `${BASE}/G10-source-kernel.json`,
  `${BASE}/G12-authority-surface-parity.json`,
  `${BASE}/grill-session.json`,
  `${BASE}/decision-receipts.json`,
  `${BASE}/render-field-coverage.json`,
  `${BASE}/sequence-contract.json`,
  `${BASE}/sequence-step-trace-matrix.json`,
  `${BASE}/acceptance-root-proof-manifest.json`,
  `${BASE}/runtime-bundle-publication-receipt.json`,
  `${BASE}/implementation-task-dag.json`,
  `${BASE}/sequence-projection-report.json`,
  `${BASE}/normalized-contract-package-manifest.json`,
  `${BASE}/compact-trace-matrix-parity.json`,
  `${BASE}/business-behavior-delta.json`,
  `${BASE}/implementation-impact-map.json`,
  `${BASE}/read-facade-parity.json`,
  `${BASE}/normalized-contract-scale-report.json`,
  `${BASE}/G13-evaluation.json`,
  `${BASE}/requirements-contract-evaluation-report.json`,
  `${BASE}/legacy-prd-migration-receipt.json`,
  `${BASE}/G14-consumer-migration.json`,
  `${BASE}/command-runs.json`,
  `${BASE}/acceptance-trace-matrix.json`,
  `${BASE}/source-coverage.json`,
  `${BASE}/final-summary.md`,
  `${BASE}/requirement-source-registry.json`,
  `${BASE}/observed-sequence-receipt.json`,
  `${BASE}/judge-credential-initialization-receipt.json`,
  `${BASE}/judge-provider-capability-selection-report.json`,
  `${BASE}/judge-provider-security-parity-report.json`,
  `${BASE}/judge-provider-two-round-evidence.json`,
  `${BASE}/recovery-lineage-finalization-receipt.json`,
] as const;

export interface Amend05SafeWriteTargetContext {
  requirementSetId: string;
  implementationAttemptId: string;
  bundleRevision: string;
  activationAttemptId: string;
  sourcePrdPath: string;
  goalExecutionApplicable: boolean;
  activationOutcome: 'success' | 'blocked';
  transactionId?: string;
  auditAttemptId?: string;
}

export const REQUIREMENTS_CONTRACT_AMEND05_SAFE_WRITE_TARGET_REGISTRY = {
  schemaVersion: 'requirements-contract-amend05-safe-write-target-registry/v1',
  fixedTargets: FIXED_TARGETS,
  parameterizedFamilies: [
    'source_prd',
    'trace_execution',
    'bundle_revision',
    'activation_plan',
    'activation_plan_write_receipt',
    'activation_outcome_receipt',
    'judge_attempt_receipts',
  ],
  excludedControlEvidenceFamilies: [
    'finalization_bundle_and_terminal_inputs',
    'finalization_block_receipts',
    'finalization_failure_archives',
    'recovery_finalization_transactions',
    'recovery_finalization_attempts',
    'terminal_supervisor_receipts',
  ],
  authority: 'none',
} as const;

function normalize(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(normalize))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function resolveAmend05ReceiptCompleteTargetSet(
  context: Amend05SafeWriteTargetContext
): { schemaVersion: string; targets: string[]; targetSetHash: string } {
  const traceRoot =
    `_bmad-output/runtime/requirement-records/${context.requirementSetId}` +
    `/trace-execution/${context.implementationAttemptId}`;
  const bundleRoot =
    `_bmad-output/runtime/requirement-records/${context.requirementSetId}` +
    `/authoring/revisions/${context.bundleRevision}`;
  const targets = [
    context.sourcePrdPath,
    ...TRACE_EXECUTION_MEMBERS.map((name) => `${traceRoot}/${name}`),
    ...BUNDLE_MEMBERS.map((name) => `${bundleRoot}/${name}`),
    `${BASE}/normalized-contract-activation-plans/${context.activationAttemptId}.json`,
    `${BASE}/normalized-contract-activation-plan-write-receipts/${context.activationAttemptId}.receipt.json`,
    context.activationOutcome === 'success'
      ? `${BASE}/normalized-contract-activation-receipt.json`
      : `${BASE}/normalized-contract-activation-attempts/${context.activationAttemptId}.json`,
    ...FIXED_TARGETS,
  ];
  if (context.goalExecutionApplicable) targets.push(`${traceRoot}/goal_execution.md`);
  if (context.transactionId && context.auditAttemptId) {
    const judgeRoot = `${BASE}/judge-runtime/${context.transactionId}/${context.auditAttemptId}`;
    targets.push(`${judgeRoot}/capability-receipt.json`, `${judgeRoot}/selection-receipt.json`);
  }
  const exactTargets = uniqueSorted(targets);
  return {
    schemaVersion: 'requirements-contract-amend05-safe-write-target-set/v1',
    targets: exactTargets,
    targetSetHash: sha256Stable({
      schemaVersion: 'requirements-contract-amend05-safe-write-target-set/v1',
      targets: exactTargets,
    }),
  };
}

const EXCLUDED_PATTERNS = [
  new RegExp(`^${BASE}/amend05-safe-write-receipt-manifest\\.json$`, 'u'),
  new RegExp(`^${BASE}/G15-final-gates\\.json$`, 'u'),
  new RegExp(`^${BASE}/implementation-evidence\\.json$`, 'u'),
  new RegExp(`^${BASE}/terminal-(?:command-receipt|closeout-packet).*\\.json$`, 'u'),
  new RegExp(`^${BASE}/finalization-receipts/blocked/.+\\.blocked\\.json$`, 'u'),
  new RegExp(`^${BASE}/finalization-failure-archive/.+\\.draft\\.json$`, 'u'),
  new RegExp(
    `^${BASE}/recovery-finalization-transactions/.+/(?:intent\\.json|invocations/.+\\.intent\\.json|observations/.+\\.state-decision\\.receipt\\.json|phases/(?:prepare|target-promoted)\\.receipt\\.json|staged/recovery-lineage-receipt\\.json|backup/recovery-lineage-receipt\\.json)$`,
    'u'
  ),
  new RegExp(
    `^${BASE}/recovery-finalization-attempts/.+/(?:block\\.receipt\\.json|failure-archive\\.json)$`,
    'u'
  ),
] as const;

export function classifyAmend05SafeWritePath(
  value: string
): 'receipt_complete' | 'excluded_control_evidence' | 'unregistered' {
  const normalized = normalize(value);
  if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'excluded_control_evidence';
  }
  if (FIXED_TARGETS.includes(normalized as (typeof FIXED_TARGETS)[number])) {
    return 'receipt_complete';
  }
  if (
    /^_bmad-output\/runtime\/requirement-records\/[^/]+\/(?:trace-execution|authoring\/revisions)\//u.test(
      normalized
    ) ||
    normalized.startsWith(`${BASE}/normalized-contract-activation-`)
  ) {
    return 'receipt_complete';
  }
  return 'unregistered';
}
