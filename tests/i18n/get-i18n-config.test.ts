import { describe, expect, it } from 'vitest';
import { getDefaultConfig, getI18nConfig, loadConfig, type RuntimeConfig } from '../../scripts/bmad-config';

const REQUIRED_I18N_KEYS = [
  'default_language_mode',
  'default_artifact_language',
  'allow_bilingual_auto_mode',
  'fallback_language',
  'preserve_control_keys_in_english',
  'preserve_commands_and_paths',
  'render_bilingual_headings_with_slash',
] as const;

function makeRuntimeConfig(): RuntimeConfig {
  const base = getDefaultConfig();
  return {
    ...base,
    _environment: {
      platform: 'cursor',
      subagentTool: 'mcp_task',
      subagentType: 'generalPurpose',
      skillsRoot: '.cursor/skills',
      agentsRoot: '.cursor/agents',
      configPath: '_bmad/_config/bmad-story-config.yaml',
    },
  };
}

describe('getI18nConfig (T1.4)', () => {
  it('returns all required i18n fields from merged config', () => {
    const cfg = makeRuntimeConfig();
    const i18n = getI18nConfig(cfg);
    for (const key of REQUIRED_I18N_KEYS) {
      expect(i18n).toHaveProperty(key);
      expect((i18n as Record<string, unknown>)[key]).not.toBeUndefined();
    }
  });

  it('allow_bilingual_auto_mode is boolean', () => {
    const i18n = getI18nConfig(makeRuntimeConfig());
    expect(typeof i18n.allow_bilingual_auto_mode).toBe('boolean');
  });

  it('matches default i18n when no file overrides i18n', () => {
    const def = getDefaultConfig().i18n;
    const i18n = getI18nConfig(makeRuntimeConfig());
    expect(i18n).toEqual(def);
  });

  it('loadConfig from repo bmad-story-config preserves i18n merge', () => {
    const cfg = loadConfig('_bmad/_config/bmad-story-config.yaml');
    const i18n = getI18nConfig(cfg);
    for (const key of REQUIRED_I18N_KEYS) {
      expect(i18n).toHaveProperty(key);
    }
  });
});
