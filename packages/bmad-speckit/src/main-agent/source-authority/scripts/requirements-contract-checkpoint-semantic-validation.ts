import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_CHECKPOINT_IDS = [
  'cp-00-semantic-kernel',
  'cp-01-must-decomposition-packet',
  'cp-02-deterministic-atomic-closure',
  'cp-03-packet-to-source-materialization',
  'cp-04-id-freeze',
  'cp-05-implementation-confirmation-core',
  'cp-06-projections',
  'cp-07-human-readable-views',
  'cp-08-pre-render-global-reconciliation',
] as const;

export type RequirementsContractCheckpointId =
  (typeof REQUIREMENTS_CONTRACT_CHECKPOINT_IDS)[number];

export interface CheckpointValidatedInput {
  role: string;
  path: string;
  hash: string;
}

export interface CheckpointSemanticBlocker {
  code: string;
  message: string;
  refs: string[];
}

export interface RequirementsContractCheckpointSemanticValidationReceipt {
  schemaVersion: 'requirements-contract-checkpoint-semantic-validation-receipt/v1';
  checkpointId: RequirementsContractCheckpointId;
  validatorIdentity: string;
  validatorVersion: string;
  validatorHash: string;
  recordId: string;
  requirementSetId: string;
  implementationAttemptId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  semanticModelHash: string;
  semanticConservationManifestHash: string;
  persistenceStatus: 'committed' | 'failed';
  semanticValidationStatus: 'pass' | 'block' | 'stale';
  validatedInputs: CheckpointValidatedInput[];
  blockers: CheckpointSemanticBlocker[];
  decision: 'pass' | 'block' | 'stale';
  createdAt: string;
  receiptHash: string;
}

export interface CheckpointProgressStateInput {
  id: string;
  name: string;
  persistenceStatus: 'pending' | 'committed' | 'failed';
  semanticValidationStatus: 'pending' | 'pass' | 'block' | 'stale';
  receiptPath: string;
  receiptHash: string | null;
}

export interface DerivedCheckpointProgressState {
  checkpoints: Array<CheckpointProgressStateInput & { status: 'passed' | 'blocked' | 'stale' | 'pending' }>;
  completedCheckpointIds: string[];
  currentCheckpoint: string | null;
  lastCompletedCheckpoint: string | null;
  next: string | null;
}

export type CreateCheckpointSemanticValidationReceiptInput = Omit<
  RequirementsContractCheckpointSemanticValidationReceipt,
  'schemaVersion' | 'receiptHash'
>;

const SCHEMA_FILE =
  'requirements-contract-checkpoint-semantic-validation-receipt.schema.json';
let receiptValidator: ValidateFunction | null = null;

function schemaValidator(): ValidateFunction {
  if (receiptValidator) return receiptValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  receiptValidator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return receiptValidator;
}

function validationIssues(value: unknown): string[] {
  const validate = schemaValidator();
  if (validate(value)) return [];
  return (validate.errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`
  );
}

export function createCheckpointSemanticValidationReceipt(
  input: CreateCheckpointSemanticValidationReceiptInput
): RequirementsContractCheckpointSemanticValidationReceipt {
  const payload = {
    schemaVersion:
      'requirements-contract-checkpoint-semantic-validation-receipt/v1' as const,
    ...input,
  };
  const receipt = {
    ...payload,
    receiptHash: sha256Stable(payload),
  };
  const issues = validationIssues(receipt);
  if (issues.length > 0) {
    throw new Error(`Checkpoint semantic validation receipt is invalid: ${issues.join('; ')}`);
  }
  return receipt;
}

export function validateCheckpointSemanticValidationReceipt(
  value: unknown
): value is RequirementsContractCheckpointSemanticValidationReceipt {
  const issues = validationIssues(value);
  if (issues.length > 0 || !value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const receipt = value as RequirementsContractCheckpointSemanticValidationReceipt;
  const { receiptHash, ...payload } = receipt;
  return receiptHash === sha256Stable(payload);
}

export function deriveCheckpointProgressState(
  checkpointStates: CheckpointProgressStateInput[]
): DerivedCheckpointProgressState {
  const completedCheckpointIds: string[] = [];
  let progressionOpen = true;
  const checkpoints = checkpointStates.map((checkpoint) => {
    const checkpointPasses =
      checkpoint.persistenceStatus === 'committed' &&
      checkpoint.semanticValidationStatus === 'pass';
    const status: DerivedCheckpointProgressState['checkpoints'][number]['status'] =
      checkpointPasses && progressionOpen
        ? 'passed'
        : checkpoint.semanticValidationStatus === 'stale'
          ? 'stale'
          : checkpoint.semanticValidationStatus === 'block' ||
              checkpoint.persistenceStatus === 'failed'
            ? 'blocked'
            : 'pending';
    if (status === 'passed') {
      completedCheckpointIds.push(checkpoint.id);
    } else {
      progressionOpen = false;
    }
    return { ...checkpoint, status };
  });
  const currentCheckpoint =
    checkpoints.find((checkpoint) => checkpoint.status !== 'passed')?.id ?? null;
  return {
    checkpoints,
    completedCheckpointIds,
    currentCheckpoint,
    lastCompletedCheckpoint:
      completedCheckpointIds[completedCheckpointIds.length - 1] ?? null,
    next: currentCheckpoint,
  };
}
