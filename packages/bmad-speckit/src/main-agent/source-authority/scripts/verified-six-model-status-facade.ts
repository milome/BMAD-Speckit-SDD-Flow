import authorityCore from './requirements-contract-runtime-status-authority-core.cjs';
import type {
  RequirementsContractSixModelId,
} from './requirements-contract-runtime-status-decision-receipt';

export interface RuntimeStatusDecisionReceiptRef {
  path: string;
  receipt: unknown;
}

export interface VerifiedSixModelStatus {
  schemaVersion: 'requirements-contract-verified-six-model-status/v1';
  recordId: string;
  requirementSetId: string;
  modelId: RequirementsContractSixModelId;
  effectiveStatus:
    | 'pass'
    | 'blocked'
    | 'stale'
    | 'not_established'
    | 'awaiting_user_acceptance';
  projectionStatus: string | null;
  projectionIntegrity: 'valid' | 'missing' | 'invalid' | 'mismatch' | 'stale';
  authorityClass: string | null;
  decisionReceiptRef: string | null;
  decisionReceiptHash: string | null;
  currentAttemptId: string;
  blockerRefs: string[];
  evidenceRefs: string[];
}

export function resolveVerifiedSixModelStatus(input: {
  record: Record<string, unknown> | null;
  modelId: RequirementsContractSixModelId;
  currentImplementationAttemptId: string;
  decisionReceipts?: RuntimeStatusDecisionReceiptRef[];
}): VerifiedSixModelStatus {
  return authorityCore.resolveVerifiedSixModelStatus(input);
}

export function resolveVerifiedSixModelPanorama(input: {
  record: Record<string, unknown> | null;
  currentImplementationAttemptId: string;
  decisionReceipts?: RuntimeStatusDecisionReceiptRef[];
}): VerifiedSixModelStatus[] {
  return authorityCore.resolveVerifiedSixModelPanorama(input);
}
