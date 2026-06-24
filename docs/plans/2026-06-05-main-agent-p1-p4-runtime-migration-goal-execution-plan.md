# Goal Execution Contract

---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:b67ad6fb7f8c3ea903f03c5b51331fd530252ece0d9b629bf8c11ee93d5c4b70
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: conversation://main-agent-p1-p4-runtime-migration
sourcePlanHash: sha256:96afad1d7f9bf3aeebd7a6c57cadf2a0cadc243e9dd55a0f3ff8894303064bdf
runtimeRecordId: main-agent-p1-p4-runtime-migration
entryFlow: main_agent_p1_p4_runtime_migration
taskRange: G001-G019
acceptanceRange: ACC001-ACC016
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: execute_batches_wave_3_6_to_wave_3_9_then_registry_install_matrix_encoding_and_evidence_closeout
stopPolicy: stop_on_contract_gap_scope_expansion_root_script_deletion_consumer_root_ts_dependency_tsx_ts_node_dependency_or_unclassified_p3_runtime_claim
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-05T00:00:00+08:00
---

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

```text
/goal docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md
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

- Use `pwsh.exe` for shell commands on Windows.
- Use `apply_patch` for manual code and documentation edits.
- Run `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` before and after Markdown, JSON, YAML, skill, command, generated-surface, or package-surface edits.
- Inspect `git status --short --branch` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, tests, CLI code, runtime modules, registry files, evidence receipts, or installed surfaces.
- Do not delete any root `scripts/*` file in Wave 3.6, Wave 3.7, Wave 3.8, or Wave 3.9.
- Do not move any root `scripts/*` file in Wave 3.6, Wave 3.7, Wave 3.8, or Wave 3.9.
- Do not rename any root `scripts/*` file in Wave 3.6, Wave 3.7, Wave 3.8, or Wave 3.9.
- Do not classify any root `scripts/*` file as deletion-ready in this contract.
- Do not set `deletionAllowed: true` for any registry entry, evidence entry, summary statement, manifest row, or installed-surface inventory row.
- Do not require consumer projects to install `tsx`.
- Do not require consumer projects to install `ts-node`.
- Do not let package tests import root `scripts/*.ts`.
- Do not make `repo-governance/**` a consumer runtime dependency.
- Do not make `tools/script-migration/**` a consumer runtime dependency.
- Do not execute root `scripts/*.ts` from package runtime paths covered by this contract.
- Do not claim P3 runtime migration before `classification-compression.json` records deterministic route decisions for all 38 P3 scripts.
- Do not claim P4 public CLI migration because P4 scope is durable helper copy unless a manifest row proves an existing package caller needs a helper-facing command.
- `NOT DONE: deletion of any original root script is excluded because deletion requires separate per-script approval after migration evidence and caller-switch proof.`
- `NOT DONE: direct consumer-root execution of every registry-declared source script is excluded because normal consumer projects must use package CLI/runtime or declared installed helpers.`
- `NOT DONE: P5 source-dev-only and deprecated classification debt is excluded because this contract covers P1-P4 remaining runtime migration backlog only.`

## Authority Model

- `conversation://main-agent-p1-p4-runtime-migration` is the human requirement source for this contract.
- `sourcePlanHash=sha256:96afad1d7f9bf3aeebd7a6c57cadf2a0cadc243e9dd55a0f3ff8894303064bdf` binds this contract to the generated P1-P4 backlog summary and script lists.
- `docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md` is the frozen execution contract for this goal.
- `repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md` is the source for P1-P4 priority membership.
- `repo-governance/script-migration-registry.yaml` is the source for already validated migration rows and new Wave 3.6 through Wave 3.9 registry entries.
- `packages/bmad-speckit/src/main-agent/**` is the package source authority for migrated Main Agent runtime actions and helpers.
- `packages/bmad-speckit/dist/main-agent/**` is the package consumer runtime output for migrated Main Agent runtime actions and helpers.
- `packages/bmad-speckit/bin/bmad-speckit.js` is the package CLI facade authority for consumer-visible command dispatch.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/candidate-manifest.json` is the Wave 3.6 candidate authority after G002 writes it.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/candidate-manifest.json` is the Wave 3.7 candidate authority after G004 writes it.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json` is the Wave 3.8 P3 route authority after G007 writes it.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json` is the Wave 3.9 durable helper candidate authority after G009 writes it.
- `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/final-evidence-packet.json` is the final evidence packet after G017 writes it.
- `/goal completion is not closeout proof`; completion proof requires package tests, dist build, static guards, install-matrix receipts, registry validation, evidence receipts, summary files, final encoding gate, and no-deletion worktree evidence.

## Root Cause To Fix

Wave 3.1 through Wave 3.5 validated P0, selected P1 runtime closures, and installation-surface hardening, but P1-P4 still contain 82 remaining scripts from the Wave 3 priority matrix. These rows remain migration debt because consumer-visible or durable Main Agent runtime behavior may still depend on source repository root scripts, TypeScript runners, compiled fallback paths, or unclassified helper placement.

The defect is not that root `scripts/*` exists. The defect is that covered runtime routes and durable helper dependencies are not yet package-local, registry-backed, install-matrix-proven, and encoded as validated migration records. This contract fixes that by forcing one frozen goal with internal batches instead of four separate goals that can drift from the same registry, install matrix, and no-deletion policy.

The execution model is intentionally batched:

- Wave 3.6 clears P1 remaining package runtime modules.
- Wave 3.7 clears P2 requirement and scoring runtime modules.
- Wave 3.8 compresses P3 classification before migration, then migrates only true runtime candidates.
- Wave 3.9 clears P4 durable helpers as package-local helpers or assets.

## Domain-Specific Contract Addenda

### D001 Backlog Source Addendum

- The P1-P4 backlog source is `repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md` crossed with `repo-governance/script-migration-registry.yaml`.
- A script is remaining only when it appears under P1, P2, P3, or P4 in the priority matrix and has no registry entry with the same `originalPath` and `validationStatus: passed`.
- P1 remaining count MUST equal 22.
- P2 remaining count MUST equal 8.
- P3 remaining count MUST equal 38.
- P4 remaining count MUST equal 14.
- Total remaining count MUST equal 82.

### D002 Target Path Addendum

- For P1, P2, and P3 rows classified as `package_runtime_module`, the target source path MUST be under `packages/bmad-speckit/src/main-agent/actions/` with a file name equal to the computed `actionSlug` plus `.js`.
- For P1, P2, and P3 rows classified as `package_runtime_module`, the target dist path MUST be under `packages/bmad-speckit/dist/main-agent/actions/` with a file name equal to the computed `actionSlug` plus `.js`.
- The `actionSlug` MUST equal the script basename without extension and without the leading `main-agent-` prefix when that prefix exists.
- For P4 rows, the target source path MUST be under `packages/bmad-speckit/src/main-agent/helpers/` with a file name equal to the script basename plus `.js`.
- For P4 rows, the target dist path MUST be under `packages/bmad-speckit/dist/main-agent/helpers/` with a file name equal to the script basename plus `.js`.
- Registry entries MUST record `deletionAllowed: false` and `deletionApprovalRef: null` for every original path.

### D003 P3 Classification Compression Addendum

- P3 route decisions MUST be written before P3 runtime migration status is marked validated.
- Each P3 row MUST have one selected route from `package_runtime_module`, `durable_helper_copy`, `repo_internal_reclassify`, `deprecated_no_migration`, or `blocked_until_semantic_decision`.
- Each P3 row MUST record caller evidence, consumer reachability, selected route reason, target paths, and validation status.
- A P3 row classified as `repo_internal_reclassify` or `deprecated_no_migration` MUST NOT be counted as a runtime migration.

### D004 Install Surface Addendum

- Consumer runtime proof MUST invoke package CLI or package runtime through `npx --no-install bmad-speckit` followed by the covered action arguments, `npx --package` followed by the package name or tarball path and `bmad-speckit`, or an installed package binary.
- Consumer runtime proof MUST record `usedRootScript: false`, `usedTsx: false`, `usedTsNode: false`, and `usedCompiledFallback: false` for covered migrated actions.
- The final status language MUST NOT claim that all declared source scripts are directly callable in a consumer project.

## Backlog Inventory

### P1 Remaining Scripts

| Script | Entry ID | Strategy | Planned Target Source | Planned Target Dist |
| --- | --- | --- | --- | --- |
| `scripts/live-smoke-main-agent-runtime.ts` | `live-smoke-main-agent-runtime` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/live-smoke-main-agent-runtime.ts` | `packages/bmad-speckit/dist/main-agent/actions/live-smoke-main-agent-runtime.js` |
| `scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts` | `main-agent-ai-tdd-closeout-remediation-adapter` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/ai-tdd-closeout-remediation-adapter.ts` | `packages/bmad-speckit/dist/main-agent/actions/ai-tdd-closeout-remediation-adapter.js` |
| `scripts/main-agent-audit-review-gate.ts` | `main-agent-audit-review-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/audit-review-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/audit-review-gate.js` |
| `scripts/main-agent-bmad-artifact-hardcut.ts` | `main-agent-bmad-artifact-hardcut` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/bmad-artifact-hardcut.ts` | `packages/bmad-speckit/dist/main-agent/actions/bmad-artifact-hardcut.js` |
| `scripts/main-agent-control-plane-isolation-check.ts` | `main-agent-control-plane-isolation-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/control-plane-isolation-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/control-plane-isolation-check.js` |
| `scripts/main-agent-data-governance-gate.ts` | `main-agent-data-governance-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/data-governance-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/data-governance-gate.js` |
| `scripts/main-agent-dataset-release-gate.ts` | `main-agent-dataset-release-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/dataset-release-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/dataset-release-gate.js` |
| `scripts/main-agent-decision-field-check.ts` | `main-agent-decision-field-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/decision-field-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/decision-field-check.js` |
| `scripts/main-agent-development-journey-matrix.ts` | `main-agent-development-journey-matrix` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/development-journey-matrix.ts` | `packages/bmad-speckit/dist/main-agent/actions/development-journey-matrix.js` |
| `scripts/main-agent-entryflow-traceability-check.ts` | `main-agent-entryflow-traceability-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/entryflow-traceability-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/entryflow-traceability-check.js` |
| `scripts/main-agent-execution-closure-gate.ts` | `main-agent-execution-closure-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/execution-closure-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/execution-closure-gate.js` |
| `scripts/main-agent-functional-resume-check.ts` | `main-agent-functional-resume-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/functional-resume-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/functional-resume-check.js` |
| `scripts/main-agent-governed-data-products.ts` | `main-agent-governed-data-products` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/governed-data-products.ts` | `packages/bmad-speckit/dist/main-agent/actions/governed-data-products.js` |
| `scripts/main-agent-production-loop-ready-check.ts` | `main-agent-production-loop-ready-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/production-loop-ready-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/production-loop-ready-check.js` |
| `scripts/main-agent-runtime-policy-snapshot-check.ts` | `main-agent-runtime-policy-snapshot-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/runtime-policy-snapshot-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/runtime-policy-snapshot-check.js` |
| `scripts/main-agent-scoring-gates-check.ts` | `main-agent-scoring-gates-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/scoring-gates-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/scoring-gates-check.js` |
| `scripts/main-agent-trace-status-policy-check.ts` | `main-agent-trace-status-policy-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/trace-status-policy-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/trace-status-policy-check.js` |
| `scripts/orchestration-dispatch-contract.ts` | `orchestration-dispatch-contract` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/orchestration-dispatch-contract.ts` | `packages/bmad-speckit/dist/main-agent/actions/orchestration-dispatch-contract.js` |
| `scripts/orchestration-governance-contract.ts` | `orchestration-governance-contract` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/orchestration-governance-contract.ts` | `packages/bmad-speckit/dist/main-agent/actions/orchestration-governance-contract.js` |
| `scripts/orchestration-state.ts` | `orchestration-state` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/orchestration-state.ts` | `packages/bmad-speckit/dist/main-agent/actions/orchestration-state.js` |
| `scripts/record-main-agent-inspect-readiness-closure.ts` | `record-main-agent-inspect-readiness-closure` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/record-main-agent-inspect-readiness-closure.ts` | `packages/bmad-speckit/dist/main-agent/actions/record-main-agent-inspect-readiness-closure.js` |
| `scripts/skill-orchestration-audit.ts` | `skill-orchestration-audit` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/skill-orchestration-audit.ts` | `packages/bmad-speckit/dist/main-agent/actions/skill-orchestration-audit.js` |

### P2 Remaining Scripts

| Script | Entry ID | Strategy | Planned Target Source | Planned Target Dist |
| --- | --- | --- | --- | --- |
| `scripts/initialize-six-model-requirement-confirmation.ts` | `initialize-six-model-requirement-confirmation` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/initialize-six-model-requirement-confirmation.ts` | `packages/bmad-speckit/dist/main-agent/actions/initialize-six-model-requirement-confirmation.js` |
| `scripts/reconfirmation-runtime.ts` | `reconfirmation-runtime` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/reconfirmation-runtime.ts` | `packages/bmad-speckit/dist/main-agent/actions/reconfirmation-runtime.js` |
| `scripts/requirement-record-control-store.ts` | `requirement-record-control-store` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/requirement-record-control-store.ts` | `packages/bmad-speckit/dist/main-agent/actions/requirement-record-control-store.js` |
| `scripts/requirement-record-live-schema-gate.ts` | `requirement-record-live-schema-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/requirement-record-live-schema-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/requirement-record-live-schema-gate.js` |
| `scripts/requirement-record-schema-evolution.ts` | `requirement-record-schema-evolution` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/requirement-record-schema-evolution.ts` | `packages/bmad-speckit/dist/main-agent/actions/requirement-record-schema-evolution.js` |
| `scripts/resolve-active-requirement.ts` | `resolve-active-requirement` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/resolve-active-requirement.ts` | `packages/bmad-speckit/dist/main-agent/actions/resolve-active-requirement.js` |
| `scripts/runtime-scoring-data-path.ts` | `runtime-scoring-data-path` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/runtime-scoring-data-path.ts` | `packages/bmad-speckit/dist/main-agent/actions/runtime-scoring-data-path.js` |
| `scripts/six-model-runtime-decision.ts` | `six-model-runtime-decision` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/six-model-runtime-decision.ts` | `packages/bmad-speckit/dist/main-agent/actions/six-model-runtime-decision.js` |

### P3 Remaining Scripts

| Script | Entry ID | Strategy | Planned Target Source | Planned Target Dist |
| --- | --- | --- | --- | --- |
| `scripts/adaptive-intake-governance-gate.ts` | `adaptive-intake-governance-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/adaptive-intake-governance-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/adaptive-intake-governance-gate.js` |
| `scripts/adaptive-intake-proof-gate.ts` | `adaptive-intake-proof-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/adaptive-intake-proof-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/adaptive-intake-proof-gate.js` |
| `scripts/ai-tdd-contract-gate.ts` | `ai-tdd-contract-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/ai-tdd-contract-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/ai-tdd-contract-gate.js` |
| `scripts/audit-scoring-convergence-policy.ts` | `audit-scoring-convergence-policy` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/audit-scoring-convergence-policy.ts` | `packages/bmad-speckit/dist/main-agent/actions/audit-scoring-convergence-policy.js` |
| `scripts/audit-stage-routing.ts` | `audit-stage-routing` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/audit-stage-routing.ts` | `packages/bmad-speckit/dist/main-agent/actions/audit-stage-routing.js` |
| `scripts/audit-triad-orchestrator.ts` | `audit-triad-orchestrator` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/audit-triad-orchestrator.ts` | `packages/bmad-speckit/dist/main-agent/actions/audit-triad-orchestrator.js` |
| `scripts/auditor-post-actions.ts` | `auditor-post-actions` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/auditor-post-actions.ts` | `packages/bmad-speckit/dist/main-agent/actions/auditor-post-actions.js` |
| `scripts/auditor-spec.ts` | `auditor-spec` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/auditor-spec.ts` | `packages/bmad-speckit/dist/main-agent/actions/auditor-spec.js` |
| `scripts/bmad-runtime-worker.ts` | `bmad-runtime-worker` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/bmad-runtime-worker.ts` | `packages/bmad-speckit/dist/main-agent/actions/bmad-runtime-worker.js` |
| `scripts/controlled-readiness-audit-bridge.ts` | `controlled-readiness-audit-bridge` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/controlled-readiness-audit-bridge.ts` | `packages/bmad-speckit/dist/main-agent/actions/controlled-readiness-audit-bridge.js` |
| `scripts/critical-auditor-profile.ts` | `critical-auditor-profile` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/critical-auditor-profile.ts` | `packages/bmad-speckit/dist/main-agent/actions/critical-auditor-profile.js` |
| `scripts/e2e-dual-host-journey-runner.ts` | `e2e-dual-host-journey-runner` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/e2e-dual-host-journey-runner.ts` | `packages/bmad-speckit/dist/main-agent/actions/e2e-dual-host-journey-runner.js` |
| `scripts/e2e-host-matrix-journey-runner.ts` | `e2e-host-matrix-journey-runner` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/e2e-host-matrix-journey-runner.ts` | `packages/bmad-speckit/dist/main-agent/actions/e2e-host-matrix-journey-runner.js` |
| `scripts/final-closeout-evidence-runner.ts` | `final-closeout-evidence-runner` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/final-closeout-evidence-runner.ts` | `packages/bmad-speckit/dist/main-agent/actions/final-closeout-evidence-runner.js` |
| `scripts/governance-host-dispatch-adapter.ts` | `governance-host-dispatch-adapter` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/governance-host-dispatch-adapter.ts` | `packages/bmad-speckit/dist/main-agent/actions/governance-host-dispatch-adapter.js` |
| `scripts/governance-packet-dispatch-worker.ts` | `governance-packet-dispatch-worker` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/governance-packet-dispatch-worker.ts` | `packages/bmad-speckit/dist/main-agent/actions/governance-packet-dispatch-worker.js` |
| `scripts/host-runtime-mode.ts` | `host-runtime-mode` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/host-runtime-mode.ts` | `packages/bmad-speckit/dist/main-agent/actions/host-runtime-mode.js` |
| `scripts/i18n/print-resolved-audit-prompt.ts` | `print-resolved-audit-prompt` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/print-resolved-audit-prompt.ts` | `packages/bmad-speckit/dist/main-agent/actions/print-resolved-audit-prompt.js` |
| `scripts/i18n/render-audit-block-cli.ts` | `render-audit-block-cli` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/render-audit-block-cli.ts` | `packages/bmad-speckit/dist/main-agent/actions/render-audit-block-cli.js` |
| `scripts/i18n/resolve-audit-prompt-path.ts` | `resolve-audit-prompt-path` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/resolve-audit-prompt-path.ts` | `packages/bmad-speckit/dist/main-agent/actions/resolve-audit-prompt-path.js` |
| `scripts/ingest-implementation-evidence.ts` | `ingest-implementation-evidence` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/ingest-implementation-evidence.ts` | `packages/bmad-speckit/dist/main-agent/actions/ingest-implementation-evidence.js` |
| `scripts/parse-bmad-audit-result.ts` | `parse-bmad-audit-result` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/parse-bmad-audit-result.ts` | `packages/bmad-speckit/dist/main-agent/actions/parse-bmad-audit-result.js` |
| `scripts/party-mode-gate-check.ts` | `party-mode-gate-check` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/party-mode-gate-check.ts` | `packages/bmad-speckit/dist/main-agent/actions/party-mode-gate-check.js` |
| `scripts/per-must-closure-evidence-index.ts` | `per-must-closure-evidence-index` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/per-must-closure-evidence-index.ts` | `packages/bmad-speckit/dist/main-agent/actions/per-must-closure-evidence-index.js` |
| `scripts/pre-rerun-anti-false-positive-gate.ts` | `pre-rerun-anti-false-positive-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/pre-rerun-anti-false-positive-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/pre-rerun-anti-false-positive-gate.js` |
| `scripts/reviewer-contract.ts` | `reviewer-contract` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/reviewer-contract.ts` | `packages/bmad-speckit/dist/main-agent/actions/reviewer-contract.js` |
| `scripts/reviewer-registry.ts` | `reviewer-registry` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/reviewer-registry.ts` | `packages/bmad-speckit/dist/main-agent/actions/reviewer-registry.js` |
| `scripts/reviewer-rollout-gate.ts` | `reviewer-rollout-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/reviewer-rollout-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/reviewer-rollout-gate.js` |
| `scripts/reviewer-runtime-definition.ts` | `reviewer-runtime-definition` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/reviewer-runtime-definition.ts` | `packages/bmad-speckit/dist/main-agent/actions/reviewer-runtime-definition.js` |
| `scripts/reviewer-schema.ts` | `reviewer-schema` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/reviewer-schema.ts` | `packages/bmad-speckit/dist/main-agent/actions/reviewer-schema.js` |
| `scripts/run-ci-release-gate-fixture.js` | `run-ci-release-gate-fixture` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/run-ci-release-gate-fixture.ts` | `packages/bmad-speckit/dist/main-agent/actions/run-ci-release-gate-fixture.js` |
| `scripts/strict-closeout-proof-gate.ts` | `strict-closeout-proof-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/strict-closeout-proof-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/strict-closeout-proof-gate.js` |
| `scripts/subagent-evidence-envelope.ts` | `subagent-evidence-envelope` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/subagent-evidence-envelope.ts` | `packages/bmad-speckit/dist/main-agent/actions/subagent-evidence-envelope.js` |
| `scripts/supervised-worker-runtime.ts` | `supervised-worker-runtime` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/supervised-worker-runtime.ts` | `packages/bmad-speckit/dist/main-agent/actions/supervised-worker-runtime.js` |
| `scripts/target-artifact-realization-gate.ts` | `target-artifact-realization-gate` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/target-artifact-realization-gate.ts` | `packages/bmad-speckit/dist/main-agent/actions/target-artifact-realization-gate.js` |
| `scripts/trace-040-evidence-packet-generator.ts` | `trace-040-evidence-packet-generator` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/trace-040-evidence-packet-generator.ts` | `packages/bmad-speckit/dist/main-agent/actions/trace-040-evidence-packet-generator.js` |
| `scripts/update-runtime-audit-index.ts` | `update-runtime-audit-index` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/update-runtime-audit-index.ts` | `packages/bmad-speckit/dist/main-agent/actions/update-runtime-audit-index.js` |
| `scripts/verify-cursor-audit-granularity.ts` | `verify-cursor-audit-granularity` | `package_runtime_module` | `packages/bmad-speckit/src/main-agent/actions/verify-cursor-audit-granularity.ts` | `packages/bmad-speckit/dist/main-agent/actions/verify-cursor-audit-granularity.js` |

### P4 Remaining Scripts

| Script | Entry ID | Strategy | Planned Target Source | Planned Target Dist |
| --- | --- | --- | --- | --- |
| `scripts/governance-packet-execution-store.ts` | `governance-packet-execution-store` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/governance-packet-execution-store.ts` | `packages/bmad-speckit/dist/main-agent/helpers/governance-packet-execution-store.js` |
| `scripts/governance-packet-reconciler.ts` | `governance-packet-reconciler` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/governance-packet-reconciler.ts` | `packages/bmad-speckit/dist/main-agent/helpers/governance-packet-reconciler.js` |
| `scripts/governance-remediation-artifact.ts` | `governance-remediation-artifact` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/governance-remediation-artifact.ts` | `packages/bmad-speckit/dist/main-agent/helpers/governance-remediation-artifact.js` |
| `scripts/governance-remediation-config.ts` | `governance-remediation-config` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/governance-remediation-config.ts` | `packages/bmad-speckit/dist/main-agent/helpers/governance-remediation-config.js` |
| `scripts/governance-remediation-runner.ts` | `governance-remediation-runner` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/governance-remediation-runner.ts` | `packages/bmad-speckit/dist/main-agent/helpers/governance-remediation-runner.js` |
| `scripts/i18n/agent-display-names.ts` | `agent-display-names` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/agent-display-names.ts` | `packages/bmad-speckit/dist/main-agent/helpers/agent-display-names.js` |
| `scripts/i18n/load-manifest.ts` | `load-manifest` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/load-manifest.ts` | `packages/bmad-speckit/dist/main-agent/helpers/load-manifest.js` |
| `scripts/i18n/party-mode-runtime-assets.ts` | `party-mode-runtime-assets` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/party-mode-runtime-assets.ts` | `packages/bmad-speckit/dist/main-agent/helpers/party-mode-runtime-assets.js` |
| `scripts/model-governance-policy-filter.ts` | `model-governance-policy-filter` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/model-governance-policy-filter.ts` | `packages/bmad-speckit/dist/main-agent/helpers/model-governance-policy-filter.js` |
| `scripts/party-mode-runtime.ts` | `party-mode-runtime` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/party-mode-runtime.ts` | `packages/bmad-speckit/dist/main-agent/helpers/party-mode-runtime.js` |
| `scripts/prompt-routing-governance.ts` | `prompt-routing-governance` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/prompt-routing-governance.ts` | `packages/bmad-speckit/dist/main-agent/helpers/prompt-routing-governance.js` |
| `scripts/prompt-routing-hints-schema.ts` | `prompt-routing-hints-schema` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/prompt-routing-hints-schema.ts` | `packages/bmad-speckit/dist/main-agent/helpers/prompt-routing-hints-schema.js` |
| `scripts/prompt-routing-hints.ts` | `prompt-routing-hints` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/prompt-routing-hints.ts` | `packages/bmad-speckit/dist/main-agent/helpers/prompt-routing-hints.js` |
| `scripts/skill-inventory-provider.ts` | `skill-inventory-provider` | `durable_helper_copy` | `packages/bmad-speckit/src/main-agent/helpers/skill-inventory-provider.ts` | `packages/bmad-speckit/dist/main-agent/helpers/skill-inventory-provider.js` |

## Implementation Tasks

### G001 Preflight and baseline lock

Purpose: Preflight and baseline lock.

Files:
- `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/preflight.json`

Steps:
- Run CMD-01.
- Run CMD-02.
- Record the exact P1-P4 counts derived from the priority matrix and registry.

Validation: CMD-01 and CMD-02 pass.

Acceptance: ACC001.

### G002 Wave 3.6 candidate manifest

Purpose: Wave 3.6 candidate manifest.

Files:
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/candidate-manifest.json`
- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-6.cjs`

Steps:
- Write a Wave 3.6 manifest with exactly the 22 P1 remaining scripts listed in the P1 backlog section.
- Record entryId, originalPath, actionSlug, target source paths, target dist paths, public command aliases, caller switch requirement, deletionAllowed=false, and evidence path for every P1 row.
- Implement CMD-03 validator coverage for manifest-only mode.

Validation: CMD-03 passes.

Acceptance: ACC002.

### G003 Wave 3.6 migrate and validate P1

Purpose: Wave 3.6 migrate and validate P1.

Files:
- `packages/bmad-speckit/src/main-agent/actions/**`
- `packages/bmad-speckit/dist/main-agent/actions/**`
- `packages/bmad-speckit/src/main-agent/runtime.ts`
- `packages/bmad-speckit/dist/main-agent/runtime.js`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/tests/main-agent-wave-3-6-runtime-actions.test.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/summary.md`
- `tests/acceptance/main-agent-runtime-migration-wave-3-6-contract.test.ts`
- `repo-governance/script-migration-registry.yaml`

Steps:
- Port P1 behavior into package runtime source without importing root scripts.
- Build dist runtime output.
- Switch package CLI or package runtime dispatch for covered P1 actions.
- Register Wave 3.6 in the registry with validationStatus=passed only after evidence exists.
- Write evidence and summary files with sha256 command hashes and no-deletion disposition.

Validation: CMD-04, CMD-05, CMD-06, and CMD-07 pass.

Acceptance: ACC003.

### G004 Wave 3.7 candidate manifest

Purpose: Wave 3.7 candidate manifest.

Files:
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/candidate-manifest.json`
- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-7.cjs`

Steps:
- Write a Wave 3.7 manifest with exactly the eight P2 scripts listed in the P2 backlog section.
- Record package runtime target paths and deletionAllowed=false for every P2 row.
- Implement CMD-08 validator coverage for manifest-only mode.

Validation: CMD-08 passes.

Acceptance: ACC004.

### G005 Wave 3.7 migrate and validate P2

Purpose: Wave 3.7 migrate and validate P2.

Files:
- `packages/bmad-speckit/src/main-agent/actions/**`
- `packages/bmad-speckit/dist/main-agent/actions/**`
- `packages/bmad-speckit/src/main-agent/runtime.ts`
- `packages/bmad-speckit/dist/main-agent/runtime.js`
- `packages/bmad-speckit/tests/main-agent-wave-3-7-runtime-actions.test.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/summary.md`
- `tests/acceptance/main-agent-runtime-migration-wave-3-7-contract.test.ts`
- `repo-governance/script-migration-registry.yaml`

Steps:
- Port P2 requirement runtime behavior into package runtime source.
- Build dist runtime output.
- Switch caller or CLI dispatch for covered P2 actions.
- Register Wave 3.7 with validationStatus=passed only after evidence exists.
- Write evidence and summary files.

Validation: CMD-09, CMD-10, CMD-11, and CMD-12 pass.

Acceptance: ACC005.

### G006 Wave 3.8 P3 manifest

Purpose: Wave 3.8 P3 manifest.

Files:
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/candidate-manifest.json`

Steps:
- Write a Wave 3.8 manifest with exactly the 38 P3 scripts listed in the P3 backlog section.
- Set initial routeDecision=blocked_until_classification_compression for every P3 row.
- Keep deletionAllowed=false for every P3 row.

Validation: The manifest exists and is consumed by CMD-13.

Acceptance: ACC006.

### G007 Wave 3.8 classification compression

Purpose: Wave 3.8 classification compression.

Files:
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json`
- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-8.cjs`

Steps:
- Classify every P3 script as package_runtime_module, durable_helper_copy, repo_internal_reclassify, deprecated_no_migration, or blocked_until_semantic_decision.
- Record direct caller evidence, consumer reachability, selected route, reason, and allowed target paths for every P3 script.
- Do not mark any P3 runtime migration validated before CMD-13 passes.

Validation: CMD-13 passes.

Acceptance: ACC006.

### G008 Wave 3.8 migrate true runtime P3 entries

Purpose: Wave 3.8 migrate true runtime P3 entries.

Files:
- `packages/bmad-speckit/src/main-agent/actions/**`
- `packages/bmad-speckit/dist/main-agent/actions/**`
- `packages/bmad-speckit/tests/main-agent-wave-3-8-runtime-actions.test.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/summary.md`
- `tests/acceptance/main-agent-runtime-migration-wave-3-8-contract.test.ts`
- `repo-governance/script-migration-registry.yaml`

Steps:
- Migrate only P3 rows classified as package_runtime_module or durable_helper_copy.
- Record repo_internal_reclassify and deprecated_no_migration rows as deterministic exclusions, not as migrated runtime modules.
- Write registry rows and evidence for every P3 row with accurate status and route.
- Build dist runtime output.

Validation: CMD-14, CMD-15, CMD-16, and CMD-17 pass.

Acceptance: ACC007.

### G009 Wave 3.9 durable helper manifest

Purpose: Wave 3.9 durable helper manifest.

Files:
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json`
- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-9.cjs`

Steps:
- Write a Wave 3.9 manifest with exactly the 14 P4 scripts listed in the P4 backlog section.
- Set migrationStrategy=durable_helper_copy for every P4 row.
- Set publicCommandsAfterMigration=[] unless a deterministic existing package caller requires a helper-facing command.

Validation: CMD-18 passes.

Acceptance: ACC008.

### G010 Wave 3.9 migrate durable helpers

Purpose: Wave 3.9 migrate durable helpers.

Files:
- `packages/bmad-speckit/src/main-agent/helpers/**`
- `packages/bmad-speckit/dist/main-agent/helpers/**`
- `packages/bmad-speckit/tests/main-agent-wave-3-9-durable-helpers.test.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/summary.md`
- `tests/acceptance/main-agent-runtime-migration-wave-3-9-contract.test.ts`
- `repo-governance/script-migration-registry.yaml`

Steps:
- Copy or port P4 durable helper behavior into package-local helper or asset paths.
- Do not expose P4 helpers as public CLI actions unless a pre-existing package caller requires it and the manifest records the reason.
- Build dist helper output.
- Register Wave 3.9 with validationStatus=passed only after evidence exists.

Validation: CMD-19, CMD-20, CMD-21, and CMD-22 pass.

Acceptance: ACC009.

### G011 Combined registry and acceptance closure

Purpose: Combined registry and acceptance closure.

Files:
- `tests/acceptance/main-agent-runtime-migration-p1-p4-contract.test.ts`
- `repo-governance/script-migration-registry.yaml`

Steps:
- Validate Waves 3.6, 3.7, 3.8, and 3.9 registry records together.
- Assert each originalPath appears in exactly one new P1-P4 wave record or one deterministic P3 exclusion record.
- Assert every new row has deletionAllowed=false and deletionApprovalRef=null.

Validation: CMD-23 and CMD-24 pass.

Acceptance: ACC010.

### G012 P1-P4 install matrix

Purpose: P1-P4 install matrix.

Files:
- `tools/script-migration/run-main-agent-p1-p4-install-matrix.cjs`
- `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/install-matrix/**`

Steps:
- Implement install matrix for npm install --save-dev, npx --package, npm install --no-save plus npx --no-install, and init/sync consumer fixture.
- Record usedRootScript=false, usedTsx=false, usedTsNode=false, and usedCompiledFallback=false for covered runtime actions.
- Do not claim every repo script is directly callable from a consumer project.

Validation: CMD-25 passes.

Acceptance: ACC011.

### G013 Static no root TypeScript dispatch guard

Purpose: Static no root TypeScript dispatch guard.

Files:
- `tools/script-migration/validate-main-agent-p1-p4-no-root-ts-dispatch.cjs`

Steps:
- Scan package source, package dist, package CLI, generated installed surfaces, and new helper paths for covered root script paths.
- Fail if covered runtime paths contain runRepoScript, tsx, ts-node, or compiled fallback dispatch for migrated actions.
- Exclude repo-governance and tools/script-migration from consumer runtime dependency paths.

Validation: CMD-26 passes.

Acceptance: ACC012.

### G014 No root script deletion guard

Purpose: No root script deletion guard.

Files:
- `tools/script-migration/validate-main-agent-p1-p4-no-root-script-deletion.cjs`

Steps:
- Assert every P1-P4 original root script still exists.
- Fail if git status reports deletion, move, or rename for root scripts.
- Fail if any P1-P4 registry row sets deletionAllowed=true or deletionApprovalRef to a non-null value.

Validation: CMD-27 passes.

Acceptance: ACC013.

### G015 Final encoding gate

Purpose: Final encoding gate.

Files:
- `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/encoding-evidence.json`

Steps:
- Run the encoding integrity gate after all Markdown, YAML, JSON, tests, validators, package source, and generated evidence writes.
- Record checkedFiles and findings in the final evidence packet.

Validation: CMD-28 passes.

Acceptance: ACC014.

### G016 Final worktree evidence

Purpose: Final worktree evidence.

Files:
- `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/worktree-evidence.json`

Steps:
- Run final worktree status.
- Identify goal-owned files and preserve unrelated dirty paths without revert.
- Record no root script deletion status.

Validation: CMD-29 output is captured.

Acceptance: ACC015.

### G017 Final evidence packet

Purpose: Final evidence packet.

Files:
- `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/final-evidence-packet.json`

Steps:
- Write a final evidence packet that maps G001-G019 and ACC001-ACC016 to command outputs, artifacts, hashes, and pass or blocked status.
- Include residual risks and stop-condition outcomes.
- State rootScriptsDeleted=false and rootScriptDeletionApproved=false.

Validation: The packet exists and maps all acceptance IDs.

Acceptance: ACC016.

### G018 Completion language gate

Purpose: Completion language gate.

Files:
- `final response`

Steps:
- Use narrow completion language based on evidence.
- Do not state all scripts are directly consumer-callable.
- State package runtime and install surface claims only for covered migrated actions and validated helper routes.

Validation: Final response follows the evidence packet.

Acceptance: ACC016.

### G019 Goal closeout decision

Purpose: Goal closeout decision.

Files:
- `goal status`

Steps:
- Only mark the active goal complete after every acceptance item has direct evidence.
- Keep the goal active when migration implementation remains incomplete after contract generation.
- Do not treat this contract document as migration completion proof.

Validation: Goal status is updated only when full P1-P4 implementation evidence exists.

Acceptance: ACC016.

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

- [ ] ACC001: Preflight captures dirty worktree and encoding baseline before migration edits. Evidence: CMD-01, CMD-02. Task: G001.
- [ ] ACC002: Wave 3.6 manifest contains exactly the 22 remaining P1 scripts and excludes the nine already validated P1 scripts. Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/candidate-manifest.json, CMD-03. Task: G001, G002.
- [ ] ACC003: Wave 3.6 package source, dist runtime, CLI dispatch, registry rows, evidence, and summary validate as P1 closure. Evidence: CMD-04, CMD-05, CMD-06, CMD-07. Task: G003.
- [ ] ACC004: Wave 3.7 manifest contains exactly eight P2 scripts. Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/candidate-manifest.json, CMD-08. Task: G004.
- [ ] ACC005: Wave 3.7 package source, dist runtime, CLI dispatch, registry rows, evidence, and summary validate as P2 closure. Evidence: CMD-09, CMD-10, CMD-11, CMD-12. Task: G005.
- [ ] ACC006: Wave 3.8 classification records all 38 P3 scripts with deterministic route decisions before any P3 migration is marked validated. Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json, CMD-13. Task: G006, G007.
- [ ] ACC007: Wave 3.8 migrates only true runtime P3 entries and records source-only or deprecated exclusions without claiming runtime migration. Evidence: CMD-14, CMD-15, CMD-16, CMD-17. Task: G008.
- [ ] ACC008: Wave 3.9 manifest contains exactly 14 P4 durable helper candidates. Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json, CMD-18. Task: G009.
- [ ] ACC009: Wave 3.9 copies durable helpers into package-local helper or asset paths and validates no public CLI action is created for P4 helpers unless a deterministic caller requires it. Evidence: CMD-19, CMD-20, CMD-21, CMD-22. Task: G010.
- [ ] ACC010: Combined registry validator and acceptance tests pass for Waves 3.6 through 3.9. Evidence: CMD-23, CMD-24. Task: G011.
- [ ] ACC011: Install matrix proves covered consumer runtime routes use package CLI or package runtime without root scripts, tsx, ts-node, or compiled fallback for covered actions. Evidence: CMD-25. Task: G012.
- [ ] ACC012: Static guards prove covered package runtime and installed surfaces do not call root scripts or TypeScript runners. Evidence: CMD-26. Task: G013.
- [ ] ACC013: No root scripts from the P1-P4 backlog are deleted, moved, renamed, or marked deletion-ready. Evidence: CMD-27. Task: G014.
- [ ] ACC014: Final encoding gate reports findings=0 after registry, evidence, summary, validator, tests, and package files are written. Evidence: CMD-28. Task: G015.
- [ ] ACC015: Final worktree status is captured and separates goal-owned changes from unrelated dirty files. Evidence: CMD-29. Task: G016.
- [ ] ACC016: Final evidence packet maps every G task and ACC item to command output or artifact paths before completion is claimed. Evidence: repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/final-evidence-packet.json, final response. Task: G017, G018, G019.

## Acceptance Traceability Matrix

| Acceptance ID | Task IDs | Evidence |
| --- | --- | --- |
| ACC001 | G001 | CMD-01, CMD-02 |
| ACC002 | G001, G002 | repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/candidate-manifest.json, CMD-03 |
| ACC003 | G003 | CMD-04, CMD-05, CMD-06, CMD-07 |
| ACC004 | G004 | repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/candidate-manifest.json, CMD-08 |
| ACC005 | G005 | CMD-09, CMD-10, CMD-11, CMD-12 |
| ACC006 | G006, G007 | repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json, CMD-13 |
| ACC007 | G008 | CMD-14, CMD-15, CMD-16, CMD-17 |
| ACC008 | G009 | repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json, CMD-18 |
| ACC009 | G010 | CMD-19, CMD-20, CMD-21, CMD-22 |
| ACC010 | G011 | CMD-23, CMD-24 |
| ACC011 | G012 | CMD-25 |
| ACC012 | G013 | CMD-26 |
| ACC013 | G014 | CMD-27 |
| ACC014 | G015 | CMD-28 |
| ACC015 | G016 | CMD-29 |
| ACC016 | G017, G018, G019 | repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/final-evidence-packet.json, final response |

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

### CMD-01 Preflight Worktree Status

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short --branch }"
```

Pass condition: Output is captured, unrelated dirty paths are not reverted, and the initial dirty paths are preserved as pre-existing worktree state.

### CMD-02 Preflight Encoding Gate

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and reports findings=0.

### CMD-03 Wave 3.6 Candidate Manifest Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-6.cjs --manifest-only; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and proves exactly 22 P1 remaining scripts.

### CMD-04 Wave 3.6 Package Runtime Tests

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-6-runtime-actions.test.js; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-05 Wave 3.6 Dist Build

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-06 Wave 3.6 Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-6.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-07 Wave 3.6 Acceptance Test

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-6-contract.test.ts; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-08 Wave 3.7 Candidate Manifest Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-7.cjs --manifest-only; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and proves exactly eight P2 scripts.

### CMD-09 Wave 3.7 Package Runtime Tests

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-7-runtime-actions.test.js; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-10 Wave 3.7 Dist Build

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-11 Wave 3.7 Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-7.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-12 Wave 3.7 Acceptance Test

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-7-contract.test.ts; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-13 Wave 3.8 Classification Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-8.cjs --classification-only; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and proves all 38 P3 scripts have deterministic route decisions.

### CMD-14 Wave 3.8 Package Runtime Tests

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-8-runtime-actions.test.js; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0, or the validator proves zero P3 true runtime entries and this command is recorded as blocked_until_no_p3_runtime_entries_selected.

### CMD-15 Wave 3.8 Dist Build

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-16 Wave 3.8 Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-8.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-17 Wave 3.8 Acceptance Test

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-8-contract.test.ts; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-18 Wave 3.9 Candidate Manifest Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-9.cjs --manifest-only; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and proves exactly 14 P4 durable helper candidates.

### CMD-19 Wave 3.9 Helper Tests

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-9-durable-helpers.test.js; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-20 Wave 3.9 Dist Build

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-21 Wave 3.9 Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-9.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-22 Wave 3.9 Acceptance Test

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-9-contract.test.ts; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-23 Registry Validator

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-registry.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-24 Combined Registry Acceptance Test

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/script-migration-registry-contract.test.ts tests/acceptance/main-agent-runtime-migration-p1-p4-contract.test.ts; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-25 P1-P4 Install Matrix

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/run-main-agent-p1-p4-install-matrix.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and writes install-matrix receipts.

### CMD-26 Static No Root TypeScript Dispatch Guard

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-p1-p4-no-root-ts-dispatch.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0.

### CMD-27 No Root Script Deletion Check

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-p1-p4-no-root-script-deletion.cjs; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and proves every P1-P4 original root script is retained with deletionAllowed=false.

### CMD-28 Final Encoding Gate

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit $LASTEXITCODE }"
```

Pass condition: Command exits with code 0 and reports findings=0.

### CMD-29 Final Worktree Status

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short }"
```

Pass condition: Output is captured and goal-owned changes are identified.

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

### MV-01 Backlog Count Verification

1. Run CMD-03, CMD-08, CMD-13, and CMD-18.
2. Verify P1 equals 22, P2 equals eight, P3 equals 38, and P4 equals 14.
3. Verify already validated P1 rows are excluded from Wave 3.6.

Evidence: candidate manifests and validator outputs.

### MV-02 Package Runtime Verification

1. Run CMD-04 through CMD-17.
2. Verify migrated actions execute from package source and dist.
3. Verify no covered action imports root `scripts/*.ts`.

Evidence: package tests, dist build output, wave validators, and static guard output.

### MV-03 P3 Classification Verification

1. Open `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json`.
2. Verify exactly 38 P3 rows exist.
3. Verify each row has caller evidence, consumer reachability, selected route, reason, target paths, and validation status.
4. Verify source-only and deprecated rows are not claimed as runtime migrations.

Evidence: classification file and CMD-13 output.

### MV-04 P4 Durable Helper Verification

1. Open `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json`.
2. Verify exactly 14 P4 rows exist.
3. Verify helper targets are under `packages/bmad-speckit/src/main-agent/helpers/**` and `packages/bmad-speckit/dist/main-agent/helpers/**`.
4. Verify public command arrays are empty unless manifest caller evidence proves a helper-facing command is required.

Evidence: Wave 3.9 manifest, CMD-18, CMD-19, CMD-21, and CMD-22 output.

### MV-05 Install Matrix Verification

1. Run CMD-25.
2. Open every install-matrix receipt.
3. Verify every receipt records `usedRootScript: false`.
4. Verify every receipt records `usedTsx: false`.
5. Verify every receipt records `usedTsNode: false`.
6. Verify covered runtime action receipts record `usedCompiledFallback: false`.

Evidence: CMD-25 output and install-matrix receipts.

### MV-06 No Deletion Verification

1. Run CMD-27.
2. Verify every P1-P4 original root script still exists.
3. Verify no P1-P4 registry row sets `deletionAllowed: true`.
4. Verify final response states root script deletion is not approved.

Evidence: CMD-27 output, registry rows, and final response.

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

- `contractPath`: `docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md`
- `sourcePlanPath`: `conversation://main-agent-p1-p4-runtime-migration`
- `sourcePlanHash`: `sha256:96afad1d7f9bf3aeebd7a6c57cadf2a0cadc243e9dd55a0f3ff8894303064bdf`
- `registryPath`: `repo-governance/script-migration-registry.yaml`
- `priorityMatrixPath`: `repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md`
- `wave3_6ManifestPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/candidate-manifest.json`
- `wave3_6EvidencePath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/evidence.json`
- `wave3_6SummaryPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/summary.md`
- `wave3_7ManifestPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/candidate-manifest.json`
- `wave3_7EvidencePath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/evidence.json`
- `wave3_7SummaryPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/summary.md`
- `wave3_8ClassificationPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json`
- `wave3_8EvidencePath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/evidence.json`
- `wave3_8SummaryPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/summary.md`
- `wave3_9ManifestPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json`
- `wave3_9EvidencePath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/evidence.json`
- `wave3_9SummaryPath`: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/summary.md`
- `installMatrixRunnerPath`: `tools/script-migration/run-main-agent-p1-p4-install-matrix.cjs`
- `staticDispatchGuardPath`: `tools/script-migration/validate-main-agent-p1-p4-no-root-ts-dispatch.cjs`
- `noDeletionGuardPath`: `tools/script-migration/validate-main-agent-p1-p4-no-root-script-deletion.cjs`
- `finalEvidencePacketPath`: `repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/final-evidence-packet.json`
- `p1RemainingCount`: 22
- `p2RemainingCount`: 8
- `p3RemainingCount`: 38
- `p4RemainingCount`: 14
- `totalRemainingCount`: 82
- `rootScriptsDeleted`: must equal `false`
- `rootScriptDeletionApproved`: must equal `false`
- `commandsRun`: list CMD-01 through CMD-29 with exit code and output summary.
- `acceptanceStatus`: list ACC001 through ACC016 as `pass` or `blocked`.
- `residualRisks`: list any failed command, unavailable evidence, blocked acceptance item, route ambiguity, or semantic port blocker.

## Stop Conditions

- Stop with `contract_amendment_required` if this contract lacks any required section, task ID, acceptance ID, command ID, or evidence mapping.
- Stop with `scope_amendment_required` if execution needs to edit a path not listed in G001 through G019.
- Stop with `root_script_deletion_approval_required` if execution proposes deleting, moving, or renaming any root `scripts/*` file.
- Stop with `deletion_ready_classification_forbidden` if execution proposes `deletionAllowed: true` for any entry.
- Stop with `p1_manifest_count_mismatch` if Wave 3.6 candidate manifest does not contain exactly 22 P1 remaining scripts.
- Stop with `p2_manifest_count_mismatch` if Wave 3.7 candidate manifest does not contain exactly eight P2 scripts.
- Stop with `p3_classification_required` if any P3 row lacks classification compression before migration.
- Stop with `p3_runtime_claim_without_route_evidence` if a P3 row is claimed as migrated runtime without caller evidence and selected route.
- Stop with `p4_public_cli_scope_violation` if a P4 helper is exposed as a public CLI action without manifest caller proof.
- Stop with `consumer_runtime_root_ts_dependency_detected` if a covered consumer runtime or installed surface still calls root `scripts/*.ts`.
- Stop with `tsx_or_ts_node_consumer_dependency_detected` if a covered consumer runtime or installed surface still requires `tsx` or `ts-node`.
- Stop with `compiled_fallback_boundary_contract_required` if a covered migrated action still reaches compiled fallback.
- Stop with `repo_governance_consumer_dependency_detected` if package consumer runtime code reads `repo-governance/**`.
- Stop with `install_matrix_contract_required` if CMD-25 cannot be created or run under declared write scope.
- Stop with `encoding_integrity_failed` if CMD-28 reports findings or exits non-zero.
- Stop with `validation_contract_required` if any required validator or acceptance test cannot be created under declared write scope.
