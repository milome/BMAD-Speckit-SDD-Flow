import { sha256Stable } from './requirements-contract-semantic-resolver';

const BINDING_FIELDS = [
  'requirementRefs',
  'scenarioRefs',
  'branchRefs',
  'targetRefs',
  'symbolRefs',
  'taskRefs',
  'redRefs',
  'oracleRefs',
  'commandRefs',
  'evidenceRefs',
  'proofRefs',
] as const;

export interface RequirementsContractSequenceStep {
  stepId: string;
  order: number;
  participantRef: string;
  critical: boolean;
  sideEffect: string;
  compensationForStepRef?: string;
}

export interface RequirementsContractSequenceStepBinding {
  stepId: string;
  requirementRefs: string[];
  scenarioRefs: string[];
  branchRefs: string[];
  targetRefs: string[];
  symbolRefs: string[];
  taskRefs: string[];
  redRefs: string[];
  oracleRefs: string[];
  commandRefs: string[];
  evidenceRefs: string[];
  proofRefs: string[];
}

export interface RequirementsContractSequenceTraceRow
  extends RequirementsContractSequenceStep,
    RequirementsContractSequenceStepBinding {
  rowHash: string;
}

export interface RequirementsContractSequenceTraceMatrix {
  schemaVersion: 'requirements-contract-sequence-trace-matrix/v1';
  requirementSetId: string;
  sequenceContractHash: string;
  semanticModelHash: string;
  rows: RequirementsContractSequenceTraceRow[];
  criticalStepCount: number;
  rowCount: number;
  matrixHash: string;
}

function bindingFingerprint(binding: RequirementsContractSequenceStepBinding): string {
  return sha256Stable(
    Object.fromEntries(BINDING_FIELDS.map((field) => [field, binding[field]]))
  );
}

export function createRequirementsContractSequenceTraceMatrix(input: {
  requirementSetId: string;
  sequenceContractHash: string;
  semanticModelHash: string;
  steps: RequirementsContractSequenceStep[];
  bindings: RequirementsContractSequenceStepBinding[];
}): RequirementsContractSequenceTraceMatrix {
  const stepIds = new Set<string>();
  const orders = new Set<number>();
  for (const step of input.steps) {
    if (stepIds.has(step.stepId)) throw new Error(`sequence_trace_duplicate_step:${step.stepId}`);
    if (orders.has(step.order)) throw new Error(`sequence_trace_duplicate_order:${step.order}`);
    if (step.order < 1) throw new Error(`sequence_trace_order_invalid:${step.stepId}`);
    stepIds.add(step.stepId);
    orders.add(step.order);
  }
  const bindingsByStep = new Map<string, RequirementsContractSequenceStepBinding>();
  for (const binding of input.bindings) {
    if (bindingsByStep.has(binding.stepId)) {
      throw new Error(`sequence_trace_duplicate_binding:${binding.stepId}`);
    }
    bindingsByStep.set(binding.stepId, binding);
  }

  const criticalFingerprints = new Map<string, string>();
  const rows = [...input.steps]
    .sort((left, right) => left.order - right.order)
    .map((step) => {
      const binding = bindingsByStep.get(step.stepId);
      if (!binding && step.critical) {
        throw new Error(`sequence_trace_binding_missing:${step.stepId}`);
      }
      const resolvedBinding =
        binding ??
        Object.fromEntries([
          ['stepId', step.stepId],
          ...BINDING_FIELDS.map((field) => [field, []]),
        ]) as unknown as RequirementsContractSequenceStepBinding;
      if (step.critical) {
        for (const field of BINDING_FIELDS) {
          if (resolvedBinding[field].length === 0) {
            throw new Error(`sequence_trace_required_ref_missing:${step.stepId}:${field}`);
          }
        }
        const fingerprint = bindingFingerprint(resolvedBinding);
        const owner = criticalFingerprints.get(fingerprint);
        if (owner) throw new Error(`sequence_trace_all_to_all_binding:${step.stepId}`);
        criticalFingerprints.set(fingerprint, step.stepId);
      }
      const preimage = { ...step, ...resolvedBinding };
      return { ...preimage, rowHash: sha256Stable(preimage) };
    });

  const preimage = {
    schemaVersion: 'requirements-contract-sequence-trace-matrix/v1' as const,
    requirementSetId: input.requirementSetId,
    sequenceContractHash: input.sequenceContractHash,
    semanticModelHash: input.semanticModelHash,
    rows,
    criticalStepCount: input.steps.filter((step) => step.critical).length,
    rowCount: rows.length,
  };
  return { ...preimage, matrixHash: sha256Stable(preimage) };
}

export function validateRequirementsContractSequenceOrdering(input: {
  matrix: RequirementsContractSequenceTraceMatrix;
  observedStepIds: string[];
  constraints: Array<{
    beforeStepId: string;
    afterStepId: string;
    maximumDelayMs: number;
    observedDelayMs: number;
  }>;
  sideEffectCounts: Record<string, number>;
  successObservedAfterStepId?: string;
}): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const constraint of input.constraints) {
    const beforeIndex = input.observedStepIds.indexOf(constraint.beforeStepId);
    const afterIndex = input.observedStepIds.indexOf(constraint.afterStepId);
    if (beforeIndex < 0 || afterIndex < 0 || beforeIndex >= afterIndex) {
      issues.push(
        `sequence_order_violation:${constraint.beforeStepId}:${constraint.afterStepId}`
      );
    }
    if (constraint.observedDelayMs > constraint.maximumDelayMs) {
      issues.push(
        `sequence_temporal_violation:${constraint.beforeStepId}:${constraint.afterStepId}`
      );
    }
  }
  for (const row of input.matrix.rows) {
    if (row.sideEffect !== 'none' && (input.sideEffectCounts[row.stepId] ?? 0) > 1) {
      issues.push(`sequence_duplicate_side_effect:${row.stepId}`);
    }
  }
  const finalCriticalStep = [...input.matrix.rows]
    .filter((row) => row.critical)
    .sort((left, right) => right.order - left.order)[0];
  if (
    input.successObservedAfterStepId &&
    input.successObservedAfterStepId !== finalCriticalStep?.stepId
  ) {
    issues.push(`sequence_early_success:${input.successObservedAfterStepId}`);
  }
  return { ok: issues.length === 0, issues };
}

export function validateRequirementsContractSequenceCompensation(input: {
  matrix: RequirementsContractSequenceTraceMatrix;
  failedStepId: string;
  observedStepIds: string[];
  compensationCounts: Record<string, number>;
  positiveAssertionStepIds: string[];
  duplicateAbsenceAssertionStepIds: string[];
}): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const failedIndex = input.observedStepIds.indexOf(input.failedStepId);
  const compensations = input.matrix.rows.filter(
    (row) => row.compensationForStepRef === input.failedStepId
  );
  if (compensations.length === 0) {
    issues.push(`sequence_compensation_missing:${input.failedStepId}`);
  }
  for (const compensation of compensations) {
    const compensationIndex = input.observedStepIds.indexOf(compensation.stepId);
    if (failedIndex < 0 || compensationIndex <= failedIndex) {
      issues.push(`sequence_compensation_order_violation:${compensation.stepId}`);
    }
    const count = input.compensationCounts[compensation.stepId] ?? 0;
    if (count === 0) issues.push(`sequence_compensation_missing:${compensation.stepId}`);
    if (count > 1) issues.push(`sequence_compensation_duplicate:${compensation.stepId}`);
    if (!input.positiveAssertionStepIds.includes(compensation.stepId)) {
      issues.push(`sequence_compensation_positive_assertion_missing:${compensation.stepId}`);
    }
    if (!input.duplicateAbsenceAssertionStepIds.includes(compensation.stepId)) {
      issues.push(`sequence_compensation_duplicate_assertion_missing:${compensation.stepId}`);
    }
  }
  return { ok: issues.length === 0, issues };
}
