declare namespace authorityCore {
  type RequirementsContractSixModelId =
    | 'requirement_confirmation'
    | 'architecture_confirmation'
    | 'implementation_readiness'
    | 'execution_closure'
    | 'audit_review'
    | 'delivery_confirmation';

  type RuntimeStatusAuthorityClass =
    | 'controlled_confirmation'
    | 'deterministic_gate'
    | 'controlled_closeout';

  type RuntimeStatusDecision = 'pass' | 'block' | 'stale';

  type RuntimeStatusEffectiveStatus =
    | 'pass'
    | 'blocked'
    | 'stale'
    | 'not_established'
    | 'awaiting_user_acceptance';

  interface RuntimeStatusBinding {
    role: string;
    path: string;
    hash: string;
  }

  interface RequirementsContractRuntimeStatusDecisionReceipt {
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
    authorityClass: RuntimeStatusAuthorityClass;
    decision: RuntimeStatusDecision;
    effectiveStatus: RuntimeStatusEffectiveStatus;
    createdAt: string;
    receiptHash: string;
  }

  type CreateRuntimeStatusDecisionReceiptInput = Omit<
    RequirementsContractRuntimeStatusDecisionReceipt,
    'schemaVersion' | 'receiptHash'
  >;

  interface RuntimeStatusDecisionReceiptRef {
    path: string;
    receipt: unknown;
  }

  interface VerifiedSixModelStatus {
    schemaVersion: 'requirements-contract-verified-six-model-status/v1';
    recordId: string;
    requirementSetId: string;
    modelId: RequirementsContractSixModelId;
    effectiveStatus: RuntimeStatusEffectiveStatus;
    projectionStatus: string | null;
    projectionIntegrity: 'valid' | 'missing' | 'invalid' | 'mismatch' | 'stale';
    authorityClass: RuntimeStatusAuthorityClass | null;
    decisionReceiptRef: string | null;
    decisionReceiptHash: string | null;
    currentAttemptId: string;
    blockerRefs: string[];
    evidenceRefs: string[];
  }

  interface ResolveVerifiedSixModelStatusInput {
    record: Record<string, unknown> | null;
    modelId: RequirementsContractSixModelId;
    currentImplementationAttemptId: string;
    decisionReceipts?: RuntimeStatusDecisionReceiptRef[];
  }

  interface ResolveVerifiedSixModelPanoramaInput {
    record: Record<string, unknown> | null;
    currentImplementationAttemptId: string;
    decisionReceipts?: RuntimeStatusDecisionReceiptRef[];
  }
}

declare const authorityCore: {
  SIX_MODEL_IDS: readonly [
    'requirement_confirmation',
    'architecture_confirmation',
    'implementation_readiness',
    'execution_closure',
    'audit_review',
    'delivery_confirmation',
  ];
  createRuntimeStatusDecisionReceipt(
    input: authorityCore.CreateRuntimeStatusDecisionReceiptInput
  ): authorityCore.RequirementsContractRuntimeStatusDecisionReceipt;
  validateRuntimeStatusDecisionReceipt(
    value: unknown
  ): value is authorityCore.RequirementsContractRuntimeStatusDecisionReceipt;
  resolveVerifiedSixModelStatus(
    input: authorityCore.ResolveVerifiedSixModelStatusInput
  ): authorityCore.VerifiedSixModelStatus;
  resolveVerifiedSixModelPanorama(
    input: authorityCore.ResolveVerifiedSixModelPanoramaInput
  ): authorityCore.VerifiedSixModelStatus[];
  sha256Stable(value: unknown): string;
};

export = authorityCore;
