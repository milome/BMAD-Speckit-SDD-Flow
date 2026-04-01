import { describe, expect, it } from 'vitest';
import { renderTemplate, type RenderTemplateInput } from '../../scripts/i18n/render-template';
import type { TemplateManifest } from '../../scripts/i18n/validate-template-manifest';

function createManifest(): TemplateManifest {
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
      audit_scope_heading: {
        zh: '审计范围',
        en: 'Audit Scope',
      },
      audit_scope_body: {
        zh: '运行 `{{report_path}}`，并保持 `{{trigger_stage}}` 不变。',
        en: 'Run `{{report_path}}` and keep `{{trigger_stage}}` unchanged.',
      },
      conclusion_heading: {
        zh: '结论',
        en: 'Conclusion',
      },
      conclusion_body: {
        zh: '总体评级: [A|B|C|D]',
        en: '总体评级: [A|B|C|D]',
      },
    },
    anchors: {
      audit_scope: 'audit_scope',
      conclusion: 'conclusion',
    },
  };
}

function createInput(language: 'zh' | 'en' | 'bilingual'): RenderTemplateInput {
  return {
    manifest: createManifest(),
    languagePolicy: {
      requestedMode: language === 'bilingual' ? 'bilingual' : language,
      resolvedMode: language,
      userLanguage: language === 'zh' ? 'zh' : language === 'en' ? 'en' : 'mixed',
      artifactLanguage: language,
      detectionSource: 'explicit_user',
      allowBilingualDisplay: true,
      preserveControlKeysInEnglish: true,
      preserveCommandsAndPaths: true,
    },
    placeholders: {
      report_path: 'reports/tasks-audit.md',
      trigger_stage: 'speckit_4_2',
    },
  };
}

describe('renderTemplate', () => {
  it('renders zh headings and body with anchors', () => {
    const output = renderTemplate(createInput('zh'));

    expect(output.content).toContain('<!-- SECTION: audit_scope -->');
    expect(output.content).toContain('## 审计范围');
    expect(output.content).toContain('运行 `reports/tasks-audit.md`');
    expect(output.content).toContain('`speckit_4_2`');
  });

  it('renders en headings and body with anchors', () => {
    const output = renderTemplate(createInput('en'));

    expect(output.content).toContain('<!-- SECTION: audit_scope -->');
    expect(output.content).toContain('## Audit Scope');
    expect(output.content).toContain('Run `reports/tasks-audit.md`');
    expect(output.content).toContain('`speckit_4_2`');
  });

  it('renders bilingual headings as zh / en', () => {
    const output = renderTemplate(createInput('bilingual'));

    expect(output.content).toContain('## 审计范围 / Audit Scope');
    expect(output.content).toContain('## 结论 / Conclusion');
  });

  it('applies fallback diagnostics when a single-language variant is missing', () => {
    const manifest = createManifest();
    manifest.strings.audit_scope_body = {
      en: 'Run `{{report_path}}` and keep `{{trigger_stage}}` unchanged.',
    };

    const output = renderTemplate({
      ...createInput('zh'),
      manifest,
    });

    expect(output.fallbackApplied).toBe(true);
    expect(output.fallbacks).toContain('strings.audit_scope_body.zh -> en');
  });

  it('fails when bilingual rendering requires both language variants and one is missing', () => {
    const manifest = createManifest();
    manifest.strings.conclusion_heading = {
      zh: '结论',
    };

    expect(() =>
      renderTemplate({
        ...createInput('bilingual'),
        manifest,
      })
    ).toThrow('Missing bilingual variant for strings.conclusion_heading');
  });

  it('changes headings and prose only while keeping anchors and protected tokens stable', () => {
    const manifest = createManifest();
    manifest.strings.audit_scope_body = {
      zh: '运行 `{{report_path}}`，执行 `npx bmad-speckit score --triggerStage {{trigger_stage}}`。',
      en: 'Run `{{report_path}}` and execute `npx bmad-speckit score --triggerStage {{trigger_stage}}`.',
    };

    const zh = renderTemplate({
      ...createInput('zh'),
      manifest,
    });
    const en = renderTemplate({
      ...createInput('en'),
      manifest,
    });

    expect(zh.content).toContain('## 审计范围');
    expect(en.content).toContain('## Audit Scope');
    expect(zh.content).toContain('运行 `reports/tasks-audit.md`');
    expect(en.content).toContain('Run `reports/tasks-audit.md`');

    expect(zh.content).toContain('<!-- SECTION: audit_scope -->');
    expect(en.content).toContain('<!-- SECTION: audit_scope -->');
    expect(zh.content).toContain('npx bmad-speckit score --triggerStage speckit_4_2');
    expect(en.content).toContain('npx bmad-speckit score --triggerStage speckit_4_2');
  });

  it('fails when a placeholder is unresolved', () => {
    expect(() =>
      renderTemplate({
        manifest: createManifest(),
        languagePolicy: createInput('en').languagePolicy,
        placeholders: {
          report_path: 'reports/tasks-audit.md',
        },
      })
    ).toThrow('Missing placeholder value: trigger_stage');
  });
});
