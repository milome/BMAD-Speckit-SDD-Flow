# AI-TDD Contract Gate Execution Plan

Date: 2026-05-25
Runtime: vibe
Internal grade: XL, wave-sequential, no parallel write fan-out because core scripts share the same integration surface.
Canonical path: `specs/ai-tdd-contract-gate/execution-plan.md`
Legacy local draft: `docs/plans/2026-05-25-ai-tdd-contract-gate-execution-plan.md`

## Wave 1 - Canonical Tracking

- Move requirement, plan, and vibe receipts into `specs/ai-tdd-contract-gate/`.
- Keep ignored legacy local copies as non-authoritative draft/runtime artifacts.
- Update references from ignored `docs/requirements/...` paths to `specs/ai-tdd-contract-gate/requirement.md`.

## Wave 2 - ACC/E2E Contract Surface

- Schemaize `acceptanceTests[]` and `e2eSuites[]` in the requirement-record schema.
- Update requirements-contract-authoring authoritative block and workflow rules to include `ACC-*` and `E2E-*`.
- Update renderer to validate and render acceptance/e2e suites as first-class rows.
- Update reverse audit to validate `ACC/E2E` refs, missing coverage, unknown refs, missing files, and smoke-only invalid proof.

## Wave 3 - Core Gate Full Version

- Extend `scripts/ai-tdd-contract-gate.ts` to normalize explicit `ACC/E2E` rows.
- Add controlled pre-implementation red evidence ingest and explicit real-command execution opt-in.
- Refine `redGreenMatrix` to include every `MUST/NEG/EVD/TRACE/CMD/ACC/E2E/ART/GATE` row with current-attempt binding.
- Preserve read-only behavior unless a separate controlled writer is explicitly confirmed.

## Wave 4 - Closeout Enforcement

- Change delivery closeout from opt-in AI-TDD enforcement to default enforcement for confirmed records with a resolvable source.
- Preserve legacy/no-source compatibility only when no confirmed source can be resolved.
- Ensure reverse audit `delivery_not_ready` and sub-gate failures bubble to the outer closeout decision.

## Wave 5 - Verification

- Add or extend acceptance tests for schema/renderer/reverse-audit `ACC/E2E`.
- Add AI-TDD matrix and red-proof evidence ingest tests.
- Add closeout default enforcement tests.
- Run targeted Vitest, TypeScript check, and encoding integrity gate.

## Rollback

- Revert only AI-TDD-related files touched by this plan.
- Do not revert unrelated dirty-worktree changes.
- Keep ignored legacy drafts untouched unless the user explicitly requests cleanup.

