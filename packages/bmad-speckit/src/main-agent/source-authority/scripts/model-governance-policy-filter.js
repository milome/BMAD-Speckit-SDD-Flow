"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterModelGovernanceHintCandidate = filterModelGovernanceHintCandidate;
exports.toPromptRoutingHintsCompat = toPromptRoutingHintsCompat;
const model_governance_hints_schema_1 = require("./model-governance-hints-schema");
function unique(values) {
    return [...new Set(values)];
}
function buildStructuredRecommendationItems(input) {
    const itemMap = new Map((input.items ?? []).map((item) => [item.value, item]));
    return unique(input.values)
        .filter(Boolean)
        .map((value) => {
        const matched = itemMap.get(value);
        return {
            value,
            source: 'model-provider',
            reason: matched?.reason ?? 'Provider recommended this item.',
            confidence: matched?.confidence ?? 'medium',
            consumed: true,
            filteredBecause: [],
        };
    });
}
function filterModelGovernanceHintCandidate(candidate, context) {
    const strippedForbiddenOverrides = [];
    const ignoredBecause = [];
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
        ignoredBecause.push(context.gateFailure.blockerOwnershipLocked
            ? 'blocker ownership locked'
            : 'blocker ownership is governance-owned');
    }
    if (forbidden.failedCheckSeverity !== undefined) {
        strippedForbiddenOverrides.push('failedCheckSeverity');
        ignoredBecause.push('failed-check severity is governance-owned');
    }
    if (forbidden.artifactRootTarget !== undefined) {
        strippedForbiddenOverrides.push('artifactRootTarget');
        ignoredBecause.push(context.artifactState.rootTargetLocked
            ? 'artifact root target locked'
            : 'artifact-derived root target is governance-owned');
    }
    if (forbidden.downstreamContinuation !== undefined) {
        strippedForbiddenOverrides.push('downstreamContinuation');
        ignoredBecause.push('downstream continuation is governance-owned');
    }
    const filteredHints = {
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
        recommendedSkillChain: candidate.recommendedSkillChain,
        recommendedSubagentRoles: candidate.recommendedSubagentRoles,
        recommendedSkillItems: buildStructuredRecommendationItems({
            values: candidate.recommendedSkillChain,
            items: candidate.recommendedSkillItems,
        }),
        recommendedSubagentRoleItems: buildStructuredRecommendationItems({
            values: candidate.recommendedSubagentRoles,
            items: candidate.recommendedSubagentRoleItems,
        }),
        researchPolicy: candidate.researchPolicy,
        delegationPreference: candidate.delegationPreference,
        constraints: candidate.constraints,
        rationale: candidate.rationale,
        overrideAllowed: false,
        debug: {
            strippedForbiddenOverrides: unique(strippedForbiddenOverrides),
            ignoredBecause: unique(ignoredBecause),
        },
    };
    (0, model_governance_hints_schema_1.assertValidFilteredModelGovernanceHints)(filteredHints);
    return {
        modelHintPresent: true,
        filteredHints,
        strippedForbiddenOverrides: filteredHints.debug.strippedForbiddenOverrides,
        ignoredBecause: filteredHints.debug.ignoredBecause,
        blockerOwnershipAffected: false,
    };
}
function toPromptRoutingHintsCompat(filteredHints) {
    return {
        source: 'user-input',
        confidence: filteredHints.confidence,
        ...(filteredHints.suggestedAction ? { requestedAction: filteredHints.suggestedAction } : {}),
        ...(filteredHints.suggestedStage ? { inferredStage: filteredHints.suggestedStage } : {}),
        ...(filteredHints.suggestedArtifactTarget
            ? { inferredArtifactTarget: filteredHints.suggestedArtifactTarget }
            : {}),
        explicitRolePreference: filteredHints.explicitRolePreference,
        recommendedSkillChain: filteredHints.recommendedSkillChain,
        recommendedSubagentRoles: filteredHints.recommendedSubagentRoles,
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
            matchedResearchPolicyAliases: filteredHints.researchPolicy === 'allowed' ? [] : [filteredHints.researchPolicy],
            matchedDelegationAliases: filteredHints.delegationPreference === 'ask-me-first'
                ? []
                : [filteredHints.delegationPreference],
            matchedConstraintAliases: filteredHints.constraints,
        },
    };
}
