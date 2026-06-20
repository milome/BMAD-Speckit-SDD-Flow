"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLanguagePolicyForSession = resolveLanguagePolicyForSession;
/**
 * Session-scoped language policy: reads i18n defaults via `getI18nConfig` and resolves
 * display / artifact language from the current user message plus recent messages.
 */
const bmad_config_1 = require("../bmad-config");
const language_policy_1 = require("./language-policy");
function resolveLanguagePolicyForSession(config, userMessage, recentMessages) {
    const i18n = (0, bmad_config_1.getI18nConfig)(config);
    return (0, language_policy_1.resolveLanguagePolicy)({
        userMessage,
        recentUserMessages: recentMessages,
        projectDefaultMode: i18n.default_language_mode,
        projectDefaultArtifactLanguage: i18n.default_artifact_language,
        allowBilingualAutoMode: i18n.allow_bilingual_auto_mode,
    });
}
