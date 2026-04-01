---

description: "Journey-first task list template for runnable slice implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required unless `PLAN_ONLY_BOOTSTRAP` gate has explicitly passed), IMPLEMENTATION_GAPS.md (required unless `PLAN_ONLY_BOOTSTRAP` gate has explicitly passed), research.md, data-model.md, contracts/

**Tests**: Tests remain optional unless the feature specification requires them, but every `P0 journey` MUST define runnable smoke proof. If full E2E is deferred, the reason must be written explicitly.

**Organization**: Tasks are grouped by `journey / runnable slice`, not by frontend/backend/db buckets. Setup or foundational work may exist only when it clearly serves a named journey.

## Format: `[ID] [P?] [Story?] [Journey?] [Invariant?] [Trace?] [Type?] Description`

- **Task ID**: Always keep `- [ ] T001 ...` grammar so downstream parsers continue to work.
- **[P]**: Can run in parallel (different files, no blocking dependency on incomplete work).
- **[Story]**: Use `[US1]`, `[US2]`, `[US3]` for story-specific tasks.
- **[Journey]**: Every setup, foundational, and story task MUST carry a `Journey ID` such as `[J01]`.
- **[Invariant]**: Use `[INV-02]` when the task protects or proves an invariant; otherwise use `[INV-N/A]` with a reason in the slice metadata.
- **[Trace]**: Every task MUST carry a stable trace label such as `[TR-J01-T021]`.
- **[Type]**: Use labels such as `[FOUNDATION]`, `[IMPLEMENT]`, `[SMOKE]`, `[FULL-E2E]`, `[EVIDENCE]`, `[CLOSURE]`, `[DEF-GAP]`, `[IMPL-GAP]`.
- Include exact file paths in descriptions.

## Hard Rules

- Top-level slices MUST be organized by `journey / runnable slice`, not by `frontend / backend / db` modules.
- Any setup or foundational task that remains MUST explicitly declare which `Journey ID` it unlocks.
- Do not write “pure internal completion”, “later wire in”, “placeholder”, or similar non-runnable completion language.
- Every milestone MUST be written as `Journey Jxx smoke 跑通`, never as “frontend complete” or “backend complete”.
- `definition gap` and `implementation gap` MUST be tracked separately. Do not hide them inside a generic development task.
- Every runnable slice MUST end with an explicit `closure note` task.
- `tasks.md` MUST include the requirement traceability, gap mapping, and gap acceptance tables required by `speckit-workflow`.
- In any non-bootstrap scenario, missing `spec.md` or missing `IMPLEMENTATION_GAPS.md` is a hard blocker, not a warning.
- `PLAN_ONLY_BOOTSTRAP` is allowed only after the command-level hard gate has passed. When used, `tasks.md` MUST explicitly carry `PLAN_ONLY_BOOTSTRAP`, `Definition Gap = N/A (greenfield bootstrap)`, and `Implementation Gap = N/A (pre-implementation bootstrap)`.
- `PLAN_ONLY_BOOTSTRAP` MUST still preserve the journey-level smoke/closure/trace contract: every `P0 journey` keeps an explicit `Smoke Task Chain`, `Closure Task ID`, and task-level `Trace ID` coverage.
- If the current artifacts would produce only module-complete tasks without runnable journey proof, generation MUST stop and escalate the missing contract artifacts.

<!--
  ============================================================================
  IMPORTANT: The sections below are structural requirements, not sample output.

  /speckit.tasks MUST replace placeholders with actual tasks generated from:
  - P0 journeys and user stories in spec.md
  - journey-first architecture and readiness constraints in plan.md
  - definition / implementation gaps in IMPLEMENTATION_GAPS.md
  - entities, contracts, and research decisions from supporting artifacts

  Generated tasks.md MUST preserve:
  - generation mode / gate decision
  - journey ledger
  - invariant ledger
  - runnable slice milestones
  - requirement traceability tables
  - gap-to-task mapping tables
  - gap acceptance tables
  - closure notes
  - journey -> task -> test -> closure traceability
  ============================================================================
-->

## P0 Journey Ledger

| Journey ID | Story | User-visible goal | Blocking dependencies | Smoke proof | Full E2E / deferred reason | Closure note |
|------------|-------|-------------------|-----------------------|-------------|----------------------------|--------------|
| J01 | US1 | [Describe the first runnable journey] | [Key dependency] | `tests/e2e/smoke/...` | `tests/e2e/full/...` or deferred reason | `closure-notes/J01.md` |
| J02 | US2 | [Describe the next runnable journey] | [Key dependency] | `tests/e2e/smoke/...` | `tests/e2e/full/...` or deferred reason | `closure-notes/J02.md` |

## Invariant Ledger

| Invariant ID | Applies to Journey | Rule that must never break | Evidence type | Verification command | Owner task IDs |
|--------------|--------------------|----------------------------|---------------|----------------------|----------------|
| INV-01 | J01 | [Invariant statement] | integration / smoke-e2e | `[command]` | T00X, T00Y |
| INV-02 | J02 | [Invariant statement] | unit / integration | `[command]` | T00Z |

## Runnable Slice Milestones

- `M1`: Journey J01 smoke 跑通
- `M2`: Journey J02 smoke 跑通
- `M3`: All required closure notes written and trace map closed

## Generation Mode & Artifact Gate

| Field | Value |
|-------|-------|
| Generation Mode | `STANDARD` or `PLAN_ONLY_BOOTSTRAP` |
| Upstream requirements source | `[PRD / Epic-Story / original requirements doc / existing spec.md / N/A]` |
| `spec.md` status | `Present` or `N/A (PLAN_ONLY_BOOTSTRAP)` |
| `IMPLEMENTATION_GAPS.md` status | `Present` or `N/A (PLAN_ONLY_BOOTSTRAP)` |
| Definition Gap status | `Tracked` or `N/A (greenfield bootstrap)` |
| Implementation Gap status | `Tracked` or `N/A (pre-implementation bootstrap)` |
| Gate decision | `[Why generation is allowed]` |
| Blockers | `N/A` or `[explicit blocker that must stop generation]` |

> `PLAN_ONLY_BOOTSTRAP` is valid only for a standalone greenfield bootstrap with no upstream requirements source and no comparable implementation diff. In every other scenario, `spec.md` and `IMPLEMENTATION_GAPS.md` are mandatory.

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T001-T009 | `[requirements doc]` | `§1, §2` | `[Journey J01 outcome and acceptance point]` |
| T010-T015 | `[requirements doc]` | `§3` | `[Journey J02 outcome and acceptance point]` |

## Gaps → 任务映射（按需求文档章节）

**核对规则**：`IMPLEMENTATION_GAPS.md` 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| 第 1 章 | `GAP-1.1` | `✓ 有` | `T002, T016` |
| 第 2 章 | `GAP-2.3` | `✓ 有` | `T008, T018` |

## Gaps → 任务映射（四类汇总）

| 类别 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| `D` | `D1, D2` | `✓ 有` | `T002, T016, T017` |
| `S` | `S1, S2` | `✓ 有` | `T001, T010` |
| `I` | `I1, I2` | `✓ 有` | `T008, T018, T019` |
| `M` | `M1, M2` | `✓ 有` | `T003, T011, T012` |

## Journey -> Task -> Test -> Closure 映射

| Journey ID | Invariant IDs | Task IDs | Smoke Task Chain | Smoke Proof | Full E2E | Closure Task ID | Closure Note |
|------------|---------------|----------|------------------|-------------|----------|-----------------|--------------|
| J01 | `INV-01, INV-N/A` | `T001-T009` | `T003 -> T006 -> T007` | `tests/e2e/smoke/...` | `tests/e2e/full/...` or deferred reason | `T009` | `closure-notes/J01.md` |
| J02 | `INV-02` | `T010-T015` | `T011 -> T013 -> T014` | `tests/e2e/smoke/...` | `N/A` or deferred reason | `T015` | `closure-notes/J02.md` |

## Definition Gap vs Implementation Gap

| Gap Type | Source | Current Handling | Owner | Next Gate |
|----------|--------|------------------|-------|----------|
| Definition Gap | `spec / plan / readiness / audit` | `clarify / re-readiness / contract patch` | `PM / Architect / Owner` | `clarify / readiness` |
| Implementation Gap | `tasks / implement / verification / audit` | `code change / test fix / closure note` | `Dev / QA / Owner` | `implement / audit` |

---

## Journey Slice 1 - [Journey Title] (Priority: P1)

**Journey ID**: `J01`
**Story**: `US1`
**Invariant IDs**: `INV-01`, `INV-N/A` (reason: [why no additional invariant is needed])
**Evidence Type**: `smoke-e2e`, `full-e2e`, `closure-note`
**Verification Command**: `[command that proves Journey J01 is runnable]`
**Smoke Task Chain**: `T003 -> T006 -> T007`
**Smoke Proof**: `[test id / path / command]`
**Full E2E**: `[test id / path]` or `Deferred: [reason]`
**Closure Task ID**: `T009`
**Closure Note Path**: `closure-notes/J01.md`
**Definition Gap Handling**: `[Gap IDs or N/A]`
**Implementation Gap Handling**: `[Gap IDs or N/A]`
**Journey Unlock**: `Journey J01`
**Smoke Path Unlock**: `T003 -> T006 -> T007`

### Slice Prerequisites

- [ ] T001 [J01] [INV-N/A] [TR-J01-T001] [FOUNDATION] Create [shared prerequisite] in [path] to unlock Journey J01 smoke path `T003 -> T006 -> T007`
- [ ] T002 [J01] [INV-01] [TR-J01-T002] [DEF-GAP] Resolve [definition gap / missing contract] in [path]

### Tests & Evidence

- [ ] T003 [P] [US1] [J01] [INV-01] [TR-J01-T003] [SMOKE] Add smoke journey test in tests/e2e/smoke/[name].spec.[ext]
- [ ] T004 [P] [US1] [J01] [INV-01] [TR-J01-T004] [FULL-E2E] Add full E2E test or explicit deferred marker in tests/e2e/full/[name].spec.[ext]
- [ ] T005 [US1] [J01] [INV-01] [TR-J01-T005] [EVIDENCE] Record verification command and proof location in [path]

### Implementation

- [ ] T006 [P] [US1] [J01] [INV-01] [TR-J01-T006] [IMPLEMENT] Create or update [component/service/model] in [path]
- [ ] T007 [US1] [J01] [INV-01] [TR-J01-T007] [IMPLEMENT] Wire the production entry path in [path] so Journey J01 is runnable end to end
- [ ] T008 [US1] [J01] [INV-01] [TR-J01-T008] [IMPL-GAP] Close remaining implementation gap in [path]

### Closure

- [ ] T009 [US1] [J01] [INV-01] [TR-J01-T009] [CLOSURE] Write closure note for Journey J01 in closure-notes/J01.md

**Checkpoint**: Journey J01 smoke 跑通

---

## Journey Slice 2 - [Journey Title] (Priority: P2)

**Journey ID**: `J02`
**Story**: `US2`
**Invariant IDs**: `INV-02`
**Evidence Type**: `smoke-e2e`, `closure-note`
**Verification Command**: `[command that proves Journey J02 is runnable]`
**Smoke Task Chain**: `T011 -> T013 -> T014`
**Smoke Proof**: `[test id / path / command]`
**Full E2E**: `[test id / path]` or `Deferred: [reason]`
**Closure Task ID**: `T015`
**Closure Note Path**: `closure-notes/J02.md`
**Definition Gap Handling**: `[Gap IDs or N/A]`
**Implementation Gap Handling**: `[Gap IDs or N/A]`
**Journey Unlock**: `Journey J02`
**Smoke Path Unlock**: `T011 -> T013 -> T014`

### Slice Prerequisites

- [ ] T010 [J02] [INV-N/A] [TR-J02-T010] [FOUNDATION] Create [shared prerequisite] in [path] to unlock Journey J02 smoke path `T011 -> T013 -> T014`

### Tests & Evidence

- [ ] T011 [P] [US2] [J02] [INV-02] [TR-J02-T011] [SMOKE] Add smoke journey test in tests/e2e/smoke/[name].spec.[ext]
- [ ] T012 [US2] [J02] [INV-02] [TR-J02-T012] [EVIDENCE] Document verification command and expected proof in [path]

### Implementation

- [ ] T013 [P] [US2] [J02] [INV-02] [TR-J02-T013] [IMPLEMENT] Implement [component/service/model] in [path]
- [ ] T014 [US2] [J02] [INV-02] [TR-J02-T014] [IMPLEMENT] Connect Journey J02 to the production entry path in [path]

### Closure

- [ ] T015 [US2] [J02] [INV-02] [TR-J02-T015] [CLOSURE] Write closure note for Journey J02 in closure-notes/J02.md

**Checkpoint**: Journey J02 smoke 跑通

---

## Definition Gap Tasks

- [ ] T016 [US1] [J01] [INV-N/A] [TR-J01-T016] [DEF-GAP] Clarify unresolved fixture / environment / permission contract in [path]
- [ ] T017 [US2] [J02] [INV-N/A] [TR-J02-T017] [DEF-GAP] Clarify unresolved completion-state contract in [path]

## Implementation Gap Tasks

- [ ] T018 [US1] [J01] [INV-01] [TR-J01-T018] [IMPL-GAP] Close implementation drift between code and Journey J01 smoke path in [path]
- [ ] T019 [US2] [J02] [INV-02] [TR-J02-T019] [IMPL-GAP] Close implementation drift between code and Journey J02 evidence path in [path]

## Gap Acceptance

### 按需求文档章节（GAP-x.y）

表头说明：**生产代码实现要点**须列出文件、类、方法、代码实现细节；**集成测试要求**须列出测试文件、用例名、执行命令、预期结果；**执行情况**验收时必填（待执行/通过/失败及原因）；仅当两者满足且执行情况为通过时可勾选**验证通过**。

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| `GAP-1.1` | `T002, T016` | `[files / classes / methods / implementation detail]` | `[test file / case / command / expected result]` | `[ ] 待执行 / [x] 通过 / [ ] 失败（原因）` | `[ ] / [x]` |
| `GAP-2.3` | `T008, T018` | `[files / classes / methods / implementation detail]` | `[test file / case / command / expected result]` | `[ ] 待执行 / [x] 通过 / [ ] 失败（原因）` | `[ ] / [x]` |

### 四类汇总（D/S/I/M）

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| `D1` | `T002, T016, T017` | `[definition-side contract patch / doc update / readiness detail]` | `[verification command / expected evidence]` | `[ ] 待执行 / [x] 通过 / [ ] 失败` | `[ ] / [x]` |
| `S1` | `T001, T010` | `[shared prerequisite / slice dependency implementation detail]` | `[smoke setup command / expected evidence]` | `[ ] 待执行 / [x] 通过 / [ ] 失败` | `[ ] / [x]` |
| `I1` | `T008, T018, T019` | `[production wiring / smoke reachability / closure-ready implementation]` | `[integration or E2E command / expected evidence]` | `[ ] 待执行 / [x] 通过 / [ ] 失败` | `[ ] / [x]` |
| `M1` | `T003, T011, T012` | `[measurement / evidence / verification path detail]` | `[smoke or full E2E command / expected evidence]` | `[ ] 待执行 / [x] 通过 / [ ] 失败` | `[ ] / [x]` |

## Closure Notes

| Journey ID | Closure Task ID | Closure note path | Must name covered task IDs | Must name smoke / full E2E IDs | Deferred gaps allowed? |
|------------|-----------------|-------------------|----------------------------|--------------------------------|------------------------|
| J01 | `T009` | `closure-notes/J01.md` | T001-T009 | `SMOKE-J01`, `E2E-J01-FULL` or deferred reason | Yes, with owner and next gate |
| J02 | `T015` | `closure-notes/J02.md` | T010-T015 | `SMOKE-J02`, `E2E-J02-FULL` or deferred reason | Yes, with owner and next gate |

---

## Dependencies & Execution Order

### Slice Dependencies

- Foundation work may start immediately, but only if the task is tagged to a concrete `Journey ID`.
- Each journey slice must produce at least one runnable smoke chain before the next milestone is claimed.
- `Definition gap` tasks must close or explicitly escalate before the corresponding implementation task is marked done.
- `Closure` tasks are mandatory before a journey is considered complete.

### Within Each Journey Slice

- Tests or evidence tasks should be written before implementation when TDD is required.
- Production wiring tasks must prove the journey is reachable from the real entry path.
- Closure note task must be the final step of the slice.

### Parallel Opportunities

- Tasks marked `[P]` may run in parallel when they touch different files and do not block the same journey proof.
- Different journey slices may run in parallel only after their journey-specific prerequisites are complete and the shared ledgers remain aligned.

---

## Parallel Example: Journey J01

```bash
# Parallel proof work for Journey J01
Task: "T003 [SMOKE] Add smoke journey test in tests/e2e/smoke/[name].spec.[ext]"
Task: "T006 [IMPLEMENT] Create or update [component/service/model] in [path]"
```

---

## Implementation Strategy

### MVP First

1. Complete the minimum journey-specific prerequisites for `J01`
2. Make `Journey J01 smoke 跑通`
3. Write `closure-notes/J01.md`
4. Stop and validate before expanding scope

### Incremental Delivery

1. Finish `J01` smoke path and closure
2. Add `J02` only after `J01` is runnable and traceable
3. Expand to later journeys with the same smoke -> evidence -> closure rhythm

### Multi-Agent Strategy

1. **Shared Journey Ledger Path**: `journey-ledger.md`
2. **Shared Invariant Ledger Path**: `invariant-ledger.md`
3. **Shared Trace Map Path**: `trace-map.json`
4. Every agent must use the same path reference for these shared artifacts; private summaries are not sufficient.
5. Split work by runnable slice, not by technical layer
6. Reconcile closure notes before claiming the batch complete

---

## Notes

- Every task must remain runnable, traceable, and tied to a journey outcome.
- Avoid orphan module tasks that never connect to a smoke or full E2E path.
- Do not merge `definition gap` handling into `implementation gap` tasks.
- A journey is not done until smoke proof, evidence, and closure note all exist.
