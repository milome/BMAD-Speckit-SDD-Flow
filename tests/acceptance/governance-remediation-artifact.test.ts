import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGovernanceRemediationArtifact,
  writeGovernanceRemediationArtifact,
} from '../../scripts/governance-remediation-artifact';

const repoRoot = process.cwd();

describe('governance remediation artifact entrypoint', () => {
  it('writes PM routing resolution and prompt hint usage into the remediation artifact', () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'gov-remediation-'));
    const outFile = path.join(outDir, 'attempt.md');

    const result = writeGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: outFile,
      promptText: '直接给我 architecture patch plan，使用 party-mode，但不要联网。',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      attemptId: 'attempt-01',
      sourceGateFailureIds: ['GF-001'],
      capabilitySlot: 'architecture.challenge',
      canonicalAgent: 'Architect + Critical Auditor',
      actualExecutor: 'party-mode facilitator',
      adapterPath: 'host skill fallback',
      targetArtifacts: ['architecture.md'],
      expectedDelta: 'tighten completion semantics',
      rerunOwner: 'PM',
      rerunGate: 'architecture-contract-gate',
      outcome: 'in_progress',
      sharedArtifactsUpdated: ['Challenge Log'],
      contradictionsDelta: '1 opened / 0 closed',
      externalProofAdded: 'none',
      readyToRerunGate: false,
      stopReason: 'waiting on architecture update',
    });

    expect(existsSync(outFile)).toBe(true);
    const written = readFileSync(outFile, 'utf8');
    expect(written).toContain('## PM Routing Resolution');
    expect(written).toContain('## Executor Routing Trace');
    expect(written).toContain('## Remediation Audit Trace Summary');
    expect(written).toContain('- Routing Mode: generic');
    expect(written).toContain('- Executor Route: default-gate-remediation');
    expect(written).toContain('Stop Reason: waiting on architecture update');
    expect(written).toContain('Journey Contract Signals: (none)');
    expect(written).toContain('## Prompt Hint Usage');
    expect(written).toContain('## Model Hint Debug');
    expect(written).toContain('## Execution Intent Candidate');
    expect(written).toContain('## Execution Plan Decision');
    expect(written).toContain('Resolution order: `stage context -> gate failure -> artifact state -> PromptRoutingHints`');
    expect(written).toContain('- Blocker ownership affected: no');
    expect(written).toContain('- Model hint present: no');
    expect(result.promptHintUsage.hintAppliedTo).toContain('adapter-selection');
    expect(result.promptHintUsage.hintAppliedTo).not.toContain('entry-routing');
    expect(result.executionIntentCandidate).toMatchObject({
      source: 'prompt-hints',
      stage: 'architecture',
      action: 'plan',
      interactionMode: 'party-mode',
      researchPolicy: 'forbidden',
      advisoryOnly: true,
    });
    expect(result.executionPlanDecision).toMatchObject({
      source: 'prompt-hints',
      stage: 'architecture',
      action: 'plan',
      interactionMode: 'party-mode',
      researchPolicy: 'forbidden',
      advisoryOnly: false,
    });
  });

  it('keeps low-confidence vague prompts from affecting artifact ownership in generated output', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '帮我看看这个',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 1,
      attemptId: 'attempt-02',
      sourceGateFailureIds: ['GF-002'],
      capabilitySlot: 'qa.traceability',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'local artifact audit',
      adapterPath: 'local workflow fallback',
      targetArtifacts: ['prd.md'],
      expectedDelta: 'fill missing trace links',
      rerunOwner: 'PM',
      rerunGate: 'traceability-gate',
      outcome: 'blocked',
    });

    expect(result.promptHintUsage.hintAppliedTo).toHaveLength(0);
    expect(result.promptHintUsage.hintIgnoredBecause).toContain('low confidence');
    expect(result.markdown).toContain('## Executor Routing Trace');
    expect(result.markdown).toContain('## Remediation Audit Trace Summary');
    expect(result.markdown).toContain('- Routing Mode: generic');
    expect(result.markdown).toContain('Stop Reason: (none)');
    expect(result.markdown).toContain('- Blocker ownership affected: no');
    expect(result.markdown).toContain('- Hint confidence: low');
  });

  it('writes targeted executor routing trace when journey contract remediation is prioritized', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '继续 readiness 审计。',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 1,
      attemptId: 'attempt-04',
      sourceGateFailureIds: ['GF-004'],
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'implementation readiness workflow',
      adapterPath: 'local workflow fallback',
      targetArtifacts: ['tasks.md'],
      expectedDelta: 'repair journey contract blockers first',
      rerunOwner: 'PM',
      rerunGate: 'implementation-readiness',
      outcome: 'blocked',
      journeyContractHints: [
        {
          signal: 'smoke_task_chain',
          label: 'Smoke Task Chain',
          count: 1,
          affected_stages: ['tasks'],
          epic_stories: ['E14.S2'],
          recommendation:
            'Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.',
        },
      ],
      executorRouting: {
        routingMode: 'targeted',
        executorRoute: 'journey-contract-remediation',
        prioritizedSignals: ['smoke_task_chain'],
        packetStrategy: 'journey-contract-remediation-packet',
        reason: 'journey contract hints detected; use targeted remediation routing before generic blocker cleanup',
      },
    });

    expect(result.markdown).toContain('## Executor Routing Trace');
    expect(result.markdown).toContain('## Remediation Audit Trace Summary');
    expect(result.markdown).toContain('- Routing Mode: targeted');
    expect(result.markdown).toContain('- Executor Route: journey-contract-remediation');
    expect(result.markdown).toContain('- Prioritized Signals: smoke_task_chain');
    expect(result.markdown).toContain('Journey Contract Signals: smoke_task_chain');
  });

  it('records filtered model hint debug without allowing ownership override', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '继续 readiness 审计。',
      modelHintsCandidate: {
        source: 'model-provider',
        providerId: 'stub-model-governance-provider',
        providerMode: 'stub',
        confidence: 'high',
        suggestedStage: 'readiness',
        suggestedAction: 'audit',
        explicitRolePreference: ['critical-auditor'],
        recommendedSkillChain: ['provider-recommended-skill', 'code-reviewer'],
        recommendedSubagentRoles: ['provider-reviewer'],
        researchPolicy: 'preferred',
        delegationPreference: 'ask-me-first',
        constraints: ['minimal-patch'],
        rationale: 'Need a stricter remediation pass.',
        overrideAllowed: false,
        forbiddenOverrides: {
          blockerOwnership: 'Architect',
          artifactRootTarget: 'architecture.md',
        },
      },
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      attemptId: 'attempt-03',
      sourceGateFailureIds: ['GF-003'],
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'implementation readiness workflow',
      adapterPath: 'local workflow fallback',
      targetArtifacts: ['prd.md', 'architecture.md'],
      expectedDelta: 'tighten blocker repair plan',
      rerunOwner: 'PM',
      rerunGate: 'implementation-readiness',
      outcome: 'blocked',
    });

    expect(result.promptHintUsage.blockerOwnershipAffected).toBe(false);
    expect(result.promptHintUsage.modelHintPresent).toBe(true);
    expect(result.promptHintUsage.modelHintAppliedTo).toContain('adapter-selection');
    expect(result.promptHintUsage.modelHintIgnoredBecause).toContain('blocker ownership locked');
    expect(result.promptHintUsage.modelHintDebug?.strippedForbiddenOverrides).toContain(
      'blockerOwnership'
    );
    expect(result.markdown).toContain('- Model hint present: yes');
    expect(result.markdown).toContain('Stripped forbidden overrides: blockerOwnership, artifactRootTarget');
    expect(result.markdown).toContain('- Model hints remain advisory only: yes');
  });

  it('renders compact skill match reasons for artifact diff readability', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '继续 architecture patch，使用 party-mode。',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      availableSkills: ['stage-audit-workflow'],
      skillInventory: [
        {
          skillId: 'stage-audit-workflow',
          path: 'D:/skills/stage-audit-workflow/SKILL.md',
          title: 'Stage Audit Workflow',
          description: 'Facilitates party mode architecture debate and multi-role review orchestration.',
          summary: 'Use for party mode facilitation during architecture review and patch planning.',
        },
      ],
      attemptId: 'attempt-05',
      sourceGateFailureIds: ['GF-005'],
      capabilitySlot: 'architecture.challenge',
      canonicalAgent: 'Architect + Critical Auditor',
      actualExecutor: 'party-mode facilitator',
      adapterPath: 'host skill fallback',
      targetArtifacts: ['architecture.md'],
      expectedDelta: 'tighten skill matching visibility',
      rerunOwner: 'PM',
      rerunGate: 'architecture-contract-gate',
      outcome: 'in_progress',
    });

    expect(result.markdown).toContain('- Skill Match Reasons:');
    expect(result.markdown).toContain(
      '  - party-mode -> stage-audit-workflow [score=1000; tokens=party|mode]'
    );
    expect(result.markdown).toContain(
      '- Semantic Skill Features: stage-audit-workflow [stage=architecture|post_audit; action=patch|review; interaction=party-mode|review-first|implement-first]'
    );
    expect(result.markdown).not.toContain(
      'stage-audit-workflow [stage=architecture|post_audit; action=patch|review; interaction=party-mode|review-first|implement-first] || stage-audit-workflow [stage=architecture|post_audit; action=patch|review; interaction=party-mode|review-first|implement-first]'
    );
    expect(result.markdown).toContain('- Semantic Feature Top-N:');
    expect(result.markdown).toContain(
      '  - interactionHints: party-mode@10006<-stage-audit-workflow, review-first@9004<-stage-audit-workflow, implement-first@8003<-stage-audit-workflow'
    );
    expect(result.markdown).not.toContain('    - title:');
    expect(result.markdown).not.toContain('    - description:');
    expect(result.markdown).not.toContain('    - summary:');
  });

  it('surfaces provider recommended skill chain and subagent roles in artifact outputs', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '继续 readiness 修复。',
      modelHintsCandidate: {
        source: 'model-provider',
        providerId: 'stub-model-governance-provider',
        providerMode: 'stub',
        confidence: 'medium',
        suggestedStage: 'plan',
        suggestedAction: 'patch',
        explicitRolePreference: ['critical-auditor'],
        recommendedSkillChain: ['provider-recommended-skill', 'code-reviewer'],
        recommendedSubagentRoles: ['provider-reviewer'],
        recommendedSkillItems: [
          {
            value: 'provider-recommended-skill',
            reason: 'Provider wants a focused remediation lane.',
            confidence: 'high',
          },
          {
            value: 'code-reviewer',
            reason: 'Provider wants review coverage in the chain.',
            confidence: 'medium',
          },
        ],
        recommendedSubagentRoleItems: [
          {
            value: 'provider-reviewer',
            reason: 'Provider wants a reviewer role preserved.',
            confidence: 'medium',
          },
        ],
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        constraints: ['minimal-patch'],
        rationale: 'Provider recommends a bounded review chain.',
        overrideAllowed: false,
      },
      availableSkills: ['provider-recommended-skill', 'code-reviewer', 'speckit-workflow'],
      skillInventory: [
        {
          skillId: 'provider-recommended-skill',
          path: 'D:/skills/provider-recommended-skill/SKILL.md',
          title: 'Provider Recommended Skill',
          description: 'Used when provider suggests a focused readiness patch workflow.',
          summary: 'Focused readiness patch workflow.',
        },
        {
          skillId: 'code-reviewer',
          path: 'D:/skills/code-reviewer/SKILL.md',
          title: 'Code Reviewer',
          description: 'Review code and remediation plans.',
          summary: 'Review remediation plans.',
        },
        {
          skillId: 'speckit-workflow',
          path: 'D:/skills/speckit-workflow/SKILL.md',
          title: 'Speckit Workflow',
          description: 'Drive plan and task workflows.',
          summary: 'Drive plan and task workflows.',
        },
      ],
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      attemptId: 'attempt-06',
      sourceGateFailureIds: ['GF-006'],
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'implementation readiness workflow',
      adapterPath: 'local workflow fallback',
      targetArtifacts: ['prd.md', 'architecture.md'],
      expectedDelta: 'use provider-recommended skill chain',
      rerunOwner: 'PM',
      rerunGate: 'implementation-readiness',
      outcome: 'blocked',
    });

    expect(result.executionIntentCandidate?.skillChain).toEqual([
      'provider-recommended-skill',
      'code-reviewer',
      'speckit-workflow',
    ]);
    expect(result.executionPlanDecision?.skillChain).toEqual([
      'provider-recommended-skill',
      'code-reviewer',
      'speckit-workflow',
    ]);
    expect(result.executionIntentCandidate?.subagentRoles).toEqual([
      'provider-reviewer',
      'critical-auditor',
    ]);
    expect(result.executionPlanDecision?.subagentRoles).toEqual([
      'provider-reviewer',
      'critical-auditor',
    ]);
    expect(result.markdown).toContain(
      '- Provider Recommended Skill Chain: provider-recommended-skill, code-reviewer'
    );
    expect(result.markdown).toContain(
      '- Provider Recommended Subagent Roles: provider-reviewer'
    );
    expect(result.markdown).toContain(
      '  - provider-recommended-skill [source=model-provider; confidence=high; consumed=yes; reason=Provider wants a focused remediation lane.; filteredBecause=(none)]'
    );
    expect(result.markdown).toContain(
      '  - code-reviewer [source=model-provider; confidence=medium; consumed=yes; reason=Provider wants review coverage in the chain.; filteredBecause=(none)]'
    );
    expect(result.markdown).toContain(
      '  - provider-reviewer [source=model-provider; confidence=medium; consumed=yes; reason=Provider wants a reviewer role preserved.; filteredBecause=(none)]'
    );
    expect(result.executionIntentCandidate?.providerRecommendationItems.skills).toEqual([
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
        value: 'code-reviewer',
        source: 'model-provider',
        reason: 'Provider wants review coverage in the chain.',
        confidence: 'medium',
        consumed: true,
        matchedSkillId: 'code-reviewer',
        matchedBy: 'exact-id',
        matchScore: 10000,
        filteredBecause: [],
      },
    ]);
    expect(result.executionPlanDecision?.providerRecommendationItems.subagentRoles).toEqual([
      {
        value: 'provider-reviewer',
        source: 'model-provider',
        reason: 'Provider wants a reviewer role preserved.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);
    expect(result.markdown).toContain(
      '- Skill Chain: provider-recommended-skill, code-reviewer, speckit-workflow'
    );
    expect(result.markdown).toContain(
      '- Subagent Roles: provider-reviewer, critical-auditor'
    );
    expect(result.markdown).toContain('- Reviewer Route Explainability:');
    expect(result.markdown).toContain(
      '  - code-reviewer => identity=bmad_code_reviewer; registry=reviewer_registry_v1; closeout=runAuditorHost'
    );
    expect(result.markdown).toContain(
      '    - cursor preferred: cursor-task/code-reviewer | fallback: mcp_task/generalPurpose'
    );
    expect(result.markdown).toContain(
      '    - claude preferred: Agent/code-reviewer | fallback: Agent/general-purpose'
    );
  });
});
