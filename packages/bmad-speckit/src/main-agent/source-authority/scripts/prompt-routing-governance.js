"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePromptHintUsage = resolvePromptHintUsage;
exports.resolvePromptHintUsageFromText = resolvePromptHintUsageFromText;
const prompt_routing_hints_1 = require("./prompt-routing-hints");
const execution_intent_schema_1 = require("./execution-intent-schema");
const model_governance_policy_filter_1 = require("./model-governance-policy-filter");
const reviewer_registry_1 = require("./reviewer-registry");
const skill_semantic_features_config_1 = require("./skill-semantic-features-config");
function unique(values) {
    return [...new Set(values)];
}
function normalizeSkillId(value) {
    return value.trim().toLowerCase();
}
function tokenizeSkillLabel(value) {
    return unique(value
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3));
}
function uniqueEnum(values) {
    return [...new Set(values.filter(Boolean))];
}
function normalizeSkillPath(value) {
    return value.replace(/\\/g, '/').trim();
}
function skillIdFromPath(value) {
    const normalized = normalizeSkillPath(value);
    if (normalized === '') {
        return null;
    }
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) {
        return null;
    }
    const lastSegment = segments[segments.length - 1];
    if (lastSegment?.toLowerCase() === 'skill.md') {
        const parentSegment = segments.length >= 2 ? segments[segments.length - 2] : null;
        return parentSegment ? normalizeSkillId(parentSegment) : null;
    }
    const leaf = lastSegment;
    return normalizeSkillId(leaf.replace(/\.[^.]+$/u, ''));
}
function normalizeSkillAvailability(input) {
    const availableSkills = unique([
        ...(input.availableSkills ?? []).map((skill) => normalizeSkillId(skill)).filter(Boolean),
        ...(input.skillInventory ?? []).map((entry) => normalizeSkillId(entry.skillId)).filter(Boolean),
        ...(input.skillPaths ?? [])
            .map((skillPath) => skillIdFromPath(skillPath))
            .filter((skillId) => Boolean(skillId)),
        ...(input.skillInventory ?? [])
            .map((entry) => (entry.path ? skillIdFromPath(entry.path) : null))
            .filter((skillId) => Boolean(skillId)),
    ]);
    const skillPaths = unique([
        ...(input.skillPaths ?? []).map((skillPath) => normalizeSkillPath(skillPath)).filter(Boolean),
        ...(input.skillInventory ?? [])
            .map((entry) => (entry.path ? normalizeSkillPath(entry.path) : ''))
            .filter(Boolean),
    ]);
    return { availableSkills, skillPaths };
}
function deriveSemanticSkillFeatures(entry) {
    const text = [entry.skillId, entry.title, entry.description, entry.summary]
        .filter((value) => Boolean(value && value.trim()))
        .join(' ')
        .toLowerCase();
    const tokens = tokenizeSkillLabel(text);
    const matchesRule = (rule) => {
        const tokenMatch = (rule.tokensAny ?? []).some((token) => tokens.includes(token));
        const phraseMatch = (rule.phrasesAny ?? []).some((phrase) => text.includes(phrase));
        return tokenMatch || phraseMatch;
    };
    const collectScoredValues = (entries) => {
        const scored = entries
            .filter((entryRule) => matchesRule(entryRule.rule))
            .map((entryRule) => ({
            value: entryRule.value,
            score: entryRule.priority * 100 + entryRule.weight,
        }))
            .sort((left, right) => right.score - left.score);
        return {
            values: uniqueEnum(scored.map((entryRule) => entryRule.value)),
            scores: Object.fromEntries(scored.map((entryRule) => [entryRule.value, entryRule.score])),
        };
    };
    const stageHints = collectScoredValues(skill_semantic_features_config_1.SKILL_SEMANTIC_FEATURES_CONFIG.stageHints);
    const actionHints = collectScoredValues(skill_semantic_features_config_1.SKILL_SEMANTIC_FEATURES_CONFIG.actionHints);
    const interactionHints = collectScoredValues(skill_semantic_features_config_1.SKILL_SEMANTIC_FEATURES_CONFIG.interactionHints);
    const researchPolicyHints = collectScoredValues(skill_semantic_features_config_1.SKILL_SEMANTIC_FEATURES_CONFIG.researchPolicyHints);
    const delegationHints = collectScoredValues(skill_semantic_features_config_1.SKILL_SEMANTIC_FEATURES_CONFIG.delegationHints);
    const constraintHints = collectScoredValues(skill_semantic_features_config_1.SKILL_SEMANTIC_FEATURES_CONFIG.constraintHints);
    return {
        skillId: entry.skillId,
        ...(entry.path ? { path: entry.path } : {}),
        ...(entry.title ? { title: entry.title } : {}),
        stageHints: stageHints.values,
        stageHintScores: stageHints.scores,
        actionHints: actionHints.values,
        actionHintScores: actionHints.scores,
        interactionHints: interactionHints.values,
        interactionHintScores: interactionHints.scores,
        researchPolicyHints: researchPolicyHints.values,
        researchPolicyHintScores: researchPolicyHints.scores,
        delegationHints: delegationHints.values,
        delegationHintScores: delegationHints.scores,
        constraintHints: constraintHints.values,
        constraintHintScores: constraintHints.scores,
    };
}
function resolveSkillAvailability(input) {
    const normalizedAvailability = normalizeSkillAvailability(input);
    const orderedInventory = (input.skillInventory ?? [])
        .map((entry) => ({
        skillId: normalizeSkillId(entry.skillId),
        path: entry.path ? normalizeSkillPath(entry.path) : undefined,
        title: entry.title?.trim(),
        description: entry.description?.trim(),
        summary: entry.summary?.trim(),
    }))
        .filter((entry) => entry.skillId !== '');
    if (normalizedAvailability.availableSkills.length === 0 &&
        normalizedAvailability.skillPaths.length === 0) {
        return {
            ...normalizedAvailability,
            matchedAvailableSkills: [],
            missingSkills: [],
            skillMatchReasons: [],
            semanticSkillFeatures: [],
            semanticFeatureTopN: {
                stageHints: [],
                actionHints: [],
                interactionHints: [],
                researchPolicyHints: [],
                delegationHints: [],
                constraintHints: [],
            },
            filteredSkillChain: input.requestedSkillChain,
            skillAvailabilityMode: 'not-provided',
        };
    }
    const matchedAvailableSkills = [];
    const missingSkills = [];
    const skillMatchReasons = [];
    const semanticSkillFeatures = [];
    const filteredSkillChain = [];
    for (const requestedSkill of input.requestedSkillChain) {
        const requestedId = normalizeSkillId(requestedSkill);
        const requestedTokens = tokenizeSkillLabel(requestedId);
        const scoreSkillMatch = (candidate) => {
            const normalizedCandidate = normalizeSkillId(candidate.skillId);
            const exactIdMatch = normalizedCandidate === requestedId;
            if (exactIdMatch) {
                return {
                    score: 10_000,
                    exactIdMatch: true,
                    substringMatch: false,
                    overlapTokens: [],
                };
            }
            const substringMatch = normalizedCandidate.includes(requestedId) || requestedId.includes(normalizedCandidate);
            let score = 0;
            if (substringMatch) {
                score += 2_000;
            }
            const candidateTokens = tokenizeSkillLabel([
                normalizedCandidate,
                candidate.path ?? '',
                candidate.title ?? '',
                candidate.description ?? '',
                candidate.summary ?? '',
            ].join(' '));
            const overlapTokens = requestedTokens.filter((token) => candidateTokens.includes(token));
            score += overlapTokens.length * 250;
            if (requestedTokens.length > 0 && overlapTokens.length === requestedTokens.length) {
                score += 500;
            }
            return {
                score,
                exactIdMatch: false,
                substringMatch,
                overlapTokens,
            };
        };
        const inventoryMatch = orderedInventory
            .map((entry, index) => ({
            entry,
            index,
            match: scoreSkillMatch(entry),
        }))
            .filter((candidate) => candidate.match.score > 0)
            .sort((left, right) => {
            if (right.match.score !== left.match.score) {
                return right.match.score - left.match.score;
            }
            return left.index - right.index;
        })[0];
        const fallbackMatch = normalizedAvailability.availableSkills
            .map((skillId, index) => ({
            skillId,
            index,
            match: scoreSkillMatch({ skillId }),
        }))
            .filter((candidate) => candidate.match.score > 0)
            .sort((left, right) => {
            if (right.match.score !== left.match.score) {
                return right.match.score - left.match.score;
            }
            return left.index - right.index;
        })[0];
        const resolvedSkill = inventoryMatch?.entry.skillId ?? fallbackMatch?.skillId ?? null;
        if (!resolvedSkill) {
            missingSkills.push(normalizeSkillId(requestedSkill));
            continue;
        }
        matchedAvailableSkills.push(resolvedSkill);
        filteredSkillChain.push(resolvedSkill);
        if (inventoryMatch) {
            semanticSkillFeatures.push(deriveSemanticSkillFeatures(inventoryMatch.entry));
            skillMatchReasons.push({
                requestedSkill: requestedId,
                matchedSkillId: inventoryMatch.entry.skillId,
                ...(inventoryMatch.entry.path ? { matchedPath: inventoryMatch.entry.path } : {}),
                score: inventoryMatch.match.score,
                exactIdMatch: inventoryMatch.match.exactIdMatch,
                substringMatch: inventoryMatch.match.substringMatch,
                overlapTokens: inventoryMatch.match.overlapTokens,
                ...(inventoryMatch.entry.title ? { title: inventoryMatch.entry.title } : {}),
                ...(inventoryMatch.entry.description
                    ? { description: inventoryMatch.entry.description }
                    : {}),
                ...(inventoryMatch.entry.summary ? { summary: inventoryMatch.entry.summary } : {}),
            });
        }
        else if (fallbackMatch) {
            semanticSkillFeatures.push(deriveSemanticSkillFeatures({
                skillId: fallbackMatch.skillId,
            }));
            skillMatchReasons.push({
                requestedSkill: requestedId,
                matchedSkillId: fallbackMatch.skillId,
                score: fallbackMatch.match.score,
                exactIdMatch: fallbackMatch.match.exactIdMatch,
                substringMatch: fallbackMatch.match.substringMatch,
                overlapTokens: fallbackMatch.match.overlapTokens,
            });
        }
    }
    const buildTopN = (pickValues, pickScores) => {
        const aggregated = new Map();
        for (const feature of semanticSkillFeatures) {
            for (const value of pickValues(feature)) {
                const score = pickScores(feature)?.[value] ?? 0;
                const current = aggregated.get(value);
                if (!current) {
                    aggregated.set(value, {
                        score,
                        provenanceSkillIds: [feature.skillId],
                    });
                    continue;
                }
                current.score = Math.max(current.score, score);
                current.provenanceSkillIds = unique([...current.provenanceSkillIds, feature.skillId]);
            }
        }
        return [...aggregated.entries()]
            .map(([value, payload]) => ({
            value,
            score: payload.score,
            provenanceSkillIds: payload.provenanceSkillIds,
        }))
            .sort((left, right) => right.score - left.score)
            .slice(0, 3);
    };
    const semanticFeatureTopN = {
        stageHints: buildTopN((feature) => feature.stageHints, (feature) => feature.stageHintScores),
        actionHints: buildTopN((feature) => feature.actionHints, (feature) => feature.actionHintScores),
        interactionHints: buildTopN((feature) => feature.interactionHints, (feature) => feature.interactionHintScores),
        researchPolicyHints: buildTopN((feature) => feature.researchPolicyHints, (feature) => feature.researchPolicyHintScores),
        delegationHints: buildTopN((feature) => feature.delegationHints, (feature) => feature.delegationHintScores),
        constraintHints: buildTopN((feature) => feature.constraintHints, (feature) => feature.constraintHintScores),
    };
    return {
        ...normalizedAvailability,
        matchedAvailableSkills: unique(matchedAvailableSkills),
        missingSkills: unique(missingSkills),
        skillMatchReasons,
        semanticSkillFeatures,
        semanticFeatureTopN,
        filteredSkillChain: unique(filteredSkillChain),
        skillAvailabilityMode: 'execution-filtered',
    };
}
function findBestSkillMatch(requestedSkill, input) {
    const normalizedAvailability = normalizeSkillAvailability(input);
    const requestedId = normalizeSkillId(requestedSkill);
    const requestedTokens = tokenizeSkillLabel(requestedId);
    const orderedInventory = (input.skillInventory ?? [])
        .map((entry) => ({
        skillId: normalizeSkillId(entry.skillId),
        path: entry.path ? normalizeSkillPath(entry.path) : undefined,
        title: entry.title?.trim(),
        description: entry.description?.trim(),
        summary: entry.summary?.trim(),
    }))
        .filter((entry) => entry.skillId !== '');
    const scoreSkillMatch = (candidate) => {
        const normalizedCandidate = normalizeSkillId(candidate.skillId);
        const exactIdMatch = normalizedCandidate === requestedId;
        if (exactIdMatch) {
            return {
                score: 10_000,
                matchedBy: 'exact-id',
            };
        }
        const substringMatch = normalizedCandidate.includes(requestedId) || requestedId.includes(normalizedCandidate);
        let score = 0;
        if (substringMatch) {
            score += 2_000;
        }
        const candidateTokens = tokenizeSkillLabel([
            normalizedCandidate,
            candidate.path ?? '',
            candidate.title ?? '',
            candidate.description ?? '',
            candidate.summary ?? '',
        ].join(' '));
        const overlapTokens = requestedTokens.filter((token) => candidateTokens.includes(token));
        score += overlapTokens.length * 250;
        if (requestedTokens.length > 0 && overlapTokens.length === requestedTokens.length) {
            score += 500;
        }
        return {
            score,
            matchedBy: substringMatch
                ? 'substring'
                : overlapTokens.length > 0
                    ? 'token-overlap'
                    : 'unmatched',
        };
    };
    const inventoryMatch = orderedInventory
        .map((entry, index) => ({
        entry,
        index,
        match: scoreSkillMatch(entry),
    }))
        .filter((candidate) => candidate.match.score > 0)
        .sort((left, right) => {
        if (right.match.score !== left.match.score) {
            return right.match.score - left.match.score;
        }
        return left.index - right.index;
    })[0];
    const fallbackMatch = normalizedAvailability.availableSkills
        .map((skillId, index) => ({
        skillId,
        index,
        match: scoreSkillMatch({ skillId }),
    }))
        .filter((candidate) => candidate.match.score > 0)
        .sort((left, right) => {
        if (right.match.score !== left.match.score) {
            return right.match.score - left.match.score;
        }
        return left.index - right.index;
    })[0];
    if (inventoryMatch) {
        return {
            matchedSkillId: inventoryMatch.entry.skillId,
            matchedBy: inventoryMatch.match.matchedBy,
            matchScore: inventoryMatch.match.score,
        };
    }
    if (fallbackMatch) {
        return {
            matchedSkillId: fallbackMatch.skillId,
            matchedBy: fallbackMatch.match.matchedBy,
            matchScore: fallbackMatch.match.score,
        };
    }
    return {
        matchedBy: 'unmatched',
    };
}
function resolveExecutionIntentSource(input) {
    if (input.promptHints && input.modelHints) {
        return 'merged';
    }
    if (input.promptHints) {
        return 'prompt-hints';
    }
    if (input.modelHints) {
        return 'model-hints';
    }
    return 'default';
}
function selectResearchPolicy(promptHints, modelHints) {
    const values = [promptHints?.researchPolicy, modelHints?.researchPolicy].filter((value) => Boolean(value));
    if (values.includes('forbidden')) {
        return 'forbidden';
    }
    if (values.includes('preferred')) {
        return 'preferred';
    }
    return 'allowed';
}
function selectDelegationPreference(promptHints, modelHints) {
    const values = [promptHints?.delegationPreference, modelHints?.delegationPreference].filter((value) => Boolean(value));
    if (values.includes('ask-me-first')) {
        return 'ask-me-first';
    }
    return 'decide-for-me';
}
function selectInteractionMode(input) {
    const roles = new Set(input.rolePreferences);
    if (roles.has('party-mode')) {
        return 'party-mode';
    }
    if (input.action === 'review' || roles.has('critical-auditor') || roles.has('code-reviewer')) {
        return 'review-first';
    }
    if (input.action === 'patch' || input.action === 'implement' || input.action === 'fix') {
        return 'implement-first';
    }
    return 'single-agent';
}
function buildSkillChain(input) {
    const skillChain = [];
    skillChain.push(...(input.recommendedSkillChain ?? []));
    if (input.stage || input.action) {
        skillChain.push('speckit-workflow');
    }
    if (input.interactionMode === 'party-mode') {
        skillChain.push('party-mode');
    }
    if (input.action === 'review' ||
        input.rolePreferences.includes('critical-auditor') ||
        input.rolePreferences.includes('code-reviewer')) {
        skillChain.push('code-reviewer');
    }
    return unique(skillChain);
}
function buildExecutionIntentCandidate(input) {
    const source = resolveExecutionIntentSource(input);
    if (source === 'default') {
        return null;
    }
    const stage = input.promptHints?.inferredStage ?? input.modelHints?.inferredStage;
    const action = input.promptHints?.requestedAction ?? input.modelHints?.requestedAction;
    const rolePreferences = unique([
        ...(input.promptHints?.explicitRolePreference ?? []),
        ...(input.modelHints?.explicitRolePreference ?? []),
    ]);
    const recommendedSubagentRoles = unique([
        ...(input.promptHints?.recommendedSubagentRoles ?? []),
        ...(input.modelHints?.recommendedSubagentRoles ?? []),
    ]);
    const recommendedSkillChain = unique([
        ...(input.promptHints?.recommendedSkillChain ?? []),
        ...(input.modelHints?.recommendedSkillChain ?? []),
    ]);
    const requestedSkillChainPreview = buildSkillChain({
        stage,
        action,
        interactionMode: selectInteractionMode({ action, rolePreferences }),
        rolePreferences,
        recommendedSkillChain,
    });
    const skillAvailabilityPreview = resolveSkillAvailability({
        requestedSkillChain: requestedSkillChainPreview,
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory,
    });
    const providerRecommendationItems = {
        skills: (input.filteredModelHints?.recommendedSkillItems ?? []).map((item) => {
            const match = findBestSkillMatch(item.value, {
                availableSkills: input.availableSkills,
                skillPaths: input.skillPaths,
                skillInventory: input.skillInventory,
            });
            const consumed = skillAvailabilityPreview.filteredSkillChain.includes(item.value);
            const filteredBecause = !match.matchedSkillId
                ? ['not-available-in-inventory']
                : !consumed
                    ? ['replaced-by-better-match']
                    : [];
            return {
                ...item,
                consumed,
                ...(match.matchedSkillId ? { matchedSkillId: match.matchedSkillId } : {}),
                matchedBy: match.matchedBy,
                ...(match.matchScore !== undefined ? { matchScore: match.matchScore } : {}),
                filteredBecause,
            };
        }),
        subagentRoles: (input.filteredModelHints?.recommendedSubagentRoleItems ?? []).map((item) => ({
            ...item,
            consumed: recommendedSubagentRoles.includes(item.value),
            filteredBecause: recommendedSubagentRoles.includes(item.value)
                ? []
                : ['blocked-by-governance-filter'],
        })),
    };
    const interactionMode = selectInteractionMode({ action, rolePreferences });
    const subagentRoles = unique([
        ...recommendedSubagentRoles,
        ...rolePreferences.filter((role) => role !== 'party-mode'),
    ]);
    const requestedSkillChain = buildSkillChain({
        stage,
        action,
        interactionMode,
        rolePreferences,
        recommendedSkillChain,
    });
    const skillAvailability = resolveSkillAvailability({
        requestedSkillChain,
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory,
    });
    const semanticFeatures = skillAvailability.semanticSkillFeatures;
    const semanticTopN = skillAvailability.semanticFeatureTopN;
    const reviewerRouteExplainability = buildPromptReviewerRouteExplainability(requestedSkillChain, skillAvailability.skillMatchReasons);
    const semanticStage = semanticTopN.stageHints[0]?.value;
    const semanticAction = semanticTopN.actionHints[0]?.value;
    const semanticInteractionMode = semanticTopN.interactionHints[0]?.value;
    const semanticResearchPolicy = semanticTopN.researchPolicyHints[0]?.value;
    const semanticDelegationPreference = semanticTopN.delegationHints[0]?.value;
    const semanticConstraints = semanticFeatures.flatMap((feature) => feature.constraintHints);
    const candidate = {
        source,
        ...((stage ?? semanticStage) ? { stage: stage ?? semanticStage } : {}),
        ...((action ?? semanticAction) ? { action: action ?? semanticAction } : {}),
        skillChain: requestedSkillChain,
        subagentRoles,
        providerRecommendedSkillChain: recommendedSkillChain,
        providerRecommendedSubagentRoles: recommendedSubagentRoles,
        providerRecommendationItems,
        availableSkills: skillAvailability.availableSkills,
        skillPaths: skillAvailability.skillPaths,
        matchedAvailableSkills: skillAvailability.matchedAvailableSkills,
        missingSkills: skillAvailability.missingSkills,
        skillMatchReasons: skillAvailability.skillMatchReasons,
        semanticSkillFeatures: semanticFeatures,
        semanticFeatureTopN: semanticTopN,
        ...(reviewerRouteExplainability ? { reviewerRouteExplainability } : {}),
        skillAvailabilityMode: skillAvailability.skillAvailabilityMode === 'not-provided' ? 'not-provided' : 'advisory-only',
        interactionMode: semanticInteractionMode ?? interactionMode,
        researchPolicy: selectResearchPolicy(input.promptHints, input.modelHints) === 'allowed' &&
            semanticResearchPolicy
            ? semanticResearchPolicy
            : selectResearchPolicy(input.promptHints, input.modelHints),
        delegationPreference: selectDelegationPreference(input.promptHints, input.modelHints) === 'decide-for-me' &&
            semanticDelegationPreference
            ? semanticDelegationPreference
            : selectDelegationPreference(input.promptHints, input.modelHints),
        constraints: unique([
            ...(input.promptHints?.constraints ?? []),
            ...(input.modelHints?.constraints ?? []),
            ...semanticConstraints,
        ]),
        rationale: source === 'merged'
            ? 'Merged user prompt hints with governance provider hints.'
            : source === 'prompt-hints'
                ? semanticFeatures.length > 0
                    ? 'Derived from user prompt hints and matched skill semantic features.'
                    : 'Derived from user prompt hints.'
                : semanticFeatures.length > 0
                    ? 'Derived from governance provider hints and matched skill semantic features.'
                    : 'Derived from governance provider hints.',
        advisoryOnly: true,
    };
    (0, execution_intent_schema_1.assertValidExecutionIntentCandidate)(candidate);
    return candidate;
}
function buildExecutionPlanDecision(input, candidate) {
    if (!candidate) {
        return null;
    }
    const governanceConstraints = unique([
        ...(input.gateFailure.blockerOwnershipLocked ? ['blocker ownership locked'] : []),
        ...(input.artifactState.rootTargetLocked ? ['artifact target locked'] : []),
    ]);
    const blockedByGovernance = unique([
        ...(input.gateFailure.exists && (candidate.stage || candidate.action) ? ['entry-routing'] : []),
        ...(input.gateFailure.blockerOwnershipLocked ? ['blocker-ownership'] : []),
        ...(input.artifactState.rootTargetLocked ? ['artifact-target'] : []),
    ]);
    const skillAvailability = resolveSkillAvailability({
        requestedSkillChain: candidate.skillChain,
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory,
    });
    const decision = {
        source: candidate.source,
        ...(candidate.stage ? { stage: candidate.stage } : {}),
        ...(candidate.action ? { action: candidate.action } : {}),
        skillChain: skillAvailability.skillAvailabilityMode === 'execution-filtered'
            ? skillAvailability.filteredSkillChain
            : candidate.skillChain,
        subagentRoles: candidate.subagentRoles,
        providerRecommendedSkillChain: candidate.providerRecommendedSkillChain,
        providerRecommendedSubagentRoles: candidate.providerRecommendedSubagentRoles,
        providerRecommendationItems: candidate.providerRecommendationItems,
        availableSkills: skillAvailability.availableSkills,
        skillPaths: skillAvailability.skillPaths,
        matchedAvailableSkills: skillAvailability.matchedAvailableSkills,
        missingSkills: skillAvailability.missingSkills,
        skillMatchReasons: skillAvailability.skillMatchReasons,
        semanticSkillFeatures: candidate.semanticSkillFeatures,
        semanticFeatureTopN: candidate.semanticFeatureTopN,
        ...(candidate.reviewerRouteExplainability
            ? { reviewerRouteExplainability: candidate.reviewerRouteExplainability }
            : {}),
        skillAvailabilityMode: skillAvailability.skillAvailabilityMode,
        interactionMode: candidate.interactionMode,
        researchPolicy: candidate.researchPolicy,
        delegationPreference: candidate.delegationPreference,
        governanceConstraints,
        blockedByGovernance,
        rationale: [
            governanceConstraints.length > 0
                ? `${candidate.rationale} Governance constraints preserved during execution planning.`
                : `${candidate.rationale} No governance constraints altered the execution plan.`,
            skillAvailability.skillAvailabilityMode === 'execution-filtered'
                ? 'Available skill inventory filtered the local execution chain without creating new governance blockers.'
                : skillAvailability.skillAvailabilityMode === 'not-provided'
                    ? 'No skill inventory was provided, so local execution chain filtering was skipped.'
                    : null,
        ]
            .filter((line) => Boolean(line))
            .join(' '),
        advisoryOnly: false,
    };
    (0, execution_intent_schema_1.assertValidExecutionPlanDecision)(decision);
    return decision;
}
function buildPromptReviewerRouteExplainability(candidateSkillChain, skillMatchReasons) {
    if (!candidateSkillChain.includes('code-reviewer')) {
        return undefined;
    }
    const reviewerSkillMatch = skillMatchReasons.find((reason) => normalizeSkillId(reason.requestedSkill) === 'code-reviewer');
    return [
        (0, reviewer_registry_1.buildReviewerRouteExplainability)({
            requestedSkillId: 'code-reviewer',
            ...(reviewerSkillMatch?.matchedSkillId
                ? { matchedSkillId: reviewerSkillMatch.matchedSkillId }
                : {}),
        }),
    ];
}
function hasExplicitConstraint(hints) {
    return (hints.researchPolicy !== 'allowed' ||
        hints.delegationPreference !== 'ask-me-first' ||
        hints.constraints.length > 0);
}
function evaluateHints(hints, input) {
    const appliedTo = [];
    const ignoredBecause = [];
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
    }
    else if (hints.inferredStage || hints.requestedAction || hints.inferredArtifactTarget) {
        ignoredBecause.push('no failed-gate-free entry routing window');
    }
    const adapterSelectionEligible = input.artifactState.equivalentAdapterCount > 1;
    const adapterPreferenceRequested = hints.explicitRolePreference.length > 0 ||
        hints.researchPolicy !== 'allowed' ||
        hints.constraints.length > 0;
    if (adapterSelectionEligible && adapterPreferenceRequested) {
        appliedTo.push('adapter-selection');
    }
    else if (adapterPreferenceRequested) {
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
function resolvePromptHintUsage(input) {
    const filteredModel = input.modelHintsCandidate
        ? (0, model_governance_policy_filter_1.filterModelGovernanceHintCandidate)(input.modelHintsCandidate, {
            gateFailure: input.gateFailure,
            artifactState: input.artifactState,
        })
        : null;
    const compatModelHints = filteredModel?.filteredHints
        ? (0, model_governance_policy_filter_1.toPromptRoutingHintsCompat)(filteredModel.filteredHints)
        : null;
    const record = {
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
        filteredModelHints: filteredModel?.filteredHints ?? null,
        executionIntentCandidate: null,
        executionPlanDecision: null,
        blockerOwnershipAffected: false,
    };
    const hints = input.promptHints;
    if (hints) {
        const promptUsage = evaluateHints(hints, input);
        record.hintAppliedTo.push(...promptUsage.appliedTo);
        record.hintIgnoredBecause.push(...promptUsage.ignoredBecause);
    }
    if (filteredModel) {
        record.modelHintDebug = filteredModel.filteredHints?.debug ?? {
            strippedForbiddenOverrides: filteredModel.strippedForbiddenOverrides,
            ignoredBecause: filteredModel.ignoredBecause,
        };
        record.modelHintIgnoredBecause.push(...filteredModel.ignoredBecause);
        if (compatModelHints) {
            const modelUsage = evaluateHints(compatModelHints, input);
            record.modelHintAppliedTo.push(...modelUsage.appliedTo);
            record.modelHintIgnoredBecause.push(...modelUsage.ignoredBecause);
            record.hintAppliedTo.push(...modelUsage.appliedTo);
            record.hintIgnoredBecause.push(...filteredModel.ignoredBecause, ...modelUsage.ignoredBecause);
        }
    }
    record.executionIntentCandidate = buildExecutionIntentCandidate({
        promptHints: input.promptHints,
        modelHints: compatModelHints,
        filteredModelHints: filteredModel?.filteredHints ?? null,
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory,
    });
    record.executionPlanDecision = buildExecutionPlanDecision(input, record.executionIntentCandidate);
    record.hintIgnoredBecause = [...new Set(record.hintIgnoredBecause)];
    record.hintAppliedTo = [...new Set(record.hintAppliedTo)];
    record.modelHintIgnoredBecause = [...new Set(record.modelHintIgnoredBecause)];
    record.modelHintAppliedTo = [...new Set(record.modelHintAppliedTo)];
    return record;
}
function resolvePromptHintUsageFromText(input) {
    const promptHints = input.promptText
        ? (0, prompt_routing_hints_1.resolvePromptRoutingHintsFromText)(input.projectRoot, input.promptText)
        : null;
    return resolvePromptHintUsage({
        stageContextKnown: input.stageContextKnown,
        gateFailure: input.gateFailure,
        artifactState: input.artifactState,
        promptHints,
        modelHintsCandidate: input.modelHintsCandidate,
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory,
    });
}
