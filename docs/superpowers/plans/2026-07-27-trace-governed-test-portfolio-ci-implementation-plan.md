# Trace-Governed Test Portfolio and Fast CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the accumulating all-tests CI model with a trace-governed test portfolio that keeps at most 480 executable tests, reserves at most 120 permanent core tests, and holds pull-request CI to a measured P95 of 10 minutes or less without hiding unknown impact.

**Architecture:** Extract a side-effect-free Audit Facts API from the existing Phase 1 audit, then project one tracked policy and the complete facts into a canonical four-state Test Catalog. A fail-closed selector produces one Run Manifest and deterministic timing-driven shard plan for four CI profiles; GitHub Actions executes that manifest through parallel-safe, repository-mutating, package-consumer, and evidence-join lanes. Feature closeout governs test retention and deletion before push, while GitHub CI remains deterministic and model-independent.

**Tech Stack:** Node.js 22 CommonJS tooling, TypeScript acceptance tests, Vitest 4, Node test runner, JSON canonicalization with SHA256, GitHub Actions, JUnit XML timing evidence, npm package/consumer installation tests.

---

## Authority and Execution Boundary

This plan implements:

- Design authority: `docs/superpowers/specs/2026-07-27-trace-governed-test-portfolio-ci-design.md`
- Design SHA256: `97309a22203ba60562bcc054359488d29add5e901f5021532fc331989f3496ac`
- Portfolio states: `core_permanent`, `feature_working_set`, `retained_on_demand`, `deletion_candidate`
- Profiles: `pr-fast`, `pr-full`, `nightly-deep`, `release-verify`
- Hard budgets: `executableTestCount <= 480`, `corePermanentCount <= 120`, PR CI `P95 <= 10 minutes`
- Selection order: exact Trace/Capability impact, then Feature, then Package, otherwise block
- Production transition: Direct Hard Cut with offline compatibility gates; no Shadow production path, dual write, fallback test authority, or second release authority

This plan does not modify or reinterpret:

- `docs/plans/2026-07-12-ci-test-runtime-optimization-goal-execution-plan.md`
- the approved Phase 1 audit design or its historical receipts
- the six-model RequirementRecord state machine
- product behavior unrelated to test discovery, selection, execution, evidence, closeout, and release verification

Implementation must preserve unrelated worktree changes. In particular, re-check ownership before touching `packages/bmad-speckit/scripts/run-node-tests.cjs`; another session currently owns an uncommitted change there. Three untracked `tests/acceptance/*.tmp.test.ts` files are also visible to runner discovery and must be classified as concurrent workspace inputs, not silently adopted into the tracked baseline.

## Corrected Baseline Assumptions

The implementation must not build the lifecycle Catalog from the current reduced audit JSON alone:

- `reduceAudit()` drops complete critical-binding objects and retains only reduced classification values and evidence references.
- `runAudit()` owns output-directory cleanup and removes files outside its approved Phase 1 report set.
- Therefore `collectAuditFacts()` must expose complete in-memory facts without writes, and governance tools must use `.artifacts/test-portfolio/` rather than `.artifacts/ci/`.

The current repository also has these constraints:

- `.github/workflows/ci.yml` serializes multiple suites through one test job and does not treat every skipped or cancelled required lane as a closed failure.
- Current audit timing input is empty; historical JUnit timing collection does not yet exist.
- `tools/test-portfolio-audit/routes.cjs` currently rejects dynamic matrices, so the audit route model and its tests must be updated in the same hard-cut task.
- PR CI and release workflows do not currently prove exact-commit, exact-package evidence parity.
- Existing audit data does not provide a trustworthy permanent core set; core authority must be explicitly tracked and frozen from reviewed capability bindings.

## Implementation Rules

- Use Red-Green-Refactor for each behavior-bearing task.
- Every selector, catalog, shard plan, manifest, authorization, and evidence join must be canonical-byte deterministic.
- Tests must compute expected outcomes independently; do not copy implementation output into fixtures or use broad snapshots as proof.
- Unknown discovery, unknown impact, classification conflicts, missing timing policy, missing required lanes, stale authorization, or evidence mismatch must fail closed.
- Model review is local and pre-push only. Deterministic non-core deletion candidates do not call a model. Semantic ambiguity permits one local review attempt with no retry or convergence loop.
- Core tests cannot enter the ordinary deletion path.
- Flake or quarantine metadata cannot create deletion authority; protected core flakes require repair or an explicitly confirmed equivalent replacement.
- No GitHub-hosted job may require a local model.
- Generated artifacts are ignored build evidence, not tracked policy authority.
- Each task gets one scoped commit after its targeted tests and task validation pass. Do not commit generated `.artifacts/test-portfolio/` content.

## Target File Structure

### Existing Phase 1 Audit Boundary

- Create `tools/test-portfolio-audit/facts.cjs`: side-effect-free `collectAuditFacts()` orchestration that preserves source index, runner identities, route graph, binding maps, complete critical bindings, target validity, duplication, independence, and timing inputs.
- Modify `tools/test-portfolio-audit/run.cjs`: call `collectAuditFacts()`, then retain the existing Phase 1 reduction and report-writing behavior.
- Modify `tools/test-portfolio-audit/routes.cjs`: recognize governed dynamic CI matrices and wrappers without treating arbitrary dynamic execution as valid.
- Modify `tools/test-portfolio-audit/discovery.cjs`: bind the governed runner adapters by declared contract/version rather than an unexplained stale file hash.
- Modify `tests/acceptance/test-portfolio-audit-discovery.test.ts`: prove facts collection and runner drift behavior.
- Modify `tests/acceptance/test-portfolio-audit-routes.test.ts`: prove only governed dynamic lanes are accepted.
- Create `tests/acceptance/test-portfolio-audit-facts.test.ts`: prove no writes, complete binding preservation, and parity with the existing reduced report.

### Tracked Authority

- Create `repo-governance/ci/test-policy.json`: explicit core capability bindings, classification rules, allowed lifecycle transitions, profile escalation rules, timing defaults, lane definitions, budgets, and bounded expansion limits.
- Create `repo-governance/ci/test-deletion-authorizations.json`: compact, reviewable authorization records bound to current deleted identities, evidence, policy, and review profile.
- Create `tools/ci/canonical-artifact.cjs`: shared governed path guard, canonical-byte writer, hash verification, stable comparison, and structured fail-closed errors.
- Create `tools/ci/test-policy.cjs`: parse and validate tracked policy with deterministic precedence and fail-closed conflict handling.
- Create `tests/acceptance/ci-test-policy.test.ts`: validate authority shape, conflict handling, explicit core bindings, budgets, and profile rules.

### Catalog and Lifecycle

- Create `tools/ci/generate-test-catalog.cjs`: reconcile filesystem candidates and runner-resolved executable identities, combine full facts with tracked policy, and emit the canonical four-state Catalog.
- Create `tools/ci/feature-closeout.cjs`: apply feature closeout transitions, core promotion rules, contract-test consolidation, and deletion candidacy.
- Create `tools/ci/authorize-test-deletions.cjs`: generate compact deletion authorization for deterministic candidates and one-shot local review results.
- Create `tools/ci/review-ambiguous-test-candidates.cjs`: bounded local-model adapter used only for semantically ambiguous non-core candidates.
- Create `tests/acceptance/ci-generated-test-catalog.test.ts`
- Create `tests/acceptance/ci-feature-closeout.test.ts`
- Create `tests/acceptance/ci-test-deletion-authorization.test.ts`
- Create `tests/fixtures/test-portfolio/`: small fixtures for discovery reconciliation, lifecycle transitions, ambiguity, core protection, and authorization drift.

### Selection, Manifest, Timing, and Shards

- Create `tools/ci/select-ci-tests.cjs`: select tests by exact Trace/Capability, Feature, Package, and bounded profile escalation.
- Create `tools/ci/write-ci-run-manifest.cjs`: write the single profile, lane, test, shard, package, and evidence authority for one run.
- Create `tools/ci/summarize-test-timings.cjs`: normalize JUnit durations into canonical history bound to test identities and commits.
- Create `tools/ci/build-shard-plan.cjs`: deterministic longest-processing-time allocation with conservative weights for unknown durations.
- Create `tests/acceptance/ci-test-selection.test.ts`
- Create `tests/acceptance/ci-profile-selection-fail-closed.test.ts`
- Create `tests/acceptance/ci-run-manifest.test.ts`
- Create `tests/acceptance/ci-timing-report-contract.test.ts`
- Create `tests/acceptance/ci-shard-plan.test.ts`

### Execution and Package Evidence

- Create `vitest.parallel-safe.config.ts`: parallel-safe lane configuration with JUnit output.
- Create `vitest.repo-mutating.config.ts`: serialized lane configuration for tests that mutate repository or installation state.
- Modify `vitest.config.ts`: remove its role as the global serial execution authority and keep shared defaults only.
- Modify `vitest.consumer-install.config.ts`: consume the governed package-consumer lane and canonical package artifact.
- Create `tools/ci/run-vitest-shard.cjs`: execute the exact file identities from one shard and emit normalized result evidence.
- Create `tools/ci/prepare-package-artifact.cjs`: build and pack once, then hash the canonical tarball.
- Create `tools/ci/run-consumer-package-lane.cjs`: install and test the exact canonical tarball without repacking.
- Create `tools/ci/join-ci-evidence.cjs`: verify every required lane and shard against the Run Manifest.
- Create `tests/helpers/canonical-package-artifact.ts`
- Create `tests/acceptance/ci-vitest-lane-execution.test.ts`
- Create `tests/acceptance/ci-canonical-package-artifact.test.ts`
- Create `tests/acceptance/ci-package-lifecycle-dedup.test.ts`
- Create `tests/acceptance/ci-evidence-join.test.ts`

### CI and Release Hard Cut

- Modify `.github/workflows/ci.yml`: implement classify, catalog, select, artifact, dynamic lanes, evidence join, and final result jobs for PR, merge queue, schedule, dispatch, and reusable-call triggers.
- Modify `.github/workflows/release.yml`: require exact-commit `pr-full` evidence and execute `release-verify` against the same canonical package artifact.
- Modify `.github/workflows/publish-npm.yml`: remove independent publish authority or reduce it to a thin call into the release workflow.
- Modify `package.json`: expose governed catalog, selection, shard, execution, package, join, and local closeout commands; remove production fallback to the old all-tests authority.
- Modify `scripts/prepublish-check.js`: verify release evidence parity and the canonical tarball instead of rebuilding an independent package.
- Create `tools/ci/verify-release-evidence-parity.cjs`
- Create `tools/ci/verify-ci-authority-hard-cut.cjs`
- Create `tests/acceptance/ci-workflow-parallel-dag.test.ts`
- Create `tests/acceptance/release-ci-lane-parity.test.ts`
- Create `tests/acceptance/ci-hard-cut-authority.test.ts`

### Migration Evidence

- Generated directory `.artifacts/test-portfolio/`: Catalog, Run Manifest, Shard Plan, timing history, lane results, evidence join, and compact deletion authorization.
- Modify `.gitignore`: ignore only the generated governance directory and temporary local review payloads.
- Create `tools/ci/freeze-core-portfolio.cjs` and `tests/acceptance/ci-core-portfolio-freeze.test.ts`: freeze only explicit protected Capability coverage within the 120-test budget.
- Create `tools/ci/apply-test-deletion-batch.cjs` and `tests/acceptance/ci-test-deletion-batch.test.ts`: apply one authorized non-core batch with exact rollback.
- Create `docs/ci/test-portfolio-operations.md`: operator commands, profile semantics, closeout flow, blocked-selection remediation, and rollback procedure.

## Task Dependency Order

```text
Task 1 Audit Facts + Policy
  -> Task 2 Catalog
  -> Task 3 Feature Closeout
  -> Task 4 Selection
  -> Task 5 Run Manifest + Evidence Join
  -> Task 6 Timing + Shards
  -> Task 7 Deletion Authorization
  -> Task 8 Execution Lanes + Canonical Package
  -> Task 9 CI/Release Direct Hard Cut
  -> Task 10 Fresh Baseline + Core Freeze
  -> Task 11 Physical Portfolio Reduction
  -> Task 12 Final Acceptance
```

Tasks 3 and 4 may be implemented in parallel only after Task 2 is merged and their file ownership remains disjoint. Tasks 6 and 7 may be implemented in parallel only after Task 5 freezes the manifest and evidence contracts. Workflow, root scripts, Vitest root configuration, package scripts, release surfaces, and shared policy remain serial ownership points.

Task 9 changes the workflow source locally, but the branch must not be pushed until Tasks 10 and 11 pass and Task 12 local preflight authorizes the representative integration-branch runs.

### Task 1: Extract a side-effect-free Audit Facts API and tracked policy authority

**Files:**
- Create: `tools/test-portfolio-audit/facts.cjs`
- Create: `tools/ci/canonical-artifact.cjs`
- Create: `tools/ci/test-policy.cjs`
- Create: `repo-governance/ci/test-policy.json`
- Create: `tests/acceptance/test-portfolio-audit-facts.test.ts`
- Create: `tests/acceptance/ci-test-policy.test.ts`
- Modify: `tools/test-portfolio-audit/run.cjs`
- Modify: `tools/test-portfolio-audit/discovery.cjs`
- Modify: `tests/acceptance/test-portfolio-audit-discovery.test.ts`

- [ ] **Step 1: Write failing tests for no-write facts collection and complete binding preservation**

Create `tests/acceptance/test-portfolio-audit-facts.test.ts` with direct assertions against the existing criticality fixture:

```ts
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { collectAuditFacts } = require('../../tools/test-portfolio-audit/facts.cjs');
const { reduceAudit } = require('../../tools/test-portfolio-audit/audit.cjs');

const FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/criticality');

describe('test portfolio audit facts', () => {
  it('collects complete facts without creating report artifacts', async () => {
    const facts = await collectAuditFacts({
      repoRoot: FIXTURE,
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings: {},
    });

    expect(existsSync(join(FIXTURE, '.artifacts'))).toBe(false);
    expect(facts.schemaVersion).toBe('test-portfolio-audit-facts/v1');
    expect(facts.discovery.complete).toBe(true);

    const criticality = facts.analyzerResults.find(
      (result: { dimension: string }) => result.dimension === 'criticality'
    );
    const installFinding = criticality.findings.find(
      (finding: { identityKey: string }) =>
        finding.identityKey === 'root-vitest::tests/package-install.test.ts'
    );

    expect(installFinding.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'package_install' }),
        expect.objectContaining({ kind: 'consumer_compatibility' }),
      ])
    );
  });

  it('feeds the existing reducer without changing Phase 1 report semantics', async () => {
    const facts = await collectAuditFacts({
      repoRoot: FIXTURE,
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings: {},
    });
    const reduced = reduceAudit(facts);

    expect(reduced.artifact.status).toBe('COMPLETE');
    expect(reduced.artifact.tests.length).toBe(facts.inventory.tests.length);
    expect(reduced.artifact.tests[0]).not.toHaveProperty('bindings');
  });
});
```

- [ ] **Step 2: Run the new facts test and verify the missing API failure**

Run:

```powershell
npm exec -- vitest run tests/acceptance/test-portfolio-audit-facts.test.ts
```

Expected: FAIL because `tools/test-portfolio-audit/facts.cjs` or `collectAuditFacts` does not exist. The failure must occur before any `.artifacts` directory is created inside the fixture.

- [ ] **Step 3: Move fact collection out of `run.cjs` without changing analyzer behavior**

Move the repository-reading and analyzer orchestration helpers from `tools/test-portfolio-audit/run.cjs` into `tools/test-portfolio-audit/facts.cjs`. Keep CLI parsing, report rendering, report writes, run receipt construction, and `main()` in `run.cjs`.

The new public API must have this exact boundary:

```js
'use strict';

const { performance } = require('node:perf_hooks');

async function collectAuditFacts(options) {
  const startedAt = performance.now();
  const timings = options.timings || {};

  const repository = readRepositoryIdentity(options.repoRoot);
  const discoveryRun = discoverConfiguredTests({ repoRoot: options.repoRoot });
  const filesystemCandidates = normalizeFilesystemCandidates(
    options.repoRoot,
    scanFilesystemCandidates({ repoRoot: options.repoRoot })
  );
  const runnerResults = expandRunnerExclusions(discoveryRun.runnerResults, filesystemCandidates);
  const preliminaryInventory = buildCanonicalInventory(runnerResults, { routes: [] });
  const routeGraph = discoveryRun.failed
    ? { routes: [], invocations: [], issues: [], failed: true }
    : safeRouteGraph(options.repoRoot, preliminaryInventory.tests);
  const configuredCandidateRefs = [
    ...runnerResults.flatMap((result) => result.configuredCandidateRefs || []),
    ...extractConfiguredCandidateRefs(routeGraph).filter((reference) =>
      fs.existsSync(path.resolve(options.repoRoot, reference.testPath))
    ),
  ];
  const discovery = attachDiscoveryCounts(
    reconcileDiscovery({ runnerResults, filesystemCandidates, configuredCandidateRefs })
  );
  const inventory = buildCanonicalInventory(runnerResults, routeGraph);
  const sourceIndexResult = safeSourceIndex(
    options.repoRoot,
    discoveryRun.packagePaths,
    discoveryRun.criticalAuthorityPackagePaths
  );

  let analyzerResults;
  try {
    analyzerResults = await runAnalyzersIndependently({
      repoRoot: options.repoRoot,
      inventory,
      routeGraph,
      sourceIndex: sourceIndexResult.sourceIndex,
      timings,
    });
  } finally {
    if (sourceIndexResult.analysisRoot) {
      fs.rmSync(sourceIndexResult.analysisRoot, { recursive: true, force: true });
    }
  }

  const staticFinishedAt = performance.now();
  const probeResults = await runOptionalProbe({
    options,
    repository,
    inventory,
    analyzerResults,
  });
  const finishedAt = performance.now();
  const setupIssues = [...sourceIndexResult.issues, ...(routeGraph.issues || [])];

  return {
    schemaVersion: 'test-portfolio-audit-facts/v1',
    repository,
    tool: toolMetadata(runnerResults),
    inventory,
    routeGraph,
    discovery: {
      ...discovery,
      issues: [
        ...runnerResults.flatMap((result) => result.issues || []),
        ...reconciliationIssues(discovery),
      ],
    },
    sourceIndex: sourceIndexResult.sourceIndex,
    analyzerResults,
    probeResults,
    timings,
    issues: collectIssues({
      discoveryRun,
      discovery,
      analyzerResults,
      setupIssues,
    }),
    fatalIssues: [
      ...(discoveryRun.issues || []).filter((entry) => entry.severity === 'fatal'),
      ...(routeGraph.issues || []).filter((entry) => entry.severity === 'fatal'),
    ],
    durations: {
      staticAnalysisMs: duration(staticFinishedAt - startedAt),
      probeMs: duration(finishedAt - staticFinishedAt),
      totalMs: duration(finishedAt - startedAt),
    },
  };
}

module.exports = {
  collectAuditFacts,
  selectCriticalAuthorityPackagePaths,
};
```

Pass `timings` through `runAnalyzersIndependently()` to every analyzer input. Do not write files from this module. Temporary TypeScript analysis directories may still be created and removed in `finally`.

Replace the body of `runAudit()` with:

```js
async function runAudit(options) {
  const facts = await collectAuditFacts(options);
  const reduced = reduceAudit(facts);
  const summaryMarkdown = renderSummary(reduced.artifact);
  const writes = writeAuditArtifacts({
    outputDir: options.outputDir,
    canonicalBytes: reduced.canonicalBytes,
    summaryMarkdown,
  });
  return {
    ...reduced,
    ...writes,
    receipt: buildRunReceipt({
      reduced,
      writes,
      probeResults: facts.probeResults,
      staticDurationMs: facts.durations.staticAnalysisMs,
      probeDurationMs: facts.durations.probeMs,
      totalDurationMs: facts.durations.totalMs,
    }),
  };
}
```

Import `collectAuditFacts` and `selectCriticalAuthorityPackagePaths` from `facts.cjs`. Preserve the existing `run.cjs` exports for callers that already import `selectCriticalAuthorityPackagePaths`.

- [ ] **Step 4: Replace the unexplained Node runner source hash with a declared adapter contract**

In `tools/test-portfolio-audit/discovery.cjs`, replace the fixed source-file SHA authority with a contract object whose version is declared by the runner wrapper:

```js
const NODE_RUNNER_ADAPTER = Object.freeze({
  runnerId: 'package-node-test',
  scriptPath: 'packages/bmad-speckit/scripts/run-node-tests.cjs',
  testsRoot: 'packages/bmad-speckit/tests',
  suffix: '.test.js',
  contractVersion: 'node-runner-discovery/v1',
});
```

Make `discoverNodeTests()` read an exported `DISCOVERY_CONTRACT_VERSION` from the adapter with `require(script)`. Return `NODE_RUNNER_CONVENTION_DRIFT` when the export is missing or differs from `contractVersion`; do not couple discovery to unrelated implementation bytes.

Add this export to `packages/bmad-speckit/scripts/run-node-tests.cjs` only after confirming the concurrent owner has finished or explicitly handed off the file:

```js
module.exports.DISCOVERY_CONTRACT_VERSION = 'node-runner-discovery/v1';
```

If that file is still concurrently modified when implementation begins, stop this step and resolve ownership before editing. Do not overwrite the other session's changes.

Update the discovery acceptance test to mutate the exported contract version and expect `NODE_RUNNER_CONVENTION_DRIFT`; remove the frozen SHA constant.

- [ ] **Step 5: Run Phase 1 parity tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/test-portfolio-audit-facts.test.ts tests/acceptance/test-portfolio-audit-discovery.test.ts tests/acceptance/test-portfolio-audit-cli.test.ts tests/acceptance/test-portfolio-audit-analyzers.test.ts
```

Expected: PASS. Existing Phase 1 audit JSON and summary tests must remain byte-stable for equivalent inputs; the only new authority is the complete in-memory facts API.

- [ ] **Step 6: Write failing policy validation tests**

Create `tests/acceptance/ci-test-policy.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  analyzePolicyExceptions,
  validateTestPolicy,
} = require('../../tools/ci/test-policy.cjs');

const basePolicy = {
  schemaVersion: 'test-portfolio-policy/v1',
  budgets: {
    executableTestCount: 480,
    corePermanentCount: 120,
    prP95Minutes: 10,
  },
  profiles: ['pr-fast', 'pr-full', 'nightly-deep', 'release-verify'],
  protectedCapabilities: [
    {
      capabilityId: 'six-model-state-machine',
      selectionRefs: ['script:test:ci:codex'],
    },
  ],
  classification: {
    directoryRules: [
      { ruleId: 'acceptance', pattern: 'tests/acceptance/**', state: 'retained_on_demand' },
    ],
    exceptions: [],
  },
  selection: {
    expansionOrder: ['trace_capability', 'feature', 'package'],
    highDiffusionPathRules: ['packages/bmad-speckit/src/utils/main-agent/**'],
  },
  timing: {
    unknownDurationMs: 60000,
    maxShardDurationMs: 480000,
    maxShardsPerLane: 8,
  },
  deletion: {
    deterministicReasonCodes: [
      'EXACT_DUPLICATE',
      'TARGET_REMOVED',
      'SELF_PROVING_ORACLE',
      'REPLACED_BY_CONTRACT_TEST',
    ],
    localReview: { maxCandidates: 30, maxCalls: 1, retries: 0 },
  },
};

const policyWithThreeEquivalentDirectoryOverrides = structuredClone(basePolicy);
for (const name of ['linux', 'macos', 'windows']) {
  policyWithThreeEquivalentDirectoryOverrides.classification.exceptions.push({
    testPath: `tests/compatibility/${name}.test.ts`,
    state: 'deletion_candidate',
  });
}

describe('test portfolio policy', () => {
  it('accepts the four profiles and hard budgets', () => {
    expect(validateTestPolicy(basePolicy)).toEqual(basePolicy);
  });

  it('fails closed on equal-specificity classification conflict', () => {
    const conflicting = structuredClone(basePolicy);
    conflicting.classification.directoryRules.push({
      ruleId: 'acceptance-conflict',
      pattern: 'tests/acceptance/**',
      state: 'deletion_candidate',
    });
    expect(() => validateTestPolicy(conflicting)).toThrow('POLICY_CLASSIFICATION_CONFLICT');
  });

  it('rejects a redundant full-record exception', () => {
    const redundant = structuredClone(basePolicy);
    redundant.classification.exceptions.push({
      testPath: 'tests/acceptance/example.test.ts',
      state: 'retained_on_demand',
    });
    expect(() => validateTestPolicy(redundant)).toThrow('POLICY_EXCEPTION_REDUNDANT');
  });

  it('reports repeated override shapes as directory-rule promotion candidates', () => {
    const diagnostics = analyzePolicyExceptions({
      policy: policyWithThreeEquivalentDirectoryOverrides,
      baselineExceptionCount: 0,
    });
    expect(diagnostics.directoryRulePromotionCandidates).toEqual([
      expect.objectContaining({ directory: 'tests/compatibility' }),
    ]);
    expect(diagnostics.exceptionCountDelta).toBe(3);
    expect(diagnostics.redundantExceptionCount).toBe(0);
  });
});
```

- [ ] **Step 7: Run the policy test and verify the missing module failure**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-policy.test.ts
```

Expected: FAIL because `tools/ci/test-policy.cjs` does not exist.

- [ ] **Step 8: Implement deterministic policy parsing and commit the initial root policy**

Implement these exports in `tools/ci/test-policy.cjs`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STATES = Object.freeze([
  'core_permanent',
  'feature_working_set',
  'retained_on_demand',
  'deletion_candidate',
]);
const PROFILES = Object.freeze(['pr-fast', 'pr-full', 'nightly-deep', 'release-verify']);

function readTestPolicy(repoRoot, policyPath = 'repo-governance/ci/test-policy.json') {
  const absolutePath = path.resolve(repoRoot, policyPath);
  return validateTestPolicy(JSON.parse(fs.readFileSync(absolutePath, 'utf8')));
}

function validateTestPolicy(policy) {
  requireExactProfiles(policy.profiles, PROFILES);
  requireBudget(policy.budgets?.executableTestCount, 480, 'POLICY_EXECUTABLE_BUDGET_INVALID');
  requireBudget(policy.budgets?.corePermanentCount, 120, 'POLICY_CORE_BUDGET_INVALID');
  requireBudget(policy.budgets?.prP95Minutes, 10, 'POLICY_PR_TIME_BUDGET_INVALID');
  validateProtectedCapabilities(policy.protectedCapabilities);
  validateClassification(policy.classification, STATES);
  validateSelection(policy.selection);
  validateTiming(policy.timing);
  validateDeletion(policy.deletion);
  return policy;
}

module.exports = {
  PROFILES,
  STATES,
  analyzePolicyExceptions,
  readTestPolicy,
  validateTestPolicy,
};
```

Create `tools/ci/canonical-artifact.cjs` and use it from every `tools/ci` writer:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../test-portfolio-audit/canonical.cjs');

function fail(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  throw error;
}

function assertGovernedPath(repoRoot, targetPath) {
  const allowedRoot = path.join(path.resolve(repoRoot), '.artifacts', 'test-portfolio');
  const target = path.resolve(targetPath);
  if (!target.startsWith(`${allowedRoot}${path.sep}`)) {
    fail('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT', { target });
  }
  return target;
}

function writeCanonicalArtifact({ repoRoot, outputDir, fileName, artifact }) {
  const target = assertGovernedPath(repoRoot, path.resolve(outputDir, fileName));
  const bytes = canonicalJsonBytes(artifact);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, target);
  return { path: target, sha256: sha256Bytes(bytes), bytes: bytes.length };
}

function readCanonicalArtifact({ repoRoot, filePath }) {
  const target = assertGovernedPath(repoRoot, filePath);
  const bytes = fs.readFileSync(target);
  const artifact = JSON.parse(bytes.toString('utf8'));
  const canonical = canonicalJsonBytes(artifact);
  if (!bytes.equals(canonical)) fail('CI_ARTIFACT_NOT_CANONICAL', { target });
  return { artifact, sha256: sha256Bytes(bytes) };
}

module.exports = {
  compareText: (left, right) => String(left).localeCompare(String(right), 'en'),
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
};
```

The helper validators must:

- sort rules by path-segment specificity, never JSON array order;
- reject equal-specificity rules that produce different fields;
- allow exceptions to override only explicitly present fields;
- reject an exception when its fields equal the resolved directory rule;
- report repeated same-directory override shapes as `directoryRulePromotionCandidates`;
- expose `exceptionCount`, `exceptionCountDelta`, and `redundantExceptionCount`;
- reject unknown state, profile, reason code, or expansion level;
- require the exact hard budgets rather than allowing a looser value.

Create `repo-governance/ci/test-policy.json` with the seven existing explicit `package.json#testPortfolioAudit.criticalBindings` represented as protected capability selection refs, the four approved profiles, the hard budgets, directory rules that cover every configured test root, bounded sharding defaults, and the approved deterministic deletion reason codes. Do not copy the generated Test Catalog into this file.

- [ ] **Step 9: Run policy and facts validation**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-policy.test.ts tests/acceptance/test-portfolio-audit-facts.test.ts tests/acceptance/test-portfolio-audit-discovery.test.ts tests/acceptance/test-portfolio-audit-cli.test.ts
```

Expected: PASS with no generated file outside test-owned temporary directories.

- [ ] **Step 10: Commit Task 1**

```powershell
git add tools/test-portfolio-audit/facts.cjs tools/test-portfolio-audit/run.cjs tools/test-portfolio-audit/discovery.cjs tools/ci/canonical-artifact.cjs tools/ci/test-policy.cjs repo-governance/ci/test-policy.json tests/acceptance/test-portfolio-audit-facts.test.ts tests/acceptance/test-portfolio-audit-discovery.test.ts tests/acceptance/ci-test-policy.test.ts packages/bmad-speckit/scripts/run-node-tests.cjs
git commit -m "refactor(ci): 提取审计事实并建立测试策略"
```

Before `git add`, omit `packages/bmad-speckit/scripts/run-node-tests.cjs` if ownership was not resolved; Task 1 cannot close until the adapter contract is integrated without discarding concurrent changes.

### Task 2: Generate the canonical four-state Test Catalog

**Files:**
- Create: `tools/ci/generate-test-catalog.cjs`
- Create: `tests/acceptance/ci-generated-test-catalog.test.ts`
- Create: `tests/fixtures/test-portfolio/catalog-policy.json`
- Create: `tests/fixtures/test-portfolio/catalog-facts.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing Catalog projection and reconciliation tests**

Create fixture facts with one protected core test, one changed test, one ordinary on-demand test, and one proven duplicate. Create a fixture policy with directory rules and an explicit protected capability.

Create `tests/acceptance/ci-generated-test-catalog.test.ts`:

```ts
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { canonicalJsonBytes, sha256Bytes } = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  projectTestCatalog,
  validateTestCatalog,
} = require('../../tools/ci/generate-test-catalog.cjs');

const FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio');
const facts = JSON.parse(readFileSync(join(FIXTURE, 'catalog-facts.json'), 'utf8'));
const policy = JSON.parse(readFileSync(join(FIXTURE, 'catalog-policy.json'), 'utf8'));

describe('canonical Test Catalog', () => {
  it('assigns exactly one lifecycle state by authority precedence', () => {
    const catalog = projectTestCatalog({
      facts,
      policy,
      changedPaths: ['tests/feature/new-behavior.test.ts'],
    });
    expect(
      Object.fromEntries(catalog.tests.map((test: any) => [test.testPath, test.lifecycleState]))
    ).toEqual({
      'tests/core/state-machine.test.ts': 'core_permanent',
      'tests/feature/new-behavior.test.ts': 'feature_working_set',
      'tests/on-demand/platform.test.ts': 'retained_on_demand',
      'tests/redundant/duplicate.test.ts': 'deletion_candidate',
    });
  });

  it('fails on runner-only, unexplained candidate-only, duplicate identity, or unclassified test', () => {
    for (const issueCode of [
      'CATALOG_RUNNER_ONLY',
      'CATALOG_CANDIDATE_ONLY',
      'CATALOG_IDENTITY_DUPLICATE',
      'CATALOG_TEST_UNCLASSIFIED',
    ]) {
      expect(() => validateTestCatalog({ ...facts.invalidCatalogs[issueCode] })).toThrow(issueCode);
    }
  });

  it('produces stable canonical bytes independent of input order', () => {
    const first = projectTestCatalog({ facts, policy, changedPaths: [] });
    const second = projectTestCatalog({
      facts: { ...facts, inventory: { tests: [...facts.inventory.tests].reverse() } },
      policy,
      changedPaths: [],
    });
    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(sha256Bytes(canonicalJsonBytes(first))).toBe(sha256Bytes(canonicalJsonBytes(second)));
  });
});
```

- [ ] **Step 2: Run the Catalog test and verify the missing projector failure**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-generated-test-catalog.test.ts
```

Expected: FAIL because `projectTestCatalog()` does not exist.

- [ ] **Step 3: Implement the Catalog projection from complete facts**

Implement this public contract in `tools/ci/generate-test-catalog.cjs`:

```js
function projectTestCatalog({ facts, policy, changedPaths = [], featureBindings = {} }) {
  const criticalBindings = indexCriticalBindings(facts.analyzerResults);
  const classifications = indexAnalyzerFindings(facts.analyzerResults);
  const changed = new Set(changedPaths.map(normalizeRelativePath));

  const tests = facts.inventory.tests.map((identity) => {
    const binding = resolvePolicyBinding(identity, policy, criticalBindings);
    const lifecycleState = resolveLifecycleState({
      identity,
      binding,
      classification: classifications.get(identity.identityKey),
      changed,
      featureBindings,
      policy,
    });
    return {
      identityKey: identity.identityKey,
      runnerId: identity.runnerId,
      testPath: identity.testPath,
      executableIdentity: identity.executableIdentity || identity.identityKey,
      packageId: binding.packageId,
      capabilityRefs: binding.capabilityRefs,
      traceRefs: binding.traceRefs,
      featureRefs: binding.featureRefs,
      fixtureRefs: binding.fixtureRefs,
      lifecycleState,
      releaseGateMembership: binding.releaseGateMembership,
      durationSummary: binding.durationSummary,
      classifications: binding.classifications,
      evidenceRefs: binding.evidenceRefs,
    };
  });

  const catalog = {
    schemaVersion: 'test-catalog/v1',
    repository: facts.repository,
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
    tests: tests.sort(compareTestIdentity),
    gates: calculateCatalogGates(facts, tests, policy),
  };
  validateTestCatalog(catalog);
  return catalog;
}
```

Lifecycle precedence must be:

```text
explicit protected capability binding -> core_permanent
added or modified test / active feature binding -> feature_working_set
approved deterministic candidate evidence -> deletion_candidate
most-specific directory rule or explicit field exception -> retained_on_demand or deletion_candidate
no resolution -> CATALOG_TEST_UNCLASSIFIED
```

`releaseGateMembership` remains an independent field and never promotes lifecycle state. `indexCriticalBindings()` must read the complete `criticality` analyzer finding bindings from `facts.analyzerResults`, not the reduced audit rows.

Expose:

```js
module.exports = {
  projectTestCatalog,
  validateTestCatalog,
  writeTestCatalog,
};
```

`writeTestCatalog()` writes canonical UTF-8 bytes atomically to `.artifacts/test-portfolio/test-catalog.json` and returns `{ path, sha256, testCount }`. It must not write to `.artifacts/ci`.

- [ ] **Step 4: Enforce all Catalog hard gates**

`validateTestCatalog()` must reject non-zero:

```text
catalogIdentityDuplicateCount
unexplainedRunnerOnlyCount
unexplainedCandidateOnlyCount
unclassifiedTestCount
protectedCapabilityWithoutCoreTestCount
```

It must also reject:

- more than one lifecycle state on a test;
- an unknown lifecycle state;
- a `core_permanent` test without an explicit protected capability ref;
- `feature_working_set` without an active feature/change reason;
- a generated path outside `.artifacts/test-portfolio/`;
- `tests.length > 480` only at final migration acceptance, not while Task 2 is establishing the truthful pre-reduction baseline.

Represent the temporary count state explicitly as `gates.executableBudgetStatus: 'over_budget'`; do not hide or truncate identities.

- [ ] **Step 5: Ignore only the generated governance directory**

Add this exact entry to `.gitignore`:

```gitignore
/.artifacts/test-portfolio/
```

Do not ignore tracked policy, fixtures, acceptance tests, or deletion authorization intended for review.

- [ ] **Step 6: Run Catalog and Phase 1 regression tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-test-policy.test.ts tests/acceptance/test-portfolio-audit-facts.test.ts tests/acceptance/test-portfolio-audit-canonical.test.ts
```

Expected: PASS. The fixture Catalog must have four tests, one per lifecycle state, zero reconciliation errors, and stable canonical bytes across reversed input order.

- [ ] **Step 7: Commit Task 2**

```powershell
git add .gitignore tools/ci/generate-test-catalog.cjs tests/acceptance/ci-generated-test-catalog.test.ts tests/fixtures/test-portfolio/catalog-policy.json tests/fixtures/test-portfolio/catalog-facts.json
git commit -m "feat(ci): 生成四态测试目录"
```

### Task 3: Enforce Feature Closeout and permanent-core budgets

**Files:**
- Create: `tools/ci/feature-closeout.cjs`
- Create: `tests/acceptance/ci-feature-closeout.test.ts`
- Create: `tests/fixtures/test-portfolio/feature-closeout.json`
- Modify: `tools/ci/generate-test-catalog.cjs`
- Modify: `repo-governance/ci/test-policy.json`

- [ ] **Step 1: Write failing state-transition and core-protection tests**

Create `tests/acceptance/ci-feature-closeout.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { closeFeaturePortfolio } = require('../../tools/ci/feature-closeout.cjs');

function catalog(states: Record<string, string>) {
  return {
    schemaVersion: 'test-catalog/v1',
    tests: Object.entries(states).map(([identityKey, lifecycleState]) => ({
      identityKey,
      testPath: identityKey.split('::')[1],
      runnerId: identityKey.split('::')[0],
      lifecycleState,
      capabilityRefs: [],
      featureRefs: ['feature:test-selection'],
    })),
  };
}

describe('Feature Closeout', () => {
  it('requires a disposition for every feature working-set test', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({
          'vitest::tests/a.test.ts': 'feature_working_set',
          'vitest::tests/b.test.ts': 'feature_working_set',
        }),
        policy: { budgets: { corePermanentCount: 120 }, protectedCapabilities: [] },
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/a.test.ts': { action: 'retain_on_demand' },
        },
      })
    ).toThrow('FEATURE_CLOSEOUT_DISPOSITION_MISSING');
  });

  it('rejects ordinary deletion or downgrade of permanent core tests', () => {
    expect(() =>
      closeFeaturePortfolio({
        catalog: catalog({ 'vitest::tests/core.test.ts': 'core_permanent' }),
        policy: { budgets: { corePermanentCount: 120 }, protectedCapabilities: [] },
        featureRef: 'feature:test-selection',
        dispositions: {
          'vitest::tests/core.test.ts': { action: 'delete_after_closeout' },
        },
      })
    ).toThrow('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW');
  });

  it('promotes only an explicitly protected capability and keeps the core budget', () => {
    const result = closeFeaturePortfolio({
      catalog: catalog({ 'vitest::tests/state-machine.test.ts': 'feature_working_set' }),
      policy: {
        budgets: { corePermanentCount: 120 },
        protectedCapabilities: [
          { capabilityId: 'six-model-state-machine', selectionRefs: [] },
        ],
      },
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/state-machine.test.ts': {
          action: 'promote_to_core',
          capabilityRef: 'six-model-state-machine',
        },
      },
    });

    expect(result.updatedTests[0].lifecycleState).toBe('core_permanent');
    expect(result.gates.unclosedFeatureWorkingTestCount).toBe(0);
    expect(result.gates.corePermanentCount).toBeLessThanOrEqual(120);
  });
});
```

- [ ] **Step 2: Run the closeout test and verify the missing module failure**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-feature-closeout.test.ts
```

Expected: FAIL because `closeFeaturePortfolio()` does not exist.

- [ ] **Step 3: Implement the four closeout dispositions**

Implement this contract:

```js
const ACTIONS = new Set([
  'promote_to_core',
  'merge_to_contract_test',
  'retain_on_demand',
  'delete_after_closeout',
]);

function closeFeaturePortfolio({ catalog, policy, featureRef, dispositions }) {
  const working = catalog.tests.filter(
    (test) =>
      test.lifecycleState === 'feature_working_set' &&
      (test.featureRefs || []).includes(featureRef)
  );
  const missing = working.filter((test) => !dispositions[test.identityKey]);
  if (missing.length > 0) fail('FEATURE_CLOSEOUT_DISPOSITION_MISSING', missing);

  const updatedTests = catalog.tests.map((test) => {
    const disposition = dispositions[test.identityKey];
    if (!disposition) return test;
    if (test.lifecycleState === 'core_permanent') {
      fail('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW', [test.identityKey]);
    }
    if (!ACTIONS.has(disposition.action)) fail('FEATURE_CLOSEOUT_ACTION_INVALID');
    return applyDisposition({ test, disposition, catalog, policy });
  });

  const gates = {
    unclosedFeatureWorkingTestCount: updatedTests.filter(
      (test) =>
        test.lifecycleState === 'feature_working_set' &&
        (test.featureRefs || []).includes(featureRef)
    ).length,
    corePermanentCount: updatedTests.filter(
      (test) => test.lifecycleState === 'core_permanent'
    ).length,
  };
  if (gates.unclosedFeatureWorkingTestCount !== 0) fail('FEATURE_CLOSEOUT_INCOMPLETE');
  if (gates.corePermanentCount > policy.budgets.corePermanentCount) {
    fail('CORE_PERMANENT_BUDGET_EXCEEDED');
  }
  return { featureRef, updatedTests, policyPatch: buildPolicyPatch(updatedTests), gates };
}
```

Disposition rules:

- `promote_to_core`: require an existing `protectedCapabilities[].capabilityId`, an independent oracle classification, and no equivalent core replacement.
- `merge_to_contract_test`: require `replacementIdentityKey`, prove equal-or-higher capability refs, and move originals to `deletion_candidate`.
- `retain_on_demand`: move the test to `retained_on_demand` without adding a redundant per-test exception when a directory rule already produces that state.
- `delete_after_closeout`: move the test to `deletion_candidate`; physical deletion remains Task 7.

Do not add a fifth lifecycle state or a time-based expiry field. Return a minimal policy patch only when core bindings or necessary field exceptions change.

- [ ] **Step 4: Add independent replacement-conservation tests**

Extend the same test file with:

```ts
it('rejects contract-test consolidation that loses a capability or independent failure mode', () => {
  expect(() =>
    closeFeaturePortfolio({
      catalog: {
        schemaVersion: 'test-catalog/v1',
        tests: [
          {
            identityKey: 'vitest::tests/old-a.test.ts',
            lifecycleState: 'feature_working_set',
            featureRefs: ['feature:test-selection'],
            capabilityRefs: ['capability:a'],
            failureModeRefs: ['negative:a'],
          },
          {
            identityKey: 'vitest::tests/replacement.test.ts',
            lifecycleState: 'feature_working_set',
            featureRefs: ['feature:test-selection'],
            capabilityRefs: [],
            failureModeRefs: [],
          },
        ],
      },
      policy: { budgets: { corePermanentCount: 120 }, protectedCapabilities: [] },
      featureRef: 'feature:test-selection',
      dispositions: {
        'vitest::tests/old-a.test.ts': {
          action: 'merge_to_contract_test',
          replacementIdentityKey: 'vitest::tests/replacement.test.ts',
        },
        'vitest::tests/replacement.test.ts': { action: 'retain_on_demand' },
      },
    })
  ).toThrow('CONTRACT_TEST_COVERAGE_NOT_CONSERVED');
});
```

The implementation must compare `capabilityRefs` and `failureModeRefs`; a green replacement test alone is insufficient evidence.

- [ ] **Step 5: Run closeout and Catalog tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-feature-closeout.test.ts tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-test-policy.test.ts
```

Expected: PASS with `unclosedFeatureWorkingTestCount = 0` for complete closeout and explicit failure for every incomplete or unsafe transition.

- [ ] **Step 6: Commit Task 3**

```powershell
git add tools/ci/feature-closeout.cjs tools/ci/generate-test-catalog.cjs repo-governance/ci/test-policy.json tests/acceptance/ci-feature-closeout.test.ts tests/fixtures/test-portfolio/feature-closeout.json
git commit -m "feat(ci): 强制功能关闭时收敛测试组合"
```

### Task 4: Implement trace-governed selection and fail-closed profile escalation

**Files:**
- Create: `tools/ci/select-ci-tests.cjs`
- Create: `tests/acceptance/ci-test-selection.test.ts`
- Create: `tests/acceptance/ci-profile-selection-fail-closed.test.ts`
- Create: `tests/fixtures/test-portfolio/selection-input.json`
- Modify: `tools/ci/generate-test-catalog.cjs`
- Modify: `repo-governance/ci/test-policy.json`

- [ ] **Step 1: Write failing exact, Feature, Package, and blocked-selection tests**

Create `tests/acceptance/ci-test-selection.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { selectCiTests } = require('../../tools/ci/select-ci-tests.cjs');

const catalog = {
  schemaVersion: 'test-catalog/v1',
  tests: [
    {
      identityKey: 'vitest::tests/core.test.ts',
      lifecycleState: 'core_permanent',
      capabilityRefs: ['capability:state-machine'],
      featureRefs: [],
      packageId: 'root',
    },
    {
      identityKey: 'vitest::tests/exact.test.ts',
      lifecycleState: 'feature_working_set',
      traceRefs: ['trace:selector'],
      capabilityRefs: ['capability:selector'],
      featureRefs: ['feature:portfolio'],
      packageId: 'root',
    },
    {
      identityKey: 'vitest::tests/feature.test.ts',
      lifecycleState: 'retained_on_demand',
      traceRefs: [],
      capabilityRefs: [],
      featureRefs: ['feature:portfolio'],
      packageId: 'root',
    },
    {
      identityKey: 'node::packages/p/tests/package.test.js',
      lifecycleState: 'retained_on_demand',
      traceRefs: [],
      capabilityRefs: [],
      featureRefs: [],
      packageId: '@bmad-speckit/p',
    },
  ],
};

it('always includes core and stops at the first complete impact boundary', () => {
  const selection = selectCiTests({
    catalog,
    policy: {
      selection: { expansionOrder: ['trace_capability', 'feature', 'package'] },
      profiles: ['pr-fast', 'pr-full', 'nightly-deep', 'release-verify'],
    },
    impact: {
      changedTestIdentityKeys: ['vitest::tests/exact.test.ts'],
      traceRefs: ['trace:selector'],
      capabilityRefs: ['capability:selector'],
      featureRefs: ['feature:portfolio'],
      packageIds: ['root'],
      unresolvedRefs: [],
    },
    requestedProfile: 'pr-fast',
  });

  expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
    'vitest::tests/core.test.ts',
    'vitest::tests/exact.test.ts',
  ]);
  expect(selection.expansionLevel).toBe('trace_capability');
});

it('expands Trace or Capability to Feature, then Package, and otherwise blocks', () => {
  const featureSelection = selectCiTests({
    catalog,
    policy: { selection: { expansionOrder: ['trace_capability', 'feature', 'package'] } },
    impact: {
      changedTestIdentityKeys: [],
      traceRefs: [],
      capabilityRefs: [],
      featureRefs: ['feature:portfolio'],
      packageIds: ['root'],
      unresolvedRefs: [],
    },
    requestedProfile: 'pr-fast',
  });
  expect(featureSelection.expansionLevel).toBe('feature');

  expect(() =>
    selectCiTests({
      catalog,
      policy: { selection: { expansionOrder: ['trace_capability', 'feature', 'package'] } },
      impact: {
        changedTestIdentityKeys: [],
        traceRefs: [],
        capabilityRefs: [],
        featureRefs: [],
        packageIds: [],
        unresolvedRefs: ['src/unknown.ts'],
      },
      requestedProfile: 'pr-fast',
    })
  ).toThrow('IMPACT_BINDING_UNRESOLVED');
});
```

- [ ] **Step 2: Write failing profile-escalation safety tests**

Create `tests/acceptance/ci-profile-selection-fail-closed.test.ts` and assert:

```ts
expect(
  selectCiTests({
    catalog,
    policy,
    impact: { changedPaths: ['packages/bmad-speckit/src/utils/main-agent/state.ts'] },
    requestedProfile: 'pr-fast',
  }).profile
).toBe('pr-full');

expect(() =>
  selectCiTests({
    catalog,
    policy,
    impact: { changedPaths: ['unknown-runner.config.ts'] },
    requestedProfile: 'pr-fast',
  })
).toThrow('PROFILE_SELECTION_UNRESOLVED');

expect(() =>
  selectCiTests({
    catalog,
    policy,
    impact: { changedPaths: [] },
    requestedProfile: 'contributor-skip',
  })
).toThrow('PROFILE_UNKNOWN');
```

PR labels, environment variables, generated summaries, and contributor-provided matrix values must not lower a policy-selected profile.

- [ ] **Step 3: Run the tests and verify the missing selector failure**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-selection.test.ts tests/acceptance/ci-profile-selection-fail-closed.test.ts
```

Expected: FAIL because `selectCiTests()` does not exist.

- [ ] **Step 4: Implement bounded impact selection**

Implement:

```js
function selectCiTests({ catalog, policy, impact, requestedProfile }) {
  const profile = resolveProfile({ policy, impact, requestedProfile });
  const core = catalog.tests.filter((test) => test.lifecycleState === 'core_permanent');
  const changed = selectChangedTests(catalog.tests, impact.changedTestIdentityKeys || []);
  const exact = selectByTraceAndCapability(catalog.tests, impact);
  const boundary = resolveFirstCompleteBoundary({
    catalog,
    impact,
    exact,
    policy,
    profile,
  });
  const selected = stableSelection([...core, ...changed, ...boundary.tests]);
  const result = {
    schemaVersion: 'test-selection/v1',
    profile,
    requestedProfile,
    escalationReasonCodes: boundary.escalationReasonCodes,
    expansionLevel: boundary.expansionLevel,
    selected: selected.map((test) => ({
      identityKey: test.identityKey,
      runnerId: test.runnerId,
      testPath: test.testPath,
      reasonCodes: selectionReasons(test, { core, changed, boundary }),
    })),
    gates: calculateSelectionGates({ catalog, selected, impact }),
  };
  validateSelection(result);
  return result;
}
```

Selection contents by profile:

- `pr-fast`: all core, all added/modified tests, affected working-set tests, exact affected on-demand tests, and minimum Product Survival E2E.
- `pr-full`: `pr-fast` plus the complete affected Feature or Package boundary selected by policy.
- `nightly-deep`: all applicable on-demand, compatibility, flake-observation, and specialized tests, never deleted identities.
- `release-verify`: package, install, CLI, consumer runtime, persistence, security, encoding, and minimum Judge/Audit/Reverse Audit delivery continuation tests selected by explicit release capability binding.

Reject non-zero `selectionOmissionCount`, `selectionDuplicateCount`, or `unresolvedImpactBindingCount`. Never substitute all historical tests when boundary resolution fails.

- [ ] **Step 5: Write canonical Selection output**

Add:

```js
function writeSelection({ outputDir, selection }) {
  validateSelection(selection);
  return writeCanonicalArtifact({
    outputDir,
    fileName: 'test-selection.json',
    artifact: selection,
  });
}

module.exports = {
  selectCiTests,
  validateSelection,
  writeSelection,
};
```

The writer must accept only `.artifacts/test-portfolio/` descendants and return the path, SHA256, selected count, profile, and expansion level.

- [ ] **Step 6: Run selection, Catalog, and closeout regression tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-selection.test.ts tests/acceptance/ci-profile-selection-fail-closed.test.ts tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-feature-closeout.test.ts
```

Expected: PASS. Add an explicit assertion that unknown impact throws instead of returning the entire Catalog.

- [ ] **Step 7: Commit Task 4**

```powershell
git add tools/ci/select-ci-tests.cjs tools/ci/generate-test-catalog.cjs repo-governance/ci/test-policy.json tests/acceptance/ci-test-selection.test.ts tests/acceptance/ci-profile-selection-fail-closed.test.ts tests/fixtures/test-portfolio/selection-input.json
git commit -m "feat(ci): 实现追踪驱动的有界测试选择"
```

### Task 5: Create the single Run Manifest and fail-closed Evidence Join

**Files:**
- Create: `tools/ci/write-ci-run-manifest.cjs`
- Create: `tools/ci/join-ci-evidence.cjs`
- Create: `tests/acceptance/ci-run-manifest.test.ts`
- Create: `tests/acceptance/ci-evidence-join.test.ts`
- Create: `tests/fixtures/test-portfolio/run-manifest-input.json`

- [ ] **Step 1: Write failing Run Manifest tests**

Create `tests/acceptance/ci-run-manifest.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createRunManifestPlan,
  finalizeRunManifest,
} = require('../../tools/ci/write-ci-run-manifest.cjs');

const input = {
  repository: { commitSha: 'a'.repeat(40), dirty: false },
  profile: 'pr-fast',
  catalogHash: 'sha256:catalog',
  selectionHash: 'sha256:selection',
  shardPlanHash: 'sha256:shards',
  shards: [
    { lane: 'core', shardId: 'core-01', identityKeys: ['vitest::tests/core.test.ts'] },
    { lane: 'feature', shardId: 'feature-01', identityKeys: ['vitest::tests/a.test.ts'] },
  ],
};

it('emits a compact matrix and keeps full identities inside the manifest plan', () => {
  const manifest = createRunManifestPlan(input);
  expect(manifest.matrix).toEqual([
    { lane: 'core', shardId: 'core-01' },
    { lane: 'feature', shardId: 'feature-01' },
  ]);
  expect(manifest.plan.shards[0].identityKeys).toEqual(['vitest::tests/core.test.ts']);
  expect(manifest.status).toBe('planned');
});

it('finalizes the same authority rather than creating a second result manifest', () => {
  const planned = createRunManifestPlan(input);
  const completed = finalizeRunManifest(planned, {
    laneResults: [
      {
        lane: 'core',
        shardId: 'core-01',
        planHash: planned.planHash,
        outcome: 'passed',
        executedIdentityKeys: ['vitest::tests/core.test.ts'],
      },
      {
        lane: 'feature',
        shardId: 'feature-01',
        planHash: planned.planHash,
        outcome: 'passed',
        executedIdentityKeys: ['vitest::tests/a.test.ts'],
      },
    ],
  });
  expect(completed.status).toBe('complete');
  expect(completed.planHash).toBe(planned.planHash);
});
```

- [ ] **Step 2: Write failing Evidence Join mutation tests**

Create `tests/acceptance/ci-evidence-join.test.ts` with a valid fixture, then mutate one field at a time:

```ts
for (const outcome of ['failed', 'cancelled', 'skipped']) {
  expect(() =>
    joinCiEvidence({
      manifest,
      laneResults: [{ ...validLaneResult, outcome }],
    })
  ).toThrow('CI_REQUIRED_LANE_NOT_PASSED');
}

expect(() =>
  joinCiEvidence({
    manifest,
    laneResults: [{ ...validLaneResult, planHash: 'sha256:stale' }],
  })
).toThrow('CI_LANE_PLAN_HASH_MISMATCH');

expect(() =>
  joinCiEvidence({
    manifest,
    laneResults: [
      validLaneResult,
      { ...validLaneResult, shardId: 'duplicate', executedIdentityKeys: validLaneResult.executedIdentityKeys },
    ],
  })
).toThrow('CI_TEST_EXECUTED_MORE_THAN_ONCE');
```

Also cover a missing shard result, an unplanned identity, a selected identity executed zero times, and a required core identity absent from execution.

- [ ] **Step 3: Run the tests and verify the missing manifest APIs**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-run-manifest.test.ts tests/acceptance/ci-evidence-join.test.ts
```

Expected: FAIL because the manifest and join modules do not exist.

- [ ] **Step 4: Implement the immutable plan section and compact matrix**

Implement:

```js
function createRunManifestPlan(input) {
  const plan = {
    repository: input.repository,
    profile: input.profile,
    catalogHash: input.catalogHash,
    selectionHash: input.selectionHash,
    shardPlanHash: input.shardPlanHash,
    shards: [...input.shards]
      .map(normalizeShard)
      .sort((left, right) => compareText(left.shardId, right.shardId)),
  };
  const planHash = sha256Bytes(canonicalJsonBytes(plan));
  return {
    schemaVersion: 'ci-run-manifest/v1',
    status: 'planned',
    planHash,
    plan,
    matrix: plan.shards.map(({ lane, shardId }) => ({ lane, shardId })),
    results: [],
    gates: null,
  };
}
```

The matrix must never contain full path arrays. Lane jobs retrieve the Run Manifest artifact and resolve their exact identities by `{lane, shardId}`.

`writeRunManifest()` writes one canonical `.artifacts/test-portfolio/ci-run-manifest.json`. The planning job writes `status: planned`; Evidence Join replaces that same logical artifact with `status: complete` or `status: failed` while preserving `planHash` and the full immutable `plan`.

- [ ] **Step 5: Implement Evidence Join**

Implement:

```js
function joinCiEvidence({ manifest, laneResults }) {
  const expectedShards = new Map(
    manifest.plan.shards.map((shard) => [`${shard.lane}\0${shard.shardId}`, shard])
  );
  const actualShards = new Map();
  const executionCount = new Map();

  for (const result of laneResults) {
    if (result.planHash !== manifest.planHash) fail('CI_LANE_PLAN_HASH_MISMATCH');
    const key = `${result.lane}\0${result.shardId}`;
    if (!expectedShards.has(key)) fail('CI_UNPLANNED_SHARD_RESULT');
    if (actualShards.has(key)) fail('CI_DUPLICATE_SHARD_RESULT');
    if (result.outcome !== 'passed') fail('CI_REQUIRED_LANE_NOT_PASSED');
    actualShards.set(key, result);
    for (const identityKey of result.executedIdentityKeys || []) {
      executionCount.set(identityKey, (executionCount.get(identityKey) || 0) + 1);
    }
  }

  const selected = manifest.plan.shards.flatMap((shard) => shard.identityKeys);
  const missingShardCount = [...expectedShards].filter(([key]) => !actualShards.has(key)).length;
  const omitted = selected.filter((identityKey) => !executionCount.has(identityKey));
  const duplicated = selected.filter((identityKey) => executionCount.get(identityKey) !== 1);
  const unplanned = [...executionCount.keys()].filter((identityKey) => !selected.includes(identityKey));
  if (missingShardCount > 0) fail('CI_REQUIRED_SHARD_MISSING');
  if (omitted.length > 0) fail('CI_SELECTED_TEST_NOT_EXECUTED');
  if (duplicated.length > 0) fail('CI_TEST_EXECUTED_MORE_THAN_ONCE');
  if (unplanned.length > 0) fail('CI_UNPLANNED_TEST_EXECUTED');

  return {
    laneResults: [...actualShards.values()].sort(compareLaneResult),
    gates: {
      missingShardCount,
      omittedIdentityCount: omitted.length,
      duplicateExecutionCount: duplicated.length,
      unplannedExecutionCount: unplanned.length,
    },
  };
}
```

`finalizeRunManifest()` must call `joinCiEvidence()` and set `status: complete` only after every gate is zero. Any thrown issue produces a failed Required CI Result; cancelled or skipped jobs are not neutral.

- [ ] **Step 6: Run manifest and selection regression tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-run-manifest.test.ts tests/acceptance/ci-evidence-join.test.ts tests/acceptance/ci-test-selection.test.ts tests/acceptance/ci-profile-selection-fail-closed.test.ts
```

Expected: PASS and byte-identical planned manifests for equivalent reordered shard input.

- [ ] **Step 7: Commit Task 5**

```powershell
git add tools/ci/write-ci-run-manifest.cjs tools/ci/join-ci-evidence.cjs tests/acceptance/ci-run-manifest.test.ts tests/acceptance/ci-evidence-join.test.ts tests/fixtures/test-portfolio/run-manifest-input.json
git commit -m "feat(ci): 建立单一运行清单和证据汇合"
```

### Task 6: Build deterministic timing-driven shard plans

**Files:**
- Create: `tools/ci/vitest-timing-reporter.ts`
- Create: `tools/ci/summarize-test-timings.cjs`
- Create: `tools/ci/build-shard-plan.cjs`
- Create: `tests/acceptance/ci-timing-report-contract.test.ts`
- Create: `tests/acceptance/ci-shard-plan.test.ts`
- Create: `tests/fixtures/test-portfolio/timing-events.json`
- Modify: `tools/ci/write-ci-run-manifest.cjs`
- Modify: `repo-governance/ci/test-policy.json`

- [ ] **Step 1: Write failing timing identity and determinism tests**

Create `tests/acceptance/ci-timing-report-contract.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');

it('aggregates real per-file observations by canonical identity', () => {
  const summary = summarizeTimingEvents({
    commitSha: 'a'.repeat(40),
    events: [
      {
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: 1200,
        outcome: 'passed',
      },
      {
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: 1800,
        outcome: 'passed',
      },
    ],
  });

  expect(summary.timings['vitest::tests/a.test.ts']).toEqual({
    sampleCount: 2,
    medianMs: 1500,
    maxMs: 1800,
    conservativeMs: 1800,
  });
});

it('rejects missing identities, negative duration, or synthetic heartbeat events', () => {
  expect(() =>
    summarizeTimingEvents({
      commitSha: 'a'.repeat(40),
      events: [{ identityKey: '', durationMs: -1, outcome: 'heartbeat' }],
    })
  ).toThrow('TIMING_EVENT_INVALID');
});
```

- [ ] **Step 2: Write failing LPT allocation tests**

Create `tests/acceptance/ci-shard-plan.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { canonicalJsonBytes } = require('../../tools/test-portfolio-audit/canonical.cjs');

const selection = {
  profile: 'pr-fast',
  selected: [
    { identityKey: 'vitest::a', runnerId: 'vitest', testPath: 'a.test.ts', lane: 'core' },
    { identityKey: 'vitest::b', runnerId: 'vitest', testPath: 'b.test.ts', lane: 'core' },
    { identityKey: 'vitest::c', runnerId: 'vitest', testPath: 'c.test.ts', lane: 'core' },
  ],
};

it('uses deterministic longest-processing-time allocation', () => {
  const plan = buildShardPlan({
    selection,
    timingSummary: {
      timings: {
        'vitest::a': { conservativeMs: 8000 },
        'vitest::b': { conservativeMs: 7000 },
        'vitest::c': { conservativeMs: 1000 },
      },
    },
    policy: {
      timing: { unknownDurationMs: 60000, maxShardDurationMs: 8000, maxShardsPerLane: 2 },
    },
  });

  expect(plan.shards.map((shard: any) => shard.identityKeys)).toEqual([
    ['vitest::a'],
    ['vitest::b', 'vitest::c'],
  ]);
});

it('covers every selected identity once and is input-order stable', () => {
  const first = buildShardPlan({ selection, timingSummary: { timings: {} }, policy });
  const second = buildShardPlan({
    selection: { ...selection, selected: [...selection.selected].reverse() },
    timingSummary: { timings: {} },
    policy,
  });
  expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
  expect(first.gates.shardCoverageMismatchCount).toBe(0);
});
```

- [ ] **Step 3: Run the timing tests and verify the missing modules**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-timing-report-contract.test.ts tests/acceptance/ci-shard-plan.test.ts
```

Expected: FAIL because the timing and shard modules do not exist.

- [ ] **Step 4: Implement one Vitest run with JUnit plus canonical timing events**

Create `tools/ci/vitest-timing-reporter.ts` as a Vitest 4 custom reporter:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import type {
  Reporter,
  SerializedError,
  TestModule,
  TestRunEndReason,
} from 'vitest/node';

export default class CanonicalTimingReporter implements Reporter {
  constructor(private readonly outputFile: string) {}

  onTestRunEnd(
    modules: ReadonlyArray<TestModule>,
    _errors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason
  ) {
    const events = modules
      .map((module) => ({
        identityKey: `vitest::${relative(process.cwd(), module.moduleId).replace(/\\/g, '/')}`,
        runnerId: 'vitest',
        testPath: relative(process.cwd(), module.moduleId).replace(/\\/g, '/'),
        durationMs: Math.max(0, Math.round(module.diagnostic()?.duration ?? 0)),
        outcome: reason === 'passed' ? 'passed' : 'failed',
      }))
      .sort((left, right) => left.identityKey.localeCompare(right.identityKey, 'en'));
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, `${JSON.stringify({ events })}\n`, 'utf8');
  }
}
```

During Task 8, configure each Vitest lane with both:

```ts
reporters: [
  'default',
  ['junit', { classnameTemplate: '{filepath}' }],
  new CanonicalTimingReporter(process.env.CI_TIMING_OUTPUT!),
],
outputFile: {
  junit: process.env.CI_JUNIT_OUTPUT!,
},
```

JUnit remains the CI-readable standard report. The custom reporter from the same real run supplies stable per-file timing identities without introducing an XML parser or a second test execution.

- [ ] **Step 5: Implement canonical timing summary**

`summarizeTimingEvents()` must:

- accept only passed or failed real runner events;
- normalize path separators and identity keys;
- reject negative, non-finite, heartbeat, empty-timer, or duplicate run-event IDs;
- calculate sample count, median, maximum, and conservative duration;
- retain a bounded rolling window selected by commit order;
- produce `timingSnapshotHash` over canonical bytes.

Unknown duration is not zero. The shard planner uses `max(policy.timing.unknownDurationMs, observedMedianAcrossLane)` as the deterministic conservative weight.

- [ ] **Step 6: Implement deterministic LPT shard planning**

Implement:

```js
function allocateLane(items, shardCount) {
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    shardId: `shard-${String(index + 1).padStart(2, '0')}`,
    estimatedDurationMs: 0,
    identityKeys: [],
  }));
  const ordered = [...items].sort(
    (left, right) =>
      right.weightMs - left.weightMs || compareText(left.identityKey, right.identityKey)
  );
  for (const item of ordered) {
    const target = [...shards].sort(
      (left, right) =>
        left.estimatedDurationMs - right.estimatedDurationMs ||
        compareText(left.shardId, right.shardId)
    )[0];
    target.identityKeys.push(item.identityKey);
    target.estimatedDurationMs += item.weightMs;
  }
  return shards;
}
```

Choose shard count from total estimated lane duration, `maxShardDurationMs`, and `maxShardsPerLane`. Group by declared execution lane before allocation. Validate complete coverage, no duplicate identities, profile membership, and work-unit bounds.

Do not use Vitest `--shard` as the governance algorithm. Task 8 passes each generated shard's exact file list to Vitest.

- [ ] **Step 7: Run timing, shard, manifest, and determinism tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-timing-report-contract.test.ts tests/acceptance/ci-shard-plan.test.ts tests/acceptance/ci-run-manifest.test.ts tests/acceptance/ci-evidence-join.test.ts
```

Expected: PASS. Unknown-duration tests must remain selected and receive a conservative non-zero weight.

- [ ] **Step 8: Commit Task 6**

```powershell
git add tools/ci/vitest-timing-reporter.ts tools/ci/summarize-test-timings.cjs tools/ci/build-shard-plan.cjs tools/ci/write-ci-run-manifest.cjs repo-governance/ci/test-policy.json tests/acceptance/ci-timing-report-contract.test.ts tests/acceptance/ci-shard-plan.test.ts tests/fixtures/test-portfolio/timing-events.json
git commit -m "feat(ci): 使用真实时长确定性生成分片"
```

### Task 7: Authorize non-core deletion batches with one bounded local review

**Files:**
- Create: `tools/ci/authorize-test-deletions.cjs`
- Create: `tools/ci/review-ambiguous-test-candidates.cjs`
- Create: `repo-governance/ci/test-deletion-authorizations.json`
- Create: `tests/acceptance/ci-test-deletion-authorization.test.ts`
- Create: `tests/fixtures/test-portfolio/deletion-candidates.json`
- Modify: `tools/ci/feature-closeout.cjs`
- Modify: `tools/ci/test-policy.cjs`

- [ ] **Step 1: Write failing deterministic, ambiguous, and core-exclusion tests**

Create `tests/acceptance/ci-test-deletion-authorization.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  authorizeDeletionBatch,
  verifyDeletionAuthorization,
} = require('../../tools/ci/authorize-test-deletions.cjs');
const {
  reviewAmbiguousCandidatesOnce,
} = require('../../tools/ci/review-ambiguous-test-candidates.cjs');

it('authorizes a proven non-core deterministic batch without a model call', async () => {
  const invokeLocalModel = vi.fn();
  const authorization = await authorizeDeletionBatch({
    candidates: [
      {
        identityKey: 'vitest::tests/duplicate.test.ts',
        lifecycleState: 'deletion_candidate',
        capabilityRefs: [],
        reasonCode: 'EXACT_DUPLICATE',
        evidenceRefs: ['identity:vitest::tests/replacement.test.ts'],
      },
    ],
    policy,
    invokeLocalModel,
  });
  expect(invokeLocalModel).not.toHaveBeenCalled();
  expect(authorization.reviewMode).toBe('deterministic');
  expect(authorization.verdict).toBe('approve_delete');
});

it('removes core and protected-capability candidates before review', async () => {
  await expect(
    authorizeDeletionBatch({
      candidates: [
        {
          identityKey: 'vitest::tests/core.test.ts',
          lifecycleState: 'core_permanent',
          capabilityRefs: ['six-model-state-machine'],
          reasonCode: 'EXACT_DUPLICATE',
        },
      ],
      policy,
    })
  ).rejects.toThrow('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW');
});

it('invokes one local review and never retries or converges', async () => {
  const invoke = vi.fn().mockResolvedValue({
    verdict: 'retain_on_demand',
    candidateIdentityKeys: ['vitest::tests/ambiguous.test.ts'],
  });
  const result = await reviewAmbiguousCandidatesOnce({
    candidates: [{ identityKey: 'vitest::tests/ambiguous.test.ts' }],
    invoke,
    timeoutMs: 120000,
  });
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(result.verdict).toBe('retain_on_demand');
});

it('invalidates authorization when deleted identities, evidence, policy, or review profile drift', () => {
  expect(() =>
    verifyDeletionAuthorization({
      authorization: validAuthorization,
      deletedIdentityKeys: ['vitest::tests/different.test.ts'],
      evidenceHash: validAuthorization.evidenceHash,
      policyHash: validAuthorization.policyHash,
      reviewProfileVersion: validAuthorization.reviewProfileVersion,
    })
  ).toThrow('TEST_DELETION_AUTHORIZATION_DRIFT');
});

it('keeps flakes and quarantine findings outside ordinary deletion authority', async () => {
  await expect(
    authorizeDeletionBatch({
      candidates: [
        {
          identityKey: 'vitest::tests/flaky-core.test.ts',
          lifecycleState: 'core_permanent',
          quarantineStatus: 'observing',
          reasonCode: 'FLAKE_OBSERVED',
        },
      ],
      policy,
    })
  ).rejects.toThrow('FLAKE_NOT_DELETION_AUTHORITY');
});
```

- [ ] **Step 2: Run the deletion test and verify the missing modules**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-deletion-authorization.test.ts
```

Expected: FAIL because the deletion modules do not exist.

- [ ] **Step 3: Implement deterministic candidate authorization**

Implement:

```js
async function authorizeDeletionBatch({ candidates, policy, invokeLocalModel }) {
  const normalized = normalizeCandidates(candidates);
  rejectFlakeAsDeletionAuthority(normalized);
  rejectCoreOrProtected(normalized);
  if (normalized.length === 0) fail('TEST_DELETION_BATCH_EMPTY');
  if (normalized.length > 50) fail('TEST_DELETION_BATCH_TOO_LARGE');

  const deterministic = normalized.every((candidate) =>
    policy.deletion.deterministicReasonCodes.includes(candidate.reasonCode)
  );
  const evidenceHash = sha256Bytes(canonicalJsonBytes(buildEvidenceView(normalized)));
  const batchHash = sha256Bytes(
    canonicalJsonBytes(normalized.map((candidate) => candidate.identityKey))
  );

  if (deterministic) {
    return {
      batchHash,
      evidenceHash,
      policyHash: sha256Bytes(canonicalJsonBytes(policy)),
      reviewMode: 'deterministic',
      verdict: 'approve_delete',
      reviewProfileVersion: 'test-portfolio-delete/v1',
    };
  }

  return reviewAmbiguousCandidatesOnce({
    candidates: normalized,
    invoke: invokeLocalModel,
    timeoutMs: policy.deletion.localReview.timeoutMs,
    batchHash,
    evidenceHash,
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
  });
}
```

Only approved reason codes use the deterministic path. A `criticality` or `obsolete_candidate` label alone is never sufficient.

- [ ] **Step 4: Implement the one-shot local review boundary**

`reviewAmbiguousCandidatesOnce()` accepts an injected local invocation owned by the Main Agent or local worker. The module owns the compact request and strict response validator; it does not embed a provider credential and is never imported by GitHub workflow code.

Request fields are limited to identity, reason, replacement refs, capability/Trace refs, fixture ownership refs, target evidence, and independent-oracle evidence. Response verdicts are exactly:

```text
approve_delete
retain_on_demand
manual_review
```

Timeout, process error, malformed response, evidence shortage, or unsupported verdict returns `retain_on_demand`. There is one invocation, zero automatic retries, and zero convergence rounds. The authorization stores no prompt, chain of thought, source body, or full model response.

Flake findings never become deterministic deletion reason codes. Non-core flakes with an independent oracle may enter governed quarantine metadata or `retained_on_demand`; core flakes require repair or a separately confirmed equivalent replacement.

- [ ] **Step 5: Track compact authorizations and verify current Git diff**

Create `repo-governance/ci/test-deletion-authorizations.json`:

```json
{
  "schemaVersion": "test-deletion-authorizations/v1",
  "authorizations": []
}
```

`verifyDeletionAuthorization()` recomputes deleted test identities from baseline-to-HEAD diff, finds an exact `batchHash`, and validates `evidenceHash`, `policyHash`, `reviewMode`, and `reviewProfileVersion`. Missing or stale authorization throws `TEST_DELETION_REVIEW_MISSING` or `TEST_DELETION_AUTHORIZATION_DRIFT`.

- [ ] **Step 6: Run deletion, closeout, and core-protection tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-deletion-authorization.test.ts tests/acceptance/ci-feature-closeout.test.ts tests/acceptance/ci-generated-test-catalog.test.ts
```

Expected: PASS; local invocation count is exactly one only for ambiguous non-core candidates.

- [ ] **Step 7: Commit Task 7**

```powershell
git add tools/ci/authorize-test-deletions.cjs tools/ci/review-ambiguous-test-candidates.cjs tools/ci/feature-closeout.cjs tools/ci/test-policy.cjs repo-governance/ci/test-deletion-authorizations.json tests/acceptance/ci-test-deletion-authorization.test.ts tests/fixtures/test-portfolio/deletion-candidates.json
git commit -m "feat(ci): 建立有界测试删除授权"
```

### Task 8: Implement parallel execution lanes and one canonical package artifact

**Files:**
- Create: `vitest.parallel-safe.config.ts`
- Create: `vitest.repo-mutating.config.ts`
- Create: `tools/ci/run-vitest-shard.cjs`
- Create: `tools/ci/prepare-package-artifact.cjs`
- Create: `tools/ci/run-consumer-package-lane.cjs`
- Create: `tests/helpers/canonical-package-artifact.ts`
- Create: `tests/acceptance/ci-vitest-lane-execution.test.ts`
- Create: `tests/acceptance/ci-canonical-package-artifact.test.ts`
- Create: `tests/acceptance/ci-package-lifecycle-dedup.test.ts`
- Modify: `vitest.config.ts`
- Modify: `vitest.consumer-install.config.ts`
- Modify: `tools/run-root-tests.cjs`
- Modify: `packages/bmad-speckit/scripts/run-node-tests.cjs`
- Modify: `tests/acceptance/accept-install-consumer-cli.test.ts`
- Modify: `tests/acceptance/accept-pack-bmad-speckit.test.ts`
- Modify: `tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts`
- Modify: `tests/acceptance/accept-consumer-governance-zero-scripts.test.ts`
- Modify: `tests/acceptance/main-agent-dist-consumer-runtime.test.ts`

- [ ] **Step 1: Write failing exact-shard execution tests**

Create `tests/acceptance/ci-vitest-lane-execution.test.ts` and assert that `resolveVitestShard()`:

```ts
expect(
  resolveVitestShard({
    manifest,
    lane: 'core',
    shardId: 'core-01',
  })
).toEqual({
  configPath: 'vitest.parallel-safe.config.ts',
  testPaths: ['tests/a.test.ts', 'tests/b.test.ts'],
  planHash: manifest.planHash,
});

expect(() =>
  resolveVitestShard({ manifest, lane: 'core', shardId: 'missing' })
).toThrow('CI_SHARD_NOT_FOUND');
```

Add a process fixture that records received file arguments and prove no unselected file is passed to Vitest.

- [ ] **Step 2: Write failing one-build/one-pack package tests**

Create `tests/acceptance/ci-canonical-package-artifact.test.ts` and `ci-package-lifecycle-dedup.test.ts`. Use fake `runCommand` injection and assert:

```ts
expect(commands.filter((command) => command.kind === 'build')).toHaveLength(1);
expect(commands.filter((command) => command.kind === 'npm_pack')).toHaveLength(1);
expect(consumerRuns.every((run) => run.tarballSha256 === prepared.tarballSha256)).toBe(true);
expect(consumerRuns.every((run) => run.commitSha === prepared.commitSha)).toBe(true);
```

Mutate the tarball bytes after preparation and expect `CANONICAL_PACKAGE_HASH_MISMATCH`.

- [ ] **Step 3: Run lane tests and verify the missing executors**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-vitest-lane-execution.test.ts tests/acceptance/ci-canonical-package-artifact.test.ts tests/acceptance/ci-package-lifecycle-dedup.test.ts
```

Expected: FAIL because lane and package executors do not exist.

- [ ] **Step 4: Split Vitest by real side-effect boundary**

Keep shared aliases, setup, include/exclude defaults, and timeouts in `vitest.config.ts`, but remove `fileParallelism: false` as global authority.

`vitest.parallel-safe.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';
import CanonicalTimingReporter from './tools/ci/vitest-timing-reporter';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`CI_REPORT_OUTPUT_REQUIRED:${name}`);
  return value;
}

export default mergeConfig(
  base,
  defineConfig({
    test: {
      fileParallelism: true,
      maxWorkers: Number(process.env.CI_VITEST_WORKERS || 4),
      reporters: [
        'default',
        ['junit', { classnameTemplate: '{filepath}' }],
        new CanonicalTimingReporter(requiredEnv('CI_TIMING_OUTPUT')),
      ],
      outputFile: { junit: requiredEnv('CI_JUNIT_OUTPUT') },
    },
  })
);
```

`vitest.repo-mutating.config.ts` uses the same reporters but sets `fileParallelism: false`, `maxWorkers: 1`, and includes only Catalog identities classified as repository-mutating or installation-mutating.

- [ ] **Step 5: Execute exact manifest shards**

`tools/ci/run-vitest-shard.cjs` must:

- read and validate the Run Manifest;
- resolve one exact `{lane, shardId}`;
- map identities to repository-relative files;
- reject missing, duplicate, outside-root, or wrong-runner paths;
- invoke Vitest with the correct lane config and the exact file list;
- write JUnit, canonical timing events, and one normalized lane result bound to `planHash`;
- preserve the real exit code.

For Node tests, update `run-node-tests.cjs` to accept a manifest-resolved exact path list and emit the same normalized lane-result/timing event shape. Do not maintain a second hard-coded test authority. Resolve concurrent ownership before editing this file.

- [ ] **Step 6: Build and pack once**

`prepare-package-artifact.cjs` performs:

```text
clean controlled output
-> build package once
-> npm pack --json once
-> resolve exact tarball
-> compute SHA256
-> write canonical package descriptor
```

The descriptor contains commit SHA, package name/version, tarball relative path, tarball SHA256, build command hash, and pack command hash.

`run-consumer-package-lane.cjs` verifies the descriptor and installs the exact tarball into isolated temporary consumers. It must not call build or `npm pack`.

Update the five consumer/package tests to obtain the tarball from `BMAD_SPECKIT_TARBALL` through `tests/helpers/canonical-package-artifact.ts`. When the variable is absent in an explicitly local standalone test, the helper may create one task-scoped artifact; CI and release modes must fail if the canonical descriptor is missing.

- [ ] **Step 7: Run lane, package, and existing consumer tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-vitest-lane-execution.test.ts tests/acceptance/ci-canonical-package-artifact.test.ts tests/acceptance/ci-package-lifecycle-dedup.test.ts tests/acceptance/accept-install-consumer-cli.test.ts tests/acceptance/accept-pack-bmad-speckit.test.ts tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts tests/acceptance/accept-consumer-governance-zero-scripts.test.ts tests/acceptance/main-agent-dist-consumer-runtime.test.ts
```

Expected: PASS with one build and one pack in governed mode, exact tarball hash parity, and no unselected test execution.

- [ ] **Step 8: Commit Task 8**

```powershell
git add vitest.config.ts vitest.parallel-safe.config.ts vitest.repo-mutating.config.ts vitest.consumer-install.config.ts tools/ci/run-vitest-shard.cjs tools/ci/prepare-package-artifact.cjs tools/ci/run-consumer-package-lane.cjs tools/run-root-tests.cjs packages/bmad-speckit/scripts/run-node-tests.cjs tests/helpers/canonical-package-artifact.ts tests/acceptance/ci-vitest-lane-execution.test.ts tests/acceptance/ci-canonical-package-artifact.test.ts tests/acceptance/ci-package-lifecycle-dedup.test.ts tests/acceptance/accept-install-consumer-cli.test.ts tests/acceptance/accept-pack-bmad-speckit.test.ts tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts tests/acceptance/accept-consumer-governance-zero-scripts.test.ts tests/acceptance/main-agent-dist-consumer-runtime.test.ts
git commit -m "feat(ci): 按副作用边界并行执行测试"
```

### Task 9: Direct hard-cut GitHub Actions to the governed profile DAG

**Files:**
- Create: `tools/ci/verify-release-evidence-parity.cjs`
- Create: `tools/ci/verify-ci-authority-hard-cut.cjs`
- Create: `tests/acceptance/ci-workflow-parallel-dag.test.ts`
- Create: `tests/acceptance/release-ci-lane-parity.test.ts`
- Create: `tests/acceptance/ci-hard-cut-authority.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/publish-npm.yml`
- Modify: `package.json`
- Modify: `scripts/prepublish-check.js`
- Modify: `tools/test-portfolio-audit/routes.cjs`
- Modify: `tests/acceptance/test-portfolio-audit-routes.test.ts`

- [ ] **Step 1: Write failing DAG, fail-closed, and single-authority tests**

The new acceptance tests must parse workflow YAML and assert:

```ts
expect(jobIds).toEqual(
  expect.arrayContaining(['classify', 'execute-shard', 'evidence-join', 'ci-result'])
);
expect(workflow.jobs['execute-shard'].strategy.matrix).toEqual(
  '${' + '{ fromJSON(needs.classify.outputs.matrix) }}'
);
expect(workflow.jobs['evidence-join'].if).toBe('always()');
expect(workflow.jobs['ci-result'].needs).toEqual(['evidence-join']);
expect(serialAllTestsJobCount).toBe(0);
expect(oldSelectionFallbackCount).toBe(0);
expect(modelInvocationCount).toBe(0);
expect(independentPublishAuthorityCount).toBe(0);
```

Add mutations for a skipped shard, contributor profile downgrade, stale package hash, independent `npm pack`, old `npm run test:ci` fallback, and a second Catalog generator.

- [ ] **Step 2: Run workflow tests and verify current workflow failures**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-workflow-parallel-dag.test.ts tests/acceptance/release-ci-lane-parity.test.ts tests/acceptance/ci-hard-cut-authority.test.ts tests/acceptance/test-portfolio-audit-routes.test.ts
```

Expected: FAIL against the current serial CI and independent release behavior.

- [ ] **Step 3: Add governed package scripts**

Add commands whose names map one-to-one to the new modules:

```json
{
  "ci:catalog": "node tools/ci/generate-test-catalog.cjs",
  "ci:select": "node tools/ci/select-ci-tests.cjs",
  "ci:shard-plan": "node tools/ci/build-shard-plan.cjs",
  "ci:manifest": "node tools/ci/write-ci-run-manifest.cjs",
  "ci:run-shard": "node tools/ci/run-vitest-shard.cjs",
  "ci:prepare-package": "node tools/ci/prepare-package-artifact.cjs",
  "ci:run-consumer": "node tools/ci/run-consumer-package-lane.cjs",
  "ci:join": "node tools/ci/join-ci-evidence.cjs",
  "ci:verify-hard-cut": "node tools/ci/verify-ci-authority-hard-cut.cjs"
}
```

Remove `test:ci` from production workflow and release authority. It may remain only as a deprecated local compatibility command that calls governed `pr-full`; it cannot contain the old concatenated all-tests command or serve as fallback.

- [ ] **Step 4: Replace CI with the profile DAG**

`.github/workflows/ci.yml` must support `pull_request`, `merge_group`, `schedule`, `workflow_dispatch`, and `workflow_call`.

The jobs are:

```text
classify
  -> catalog + selection + shard plan + planned Run Manifest
  -> upload manifest artifact
  -> output compact matrix [{lane, shardId}]

execute-shard
  -> matrix fan-out
  -> download manifest
  -> execute exact shard
  -> upload lane result, timing, and JUnit

evidence-join (if: always())
  -> download all required artifacts
  -> fail on missing/failed/cancelled/skipped lane
  -> finalize Run Manifest

ci-result
  -> expose the only required status
```

The workflow must not infer identities in individual lane jobs. Only the classify job owns Catalog, Selection, Shard Plan, and the immutable manifest plan.

- [ ] **Step 5: Teach the Phase 1 route audit the governed matrix contract**

Update `routes.cjs` so a dynamic matrix is accepted only when:

- the producer step is the tracked `ci:manifest` command;
- the matrix expression references the declared classify output;
- matrix rows contain only `lane` and `shardId`;
- the consumer command is the tracked `ci:run-shard` command;
- the Evidence Join job requires all matrix results.

Arbitrary expressions, dynamic command construction, dynamic working directories, or unrecognized matrix fields remain `WORKFLOW_MATRIX_DYNAMIC`.

- [ ] **Step 6: Unify release and publish authority**

Make `release.yml` callable and require:

```text
exact commit pr-full evidence
-> release-verify selection
-> same canonical tarball hash
-> encoding/security/install/CLI/consumer gates
-> publish
```

Pin both qualifying PR evidence and release verification to the same Node 22 runtime and package-manager version. A runtime mismatch invalidates evidence parity rather than starting an independent release run with different semantics.

`verify-release-evidence-parity.cjs` compares commit SHA, Catalog hash, policy hash, package descriptor hash, tarball SHA256, and required lane identities.

Remove independent publishing behavior from `publish-npm.yml`; it may only call the reusable release workflow. `scripts/prepublish-check.js` verifies the existing descriptor and never rebuilds or repacks.

- [ ] **Step 7: Implement and run the hard-cut verifier**

`verify-ci-authority-hard-cut.cjs` must fail on:

- more than one Catalog or Selection producer;
- old serial all-tests workflow jobs;
- `test:ci` fallback in production workflows;
- model command/provider/credential in GitHub CI;
- a second package build/pack authority;
- skipped/cancelled required lanes treated as success;
- workflow output matrix containing test paths;
- release or publish path that bypasses exact evidence parity.

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-workflow-parallel-dag.test.ts tests/acceptance/release-ci-lane-parity.test.ts tests/acceptance/ci-hard-cut-authority.test.ts tests/acceptance/test-portfolio-audit-routes.test.ts
npm run ci:verify-hard-cut
```

Expected: PASS locally. Do not push or merge the hard-cut workflow until Tasks 10 and 11 establish the fresh baseline, freeze the core set, reduce the executable portfolio to 480 or fewer, and Task 12 local preflight authorizes the representative integration-branch runs.

- [ ] **Step 8: Commit Task 9**

```powershell
git add .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/publish-npm.yml package.json scripts/prepublish-check.js tools/ci/verify-release-evidence-parity.cjs tools/ci/verify-ci-authority-hard-cut.cjs tools/test-portfolio-audit/routes.cjs tests/acceptance/ci-workflow-parallel-dag.test.ts tests/acceptance/release-ci-lane-parity.test.ts tests/acceptance/ci-hard-cut-authority.test.ts tests/acceptance/test-portfolio-audit-routes.test.ts
git commit -m "feat(ci): 直接切换到治理型并行流水线"
```

### Task 10: Generate a fresh baseline and freeze the explicit permanent core

**Files:**
- Create: `tools/ci/freeze-core-portfolio.cjs`
- Create: `tests/acceptance/ci-core-portfolio-freeze.test.ts`
- Create: `docs/ci/test-portfolio-operations.md`
- Modify: `repo-governance/ci/test-policy.json`
- Modify: `tools/ci/generate-test-catalog.cjs`

- [ ] **Step 1: Write failing core-freeze tests**

Create `tests/acceptance/ci-core-portfolio-freeze.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { freezeCorePortfolio } = require('../../tools/ci/freeze-core-portfolio.cjs');

it('uses explicit protected capability bindings and ignores inherited release membership', () => {
  const result = freezeCorePortfolio({
    catalog: fixtureCatalog,
    policy: fixturePolicy,
  });
  expect(result.coreIdentityKeys).toContain('vitest::tests/state-machine.test.ts');
  expect(result.coreIdentityKeys).not.toContain('vitest::tests/release-descendant.test.ts');
  expect(result.gates.protectedCapabilityWithoutCoreTestCount).toBe(0);
});

it('fails rather than increasing the 120-test core budget', () => {
  expect(() =>
    freezeCorePortfolio({ catalog: catalogWith121ExplicitCoreTests, policy: fixturePolicy })
  ).toThrow('CORE_PERMANENT_BUDGET_EXCEEDED');
});
```

Also assert every selected core test has an independent oracle and that ordinary reducer output cannot delete or downgrade the frozen set.

- [ ] **Step 2: Run the test and verify the missing freeze module**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-core-portfolio-freeze.test.ts
```

Expected: FAIL because `freezeCorePortfolio()` does not exist.

- [ ] **Step 3: Implement explicit core freeze**

Implement:

```js
function freezeCorePortfolio({ catalog, policy }) {
  const protectedCapabilities = new Map(
    policy.protectedCapabilities.map((entry) => [entry.capabilityId, entry])
  );
  const selected = catalog.tests.filter((test) =>
    (test.capabilityRefs || []).some((ref) => protectedCapabilities.has(ref))
  );
  const missing = [...protectedCapabilities.keys()].filter(
    (ref) => !selected.some((test) => (test.capabilityRefs || []).includes(ref))
  );
  if (missing.length > 0) fail('PROTECTED_CAPABILITY_WITHOUT_CORE_TEST', missing);
  if (selected.some((test) => test.classifications?.oracleEffectiveness !== 'effective')) {
    fail('CORE_TEST_ORACLE_NOT_INDEPENDENT');
  }
  if (selected.length > policy.budgets.corePermanentCount) {
    fail('CORE_PERMANENT_BUDGET_EXCEEDED');
  }
  return {
    coreIdentityKeys: selected.map((test) => test.identityKey).sort(compareText),
    policyPatch: buildCorePolicyPatch(selected),
    gates: {
      corePermanentCount: selected.length,
      protectedCapabilityWithoutCoreTestCount: missing.length,
    },
  };
}
```

Core coverage must include the six-model state machine and stable projection, RequirementRecord authority, Judge/Audit/Reverse Audit continuation, CLI startup, consumer installation, canonical package/runtime, persistence, security, and encoding minimum E2E. Prefer one small behavior-level test per independent failure boundary; do not freeze every release workflow descendant.

- [ ] **Step 4: Generate a fresh truthful baseline without deleting tests**

Run the new production modules against the current commit and write only generated artifacts:

```powershell
node tools/test-portfolio-audit/run.cjs --repo-root . --output-dir .artifacts/ci --probe-limit 0 --json
npm run ci:catalog -- --output-dir .artifacts/test-portfolio
node tools/ci/freeze-core-portfolio.cjs --catalog .artifacts/test-portfolio/test-catalog.json --policy repo-governance/ci/test-policy.json --output .artifacts/test-portfolio/core-freeze.json
```

Record:

- runner-resolved executable count;
- candidate-only and runner-only counts;
- explicit critical/capability bindings;
- duplicate, obsolete, ineffective, unresolved, and ambiguous counts;
- timing observation count;
- current core count and protected capability coverage.

This step is fact establishment only. Do not delete, skip, rename, or reclassify files merely to make the baseline green.

- [ ] **Step 5: Apply the reviewed core patch and regenerate the Catalog**

Apply only explicit core bindings from `core-freeze.json` to `test-policy.json`, regenerate the Catalog twice, and require byte-identical output.

Expected gates:

```text
corePermanentCount <= 120
protectedCapabilityWithoutCoreTestCount = 0
unclassifiedTestCount = 0
unexplainedRunnerOnlyCount = 0
unexplainedCandidateOnlyCount = 0
```

- [ ] **Step 6: Document operator commands**

Create `docs/ci/test-portfolio-operations.md` with:

- the four lifecycle states and profiles;
- fresh Catalog and Selection commands;
- Feature Closeout dispositions;
- deterministic and ambiguous deletion batch commands;
- blocked impact-binding remediation;
- local one-shot review behavior;
- shard/result diagnostics;
- exact rollback of one deletion batch;
- the difference between provisional and formal P95.

- [ ] **Step 7: Run core, policy, Catalog, and encoding tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-core-portfolio-freeze.test.ts tests/acceptance/ci-test-policy.test.ts tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-feature-closeout.test.ts
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Expected: PASS and `findings=0`.

- [ ] **Step 8: Commit Task 10**

```powershell
git add tools/ci/freeze-core-portfolio.cjs repo-governance/ci/test-policy.json tools/ci/generate-test-catalog.cjs tests/acceptance/ci-core-portfolio-freeze.test.ts docs/ci/test-portfolio-operations.md
git commit -m "feat(ci): 冻结显式核心测试组合"
```

Do not commit `.artifacts/ci` or `.artifacts/test-portfolio`.

### Task 11: Reduce the physical executable portfolio to 480 or fewer

**Files:**
- Create: `tools/ci/apply-test-deletion-batch.cjs`
- Create: `tests/acceptance/ci-test-deletion-batch.test.ts`
- Modify: `repo-governance/ci/test-deletion-authorizations.json`
- Modify: test files and fixtures selected by current validated deletion batches

- [ ] **Step 1: Write failing atomic rollback tests**

Create `tests/acceptance/ci-test-deletion-batch.test.ts` with a temporary Git fixture:

```ts
it('restores only the current batch when affected validation fails', async () => {
  const result = await applyDeletionBatch({
    repoRoot,
    authorization: validAuthorization,
    identityKeys: ['vitest::tests/a.test.ts'],
    validate: async () => ({ passed: false, issueCode: 'AFFECTED_TEST_FAILED' }),
  });
  expect(result.status).toBe('rolled_back');
  expect(readFileSync(join(repoRoot, 'tests/a.test.ts'), 'utf8')).toBe(originalSource);
  expect(readFileSync(join(repoRoot, 'tests/unrelated.test.ts'), 'utf8')).toBe(unrelatedSource);
});
```

Also prove that missing authorization, core identity, path outside the repository, hash drift, or more than the batch limit prevents any file mutation.

- [ ] **Step 2: Run the test and verify the missing batch executor**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-deletion-batch.test.ts
```

Expected: FAIL because `applyDeletionBatch()` does not exist.

- [ ] **Step 3: Implement exact-batch move, validation, and rollback**

The executor must:

```text
verify compact authorization
-> verify no core/protected identity
-> copy exact original bytes and hashes to a task-scoped backup
-> remove only authorized working-tree paths
-> rerun affected tests, Catalog reconciliation, binding gates, and count
-> PASS keeps deletion and writes a compact result
-> FAIL restores exact bytes for this batch only
```

Use repository-relative literal paths and reject symlinks or paths outside the workspace. Do not run broad cleanup or Git reset commands.

- [ ] **Step 4: Process deterministic batches in value order**

Generate homogeneous batches of at most 50:

1. exact duplicate execution or oracle;
2. removed or unreachable targets;
3. self-proving expected values with no independent product behavior;
4. implementation-detail tests replaced by a stable contract test;
5. stale or duplicate fixture combinations.

For each batch:

```powershell
node tools/ci/authorize-test-deletions.cjs --candidates .artifacts/test-portfolio/deletion-batches/batch-001.json --policy repo-governance/ci/test-policy.json --output .artifacts/test-portfolio/deletion-batches/batch-001.authorization.json
node tools/ci/apply-test-deletion-batch.cjs --authorization .artifacts/test-portfolio/deletion-batches/batch-001.authorization.json --catalog .artifacts/test-portfolio/test-catalog.json
```

Run the exact affected validation from the batch result, regenerate the Catalog, and commit only the batch paths plus its compact tracked authorization. A failing batch rolls back and does not block independent later batches.

- [ ] **Step 5: Process only remaining ambiguous batches**

Use batches of 20 to 30 semantically similar non-core candidates. Invoke the local model once. `retain_on_demand`, invalid output, timeout, or uncertainty keeps the tests. No review loop is allowed.

- [ ] **Step 6: Prove the physical count and retained semantics**

Regenerate from runner discovery, not filesystem count:

```text
runnerResolvedExecutableTestCount <= 480
corePermanentCount <= 120
unauthorizedDeletedTestCount = 0
unclassifiedTestCount = 0
unresolvedImpactBindingCount = 0
```

Moving a test to `retained_on_demand` or out of `pr-fast` does not reduce executable count and cannot satisfy this gate.

- [ ] **Step 7: Run portfolio regression tests**

Run:

```powershell
npm exec -- vitest run tests/acceptance/ci-test-deletion-batch.test.ts tests/acceptance/ci-test-deletion-authorization.test.ts tests/acceptance/ci-core-portfolio-freeze.test.ts tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-test-selection.test.ts
```

Then run every affected test command recorded by the accepted deletion batches.

Expected: PASS with no protected capability loss and no hidden runner identity.

- [ ] **Step 8: Commit each accepted batch**

Use one commit per accepted batch:

```powershell
git add --pathspec-from-file=.artifacts/test-portfolio/deletion-batches/batch-001.changed-paths.txt
git add repo-governance/ci/test-deletion-authorizations.json
git commit -m "test(portfolio): 删除已验证的非核心冗余批次"
```

Do not combine unrelated batches or core changes.

### Task 12: Prove count, coverage, determinism, and runtime acceptance

**Files:**
- Modify: `docs/ci/test-portfolio-operations.md`
- Verify: all files changed by Tasks 1 through 11

- [ ] **Step 1: Run the complete portfolio acceptance suite**

Run:

```powershell
npm exec -- vitest run tests/acceptance/test-portfolio-audit-facts.test.ts tests/acceptance/test-portfolio-audit-discovery.test.ts tests/acceptance/test-portfolio-audit-routes.test.ts tests/acceptance/test-portfolio-audit-canonical.test.ts tests/acceptance/ci-test-policy.test.ts tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-feature-closeout.test.ts tests/acceptance/ci-test-selection.test.ts tests/acceptance/ci-profile-selection-fail-closed.test.ts tests/acceptance/ci-run-manifest.test.ts tests/acceptance/ci-evidence-join.test.ts tests/acceptance/ci-timing-report-contract.test.ts tests/acceptance/ci-shard-plan.test.ts tests/acceptance/ci-test-deletion-authorization.test.ts tests/acceptance/ci-test-deletion-batch.test.ts tests/acceptance/ci-vitest-lane-execution.test.ts tests/acceptance/ci-canonical-package-artifact.test.ts tests/acceptance/ci-package-lifecycle-dedup.test.ts tests/acceptance/ci-workflow-parallel-dag.test.ts tests/acceptance/release-ci-lane-parity.test.ts tests/acceptance/ci-hard-cut-authority.test.ts tests/acceptance/ci-core-portfolio-freeze.test.ts
npm run ci:verify-hard-cut
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Expected: PASS and encoding `findings=0`.

- [ ] **Step 2: Prove canonical determinism**

From one clean repository state and one fixed timing snapshot, generate Catalog, Selection, Shard Plan, and planned Run Manifest twice into separate temporary directories.

Compare exact bytes and SHA256:

```text
catalog bytes equal
selection bytes equal
shard plan bytes equal
manifest plan bytes equal
```

Then change only the timing snapshot. The selected identity set must remain equal; only shard packing and timing hashes may change.

- [ ] **Step 3: Prove all final integrity gates**

Require:

```text
runnerResolvedExecutableTestCount <= 480
corePermanentCount <= 120
unclassifiedTestCount = 0
unresolvedImpactBindingCount = 0
unclosedFeatureWorkingTestCount = 0
protectedCapabilityWithoutCoreTestCount = 0
unauthorizedDeletedTestCount = 0
selectionOmissionCount = 0
selectionDuplicateCount = 0
shardCoverageMismatchCount = 0
```

Coverage conservation must also prove independent protection for six-model state transitions, RequirementRecord authority, Judge/Audit/Reverse Audit continuation, CLI startup, package/install/consumer runtime, persistence, security, and encoding.

- [ ] **Step 4: Run three fresh representative `pr-fast` workflows**

After Tasks 10 and 11 and all local preflight gates pass, push the integration branch and run the new workflow three times without reusing result artifacts:

- ordinary Feature impact;
- shared-core/high-diffusion impact that escalates to `pr-full`;
- package or consumer boundary impact.

Each run must use real discovery, selection, package preparation, runners, JUnit/timing output, matrix jobs, and Evidence Join. Each wall-clock duration must be 10 minutes or less. Empty timers, mocked journeys, cached result substitution, or running fewer selected identities are invalid.

Before 20 valid PR samples, record only:

```text
provisional_slo_pass
```

After at least 20 valid samples, calculate and require formal PR CI `P95 <= 10 minutes`.

- [ ] **Step 5: Run `release-verify` evidence parity**

Trigger the reusable release workflow without publishing and require exact commit, Catalog, policy, package descriptor, tarball SHA256, and required lane parity with the qualifying `pr-full` evidence.

- [ ] **Step 6: Inspect repository boundaries**

Verify:

- `.artifacts/test-portfolio` and `.artifacts/ci` are not staged or committed;
- no abandoned review payload or deletion backup is staged;
- no unrelated concurrent change entered task commits;
- no production Shadow, dual write, fallback, second Catalog, second Selection, second package build, or independent publish authority remains;
- generated matrix output contains only `lane` and `shardId`;
- local model code is unreachable from GitHub workflow commands.

- [ ] **Step 7: Update operations evidence and commit closeout**

Add the final command set, current counts, provisional/formal SLO status, rollback command, and required status name to `docs/ci/test-portfolio-operations.md`.

```powershell
git add docs/ci/test-portfolio-operations.md
git commit -m "docs(ci): 记录测试组合治理验收流程"
```

Do not claim formal P95 before 20 valid runs. Do not claim complete hard-cut acceptance if any integrity gate, representative run, release parity check, or Evidence Join is missing.

## Design Coverage Matrix

| Design area | Implemented by |
| --- | --- |
| Four-state authority and hard budgets | Tasks 1-3, 10-11 |
| Tracked policy and deterministic precedence | Tasks 1-2 |
| Dual-source discovery and complete facts | Tasks 1-2 |
| Trace-governed bounded selection | Task 4 |
| Minimal generated artifacts and single manifest | Tasks 2, 4-6 |
| Duration-governed sharding | Task 6 |
| Four profiles and parallel DAG | Tasks 4, 8-9 |
| Feature Closeout lifecycle | Task 3 |
| Core protection and freeze | Tasks 3, 7, 10 |
| Deterministic deletion and one local review | Tasks 7, 11 |
| GitHub model independence | Tasks 7, 9, 12 |
| Direct Hard Cut and release parity | Tasks 9, 12 |
| Count, coverage, determinism, and P95 acceptance | Tasks 10-12 |

## Execution Handoff

This plan is implementation-ready only after the design hash remains `97309a22203ba60562bcc054359488d29add5e901f5021532fc331989f3496ac` and concurrent ownership of `packages/bmad-speckit/scripts/run-node-tests.cjs` is resolved. Execute tasks in dependency order, keep generated artifacts untracked, and do not push the workflow hard cut before Task 12 local preflight permits the three representative integration-branch runs.
