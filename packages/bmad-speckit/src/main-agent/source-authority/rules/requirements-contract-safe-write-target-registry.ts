import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-safe-write-target-registry.ts';

export type RequirementsContractSafeWriteTargetDescriptor =
  | {
      targetId: string;
      resolution: 'context_path';
      contextKey: 'consumerRegistryPath';
    }
  | {
      targetId: string;
      resolution: 'evidence_relative';
      relativePath: string;
    };

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
const FIXED_TARGET_DESCRIPTORS = [
  {
    targetId: 'consumer_registry',
    resolution: 'context_path',
    contextKey: 'consumerRegistryPath',
  },
  {
    targetId: 'prompt_transaction',
    resolution: 'evidence_relative',
    relativePath: 'G09-prompt-transaction.json',
  },
  {
    targetId: 'source_kernel',
    resolution: 'evidence_relative',
    relativePath: 'G10-source-kernel.json',
  },
  {
    targetId: 'authority_surface_parity',
    resolution: 'evidence_relative',
    relativePath: 'G12-authority-surface-parity.json',
  },
  {
    targetId: 'grill_session',
    resolution: 'evidence_relative',
    relativePath: 'grill-session.json',
  },
  {
    targetId: 'decision_receipts',
    resolution: 'evidence_relative',
    relativePath: 'decision-receipts.json',
  },
  {
    targetId: 'render_field_coverage',
    resolution: 'evidence_relative',
    relativePath: 'render-field-coverage.json',
  },
  {
    targetId: 'sequence_contract',
    resolution: 'evidence_relative',
    relativePath: 'sequence-contract.json',
  },
  {
    targetId: 'sequence_step_trace_matrix',
    resolution: 'evidence_relative',
    relativePath: 'sequence-step-trace-matrix.json',
  },
  {
    targetId: 'acceptance_root_proof_manifest',
    resolution: 'evidence_relative',
    relativePath: 'acceptance-root-proof-manifest.json',
  },
  {
    targetId: 'runtime_bundle_publication_receipt',
    resolution: 'evidence_relative',
    relativePath: 'runtime-bundle-publication-receipt.json',
  },
  {
    targetId: 'implementation_task_dag',
    resolution: 'evidence_relative',
    relativePath: 'implementation-task-dag.json',
  },
  {
    targetId: 'sequence_projection_report',
    resolution: 'evidence_relative',
    relativePath: 'sequence-projection-report.json',
  },
  {
    targetId: 'normalized_contract_package_manifest',
    resolution: 'evidence_relative',
    relativePath: 'normalized-contract-package-manifest.json',
  },
  {
    targetId: 'compact_trace_matrix_parity',
    resolution: 'evidence_relative',
    relativePath: 'compact-trace-matrix-parity.json',
  },
  {
    targetId: 'business_behavior_delta',
    resolution: 'evidence_relative',
    relativePath: 'business-behavior-delta.json',
  },
  {
    targetId: 'implementation_impact_map',
    resolution: 'evidence_relative',
    relativePath: 'implementation-impact-map.json',
  },
  {
    targetId: 'read_facade_parity',
    resolution: 'evidence_relative',
    relativePath: 'read-facade-parity.json',
  },
  {
    targetId: 'normalized_contract_scale_report',
    resolution: 'evidence_relative',
    relativePath: 'normalized-contract-scale-report.json',
  },
  {
    targetId: 'evaluation',
    resolution: 'evidence_relative',
    relativePath: 'G13-evaluation.json',
  },
  {
    targetId: 'requirements_contract_evaluation_report',
    resolution: 'evidence_relative',
    relativePath: 'requirements-contract-evaluation-report.json',
  },
  {
    targetId: 'legacy_prd_migration_receipt',
    resolution: 'evidence_relative',
    relativePath: 'legacy-prd-migration-receipt.json',
  },
  {
    targetId: 'consumer_migration',
    resolution: 'evidence_relative',
    relativePath: 'G14-consumer-migration.json',
  },
  {
    targetId: 'command_runs',
    resolution: 'evidence_relative',
    relativePath: 'command-runs.json',
  },
  {
    targetId: 'acceptance_trace_matrix',
    resolution: 'evidence_relative',
    relativePath: 'acceptance-trace-matrix.json',
  },
  {
    targetId: 'source_coverage',
    resolution: 'evidence_relative',
    relativePath: 'source-coverage.json',
  },
  {
    targetId: 'final_summary',
    resolution: 'evidence_relative',
    relativePath: 'final-summary.md',
  },
  {
    targetId: 'requirement_source_registry',
    resolution: 'evidence_relative',
    relativePath: 'requirement-source-registry.json',
  },
  {
    targetId: 'observed_sequence_receipt',
    resolution: 'evidence_relative',
    relativePath: 'observed-sequence-receipt.json',
  },
  {
    targetId: 'judge_credential_initialization_receipt',
    resolution: 'evidence_relative',
    relativePath: 'judge-credential-initialization-receipt.json',
  },
  {
    targetId: 'judge_provider_capability_selection_report',
    resolution: 'evidence_relative',
    relativePath: 'judge-provider-capability-selection-report.json',
  },
  {
    targetId: 'judge_provider_security_parity_report',
    resolution: 'evidence_relative',
    relativePath: 'judge-provider-security-parity-report.json',
  },
  {
    targetId: 'judge_provider_two_round_evidence',
    resolution: 'evidence_relative',
    relativePath: 'judge-provider-two-round-evidence.json',
  },
  {
    targetId: 'recovery_lineage_finalization_receipt',
    resolution: 'evidence_relative',
    relativePath: 'recovery-lineage-finalization-receipt.json',
  },
] as const satisfies readonly RequirementsContractSafeWriteTargetDescriptor[];

export interface RequirementsContractSafeWriteTargetContext {
  requirementSetId: string;
  implementationAttemptId: string;
  bundleRevision: string;
  activationAttemptId: string;
  sourcePrdPath: string;
  consumerRegistryPath: string;
  evidenceRoot: string;
  goalExecutionApplicable: boolean;
  activationOutcome: 'success' | 'blocked';
  transactionId?: string;
  auditAttemptId?: string;
}

export const REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY = {
  schemaVersion: 'requirements-contract-safe-write-target-registry/v1',
  targetSetSchemaVersion: 'requirements-contract-safe-write-target-set/v1',
  targetOrdering: 'normalized_path_lexicographic',
  fixedTargetDescriptors: FIXED_TARGET_DESCRIPTORS,
  parameterizedFamilies: [
    'source_prd',
    'trace_execution',
    'bundle_revision',
    'activation_plan',
    'activation_plan_write_receipt',
    'activation_outcome_receipt',
    'judge_attempt_receipts',
  ],
  applicabilityRules: {
    goalExecution: 'goal_execution_applicable',
    activationOutcome: 'success_or_blocked_exclusive',
    judgeAttemptReceipts: 'transaction_and_audit_attempt_required',
  },
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

export function requirementsContractSafeWriteTargetRegistryHash(): string {
  return sha256Stable(REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY);
}

export function createRequirementsContractSafeWriteTargetRegistryProjection(
  ownerHash: string
) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(ownerHash)) {
    throw new Error('safe_write_target_registry_owner_hash_invalid');
  }
  return {
    schemaVersion: REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.schemaVersion,
    owner: {
      path: REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY_OWNER_PATH,
      hash: ownerHash,
    },
    registryHash: requirementsContractSafeWriteTargetRegistryHash(),
    targetSetSchemaVersion:
      REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.targetSetSchemaVersion,
    targetOrdering: REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.targetOrdering,
    fixedTargetDescriptors:
      REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.fixedTargetDescriptors.map(
        (descriptor) => ({ ...descriptor })
      ),
    parameterizedFamilies: [
      ...REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.parameterizedFamilies,
    ],
    applicabilityRules: {
      ...REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.applicabilityRules,
    },
    excludedControlEvidenceFamilies: [
      ...REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY
        .excludedControlEvidenceFamilies,
    ],
    authority: REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.authority,
  };
}

function normalize(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function joinPortable(root: string, relativePath: string): string {
  return `${normalize(root).replace(/\/+$/u, '')}/${normalize(relativePath).replace(
    /^\/+/u,
    ''
  )}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(normalize))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function resolveFixedTargetDescriptor(
  context: RequirementsContractSafeWriteTargetContext,
  descriptor: RequirementsContractSafeWriteTargetDescriptor
): string {
  if (descriptor.resolution === 'context_path') {
    return context[descriptor.contextKey];
  }
  return joinPortable(context.evidenceRoot, descriptor.relativePath);
}

export function resolveRequirementsContractSafeWriteTargetSet(
  context: RequirementsContractSafeWriteTargetContext
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
    joinPortable(
      context.evidenceRoot,
      `normalized-contract-activation-plans/${context.activationAttemptId}.json`
    ),
    joinPortable(
      context.evidenceRoot,
      `normalized-contract-activation-plan-write-receipts/${context.activationAttemptId}.receipt.json`
    ),
    context.activationOutcome === 'success'
      ? joinPortable(
          context.evidenceRoot,
          'normalized-contract-activation-receipt.json'
        )
      : joinPortable(
          context.evidenceRoot,
          `normalized-contract-activation-attempts/${context.activationAttemptId}.json`
        ),
    ...FIXED_TARGET_DESCRIPTORS.map((descriptor) =>
      resolveFixedTargetDescriptor(context, descriptor)
    ),
  ];
  if (context.goalExecutionApplicable) targets.push(`${traceRoot}/goal_execution.md`);
  if (context.transactionId && context.auditAttemptId) {
    const judgeRoot = joinPortable(
      context.evidenceRoot,
      `judge-runtime/${context.transactionId}/${context.auditAttemptId}`
    );
    targets.push(`${judgeRoot}/capability-receipt.json`, `${judgeRoot}/selection-receipt.json`);
  }
  const exactTargets = uniqueSorted(targets);
  return {
    schemaVersion:
      REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.targetSetSchemaVersion,
    targets: exactTargets,
    targetSetHash: sha256Stable({
      schemaVersion:
        REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY.targetSetSchemaVersion,
      targets: exactTargets,
    }),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function excludedPatterns(
  context: RequirementsContractSafeWriteTargetContext
): RegExp[] {
  const evidenceRoot = escapeRegExp(
    normalize(context.evidenceRoot).replace(/\/+$/u, '')
  );
  return [
    new RegExp(`^${evidenceRoot}/safe-write-receipt-manifest\\.json$`, 'u'),
    new RegExp(`^${evidenceRoot}/G15-final-gates\\.json$`, 'u'),
    new RegExp(`^${evidenceRoot}/implementation-evidence\\.json$`, 'u'),
    new RegExp(
      `^${evidenceRoot}/terminal-(?:command-receipt|closeout-packet).*\\.json$`,
      'u'
    ),
    new RegExp(
      `^${evidenceRoot}/finalization-receipts/blocked/.+\\.blocked\\.json$`,
      'u'
    ),
    new RegExp(
      `^${evidenceRoot}/finalization-failure-archive/.+\\.draft\\.json$`,
      'u'
    ),
    new RegExp(
      `^${evidenceRoot}/recovery-finalization-transactions/.+/(?:intent\\.json|invocations/.+\\.intent\\.json|observations/.+\\.state-decision\\.receipt\\.json|phases/(?:prepare|target-promoted)\\.receipt\\.json|staged/recovery-lineage-receipt\\.json|backup/recovery-lineage-receipt\\.json)$`,
      'u'
    ),
    new RegExp(
      `^${evidenceRoot}/recovery-finalization-attempts/.+/(?:block\\.receipt\\.json|failure-archive\\.json)$`,
      'u'
    ),
  ];
}

export function classifyRequirementsContractSafeWritePath(
  value: string,
  context: RequirementsContractSafeWriteTargetContext
): 'receipt_complete' | 'excluded_control_evidence' | 'unregistered' {
  const normalized = normalize(value);
  if (excludedPatterns(context).some((pattern) => pattern.test(normalized))) {
    return 'excluded_control_evidence';
  }
  if (
    resolveRequirementsContractSafeWriteTargetSet(context).targets.includes(
      normalized
    )
  ) {
    return 'receipt_complete';
  }
  return 'unregistered';
}
