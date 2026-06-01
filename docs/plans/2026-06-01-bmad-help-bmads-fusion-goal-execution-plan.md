# Goal Execution Contract

---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:b67ad6fb7f8c3ea903f03c5b51331fd530252ece0d9b629bf8c11ee93d5c4b70
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: docs/requirements/2026-05-31-bmad-help-bmads-fusion-requirements.md
sourcePlanHash: sha256:ea1e635a9ec8e8bcda2abc3bffba0877f7f7736cc3828be115d2cc38c0cd0eac
goalContractFileTrackedPolicy: force_add_required_when_gitignored
runtimeRecordId: REQ-2026-05-31-BMAD-HELP-BMADS-FUSION
entryFlow: requirement_document_goal_contract
taskRange: G001-G011
acceptanceRange: AC-001-AC-040
completionGate: all_acceptance_items_and_changed_file_regressions_pass
repairPolicy: fix_contract_gaps_before_execution
stopPolicy: stop_on_unlisted_write_scope_or_unconfirmed_control_authority_change
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-01T10:55:25.450+08:00
---

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

```text
/goal docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md
```

The full execution contract is this document, not the command text.

## Contract Freeze Rules

- `/goal` must not rewrite this contract.
- `/goal` must not replace this contract with a different task list, acceptance matrix, completion gate, or authority model.
- `/goal` must not convert this template into a JSON-generates-Markdown design.
- `/goal` must not convert a consumer compiler into a hardcoded local Markdown string that bypasses shared template slots.
- If this contract is incomplete, `/goal` must stop with `contract_amendment_required` and list the missing fields.
- If acceptance criteria are insufficient, `/goal` must stop with `contract_amendment_required`; it must not silently add stricter acceptance criteria while executing.
- If a task requires files outside its declared write scope, `/goal` must stop with `scope_amendment_required` unless this contract explicitly allows scope expansion.
- If a requirement semantic decision is missing, `/goal` must stop with `semantic_decision_required`.
- If a validation command is unavailable, ambiguous, and not produced by a declared earlier or current task in this contract, `/goal` must stop with `validation_contract_required`.

## Contract Completeness Gate

Before editing files, verify this contract has all required sections:

- `/goal Entry`
- `Contract Freeze Rules`
- `Contract Completeness Gate`
- `Non-Negotiable Execution Rules`
- `Authority Model`
- `Root Cause To Fix`
- `Domain-Specific Contract Addenda`
- `Implementation Tasks`
- `Strict Acceptance Checklist`
- `Acceptance Traceability Matrix`
- `Required Test Commands`
- `Manual Verification Scenarios`
- `Completion Evidence Packet`
- `Stop Conditions`

Before editing files, verify the frozen front matter has no unresolved placeholders and that every required slot was rendered.

Fail closed when any required section, field, task ID, acceptance ID, evidence command, matrix row, slot, or invariant fragment is missing.

## Non-Negotiable Execution Rules

- Use the shell required by the host environment and repository rules.
- Use `apply_patch` for manual code and documentation edits.
- Run the project encoding gate before and after Markdown, JSON, skill, command, or generated-surface edits when the repository provides one.
- Inspect `git status --short` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, or tests.

## Authority Model

- `docs/requirements/2026-05-31-bmad-help-bmads-fusion-requirements.md` is the human requirement source for this execution contract.
- `sourcePlanHash=sha256:ea1e635a9ec8e8bcda2abc3bffba0877f7f7736cc3828be115d2cc38c0cd0eac` binds this contract to the current source document bytes after the root renderer removal migration path was clarified.
- This file is the frozen `/goal` execution authority for implementing the BMAD Help and BMADS fusion behavior.
- `model_packet.json is the machine-readable execution authority` for a later runtime implementation only after a confirmed requirement source and current RequirementRecord produce a packet through the req-trace compiler.
- `goal_execution.md is not execution authority`; it is a req-trace human execution projection and does not replace `model_packet.json`, RequirementRecord, or this frozen contract.
- `/goal completion is not closeout proof`; completion requires all strict acceptance rows and all changed-file regression commands in this document to pass.
- `RequirementRecord`, Control Event Journal, schema reducers, and controlled ingest remain the runtime control-state authority.
- `_bmad/_config/six-model-artifact-manifest.yaml` remains the six-model artifact authority.
- The new AI-TDD CSV files are display projection inputs only and MUST NOT write runtime control state.
- `packages/bmad-speckit/bin/bmad-speckit.js` is the only package CLI entry that may expose `bmad-speckit bmad-help` and `bmad-speckit bmads`.
- `packages/bmad-speckit/src/runtime/bmad-help-renderer.js` owns the package-deployed `bmad-help` user-facing projection.
- `packages/bmad-speckit/src/runtime/bmads-renderer.js` owns the package-deployed `bmads` user-facing projection.
- `packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.js` owns package-deployed current runtime next-action projection logic for these commands.
- `scripts/main-agent-delivery-closeout-gate.ts` owns delivery closeout gate execution and closeout acceptance lifecycle evidence.
- `_bmad/core/skills/bmad-help/workflow.md` and `_bmad/skills/bmad-help/workflow.md` own `bmad-help` workflow prose.
- `_bmad/skills/ai-tdd-runtime-navigator/workflow.md` documents the internal read-only runtime navigator projection used by `bmads` and `bmad-speckit` surfaces.
- `_bmad/skills/ai-tdd-runtime-navigator/workflow.md` MUST NOT own activation, orchestration, current mental model progression, root runtime authority, or a public command alias.
- The repository-root `_bmad/` directory is the only source-authoritative BMAD asset tree for this goal.
- `packages/bmad-speckit/_bmad/` is a prepack/prepublish generated package mirror, not a second source tree.
- `packages/bmad-speckit/_bmad/` MAY be absent from the working tree after `postpack` cleanup and MUST NOT be hand-maintained as persistent source.
- Package mirror validation MUST materialize the mirror through the existing prepack/prepublish sync path or inspect the packed tarball/consumer install, then compare it to the root `_bmad` source.

## Root Cause To Fix

The source requirement identifies a display and routing gap. `bmad-help` already has useful upstream workflow, catalog rows, command rows, and route prose that people understand. `bmads` must present the AI-TDD Six Mental Models with the same level of clarity, while each entry keeps its own job. `bmad-help` must preserve its upstream main body and add only short cross-entry runtime guidance. `bmads` must present the AI-TDD runtime panorama, active RequirementRecords, current model, blockers, and next safe action without taking over `bmad-help` content.

The implementation must convert the requirement prose into deterministic display projection assets, renderers, workflow documentation, and tests. The implementation must not make CSV files a control authority, must not expose `record_closed` as a user-executable action, must not hide delivery confirmation waiting states, and must not add a public `AI-TDD Navigator` command.

## Domain-Specific Contract Addenda

### Display Projection Authority Contract

- `ai-tdd-six-model-manifest.csv` MUST define the six mental models in order: `requirement_confirmation`, `architecture_confirmation`, `implementation_readiness`, `execution_closure`, `audit_review`, and `delivery_confirmation`.
- `ai-tdd-six-model-action-matrix.csv` MUST define display-only next-safe-action rows from model status, blocker condition, runtime next action, display route alias, and user-facing prompt.
- `ai-tdd-six-model-skill-routes.csv` MUST define skill route projection rows for `requirements-contract-authoring`, `req-trace-matrix-prompt-generator`, `goal-execution-contract-generator`, delivery closeout gate, closeout page rendering, and closeout acceptance ingest.
- `ai-tdd-reconfirmation-route-matrix.csv` MUST define reconfirmation projection rows for source hash drift, confirmation hash mismatch, architecture stale state, execution semantic gap, stale closeout page, stale acceptance request, and post-close defect intake.
- Every CSV row MUST set `canWriteControlState=false`.
- `controlledIngestWritesState=true` means the row displays an existing controlled ingest route that writes state.
- `controlledIngestWritesState=true` MUST NOT grant CSV, parser, renderer, or workflow code permission to write control state.
- A row with `controlledIngestWritesState=true` MUST also set `canWriteControlState=false`.
- A row with `controlledIngestWritesState=true` MUST bind `skill` and `mode` to an existing controlled ingest path.
- A row with `controlledIngestWritesState=true` MUST NOT set `runtimeNextAction=record_closed`.
- A row with `controlledIngestWritesState=true` MAY set `terminalEvent=record_closed` only as post-ingest terminal event display.
- A CSV parser MUST reject missing required headers, illegal enum values, illegal boolean values, absolute local paths, and invalid stable tokens.
- A CSV parser MUST return diagnostics with `file`, `row`, `column`, `code`, and `message`.
- A CSV parser MUST warn for unknown columns and MUST NOT fail the run for unknown columns.
- A CSV parser MUST warn for unknown row conditions, unknown blockers, and unknown display aliases.
- Display projection code MUST NOT mutate RequirementRecord JSON, Control Event Journal files, closeout reports, confirmation reports, or runtime gate outputs.

### BMAD Help Preservation Contract

- `bmad-help` default output MUST preserve its original section order.
- `bmad-help` default output MUST preserve its original information density.
- `bmad-help --catalog` MUST preserve the existing catalog row behavior.
- `bmad-help` MUST add only a short cross-entry block when active runtime state exists.
- The short cross-entry block MUST include `bmads` or `bmad-speckit`, view mode, primary runtime route, selected skill name, and one sentence telling the person when to switch.
- The short cross-entry block MUST NOT expand all active RequirementRecords.
- The short cross-entry block MUST NOT expand the full Six Mental Models panorama.
- The short cross-entry block MUST NOT expand full `delivery_confirmation` details.
- When upstream `bmad-help` guidance conflicts with governed runtime next action, the short cross-entry block MUST state that RequirementRecord runtime action takes precedence.

### BMADS Six-Model Runtime Console Contract

- `bmads` output MUST include `View Mode: AI-TDD Runtime Six-Model Panorama`.
- `bmads` output MUST include `Status Summary`.
- `bmads` output MUST include `Recommended Next Steps`.
- `bmads` output MUST include `Active Requirement Records`.
- `bmads` output MUST include `Six Mental Model Panorama`.
- `bmads` output MUST include `Runtime Workflow Guidance`.
- `bmads` output MUST include `Command Hints`.
- `bmads` output MUST include `See also: bmad-help`.
- For each active RequirementRecord, `bmads` MUST show `recordId`, source or short title, current mental model, schema model status, display state, blocker summary, next safe action, and `updatedAt` or current attempt/hash.
- When multiple active RequirementRecords exist, `bmads` MUST select one global primary record by safety priority and MUST print `Primary because:` followed by one non-empty stable reason token.
- `explicit_user_selection` MUST NOT override a higher-priority safety blocker.
- Secondary records MUST appear as secondary detail when a higher-priority safety blocker owns the primary route.

### Display Budget Resolver Contract

- The display budget resolver MUST support `compact`, `route`, `expanded`, and `full`.
- The display budget resolver MUST apply only to projection rows, skill detail, non-primary records, and short cross-entry blocks.
- The display budget resolver MUST NOT compress the owning entry's primary output.
- `bmad-help` default output MUST NOT lose its main body due to display budget.
- `bmads` primary safety route MUST remain visible in every display budget.
- `bmads --full` MUST still preserve the primary safety blocker before expanded secondary content.

### Delivery Confirmation Projection Contract

- A closeout gate pass that needs user acceptance MUST display `closeout-confirmation-current.html`.
- A closeout gate pass that needs user acceptance MUST display `closeout-render-report.json`.
- A closeout gate pass that needs user acceptance MUST display the current hash or current attempt identifier.
- A closeout gate pass that needs user acceptance MUST display the exact closeout confirmation instruction.
- A closeout gate pass that needs user acceptance MUST display `confirm-closeout-acceptance`.
- `record_closed` MUST appear only as a terminal event or terminal event status.
- `record_closed` MUST NOT appear as a user-executable primary route.
- Stale closeout page, stale attempt, hash mismatch, missing acceptance request, and open blocker MUST block terminal completion display.
- `confirm-closeout-acceptance` controlled ingest MUST be the visible next action before controlled ingest produces `record_closed`.

### Reconfirmation Route Contract

- Source semantic hash change MUST route to `requirements-contract-authoring` with `authoring-repair-preserve-existing`.
- Confirmation record hash mismatch MUST route to `requirements-contract-authoring` with confirmation regeneration and exact user confirmation.
- Architecture stale state MUST route to `requirements-contract-authoring` with `prepare-architecture-confirmation-page`.
- Execution semantic gap MUST route to source reconfirmation and MUST stop execution dispatch from stale packet state.
- Stale closeout page MUST route to closeout confirmation page rendering.
- Stale closeout acceptance request MUST route to `main-agent-delivery-closeout-gate` before acceptance ingest.
- Post-close defect MUST route to a linked bugfix requirement or closure integrity incident carrier.
- A closed origin record MUST remain immutable for post-close defect intake except under a new approved contract amendment.

### Public Entry Surface Contract

- `/goal` MUST NOT add a public `BMAD Navigator` entry.
- `/goal` MUST NOT add a public `ai-tdd-runtime-navigator` command.
- `/goal` MUST NOT add a public `ai-tdd-runtime-navigator` skill alias.
- `_bmad/skills/ai-tdd-runtime-navigator/workflow.md` MUST exist as an internal workflow document only.
- `_bmad/skills/ai-tdd-runtime-navigator/SKILL.md` MUST NOT be created by this goal.

### Existing Root Scripts Migration Contract

- `packages/bmad-speckit/bin/bmad-speckit.js` MUST remain the only package CLI entry for `bmad-speckit bmad-help` and `bmad-speckit bmads`.
- `/goal` MUST NOT add `packages/bmad-speckit/bin/bmad-help.js`.
- `/goal` MUST NOT add `packages/bmad-speckit/bin/bmads.js`.
- Package runtime implementation MUST live under `packages/bmad-speckit/src/runtime/**/*.js`.
- `scripts/bmads-renderer.ts` MUST be ported to `packages/bmad-speckit/src/runtime/bmads-renderer.js` and then removed from root `scripts/`.
- `scripts/bmad-help-renderer.ts` MUST be ported to `packages/bmad-speckit/src/runtime/bmad-help-renderer.js` and then removed from root `scripts/`.
- A root renderer tombstone, wrapper, replacement surface, or preserved root renderer surface MUST NOT be created for these two renderers.
- Root `package.json` `scripts.bmads` MUST NOT call `scripts/bmads-renderer.ts`, `ts-node`, `tsx`, or any root TypeScript renderer.
- If root `package.json` keeps `scripts.bmads`, it MUST call the package CLI path or installed CLI form for `bmads`.
- Root `package.json` `bin.bmad-speckit` MAY point to `scripts/bmad-speckit-cli.js` only as a root package trampoline.
- `scripts/bmad-speckit-cli.js` MUST only resolve and execute the installed or workspace package CLI at `packages/bmad-speckit/bin/bmad-speckit.js`.
- `scripts/bmad-speckit-cli.js` MUST NOT contain `bmads` renderer logic, `bmad-help` renderer logic, projection manifest logic, display budget logic, or runtime decision logic.
- Package CLI command blocks for `bmad-help` and `bmads` MUST NOT dispatch to root `scripts/*`, root npm aliases, `ts-node`, `tsx`, or repo-root TypeScript renderers.
- Root `scripts/*` migration proof MUST be explicit in tests or command evidence before completion is claimed.

### Excluded Scope Contract

- `NOT DONE` `/goal` MUST NOT implement user confirmation ingest behavior outside existing controlled ingest paths.
- `NOT DONE` `/goal` MUST NOT change the RequirementRecord schema authority without tests that prove backward-compatible runtime reads.
- `NOT DONE` `/goal` MUST NOT make CSV files write RequirementRecord state.
- `NOT DONE` `/goal` MUST NOT replace `bmad-help` upstream content with a shortened AI-TDD-only page.
- `NOT DONE` `/goal` MUST NOT replace `bmads` runtime view with upstream BMAD catalog content.
- `NOT DONE` `/goal` MUST NOT create new public commands for the internal runtime navigator workflow.
- `NOT DONE` `/goal` MUST NOT claim delivery completion from renderer output, snapshot output, or generated docs alone.

## Command Index

Run CMD-001, CMD-002, and CMD-003 before edits. Run CMD-004 through CMD-015 after edits.

| Command ID | Purpose |
| ---------- | ------- |
| CMD-001 | Capture pre-edit and post-edit worktree status. |
| CMD-002 | Run pre-edit encoding integrity gate. |
| CMD-003 | Verify frozen source requirement hash. |
| CMD-004 | Run targeted acceptance tests. |
| CMD-005 | Verify package mirror sync through byte comparison. |
| CMD-006 | Verify no public navigator entry surface, duplicate bin, new root script, or root-script CLI dispatch exists. |
| CMD-007 | Run `bmads` label smoke. |
| CMD-008 | Run static lint gate. |
| CMD-009 | Run post-edit encoding integrity gate. |
| CMD-010 | Capture ignored plan and requirement file status. |
| CMD-011 | Verify the generated goal contract file is tracked or staged with `git add -f`. |
| CMD-012 | Verify `bmad-help` baseline preservation fixture. |
| CMD-013 | Verify `bmads` active-record fixture fields. |
| CMD-014 | Verify packed package and consumer install smoke. |
| CMD-015 | Verify root renderer removal and root package trampoline boundary. |

## Implementation Tasks

### G001 Establish Preflight And Contract Boundary

Purpose: Prove the executor starts from a known state and edits only declared files.

Files:

- `docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md`
- `docs/requirements/2026-05-31-bmad-help-bmads-fusion-requirements.md`
- `package.json`
- `.gitattributes`

Steps:

1. Run CMD-001 from the repository root.
2. Run CMD-002 from the repository root.
3. Run CMD-003 from the repository root.
4. Run CMD-010 from the repository root.
5. Run CMD-011 from the repository root.
6. Verify CMD-003 output equals `ea1e635a9ec8e8bcda2abc3bffba0877f7f7736cc3828be115d2cc38c0cd0eac`.
7. Verify every planned write path appears in a G002 through G011 `Files` list.
8. Stop with `scope_amendment_required` before editing a path that is absent from this contract.
9. Stop with `source_requirement_changed_contract_amendment_required` when CMD-003 output differs from the frozen hash and the source change changes execution semantics.
10. Treat every G001 `Files` path as read-only preflight evidence.
11. Stop with `goal_contract_not_trackable` when CMD-011 cannot prove the generated contract file is tracked or explicitly force-staged.

Validation:

- CMD-001 proves worktree state.
- CMD-002 proves pre-edit encoding integrity.
- CMD-003 proves source requirement identity.
- CMD-010 proves ignored plan and requirement status is visible.
- CMD-011 proves the generated goal contract is not hidden by `.gitignore`.

Acceptance:

- AC-001
- AC-002
- AC-029
- AC-030

### G002 Create AI-TDD Projection CSV Manifests

Purpose: Materialize display projection manifests for the six-model panorama, next safe action, skill routes, and reconfirmation routes.

Files:

- `_bmad/_config/ai-tdd-six-model-manifest.csv`
- `_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv`

Generated package mirror evidence:

- `packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-manifest.csv`
- `packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `packages/bmad-speckit/_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv`

Steps:

1. Create `_bmad/_config/ai-tdd-six-model-manifest.csv` with the exact required headers from the source requirement.
2. Populate six rows for the six mental models in sequence `10`, `20`, `30`, `40`, `50`, and `60`.
3. Create `_bmad/_config/ai-tdd-six-model-action-matrix.csv` with the exact required headers from the source requirement.
4. Populate rows for requirement confirmation rendering, requirement confirmation ingest, architecture confirmation rendering, readiness gate, execution dispatch, audit dispatch, delivery closeout, closeout page rendering, closeout acceptance waiting, and closeout acceptance ingest.
5. Create `_bmad/_config/ai-tdd-six-model-skill-routes.csv` with the exact required headers from the source requirement.
6. Populate rows for `requirements-contract-authoring`, `req-trace-matrix-prompt-generator`, `goal-execution-contract-generator`, delivery closeout gate, closeout page rendering, and closeout acceptance ingest.
7. Create `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv` with the exact required headers from the source requirement.
8. Populate rows for `SOURCE_SEMANTIC_HASH_CHANGED`, `CONFIRMATION_RECORD_HASH_MISMATCH`, `ARCHITECTURE_STALE`, `EXECUTION_SEMANTIC_GAP`, `DELIVERY_CONFIRMATION_PAGE_STALE`, `DELIVERY_ACCEPTANCE_REQUEST_STALE`, and `POST_CLOSE_DEFECT`.
9. Do not hand-edit `packages/bmad-speckit/_bmad/_config/`; materialize those mirror files through `scripts/prepublish-check.js` or `npm pack`.
10. Ensure no CSV row contains an absolute local path.
11. Ensure no CSV row sets `canWriteControlState=true`.
12. Ensure every row with `controlledIngestWritesState=true` sets `canWriteControlState=false`.
13. Ensure every row with `controlledIngestWritesState=true` binds `skill` and `mode` to an existing controlled ingest path.
14. Ensure every row with `controlledIngestWritesState=true` does not set `runtimeNextAction=record_closed`.
15. Ensure every row with `terminalEvent=record_closed` renders that value only as post-ingest terminal event display.

Validation:

- CMD-004 proves parser behavior after G003.
- CMD-005 proves mirror sync after G009.
- CMD-009 proves encoding integrity.

Acceptance:

- AC-003
- AC-004
- AC-005
- AC-006
- AC-007
- AC-008
- AC-009
- AC-010
- AC-011
- AC-031

### G003 Implement Projection CSV Parser And Diagnostics

Purpose: Enforce manifest headers, enum values, booleans, stable tokens, local path rules, and warning diagnostics.

Files:

- `packages/bmad-speckit/src/runtime/ai-tdd/projection-manifest.js`
- `packages/bmad-speckit/tests/ai-tdd-projection-manifest.test.js`
- `_bmad/_config/ai-tdd-six-model-manifest.csv`
- `_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv`

Steps:

1. Create `packages/bmad-speckit/src/runtime/ai-tdd/projection-manifest.js`.
2. Export a parser function that accepts a CSV file path and a manifest kind.
3. Validate required headers for each of the four CSV files.
4. Validate `modelId`, `schemaStatus`, `runtimeNextAction`, `terminalEvent`, and boolean fields against the source requirement enum set.
5. Validate stable token fields against `^[a-z][a-z0-9_]*$` or `none`.
6. Reject absolute local paths in artifact and output fields.
7. Return diagnostics with `warnings[]` and `errors[]`.
8. Include `file`, `row`, `column`, `code`, and `message` in every diagnostic object.
9. Treat unknown columns as warnings.
10. Treat unknown row conditions, unknown blockers, and unknown display aliases as warnings.
11. Add package tests in `packages/bmad-speckit/tests/ai-tdd-projection-manifest.test.js` for pass, missing required header, illegal enum, illegal boolean, invalid stable token, absolute local path, and unknown column warning.
12. Add acceptance tests proving `controlledIngestWritesState=true` does not grant parser, renderer, CSV, or workflow writer authority.
13. Add acceptance tests proving `controlledIngestWritesState=true` rows require `canWriteControlState=false`, a controlled ingest skill/mode, no `runtimeNextAction=record_closed`, and terminal-event-only `record_closed` display.

Validation:

- CMD-004 proves parser tests pass.
- CMD-008 proves static lint passes.

Acceptance:

- AC-003
- AC-004
- AC-005
- AC-012
- AC-031

### G004 Preserve BMAD Help Output And Add Short Runtime Cross-Entry Guidance

Purpose: Keep `bmad-help` as the upstream workflow panorama while adding only concise governed runtime guidance.

Files:

- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/projection-manifest.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/display-budget.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.js`
- `_bmad/_config/bmad-help.csv`
- `_bmad/core/skills/bmad-help/workflow.md`
- `_bmad/skills/bmad-help/workflow.md`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`
- `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`
- `packages/bmad-speckit/tests/bmad-help-display-budget.test.js`

Generated package mirror evidence:

- `packages/bmad-speckit/_bmad/_config/bmad-help.csv`
- `packages/bmad-speckit/_bmad/skills/bmad-help/workflow.md`

Steps:

1. Inspect the existing `bmad-help` default output order before editing.
2. Add the `bmad-help` subcommand to the existing `packages/bmad-speckit/bin/bmad-speckit.js` CLI entry.
3. Preserve the existing default section order in `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`.
4. Preserve the existing default catalog row rendering in `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`.
5. Add a short cross-entry block for active runtime state.
6. Include `bmads` or `bmad-speckit` in the short cross-entry block.
7. Include view mode in the short cross-entry block.
8. Include the primary runtime route or selected skill name in the short cross-entry block.
9. Include one switch sentence in the short cross-entry block.
10. Do not expand all active RequirementRecords in `bmad-help`.
11. Do not expand full Six Mental Models panorama in `bmad-help`.
12. Update both bmad-help workflow files with preservation and cross-entry rules.
13. Do not hand-edit package mirror files; verify the existing prepack/prepublish sync produces matching `packages/bmad-speckit/_bmad/` files.
14. Add tests that compare the preserved `bmad-help` main output labels before and after active runtime state.
15. Add a baseline fixture or inline expected label list for `bmad-help` default section order.
16. Add a baseline fixture or inline expected catalog row labels for `bmad-speckit bmad-help --catalog`.
17. Add a forbidden-removal assertion for existing `bmad-help` main output labels.
18. Do not add `packages/bmad-speckit/bin/bmad-help.js`.
19. Ensure the `bmad-help` subcommand in `packages/bmad-speckit/bin/bmad-speckit.js` requires or dispatches to `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`.
20. Ensure the `bmad-help` subcommand never calls `runRepoScript`, root `scripts/*`, a root npm alias, `tsx`, or a repo-root TypeScript renderer.

Validation:

- CMD-004 proves bmad-help regression tests pass.
- CMD-006 proves the package CLI does not dispatch `bmad-help` to root scripts.
- CMD-012 proves bmad-help baseline preservation.
- CMD-005 proves mirror sync passes.
- CMD-008 proves static lint passes.
- CMD-014 proves the packed package can run `bmad-speckit bmad-help` from a consumer install.

Acceptance:

- AC-013
- AC-014
- AC-015
- AC-016
- AC-017
- AC-018
- AC-019
- AC-032

### G005 Implement BMADS Six-Model Runtime Panorama

Purpose: Make `bmads` show the AI-TDD runtime panorama with active records, current location, blockers, and next safe action.

Files:

- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/projection-manifest.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/display-budget.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.js`
- `_bmad/_config/ai-tdd-six-model-manifest.csv`
- `_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`

Steps:

1. Add the `bmads` subcommand to the existing `packages/bmad-speckit/bin/bmad-speckit.js` CLI entry.
2. Load the three AI-TDD projection CSV files needed by `bmads`.
3. Render `View Mode: AI-TDD Runtime Six-Model Panorama`.
4. Render `Status Summary`.
5. Render `Recommended Next Steps`.
6. Render `Active Requirement Records`.
7. Render `Six Mental Model Panorama`.
8. Render `Runtime Workflow Guidance`.
9. Render `Command Hints`.
10. Render `See also: bmad-help`.
11. For every active RequirementRecord rendered, show `recordId`, source or short title, current mental model, schema model status, display state, blocker summary, next safe action, and `updatedAt` or current attempt/hash.
12. Select one global primary record using safety priority before user explicit selection.
13. Print `Primary because:` followed by one non-empty stable reason token for the selected global primary record.
14. Render secondary records with reduced detail when a safety blocker owns the primary route.
15. Ensure primary safety blocker and next safe action remain visible for every display budget.
16. Render `req-trace-matrix-prompt-generator` for `/goal` only when an active RequirementRecord has current source hash, current confirmation hash, satisfied current mental model state, and no reconfirmation, stale hash, stale attempt, awaiting acceptance, or open blocker.
17. Render the current `bmads` Next Safe Action instead of `req-trace-matrix-prompt-generator` when an active RequirementRecord has reconfirmation, stale hash, stale attempt, awaiting acceptance, or open blocker.
18. Render `goal-execution-contract-generator` only when no active RequirementRecord exists or the person asks for an independent goal execution contract.
19. Do not add `packages/bmad-speckit/bin/bmads.js`.
20. Ensure the `bmads` subcommand in `packages/bmad-speckit/bin/bmad-speckit.js` requires or dispatches to `packages/bmad-speckit/src/runtime/bmads-renderer.js`.
21. Ensure the `bmads` subcommand never calls `runRepoScript`, root `scripts/*`, a root npm alias, `tsx`, or a repo-root TypeScript renderer.

Validation:

- CMD-004 proves BMADS panorama tests pass.
- CMD-006 proves the package CLI does not dispatch `bmads` to root scripts.
- CMD-007 proves manual output labels exist.
- CMD-013 proves per-record fixture fields.
- CMD-008 proves static lint passes.
- CMD-014 proves the packed package can run `bmad-speckit bmads` from a consumer install.

Acceptance:

- AC-020
- AC-021
- AC-022
- AC-023
- AC-024
- AC-033

### G006 Implement Display Budget Resolver

Purpose: Apply `compact`, `route`, `expanded`, and `full` budgets without compressing the owning entry's primary output.

Files:

- `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`
- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/display-budget.js`
- `packages/bmad-speckit/tests/bmad-help-display-budget.test.js`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`

Steps:

1. Implement budget values `compact`, `route`, `expanded`, and `full`.
2. Apply the budget to projection rows, skill detail, non-primary records, and cross-entry blocks.
3. Preserve the owning entry's primary output in every budget.
4. Preserve `bmad-help` default main body in every budget.
5. Preserve the `bmads` primary safety route in every budget.
6. Add tests for each budget value.
7. Add tests proving physical line wrapping width is not an assertion target.

Validation:

- CMD-004 proves budget tests pass.
- CMD-008 proves static lint passes.

Acceptance:

- AC-025
- AC-026

### G007 Project Delivery Confirmation And Reconfirmation Routes

Purpose: Make closeout acceptance and reconfirmation states visible without exposing unsafe primary actions.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.js`
- `scripts/main-agent-delivery-closeout-gate.ts`
- `_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`
- `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts`
- `tests/acceptance/main-agent-reconfirmation-runtime.test.ts`

Steps:

1. Render closeout page path `closeout-confirmation-current.html` when delivery confirmation is awaiting user acceptance.
2. Render closeout report path `closeout-render-report.json` when delivery confirmation is awaiting user acceptance.
3. Render current hash or current attempt identifier when delivery confirmation is awaiting user acceptance.
4. Render exact confirmation instruction when delivery confirmation is awaiting user acceptance.
5. Render `confirm-closeout-acceptance` as the visible next action before record closure.
6. Render `record_closed` only as terminal event state.
7. Block `record_closed` display as a user-executable primary route.
8. Render source drift, confirmation mismatch, architecture stale state, execution semantic gap, stale closeout page, stale acceptance request, and post-close defect routes from the reconfirmation matrix.
9. Render a post-close defect route target that points to a linked bugfix requirement or closure integrity incident carrier.
10. Preserve closed origin record immutability in display text.
11. Do not create or mutate RequirementRecord files from renderer or projection code when rendering a post-close defect route.
12. Verify the displayed closeout page, closeout render report, delivery closeout report hash, current attempt, and acceptance request belong to the same active RequirementRecord current attempt.

Validation:

- CMD-004 proves delivery and reconfirmation tests pass.
- CMD-008 proves static lint passes.

Acceptance:

- AC-007
- AC-008
- AC-009
- AC-010
- AC-011
- AC-027
- AC-034

### G008 Add Internal Runtime Navigator Workflow

Purpose: Document the internal runtime navigator workflow without creating a public command or public skill alias.

Files:

- `_bmad/skills/ai-tdd-runtime-navigator/workflow.md`
- `_bmad/skills/bmad-help/workflow.md`
- `_bmad/core/skills/bmad-help/workflow.md`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`
- `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`

Generated package mirror evidence:

- `packages/bmad-speckit/_bmad/skills/ai-tdd-runtime-navigator/workflow.md`

Steps:

1. Create `_bmad/skills/ai-tdd-runtime-navigator/workflow.md`.
2. Do not create `_bmad/skills/ai-tdd-runtime-navigator/SKILL.md`.
3. Do not hand-create `packages/bmad-speckit/_bmad/skills/ai-tdd-runtime-navigator/workflow.md`; materialize it through the existing prepack/prepublish sync path.
4. Verify the generated package mirror and packed tarball do not contain `packages/bmad-speckit/_bmad/skills/ai-tdd-runtime-navigator/SKILL.md` or `_bmad/skills/ai-tdd-runtime-navigator/SKILL.md`.
5. Document that the workflow is internal to `bmads` and `bmad-speckit`.
6. Document that the workflow reads projection CSV files and runtime records only.
7. Document that the workflow never writes control state.
8. Add entry-surface tests proving no public command or public skill alias exists.

Validation:

- CMD-004 proves entry-surface tests pass.
- CMD-005 proves mirror sync passes.
- CMD-006 proves forbidden public files are absent.

Acceptance:

- AC-028

### G009 Synchronize Package Surfaces And Install Assets

Purpose: Keep package mirror surfaces aligned for config and workflow files that are distributed from this repository.

Files:

- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`
- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/projection-manifest.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/display-budget.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.js`
- `package.json`
- `.gitattributes`

Generated package mirror evidence:

- `packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-manifest.csv`
- `packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `packages/bmad-speckit/_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv`
- `packages/bmad-speckit/_bmad/_config/bmad-help.csv`
- `packages/bmad-speckit/_bmad/skills/bmad-help/workflow.md`
- `packages/bmad-speckit/_bmad/skills/ai-tdd-runtime-navigator/workflow.md`

Steps:

1. Treat repository-root `_bmad/` as the only hand-edited source tree.
2. Materialize `packages/bmad-speckit/_bmad/` with the existing `scripts/prepublish-check.js` sync path.
3. Verify materialized mirror files byte-match root `_bmad` files with CMD-005.
4. Run CMD-005.
5. Stop with `package_surface_mapping_required` when CMD-005 proves a required sync rule is absent from the current repository.
6. Edit `package.json` or `.gitattributes` only when CMD-005 or packaging evidence proves a missing package inclusion rule.
7. Do not add new root `scripts/*` files for renderer, parser, display budget, or runtime decision behavior.
8. Do not add `packages/bmad-speckit/bin/bmad-help.js` or `packages/bmad-speckit/bin/bmads.js`.
9. Run CMD-014 to prove package files and packed consumer execution include the package runtime and `_bmad` assets.

Validation:

- CMD-005 proves mirror sync.
- CMD-006 proves forbidden public and duplicate entry surfaces are absent.
- CMD-009 proves encoding integrity.
- CMD-014 proves package tarball and consumer install smoke.
- CMD-015 proves root renderer removal and root package trampoline boundaries.

Acceptance:

- AC-004
- AC-028
- AC-036
- AC-037

### G010 Migrate Existing Root Scripts And Compatibility Boundary

Purpose: Move deployable `bmad-help` and `bmads` runtime behavior out of root `scripts/`, remove the root TypeScript renderer files, and keep only an explicit root package trampoline where the root package install surface still needs one.

Files:

- `package.json`
- `scripts/bmad-speckit-cli.js`
- `scripts/bmads-renderer.ts`
- `scripts/bmad-help-renderer.ts`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`
- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/projection-manifest.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/display-budget.js`
- `packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.js`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`
- `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`

Steps:

1. Treat `packages/bmad-speckit/src/runtime/**/*.js` as the only deployable runtime implementation for `bmad-help` and `bmads`.
2. Port any still-needed behavior from `scripts/bmads-renderer.ts` into `packages/bmad-speckit/src/runtime/bmads-renderer.js`.
3. Port any still-needed behavior from `scripts/bmad-help-renderer.ts` into `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`.
4. Remove `scripts/bmads-renderer.ts` and `scripts/bmad-help-renderer.ts`; root-only developer workflows must use `node packages/bmad-speckit/bin/bmad-speckit.js bmads` or `node packages/bmad-speckit/bin/bmad-speckit.js bmad-help`.
5. Do not leave a tombstone, wrapper, replacement surface, or any preserved root renderer surface for either root renderer.
6. Update root `package.json` `scripts.bmads` so it does not call `scripts/bmads-renderer.ts`, `ts-node`, `tsx`, or any root TypeScript renderer.
7. If root `package.json` keeps `scripts.bmads`, make it call `node packages/bmad-speckit/bin/bmad-speckit.js bmads` or `bmad-speckit bmads`.
8. Keep root `package.json` `bin.bmad-speckit` pointed at `scripts/bmad-speckit-cli.js` only when root package install compatibility still requires the trampoline.
9. Keep `scripts/bmad-speckit-cli.js` as a trampoline to installed or workspace `packages/bmad-speckit/bin/bmad-speckit.js` only.
10. Ensure `scripts/bmad-speckit-cli.js` contains no renderer, projection manifest, display budget, or runtime decision implementation.
11. Ensure `packages/bmad-speckit/bin/bmad-speckit.js` command blocks for `bmad-help` and `bmads` dispatch only to package runtime JS files.
12. Ensure `packages/bmad-speckit/bin/bmad-speckit.js` command blocks for `bmad-help` and `bmads` never call root `scripts/*`, root npm aliases, `ts-node`, `tsx`, or repo-root TypeScript renderers.
13. Add or update package and acceptance tests that prove package CLI behavior is independent of root `scripts/*` and that the removed root renderer files are absent.
14. Run CMD-006 and CMD-015 before claiming the migration boundary is complete.
15. Stop with `root_legacy_runtime_dispatch_violation` if any package or packed-consumer path dispatches to root legacy renderers.

Validation:

- CMD-006 proves no new root runtime script and no package CLI root-script dispatch exists.
- CMD-012 proves `bmad-help` still preserves its baseline after migration.
- CMD-013 proves `bmads` active-record output still works after migration.
- CMD-014 proves the packed package and consumer install use package runtime files.
- CMD-015 proves root `package.json`, root package trampoline, removed root renderers, and package command blocks follow the migration boundary.

Acceptance:

- AC-036
- AC-037
- AC-038
- AC-039
- AC-040

### G011 Run Final Verification And Evidence Capture

Purpose: Prove the implementation satisfies every acceptance row and changed-file regression command.

Files:

- `docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md`

Steps:

1. Run CMD-001.
2. Run CMD-004.
3. Run CMD-005.
4. Run CMD-006.
5. Run CMD-007.
6. Run CMD-008.
7. Run CMD-009.
8. Run CMD-010.
9. Run CMD-011.
10. Run CMD-012.
11. Run CMD-013.
12. Run CMD-014.
13. Run CMD-015.
14. Collect command exit codes and output summaries.
15. Map each passing command to the acceptance rows it proves.
16. Stop with `completion_evidence_missing` when any acceptance row lacks direct command or artifact evidence.

Validation:

- CMD-001 through CMD-015 prove final completion status.

Acceptance:

- AC-001
- AC-002
- AC-003
- AC-004
- AC-005
- AC-006
- AC-007
- AC-008
- AC-009
- AC-010
- AC-011
- AC-012
- AC-013
- AC-014
- AC-015
- AC-016
- AC-017
- AC-018
- AC-019
- AC-020
- AC-021
- AC-022
- AC-023
- AC-024
- AC-025
- AC-026
- AC-027
- AC-028
- AC-029
- AC-030
- AC-031
- AC-032
- AC-033
- AC-034
- AC-035
- AC-036
- AC-037
- AC-038
- AC-039
- AC-040

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

- [ ] AC-001: CMD-001 output shows the branch, dirty files, and no reverted unrelated user changes.
- [ ] AC-002: CMD-002 passes before edits and CMD-009 passes after edits with `findings=0`.
- [ ] AC-003: `_bmad/_config/ai-tdd-six-model-manifest.csv`, `_bmad/_config/ai-tdd-six-model-action-matrix.csv`, `_bmad/_config/ai-tdd-six-model-skill-routes.csv`, and `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv` exist with the required headers.
- [ ] AC-004: The four AI-TDD CSV files are generated into the package mirror by the existing prepack/prepublish sync path and byte-match the root `_bmad/_config/` source files when the mirror is materialized.
- [ ] AC-005: The six-model manifest contains exactly six model rows with model IDs `requirement_confirmation`, `architecture_confirmation`, `implementation_readiness`, `execution_closure`, `audit_review`, and `delivery_confirmation`.
- [ ] AC-006: The action matrix contains rows for requirement confirmation, architecture confirmation, readiness, execution, audit, delivery closeout, closeout page rendering, closeout acceptance waiting, and closeout acceptance ingest.
- [ ] AC-007: The delivery closeout projection row displays `confirm-closeout-acceptance` before `record_closed`.
- [ ] AC-008: `record_closed` is represented only as terminal event state and never as a user-executable primary route.
- [ ] AC-009: Closeout awaiting acceptance display includes `closeout-confirmation-current.html`, `closeout-render-report.json`, current hash or attempt, exact confirmation instruction, and `confirm-closeout-acceptance`.
- [ ] AC-010: Stale closeout page, stale attempt, hash mismatch, missing acceptance request, and open blocker prevent terminal completion display.
- [ ] AC-011: Controlled ingest rows use `controlledIngestWritesState=true`, and projection-only rows use `canWriteControlState=false`.
- [ ] AC-012: CSV parser diagnostics include `file`, `row`, `column`, `code`, and `message`; parser tests cover missing header, illegal enum, illegal boolean, invalid stable token, absolute local path, and unknown column warning.
- [ ] AC-013: `bmad-speckit bmad-help` default output preserves the original main section order.
- [ ] AC-014: `bmad-help` default output preserves original information density and does not replace the main body with AI-TDD runtime content.
- [ ] AC-015: `bmad-speckit bmad-help --catalog` preserves existing catalog row behavior.
- [ ] AC-016: `bmad-help` active runtime output adds only a short cross-entry block containing `bmads` or `bmad-speckit`, view mode, primary route or skill, and one switch sentence.
- [ ] AC-017: `bmad-help` active runtime output does not expand all active RequirementRecords.
- [ ] AC-018: `bmad-help` active runtime output does not expand full Six Mental Models panorama.
- [ ] AC-019: `bmad-help` states RequirementRecord runtime action takes precedence when upstream guidance conflicts with governed runtime next action.
- [ ] AC-020: `bmad-speckit bmads` output contains `View Mode: AI-TDD Runtime Six-Model Panorama`, `Status Summary`, `Recommended Next Steps`, `Active Requirement Records`, `Six Mental Model Panorama`, `Runtime Workflow Guidance`, `Command Hints`, and `See also: bmad-help`.
- [ ] AC-021: `bmad-speckit bmads` output lists each active record with `recordId`, source or title, current mental model, schema model status, display state, blocker summary, next safe action, and `updatedAt` or current attempt/hash.
- [ ] AC-022: Multiple active records produce one global primary record and print `Primary because:` followed by one non-empty stable reason token.
- [ ] AC-023: `explicit_user_selection` cannot override `awaiting_user_acceptance`, open reconfirmation, stale hash, stale attempt, delivery closeout blocker, or readiness blocker.
- [ ] AC-024: `/goal` route display recommends `req-trace-matrix-prompt-generator` when an active RequirementRecord has current source/hash and recommends `goal-execution-contract-generator` only for independent goal contract generation or missing active record.
- [ ] AC-025: Display budget values `compact`, `route`, `expanded`, and `full` exist and affect only projection rows, skill detail, non-primary records, and short cross-entry blocks.
- [ ] AC-026: Display budget never compresses the owning entry's primary output or hides the primary safety route.
- [ ] AC-027: Reconfirmation route matrix covers source semantic hash change, confirmation record hash mismatch, architecture stale state, execution semantic gap, stale closeout page, stale acceptance request, and post-close defect.
- [ ] AC-028: `_bmad/skills/ai-tdd-runtime-navigator/workflow.md` exists as the source workflow, the materialized package mirror and packed tarball contain `_bmad/skills/ai-tdd-runtime-navigator/workflow.md`, and neither source nor generated package mirror/tarball contains `_bmad/skills/ai-tdd-runtime-navigator/SKILL.md`.
- [ ] AC-029: CMD-010 shows ignored status for `docs/plans` and `docs/requirements`, and the completion packet records before and after hashes for the goal contract and source requirement.
- [ ] AC-030: CMD-011 proves `docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md` is tracked or explicitly force-staged with `git add -f`.
- [ ] AC-031: `controlledIngestWritesState=true` rows are display routes to existing controlled ingest paths and do not grant writer authority to CSV, parser, renderer, or workflow code.
- [ ] AC-032: `bmad-help` preservation tests use a deterministic baseline of section labels, catalog row labels, and forbidden removals.
- [ ] AC-033: `/goal` route display recommends `req-trace-matrix-prompt-generator` only when active RequirementRecord source hash, confirmation hash, current mental model state, and blockers permit packet compilation; otherwise it shows the current `bmads` Next Safe Action or independent `goal-execution-contract-generator` path.
- [ ] AC-034: Delivery awaiting acceptance display proves closeout page, render report, delivery closeout report hash, current attempt, and acceptance request come from the same active RequirementRecord current attempt.
- [ ] AC-035: Manual verification scenarios specify exact commands, fixture paths, expected stdout fragments, and artifact paths.
- [ ] AC-036: `packages/bmad-speckit/bin/bmad-speckit.js` is the only package bin entry for `bmad-help` and `bmads`; `packages/bmad-speckit/bin/bmad-help.js` and `packages/bmad-speckit/bin/bmads.js` do not exist; no newly added root `scripts/*` renderer/parser/display-budget/runtime-decision files exist; and the `bmad-help` or `bmads` subcommands do not dispatch to root `scripts/*`, root npm aliases, `tsx`, or repo-root TypeScript renderers.
- [ ] AC-037: Packed `packages/bmad-speckit` tarball contains `bin/bmad-speckit.js`, the package runtime JS files, the package `_bmad` CSV/workflow assets, and a temporary consumer install can run `bmad-speckit bmads` and `bmad-speckit bmad-help` without repository-root `scripts/*`.
- [ ] AC-038: Root `package.json` `scripts.bmads`, when present, does not call `scripts/bmads-renderer.ts`, `ts-node`, `tsx`, or any root TypeScript renderer, and instead calls the package CLI path or installed CLI form for `bmads`.
- [ ] AC-039: Root `package.json` `bin.bmad-speckit` points to `scripts/bmad-speckit-cli.js` only as a root package trampoline, and `scripts/bmad-speckit-cli.js` dispatches to installed or workspace `packages/bmad-speckit/bin/bmad-speckit.js` without containing renderer, projection manifest, display budget, or runtime decision implementation.
- [ ] AC-040: Existing root `scripts/bmads-renderer.ts` and `scripts/bmad-help-renderer.ts` are removed; no tombstone, wrapper, package CLI, package test, packed tarball, or consumer install path depends on them.

## Acceptance Traceability Matrix

| Acceptance ID | Task IDs | Evidence |
| ------------- | -------- | -------- |
| AC-001 | G001, G011 | CMD-001 |
| AC-002 | G001, G011 | CMD-002, CMD-009 |
| AC-003 | G002, G003 | CMD-004, file paths in G002 |
| AC-004 | G002, G009 | CMD-005, package mirror file paths in G002 |
| AC-005 | G002, G003 | CMD-004, `_bmad/_config/ai-tdd-six-model-manifest.csv` |
| AC-006 | G002, G003 | CMD-004, `_bmad/_config/ai-tdd-six-model-action-matrix.csv` |
| AC-007 | G002, G007 | CMD-004, `_bmad/_config/ai-tdd-six-model-action-matrix.csv` |
| AC-008 | G002, G007 | CMD-004, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-009 | G007 | CMD-004, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-010 | G007 | CMD-004, `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts` |
| AC-011 | G002, G003, G007 | CMD-004, four AI-TDD CSV files |
| AC-012 | G003 | CMD-004, `packages/bmad-speckit/tests/ai-tdd-projection-manifest.test.js` |
| AC-013 | G004 | CMD-004, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-014 | G004 | CMD-004, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-015 | G004 | CMD-004, `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js` |
| AC-016 | G004 | CMD-004, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-017 | G004 | CMD-004, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-018 | G004 | CMD-004, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-019 | G004, G005 | CMD-004, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-020 | G005 | CMD-004, CMD-007 |
| AC-021 | G005 | CMD-004, CMD-007 |
| AC-022 | G005 | CMD-004, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-023 | G005 | CMD-004, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-024 | G002, G005 | CMD-004, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-025 | G006 | CMD-004, `packages/bmad-speckit/tests/bmad-help-display-budget.test.js` |
| AC-026 | G006 | CMD-004, `packages/bmad-speckit/tests/bmad-help-display-budget.test.js`, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-027 | G002, G007 | CMD-004, `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv` |
| AC-028 | G008, G009 | CMD-005, CMD-006 |
| AC-029 | G001, G011 | CMD-010, completion evidence packet hashes |
| AC-030 | G001, G011 | CMD-011 |
| AC-031 | G002, G003, G007 | CMD-004, `packages/bmad-speckit/tests/ai-tdd-projection-manifest.test.js` |
| AC-032 | G004 | CMD-012, `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js` |
| AC-033 | G005 | CMD-004, CMD-013, `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` |
| AC-034 | G007 | CMD-004, `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts` |
| AC-035 | G011 | CMD-004, CMD-007, CMD-012, CMD-013 |
| AC-036 | G004, G005, G009, G010 | CMD-006, `packages/bmad-speckit/bin/bmad-speckit.js` |
| AC-037 | G004, G005, G009, G010, G011 | CMD-014, packed package file list and consumer install smoke |
| AC-038 | G010, G011 | CMD-015, root `package.json` |
| AC-039 | G010, G011 | CMD-015, `scripts/bmad-speckit-cli.js` |
| AC-040 | G010, G011 | CMD-006, CMD-014, CMD-015, root legacy renderer paths |

## Required Test Commands

Use these command definitions for preflight, implementation validation, and final verification. Add any newly created test command only through an explicit contract amendment.

### CMD-001 Worktree Preflight

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short --branch }"
```

Working directory: repository root.

Pass condition: command exits `0` and output is recorded in the evidence packet.

Proves: AC-001.

### CMD-002 Encoding Gate Before Edits

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"
```

Working directory: repository root.

Pass condition: command exits `0` and output contains `findings=0`.

Proves: AC-002.

### CMD-003 Source Requirement Hash

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { (Get-FileHash 'docs/requirements/2026-05-31-bmad-help-bmads-fusion-requirements.md' -Algorithm SHA256).Hash.ToLowerInvariant() }"
```

Working directory: repository root.

Pass condition: command exits `0` and output equals `ea1e635a9ec8e8bcda2abc3bffba0877f7f7736cc3828be115d2cc38c0cd0eac`.

Proves: AC-001.

### CMD-004 Targeted Acceptance Tests

```powershell
pwsh.exe -NoLogo -NoProfile -Command @'
& {
  npm test --prefix packages/bmad-speckit -- ai-tdd-projection-manifest.test.js bmad-help-bmads-fusion-contract.test.js bmads-six-model-panorama.test.js bmad-help-entry-surface-contract.test.js bmad-help-display-budget.test.js
  if ($LASTEXITCODE -ne 0) { throw 'package acceptance tests failed' }

  npx vitest run tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts tests/acceptance/main-agent-reconfirmation-runtime.test.ts
  if ($LASTEXITCODE -ne 0) { throw 'root acceptance tests failed' }
}
'@
```

Working directory: repository root.

Pass condition: command exits `0` and all listed package and root acceptance test files pass.

Proves: the test-backed acceptance rows covered by the listed package and root acceptance test files. CMD-006 remains the required proof for AC-028 and AC-036 public-entry and root-script prohibition rows.

### CMD-005 Package Mirror Sync

```powershell
pwsh.exe -NoLogo -NoProfile -Command @'
& {
  $ErrorActionPreference = 'Stop'
  $env:BMAD_PREPUBLISH_SILENT = '1'
  node scripts/prepublish-check.js
  if ($LASTEXITCODE -ne 0) { throw 'prepublish mirror materialization failed' }

  $pairs = @(
    @('_bmad/_config/ai-tdd-six-model-manifest.csv','packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-manifest.csv'),
    @('_bmad/_config/ai-tdd-six-model-action-matrix.csv','packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-action-matrix.csv'),
    @('_bmad/_config/ai-tdd-six-model-skill-routes.csv','packages/bmad-speckit/_bmad/_config/ai-tdd-six-model-skill-routes.csv'),
    @('_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv','packages/bmad-speckit/_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv'),
    @('_bmad/_config/bmad-help.csv','packages/bmad-speckit/_bmad/_config/bmad-help.csv'),
    @('_bmad/skills/bmad-help/workflow.md','packages/bmad-speckit/_bmad/skills/bmad-help/workflow.md'),
    @('_bmad/skills/ai-tdd-runtime-navigator/workflow.md','packages/bmad-speckit/_bmad/skills/ai-tdd-runtime-navigator/workflow.md')
  )

  foreach ($p in $pairs) {
    if (!(Test-Path $p[0])) { throw "missing canonical $($p[0])" }
    if (!(Test-Path $p[1])) { throw "missing package $($p[1])" }
    $a = (Get-FileHash $p[0] -Algorithm SHA256).Hash
    $b = (Get-FileHash $p[1] -Algorithm SHA256).Hash
    if ($a -ne $b) { throw "mirror mismatch $($p[0]) $($p[1])" }
    "$($p[0]) == $($p[1]) $a"
  }
}
'@
```

Working directory: repository root.

Pass condition: command exits `0`, materializes `packages/bmad-speckit/_bmad/` through the existing prepublish sync path, and every listed generated mirror file byte-matches its root `_bmad` source file. The materialized mirror may be removed later by `postpack`; it is not a persistent hand-maintained source tree.

Proves: AC-004 and the AC-028 workflow existence portion only. CMD-006 remains required for AC-028 public skill absence and command registration prohibition proof.

### CMD-006 Public Entry Surface Absence Check

```powershell
pwsh.exe -NoLogo -NoProfile -Command @'
& {
  $forbidden = @(
    '_bmad/skills/ai-tdd-runtime-navigator/SKILL.md',
    'packages/bmad-speckit/_bmad/skills/ai-tdd-runtime-navigator/SKILL.md',
    '_bmad/commands/ai-tdd-runtime-navigator.md',
    '_bmad/commands/bmad-navigator.md',
    'packages/bmad-speckit/_bmad/commands/ai-tdd-runtime-navigator.md',
    'packages/bmad-speckit/_bmad/commands/bmad-navigator.md',
    'packages/bmad-speckit/bin/ai-tdd-runtime-navigator.js',
    'packages/bmad-speckit/bin/bmad-navigator.js',
    'packages/bmad-speckit/bin/bmad-help.js',
    'packages/bmad-speckit/bin/bmads.js'
  )

  foreach ($path in $forbidden) {
    if (Test-Path $path) { throw "unexpected public or duplicate entry path $path" }
  }

  $packageJson = Get-Content -Raw 'packages/bmad-speckit/package.json' | ConvertFrom-Json
  $bin = $packageJson.bin
  if (-not $bin) { throw 'packages/bmad-speckit/package.json missing bin field' }
  if (-not $bin.'bmad-speckit') { throw 'missing bmad-speckit package bin entry' }
  if ($bin.'bmad-speckit' -ne 'bin/bmad-speckit.js') {
    throw "unexpected bmad-speckit bin target $($bin.'bmad-speckit')"
  }
  $forbiddenBinKeys = @('bmad-help', 'bmads', 'ai-tdd-runtime-navigator', 'bmad-navigator')
  foreach ($key in $forbiddenBinKeys) {
    if ($bin.PSObject.Properties.Name -contains $key) { throw "unexpected package bin alias $key" }
  }

  $rootCandidates = @()
  $rootCandidates += git diff --name-only --diff-filter=A -- 'scripts/*.ts' 'scripts/*.js'
  $rootCandidates += git diff --cached --name-only --diff-filter=A -- 'scripts/*.ts' 'scripts/*.js'
  $rootCandidates += git ls-files --others --exclude-standard -- 'scripts/*.ts' 'scripts/*.js'
  $newRootScripts = $rootCandidates |
    Sort-Object -Unique |
    Where-Object { $_ -match '(bmad-help-renderer|bmads-renderer|projection-manifest|display-budget|runtime-decision)' }
  if ($newRootScripts) {
    $newRootScripts
    throw 'unexpected newly added root renderer/parser/runtime script'
  }

  $cli = (Get-Content -Raw 'packages/bmad-speckit/bin/bmad-speckit.js') -replace "`r`n", "`n"

  function GetCommandBlock([string]$text, [string]$name) {
    $startMatch = [regex]::Match($text, "(?m)^program(?:\s*\n\s*)?\.command\('$name'\)")
    if (-not $startMatch.Success) { throw "missing package CLI command block $name" }
    $tail = $text.Substring($startMatch.Index)
    $next = [regex]::Match($tail.Substring(1), "(?m)^program(?:\s*\n\s*)?\.command\('")
    $end = if ($next.Success) {
      1 + $next.Index
    } else {
      $parse = $tail.IndexOf('program.parse')
      if ($parse -ge 0) { $parse } else { $tail.Length }
    }
    return $tail.Substring(0, $end)
  }

  $helpBlock = GetCommandBlock $cli 'bmad-help'
  $bmadsBlock = GetCommandBlock $cli 'bmads'
  if ($helpBlock -notmatch 'src[/\\]runtime[/\\]bmad-help-renderer[.]js') {
    throw 'bmad-help command block does not reference package runtime renderer'
  }
  if ($bmadsBlock -notmatch 'src[/\\]runtime[/\\]bmads-renderer[.]js') {
    throw 'bmads command block does not reference package runtime renderer'
  }

  $badDispatch = @(
    'runRepoScript\s*\(',
    'npm\s+run\s+(?:bmad-help|bmads)',
    '(?:spawn|spawnSync|exec|execFile|execFileSync)\s*\([^\)]*(?:npm|yarn|pnpm)[^\)]*(?:bmad-help|bmads)',
    'scripts[/\\](?:bmad-help-renderer|bmads-renderer|ai-tdd-projection-manifest|six-model-runtime-decision|display-budget|runtime-decision)[.](?:ts|js)',
    '\btsx\b',
    '(?:bmad-help-renderer|bmads-renderer|ai-tdd-projection-manifest|six-model-runtime-decision|display-budget|runtime-decision)[.]ts'
  )
  $patternSelfTests = @(
    @('runRepoScript(', 'runRepoScript\s*\('),
    @('scripts/bmads-renderer.ts', 'scripts[/\\](?:bmad-help-renderer|bmads-renderer|ai-tdd-projection-manifest|six-model-runtime-decision|display-budget|runtime-decision)[.](?:ts|js)'),
    @('tsx scripts/bmads-renderer.ts', '\btsx\b')
  )
  foreach ($case in $patternSelfTests) {
    if ($case[0] -notmatch $case[1]) { throw "regex self-test failed: $($case[1])" }
  }

  foreach ($pattern in $badDispatch) {
    if ($helpBlock -match $pattern) { throw "bmad-help command block forbidden dispatch pattern: $pattern" }
    if ($bmadsBlock -match $pattern) { throw "bmads command block forbidden dispatch pattern: $pattern" }
  }

  $searchRoots = @(
    'package.json',
    '_bmad/_config',
    '_bmad/commands',
    '_bmad/skills',
    'scripts',
    'packages/bmad-speckit/package.json',
    'packages/bmad-speckit/bin',
    'packages/bmad-speckit/src'
  )
  if (Test-Path 'packages/bmad-speckit/_bmad') {
    $searchRoots += 'packages/bmad-speckit/_bmad'
  }
  $hits = rg -n -e 'BMAD Navigator' -e 'ai-tdd-runtime-navigator.*(command|alias|bin|script)' -- @searchRoots 2>$null
  if ($LASTEXITCODE -eq 0) {
    $hits
    throw 'unexpected public AI-TDD navigator registration'
  }
  if ($LASTEXITCODE -gt 1) { throw 'public entry surface scan failed' }

  'public entry surface clean'
}
'@
```

Working directory: repository root.

Pass condition: command exits `0`, finds no public command registration, finds no `SKILL.md` at the two forbidden public skill paths, finds no standalone `bmad-help` or `bmads` bin file, proves `packages/bmad-speckit/package.json` exposes only the `bmad-speckit` bin for this surface and does not expose `bmad-help`, `bmads`, `ai-tdd-runtime-navigator`, or `bmad-navigator` bin aliases, finds no newly added root renderer/parser/display-budget/runtime-decision script across unstaged, staged, or untracked files, handles CRLF and LF command files, separately proves the `bmad-help` block references `src/runtime/bmad-help-renderer.js`, separately proves the `bmads` block references `src/runtime/bmads-renderer.js`, proves the forbidden-dispatch regexes match known bad examples, and fails when either target command block contains `runRepoScript`, root npm alias, root `scripts/`, `tsx`, or repo-root TypeScript renderer dispatch patterns. Existing non-target CLI helpers and unrelated commands are not failure conditions.

Proves: AC-028 and AC-036.

### CMD-007 Manual Renderer Smoke

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node packages/bmad-speckit/bin/bmad-speckit.js bmads }"
```

Working directory: repository root.

Pass condition: command exits `0` and stdout contains `View Mode: AI-TDD Runtime Six-Model Panorama`, `Status Summary`, `Recommended Next Steps`, `Active Requirement Records`, `Six Mental Model Panorama`, `Runtime Workflow Guidance`, `Command Hints`, and `See also: bmad-help`.

Proves: AC-020 and AC-021. This smoke supports the package-runtime execution portion of AC-036, but CMD-006 is required for full AC-036 proof.

### CMD-008 Static Lint Gate

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run lint -- --quiet }"
```

Working directory: repository root.

Pass condition: command exits `0`.

Proves: changed TypeScript and JavaScript files pass static lint. This is supporting quality evidence, not direct behavioral or package-surface acceptance proof.

### CMD-009 Encoding Gate After Edits

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"
```

Working directory: repository root.

Pass condition: command exits `0` and output contains `findings=0`.

Proves: AC-002.

### CMD-010 Ignored Plan And Requirement Status

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short --ignored -- docs/plans docs/requirements; (Get-FileHash 'docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md' -Algorithm SHA256).Hash.ToLowerInvariant(); (Get-FileHash 'docs/requirements/2026-05-31-bmad-help-bmads-fusion-requirements.md' -Algorithm SHA256).Hash.ToLowerInvariant() }"
```

Working directory: repository root.

Pass condition: command exits `0` and prints ignored status plus hashes for the goal contract and source requirement.

Proves: AC-029.

### CMD-011 Goal Contract Trackability Gate

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { $path='docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md'; $tracked = git ls-files -- $path; $staged = git diff --cached --name-only -- $path; if ($tracked -or $staged) { 'goal contract trackable' } else { throw 'goal_contract_not_trackable: run git add -f docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md before completion' } }"
```

Working directory: repository root.

Pass condition: command exits `0` and prints `goal contract trackable`.

Proves: AC-030.

### CMD-012 BMAD Help Baseline Preservation

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm test --prefix packages/bmad-speckit -- bmad-help-bmads-fusion-contract.test.js bmad-help-entry-surface-contract.test.js bmad-help-display-budget.test.js }"
```

Working directory: repository root.

Pass condition: command exits `0` and the tests assert baseline section labels, catalog row labels, and forbidden removals.

Proves: AC-013, AC-014, AC-015, AC-016, AC-017, AC-018, AC-019, and AC-032.

### CMD-013 BMADS Active Record Field Fixture

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm test --prefix packages/bmad-speckit -- bmads-six-model-panorama.test.js }"
```

Working directory: repository root.

Pass condition: command exits `0` and the tests assert per-record `recordId`, source or title, current mental model, schema status, display state, blocker summary, next safe action, and `updatedAt` or current attempt/hash.

Proves: AC-020, AC-021, AC-022, AC-023, AC-024, AC-025, AC-026, AC-033, and AC-035.

### CMD-014 Packed Package Consumer Smoke

```powershell
pwsh.exe -NoLogo -NoProfile -Command @'
& {
  $ErrorActionPreference = 'Stop'
  $packDir = Join-Path $env:TEMP ('bmad-speckit-pack-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $packDir | Out-Null

  Push-Location 'packages/bmad-speckit'
  try {
    $packRaw = npm pack --json --pack-destination $packDir
    if ($LASTEXITCODE -ne 0) { throw 'npm pack failed' }
  } finally {
    Pop-Location
  }

  $packLines = @($packRaw)
  $jsonStart = -1
  $jsonEnd = -1
  for ($i = 0; $i -lt $packLines.Count; $i++) {
    if ($packLines[$i].Trim() -eq '[') {
      $jsonStart = $i
      break
    }
  }
  for ($i = $packLines.Count - 1; $i -ge 0; $i--) {
    if ($packLines[$i].Trim() -eq ']') {
      $jsonEnd = $i
      break
    }
  }
  if ($jsonStart -lt 0 -or $jsonEnd -lt $jsonStart) {
    $packRaw
    throw 'npm pack json payload not found'
  }
  $packJson = ($packLines[$jsonStart..$jsonEnd] -join "`n") | ConvertFrom-Json
  $tgz = Join-Path $packDir $packJson[0].filename
  $files = $packJson[0].files.path
  $required = @(
    'bin/bmad-speckit.js',
    'src/runtime/bmad-help-renderer.js',
    'src/runtime/bmads-renderer.js',
    'src/runtime/ai-tdd/projection-manifest.js',
    'src/runtime/ai-tdd/display-budget.js',
    'src/runtime/ai-tdd/runtime-decision.js',
    '_bmad/_config/ai-tdd-six-model-manifest.csv',
    '_bmad/_config/ai-tdd-six-model-action-matrix.csv',
    '_bmad/_config/ai-tdd-six-model-skill-routes.csv',
    '_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv',
    '_bmad/skills/ai-tdd-runtime-navigator/workflow.md',
    '_bmad/_config/bmad-help.csv',
    '_bmad/skills/bmad-help/workflow.md'
  )
  foreach ($path in $required) {
    if ($files -notcontains $path) { throw "packed package missing $path" }
  }

  $consumer = Join-Path $env:TEMP ('bmad-speckit-consumer-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $consumer | Out-Null
  npm init -y --prefix $consumer | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'consumer npm init failed' }
  npm install --prefix $consumer $tgz | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'consumer npm install failed' }

  Push-Location $consumer
  try {
    $bmadsOut = npx --no-install bmad-speckit bmads 2>&1
    if ($LASTEXITCODE -ne 0) {
      $bmadsOut
      throw 'consumer bmads failed'
    }
    if (($bmadsOut -join "`n") -notmatch 'View Mode: AI-TDD Runtime Six-Model Panorama') {
      $bmadsOut
      throw 'consumer bmads missing panorama label'
    }

    $helpOut = npx --no-install bmad-speckit bmad-help 2>&1
    if ($LASTEXITCODE -ne 0) {
      $helpOut
      throw 'consumer bmad-help failed'
    }
    if (($helpOut -join "`n") -notmatch 'bmad-help') {
      $helpOut
      throw 'consumer bmad-help missing label'
    }
  } finally {
    Pop-Location
    if (Test-Path $consumer) { Remove-Item -Recurse -Force $consumer }
    if (Test-Path $packDir) { Remove-Item -Recurse -Force $packDir }
  }
}
'@
```

Working directory: repository root.

Pass condition: command exits `0`, `npm pack` runs from `packages/bmad-speckit` into a temporary tarball directory outside the repository root, every native command has an explicitly checked zero exit code, the packed file list contains every required package runtime and `_bmad` asset, and both `npx --no-install bmad-speckit bmads` and `npx --no-install bmad-speckit bmad-help` run from a temporary consumer install without repository-root `scripts/*`.

Proves: AC-020, AC-021, and AC-037. This smoke supports the package-runtime execution portion of AC-036 and AC-040, but CMD-006 and CMD-015 are required for full root migration proof.

### CMD-015 Root Legacy Migration Boundary Check

```powershell
pwsh.exe -NoLogo -NoProfile -Command @'
& {
  $ErrorActionPreference = 'Stop'

  $rootPackage = Get-Content -Raw 'package.json' | ConvertFrom-Json
  $rootBmadsScript = $rootPackage.scripts.bmads
  if ($rootBmadsScript) {
    $forbiddenScriptPatterns = @(
      'scripts[/\\]bmads-renderer[.]ts',
      '\bts-node\b',
      '\btsx\b',
      '(?:^|\s)(?:node\s+)?scripts[/\\][^\s]*(?:bmad-help-renderer|bmads-renderer|projection-manifest|display-budget|runtime-decision)[.](?:ts|js)'
    )
    foreach ($pattern in $forbiddenScriptPatterns) {
      if ($rootBmadsScript -match $pattern) {
        throw "root package.json scripts.bmads forbidden pattern: $pattern"
      }
    }
    if (
      $rootBmadsScript -notmatch 'packages[/\\]bmad-speckit[/\\]bin[/\\]bmad-speckit[.]js\s+bmads' -and
      $rootBmadsScript -notmatch '\bbmad-speckit\s+bmads\b'
    ) {
      throw 'root package.json scripts.bmads must call the package CLI bmads path or installed CLI form'
    }
  }

  if (-not $rootPackage.bin.'bmad-speckit') { throw 'root package.json missing bin.bmad-speckit' }
  if ($rootPackage.bin.'bmad-speckit' -ne 'scripts/bmad-speckit-cli.js') {
    throw "root package.json bin.bmad-speckit must remain scripts/bmad-speckit-cli.js when present"
  }

  $trampolinePath = 'scripts/bmad-speckit-cli.js'
  if (!(Test-Path $trampolinePath)) { throw 'missing root package trampoline scripts/bmad-speckit-cli.js' }
  $trampoline = (Get-Content -Raw $trampolinePath) -replace "`r`n", "`n"
  if ($trampoline -notmatch 'packages[/\\]bmad-speckit[/\\]bin[/\\]bmad-speckit[.]js') {
    throw 'root trampoline does not reference packages/bmad-speckit/bin/bmad-speckit.js'
  }
  $forbiddenTrampolinePatterns = @(
    'bmads-renderer',
    'bmad-help-renderer',
    'projection-manifest',
    'display-budget',
    'runtime-decision'
  )
  foreach ($pattern in $forbiddenTrampolinePatterns) {
    if ($trampoline -match $pattern) { throw "root trampoline contains runtime implementation marker: $pattern" }
  }

  $packageCliPath = 'packages/bmad-speckit/bin/bmad-speckit.js'
  if (!(Test-Path $packageCliPath)) { throw 'missing package CLI packages/bmad-speckit/bin/bmad-speckit.js' }
  $cli = (Get-Content -Raw $packageCliPath) -replace "`r`n", "`n"

  function GetCommandBlock([string]$text, [string]$name) {
    $startMatch = [regex]::Match($text, "(?m)^program(?:\s*\n\s*)?\.command\('$name'\)")
    if (-not $startMatch.Success) { throw "missing package CLI command block $name" }
    $tail = $text.Substring($startMatch.Index)
    $next = [regex]::Match($tail.Substring(1), "(?m)^program(?:\s*\n\s*)?\.command\('")
    $end = if ($next.Success) {
      1 + $next.Index
    } else {
      $parse = $tail.IndexOf('program.parse')
      if ($parse -ge 0) { $parse } else { $tail.Length }
    }
    return $tail.Substring(0, $end)
  }

  $helpBlock = GetCommandBlock $cli 'bmad-help'
  $bmadsBlock = GetCommandBlock $cli 'bmads'
  if ($helpBlock -notmatch 'src[/\\]runtime[/\\]bmad-help-renderer[.]js') {
    throw 'bmad-help command block must dispatch to package runtime bmad-help-renderer.js'
  }
  if ($bmadsBlock -notmatch 'src[/\\]runtime[/\\]bmads-renderer[.]js') {
    throw 'bmads command block must dispatch to package runtime bmads-renderer.js'
  }
  $forbiddenPackageDispatch = @(
    'runRepoScript\s*\(',
    'npm\s+run\s+(?:bmad-help|bmads)',
    'scripts[/\\](?:bmad-help-renderer|bmads-renderer|projection-manifest|display-budget|runtime-decision)[.](?:ts|js)',
    '\bts-node\b',
    '\btsx\b',
    '(?:bmad-help-renderer|bmads-renderer|projection-manifest|display-budget|runtime-decision)[.]ts'
  )
  foreach ($pattern in $forbiddenPackageDispatch) {
    if ($helpBlock -match $pattern) { throw "bmad-help command block forbidden dispatch pattern: $pattern" }
    if ($bmadsBlock -match $pattern) { throw "bmads command block forbidden dispatch pattern: $pattern" }
  }

  $legacyRootRenderers = @('scripts/bmads-renderer.ts', 'scripts/bmad-help-renderer.ts')
  foreach ($path in $legacyRootRenderers) {
    if (Test-Path $path) {
      throw "$path must be removed; root renderer tombstones, wrappers, and legacy replacements are forbidden"
    }
  }

  'root legacy migration boundary clean'
}
'@
```

Working directory: repository root.

Pass condition: command exits `0`, root `package.json` `scripts.bmads` is absent or calls the package CLI `bmads` path without `ts-node`, `tsx`, root renderers, or root TypeScript renderer dispatch; root `bin.bmad-speckit` points only to `scripts/bmad-speckit-cli.js`; the trampoline references `packages/bmad-speckit/bin/bmad-speckit.js` and contains no renderer or runtime projection implementation markers; package `bmad-help` and `bmads` command blocks dispatch to package runtime JS files and do not dispatch to root `scripts/*`; root `scripts/bmads-renderer.ts` and `scripts/bmad-help-renderer.ts` do not exist.

Proves: AC-038, AC-039, and AC-040. This command also supports AC-036 root-dispatch proof.

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

### MVS-001 BMAD Help Default Without Runtime Record

Command:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm test --prefix packages/bmad-speckit -- bmad-help-bmads-fusion-contract.test.js }"
```

Fixture path: `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`.

Expected stdout fragments: `bmad-help-bmads-fusion-contract.test.js`, `pass`.

Artifact path: test stdout captured in completion evidence packet.

Evidence MUST show that the original main section order remains visible and that no runtime cross-entry block appears without active runtime state.

Acceptance rows: AC-013, AC-014, AC-016, AC-017, AC-018.

### MVS-002 BMAD Help Catalog With Runtime Record

Command:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm test --prefix packages/bmad-speckit -- bmad-help-entry-surface-contract.test.js }"
```

Fixture path: `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`.

Expected stdout fragments: `bmad-help-entry-surface-contract.test.js`, `pass`.

Artifact path: test stdout captured in completion evidence packet.

Evidence MUST show catalog rows remain the main content and runtime guidance remains short.

Acceptance rows: AC-015, AC-016, AC-019.

### MVS-003 BMADS Multiple Active Records

Command:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm test --prefix packages/bmad-speckit -- bmads-six-model-panorama.test.js }"
```

Fixture path: `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`.

Expected stdout fragments: `bmads-six-model-panorama.test.js`, `pass`.

Artifact path: test stdout captured in completion evidence packet.

Evidence MUST show one global primary record, `Primary because:` followed by one non-empty stable reason token, secondary record details, blocker summary, and next safe action.

Acceptance rows: AC-020, AC-021, AC-022, AC-023.

### MVS-004 Delivery Awaiting Acceptance

Command:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts -t 'records delivery confirmation awaiting user acceptance' }"
```

Fixture path: `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts`.

Expected stdout fragments: `main-agent-delivery-closeout-gate-record.test.ts`, `passed`.

Artifact path: test stdout captured in completion evidence packet.

Evidence MUST show closeout page, closeout render report, delivery closeout report hash, current attempt, acceptance request, exact confirmation instruction, and `confirm-closeout-acceptance` are bound to the same active RequirementRecord current attempt.

Acceptance rows: AC-007, AC-008, AC-009, AC-010.

### MVS-005 Public Entry Surface Check

Run CMD-005 and CMD-006. Evidence MUST show the canonical and package `ai-tdd-runtime-navigator/workflow.md` files exist and match, no public `BMAD Navigator` command exists, no public `ai-tdd-runtime-navigator` skill file exists, no standalone `bmad-help` or `bmads` bin file exists, no package `bin` alias exposes `bmad-help`, `bmads`, `ai-tdd-runtime-navigator`, or `bmad-navigator`, and no new root `scripts/*` renderer/parser entry exists.

Acceptance rows: AC-028, AC-036.

### MVS-006 Packed Consumer Commands

Run CMD-014. Evidence MUST show the packed tarball contains `bin/bmad-speckit.js`, all required `src/runtime/**/*.js` files, all required `_bmad` CSV/workflow assets, and that a temporary consumer install can run `bmad-speckit bmads` and `bmad-speckit bmad-help`.

Acceptance rows: AC-020, AC-021, AC-037.

### MVS-007 Root Scripts Migration Boundary

Run CMD-015. Evidence MUST show root `package.json` `scripts.bmads` no longer calls `scripts/bmads-renderer.ts`, `ts-node`, `tsx`, or any root TypeScript renderer; root `bin.bmad-speckit` is only the `scripts/bmad-speckit-cli.js` package trampoline; `scripts/bmad-speckit-cli.js` contains no runtime implementation markers; package CLI command blocks dispatch only to package runtime JS files; and root `scripts/bmads-renderer.ts` plus `scripts/bmad-help-renderer.ts` do not exist.

Acceptance rows: AC-038, AC-039, AC-040.

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

Required fields:

- `contractPath`: `docs/plans/2026-06-01-bmad-help-bmads-fusion-goal-execution-plan.md`
- `sourceRequirementPath`: `docs/requirements/2026-05-31-bmad-help-bmads-fusion-requirements.md`
- `sourceRequirementHash`: `sha256:ea1e635a9ec8e8bcda2abc3bffba0877f7f7736cc3828be115d2cc38c0cd0eac`
- `changedFiles`: list of changed files grouped by task ID
- `commands`: CMD-001 through CMD-015 with exit code and output summary
- `acceptance`: AC-001 through AC-040 with direct evidence mapping
- `manualScenarios`: MVS-001 through MVS-007 with output summary or artifact path
- `encodingGate`: pre-edit and post-edit output summary
- `ignoredFileEvidence`: CMD-010 output summary and before/after hashes for the goal contract and source requirement
- `trackabilityEvidence`: CMD-011 output summary
- `residualRisks`: list of stop conditions or blocked rows that remain

Completion rule:

- `/goal` may claim completion only when every AC-001 through AC-040 row is checked, every required command passes, every changed-file regression test passes, and CMD-009 reports `findings=0`.

## Stop Conditions

- Stop with `contract_amendment_required` when this file lacks a required section, task ID, acceptance ID, command, or traceability row.
- Stop with `source_requirement_changed_contract_amendment_required` when CMD-003 hash differs and the source semantic meaning changed.
- Stop with `scope_amendment_required` before editing a file outside the `Files` lists in G001 through G011.
- Stop with `validation_contract_required` when a required command is unavailable and no earlier task creates it.
- Stop with `package_surface_mapping_required` when package mirror sync requires a path mapping that is absent from current repository rules.
- Stop with `root_scripts_surface_violation` when a new renderer, parser, display budget, or runtime-decision implementation is added under root `scripts/`, or when `bmad-help` / `bmads` package CLI dispatches to root `scripts/*`.
- Stop with `root_legacy_runtime_dispatch_violation` when root `package.json` `scripts.bmads`, `scripts/bmad-speckit-cli.js`, package CLI command blocks, package tests, packed tarball, or consumer install paths depend on `scripts/bmads-renderer.ts`, `scripts/bmad-help-renderer.ts`, root `ts-node`, root `tsx`, or repo-root TypeScript renderers.
- Stop with `duplicate_package_bin_violation` when `packages/bmad-speckit/bin/bmad-help.js` or `packages/bmad-speckit/bin/bmads.js` is created, or when `packages/bmad-speckit/package.json` exposes forbidden `bin` aliases for `bmad-help`, `bmads`, `ai-tdd-runtime-navigator`, or `bmad-navigator`, instead of using `packages/bmad-speckit/bin/bmad-speckit.js` subcommands.
- Stop with `packed_consumer_smoke_failed` when `npm pack` omits required package runtime or `_bmad` assets, or when a temporary consumer install cannot run `bmad-speckit bmads` and `bmad-speckit bmad-help`.
- Stop with `runtime_control_authority_violation` when any CSV parser, renderer, or workflow attempts to write RequirementRecord state or Control Event Journal state.
- Stop with `public_entry_surface_violation` when a public `BMAD Navigator` command, public `ai-tdd-runtime-navigator` command, or public `ai-tdd-runtime-navigator` skill alias is created.
- Stop with `delivery_terminal_action_violation` when `record_closed` is displayed as a user-executable primary route.
- Stop with `bmad_help_preservation_violation` when `bmad-help` main output is compressed, reordered, or replaced by AI-TDD runtime panorama.
- Stop with `bmads_panorama_missing` when `bmads` does not display the required six-model panorama sections.
- Stop with `completion_evidence_missing` when any acceptance row lacks direct command output or artifact evidence.
