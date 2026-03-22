import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../scripts/i18n/render-template';
import type { TemplateManifest } from '../../scripts/i18n/validate-template-manifest';

const manifest: TemplateManifest = {
  id: 'golden.audit',
  version: 1,
  kind: 'prompt_template',
  control: {
    stage: 'tasks',
    output_contract: 'markdown',
    required_sections: ['audit_scope'],
    placeholders: {
      report_path: 'path',
    },
    protected_tokens: ['reports/tasks-audit.md'],
  },
  localization: {
    default_language: 'en',
    allow_bilingual: true,
  },
  strings: {
    audit_scope_heading: {
      zh: '审计范围',
      en: 'Audit Scope',
    },
    audit_scope_body: {
      zh: '输出到 `{{report_path}}`。',
      en: 'Write output to `{{report_path}}`.',
    },
  },
  anchors: {
    audit_scope: 'audit_scope',
  },
};

describe('renderTemplate golden behavior', () => {
  it('keeps anchors identical across all language modes', () => {
    const zh = renderTemplate({
      manifest,
      languagePolicy: {
        requestedMode: 'zh',
        resolvedMode: 'zh',
        userLanguage: 'zh',
        artifactLanguage: 'zh',
        detectionSource: 'explicit_user',
        allowBilingualDisplay: true,
        preserveControlKeysInEnglish: true,
        preserveCommandsAndPaths: true,
      },
      placeholders: { report_path: 'reports/tasks-audit.md' },
    });

    const en = renderTemplate({
      manifest,
      languagePolicy: {
        requestedMode: 'en',
        resolvedMode: 'en',
        userLanguage: 'en',
        artifactLanguage: 'en',
        detectionSource: 'explicit_user',
        allowBilingualDisplay: true,
        preserveControlKeysInEnglish: true,
        preserveCommandsAndPaths: true,
      },
      placeholders: { report_path: 'reports/tasks-audit.md' },
    });

    const bilingual = renderTemplate({
      manifest,
      languagePolicy: {
        requestedMode: 'bilingual',
        resolvedMode: 'bilingual',
        userLanguage: 'mixed',
        artifactLanguage: 'bilingual',
        detectionSource: 'explicit_user',
        allowBilingualDisplay: true,
        preserveControlKeysInEnglish: true,
        preserveCommandsAndPaths: true,
      },
      placeholders: { report_path: 'reports/tasks-audit.md' },
    });

    expect(zh.content).toContain('<!-- SECTION: audit_scope -->');
    expect(en.content).toContain('<!-- SECTION: audit_scope -->');
    expect(bilingual.content).toContain('<!-- SECTION: audit_scope -->');
    expect(zh.content).toContain('`reports/tasks-audit.md`');
    expect(en.content).toContain('`reports/tasks-audit.md`');
    expect(bilingual.content).toContain('`reports/tasks-audit.md`');
  });
});
