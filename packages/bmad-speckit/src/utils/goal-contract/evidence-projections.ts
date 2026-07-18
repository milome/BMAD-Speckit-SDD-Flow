const {
  PROJECTION_REGISTRY,
} = require(
  __filename.endsWith('.ts') ? './evidence-graph.ts' : './evidence-graph'
);

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function nodesOf(graph, nodeType) {
  return graph.nodes
    .filter((node) => node.nodeType === nodeType)
    .sort((left, right) => compareIds(left.id, right.id));
}

function nodeMap(graph, nodeType) {
  return new Map(nodesOf(graph, nodeType).map((node) => [node.id, node]));
}

function outgoing(graph, from, edgeType) {
  return graph.edges
    .filter(
      (edge) =>
        edge.from === from && (!edgeType || edge.edgeType === edgeType)
    )
    .map((edge) => edge.to)
    .sort(compareIds);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort(
    compareIds
  );
}

function join(values) {
  const items = unique(values);
  return items.length > 0 ? items.join(', ') : 'none';
}

function projectionDefinition(projectionId) {
  const definition = PROJECTION_REGISTRY.find(
    (projection) => projection.id === projectionId
  );
  if (!definition) {
    const error = new Error('goal_contract_projection_unknown');
    error.failureClass = 'goal_contract_projection_unknown';
    error.projectionId = projectionId;
    throw error;
  }
  return definition;
}

function commandLiterals(commands, commandIds) {
  return unique(
    commandIds.map((commandId) => commands.get(commandId)?.literal)
  );
}

function pathLiterals(paths, pathIds) {
  return unique(pathIds.map((pathId) => paths.get(pathId)?.literal));
}

function symbolLiterals(symbols, symbolIds) {
  return unique(symbolIds.map((symbolId) => symbols.get(symbolId)?.literal));
}

function baseProjection({
  graph,
  projectionId,
  rows,
  markdown,
  commands = [],
  paths = [],
  symbols = [],
}) {
  const definition = projectionDefinition(projectionId);
  return Object.freeze({
    projectionId,
    sectionTitle: definition.sectionTitle,
    semanticRole: definition.semanticRole,
    runtimeEvidenceAuthority: false,
    evidenceClassification: 'projection_only',
    declaredRanges: structuredClone(graph.ranges),
    rows,
    markdown,
    sharedLiterals: {
      commands: unique(commands),
      paths: unique(paths),
      symbols: unique(symbols),
    },
  });
}

function commandCell(commands, commandIds) {
  return unique(commandIds)
    .map((commandId) => {
      const command = commands.get(commandId);
      return command ? `${command.id}: ${command.literal}` : commandId;
    })
    .join('<br>');
}

function projectTraceSlices(graph) {
  const commands = nodeMap(graph, 'command');
  const paths = nodeMap(graph, 'path');
  const symbols = nodeMap(graph, 'symbol');
  const rows = nodesOf(graph, 'trace').map((trace) => {
    const directCommands = unique(trace.directCommands);
    const impactedCommands = unique(trace.impactedCommands);
    const symbolIds = outgoing(graph, trace.id, 'trace_to_symbol');
    const pathIds = outgoing(graph, trace.id, 'trace_to_path');
    return {
      traceId: trace.id,
      goalIds: outgoing(graph, trace.id, 'trace_to_goal'),
      sourceIds: graph.edges
        .filter(
          (edge) =>
            edge.edgeType === 'source_to_trace' && edge.to === trace.id
        )
        .map((edge) => edge.from)
        .sort(compareIds),
      acceptanceIds: outgoing(graph, trace.id, 'trace_to_acceptance'),
      productionSymbolIds: symbolIds,
      allowedPathIds: pathIds,
      directCommands,
      impactedCommands,
      dependencies: unique(trace.dependencies),
      commitPolicy: trace.commitPolicy,
      closeCondition: trace.closeCondition,
    };
  });
  const markdown = [
    '| Trace ID | Goal IDs | Source IDs | Acceptance IDs | Production Symbols | Allowed Paths | Direct Commands | Impacted Commands | Dependencies | Commit Policy | Close Condition |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) =>
      [
        row.traceId,
        join(row.goalIds),
        join(row.sourceIds),
        join(row.acceptanceIds),
        join(symbolLiterals(symbols, row.productionSymbolIds)),
        join(pathLiterals(paths, row.allowedPathIds)),
        commandCell(commands, row.directCommands) || 'none',
        commandCell(commands, row.impactedCommands) || 'none',
        join(row.dependencies),
        row.commitPolicy || 'none',
        row.closeCondition || 'none',
      ].join(' | ').replace(/^/u, '| ').replace(/$/u, ' |')
    ),
  ].join('\n');
  return baseProjection({
    graph,
    projectionId: 'projection.trace_slices',
    rows,
    markdown,
    commands: commandLiterals(
      commands,
      rows.flatMap((row) => [
        ...row.directCommands,
        ...row.impactedCommands,
      ])
    ),
    paths: rows.flatMap((row) =>
      pathLiterals(paths, row.allowedPathIds)
    ),
    symbols: rows.flatMap((row) =>
      symbolLiterals(symbols, row.productionSymbolIds)
    ),
  });
}

function projectStrictAcceptance(graph) {
  const commands = nodeMap(graph, 'command');
  const rows = nodesOf(graph, 'acceptance').map((acceptance) => {
    const commandIds = outgoing(
      graph,
      acceptance.id,
      'acceptance_to_command'
    );
    return {
      acceptanceId: acceptance.id,
      statement: acceptance.statement || acceptance.passCondition || '',
      goalIds: outgoing(graph, acceptance.id, 'acceptance_to_goal'),
      traceIds: outgoing(graph, acceptance.id, 'acceptance_to_trace'),
      commandIds,
      evidenceIds: outgoing(
        graph,
        acceptance.id,
        'acceptance_to_evidence'
      ),
      passCondition: acceptance.passCondition || acceptance.statement || '',
    };
  });
  const markdown = rows
    .map(
      (row) =>
        `- [ ] ${row.acceptanceId}: ${row.statement} Commands: ${commandCell(
          commands,
          row.commandIds
        )}. Expected evidence: ${join(row.evidenceIds)}. Pass condition: ${
          row.passCondition
        }`
    )
    .join('\n');
  return baseProjection({
    graph,
    projectionId: 'projection.strict_acceptance',
    rows,
    markdown,
    commands: commandLiterals(
      commands,
      rows.flatMap((row) => row.commandIds)
    ),
  });
}

function projectAcceptanceTraceability(graph) {
  const commands = nodeMap(graph, 'command');
  const rows = nodesOf(graph, 'acceptance').map((acceptance) => ({
    acceptanceId: acceptance.id,
    goalIds: outgoing(graph, acceptance.id, 'acceptance_to_goal'),
    traceIds: outgoing(graph, acceptance.id, 'acceptance_to_trace'),
    commandIds: outgoing(
      graph,
      acceptance.id,
      'acceptance_to_command'
    ),
    evidenceIds: outgoing(
      graph,
      acceptance.id,
      'acceptance_to_evidence'
    ),
    passCondition: acceptance.passCondition || acceptance.statement || '',
  }));
  const markdown = [
    '| Acceptance ID | Goal IDs | Trace IDs | Commands | Expected Evidence | Pass Condition |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${row.acceptanceId} | ${join(row.goalIds)} | ${join(
          row.traceIds
        )} | ${commandCell(commands, row.commandIds)} | ${join(
          row.evidenceIds
        )} | ${row.passCondition} |`
    ),
  ].join('\n');
  return baseProjection({
    graph,
    projectionId: 'projection.acceptance_traceability',
    rows,
    markdown,
    commands: commandLiterals(
      commands,
      rows.flatMap((row) => row.commandIds)
    ),
  });
}

function projectSourceCoverage(graph) {
  const commands = nodeMap(graph, 'command');
  const paths = nodeMap(graph, 'path');
  const rows = nodesOf(graph, 'source').map((source) => {
    const traceIds = outgoing(graph, source.id, 'source_to_trace');
    const pathIds = unique(
      traceIds.flatMap((traceId) =>
        outgoing(graph, traceId, 'trace_to_path')
      )
    );
    return {
      sourceId: source.id,
      summary: source.summary || source.text || '',
      goalIds: outgoing(graph, source.id, 'source_to_goal'),
      traceIds,
      acceptanceIds: outgoing(
        graph,
        source.id,
        'source_to_acceptance'
      ),
      commandIds: outgoing(graph, source.id, 'source_to_command'),
      evidenceIds: outgoing(graph, source.id, 'source_to_evidence'),
      pathIds,
    };
  });
  const markdown = [
    '| Source ID | Source Summary | Goal IDs | Trace IDs | Acceptance IDs | Commands | Evidence | Allowed Paths |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${row.sourceId} | ${row.summary} | ${join(row.goalIds)} | ${join(
          row.traceIds
        )} | ${join(row.acceptanceIds)} | ${commandCell(
          commands,
          row.commandIds
        )} | ${join(row.evidenceIds)} | ${join(
          pathLiterals(paths, row.pathIds)
        )} |`
    ),
  ].join('\n');
  return baseProjection({
    graph,
    projectionId: 'projection.source_coverage',
    rows,
    markdown,
    commands: commandLiterals(
      commands,
      rows.flatMap((row) => row.commandIds)
    ),
    paths: rows.flatMap((row) => pathLiterals(paths, row.pathIds)),
  });
}

function projectManualScenarios(graph) {
  const commands = nodeMap(graph, 'command');
  const symbols = nodeMap(graph, 'symbol');
  const rows = nodesOf(graph, 'manualScenario').map((scenario) => ({
    scenarioId: scenario.id,
    title: scenario.title || scenario.summary || scenario.id,
    steps: unique(scenario.steps),
    commandIds: outgoing(graph, scenario.id, 'manual_to_command'),
    evidenceIds: outgoing(graph, scenario.id, 'manual_to_evidence'),
    productionSymbolIds: outgoing(
      graph,
      scenario.id,
      'manual_to_symbol'
    ),
    expectedResult: scenario.expectedResult || '',
  }));
  const markdown = rows
    .map((row) =>
      [
        `### ${row.scenarioId} ${row.title}`,
        '',
        ...row.steps.map((step) => `- ${step}`),
        `- Production entry: ${join(
          symbolLiterals(symbols, row.productionSymbolIds)
        )}.`,
        `- Command: ${commandCell(commands, row.commandIds)}.`,
        `- Expected evidence: ${join(row.evidenceIds)}.`,
        `- Expected result: ${row.expectedResult}`,
      ].join('\n')
    )
    .join('\n\n');
  return baseProjection({
    graph,
    projectionId: 'projection.manual_scenarios',
    rows,
    markdown,
    commands: commandLiterals(
      commands,
      rows.flatMap((row) => row.commandIds)
    ),
    symbols: rows.flatMap((row) =>
      symbolLiterals(symbols, row.productionSymbolIds)
    ),
  });
}

function projectCompletionEvidence(graph) {
  const commands = nodeMap(graph, 'command');
  const rows = nodesOf(graph, 'evidence').map((evidence) => {
    const producerIds = outgoing(
      graph,
      evidence.id,
      'evidence_to_command'
    );
    return {
      evidenceId: evidence.id,
      producerIds,
      admissibleTypes: unique(evidence.admissibleTypes),
      provenanceFields: unique(evidence.requiredProvenanceFields),
      freshnessRule: evidence.freshnessRule,
      expectedResult: evidence.expectedResult,
      observedEvidence: 'pending runtime activity',
    };
  });
  const markdown = [
    '| Evidence ID | Producer | Admissible Types | Required Provenance | Freshness | Expected Result | Observed Evidence |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${row.evidenceId} | ${commandCell(
          commands,
          row.producerIds
        )} | ${join(row.admissibleTypes)} | ${join(
          row.provenanceFields
        )} | ${row.freshnessRule || 'none'} | ${
          row.expectedResult || 'none'
        } | ${row.observedEvidence} |`
    ),
  ].join('\n');
  return baseProjection({
    graph,
    projectionId: 'projection.completion_evidence',
    rows,
    markdown,
    commands: commandLiterals(
      commands,
      rows.flatMap((row) => row.producerIds)
    ),
  });
}

function projectStopConditions(graph) {
  const rows = nodesOf(graph, 'stopCondition').map((condition) => ({
    stopId: condition.id,
    condition: condition.condition || condition.summary || '',
    failureClass: condition.failureClass || 'contract_stop',
    sourceIds: graph.edges
      .filter(
        (edge) =>
          edge.edgeType === 'source_to_stop' && edge.to === condition.id
      )
      .map((edge) => edge.from)
      .sort(compareIds),
    traceIds: graph.edges
      .filter(
        (edge) =>
          edge.edgeType === 'trace_to_stop' && edge.to === condition.id
      )
      .map((edge) => edge.from)
      .sort(compareIds),
  }));
  const markdown = rows
    .map(
      (row) =>
        `- ${row.stopId}: If ${row.condition}, stop with \`${row.failureClass}\`. Sources: ${join(
          row.sourceIds
        )}. Traces: ${join(row.traceIds)}.`
    )
    .join('\n');
  return baseProjection({
    graph,
    projectionId: 'projection.stop_conditions',
    rows,
    markdown,
  });
}

function projectEvidenceDimensions(graph) {
  return [
    projectTraceSlices(graph),
    projectStrictAcceptance(graph),
    projectAcceptanceTraceability(graph),
    projectSourceCoverage(graph),
    projectManualScenarios(graph),
    projectCompletionEvidence(graph),
    projectStopConditions(graph),
  ];
}

module.exports = {
  projectAcceptanceTraceability,
  projectCompletionEvidence,
  projectEvidenceDimensions,
  projectManualScenarios,
  projectSourceCoverage,
  projectStopConditions,
  projectStrictAcceptance,
  projectTraceSlices,
};
