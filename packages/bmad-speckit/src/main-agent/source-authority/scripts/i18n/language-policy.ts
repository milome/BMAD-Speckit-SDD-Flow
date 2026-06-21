/**
 * `LanguagePolicy` is a **language sub-policy** only: display / artifact language resolution.
 * It does **not** carry or derive `auditRequired`, `mandatoryGate`, `scoringEnabled`, or `triggerStage`
 * (those come from Runtime Governance / `resolveRuntimePolicy`).
 * It must not become a second control plane or a second dynamic governance decision surface.
 */
import {
  classifyUserMessageLanguage,
  detectExplicitLanguageInstruction,
  resolveAutoDetectedLanguage,
  type ResolvedLanguage,
} from './detect-language';

export type LanguageMode = 'zh' | 'en' | 'bilingual' | 'auto';

export interface LanguagePolicy {
  requestedMode: LanguageMode;
  resolvedMode: ResolvedLanguage;
  userLanguage: 'zh' | 'en' | 'mixed' | 'unknown';
  artifactLanguage: 'zh' | 'en' | 'bilingual';
  detectionSource:
    | 'explicit_user'
    | 'invocation_parameter'
    | 'session_memory'
    | 'project_default'
    | 'auto_detector'
    | 'fallback_default';
  allowBilingualDisplay: boolean;
  preserveControlKeysInEnglish: true;
  preserveCommandsAndPaths: true;
}

export interface ResolveLanguagePolicyInput {
  userMessage: string;
  invocationMode?: LanguageMode;
  sessionPreference?: Exclude<LanguageMode, 'auto'>;
  projectDefaultMode?: LanguageMode;
  projectDefaultArtifactLanguage?: LanguageMode;
  allowBilingualAutoMode: boolean;
  recentUserMessages: string[];
}

function normalizeArtifactLanguage(
  mode: LanguageMode | undefined,
  resolvedMode: ResolvedLanguage
): 'zh' | 'en' | 'bilingual' {
  if (!mode || mode === 'auto') {
    return resolvedMode;
  }

  return mode;
}

export function resolveLanguagePolicy(input: ResolveLanguagePolicyInput): LanguagePolicy {
  const explicitMode = detectExplicitLanguageInstruction(input.userMessage);
  if (explicitMode) {
    return {
      requestedMode: explicitMode,
      resolvedMode: explicitMode,
      userLanguage: classifyUserMessageLanguage(input.userMessage),
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
      userLanguage: classifyUserMessageLanguage(input.userMessage),
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
      userLanguage: classifyUserMessageLanguage(input.userMessage),
      artifactLanguage: normalizeArtifactLanguage(
        input.projectDefaultArtifactLanguage,
        input.sessionPreference
      ),
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
      userLanguage: classifyUserMessageLanguage(input.userMessage),
      artifactLanguage: normalizeArtifactLanguage(
        input.projectDefaultArtifactLanguage,
        input.projectDefaultMode
      ),
      detectionSource: 'project_default',
      allowBilingualDisplay: input.allowBilingualAutoMode,
      preserveControlKeysInEnglish: true,
      preserveCommandsAndPaths: true,
    };
  }

  const detectedMessages = input.recentUserMessages
    .slice(-3)
    .map((message) => classifyUserMessageLanguage(message));
  const autoResolved = resolveAutoDetectedLanguage(detectedMessages, input.allowBilingualAutoMode);

  if (detectedMessages.some((value) => value !== 'unknown')) {
    return {
      requestedMode: 'auto',
      resolvedMode: autoResolved,
      userLanguage: classifyUserMessageLanguage(input.userMessage),
      artifactLanguage: normalizeArtifactLanguage(
        input.projectDefaultArtifactLanguage,
        autoResolved
      ),
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
