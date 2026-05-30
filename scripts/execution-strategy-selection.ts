import * as crypto from 'node:crypto';
import type {
  CompiledPromptRef,
  ExecutionStrategyAvailability,
  ExecutionStrategyId,
  ExecutionStrategyOption,
  ExecutionStrategySelection,
} from './orchestration-dispatch-contract';
import {
  appendControlEventAndReplay,
  type ControlCommitResult,
} from './requirement-record-control-store';

export interface ExecutionStrategyOptionsResult {
  status: 'pass' | 'blocked';
  strategyOptionsHash: string;
  modelPacketHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  options: ExecutionStrategyOption[];
  blockingReasons: string[];
}

export interface ExecutionStrategySelectionEvent extends ExecutionStrategySelection {
  recordId: string;
  requirementSetId: string;
  sourceRefs: Array<{ sourceType: string; id: string }>;
  recordedAt: string;
  recordedBy: string;
}

export const EXECUTION_STRATEGY_SELECTION_EVENT_TYPE = 'execution_strategy_selected' as const;
export const EXECUTION_STRATEGY_SELECTION_WRITER_ID = 'main-agent-execution-strategy-selection';

export const EXECUTION_STRATEGY_SELECTION_GOVERNANCE_EVENT_REGISTRY_ENTRY = {
  eventType: EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
  payloadKind: 'strategy_selection',
  writesControlFields: ['executionStrategySelections'],
  canAffectControlFlow: true,
  payloadContract: {
    requiredFields: [
      'eventType',
      'recordId',
      'requirementSetId',
      'strategyId',
      'availability',
      'selectedBy',
      'strategyOptionsHash',
      'selectedOptionHash',
      'modelPacketHash',
      'sourceDocumentHash',
      'implementationConfirmationHash',
      'sourceRefs',
      'recordedAt',
      'recordedBy',
    ],
    forbiddenFields: ['traceRows', 'requiredCommands', 'requirementScopeDecision', 'recordClosed'],
    requiredSourceRefs: true,
    allowedControlWriteMode: 'control',
  },
};

export const EXECUTION_STRATEGY_SELECTION_WRITER_REGISTRY_ENTRY = {
  writerId: EXECUTION_STRATEGY_SELECTION_WRITER_ID,
  eventType: EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
  writesControlFields: ['executionStrategySelections'],
  writeMode: 'append_only_control_event',
  directRequirementRecordWrite: false,
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

export function sha256Stable(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strategyOption(input: {
  strategyId: ExecutionStrategyId;
  availability: ExecutionStrategyAvailability;
  blockingReasons: string[];
  modelPacketHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): ExecutionStrategyOption {
  const hashInput = {
    strategyId: input.strategyId,
    availability: input.availability,
    blockingReasons: input.blockingReasons,
    modelPacketHash: input.modelPacketHash,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
  };
  return {
    strategyId: input.strategyId,
    availability: input.availability,
    blockingReasons: input.blockingReasons,
    optionHash: sha256Stable(hashInput),
  };
}

export function buildExecutionStrategyOptions(input: {
  compiledPromptRef?: CompiledPromptRef | null;
  modelPacketGateDecision?: 'pass' | 'blocked' | 'fail' | null;
}): ExecutionStrategyOptionsResult {
  const ref = input.compiledPromptRef ?? null;
  const blockingReasons: string[] = [];
  if (!ref) blockingReasons.push('model_packet_ref_missing');
  if (input.modelPacketGateDecision !== 'pass') blockingReasons.push('model_packet_gate_not_pass');
  const modelPacketHash = text(ref?.modelPacketHash);
  const sourceDocumentHash = text(ref?.sourceDocumentHash);
  const implementationConfirmationHash = text(ref?.implementationConfirmationHash);
  if (!SHA256_PATTERN.test(modelPacketHash))
    blockingReasons.push('model_packet_hash_missing_or_invalid');
  if (!SHA256_PATTERN.test(sourceDocumentHash))
    blockingReasons.push('source_document_hash_missing_or_invalid');
  if (!SHA256_PATTERN.test(implementationConfirmationHash)) {
    blockingReasons.push('implementation_confirmation_hash_missing_or_invalid');
  }
  if (blockingReasons.length > 0) {
    return {
      status: 'blocked',
      strategyOptionsHash: sha256Stable({ blockingReasons }),
      modelPacketHash,
      sourceDocumentHash,
      implementationConfirmationHash,
      options: [],
      blockingReasons,
    };
  }

  const common = { modelPacketHash, sourceDocumentHash, implementationConfirmationHash };
  const options: ExecutionStrategyOption[] = [
    strategyOption({
      strategyId: 'compiled_trace_direct',
      availability: 'available',
      blockingReasons: [],
      ...common,
    }),
    strategyOption({
      strategyId: 'compiled_trace_with_sdd_artifacts',
      availability: 'blocked_until_artifact_realization_lane',
      blockingReasons: ['blocked_until_artifact_realization_lane'],
      ...common,
    }),
    strategyOption({
      strategyId: 'governed_skill_adapter',
      availability: 'blocked_until_adapter_certification_gate',
      blockingReasons: ['blocked_until_adapter_certification_gate'],
      ...common,
    }),
    strategyOption({
      strategyId: 'governed_skill_prompt',
      availability: 'blocked_until_prompt_equivalence_gate',
      blockingReasons: ['blocked_until_prompt_equivalence_gate'],
      ...common,
    }),
  ];
  return {
    status: 'pass',
    strategyOptionsHash: sha256Stable({
      modelPacketHash,
      sourceDocumentHash,
      implementationConfirmationHash,
      options,
    }),
    modelPacketHash,
    sourceDocumentHash,
    implementationConfirmationHash,
    options,
    blockingReasons: [],
  };
}

export function exactExecutionStrategySelectionPhrase(input: {
  strategyId: ExecutionStrategyId;
  strategyOptionsHash: string;
  modelPacketHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): string {
  return [
    `确认执行策略=${input.strategyId}`,
    `strategyOptionsHash=${input.strategyOptionsHash}`,
    `modelPacketHash=${input.modelPacketHash}`,
    `sourceDocumentHash=${input.sourceDocumentHash}`,
    `implementationConfirmationHash=${input.implementationConfirmationHash}`,
  ].join('\n');
}

export function selectExecutionStrategy(input: {
  optionsResult: ExecutionStrategyOptionsResult;
  strategyId: ExecutionStrategyId;
  selectedBy: 'user' | 'policy';
  exactPhrase?: string | null;
  policyDefaultAllowed?: boolean;
}): ExecutionStrategySelection {
  if (input.optionsResult.status !== 'pass') {
    throw new Error(
      `strategy options are not available: ${input.optionsResult.blockingReasons.join(',')}`
    );
  }
  const option = input.optionsResult.options.find((item) => item.strategyId === input.strategyId);
  if (!option) throw new Error(`unknown execution strategy: ${input.strategyId}`);
  if (option.availability !== 'available') {
    throw new Error(
      `execution strategy is not available: ${input.strategyId}:${option.availability}`
    );
  }
  if (input.selectedBy === 'user') {
    const expected = exactExecutionStrategySelectionPhrase({
      strategyId: input.strategyId,
      strategyOptionsHash: input.optionsResult.strategyOptionsHash,
      modelPacketHash: input.optionsResult.modelPacketHash,
      sourceDocumentHash: input.optionsResult.sourceDocumentHash,
      implementationConfirmationHash: input.optionsResult.implementationConfirmationHash,
    });
    if (input.exactPhrase !== expected) {
      throw new Error('execution strategy exact phrase mismatch');
    }
  }
  if (input.selectedBy === 'policy' && input.policyDefaultAllowed !== true) {
    throw new Error('policy default execution strategy selection is not allowed');
  }
  return {
    eventType: EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
    strategyId: option.strategyId,
    availability: 'available',
    selectedBy: input.selectedBy,
    strategyOptionsHash: input.optionsResult.strategyOptionsHash,
    selectedOptionHash: option.optionHash,
    modelPacketHash: input.optionsResult.modelPacketHash,
    sourceDocumentHash: input.optionsResult.sourceDocumentHash,
    implementationConfirmationHash: input.optionsResult.implementationConfirmationHash,
  };
}

export function validateExecutionStrategySelectionEvent(
  event: Partial<ExecutionStrategySelectionEvent>
): string[] {
  const issues: string[] = [];
  if (event.eventType !== EXECUTION_STRATEGY_SELECTION_EVENT_TYPE)
    issues.push('event_type_invalid');
  if (!text(event.recordId)) issues.push('record_id_missing');
  if (!text(event.requirementSetId)) issues.push('requirement_set_id_missing');
  if (!text(event.strategyId)) issues.push('strategy_id_missing');
  if (event.availability !== 'available') issues.push('strategy_availability_not_available');
  if (event.selectedBy !== 'user' && event.selectedBy !== 'policy')
    issues.push('selected_by_invalid');
  for (const field of [
    'strategyOptionsHash',
    'selectedOptionHash',
    'modelPacketHash',
    'sourceDocumentHash',
    'implementationConfirmationHash',
  ] as const) {
    if (!SHA256_PATTERN.test(text(event[field]))) issues.push(`${field}_missing_or_invalid`);
  }
  if (!Array.isArray(event.sourceRefs) || event.sourceRefs.length === 0)
    issues.push('source_refs_missing');
  if (!text(event.recordedAt)) issues.push('recorded_at_missing');
  if (!text(event.recordedBy)) issues.push('recorded_by_missing');
  return issues;
}

export function toExecutionStrategySelectionEvent(input: {
  recordId: string;
  requirementSetId: string;
  selection: ExecutionStrategySelection;
  sourceRefs: Array<{ sourceType: string; id: string }>;
  recordedAt: string;
  recordedBy: string;
}): ExecutionStrategySelectionEvent {
  return {
    ...input.selection,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourceRefs: input.sourceRefs,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
  };
}

export function appendExecutionStrategySelection(input: {
  recordPath: string;
  event: ExecutionStrategySelectionEvent;
  writerId?: string;
}): ControlCommitResult {
  const issues = validateExecutionStrategySelectionEvent(input.event);
  if (issues.length > 0) {
    throw new Error(`invalid execution_strategy_selected event: ${issues.join(',')}`);
  }
  return appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: input.writerId ?? EXECUTION_STRATEGY_SELECTION_WRITER_ID,
    eventType: EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
    payload: input.event as unknown as Record<string, unknown>,
    recordedAt: input.event.recordedAt,
    reduce: (record) => ({
      ...record,
      executionStrategySelections: [
        ...((Array.isArray(record.executionStrategySelections)
          ? record.executionStrategySelections
          : []) as unknown[]),
        input.event,
      ],
      lastEventType: EXECUTION_STRATEGY_SELECTION_EVENT_TYPE,
      updatedAt: input.event.recordedAt,
    }),
  });
}

export function appendBlockedExecutionStrategyAttempt(input: {
  recordPath: string;
  recordId: string;
  requirementSetId: string;
  strategyId: ExecutionStrategyId;
  blockingReasons: string[];
  sourceRefs: Array<{ sourceType: string; id: string }>;
  recordedAt: string;
  recordedBy: string;
  writerId?: string;
}): ControlCommitResult {
  const check = {
    eventType: 'contract_check_recorded',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    checkId: `execution-strategy-selection:${input.strategyId}`,
    contract: 'execution_strategy_selection',
    decision: 'blocked',
    sourceRefs: input.sourceRefs,
    blockingReasons: input.blockingReasons,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
  };
  return appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: input.writerId ?? EXECUTION_STRATEGY_SELECTION_WRITER_ID,
    eventType: 'contract_check_recorded',
    payload: check,
    recordedAt: input.recordedAt,
    reduce: (record) => ({
      ...record,
      contractChecks: [
        ...((Array.isArray(record.contractChecks) ? record.contractChecks : []) as unknown[]),
        check,
      ],
      lastEventType: 'contract_check_recorded',
      updatedAt: input.recordedAt,
    }),
  });
}
