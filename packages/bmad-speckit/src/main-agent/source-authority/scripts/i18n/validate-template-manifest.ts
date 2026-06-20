import { assertProtectedTokensPreserved, collectProtectedTokens } from './protected-token-check';
import type { PlaceholderType } from './placeholder-types';

export interface TemplateManifest {
  id?: string;
  version?: number;
  kind?: string;
  control?: {
    stage?: string;
    output_contract?: string;
    required_sections?: string[];
    placeholders?: Record<string, PlaceholderType>;
    protected_tokens?: string[];
  };
  localization?: {
    default_language?: 'zh' | 'en';
    allow_bilingual?: boolean;
  };
  strings?: Record<string, { zh?: string; en?: string }>;
  anchors?: Record<string, string>;
}

export interface TemplateManifestValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_BLOCKS: Array<keyof TemplateManifest> = [
  'control',
  'localization',
  'strings',
  'anchors',
];

function extractPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((match) => match[1]);
}

function collectReferencedProtectedTokens(
  variants: { zh?: string; en?: string },
  protectedTokens: string[]
): string[] {
  const values = Object.values(variants).filter(
    (value): value is string => typeof value === 'string'
  );
  return protectedTokens.filter((token) => values.some((value) => value.includes(token)));
}

export function validateTemplateManifest(
  manifest: TemplateManifest
): TemplateManifestValidationResult {
  const errors: string[] = [];

  for (const block of REQUIRED_BLOCKS) {
    if (!manifest[block]) {
      errors.push(`Missing required block: ${block}`);
    }
  }

  const anchorValues = Object.values(manifest.anchors ?? {});
  const seenAnchors = new Set<string>();
  for (const anchor of anchorValues) {
    if (seenAnchors.has(anchor)) {
      errors.push(`Duplicate anchor value: ${anchor}`);
    }
    seenAnchors.add(anchor);
  }

  for (const [key, variants] of Object.entries(manifest.strings ?? {})) {
    const providedValues = Object.values(variants).filter((value): value is string =>
      Boolean(value)
    );
    if (providedValues.length === 0) {
      errors.push(`Missing all language variants for strings.${key}`);
      continue;
    }

    for (const [language, value] of Object.entries(variants)) {
      for (const placeholder of extractPlaceholders(value ?? '')) {
        if (!manifest.control?.placeholders?.[placeholder]) {
          errors.push(`Undeclared placeholder: ${placeholder} in strings.${key}.${language}`);
        }
      }
    }
  }

  const protectedTokens = collectProtectedTokens(manifest);
  for (const [key, variants] of Object.entries(manifest.strings ?? {})) {
    const referencedTokens = collectReferencedProtectedTokens(variants, protectedTokens);
    if (referencedTokens.length === 0) {
      continue;
    }

    for (const [language, value] of Object.entries(variants)) {
      if (!value) {
        continue;
      }

      const result = assertProtectedTokensPreserved(referencedTokens, [value]);
      for (const error of result.errors) {
        const missing = error.replace('Protected token missing from output: ', '');
        errors.push(`Protected token missing from strings.${key}.${language}: ${missing}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
