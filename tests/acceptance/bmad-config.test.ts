/**
 * BMAD Configuration Loader Tests
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadConfig,
  getStageConfig,
  shouldAudit,
  shouldValidate,
  shouldGenerateDoc,
  getStrictness,
  getSubagentParams,
  getEnvironment,
  formatReportPath,
  validateConfig,
  getDefaultConfig,
  setEnvironment,
  isAutoContinueEnabled,
  shouldAutoContinue,
  type AuditGranularityMode,
  type StageName,
} from '../../scripts/bmad-config';
import { getI18nConfig } from '../../scripts/bmad-config';

describe('bmad-config', () => {
  describe('Environment Detection', () => {
    const originalEnv = process.env.BMAD_PLATFORM;

    afterEach(() => {
      if (originalEnv) {
        process.env.BMAD_PLATFORM = originalEnv;
      } else {
        delete process.env.BMAD_PLATFORM;
      }
    });

    it('should detect cursor environment from env variable', () => {
      setEnvironment('cursor');
      const env = getEnvironment();
      expect(env.platform).toBe('cursor');
      expect(env.subagentTool).toBe('mcp_task');
      expect(env.subagentType).toBe('generalPurpose');
    });

    it('should detect claude environment from env variable', () => {
      setEnvironment('claude');
      const env = getEnvironment();
      expect(env.platform).toBe('claude');
      expect(env.subagentTool).toBe('Agent');
      expect(env.subagentType).toBe('general-purpose');
    });

    it('should read environment from runtime config when provided', () => {
      const config = loadConfig();
      const env = getEnvironment(config);

      expect(env.platform).toBe(config._environment.platform);
      expect(env.subagentTool).toBe(config._environment.subagentTool);
      expect(env.subagentType).toBe(config._environment.subagentType);
    });
  });

  describe('Default Configuration', () => {
    it('should provide complete default config', () => {
      const config = getDefaultConfig();
      expect(config.version).toBe('1.0');
      expect(config.audit_granularity.mode).toBe('full');
      expect(config.audit_granularity.modes.full).toBeDefined();
      expect(config.audit_granularity.modes.story).toBeDefined();
      expect(config.audit_granularity.modes.epic).toBeDefined();
    });

    it('should ignore governance-owned fields even when extra fields are mixed into config-shaped input', () => {
      const config = getDefaultConfig();
      const mixedInput = {
        ...config,
        i18n: {
          ...config.i18n,
          triggerStage: 'speckit_9_9',
          scoringEnabled: false,
          mandatoryGate: false,
          granularityGoverned: 'epic',
        },
      } as ReturnType<typeof loadConfig>;

      const i18n = getI18nConfig(mixedInput);

      expect(i18n.default_language_mode).toBe('auto');
      expect(i18n.default_artifact_language).toBe('auto');
      expect(i18n.allow_bilingual_auto_mode).toBe(false);
      expect(i18n.fallback_language).toBe('en');
      expect(i18n.preserve_control_keys_in_english).toBe(true);
      expect(i18n.preserve_commands_and_paths).toBe(true);
      expect(i18n.render_bilingual_headings_with_slash).toBe(true);
      expect(i18n).not.toHaveProperty('triggerStage');
      expect(i18n).not.toHaveProperty('scoringEnabled');
      expect(i18n).not.toHaveProperty('mandatoryGate');
      expect(i18n).not.toHaveProperty('granularityGoverned');
    });

    it('should have all required stages in full mode', () => {
      const config = getDefaultConfig();
      const fullMode = config.audit_granularity.modes.full;
      const requiredStages: StageName[] = [
        'story_create',
        'story_audit',
        'specify',
        'plan',
        'gaps',
        'tasks',
        'implement',
        'post_audit',
      ];

      for (const stage of requiredStages) {
        expect(fullMode.stages[stage]).toBeDefined();
        expect(fullMode.stages[stage]?.audit).toBe(true);
      }
    });
  });

  describe('Mode: full', () => {
    beforeEach(() => {
      process.env.BMAD_PLATFORM = 'claude';
      // Force full mode by temporarily modifying the loaded config
      // In real usage, the mode comes from config file
    });

    it('should audit all stages in full mode', () => {
      // Test against default config which uses full mode
      const defaultConfig = getDefaultConfig();
      const stages: StageName[] = [
        'story_create',
        'story_audit',
        'specify',
        'plan',
        'gaps',
        'tasks',
        'implement',
        'post_audit',
      ];

      for (const stage of stages) {
        const stageConfig = defaultConfig.audit_granularity.modes.full.stages[stage];
        expect(stageConfig?.audit).toBe(true);
      }
    });

    it('should have strict strictness for implement and post_audit in full mode', () => {
      const defaultConfig = getDefaultConfig();
      expect(defaultConfig.audit_granularity.modes.full.stages.implement?.strictness).toBe(
        'strict'
      );
      expect(defaultConfig.audit_granularity.modes.full.stages.post_audit?.strictness).toBe(
        'strict'
      );
    });

    it('should have standard strictness for other stages', () => {
      expect(getStrictness('story_create')).toBe('standard');
      expect(getStrictness('specify')).toBe('standard');
      expect(getStrictness('plan')).toBe('standard');
    });
  });

  describe('Mode: story', () => {
    it('should only audit story_create, story_audit, and post_audit in story mode', () => {
      const config = getDefaultConfig();
      config.audit_granularity.mode = 'story';

      expect(shouldAudit('story_create', config as ReturnType<typeof loadConfig>)).toBe(true);
      expect(shouldAudit('story_audit', config as ReturnType<typeof loadConfig>)).toBe(true);
      expect(shouldAudit('specify', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('plan', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('gaps', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('tasks', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('implement', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('post_audit', config as ReturnType<typeof loadConfig>)).toBe(true);
    });

    it('should return basic or test_only validation for story mode stages', () => {
      const config = getDefaultConfig();
      config.audit_granularity.mode = 'story';

      expect(shouldValidate('specify', config as ReturnType<typeof loadConfig>)).toBe('basic');
      expect(shouldValidate('plan', config as ReturnType<typeof loadConfig>)).toBe('basic');
      expect(shouldValidate('gaps', config as ReturnType<typeof loadConfig>)).toBe('basic');
      expect(shouldValidate('tasks', config as ReturnType<typeof loadConfig>)).toBe('basic');
      expect(shouldValidate('implement', config as ReturnType<typeof loadConfig>)).toBe(
        'test_only'
      );
      expect(shouldValidate('post_audit', config as ReturnType<typeof loadConfig>)).toBeNull();
    });
  });

  describe('Mode: epic', () => {
    it('should only audit epic_create and epic_complete in epic mode', () => {
      const config = getDefaultConfig();
      config.audit_granularity.mode = 'epic';

      expect(shouldAudit('story_create', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('story_audit', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('specify', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('plan', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('gaps', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('tasks', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('implement', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('post_audit', config as ReturnType<typeof loadConfig>)).toBe(false);
      expect(shouldAudit('epic_create', config as ReturnType<typeof loadConfig>)).toBe(true);
      expect(shouldAudit('epic_complete', config as ReturnType<typeof loadConfig>)).toBe(true);
    });

    it('should keep test_only validation for implement in epic mode', () => {
      const config = getDefaultConfig();
      config.audit_granularity.mode = 'epic';

      expect(shouldValidate('specify', config as ReturnType<typeof loadConfig>)).toBeNull();
      expect(shouldValidate('implement', config as ReturnType<typeof loadConfig>)).toBe(
        'test_only'
      );
      expect(shouldValidate('post_audit', config as ReturnType<typeof loadConfig>)).toBeNull();
    });
  });

  describe('Validation Checks', () => {
    beforeEach(() => {
      process.env.BMAD_PLATFORM = 'claude';
    });

    it('should return validation checks for stages from default full config', () => {
      const config = getDefaultConfig();
      expect(shouldValidate('specify', config as ReturnType<typeof loadConfig>)).toBeNull();
    });
  });

  describe('Report Path Formatting', () => {
    it('should format report paths with placeholders', () => {
      const template =
        'specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md';
      const result = formatReportPath(template, {
        epic: 'E001',
        story: 'S001',
        epicSlug: 'test-epic',
        storySlug: 'test-story',
      });

      expect(result).toBe(
        'specs/epic-E001-test-epic/story-S001-test-story/AUDIT_spec-EE001-SS001.md'
      );
    });

    it('should handle missing optional parameters', () => {
      const template = '_bmad-output/epic-{epic}-{epic-slug}/';
      const result = formatReportPath(template, {
        epic: 'E001',
      });

      expect(result).toBe('_bmad-output/epic-E001-e001/');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct config', () => {
      const config = getDefaultConfig();
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config without version', () => {
      const result = validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing version field');
    });

    it('should reject config with invalid mode', () => {
      const result = validateConfig({
        version: '1.0',
        audit_granularity: {
          mode: 'invalid' as AuditGranularityMode,
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid mode: invalid');
    });
  });

  describe('Auto Continue', () => {
    const originalAutoContinue = process.env.BMAD_AUTO_CONTINUE;

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalAutoContinue === undefined) {
        delete process.env.BMAD_AUTO_CONTINUE;
      } else {
        process.env.BMAD_AUTO_CONTINUE = originalAutoContinue;
      }
    });

    it('should default auto_continue to disabled', () => {
      const config = getDefaultConfig();
      expect(config.auto_continue.enabled).toBe(false);
      expect(config.auto_continue.require_ready_flag).toBe(true);
      expect(config.auto_continue.require_next_action).toBe(true);
    });

    it('should enable auto continue from env variable', () => {
      process.env.BMAD_AUTO_CONTINUE = 'true';
      const config = loadConfig();
      expect(isAutoContinueEnabled(config)).toBe(true);
    });

    it('should disable auto continue from env variable', () => {
      process.env.BMAD_AUTO_CONTINUE = 'false';
      const config = loadConfig();
      expect(isAutoContinueEnabled(config)).toBe(false);
    });

    it('should enable auto continue from cli flag', () => {
      vi.stubGlobal('process', {
        ...process,
        argv: ['node', 'scripts/bmad-config.ts', '--continue'],
      });

      const config = loadConfig();
      expect(isAutoContinueEnabled(config)).toBe(true);
    });

    it('should let cli flag override env setting', () => {
      process.env.BMAD_AUTO_CONTINUE = 'false';
      vi.stubGlobal('process', {
        ...process,
        env: process.env,
        argv: ['node', 'scripts/bmad-config.ts', '--continue'],
      });

      const config = loadConfig();
      expect(isAutoContinueEnabled(config)).toBe(true);
    });

    it('should only auto continue when config and handoff are both ready', () => {
      const config = getDefaultConfig();
      config.auto_continue.enabled = true;

      expect(
        shouldAutoContinue(
          {
            next_action: 'story_audit',
            ready: true,
          },
          config as ReturnType<typeof loadConfig>
        )
      ).toBe(true);

      expect(
        shouldAutoContinue(
          {
            next_action: 'story_audit',
            ready: false,
          },
          config as ReturnType<typeof loadConfig>
        )
      ).toBe(false);

      expect(
        shouldAutoContinue(
          {
            ready: true,
          },
          config as ReturnType<typeof loadConfig>
        )
      ).toBe(false);
    });
  });

  describe('Subagent Parameters', () => {
    beforeEach(() => {
      process.env.BMAD_PLATFORM = 'claude';
    });

    it('should return correct subagent params for claude', () => {
      const params = getSubagentParams();
      expect(params.tool).toBe('Agent');
      expect(params.subagent_type).toBe('general-purpose');
    });

    it('should return correct subagent params for cursor', () => {
      setEnvironment('cursor');
      const params = getSubagentParams();
      expect(params.tool).toBe('mcp_task');
      expect(params.subagent_type).toBe('generalPurpose');
    });
  });

  describe('Cursor audit granularity regression anchors', () => {
    it('should keep the Cursor rule vocabulary aligned with the config contract', () => {
      const cursorRule = readFileSync('.cursor/rules/bmad-story-assistant.mdc', 'utf8');

      expect(cursorRule).toContain('--audit-granularity');
      expect(cursorRule).toContain('BMAD_AUDIT_GRANULARITY');
      expect(cursorRule).toContain('mcp_task');
      expect(cursorRule).toContain('generalPurpose');
      expect(cursorRule).toContain('shouldAudit');
      expect(cursorRule).toContain('getStageConfig');
      expect(cursorRule).toContain('full');
      expect(cursorRule).toContain('story');
      expect(cursorRule).toContain('epic');
      expect(cursorRule).toContain('basic');
      expect(cursorRule).toContain('test_only');
    });
  });

  describe('getStageConfig', () => {
    it('should return stage config for valid stage from default config', () => {
      const defaultConfig = getDefaultConfig();
      const stageConfig = defaultConfig.audit_granularity.modes.full.stages.specify;
      expect(stageConfig).toBeDefined();
      expect(stageConfig?.audit).toBe(true);
    });

    it('should return undefined for invalid stage', () => {
      const config = getStageConfig('invalid_stage' as StageName);
      expect(config).toBeUndefined();
    });
  });

  /**
   * U-1.1：冻结 `full` / `story` / `epic` × 各 `StageName` 下 helper 与阶段表语义一致（单一事实源：`getDefaultConfig().audit_granularity.modes`）。
   */
  describe('U-1.1 legacy baseline', () => {
    const ALL_STAGES: StageName[] = [
      'story_create',
      'story_audit',
      'specify',
      'plan',
      'gaps',
      'tasks',
      'implement',
      'post_audit',
      'epic_create',
      'epic_complete',
    ];

    const MODES: AuditGranularityMode[] = ['full', 'story', 'epic'];

    function runtimeConfigForMode(mode: AuditGranularityMode): ReturnType<typeof loadConfig> {
      const base = getDefaultConfig();
      base.audit_granularity.mode = mode;
      return base as ReturnType<typeof loadConfig>;
    }

    it.each(MODES.flatMap((mode) => ALL_STAGES.map((stage) => [mode, stage] as const)))(
      'mode %s × stage %s: shouldAudit / shouldValidate / getStrictness / shouldGenerateDoc match stage table + documented fallbacks',
      (mode, stage) => {
        const cfg = runtimeConfigForMode(mode);
        const table = getDefaultConfig().audit_granularity.modes[mode].stages[stage];
        const stageCfg = getStageConfig(stage, cfg);

        expect(stageCfg).toEqual(table);
        expect(shouldAudit(stage, cfg)).toBe(table?.audit ?? true);
        expect(shouldValidate(stage, cfg)).toBe(table?.validation ?? null);
        expect(getStrictness(stage, cfg)).toBe(table?.strictness ?? 'standard');
        expect(shouldGenerateDoc(stage, cfg)).toBe(table?.generate_doc ?? true);
      }
    );

    /** U-1.1c：`StageConfig` 暴露的语义字段与 helper 可追踪一致（防仅测 helper 而表漂移）。 */
    it('U-1.1c: stageConfig audit/validation/generate_doc/strictness trace to helpers with documented defaults', () => {
      for (const mode of MODES) {
        const cfg = runtimeConfigForMode(mode);
        for (const stage of ALL_STAGES) {
          const sc = getStageConfig(stage, cfg);
          expect(shouldAudit(stage, cfg)).toBe(sc?.audit ?? true);
          expect(shouldValidate(stage, cfg)).toBe(sc?.validation ?? null);
          expect(shouldGenerateDoc(stage, cfg)).toBe(sc?.generate_doc ?? true);
          expect(getStrictness(stage, cfg)).toBe(sc?.strictness ?? 'standard');
        }
      }
    });
  });
});
