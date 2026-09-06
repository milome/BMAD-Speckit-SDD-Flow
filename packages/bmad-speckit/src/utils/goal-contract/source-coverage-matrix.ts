function toSet(values) {
  return new Set(values || []);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function typedSourceIssues(row, knownSourceIds) {
  const issues = [];
  const roles = ['action', 'requirement', 'acceptance', 'binding', 'definition', 'boundary', 'guidance'];
  const provenance = toSet(row.provenanceRefs);
  const bound = (refs) => Array.isArray(refs) && refs.length > 0 && refs.every((ref) => provenance.has(ref));
  if (!roles.includes(row.executionRole) || !bound(row.sourceBlockRefs)) issues.push('typed_source_provenance_invalid');
  if (!['must', 'should', 'may', 'mixed', 'descriptive'].includes(row.normativeStrength) ||
    !['required', 'forbidden', 'permitted', 'preserve', 'mixed', 'descriptive'].includes(row.polarity)) issues.push('typed_source_modality_invalid');
  const clauses = list(row.normativeClauses);
  const clauseIds = clauses.map((clause) => clause.id);
  if (!Array.isArray(row.normativeClauses) || !Array.isArray(row.clauseRefs) ||
    clauseIds.length !== new Set(clauseIds).size ||
    JSON.stringify([...clauseIds].sort()) !== JSON.stringify([...list(row.clauseRefs)].sort()) ||
    (!['action', 'definition'].includes(row.executionRole) && clauses.length === 0)) issues.push('typed_source_clause_coverage_missing');
  if (!Array.isArray(row.conditions) || row.conditions.some((condition) =>
    condition.state !== 'unevaluated' || typeof condition.text !== 'string' || !condition.text.trim() ||
    !bound(condition.sourceRefs))) issues.push('typed_source_condition_invalid');
  const applicability = row.applicability ?? {};
  if (!bound(applicability.sourceRefs) || !['obligations', 'source_scope'].includes(applicability.scope) ||
    (applicability.scope === 'obligations' && (!list(applicability.obligationRefs).length ||
      applicability.obligationRefs.some((ref) => !knownSourceIds.has(ref)))) ||
    (applicability.scope === 'source_scope' && (!applicability.sourceScope?.kind ||
      !Array.isArray(applicability.sourceScope.ownerBlockRefs) ||
      applicability.sourceScope.ownerBlockRefs.some((ref) => !provenance.has(ref))))) issues.push('typed_source_scope_invalid');
  return issues;
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
  const typed = registries?.projectionMode === 'semantic' || obligations.some((row) => row.executionRole !== undefined);
  const knownSourceIds = toSet(obligations.map((row) => row.id));
  // A semantic row may point at a source declaration (for example a FIX
  // heading) that is intentionally not itself an obligation. Those IDs are
  // still source-backed through the row's typed scope and acceptance refs.
  for (const row of obligations) {
    for (const ref of list(row.acceptanceRefs)) knownSourceIds.add(ref);
    for (const ref of list(row.applicability?.obligationRefs)) knownSourceIds.add(ref);
    const owner = row.applicability?.sourceScope?.ownerId;
    if (typeof owner === 'string' && owner) knownSourceIds.add(owner);
  }

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
    if (typed) {
      const issues = typedSourceIssues(obligation, knownSourceIds);
      blockingReasons.push(...issues.map((issue) => `${obligation.id} ${issue}`));
      if (issues.length) unmappedSourceObligations.push(obligation.id);
    }

    for (const [field, allowed] of [
      ['goalTaskRefs', taskIds],
      ['acceptanceRefs', acceptanceIds],
      ['commandRefs', commandIds],
    ]) {
      const refs = list(obligation[field]);
      if (refs.length === 0 && (!typed || obligation.executionRole === 'action')) {
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
    evidenceClassification: 'coverage_only',
    runtimeEvidenceAuthority: false,
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
