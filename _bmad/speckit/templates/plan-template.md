# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`
**Plan Mode**: `STANDARD` or `PLAN_ONLY_BOOTSTRAP_CANDIDATE`
**Upstream Requirement Sources**: [original requirements doc / PRD / Epic-Story / design doc / spec.md]

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Hard Rules

- `plan.md` MUST trace back to both the upstream requirement source and `spec.md`; missing traceability is a blocker, not a warning.
- The plan MUST be organized around runnable user-visible journeys / slices, not only around technical modules or layers.
- Every `P0` journey MUST define user-visible completion state, smoke proof, and either full E2E proof or an explicit deferred reason.
- Every `P0` journey MUST define its closure note path, dependency semantics, owner / permission boundary, fixture / environment readiness, and failure / recovery / rollback / exception boundaries.
- Any unresolved `NEEDS CLARIFICATION` that changes runnable behavior, journey completion, permissions, environment readiness, or acceptance proof blocks `PLAN_ONLY_BOOTSTRAP` and should normally block planning readiness.
- `PLAN_ONLY_BOOTSTRAP_CANDIDATE` does not mean allowed by default; `/speckit.tasks` must still apply its hard gate before plan-only task generation is permitted.

## 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| §1 | spec §User Story 1 / FR-001 | plan §Summary / §P0 Journey Ledger | ✅ / ❌ |
| §2 | spec §User Story 2 / FR-00X | plan §Project Structure / §Runnable Slice Contract | ✅ / ❌ |

**说明**：
- 需求文档与 `spec.md` 的每一章、每一条须在 `plan.md` 中有明确对应。
- 若为 greenfield/bootstrap 场景，上游来源可写为 `user prompt`、`bootstrap brief` 或等价输入，但不得留空。
- 任一 `❌` 必须在本轮补齐，或明确转入 `NEEDS CLARIFICATION` 并阻断进入后续 GAPS / tasks。

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Readiness Gate

| Gate | Status | Evidence |
|------|--------|----------|
| Constitution gate | Pass / Fail | [constitution reference or rationale] |
| Spec audit gate | Pass / Fail | [audit report / path] |
| Clarification gate | Pass / Fail | [open CL IDs or "none"] |
| Plan-only bootstrap candidate | Yes / No | [why / why not] |

## P0 Journey Ledger

| Journey ID | spec.md source | User-visible completion state | Smoke proof | Full E2E / deferred reason | Closure note path |
|------------|----------------|-------------------------------|-------------|----------------------------|-------------------|
| J01 | User Story 1 / FR-001 | [What the user can now do] | [test / command / proof] | [test / command] or Deferred: [reason] | `closure-notes/J01.md` |
| J02 | User Story 2 / FR-00X | [What the user can now do] | [test / command / proof] | [test / command] or Deferred: [reason] | `closure-notes/J02.md` |

## Runnable Slice Contract

| Journey ID | Dependency semantics | Owner / permission boundary | Fixture / environment readiness | Failure / recovery / rollback / exception boundaries | Open clarification? |
|------------|----------------------|-----------------------------|---------------------------------|------------------------------------------------------|---------------------|
| J01 | [What must already exist, and what this slice unlocks] | [Owner, actor, role, permission, tenancy boundary] | [Env vars, fixtures, services, test data, seed state] | [Failure mode, recovery path, rollback path, exception handling] | No / CL-001 |
| J02 | [What must already exist, and what this slice unlocks] | [Owner, actor, role, permission, tenancy boundary] | [Env vars, fixtures, services, test data, seed state] | [Failure mode, recovery path, rollback path, exception handling] | No / CL-002 |

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
  The selected stack and structure MUST be sufficient to execute the
  runnable-slice contract above, not just module-local implementation.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Clarification Ledger

| Clarification ID | Source section | Open question | Blocking impact | Resolution needed before |
|------------------|----------------|---------------|-----------------|--------------------------|
| CL-001 | §[N] / spec §[...] | [What is unclear?] | P0 / P1 / P2 / P3 | plan finalization / gaps / tasks |
| CL-002 | §[N] / spec §[...] | [What is unclear?] | P0 / P1 / P2 / P3 | plan finalization / gaps / tasks |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Planning Exit Criteria

- Every `P0` journey has a complete runnable-slice contract and no hidden dependency on unspecified behavior.
- Every upstream requirement chapter is mapped to both `spec.md` and `plan.md`.
- Any remaining `NEEDS CLARIFICATION` is explicitly logged with blocking impact and next gate.
- The plan defines enough information for `IMPLEMENTATION_GAPS.md` to distinguish `Definition Gap` from `Implementation Gap`.
- The plan does not allow a future `tasks.md` to devolve into module-complete work without runnable journey proof.
