import type { PromptRoutingHints } from './prompt-routing-hints-schema';
import {
  assertValidFilteredModelGovernanceHints,
  type FilteredModelGovernanceHints,
  type ModelGovernanceForbiddenOverrideKey,
  type ModelGovernanceHintCandidate,
} from './model-governance-hints-schema';

export interface ModelGovernancePolicyContext {
  gateFailure: {
    exists: boolean;
    blockerOwnershipLocked: boolean;
  };
  artifactState: {
    rootTargetLocked: boolean;
    equivalentAdapterCount: number;
  };
}

export interface ModelGovernancePolicyFilterResult {
  modelHintPresent: boolean;
  filteredHints: FilteredModelGovernanceHints | null;
  strippedForbiddenOverrides: ModelGovernanceForbiddenOverrideKey[];
  ignoredBecause: string[];
  blockerOwnershipAffected: false;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function filterModelGovernanceHintCandidate(
  candidate: ModelGovernanceHintCandidate | null,
  context: ModelGovernancePolicyContext
): ModelGovernancePolicyFilterResult {
  const strippedForbiddenOverrides: ModelGovernanceForbiddenOverrideKey[] = [];
  const ignoredBecause: string[] = [];

  if (!candidate) {
    return {
      modelHintPresent: false,
      filteredHints: null,
      strippedForbiddenOverrides,
      ignoredBecause,
      blockerOwnershipAffected: false,
    };
  }

  const forbidden = candidate.forbiddenOverrides ?? {};

  if (forbidden.blockerOwnership !== undefined) {
    strippedForbiddenOverrides.push('blockerOwnership');
    ignoredBecause.push(
      context.gateFailure.blockerOwnershipLocked
        ? 'blocker ownership locked'
        : 'blocker ownership is governance-owned'
    );
  }

  if (forbidden.failedCheckSeverity !== undefined) {
    strippedForbiddenOverrides.push('failedCheckSeverity');
    ignoredBecause.push('failed-check severity is governance-owned');
  }

  if (forbidden.artifactRootTarget !== undefined) {
    strippedForbiddenOverrides.push('artifactRootTarget');
    ignoredBecause.push(
      context.artifactState.rootTargetLocked
        ? 'artifact root target locked'
        : 'artifact-derived root target is governance-owned'
    );
  }

  if (forbidden.downstreamContinuation !== undefined) {
    strippedForbiddenOverrides.push('downstreamContinuation');
    ignoredBecause.push('downstream continuation is governance-owned');
  }

  const filteredHints: FilteredModelGovernanceHints = {
    source: 'model-provider',
    providerId: candidate.providerId,
    providerMode: candidate.providerMode,
    confidence: candidate.confidence,
    ...(candidate.suggestedStage ? { suggestedStage: candidate.suggestedStage } : {}),
    ...(candidate.suggestedAction ? { suggestedAction: candidate.suggestedAction } : {}),
    ...(candidate.suggestedArtifactTarget &&
    !context.artifactState.rootTargetLocked &&
    strippedForbiddenOverrides.length === 0
      ? { suggestedArtifactTarget: candidate.suggestedArtifactTarget }
      : {}),
    explicitRolePreference: candidate.explicitRolePreference,
    researchPolicy: candidate.researchPolicy,
    delegationPreference: candidate.delegationPreference,
    constraints: candidate.constraints,
    rationale: candidate.rationale,
    overrideAllowed: false,
    debug: {
      strippedForbiddenOverrides: unique(strippedForbiddenOverrides) as ModelGovernanceForbiddenOverrideKey[],
      ignoredBecause: unique(ignoredBecause),
    },
  };

  assertValidFilteredModelGovernanceHints(filteredHints);
  return {
    modelHintPresent: true,
    filteredHints,
    strippedForbiddenOverrides: filteredHints.debug.strippedForbiddenOverrides,
    ignoredBecause: filteredHints.debug.ignoredBecause,
    blockerOwnershipAffected: false,
  };
}

export function toPromptRoutingHintsCompat(
  filteredHints: FilteredModelGovernanceHints
): PromptRoutingHints {
  return {
    source: 'user-input',
    confidence: filteredHints.confidence,
    ...(filteredHints.suggestedAction ? { requestedAction: filteredHints.suggestedAction } : {}),
    ...(filteredHints.suggestedStage ? { inferredStage: filteredHints.suggestedStage } : {}),
    ...(filteredHints.suggestedArtifactTarget
      ? { inferredArtifactTarget: filteredHints.suggestedArtifactTarget }
      : {}),
    explicitRolePreference: filteredHints.explicitRolePreference,
    researchPolicy: filteredHints.researchPolicy,
    delegationPreference: filteredHints.delegationPreference,
    constraints: filteredHints.constraints,
    overrideAllowed: false,
    debug: {
      score: filteredHints.debug.strippedForbiddenOverrides.length > 0 ? 2 : 3,
      normalizedInput: `[model-provider:${filteredHints.providerId}]`,
      matchedStageAliases: filteredHints.suggestedStage ? [filteredHints.suggestedStage] : [],
      matchedActionAliases: filteredHints.suggestedAction ? [filteredHints.suggestedAction] : [],
      matchedArtifactAliases: filteredHints.suggestedArtifactTarget
        ? [filteredHints.suggestedArtifactTarget]
        : [],
      matchedRoleAliases: filteredHints.explicitRolePreference,
      matchedResearchPolicyAliases:
        filteredHints.researchPolicy === 'allowed' ? [] : [filteredHints.researchPolicy],
      matchedDelegationAliases:
        filteredHints.delegationPreference === 'ask-me-first'
          ? []
          : [filteredHints.delegationPreference],
      matchedConstraintAliases: filteredHints.constraints,
    },
  };
}
