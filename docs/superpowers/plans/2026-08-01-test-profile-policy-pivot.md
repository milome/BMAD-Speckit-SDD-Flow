# Test Profile Policy Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all deleted tests and pivot CI optimization from test deletion to governed PR-fast selection plus full-suite compensation.

**Architecture:** Preserve the existing catalog, changed-code impact, semantic coverage, shard, manifest, and evidence-join pipeline. Replace deletion authorization as the normal optimization path with a per-test profile policy, select PR tests by `pr-fast OR changed-code impact`, and run retained tests through nightly/release full profiles. Keep physical test deletion behind a separate fail-closed review gate.

**Tech Stack:** Node.js CommonJS CI tooling, Vitest, JSON policy artifacts, GitHub Actions, npm scripts.

---

### Task 1: Freeze the pivot contract

**Files:**
- Create: `docs/superpowers/plans/2026-08-01-test-profile-policy-pivot.md`
- Test: `tests/acceptance/ci-test-profile-policy.test.ts`

- [ ] Add failing tests requiring every policy record to expose `testPath`, `runner`, `capabilityRefs`, `riskTier`, `profiles`, `estimatedDurationMs`, `owner`, and `lastFullRunAt`.
- [ ] Add failing tests requiring PR selection to use the union of explicit `pr-fast` membership and changed-code impact.
- [ ] Add failing tests requiring nightly/release full profiles to retain every cataloged executable test.
- [ ] Run `npx vitest run tests/acceptance/ci-test-profile-policy.test.ts` and confirm failures identify missing profile-policy behavior.

### Task 2: Restore the test inventory

**Files:**
- Restore: the 531 test-like paths deleted between merge-base `8b6134e190175fa050a9d761801dfc658d97abb4` and this feature branch

- [ ] Produce the deletion path list from Git and verify every entry is test-like.
- [ ] Restore only those paths from merge-base `8b6134e190175fa050a9d761801dfc658d97abb4`.
- [ ] Re-run the deletion inventory and require zero deleted test-like paths.
- [ ] Regenerate the test catalog so restored tests re-enter governance.

### Task 3: Replace deletion authorization with profile policy

**Files:**
- Create: `repo-governance/ci/test-profile-policy.json`
- Modify: `repo-governance/ci/test-policy.json`
- Modify: `tools/ci/test-policy.cjs`
- Modify: `tools/ci/generate-test-catalog.cjs`
- Test: `tests/acceptance/ci-test-profile-policy.test.ts`

- [ ] Derive one profile-policy record per cataloged test, preserving capability, runner, risk, and timing evidence already computed by the branch.
- [ ] Assign `pr-fast` only through explicit policy; assign full compensation profiles to all retained tests.
- [ ] Validate unique normalized paths, known runners/profiles, non-empty owners, finite non-negative durations, and nullable ISO `lastFullRunAt`.
- [ ] Make stale or missing full-run evidence visible without deleting or silently excluding the test.

### Task 4: Pivot selection and execution profiles

**Files:**
- Modify: `tools/ci/select-ci-tests.cjs`
- Modify: `tools/ci/run-governed-profile.cjs`
- Modify: `package.json`
- Test: `tests/acceptance/ci-test-selection.test.ts`
- Test: `tests/acceptance/ci-profile-selection-fail-closed.test.ts`
- Test: `tests/acceptance/ci-test-profile-policy.test.ts`

- [ ] Add `pr-fast`, `nightly-full`, and `release-full` profile contracts.
- [ ] Select PR tests as `profile(pr-fast) UNION changed-code-impact`, retaining existing semantic fail-closed expansion.
- [ ] Select all executable catalog entries for nightly/release full profiles and keep existing sharding/evidence behavior.
- [ ] Reject unknown profile names, invalid policy records, missing impact evidence, and catalog/policy drift.

### Task 5: Rewire CI and isolate physical deletion

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/nightly-full.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `tools/ci/authorize-test-deletions.cjs`
- Modify: `tools/ci/apply-test-deletion-batch.cjs`
- Test: `tests/acceptance/ci-workflow-parallel-dag.test.ts`
- Test: `tests/acceptance/ci-test-deletion-authorization.test.ts`

- [ ] Point PR CI at `pr-fast` and preserve the 15-minute P95 budget gate.
- [ ] Add scheduled/manual nightly full execution and point release verification at `release-full`.
- [ ] Require explicit high-threshold review evidence for physical deletion; profile exclusion must not count as deletion authorization.
- [ ] Keep deletion tooling available only as a separately invoked exceptional maintenance flow.

### Task 6: Verify and audit the pivot

**Files:**
- Verify all modified CI policy, tooling, tests, and workflows.

- [ ] Run encoding integrity checks before and after JSON/YAML edits.
- [ ] Run the focused CI governance acceptance suite.
- [ ] Run catalog generation and each profile in selection/dry-run mode.
- [ ] Verify zero deleted test-like paths relative to the feature merge-base.
- [ ] Review `git diff --check`, modified-file status, profile counts, duration estimates, and residual full-suite runtime risks.
