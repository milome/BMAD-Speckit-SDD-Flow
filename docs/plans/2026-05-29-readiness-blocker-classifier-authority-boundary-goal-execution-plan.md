# Goal Execution Contract

<!-- goal-slot:frontMatter required dynamic=frontMatter -->
---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 1.1.0
goalContractProfileHash: sha256:a1971090837806dd1c36fa5dc4c32da9cc7d92cc77289e82ad6ce135e27f62f5
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: conversation://2026-05-29-readiness-blocker-classifier-authority-boundary-rules
sourcePlanHash: sha256:fb55e35db0c57237da2c610172180737a5f56d89e548e6a65e4d4a4c208a184c
runtimeRecordId: REQ-2026-05-29-MAIN-AGENT-SIX-MENTAL-MODEL-PRODUCTION-ORCHESTRATION-HARDENING
entryFlow: standalone_tasks
taskRange: G01..G07
acceptanceRange: AC-001..AC-034
completionGate: all_acceptance_items_pass_and_commands_green
repairPolicy: fix_until_all_acceptance_pass
stopPolicy: stop_on_scope_or_semantic_or_validation_contract_violation
generatedBy: goal-execution-contract-generator
generatedAt: 2026-05-29T20:00:00+08:00
---
<!-- /goal-slot:frontMatter -->

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, and do not claim completion until every strict acceptance item passes.
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

<!-- goal-slot:goalEntry required dynamic=goalEntry -->
```text
/goal docs/plans/2026-05-29-readiness-blocker-classifier-authority-boundary-goal-execution-plan.md
```
<!-- /goal-slot:goalEntry -->

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
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, or tests.

## Authority Model

<!-- goal-slot:authorityModel required dynamic=authorityModel -->
- `AUTH-001`: The confirmed source document and inline `implementationConfirmation` remain the only requirement semantic authority for req-trace compiler input.
- `AUTH-002`: `sourceDocumentHash` and `implementationConfirmationHash` must match the current confirmed source before any blocker classification can run.
- `AUTH-003`: `readiness_auto_remediation` may process only blocker categories classified as `derive_without_reconfirm`.
- `AUTH-004`: `readiness_auto_remediation` must not write source-equivalent execution contract content for blocker categories classified as `requires_source_amendment`.
- `AUTH-005`: `readiness_auto_remediation` must not select among multiple equal candidates for blocker categories classified as `requires_user_decision`.
- `AUTH-006`: `main-agent-orchestration` owns routing from blocker classification to `source_amendment_required`, `blocked_by_unresolved_user_decision`, or derive execution.
- `AUTH-007`: `req-trace compiler` must continue to treat source document `implementationConfirmation` as semantic authority and must not consume mutated confirmation semantics from runtime remediation.
- `AUTH-008`: `model_packet.json is the machine-readable execution authority` only after req-trace compiler passes against confirmed source authority and validated non-semantic projections.
- `AUTH-009`: `goal_execution.md is not execution authority`; this document defines deterministic `/goal` implementation obligations only.
- `AUTH-010`: `/goal completion is not closeout proof`; closeout remains controlled by AI-TDD and delivery closeout gates.
- `MUST NOT`: A runtime overlay, remediation receipt, or readiness score must not change confirmed `MUST`, `TRACE`, `EVD`, `ACC`, `E2E`, `FAIL`, or `EDGE` semantics.
- `MUST NOT`: A missing relation, missing plan, missing expected-red rule, missing target scope, missing artifact scope, or missing command authority must not be classified as `derive_without_reconfirm`.
<!-- /goal-slot:authorityModel -->

## Root Cause To Fix

<!-- goal-slot:rootCause required dynamic=rootCause -->
The current readiness auto-remediation path can treat source-authority gaps as runtime-repairable gaps. This allows `implementation_readiness` to reach `pass` after record-only remediation while req-trace compiler still blocks dispatch because the confirmed source document lacks required execution contract fields and semantic bindings.

The root cause is an over-permissive blocker classifier. It does not deterministically separate proof, projection, and normalization gaps from semantic relation, execution contract, and authority gaps. The fix is to install a fail-closed classifier rule table, route each blocker to exactly one remediation class, and make main-agent readiness progression depend on that classification.
<!-- /goal-slot:rootCause -->

## Domain-Specific Contract Addenda

Use this section to bind any domain-specific classifier, state machine, schema, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, or other machine contract.

<!-- goal-slot:domainAddenda required dynamic=domainAddenda -->
### DA-001 Classifier Output Schema

- `MUST`: The classifier output schema name is `readiness-blocker-classification/v1`.
- `MUST`: Each classifier output item has `blockerId`, `classification`, `sourceAuthorityImpact`, `autoRemediationAllowed`, `requiredNextAction`, and `reasonCode`.
- `MUST`: `classification` values are exactly `derive_without_reconfirm`, `requires_source_amendment`, and `requires_user_decision`.
- `MUST`: `autoRemediationAllowed` is `true` only when `classification` is `derive_without_reconfirm`.
- `MUST`: `requiredNextAction` is `run_deterministic_projection_repair` only for `derive_without_reconfirm`.
- `MUST`: `requiredNextAction` is `source_amendment_required` only for `requires_source_amendment`.
- `MUST`: `requiredNextAction` is `blocked_by_unresolved_user_decision` only for `requires_user_decision`.

### DA-002 Global Preconditions

- `MUST`: `sourceDocumentHash` must match the current confirmed source before classifier output is accepted.
- `MUST`: `implementationConfirmationHash` must match the current confirmed source before classifier output is accepted.
- `MUST NOT`: Classifier logic must not add, delete, or rewrite confirmed semantic IDs.
- `MUST NOT`: Classifier logic must not expand write scope, command authority, artifact authority, target authority, or closeout authority.

### DA-003 Derive Without Reconfirm Rule

- `MUST`: `derive_without_reconfirm` is allowed only for proof artifacts, report regeneration, hash normalization, path normalization, canonical materialization, alias normalization with equal content, and policy surface projection.
- `MUST`: `derive_without_reconfirm` output must include deterministic input refs and output artifact refs.
- `MUST`: A rerun-derived report classified as `derive_without_reconfirm` must downgrade to `requires_source_amendment` when the rerun report result is `fail`.

### DA-004 Source Amendment Rule

- `MUST`: `requires_source_amendment` is required for missing execution plans, missing relation bindings, missing expected-red strategy, missing red-proof strategy, missing target authority, missing artifact authority, and missing command authority.
- `MUST`: `requires_source_amendment` must block implementation readiness progression until source amendment and controlled reconfirmation occur.
- `MUST NOT`: `requires_source_amendment` blockers must not be written into `requirement-record.json` as if they were confirmed source content.

### DA-005 User Decision Rule

- `MUST`: `requires_user_decision` is required when two or more equal valid candidates exist and confirmed source or confirmed companion artifact does not select one candidate.
- `MUST`: `requires_user_decision` must block implementation readiness progression with `blocked_by_unresolved_user_decision`.
- `MUST NOT`: The main agent, readiness auto-remediation lane, or req-trace compiler must choose among equal valid candidates without user confirmation.

### DA-006 Exact Blocker Rule Table

- `PRE_CONFIRMATION_DRILLDOWN_REQUIRED`: `derive_without_reconfirm` when current confirmed source has matching requirement-confirmation artifacts.
- `PACKET_SOURCE_RECONCILIATION_REQUIRED`: `derive_without_reconfirm` when reconciliation report is missing or stale and rerun result is `pass`; `requires_source_amendment` when rerun result is `fail`.
- `PRE_RENDER_GATE_REPORT_REQUIRED`: `derive_without_reconfirm` when gate report is missing or stale and rerun result is `pass`; when rerun result is `fail`, classify by the failing root blocker instead of this blocker ID.
- `ATOMIC_TASK_LINEAGE_REQUIRED`: `derive_without_reconfirm` when deterministic atomic packet and maps already exist for the same confirmed source; `requires_source_amendment` when repair would add, merge, split, or redefine contract task semantics; `requires_user_decision` when multiple equal valid decomposition boundaries exist.
- `AI_TDD_MANIFEST_REQUIRED`: classify by the missing manifest section IDs; do not classify this blocker by itself.
- `MANIFEST_SECTION_REQUIRED:preConfirmationDrilldownInputs`: `derive_without_reconfirm`.
- `MANIFEST_SECTION_REQUIRED:atomicImplementationTaskLineage`: use the same rule as `ATOMIC_TASK_LINEAGE_REQUIRED`.
- `MANIFEST_SECTION_REQUIRED:legacyDenial`: `derive_without_reconfirm`.
- `MANIFEST_SECTION_REQUIRED:executionLoopProtocol`: `derive_without_reconfirm`.
- `MANIFEST_SECTION_REQUIRED:semanticGapPolicy`: `derive_without_reconfirm`.
- `MANIFEST_SECTION_REQUIRED:hostExecutionHints`: `derive_without_reconfirm` when host is already selected by main-agent input; `requires_user_decision` when multiple execution hosts are equally valid and no confirmed selection exists.
- `MANIFEST_SECTION_REQUIRED:evidenceTrustStates`: `derive_without_reconfirm`.
- `MANIFEST_SECTION_REQUIRED:finalGateMatrix`: `derive_without_reconfirm` when source-defined commands and gate rows are present; `requires_source_amendment` when source lacks required command or closeout authority; `requires_user_decision` when multiple equal command sets exist.
- `MANIFEST_SECTION_REQUIRED:canonicalSurfaceReconciliation`: `derive_without_reconfirm` when authoritative target set exists; `requires_source_amendment` when no authoritative canonical surface exists; `requires_user_decision` when multiple equal surface sets exist.
- `MANIFEST_SECTION_REQUIRED:closeoutProof`: `derive_without_reconfirm` when source-confirmed required commands and authority rows exist; `requires_source_amendment` when closeout authority is missing; `requires_user_decision` when multiple equal closeout command sets exist.
- `MANIFEST_SECTION_REQUIRED:errorCaseCoverage`: `derive_without_reconfirm` when failure, edge, trace, and acceptance relationships already exist in source; `requires_source_amendment` when any relationship is missing.
- `MANIFEST_SECTION_REQUIRED:traceClosureAssertions`: `derive_without_reconfirm` when generated from existing trace, evidence, command, and acceptance relationships; `requires_source_amendment` when any underlying relationship is missing.
- `MANIFEST_SECTION_REQUIRED:commandTargets`: `derive_without_reconfirm` for equal alias or canonical materialization; `requires_source_amendment` when command target scope, write scope, or artifact scope is undefined; `requires_user_decision` when multiple equal target sets exist.
- `MANIFEST_SECTION_REQUIRED:currentTargetMap`: `derive_without_reconfirm` when authoritative target map exists; `requires_source_amendment` when target map is missing; `requires_user_decision` when multiple equal target maps exist.
- `requirement_pre_implementation_missing_plan`: `requires_source_amendment`.
- `pre_implementation_red_proof_missing`: `requires_source_amendment`.
- `pre_implementation_valid_expected_red_missing`: `requires_source_amendment`.
- `PRE_IMPLEMENTATION_RED_PROOF_PLAN_REQUIRED:*`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal red-proof adapter paths exist.
- `trace_acceptance_binding_missing`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal acceptance or E2E candidates exist.
- `FAILURE_PATH_BINDING_REQUIRED:TRACE-*`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal failure path candidates exist.
- `EDGE_CASE_BINDING_REQUIRED:TRACE-*`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal edge case candidates exist.
- `ERROR_CASE_CLOSURE_INCOMPLETE:FAIL-*:*`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal existing candidates exist.
- `ERROR_CASE_CLOSURE_INCOMPLETE:EDGE-*:*`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal existing candidates exist.
- `command target refs missing`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal refs exist.
- `artifact refs missing`: `requires_source_amendment` by default; `requires_user_decision` when multiple equal refs exist.
- `commandTargets -> commandTargetCollection alias normalization`: `derive_without_reconfirm` only when normalized content is equal and authority is unchanged.

### DA-007 Main-Agent Routing Contract

- `MUST`: If any active blocker is classified as `requires_source_amendment`, `main-agent-orchestration` must return `source_amendment_required` and must not return `dispatch_implement`.
- `MUST`: If any active blocker is classified as `requires_user_decision`, `main-agent-orchestration` must return `blocked_by_unresolved_user_decision` and must not return `dispatch_implement`.
- `MUST`: `readiness_auto_remediation` may run only when every active blocker is classified as `derive_without_reconfirm`.
- `MUST`: Mixed classifications must use the strictest route in this order: `requires_user_decision`, `requires_source_amendment`, `derive_without_reconfirm`.

### DA-008 Req-Trace Boundary Contract

- `MUST`: req-trace compiler must continue to validate confirmed source hashes and confirmed source semantics before generating `model_packet.json`.
- `MUST NOT`: req-trace compiler must not accept runtime remediation as a replacement for confirmed source execution contract fields.
- `MUST`: req-trace compiler may consume proof artifacts and canonical materialization outputs only when classifier output proves `derive_without_reconfirm`.
<!-- /goal-slot:domainAddenda -->

## Implementation Tasks

<!-- goal-slot:implementationTasks required dynamic=traceSlices -->
### G01 Locate and isolate readiness blocker classifier implementation

- Purpose: Identify the classifier and remediation entry points that currently allow source-authority blockers to be auto-remediated.
- Files: `scripts/main-agent-orchestration.ts`, `scripts/main-agent-implementation-readiness-gate.ts`, `scripts/ai-tdd-contract-gate.ts`, and `tests/acceptance/main-agent-readiness-auto-remediation.test.ts`.
- Steps:
  - Inspect the function that classifies readiness blockers before `readiness_auto_remediation`.
  - Inspect the function that runs `readiness_auto_remediation`.
  - Inspect the readiness gate output fields used by main-agent routing.
  - Record every current blocker ID string handled by the classifier.
  - Do not modify req-trace compiler behavior in this task.
- Validation: Run `CMD-001`.
- Acceptance: `AC-001`, `AC-002`, `AC-003`, and `AC-004` must pass.

### G02 Implement deterministic blocker classification table

- Purpose: Encode `derive_without_reconfirm`, `requires_source_amendment`, and `requires_user_decision` as fail-closed classifier outcomes.
- Files: `scripts/main-agent-orchestration.ts` and `tests/acceptance/main-agent-readiness-auto-remediation.test.ts`.
- Steps:
  - Add classifier output type `readiness-blocker-classification/v1`.
  - Add exact classification values `derive_without_reconfirm`, `requires_source_amendment`, and `requires_user_decision`.
  - Add exact `requiredNextAction` values `run_deterministic_projection_repair`, `source_amendment_required`, and `blocked_by_unresolved_user_decision`.
  - Encode every blocker rule in `DA-006`.
  - Make unknown blocker IDs classify as `requires_source_amendment` with `reasonCode: "unknown_blocker_fail_closed"`.
  - Make wildcard blockers match deterministic prefixes before falling back to unknown.
- Validation: Run `CMD-001`, `CMD-002`, and `CMD-003`.
- Acceptance: `AC-005` through `AC-019` must pass.

### G03 Restrict readiness auto-remediation to derive-only blockers

- Purpose: Prevent runtime remediation from writing execution contract semantics that belong in confirmed source.
- Files: `scripts/main-agent-orchestration.ts` and `tests/acceptance/main-agent-readiness-auto-remediation.test.ts`.
- Steps:
  - Gate `readiness_auto_remediation` execution on all active classifications being `derive_without_reconfirm`.
  - Route any `requires_source_amendment` blocker to `source_amendment_required`.
  - Route any `requires_user_decision` blocker to `blocked_by_unresolved_user_decision`.
  - Preserve derive-only remediation behavior for proof artifacts, report regeneration, canonical projection, normalization, and policy materialization.
  - Persist classification details in the task report evidence when remediation does not run.
- Validation: Run `CMD-001`, `CMD-002`, and `CMD-003`.
- Acceptance: `AC-020` through `AC-025` must pass.

### G04 Update readiness gate and AI-TDD tests for source-authority blockers

- Purpose: Prove that source-authority blockers cannot be converted to readiness pass without source amendment and reconfirmation.
- Files: `tests/acceptance/main-agent-implementation-readiness-gate-record.test.ts`, `tests/acceptance/ai-tdd-contract-gate.test.ts`, and `tests/acceptance/main-agent-readiness-auto-remediation.test.ts`.
- Steps:
  - Add test coverage for `requirement_pre_implementation_missing_plan` classified as `requires_source_amendment`.
  - Add test coverage for `pre_implementation_red_proof_missing` classified as `requires_source_amendment`.
  - Add test coverage for `pre_implementation_valid_expected_red_missing` classified as `requires_source_amendment`.
  - Add test coverage for `trace_acceptance_binding_missing` classified as `requires_source_amendment`.
  - Add test coverage for `FAILURE_PATH_BINDING_REQUIRED:TRACE-*` classified as `requires_source_amendment`.
  - Add test coverage for `EDGE_CASE_BINDING_REQUIRED:TRACE-*` classified as `requires_source_amendment`.
  - Add test coverage for `ERROR_CASE_CLOSURE_INCOMPLETE:*` classified as `requires_source_amendment`.
  - Add test coverage for multiple equal candidate cases classified as `requires_user_decision`.
- Validation: Run `CMD-001`, `CMD-002`, `CMD-003`, and `CMD-004`.
- Acceptance: `AC-026` through `AC-030` must pass.

### G05 Preserve req-trace source authority boundary

- Purpose: Prove this implementation does not relax req-trace compiler source-authority validation.
- Files: `_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`, `.codex/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`, `.cursor/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`, `.claude/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`, and `tests/acceptance/req-trace-confirmation-block-generator.test.ts`.
- Steps:
  - Do not add code that merges runtime remediation into source `implementationConfirmation` semantics.
  - Add or keep tests proving req-trace blocks when confirmed source lacks source-authority execution contract fields.
  - If canonical req-trace source files are changed for comments or tests, sync `.codex`, `.cursor`, and `.claude` host surfaces to canonical `_bmad` behavior.
  - Ensure `model_packet.json` generation still depends on confirmed source hashes.
- Validation: Run `CMD-005` and `CMD-008`.
- Acceptance: `AC-031`, `AC-032`, and `AC-033` must pass.

### G06 Update documentation surfaces for classifier authority boundary

- Purpose: Document that readiness auto-remediation cannot repair source-authority blockers and that source amendment plus reconfirmation is required.
- Files: `docs/plans/2026-05-29-readiness-blocker-classifier-authority-boundary-goal-execution-plan.md`, `_bmad/skills/bmad-check-implementation-readiness/SKILL.md`, `.codex/skills/bmad-check-implementation-readiness/SKILL.md`, `_bmad/skills/bmad-help/workflow.md`, and `.codex/skills/bmad-help/workflow.md`.
- Steps:
  - Add deterministic text to skill surfaces only when existing surfaces currently imply auto-remediation can repair source-authority blockers.
  - Preserve the rule that `bmad-check-implementation-readiness` is a readiness intent facade and not a global controller.
  - Preserve the rule that `bmad-help` explains routes and does not trigger remediation.
  - Do not modify confirmed requirement documents in this task.
- Validation: Run `CMD-006` and `CMD-008`.
- Acceptance: `AC-024`, `AC-033`, and `AC-034` must pass.

### G07 Run final verification and evidence closure

- Purpose: Prove the classifier boundary, route behavior, req-trace source authority boundary, and encoding integrity are all satisfied.
- Files: no source files are modified in this task.
- Steps:
  - Run `CMD-001` through `CMD-008` in order.
  - Record each command line, exit code, and output summary.
  - Inspect `git status --short`.
  - Inspect `git diff --name-status`.
  - Confirm no unrelated dirty files were reverted.
  - Confirm no confirmed requirement document was silently modified.
- Validation: Run `CMD-001` through `CMD-008`.
- Acceptance: `AC-001` through `AC-034` must pass.
<!-- /goal-slot:implementationTasks -->

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

<!-- goal-slot:strictAcceptanceChecklist required dynamic=traceEvidence -->
- [ ] `AC-001`: Classifier implementation location is identified in `scripts/main-agent-orchestration.ts`.
- [ ] `AC-002`: Readiness remediation entry point is identified in `scripts/main-agent-orchestration.ts`.
- [ ] `AC-003`: Readiness gate input blocker IDs are enumerated in a test or classifier fixture.
- [ ] `AC-004`: Req-trace compiler behavior remains out of scope for classifier implementation tasks `G01..G04`.
- [ ] `AC-005`: Classifier output schema is `readiness-blocker-classification/v1`.
- [ ] `AC-006`: Classification values are exactly `derive_without_reconfirm`, `requires_source_amendment`, and `requires_user_decision`.
- [ ] `AC-007`: `derive_without_reconfirm` maps to `requiredNextAction: "run_deterministic_projection_repair"`.
- [ ] `AC-008`: `requires_source_amendment` maps to `requiredNextAction: "source_amendment_required"`.
- [ ] `AC-009`: `requires_user_decision` maps to `requiredNextAction: "blocked_by_unresolved_user_decision"`.
- [ ] `AC-010`: `PRE_CONFIRMATION_DRILLDOWN_REQUIRED` classifies as `derive_without_reconfirm`.
- [ ] `AC-011`: `PACKET_SOURCE_RECONCILIATION_REQUIRED` classifies as derive only when rerun reconciliation passes and as amendment when rerun reconciliation fails.
- [ ] `AC-012`: `PRE_RENDER_GATE_REPORT_REQUIRED` classifies as derive only when rerun gate passes and defers to failing root blockers when rerun gate fails.
- [ ] `AC-013`: `ATOMIC_TASK_LINEAGE_REQUIRED` supports derive, amendment, and user-decision branches according to `DA-006`.
- [ ] `AC-014`: Pure policy or projection manifest sections classify as `derive_without_reconfirm`.
- [ ] `AC-015`: `requirement_pre_implementation_missing_plan` classifies as `requires_source_amendment`.
- [ ] `AC-016`: `pre_implementation_red_proof_missing` classifies as `requires_source_amendment`.
- [ ] `AC-017`: `pre_implementation_valid_expected_red_missing` classifies as `requires_source_amendment`.
- [ ] `AC-018`: `trace_acceptance_binding_missing` classifies as `requires_source_amendment` unless multiple equal candidates require `requires_user_decision`.
- [ ] `AC-019`: Unknown blocker IDs classify as `requires_source_amendment` with `reasonCode: "unknown_blocker_fail_closed"`.
- [ ] `AC-020`: `readiness_auto_remediation` runs only when every active blocker is classified as `derive_without_reconfirm`.
- [ ] `AC-021`: A single `requires_source_amendment` blocker prevents `readiness_auto_remediation` from running.
- [ ] `AC-022`: A single `requires_user_decision` blocker prevents `readiness_auto_remediation` from running.
- [ ] `AC-023`: Mixed classifications use strictest routing order `requires_user_decision`, `requires_source_amendment`, then `derive_without_reconfirm`.
- [ ] `AC-024`: Main-agent routing returns `source_amendment_required` for source-authority blockers and does not return `dispatch_implement`.
- [ ] `AC-025`: Main-agent routing returns `blocked_by_unresolved_user_decision` for equal-candidate blockers and does not return `dispatch_implement`.
- [ ] `AC-026`: `FAILURE_PATH_BINDING_REQUIRED:TRACE-*` classifies as `requires_source_amendment` unless equal candidates require user decision.
- [ ] `AC-027`: `EDGE_CASE_BINDING_REQUIRED:TRACE-*` classifies as `requires_source_amendment` unless equal candidates require user decision.
- [ ] `AC-028`: `ERROR_CASE_CLOSURE_INCOMPLETE:FAIL-*:*` classifies as `requires_source_amendment` unless equal candidates require user decision.
- [ ] `AC-029`: `ERROR_CASE_CLOSURE_INCOMPLETE:EDGE-*:*` classifies as `requires_source_amendment` unless equal candidates require user decision.
- [ ] `AC-030`: Authority-bearing command target refs, current target map refs, and artifact refs classify as amendment or user decision, not derive.
- [ ] `AC-031`: Req-trace compiler continues to validate confirmed `sourceDocumentHash` and `implementationConfirmationHash`.
- [ ] `AC-032`: Req-trace compiler does not merge runtime remediation into source `implementationConfirmation` semantics.
- [ ] `AC-033`: Host surfaces changed by this implementation are synchronized or left unchanged with documented evidence.
- [ ] `AC-034`: Encoding integrity gate reports `findings=0` after all text edits.
<!-- /goal-slot:strictAcceptanceChecklist -->

## Acceptance Traceability Matrix

<!-- goal-slot:acceptanceTraceabilityMatrix required dynamic=traceEvidence -->
| Task | Acceptance IDs | Artifact IDs | Command IDs |
|---|---|---|---|
| `G01` | `AC-001`, `AC-002`, `AC-003`, `AC-004` | `ART-001`, `ART-002`, `ART-003`, `ART-008` | `CMD-001` |
| `G02` | `AC-005`, `AC-006`, `AC-007`, `AC-008`, `AC-009`, `AC-010`, `AC-011`, `AC-012`, `AC-013`, `AC-014`, `AC-015`, `AC-016`, `AC-017`, `AC-018`, `AC-019` | `ART-001`, `ART-008` | `CMD-001`, `CMD-002`, `CMD-003` |
| `G03` | `AC-020`, `AC-021`, `AC-022`, `AC-023`, `AC-024`, `AC-025` | `ART-001`, `ART-008` | `CMD-001`, `CMD-002`, `CMD-003` |
| `G04` | `AC-026`, `AC-027`, `AC-028`, `AC-029`, `AC-030` | `ART-002`, `ART-003`, `ART-008`, `ART-009`, `ART-010` | `CMD-001`, `CMD-002`, `CMD-003`, `CMD-004` |
| `G05` | `AC-031`, `AC-032`, `AC-033` | `ART-004`, `ART-005`, `ART-006`, `ART-007`, `ART-011` | `CMD-005`, `CMD-008` |
| `G06` | `AC-024`, `AC-033`, `AC-034` | `ART-012`, `ART-013`, `ART-014`, `ART-015`, `ART-016` | `CMD-006`, `CMD-008` |
| `G07` | `AC-001..AC-034` | `ART-001..ART-016` | `CMD-001..CMD-008` |

### Artifact Register

- `ART-001`: `scripts/main-agent-orchestration.ts`; producer `G02/G03`; consumer `CMD-001`, `CMD-002`, `CMD-003`, and `CMD-007`.
- `ART-002`: `scripts/main-agent-implementation-readiness-gate.ts`; producer `G04` when gate output changes; consumer `CMD-004`.
- `ART-003`: `scripts/ai-tdd-contract-gate.ts`; producer `G04` when AI-TDD blocker output changes; consumer `CMD-004`.
- `ART-004`: `_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`; producer `G05` only when source-boundary tests require source comments or guard code; consumer `CMD-005`.
- `ART-005`: `.codex/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`; producer `G05` when `ART-004` changes; consumer `CMD-008`.
- `ART-006`: `.cursor/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`; producer `G05` when `ART-004` changes; consumer `CMD-008`.
- `ART-007`: `.claude/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`; producer `G05` when `ART-004` changes; consumer `CMD-008`.
- `ART-008`: `tests/acceptance/main-agent-readiness-auto-remediation.test.ts`; producer `G01/G02/G03/G04`; consumer `CMD-001`, `CMD-002`, and `CMD-003`.
- `ART-009`: `tests/acceptance/main-agent-implementation-readiness-gate-record.test.ts`; producer `G04`; consumer `CMD-004`.
- `ART-010`: `tests/acceptance/ai-tdd-contract-gate.test.ts`; producer `G04`; consumer `CMD-004`.
- `ART-011`: `tests/acceptance/req-trace-confirmation-block-generator.test.ts`; producer `G05`; consumer `CMD-005`.
- `ART-012`: `_bmad/skills/bmad-check-implementation-readiness/SKILL.md`; producer `G06` only when existing text conflicts with `DA-007`; consumer `CMD-006`.
- `ART-013`: `.codex/skills/bmad-check-implementation-readiness/SKILL.md`; producer `G06` when `ART-012` changes; consumer `CMD-008`.
- `ART-014`: `_bmad/skills/bmad-help/workflow.md`; producer `G06` only when route text conflicts with `DA-007`; consumer `CMD-006`.
- `ART-015`: `.codex/skills/bmad-help/workflow.md`; producer `G06` when `ART-014` changes; consumer `CMD-008`.
- `ART-016`: `docs/plans/2026-05-29-readiness-blocker-classifier-authority-boundary-goal-execution-plan.md`; producer `goal-execution-contract-generator`; consumer `CMD-006` and `CMD-007`.
<!-- /goal-slot:acceptanceTraceabilityMatrix -->

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

<!-- goal-slot:requiredTestCommands required dynamic=requiredCommands -->
Run commands from repository root in numeric order.

- `CMD-001`: `npx vitest run tests/acceptance/main-agent-readiness-auto-remediation.test.ts --reporter=dot`; pass condition is exit code 0; proves `AC-001..AC-025`.
- `CMD-002`: `npx vitest run tests/acceptance/main-agent-readiness-auto-remediation.test.ts tests/acceptance/main-agent-implementation-readiness-gate-record.test.ts --reporter=dot`; pass condition is exit code 0; proves classifier and gate integration for `AC-001..AC-030`.
- `CMD-003`: `npx vitest run tests/acceptance/main-agent-readiness-auto-remediation.test.ts tests/acceptance/main-agent-implementation-readiness-gate-record.test.ts tests/acceptance/ai-tdd-contract-gate.test.ts --reporter=dot`; pass condition is exit code 0; proves remediation, readiness gate, and AI-TDD gate integration for `AC-001..AC-030`.
- `CMD-004`: `npx vitest run tests/acceptance/main-agent-implementation-readiness-gate-record.test.ts tests/acceptance/ai-tdd-contract-gate.test.ts --reporter=dot`; pass condition is exit code 0; proves gate-level source-authority blockers for `AC-026..AC-030`.
- `CMD-005`: `npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts --reporter=dot`; pass condition is exit code 0; proves req-trace source authority boundary for `AC-031` and `AC-032`.
- `CMD-006`: `pwsh.exe -NoLogo -NoProfile -Command '& { $path = "docs/plans/2026-05-29-readiness-blocker-classifier-authority-boundary-goal-execution-plan.md"; $text = Get-Content -Raw -LiteralPath $path; $required = @("/goal Entry","Contract Freeze Rules","Contract Completeness Gate","Non-Negotiable Execution Rules","Authority Model","Root Cause To Fix","Domain-Specific Contract Addenda","Implementation Tasks","Strict Acceptance Checklist","Acceptance Traceability Matrix","Required Test Commands","Manual Verification Scenarios","Completion Evidence Packet","Stop Conditions"); foreach ($item in $required) { if ($text -notmatch [regex]::Escape("## $item") -and $item -ne "/goal Entry") { Write-Error "missing section $item"; exit 1 }; if ($item -eq "/goal Entry" -and $text -notmatch "## /goal Entry") { Write-Error "missing section /goal Entry"; exit 1 } }; $p1 = -join ([char[]](91,84,79,68,79,93)); $p2 = -join ([char[]](84,66,68)); if ($text.Contains($p1) -or $text.Contains($p2)) { Write-Error "placeholder found"; exit 1 }; Write-Output "contract completeness pass" }'`; pass condition is exit code 0 and output containing `contract completeness pass`; proves `AC-034`.
- `CMD-007`: `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js`; pass condition is output containing `findings=0`; proves `AC-034`.
- `CMD-008`: `pwsh.exe -NoLogo -NoProfile -Command '& { $pairs = @(@("_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js",".codex/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js"),@("_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js",".cursor/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js"),@("_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js",".claude/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js")); foreach ($pair in $pairs) { if ((Test-Path -LiteralPath $pair[0]) -and (Test-Path -LiteralPath $pair[1])) { $left = (Get-FileHash -Algorithm SHA256 -LiteralPath $pair[0]).Hash; $right = (Get-FileHash -Algorithm SHA256 -LiteralPath $pair[1]).Hash; if ($left -ne $right) { Write-Error ("mirror hash mismatch {0} {1}" -f $pair[0], $pair[1]); exit 1 } } }; Write-Output "req-trace host surfaces match" }'`; pass condition is exit code 0 and output containing `req-trace host surfaces match`; proves `AC-033`.
<!-- /goal-slot:requiredTestCommands -->

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

<!-- goal-slot:manualVerificationScenarios required dynamic=manualScenarios -->
- `MV-001`: Input blockers contain only `PRE_CONFIRMATION_DRILLDOWN_REQUIRED`, `PRE_RENDER_GATE_REPORT_REQUIRED`, and `MANIFEST_SECTION_REQUIRED:legacyDenial`; expected result is every blocker classified as `derive_without_reconfirm` and `readiness_auto_remediation` allowed to run.
- `MV-002`: Input blockers contain `requirement_pre_implementation_missing_plan`; expected result is `requires_source_amendment`, `source_amendment_required`, no readiness auto-remediation, and no `dispatch_implement`.
- `MV-003`: Input blockers contain `pre_implementation_red_proof_missing` and `pre_implementation_valid_expected_red_missing`; expected result is `requires_source_amendment`, `source_amendment_required`, no readiness auto-remediation, and no `dispatch_implement`.
- `MV-004`: Input blockers contain `trace_acceptance_binding_missing` with two equal valid acceptance candidates; expected result is `requires_user_decision`, `blocked_by_unresolved_user_decision`, no readiness auto-remediation, and no `dispatch_implement`.
- `MV-005`: Input blockers contain `ERROR_CASE_CLOSURE_INCOMPLETE:FAIL-001:TRACE`; expected result is `requires_source_amendment`, `source_amendment_required`, no readiness auto-remediation, and no `dispatch_implement`.
- `MV-006`: Req-trace compiler receives a confirmed source that lacks source-authority execution contract fields but has runtime remediation records; expected result is blocked compiler output unless the source has been amended and reconfirmed.
<!-- /goal-slot:manualVerificationScenarios -->

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

<!-- goal-slot:completionEvidencePacket required dynamic=evidencePacket -->
Required completion evidence fields:

- `generatedContractPath`: `docs/plans/2026-05-29-readiness-blocker-classifier-authority-boundary-goal-execution-plan.md`.
- `sourcePlanPath`: `conversation://2026-05-29-readiness-blocker-classifier-authority-boundary-rules`.
- `sourcePlanHash`: `sha256:fb55e35db0c57237da2c610172180737a5f56d89e548e6a65e4d4a4c208a184c`.
- `taskStatus`: status for `G01`, `G02`, `G03`, `G04`, `G05`, `G06`, and `G07`.
- `acceptanceStatus`: status for every `AC-001..AC-034` item.
- `commandEvidence`: command line, exit code, and output summary for `CMD-001`, `CMD-002`, `CMD-003`, `CMD-004`, `CMD-005`, `CMD-006`, `CMD-007`, and `CMD-008`.
- `classifierEvidence`: list of blocker IDs tested, classification result, `requiredNextAction`, and route result.
- `sourceAuthorityEvidence`: evidence that req-trace compiler still validates confirmed source hashes and does not use runtime remediation to replace source execution contract fields.
- `artifactSummary`: changed-path summary for `ART-001..ART-016`.
- `encodingGate`: `CMD-007` output containing `findings=0`.
- `hostSurfaceGate`: `CMD-008` output containing `req-trace host surfaces match`.
- `notDoneStatus`: `ND-001`, `ND-002`, `ND-003`, `ND-004`, `ND-005`, and `ND-006` remain true.

### NOT DONE Rows

- `ND-001`: This contract does not modify confirmed requirement source documents.
- `ND-002`: This contract does not let runtime remediation replace confirmed source execution contract fields.
- `ND-003`: This contract does not relax req-trace compiler source authority.
- `ND-004`: This contract does not add a new mental model.
- `ND-005`: This contract does not make `bmad-check-implementation-readiness` a global controller.
- `ND-006`: This contract does not execute `/goal`; it defines deterministic execution obligations for an explicit `/goal` run that cites this contract.
<!-- /goal-slot:completionEvidencePacket -->

## Stop Conditions

<!-- goal-slot:stopConditions required dynamic=stopConditions -->
- `SC-001`: Stop with `scope_amendment_required` when implementation requires files outside `ART-001..ART-016`.
- `SC-002`: Stop with `semantic_decision_required` when a blocker cannot be classified without changing confirmed source semantics.
- `SC-003`: Stop with `source_amendment_required` when any active blocker belongs to `requires_source_amendment`.
- `SC-004`: Stop with `blocked_by_unresolved_user_decision` when multiple equal valid candidates exist and source does not choose one.
- `SC-005`: Stop with `validation_contract_required` when any `CMD-001..CMD-008` command is unavailable and no replacement command is declared by contract amendment.
- `SC-006`: Stop with `confirmed_source_integrity_violation` when source hashes no longer match the current confirmed source.
- `SC-007`: Stop with `req_trace_authority_violation` when a proposed fix requires req-trace compiler to treat runtime remediation as confirmed source semantics.
<!-- /goal-slot:stopConditions -->
