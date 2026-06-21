import type { DimensionMode } from '../parsers/dimension-parser';

export type ScoringDimensionContractStatus = 'resolved' | 'blocked' | 'ambiguous';

export interface ScoringDimensionContractResolution {
  status: ScoringDimensionContractStatus;
  dimensionMode: DimensionMode | null;
  dimensionContractId: string | null;
  expectedDimensions: string[];
  atomicItemSetId: string | null;
  blockingReasons: string[];
}

export interface ResolveScoringDimensionContractInput {
  stage?: string | null;
  dimensionMode?: DimensionMode | null;
  dimensionContractId?: string | null;
  expectedDimensions?: string[] | null;
  atomicItemSetId?: string | null;
}

const CONTRACT_BY_STAGE: Record<string, { mode: DimensionMode; contractId: string }> = {
  prd: { mode: 'prd', contractId: 'prd_document' },
  spec: { mode: 'prd', contractId: 'prd_document' },
  specify: { mode: 'prd', contractId: 'prd_document' },
  plan: { mode: 'prd', contractId: 'prd_document' },
  gaps: { mode: 'prd', contractId: 'prd_document' },
  arch: { mode: 'arch', contractId: 'architecture_design' },
  architecture: { mode: 'arch', contractId: 'architecture_design' },
  implementation_readiness: { mode: 'readiness', contractId: 'implementation_readiness' },
  readiness: { mode: 'readiness', contractId: 'implementation_readiness' },
  delivery_confirmation: { mode: 'delivery', contractId: 'delivery_confirmation' },
  delivery: { mode: 'delivery', contractId: 'delivery_confirmation' },
  story: { mode: 'story', contractId: 'story_document' },
  tasks: { mode: 'tasks', contractId: 'tasks_decomposition' },
  standalone_tasks: { mode: 'tasks', contractId: 'tasks_decomposition' },
  bugfix: { mode: 'bugfix', contractId: 'bugfix_implementation' },
  implement: { mode: 'code', contractId: 'code_implementation' },
  post_impl: { mode: 'code', contractId: 'code_implementation' },
  pr_review: { mode: 'pr', contractId: 'pull_request_review' },
};

const EXPECTED_DIMENSIONS_BY_MODE: Record<DimensionMode, string[]> = {
  code: ['Functionality', 'Code Quality', 'Test Coverage', 'Security'],
  prd: ['Requirements Completeness', 'Testability', 'Consistency', 'Traceability'],
  arch: ['Technical Feasibility', 'Scalability', 'Security', 'Cost-Benefit'],
  pr: ['CI Status', 'Code Review', 'Test Coverage', 'Impact Assessment'],
  readiness: [
    'P0 Journey Coverage',
    'Smoke E2E Readiness',
    'Evidence Proof Chain',
    'Cross-Document Traceability',
  ],
  story: [
    'Story Scope Integrity',
    'Story Acceptance Coverage',
    'Story Evidence Traceability',
    'Story Execution Readiness',
  ],
  tasks: [
    'Task Atomicity',
    'Task Dependency Order',
    'Task Evidence Binding',
    'Task Execution Readiness',
  ],
  bugfix: [
    'Root Cause Accuracy',
    'Fix Correctness',
    'Regression Protection',
    'Bugfix Evidence Closure',
  ],
  delivery: [
    'Delivery Evidence Closure',
    'Current Attempt Binding',
    'Audit Convergence Receipt',
    'Closeout Authority',
  ],
};

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function contractMode(contractId: string): DimensionMode | null {
  switch (contractId) {
    case 'story_document':
      return 'story';
    case 'tasks_decomposition':
      return 'tasks';
    case 'bugfix_implementation':
      return 'bugfix';
    case 'implementation_readiness':
      return 'readiness';
    case 'delivery_confirmation':
      return 'delivery';
    case 'architecture_design':
      return 'arch';
    case 'prd_document':
      return 'prd';
    case 'pull_request_review':
      return 'pr';
    case 'code_implementation':
      return 'code';
    default:
      return null;
  }
}

export function expectedDimensionsForMode(mode: DimensionMode): string[] {
  return EXPECTED_DIMENSIONS_BY_MODE[mode];
}

export function resolveScoringDimensionContract(
  input: ResolveScoringDimensionContractInput
): ScoringDimensionContractResolution {
  const explicitMode = input.dimensionMode ?? null;
  const explicitContractId = normalize(input.dimensionContractId);
  const modeFromContract = explicitContractId ? contractMode(explicitContractId) : null;
  const stageKey = normalize(input.stage);
  const stageContract = CONTRACT_BY_STAGE[stageKey] ?? null;
  const derivedMode = stageContract?.mode ?? null;
  const resolvedMode = explicitMode ?? modeFromContract ?? derivedMode;
  const conflicts = [
    explicitMode && modeFromContract && explicitMode !== modeFromContract
      ? 'dimension_mode_conflicts_with_contract_id'
      : null,
    explicitMode && derivedMode && explicitMode !== derivedMode && !input.dimensionContractId
      ? 'dimension_mode_conflicts_with_stage'
      : null,
    modeFromContract && derivedMode && modeFromContract !== derivedMode && !explicitMode
      ? 'dimension_contract_conflicts_with_stage'
      : null,
  ].filter(Boolean) as string[];

  if (!resolvedMode) {
    return {
      status: stageKey ? 'blocked' : 'ambiguous',
      dimensionMode: null,
      dimensionContractId: input.dimensionContractId ?? null,
      expectedDimensions: [],
      atomicItemSetId: input.atomicItemSetId ?? null,
      blockingReasons: [
        stageKey ? 'dimension_contract_unresolved' : 'dimension_contract_ambiguous',
      ],
    };
  }

  if (conflicts.length > 0) {
    return {
      status: 'blocked',
      dimensionMode: resolvedMode,
      dimensionContractId: input.dimensionContractId ?? stageContract?.contractId ?? null,
      expectedDimensions: input.expectedDimensions ?? expectedDimensionsForMode(resolvedMode),
      atomicItemSetId: input.atomicItemSetId ?? null,
      blockingReasons: conflicts,
    };
  }

  return {
    status: 'resolved',
    dimensionMode: resolvedMode,
    dimensionContractId: input.dimensionContractId ?? stageContract?.contractId ?? null,
    expectedDimensions: input.expectedDimensions ?? expectedDimensionsForMode(resolvedMode),
    atomicItemSetId: input.atomicItemSetId ?? `${resolvedMode}_atomic_check_items`,
    blockingReasons: [],
  };
}
