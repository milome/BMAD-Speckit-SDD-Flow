import { describe, expect, it } from 'vitest';
import { loadManifest } from '../../scripts/i18n/load-manifest';
import { renderTemplate } from '../../scripts/i18n/render-template';
import type { LanguagePolicy } from '../../scripts/i18n/language-policy';
import { validateTemplateManifest } from '../../scripts/i18n/validate-template-manifest';

function lp(mode: 'zh' | 'en' | 'bilingual'): LanguagePolicy {
  return {
    requestedMode: mode,
    resolvedMode: mode,
    userLanguage: mode === 'zh' ? 'zh' : mode === 'en' ? 'en' : 'mixed',
    artifactLanguage: mode === 'bilingual' ? 'bilingual' : mode,
    detectionSource: 'explicit_user',
    allowBilingualDisplay: mode === 'bilingual',
    preserveControlKeysInEnglish: true,
    preserveCommandsAndPaths: true,
  };
}

const MANIFEST_IDS = [
  'speckit.audit.spec',
  'speckit.audit.plan',
  'speckit.audit.tasks',
  'speckit.audit.implement',
] as const;

describe('loadManifest + renderTemplate (E15-S2 manifests)', () => {
  for (const id of MANIFEST_IDS) {
    it(`${id} validates and renders zh/en/bilingual`, () => {
      const manifest = loadManifest(id);
      const v = validateTemplateManifest(manifest);
      expect(v.valid, v.errors.join('; ')).toBe(true);

      const placeholders = { epic: '15', story: '2' };
      const zh = renderTemplate({ manifest, languagePolicy: lp('zh'), placeholders });
      const en = renderTemplate({ manifest, languagePolicy: lp('en'), placeholders });
      const bi = renderTemplate({ manifest, languagePolicy: lp('bilingual'), placeholders });

      expect(zh.content.length).toBeGreaterThan(20);
      expect(en.content.length).toBeGreaterThan(20);
      expect(bi.content).toContain(' / ');
      expect(zh.content).toMatch(/总体评级|审计范围/);
      expect(en.content).toMatch(/Overall Grade|Audit Scope/i);
    });
  }
});
