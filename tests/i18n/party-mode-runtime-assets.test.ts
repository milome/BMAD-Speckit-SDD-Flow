import { describe, expect, it } from 'vitest';
import {
  resolveCanonicalPartyModeAsset,
  resolveFacilitatorSourceAsset,
  resolvePartyModeSpeakerProfile,
} from '../../scripts/i18n/party-mode-runtime-assets';

describe('party-mode runtime assets', () => {
  it('resolves canonical workflow assets through the shared localized markdown resolver', () => {
    const workflow = resolveCanonicalPartyModeAsset(process.cwd(), 'workflow', 'zh');
    expect(workflow.baseRelativePath).toBe('_bmad/core/skills/bmad-party-mode/workflow.md');
    expect(workflow.resolvedRelativePath).toBe('_bmad/core/skills/bmad-party-mode/workflow.zh.md');
    expect(workflow.variant).toBe('zh');
    expect(workflow.usedFallback).toBe(false);

    const step02 = resolveCanonicalPartyModeAsset(
      process.cwd(),
      'step-02-discussion-orchestration',
      'en'
    );
    expect(step02.baseRelativePath).toBe(
      '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md'
    );
    expect(step02.resolvedRelativePath).toBe(
      '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.en.md'
    );
    expect(step02.variant).toBe('en');

    const step03Bilingual = resolveCanonicalPartyModeAsset(
      process.cwd(),
      'step-03-graceful-exit',
      'bilingual'
    );
    expect(step03Bilingual.resolvedRelativePath).toBe(
      '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.zh.md'
    );
    expect(step03Bilingual.variant).toBe('zh');
  });

  it('resolves facilitator source assets through the same shared resolver', () => {
    const cursor = resolveFacilitatorSourceAsset(process.cwd(), 'cursor', 'bilingual');
    expect(cursor.resolvedRelativePath).toBe('_bmad/cursor/agents/party-mode-facilitator.zh.md');
    expect(cursor.variant).toBe('zh');

    const claude = resolveFacilitatorSourceAsset(process.cwd(), 'claude', 'en');
    expect(claude.resolvedRelativePath).toBe('_bmad/claude/agents/party-mode-facilitator.en.md');
    expect(claude.variant).toBe('en');
  });

  it('exposes localized speaker display profiles for party-mode consumers', () => {
    const profile = resolvePartyModeSpeakerProfile(process.cwd(), 'pm', 'bilingual');
    expect(profile.displayName).toBe('John 产品经理 / John Product Manager');
    expect(profile.title).toBe('产品经理 / Product Manager');
    expect(profile.icon).toBe('📋');
  });
});
