const NON_DETERMINISTIC_PHRASES = [
  'if refactoring',
  'as needed',
  'where appropriate',
  'where applicable',
  'optional',
  'allowed',
  'might',
  'should',
  'may',
  'can',
  '可选',
  '可以',
  '如需',
  '必要时',
  '建议',
  '允许',
];

const WORD_BOUNDARY_PHRASES = new Set([
  'optional',
  'allowed',
  'might',
  'should',
  'may',
  'can',
]);

const EXECUTABLE_OBLIGATION_KINDS = new Set([
  'command_block',
  'completion_criteria',
  'failure_handling',
  'file_map',
  'heading_execution_segment',
  'observability',
  'public_surface_scan',
  'release_gate',
]);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function phrasePattern(phrase, flags = 'iu') {
  const escaped = escapeRegex(phrase);
  if (WORD_BOUNDARY_PHRASES.has(phrase)) {
    return new RegExp(`\\b${escaped}\\b`, flags);
  }
  return new RegExp(escaped, flags);
}

function stripInlineCode(text) {
  return String(text || '').replace(/`[^`]*`/gu, '');
}

function boundedContext(text, index, beforeLength = 240, afterLength = 320) {
  return {
    before: text.slice(Math.max(0, index - beforeLength), index),
    after: text.slice(index, index + afterLength),
    full: text,
  };
}

function isIdentityBoundPublication(before, after) {
  return (
    /\b(?:is|are|must be|shall be)\s+[^.!?\n;]{0,180}\b(?:byte-identical|identical|equal)\s+(?:to|with)\b[^.!?\n;]{0,180}$/iu.test(
      before
    ) &&
    /^may\s+(?:publish|write|emit|copy|install|expose)\b/iu.test(after)
  );
}

function isDeterministicMayUsage(text, index) {
  const { before, after, full } = boundedContext(text, index);
  return (
    /^may\s+not\b/iu.test(after) ||
    /\bmay\s+not\b/iu.test(full) ||
    isIdentityBoundPublication(before, after) ||
    /\b(?:no|only|either|neither|exactly)\b[^.!?\n;]{0,220}$/iu.test(before) ||
    /\bdecides?\s+which\b[^.!?\n;]{0,220}$/iu.test(before) ||
    /^may\b[^.!?\n;]{0,220}\bonly\b/iu.test(after) ||
    /^may\b[^.!?\n;]{0,220}\bwhile\s+(?:exactly\s+)?one\b/iu.test(
      after
    ) ||
    /^may\b[^.!?\n]{0,260}\bbut\s+(?:must|shall)\s+(?:not|never)\b/iu.test(
      after
    ) ||
    /^may\b[^.!?\n]{0,260}\bbut\s+no\b/iu.test(after) ||
    /^may\b[^.!?\n]{0,260}\b(?:but\s+not|without)\b/iu.test(after) ||
    /\b(?:cannot|must not|shall not)\b/iu.test(full)
  );
}

function isDeterministicAllowedUsage(text, index) {
  const { before, after } = boundedContext(text, index);
  return (
    /\b(?:exactly|only|validate|verify|constrain|enumerate|reject|accept|check|list)\b[^.!?\n;]{0,220}$/iu.test(
      before
    ) ||
    /^allowed\b[^.!?\n;]{0,160}\bonly\s+(?:after|before|if|when)\b/iu.test(
      after
    ) ||
    /^allowed\b[^.!?\n;]{0,160};[^.!?\n;]{0,220}\bis\s+not\b/iu.test(
      after
    )
  );
}

function isDeterministicCanUsage(text, index) {
  const { before, after, full } = boundedContext(text, index);
  return (
    /\bno\b[^.!?\n;]{0,220}$/iu.test(before) ||
    /\b(?:closes?|passes?|succeeds?|completes?|is complete)\s+(?:only\s+)?when\b[^.!?\n]{0,300}$/iu.test(
      before
    ) ||
    /\brequire(?:s|d)?\b[^.!?\n]{0,300}\bbefore\b[^.!?\n]{0,220}$/iu.test(
      before
    ) ||
    /\bdifferent\b[^.!?\n]{0,220}$/iu.test(before) &&
      /^can\s+produce\b[^.!?\n]{0,220}\bdifferent\b/iu.test(after) ||
    /\bdeterministic\b[^.!?\n]{0,180}$/iu.test(before) &&
      /^can\s+(?:produce|emit|generate|derive|compute|prove)\b/iu.test(after) ||
    /\bcannot\b/iu.test(full) && /\bno\b/iu.test(full)
  );
}

function isDeterministicOptionalUsage(sourceText, text, index) {
  const { before, after } = boundedContext(text, index);
  return (
    /\boptional\b[^.!?\n]{0,260}\b(?:otherwise|default|fallback)\b/iu.test(
      sourceText
    ) ||
    /\bany\s+$/iu.test(before) &&
      /^optional\b[^.!?\n]{0,260}\b(?:cannot|must not|shall not)\b/iu.test(
        after
      )
  );
}

function isDeterministicPhraseUsage(phrase, sourceText, proseOnly, index) {
  if (phrase === 'may') return isDeterministicMayUsage(proseOnly, index);
  if (phrase === 'allowed') {
    return isDeterministicAllowedUsage(proseOnly, index);
  }
  if (phrase === 'can') return isDeterministicCanUsage(proseOnly, index);
  if (phrase === 'optional') {
    return isDeterministicOptionalUsage(sourceText, proseOnly, index);
  }
  return false;
}

function findNonDeterministicPhrase(text) {
  const sourceText = String(text || '');
  const proseOnly = stripInlineCode(sourceText);
  for (const phrase of NON_DETERMINISTIC_PHRASES) {
    const matches = proseOnly.matchAll(phrasePattern(phrase, 'giu'));
    for (const match of matches) {
      if (
        !isDeterministicPhraseUsage(
          phrase,
          sourceText,
          proseOnly,
          match.index
        )
      ) {
        return phrase;
      }
    }
  }
  return null;
}

function isExecutableSourceObligation(obligation) {
  return EXECUTABLE_OBLIGATION_KINDS.has(obligation?.kind);
}

function validateDeterministicSourceObligations(sourceObligations) {
  for (const obligation of sourceObligations || []) {
    if (!isExecutableSourceObligation(obligation)) continue;
    const text = String(obligation.text || '');
    const matchedPhrase = findNonDeterministicPhrase(text);
    if (!matchedPhrase) continue;
    const error = new Error('non_deterministic_source_obligation');
    error.failureClass = 'non_deterministic_source_obligation';
    error.sourceId = obligation.id;
    error.lineStart = obligation.lineStart;
    error.lineEnd = obligation.lineEnd;
    error.matchedPhrase = matchedPhrase;
    error.sourceExcerpt = text.slice(0, 500);
    error.repairHint = 'Rewrite this source obligation with deterministic MUST or MUST NOT language before generating a goal contract.';
    throw error;
  }
}

module.exports = {
  EXECUTABLE_OBLIGATION_KINDS,
  NON_DETERMINISTIC_PHRASES,
  findNonDeterministicPhrase,
  isExecutableSourceObligation,
  stripInlineCode,
  validateDeterministicSourceObligations,
};
