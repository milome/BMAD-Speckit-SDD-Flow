import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../scripts/i18n/render-template';
import { resolveLanguagePolicy } from '../../scripts/i18n/language-policy';
import type { TemplateManifest } from '../../scripts/i18n/validate-template-manifest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

function governanceSnapshotFromResolve() {
  const config = loadConfig();
  const p = resolveRuntimePolicy({ flow: 'story', stage: 'tasks', config });
  return {
    triggerStage: p.triggerStage,
    scoringEnabled: p.scoringEnabled,
    mandatoryGate: p.mandatoryGate,
    granularityGoverned: p.granularityGoverned,
  } as const;
}

function createMinimalManifest(): TemplateManifest {
  return {
    id: 'governance.boundary.audit',
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
      protected_tokens: ['speckit_4_2'],
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
        zh: '输出到 `{{report_path}}`，并保持 `{{trigger_stage}}` 不变。',
        en: 'Write output to `{{report_path}}` and keep `{{trigger_stage}}` unchanged.',
      },
      conclusion_heading: {
        zh: '结论',
        en: 'Conclusion',
      },
      conclusion_body: {
        zh: '门控语义保持不变。',
        en: 'Gate semantics remain unchanged.',
      },
    },
    anchors: {
      audit_scope: 'audit_scope',
      conclusion: 'conclusion',
    },
  };
}

function createPlaceholders(governance: ReturnType<typeof governanceSnapshotFromResolve>) {
  return {
    report_path: 'reports/tasks-audit.md',
    trigger_stage: governance.triggerStage,
  };
}

function createLanguagePolicy(mode: 'zh' | 'en' | 'bilingual') {
  const userMessageByMode = {
    zh: '请用中文回答',
    en: 'Please answer in English.',
    bilingual: '请中英双语输出',
  } as const;

  return resolveLanguagePolicy({
    userMessage: userMessageByMode[mode],
    projectDefaultMode: 'auto',
    projectDefaultArtifactLanguage: 'auto',
    allowBilingualAutoMode: true,
    recentUserMessages:
      mode === 'zh'
        ? ['请继续', '补充说明']
        : mode === 'en'
          ? ['hello', 'continue in English']
          : ['继续', 'continue please'],
  });
}

describe('governance boundary', () => {
  it('does not change governance-owned fields when resolved mode is zh', () => {
    const governance = governanceSnapshotFromResolve();
    const policy = createLanguagePolicy('zh');

    expect(policy.resolvedMode).toBe('zh');
    expect(governance).toEqual(governanceSnapshotFromResolve());
  });

  it('does not change governance-owned fields when resolved mode is en', () => {
    const governance = governanceSnapshotFromResolve();
    const policy = createLanguagePolicy('en');

    expect(policy.resolvedMode).toBe('en');
    expect(governance).toEqual(governanceSnapshotFromResolve());
  });

  it('does not change governance-owned fields when resolved mode is bilingual', () => {
    const governance = governanceSnapshotFromResolve();
    const policy = createLanguagePolicy('bilingual');

    expect(policy.resolvedMode).toBe('bilingual');
    expect(governance).toEqual(governanceSnapshotFromResolve());
  });

  it('preserves governance-owned fields across render modes for the same control input', () => {
    const governance = governanceSnapshotFromResolve();
    const manifest = createMinimalManifest();
    const placeholders = createPlaceholders(governance);

    const zh = renderTemplate({
      manifest,
      languagePolicy: createLanguagePolicy('zh'),
      placeholders,
    });
    const en = renderTemplate({
      manifest,
      languagePolicy: createLanguagePolicy('en'),
      placeholders,
    });
    const bilingual = renderTemplate({
      manifest,
      languagePolicy: createLanguagePolicy('bilingual'),
      placeholders,
    });

    expect(zh.content).toContain('<!-- SECTION: audit_scope -->');
    expect(en.content).toContain('<!-- SECTION: audit_scope -->');
    expect(bilingual.content).toContain('<!-- SECTION: audit_scope -->');
    expect(zh.content).toContain('<!-- SECTION: conclusion -->');
    expect(en.content).toContain('<!-- SECTION: conclusion -->');
    expect(bilingual.content).toContain('<!-- SECTION: conclusion -->');

    expect(governance).toEqual(governanceSnapshotFromResolve());
  });

  it('does not let localized rendering change triggerStage', () => {
    const governance = governanceSnapshotFromResolve();
    const manifest = createMinimalManifest();
    const placeholders = createPlaceholders(governance);

    const zh = renderTemplate({
      manifest,
      languagePolicy: createLanguagePolicy('zh'),
      placeholders,
    });
    const en = renderTemplate({
      manifest,
      languagePolicy: createLanguagePolicy('en'),
      placeholders,
    });
    const bilingual = renderTemplate({
      manifest,
      languagePolicy: createLanguagePolicy('bilingual'),
      placeholders,
    });

    expect(zh.content).toContain('`speckit_4_2`');
    expect(en.content).toContain('`speckit_4_2`');
    expect(bilingual.content).toContain('`speckit_4_2`');
    expect(governance.triggerStage).toBe(governanceSnapshotFromResolve().triggerStage);
  });

  it('structured control mirror remains aligned with top-level governance fields across language modes', () => {
    const governance = resolveRuntimePolicy({
      flow: 'story',
      stage: 'tasks',
      config: loadConfig(),
    });

    expect(governance.control.triggerStage).toBe(governance.triggerStage);
    expect(governance.control.scoringEnabled).toBe(governance.scoringEnabled);
    expect(governance.control.mandatoryGate).toBe(governance.mandatoryGate);
    expect(governance.control.granularityGoverned).toBe(governance.granularityGoverned);
    expect(governance.language.preserveMachineKeys).toBe(true);
    expect(governance.language.preserveParserAnchors).toBe(true);
    expect(governance.language.preserveTriggerStage).toBe(true);
  });
});
