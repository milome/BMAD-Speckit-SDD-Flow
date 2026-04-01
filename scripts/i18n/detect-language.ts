export type DetectedLanguage = 'zh' | 'en' | 'mixed' | 'unknown';
export type ResolvedLanguage = 'zh' | 'en' | 'bilingual';

const EXPLICIT_PATTERNS: Array<{ mode: ResolvedLanguage; patterns: RegExp[] }> = [
  {
    mode: 'zh',
    patterns: [/请用中文/u, /用中文/u, /中文回答/u, /输出中文/u],
  },
  {
    mode: 'en',
    patterns: [
      /answer in english/i,
      /respond in english/i,
      /use english/i,
      /output in english/i,
      /请用英文/u,
    ],
  },
  {
    mode: 'bilingual',
    patterns: [/中英双语/u, /双语/u, /\bbilingual\b/i, /both chinese and english/i],
  },
];

function stripCodeLikeSegments(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[A-Za-z]:\\[^\s]*/g, ' ')
    .replace(/\/[\w./-]+/g, ' ')
    .trim();
}

export function detectExplicitLanguageInstruction(message: string): ResolvedLanguage | null {
  let lastMatch: { index: number; mode: ResolvedLanguage } | null = null;

  for (const candidate of EXPLICIT_PATTERNS) {
    for (const pattern of candidate.patterns) {
      const match = pattern.exec(message);
      if (match && (lastMatch === null || match.index > lastMatch.index)) {
        lastMatch = { index: match.index, mode: candidate.mode };
      }
    }
  }

  return lastMatch?.mode ?? null;
}

export function classifyUserMessageLanguage(message: string): DetectedLanguage {
  const visible = stripCodeLikeSegments(message);
  const chars = Array.from(visible);
  const cjkChars = chars.filter((char) => /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(char)).length;
  const nonWhitespaceChars = chars.filter((char) => !/\s/u.test(char)).length;
  const englishWords = visible.match(/[A-Za-z]+/g) ?? [];
  const totalWords = visible.match(/[A-Za-z\u3400-\u9FFF]+/gu) ?? [];

  const cjkRatio = nonWhitespaceChars === 0 ? 0 : cjkChars / nonWhitespaceChars;
  const englishRatio = totalWords.length === 0 ? 0 : englishWords.length / totalWords.length;

  if (visible.length < 12) {
    if (cjkRatio > 0.6) {
      return 'zh';
    }
    if (englishWords.length >= 3 && englishRatio > 0.6 && cjkRatio < 0.2) {
      return 'en';
    }
    return 'unknown';
  }

  if (cjkRatio > 0.6) {
    return 'zh';
  }

  if (englishRatio > 0.6 && cjkRatio < 0.2) {
    return 'en';
  }

  return 'mixed';
}

export function resolveAutoDetectedLanguage(
  messages: DetectedLanguage[],
  allowBilingualAutoMode: boolean
): ResolvedLanguage {
  const recent = messages.slice(-3);
  const zhCount = recent.filter((value) => value === 'zh').length;
  const enCount = recent.filter((value) => value === 'en').length;

  if (zhCount >= 2) {
    return 'zh';
  }

  if (enCount >= 2) {
    return 'en';
  }

  if (allowBilingualAutoMode && recent.some((value) => value === 'mixed')) {
    return 'bilingual';
  }

  const latestNonUnknown = [...recent].reverse().find((value) => value !== 'unknown');
  if (latestNonUnknown === 'zh') {
    return 'zh';
  }
  if (latestNonUnknown === 'en') {
    return 'en';
  }
  if (latestNonUnknown === 'mixed' && allowBilingualAutoMode) {
    return 'bilingual';
  }

  return 'en';
}
