/**
 * CLI user-visible strings (TP.1). BMAD_SPECKIT_LOCALE=zh|en (default en).
 */
/**
 * Resolve CLI locale from environment.
 * @returns {'zh' | 'en'} Normalized locale
 */
function locale() {
  const v = (process.env.BMAD_SPECKIT_LOCALE || 'en').toLowerCase();
  return v === 'zh' ? 'zh' : 'en';
}

const STR = {
  en: {
    postInitGuide:
      'Init complete. Run `/bmad-help` in your AI IDE for next steps, or start Spec-Driven Development with `speckit.constitution`.',
    feedbackHint: 'Feedback: run `bmad-speckit feedback` to get the feedback entry.',
  },
  zh: {
    postInitGuide:
      'Init 完成。建议在 AI IDE 中运行 `/bmad-help` 获取下一步指引，或运行 `speckit.constitution` 开始 Spec-Driven Development。',
    feedbackHint: 'Feedback: 运行 `bmad-speckit feedback` 获取反馈入口。',
  },
};

/**
 * Look up a localized CLI string.
 * @param {keyof typeof STR.en} key - String key
 * @returns {string} Localized message
 */
function t(key) {
  const loc = locale();
  return STR[loc][key] ?? STR.en[key];
}

module.exports = {
  locale,
  postInitGuideMsg: () => t('postInitGuide'),
  feedbackHintMsg: () => t('feedbackHint'),
};
