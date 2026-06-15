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

function phrasePattern(phrase) {
  const escaped = escapeRegex(phrase);
  if (WORD_BOUNDARY_PHRASES.has(phrase)) {
    return new RegExp(`\\b${escaped}\\b`, 'iu');
  }
  return new RegExp(escaped, 'iu');
}

function stripInlineCode(text) {
  return String(text || '').replace(/`[^`]*`/gu, '');
}

function findNonDeterministicPhrase(text) {
  const proseOnly = stripInlineCode(text);
  return NON_DETERMINISTIC_PHRASES.find((phrase) => phrasePattern(phrase).test(proseOnly)) || null;
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
