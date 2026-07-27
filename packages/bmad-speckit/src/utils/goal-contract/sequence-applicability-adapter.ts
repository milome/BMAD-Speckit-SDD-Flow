const { REQUIRED_SIGNALS } = require(
  __filename.endsWith('.ts')
    ? './sequence-applicability.ts'
    : './sequence-applicability'
);

export type GoalContractSequenceApplicabilityAdapterModule = never;

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort();
}

function completeFalseFacts(evidenceRefs) {
  return Object.fromEntries([
    ...REQUIRED_SIGNALS.map((signal) => [signal, false]),
    ['evidenceRefs', unique(evidenceRefs)],
  ]);
}

function deriveSequenceArchitectureFacts(graph) {
  const sourceRefs = unique(
    (graph?.nodes || [])
      .filter((node) => node?.nodeType === 'source')
      .map((node) => node.id)
  );
  const typed = graph?.sequenceApplicabilityFacts;

  if (typed === undefined) {
    return graph?.schemaVersion === 'goal-contract-evidence-graph/v2'
      ? completeFalseFacts(sourceRefs)
      : { evidenceRefs: [] };
  }
  if (
    typed?.coverage !== 'complete' ||
    !typed.signals ||
    typeof typed.signals !== 'object' ||
    Array.isArray(typed.signals)
  ) {
    return { evidenceRefs: [] };
  }
  const keys = Object.keys(typed.signals).sort();
  const expected = [...REQUIRED_SIGNALS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    expected.some((key) => typeof typed.signals[key] !== 'boolean')
  ) {
    return { evidenceRefs: [] };
  }
  const evidenceRefs = unique(typed.evidenceRefs);
  if (evidenceRefs.length === 0) return { evidenceRefs: [] };
  return Object.fromEntries([
    ...REQUIRED_SIGNALS.map((signal) => [signal, typed.signals[signal]]),
    ['evidenceRefs', evidenceRefs],
  ]);
}

module.exports = {
  deriveSequenceArchitectureFacts,
};
