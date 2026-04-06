---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs: 
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: |
      Execute /speckit.implement in full. MANDATORY before any coding: create prd.{stem}.json and progress.{stem}.txt per ralph-method (step 3.5). Follow TDD red-green-refactor per task; update prd/progress per US (steps 6, 8). Load commands/speckit.implement.md and follow all steps including 3.5, 6, 8.
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `_bmad/speckit/scripts/powershell/check-prerequisites.ps1 -Json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities), IMPLEMENTATION_GAPS.md (or the latest versioned gaps doc)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - **If already split out**: journey-ledger.md, invariant-ledger.md, trace-map.json
   - Note: Not all projects have all optional documents. Generate tasks from the strongest available journey / gap evidence and surface missing contract artifacts explicitly.

2.5 **Plan-Only Bootstrap Gate (HARD RULE)**:
   - `/speckit.tasks` MUST NOT generate `tasks.md` from `plan.md` alone by default.
   - It MAY enter `PLAN_ONLY_BOOTSTRAP` mode only when **all** of the following are true:
     - The feature is a **standalone greenfield bootstrap** with no upstream requirements source:
       - no PRD
       - no Epic/Story document
       - no original requirements/design document
       - no existing `spec.md`
     - There is no comparable current implementation to diff against, so `IMPLEMENTATION_GAPS` is genuinely `N/A`, not merely missing or skipped.
     - `plan.md` is already self-sufficient and explicitly defines all of the following:
       - `P0 journeys`
       - user-visible completion state for each journey
       - smoke proof for each journey
       - full E2E proof, or an explicit deferred reason
       - closure note path for each journey
       - dependency semantics
       - owner / permission boundaries
       - fixture / environment readiness
       - failure / recovery / rollback / exception boundaries
     - `plan.md` contains no unresolved `NEEDS CLARIFICATION` items and the constitution gate has already passed.
   - If and only if all conditions above are true, `/speckit.tasks` MAY generate `tasks.md` in `PLAN_ONLY_BOOTSTRAP` mode.
   - When using `PLAN_ONLY_BOOTSTRAP` mode, the generated `tasks.md` MUST explicitly include:
     - `PLAN_ONLY_BOOTSTRAP`
     - `Definition Gap = N/A (greenfield bootstrap)`
     - `Implementation Gap = N/A (pre-implementation bootstrap)`
     - a complete `Journey -> Task -> Test -> Closure` mapping for every `P0 journey`
     - the full journey-level smoke/closure/trace contract for every `P0 journey`
     - explicit `Smoke Task Chain`, `Closure Task ID`, and task-level `Trace ID` coverage for every `P0 journey`
   - `/speckit.tasks` MUST REFUSE plan-only generation and STOP with an explicit blocker if **any** of the following is true:
     - `spec.md` is missing while any upstream requirements source exists
     - `IMPLEMENTATION_GAPS.md` is missing in any non-bootstrap scenario
     - PRD, Epic/Story, original requirements, or design documents exist but are not mapped
     - `plan.md` does not define a complete runnable-slice contract
     - `plan.md` still contains unresolved clarifications
     - the requested output would produce module-complete tasks without runnable journey proof
   - Required refusal messages should be explicit. Prefer messages such as:
     - `Blocked: spec.md is required to establish user journeys, priority, and requirement coverage.`
     - `Blocked: IMPLEMENTATION_GAPS.md is required to separate definition gaps from implementation gaps.`
     - `Blocked: upstream requirements sources exist, so plan-only task generation is prohibited.`
     - `Blocked: plan.md does not yet define a complete runnable-slice contract for plan-only bootstrap generation.`

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure, `P0 journey`, smoke E2E expectations, fixture / environment readiness constraints, and dependency semantics
   - Load spec.md and extract user stories with priorities plus user-visible journey outcomes
   - Load IMPLEMENTATION_GAPS.md and separate `definition gap` from `implementation gap`
   - Build or refresh a `journey ledger`, `invariant ledger`, and `journey -> task -> test -> closure` trace map
   - If data-model.md exists: Extract entities and map them to journeys, not only to modules
   - If contracts/ exists: Map endpoints to journeys and identify smoke/full proof points
   - If research.md exists: Extract decisions for setup or foundational tasks, but keep those tasks attached to a named Journey ID
   - Generate tasks organized by `runnable slice` (see Task Generation Rules below)
   - Generate dependency graph showing journey completion order and at least one smoke path task chain per journey
   - Create parallel execution examples per journey slice
   - Validate task completeness: each journey has implementation, evidence, smoke proof, and closure coverage

4. **Generate tasks.md**: Use `_bmad/speckit/templates/tasks-template.md` (or the project's bound tasks template path) as structure, fill with:
   - Correct feature name from plan.md
   - `P0 Journey Ledger`
   - `Invariant Ledger`
   - `Runnable Slice Milestones`
   - One `Journey Slice` per runnable journey, in priority order
   - Slice metadata including `Journey ID`, `Invariant IDs`, `Evidence Type`, `Verification Command`, `Definition Gap Handling`, `Implementation Gap Handling`, `Journey Unlock`, `Smoke Path Unlock`, and `Closure Note Path`
   - One explicit `Smoke Task Chain` and one explicit `Closure Task ID` per journey so smoke/closure coverage is traceable at task level
   - Separate `Definition Gap Tasks` and `Implementation Gap Tasks`
   - `Closure Notes` section with one closure note path per journey
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Every task must carry `Journey ID`, `Trace ID`, and the right evidence / task-type label
   - Every journey must contain at least one smoke path task chain plus one closure note task
   - Clear file paths for each task
   - Dependencies section showing journey completion order
   - Parallel execution examples per journey
   - Implementation strategy section (MVP first, incremental delivery)
   - For multi-agent mode: explicit shared artifact requirement for one journey ledger, one invariant ledger, and one trace map via the same path reference
   - For multi-agent mode: record `Shared Journey Ledger Path`, `Shared Invariant Ledger Path`, and `Shared Trace Map Path`; private summaries are not sufficient

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per journey
   - Parallel opportunities identified
   - Smoke proof / full E2E / closure coverage for each journey
   - Suggested MVP scope (typically just the first runnable P0 journey)
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)
   - Trace validation: Confirm `journey -> task -> test -> closure` coverage and whether any gaps remain definition-only vs implementation-only

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by `journey / runnable slice` so the user-visible path becomes runnable and verifiable without waiting for module-complete cleanup.

**Tests are OPTIONAL**: Only generate formal test tasks if explicitly requested in the feature specification or if the user requests TDD. However, every `P0 journey` MUST still have smoke proof, verification command, and closure note coverage.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] [Journey?] [Invariant?] [Trace?] [Type?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: Include ONLY if task is parallelizable (different files, no dependencies on incomplete tasks)
4. **[Story] label**:
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Journey slice tasks MUST have a story label
   - Shared setup / foundational tasks may omit it only if the owning journey is still explicit
5. **[Journey] label**:
   - REQUIRED for every setup, foundational, and journey task
   - Format: [J01], [J02], [J03], etc.
6. **[Invariant] label**:
   - Use [INV-02] when the task protects an invariant
   - Use [INV-N/A] only when no invariant applies and the reason is written in slice metadata
7. **[Trace] label**:
   - REQUIRED for every task
   - Format: [TR-J01-T021] or another stable project convention derived from journey + task id
8. **[Type] label**:
   - REQUIRED for every task
   - Prefer [FOUNDATION], [IMPLEMENT], [SMOKE], [FULL-E2E], [EVIDENCE], [CLOSURE], [DEF-GAP], [IMPL-GAP]
9. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 [J01] [INV-N/A] [TR-J01-T001] [FOUNDATION] Create project structure in src/ for Journey J01`
- ✅ CORRECT: `- [ ] T005 [P] [US1] [J01] [INV-02] [TR-J01-T005] [SMOKE] Add checkout smoke test in tests/e2e/smoke/checkout.spec.ts`
- ✅ CORRECT: `- [ ] T012 [P] [US1] [J01] [INV-02] [TR-J01-T012] [IMPLEMENT] Create Order model in src/models/order.py`
- ✅ CORRECT: `- [ ] T014 [US1] [J01] [INV-02] [TR-J01-T014] [CLOSURE] Write closure note in closure-notes/J01.md`
- ❌ WRONG: `- [ ] Create User model` (missing ID and trace labels)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing Journey / Trace / file path)
- ❌ WRONG: `- [ ] T030 [US2] [J02] [TR-J02-T030] [IMPLEMENT] Finish backend before wiring later` (non-runnable completion language)

### Task Organization

1. **From P0 Journeys (spec.md + plan.md)** - PRIMARY ORGANIZATION:
   - Each runnable journey gets its own top-level slice
   - Map all related components to the journey:
     - Models or entities needed for the journey
     - Services needed for the journey
     - Endpoints/UI needed for the journey
     - Smoke proof, full E2E or deferred reason, closure note
   - Mark journey dependencies; do not let a slice become a loose technical bucket

2. **From Contracts**:
   - Map each contract/endpoint → to the journey it serves
   - If tests requested: each contract should produce test tasks in the same journey slice
   - Mark which contract task is smoke proof vs full E2E vs supporting evidence

3. **From Data Model**:
   - Map each entity to the journey or invariant that needs it
   - If an entity serves multiple journeys: attach it to the earliest runnable slice or to a clearly tagged shared prerequisite with Journey IDs
   - Relationships → implementation tasks inside the appropriate journey slice

4. **From Setup/Infrastructure**:
   - Shared infrastructure is allowed only if it names the journey(s) it unlocks
   - Foundational / blocking tasks must remain inside the affected journey slice or in a clearly tagged shared prerequisite section
   - Story-specific setup belongs inside that story's runnable slice

5. **From Gaps**:
   - `Definition gap` tasks must be listed separately from `implementation gap` tasks
   - A missing contract, role definition, completion state, fixture, permission boundary, or dependency semantic is a definition gap
   - A missing code path, missing wiring, failing proof, or missing closure note is an implementation gap

### Top-Level Structure

- `P0 Journey Ledger`
- `Invariant Ledger`
- `Runnable Slice Milestones`
- One `Journey Slice` per runnable journey
- `Definition Gap Tasks`
- `Implementation Gap Tasks`
- `Closure Notes`

Every runnable slice must carry:

- `Journey ID`
- `Invariant IDs` or explicit `INV-N/A` reason
- `Evidence Type`
- `Verification Command`
- `Definition Gap Handling`
- `Implementation Gap Handling`
- `Journey Unlock`
- `Smoke Path Unlock`
- `Smoke Task Chain`
- `Closure Task ID`
- `Closure Note Path`

### Generation Guardrails

- Every journey MUST have at least one `smoke path` task chain.
- Every journey MUST have one `closure note` task.
- Do not merge multiple journeys into one module bucket just because they share files.
- Do not produce “module complete but journey not runnable” task plans.
- In multi-agent mode, all agents must share the same `journey ledger`, `invariant ledger`, and `trace map` via the same path reference; private summaries are not sufficient.
