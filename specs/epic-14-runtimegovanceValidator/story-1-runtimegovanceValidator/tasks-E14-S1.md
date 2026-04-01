# Tasks E14-S1 — Runtime Governance Story 14.1

## Phase 1: Speckit Document Recovery

- [ ] T001 Rebuild `specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/spec-E14-S1.md` from Story 14.1 authority and replace fresh-regression drifted content
- [ ] T002 Rebuild `specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/plan-E14-S1.md` with RuntimePolicy-first batch ordering and Story 14.1 implementation architecture
- [ ] T003 Rebuild `specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/IMPLEMENTATION_GAPS-E14-S1.md` to reflect current Runtime Governance blockers instead of fresh harness gaps
- [ ] T004 Rebuild `specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/tasks-E14-S1.md` so all tasks map to T1–T19 and first implementation batch locks T12/T13
- [ ] T005 Run Stage 1–4 document audit loop and persist updated audit evidence proving Story 14.1 runtime-governance authority alignment for rebuilt `spec-E14-S1.md`, `plan-E14-S1.md`, `IMPLEMENTATION_GAPS-E14-S1.md`, and `tasks-E14-S1.md`; audit artifacts must not describe fresh-install/fresh-regression harness as the implementation target

## Phase 2: First Code Batch Decomposition for T12/T13 (Blocking)

> This phase is not a separate pre-batch. It is the task-level decomposition of Story 14.1’s required first implementation batch: T12/T13 plus only the mirror/consumer-stability work needed to prove compatibility.

- [ ] T006 Create RuntimePolicy substructures in `scripts/runtime-governance.ts` for `identity`, `control`, and `language` while preserving current top-level fields as compatibility mirrors
- [ ] T007 [P] Add/extend only the schema/helper support in `scripts/runtime-governance-template-schema.ts` and adjacent helper paths that is strictly required for T12/T13 compatibility
- [ ] T008 [P] Add the minimum config support in `_bmad/_config/stage-mapping.yaml`, `_bmad/_config/runtime-mandatory-gates.yaml`, and `_bmad/_config/runtime-granularity-stages.yaml` that is inseparable from T12/T13 control-plane stabilization
- [ ] T009 [P] Add mirror compatibility coverage in `tests/acceptance/runtime-policy-structure-mirror.test.ts` and extend existing governance baseline tests only as required to prove T12/T13 do not break legacy consumers
- [x] T010 Update `docs/reference/runtime-governance-terms.md` and `docs/reference/runtime-policy-emit-schema.md` so the documented RuntimePolicy shape matches the T12/T13-first control-plane migration
- [x] T011 Verify first-batch parity by running `tests/acceptance/runtime-governance-policy.test.ts`, `tests/acceptance/runtime-governance-scoring-chain.test.ts`, and `tests/i18n/governance-boundary.test.ts` before any post-T12/T13 work starts

## Phase 3: User Story 1 — Stabilize RuntimePolicy Control Plane (Priority: P1) 🎯 MVP

**Goal**: Deliver the first implementation batch for Story 14.1 by stabilizing RuntimePolicy as the sole governance control plane with substructures and compatibility mirrors.

**Independent Test**: Mirror consistency, trigger-stage parity, scoring-chain alignment, and governance boundary tests all pass while old consumers still read equivalent top-level fields.

### Tests for User Story 1

- [x] T012 [P] [US1] Add mirror consistency tests in `tests/acceptance/runtime-policy-structure-mirror.test.ts` covering top-level fields vs `identity/control/language` substructures
- [x] T015 [US1] Refactor `scripts/runtime-governance.ts` to emit substructured RuntimePolicy objects while preserving compatibility mirrors and existing reason/trigger behavior
- [x] T013 [P] [US1] Extend `tests/acceptance/runtime-governance-scoring-chain.test.ts` to prove `implement` and `speckit_5_2` remain distinct registered trigger stages after the RuntimePolicy restructure
- [x] T014 [P] [US1] Extend `tests/i18n/governance-boundary.test.ts` to ensure language rendering never mutates governance-owned control fields after substructure migration
- [x] T016 [US1] Update `packages/scoring/trigger/trigger-loader.ts` and any direct governance consumers to read the normalized control plane without introducing a second trigger-stage resolution path
- [x] T017 [US1] Update `docs/reference/runtime-governance-terms.md` and `docs/reference/runtime-policy-emit-schema.md` so the documented RuntimePolicy shape matches the restructured control plane
- [x] T018 [US1] Record first-batch evidence in `_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator/progress.tasks-E14-S1.txt` and `prd.tasks-E14-S1.json`

## Phase 4: User Story 2 — Enable Story-Scoped Isolation (Priority: P2)

**Goal**: Add story identity, run identity, and concurrency-safe runtime context handling so Runtime Governance works correctly in multi-story execution.

**Independent Test**: Runtime context schema validation, policy input identity tests, emit concurrency tests, and score/state ordering tests pass without shared-context fallback in story-scoped mode.

### Tests for User Story 2

- [x] T019 [P] [US2] Add `tests/acceptance/runtime-context-schema.test.ts` to validate story-scoped runtime context fields and backward-compatible file loading
- [x] T020 [P] [US2] Add `tests/acceptance/runtime-governance-input-identity.test.ts` to verify story/run identity becomes observable in policy resolution output
- [x] T021 [P] [US2] Add `tests/acceptance/runtime-governance-concurrency-emit.test.ts`, `tests/acceptance/runtime-governance-score-idempotency.test.ts`, and `tests/acceptance/runtime-governance-state-ordering.test.ts` to freeze concurrent story behavior

### Implementation for User Story 2

- [x] T022 [US2] Extend `docs/reference/runtime-context.schema.json`, `scripts/runtime-context.ts`, and `scripts/write-runtime-context.js` for story-scoped identity and contextScope-aware semantics
- [x] T023 [US2] Update `scripts/emit-runtime-policy.ts` and `docs/reference/runtime-context.md` so explicit story-scoped context disables shared fallback and fails loudly when context is missing
- [x] T024 [US2] Extend `scripts/runtime-governance.ts` input types and reason generation to surface epic/story/run identity and artifactRoot for observability
- [x] T025 [US2] Update score/state write logic in the relevant scoring entrypoints to enforce authoritative-final-pass idempotency and monotonic stage ordering

## Phase 5: User Story 3 — Unify Dual-Host Automation and Language Governance (Priority: P3)

**Goal**: Finish the Story 14.1 production-consolidation chain by unifying Cursor/Claude host automation, language policy ownership, and skills boundary enforcement.

**Independent Test**: Native hooks / parity / language-policy / audit-report / scoring / trace / SFT regression paths pass while skills no longer own dynamic governance decisions.

### Tests for User Story 3

- [x] T026 [P] [US3] Add `tests/acceptance/runtime-governance-language-policy.test.ts`, `tests/acceptance/audit-report-language-policy.test.ts`, `tests/acceptance/scoring-language-policy.test.ts`, `tests/acceptance/trace-language-policy.test.ts`, and `tests/acceptance/sft-language-policy.test.ts`
- [x] T027 [P] [US3] Add Cursor native hooks / dual-host parity regression coverage in acceptance tests and host-specific validation paths
- [x] T028 [P] [US3] Add `tests/acceptance/skill-governance-boundary.test.ts` to freeze the “skills are thin orchestration only” boundary

### Implementation for User Story 3

- [x] T029 [US3] Update Cursor/Claude host adapter files and related docs so `.cursor/hooks.json` becomes the primary Cursor path and third-party hooks remain explicit fallback only
- [x] T030 [US3] Refactor `scripts/i18n/language-policy.ts`, rendering/reporting/scoring/trace integration points, and RuntimePolicy language substructure wiring so Runtime Governance becomes the sole language decision source
- [x] T031 [US3] Thin governance-heavy skill/prompt assets under `_bmad/claude/` and related runtime-governance documentation so they retain workflow skeletons but drop duplicated dynamic governance logic

## Phase 6: Polish & Cross-Cutting Closure

- [ ] T032 [P] Run the Story 14.1 gate commands from `_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator/14-1-runtimegovanceValidator.md` section 12 and capture evidence paths
- [ ] T033 [P] Update runtime governance reference/design documents in `docs/reference/` and `docs/design/` to remove PoC wording, align terminology, and reflect final production inputs under `_bmad/_config/`
- [ ] T034 Complete post-implementation audit evidence in `_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator/AUDIT_Story_14-1_stage4.md` and related scoring write inputs
- [ ] T035 Confirm Ralph tracking artifacts `_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator/prd.tasks-E14-S1.json` and `progress.tasks-E14-S1.txt` fully reflect completed user stories and TDD phases

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 must complete before any implementation work resumes.
- Phase 2 blocks all user stories because RuntimePolicy structure is the foundation for the rest of Story 14.1.
- User Story 1 must complete before User Story 2 and User Story 3 are declared ready, even if some exploratory tests can be prepared in parallel.
- User Story 2 should complete before User Story 3 host/language closure because dual-host and language governance both depend on story-scoped identity and emit correctness.
- Polish depends on all user stories being complete.

### User Story Dependencies

- **US1**: No dependency after document rebuild; delivers MVP control-plane stabilization.
- **US2**: Depends on US1’s RuntimePolicy substructure and compatibility mirrors.
- **US3**: Depends on US1 and US2 because host automation and language ownership must consume the stabilized control plane and story-scoped identity.

### Parallel Opportunities

- Test authoring tasks marked `[P]` can run in parallel when they touch distinct files.
- Config-file additions and registry/template support can run in parallel during Phase 2.
- Language-policy, parity, and skill-boundary tests can be split across separate files in Phase 5.

## Implementation Strategy

### MVP First

1. Rebuild spec/plan/GAPS/tasks.
2. Complete Phase 2 foundation.
3. Complete User Story 1 only.
4. Validate mirror consistency + scoring chain + governance boundary.
5. Only then continue to story-scoped isolation and dual-host/language closure.

### Incremental Delivery

1. Control plane stabilization (US1)
2. Story-scoped isolation (US2)
3. Dual-host + language ownership + skill lightening (US3)
4. CI / audit closure

<!-- AUDIT: PENDING REBUILD -->
