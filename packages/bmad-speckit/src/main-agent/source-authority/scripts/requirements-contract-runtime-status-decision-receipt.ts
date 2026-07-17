import authorityCore from './requirements-contract-runtime-status-authority-core.cjs';

export const REQUIREMENTS_CONTRACT_SIX_MODEL_IDS =
  authorityCore.SIX_MODEL_IDS;

export type RequirementsContractSixModelId =
  (typeof REQUIREMENTS_CONTRACT_SIX_MODEL_IDS)[number];

export interface RuntimeStatusBinding {
  role: string;
  path: string;
  hash: string;
}

export interface RequirementsContractRuntimeStatusDecisionReceipt {
  schemaVersion: 'requirements-contract-runtime-status-decision-receipt/v1';
  recordId: string;
  requirementSetId: string;
  modelId: RequirementsContractSixModelId;
  implementationAttemptId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  semanticModelHash: string;
  stageInputs: RuntimeStatusBinding[];
  deterministicGateOutputs: RuntimeStatusBinding[];
  blockerRefs: string[];
  evidenceRefs: string[];
  authorityClass:
    | 'controlled_confirmation'
    | 'deterministic_gate'
    | 'controlled_closeout';
  decision: 'pass' | 'block' | 'stale';
  effectiveStatus:
    | 'pass'
    | 'blocked'
    | 'stale'
    | 'not_established'
    | 'awaiting_user_acceptance';
  createdAt: string;
  receiptHash: string;
}

export type CreateRuntimeStatusDecisionReceiptInput = Omit<
  RequirementsContractRuntimeStatusDecisionReceipt,
  'schemaVersion' | 'receiptHash'
>;

export interface CreateRuntimeStatusProjectionUpdateInput
  extends CreateRuntimeStatusDecisionReceiptInput {
  receiptPath: string;
  projection: Record<string, unknown>;
}

export interface RuntimeStatusProjectionUpdate {
  projection: Record<string, unknown>;
  receiptRef: {
    path: string;
    receipt: RequirementsContractRuntimeStatusDecisionReceipt;
  } | null;
  authorityEstablished: boolean;
  missingAuthorityBindings: string[];
}

export function createRuntimeStatusDecisionReceipt(
  input: CreateRuntimeStatusDecisionReceiptInput
): RequirementsContractRuntimeStatusDecisionReceipt {
  return authorityCore.createRuntimeStatusDecisionReceipt(input);
}

export function validateRuntimeStatusDecisionReceipt(
  value: unknown
): value is RequirementsContractRuntimeStatusDecisionReceipt {
  return authorityCore.validateRuntimeStatusDecisionReceipt(value);
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function validBindings(bindings: RuntimeStatusBinding[]): boolean {
  return (
    bindings.length > 0 &&
    bindings.every(
      (binding) =>
        binding.role.trim().length > 0 &&
        binding.path.trim().length > 0 &&
        isSha256(binding.hash)
    )
  );
}

export function createRuntimeStatusProjectionUpdate(
  input: CreateRuntimeStatusProjectionUpdateInput
): RuntimeStatusProjectionUpdate {
  const missingAuthorityBindings = [
    ...(!input.recordId.trim() ? ['recordId'] : []),
    ...(!input.requirementSetId.trim() ? ['requirementSetId'] : []),
    ...(!input.implementationAttemptId.trim() ? ['implementationAttemptId'] : []),
    ...(!isSha256(input.sourceDocumentHash) ? ['sourceDocumentHash'] : []),
    ...(!isSha256(input.implementationConfirmationHash)
      ? ['implementationConfirmationHash']
      : []),
    ...(!isSha256(input.semanticModelHash) ? ['semanticModelHash'] : []),
    ...(!validBindings(input.stageInputs) ? ['stageInputs'] : []),
    ...(!validBindings(input.deterministicGateOutputs)
      ? ['deterministicGateOutputs']
      : []),
    ...(!input.receiptPath.trim() ? ['receiptPath'] : []),
  ];
  if (missingAuthorityBindings.length > 0) {
    const blocker = `runtime_status_authority_context_missing:${missingAuthorityBindings.join(',')}`;
    const blockingReasons = Array.isArray(input.projection.blockingReasons)
      ? input.projection.blockingReasons.map(String)
      : [];
    return {
      projection: {
        ...input.projection,
        status:
          input.effectiveStatus === 'blocked' || input.effectiveStatus === 'stale'
            ? input.effectiveStatus
            : 'not_established',
        blockingReasons: [...new Set([...blockingReasons, blocker])],
      },
      receiptRef: null,
      authorityEstablished: false,
      missingAuthorityBindings,
    };
  }
  const binding = createRuntimeStatusProjectionBinding(input);
  return {
    ...binding,
    authorityEstablished: true,
    missingAuthorityBindings: [],
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function objectValues(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(objectValue).filter((item) => Object.keys(item).length) : [];
}

export function runtimeStatusProjectionRecordPatch(input: {
  record: Record<string, unknown>;
  modelId: RequirementsContractSixModelId;
  update: RuntimeStatusProjectionUpdate;
}): Record<string, unknown> {
  const receipts = objectValues(input.record.runtimeStatusDecisionReceipts);
  const artifacts = objectValues(input.record.artifactIndex);
  const nextReceipts = input.update.receiptRef
    ? [
        ...receipts.filter((entry) => entry.path !== input.update.receiptRef?.path),
        input.update.receiptRef,
      ]
    : receipts;
  const receipt = input.update.receiptRef?.receipt;
  const nextArtifacts = receipt
    ? [
        {
          artifactType: 'runtime_status_decision_receipt',
          sourceOfTruthRole: 'control',
          recordId: receipt.recordId,
          requirementSetId: receipt.requirementSetId,
          path: input.update.receiptRef!.path,
          contentHash: receipt.receiptHash,
          producer: 'requirements-contract-runtime-status-decision-receipt',
          purpose: `Canonical ${receipt.modelId} runtime-status decision Receipt.`,
          relatedRequirementIds: [receipt.recordId],
          status: 'active',
          inputVersion: receipt.schemaVersion,
          outputVersion: receipt.schemaVersion,
        },
        ...receipt.stageInputs.map((binding) => ({
          artifactType: 'runtime_status_stage_input',
          sourceOfTruthRole: 'evidence',
          recordId: receipt.recordId,
          requirementSetId: receipt.requirementSetId,
          path: binding.path,
          contentHash: binding.hash,
          producer: 'requirements-contract-runtime-status-decision-receipt',
          purpose: `Bound ${receipt.modelId} stage input: ${binding.role}.`,
          relatedRequirementIds: [receipt.recordId],
          status: 'active',
          inputVersion: receipt.schemaVersion,
          outputVersion: 'requirements-contract-runtime-status-binding/v1',
        })),
        ...receipt.deterministicGateOutputs.map((binding) => ({
          artifactType: 'runtime_status_deterministic_gate_output',
          sourceOfTruthRole: 'evidence',
          recordId: receipt.recordId,
          requirementSetId: receipt.requirementSetId,
          path: binding.path,
          contentHash: binding.hash,
          producer: 'requirements-contract-runtime-status-decision-receipt',
          purpose: `Bound ${receipt.modelId} deterministic Gate output: ${binding.role}.`,
          relatedRequirementIds: [receipt.recordId],
          status: 'active',
          inputVersion: receipt.schemaVersion,
          outputVersion: 'requirements-contract-runtime-status-binding/v1',
        })),
      ]
    : [];
  const nextArtifactPaths = new Set(nextArtifacts.map((entry) => entry.path));
  return {
    sixModelResults: {
      ...objectValue(input.record.sixModelResults),
      [input.modelId]: input.update.projection,
    },
    runtimeStatusDecisionReceipts: nextReceipts,
    ...(receipt
      ? {
          artifactIndex: [
            ...artifacts.filter((entry) => !nextArtifactPaths.has(String(entry.path ?? ''))),
            ...nextArtifacts,
          ],
        }
      : {}),
    ...(input.update.authorityEstablished
      ? { currentAttemptId: input.update.projection.currentAttemptId }
      : {}),
  };
}

export function createRuntimeStatusProjectionBinding(input: {
  recordId: string;
  requirementSetId: string;
  modelId: RequirementsContractSixModelId;
  implementationAttemptId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  semanticModelHash: string;
  stageInputs: RuntimeStatusBinding[];
  deterministicGateOutputs: RuntimeStatusBinding[];
  blockerRefs: string[];
  evidenceRefs: string[];
  authorityClass:
    | 'controlled_confirmation'
    | 'deterministic_gate'
    | 'controlled_closeout';
  decision: 'pass' | 'block' | 'stale';
  effectiveStatus:
    | 'pass'
    | 'blocked'
    | 'stale'
    | 'not_established'
    | 'awaiting_user_acceptance';
  createdAt: string;
  receiptPath: string;
  projection: Record<string, unknown>;
}): {
  projection: Record<string, unknown>;
  receiptRef: {
    path: string;
    receipt: RequirementsContractRuntimeStatusDecisionReceipt;
  };
} {
  const receipt = createRuntimeStatusDecisionReceipt({
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    modelId: input.modelId,
    implementationAttemptId: input.implementationAttemptId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    semanticModelHash: input.semanticModelHash,
    stageInputs: input.stageInputs,
    deterministicGateOutputs: input.deterministicGateOutputs,
    blockerRefs: input.blockerRefs,
    evidenceRefs: input.evidenceRefs,
    authorityClass: input.authorityClass,
    decision: input.decision,
    effectiveStatus: input.effectiveStatus,
    createdAt: input.createdAt,
  });
  return {
    projection: {
      ...input.projection,
      status: input.effectiveStatus,
      currentAttemptId: input.implementationAttemptId,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      semanticModelHash: input.semanticModelHash,
      decisionReceiptRef: input.receiptPath,
      decisionReceiptHash: receipt.receiptHash,
    },
    receiptRef: {
      path: input.receiptPath,
      receipt,
    },
  };
}
