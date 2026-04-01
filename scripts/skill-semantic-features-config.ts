import type {
  PromptRoutingDelegationPreference,
  PromptRoutingResearchPolicy,
} from './prompt-routing-hints-schema';

export interface SkillSemanticKeywordRule {
  tokensAny?: string[];
  phrasesAny?: string[];
}

export interface SkillSemanticFeatureConfigEntry<TValue extends string> {
  value: TValue;
  priority: number;
  weight: number;
  rule: SkillSemanticKeywordRule;
}

export interface SkillSemanticFeaturesConfig {
  stageHints: Array<SkillSemanticFeatureConfigEntry<string>>;
  actionHints: Array<SkillSemanticFeatureConfigEntry<string>>;
  interactionHints: Array<SkillSemanticFeatureConfigEntry<string>>;
  researchPolicyHints: Array<SkillSemanticFeatureConfigEntry<PromptRoutingResearchPolicy>>;
  delegationHints: Array<SkillSemanticFeatureConfigEntry<PromptRoutingDelegationPreference>>;
  constraintHints: Array<SkillSemanticFeatureConfigEntry<string>>;
}

export const SKILL_SEMANTIC_FEATURES_CONFIG: SkillSemanticFeaturesConfig = {
  stageHints: [
    { value: 'architecture', priority: 100, weight: 4, rule: { tokensAny: ['architecture'] } },
    { value: 'readiness', priority: 95, weight: 4, rule: { tokensAny: ['readiness'] } },
    { value: 'plan', priority: 90, weight: 3, rule: { tokensAny: ['plan'] } },
    { value: 'tasks', priority: 85, weight: 3, rule: { tokensAny: ['tasks'] } },
    { value: 'post_audit', priority: 80, weight: 2, rule: { tokensAny: ['audit', 'review'] } },
  ],
  actionHints: [
    { value: 'patch', priority: 100, weight: 4, rule: { tokensAny: ['patch'] } },
    { value: 'review', priority: 95, weight: 3, rule: { tokensAny: ['review'] } },
    { value: 'plan', priority: 90, weight: 3, rule: { tokensAny: ['plan'] } },
    { value: 'implement', priority: 85, weight: 3, rule: { tokensAny: ['implement'] } },
    { value: 'fix', priority: 80, weight: 3, rule: { tokensAny: ['fix'] } },
  ],
  interactionHints: [
    { value: 'party-mode', priority: 100, weight: 6, rule: { phrasesAny: ['party mode'] } },
    {
      value: 'review-first',
      priority: 90,
      weight: 4,
      rule: { phrasesAny: ['critical auditor', 'code reviewer'], tokensAny: ['review'] },
    },
    {
      value: 'implement-first',
      priority: 80,
      weight: 3,
      rule: { tokensAny: ['implement', 'patch', 'fix'] },
    },
  ],
  researchPolicyHints: [
    {
      value: 'forbidden',
      priority: 100,
      weight: 5,
      rule: { phrasesAny: ['do not browse', 'no external browse'], tokensAny: ['forbidden'] },
    },
    {
      value: 'preferred',
      priority: 80,
      weight: 2,
      rule: { phrasesAny: ['research preferred'], tokensAny: ['preferred'] },
    },
  ],
  delegationHints: [
    {
      value: 'ask-me-first',
      priority: 100,
      weight: 4,
      rule: { phrasesAny: ['ask me first'] },
    },
    {
      value: 'decide-for-me',
      priority: 90,
      weight: 3,
      rule: { phrasesAny: ['decide for me'] },
    },
  ],
  constraintHints: [
    {
      value: 'minimal-patch',
      priority: 100,
      weight: 5,
      rule: { phrasesAny: ['minimal patch'] },
    },
    {
      value: 'docs-only',
      priority: 90,
      weight: 4,
      rule: { phrasesAny: ['docs only'] },
    },
    {
      value: 'no-external-browse',
      priority: 95,
      weight: 5,
      rule: { phrasesAny: ['no external browse'] },
    },
  ],
};
