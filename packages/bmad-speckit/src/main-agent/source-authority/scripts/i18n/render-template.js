"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
const validate_template_manifest_1 = require("./validate-template-manifest");
function resolveStringVariant(key, variants, language) {
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
            value: variants[language],
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
function substitutePlaceholders(content, placeholders) {
    return content.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
        if (!(key in placeholders)) {
            throw new Error(`Missing placeholder value: ${key}`);
        }
        return placeholders[key];
    });
}
function orderedSectionKeys(manifest) {
    return Object.keys(manifest.anchors ?? {});
}
function renderTemplate(input) {
    const validation = (0, validate_template_manifest_1.validateTemplateManifest)(input.manifest);
    if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`);
    }
    const language = input.languagePolicy.resolvedMode;
    const fallbacks = [];
    const blocks = [];
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
