import { describe, expect, it } from 'vitest';
import {
  detectPromptRoutingHints,
  loadPromptRoutingRules,
  resolvePromptRoutingHintsFromText,
} from '../../scripts/prompt-routing-hints';

const repoRoot = process.cwd();

describe('prompt-routing-hints', () => {
  it('extracts stage, action, and constraints from an explicit mixed-language prompt', () => {
    const hints = resolvePromptRoutingHintsFromText(
      repoRoot,
      '直接给我 architecture 的 patch plan，先不要联网，只做最小修复，ask before deciding。'
    );

    expect(hints.inferredStage).toBe('architecture');
    expect(hints.requestedAction).toBe('plan');
    expect(hints.researchPolicy).toBe('forbidden');
    expect(hints.delegationPreference).toBe('ask-me-first');
    expect(hints.constraints).toContain('minimal-patch');
    expect(hints.overrideAllowed).toBe(false);
    expect(hints.confidence).not.toBe('low');
  });

  it('captures explicit role preferences and preferred research signals', () => {
    const rules = loadPromptRoutingRules(repoRoot);
    const hints = detectPromptRoutingHints(
      'Use party-mode with 批判审计员 and do deep research on the latest API docs.',
      rules
    );

    expect(hints.explicitRolePreference).toContain('party-mode');
    expect(hints.explicitRolePreference).toContain('critical-auditor');
    expect(hints.researchPolicy).toBe('preferred');
    expect(hints.debug.matchedRoleAliases.length).toBeGreaterThan(0);
  });

  it('degrades vague prompts to low confidence without override power', () => {
    const hints = resolvePromptRoutingHintsFromText(repoRoot, '帮我看看这个');

    expect(hints.confidence).toBe('low');
    expect(hints.overrideAllowed).toBe(false);
    expect(hints.explicitRolePreference).toHaveLength(0);
    expect(hints.constraints).toHaveLength(0);
  });
});
