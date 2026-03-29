#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceExecutionResult} GovernanceExecutionResult
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceExecutorRoutingProjection} GovernanceExecutorRoutingProjection
 * @typedef {import('../../../scripts/governance-hook-types').GovernancePresentation} GovernancePresentation
 */

const {
  buildGovernanceLatestRawEventSectionLines,
  normalizeGovernanceRunnerSummaryLines,
} = require('./governance-runner-summary-format.js');

/**
 * @param {unknown} value
 * @returns {string}
 */
function yesNoOrUnknown(value) {
  if (value === true) {
    return 'yes';
  }
  if (value === false) {
    return 'no';
  }
  return '(unknown)';
}

/**
 * @param {GovernanceExecutionResult['packetPaths'] | null | undefined} packetPaths
 * @returns {string}
 */
function buildPacketPathsValue(packetPaths) {
  if (!packetPaths || typeof packetPaths !== 'object') {
    return '(none)';
  }

  const entries = Object.entries(packetPaths).filter((entry) => Boolean(entry[1]));
  if (entries.length === 0) {
    return '(none)';
  }

  return entries.map(([hostKind, packetPath]) => `${hostKind}: ${packetPath}`).join(' | ');
}

/**
 * @param {unknown} semanticSkillFeatures
 * @returns {string}
 */
function buildSemanticSkillFeaturesValue(semanticSkillFeatures) {
  if (!Array.isArray(semanticSkillFeatures) || semanticSkillFeatures.length === 0) {
    return '(none)';
  }

  const renderedFeatures = semanticSkillFeatures
    .map((feature) => {
      if (!feature || typeof feature !== 'object') {
        return null;
      }
      const record = /** @type {Record<string, unknown>} */ (feature);
      const skillId = typeof record.skillId === 'string' ? record.skillId : '(unknown)';
      const stageHints = Array.isArray(record.stageHints) ? record.stageHints.join('|') : '';
      const actionHints = Array.isArray(record.actionHints) ? record.actionHints.join('|') : '';
      const interactionHints = Array.isArray(record.interactionHints)
        ? record.interactionHints.join('|')
        : '';
      const researchPolicyHints = Array.isArray(record.researchPolicyHints)
        ? record.researchPolicyHints.join('|')
        : '';
      const delegationHints = Array.isArray(record.delegationHints)
        ? record.delegationHints.join('|')
        : '';
      const constraintHints = Array.isArray(record.constraintHints)
        ? record.constraintHints.join('|')
        : '';
      const details = [
        stageHints ? `stage=${stageHints}` : null,
        actionHints ? `action=${actionHints}` : null,
        interactionHints ? `interaction=${interactionHints}` : null,
        researchPolicyHints ? `research=${researchPolicyHints}` : null,
        delegationHints ? `delegation=${delegationHints}` : null,
        constraintHints ? `constraints=${constraintHints}` : null,
      ]
        .filter(Boolean)
        .join('; ');
      return `${skillId}${details ? ` [${details}]` : ''}`;
    })
    .filter(Boolean);

  return [...new Set(renderedFeatures)].join(' || ');
}

/**
 * @param {unknown} semanticFeatureTopN
 * @returns {string}
 */
function buildSemanticFeatureTopNValue(semanticFeatureTopN) {
  if (!semanticFeatureTopN || typeof semanticFeatureTopN !== 'object') {
    return '(none)';
  }

  const record = /** @type {Record<string, unknown>} */ (semanticFeatureTopN);
  const dimensions = [
    'stageHints',
    'actionHints',
    'interactionHints',
    'researchPolicyHints',
    'delegationHints',
    'constraintHints',
  ];

  const rendered = dimensions
    .map((dimension) => {
      const values = Array.isArray(record[dimension]) ? record[dimension] : [];
      if (values.length === 0) {
        return null;
      }
      const compact = values
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const candidate = /** @type {Record<string, unknown>} */ (item);
          const value = typeof candidate.value === 'string' ? candidate.value : '(unknown)';
          const score = typeof candidate.score === 'number' ? candidate.score : 0;
          const provenance = Array.isArray(candidate.provenanceSkillIds)
            ? candidate.provenanceSkillIds.join('|')
            : '';
          return `${value}@${score}${provenance ? `<-${provenance}` : ''}`;
        })
        .filter(Boolean)
        .join(', ');
      return compact ? `${dimension}=${compact}` : null;
    })
    .filter(Boolean);

  return rendered.length > 0 ? rendered.join(' || ') : '(none)';
}

/**
 * @param {unknown} recommendationItems
 * @returns {string}
 */
function buildProviderRecommendationItemsValue(recommendationItems) {
  if (!Array.isArray(recommendationItems) || recommendationItems.length === 0) {
    return '(none)';
  }

  return recommendationItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = /** @type {Record<string, unknown>} */ (item);
      const value = typeof record.value === 'string' ? record.value : '(unknown)';
      const source = typeof record.source === 'string' ? record.source : '(unknown)';
      const reason = typeof record.reason === 'string' ? record.reason : '(none)';
      const confidence = typeof record.confidence === 'string' ? record.confidence : '(unknown)';
      const consumed = record.consumed === true ? 'yes' : record.consumed === false ? 'no' : '(unknown)';
      const matchedSkillId = typeof record.matchedSkillId === 'string' ? record.matchedSkillId : '(none)';
      const matchedBy = typeof record.matchedBy === 'string' ? record.matchedBy : '(none)';
      const matchScore = typeof record.matchScore === 'number' ? record.matchScore : '(none)';
      const filteredBecause = Array.isArray(record.filteredBecause)
        ? record.filteredBecause.join('|') || '(none)'
        : '(none)';
      return `${value} [source=${source}; confidence=${confidence}; consumed=${consumed}; matchedSkillId=${matchedSkillId}; matchedBy=${matchedBy}; matchScore=${matchScore}; reason=${reason}; filteredBecause=${filteredBecause}]`;
    })
    .filter(Boolean)
    .join(' || ');
}

/**
 * @param {GovernanceExecutionResult | null | undefined} [input]
 * @returns {string[]}
 */
function buildGovernanceStructuredMetadataSectionLines(input = {}) {
  const normalizedInput = input ?? {};
  const executorRouting =
    normalizedInput.executorRouting && typeof normalizedInput.executorRouting === 'object'
      ? normalizedInput.executorRouting
      : /** @type {GovernanceExecutorRoutingProjection} */ ({});
  const prioritizedSignals = Array.isArray(executorRouting.prioritizedSignals)
    ? executorRouting.prioritizedSignals
    : [];
  const executionIntentCandidate =
    normalizedInput.executionIntentCandidate &&
    typeof normalizedInput.executionIntentCandidate === 'object'
      ? normalizedInput.executionIntentCandidate
      : {};
  const executionPlanDecision =
    normalizedInput.executionPlanDecision &&
    typeof normalizedInput.executionPlanDecision === 'object'
      ? normalizedInput.executionPlanDecision
      : {};
  const executionSkillChain = Array.isArray(executionPlanDecision.skillChain)
    ? executionPlanDecision.skillChain
    : Array.isArray(executionIntentCandidate.skillChain)
      ? executionIntentCandidate.skillChain
      : [];
  const providerRecommendedSkillChain = Array.isArray(
    executionPlanDecision.providerRecommendedSkillChain
  )
    ? executionPlanDecision.providerRecommendedSkillChain
    : Array.isArray(executionIntentCandidate.providerRecommendedSkillChain)
      ? executionIntentCandidate.providerRecommendedSkillChain
      : [];
  const availableSkills = Array.isArray(executionPlanDecision.availableSkills)
    ? executionPlanDecision.availableSkills
    : Array.isArray(executionIntentCandidate.availableSkills)
      ? executionIntentCandidate.availableSkills
      : [];
  const matchedAvailableSkills = Array.isArray(executionPlanDecision.matchedAvailableSkills)
    ? executionPlanDecision.matchedAvailableSkills
    : Array.isArray(executionIntentCandidate.matchedAvailableSkills)
      ? executionIntentCandidate.matchedAvailableSkills
      : [];
  const missingSkills = Array.isArray(executionPlanDecision.missingSkills)
    ? executionPlanDecision.missingSkills
    : Array.isArray(executionIntentCandidate.missingSkills)
      ? executionIntentCandidate.missingSkills
      : [];
  const executionSubagentRoles = Array.isArray(executionPlanDecision.subagentRoles)
    ? executionPlanDecision.subagentRoles
    : Array.isArray(executionIntentCandidate.subagentRoles)
      ? executionIntentCandidate.subagentRoles
      : [];
  const providerRecommendedSubagentRoles = Array.isArray(
    executionPlanDecision.providerRecommendedSubagentRoles
  )
    ? executionPlanDecision.providerRecommendedSubagentRoles
    : Array.isArray(executionIntentCandidate.providerRecommendedSubagentRoles)
      ? executionIntentCandidate.providerRecommendedSubagentRoles
      : [];
  const providerRecommendationItems =
    executionPlanDecision.providerRecommendationItems &&
    typeof executionPlanDecision.providerRecommendationItems === 'object'
      ? executionPlanDecision.providerRecommendationItems
      : executionIntentCandidate.providerRecommendationItems &&
          typeof executionIntentCandidate.providerRecommendationItems === 'object'
        ? executionIntentCandidate.providerRecommendationItems
        : { skills: [], subagentRoles: [] };
  const recommendedSkillLines = providerRecommendationItems.skills.filter((item) => item && item.consumed === true);
  const skippedSkillLines = providerRecommendationItems.skills.filter((item) => item && item.consumed !== true);
  const recommendedRoleLines = providerRecommendationItems.subagentRoles.filter((item) => item && item.consumed === true);
  const skippedRoleLines = providerRecommendationItems.subagentRoles.filter((item) => item && item.consumed !== true);
  const governanceBlockedBy = Array.isArray(executionPlanDecision.blockedByGovernance)
    ? executionPlanDecision.blockedByGovernance
    : [];
  const governanceConstraints = Array.isArray(executionPlanDecision.governanceConstraints)
    ? executionPlanDecision.governanceConstraints
    : [];
  const semanticSkillFeatures = Array.isArray(executionPlanDecision.semanticSkillFeatures)
    ? executionPlanDecision.semanticSkillFeatures
    : Array.isArray(executionIntentCandidate.semanticSkillFeatures)
      ? executionIntentCandidate.semanticSkillFeatures
      : [];
  const semanticFeatureTopN =
    executionPlanDecision.semanticFeatureTopN &&
    typeof executionPlanDecision.semanticFeatureTopN === 'object'
      ? executionPlanDecision.semanticFeatureTopN
      : executionIntentCandidate.semanticFeatureTopN &&
          typeof executionIntentCandidate.semanticFeatureTopN === 'object'
        ? executionIntentCandidate.semanticFeatureTopN
        : null;

  return [
    '## Governance Structured Metadata',
    '',
    `- Should Continue: ${yesNoOrUnknown(normalizedInput.shouldContinue)}`,
    `- Stop Reason: ${normalizedInput.stopReason || '(none)'}`,
    `- Loop State ID: ${normalizedInput.loopStateId || '(none)'}`,
    `- Current Attempt Number: ${
      normalizedInput.currentAttemptNumber !== undefined && normalizedInput.currentAttemptNumber !== null
        ? normalizedInput.currentAttemptNumber
        : '(none)'
    }`,
    `- Next Attempt Number: ${
      normalizedInput.nextAttemptNumber !== undefined && normalizedInput.nextAttemptNumber !== null
        ? normalizedInput.nextAttemptNumber
        : '(none)'
    }`,
    `- Artifact Path: ${normalizedInput.artifactPath || '(none)'}`,
    `- Routing Mode: ${executorRouting.routingMode || '(unknown)'}`,
    `- Executor Route: ${executorRouting.executorRoute || '(unknown)'}`,
    `- Prioritized Signals: ${prioritizedSignals.join(', ') || '(none)'}`,
    `- Execution Stage: ${executionPlanDecision.stage || executionIntentCandidate.stage || '(none)'}`,
    `- Execution Action: ${executionPlanDecision.action || executionIntentCandidate.action || '(none)'}`,
    `- Interaction Mode: ${
      executionPlanDecision.interactionMode || executionIntentCandidate.interactionMode || '(none)'
    }`,
    `- Skill Availability Mode: ${
      executionPlanDecision.skillAvailabilityMode ||
      executionIntentCandidate.skillAvailabilityMode ||
      '(none)'
    }`,
    `- Research Policy: ${
      executionPlanDecision.researchPolicy || executionIntentCandidate.researchPolicy || '(none)'
    }`,
    `- Delegation Preference: ${
      executionPlanDecision.delegationPreference ||
      executionIntentCandidate.delegationPreference ||
      '(none)'
    }`,
    `- Available Skills: ${availableSkills.join(', ') || '(none)'}`,
    `- Matched Available Skills: ${matchedAvailableSkills.join(', ') || '(none)'}`,
    `- Missing Skills: ${missingSkills.join(', ') || '(none)'}`,
    `- Provider Recommended Skill Chain: ${providerRecommendedSkillChain.join(', ') || '(none)'}`,
    `- Provider Recommended Subagent Roles: ${providerRecommendedSubagentRoles.join(', ') || '(none)'}`,
    `- Provider Recommended vs Executed (Skills): recommended=${buildProviderRecommendationItemsValue(recommendedSkillLines)} || skipped=${buildProviderRecommendationItemsValue(skippedSkillLines)}`,
    `- Provider Recommended vs Executed (Subagent Roles): recommended=${buildProviderRecommendationItemsValue(recommendedRoleLines)} || skipped=${buildProviderRecommendationItemsValue(skippedRoleLines)}`,
    `- Execution Skill Chain: ${executionSkillChain.join(', ') || '(none)'}`,
    `- Semantic Skill Features: ${buildSemanticSkillFeaturesValue(semanticSkillFeatures)}`,
    `- Semantic Feature Top-N: ${buildSemanticFeatureTopNValue(semanticFeatureTopN)}`,
    `- Execution Subagent Roles: ${executionSubagentRoles.join(', ') || '(none)'}`,
    `- Governance Constraints: ${governanceConstraints.join(', ') || '(none)'}`,
    `- Blocked By Governance: ${governanceBlockedBy.join(', ') || '(none)'}`,
    `- Packet Paths: ${buildPacketPathsValue(normalizedInput.packetPaths)}`,
    '',
  ];
}

/**
 * @param {GovernanceExecutionResult | null | undefined} [input]
 * @returns {GovernancePresentation}
 */
function buildGovernanceRunnerCliPresentation(input = {}) {
  const normalizedInput = input ?? {};
  const runnerSummaryLines = normalizeGovernanceRunnerSummaryLines(normalizedInput.runnerSummaryLines);
  const structuredMetadataLines = buildGovernanceStructuredMetadataSectionLines(normalizedInput);
  const rawEventLines = buildGovernanceLatestRawEventSectionLines(runnerSummaryLines);
  return {
    structuredMetadataLines,
    rawEventLines,
    combinedLines: [...structuredMetadataLines, ...rawEventLines],
  };
}

/**
 * @param {GovernancePresentation | null | undefined} presentation
 * @param {(line: string) => void | null | undefined} log
 * @returns {void}
 */
function printGovernanceRunnerCliPresentation(presentation, log) {
  const sink = typeof log === 'function' ? log : console.log;
  const lines =
    presentation && Array.isArray(presentation.combinedLines) ? presentation.combinedLines : [];
  for (const line of lines) {
    sink(line);
  }
}

module.exports = {
  buildGovernanceRunnerCliPresentation,
  buildGovernanceStructuredMetadataSectionLines,
  printGovernanceRunnerCliPresentation,
};
