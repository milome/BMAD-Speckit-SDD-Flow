import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  assertValidPromptRoutingHints,
  assertValidPromptRoutingRuleSet,
  type PromptRoutingDelegationPreference,
  type PromptRoutingHintConfidence,
  type PromptRoutingHints,
  type PromptRoutingResearchPolicy,
  type PromptRoutingRuleSet,
} from './prompt-routing-hints-schema';

export const DEFAULT_PROMPT_ROUTING_RULES_PATH = path.join(
  '_bmad',
  'bmm',
  'data',
  'prompt-routing-rules.yaml'
);

type AliasHitMap = Record<string, string[]>;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function resolveRulesPath(projectRoot: string, rulesPath = DEFAULT_PROMPT_ROUTING_RULES_PATH): string {
  return path.isAbsolute(rulesPath) ? rulesPath : path.join(projectRoot, rulesPath);
}

function collectAliasHits(aliasMap: Record<string, string[]>, normalizedInput: string): AliasHitMap {
  const hits: AliasHitMap = {};
  for (const [key, aliases] of Object.entries(aliasMap)) {
    const matched = aliases.filter((alias) => normalizedInput.includes(normalizeText(alias)));
    if (matched.length > 0) {
      hits[key] = matched;
    }
  }
  return hits;
}

function pickBestKey(hits: AliasHitMap): string | undefined {
  let bestKey: string | undefined;
  let bestCount = 0;
  for (const [key, aliases] of Object.entries(hits)) {
    if (aliases.length > bestCount) {
      bestKey = key;
      bestCount = aliases.length;
    }
  }
  return bestKey;
}

function flattenAliases(hits: AliasHitMap): string[] {
  return Object.values(hits).flat();
}

function resolveConfidence(
  signalCount: number,
  thresholds: PromptRoutingRuleSet['defaults']['confidenceThresholds']
): PromptRoutingHintConfidence {
  if (signalCount >= thresholds.high) {
    return 'high';
  }
  if (signalCount >= thresholds.medium) {
    return 'medium';
  }
  return 'low';
}

function deriveResearchPolicy(
  rules: PromptRoutingRuleSet,
  normalizedInput: string
): { value: PromptRoutingResearchPolicy; aliases: string[] } {
  const hits = collectAliasHits(rules.researchPolicyAliases, normalizedInput);
  if (hits.forbidden) {
    return { value: 'forbidden', aliases: hits.forbidden };
  }
  if (hits.preferred) {
    return { value: 'preferred', aliases: hits.preferred };
  }
  return { value: rules.defaults.researchPolicy, aliases: [] };
}

function deriveDelegationPreference(
  rules: PromptRoutingRuleSet,
  normalizedInput: string
): { value: PromptRoutingDelegationPreference; aliases: string[] } {
  const hits = collectAliasHits(rules.delegationAliases, normalizedInput);
  if (hits['decide-for-me']) {
    return { value: 'decide-for-me', aliases: hits['decide-for-me'] };
  }
  if (hits['ask-me-first']) {
    return { value: 'ask-me-first', aliases: hits['ask-me-first'] };
  }
  return { value: rules.defaults.delegationPreference, aliases: [] };
}

export function loadPromptRoutingRules(
  projectRoot: string,
  rulesPath = DEFAULT_PROMPT_ROUTING_RULES_PATH
): PromptRoutingRuleSet {
  const absolutePath = resolveRulesPath(projectRoot, rulesPath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = yaml.load(raw) as unknown;
  assertValidPromptRoutingRuleSet(parsed);
  return parsed;
}

export function detectPromptRoutingHints(
  input: string,
  rules: PromptRoutingRuleSet
): PromptRoutingHints {
  const normalizedInput = normalizeText(input);
  const stageHits = collectAliasHits(rules.stageAliases, normalizedInput);
  const actionHits = collectAliasHits(rules.actionAliases, normalizedInput);
  const artifactHits = collectAliasHits(rules.artifactAliases, normalizedInput);
  const roleHits = collectAliasHits(rules.roleAliases, normalizedInput);
  const constraintHits = collectAliasHits(rules.constraintAliases, normalizedInput);
  const researchPolicy = deriveResearchPolicy(rules, normalizedInput);
  const delegationPreference = deriveDelegationPreference(rules, normalizedInput);

  const signalCount =
    (pickBestKey(stageHits) ? 1 : 0) +
    (pickBestKey(actionHits) ? 1 : 0) +
    (pickBestKey(artifactHits) ? 1 : 0) +
    Object.keys(roleHits).length +
    Object.keys(constraintHits).length +
    (researchPolicy.aliases.length > 0 ? 1 : 0) +
    (delegationPreference.aliases.length > 0 ? 1 : 0);

  const hints: PromptRoutingHints = {
    source: 'user-input',
    confidence: resolveConfidence(signalCount, rules.defaults.confidenceThresholds),
    ...(pickBestKey(actionHits) ? { requestedAction: pickBestKey(actionHits) } : {}),
    ...(pickBestKey(stageHits) ? { inferredStage: pickBestKey(stageHits) } : {}),
    ...(pickBestKey(artifactHits) ? { inferredArtifactTarget: pickBestKey(artifactHits) } : {}),
    explicitRolePreference: Object.keys(roleHits),
    researchPolicy: researchPolicy.value,
    delegationPreference: delegationPreference.value,
    constraints: Object.keys(constraintHits),
    overrideAllowed: false,
    debug: {
      score: signalCount,
      normalizedInput,
      matchedStageAliases: flattenAliases(stageHits),
      matchedActionAliases: flattenAliases(actionHits),
      matchedArtifactAliases: flattenAliases(artifactHits),
      matchedRoleAliases: flattenAliases(roleHits),
      matchedResearchPolicyAliases: researchPolicy.aliases,
      matchedDelegationAliases: delegationPreference.aliases,
      matchedConstraintAliases: flattenAliases(constraintHits),
    },
  };

  assertValidPromptRoutingHints(hints);
  return hints;
}

export function resolvePromptRoutingHintsFromText(
  projectRoot: string,
  input: string,
  rulesPath = DEFAULT_PROMPT_ROUTING_RULES_PATH
): PromptRoutingHints {
  const rules = loadPromptRoutingRules(projectRoot, rulesPath);
  return detectPromptRoutingHints(input, rules);
}
