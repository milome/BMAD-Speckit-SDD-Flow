import { describe, expect, it } from 'vitest';
import {
  validateTemplateManifest,
  type TemplateManifest,
} from '../../scripts/i18n/validate-template-manifest';

function createValidManifest(): TemplateManifest {
  return {
    id: 'speckit.audit.tasks',
    version: 1,
    kind: 'prompt_template',
    control: {
      stage: 'tasks',
      output_contract: 'markdown',
      required_sections: ['audit_scope', 'conclusion'],
      placeholders: {
        report_path: 'path',
        trigger_stage: 'stage_key',
      },
      protected_tokens: ['npx bmad-speckit score', '--triggerStage speckit_4_2'],
    },
    localization: {
      default_language: 'en',
      allow_bilingual: true,
    },
    strings: {
      title: {
        zh: '任务审计',
        en: 'Task Audit',
      },
      instruction: {
        zh: '运行 `{{report_path}}` 并保持 `{{trigger_stage}}` 不变。',
        en: 'Run `{{report_path}}` and keep `{{trigger_stage}}` unchanged.',
      },
    },
    anchors: {
      audit_scope: 'audit_scope',
      conclusion: 'conclusion',
    },
  };
}

describe('validateTemplateManifest', () => {
  it('accepts manifests when protected tokens are declared but only used in some strings', () => {
    const result = validateTemplateManifest(createValidManifest());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when required top-level blocks are missing', () => {
    const manifest = {
      id: 'broken',
      version: 1,
      kind: 'prompt_template',
    } as TemplateManifest;

    const result = validateTemplateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required block: control');
    expect(result.errors).toContain('Missing required block: localization');
    expect(result.errors).toContain('Missing required block: strings');
    expect(result.errors).toContain('Missing required block: anchors');
  });

  it('fails when localized strings reference undeclared placeholders', () => {
    const manifest = createValidManifest();
    manifest.strings.instruction = {
      zh: '运行 `{{missing_path}}`',
      en: 'Run `{{missing_path}}`',
    };

    const result = validateTemplateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Undeclared placeholder: missing_path in strings.instruction.zh'
    );
    expect(result.errors).toContain(
      'Undeclared placeholder: missing_path in strings.instruction.en'
    );
  });

  it('fails when anchors are duplicated', () => {
    const manifest = createValidManifest();
    manifest.anchors.conclusion = 'audit_scope';

    const result = validateTemplateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate anchor value: audit_scope');
  });

  it('allows single-language variants for runtime fallback scenarios', () => {
    const manifest = createValidManifest();
    manifest.strings.title = {
      zh: '任务审计',
    } as { zh: string; en: string };

    const result = validateTemplateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when protected tokens differ across language variants', () => {
    const manifest = createValidManifest();
    manifest.strings.instruction = {
      zh: '执行 `npx bmad-speckit score --triggerStage speckit_4_2`',
      en: 'Run `npx bmad-speckit score --triggerStage translated_stage`',
    };

    const result = validateTemplateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Protected token missing from strings.instruction.en: --triggerStage speckit_4_2'
    );
  });
});
