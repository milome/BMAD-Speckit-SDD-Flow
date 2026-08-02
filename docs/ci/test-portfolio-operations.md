# Test Portfolio Operations

## Authority

- Tracked policy: `repo-governance/ci/test-policy.json`
- Generated Catalog: `.artifacts/test-portfolio/test-catalog.json`
- Core freeze: `.artifacts/test-portfolio/core-freeze.json`
- Generated artifacts are evidence only and must not be committed.
- Runner-resolved discovery, not filesystem glob count, is the executable-test authority.

## Lifecycle States

- `core_permanent`: frozen protected-capability tests; ordinary reducers cannot delete or downgrade them.
- `feature_working_set`: tests added, changed, or directly affected by an open feature.
- `retained_on_demand`: valuable non-core tests selected by impact, nightly, release, or explicit maintenance.
- `deletion_candidate`: review candidate only; it remains executable until an authorized physical deletion succeeds.

## CI Profiles

- `pr-fast`: permanent core, product-survival boundary, changed tests, and the first complete impact boundary.
- `pr-full`: broader feature or package boundary for high-diffusion changes.
- `nightly-deep`: all applicable non-deleted tests.
- `release-verify`: release capabilities, package/install/consumer boundaries, and release evidence parity.

Unknown profiles, unresolved changed paths, missing bindings, or contributor downgrade attempts fail closed.

## Fresh Baseline

```powershell
node tools/test-portfolio-audit/run.cjs --repo-root . --output-dir .artifacts/ci --probe-limit 0 --json
npm run ci:catalog -- --output-dir .artifacts/test-portfolio
node tools/ci/freeze-core-portfolio.cjs --catalog .artifacts/test-portfolio/test-catalog.json --policy repo-governance/ci/test-policy.json --output .artifacts/test-portfolio/core-freeze.json
```

Baseline captured on July 29, 2026:

- Runner-resolved executable tests: `479`
- Catalog identities: `479`
- Candidate-only / runner-only reconciliation: `0 / 0`
- Catalog core identities: `37`
- Protected capabilities without core coverage: `0`
- Unclassified tests: `0`
- Timing observations: `0`
- Executable budget status: `within_budget` against the hard limit of `480`
- Current `pr-fast` Selection: `37`
- Current Shard Plan: `5` shards

Catalog reconciliation gates are authoritative for runner-only and candidate-only drift; both are zero.

## Core Freeze

Each protected capability contains exact `coreIdentityKeys`. `selectionRefs` retain source lineage, but cannot promote new script descendants after a freeze.

Core changes require a separate reviewed change. Do not use ordinary Feature Closeout, deletion authorization, or deletion batches to alter the frozen set.

Required gates:

```text
corePermanentCount <= 120
protectedCapabilityWithoutCoreTestCount = 0
every frozen identity has oracleEffectiveness = effective
```

## Feature Closeout

Every `feature_working_set` identity must receive one disposition:

- `promote_to_core`
- `merge_to_contract_test`
- `retain_on_demand`
- `delete_after_closeout`

Closeout is blocked while `unclosedFeatureWorkingTestCount > 0`. Promotion requires a protected capability, independent oracle, no smaller equivalent core test, and remaining core budget.

## Selection And Shards

```powershell
npm run ci:select -- --catalog .artifacts/test-portfolio/test-catalog.json --changed-paths .artifacts/test-portfolio/changed-paths.json --requested-profile pr-fast --output-dir .artifacts/test-portfolio
npm run ci:shard-plan -- --selection .artifacts/test-portfolio/test-selection.json --timing-summary .artifacts/test-portfolio/ci-test-timing-summary.json --output-dir .artifacts/test-portfolio
npm run ci:manifest -- --catalog .artifacts/test-portfolio/test-catalog.json --selection .artifacts/test-portfolio/test-selection.json --shard-plan .artifacts/test-portfolio/ci-shard-plan.json --timing-summary .artifacts/test-portfolio/ci-test-timing-summary.json --package-descriptor .artifacts/test-portfolio/package/canonical-package.json --output-dir .artifacts/test-portfolio
```

For diagnostics, compare the selected identity count with the sum of shard identities, then inspect `.artifacts/test-portfolio/lane-results` and the final Run Manifest. Missing, failed, cancelled, skipped, duplicate, or unplanned lane evidence is a hard failure.

If Selection reports `IMPACT_BINDING_UNRESOLVED`, add or correct the tracked capability, trace, feature, package, or managed path binding. Do not add a broad default and do not lower the profile.

The package producer and Manifest projector must remain separate authorities. `ci:manifest` consumes the canonical descriptor and tarball produced for the same commit; it does not rebuild the package or accept a descriptor from a different commit.

## Deletion Batches

Deterministic batches:

```powershell
node tools/ci/authorize-test-deletions.cjs --candidates .artifacts/test-portfolio/deletion-batches/batch-001.json --policy repo-governance/ci/test-policy.json --output .artifacts/test-portfolio/deletion-batches/batch-001.authorization.json
node tools/ci/apply-test-deletion-batch.cjs --authorization .artifacts/test-portfolio/deletion-batches/batch-001.authorization.json --catalog .artifacts/test-portfolio/test-catalog.json
```

- Deterministic batches contain at most `50` homogeneous candidates.
- Ambiguous batches contain `20-30` similar non-core candidates.
- Ambiguous review invokes the local model once, with no retries and no review loop.
- `retain_on_demand`, invalid output, timeout, uncertainty, or missing evidence keeps the tests.
- A candidate still referenced by production source, workflow authority, manifest authority, package scripts, or a tracked registry fails with `TEST_DELETION_EXTERNAL_BINDING_ACTIVE`.

The batch executor restores exact original bytes automatically when affected validation fails. Every accepted deletion must use a task-scoped commit containing only that batch. To roll it back after commit:

```powershell
git revert <task-scoped-deletion-commit>
```

Before committing, use the batch's recorded original-byte backup and changed-path list. Never use a repository-wide reset.

## Local Acceptance

Run the complete governed acceptance and authority gates:

```powershell
npm exec -- vitest run tests/acceptance/test-portfolio-audit-facts.test.ts tests/acceptance/test-portfolio-audit-discovery.test.ts tests/acceptance/test-portfolio-audit-routes.test.ts tests/acceptance/test-portfolio-audit-canonical.test.ts tests/acceptance/ci-test-policy.test.ts tests/acceptance/ci-generated-test-catalog.test.ts tests/acceptance/ci-feature-closeout.test.ts tests/acceptance/ci-test-selection.test.ts tests/acceptance/ci-profile-selection-fail-closed.test.ts tests/acceptance/ci-run-manifest.test.ts tests/acceptance/ci-evidence-join.test.ts tests/acceptance/ci-timing-report-contract.test.ts tests/acceptance/ci-shard-plan.test.ts tests/acceptance/ci-test-deletion-authorization.test.ts tests/acceptance/ci-test-deletion-batch.test.ts tests/acceptance/ci-vitest-lane-execution.test.ts tests/acceptance/ci-canonical-package-artifact.test.ts tests/acceptance/ci-package-lifecycle-dedup.test.ts tests/acceptance/ci-workflow-parallel-dag.test.ts tests/acceptance/release-ci-lane-parity.test.ts tests/acceptance/ci-hard-cut-authority.test.ts tests/acceptance/ci-core-portfolio-freeze.test.ts tests/acceptance/requirements-contract-runtime-action-survival.test.ts
npm run ci:verify-hard-cut
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Recorded local closeout evidence on July 29, 2026: `23` files and `466` tests passed in `75.90s`; Hard-Cut authority verification reported one Catalog producer, one Selection producer, one package preparation authority, and zero serial-all-tests jobs, legacy fallbacks, model invocations, or independent publish authorities.

Current integrity gates:

```text
executableTestCount = 479
corePermanentCount = 37
reconciliationErrorCount = 0
unclassifiedTestCount = 0
protectedCapabilityWithoutCoreTestCount = 0
unresolvedImpactBindingCount = 0
selectionOmissionCount = 0
selectionDuplicateCount = 0
shardCoverageMismatchCount = 0
shardDuplicateIdentityCount = 0
maxShardDurationExceededCount = 0
```

Two clean-state generations on commit `61771ef15942277c8d2b6e714f3cb2a42d65d684` produced exact byte matches:

```text
test-catalog.json   sha256:1014a52a2258fcf77edbeafbd44286bd3c6707069d9e04fe940a87bba3e3671e
test-selection.json sha256:c87afc9dd5049362acf9417b9d911349b44a24450204237ce4a36909b6480b02
ci-shard-plan.json  sha256:d491a2da9303942283b8bf53af17a2b3e942aeba1543312079d6bb7cd9747311
ci-run-manifest.json sha256:b3a2fdb140b0674861e7e6ab32c152b5f17faef543a596a3e1c7e6d1c3fe8ec8
```

A timing-only mutation retained the exact selected identity set and changed only the timing-governed Shard Plan and Manifest projection. The unique required branch-protection status is `ci-result`.

## Runtime Evidence

Before 20 valid PR samples, report only `provisional_slo_pass`. After at least 20 valid samples, calculate the formal wall-clock distribution and require `P95 <= 10 minutes`.

Do not sum parallel job durations. Measure workflow wall clock from classify start through the required `ci-result`, and retain Catalog, Selection, Shard Plan, Run Manifest, timing events, JUnit, and Evidence Join provenance for each sample.

Current remote status on July 29, 2026:

```text
remote_evidence_not_executed
representative_pr_runs = 0 / 3
release_verify_parity = not_run
formal_p95 = not_available
```
