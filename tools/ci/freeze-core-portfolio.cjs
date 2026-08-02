'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { compareText, fail, writeCanonicalArtifact } = require('./canonical-artifact.cjs');
const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  expandCapabilityBehaviorBindings,
  expandSemanticObligations,
  validateTestPolicy,
} = require('./test-policy.cjs');
const {
  catalogFactsHash,
  catalogPolicyHash,
  validateCatalogAuthority,
  validateTestCatalog,
} = require('./generate-test-catalog.cjs');
const { selectMinimalTestCover } = require('./select-minimal-test-cover.cjs');
const {
  resolveTimingAuthority,
  timingWeight,
  validateTimingSummary,
} = require('./summarize-test-timings.cjs');

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireStringArray(value, code) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    fail(code);
  }
  const normalized = value.map((entry) => entry.trim());
  if (new Set(normalized).size !== normalized.length) fail(code);
  return normalized.sort(compareText);
}

function normalizedCatalogTests(catalog) {
  if (!isPlainObject(catalog) || !Array.isArray(catalog.tests)) {
    fail('CORE_FREEZE_CATALOG_INVALID');
  }
  const identities = new Set();
  return catalog.tests
    .map((test) => {
      if (
        !isPlainObject(test) ||
        typeof test.identityKey !== 'string' ||
        test.identityKey.trim() === '' ||
        !isPlainObject(test.classifications) ||
        !isPlainObject(test.behaviorEvidence) ||
        !isPlainObject(test.behaviorOracleAuthority) ||
        !isPlainObject(test.durationSummary)
      ) {
        fail('CORE_FREEZE_CATALOG_INVALID');
      }
      const identityKey = test.identityKey.trim();
      if (identities.has(identityKey)) fail('CORE_FREEZE_CATALOG_INVALID');
      identities.add(identityKey);
      return {
        ...test,
        identityKey,
        classifications: {
          ...test.classifications,
          protectedCapabilityRefs: requireStringArray(
            test.classifications.protectedCapabilityRefs || [],
            'CORE_FREEZE_PROTECTED_CAPABILITY_REFS_INVALID'
          ),
        },
        capabilityRefs: requireStringArray(
          test.capabilityRefs,
          'CORE_FREEZE_CAPABILITY_REFS_INVALID'
        ),
        behaviorEvidence: Object.fromEntries(
          Object.entries(test.behaviorEvidence)
            .map(([evidenceRef, evidenceKind]) => {
              if (
                typeof evidenceRef !== 'string' ||
                evidenceRef.trim() === '' ||
                !['direct', 'indirect', 'ambiguous'].includes(evidenceKind)
              ) {
                fail('CORE_FREEZE_BEHAVIOR_EVIDENCE_INVALID');
              }
              return [evidenceRef, evidenceKind];
            })
            .sort(([left], [right]) => compareText(left, right))
        ),
        behaviorOracleAuthority: Object.fromEntries(
          Object.entries(test.behaviorOracleAuthority)
            .map(([evidenceRef, authority]) => {
              if (
                !Object.prototype.hasOwnProperty.call(test.behaviorEvidence, evidenceRef) ||
                !isPlainObject(authority) ||
                authority.oracleIndependence !== 'independent'
              ) {
                fail('CORE_FREEZE_BEHAVIOR_ORACLE_AUTHORITY_INVALID');
              }
              return [
                evidenceRef,
                {
                  evidenceRefs: requireStringArray(
                    authority.evidenceRefs,
                    'CORE_FREEZE_BEHAVIOR_ORACLE_EVIDENCE_REFS_INVALID'
                  ),
                  oracleIndependence: authority.oracleIndependence,
                },
              ];
            })
            .sort(([left], [right]) => compareText(left, right))
        ),
      };
    })
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function strongestEvidenceKind(values) {
  if (values.includes('direct')) return 'direct';
  if (values.includes('indirect')) return 'indirect';
  if (values.includes('ambiguous')) return 'ambiguous';
  return undefined;
}

function obligationEvidenceForTest(test, policy) {
  const obligationEvidence = {};
  for (const capability of policy.protectedCapabilities) {
    for (const binding of expandCapabilityBehaviorBindings(policy, capability)) {
      const observedKinds = binding.anyOfEvidenceRefs
        .map((evidenceRef) => test.behaviorEvidence[evidenceRef])
        .filter(Boolean);
      const observedKind = strongestEvidenceKind(observedKinds);
      if (!observedKind) continue;
      const current = obligationEvidence[binding.obligationId];
      obligationEvidence[binding.obligationId] = strongestEvidenceKind(
        [current, observedKind].filter(Boolean)
      );
    }
  }
  return Object.fromEntries(
    Object.entries(obligationEvidence).sort(([left], [right]) => compareText(left, right))
  );
}

function obligationOracleIndependenceForTest(test, policy) {
  const defaultOracleIndependence =
    test.classifications.oracleEffectiveness === 'effective' ? 'independent' : 'dependent';
  const obligationOracleIndependence = {};
  for (const capability of policy.protectedCapabilities) {
    for (const binding of expandCapabilityBehaviorBindings(policy, capability)) {
      const observedRefs = binding.anyOfEvidenceRefs.filter((evidenceRef) =>
        Object.prototype.hasOwnProperty.call(test.behaviorEvidence, evidenceRef)
      );
      if (observedRefs.length === 0) continue;
      obligationOracleIndependence[binding.obligationId] = observedRefs.some(
        (evidenceRef) =>
          test.behaviorOracleAuthority[evidenceRef]?.oracleIndependence === 'independent'
      )
        ? 'independent'
        : defaultOracleIndependence;
    }
  }
  return Object.fromEntries(
    Object.entries(obligationOracleIndependence).sort(([left], [right]) => compareText(left, right))
  );
}

function timingFreshness(durationSummary) {
  if (durationSummary.source === 'observed') return 'fresh';
  if (durationSummary.source === 'policy_default') return 'fallback';
  return 'stale';
}

function selectorCandidate(test, policy, timingDecision, timingSummary) {
  const freshIdentitySet = new Set(timingDecision?.freshIdentityKeys || []);
  const usesFreshTiming = timingDecision && freshIdentitySet.has(test.executableIdentity);
  const durationMs = usesFreshTiming
    ? timingWeight(timingSummary, test.executableIdentity)
    : timingDecision
      ? policy.timing.unknownDurationMs
      : test.durationSummary.durationMs;
  if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
    fail('CORE_FREEZE_DURATION_INVALID', { identityKey: test.identityKey });
  }
  return {
    identityKey: test.identityKey,
    obligationEvidence: obligationEvidenceForTest(test, policy),
    obligationOracleIndependence: obligationOracleIndependenceForTest(test, policy),
    oracleIndependence:
      test.classifications.oracleEffectiveness === 'effective' ? 'independent' : 'dependent',
    estimatedDurationMs: durationMs,
    timingProvenance: usesFreshTiming
      ? timingDecision.binding.provenance
      : timingDecision
        ? 'policy_default'
        : test.durationSummary.source,
    timingFreshness: usesFreshTiming
      ? 'fresh'
      : timingDecision
        ? 'fallback'
        : timingFreshness(test.durationSummary),
    flakePenaltyMs: 0,
    fragileFixturePenaltyMs: 0,
    redundancyPenaltyMs: 0,
    directEvidenceQualityBonusMs: 0,
    independentOracleBonusMs: 0,
    stabilityScore: 1,
  };
}

function gapReason(coverageItem) {
  const diagnostics = coverageItem.evidenceDiagnostics || [];
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.meetsMinimumEvidenceKind === true &&
        diagnostic.oracleIndependence === 'dependent'
    )
  ) {
    return 'missing_independent_oracle';
  }
  if (coverageItem.status === 'ambiguous') return 'ambiguous';
  return 'missing_test';
}

function buildSelectorOutcome({ obligations, candidates, defaultDurationMs }) {
  const result = selectMinimalTestCover(
    { obligations, candidates, defaultDurationMs },
    { allowUnmapped: true }
  );
  return {
    result,
    gaps: result.coverage
      .filter(
        (item) =>
          item.applicability === 'applicable' &&
          !['covered', 'indirectly_covered'].includes(item.status)
      )
      .map((item) => ({
        obligationId: item.obligationId,
        reason: gapReason(item),
      })),
  };
}

function projectFrozenSelection(selected) {
  return selected.map((item) => ({
    identityKey: item.identityKey,
    coveredObligationIds: item.coveredObligationIds,
    obligationOracleIndependence: item.obligationOracleIndependence,
    oracleIndependence: item.oracleIndependence,
    estimatedDurationMs: item.estimatedDurationMs,
    timingProvenance: item.timingProvenance,
    timingFreshness: item.timingFreshness,
    flakePenaltyMs: item.flakePenaltyMs,
    fragileFixturePenaltyMs: item.fragileFixturePenaltyMs,
    redundancyPenaltyMs: item.redundancyPenaltyMs,
    directEvidenceQualityBonusMs: item.directEvidenceQualityBonusMs,
    independentOracleBonusMs: item.independentOracleBonusMs,
    stabilityScore: item.stabilityScore,
    grossCostMs: item.grossCostMs,
    totalCostMs: item.totalCostMs,
  }));
}

function freezeCorePortfolio({ catalog, facts, policy, timingSummary, timingContext }) {
  validateTestPolicy(policy);
  validateTestCatalog(catalog);
  const expectedPolicyHash = catalogPolicyHash(policy);
  if (catalog.policyHash !== expectedPolicyHash) {
    fail('CORE_FREEZE_POLICY_HASH_MISMATCH', {
      expected: expectedPolicyHash,
      actual: catalog.policyHash,
    });
  }
  validateCatalogAuthority({
    catalog,
    facts,
    policy,
    errorCode: 'CORE_FREEZE_CATALOG_AUTHORITY_MISMATCH',
  });
  const tests = normalizedCatalogTests(catalog);
  const obligations = expandSemanticObligations(policy);
  const timingInputsProvided = timingSummary !== undefined || timingContext !== undefined;
  if (
    timingInputsProvided &&
    (!timingSummary ||
      !isPlainObject(timingContext) ||
      typeof timingContext.expectedCommitSha !== 'string' ||
      typeof timingContext.expectedEnvironmentClass !== 'string')
  ) {
    fail('CORE_FREEZE_TIMING_INPUT_INVALID');
  }
  const validatedTimingSummary = timingInputsProvided ? validateTimingSummary(timingSummary) : null;
  const timingDecision = timingInputsProvided
    ? resolveTimingAuthority({
        timingSummary: validatedTimingSummary,
        identityKeys: tests.map((test) => test.executableIdentity),
        expectedCommitSha: timingContext.expectedCommitSha,
        expectedEnvironmentClass: timingContext.expectedEnvironmentClass,
      })
    : null;
  const candidates = tests.map((test) =>
    selectorCandidate(test, policy, timingDecision, validatedTimingSummary)
  );
  const selectorInput = {
    obligations,
    candidates,
    defaultDurationMs: policy.timing.unknownDurationMs,
  };
  const outcome = buildSelectorOutcome(selectorInput);
  const gaps = [...outcome.gaps];
  if (tests.length > policy.budgets.executableTestCount) {
    gaps.push({
      reason: 'executable_budget_exceeded',
      actual: tests.length,
      budget: policy.budgets.executableTestCount,
    });
  }
  if (outcome.result.selected.length > policy.budgets.corePermanentCount) {
    gaps.push({
      reason: 'core_budget_exceeded',
      actual: outcome.result.selected.length,
      budget: policy.budgets.corePermanentCount,
    });
  }
  return {
    schemaVersion: 'test-portfolio-core-freeze/v2',
    candidateEvidence: outcome.result.candidateEvidence,
    selected: projectFrozenSelection(outcome.result.selected),
    coverage: outcome.result.coverage,
    ...(timingDecision ? { timingBinding: timingDecision.binding } : {}),
    gaps: gaps.sort((left, right) =>
      compareText(left.obligationId || left.reason, right.obligationId || right.reason)
    ),
    hashes: {
      catalogSha256: sha256Bytes(canonicalJsonBytes(catalog)),
      factsSha256: catalogFactsHash(facts),
      policySha256: sha256Bytes(canonicalJsonBytes(policy)),
      selectorInputSha256: sha256Bytes(canonicalJsonBytes(selectorInput)),
      selectorOutcomeSha256: sha256Bytes(canonicalJsonBytes(outcome.result)),
      ...(validatedTimingSummary
        ? { timingSnapshotSha256: validatedTimingSummary.timingSnapshotHash }
        : {}),
    },
  };
}

function repoPath(repoRoot, value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, value);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return target;
}

function parseCliArgs(args) {
  const options = {
    catalog: '.artifacts/test-portfolio/test-catalog.json',
    facts: null,
    policy: 'repo-governance/ci/test-policy.json',
    timingSummary: null,
    commitSha: null,
    environmentClass: null,
    output: '.artifacts/test-portfolio/core-freeze.json',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--catalog',
        '--facts',
        '--policy',
        '--timing-summary',
        '--commit-sha',
        '--environment-class',
        '--output',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CORE_FREEZE_CLI_ARGS_INVALID');
    }
    const key = flag.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    options[key] = value;
  }
  if (!options.facts || !options.timingSummary || !options.commitSha || !options.environmentClass) {
    fail('CORE_FREEZE_CLI_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const options = parseCliArgs(args);
  const catalog = JSON.parse(
    fs.readFileSync(repoPath(repoRoot, options.catalog, 'CORE_FREEZE_CATALOG_PATH_INVALID'), 'utf8')
  );
  const facts = JSON.parse(
    fs.readFileSync(repoPath(repoRoot, options.facts, 'CORE_FREEZE_FACTS_PATH_INVALID'), 'utf8')
  );
  const policy = JSON.parse(
    fs.readFileSync(repoPath(repoRoot, options.policy, 'CORE_FREEZE_POLICY_PATH_INVALID'), 'utf8')
  );
  const timingSummary = JSON.parse(
    fs.readFileSync(
      repoPath(repoRoot, options.timingSummary, 'CORE_FREEZE_TIMING_SUMMARY_PATH_INVALID'),
      'utf8'
    )
  );
  const artifact = freezeCorePortfolio({
    catalog,
    facts,
    policy,
    timingSummary,
    timingContext: {
      expectedCommitSha: options.commitSha,
      expectedEnvironmentClass: options.environmentClass,
    },
  });
  const outputPath = repoPath(repoRoot, options.output, 'CORE_FREEZE_OUTPUT_PATH_INVALID');
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: path.dirname(outputPath),
    fileName: path.basename(outputPath),
    artifact,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return artifact.gaps.length === 0 ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildSelectorOutcome,
  freezeCorePortfolio,
  main,
  parseCliArgs,
};
