function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringList(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function unique(items) {
  return [...new Set(items.filter(Boolean).map(String))];
}

function rowId(row, fallback = '') {
  return String(row?.id ?? row?.artifactId ?? row?.commandId ?? row?.path ?? fallback).trim();
}

function refsFor(row, keys) {
  return unique(keys.flatMap((key) => stringList(row?.[key])));
}

function collectText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(collectText).join(' ');
  if (typeof value === 'object') return Object.values(value).map(collectText).join(' ');
  return '';
}

function hasObjectEntryFor(value, mustId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value[mustId];
  if (entry === undefined || entry === null) return false;
  if (Array.isArray(entry)) return entry.length > 0;
  if (typeof entry === 'object') return Object.keys(entry).length > 0;
  return String(entry).trim().length > 0;
}

function hasArrayEntryFor(value, mustId) {
  return asArray(value).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const refs = refsFor(entry, ['id', 'mustRef', 'mustRefs', 'requirementRef', 'requirementRefs', 'requirementId', 'requirementIds']);
    if (!refs.includes(mustId)) return false;
    return collectText({
      assertion: entry.assertion,
      assertions: entry.assertions,
      oracle: entry.oracle,
      expectedBehavior: entry.expectedBehavior,
      responsibility: entry.responsibility,
      responsibilities: entry.responsibilities,
      targetRole: entry.targetRole,
      traceRows: entry.traceRows,
    }).trim().length > 0;
  });
}

function hasPerMustDetail(row, mustId) {
  const objectFields = [
    'perMustAssertions',
    'perRequirementAssertions',
    'assertionsByMust',
    'assertionsByRequirement',
    'perMustOracles',
    'perRequirementOracles',
    'oraclesByMust',
    'oraclesByRequirement',
    'perMustResponsibilities',
    'perRequirementResponsibilities',
    'responsibilitiesByMust',
    'responsibilitiesByRequirement',
    'perMustAcceptance',
    'perRequirementAcceptance',
  ];
  if (objectFields.some((field) => hasObjectEntryFor(row?.[field], mustId))) return true;

  const arrayFields = [
    'mustAssertions',
    'requirementAssertions',
    'mustOracles',
    'requirementOracles',
    'mustResponsibilities',
    'requirementResponsibilities',
    'targetResponsibilities',
    'perMustRows',
    'perRequirementRows',
  ];
  return arrayFields.some((field) => hasArrayEntryFor(row?.[field], mustId));
}

function hasPerMustDetailForAll(row, mustIds) {
  return mustIds.length > 0 && mustIds.every((mustId) => hasPerMustDetail(row, mustId));
}

function idsFor(rows) {
  return unique(asArray(rows).map((row) => rowId(row)));
}

function buildTraceMustMap(confirmation) {
  const map = new Map();
  for (const trace of asArray(confirmation.traceRows)) {
    const traceId = rowId(trace);
    const mustRefs = refsFor(trace, ['covers']).filter((ref) => ref.startsWith('MUST-'));
    if (traceId) map.set(traceId, new Set(mustRefs));
  }
  return map;
}

function mustRefsFromTraceRefs(traceRefs, traceMustMap) {
  const refs = new Set();
  for (const traceRef of traceRefs) {
    for (const mustRef of traceMustMap.get(traceRef) ?? []) refs.add(mustRef);
  }
  return refs;
}

function mustRefsForCoverageRow(row, traceMustMap) {
  const direct = refsFor(row, ['covers', 'requirementRefs', 'mustRefs']).filter((ref) =>
    ref.startsWith('MUST-')
  );
  const traceRefs = refsFor(row, ['traceRows', 'traceRefs', 'coveredByTraceRows']);
  return new Set([...direct, ...mustRefsFromTraceRefs(traceRefs, traceMustMap)]);
}

function businessMustIds(confirmation, mustIds) {
  const boundary = confirmation.requirementBoundary?.business;
  const explicit = refsFor(boundary ?? {}, ['requirementIds', 'mustRefs']).filter((ref) =>
    mustIds.includes(ref)
  );
  if (explicit.length > 0) return explicit;
  const governanceTerms = /\b(?:governance|confirmation|contract|audit|checkpoint|packet|renderer|authoring|source document|critical auditor)\b/iu;
  return asArray(confirmation.must)
    .filter((row) => !governanceTerms.test(collectText(row)))
    .map((row) => rowId(row))
    .filter((id) => mustIds.includes(id));
}

function currentTargetRows(confirmation) {
  const map = confirmation.currentTargetMap ?? {};
  return [
    ...asArray(map.currentSummary),
    ...asArray(map.targetSummary),
    ...asArray(map.diffRows),
    ...asArray(map.process),
    ...asArray(map.artifactPaths),
    ...asArray(map.canonicalArtifacts),
    ...asArray(map.existingArtifacts),
    ...asArray(map.targetRealization),
  ];
}

function isGenericProjectionText(text) {
  return /\b(?:source-derived|generic|all must|all requirements|requirement scenario|source derived)\b/iu.test(
    text
  );
}

function collectProjectionQualityIssues(confirmation, options = {}) {
  const prefix = options.codePrefix ?? '';
  const makeIssue =
    options.makeIssue ??
    ((code, message, refs = []) => ({
      code,
      message,
      refs: stringList(refs),
      severity: 'blocker',
      source: options.source ?? 'projection_quality_gate',
    }));
  const issue = (code, message, refs = []) => makeIssue(`${prefix}${code}`, message, refs);
  const issues = [];
  const mustIds = idsFor(confirmation.must).filter((id) => id.startsWith('MUST-'));
  if (mustIds.length <= 1) return issues;

  const traceMustMap = buildTraceMustMap(confirmation);
  const acceptanceRows = [
    ...asArray(confirmation.acceptanceTests),
    ...asArray(confirmation.e2eSuites),
  ];

  for (const mustId of mustIds) {
    const hasIndependentAcceptance = acceptanceRows.some((row) => {
      const rowMustRefs = mustRefsForCoverageRow(row, traceMustMap);
      if (!rowMustRefs.has(mustId)) return false;
      return rowMustRefs.size === 1 || hasPerMustDetail(row, mustId);
    });
    if (!hasIndependentAcceptance) {
      issues.push(
        issue(
          'projection_per_must_acceptance_not_independent',
          `${mustId} lacks an independent ACC/E2E row or explicit per-MUST assertion mapping`,
          [mustId]
        )
      );
    }
  }

  const evidenceToMust = new Map();
  const addEvidenceMust = (evidenceId, mustId) => {
    if (!evidenceId || !mustId) return;
    if (!evidenceToMust.has(evidenceId)) evidenceToMust.set(evidenceId, new Set());
    evidenceToMust.get(evidenceId).add(mustId);
  };
  for (const must of asArray(confirmation.must)) {
    const mustId = rowId(must);
    for (const evidenceId of refsFor(must, ['evidenceRefs', 'linkedEvidenceIds'])) {
      addEvidenceMust(evidenceId, mustId);
    }
  }
  for (const trace of asArray(confirmation.traceRows)) {
    const traceMustRefs = refsFor(trace, ['covers']).filter((ref) => ref.startsWith('MUST-'));
    for (const evidenceId of refsFor(trace, ['evidenceRefs', 'linkedEvidenceIds'])) {
      for (const mustId of traceMustRefs) addEvidenceMust(evidenceId, mustId);
    }
  }
  for (const evidence of asArray(confirmation.evidence)) {
    const evidenceId = rowId(evidence, 'EVD-UNKNOWN');
    const coveredMustIds = [...(evidenceToMust.get(evidenceId) ?? [])].sort();
    if (coveredMustIds.length > 1 && !hasPerMustDetailForAll(evidence, coveredMustIds)) {
      issues.push(
        issue(
          'projection_shared_evidence_without_per_must_oracle',
          `${evidenceId} is shared by multiple MUST rows without per-MUST oracle/assertion mapping`,
          [evidenceId, ...coveredMustIds]
        )
      );
    }
  }

  const commandToMust = new Map();
  const addCommandMust = (commandId, mustId) => {
    if (!commandId || !mustId) return;
    if (!commandToMust.has(commandId)) commandToMust.set(commandId, new Set());
    commandToMust.get(commandId).add(mustId);
  };
  for (const trace of asArray(confirmation.traceRows)) {
    const traceMustRefs = refsFor(trace, ['covers']).filter((ref) => ref.startsWith('MUST-'));
    for (const commandId of refsFor(trace, ['contractValidationCommandRefs', 'deliveryEvidenceCommandRefs', 'commandRefs'])) {
      for (const mustId of traceMustRefs) addCommandMust(commandId, mustId);
    }
  }
  for (const evidence of asArray(confirmation.evidence)) {
    const evidenceMustIds = [...(evidenceToMust.get(rowId(evidence)) ?? [])];
    for (const commandId of refsFor(evidence, ['requiredCommandRefs', 'commandRefs'])) {
      for (const mustId of evidenceMustIds) addCommandMust(commandId, mustId);
    }
  }
  for (const row of acceptanceRows) {
    const rowMustRefs = [...mustRefsForCoverageRow(row, traceMustMap)];
    for (const commandId of refsFor(row, ['commandRefs', 'requiredCommandRefs'])) {
      for (const mustId of rowMustRefs) addCommandMust(commandId, mustId);
    }
  }
  const commandRows = [...asArray(confirmation.requiredCommands), ...asArray(confirmation.suggestedCommands)];
  for (const command of commandRows) {
    const commandId = rowId(command, 'CMD-UNKNOWN');
    const coveredMustIds = [...(commandToMust.get(commandId) ?? [])].sort();
    if (
      coveredMustIds.length === mustIds.length &&
      coveredMustIds.length > 1 &&
      !hasPerMustDetailForAll(command, coveredMustIds)
    ) {
      issues.push(
        issue(
          'required_command_all_cover_all_without_per_must_assertions',
          `${commandId} covers all MUST rows without per-MUST command assertions`,
          [commandId, ...coveredMustIds]
        )
      );
    }
  }

  for (const row of asArray(confirmation.targetModificationPaths)) {
    const targetId = rowId(row, 'TARGET-MOD-UNKNOWN');
    const rowMustRefs = mustRefsForCoverageRow(row, traceMustMap);
    if (
      rowMustRefs.size === mustIds.length &&
      rowMustRefs.size > 1 &&
      !hasPerMustDetailForAll(row, [...rowMustRefs])
    ) {
      issues.push(
        issue(
          'target_modification_path_all_cover_all',
          `${targetId} binds one target path to every MUST without per-MUST responsibilities`,
          [targetId, ...[...rowMustRefs].sort()]
        )
      );
    }
  }

  const businessMust = businessMustIds(confirmation, mustIds);
  if (businessMust.length > 0 && confirmation.currentTargetMap) {
    const rows = currentTargetRows(confirmation);
    const hasBusinessRefs = rows.some((row) =>
      refsFor(row, ['covers', 'requirementRefs', 'mustRefs', 'traceRefs', 'traceRows']).some((ref) =>
        businessMust.includes(ref)
      )
    );
    const text = collectText(rows);
    if (!hasBusinessRefs && isGenericProjectionText(text)) {
      issues.push(
        issue(
          'current_target_map_not_product_specific',
          'currentTargetMap uses generic/source-derived rows instead of product-specific current and target states for business MUST rows',
          ['currentTargetMap', ...businessMust]
        )
      );
    }
  }

  if (businessMust.length > 0) {
    const visuals = [
      ...asArray(confirmation.businessVisuals),
      ...asArray(confirmation.sequenceViews).filter((row) => String(row?.scope ?? '').toLowerCase() === 'business'),
      ...asArray(confirmation.flowViews).filter((row) => String(row?.scope ?? '').toLowerCase() === 'business'),
    ];
    const hasSpecificBusinessVisual = visuals.some((row) => {
      const text = collectText(row);
      const visualMustRefs = refsFor(row, ['covers', 'requirementRefs', 'mustRefs']).filter((ref) =>
        businessMust.includes(ref)
      );
      if (visualMustRefs.length === 0) return false;
      if (isGenericProjectionText(text)) return false;
      if (visualMustRefs.length < businessMust.length) return true;
      if (businessMust.every((mustId) => text.includes(mustId))) return true;
      return hasPerMustDetailForAll(row, businessMust);
    });
    if (!hasSpecificBusinessVisual) {
      issues.push(
        issue(
          'business_visual_generic_or_compressed',
          'business visuals are missing, generic, or compressed across business MUST rows without per-MUST flow boundaries',
          ['businessVisuals', ...businessMust]
        )
      );
    }
  }

  return issues;
}

module.exports = {
  collectProjectionQualityIssues,
};
