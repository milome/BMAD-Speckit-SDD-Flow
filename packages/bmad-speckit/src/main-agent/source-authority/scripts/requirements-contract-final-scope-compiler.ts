import {
  assertNoForbiddenKeys,
  canonicalHashList,
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  sameSet,
  stableHash,
  strings,
  text,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

const FORBIDDEN_SCOPE_KEYS = [
  'fallback',
  'budgetscaling',
  'partitioncountbudget',
  'score',
  'verdict',
  'approval',
];

export interface RequirementsContractChildClosureSummary {
  partitionId: string;
  childContractHash: string;
  closureReceiptHash: string;
  governedFileManifestHash: string;
  subcontractEvidenceHash: string;
  productionReachabilityReceiptHash: string;
  dependencyClosureHash: string;
}

export interface RequirementsContractParentGoalCampaignScopeManifest {
  schemaVersion: 'requirements-contract-parent-goal-campaign-scope-manifest/v1';
  campaignId: string;
  attemptId: string;
  partitionManifestHash: string;
  partitionSetHash: string;
  sourceAuthorityBundleHash: string;
  sourceCompositionPolicyHash: string;
  implementationLineageHash: string;
  childClosureCount: number;
  childClosures: RequirementsContractChildClosureSummary[];
  governedPathRefs: string[];
  taskReportProvenanceRefs: string[];
  priorFindingRefs: string[];
  deliverySurfaceRefs: string[];
  policyRefs: string[];
  coverageProofHash: string;
  campaignLineageKey: string;
  scopeManifestHash: string;
}

export class RequirementsContractFinalScopeError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalScopeError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalScopeError(code);
}

function childSummary(value: unknown): RequirementsContractChildClosureSummary {
  if (!isRecord(value)) fail('campaign_scope_child_closure_invalid');
  const summary = {
    partitionId: requireText(value, 'partitionId', 'campaign_scope_child_closure_invalid'),
    childContractHash: requireHash(
      value,
      'childContractHash',
      'campaign_scope_child_closure_invalid'
    ),
    closureReceiptHash: requireHash(value, 'receiptHash', 'campaign_scope_child_closure_invalid'),
    governedFileManifestHash: requireHash(
      value,
      'governedFileManifestHash',
      'campaign_scope_child_closure_invalid'
    ),
    subcontractEvidenceHash: requireHash(
      value,
      'subcontractEvidenceHash',
      'campaign_scope_child_closure_invalid'
    ),
    productionReachabilityReceiptHash: requireHash(
      value,
      'productionReachabilityReceiptHash',
      'campaign_scope_child_closure_invalid'
    ),
    dependencyClosureHash: requireHash(
      value,
      'dependencyClosureHash',
      'campaign_scope_child_closure_invalid'
    ),
  };
  if (value.decision !== 'pass') fail('campaign_scope_child_closure_not_pass');
  return summary;
}

function currentLineage(input: JsonRecord): JsonRecord {
  const lineage = isRecord(input.currentImplementationLineage)
    ? input.currentImplementationLineage
    : {};
  if (lineage.decision !== 'pass') fail('campaign_scope_lineage_not_closed');
  if (lineage.stale === true || lineage.current !== true) {
    fail('campaign_scope_lineage_stale');
  }
  return lineage;
}

export function compileRequirementsContractFinalScopeManifest(
  input: unknown
): RequirementsContractParentGoalCampaignScopeManifest {
  if (!isRecord(input)) fail('campaign_scope_input_invalid');
  assertNoForbiddenKeys(input, FORBIDDEN_SCOPE_KEYS, 'campaign_scope_forbidden_authority_field');
  const lineage = currentLineage(input);
  const expectedPartitionIds = requireNonEmptyUniqueStrings(
    input.expectedPartitionIds,
    'campaign_scope_expected_partitions_invalid'
  );
  const closures = Array.isArray(input.childClosureReceipts)
    ? input.childClosureReceipts.map(childSummary)
    : [];
  if (closures.length !== expectedPartitionIds.length) fail('campaign_scope_child_closure_missing');
  if (
    !sameSet(
      closures.map(({ partitionId }) => partitionId),
      expectedPartitionIds
    )
  ) {
    fail('campaign_scope_child_closure_mismatch');
  }
  const partitionManifestHash = requireHash(
    input,
    'partitionManifestHash',
    'campaign_scope_hash_invalid'
  );
  const partitionSetHash = requireHash(input, 'partitionSetHash', 'campaign_scope_hash_invalid');
  const sourceAuthorityBundleHash = requireHash(
    input,
    'sourceAuthorityBundleHash',
    'campaign_scope_hash_invalid'
  );
  const sourceCompositionPolicyHash = requireHash(
    input,
    'sourceCompositionPolicyHash',
    'campaign_scope_hash_invalid'
  );
  if (lineage.partitionManifestHash !== partitionManifestHash) {
    fail('campaign_scope_lineage_stale');
  }
  if (lineage.partitionSetHash !== partitionSetHash) {
    fail('campaign_scope_lineage_stale');
  }
  const taskReportProvenanceRefs = requireNonEmptyUniqueStrings(
    input.taskReportProvenanceRefs,
    'campaign_scope_task_report_provenance_missing'
  );
  const deliverySurfaceRefs = requireNonEmptyUniqueStrings(
    input.deliverySurfaceRefs,
    'campaign_scope_delivery_surface_missing'
  );
  const policyRefs = requireNonEmptyUniqueStrings(
    input.policyRefs,
    'campaign_scope_policy_missing'
  );
  const governedPathRefs = requireNonEmptyUniqueStrings(
    input.governedPathRefs,
    'campaign_scope_governed_bytes_missing'
  );
  const priorFindingRefs = strings(input.priorFindingRefs);
  const payload = {
    schemaVersion: 'requirements-contract-parent-goal-campaign-scope-manifest/v1' as const,
    campaignId: requireText(input, 'campaignId', 'campaign_scope_identity_invalid'),
    attemptId: requireText(input, 'attemptId', 'campaign_scope_identity_invalid'),
    partitionManifestHash,
    partitionSetHash,
    sourceAuthorityBundleHash,
    sourceCompositionPolicyHash,
    implementationLineageHash: requireHash(
      lineage,
      'implementationLineageHash',
      'campaign_scope_lineage_stale'
    ),
    childClosureCount: closures.length,
    childClosures: [...closures].sort((left, right) =>
      left.partitionId.localeCompare(right.partitionId)
    ),
    governedPathRefs,
    taskReportProvenanceRefs,
    priorFindingRefs: [...new Set(priorFindingRefs)].sort((left, right) =>
      left.localeCompare(right)
    ),
    deliverySurfaceRefs,
    policyRefs,
    coverageProofHash: stableHash({
      closureHashes: canonicalHashList(closures as unknown as JsonRecord[], 'closureReceiptHash'),
      governedPathRefs,
      taskReportProvenanceRefs,
      deliverySurfaceRefs,
      policyRefs,
    }),
  };
  const campaignLineageKey = stableHash({
    campaignId: payload.campaignId,
    attemptId: payload.attemptId,
    partitionManifestHash,
    partitionSetHash,
    implementationLineageHash: payload.implementationLineageHash,
  });
  const withLineage = { ...payload, campaignLineageKey };
  return {
    ...withLineage,
    scopeManifestHash: stableHash(withLineage),
  };
}

export function validateRequirementsContractFinalScopeManifest(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractParentGoalCampaignScopeManifest {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('campaign_scope_manifest_invalid');
  const manifest = value as unknown as RequirementsContractParentGoalCampaignScopeManifest;
  const { scopeManifestHash, ...payload } = manifest;
  if (scopeManifestHash !== stableHash(payload)) fail('campaign_scope_manifest_hash_mismatch');
  for (const field of [
    'campaignId',
    'attemptId',
    'partitionManifestHash',
    'partitionSetHash',
    'implementationLineageHash',
    'campaignLineageKey',
  ]) {
    if (manifest[field as keyof typeof manifest] !== currentAuthority[field]) {
      fail('campaign_scope_authority_stale');
    }
  }
  if (!text(manifest.schemaVersion).endsWith('/v1')) fail('campaign_scope_manifest_invalid');
  return manifest;
}
