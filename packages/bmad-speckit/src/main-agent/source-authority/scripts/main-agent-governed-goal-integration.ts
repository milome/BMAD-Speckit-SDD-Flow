import { createHash } from 'node:crypto';

export type MainAgentGovernedGoalIntegrationModule = never;

type UnknownRecord = Record<string, unknown>;
type DependencyFunction = (input: UnknownRecord) => unknown;

const REQUIRED_CAMPAIGN_DEPENDENCIES = Object.freeze([
  'compileExecutionPackage',
  'auditExecutionPackage',
  'invokeCampaign',
  'auditCompletedChild',
  'auditCompletedCampaign',
  'persistTaskReport',
]);

function failure(failureClass: string, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function hashControlPlaneValue(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)), 'utf8')
    .digest('hex')}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSha256Hash(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function requireHash(value: unknown, field: string): string {
  if (!isSha256Hash(value)) {
    throw failure('main_agent_goal_source_authority_mismatch', {
      field,
    });
  }
  return value;
}

function requireDependency(
  dependencies: Record<string, unknown>,
  name: string
): DependencyFunction {
  if (typeof dependencies[name] !== 'function') {
    throw failure('main_agent_goal_campaign_dependency_missing', {
      dependency: name,
    });
  }
  return dependencies[name] as DependencyFunction;
}

function sourceAuthorityInput(input: UnknownRecord): UnknownRecord {
  const authority = input.sourceAuthority ?? input.verifiedSourceAuthority ?? input.authority;
  if (!isRecord(authority)) {
    throw failure('main_agent_goal_source_authority_mismatch');
  }
  return authority;
}

function validateVerifiedBases(sourceAuthority: UnknownRecord): UnknownRecord[] {
  const bases = sourceAuthority.verifiedObligationBases;
  if (!Array.isArray(bases) || bases.length === 0 || !bases.every(isRecord)) {
    throw failure('main_agent_goal_source_root_inventory_mismatch');
  }
  const rootIds = bases.map((base) => base.sourceRootId);
  if (
    rootIds.some((value) => typeof value !== 'string' || value.length === 0) ||
    new Set(rootIds).size !== rootIds.length
  ) {
    throw failure('main_agent_goal_source_root_ambiguous');
  }
  return bases;
}

function buildSourceRootMappings(bases: UnknownRecord[], canonicalIntentBundle: UnknownRecord) {
  const records = Array.isArray(canonicalIntentBundle?.canonicalIntentIR)
    ? canonicalIntentBundle.canonicalIntentIR.filter(isRecord)
    : [];
  const byDeclaredId = new Map<string, UnknownRecord>(
    records
      .filter((record) => typeof record?.declaredSourceId === 'string')
      .map((record) => [record.declaredSourceId as string, record])
  );
  return bases
    .map((base) => {
      const sourceRootId = base.sourceRootId as string;
      const mappingId =
        typeof base.declaredSourceId === 'string' ? base.declaredSourceId : sourceRootId;
      const record = byDeclaredId.get(mappingId);
      const specSpanId =
        record && Array.isArray(record.specSpanRefs) ? record.specSpanRefs[0] : undefined;
      if (!record || typeof record.intentRecordId !== 'string' || typeof specSpanId !== 'string') {
        throw failure('main_agent_goal_model_packet_source_mapping_invalid', {
          sourceRootId,
        });
      }
      return {
        sourceRootId,
        intentRecordId: record.intentRecordId,
        specSpanId,
      };
    })
    .sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId, 'en'));
}

function bindingProjection(binding: UnknownRecord) {
  if (binding.status === 'absent') {
    if (Object.keys(binding).some((field) => field !== 'status')) {
      throw failure('main_agent_goal_source_authority_mismatch', {
        field: 'requirementRecordBinding',
      });
    }
    return {
      requirementRecordBinding: { status: 'absent' },
      downstreamAction: 'main_agent_resolve_requirement_record',
    };
  }
  if (binding.status !== 'present') {
    throw failure('main_agent_goal_source_authority_mismatch', {
      field: 'requirementRecordBinding.status',
    });
  }
  const result: Record<string, unknown> = { status: 'present' };
  for (const field of ['recordId', 'requirementSetId', 'recordPathHash']) {
    if (binding[field] !== undefined) result[field] = binding[field];
  }
  return { requirementRecordBinding: result };
}

function validatePresentBinding(binding: UnknownRecord) {
  const allowedFields = new Set([
    'status',
    'recordId',
    'requirementSetId',
    'recordPathHash',
  ]);
  if (
    Object.keys(binding).some((field) => !allowedFields.has(field)) ||
    typeof binding.recordId !== 'string' ||
    binding.recordId.length === 0 ||
    typeof binding.requirementSetId !== 'string' ||
    binding.requirementSetId.length === 0 ||
    typeof binding.recordPathHash !== 'string'
  ) {
    throw failure('main_agent_goal_source_authority_mismatch', {
      field: 'requirementRecordBinding',
    });
  }
  requireHash(binding.recordPathHash, 'requirementRecordBinding.recordPathHash');
}

export function compileMainAgentGoalSourceAuthority(input: UnknownRecord) {
  if (!isRecord(input)) {
    throw failure('main_agent_goal_source_authority_mismatch');
  }
  const binding = input.requirementRecordBinding;
  if (!isRecord(binding)) {
    throw failure('main_agent_goal_source_authority_mismatch', {
      field: 'requirementRecordBinding',
    });
  }
  if (binding.status === 'absent') {
    return Object.freeze({
      status: 'requirement_record_absent',
      ...bindingProjection(binding),
    });
  }
  validatePresentBinding(binding);
  const sourceAuthority = sourceAuthorityInput(input);
  const sourceAuthorityHash = requireHash(
    sourceAuthority.sourceAuthorityHash,
    'sourceAuthority.sourceAuthorityHash'
  );
  const sourceSnapshotHash = requireHash(
    sourceAuthority.sourceSnapshotHash,
    'sourceAuthority.sourceSnapshotHash'
  );
  const registeredAuthoritySnapshotHash = requireHash(
    sourceAuthority.registeredAuthoritySnapshotHash,
    'sourceAuthority.registeredAuthoritySnapshotHash'
  );
  if (typeof sourceAuthority.sourcePath !== 'string' || sourceAuthority.sourcePath.length === 0) {
    throw failure('main_agent_goal_source_authority_mismatch', {
      field: 'sourceAuthority.sourcePath',
    });
  }
  const bases = validateVerifiedBases(sourceAuthority);
  const modelPacket = input.modelPacket;
  if (!isRecord(modelPacket)) {
    throw failure('main_agent_goal_model_packet_source_mapping_invalid');
  }
  const dependencies = isRecord(input.dependencies) ? input.dependencies : {};
  const compileIntent = dependencies.compileCanonicalIntent;
  if (typeof compileIntent !== 'function') {
    throw failure('main_agent_goal_source_authority_dependency_missing', {
      dependency: 'compileCanonicalIntent',
    });
  }
  const compileCanonicalIntent = compileIntent as DependencyFunction;
  const projectImplementationView = requireDependency(dependencies, 'projectImplementationView');
  const projectAcceptanceEvidenceView = requireDependency(
    dependencies,
    'projectAcceptanceEvidenceView'
  );
  const validateImplementationView = requireDependency(dependencies, 'validateImplementationView');
  const validateAcceptanceEvidenceView = requireDependency(
    dependencies,
    'validateAcceptanceEvidenceView'
  );
  const reconcileGoalContractViews = requireDependency(dependencies, 'reconcileGoalContractViews');
  const compileGoalAuthority =
    dependencies.compileMainAgentGoalAuthority ?? dependencies.compileGoalAuthority;
  const partitionGoalAuthority = dependencies.partitionGoalAuthority ?? dependencies.partition;
  const certifyPartition = dependencies.certifyPartition ?? dependencies.certifyPartitionAuthority;
  if (typeof compileGoalAuthority !== 'function') {
    throw failure('main_agent_goal_source_authority_dependency_missing', {
      dependency: 'compileMainAgentGoalAuthority',
    });
  }
  if (typeof partitionGoalAuthority !== 'function') {
    throw failure('main_agent_goal_source_authority_dependency_missing', {
      dependency: 'partitionGoalAuthority',
    });
  }
  if (typeof certifyPartition !== 'function') {
    throw failure('main_agent_goal_source_authority_dependency_missing', {
      dependency: 'certifyPartition',
    });
  }

  const canonicalIntentBundle = compileCanonicalIntent({
    ...sourceAuthority,
    ...input,
    verifiedObligationBases: bases,
    sourceCompositionPolicy: sourceAuthority.sourceCompositionPolicy,
    orderedSourceSnapshotSet: sourceAuthority.orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle: sourceAuthority.compositeSourceAuthorityBundle,
    authorityState: 'authoritative',
  });
  if (!isRecord(canonicalIntentBundle)) {
    throw failure('main_agent_goal_source_authority_mismatch', {
      field: 'canonicalIntentBundle',
    });
  }
  const implementationView = projectImplementationView({
    modelPacket,
    canonicalIntentBundle,
    verifiedObligationBases: bases,
  });
  if (!isRecord(implementationView)) {
    throw failure('main_agent_goal_view_projection_invalid', {
      view: 'implementation',
    });
  }
  const acceptanceEvidenceView = projectAcceptanceEvidenceView({
    modelPacket,
    canonicalIntentBundle,
    verifiedObligationBases: bases,
  });
  if (!isRecord(acceptanceEvidenceView)) {
    throw failure('main_agent_goal_view_projection_invalid', {
      view: 'acceptanceEvidence',
    });
  }
  const implementationValidation = validateImplementationView(implementationView);
  if (!isRecord(implementationValidation) || implementationValidation.decision !== 'pass') {
    throw failure('main_agent_goal_view_projection_invalid', {
      view: 'implementation',
    });
  }
  const acceptanceValidation = validateAcceptanceEvidenceView(acceptanceEvidenceView);
  if (!isRecord(acceptanceValidation) || acceptanceValidation.decision !== 'pass') {
    throw failure('main_agent_goal_view_projection_invalid', {
      view: 'acceptanceEvidence',
    });
  }
  const reconciledViews = reconcileGoalContractViews({
    sourceSnapshot: sourceAuthority.sourceSnapshot,
    sourceObligationGraph: canonicalIntentBundle.sourceObligationGraph,
    sourceObligationGraphHash: canonicalIntentBundle.sourceObligationGraphHash,
    methodologyProfileHash: sourceAuthority.methodologyProfileHash,
    semanticModelHash: sourceAuthority.semanticModelHash,
    derivation: {
      mode: 'semantic_completion',
      implementation: { view: implementationView },
      acceptanceEvidence: { view: acceptanceEvidenceView },
    },
  });
  if (!isRecord(reconciledViews)) {
    throw failure('main_agent_goal_view_projection_invalid', {
      stage: 'view_reconciliation',
    });
  }
  const sourceRootToSpecSpanMappings = buildSourceRootMappings(bases, canonicalIntentBundle);
  const sourceAuthorityCompilationReceipt = {
    sourceAuthorityHash,
    sourceSnapshotHash,
    registeredAuthoritySnapshotHash,
    sourcePath: sourceAuthority.sourcePath,
    sourceRootToSpecSpanMappings,
    sourceRootToSpecSpanMappingHash: hashControlPlaneValue(sourceRootToSpecSpanMappings),
    canonicalIntentBundleHash: canonicalIntentBundle.canonicalIntentBundleHash,
    implementationViewHash: hashControlPlaneValue(implementationView),
    acceptanceEvidenceViewHash: hashControlPlaneValue(acceptanceEvidenceView),
    reconciledViewsHash: hashControlPlaneValue(reconciledViews),
  };
  const machineAuthority = compileGoalAuthority({
    profile: 'main_agent_compiled',
    ...bindingProjection(binding),
    sourceAuthorityCompilationReceipt,
    canonicalIntentBundle,
    implementationView,
    acceptanceEvidenceView,
    reconciledViews,
  });
  if (!isRecord(machineAuthority)) {
    throw failure('main_agent_goal_view_projection_invalid', {
      stage: 'goal_authority_compilation',
    });
  }
  const partition = partitionGoalAuthority({
    profile: 'main_agent_compiled',
    machineAuthority,
    implementationView,
    acceptanceEvidenceView,
  });
  if (!isRecord(partition)) {
    throw failure('main_agent_goal_view_projection_invalid', {
      stage: 'partition',
    });
  }
  const certification = certifyPartition({
    profile: 'main_agent_compiled',
    machineAuthority,
    partition,
    sourceAuthorityCompilationReceipt,
  });
  if (!isRecord(certification) || certification.status !== 'certified') {
    throw failure('main_agent_goal_view_projection_invalid', {
      stage: 'partition_certification',
    });
  }
  return Object.freeze({
    status: 'certified_partition_ready',
    ...bindingProjection(binding),
    sourceAuthorityCompilationReceipt,
    sourceRootToSpecSpanMappings,
    verifiedViews: Object.freeze({
      implementationView,
      acceptanceEvidenceView,
      reconciledViews,
    }),
    machineAuthority,
    partition,
    certification,
  });
}

function campaignStatus(childResults: UnknownRecord[]) {
  if (childResults.length === 0 || childResults.some((result) => result.status !== 'closed')) {
    return 'blocked';
  }
  return 'partial';
}

function closedChildSetMatches(
  children: UnknownRecord[],
  childResults: UnknownRecord[]
) {
  if (children.length === 0 || childResults.length !== children.length) {
    return false;
  }
  const expectedIds = children.map((child) => child.partitionId);
  const resultIds = childResults.map((result) => result.partitionId);
  if (
    expectedIds.some(
      (partitionId) =>
        typeof partitionId !== 'string' || partitionId.length === 0
    ) ||
    new Set(expectedIds).size !== expectedIds.length ||
    new Set(resultIds).size !== resultIds.length
  ) {
    return false;
  }
  return childResults.every(
    (result, index) =>
      result.status === 'closed' &&
      result.partitionId === expectedIds[index] &&
      isSha256Hash(result.commitHash)
  );
}

function requireTerminalPackageProvenance({
  packageResult,
  packageAudit,
  aggregateAudit,
  campaignResult,
}: {
  packageResult: unknown;
  packageAudit: unknown;
  aggregateAudit: unknown;
  campaignResult?: UnknownRecord;
}) {
  if (
    !isRecord(packageResult) ||
    !isRecord(packageAudit) ||
    !isRecord(aggregateAudit) ||
    !isSha256Hash(packageResult.packageManifestHash) ||
    !isSha256Hash(packageAudit.packageManifestHash) ||
    !isSha256Hash(aggregateAudit.packageManifestHash) ||
    packageAudit.packageManifestHash !==
      packageResult.packageManifestHash ||
    aggregateAudit.packageManifestHash !==
      packageResult.packageManifestHash ||
    (campaignResult !== undefined &&
      campaignResult.packageManifestHash !==
        packageResult.packageManifestHash)
  ) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }
  return packageResult.packageManifestHash;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function collectedStrings(
  campaignResult: UnknownRecord,
  field: string,
  childField: string
): string[] {
  const direct = stringArray(campaignResult[field]);
  const childResults = Array.isArray(campaignResult.childResults)
    ? campaignResult.childResults.filter(isRecord)
    : [];
  return [
    ...new Set([
      ...direct,
      ...childResults.flatMap((result) => stringArray(result[childField])),
    ]),
  ].sort();
}

function taskReportContext(campaignResult: UnknownRecord): string[] {
  const explicit = stringArray(campaignResult.downstreamContext);
  if (explicit.length > 0) return explicit;
  const context: string[] = [];
  if (isSha256Hash(campaignResult.campaignReportHash)) {
    context.push(`campaignReportHash=${campaignResult.campaignReportHash}`);
  }
  context.push(`packageManifestHash=${campaignResult.packageManifestHash}`);
  const binding = campaignResult.requirementRecordBinding;
  if (isRecord(binding) && binding.status === 'absent') {
    context.push('requirementRecordBinding=absent');
  } else if (isRecord(binding) && binding.status === 'present') {
    for (const field of ['recordId', 'requirementRecordRevision']) {
      if (binding[field] !== undefined) {
        context.push(`${field}=${String(binding[field])}`);
      }
    }
  }
  return context;
}

export function projectGovernedSkillCampaignTaskReport(input: UnknownRecord) {
  if (!isRecord(input) || !isRecord(input.campaignResult)) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }
  const campaignResult = input.campaignResult;
  const provenance = input.provenance;
  const packetId = input.packetId;
  if (
    typeof packetId !== 'string' ||
    packetId.length === 0 ||
    !isRecord(provenance) ||
    !isSha256Hash(provenance.packageManifestHash) ||
    !isSha256Hash(campaignResult.packageManifestHash) ||
    provenance.packageManifestHash !== campaignResult.packageManifestHash
  ) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }
  if (
    !Array.isArray(campaignResult.children) ||
    !campaignResult.children.every(isRecord) ||
    !Array.isArray(campaignResult.childResults) ||
    !campaignResult.childResults.every(isRecord)
  ) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }
  const children = campaignResult.children;
  const childResults = campaignResult.childResults;
  const aggregateAudit = isRecord(campaignResult.aggregateAudit)
    ? campaignResult.aggregateAudit
    : {};
  const aggregateClosed = ['pass', 'closed', 'done'].includes(
    typeof aggregateAudit.status === 'string' ? aggregateAudit.status : ''
  );
  const childSetClosed = closedChildSetMatches(
    children,
    childResults
  );
  const terminalCampaignHashValid =
    isSha256Hash(provenance.campaignReportHash) &&
    isSha256Hash(campaignResult.campaignReportHash) &&
    provenance.campaignReportHash === campaignResult.campaignReportHash;
  if (
    campaignResult.status === 'done' &&
    aggregateClosed &&
    (!childSetClosed || !terminalCampaignHashValid)
  ) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }
  if (campaignResult.status === 'done' && aggregateClosed) {
    requireTerminalPackageProvenance({
      packageResult: campaignResult.packageResult,
      packageAudit: campaignResult.packageAudit,
      aggregateAudit,
      campaignResult,
    });
  }
  const status =
    campaignResult.status === 'done' && aggregateClosed && childSetClosed
      ? 'done'
      : campaignStatus(childResults);
  const report: UnknownRecord = {
    packetId,
    status,
    filesChanged: collectedStrings(campaignResult, 'filesChanged', 'filesChanged'),
    validationsRun: collectedStrings(
      campaignResult,
      'validationsRun',
      'validationsRun'
    ),
    evidence: collectedStrings(campaignResult, 'evidence', 'evidence'),
    downstreamContext: taskReportContext(campaignResult),
  };
  const driftFlags = collectedStrings(campaignResult, 'driftFlags', 'driftFlags');
  if (status !== 'done' && driftFlags.length > 0) {
    report.driftFlags = driftFlags;
  }
  return Object.freeze(report);
}

export function runMainAgentGoalSubcontractCampaign(input: UnknownRecord) {
  if (
    !isRecord(input) ||
    !Array.isArray(input.children) ||
    input.children.length === 0 ||
    !input.children.every(isRecord)
  ) {
    throw failure('main_agent_goal_campaign_input_invalid');
  }
  const dependencies = isRecord(input.dependencies) ? input.dependencies : {};
  const resolved = Object.fromEntries(
    REQUIRED_CAMPAIGN_DEPENDENCIES.map((name) => [name, requireDependency(dependencies, name)])
  ) as Record<string, DependencyFunction>;
  const children = input.children;
  const childIds = children.map((child) => child.partitionId);
  if (
    childIds.some((id) => typeof id !== 'string' || id.length === 0) ||
    new Set(childIds).size !== childIds.length
  ) {
    throw failure('main_agent_goal_campaign_input_invalid');
  }
  const packageResultValue = resolved.compileExecutionPackage({
    ...input,
    children,
  });
  if (!isRecord(packageResultValue)) {
    throw failure('main_agent_goal_campaign_input_invalid', {
      stage: 'compile_execution_package',
    });
  }
  const packageResult = packageResultValue;
  const packageAuditValue = resolved.auditExecutionPackage({
    ...input,
    packageResult,
  });
  if (!isRecord(packageAuditValue)) {
    throw failure('main_agent_goal_campaign_input_invalid', {
      stage: 'audit_execution_package',
    });
  }
  const packageAudit = packageAuditValue;
  const requirementRecordBinding = isRecord(
    input.requirementRecordBinding
  )
    ? bindingProjection(
        input.requirementRecordBinding
      ).requirementRecordBinding
    : undefined;
  if (
    !['pass', 'closed', 'done'].includes(
      typeof packageAudit.status === 'string' ? packageAudit.status : ''
    )
  ) {
    const blockedResult = {
      status: 'blocked',
      children,
      childResults: [],
      packageResult,
      packageAudit,
      packageManifestHash: packageResult.packageManifestHash,
      requirementRecordBinding,
      driftFlags:
        typeof packageAudit.failureClass === 'string'
          ? [packageAudit.failureClass]
          : [],
      ...(requirementRecordBinding?.status === 'absent'
        ? { downstreamAction: 'main_agent_resolve_requirement_record' }
        : {}),
    };
    const taskReport = projectGovernedSkillCampaignTaskReport({
      packetId: input.packetId,
      campaignResult: blockedResult,
      provenance: {
        packageManifestHash: packageResult.packageManifestHash,
      },
    });
    resolved.persistTaskReport(taskReport);
    return Object.freeze({ ...blockedResult, taskReport });
  }
  if (
    !isSha256Hash(packageResult.packageManifestHash) ||
    !isSha256Hash(packageAudit.packageManifestHash) ||
    packageAudit.packageManifestHash !==
      packageResult.packageManifestHash
  ) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }

  const invocationValue = resolved.invokeCampaign({
    ...input,
    children,
    packageResult,
    packageAudit,
  });
  if (
    !isRecord(invocationValue) ||
    invocationValue.hostInvocationCount !== 1 ||
    !Array.isArray(invocationValue.childInvocations) ||
    invocationValue.childInvocations.length !== children.length ||
    !invocationValue.childInvocations.every(isRecord)
  ) {
    throw failure('main_agent_goal_campaign_input_invalid', {
      stage: 'invoke_campaign',
    });
  }
  const childInvocations = invocationValue.childInvocations as UnknownRecord[];
  if (
    childInvocations.some(
      (invocation, index) =>
        invocation.partitionId !== children[index].partitionId
    )
  ) {
    throw failure('main_agent_goal_campaign_input_invalid', {
      stage: 'invoke_campaign_child_order',
    });
  }

  const childResults: UnknownRecord[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const invocation = childInvocations[index];
    const auditValue = resolved.auditCompletedChild({
      child,
      invocation,
      packageResult,
      predecessorResults: childResults,
    });
    if (!isRecord(auditValue)) {
      throw failure('main_agent_goal_campaign_input_invalid', {
        stage: 'audit_completed_child',
        partitionId: child.partitionId,
      });
    }
    const audit = auditValue;
    childResults.push(audit);
    if (
      audit.status !== 'closed' ||
      audit.partitionId !== child.partitionId ||
      !isSha256Hash(audit.commitHash)
    ) {
      const blockedResult = {
        status: 'blocked',
        children,
        childResults,
        packageResult,
        packageAudit,
        packageManifestHash: packageResult.packageManifestHash,
        requirementRecordBinding,
        driftFlags:
          typeof audit.failureClass === 'string'
            ? [audit.failureClass]
            : [],
        ...(requirementRecordBinding?.status === 'absent'
          ? { downstreamAction: 'main_agent_resolve_requirement_record' }
          : {}),
      };
      const taskReport = projectGovernedSkillCampaignTaskReport({
        packetId: input.packetId,
        campaignResult: blockedResult,
        provenance: {
          packageManifestHash: packageResult.packageManifestHash,
        },
      });
      resolved.persistTaskReport(taskReport);
      return Object.freeze({ ...blockedResult, taskReport });
    }
  }

  const aggregateAuditValue = resolved.auditCompletedCampaign({
    ...input,
    children,
    childResults,
    packageResult,
    packageAudit,
  });
  if (!isRecord(aggregateAuditValue)) {
    throw failure('main_agent_goal_campaign_input_invalid', {
      stage: 'audit_completed_campaign',
    });
  }
  const aggregateAudit = aggregateAuditValue;
  const campaignReportHash = aggregateAudit.campaignReportHash;
  const aggregateClosed = ['pass', 'closed', 'done'].includes(
    typeof aggregateAudit.status === 'string'
      ? aggregateAudit.status
      : ''
  );
  const packageManifestHash = aggregateClosed
    ? requireTerminalPackageProvenance({
        packageResult,
        packageAudit,
        aggregateAudit,
      })
    : packageResult.packageManifestHash;
  if (
    aggregateClosed &&
    !isSha256Hash(campaignReportHash)
  ) {
    throw failure('main_agent_goal_task_report_provenance_mismatch');
  }
  const campaignResult = {
    status: aggregateClosed &&
      closedChildSetMatches(children, childResults)
      ? 'done'
      : campaignStatus(childResults),
    children,
    childResults,
    aggregateAudit,
    packageResult,
    packageAudit,
    packageManifestHash,
    campaignReportHash,
    requirementRecordBinding,
    ...(requirementRecordBinding?.status === 'absent'
      ? { downstreamAction: 'main_agent_resolve_requirement_record' }
      : {}),
  };
  const taskReport = projectGovernedSkillCampaignTaskReport({
    packetId: input.packetId,
    campaignResult,
    provenance: {
      packageManifestHash,
      ...(isSha256Hash(campaignReportHash) ? { campaignReportHash } : {}),
    },
  });
  resolved.persistTaskReport(taskReport);
  return Object.freeze({
    ...campaignResult,
    taskReport,
  });
}
