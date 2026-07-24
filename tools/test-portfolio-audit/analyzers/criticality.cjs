'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ANALYZER_ID = 'criticality';
const ANALYZER_VERSION = '1';
const DIMENSION = 'criticality';
const ALLOWED_BINDING_KINDS = Object.freeze([
  'package_install',
  'packaged_runtime',
  'cli_bin',
  'main_agent_core',
  'release_path',
  'consumer_compatibility',
  'security_encoding_persistence',
  'protected_acceptance_or_proof',
  'active_regression_binding',
]);
const ALLOWED_BINDING_KIND_SET = new Set(ALLOWED_BINDING_KINDS);
const SOURCE_BINDING_FIELDS = Object.freeze([
  ['packageInstallBindings', 'package_install'],
  ['packagedRuntimeBindings', 'packaged_runtime'],
  ['cliBinBindings', 'cli_bin'],
  ['mainAgentCoreBindings', 'main_agent_core'],
  ['consumerCompatibilityBindings', 'consumer_compatibility'],
  ['securityEncodingPersistenceBindings', 'security_encoding_persistence'],
  ['protectedAcceptanceOrProofBindings', 'protected_acceptance_or_proof'],
  ['activeRegressionBindings', 'active_regression_binding'],
]);

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareText);
}

function normalizePath(value) {
  return path.posix.normalize(String(value).replace(/\\/g, '/')).replace(/^\.\//, '');
}

function scriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.js') || filePath.endsWith('.cjs') || filePath.endsWith('.mjs')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function stableBindings(bindings) {
  const byKey = new Map();
  for (const binding of bindings) {
    if (
      !binding ||
      !ALLOWED_BINDING_KIND_SET.has(binding.kind) ||
      typeof binding.evidenceRef !== 'string' ||
      binding.evidenceRef.trim() === ''
    ) {
      continue;
    }
    const normalized = {
      kind: binding.kind,
      evidenceRef: binding.evidenceRef,
    };
    byKey.set(`${normalized.evidenceRef}\0${normalized.kind}`, normalized);
  }
  return [...byKey.values()].sort((left, right) =>
    compareText(`${left.evidenceRef}\0${left.kind}`, `${right.evidenceRef}\0${right.kind}`)
  );
}

function normalizeBinding(value, fallbackKind) {
  if (typeof value === 'string') {
    return { kind: fallbackKind, evidenceRef: value };
  }
  if (!value || typeof value !== 'object') return undefined;
  return {
    kind: fallbackKind || value.kind,
    evidenceRef: value.evidenceRef,
  };
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function valuesForKey(collection, identityKey, testPath) {
  if (collection instanceof Map) {
    return collection.get(testPath) || collection.get(identityKey) || [];
  }
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) return [];
  return collection[testPath] || collection[identityKey] || [];
}

function collectSourceBindings({ identityKey, testPath, sourceIndex }) {
  const bindings = [];
  for (const [fieldName, fallbackKind] of SOURCE_BINDING_FIELDS) {
    const values = valuesForKey(sourceIndex?.[fieldName], identityKey, testPath);
    for (const value of toArray(values)) {
      bindings.push(normalizeBinding(value, fallbackKind));
    }
  }
  return bindings;
}

function matchingRoutes(routeGraph, identityKey, testPath) {
  return (Array.isArray(routeGraph?.routes) ? routeGraph.routes : [])
    .filter(
      (route) =>
        route?.identityKey === identityKey ||
        (typeof route?.testPath === 'string' && normalizePath(route.testPath) === testPath)
    )
    .sort((left, right) =>
      compareText(
        `${left.sourceRef || ''}\0${left.routeId || ''}`,
        `${right.sourceRef || ''}\0${right.routeId || ''}`
      )
    );
}

function sourceRefFragment(sourceRef) {
  return typeof sourceRef === 'string' && sourceRef.includes('#')
    ? sourceRef.slice(sourceRef.indexOf('#') + 1)
    : '';
}

function collectRouteBindings({ identityKey, testPath, routeGraph }) {
  const bindings = [];
  for (const route of matchingRoutes(routeGraph, identityKey, testPath)) {
    if (
      typeof route.sourceRef === 'string' &&
      /release|publish|package_parity|artifact|eligibility/iu.test(
        `${route.purpose || ''} ${sourceRefFragment(route.sourceRef)}`
      )
    ) {
      bindings.push({
        kind: 'release_path',
        evidenceRef: route.sourceRef,
      });
    }
  }
  return bindings;
}

function collectCriticalBindings(input) {
  return stableBindings([...collectSourceBindings(input), ...collectRouteBindings(input)]);
}

function specializedEvidenceRefs({ identityKey, testPath, routeGraph, sourceIndex }) {
  const refs = [];
  for (const route of matchingRoutes(routeGraph, identityKey, testPath)) {
    if (
      typeof route.sourceRef === 'string' &&
      /extended_host|host_matrix|compatibility_matrix|mutation|chaos|nightly|long_run/iu.test(
        `${route.purpose || ''} ${sourceRefFragment(route.sourceRef)}`
      )
    ) {
      refs.push(route.sourceRef);
    }
  }
  for (const value of toArray(
    valuesForKey(sourceIndex?.specializedBindings, identityKey, testPath)
  )) {
    if (typeof value === 'string') refs.push(value);
    else if (typeof value?.evidenceRef === 'string') refs.push(value.evidenceRef);
  }
  return stableUnique(refs);
}

function finding(identityKey, value, confidence, bindings, evidenceRefs, issueCodes) {
  return {
    identityKey,
    value,
    confidence,
    bindings: stableBindings(bindings),
    evidenceRefs: stableUnique(evidenceRefs),
    issueCodes: stableUnique(issueCodes),
  };
}

function parseTest(repoRoot, testPath) {
  try {
    const sourceText = fs.readFileSync(path.join(repoRoot, testPath), 'utf8');
    const sourceFile = ts.createSourceFile(
      testPath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(testPath)
    );
    return {
      error: sourceFile.parseDiagnostics.length > 0,
      evidenceRefs: sourceFile.parseDiagnostics.map((diagnostic) => {
        const start = diagnostic.start || 0;
        const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
        return `source:${testPath}#parse-error:${diagnostic.code}:line:${line}`;
      }),
    };
  } catch {
    return {
      error: true,
      evidenceRefs: [`source:${testPath}#read-error`],
    };
  }
}

async function analyzeTest(input) {
  const identityKey = input.identityKey || input.testPath;
  const testPath = normalizePath(input.testPath || identityKey);
  const parsed = parseTest(input.repoRoot, testPath);
  if (parsed.error) {
    return finding(identityKey, 'unknown', 'low', [], parsed.evidenceRefs, [
      'CRITICALITY_ANALYSIS_INCOMPLETE',
    ]);
  }

  const bindings = collectCriticalBindings({
    ...input,
    identityKey,
    testPath,
  });
  if (bindings.length > 0) {
    return finding(
      identityKey,
      'critical',
      'high',
      bindings,
      bindings.map((binding) => binding.evidenceRef),
      []
    );
  }

  const specializedRefs = specializedEvidenceRefs({
    ...input,
    identityKey,
    testPath,
  });
  if (specializedRefs.length > 0) {
    return finding(identityKey, 'specialized', 'high', [], specializedRefs, []);
  }
  return finding(identityKey, 'standard', 'medium', [], [], []);
}

async function analyze(input) {
  if (typeof input?.repoRoot !== 'string' || !Array.isArray(input?.inventory?.tests)) {
    return {
      analyzerId: ANALYZER_ID,
      analyzerVersion: ANALYZER_VERSION,
      dimension: DIMENSION,
      required: true,
      status: 'failed',
      findings: [],
      issues: ['CRITICALITY_INITIALIZATION_FAILED'],
    };
  }

  const findings = [];
  const tests = [...input.inventory.tests].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  for (const test of tests) {
    findings.push(
      await analyzeTest({
        repoRoot: input.repoRoot,
        testPath: test.testPath,
        identityKey: test.identityKey,
        routeGraph: input.routeGraph,
        sourceIndex: input.sourceIndex,
      })
    );
  }
  return {
    analyzerId: ANALYZER_ID,
    analyzerVersion: ANALYZER_VERSION,
    dimension: DIMENSION,
    required: true,
    status: 'complete',
    findings,
    issues: [],
  };
}

module.exports = {
  ALLOWED_BINDING_KINDS,
  ANALYZER_ID,
  ANALYZER_VERSION,
  analyze,
  analyzeTest,
  collectCriticalBindings,
};
