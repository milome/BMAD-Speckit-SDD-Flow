const { createHash } = require('node:crypto');

export type GoalContractEvidenceGraphModule = never;

const PROJECTION_REGISTRY = Object.freeze(
  [
    {
      id: 'projection.trace_slices',
      key: 'traceSlices',
      sectionTitle: 'Trace Slice Tracking Matrix',
      semanticRole: 'execution_order',
    },
    {
      id: 'projection.strict_acceptance',
      key: 'strictAcceptance',
      sectionTitle: 'Strict Acceptance Checklist',
      semanticRole: 'executor_completion_checklist',
    },
    {
      id: 'projection.acceptance_traceability',
      key: 'acceptanceTraceability',
      sectionTitle: 'Acceptance Traceability Matrix',
      semanticRole: 'acceptance_implementation_evidence_join',
    },
    {
      id: 'projection.source_coverage',
      key: 'sourceCoverage',
      sectionTitle: 'Source Coverage Matrix',
      semanticRole: 'source_obligation_completeness',
    },
    {
      id: 'projection.manual_scenarios',
      key: 'manualScenarios',
      sectionTitle: 'Manual Verification Scenarios',
      semanticRole: 'human_observable_real_entry_behavior',
    },
    {
      id: 'projection.completion_evidence',
      key: 'completionEvidence',
      sectionTitle: 'Completion Evidence Packet',
      semanticRole: 'expected_observed_evidence_closure',
    },
    {
      id: 'projection.stop_conditions',
      key: 'stopConditions',
      sectionTitle: 'Stop Conditions',
      semanticRole: 'terminal_decision_failure_classification',
    },
  ].map((projection) => Object.freeze({ ...projection, runtimeEvidenceAuthority: false }))
);

const NODE_PROJECTIONS = Object.freeze({
  source: ['projection.trace_slices', 'projection.source_coverage', 'projection.stop_conditions'],
  goal: [
    'projection.trace_slices',
    'projection.strict_acceptance',
    'projection.acceptance_traceability',
    'projection.source_coverage',
  ],
  trace: [
    'projection.trace_slices',
    'projection.acceptance_traceability',
    'projection.source_coverage',
    'projection.stop_conditions',
  ],
  acceptance: [
    'projection.trace_slices',
    'projection.strict_acceptance',
    'projection.acceptance_traceability',
    'projection.completion_evidence',
  ],
  command: [
    'projection.trace_slices',
    'projection.strict_acceptance',
    'projection.acceptance_traceability',
    'projection.source_coverage',
    'projection.manual_scenarios',
    'projection.completion_evidence',
  ],
  evidence: [
    'projection.trace_slices',
    'projection.strict_acceptance',
    'projection.acceptance_traceability',
    'projection.source_coverage',
    'projection.manual_scenarios',
    'projection.completion_evidence',
    'projection.stop_conditions',
  ],
  manualScenario: ['projection.manual_scenarios'],
  stopCondition: ['projection.stop_conditions'],
  symbol: [
    'projection.trace_slices',
    'projection.acceptance_traceability',
    'projection.manual_scenarios',
  ],
  path: ['projection.trace_slices', 'projection.source_coverage'],
});

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort(compareIds);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value, fallbackId = undefined) {
  if (typeof value === 'string') return { id: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { id: fallbackId };
  }
  return structuredClone(value);
}

function stableIdentity(prefix, literal) {
  return `${prefix}-${sha256(Buffer.from(String(literal), 'utf8'))
    .slice('sha256:'.length, 'sha256:'.length + 16)
    .toUpperCase()}`;
}

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...details });
  return error;
}

function requiredId(record, nodeType) {
  const id = String(record?.id || '').trim();
  if (!id) throw failure('evidence_graph_node_id_missing', { nodeType });
  return id;
}

function commandReferences(trace) {
  return uniqueSorted([
    ...asArray(trace.directCommands),
    ...asArray(trace.impactedCommands),
    ...asArray(trace.integrationCommands),
    ...asArray(trace.regressionCommands),
    ...asArray(trace.commandIds),
  ]);
}

function nodeProjectionIds(nodeType) {
  return [...(NODE_PROJECTIONS[nodeType] || [])];
}

function normalizeNode(nodeType, record) {
  const normalized = {
    ...record,
    id: requiredId(record, nodeType),
    nodeType,
    projectionIds: nodeProjectionIds(nodeType),
  };
  for (const [key, value] of Object.entries(normalized)) {
    if (Array.isArray(value)) normalized[key] = uniqueSorted(value);
  }
  return normalized;
}

function mergeNode(existing, incoming) {
  const merged = { ...existing, ...incoming };
  for (const key of new Set([...Object.keys(existing), ...Object.keys(incoming)])) {
    if (Array.isArray(existing[key]) || Array.isArray(incoming[key])) {
      merged[key] = uniqueSorted([...asArray(existing[key]), ...asArray(incoming[key])]);
    }
  }
  return merged;
}

function buildRanges(nodes) {
  return Object.fromEntries(
    Object.keys(NODE_PROJECTIONS)
      .sort(compareIds)
      .map((nodeType) => {
        const ids = nodes.filter((node) => node.nodeType === nodeType).map((node) => node.id);
        return [
          nodeType,
          {
            count: ids.length,
            first: ids.at(0) || null,
            last: ids.at(-1) || null,
          },
        ];
      })
  );
}

function hashNormalizedTraceSubgraph({ nodes, edges }) {
  const normalized = {
    nodes: nodes.map(({ projectionIds: _projectionIds, ...node }) => node),
    edges: edges.map(({ id: _id, projectionIds: _projectionIds, ...edge }) => edge),
  };
  return sha256(Buffer.from(stableStringify(normalized), 'utf8'));
}

function buildEvidenceGraph(reconciliation) {
  if (
    reconciliation?.metrics?.reconciliationCount !== 1 ||
    ![
      'goal-contract-reconciled-graph-input/v1',
      'goal-contract-reconciled-graph-input/v2',
    ].includes(reconciliation?.graphInput?.schemaVersion)
  ) {
    throw failure('evidence_graph_requires_single_reconciliation');
  }
  const input = reconciliation.graphInput;
  const nodeMap = new Map();
  const edgeMap = new Map();

  function addNode(nodeType, value, fallbackId = undefined) {
    const record = asRecord(value, fallbackId);
    const normalized = normalizeNode(nodeType, record);
    const key = `${nodeType}:${normalized.id}`;
    nodeMap.set(key, nodeMap.has(key) ? mergeNode(nodeMap.get(key), normalized) : normalized);
    return normalized.id;
  }

  function addEdge(edgeType, from, to, fields = {}) {
    if (!from || !to) return;
    const fromNode = [...nodeMap.values()].find((node) => node.id === from);
    const toNode = [...nodeMap.values()].find((node) => node.id === to);
    const projectionIds = uniqueSorted(
      (fromNode?.projectionIds || []).filter((projectionId) =>
        (toNode?.projectionIds || []).includes(projectionId)
      )
    );
    const key = `${edgeType}:${from}:${to}`;
    edgeMap.set(key, {
      edgeType,
      from,
      to,
      ...fields,
      projectionIds:
        projectionIds.length > 0
          ? projectionIds
          : uniqueSorted([...(fromNode?.projectionIds || []), ...(toNode?.projectionIds || [])]),
    });
  }

  for (const source of input.sourceObligations || []) {
    addNode('source', source);
  }
  for (const task of input.tasks || []) {
    const taskRecord = asRecord(task);
    addNode('goal', taskRecord);
    for (const sourceId of asArray(taskRecord.sourceIds)) {
      addNode('source', { id: sourceId });
      addEdge('source_to_goal', sourceId, taskRecord.id);
    }
  }
  for (const symbol of input.productionSymbols || []) {
    const record =
      typeof symbol === 'string'
        ? { id: stableIdentity('SYMBOL', symbol), literal: symbol }
        : symbol;
    addNode('symbol', record);
  }
  for (const allowedPath of input.allowedPaths || []) {
    const record =
      typeof allowedPath === 'string'
        ? { id: stableIdentity('PATH', allowedPath), literal: allowedPath }
        : allowedPath;
    addNode('path', record);
  }

  const commandIdsByKind = {};
  for (const kind of ['direct', 'impacted', 'integration', 'regression']) {
    commandIdsByKind[kind] = [];
    for (const command of input.commands?.[kind] || []) {
      const record = asRecord(command);
      const id = requiredId(record, 'command');
      const productionEntryPoint =
        record.productionEntryPoint || (input.productionEntryPoints || []).length === 1
          ? record.productionEntryPoint || input.productionEntryPoints[0]
          : null;
      const requiredFields = {
        literal: record.literal,
        expectedExitBehavior: record.expectedExitBehavior,
        productionEntryPoint,
        evidenceType: record.evidenceType,
        provenanceFields: record.provenanceFields,
        freshnessRule: record.freshnessRule,
      };
      const missingFields = Object.entries(requiredFields)
        .filter(([, value]) => (Array.isArray(value) ? value.length === 0 : !value))
        .map(([field]) => field);
      if (missingFields.length > 0) {
        throw failure('evidence_graph_command_literal_incomplete', {
          commandId: id,
          missingFields,
        });
      }
      addNode('command', {
        ...record,
        id,
        commandKinds: [kind],
        productionEntryPoint,
      });
      commandIdsByKind[kind].push(id);
    }
  }

  for (const evidence of input.expectedEvidence || []) {
    const record = asRecord(evidence);
    addNode('evidence', record);
    if (record.producer) {
      addEdge('evidence_to_command', record.id, record.producer);
    }
  }
  for (const [index, scenario] of (input.manualScenarios || []).entries()) {
    addNode('manualScenario', scenario, `MV-${String(index + 1).padStart(3, '0')}`);
  }
  for (const [index, condition] of (input.stopConditions || []).entries()) {
    addNode('stopCondition', condition, `STOP-${String(index + 1).padStart(3, '0')}`);
  }

  for (const trace of input.traceSlices || []) {
    const record = asRecord(trace);
    addNode('trace', record);
    const goalIds = uniqueSorted(record.goalIds);
    const sourceIds = uniqueSorted(record.sourceIds);
    const acceptanceIds = uniqueSorted(record.acceptanceIds);
    const evidenceIds = uniqueSorted(record.evidenceIds);
    const stopConditionIds = uniqueSorted(record.stopConditionIds);
    const traceCommandIds = commandReferences(record);
    const traceSymbolIds = asArray(record.productionSymbols).map((symbol) =>
      typeof symbol === 'string' ? stableIdentity('SYMBOL', symbol) : requiredId(symbol, 'symbol')
    );
    const tracePathIds = asArray(record.allowedPaths).map((allowedPath) =>
      typeof allowedPath === 'string'
        ? stableIdentity('PATH', allowedPath)
        : requiredId(allowedPath, 'path')
    );

    for (const sourceId of sourceIds) addNode('source', { id: sourceId });
    for (const goalId of goalIds) addNode('goal', { id: goalId });
    for (const acceptanceId of acceptanceIds) {
      addNode('acceptance', { id: acceptanceId });
    }
    for (const evidenceId of evidenceIds) {
      addNode('evidence', { id: evidenceId });
    }
    for (const stopId of stopConditionIds) {
      addNode('stopCondition', { id: stopId });
    }
    for (const symbol of asArray(record.productionSymbols)) {
      addNode(
        'symbol',
        typeof symbol === 'string'
          ? { id: stableIdentity('SYMBOL', symbol), literal: symbol }
          : symbol
      );
    }
    for (const allowedPath of asArray(record.allowedPaths)) {
      addNode(
        'path',
        typeof allowedPath === 'string'
          ? { id: stableIdentity('PATH', allowedPath), literal: allowedPath }
          : allowedPath
      );
    }

    for (const sourceId of sourceIds) {
      addEdge('source_to_trace', sourceId, record.id);
      for (const goalId of goalIds) addEdge('source_to_goal', sourceId, goalId);
      for (const acceptanceId of acceptanceIds) {
        addEdge('source_to_acceptance', sourceId, acceptanceId);
      }
      for (const commandId of traceCommandIds) {
        addEdge('source_to_command', sourceId, commandId);
      }
      for (const evidenceId of evidenceIds) {
        addEdge('source_to_evidence', sourceId, evidenceId);
      }
      for (const stopId of stopConditionIds) {
        addEdge('source_to_stop', sourceId, stopId);
      }
    }
    for (const goalId of goalIds) addEdge('trace_to_goal', record.id, goalId);
    for (const acceptanceId of acceptanceIds) {
      addEdge('trace_to_acceptance', record.id, acceptanceId);
    }
    for (const commandId of traceCommandIds) {
      addEdge('trace_to_command', record.id, commandId);
    }
    for (const evidenceId of evidenceIds) {
      addEdge('trace_to_evidence', record.id, evidenceId);
    }
    for (const symbolId of traceSymbolIds) {
      addEdge('trace_to_symbol', record.id, symbolId);
    }
    for (const pathId of tracePathIds) {
      addEdge('trace_to_path', record.id, pathId);
    }
    for (const stopId of stopConditionIds) {
      addEdge('trace_to_stop', record.id, stopId);
    }
  }

  for (const acceptance of input.acceptanceItems || []) {
    const record = asRecord(acceptance);
    addNode('acceptance', record);
    for (const sourceId of asArray(record.sourceIds)) {
      addNode('source', { id: sourceId });
      addEdge('source_to_acceptance', sourceId, record.id);
    }
    for (const goalId of asArray(record.goalIds)) {
      addNode('goal', { id: goalId });
      addEdge('acceptance_to_goal', record.id, goalId);
    }
    for (const traceId of asArray(record.traceIds)) {
      addNode('trace', { id: traceId });
      addEdge('acceptance_to_trace', record.id, traceId);
    }
    for (const commandId of asArray(record.requiredCommands)) {
      addEdge('acceptance_to_command', record.id, commandId);
    }
    for (const evidenceId of asArray(record.expectedEvidenceIds)) {
      addNode('evidence', { id: evidenceId });
      addEdge('acceptance_to_evidence', record.id, evidenceId);
    }
  }

  for (const [index, scenario] of (input.manualScenarios || []).entries()) {
    const record = asRecord(scenario, `MV-${String(index + 1).padStart(3, '0')}`);
    for (const commandId of asArray(record.commandIds)) {
      addEdge('manual_to_command', record.id, commandId);
    }
    for (const evidenceId of asArray(record.evidenceIds)) {
      addEdge('manual_to_evidence', record.id, evidenceId);
    }
    for (const entryPoint of asArray(record.productionEntryPoints)) {
      const symbolId =
        typeof entryPoint === 'string'
          ? stableIdentity('SYMBOL', entryPoint)
          : requiredId(entryPoint, 'symbol');
      addNode(
        'symbol',
        typeof entryPoint === 'string' ? { id: symbolId, literal: entryPoint } : entryPoint
      );
      addEdge('manual_to_symbol', record.id, symbolId);
    }
  }

  const nodes = [...nodeMap.values()]
    .map((node) => {
      const normalized = { ...node };
      for (const [key, value] of Object.entries(normalized)) {
        if (Array.isArray(value)) normalized[key] = uniqueSorted(value);
      }
      return normalized;
    })
    .sort((left, right) =>
      compareIds(`${left.nodeType}:${left.id}`, `${right.nodeType}:${right.id}`)
    );
  const edges = [...edgeMap.values()]
    .sort((left, right) =>
      compareIds(
        `${left.edgeType}:${left.from}:${left.to}`,
        `${right.edgeType}:${right.from}:${right.to}`
      )
    )
    .map((edge, index) => ({
      id: `EDGE-${String(index + 1).padStart(4, '0')}`,
      ...edge,
    }));
  const sequenceApplicabilityFacts =
    input.sequenceApplicabilityFacts === undefined
      ? undefined
      : structuredClone(input.sequenceApplicabilityFacts);
  const graph = {
    schemaVersion: 'goal-contract-evidence-graph/v2',
    sourceSnapshotHash: input.sourceSnapshotHash,
    sourceObligationGraphHash: input.sourceObligationGraphHash || null,
    methodologyProfileHash: input.methodologyProfileHash || null,
    semanticModelHash: input.semanticModelHash || null,
    reconciledGraphHash:
      reconciliation.graphInputHash || sha256(Buffer.from(stableStringify(input), 'utf8')),
    graphInputHash:
      reconciliation.graphInputHash || sha256(Buffer.from(stableStringify(input), 'utf8')),
    traceGraphHash: hashNormalizedTraceSubgraph({ nodes, edges }),
    runtimeEvidencePolicy: 'runtime_only',
    ...(sequenceApplicabilityFacts
      ? { sequenceApplicabilityFacts }
      : {}),
    projectionRegistry: PROJECTION_REGISTRY.map((projection) => ({
      ...projection,
    })),
    ranges: buildRanges(nodes),
    nodes,
    edges,
  };
  return Object.freeze({
    ...graph,
    graphHash: sha256(Buffer.from(stableStringify(graph), 'utf8')),
  });
}

module.exports = {
  PROJECTION_REGISTRY,
  buildEvidenceGraph,
  hashNormalizedTraceSubgraph,
  stableStringify,
};
