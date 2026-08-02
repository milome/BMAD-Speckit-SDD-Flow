function modulePath(relativePath) {
  return `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
}

const {
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require(modulePath('./canonical-hash'));
const {
  activateGoalCampaign,
  activateGoalCampaignFromSuccessorAuthority,
  issueSubcontractExecutionLease,
} = require(modulePath('./campaign-activation'));
const {
  closeGoalCampaign,
} = require(modulePath('./campaign-closure'));
const {
  commitGoalCampaignRepairAuthority,
  compileGoalCampaignRepairAuthority,
  verifyGoalCampaignRepairAuthority,
} = require(modulePath('./campaign-repair-authority'));
const {
  compileCanonicalIntent,
} = require(modulePath('./canonical-intent-compiler'));
const {
  compileCompositeSourceAuthorityBundle,
} = require(modulePath('./composite-source-authority-bundle'));
const {
  compileGoalContract,
  compileGoalContractPolicy,
  goalContractCompilerIdentity,
} = require(modulePath('./goal-contract-compiler'));
const {
  compileIntentAuthorityEnvelope,
} = require(modulePath('./intent-authority'));
const {
  compilePartitionImpactGraph,
  verifyPartitionImpactGraph,
} = require(modulePath('./partition-impact-graph'));
const {
  compilePartitionClosureFeasibility,
  verifyPartitionClosureFeasibility,
} = require(modulePath('./partition-closure-feasibility'));
const {
  loadPartitionImpactPolicy,
} = require(modulePath('./partition-impact-policy'));
const {
  compilePartitionImpactAuthority,
  compilePartitionImpactDriftBaseline,
  compilePartitions,
  projectExecutionArtifacts,
} = require(modulePath('./partition-compiler'));
const {
  commitRequirementRecordPartitionAuthoritySupersession,
  readRequirementRecordPartitionAuthorityProjection,
  recoverRequirementRecordPartitionAuthorityProjection,
} = require(modulePath('./authority-supersession'));
const {
  activateStandalonePartitionGeneration,
  assertRawNonAuthoritativeContainmentRoot,
  assertImmutableAuthorityUnit,
  computePartitionGenerationKey,
  goalContractAuthorityWriterBinding,
  preflightRequirementRecordPartitionAuthoritySupersession,
  resolveCanonicalPartitionOutputPaths,
  writeImmutableAuthorityFile,
} = require(modulePath('./partition-output-paths'));
const {
  goalContractSchemaArtifactHash,
  validateGoalContractSchema,
} = require(modulePath('./schema-registry'));
const {
  compileSourceCompositionPolicy,
} = require(modulePath('./source-composition-policy'));
const {
  resolveSupervisorReadinessProjection,
} = require(modulePath('./supervisor-readiness-projection'));
const {
  compileOrderedSourceSnapshotSet,
  compileSourceSnapshot,
} = require(modulePath('./source-snapshot'));
const {
  compileSpecSpanRegistry,
  resolveSpecSpan,
} = require(modulePath('./spec-span-registry'));
const {
  closeSubcontract,
} = require(modulePath('./subcontract-closure'));
const {
  compileSubcontractEvidence,
} = require(modulePath('./subcontract-evidence'));

const KERNEL_SCHEMA_NAMES = Object.freeze([
  'goal-contract-campaign-activation-receipt.schema.json',
  'goal-contract-campaign-closure-receipt.schema.json',
  'goal-contract-campaign-repair-authority-receipt.schema.json',
  'goal-contract-canonical-intent-bundle.schema.json',
  'goal-contract-canonical-source-snapshot.schema.json',
  'goal-contract-compilation-receipt.schema.json',
  'goal-contract-composite-source-authority-bundle.schema.json',
  'goal-contract-intent-authority-envelope.schema.json',
  'goal-contract-lifecycle-authority-binding.schema.json',
  'goal-contract-partition-closure-feasibility-receipt.schema.json',
  'goal-contract-partition-impact-drift-receipt.schema.json',
  'goal-contract-partition-impact-graph.schema.json',
  'goal-contract-partition-impact-policy.schema.json',
  'goal-contract-partition-manifest.schema.json',
  'goal-contract-partition-output-authority.schema.json',
  'goal-contract-partition-plan.schema.json',
  'goal-contract-source-composition-policy.schema.json',
  'goal-contract-spec-span-registry.schema.json',
  'goal-contract-subcontract-closure-receipt.schema.json',
  'goal-contract-subcontract-evidence.schema.json',
  'goal-contract-subcontract-execution-lease.schema.json',
  'goal-contract-subordinate-source-coverage-receipt.schema.json',
  'goal-contract-supervisor-readiness-projection.schema.json',
]);
const RECEIPT_SCHEMAS = Object.freeze({
  'goal-contract-campaign-activation-receipt/v1': {
    schemaName:
      'goal-contract-campaign-activation-receipt.schema.json',
    hashField: 'receiptHash',
  },
  'goal-contract-campaign-closure-receipt/v1': {
    schemaName: 'goal-contract-campaign-closure-receipt.schema.json',
    hashField: 'receiptHash',
  },
  'goal-contract-campaign-repair-authority-receipt/v1': {
    schemaName:
      'goal-contract-campaign-repair-authority-receipt.schema.json',
    hashField: 'receiptHash',
  },
  'goal-contract-subcontract-closure-receipt/v1': {
    schemaName:
      'goal-contract-subcontract-closure-receipt.schema.json',
    hashField: 'receiptHash',
  },
  'goal-contract-subcontract-evidence/v1': {
    schemaName: 'goal-contract-subcontract-evidence.schema.json',
    hashField: 'evidenceHash',
  },
  'goal-contract-subcontract-execution-lease/v1': {
    schemaName:
      'goal-contract-subcontract-execution-lease.schema.json',
    hashField: 'receiptHash',
  },
});

// Schema validation establishes the shape before these dynamic records are consumed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaRecord = Record<string, any>;

function failure(
  failureClass: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function isRecord(value: unknown): value is SchemaRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function canonicalBytes(value: unknown): string {
  return `${stableControlPlaneStringify(value)}\n`;
}

function normalizedAuthorityBasis(
  value: unknown,
  orderedSourceSnapshotSet: SchemaRecord
) {
  if (!isRecord(value)) {
    throw failure('execution_bundle_authority_basis_invalid');
  }
  if (
    value.kind !== 'direct_source_declaration' ||
    value.sourceDeclarationHash !== undefined
  ) {
    return value;
  }
  const primarySnapshot =
    orderedSourceSnapshotSet.sourceSnapshots.find(
      ({ sourceRole }) =>
        sourceRole === 'primary_implementation_authority'
    );
  if (!primarySnapshot) {
    throw failure('primary_source_missing');
  }
  return {
    ...value,
    sourceDeclarationHash: primarySnapshot.sourceSnapshotHash,
  };
}

function subordinateCoverageReceipts(
  bundle: SchemaRecord
): SchemaRecord[] {
  const coverage = bundle.subordinateCoverage;
  if (!coverage) return [];
  return Array.isArray(coverage.receipts)
    ? coverage.receipts
    : [coverage];
}

function schemaArtifactHashes() {
  return Object.freeze(
    Object.fromEntries(
      KERNEL_SCHEMA_NAMES.map((schemaName) => [
        schemaName,
        goalContractSchemaArtifactHash(schemaName),
      ])
    )
  );
}

function goalContractKernelSchemaArtifactHashes() {
  return schemaArtifactHashes();
}

function compileExecutionBundle(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('execution_bundle_request_invalid');
  }
  const forbiddenFields = [
    'sourceCompositionPolicy',
    'orderedSourceSnapshotSet',
    'compositeSourceAuthorityBundle',
    'intentAuthorityEnvelope',
    'canonicalIntentBundle',
    'goalContractBundle',
    'partitionBundle',
    'executionProjectionBundle',
    'campaignActivationReceipt',
  ].filter((field) => Object.hasOwn(request, field));
  if (forbiddenFields.length > 0) {
    throw failure('execution_bundle_authority_injection', {
      forbiddenFields,
    });
  }
  const sourceCompositionPolicy =
    compileSourceCompositionPolicy({
      authorityRecord: request.sourceCompositionAuthorityRecord,
    });
  const orderedSourceSnapshotSet =
    compileOrderedSourceSnapshotSet({
      sources: request.sources,
    });
  const compositeSourceAuthorityBundle =
    compileCompositeSourceAuthorityBundle({
      sourceCompositionPolicy,
      orderedSourceSnapshotSet,
      primarySource: request.primarySource,
      subordinateSources: request.subordinateSources,
    });
  const candidateCanonicalIntentBundle =
    compileCanonicalIntent({
      sourceCompositionPolicy,
      orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
      ...(request.projectionObligations === undefined
        ? {}
        : {
            projectionObligations:
              request.projectionObligations,
          }),
    });
  const authorityBasis = normalizedAuthorityBasis(
    request.authorityBasis,
    orderedSourceSnapshotSet
  );
  const intentAuthorityEnvelope =
    compileIntentAuthorityEnvelope({
      subject: {
        sourceSnapshotHash:
          orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
        canonicalIntentSemanticHash:
          candidateCanonicalIntentBundle.canonicalIntentSemanticHash,
        specSpanRegistryHash:
          candidateCanonicalIntentBundle.specSpanRegistry
            .specSpanRegistryHash,
        sourceCompositionPolicyHash:
          sourceCompositionPolicy.sourceCompositionPolicyHash,
        orderedSourceSnapshotSetHash:
          orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
        sourceAuthorityBundleHash:
          compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
      },
      authorityBasis,
      entryScenario: authorityBasis.entryScenario,
      compositeSourceAuthorityBundle,
    });
  const canonicalIntentBundle = compileCanonicalIntent({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    intentAuthorityEnvelope,
    authorityState: 'authoritative',
    ...(request.projectionObligations === undefined
      ? {}
      : {
          projectionObligations:
            request.projectionObligations,
        }),
  });
  const coverageReceipts = subordinateCoverageReceipts(
    compositeSourceAuthorityBundle
  );
  const compilePolicy = compileGoalContractPolicy(
    request.goalContractPolicyRequest
  );
  const compilerIdentity = goalContractCompilerIdentity();
  const goalContractBundle = compileGoalContract({
    sourceCompositionPolicy,
    compositeSourceAuthorityBundle,
    canonicalIntentBundle,
    subordinateCoverageReceipts: coverageReceipts,
    compilePolicy,
    compilerIdentity,
    contractProfileBytes: request.contractProfileBytes,
    templateBytes: request.templateBytes,
  });
  if (!isRecord(request.partitionRequest)) {
    throw failure('execution_bundle_partition_request_invalid');
  }
  const partitionBundle = compilePartitions({
    ...request.partitionRequest,
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    canonicalIntentBundle,
    goalContractBundle,
    subordinateCoverageReceipts:
      goalContractBundle.subordinateSourceCoverageReceipts,
  });
  const executionProjectionBundle =
    projectExecutionArtifacts({
      partitionPlan: partitionBundle.partitionPlan,
      renderChildContract: request.renderChildContract,
    });
  const schemaHashes = schemaArtifactHashes();
  return Object.freeze({
    schemaVersion:
      'goal-contract-execution-authority-bundle/v1',
    compilerStages: Object.freeze([
      'source_composition_policy',
      'ordered_source_snapshot_set',
      'composite_source_authority_bundle',
      'candidate_canonical_intent',
      'intent_authority',
      'authoritative_canonical_intent',
      'goal_contract',
      'partition_plan',
      'execution_projection',
    ]),
    sourceCompositionPolicy,
    sourceCompositionPolicyBytes: canonicalBytes(
      sourceCompositionPolicy
    ),
    orderedSourceSnapshotSet,
    orderedSourceSnapshotSetBytes: canonicalBytes(
      orderedSourceSnapshotSet
    ),
    compositeSourceAuthorityBundle,
    compositeSourceAuthorityBundleBytes: canonicalBytes(
      compositeSourceAuthorityBundle
    ),
    intentAuthorityEnvelope,
    intentAuthorityEnvelopeBytes: canonicalBytes(
      intentAuthorityEnvelope
    ),
    canonicalIntentBundle,
    canonicalIntentBundleBytes: canonicalBytes(
      canonicalIntentBundle
    ),
    specSpanRegistry: canonicalIntentBundle.specSpanRegistry,
    specSpanRegistryBytes: canonicalBytes(
      canonicalIntentBundle.specSpanRegistry
    ),
    subordinateCoverageReceipts:
      goalContractBundle.subordinateSourceCoverageReceipts,
    goalContractBundle,
    partitionBundle,
    executionProjectionBundle,
    schemaArtifactHashes: schemaHashes,
  });
}

function verifyControlPlaneReceipt(request: unknown = {}) {
  if (!isRecord(request) || !isRecord(request.receipt)) {
    throw failure('control_plane_receipt_verification_invalid');
  }
  const binding =
    RECEIPT_SCHEMAS[request.receipt.schemaVersion];
  if (!binding) {
    throw failure('control_plane_receipt_schema_unsupported', {
      schemaVersion: request.receipt.schemaVersion,
    });
  }
  validateGoalContractSchema(binding.schemaName, request.receipt);
  if (!verifyReceiptSelfHash(request.receipt, binding.hashField)) {
    throw failure('control_plane_receipt_hash_invalid');
  }
  return Object.freeze({
    schemaVersion: 'goal-contract-verified-control-plane-receipt/v1',
    receiptSchemaVersion: request.receipt.schemaVersion,
    receiptHash: request.receipt[binding.hashField],
    decision: 'pass',
  });
}

module.exports = {
  activateGoalCampaign,
  activateGoalCampaignFromSuccessorAuthority,
  closeGoalCampaign,
  closeSubcontract,
  commitGoalCampaignRepairAuthority,
  commitRequirementRecordPartitionAuthoritySupersession,
  compileCanonicalIntent,
  compileCompositeSourceAuthorityBundle,
  compileExecutionBundle,
  compileGoalCampaignRepairAuthority,
  compileGoalContract,
  compileIntentAuthorityEnvelope,
  compilePartitionClosureFeasibility,
  compilePartitionImpactAuthority,
  compilePartitionImpactDriftBaseline,
  compilePartitionImpactGraph,
  compilePartitions,
  compileSourceCompositionPolicy,
  compileSourceSnapshot,
  compileSpecSpanRegistry,
  compileSubcontractEvidence,
  activateStandalonePartitionGeneration,
  assertRawNonAuthoritativeContainmentRoot,
  assertImmutableAuthorityUnit,
  computePartitionGenerationKey,
  goalContractAuthorityWriterBinding,
  goalContractKernelSchemaArtifactHashes,
  issueSubcontractExecutionLease,
  loadPartitionImpactPolicy,
  preflightRequirementRecordPartitionAuthoritySupersession,
  projectExecutionArtifacts,
  resolveCanonicalPartitionOutputPaths,
  readRequirementRecordPartitionAuthorityProjection,
  recoverRequirementRecordPartitionAuthorityProjection,
  resolveSpecSpan,
  resolveSupervisorReadinessProjection,
  verifyGoalCampaignRepairAuthority,
  verifyPartitionClosureFeasibility,
  verifyPartitionImpactGraph,
  verifyControlPlaneReceipt,
  writeImmutableAuthorityFile,
};
