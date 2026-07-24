const {
  AUDIT_SCHEMA_VERSION,
  canonicalJsonBytes,
  canonicalize,
  compareTestIdentity,
  normalizeEvidenceRef,
  sha256Bytes,
  stableUnique,
  validateCanonicalAudit,
} = require('./canonical.cjs');

const DIMENSIONS = Object.freeze({
  executionMultiplicity: Object.freeze({
    values: new Set(['single', 'duplicate', 'unknown']),
    conflict: 'unknown',
    coverageCode: 'EXECUTION_MULTIPLICITY_COVERAGE_MISSING',
    conflictCode: 'EXECUTION_MULTIPLICITY_CONFLICT',
  }),
  targetValidity: Object.freeze({
    values: new Set(['active', 'obsolete_candidate', 'ambiguous']),
    conflict: 'ambiguous',
    coverageCode: 'TARGET_VALIDITY_COVERAGE_MISSING',
    conflictCode: 'TARGET_CLASSIFICATION_CONFLICT',
  }),
  oracleEffectiveness: Object.freeze({
    values: new Set(['effective', 'ineffective_candidate', 'ambiguous']),
    conflict: 'ambiguous',
    coverageCode: 'ORACLE_EFFECTIVENESS_COVERAGE_MISSING',
    conflictCode: 'ORACLE_CLASSIFICATION_CONFLICT',
  }),
  parallelSafety: Object.freeze({
    values: new Set(['safe_candidate', 'unsafe', 'unknown']),
    conflict: 'unknown',
    coverageCode: 'PARALLEL_SAFETY_COVERAGE_MISSING',
    conflictCode: 'PARALLEL_SAFETY_CLASSIFICATION_CONFLICT',
  }),
  criticality: Object.freeze({
    values: new Set(['critical', 'standard', 'specialized', 'unknown']),
    conflict: 'unknown',
    coverageCode: 'CRITICALITY_COVERAGE_MISSING',
    conflictCode: 'CRITICALITY_CLASSIFICATION_CONFLICT',
  }),
});

const CONFIDENCE_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });

function compareText(left, right) {
  const leftText = String(left || '');
  const rightText = String(right || '');
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function finiteDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeIssue(issue, fallback = {}) {
  const source =
    typeof issue === 'string'
      ? { code: issue }
      : issue && typeof issue === 'object'
        ? issue
        : { code: 'AUDIT_ISSUE_INVALID' };
  let evidenceRef = source.evidenceRef || source.sourceRef || fallback.evidenceRef || '';
  if (evidenceRef) {
    try {
      evidenceRef = normalizeEvidenceRef(evidenceRef);
    } catch {
      evidenceRef = '';
    }
  }
  const normalized = {
    severity: String(source.severity || fallback.severity || 'warning'),
    code: String(source.code || fallback.code || 'AUDIT_ISSUE_UNSPECIFIED'),
    identityKey: String(source.identityKey || fallback.identityKey || ''),
    evidenceRef: String(evidenceRef),
  };
  for (const field of ['analyzerId', 'dimension', 'value']) {
    const value = source[field] ?? fallback[field];
    if (value !== undefined && value !== null && String(value) !== '') {
      normalized[field] = String(value);
    }
  }
  return normalized;
}

function compareIssues(left, right) {
  for (const field of ['severity', 'code', 'identityKey', 'evidenceRef']) {
    const order = compareText(left[field], right[field]);
    if (order !== 0) return order;
  }
  return compareText(JSON.stringify(canonicalize(left)), JSON.stringify(canonicalize(right)));
}

function normalizeIssues(issues) {
  const byValue = new Map();
  for (const issue of issues || []) {
    const normalized = normalizeIssue(issue);
    byValue.set(JSON.stringify(canonicalize(normalized)), normalized);
  }
  return [...byValue.values()].sort(compareIssues);
}

function addIssue(issues, code, context = {}) {
  issues.push(
    normalizeIssue(
      {
        severity: context.severity || 'warning',
        code,
        identityKey: context.identityKey || '',
        evidenceRef: context.evidenceRef || '',
        analyzerId: context.analyzerId,
        dimension: context.dimension,
        value: context.value,
      },
      context
    )
  );
}

function normalizedRefs(values, context, issues) {
  const refs = [];
  for (const value of values || []) {
    try {
      refs.push(normalizeEvidenceRef(value));
    } catch {
      addIssue(issues, 'EVIDENCE_REF_INVALID', {
        ...context,
        value: typeof value === 'string' ? value : typeof value,
      });
    }
  }
  return stableUnique(refs);
}

function normalizedRouteRefs(values, context, issues) {
  const refs = [];
  for (const value of values || []) {
    try {
      const normalized = normalizeEvidenceRef(value);
      if (!normalized.startsWith('route:') || normalized === 'route:') {
        throw new Error('EXECUTION_ROUTE_REF_INVALID');
      }
      refs.push(normalized);
    } catch {
      addIssue(issues, 'EXECUTION_ROUTE_REF_INVALID', {
        ...context,
        value: typeof value === 'string' ? value : typeof value,
      });
    }
  }
  return stableUnique(refs);
}

function normalizedIssueCodes(values) {
  return stableUnique((values || []).filter((value) => typeof value === 'string' && value));
}

function normalizeConfidence(value, context, issues) {
  if (Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, value)) return value;
  addIssue(issues, 'ANALYZER_FINDING_CONFIDENCE_UNSUPPORTED', {
    ...context,
    value: value === undefined ? 'undefined' : value,
  });
  return 'low';
}

function conservativeConfidence(values) {
  return [...values].sort((left, right) => CONFIDENCE_RANK[left] - CONFIDENCE_RANK[right])[0];
}

function highestDuration(findings, field) {
  const values = findings.map((finding) => finiteDuration(finding[field])).filter(Boolean);
  return values.length === 0 ? undefined : Math.max(...values);
}

function mergeFindings(findings, context, issues) {
  const confidences = findings.map((finding) =>
    normalizeConfidence(finding.confidence, context, issues)
  );
  return {
    confidence: conservativeConfidence(confidences),
    evidenceRefs: normalizedRefs(
      findings.flatMap((finding) => finding.evidenceRefs || []),
      context,
      issues
    ),
    issueCodes: normalizedIssueCodes(findings.flatMap((finding) => finding.issueCodes || [])),
    executionRouteRefs: normalizedRouteRefs(
      findings.flatMap((finding) => finding.executionRouteRefs || []),
      context,
      issues
    ),
    durationMs: highestDuration(findings, 'durationMs'),
    removableDurationMs: highestDuration(findings, 'removableDurationMs'),
  };
}

function applyProbeFinding(reduced, probeFinding, context, issues) {
  if (!probeFinding) return reduced;
  const probeContext = { ...context, analyzerId: 'runtime-probe' };
  const evidenceRefs = normalizedRefs(probeFinding.evidenceRefs || [], probeContext, issues);
  const issueCodes = normalizedIssueCodes(probeFinding.issueCodes || []);
  const combined = {
    ...reduced,
    evidenceRefs: stableUnique([...reduced.evidenceRefs, ...evidenceRefs]),
    issueCodes: stableUnique([...reduced.issueCodes, ...issueCodes]),
  };
  if (!DIMENSIONS.parallelSafety.values.has(probeFinding.value)) {
    addIssue(issues, 'PROBE_FINDING_VALUE_UNSUPPORTED', {
      ...probeContext,
      value: probeFinding.value,
      evidenceRef: evidenceRefs[0] || '',
    });
    combined.issueCodes = stableUnique([...combined.issueCodes, 'PROBE_FINDING_VALUE_UNSUPPORTED']);
    return combined;
  }
  if (reduced.value !== 'safe_candidate') return combined;
  if (probeFinding.value === 'unsafe' || probeFinding.value === 'unknown') {
    return {
      ...combined,
      value: probeFinding.value,
      confidence: normalizeConfidence(probeFinding.confidence, probeContext, issues),
    };
  }
  return {
    ...combined,
    confidence:
      CONFIDENCE_RANK[reduced.confidence] > CONFIDENCE_RANK.medium ? 'medium' : reduced.confidence,
  };
}

function hasDistinctTargetScopes(dimension, findings) {
  if (dimension !== 'targetValidity' || findings.length < 2) return false;
  const targetRefs = findings.map((finding) =>
    typeof finding.targetRef === 'string' ? finding.targetRef : ''
  );
  return targetRefs.every(Boolean) && new Set(targetRefs).size === targetRefs.length;
}

function reduceDimension({ dimension, findings = [], probeFinding, identityKey = '' }) {
  const contract = DIMENSIONS[dimension];
  if (!contract) throw new Error(`ANALYZER_DIMENSION_UNSUPPORTED:${dimension}`);
  const issues = [];
  const context = { dimension, identityKey };
  const supported = [];
  const inheritedIssueCodes = [];
  const inheritedEvidenceRefs = [];

  for (const finding of findings) {
    const findingContext = {
      ...context,
      analyzerId: finding.analyzerId,
      value: finding.value,
    };
    inheritedIssueCodes.push(...normalizedIssueCodes(finding.issueCodes || []));
    inheritedEvidenceRefs.push(
      ...normalizedRefs(finding.evidenceRefs || [], findingContext, issues)
    );
    if (!contract.values.has(finding.value)) {
      addIssue(issues, 'ANALYZER_FINDING_VALUE_UNSUPPORTED', {
        ...findingContext,
        evidenceRef: inheritedEvidenceRefs.at(-1) || '',
      });
      inheritedIssueCodes.push('ANALYZER_FINDING_VALUE_UNSUPPORTED');
      continue;
    }
    supported.push(finding);
  }

  if (supported.length === 0) {
    addIssue(issues, contract.coverageCode, context);
    return {
      value: contract.conflict,
      confidence: 'low',
      evidenceRefs: stableUnique(inheritedEvidenceRefs),
      issueCodes: stableUnique([...inheritedIssueCodes, contract.coverageCode]),
      executionRouteRefs: [],
      coverageMissing: true,
      conflict: false,
      issues,
    };
  }

  const merged = mergeFindings(supported, context, issues);
  const values = new Set(supported.map((finding) => finding.value));
  let reduced = {
    value: supported[0].value,
    ...merged,
    coverageMissing: false,
    conflict: false,
    issues,
  };

  if (values.size > 1 && hasDistinctTargetScopes(dimension, supported)) {
    reduced = {
      ...reduced,
      value: contract.conflict,
      confidence: 'low',
    };
  } else if (values.size > 1) {
    addIssue(issues, contract.conflictCode, {
      ...context,
      evidenceRef: merged.evidenceRefs[0] || '',
    });
    reduced = {
      ...reduced,
      value: contract.conflict,
      confidence: 'low',
      issueCodes: stableUnique([...merged.issueCodes, contract.conflictCode]),
      conflict: true,
    };
  }

  if (dimension === 'parallelSafety') {
    reduced = applyProbeFinding(reduced, probeFinding, context, issues);
  }

  if (dimension === 'executionMultiplicity' && reduced.value === 'duplicate') {
    if (reduced.executionRouteRefs.length < 2) {
      addIssue(issues, 'DUPLICATE_EVIDENCE_INCOMPLETE', context);
      reduced = {
        ...reduced,
        value: 'unknown',
        confidence: 'low',
        issueCodes: stableUnique([...reduced.issueCodes, 'DUPLICATE_EVIDENCE_INCOMPLETE']),
        coverageMissing: true,
      };
    }
  }

  reduced.issues = issues;
  return reduced;
}

function normalizedRunnerBindings(identity) {
  const bindings =
    Array.isArray(identity.runnerBindings) && identity.runnerBindings.length > 0
      ? identity.runnerBindings
      : [{ runnerId: identity.runnerId }];
  const normalized = bindings
    .map((binding) => {
      if (typeof binding === 'string') return { runnerId: binding };
      if (!binding || typeof binding !== 'object') return undefined;
      return JSON.parse(JSON.stringify(binding));
    })
    .filter((binding) => binding && typeof binding.runnerId === 'string');
  const byValue = new Map(
    normalized.map((binding) => [JSON.stringify(canonicalize(binding)), binding])
  );
  return [...byValue.values()].sort((left, right) => {
    const runnerOrder = compareText(left.runnerId, right.runnerId);
    if (runnerOrder !== 0) return runnerOrder;
    return compareText(JSON.stringify(canonicalize(left)), JSON.stringify(canonicalize(right)));
  });
}

function probeFindingFor(identity, probeResults) {
  const results = Array.isArray(probeResults?.results) ? probeResults.results : [];
  return results.find((result) => {
    if (result.identityKey) return result.identityKey === identity.identityKey;
    return result.testPath === identity.testPath && result.runnerId === identity.runnerId;
  });
}

function buildFindingIndex(analyzerResults, identities, issues) {
  const identityKeys = new Set(identities.map((identity) => identity.identityKey));
  const index = new Map();
  for (const result of analyzerResults) {
    if (!DIMENSIONS[result.dimension]) {
      addIssue(issues, 'ANALYZER_DIMENSION_UNSUPPORTED', {
        analyzerId: result.analyzerId,
        dimension: result.dimension,
      });
      continue;
    }
    for (const finding of Array.isArray(result.findings) ? result.findings : []) {
      if (!finding || typeof finding !== 'object') {
        addIssue(issues, 'ANALYZER_FINDING_INVALID', {
          analyzerId: result.analyzerId,
          dimension: result.dimension,
        });
        continue;
      }
      if (!finding.identityKey) {
        addIssue(issues, 'ANALYZER_FINDING_IDENTITY_MISSING', {
          analyzerId: result.analyzerId,
          dimension: result.dimension,
        });
        continue;
      }
      if (!identityKeys.has(finding.identityKey)) {
        addIssue(issues, 'ANALYZER_FINDING_IDENTITY_UNKNOWN', {
          analyzerId: result.analyzerId,
          dimension: result.dimension,
          identityKey: finding.identityKey,
        });
        continue;
      }
      const key = `${finding.identityKey}\0${result.dimension}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ ...finding, analyzerId: result.analyzerId });
    }
  }
  return index;
}

function reduceIdentity(identity, findingIndex, input, issues) {
  const dimensionResults = {};
  const probeFinding = probeFindingFor(identity, input.probeResults);
  for (const dimension of Object.keys(DIMENSIONS)) {
    const result = reduceDimension({
      dimension,
      identityKey: identity.identityKey,
      findings: findingIndex.get(`${identity.identityKey}\0${dimension}`) || [],
      probeFinding: dimension === 'parallelSafety' ? probeFinding : undefined,
    });
    dimensionResults[dimension] = result;
    issues.push(...result.issues);
  }

  const evidenceRefs = normalizedRefs(
    [
      ...(identity.evidenceRefs || []),
      ...Object.values(dimensionResults).flatMap((result) => result.evidenceRefs),
    ],
    { identityKey: identity.identityKey },
    issues
  );
  const executionRouteRefs = normalizedRouteRefs(
    [
      ...(identity.executionRouteRefs || identity.routeRefs || []),
      ...Object.values(dimensionResults).flatMap((result) => result.executionRouteRefs),
    ],
    { identityKey: identity.identityKey, dimension: 'executionMultiplicity' },
    issues
  );
  const issueCodes = stableUnique(
    Object.values(dimensionResults).flatMap((result) => result.issueCodes)
  );
  for (const code of issueCodes) {
    issues.push(
      normalizeIssue({
        severity: 'warning',
        code,
        identityKey: identity.identityKey,
        evidenceRef: evidenceRefs[0] || '',
      })
    );
  }

  const durationMs =
    finiteDuration(input.timings?.[identity.identityKey]) ??
    finiteDuration(identity.durationMs) ??
    Object.values(dimensionResults)
      .map((result) => result.durationMs)
      .find((value) => value !== undefined);
  const removableDurationMs = dimensionResults.executionMultiplicity.removableDurationMs;
  const row = {
    identityKey: identity.identityKey,
    testPath: identity.testPath,
    runnerId: identity.runnerId,
    runnerBindings: normalizedRunnerBindings(identity),
    executionMultiplicity: dimensionResults.executionMultiplicity.value,
    targetValidity: dimensionResults.targetValidity.value,
    oracleEffectiveness: dimensionResults.oracleEffectiveness.value,
    parallelSafety: dimensionResults.parallelSafety.value,
    criticality: dimensionResults.criticality.value,
    confidence: Object.fromEntries(
      Object.entries(dimensionResults).map(([dimension, result]) => [dimension, result.confidence])
    ),
    executionRouteRefs,
    evidenceRefs,
    issueCodes,
  };
  if (durationMs !== undefined) row.durationMs = durationMs;
  if (removableDurationMs !== undefined) row.removableDurationMs = removableDurationMs;
  return {
    row,
    coverageMissing: Object.values(dimensionResults).some((result) => result.coverageMissing),
    conflict: Object.values(dimensionResults).some((result) => result.conflict),
  };
}

function normalizeAnalyzerResults(values, issues) {
  const results = [];
  for (const value of values || []) {
    if (!value || typeof value !== 'object') {
      addIssue(issues, 'ANALYZER_RESULT_INVALID');
      continue;
    }
    results.push(value);
    for (const issue of value.issues || []) {
      issues.push(
        normalizeIssue(issue, {
          analyzerId: value.analyzerId,
          dimension: value.dimension,
        })
      );
    }
  }
  return results.sort((left, right) => {
    for (const field of ['dimension', 'analyzerId', 'analyzerVersion']) {
      const order = compareText(left[field], right[field]);
      if (order !== 0) return order;
    }
    return 0;
  });
}

function normalizeRepository(repository) {
  return {
    commit:
      typeof repository?.commit === 'string' && repository.commit ? repository.commit : 'unknown',
    dirty: Boolean(repository?.dirty),
  };
}

function normalizeVersionRows(values, idField) {
  const rows = [];
  for (const value of values || []) {
    if (typeof value === 'string') {
      rows.push({ [idField]: value, version: 'unknown' });
      continue;
    }
    if (!value || typeof value !== 'object' || !value[idField]) continue;
    rows.push({
      [idField]: String(value[idField]),
      version: String(value.version ?? value.analyzerVersion ?? 'unknown'),
    });
  }
  const byValue = new Map(rows.map((row) => [JSON.stringify(canonicalize(row)), row]));
  return [...byValue.values()].sort((left, right) => {
    const idOrder = compareText(left[idField], right[idField]);
    if (idOrder !== 0) return idOrder;
    return compareText(left.version, right.version);
  });
}

function normalizeTool(tool, analyzerResults) {
  return {
    version:
      typeof tool?.version === 'string' && tool.version ? tool.version : 'test-portfolio-audit/1',
    runnerVersions: normalizeVersionRows(tool?.runnerVersions, 'runnerId'),
    analyzerVersions: normalizeVersionRows(
      analyzerResults.map((result) => ({
        analyzerId: result.analyzerId,
        version: result.analyzerVersion,
      })),
      'analyzerId'
    ),
  };
}

function nonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
}

function normalizeDiscovery(discovery) {
  const runnerResolvedCount = nonNegativeInteger(
    discovery?.runnerResolvedCount,
    Array.isArray(discovery?.runnerResolved) ? discovery.runnerResolved.length : 0
  );
  const candidateCount = nonNegativeInteger(
    discovery?.candidateCount,
    Array.isArray(discovery?.candidates) ? discovery.candidates.length : 0
  );
  const unexplainedRunnerOnlyCount = nonNegativeInteger(
    discovery?.unexplainedRunnerOnlyCount,
    Array.isArray(discovery?.unexplainedRunnerOnly) ? discovery.unexplainedRunnerOnly.length : 0
  );
  const unexplainedCandidateOnlyCount = nonNegativeInteger(
    discovery?.unexplainedCandidateOnlyCount,
    Array.isArray(discovery?.unexplainedCandidateOnly)
      ? discovery.unexplainedCandidateOnly.length
      : 0
  );
  return {
    complete: discovery?.complete === true,
    runnerResolvedCount,
    candidateCount,
    unexplainedRunnerOnlyCount,
    unexplainedCandidateOnlyCount,
  };
}

function normalizeProbe(probeResults) {
  const issueCodes = normalizedIssueCodes(probeResults?.issueCodes || []);
  const summary = {
    requested: nonNegativeInteger(probeResults?.requested),
    selected: nonNegativeInteger(probeResults?.selected),
    completed: nonNegativeInteger(probeResults?.completed),
    failed: nonNegativeInteger(probeResults?.failed),
    timedOut: nonNegativeInteger(probeResults?.timedOut),
    unprobed: nonNegativeInteger(probeResults?.unprobed),
    budgetExhausted: Boolean(
      probeResults?.budgetExhausted || issueCodes.includes('PROBE_BUDGET_EXHAUSTED')
    ),
  };
  return {
    complete:
      summary.unprobed === 0 &&
      summary.failed === 0 &&
      summary.timedOut === 0 &&
      !summary.budgetExhausted,
    ...summary,
  };
}

function calculateTotals(tests, issues) {
  const dimensions = {};
  for (const dimension of Object.keys(DIMENSIONS)) {
    const counts = {};
    for (const row of tests) counts[row[dimension]] = (counts[row[dimension]] || 0) + 1;
    dimensions[dimension] = Object.fromEntries(
      Object.entries(counts).sort(([left], [right]) => compareText(left, right))
    );
  }
  return {
    testCount: tests.length,
    issueCount: issues.length,
    duplicateCount: tests.filter((row) => row.executionMultiplicity === 'duplicate').length,
    safeCandidateCount: tests.filter((row) => row.parallelSafety === 'safe_candidate').length,
    obsoleteCandidateCount: tests.filter((row) => row.targetValidity === 'obsolete_candidate')
      .length,
    ineffectiveCandidateCount: tests.filter(
      (row) => row.oracleEffectiveness === 'ineffective_candidate'
    ).length,
    criticalCount: tests.filter((row) => row.criticality === 'critical').length,
    estimatedDuplicateDurationMs: tests.reduce(
      (total, row) =>
        total +
        (row.executionMultiplicity === 'duplicate'
          ? finiteDuration(row.removableDurationMs) || 0
          : 0),
      0
    ),
    estimatedParallelizableDurationMs: tests.reduce(
      (total, row) =>
        total + (row.parallelSafety === 'safe_candidate' ? finiteDuration(row.durationMs) || 0 : 0),
      0
    ),
    dimensions,
  };
}

function calculateAuditStatus({
  discovery,
  analyzerResults,
  routeGraph,
  issues,
  coverageMissing,
  conflict,
}) {
  if (issues.some((issue) => issue.severity === 'fatal') || routeGraph?.failed) return 'FAILED';
  if (!discovery.complete) return 'INCOMPLETE';
  for (const dimension of Object.keys(DIMENSIONS)) {
    const matching = analyzerResults.filter((result) => result.dimension === dimension);
    if (matching.length === 0 || matching.some((result) => result.status !== 'complete')) {
      return 'INCOMPLETE';
    }
  }
  if (
    analyzerResults.some((result) => result.required && result.status !== 'complete') ||
    analyzerResults.some((result) => result.coverageMissing) ||
    coverageMissing ||
    conflict
  ) {
    return 'INCOMPLETE';
  }
  return 'COMPLETE';
}

function reduceAudit(input = {}) {
  const issues = [];
  for (const issue of input.issues || []) issues.push(normalizeIssue(issue));
  for (const issue of input.discovery?.issues || []) issues.push(normalizeIssue(issue));
  for (const issue of input.routeGraph?.issues || []) issues.push(normalizeIssue(issue));
  for (const code of input.probeResults?.issueCodes || []) {
    issues.push(normalizeIssue({ code }));
  }
  for (const issue of input.fatalIssues || []) {
    issues.push(normalizeIssue(issue, { severity: 'fatal' }));
  }

  const identities = (input.inventory?.tests || [])
    .map((identity) => {
      const testPath = String(identity.testPath || '');
      const runnerId = String(identity.runnerId || '');
      return {
        ...identity,
        testPath,
        runnerId,
        identityKey: String(identity.identityKey || `${runnerId}::${testPath}`),
      };
    })
    .sort(compareTestIdentity);
  const analyzerResults = normalizeAnalyzerResults(input.analyzerResults || [], issues);
  const findingIndex = buildFindingIndex(analyzerResults, identities, issues);
  const reductions = identities.map((identity) =>
    reduceIdentity(identity, findingIndex, input, issues)
  );
  const tests = reductions.map((reduction) => reduction.row).sort(compareTestIdentity);
  const discovery = normalizeDiscovery(input.discovery);
  const normalizedIssues = normalizeIssues(issues);
  const status = calculateAuditStatus({
    discovery,
    analyzerResults,
    routeGraph: input.routeGraph,
    issues: normalizedIssues,
    coverageMissing: reductions.some((reduction) => reduction.coverageMissing),
    conflict: reductions.some((reduction) => reduction.conflict),
  });
  const finalIssues = normalizeIssues(issues);
  const artifact = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    repository: normalizeRepository(input.repository),
    tool: normalizeTool(input.tool, analyzerResults),
    status,
    discovery,
    probe: normalizeProbe(input.probeResults),
    tests,
    issues: finalIssues,
    totals: calculateTotals(tests, finalIssues),
  };
  validateCanonicalAudit(artifact);
  const canonicalBytes = canonicalJsonBytes(artifact);
  return {
    artifact,
    canonicalBytes,
    artifactSha256: sha256Bytes(canonicalBytes),
  };
}

module.exports = {
  DIMENSIONS,
  calculateAuditStatus,
  reduceAudit,
  reduceDimension,
};
