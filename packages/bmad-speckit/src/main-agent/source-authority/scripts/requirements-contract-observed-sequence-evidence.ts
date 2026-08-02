import {
  type RequirementsContractSequenceContract,
  validateSequenceContract,
} from './requirements-contract-sequence-model';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export type ObservedSequenceEvidenceOriginKind =
  | 'test_assertion'
  | 'contract_adapter'
  | 'database_state'
  | 'event_capture'
  | 'api_observation'
  | 'detached_rerun'
  | 'tracing_span';

export interface ObservedSequenceEvidenceOrigin {
  kind: ObservedSequenceEvidenceOriginKind;
  ref: string;
  hash: string;
  allowlisted?: boolean;
}

export interface ObservedSequenceObservation {
  stepRef: string;
  branchRefs: string[];
  oracleRefs: string[];
  origin: ObservedSequenceEvidenceOrigin;
  observedAt: string;
}

export interface ObservedSequenceViolations {
  ordering: string[];
  temporal: string[];
  sideEffect: string[];
  compensation: string[];
}

export interface ObservedSequenceReceipt {
  schemaVersion: 'requirements-contract-observed-sequence-receipt/v1';
  receiptId: string;
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
  sequenceContractHash: string;
  observations: ObservedSequenceObservation[];
  observedStepRefs: string[];
  missingStepRefs: string[];
  observedBranchRefs: string[];
  missingBranchRefs: string[];
  observedOracleRefs: string[];
  missingOracleRefs: string[];
  unexpectedStepRefs: string[];
  violations: ObservedSequenceViolations;
  decision: 'pass' | 'block';
  createdAt: string;
  receiptHash: string;
}

export interface CreateObservedSequenceReceiptInput {
  receiptId: string;
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
  sequenceContract: RequirementsContractSequenceContract;
  observations: ObservedSequenceObservation[];
  violations: ObservedSequenceViolations;
  createdAt: string;
}

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TRUSTED_ORIGINS = new Set<ObservedSequenceEvidenceOriginKind>([
  'test_assertion',
  'contract_adapter',
  'database_state',
  'event_capture',
  'api_observation',
  'detached_rerun',
  'tracing_span',
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function validStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(nonEmpty) &&
    new Set(value).size === value.length
  );
}

function expectedUniverse(contract: RequirementsContractSequenceContract) {
  const stepRefs: string[] = [];
  const branchRefs: string[] = [];
  const oracleRefs: string[] = [];
  for (const scenario of contract.sequenceScenarios) {
    for (const step of scenario.steps) {
      stepRefs.push(`${scenario.id}#${step.id}`);
      oracleRefs.push(step.verificationBindings.oracleRef);
    }
    for (const branch of scenario.branches) {
      branchRefs.push(`${scenario.id}#${branch.id}`);
      oracleRefs.push(branch.verificationBindings.oracleRef);
    }
    for (const constraint of scenario.orderingConstraints) {
      oracleRefs.push(constraint.oracleRef, constraint.verificationBindings.oracleRef);
    }
    for (const constraint of scenario.temporalConstraints) {
      oracleRefs.push(constraint.oracleRef, constraint.verificationBindings.oracleRef);
    }
    for (const transition of scenario.stateTransitions) {
      oracleRefs.push(transition.verificationBindings.oracleRef);
    }
  }
  return {
    stepRefs: uniqueSorted(stepRefs),
    branchRefs: uniqueSorted(branchRefs),
    oracleRefs: uniqueSorted(oracleRefs),
  };
}

function validOrigin(origin: unknown): origin is ObservedSequenceEvidenceOrigin {
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) return false;
  const value = origin as ObservedSequenceEvidenceOrigin;
  if (
    !TRUSTED_ORIGINS.has(value.kind) ||
    !nonEmpty(value.ref) ||
    !HASH.test(value.hash)
  ) {
    return false;
  }
  return value.kind !== 'tracing_span' || value.allowlisted === true;
}

function validObservation(value: unknown): value is ObservedSequenceObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const observation = value as ObservedSequenceObservation;
  return (
    nonEmpty(observation.stepRef) &&
    validStringArray(observation.branchRefs) &&
    validStringArray(observation.oracleRefs) &&
    validOrigin(observation.origin) &&
    nonEmpty(observation.observedAt) &&
    !Number.isNaN(Date.parse(observation.observedAt))
  );
}

function validViolations(value: unknown): value is ObservedSequenceViolations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const violations = value as ObservedSequenceViolations;
  return (
    validStringArray(violations.ordering) &&
    validStringArray(violations.temporal) &&
    validStringArray(violations.sideEffect) &&
    validStringArray(violations.compensation)
  );
}

export function validateObservedSequenceReceipt(
  value: unknown
): value is ObservedSequenceReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as ObservedSequenceReceipt;
  if (
    receipt.schemaVersion !== 'requirements-contract-observed-sequence-receipt/v1' ||
    !nonEmpty(receipt.receiptId) ||
    !nonEmpty(receipt.requirementSetId) ||
    !nonEmpty(receipt.transactionId) ||
    !nonEmpty(receipt.implementationAttemptId) ||
    !HASH.test(receipt.sequenceContractHash) ||
    !Array.isArray(receipt.observations) ||
    !receipt.observations.every(validObservation) ||
    !validStringArray(receipt.observedStepRefs) ||
    !validStringArray(receipt.missingStepRefs) ||
    !validStringArray(receipt.observedBranchRefs) ||
    !validStringArray(receipt.missingBranchRefs) ||
    !validStringArray(receipt.observedOracleRefs) ||
    !validStringArray(receipt.missingOracleRefs) ||
    !validStringArray(receipt.unexpectedStepRefs) ||
    !validViolations(receipt.violations) ||
    !['pass', 'block'].includes(receipt.decision) ||
    !nonEmpty(receipt.createdAt) ||
    Number.isNaN(Date.parse(receipt.createdAt)) ||
    !HASH.test(receipt.receiptHash)
  ) {
    return false;
  }
  const violationCount = Object.values(receipt.violations).reduce(
    (total, items) => total + items.length,
    0
  );
  const shouldPass =
    receipt.missingStepRefs.length === 0 &&
    receipt.missingBranchRefs.length === 0 &&
    receipt.missingOracleRefs.length === 0 &&
    receipt.unexpectedStepRefs.length === 0 &&
    violationCount === 0;
  if (receipt.decision !== (shouldPass ? 'pass' : 'block')) return false;
  const { receiptHash, ...payload } = receipt;
  return receiptHash === sha256Stable(payload);
}

export function createObservedSequenceReceipt(
  input: CreateObservedSequenceReceiptInput
): ObservedSequenceReceipt {
  const validation = validateSequenceContract(input.sequenceContract);
  if (!validation.ok) {
    throw new Error('observed_sequence_contract_invalid');
  }
  if (!input.observations.every(validObservation)) {
    throw new Error('observed_sequence_observation_invalid');
  }
  if (!validViolations(input.violations)) {
    throw new Error('observed_sequence_violations_invalid');
  }
  const expected = expectedUniverse(input.sequenceContract);
  const expectedSteps = new Set(expected.stepRefs);
  const expectedBranches = new Set(expected.branchRefs);
  const expectedOracles = new Set(expected.oracleRefs);
  const observedStepRefs = uniqueSorted(
    input.observations
      .map((observation) => observation.stepRef)
      .filter((ref) => expectedSteps.has(ref))
  );
  const unexpectedStepRefs = uniqueSorted(
    input.observations
      .map((observation) => observation.stepRef)
      .filter((ref) => !expectedSteps.has(ref))
  );
  const observedBranchRefs = uniqueSorted(
    input.observations
      .flatMap((observation) => observation.branchRefs)
      .filter((ref) => expectedBranches.has(ref))
  );
  const observedOracleRefs = uniqueSorted(
    input.observations
      .flatMap((observation) => observation.oracleRefs)
      .filter((ref) => expectedOracles.has(ref))
  );
  const missingStepRefs = expected.stepRefs.filter(
    (ref) => !observedStepRefs.includes(ref)
  );
  const missingBranchRefs = expected.branchRefs.filter(
    (ref) => !observedBranchRefs.includes(ref)
  );
  const missingOracleRefs = expected.oracleRefs.filter(
    (ref) => !observedOracleRefs.includes(ref)
  );
  const violationCount = Object.values(input.violations).reduce(
    (total, items) => total + items.length,
    0
  );
  const decision =
    missingStepRefs.length === 0 &&
    missingBranchRefs.length === 0 &&
    missingOracleRefs.length === 0 &&
    unexpectedStepRefs.length === 0 &&
    violationCount === 0
      ? 'pass'
      : 'block';
  const payload = {
    schemaVersion: 'requirements-contract-observed-sequence-receipt/v1' as const,
    receiptId: input.receiptId,
    requirementSetId: input.requirementSetId,
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    sequenceContractHash: input.sequenceContract.sequenceContractHash,
    observations: input.observations,
    observedStepRefs,
    missingStepRefs,
    observedBranchRefs,
    missingBranchRefs,
    observedOracleRefs,
    missingOracleRefs,
    unexpectedStepRefs,
    violations: input.violations,
    decision,
    createdAt: input.createdAt,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  if (!validateObservedSequenceReceipt(receipt)) {
    throw new Error('observed_sequence_receipt_invalid');
  }
  return receipt;
}
