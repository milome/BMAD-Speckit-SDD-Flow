import { describe, expect, it } from 'vitest';
import { resolvePromptRoutingHintsFromText } from '../../scripts/prompt-routing-hints';
import { resolvePromptHintUsage } from '../../scripts/prompt-routing-governance';

const repoRoot = process.cwd();

describe('prompt-routing governance consumption order', () => {
  it('allows hints to influence entry routing before any failed gate exists', () => {
    const hints = resolvePromptRoutingHintsFromText(
      repoRoot,
      '直接给我 architecture patch plan，使用 party-mode，最小修复。'
    );

    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: false,
        blockerOwnershipLocked: false,
      },
      artifactState: {
        rootTargetLocked: false,
        equivalentAdapterCount: 2,
      },
      promptHints: hints,
    });

    expect(usage.consumedAfter).toBe(
      'stage context -> gate failure -> artifact state -> PromptRoutingHints'
    );
    expect(usage.hintAppliedTo).toContain('entry-routing');
    expect(usage.hintAppliedTo).toContain('adapter-selection');
    expect(usage.blockerOwnershipAffected).toBe(false);
  });

  it('filters model hints before governance consumption and keeps them advisory-only', () => {
    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 2,
      },
      modelHintsCandidate: {
        source: 'model-provider',
        providerId: 'stub-model-governance-provider',
        providerMode: 'stub',
        confidence: 'high',
        suggestedStage: 'architecture',
        suggestedAction: 'patch',
        explicitRolePreference: ['party-mode'],
        recommendedSkillChain: ['speckit-workflow'],
        recommendedSubagentRoles: ['code-reviewer'],
        recommendedSkillItems: [
          {
            value: 'speckit-workflow',
            reason: 'Provider wants the workflow scaffold retained.',
            confidence: 'high',
          },
          {
            value: 'provider-unavailable-skill',
            reason: 'Provider suggested an unavailable skill.',
            confidence: 'medium',
          },
        ],
        recommendedSubagentRoleItems: [
          {
            value: 'code-reviewer',
            reason: 'Provider wants reviewer coverage retained.',
            confidence: 'medium',
          },
        ],
        researchPolicy: 'forbidden',
        delegationPreference: 'decide-for-me',
        constraints: ['docs-only'],
        rationale: 'Keep remediation in documentation-only path.',
        overrideAllowed: false,
        forbiddenOverrides: {
          blockerOwnership: 'Architect',
          failedCheckSeverity: 'warning',
        },
      },
    });

    expect(usage.blockerOwnershipAffected).toBe(false);
    expect(usage.modelHintPresent).toBe(true);
    expect(usage.modelHintAppliedTo).toContain('adapter-selection');
    expect(usage.modelHintAppliedTo).toContain('interaction-style');
    expect(usage.modelHintAppliedTo).toContain('research-policy');
    expect(usage.modelHintIgnoredBecause).toContain('blocker ownership locked');
    expect(usage.modelHintIgnoredBecause).toContain('failed-check severity is governance-owned');
    expect(usage.modelHintDebug?.strippedForbiddenOverrides).toContain('blockerOwnership');
  });

  it('keeps blocker ownership stable after a failed gate and only allows adapter-level influence', () => {
    const hints = resolvePromptRoutingHintsFromText(
      repoRoot,
      '架构这里继续用 party-mode 深度研究，但不要改 blocker owner。'
    );

    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 3,
      },
      promptHints: hints,
    });

    expect(usage.hintAppliedTo).not.toContain('entry-routing');
    expect(usage.hintAppliedTo).toContain('adapter-selection');
    expect(usage.hintIgnoredBecause).toContain('blocker ownership locked');
    expect(usage.hintIgnoredBecause).toContain('artifact target locked');
    expect(usage.blockerOwnershipAffected).toBe(false);
  });

  it('records low-confidence hints as ignored when no explicit constraint exists', () => {
    const hints = resolvePromptRoutingHintsFromText(repoRoot, '帮我看看这个');

    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 1,
      },
      promptHints: hints,
    });

    expect(usage.hintAppliedTo).toHaveLength(0);
    expect(usage.hintIgnoredBecause).toContain('low confidence');
    expect(usage.blockerOwnershipAffected).toBe(false);
  });

  it('builds a governed execution intent decision from prompt and model hints', () => {
    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 2,
      },
      promptHints: {
        source: 'user-input',
        confidence: 'high',
        requestedAction: 'patch',
        inferredStage: 'architecture',
        explicitRolePreference: ['party-mode'],
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        constraints: ['minimal-patch'],
        overrideAllowed: false,
        debug: {
          score: 5,
          normalizedInput: 'architecture patch plan',
          matchedStageAliases: ['architecture'],
          matchedActionAliases: ['patch'],
          matchedArtifactAliases: [],
          matchedRoleAliases: ['party-mode'],
          matchedResearchPolicyAliases: ['forbidden'],
          matchedDelegationAliases: [],
          matchedConstraintAliases: ['minimal-patch'],
        },
      },
      modelHintsCandidate: {
        source: 'model-provider',
        providerId: 'stub-model-governance-provider',
        providerMode: 'stub',
        confidence: 'high',
        suggestedStage: 'architecture',
        suggestedAction: 'review',
        explicitRolePreference: ['critical-auditor', 'code-reviewer'],
        recommendedSkillChain: ['speckit-workflow'],
        recommendedSubagentRoles: ['code-reviewer'],
        recommendedSkillItems: [
          {
            value: 'speckit-workflow',
            reason: 'Provider wants the workflow scaffold retained.',
            confidence: 'high',
          },
        ],
        recommendedSubagentRoleItems: [
          {
            value: 'code-reviewer',
            reason: 'Provider wants reviewer coverage retained.',
            confidence: 'medium',
          },
        ],
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        constraints: ['docs-only'],
        rationale: 'Use review support while keeping the patch bounded.',
        overrideAllowed: false,
        forbiddenOverrides: {
          blockerOwnership: 'Architect',
          artifactRootTarget: 'architecture.md',
        },
      },
    });

    expect(usage.executionIntentCandidate).toMatchObject({
      source: 'merged',
      stage: 'architecture',
      action: 'patch',
      interactionMode: 'party-mode',
      researchPolicy: 'forbidden',
      delegationPreference: 'ask-me-first',
      advisoryOnly: true,
    });
    expect(usage.executionIntentCandidate?.skillChain).toEqual(
      expect.arrayContaining(['speckit-workflow', 'party-mode', 'code-reviewer'])
    );
    expect(usage.executionIntentCandidate?.subagentRoles).toEqual(
      expect.arrayContaining(['critical-auditor', 'code-reviewer'])
    );
    expect(usage.executionIntentCandidate?.providerRecommendedSkillChain).toEqual([
      'speckit-workflow',
    ]);
    expect(usage.executionIntentCandidate?.providerRecommendedSubagentRoles).toEqual([
      'code-reviewer',
    ]);
    expect(usage.executionIntentCandidate?.providerRecommendationItems.skills).toEqual([
      {
        value: 'speckit-workflow',
        source: 'model-provider',
        reason: 'Provider wants the workflow scaffold retained.',
        confidence: 'high',
        consumed: true,
        matchedBy: 'unmatched',
        filteredBecause: ['not-available-in-inventory'],
      },
    ]);
    expect(usage.executionIntentCandidate?.providerRecommendationItems.subagentRoles).toEqual([
      {
        value: 'code-reviewer',
        source: 'model-provider',
        reason: 'Provider wants reviewer coverage retained.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);

    expect(usage.executionPlanDecision).toMatchObject({
      source: 'merged',
      stage: 'architecture',
      action: 'patch',
      interactionMode: 'party-mode',
      researchPolicy: 'forbidden',
      delegationPreference: 'ask-me-first',
      advisoryOnly: false,
    });
    expect(usage.executionPlanDecision?.governanceConstraints).toEqual(
      expect.arrayContaining(['blocker ownership locked', 'artifact target locked'])
    );
    expect(usage.executionPlanDecision?.blockedByGovernance).toContain('entry-routing');
    expect(usage.executionPlanDecision?.skillChain).toEqual(
      expect.arrayContaining(['speckit-workflow', 'party-mode', 'code-reviewer'])
    );
    expect(usage.executionPlanDecision?.providerRecommendedSkillChain).toEqual([
      'speckit-workflow',
    ]);
    expect(usage.executionPlanDecision?.providerRecommendedSubagentRoles).toEqual([
      'code-reviewer',
    ]);
    expect(usage.executionPlanDecision?.providerRecommendationItems.skills).toEqual([
      {
        value: 'speckit-workflow',
        source: 'model-provider',
        reason: 'Provider wants the workflow scaffold retained.',
        confidence: 'high',
        consumed: true,
        matchedBy: 'unmatched',
        filteredBecause: ['not-available-in-inventory'],
      },
    ]);
    expect(usage.executionPlanDecision?.providerRecommendationItems.subagentRoles).toEqual([
      {
        value: 'code-reviewer',
        source: 'model-provider',
        reason: 'Provider wants reviewer coverage retained.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);
  });

  it('treats available skill inventory as advisory on intent and execution-filtered on plan decision', () => {
    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 2,
      },
      availableSkills: [
        'speckit-workflow',
        'team-party-mode-facilitator',
        'elite-code-reviewer-lifecycle',
      ],
      skillPaths: [
        'D:/skills/speckit-workflow/SKILL.md',
        'D:/skills/team-party-mode-facilitator/SKILL.md',
        'D:/skills/elite-code-reviewer-lifecycle/SKILL.md',
      ],
      skillInventory: [
        {
          skillId: 'speckit-workflow',
          path: 'D:/skills/speckit-workflow/SKILL.md',
        },
        {
          skillId: 'team-party-mode-facilitator',
          path: 'D:/skills/team-party-mode-facilitator/SKILL.md',
        },
        {
          skillId: 'elite-code-reviewer-lifecycle',
          path: 'D:/skills/elite-code-reviewer-lifecycle/SKILL.md',
        },
      ],
      promptHints: {
        source: 'user-input',
        confidence: 'high',
        requestedAction: 'patch',
        inferredStage: 'architecture',
        explicitRolePreference: ['party-mode', 'critical-auditor', 'code-reviewer'],
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        constraints: ['minimal-patch'],
        overrideAllowed: false,
        debug: {
          score: 6,
          normalizedInput: 'architecture patch critical auditor party-mode',
          matchedStageAliases: ['architecture'],
          matchedActionAliases: ['patch'],
          matchedArtifactAliases: [],
          matchedRoleAliases: ['party-mode', 'critical-auditor'],
          matchedResearchPolicyAliases: ['forbidden'],
          matchedDelegationAliases: [],
          matchedConstraintAliases: ['minimal-patch'],
        },
      },
    });

    expect(usage.executionIntentCandidate).toMatchObject({
      source: 'prompt-hints',
      skillAvailabilityMode: 'advisory-only',
      availableSkills: [
        'speckit-workflow',
        'team-party-mode-facilitator',
        'elite-code-reviewer-lifecycle',
      ],
      matchedAvailableSkills: [
        'speckit-workflow',
        'team-party-mode-facilitator',
        'elite-code-reviewer-lifecycle',
      ],
      missingSkills: [],
      advisoryOnly: true,
    });
    expect(usage.executionIntentCandidate?.skillChain).toEqual(
      expect.arrayContaining(['speckit-workflow', 'party-mode', 'code-reviewer'])
    );

    expect(usage.executionPlanDecision).toMatchObject({
      source: 'prompt-hints',
      skillAvailabilityMode: 'execution-filtered',
      availableSkills: [
        'speckit-workflow',
        'team-party-mode-facilitator',
        'elite-code-reviewer-lifecycle',
      ],
      matchedAvailableSkills: [
        'speckit-workflow',
        'team-party-mode-facilitator',
        'elite-code-reviewer-lifecycle',
      ],
      missingSkills: [],
      advisoryOnly: false,
    });
    expect(usage.executionPlanDecision?.skillChain).toEqual([
      'speckit-workflow',
      'team-party-mode-facilitator',
      'elite-code-reviewer-lifecycle',
    ]);
    expect(usage.executionPlanDecision?.blockedByGovernance).toEqual(
      expect.arrayContaining(['entry-routing', 'blocker-ownership', 'artifact-target'])
    );
  });

  it('uses skill metadata text for token-overlap matching when skill ids do not directly match', () => {
    const usage = resolvePromptHintUsage({
      stageContextKnown: true,
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 2,
      },
      skillInventory: [
        {
          skillId: 'stage-audit-workflow',
          path: 'D:/skills/stage-audit-workflow/SKILL.md',
          title: 'Stage Audit Workflow',
          description:
            'Facilitates party mode architecture debate and multi-role review orchestration.',
          summary: 'Use for party mode facilitation during architecture review and patch planning.',
        },
      ],
      promptHints: {
        source: 'user-input',
        confidence: 'high',
        requestedAction: 'patch',
        inferredStage: 'architecture',
        explicitRolePreference: ['party-mode'],
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        constraints: ['minimal-patch'],
        overrideAllowed: false,
        debug: {
          score: 6,
          normalizedInput: 'architecture patch party mode',
          matchedStageAliases: ['architecture'],
          matchedActionAliases: ['patch'],
          matchedArtifactAliases: [],
          matchedRoleAliases: ['party-mode'],
          matchedResearchPolicyAliases: ['forbidden'],
          matchedDelegationAliases: [],
          matchedConstraintAliases: ['minimal-patch'],
        },
      },
    });

    expect(usage.executionIntentCandidate).toMatchObject({
      interactionMode: 'party-mode',
      matchedAvailableSkills: ['stage-audit-workflow'],
      missingSkills: [],
      skillAvailabilityMode: 'advisory-only',
      rationale: 'Derived from user prompt hints and matched skill semantic features.',
    });
    expect(usage.executionIntentCandidate?.skillMatchReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestedSkill: 'party-mode',
          matchedSkillId: 'stage-audit-workflow',
          substringMatch: false,
          overlapTokens: ['party', 'mode'],
          title: 'Stage Audit Workflow',
        }),
      ])
    );
    expect(usage.executionIntentCandidate?.semanticSkillFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 'stage-audit-workflow',
          stageHints: expect.arrayContaining(['architecture', 'post_audit']),
          stageHintScores: expect.objectContaining({ architecture: 10004, post_audit: 8002 }),
          actionHints: expect.arrayContaining(['review', 'patch']),
          actionHintScores: expect.objectContaining({ patch: 10004, review: 9503 }),
          interactionHints: expect.arrayContaining([
            'party-mode',
            'review-first',
            'implement-first',
          ]),
          interactionHintScores: expect.objectContaining({
            'party-mode': 10006,
            'review-first': 9004,
            'implement-first': 8003,
          }),
        }),
      ])
    );
    expect(usage.executionIntentCandidate?.semanticFeatureTopN).toMatchObject({
      stageHints: expect.arrayContaining([
        expect.objectContaining({
          value: 'architecture',
          score: 10004,
          provenanceSkillIds: ['stage-audit-workflow'],
        }),
      ]),
      interactionHints: expect.arrayContaining([
        expect.objectContaining({
          value: 'party-mode',
          score: 10006,
          provenanceSkillIds: ['stage-audit-workflow'],
        }),
      ]),
    });
    expect(usage.executionPlanDecision).toMatchObject({
      skillChain: ['stage-audit-workflow'],
      matchedAvailableSkills: ['stage-audit-workflow'],
      missingSkills: [],
      skillAvailabilityMode: 'execution-filtered',
      semanticSkillFeatures: expect.arrayContaining([
        expect.objectContaining({ skillId: 'stage-audit-workflow' }),
      ]),
      semanticFeatureTopN: expect.objectContaining({
        actionHints: expect.arrayContaining([
          expect.objectContaining({ value: 'patch', score: 10004 }),
        ]),
      }),
    });
    expect(usage.executionPlanDecision?.skillMatchReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestedSkill: 'party-mode',
          matchedSkillId: 'stage-audit-workflow',
          overlapTokens: ['party', 'mode'],
        }),
      ])
    );
  });
});
