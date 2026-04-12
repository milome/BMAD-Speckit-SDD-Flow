import { describe, expect, it } from 'vitest';
import { resolvePromptHintUsage } from '../../scripts/prompt-routing-governance';

describe('prompt-routing reviewer route explainability', () => {
  it('projects registry-backed reviewer route explainability when code-reviewer is in the governed skill chain', () => {
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
        requestedAction: 'review',
        inferredStage: 'architecture',
        explicitRolePreference: ['code-reviewer'],
        researchPolicy: 'allowed',
        delegationPreference: 'ask-me-first',
        constraints: [],
        overrideAllowed: false,
        debug: {
          score: 4,
          normalizedInput: 'review with code reviewer',
          matchedStageAliases: ['architecture'],
          matchedActionAliases: ['review'],
          matchedArtifactAliases: [],
          matchedRoleAliases: ['code-reviewer'],
          matchedResearchPolicyAliases: [],
          matchedDelegationAliases: [],
          matchedConstraintAliases: [],
        },
      },
      availableSkills: ['speckit-workflow', 'code-reviewer'],
      skillPaths: [
        'D:/skills/speckit-workflow/SKILL.md',
        'D:/skills/code-reviewer/SKILL.md',
      ],
    });

    expect(usage.executionIntentCandidate?.reviewerRouteExplainability).toEqual([
      expect.objectContaining({
        requestedSkillId: 'code-reviewer',
        matchedSkillId: 'code-reviewer',
        reviewerIdentity: 'bmad_code_reviewer',
        registryVersion: 'reviewer_registry_v1',
        sharedCore: expect.objectContaining({
          version: 'reviewer_shared_core_v1',
          rootPath: '_bmad/core/agents/code-reviewer',
        }),
        closeoutRunner: 'runAuditorHost',
        routeReasonSummary: expect.stringContaining('Registry-backed reviewer routing'),
        fallbackStatus: 'fallback_ready',
        isomorphismMaturity: 'projection_wired',
        complexitySource: expect.stringContaining('legacy skill narrative cleanup'),
        remainingBlocker: expect.stringContaining('rollout gate'),
        supportedProfiles: expect.arrayContaining(['implement_audit', 'bugfix_doc_audit']),
        hosts: expect.objectContaining({
          cursor: expect.objectContaining({
            carrierSourcePath: '_bmad/cursor/agents/code-reviewer.md',
            runtimeTargetPath: '.cursor/agents/code-reviewer.md',
            preferredRoute: expect.objectContaining({
              tool: 'cursor-task',
              subtypeOrExecutor: 'code-reviewer',
            }),
          }),
          claude: expect.objectContaining({
            carrierSourcePath: '_bmad/claude/agents/code-reviewer.md',
            runtimeTargetPath: '.claude/agents/code-reviewer.md',
            preferredRoute: expect.objectContaining({
              tool: 'Agent',
              subtypeOrExecutor: 'code-reviewer',
            }),
          }),
        }),
      }),
    ]);

    expect(usage.executionPlanDecision?.reviewerRouteExplainability).toEqual(
      usage.executionIntentCandidate?.reviewerRouteExplainability
    );
  });
});
