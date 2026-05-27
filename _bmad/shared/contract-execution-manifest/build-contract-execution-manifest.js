const {
  CANONICAL_BUILDER_VERSION,
  CANONICAL_SCHEMA_VERSION,
  normalizeContractExecutionManifest,
} = require('./normalize-contract-execution-manifest');
const {
  hashCanonicalManifest,
  hashSourceProjection,
  stableStringify,
} = require('./hash-contract-execution-manifest');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function objects(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function nested(value) {
  return isObject(value) ? value : {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePath(value) {
  return text(value).replace(/\\/gu, '/');
}

function commandId(row) {
  return text(row.id) || text(row.commandId);
}

function commandRefs(row) {
  return unique([
    ...strings(row.commandRefs),
    ...strings(row.requiredCommandRefs),
    ...strings(row.requiredCommandIds),
    ...strings(row.contractValidationCommandRefs),
    ...strings(row.deliveryEvidenceCommandRefs),
  ]);
}

function idRefs(row, keys) {
  return unique(keys.flatMap((key) => strings(row[key])));
}

function extractCommandFileRefs(command) {
  const refs = new Set();
  const tokens = text(command).replace(/\r?\n/gu, ' ').match(/"[^"]+"|'[^']+'|\S+/gu) ?? [];
  for (const token of tokens) {
    const ref = token.replace(/^['"]|['"]$/gu, '');
    if (
      /(?:^|[\\/])[^\\/]+\.(?:tsx|ts|jsx|json|mjs|cjs|js|ya?ml|md)$/iu.test(ref) &&
      (/[\\/]/u.test(ref) || /\.(?:test|spec)\./iu.test(ref))
    ) {
      refs.add(normalizePath(ref));
    }
  }
  return [...refs];
}

function requirementRows(confirmation) {
  const traceRefsByRequirement = new Map();
  for (const trace of objects(confirmation.traceRows)) {
    const traceId = text(trace.id);
    if (!traceId) continue;
    for (const coveredId of strings(trace.covers)) {
      traceRefsByRequirement.set(
        coveredId,
        unique([...(traceRefsByRequirement.get(coveredId) ?? []), traceId])
      );
    }
  }
  const traceRefsFor = (row) =>
    unique([
      ...idRefs(row, ['coveredByTraceRows', 'traceRows', 'traceRefs']),
      ...(traceRefsByRequirement.get(text(row.id)) ?? []),
    ]);
  return [
    ...objects(confirmation.must).map((row) => ({
      id: text(row.id),
      kind: 'MUST',
      text: text(row.text),
      evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
      traceRefs: traceRefsFor(row),
    })),
    ...objects(confirmation.notDone).map((row) => ({
      id: text(row.id),
      kind: 'NEG',
      text: text(row.text),
      evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
      traceRefs: traceRefsFor(row),
    })),
    ...objects(confirmation.mustNot).map((row) => ({
      id: text(row.id),
      kind: 'OUT',
      text: text(row.text),
      evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
      traceRefs: idRefs(row, ['boundaryRefs', 'boundaryViewRefs', 'traceRows', 'traceRefs']),
    })),
  ].filter((row) => row.id);
}

function acceptanceRows(confirmation) {
  return [
    ...objects(confirmation.acceptanceTests).map((row) => ({
      id: text(row.id),
      kind: 'acceptance',
      files: [text(row.file), ...strings(row.files)].filter(Boolean).map(normalizePath),
      commandRefs: commandRefs(row),
      covers: strings(row.covers),
      failurePathRefs: idRefs(row, ['failurePathRefs', 'failurePaths']),
      edgeCaseRefs: idRefs(row, ['edgeCaseRefs', 'edgeCases']),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
      expectedPreImplementationState: text(row.expectedPreImplementationState),
      oracle: text(row.oracle),
      mockOnly: row.mockOnly === true || text(row.proofType).toLowerCase() === 'mock-only',
    })),
    ...objects(confirmation.e2eSuites).map((row) => ({
      id: text(row.id),
      kind: 'e2e',
      files: [text(row.file), ...strings(row.files)].filter(Boolean).map(normalizePath),
      commandRefs: commandRefs(row),
      covers: strings(row.covers),
      failurePathRefs: idRefs(row, ['failurePathRefs', 'failurePaths']),
      edgeCaseRefs: idRefs(row, ['edgeCaseRefs', 'edgeCases']),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
      expectedPreImplementationState: text(row.expectedPreImplementationState),
      oracle: text(row.oracle),
      mockOnly: row.mockOnly === true || text(row.proofType).toLowerCase() === 'mock-only',
    })),
  ].filter((row) => row.id);
}

function targetArtifacts(confirmation) {
  const currentTargetMap = nested(confirmation.currentTargetMap);
  return [
    ...objects(confirmation.artifactAutomationPlan).map((row, index) => ({
      id: text(row.id) || text(row.artifactId) || `artifactAutomationPlan:${index + 1}`,
      kind: text(row.artifactType) || 'artifact',
      sourceSection: 'artifactAutomationPlan',
      pathOrField: normalizePath(text(row.path) || text(row.targetPathOrField)),
      expectedProducer: text(row.producer),
      expectedSourceOfTruthRole: text(row.sourceOfTruthRole),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
      requirementRefs: idRefs(row, ['relatedRequirementIds', 'linkedRequirementIds']),
    })),
    ...objects(currentTargetMap.canonicalArtifacts).map((row, index) => ({
      id: text(row.id) || text(row.targetPathOrField) || `canonicalArtifacts:${index + 1}`,
      kind: 'canonical_surface',
      sourceSection: 'currentTargetMap.canonicalArtifacts',
      pathOrField: normalizePath(text(row.targetPathOrField) || text(row.pathOrField)),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
      requirementRefs: idRefs(row, ['linkedRequirementIds', 'requirementRefs']),
    })),
    ...objects(currentTargetMap.existingArtifacts)
      .filter((row) => text(row.completionProofPolicy))
      .map((row, index) => ({
        id: text(row.id) || text(row.currentPath) || `existingArtifacts:${index + 1}`,
        kind: ['legacy_only', 'not_completion_proof'].includes(text(row.completionProofPolicy))
          ? 'legacy_policy'
          : 'existing_artifact',
        sourceSection: 'currentTargetMap.existingArtifacts',
        pathOrField: normalizePath(text(row.currentPath)),
        completionProofPolicy: text(row.completionProofPolicy),
        traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
        evidenceRefs: idRefs(row, ['evidenceRefs']),
        requirementRefs: idRefs(row, ['linkedRequirementIds', 'requirementRefs']),
      })),
  ].filter((row) => row.pathOrField || row.id);
}

function targetModificationPaths(confirmation) {
  return [
    ...strings(confirmation.targetModificationPaths).map((value, index) => ({
      id: `TARGET-MOD-${index + 1}`,
      path: normalizePath(value),
      traceRefs: [],
      evidenceRefs: [],
      artifactRefs: [],
      sourceSection: 'targetModificationPaths',
    })),
    ...objects(confirmation.targetModificationPaths).map((row, index) => ({
      id: text(row.id) || `TARGET-MOD-${index + 1}`,
      path: normalizePath(text(row.path) || text(row.targetPath) || text(row.targetPathOrField)),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
      artifactRefs: idRefs(row, ['artifactRefs']),
      sourceSection: 'targetModificationPaths',
    })),
  ];
}

function targetModificationPathCoverage(confirmation, rows) {
  const traceIds = new Set(objects(confirmation.traceRows).map((row) => text(row.id)).filter(Boolean));
  const evidenceIds = new Set(objects(confirmation.evidence).map((row) => text(row.id)).filter(Boolean));
  const covered = rows.map((row, index) => {
    const id = text(row.id) || text(row.path) || `TARGET-MOD-${index + 1}`;
    const traceRefs = strings(row.traceRefs);
    const evidenceRefs = strings(row.evidenceRefs);
    const missing = [
      ...(text(row.path) ? [] : [{ id, code: 'target_modification_path_missing' }]),
      ...(traceRefs.length > 0 ? [] : [{ id, code: 'target_modification_trace_refs_missing' }]),
      ...(evidenceRefs.length > 0 ? [] : [{ id, code: 'target_modification_evidence_refs_missing' }]),
      ...traceRefs.filter((ref) => !traceIds.has(ref)).map((ref) => ({ id, code: 'trace_ref_missing', ref })),
      ...evidenceRefs
        .filter((ref) => !evidenceIds.has(ref))
        .map((ref) => ({ id, code: 'evidence_ref_missing', ref })),
    ];
    return {
      ...row,
      id,
      missing,
      ready: missing.length === 0,
      decision: missing.length === 0 ? 'pass' : 'blocked',
      blockingReasons: unique(missing.map((item) => text(item.code))),
    };
  });
  const missing = [
    ...(covered.length === 0
      ? [{ id: 'targetModificationPaths', code: 'target_modification_paths_missing' }]
      : []),
    ...covered.flatMap((row) => objects(row.missing)),
  ];
  return {
    rows: covered,
    missing,
    ready: missing.length === 0,
    decision: missing.length === 0 ? 'pass' : 'blocked',
    blockingReasons: unique(missing.map((row) => text(row.code))),
  };
}

function negativeControls(confirmation, targetRows) {
  return [
    ...objects(confirmation.notDone).map((row) => ({
      id: text(row.id),
      source: 'notDone',
      oracle: text(row.oracle) || text(row.whyItBlocksCompletion),
      linkedIds: [text(row.id), ...idRefs(row, ['evidenceRefs', 'coveredByTraceRows'])].filter(Boolean),
    })),
    ...objects(confirmation.failurePaths).map((row) => ({
      id: text(row.id),
      source: 'failurePaths',
      oracle: text(row.expectedBehavior) || text(row.forbiddenBehavior),
      linkedIds: idRefs(row, ['linkedNegIds', 'linkedEvidenceIds']),
    })),
    ...objects(confirmation.edgeCases).map((row) => ({
      id: text(row.id),
      source: 'edgeCases',
      oracle: text(row.expectedBehavior) || text(row.forbiddenBehavior),
      linkedIds: idRefs(row, ['linkedFailurePathIds', 'linkedEvidenceIds']),
    })),
    ...targetRows
      .filter((row) => text(row.kind) === 'legacy_policy')
      .map((row) => ({
        id: text(row.id),
        source: 'legacy_policy',
        oracle: `Must not use ${text(row.pathOrField)} as completion proof`,
        linkedIds: unique([...strings(row.traceRefs), ...strings(row.evidenceRefs)]),
      })),
    {
      id: 'NEGCTRL-MOCK-ONLY',
      source: 'builtin',
      oracle: 'mock-only proof is not closeout proof',
      linkedIds: [],
    },
    {
      id: 'NEGCTRL-EXITCODE-ONLY',
      source: 'builtin',
      oracle: 'exitCode-only proof is not closeout proof',
      linkedIds: [],
    },
    {
      id: 'NEGCTRL-SELF-CERTIFICATION',
      source: 'builtin',
      oracle: 'runtime closure packet self-certification is not closeout proof',
      linkedIds: [],
    },
  ].filter((row) => text(row.id));
}

function errorCaseCoverage(confirmation, acceptance) {
  const traceRows = objects(confirmation.traceRows);
  const failureRows = objects(confirmation.failurePaths);
  const edgeRows = objects(confirmation.edgeCases);
  const acceptanceRefsFor = (key, id) => ({
    acceptanceRefs: acceptance.filter((row) => row.kind !== 'e2e' && strings(row[key]).includes(id)).map((row) => row.id),
    e2eRefs: acceptance.filter((row) => row.kind === 'e2e' && strings(row[key]).includes(id)).map((row) => row.id),
  });
  const traceRefsFor = (requirementRefs, evidenceRefs, explicitRefs) =>
    unique([
      ...explicitRefs,
      ...traceRows
        .filter(
          (trace) =>
            strings(trace.covers).some((ref) => requirementRefs.includes(ref)) ||
            strings(trace.evidenceRefs).some((ref) => evidenceRefs.includes(ref))
        )
        .map((trace) => text(trace.id)),
    ]);
  const failureNegRefs = new Map(
    failureRows.map((row) => [text(row.id), idRefs(row, ['linkedNegIds', 'negRefs'])])
  );
  const failurePaths = failureRows
    .map((row) => {
      const id = text(row.id);
      const linkedNegIds = idRefs(row, ['linkedNegIds', 'negRefs']);
      const linkedEvidenceIds = idRefs(row, ['linkedEvidenceIds', 'evidenceRefs']);
      const traceRefs = traceRefsFor(linkedNegIds, linkedEvidenceIds, idRefs(row, ['traceRows', 'traceRefs']));
      const { acceptanceRefs, e2eRefs } = acceptanceRefsFor('failurePathRefs', id);
      const missing = [
        ...(linkedNegIds.length > 0 ? [] : ['failure_path_neg_refs_missing']),
        ...(linkedEvidenceIds.length > 0 ? [] : ['failure_path_evidence_refs_missing']),
        ...(traceRefs.length > 0 ? [] : ['failure_path_trace_coverage_missing']),
        ...(acceptanceRefs.length + e2eRefs.length > 0 ? [] : ['failure_path_acceptance_coverage_missing']),
      ];
      return { id, linkedNegIds, linkedEvidenceIds, traceRefs, acceptanceRefs, e2eRefs, missing, covered: missing.length === 0 };
    })
    .filter((row) => row.id);
  const edgeCases = edgeRows
    .map((row) => {
      const id = text(row.id);
      const linkedFailurePathIds = idRefs(row, ['linkedFailurePathIds', 'failurePathRefs']);
      const linkedNegIds = unique([
        ...idRefs(row, ['linkedNegIds', 'negRefs']),
        ...linkedFailurePathIds.flatMap((failureId) => failureNegRefs.get(failureId) ?? []),
      ]);
      const linkedEvidenceIds = idRefs(row, ['linkedEvidenceIds', 'evidenceRefs']);
      const traceRefs = traceRefsFor(linkedNegIds, linkedEvidenceIds, idRefs(row, ['traceRows', 'traceRefs']));
      const { acceptanceRefs, e2eRefs } = acceptanceRefsFor('edgeCaseRefs', id);
      const missing = [
        ...(linkedFailurePathIds.length + linkedNegIds.length > 0 ? [] : ['edge_case_failure_or_neg_missing']),
        ...(linkedEvidenceIds.length > 0 ? [] : ['edge_case_evidence_refs_missing']),
        ...(traceRefs.length > 0 ? [] : ['edge_case_trace_coverage_missing']),
        ...(acceptanceRefs.length + e2eRefs.length > 0 ? [] : ['edge_case_acceptance_coverage_missing']),
      ];
      return { id, linkedFailurePathIds, linkedNegIds, linkedEvidenceIds, traceRefs, acceptanceRefs, e2eRefs, missing, covered: missing.length === 0 };
    })
    .filter((row) => row.id);
  const missing = [...failurePaths, ...edgeCases].flatMap((row) =>
    strings(row.missing).map((code) => ({ id: text(row.id), code }))
  );
  return {
    decision: missing.length === 0 ? 'pass' : 'blocked',
    ready: missing.length === 0,
    failurePaths,
    edgeCases,
    missing,
    summary: {
      failurePathCount: failurePaths.length,
      edgeCaseCount: edgeCases.length,
      coveredFailurePathCount: failurePaths.filter((row) => row.covered).length,
      coveredEdgeCaseCount: edgeCases.filter((row) => row.covered).length,
      missingCount: missing.length,
    },
  };
}

function commandTargetCollection(confirmation) {
  const traceRows = objects(confirmation.traceRows);
  const rows = objects(confirmation.requiredCommands)
    .map((row) => {
      const id = commandId(row);
      const linkedTraceRows = traceRows.filter((trace) => commandRefs(trace).includes(id));
      const traceRefs = unique([...idRefs(row, ['traceRows', 'traceRefs']), ...linkedTraceRows.map((trace) => text(trace.id))]);
      const evidenceRefs = unique([
        ...idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
        ...linkedTraceRows.flatMap((trace) => strings(trace.evidenceRefs)),
      ]);
      const files = extractCommandFileRefs(text(row.command));
      const missing = [
        ...(files.length > 0 ? [] : ['command_target_files_missing']),
        ...(traceRefs.length > 0 ? [] : ['command_target_trace_refs_missing']),
        ...(evidenceRefs.length > 0 ? [] : ['command_target_evidence_refs_missing']),
      ];
      return { id, command: text(row.command), files, traceRefs, evidenceRefs, missing, ready: missing.length === 0 };
    })
    .filter((row) => row.id);
  const missing = rows.flatMap((row) => strings(row.missing).map((code) => ({ id: row.id, code })));
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'requiredCommands', code: 'command_target_collection_missing' }] : missing,
    summary: { commandCount: rows.length, coveredCommandCount: rows.filter((row) => row.ready).length, missingCount: rows.length === 0 ? 1 : missing.length },
  };
}

function traceClosureAssertions(confirmation) {
  const rows = objects(confirmation.traceRows)
    .map((row) => {
      const id = text(row.id);
      const covers = strings(row.covers);
      const evidenceRefs = strings(row.evidenceRefs);
      const commandRefsForRow = commandRefs(row);
      const acceptanceRefs = strings(row.acceptanceRefs);
      const artifactRefs = strings(row.artifactRefs);
      const missing = [
        ...(covers.length > 0 ? [] : ['trace_closure_requirement_refs_missing']),
        ...(evidenceRefs.length > 0 ? [] : ['trace_closure_evidence_refs_missing']),
        ...(commandRefsForRow.length > 0 ? [] : ['trace_closure_command_refs_missing']),
        ...(acceptanceRefs.length > 0 ? [] : ['trace_closure_acceptance_refs_missing']),
        ...(artifactRefs.length > 0 ? [] : ['trace_closure_artifact_refs_missing']),
      ];
      return { id, covers, evidenceRefs, commandRefs: commandRefsForRow, acceptanceRefs, artifactRefs, missing, ready: missing.length === 0 };
    })
    .filter((row) => row.id);
  const missing = rows.flatMap((row) => strings(row.missing).map((code) => ({ id: row.id, code })));
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'traceRows', code: 'trace_closure_assertions_missing' }] : missing,
    summary: { traceCount: rows.length, closedByPlanCount: rows.filter((row) => row.ready).length, missingCount: rows.length === 0 ? 1 : missing.length },
  };
}

function currentTargetMapSection(confirmation) {
  const map = nested(confirmation.currentTargetMap);
  const groups = [
    ['currentSummary', objects(map.currentSummary)],
    ['targetSummary', objects(map.targetSummary)],
    ['diffRows', objects(map.diffRows)],
    ['process', objects(map.process)],
    ['artifactPaths', objects(map.artifactPaths)],
    ['canonicalArtifacts', objects(map.canonicalArtifacts)],
    ['existingArtifacts', objects(map.existingArtifacts)],
  ];
  const missing = groups
    .filter(([, rows]) => rows.length === 0)
    .map(([id]) => ({ id, code: 'current_target_map_group_missing' }));
  if (text(map.schemaVersion) !== 'current-target-map/v1') {
    missing.push({ id: 'schemaVersion', code: 'current_target_map_schema_version_missing_or_invalid' });
  }
  return {
    decision: missing.length === 0 ? 'pass' : 'blocked',
    ready: missing.length === 0,
    schemaVersion: text(map.schemaVersion),
    displayProfile: text(map.displayProfile),
    rows: groups.map(([id, rows]) => ({ id, count: rows.length, ready: rows.length > 0 })),
    missing,
    summary: {
      currentSummaryCount: objects(map.currentSummary).length,
      targetSummaryCount: objects(map.targetSummary).length,
      diffRowCount: objects(map.diffRows).length,
      processCount: objects(map.process).length,
      artifactPathCount: objects(map.artifactPaths).length,
      canonicalArtifactCount: objects(map.canonicalArtifacts).length,
      legacySurfaceCount: objects(map.existingArtifacts).length,
      missingCount: missing.length,
    },
  };
}

function canonicalSurfaceReconciliation(targetRows) {
  const rows = targetRows
    .filter((row) => text(row.kind) !== 'legacy_policy')
    .map((row) => {
      const missing = [
        ...(text(row.pathOrField) ? [] : ['canonical_surface_path_or_field_missing']),
        ...(strings(row.traceRefs).length > 0 ? [] : ['canonical_surface_trace_refs_missing']),
        ...(strings(row.evidenceRefs).length > 0 ? [] : ['canonical_surface_evidence_refs_missing']),
      ];
      return { ...row, missing, ready: missing.length === 0 };
    });
  const missing = rows.flatMap((row) => strings(row.missing).map((code) => ({ id: text(row.id), code })));
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'currentTargetMap', code: 'canonical_surface_reconciliation_missing' }] : missing,
    summary: { canonicalSurfaceCount: rows.length, reconciledByPlanCount: rows.filter((row) => row.ready).length, missingCount: rows.length === 0 ? 1 : missing.length },
  };
}

function legacyDenial(targetRows, controls) {
  const rows = [
    ...targetRows.filter((row) => text(row.kind) === 'legacy_policy'),
    ...controls.filter((row) => text(row.source) === 'legacy_policy'),
  ].map((row) => {
    const missing = strings(row.traceRefs).length + strings(row.evidenceRefs).length + strings(row.linkedIds).length > 0 ? [] : ['legacy_denial_refs_missing'];
    return {
      id: text(row.id),
      pathOrField: text(row.pathOrField),
      completionProofPolicy: text(row.completionProofPolicy) || 'legacy_only',
      oracle: text(row.oracle) || `Must not use ${text(row.pathOrField)} as completion proof`,
      traceRefs: strings(row.traceRefs),
      evidenceRefs: strings(row.evidenceRefs),
      linkedIds: strings(row.linkedIds),
      missing,
      ready: missing.length === 0,
    };
  });
  const missing = rows.flatMap((row) => strings(row.missing).map((code) => ({ id: text(row.id) || text(row.pathOrField), code })));
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'currentTargetMap.existingArtifacts', code: 'legacy_denial_missing' }] : missing,
    summary: { legacyDenialCount: rows.length, coveredLegacyDenialCount: rows.filter((row) => row.ready).length, missingCount: rows.length === 0 ? 1 : missing.length },
  };
}

function closeoutProof(confirmation, targetRows, commandTargets) {
  const projection = nested(nested(confirmation.aiTddContractExecutionManifestProjection).closeoutProof);
  const preview = nested(confirmation.closeoutReadinessPreview);
  const projectedCommands = strings(projection.requiredCommands);
  const previewCommands = strings(preview.requiredCommands);
  const requiredCommands = projectedCommands.length ? projectedCommands : previewCommands;
  const explicitCommandRefs = new Set([
    ...objects(confirmation.traceRows).flatMap((row) => commandRefs(row)),
    ...objects(confirmation.acceptanceTests).flatMap((row) => commandRefs(row)),
    ...objects(confirmation.e2eSuites).flatMap((row) => commandRefs(row)),
  ]);
  const closeoutCandidateCommands = objects(commandTargets.rows)
    .map((row) => text(row.id))
    .filter((id) => explicitCommandRefs.has(id));
  const normalizedRequiredCommands = unique([...requiredCommands, ...closeoutCandidateCommands]);
  const commandIds = new Set(objects(confirmation.requiredCommands).map(commandId).filter(Boolean));
  const policies = unique([
    ...strings(projection.policies),
    text(preview.orphanPolicy),
    text(preview.currentAttemptPolicy),
    text(preview.recordClosedPolicy),
  ]);
  const targetRefs = strings(projection.targetRefs).length
    ? strings(projection.targetRefs)
    : targetRows.filter((row) => text(row.kind) !== 'legacy_policy').map((row) => text(row.id) || text(row.pathOrField)).filter(Boolean);
  const missing = [
    ...(normalizedRequiredCommands.length > 0 ? [] : ['closeout_proof_required_commands_missing']),
    ...normalizedRequiredCommands
      .filter((id) => !commandIds.has(id))
      .map((id) => `closeout_proof_required_command_missing:${id}`),
    ...(policies.length > 0 ? [] : ['closeout_proof_policies_missing']),
    ...(targetRefs.length > 0 ? [] : ['closeout_proof_target_refs_missing']),
  ];
  return {
    decision: missing.length === 0 ? 'pass' : 'blocked',
    ready: missing.length === 0,
    requiredCommands: normalizedRequiredCommands,
    sourceRequiredCommands: requiredCommands,
    projectionRequiredCommands: projectedCommands,
    previewRequiredCommands: previewCommands,
    normalizedFromCommandTargets: closeoutCandidateCommands.filter(
      (id) => !projectedCommands.includes(id)
    ),
    policies,
    targetRefs,
    missing: missing.map((code) => ({ id: projectedCommands.length ? 'aiTddContractExecutionManifestProjection.closeoutProof' : 'closeoutReadinessPreview', code })),
    summary: {
      requiredCommandCount: normalizedRequiredCommands.length,
      sourceRequiredCommandCount: requiredCommands.length,
      normalizedCommandCount: closeoutCandidateCommands.filter((id) => !projectedCommands.includes(id)).length,
      policyCount: policies.length,
      targetRefCount: targetRefs.length,
      missingCount: missing.length,
    },
  };
}

function evidenceTrustStates(confirmation) {
  const rows = objects(confirmation.evidence)
    .map((row) => {
      const requiredCommandRefs = idRefs(row, ['requiredCommandRefs', 'commandRefs']);
      const artifactRefs = idRefs(row, ['artifactRefs']);
      const missing = [
        ...(text(row.oracle) ? [] : ['evidence_trust_oracle_missing']),
        ...(requiredCommandRefs.length > 0 ? [] : ['evidence_trust_command_refs_missing']),
        ...(artifactRefs.length > 0 ? [] : ['evidence_trust_artifact_refs_missing']),
      ];
      return {
        id: text(row.id),
        initialState: 'planned',
        allowedStates: ['planned', 'observed', 'assertion_validated', 'delivery_verified'],
        closeoutConsumableState: 'delivery_verified',
        requiredCommandRefs,
        artifactRefs,
        oracle: text(row.oracle),
        missing,
        ready: missing.length === 0,
      };
    })
    .filter((row) => row.id);
  const missing = rows.flatMap((row) => strings(row.missing).map((code) => ({ id: row.id, code })));
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'evidence', code: 'evidence_trust_states_missing' }] : missing,
    summary: { evidenceCount: rows.length, trustedByPlanCount: rows.filter((row) => row.ready).length, missingCount: rows.length === 0 ? 1 : missing.length },
  };
}

function buildDerivedContractExecutionManifest(input) {
  const confirmation = input.confirmation ?? {};
  const projection = nested(confirmation.aiTddContractExecutionManifestProjection);
  const acceptance = acceptanceRows(confirmation);
  const targetRows = targetArtifacts(confirmation);
  const controls = negativeControls(confirmation, targetRows);
  const commandTargets = commandTargetCollection(confirmation);
  const traceClosures = traceClosureAssertions(confirmation);
  const currentTargetMap = currentTargetMapSection(confirmation);
  const targetMods = targetModificationPaths(confirmation);
  const targetModCoverage = targetModificationPathCoverage(confirmation, targetMods);
  const canonicalSurfaces = canonicalSurfaceReconciliation(targetRows);
  const legacyControls = legacyDenial(targetRows, controls);
  const closeout = closeoutProof(confirmation, targetRows, commandTargets);
  const evidenceTrust = evidenceTrustStates(confirmation);
  const providedManifest = nested(input.manifest);
  const projectionOnlyKeys = new Set([
    'applies',
    'atomicImplementationTaskLineage',
    'currentTargetMapRefs',
    'canonicalSurfaceRefs',
    'executionLoopProtocol',
    'finalGateMatrix',
    'hostExecutionHints',
    'postCloseoutConfirmationReview',
    'preConfirmationDrilldownInputs',
    'semanticGapPolicy',
  ]);
  const overrides = {};
  for (const [key, value] of Object.entries(providedManifest)) {
    if (!projectionOnlyKeys.has(key)) overrides[key] = value;
  }
  const derivedSection = (key, fallback) => {
    const value = overrides[key];
    if (!isObject(value)) return fallback;
    if (
      value.decision !== undefined ||
      value.missing !== undefined ||
      value.summary !== undefined ||
      Array.isArray(value.rows)
    ) {
      return value;
    }
    return fallback;
  };
  const rawManifest = {
    ...projection,
    ...overrides,
    requirements: requirementRows(confirmation),
    evidence: objects(confirmation.evidence).map((row) => ({
      id: text(row.id),
      text: text(row.text),
      gate: text(row.gate),
      oracle: text(row.oracle),
      requiredCommandRefs: idRefs(row, ['requiredCommandRefs', 'commandRefs']),
      artifactRefs: idRefs(row, ['artifactRefs']),
    })),
    traceRows: objects(confirmation.traceRows).map((row) => ({
      id: text(row.id),
      covers: strings(row.covers),
      evidenceRefs: strings(row.evidenceRefs),
      commandRefs: commandRefs(row),
      artifactRefs: strings(row.artifactRefs),
      canonicalSurfaceRefs: strings(row.canonicalSurfaceRefs),
      currentTargetMapRefs: strings(row.currentTargetMapRefs),
      targetModificationPaths: strings(row.targetModificationPaths),
      acceptanceRefs: strings(row.acceptanceRefs),
      status: text(row.status),
    })),
    requiredCommands: objects(confirmation.requiredCommands).map((row) => ({
      id: commandId(row),
      command: text(row.command),
      role: text(row.role) || text(row.commandRole) || text(row.gate),
      expectedMode: text(row.expectedMode) || text(row.expectedExitCodeAfterImplementation),
      files: extractCommandFileRefs(text(row.command)),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
    })),
    acceptanceTests: acceptance.filter((row) => row.kind !== 'e2e'),
    e2eSuites: acceptance.filter((row) => row.kind === 'e2e'),
    acceptanceSuites: acceptance,
    preImplementationRedProofs:
      overrides.preImplementationRedProofs ??
      objects(input.record?.aiTddContractGate?.preImplementationRedProofs),
    targetArtifacts: overrides.targetArtifacts ?? targetRows,
    targetModificationPaths: overrides.targetModificationPaths ?? targetMods,
    negativeControls: controls,
    errorCaseCoverage: overrides.errorCaseCoverage ?? errorCaseCoverage(confirmation, acceptance),
    commandTargetCollection: overrides.commandTargetCollection ?? commandTargets,
    traceClosureAssertions: overrides.traceClosureAssertions ?? traceClosures,
    currentTargetMap: derivedSection('currentTargetMap', currentTargetMap),
    targetModificationPathCoverage: derivedSection(
      'targetModificationPathCoverage',
      targetModCoverage
    ),
    canonicalSurfaceReconciliation: derivedSection(
      'canonicalSurfaceReconciliation',
      canonicalSurfaces
    ),
    legacyDenial: derivedSection('legacyDenial', legacyControls),
    closeoutProof: derivedSection('closeoutProof', closeout),
    evidenceTrustStates: derivedSection('evidenceTrustStates', evidenceTrust),
    closeoutGates: overrides.closeoutGates ?? {
      decision: [
        commandTargets,
        traceClosures,
        currentTargetMap,
        targetModCoverage,
        canonicalSurfaces,
        legacyControls,
        closeout,
        evidenceTrust,
      ].every((section) => section.ready === true)
        ? 'pass'
        : 'blocked',
      requiredManifestSections: [
        'commandTargetCollection',
        'traceClosureAssertions',
        'currentTargetMap',
        'targetModificationPathCoverage',
        'canonicalSurfaceReconciliation',
        'legacyDenial',
        'closeoutProof',
        'evidenceTrustStates',
      ],
    },
  };
  return buildContractExecutionManifest({ ...input, manifest: rawManifest });
}

function withoutGeneratedHash(manifest) {
  const clone = { ...manifest };
  delete clone.manifestHash;
  return clone;
}

function buildContractExecutionManifest(input) {
  const confirmation = input.confirmation ?? {};
  const sourceProjection = isObject(confirmation.aiTddContractExecutionManifestProjection)
    ? confirmation.aiTddContractExecutionManifestProjection
    : {};
  const normalized = normalizeContractExecutionManifest({
    confirmation,
    manifest: input.manifest,
    builderVersion: input.builderVersion ?? CANONICAL_BUILDER_VERSION,
  });
  const manifest = {
    ...normalized.manifest,
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    builderVersion: input.builderVersion ?? CANONICAL_BUILDER_VERSION,
    sourcePath: input.sourcePath ?? normalized.manifest.sourcePath,
    recordPath: input.recordPath ?? normalized.manifest.recordPath,
    currentAttemptId: input.attemptId ?? normalized.manifest.currentAttemptId,
    sourceDocumentHash: input.sourceDocumentHash ?? normalized.manifest.sourceDocumentHash,
    implementationConfirmationHash:
      input.implementationConfirmationHash ?? normalized.manifest.implementationConfirmationHash,
    sourceProjectionHash:
      input.sourceProjectionHash ??
      normalized.manifest.sourceProjectionHash ??
      hashSourceProjection(sourceProjection),
    aliasAudit: normalized.audit,
  };
  if (!manifest.sourcePath) delete manifest.sourcePath;
  if (!manifest.recordPath) delete manifest.recordPath;
  if (!manifest.currentAttemptId) delete manifest.currentAttemptId;
  if (!manifest.sourceDocumentHash) delete manifest.sourceDocumentHash;
  if (!manifest.implementationConfirmationHash) delete manifest.implementationConfirmationHash;
  manifest.manifestHash = hashCanonicalManifest(withoutGeneratedHash(manifest));
  return manifest;
}

function canonicalManifestFingerprint(manifest) {
  return hashCanonicalManifest(withoutGeneratedHash(manifest));
}

function manifestsEquivalent(left, right) {
  return stableStringify(withoutGeneratedHash(left)) === stableStringify(withoutGeneratedHash(right));
}

module.exports = {
  buildContractExecutionManifest,
  buildDerivedContractExecutionManifest,
  canonicalManifestFingerprint,
  manifestsEquivalent,
};
