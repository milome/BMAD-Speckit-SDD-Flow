import { describe, expect, it } from 'vitest';
import { getDefaultConfig, type RuntimeConfig } from '../../scripts/bmad-config';
import { resolveLanguagePolicyForSession } from '../../scripts/i18n/resolve-for-session';

function makeTestRuntimeConfig(): RuntimeConfig {
  const base = getDefaultConfig();
  return {
    ...base,
    _environment: {
      platform: 'cursor',
      subagentTool: 'mcp_task',
      subagentType: 'generalPurpose',
      skillsRoot: '.cursor/skills',
      agentsRoot: '.cursor/agents',
      configPath: 'config/bmad-story-config.yaml',
    },
  };
}

describe('resolveLanguagePolicyForSession', () => {
  it('resolves en when user asks for English in Chinese (请用英文)', () => {
    const policy = resolveLanguagePolicyForSession(
      makeTestRuntimeConfig(),
      '请用英文回答这个问题',
      []
    );
    expect(policy.resolvedMode).toBe('en');
    expect(policy.detectionSource).toBe('explicit_user');
  });

  it('resolves zh when user asks for Chinese (用中文)', () => {
    const policy = resolveLanguagePolicyForSession(makeTestRuntimeConfig(), '用中文说明', []);
    expect(policy.resolvedMode).toBe('zh');
    expect(policy.detectionSource).toBe('explicit_user');
  });
});
