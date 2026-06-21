/**
 * Session-scoped language policy: reads i18n defaults via `getI18nConfig` and resolves
 * display / artifact language from the current user message plus recent messages.
 */
import { getI18nConfig, type RuntimeConfig } from '../bmad-config';
import { resolveLanguagePolicy, type LanguagePolicy } from './language-policy';

export function resolveLanguagePolicyForSession(
  config: RuntimeConfig | undefined,
  userMessage: string,
  recentMessages: string[]
): LanguagePolicy {
  const i18n = getI18nConfig(config);
  return resolveLanguagePolicy({
    userMessage,
    recentUserMessages: recentMessages,
    projectDefaultMode: i18n.default_language_mode,
    projectDefaultArtifactLanguage: i18n.default_artifact_language,
    allowBilingualAutoMode: i18n.allow_bilingual_auto_mode,
  });
}

export type { LanguagePolicy };
