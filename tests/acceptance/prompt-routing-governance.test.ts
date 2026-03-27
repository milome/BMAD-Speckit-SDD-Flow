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
});
