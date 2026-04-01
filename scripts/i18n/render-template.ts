/**
 * Template rendering consumes **only** manifest control metadata, `LanguagePolicy`, and caller-supplied placeholders.
 * **Do not** import `runtime-governance` or `bmad-config` governance helpers here.
 * Callers must pass governance-derived values (e.g. `triggerStage`) from `resolveRuntimePolicy` into placeholders;
 * **do not** infer `triggerStage` / `scoringEnabled` from manifest `control` blocks (§B.9).
 */
import type { LanguagePolicy } from './language-policy';
import { validateTemplateManifest, type TemplateManifest } from './validate-template-manifest';

export interface RenderTemplateInput {
  manifest: TemplateManifest;
  languagePolicy: LanguagePolicy;
  placeholders: Record<string, string>;
}

export interface RenderTemplateResult {
  content: string;
  fallbackApplied: boolean;
  fallbacks: string[];
}

function resolveStringVariant(
  key: string,
  variants: { zh?: string; en?: string },
  language: 'zh' | 'en' | 'bilingual'
): { value: string; fallbackApplied: boolean; fallback?: string } {
  if (language === 'bilingual') {
    if (!variants.zh || !variants.en) {
      throw new Error(`Missing bilingual variant for strings.${key}`);
    }

    return {
      value: `${variants.zh} / ${variants.en}`,
      fallbackApplied: false,
    };
  }

  if (variants[language]) {
    return {
      value: variants[language] as string,
      fallbackApplied: false,
    };
  }

  const fallbackLanguage = language === 'zh' ? 'en' : 'zh';
  const fallbackValue = variants[fallbackLanguage];
  if (!fallbackValue) {
    throw new Error(`Missing variant for strings.${key}`);
  }

  return {
    value: fallbackValue,
    fallbackApplied: true,
    fallback: `strings.${key}.${language} -> ${fallbackLanguage}`,
  };
}

function substitutePlaceholders(content: string, placeholders: Record<string, string>): string {
  return content.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => {
    if (!(key in placeholders)) {
      throw new Error(`Missing placeholder value: ${key}`);
    }

    return placeholders[key];
  });
}

function orderedSectionKeys(manifest: TemplateManifest): string[] {
  return Object.keys(manifest.anchors ?? {});
}

export function renderTemplate(input: RenderTemplateInput): RenderTemplateResult {
  const validation = validateTemplateManifest(input.manifest);
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`);
  }

  const language = input.languagePolicy.resolvedMode;
  const fallbacks: string[] = [];
  const blocks: string[] = [];

  for (const sectionKey of orderedSectionKeys(input.manifest)) {
    const headingKey = `${sectionKey}_heading`;
    const bodyKey = `${sectionKey}_body`;

    const headingVariants = input.manifest.strings?.[headingKey];
    const bodyVariants = input.manifest.strings?.[bodyKey];

    if (!headingVariants || !bodyVariants) {
      continue;
    }

    const heading = resolveStringVariant(headingKey, headingVariants, language);
    const body = resolveStringVariant(bodyKey, bodyVariants, language);

    if (heading.fallbackApplied && heading.fallback) {
      fallbacks.push(heading.fallback);
    }
    if (body.fallbackApplied && body.fallback) {
      fallbacks.push(body.fallback);
    }

    blocks.push(`<!-- SECTION: ${input.manifest.anchors?.[sectionKey]} -->`);
    blocks.push(`## ${substitutePlaceholders(heading.value, input.placeholders)}`);
    blocks.push(substitutePlaceholders(body.value, input.placeholders));
  }

  return {
    content: blocks.join('\n\n'),
    fallbackApplied: fallbacks.length > 0,
    fallbacks,
  };
}
