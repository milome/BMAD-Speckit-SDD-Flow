import { describe, expect, it } from 'vitest';
import {
  detectExplicitLanguageInstruction,
  classifyUserMessageLanguage,
  resolveAutoDetectedLanguage,
} from '../../scripts/i18n/detect-language';
import { resolveLanguagePolicy } from '../../scripts/i18n/language-policy';

describe('language-policy', () => {
  describe('detectExplicitLanguageInstruction', () => {
    it('detects explicit Chinese instruction', () => {
      expect(detectExplicitLanguageInstruction('请用中文详细解释')).toBe('zh');
    });

    it('detects explicit English instruction', () => {
      expect(detectExplicitLanguageInstruction('Please answer in English.')).toBe('en');
    });

    it('detects explicit bilingual instruction', () => {
      expect(detectExplicitLanguageInstruction('请中英双语输出')).toBe('bilingual');
    });

    it('uses the last conflicting instruction in the same message', () => {
      expect(detectExplicitLanguageInstruction('请用中文说明，最后 answer in English')).toBe('en');
    });
  });

  describe('classifyUserMessageLanguage', () => {
    it('classifies Chinese-dominant text as zh', () => {
      expect(classifyUserMessageLanguage('请详细解释这个双语运行时设计方案以及迁移策略')).toBe('zh');
    });

    it('classifies English-dominant text as en', () => {
      expect(
        classifyUserMessageLanguage(
          'Please explain the implementation details of the bilingual runtime and migration plan.'
        )
      ).toBe('en');
    });

    it('classifies short low-signal text as unknown', () => {
      expect(classifyUserMessageLanguage('ok')).toBe('unknown');
    });
  });

  describe('resolveAutoDetectedLanguage', () => {
    it('resolves zh when two of the last three messages are zh', () => {
      expect(resolveAutoDetectedLanguage(['zh', 'en', 'zh'], false)).toBe('zh');
    });

    it('resolves en when two of the last three messages are en', () => {
      expect(resolveAutoDetectedLanguage(['en', 'zh', 'en'], false)).toBe('en');
    });

    it('resolves latest non-unknown language when bilingual auto mode is disabled', () => {
      expect(resolveAutoDetectedLanguage(['mixed', 'unknown', 'zh'], false)).toBe('zh');
    });

    it('resolves bilingual when mixed and bilingual auto mode is enabled', () => {
      expect(resolveAutoDetectedLanguage(['mixed', 'en', 'zh'], true)).toBe('bilingual');
    });

    it('falls back to en when all signals are unknown', () => {
      expect(resolveAutoDetectedLanguage(['unknown', 'unknown', 'unknown'], false)).toBe('en');
    });
  });

  describe('resolveLanguagePolicy', () => {
    it('prefers explicit user instruction over invocation mode and project defaults', () => {
      const policy = resolveLanguagePolicy({
        userMessage: '请用中文回答，但 invocation says en',
        invocationMode: 'en',
        projectDefaultMode: 'en',
        projectDefaultArtifactLanguage: 'en',
        allowBilingualAutoMode: false,
        recentUserMessages: ['hello', 'world'],
      });

      expect(policy.requestedMode).toBe('zh');
      expect(policy.resolvedMode).toBe('zh');
      expect(policy.detectionSource).toBe('explicit_user');
      expect(policy.artifactLanguage).toBe('zh');
    });

    it('uses invocation mode when there is no explicit user instruction', () => {
      const policy = resolveLanguagePolicy({
        userMessage: 'Explain the policy details',
        invocationMode: 'en',
        projectDefaultMode: 'zh',
        projectDefaultArtifactLanguage: 'zh',
        allowBilingualAutoMode: false,
        recentUserMessages: ['请解释一下', '继续'],
      });

      expect(policy.requestedMode).toBe('en');
      expect(policy.resolvedMode).toBe('en');
      expect(policy.detectionSource).toBe('invocation_parameter');
      expect(policy.artifactLanguage).toBe('en');
    });

    it('uses session preference before project default and auto detection', () => {
      const policy = resolveLanguagePolicy({
        userMessage: 'Continue with details',
        sessionPreference: 'zh',
        projectDefaultMode: 'en',
        projectDefaultArtifactLanguage: 'auto',
        allowBilingualAutoMode: false,
        recentUserMessages: ['Continue', 'More details please'],
      });

      expect(policy.requestedMode).toBe('zh');
      expect(policy.resolvedMode).toBe('zh');
      expect(policy.detectionSource).toBe('session_memory');
      expect(policy.artifactLanguage).toBe('zh');
    });

    it('uses project default when there is no stronger signal', () => {
      const policy = resolveLanguagePolicy({
        userMessage: 'Continue',
        projectDefaultMode: 'zh',
        projectDefaultArtifactLanguage: 'auto',
        allowBilingualAutoMode: false,
        recentUserMessages: ['ok', 'go'],
      });

      expect(policy.requestedMode).toBe('zh');
      expect(policy.resolvedMode).toBe('zh');
      expect(policy.detectionSource).toBe('project_default');
      expect(policy.artifactLanguage).toBe('zh');
    });

    it('uses auto detection when requested mode is auto and no stronger signal exists', () => {
      const policy = resolveLanguagePolicy({
        userMessage: '继续说明',
        projectDefaultMode: 'auto',
        projectDefaultArtifactLanguage: 'auto',
        allowBilingualAutoMode: false,
        recentUserMessages: ['Please explain', '请继续说明', '继续细化'],
      });

      expect(policy.requestedMode).toBe('auto');
      expect(policy.resolvedMode).toBe('zh');
      expect(policy.detectionSource).toBe('auto_detector');
      expect(policy.artifactLanguage).toBe('zh');
    });

    it('falls back to en when no usable signal exists', () => {
      const policy = resolveLanguagePolicy({
        userMessage: 'ok',
        projectDefaultMode: 'auto',
        projectDefaultArtifactLanguage: 'auto',
        allowBilingualAutoMode: false,
        recentUserMessages: ['ok', 'go', '1'],
      });

      expect(policy.requestedMode).toBe('auto');
      expect(policy.resolvedMode).toBe('en');
      expect(policy.detectionSource).toBe('fallback_default');
      expect(policy.artifactLanguage).toBe('en');
    });

    it('keeps preserve flags always true', () => {
      const policy = resolveLanguagePolicy({
        userMessage: '请用中文回答',
        projectDefaultMode: 'auto',
        projectDefaultArtifactLanguage: 'auto',
        allowBilingualAutoMode: false,
        recentUserMessages: [],
      });

      expect(policy.preserveControlKeysInEnglish).toBe(true);
      expect(policy.preserveCommandsAndPaths).toBe(true);
    });
  });
});
