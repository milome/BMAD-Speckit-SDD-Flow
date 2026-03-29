import { describe, expect, it } from 'vitest';
import { resolvePromptHintUsage } from '../../scripts/prompt-routing-governance';
import {
  createStubModelGovernanceHintProvider,
  resolveModelGovernanceHintCandidate,
} from '../../scripts/model-governance-hint-resolver';
import {
  filterModelGovernanceHintCandidate,
  toPromptRoutingHintsCompat,
} from '../../scripts/model-governance-policy-filter';

describe('model-governance policy filter', () => {
  it('strips model attempts to override blocker ownership before governance consumes the hint', async () => {
    const provider = createStubModelGovernanceHintProvider({
      source: 'model-provider',
      providerId: 'placeholder',
      providerMode: 'stub',
      confidence: 'high',
      suggestedStage: 'readiness',
      suggestedAction: 'audit',
      explicitRolePreference: ['critical-auditor'],
      recommendedSkillChain: ['speckit-workflow'],
      recommendedSubagentRoles: ['code-reviewer'],
      researchPolicy: 'preferred',
      delegationPreference: 'ask-me-first',
      constraints: ['minimal-patch'],
      rationale: 'Need stronger challenge pass on the readiness gate.',
      overrideAllowed: false,
      forbiddenOverrides: {
        blockerOwnership: 'Architect',
        failedCheckSeverity: 'warning',
        artifactRootTarget: 'architecture.md',
        downstreamContinuation: true,
      },
    });

    const candidate = await resolveModelGovernanceHintCandidate(
      {
        promptText: '继续 readiness，但想把 blocker owner 改成 Architect。',
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 2,
      },
      provider
    );

    const filtered = filterModelGovernanceHintCandidate(candidate, {
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 2,
      },
    });

    expect(filtered.blockerOwnershipAffected).toBe(false);
    expect(filtered.strippedForbiddenOverrides).toEqual([
      'blockerOwnership',
      'failedCheckSeverity',
      'artifactRootTarget',
      'downstreamContinuation',
    ]);
    expect(filtered.ignoredBecause).toContain('blocker ownership locked');
    expect(filtered.ignoredBecause).toContain('failed-check severity is governance-owned');
    expect(filtered.ignoredBecause).toContain('artifact root target locked');
    expect(filtered.ignoredBecause).toContain('downstream continuation is governance-owned');
    expect(filtered.filteredHints?.debug.strippedForbiddenOverrides).toContain('blockerOwnership');
    expect(filtered.filteredHints?.recommendedSkillItems).toEqual([
      {
        value: 'speckit-workflow',
        source: 'model-provider',
        reason: 'Provider recommended this item.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);
    expect(filtered.filteredHints?.recommendedSubagentRoleItems).toEqual([
      {
        value: 'code-reviewer',
        source: 'model-provider',
        reason: 'Provider recommended this item.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);

    const compatHints = toPromptRoutingHintsCompat(filtered.filteredHints!);
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
      promptHints: compatHints,
    });

    expect(usage.blockerOwnershipAffected).toBe(false);
    expect(usage.hintAppliedTo).not.toContain('entry-routing');
    expect(usage.hintAppliedTo).toContain('adapter-selection');
    expect(usage.hintAppliedTo).toContain('research-policy');
  });

  it('keeps allowed model hints usable for adapter-level routing after policy filtering', async () => {
    const provider = createStubModelGovernanceHintProvider({
      source: 'model-provider',
      providerId: 'placeholder',
      providerMode: 'stub',
      confidence: 'medium',
      suggestedStage: 'architecture',
      suggestedAction: 'patch',
      explicitRolePreference: ['party-mode'],
      recommendedSkillChain: ['speckit-workflow'],
      recommendedSubagentRoles: ['code-reviewer'],
      researchPolicy: 'forbidden',
      delegationPreference: 'decide-for-me',
      constraints: ['docs-only'],
      rationale: 'Constrain execution to documentation-only adapter selection.',
      overrideAllowed: false,
    });

    const candidate = await resolveModelGovernanceHintCandidate(
      {
        promptText: '只改文档，不要联网，直接给我 patch。',
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 3,
      },
      provider
    );

    const filtered = filterModelGovernanceHintCandidate(candidate, {
      gateFailure: {
        exists: true,
        blockerOwnershipLocked: true,
      },
      artifactState: {
        rootTargetLocked: true,
        equivalentAdapterCount: 3,
      },
    });

    expect(filtered.strippedForbiddenOverrides).toHaveLength(0);
    expect(filtered.filteredHints?.explicitRolePreference).toEqual(['party-mode']);
    expect(filtered.filteredHints?.recommendedSkillItems).toEqual([
      {
        value: 'speckit-workflow',
        source: 'model-provider',
        reason: 'Provider recommended this item.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);
    expect(filtered.filteredHints?.recommendedSubagentRoleItems).toEqual([
      {
        value: 'code-reviewer',
        source: 'model-provider',
        reason: 'Provider recommended this item.',
        confidence: 'medium',
        consumed: true,
        filteredBecause: [],
      },
    ]);
    expect(filtered.filteredHints?.researchPolicy).toBe('forbidden');

    const compatHints = toPromptRoutingHintsCompat(filtered.filteredHints!);
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
      promptHints: compatHints,
    });

    expect(usage.blockerOwnershipAffected).toBe(false);
    expect(usage.hintAppliedTo).toContain('adapter-selection');
    expect(usage.hintAppliedTo).toContain('interaction-style');
    expect(usage.hintAppliedTo).toContain('research-policy');
  });
});
