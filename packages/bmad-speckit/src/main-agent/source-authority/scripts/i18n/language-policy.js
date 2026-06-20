"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLanguagePolicy = resolveLanguagePolicy;
/**
 * `LanguagePolicy` is a **language sub-policy** only: display / artifact language resolution.
 * It does **not** carry or derive `auditRequired`, `mandatoryGate`, `scoringEnabled`, or `triggerStage`
 * (those come from Runtime Governance / `resolveRuntimePolicy`).
 * It must not become a second control plane or a second dynamic governance decision surface.
 */
const detect_language_1 = require("./detect-language");
function normalizeArtifactLanguage(mode, resolvedMode) {
    if (!mode || mode === 'auto') {
        return resolvedMode;
    }
    return mode;
}
function resolveLanguagePolicy(input) {
    const explicitMode = (0, detect_language_1.detectExplicitLanguageInstruction)(input.userMessage);
    if (explicitMode) {
        return {
            requestedMode: explicitMode,
            resolvedMode: explicitMode,
            userLanguage: (0, detect_language_1.classifyUserMessageLanguage)(input.userMessage),
            artifactLanguage: normalizeArtifactLanguage(explicitMode, explicitMode),
            detectionSource: 'explicit_user',
            allowBilingualDisplay: input.allowBilingualAutoMode,
            preserveControlKeysInEnglish: true,
            preserveCommandsAndPaths: true,
        };
    }
    if (input.invocationMode && input.invocationMode !== 'auto') {
        return {
            requestedMode: input.invocationMode,
            resolvedMode: input.invocationMode,
            userLanguage: (0, detect_language_1.classifyUserMessageLanguage)(input.userMessage),
            artifactLanguage: normalizeArtifactLanguage(input.invocationMode, input.invocationMode),
            detectionSource: 'invocation_parameter',
            allowBilingualDisplay: input.allowBilingualAutoMode,
            preserveControlKeysInEnglish: true,
            preserveCommandsAndPaths: true,
        };
    }
    if (input.sessionPreference) {
        return {
            requestedMode: input.sessionPreference,
            resolvedMode: input.sessionPreference,
            userLanguage: (0, detect_language_1.classifyUserMessageLanguage)(input.userMessage),
            artifactLanguage: normalizeArtifactLanguage(input.projectDefaultArtifactLanguage, input.sessionPreference),
            detectionSource: 'session_memory',
            allowBilingualDisplay: input.allowBilingualAutoMode,
            preserveControlKeysInEnglish: true,
            preserveCommandsAndPaths: true,
        };
    }
    if (input.projectDefaultMode && input.projectDefaultMode !== 'auto') {
        return {
            requestedMode: input.projectDefaultMode,
            resolvedMode: input.projectDefaultMode,
            userLanguage: (0, detect_language_1.classifyUserMessageLanguage)(input.userMessage),
            artifactLanguage: normalizeArtifactLanguage(input.projectDefaultArtifactLanguage, input.projectDefaultMode),
            detectionSource: 'project_default',
            allowBilingualDisplay: input.allowBilingualAutoMode,
            preserveControlKeysInEnglish: true,
            preserveCommandsAndPaths: true,
        };
    }
    const detectedMessages = input.recentUserMessages
        .slice(-3)
        .map((message) => (0, detect_language_1.classifyUserMessageLanguage)(message));
    const autoResolved = (0, detect_language_1.resolveAutoDetectedLanguage)(detectedMessages, input.allowBilingualAutoMode);
    if (detectedMessages.some((value) => value !== 'unknown')) {
        return {
            requestedMode: 'auto',
            resolvedMode: autoResolved,
            userLanguage: (0, detect_language_1.classifyUserMessageLanguage)(input.userMessage),
            artifactLanguage: normalizeArtifactLanguage(input.projectDefaultArtifactLanguage, autoResolved),
            detectionSource: 'auto_detector',
            allowBilingualDisplay: input.allowBilingualAutoMode,
            preserveControlKeysInEnglish: true,
            preserveCommandsAndPaths: true,
        };
    }
    return {
        requestedMode: 'auto',
        resolvedMode: 'en',
        userLanguage: 'unknown',
        artifactLanguage: 'en',
        detectionSource: 'fallback_default',
        allowBilingualDisplay: input.allowBilingualAutoMode,
        preserveControlKeysInEnglish: true,
        preserveCommandsAndPaths: true,
    };
}
