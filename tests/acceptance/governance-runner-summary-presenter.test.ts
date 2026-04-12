import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

describe('governance runner summary presenter', () => {
  it('separates structured metadata lines from raw event lines and exposes a combined CLI presentation', () => {
    const {
      buildGovernanceRunnerCliPresentation,
      printGovernanceRunnerCliPresentation,
    } = require('../../_bmad/runtime/hooks/governance-runner-summary-presenter.cjs') as {
      buildGovernanceRunnerCliPresentation: (input: {
        executionPlanDecision?: Record<string, unknown>;
        shouldContinue?: boolean | null;
        stopReason?: string | null;
        loopStateId?: string | null;
        currentAttemptNumber?: number | null;
        nextAttemptNumber?: number | null;
        artifactPath?: string | null;
        packetPaths?: Record<string, string>;
        executorRouting?: {
          routingMode?: string;
          executorRoute?: string;
          prioritizedSignals?: string[];
        } | null;
        runnerSummaryLines?: string[];
      }) => {
        structuredMetadataLines: string[];
        rawEventLines: string[];
        combinedLines: string[];
      };
      printGovernanceRunnerCliPresentation: (
        presentation: {
          combinedLines?: string[];
        },
        log?: (line: string) => void
      ) => void;
    };

    const presentation = buildGovernanceRunnerCliPresentation({
      executionPlanDecision: {
        source: 'prompt-hints',
        stage: 'architecture',
        action: 'patch',
        skillChain: ['provider-recommended-skill', 'speckit-workflow'],
        subagentRoles: ['provider-reviewer'],
        providerRecommendedSkillChain: ['provider-recommended-skill'],
        providerRecommendedSubagentRoles: ['provider-reviewer'],
        providerRecommendationItems: {
          skills: [
            {
              value: 'provider-recommended-skill',
              source: 'model-provider',
              reason: 'Provider wants a focused remediation lane.',
              confidence: 'high',
              consumed: true,
              matchedSkillId: 'provider-recommended-skill',
              matchedBy: 'exact-id',
              matchScore: 10000,
              filteredBecause: [],
            },
            {
              value: 'provider-unavailable-skill',
              source: 'model-provider',
              reason: 'Provider suggested an unavailable skill.',
              confidence: 'medium',
              consumed: false,
              matchedBy: 'unmatched',
              filteredBecause: ['not-available-in-inventory'],
            },
          ],
          subagentRoles: [
            {
              value: 'provider-reviewer',
              source: 'model-provider',
              reason: 'Provider wants a reviewer role preserved.',
              confidence: 'medium',
              consumed: true,
              filteredBecause: [],
            },
          ],
        },
        availableSkills: ['speckit-workflow'],
        skillPaths: ['D:/skills/speckit-workflow/SKILL.md'],
        matchedAvailableSkills: ['speckit-workflow'],
        missingSkills: [],
        skillMatchReasons: [],
        semanticSkillFeatures: [
          {
            skillId: 'speckit-workflow',
            stageHints: ['architecture'],
            stageHintScores: { architecture: 10004 },
            actionHints: ['patch'],
            actionHintScores: { patch: 10004 },
            interactionHints: ['implement-first'],
            interactionHintScores: { 'implement-first': 8003 },
            researchPolicyHints: ['forbidden'],
            researchPolicyHintScores: { forbidden: 10005 },
            delegationHints: ['ask-me-first'],
            delegationHintScores: { 'ask-me-first': 10004 },
            constraintHints: ['minimal-patch'],
            constraintHintScores: { 'minimal-patch': 10005 },
          },
        ],
        semanticFeatureTopN: {
          stageHints: [
            { value: 'architecture', score: 10004, provenanceSkillIds: ['speckit-workflow'] },
          ],
          actionHints: [
            { value: 'patch', score: 10004, provenanceSkillIds: ['speckit-workflow'] },
          ],
          interactionHints: [
            {
              value: 'implement-first',
              score: 8003,
              provenanceSkillIds: ['speckit-workflow'],
            },
          ],
          researchPolicyHints: [
            { value: 'forbidden', score: 10005, provenanceSkillIds: ['speckit-workflow'] },
          ],
          delegationHints: [
            { value: 'ask-me-first', score: 10004, provenanceSkillIds: ['speckit-workflow'] },
          ],
          constraintHints: [
            { value: 'minimal-patch', score: 10005, provenanceSkillIds: ['speckit-workflow'] },
          ],
        },
        reviewerRouteExplainability: [
          {
            requestedSkillId: 'code-reviewer',
            matchedSkillId: 'code-reviewer',
            reviewerIdentity: 'bmad_code_reviewer',
            reviewerDisplayName: 'code-reviewer',
            registryVersion: 'reviewer_registry_v1',
            closeoutRunner: 'runAuditorHost',
            supportedProfiles: ['story_audit', 'implement_audit'],
            hosts: {
              cursor: {
                preferredRoute: { tool: 'cursor-task', subtypeOrExecutor: 'code-reviewer' },
                fallbackRoute: { tool: 'mcp_task', subtypeOrExecutor: 'generalPurpose' },
              },
              claude: {
                preferredRoute: { tool: 'Agent', subtypeOrExecutor: 'code-reviewer' },
                fallbackRoute: { tool: 'Agent', subtypeOrExecutor: 'general-purpose' },
              },
            },
            activeAuditConsumer: {
              entryStage: 'implement',
              profile: 'implement_audit',
              closeoutStage: 'implement',
              auditorScript: 'auditor-implement',
              scoreStage: 'implement',
              triggerStage: 'speckit_5_2',
            },
          },
        ],
        skillAvailabilityMode: 'execution-filtered',
        interactionMode: 'implement-first',
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        governanceConstraints: [],
        blockedByGovernance: [],
        rationale: 'test',
        advisoryOnly: false,
      },
      shouldContinue: false,
      stopReason: 'await human review',
      loopStateId: 'loop-123',
      currentAttemptNumber: 3,
      nextAttemptNumber: null,
      artifactPath: null,
      packetPaths: {},
      executorRouting: {
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      },
      runnerSummaryLines: [
        '## Governance Remediation Runner Summary',
        '- Should Continue: no',
        '- Stop Reason: await human review',
        '',
        '## Loop State Trace Summary',
        '- Journey Contract Signals: (none)',
      ],
    });

    expect(presentation.structuredMetadataLines).toEqual([
      '## Governance Structured Metadata',
      '',
      '- Should Continue: no',
      '- Stop Reason: await human review',
      '- Loop State ID: loop-123',
      '- Current Attempt Number: 3',
      '- Next Attempt Number: (none)',
      '- Artifact Path: (none)',
      '- Routing Mode: generic',
      '- Executor Route: default-gate-remediation',
      '- Prioritized Signals: (none)',
      '- Execution Stage: architecture',
      '- Execution Action: patch',
      '- Interaction Mode: implement-first',
      '- Skill Availability Mode: execution-filtered',
      '- Research Policy: forbidden',
      '- Delegation Preference: ask-me-first',
      '- Available Skills: speckit-workflow',
      '- Matched Available Skills: speckit-workflow',
      '- Missing Skills: (none)',
      '- Provider Recommended Skill Chain: provider-recommended-skill',
      '- Provider Recommended Subagent Roles: provider-reviewer',
      '- Provider Recommended vs Executed (Skills): recommended=provider-recommended-skill [source=model-provider; confidence=high; consumed=yes; matchedSkillId=provider-recommended-skill; matchedBy=exact-id; matchScore=10000; reason=Provider wants a focused remediation lane.; filteredBecause=(none)] || skipped=provider-unavailable-skill [source=model-provider; confidence=medium; consumed=no; matchedSkillId=(none); matchedBy=unmatched; matchScore=(none); reason=Provider suggested an unavailable skill.; filteredBecause=not-available-in-inventory]',
      '- Provider Recommended vs Executed (Subagent Roles): recommended=provider-reviewer [source=model-provider; confidence=medium; consumed=yes; matchedSkillId=(none); matchedBy=(none); matchScore=(none); reason=Provider wants a reviewer role preserved.; filteredBecause=(none)] || skipped=(none)',
      '- Execution Skill Chain: provider-recommended-skill, speckit-workflow',
      '- Semantic Skill Features: speckit-workflow [stage=architecture; action=patch; interaction=implement-first; research=forbidden; delegation=ask-me-first; constraints=minimal-patch]',
      '- Semantic Feature Top-N: stageHints=architecture@10004<-speckit-workflow || actionHints=patch@10004<-speckit-workflow || interactionHints=implement-first@8003<-speckit-workflow || researchPolicyHints=forbidden@10005<-speckit-workflow || delegationHints=ask-me-first@10004<-speckit-workflow || constraintHints=minimal-patch@10005<-speckit-workflow',
      '- Reviewer Projection: code-reviewer => bmad_code_reviewer [registry=reviewer_registry_v1; closeout=runAuditorHost; active=implement/implement_audit]',
      '- Execution Subagent Roles: provider-reviewer',
      '- Governance Constraints: (none)',
      '- Blocked By Governance: (none)',
      '- Packet Paths: (none)',
      '',
    ]);

    expect(presentation.rawEventLines).toEqual([
      '## Governance Latest Raw Event',
      '',
      '## Governance Remediation Runner Summary',
      '- Should Continue: no',
      '- Stop Reason: await human review',
      '',
      '## Loop State Trace Summary',
      '- Journey Contract Signals: (none)',
      '',
    ]);

    expect(presentation.combinedLines).toEqual([
      ...presentation.structuredMetadataLines,
      ...presentation.rawEventLines,
    ]);

    const log = vi.fn<(line: string) => void>();
    printGovernanceRunnerCliPresentation(presentation, log);
    expect(log.mock.calls.map(([line]) => line)).toEqual(presentation.combinedLines);
  });
});
