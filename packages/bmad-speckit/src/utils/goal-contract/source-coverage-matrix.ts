function toSet(values) {
  return new Set(values || []);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function validateGraphSourceCoverage(graph) {
  const sourceIds = graph.nodes
    .filter((node) => node.nodeType === 'source')
    .map((node) => node.id);
  const targetTypes = new Map([
    ['source_to_goal', 'goal'],
    ['source_to_trace', 'trace'],
    ['source_to_acceptance', 'acceptance'],
    ['source_to_command', 'command'],
    ['source_to_evidence', 'evidence'],
  ]);
  const validTargets = new Map(
    [...new Set(targetTypes.values())].map((nodeType) => [
      nodeType,
      new Set(
        graph.nodes
          .filter((node) => node.nodeType === nodeType)
          .map((node) => node.id)
      ),
    ])
  );
  const unmappedSourceObligations = [];
  const orphanGeneratedRefs = [];
  const blockingReasons = [];

  for (const sourceId of sourceIds) {
    for (const [edgeType, targetType] of targetTypes) {
      const bindings = graph.edges.filter(
        (edge) => edge.edgeType === edgeType && edge.from === sourceId
      );
      if (bindings.length === 0) {
        if (!unmappedSourceObligations.includes(sourceId)) {
          unmappedSourceObligations.push(sourceId);
        }
        blockingReasons.push(`${sourceId} missing ${edgeType}`);
      }
      for (const edge of bindings) {
        if (!validTargets.get(targetType).has(edge.to)) {
          orphanGeneratedRefs.push(`${edgeType}:${sourceId}:${edge.to}`);
        }
      }
    }
  }

  return {
    decision:
      sourceIds.length > 0 &&
      unmappedSourceObligations.length === 0 &&
      orphanGeneratedRefs.length === 0
        ? 'pass'
        : 'blocked',
    evidenceClassification: 'coverage_only',
    runtimeEvidenceAuthority: false,
    unmappedSourceObligations,
    orphanGeneratedRefs,
    blockingReasons:
      sourceIds.length === 0
        ? ['source nodes are empty']
        : blockingReasons,
  };
}

function validateSourceCoverage({ sourceObligations, registries, graph }) {
  if (graph) return validateGraphSourceCoverage(graph);
  const obligations = list(sourceObligations);
  const taskIds = toSet(registries?.tasks);
  const acceptanceIds = toSet(registries?.acceptance);
  const commandIds = toSet(registries?.commands);
  const evidenceIds = toSet(registries?.evidence);
  const unmappedSourceObligations = [];
  const orphanGeneratedRefs = [];
  const blockingReasons = [];
  const seen = new Set();

  if (obligations.length === 0) {
    return {
      decision: 'blocked',
      unmappedSourceObligations: [],
      orphanGeneratedRefs: [],
      blockingReasons: ['sourceObligations is empty'],
    };
  }

  for (const obligation of obligations) {
    if (!obligation.sourcePlanHash) blockingReasons.push(`${obligation.id} missing sourcePlanHash`);
    if (seen.has(obligation.id)) blockingReasons.push(`${obligation.id} duplicate source obligation id`);
    seen.add(obligation.id);

    for (const [field, allowed] of [
      ['goalTaskRefs', taskIds],
      ['acceptanceRefs', acceptanceIds],
      ['commandRefs', commandIds],
    ]) {
      const refs = list(obligation[field]);
      if (refs.length === 0) {
        if (!unmappedSourceObligations.includes(obligation.id)) unmappedSourceObligations.push(obligation.id);
        blockingReasons.push(`${obligation.id} missing ${field}`);
      }
      for (const ref of refs) {
        if (!allowed.has(ref)) orphanGeneratedRefs.push(`${obligation.id}:${field}:${ref}`);
      }
    }

    for (const ref of list(obligation.evidenceRefs)) {
      if (!evidenceIds.has(ref)) orphanGeneratedRefs.push(`${obligation.id}:evidenceRefs:${ref}`);
    }
  }

  return {
    decision: unmappedSourceObligations.length === 0 && orphanGeneratedRefs.length === 0 && blockingReasons.length === 0
      ? 'pass'
      : 'blocked',
    unmappedSourceObligations,
    orphanGeneratedRefs,
    blockingReasons,
  };
}

function buildSourceCoverageMatrix({ sourceObligations }) {
  const rows = [
    '| Source ID | Source Kind | Source Ref | Goal Tasks | Acceptance | Commands | Evidence |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const obligation of list(sourceObligations)) {
    rows.push(
      [
        obligation.id,
        obligation.kind,
        `${obligation.sourcePlanPath}:${obligation.lineStart}-${obligation.lineEnd}`,
        list(obligation.goalTaskRefs).join(', '),
        list(obligation.acceptanceRefs).join(', '),
        list(obligation.commandRefs).join(', '),
        list(obligation.evidenceRefs).join(', '),
      ].join(' | ').replace(/^/u, '| ').replace(/$/u, ' |')
    );
  }
  return rows.join('\n');
}

module.exports = {
  buildSourceCoverageMatrix,
  validateGraphSourceCoverage,
  validateSourceCoverage,
};
