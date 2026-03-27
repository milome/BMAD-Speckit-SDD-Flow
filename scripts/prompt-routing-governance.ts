import { type PromptRoutingHints } from './prompt-routing-hints-schema';
import { type ModelGovernanceHintCandidate } from './model-governance-hints-schema';
import {
  filterModelGovernanceHintCandidate,
  toPromptRoutingHintsCompat,
} from './model-governance-policy-filter';

export type PromptHintApplicationTarget =
  | 'entry-routing'
  | 'adapter-selection'
  | 'interaction-style'
  | 'research-policy';

export interface PromptRoutingGovernanceInput {
  stageContextKnown: boolean;
  gateFailure: {
    exists: boolean;
    blockerOwnershipLocked: boolean;
  };
  artifactState: {
    rootTargetLocked: boolean;
    equivalentAdapterCount: number;
  };
  promptHints?: PromptRoutingHints | null;
  modelHintsCandidate?: ModelGovernanceHintCandidate | null;
}

export interface PromptHintUsageRecord {
  promptHintPresent: boolean;
  hintConfidence: PromptRoutingHints['confidence'] | 'n/a';
  modelHintPresent: boolean;
  modelHintConfidence: PromptRoutingHints['confidence'] | 'n/a';
  consumedAfter: 'stage context -> gate failure -> artifact state -> PromptRoutingHints';
  hintAppliedTo: PromptHintApplicationTarget[];
  hintIgnoredBecause: string[];
  modelHintAppliedTo: PromptHintApplicationTarget[];
  modelHintIgnoredBecause: string[];
  modelHintDebug: {
    strippedForbiddenOverrides: string[];
    ignoredBecause: string[];
  } | null;
  blockerOwnershipAffected: false;
}

function hasExplicitConstraint(hints: PromptRoutingHints): boolean {
  return (
    hints.researchPolicy !== 'allowed' ||
    hints.delegationPreference !== 'ask-me-first' ||
    hints.constraints.length > 0
  );
}

function evaluateHints(
  hints: PromptRoutingHints,
  input: PromptRoutingGovernanceInput
): {
  appliedTo: PromptHintApplicationTarget[];
  ignoredBecause: string[];
} {
  const appliedTo: PromptHintApplicationTarget[] = [];
  const ignoredBecause: string[] = [];

  if (hints.delegationPreference !== 'ask-me-first') {
    appliedTo.push('interaction-style');
  }

  if (hints.researchPolicy !== 'allowed') {
    appliedTo.push('research-policy');
  }

  const lowConfidence = hints.confidence === 'low';
  if (lowConfidence && !hasExplicitConstraint(hints)) {
    ignoredBecause.push('low confidence');
    return {
      appliedTo,
      ignoredBecause,
    };
  }

  const entryRoutingEligible = !input.gateFailure.exists;
  if (entryRoutingEligible) {
    if (hints.inferredStage || hints.requestedAction || hints.inferredArtifactTarget) {
      appliedTo.push('entry-routing');
    }
  } else if (hints.inferredStage || hints.requestedAction || hints.inferredArtifactTarget) {
    ignoredBecause.push('no failed-gate-free entry routing window');
  }

  const adapterSelectionEligible = input.artifactState.equivalentAdapterCount > 1;
  const adapterPreferenceRequested =
    hints.explicitRolePreference.length > 0 ||
    hints.researchPolicy !== 'allowed' ||
    hints.constraints.length > 0;

  if (adapterSelectionEligible && adapterPreferenceRequested) {
    appliedTo.push('adapter-selection');
  } else if (adapterPreferenceRequested) {
    ignoredBecause.push('no equivalent adapter choice');
  }

  if (input.gateFailure.blockerOwnershipLocked) {
    ignoredBecause.push('blocker ownership locked');
  }

  if (input.artifactState.rootTargetLocked) {
    ignoredBecause.push('artifact target locked');
  }

  return {
    appliedTo: [...new Set(appliedTo)],
    ignoredBecause: [...new Set(ignoredBecause)],
  };
}

export function resolvePromptHintUsage(
  input: PromptRoutingGovernanceInput
): PromptHintUsageRecord {
  const record: PromptHintUsageRecord = {
    promptHintPresent: Boolean(input.promptHints),
    hintConfidence: input.promptHints?.confidence ?? 'n/a',
    modelHintPresent: Boolean(input.modelHintsCandidate),
    modelHintConfidence: input.modelHintsCandidate?.confidence ?? 'n/a',
    consumedAfter: 'stage context -> gate failure -> artifact state -> PromptRoutingHints',
    hintAppliedTo: [],
    hintIgnoredBecause: [],
    modelHintAppliedTo: [],
    modelHintIgnoredBecause: [],
    modelHintDebug: null,
    blockerOwnershipAffected: false,
  };

  const hints = input.promptHints;
  if (hints) {
    const promptUsage = evaluateHints(hints, input);
    record.hintAppliedTo.push(...promptUsage.appliedTo);
    record.hintIgnoredBecause.push(...promptUsage.ignoredBecause);
  }

  if (input.modelHintsCandidate) {
    const filteredModel = filterModelGovernanceHintCandidate(input.modelHintsCandidate, {
      gateFailure: input.gateFailure,
      artifactState: input.artifactState,
    });

    record.modelHintDebug = filteredModel.filteredHints?.debug ?? {
      strippedForbiddenOverrides: filteredModel.strippedForbiddenOverrides,
      ignoredBecause: filteredModel.ignoredBecause,
    };
    record.modelHintIgnoredBecause.push(...filteredModel.ignoredBecause);

    if (filteredModel.filteredHints) {
      const compatHints = toPromptRoutingHintsCompat(filteredModel.filteredHints);
      const modelUsage = evaluateHints(compatHints, input);
      record.modelHintAppliedTo.push(...modelUsage.appliedTo);
      record.modelHintIgnoredBecause.push(...modelUsage.ignoredBecause);
      record.hintAppliedTo.push(...modelUsage.appliedTo);
      record.hintIgnoredBecause.push(...filteredModel.ignoredBecause, ...modelUsage.ignoredBecause);
    }
  }

  record.hintIgnoredBecause = [...new Set(record.hintIgnoredBecause)];
  record.hintAppliedTo = [...new Set(record.hintAppliedTo)];
  record.modelHintIgnoredBecause = [...new Set(record.modelHintIgnoredBecause)];
  record.modelHintAppliedTo = [...new Set(record.modelHintAppliedTo)];
  return record;
}
