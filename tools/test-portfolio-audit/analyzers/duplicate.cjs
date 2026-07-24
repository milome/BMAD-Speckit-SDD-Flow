'use strict';

const ANALYZER_ID = 'duplicate-execution';
const ANALYZER_VERSION = '1';

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function stableUnique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort(
    compareText
  );
}

function hasCompleteContext(route) {
  return ['effectiveProfileId', 'environmentId', 'purpose'].every(
    (field) => typeof route?.[field] === 'string' && route[field].trim().length > 0
  );
}

function routeGroupKey(route) {
  if (!hasCompleteContext(route)) return undefined;
  return [route.identityKey, route.effectiveProfileId, route.environmentId, route.purpose].join(
    '\0'
  );
}

function routeRefs(routes) {
  return stableUnique(routes.map((route) => route.routeId));
}

function evidenceRefs(routes) {
  return stableUnique(routes.map((route) => route.sourceRef));
}

function uniqueRoutes(routes) {
  const byRouteId = new Map();
  for (const route of routes) {
    if (!byRouteId.has(route.routeId)) byRouteId.set(route.routeId, route);
  }
  return [...byRouteId.values()];
}

function singleFinding(identityKey, routes) {
  return {
    identityKey,
    value: 'single',
    confidence: 'high',
    executionRouteRefs: routeRefs(routes),
    evidenceRefs: evidenceRefs(routes),
    issueCodes: [],
  };
}

function incompleteFinding(identityKey, routes) {
  return {
    identityKey,
    value: 'unknown',
    confidence: 'low',
    executionRouteRefs: routeRefs(routes),
    evidenceRefs: evidenceRefs(routes),
    issueCodes: ['DUPLICATE_ROUTE_CONTEXT_INCOMPLETE'],
  };
}

async function analyze({ inventory, routeGraph, timings = {} }) {
  const routes = Array.isArray(routeGraph?.routes) ? routeGraph.routes : [];
  const findings = [];

  for (const test of inventory?.tests || []) {
    const matchingRoutes = routes
      .filter((route) => route?.identityKey === test.identityKey)
      .sort((left, right) => compareText(left.routeId, right.routeId));

    if (matchingRoutes.some((route) => !hasCompleteContext(route))) {
      findings.push(incompleteFinding(test.identityKey, matchingRoutes));
      continue;
    }

    const identityRoutes = uniqueRoutes(matchingRoutes);
    const grouped = new Map();
    for (const route of identityRoutes) {
      const key = routeGroupKey(route);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(route);
    }

    const duplicateGroups = [...grouped.values()].filter((group) => group.length > 1);
    if (duplicateGroups.length === 0) {
      findings.push(singleFinding(test.identityKey, identityRoutes));
      continue;
    }

    const duplicateRoutes = duplicateGroups.flat();
    const redundantExecutions = duplicateGroups.reduce(
      (total, group) => total + group.length - 1,
      0
    );
    const durationMs = timings?.[test.identityKey];
    findings.push({
      identityKey: test.identityKey,
      value: 'duplicate',
      confidence: 'high',
      executionRouteRefs: routeRefs(duplicateRoutes),
      evidenceRefs: evidenceRefs(duplicateRoutes),
      issueCodes: ['DUPLICATE_EFFECTIVE_EXECUTION'],
      ...(typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0
        ? { removableDurationMs: durationMs * redundantExecutions }
        : {}),
    });
  }

  return {
    analyzerId: ANALYZER_ID,
    analyzerVersion: ANALYZER_VERSION,
    dimension: 'executionMultiplicity',
    required: true,
    status: 'complete',
    findings: findings.sort((left, right) => compareText(left.identityKey, right.identityKey)),
    issues: [],
  };
}

module.exports = { ANALYZER_ID, ANALYZER_VERSION, analyze, routeGroupKey };
