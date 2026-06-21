# Goal Execution Contract

---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:b67ad6fb7f8c3ea903f03c5b51331fd530252ece0d9b629bf8c11ee93d5c4b70
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: conversation://main-agent-runtime-migration-wave-3.11-consumer-closure-migration
sourcePlanHash: sha256:4ba8815e83700e5a8ce5329e559fea433e05b7ab219307504ec1840c723f60f9
runtimeRecordId: main-agent-runtime-migration-wave-3.11
entryFlow: consumer_reachable_closure_migration_wave_3_11
taskRange: G001-G012; G013: not applicable
acceptanceRange: ACC001-ACC014
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: execute_declared_tasks_only_and_stop_on_scope_or_semantic_gap
stopPolicy: stop_on_contract_gap_scope_expansion_root_script_deletion_consumer_root_ts_dependency_tsx_ts_node_dependency_compiled_fallback_claim_or_registry_validation_failure
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-05T18:33:00+08:00
---

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

```text
/goal docs/plans/2026-06-05-main-agent-runtime-migration-wave-3-11-goal-execution-plan.md
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
- Use `apply_patch` for small manual code and localized documentation edits; for generated, large, ignored, or evidence artifacts, the D010 safe-write requirements and repository Large File Safe Write Protocol take precedence.
- Run `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` before and after Markdown, JSON, YAML, skill, command, generated-surface, or package-surface edits.
- Inspect `git status --short --branch` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, tests, CLI code, runtime modules, registry files, evidence receipts, or installed surfaces.
- Do not delete any root `scripts/*` file in Wave 3.11.
- Do not move any root `scripts/*` file in Wave 3.11.
- Do not rename any root `scripts/*` file in Wave 3.11.
- Do not set `deletionAllowed: true` for any Wave 3.11 registry entry, evidence entry, summary statement, manifest row, or installed-surface inventory row.
- Do not require consumer projects to install `tsx`.
- Do not require consumer projects to install `ts-node`.
- Do not let package tests import root `scripts/*.ts`.
- Do not make `repo-governance/**` a consumer runtime dependency.
- Do not make `tools/script-migration/**` a consumer runtime dependency.
- Do not execute root `scripts/*.ts` from package runtime paths covered by this contract.
- Do not claim that all source repository scripts are directly callable in a consumer project.
- `NOT DONE: deletion of any original root script is excluded because deletion requires separate per-script approval after migration evidence and caller-switch proof.`
- `NOT DONE: direct consumer-root execution of every registry-declared source script is excluded because consumer projects must use package CLI, package runtime, or declared installed helpers.`
- `NOT DONE: migration of scripts outside the Wave 3.11 entry inventory is excluded because this contract freezes only the corrected consumer reachable closure scope.`

## Authority Model

- `conversation://main-agent-runtime-migration-wave-3.11-consumer-closure-migration` is the human requirement source for this contract.
- `sourcePlanHash=sha256:4ba8815e83700e5a8ce5329e559fea433e05b7ab219307504ec1840c723f60f9` binds this contract to the conversation-derived Wave 3.11 requirement set.
- `docs/plans/2026-06-05-main-agent-runtime-migration-wave-3-11-goal-execution-plan.md` is the frozen execution contract for Wave 3.11. Because `docs/plans/**` is ignored by this repository, this file is local execution authority for this run and is not itself Wave 3.11 migration evidence; final closeout MUST report its absolute path plus current SHA256 when citing it, while proof artifacts remain under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/**`.
- `repo-governance/script-migration-registry.yaml` is the machine-readable migration registry authority.
- `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json` is the consumer reachable closure audit artifact.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence.json` is the Wave 3.11 command evidence artifact after task G011 writes it.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/summary.md` is the Wave 3.11 human closeout projection after task G012 writes it.
- `packages/bmad-speckit/src/main-agent/runtime/**` is the package source authority for the four migrated runtime modules.
- `packages/bmad-speckit/src/main-agent/helpers/**` is the package source authority for the five migrated helper modules.
- `packages/bmad-speckit/src/commands/eval-question-generate.js` is the package source authority for the eval question generation public CLI action.
- `packages/bmad-speckit/src/commands/check-score.js` remains the package source authority for the existing check-score public CLI action.
- `packages/bmad-speckit/dist/main-agent/**` is the package consumer runtime output for Main Agent runtime and helper modules.
- `packages/bmad-speckit/bin/bmad-speckit.js` is the package CLI facade authority for consumer-visible command dispatch.
- `model_packet.json is the machine-readable execution authority` only when a generated Main Agent execution packet exists for this contract.
- `goal_execution.md is not execution authority`; this Markdown contract is the frozen human/model execution source for this Wave 3.11 run.
- `/goal completion is not closeout proof`; closeout proof requires command evidence, package tests, dist build, static guards, install-matrix receipts, registry validation, summary artifacts, final encoding gate, and no-deletion worktree evidence.

## Root Cause To Fix

Wave 3.10 corrected an earlier overbroad internal classification. The corrected audit established that most root scripts in the Wave 3.10 challenged set are not true repo-internal: some have confirmed package runtime, public CLI, or workflow reachability, while the five helper entries remain `package_local_helper` candidates whose package proof must be produced by Wave 3.11 tests and install-matrix evidence. Within the Wave 3.10 corrected set covered by this Wave 3.11 contract, two root scripts remain true no-migration internal scripts under narrow classifications. The remaining Wave 3.11 defect is the unconverted subset of the Wave 3.10 correction set plus the explicit Wave 3.11 decision to close `scripts/eval-question-generate.ts` as a public CLI package action after the closure audit left it in follow-up/recommendation state.

The fix is a narrow migration wave. Wave 3.11 migrates four runtime support modules, packages five helper modules, creates an eval question generation package action, closes the existing check-score package action as legacy-root retained, and records the only two true no-migration root scripts within this Wave 3.11 declared inventory. Wave 3.11 does not delete root scripts. Wave 3.11 does not claim direct consumer execution for every source repository script, and it makes no repository-wide no-migration claim for P5 or any script outside this contract inventory.

### Wave 3.10 To Wave 3.11 Scope Delta

- Wave 3.10 corrected fourteen challenged scripts.
- Wave 3.11 intentionally covers thirteen entries.
- `scripts/bmad-help-renderer.ts` is excluded from Wave 3.11 because Wave 3.10 already records it as `already_migrated_package_runtime_deprecated_root_path` with existing package runtime authority through `packages/bmad-speckit/src/runtime/bmad-help-renderer.js`.
- `scripts/bmads-renderer.ts` is excluded from Wave 3.11 because Wave 3.10 already records it as `already_migrated_package_runtime_deprecated_root_path` with existing package runtime authority through `packages/bmad-speckit/src/runtime/bmads-renderer.js`.
- `scripts/eval-question-generate.ts` is included in Wave 3.11 because this contract explicitly promotes the closure audit follow-up recommendation into a public CLI package action migration decision; the pre-implementation audit state is not treated as already-proven consumer reachability.
- Wave 3.11 preserves Wave 3.10 semantic corrections unless this contract explicitly changes an entry. Wave 3.11 supersedes completion, migration target, validation, and evidence state for its thirteen entries only.
- This scope delta is closed: adding or removing a Wave 3.11 entry requires `contract_amendment_required`.

## Domain-Specific Contract Addenda

### D001 Consumer Reachable Classification Addendum

- The Wave 3.11 entry inventory MUST include exactly these runtime module entries: `scripts/host-runtime-mode.ts`, `scripts/supervised-worker-runtime.ts`, `scripts/diagnose-bmad-state.ts`, and `scripts/parallel-mission-control.ts`.
- The Wave 3.11 entry inventory MUST include exactly these helper entries: `scripts/bmad-state-reader.ts`, `scripts/e2e-verify-paths.ts`, `scripts/query-validate.ts`, `scripts/runtime-step-state.ts`, and `scripts/verify-agent-files.ts`.
- The Wave 3.11 entry inventory MUST include exactly this public CLI action entry: `scripts/eval-question-generate.ts`.
- The Wave 3.11 entry inventory MUST include exactly this existing public CLI legacy entry: `scripts/check-story-score-written.ts`.
- The Wave 3.11 entry inventory MUST include exactly these true no-migration entries within this contract inventory: `scripts/create-second-story.ts` and `scripts/verify-score-auto-scoped-bundle.cjs`.
- The audit artifact MUST NOT classify any Wave 3.11 entry as `repo_internal_reclassify_possible`.
- The audit artifact MUST classify `scripts/eval-question-generate.ts` as `public_cli_package_action`.
- The audit artifact MUST close Wave 3.11 entries through current classification fields or an explicit correction override. A `recommendation.recommendedStrategy` value alone is follow-up advice, not accepted current classification evidence.
- Helper audit semantic classification MUST remain `package_local_helper`; only the registry migration strategy for those helper entries is `durable_helper_copy`.

Expected audit semantic classifications:

| Original script | Expected audit semantic classification |
| --- | --- |
| `scripts/host-runtime-mode.ts` | `package_runtime_module` |
| `scripts/supervised-worker-runtime.ts` | `package_runtime_module` |
| `scripts/diagnose-bmad-state.ts` | `package_runtime_module` |
| `scripts/parallel-mission-control.ts` | `package_runtime_module` |
| `scripts/bmad-state-reader.ts` | `package_local_helper` |
| `scripts/e2e-verify-paths.ts` | `package_local_helper` |
| `scripts/query-validate.ts` | `package_local_helper` |
| `scripts/runtime-step-state.ts` | `package_local_helper` |
| `scripts/verify-agent-files.ts` | `package_local_helper` |
| `scripts/eval-question-generate.ts` | `public_cli_package_action` |
| `scripts/check-story-score-written.ts` | `public_cli_package_action_existing_root_legacy` |
| `scripts/create-second-story.ts` | `repo_internal_test_seed_only` |
| `scripts/verify-score-auto-scoped-bundle.cjs` | `repo_internal_verification_harness` |

Canonical semantic-to-registry mapping for Wave 3.11:

| Audit semantic classification | Registry migration strategy |
| --- | --- |
| `public_cli_package_action` | `public_cli_de_surface` |
| `public_cli_package_action_existing_root_legacy` | `public_cli_de_surface` |
| `package_runtime_module` | `package_runtime_module` |
| `package_local_helper` | `durable_helper_copy` |
| `repo_internal_test_seed_only` | `repo_internal_reclassify` |
| `repo_internal_verification_harness` | `repo_internal_reclassify` |

`public_cli_de_surface` is the existing registry-accepted strategy for public CLI package actions in `repo-governance/script-migration-registry.yaml` and `tools/script-migration/validate-registry.cjs`. If either registry authority no longer accepts that strategy, execution MUST stop with `registry_strategy_contract_mismatch:public_cli_de_surface` rather than inventing a new Wave 3.11 strategy.

### D002 Runtime Module Migration Addendum

- `scripts/host-runtime-mode.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/runtime/host-runtime-mode.js` and `packages/bmad-speckit/dist/main-agent/runtime/host-runtime-mode.js`.
- `scripts/supervised-worker-runtime.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.js` and `packages/bmad-speckit/dist/main-agent/runtime/supervised-worker-runtime.js`.
- `scripts/diagnose-bmad-state.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/runtime/diagnose-bmad-state.js` and `packages/bmad-speckit/dist/main-agent/runtime/diagnose-bmad-state.js`.
- `scripts/parallel-mission-control.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/runtime/parallel-mission-control.js` and `packages/bmad-speckit/dist/main-agent/runtime/parallel-mission-control.js`.
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` MUST copy each runtime module target from `src/main-agent/runtime/` to `dist/main-agent/runtime/`.
- Package tests MUST import the four runtime modules from `packages/bmad-speckit/src/main-agent/runtime/` or `packages/bmad-speckit/dist/main-agent/runtime/`.
- Package tests MUST NOT import any of the four original root TypeScript scripts.
- `packages/bmad-speckit/src/main-agent/runtime/` is a newly declared package runtime support-module surface for Wave 3.11.
- Runtime support modules in `src/main-agent/runtime/` do not have to be CLI-dispatched through `src/main-agent/runtime.js` unless a task explicitly adds such dispatch.
- Consumer proof for runtime support modules MUST use installed-package `dist/main-agent/runtime/*.js` direct `require` probes from the install matrix.
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` MUST include the four runtime support modules in its explicit copy list.

### D003 Package Helper Closure Addendum

- `scripts/bmad-state-reader.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/helpers/bmad-state-reader.js` and `packages/bmad-speckit/dist/main-agent/helpers/bmad-state-reader.js`.
- `scripts/e2e-verify-paths.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/helpers/e2e-verify-paths.js` and `packages/bmad-speckit/dist/main-agent/helpers/e2e-verify-paths.js`.
- `scripts/query-validate.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/helpers/query-validate.js` and `packages/bmad-speckit/dist/main-agent/helpers/query-validate.js`.
- `scripts/runtime-step-state.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/helpers/runtime-step-state.js` and `packages/bmad-speckit/dist/main-agent/helpers/runtime-step-state.js`.
- `scripts/verify-agent-files.ts` MUST migrate to `packages/bmad-speckit/src/main-agent/helpers/verify-agent-files.js` and `packages/bmad-speckit/dist/main-agent/helpers/verify-agent-files.js`.
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` MUST copy each helper target from `src/main-agent/helpers/` to `dist/main-agent/helpers/`.
- Helper modules MUST use package-relative paths or caller-provided project paths.
- Helper modules MUST NOT read `repo-governance/**` as consumer runtime input.
- Helper modules that were CLI-only root scripts MUST expose deterministic CommonJS runner APIs named in D006, not just process-exit side effects.

### D004 Public CLI Package Action Addendum

- `scripts/eval-question-generate.ts` MUST migrate to `packages/bmad-speckit/src/commands/eval-question-generate.js`.
- `packages/bmad-speckit/bin/bmad-speckit.js` MUST expose a consumer-visible `eval-question-generate` command that loads `../src/commands/eval-question-generate`.
- `packages/bmad-speckit/bin/bmad-speckit.js` MUST NOT route `eval-question-generate` through `emitDeprecatedAlias`.
- `packages/bmad-speckit/src/commands/eval-question-generate.js` MUST import scoring package code through `@bmad-speckit/scoring` package exports. Vendoring or copying scoring source/dist files directly into `packages/bmad-speckit/src/commands/eval-question-generate.js` or another package-local command helper is outside Wave 3.11 scope and MUST NOT be used as the consumer proof route. The allowed and required consumer proof route is the installed `@bmad-speckit/scoring` package dependency staged from the current workspace and resolved through package exports.
- `packages/scoring/package.json` MUST expose `./eval-questions/template-generator` and `./eval-questions/manifest-loader` as mandatory Wave 3.11 package exports.
- `packages/scoring/package.json` MUST include package file coverage for the mandatory eval-question dist modules and every eval-question asset required by the installed `eval-question-generate` command.
- `npm run build:scoring` MUST produce `packages/scoring/dist/eval-questions/template-generator.js` and `packages/scoring/dist/eval-questions/manifest-loader.js`.
- The install matrix MUST prove installed package resolution for the mandatory `@bmad-speckit/scoring/eval-questions/template-generator` and `@bmad-speckit/scoring/eval-questions/manifest-loader` exports.
- Eval question generation MUST preserve the existing scoring manifest format: generated output uses `manifest.yaml` and MUST be loadable through the scoring `loadManifest(versionDir)` contract from `@bmad-speckit/scoring/eval-questions/manifest-loader`. Wave 3.11 MUST NOT require `manifest.json` or JSON manifest parsing as acceptance evidence.
- Wave 3.11 consumer proof for `eval-question-generate` is limited to the explicit `--input <coach-report.json> --outputDir <dir> --version <version>` path. The `--run-id` argument is retained as package-command compatibility only and MUST NOT be used as install-matrix consumer proof.
- The retained `--run-id` compatibility path MUST resolve scoring data only through package scoring APIs and package-supported data path resolution such as `SCORING_DATA_PATH` or the current working directory. If the scoring data path or run record cannot be resolved, it MUST fail closed with a nonzero exit code and a clear error, rather than falling back to root repository source, root `scripts/*.ts`, `tsx`, `ts-node`, or compiled fallback.
- `packages/bmad-speckit/src/commands/check-score.js` MUST remain the package action authority for `bmad-speckit check-score`.
- `scripts/check-story-score-written.ts` MUST remain retained legacy root source and MUST NOT be classified as true no-migration internal.

### D005 Registry And Evidence Addendum

- `repo-governance/script-migration-registry.yaml` MUST add `main-agent-runtime-migration-wave-3.11` with `refinesWaveId: main-agent-runtime-migration-wave-3.10`.
- Every Wave 3.11 registry entry MUST set `deletionAllowed: false`.
- Every Wave 3.11 registry entry MUST set `deletionApprovalRef: null`.
- Every Wave 3.11 registry entry MUST include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/registry-evidence.json` in `evidenceRefs`.
- G009 registry entries MUST reference `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/registry-evidence.json` in `evidenceRefs` because `tools/script-migration/validate-registry.cjs` validates registry evidence references with the legacy registry evidence schema. Detailed D010 command evidence remains in `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence.json` and MUST NOT be used as a registry `evidenceRefs` target unless `validate-registry.cjs` is explicitly changed to accept that schema.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence.json` MUST include command rows with `commandId`, `sequence`, `attempt`, `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, `startedAt`, `completedAt`, and `status`.
- Install-matrix evidence for covered package CLI or runtime entries MUST record `usedRootScript: false`, `usedTsx: false`, `usedTsNode: false`, and `usedCompiledFallback: false`.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/summary.md` MUST use narrow completion language.
- `preflight.json` MUST record command evidence rows with `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, `startedAt`, `completedAt`, and `status`. Its `gitStatusShortHash` MUST equal the git status command row `stdoutHash`, and its `sourceInventoryHash` MUST equal the promoted-file-byte SHA256 of `source-inventory.json`.
- `validate-main-agent-runtime-migration-wave-3-11.cjs --pre-evidence` MUST NOT require `evidence.json`, `install-matrix.json`, `summary.md`, or `final-evidence-packet.json`.
- `validate-main-agent-runtime-migration-wave-3-11.cjs --evidence-running` MUST validate G011 evidence artifacts after `evidence.json` and `install-matrix.json` exist, and MUST NOT require G012 `summary.md` or `final-evidence-packet.json`.
- `validate-main-agent-runtime-migration-wave-3-11.cjs --final-acceptance` MUST validate the sealed packet, summary, final encoding row, all pre-final-acceptance command rows, and ACC013/ACC014 self-exclusion, but MUST NOT require `cmd-test-wave-3-11-contract-final` or `cmd-validate-wave-3-11-final` to already exist in `evidence.json`.
- `validate-main-agent-runtime-migration-wave-3-11.cjs` without an evidence mode is the final full validator. It MUST validate final evidence artifacts only after G012 has written and sealed them, validate the D010 self-exclusion contract for the validator's own future command row, and allow only the D010-declared post-validator `evidence.json` mutations after the invocation returns.
- The Wave 3.11 registry wave MUST be written in validator-ready final registry state by the time G009 validation runs: `waveId: main-agent-runtime-migration-wave-3.11`, `title: Main Agent runtime migration wave 3.11 consumer reachable closure migration`, `contractPath: docs/plans/2026-06-05-main-agent-runtime-migration-wave-3-11-goal-execution-plan.md`, `refinesWaveId: main-agent-runtime-migration-wave-3.10`, `status: validated`, `startedAt` as the ISO 8601 UTC timestamp captured immediately before the G009 registry safe-write promotion, `completedAt` as the ISO 8601 UTC timestamp captured after registry evidence and registry YAML are promoted, and `entries` containing exactly the thirteen Wave 3.11 entries.
- Every Wave 3.11 registry entry MUST use these exact common field values when G009 writes it: `refinesWaveId: main-agent-runtime-migration-wave-3.10`, `originalPathStatus: retained`, `evidenceRefs: ["repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/registry-evidence.json"]`, `deletionAllowed: false`, and `deletionApprovalRef: null`.
- Registry `status: blocked`, entry `migrationStatus: blocked`, and entry `validationStatus: partial` are required for Wave 3.11 package-runtime/package-helper/public-CLI entries until strict package source parity and passing command evidence exist. They do not prove G011/G012 final closeout; final closeout remains proven only by `evidence.json`, `install-matrix.json`, `summary.md`, `final-evidence-packet.json`, the final acceptance command row, the final validator command row, and the final human response.
- G009 MUST NOT leave the Wave 3.11 registry wave at `status: in_progress`. It MUST fail closed as `blocked` for entries without strict package source parity and may use `validated/passed` only for true `repo_internal_reclassify` entries that do not require package parity.
- Wave 3.11 final closeout MUST keep registry `evidenceRefs` pointed at registry-compatible `registry-evidence.json`. Detailed D010 command evidence MAY be referenced from Wave 3.11-specific artifacts, but MUST NOT replace `registry-evidence.json` in registry entry `evidenceRefs` unless `tools/script-migration/validate-registry.cjs` is explicitly changed to accept that schema.
- Wave 3.11 registry entry IDs MUST be exactly: `host-runtime-mode`, `supervised-worker-runtime`, `diagnose-bmad-state`, `parallel-mission-control`, `bmad-state-reader`, `e2e-verify-paths`, `query-validate`, `runtime-step-state`, `verify-agent-files`, `eval-question-generate`, `check-story-score-written`, `create-second-story`, and `verify-score-auto-scoped-bundle`.
- Registry entry `originalClassBeforeMigration` MUST equal the D001 expected audit semantic classification for that original script, not the older Wave 3.10 `repo_internal_reclassify_possible` value.
- Runtime module registry entries MUST express the package-runtime migration through `migrationStrategy: package_runtime_module`, `migrationStatus: validated`, `callerSwitchStatus: switched`, `oldPathDisposition: retained_source_root_legacy_package_runtime_module`, `publicCommandsBeforeMigration: ["source repository <originalPath>"]`, `publicCommandsAfterMigration: []`, and `targetPaths` set to the two D002 source/dist paths for that entry.
- Helper registry entries MUST express the helper migration through `migrationStrategy: durable_helper_copy`, `migrationStatus: validated`, `callerSwitchStatus: not_applicable`, `oldPathDisposition: retained_source_root_legacy_package_local_helper`, `publicCommandsBeforeMigration: ["source repository <originalPath>"]`, `publicCommandsAfterMigration: []`, and `targetPaths` set to the two D003 source/dist paths for that entry.
- `scripts/eval-question-generate.ts` MUST express the public CLI package action through `migrationStrategy: public_cli_de_surface`, `migrationStatus: validated`, `callerSwitchStatus: switched`, `oldPathDisposition: retained_legacy_root_public_cli_replaced`, `targetPaths: ["packages/bmad-speckit/bin/bmad-speckit.js", "packages/bmad-speckit/src/commands/eval-question-generate.js"]`, `publicCommandsBeforeMigration: ["source repository scripts/eval-question-generate.ts"]`, and `publicCommandsAfterMigration: ["bmad-speckit eval-question-generate"]`.
- `scripts/check-story-score-written.ts` MUST express the existing package action closure through `migrationStrategy: public_cli_de_surface`, `migrationStatus: validated`, `callerSwitchStatus: switched_existing_package_runtime`, `oldPathDisposition: retained_legacy_root_public_cli_replaced`, `targetPaths: ["packages/bmad-speckit/bin/bmad-speckit.js", "packages/bmad-speckit/src/commands/check-score.js"]`, `publicCommandsBeforeMigration: ["source repository scripts/check-story-score-written.ts"]`, and `publicCommandsAfterMigration: ["bmad-speckit check-score"]`.
- `scripts/create-second-story.ts` MUST express the narrow no-migration decision through `migrationStrategy: repo_internal_reclassify`, `migrationStatus: validated`, `callerSwitchStatus: not_applicable`, `oldPathDisposition: retained_source_repo_internal_test_seed_only`, `targetPaths: ["scripts/create-second-story.ts"]`, `publicCommandsBeforeMigration: ["source repository scripts/create-second-story.ts"]`, and `publicCommandsAfterMigration: []`.
- `scripts/verify-score-auto-scoped-bundle.cjs` MUST express the narrow no-migration decision through `migrationStrategy: repo_internal_reclassify`, `migrationStatus: validated`, `callerSwitchStatus: not_applicable`, `oldPathDisposition: retained_source_repo_internal_verification_harness`, `targetPaths: ["scripts/verify-score-auto-scoped-bundle.cjs"]`, `publicCommandsBeforeMigration: ["source repository scripts/verify-score-auto-scoped-bundle.cjs"]`, and `publicCommandsAfterMigration: []`.

### D006 Runtime And Helper API Surface Map

The executor MUST implement these CommonJS exports and tests MUST assert them.

| Original script | Package target | Required CommonJS exports |
| --- | --- | --- |
| `scripts/host-runtime-mode.ts` | `packages/bmad-speckit/src/main-agent/runtime/host-runtime-mode.js` | `normalizeRuntimeHost`, `selectExecutionRuntimeMode`, `runtimeModeDir`, `writeExecutionRuntimeModeSelection`, `validateNativeGoalReadiness`, `writeRuntimeBlocker`, `writeNativeGoalInvocationReceipt`, `validateNativeGoalInvocationReceipt` |
| `scripts/supervised-worker-runtime.ts` | `packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.js` | `appendTaskProgress`, `readTaskProgress`, `evaluateSupervisedWorker` |
| `scripts/diagnose-bmad-state.ts` | `packages/bmad-speckit/src/main-agent/runtime/diagnose-bmad-state.js` | `collectReviewerProjectionDiagnosis`, `collectReadinessProjectionDiagnosis`, `diagnoseBmadState` |
| `scripts/parallel-mission-control.ts` | `packages/bmad-speckit/src/main-agent/runtime/parallel-mission-control.js` | `DEFAULT_PROTECTED_WRITE_PATHS`, `evaluateParallelMissionEvidenceIntegration`, `buildParallelMissionPlan`, `buildPrTopology`, `validatePrTopologyForReleaseGate` |
| `scripts/bmad-state-reader.ts` | `packages/bmad-speckit/src/main-agent/helpers/bmad-state-reader.js` | `readBmadProgress`, `readStoryState`, `getCurrentStoryState`, `buildPaths` |
| `scripts/e2e-verify-paths.ts` | `packages/bmad-speckit/src/main-agent/helpers/e2e-verify-paths.js` | `runE2eVerifyPaths`, `main` |
| `scripts/query-validate.ts` | `packages/bmad-speckit/src/main-agent/helpers/query-validate.js` | `runQueryValidation`, `main` |
| `scripts/runtime-step-state.ts` | `packages/bmad-speckit/src/main-agent/helpers/runtime-step-state.js` | `resolveRuntimeStepState`, `persistRuntimeStepState` |
| `scripts/verify-agent-files.ts` | `packages/bmad-speckit/src/main-agent/helpers/verify-agent-files.js` | `verifyAgentFiles`, `REQUIRED_AGENTS`, `REQUIRED_SPECKIT_ALIASES`, `REQUIRED_AUDITORS`, `main` |

Minimum behavioral assertions:

- Runtime tests MUST assert every D006 runtime export exists.
- Helper tests MUST assert every D006 helper export exists.
- Runtime and helper tests MUST execute every exported function that can be exercised through pure inputs or fixture-backed project paths without external services.
- Constants listed in D006 MUST have exact-value or shape assertions.
- `main` wrapper exports MUST be asserted as functions, and CLI-only helper ports MUST prove process termination happens only through the wrapper path.
- For each module whose root source has an observable negative/error path, package tests MUST include at least one negative assertion that preserves the error name, message marker, exit-code representation, or structured-result shape used by that port.
- CLI-only helper ports MUST return structured result objects and MUST NOT call `process.exit` except from their exported `main` wrapper.
- Wave 3.11 validator coverage MUST scan the package CLI facade, covered package source, package dist, package tests, and install-matrix probe text for root `scripts/*.ts`, `ts-node`, and `tsx` dependencies after G010 creates the validator and install-matrix runner. Package tests in G003, G005, G006, and G007 MUST still assert no root-script, `ts-node`, or `tsx` dependency inside their own task-local package surfaces. This scan scope does not include unrelated repository-root dev scripts or root `package.json` dependencies.

### D007 Caller-Switch And Source-Retention Addendum

- G003 caller switching is limited to package tests and the seven listed acceptance tests.
- Existing root source callers may remain in root `scripts/*.ts` because Wave 3.11 explicitly retains all original root scripts.
- Known retained root source callers include `scripts/main-agent-orchestration.ts`, `scripts/supervised-worker-runtime.ts`, `scripts/main-agent-delivery-truth-gate.ts`, `scripts/main-agent-release-gate.ts`, and `scripts/main-agent-host-matrix-pr-orchestrator.ts`.
- The retained root source callers MUST NOT be used as consumer proof.
- Root script retention means every Wave 3.11 original root script path remains present and behavior-compatible for existing repository callers. A Wave 3.11 task MAY edit an original root script only to add a minimal compatibility wrapper or import redirection, and the edit MUST preserve its documented CLI/API arguments, output shape, exit-code semantics, and error names.
- If any Wave 3.11 original root script is edited, `cmd-assert-root-scripts-not-deleted` and the associated acceptance or package tests that exercised that root behavior before the switch MUST still pass after the edit. G011 MUST write `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/root-script-regression-proof.json` before running `cmd-assert-root-scripts-not-deleted`; that artifact is the only accepted source for named root-script behavior-regression evidence. If no accepted proof row covers a modified original root script, the executor MUST either leave that root script byte-for-byte unchanged or stop with `root_script_behavior_regression_proof_missing:<scriptPath>`.
- The Wave 3.11 validator MUST prove that covered package source, package dist, package tests, and install-matrix probes do not import or execute root `scripts/*.ts`.

### D008 Install Matrix Coverage Addendum

The install matrix MUST write `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json` and per-mode receipts under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix/`.

The package under test is the workspace package `packages/bmad-speckit` whose package name is `bmad-speckit`. The install matrix MUST NOT pack the repository root package `bmad-speckit-sdd-flow` for Wave 3.11 consumer probes.

Required pack source and isolation:

- The runner MUST create temp material only under `.tmp/main-agent-runtime-migration-wave-3.11/**` and `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix/**`, except for the explicit package staging surfaces required by `scripts/prepublish-check.js`: `packages/bmad-speckit/node_modules/@bmad-speckit/**`, `packages/bmad-speckit/node_modules/@bmad-speckit.staging/**`, `packages/bmad-speckit/node_modules/@bmad-speckit.old/**`, `packages/bmad-speckit/node_modules/.pack-session-count.json`, `packages/bmad-speckit/node_modules/.pack-session.lock/**`, `packages/bmad-speckit/node_modules/.prepublish-sync.lock/**`, `packages/bmad-speckit/_bmad/**`, `packages/bmad-speckit/_bmad.staging/**`, and `packages/bmad-speckit/_bmad.old/**`.
- Before `npm pack --ignore-scripts`, the runner MUST perform explicit pre-pack workspace bundle preparation through checked-in runner code instead of relying on npm lifecycle scripts or inline `node -e`.
- The runner MUST run these preparation commands with `cwd` set to the repository root: `npm run build:scoring`, `npm run build:runtime-context`, `npm run build:runtime-emit`, `npm run build:ralph-method`, and `npm run build:main-agent-dist`.
- The runner MUST then invoke checked-in `scripts/prepublish-check.js` with `cwd` set to the repository root and environment variables `BMAD_PREPUBLISH_SILENT=1` and `BMAD_PACK_SESSION=1`. The recorded command row MAY display this as `node scripts/prepublish-check.js` plus the explicit environment map; it MUST NOT require a caller to run inline JavaScript.
- The preparation MUST build and stage every bundled workspace dependency declared by `packages/bmad-speckit/package.json`: `@bmad-speckit/schema`, `@bmad-speckit/scoring`, `@bmad-speckit/runtime-context`, `@bmad-speckit/runtime-emit`, and `@bmad-speckit/ralph-method`.
- The runner MUST record `prepackPrepCommands` in `install-matrix.json`; each row MUST include `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, `startedAt`, `completedAt`, and `status`.
- The runner MUST fail before packing unless `packages/bmad-speckit/node_modules/@bmad-speckit/schema/package.json`, `packages/bmad-speckit/node_modules/@bmad-speckit/scoring/package.json`, `packages/bmad-speckit/node_modules/@bmad-speckit/scoring/dist/eval-questions/template-generator.js`, `packages/bmad-speckit/node_modules/@bmad-speckit/scoring/dist/eval-questions/manifest-loader.js`, `packages/bmad-speckit/node_modules/@bmad-speckit/runtime-context/package.json`, `packages/bmad-speckit/node_modules/@bmad-speckit/runtime-emit/package.json`, `packages/bmad-speckit/node_modules/@bmad-speckit/ralph-method/package.json`, and `packages/bmad-speckit/_bmad` exist after pre-pack preparation.
- The runner MUST run `npm pack --pack-destination <absolute-temp-pack-dir> --json --ignore-scripts` with `cwd=packages/bmad-speckit` after `npm run build:main-agent-dist` has produced dist files.
- `--ignore-scripts` is retained intentionally for the pack command. The install matrix MUST prove workspace-derived bundled dependencies through the explicit pre-pack preparation rows, not through implicit npm lifecycle execution during pack.
- Because `--ignore-scripts` prevents the package `postpack` cleanup from running, the runner MUST define a complete D008 cleanup sequence that runs `node scripts/cleanup-packed-bmad.js` from the repository root, runs runner-owned cleanup for every allowed prepublish staging leftover not removed by that script, and then performs the explicit absence check for every path listed below.
- If pre-pack preparation starts, the runner MUST execute the complete D008 cleanup sequence in a `finally` path or equivalent before any exit, including pack, install, probe, or validation failures.
- `install-matrix.json` MUST record `cleanupCommands` rows with the same command-row fields as `prepackPrepCommands`, including `status`. The rows MUST include the `node scripts/cleanup-packed-bmad.js` step, every runner-owned leftover-cleanup step, and the final absence-check step.
- The runner MUST fail unless all explicit package staging surfaces are absent after cleanup: `packages/bmad-speckit/_bmad`, `packages/bmad-speckit/_bmad.staging`, `packages/bmad-speckit/_bmad.old`, `packages/bmad-speckit/node_modules/@bmad-speckit`, `packages/bmad-speckit/node_modules/@bmad-speckit.staging`, `packages/bmad-speckit/node_modules/@bmad-speckit.old`, `packages/bmad-speckit/node_modules/.pack-session-count.json`, `packages/bmad-speckit/node_modules/.pack-session.lock`, and `packages/bmad-speckit/node_modules/.prepublish-sync.lock`.
- The runner MUST record `packageCwd: packages/bmad-speckit`, `packageName: bmad-speckit`, `packageVersion`, `tarballPath`, and `tarballSha256` in `install-matrix.json`.
- The runner MUST prove the installed `@bmad-speckit/scoring` dependency is derived from the current workspace build, not a stale registry copy. It MUST record `scoringPackageSourceCwd: packages/scoring`, `scoringPackageName: @bmad-speckit/scoring`, `scoringWorkspaceVersion`, `scoringWorkspaceDistHashes`, `installedScoringResolvedPath`, `installedScoringPackageVersion`, and `installedScoringDistHashes`.
- For `IM003`, `installedScoringDistHashes` MUST match the current workspace hashes for `packages/scoring/dist/eval-questions/template-generator.js` and `packages/scoring/dist/eval-questions/manifest-loader.js`.
- Consumer probes MUST execute from temp consumer projects outside the repository package workspace and MUST resolve `bmad-speckit` and `@bmad-speckit/scoring` from that temp consumer project's `node_modules`, not from repo source, workspace links, or the public registry.
- Temp packed tarballs, temp consumer package.json files, probe scripts, and per-mode receipts are generated evidence/temp surfaces. They are not consumer runtime dependencies and MUST NOT be referenced by package runtime code.

Required install modes:

| Mode | Required coverage |
| --- | --- |
| `save-dev` | Install the packed `packages/bmad-speckit` tarball into a temp consumer project and run all package CLI rows plus runtime/helper direct-require probes. |
| `no-save` | Install the packed `packages/bmad-speckit` tarball without saving dependency metadata and run all package CLI rows plus runtime/helper direct-require probes. |
| `npx-package` | Execute package CLI rows from a clean temp consumer project that does not preinstall `bmad-speckit`, using `npm exec --package <packed-bmad-speckit-tarball> -- bmad-speckit ...`. Direct-require rows may use a separate temp direct-require consumer with the packed tarball installed, but the install-matrix mode receipt MUST distinguish `consumerRoot`, `probeRoot`, and `requireProbeRoot`, and IM003/IM004 `cwd` values MUST point at the clean npx consumer. |
| `init-sync-consumer` | From a temp consumer parent that installed the packed tarball, run the installed CLI command `bmad-speckit init wave-3-11-sync --yes --no-git --ai codex --bmad-path <installed-bmad-speckit-package-root>/_bmad`, where `<installed-bmad-speckit-package-root>` is resolved from that temp consumer parent's `node_modules/bmad-speckit`; then execute package CLI rows and direct-require probes from `<temp-consumer-parent>/wave-3-11-sync`. The runner MUST assert the generated `bmad-speckit.json` records the installed package `_bmad` path, `bmad-speckit check --json --ignore-agent-tools` exits `0` from the synced project, and every Wave 3.11 probe still resolves `bmad-speckit` and `@bmad-speckit/scoring` from the temp consumer install, not from repo source. |

Required matrix rows:

| Row ID | Covered entries | Command surface | Required assertion |
| --- | --- | --- | --- |
| `IM001` | Four runtime module entries | Installed package direct `require('bmad-speckit/dist/main-agent/runtime/*.js')` probe | All D006 runtime exports exist and fixture-backed calls succeed without root script, `tsx`, `ts-node`, or compiled fallback. |
| `IM002` | Five helper entries | Installed package direct `require('bmad-speckit/dist/main-agent/helpers/*.js')` probe | All D006 helper exports exist and fixture-backed calls succeed without root script, `tsx`, `ts-node`, or compiled fallback. |
| `IM003` | `scripts/eval-question-generate.ts` | Installed `bmad-speckit eval-question-generate --input <fixture> --outputDir <tmp> --version v1` | Generated question files exist; generated `manifest.yaml` is loadable through installed `@bmad-speckit/scoring/eval-questions/manifest-loader.loadManifest(versionDir)`; every loaded question entry has `id`, `title`, `path`, and an existing generated question file; command does not execute root `scripts/eval-question-generate.ts`; installed `@bmad-speckit/scoring/eval-questions/*` resolves from the current workspace-derived scoring package and hash-matches D008 scoring proof. |
| `IM004` | `scripts/check-story-score-written.ts` | Installed `bmad-speckit check-score --epic <fixture> --story <fixture> --dataPath <fixture>` | Command loads `packages/bmad-speckit/src/commands/check-score.js` or installed package equivalent and does not execute root `scripts/check-story-score-written.ts`. |

Every row in every applicable mode MUST record `usedRootScript: false`, `usedTsx: false`, `usedTsNode: false`, and `usedCompiledFallback: false`. If a mode cannot execute a row, the row MUST be recorded with `status: blocked`, a concrete reason, and the run MUST stop with `blocked_by_contract_ambiguity:install_matrix_command_surface`.

### D009 Evidence, Failure, And Safe-Write Addendum

- G011 MUST write `evidence.json` incrementally: initialize the artifact before running evidence commands, append a command row immediately after each command finishes, and never mark a command with nonzero `exitCode` as passed.
- G010 MUST provide `tools/script-migration/write-main-agent-wave-3-11-evidence.cjs` and `tools/script-migration/main-agent-wave-3-11-evidence-utils.cjs` as the deterministic writer path for pre-evidence artifacts, `evidence.json` initialization, command row execution/appending, `root-script-regression-proof.json`, `summary.md`, the unsealed final packet, final packet sealing, and the post-validator self-excluded final row. Executors MUST use this writer path or an explicitly contract-amended equivalent; ad hoc hand-written `evidence.json` command rows are not accepted.
- The G011 `--evidence-running` validator MAY validate all G011 command rows completed before its own invocation and MUST NOT require G012 `summary.md` or `final-evidence-packet.json`.
- G012 MUST NOT start until ACC001 through ACC012 are `passed`, MAN001 through MAN003 are `passed`, and no latest Required Test Command row is `failed`. The writer MUST enforce this before `--write-summary`, `--mark-awaiting-final-validator`, `--write-unsealed-final-packet`, or `--seal-final-packet`.
- G012 MUST write and promote `summary.md`, run `cmd-assert-final-closeout-language`, append that row with `manualScenarioIds: ["MAN004"]`, set ACC013/ACC014 to self-excluded awaiting-final state, write and promote the unsealed `final-evidence-packet.json`, run `cmd-encoding-final`, append its row, then seal `final-evidence-packet.json` before running final acceptance and the final full validator.
- G012 final acceptance MUST run after the packet is sealed and MUST validate the sealed packet plus final encoding row, but MUST NOT require the final validator command row. If `cmd-test-wave-3-11-contract-final` fails after packet sealing, the executor MUST append the failed command row to `evidence.json` and stop with `sealed_final_command_failed:cmd-test-wave-3-11-contract-final`; it MUST NOT modify or replace the sealed packet in the same run.
- The final full validator MUST run last through `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row`; executors MUST NOT run `cmd-validate-wave-3-11-final` as a separate pre-step. The writer MUST invoke the direct validator command, validate the sealed packet, final encoding row, final acceptance row, install-matrix rows, every command row completed before its own invocation, and the D010 self-exclusion contract for its own future row. It MUST NOT fail solely because its own command row is appended after the invocation returns.
- If the final validator invocation inside `--append-final-validator-row` fails after packet sealing, the writer MUST append the failed command row to `evidence.json` and the executor MUST stop with `sealed_final_command_failed:cmd-validate-wave-3-11-final`; it MUST NOT modify or replace the sealed packet in the same run. This is an allowed post-validator mutation of `evidence.json`: append the failed final validator row, set top-level `status: failed`, and set `completedAt` without mutating `safe-write-receipts.json`.
- After the final full validator exits `0`, the writer MUST append only the final validator command row to `evidence.json`, set `status: passed`, and set `completedAt`. This final post-validator `evidence.json` promotion is self-excluded from final-validator and `safe-write-receipts.json` coverage; `safe-write-receipts.json` MUST NOT be mutated after `cmd-validate-wave-3-11-final` returns, and the final human response MUST report the post-validator `evidence.json` SHA256.
- `final-evidence-packet.json` MUST NOT be modified after its `sealed: true`, `sealedAt`, and `sealHash` fields are written. The final validator command row remains only in `evidence.json` and the final human response.
- Every Required Test Command failure before `final-evidence-packet.json` is sealed allows one scoped repair attempt only when the required repair stays inside G001-G012 file scopes.
- After a scoped repair, the failed command and every later command in the Required Test Commands sequence MUST be rerun and recorded with fresh hashes unless `validate-main-agent-runtime-migration-wave-3-11.cjs` records and enforces a stricter dependency map.
- The writer MUST run a preflight gate before executing any Required Test Command. If the latest row for that command already failed twice, the writer MUST stop with `required_command_failed:<commandId>` before spawning the underlying command. If any earlier Required Test Command latest row is `failed`, the writer MUST stop with `required_command_pending_repair:<earlierCommandId>` before spawning a later command.
- If the same command fails a second time, `--run-command <commandId>` MUST append the second failed command row and, in the same safe-write promotion, automatically set active `evidence.json` to `status: blocked`, `blockedReason: "required_command_failed:<commandId>"`, `blockedCommandId: <commandId>`, and `blockedAt`. Its CLI result MUST report `status: blocked` plus `blockedReason` and `blockedCommandId`.
- After this automatic blocked-state transition, a later implementation repair MUST start a new explicitly named execution round by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --start-repair-round <roundId>` or by a contract amendment; it MUST NOT append a third ordinary attempt to the same command in the same `evidence.json`.
- `--start-repair-round <roundId>` MUST only run when the active `evidence.json` is `status: blocked`; it MUST safe-write the blocked round to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence-history/<roundId>.evidence.json`, then initialize a new active `evidence.json` with `status: running`, `executionRoundId: <roundId>`, `previousEvidenceArchivePath`, `repairOfBlockedReason`, and `repairOfBlockedCommandId`.
- When active `evidence.json.previousEvidenceArchivePath` exists, the validator MUST require that archive path to match `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence-history/<executionRoundId>.evidence.json`, require the archive JSON to exist, require a latest passed `safe-write-receipts.json` receipt whose hash matches the promoted archive bytes, and require archive `blockedReason` / `blockedCommandId` plus nested blocked evidence metadata to match active `repairOfBlockedReason` / `repairOfBlockedCommandId`.
- Required PowerShell commands MUST be copy-paste runnable in PowerShell 7 and MUST use single-quoted outer `-Command '& { ... }'` script blocks. Complex assertions MUST live in checked-in validator code, not inline `node -e` snippets.
- Generated or large Markdown, YAML, JSON, TOML, README, AGENTS, requirements contract, or generated documentation rewrites MUST use the repository Large File Safe Write Protocol: same-directory draft, backup, required-heading check, byte-length check, SHA256 check, atomic promote, post-write readback, and encoding gate.

### D010 Artifact Schema And Safe-Write Addendum

All Wave 3.11 generated evidence artifacts are UTF-8 JSON or Markdown written under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/**` unless D008 explicitly allows temp material under `.tmp/main-agent-runtime-migration-wave-3.11/**`.

Shared schema rules:

- JSON artifacts MUST be parseable JSON with no comments.
- Timestamps MUST be ISO 8601 strings with a timezone designator.
- Hash fields MUST use lowercase `sha256:<64-hex>` format. `stdoutHash` and `stderrHash` hash the exact captured UTF-8 stdout and stderr strings; empty streams still use the SHA256 hash of the empty string.
- Canonical JSON hashing applies only to `final-evidence-packet.json` `sealHash` and `safe-write-receipts.json` `selfVerification.payloadSha256`. For `sealHash`, recursively sort object keys in ascending JavaScript `Array.prototype.sort()` order, preserve array order, omit only the top-level `sealHash` property, serialize with `JSON.stringify(canonicalValue)`, encode those exact bytes as UTF-8 without BOM, and add no trailing newline before hashing. Safe-write receipt hashes and final packet cross-artifact hashes are promoted-file-byte hashes: `draftSha256`, `promotedSha256`, `postWriteSha256`, validator-compatible `sha256`, `installMatrixHash`, `summaryHash`, and `sealedEvidenceJsonHash` MUST hash the exact promoted file bytes of the referenced artifact.
- Top-level artifact `status` values are limited to `running`, `awaiting_final_validator_self_receipt`, `sealed_snapshot`, `passed`, `failed`, or `blocked`, as applicable to the artifact.
- A command row MUST include `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, `startedAt`, `completedAt`, and `status`. Rows in `evidence.json` MUST also include `commandId`, `sequence`, and `attempt`. Rows that satisfy manual verification scenarios MUST include `manualScenarioIds` with one or more of `MAN001`, `MAN002`, `MAN003`, or `MAN004`.
- Command row `status` values are limited to `passed`, `failed`, or `blocked`. A command row status is `passed` only when `exitCode` is `0`; nonzero rows MUST be `failed` or `blocked` and MUST NOT be counted as passing evidence.
- `acceptanceStatus` MUST be an object keyed by `ACC001` through `ACC014`. Each value MUST include `status`, `evidenceRefs`, `commandIds`, and `notes`. Allowed acceptance status values are `passed`, `failed`, `blocked`, `pending`, and `self_excluded`. `self_excluded` is allowed only for ACC013 and ACC014 final sealed-snapshot self-reference cases and MUST include `reason` plus `pendingCommandIds`.
- ACC001 through ACC012 status updates MUST follow the `ACC001-ACC012 Status Update Table` below. The executor may set an ACC row to `passed` only after every listed command row has `status: passed`, every listed artifact exists, every safe-written artifact has a `safe-write-receipts.json` receipt with `status: passed`, and the validator has checked the row-specific pass condition from the Acceptance Traceability Matrix. If any required command fails, set the ACC row to `failed`; if a required artifact or decision is missing, keep it `pending` or set it to `blocked` with a concrete reason. Do not infer pass status from prose.
- ACC013 and ACC014 final completion is a two-layer proof. In `final-evidence-packet.json` and in `evidence.json` immediately before `cmd-validate-wave-3-11-final`, ACC013 and ACC014 MUST remain `self_excluded` with `pendingCommandIds: ["cmd-test-wave-3-11-contract-final", "cmd-validate-wave-3-11-final"]`. After `cmd-validate-wave-3-11-final` exits `0`, the executor MUST NOT mutate ACC013 or ACC014 inside the sealed packet or `evidence.json`; instead, ACC013 and ACC014 are considered directly proven only by the recorded final acceptance command row, the recorded final validator command row, and the final human response that reports those exit codes.

ACC001-ACC012 Status Update Table:

| ACC | Required command IDs | Required artifact refs before `passed` |
| --- | --- | --- |
| ACC001 | `cmd-git-status-baseline`, `cmd-encoding-pre-implementation` | `preflight.json`, `source-inventory.json` with per-entry `originalPathSha256`, `safe-write-receipts.json` |
| ACC002 | `cmd-build-main-agent-dist` | Four D002 runtime source files and four D002 runtime dist files |
| ACC003 | `cmd-test-runtime-modules` | `packages/bmad-speckit/tests/main-agent-wave-3-11-runtime-modules.test.js` |
| ACC004 | `cmd-test-runtime-acceptance-import-switches` | Seven G003 acceptance test files |
| ACC005 | `cmd-build-main-agent-dist`, `cmd-test-helpers` | Five D003 helper source files, five D003 helper dist files, `packages/bmad-speckit/tests/main-agent-wave-3-11-helpers.test.js` |
| ACC006 | `cmd-build-scoring`, `cmd-test-scoring-eval-questions`, `cmd-test-eval-question-generate`, `cmd-smoke-eval-question-generate-source-tree`, `cmd-run-install-matrix` | `packages/bmad-speckit/src/commands/eval-question-generate.js`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/fixtures/coach-report.json`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json` |
| ACC007 | `cmd-test-check-score`, `cmd-assert-public-cli-dispatch`, `cmd-validate-registry` | `packages/bmad-speckit/src/commands/check-score.js`, `packages/bmad-speckit/bin/bmad-speckit.js`, `repo-governance/script-migration-registry.yaml` |
| ACC008 | `cmd-assert-no-migration-internal-exact` | `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/no-migration-internal.json` |
| ACC009 | `cmd-validate-registry` | `repo-governance/script-migration-registry.yaml`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/registry-evidence.json`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/classification-evidence.json` |
| ACC010 | `cmd-closure-audit-write`, `cmd-assert-closure-audit-exact-wave-3-11` | `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/classification-evidence.json` |
| ACC011 | `cmd-build-scoring`, `cmd-test-scoring-eval-questions`, `cmd-build-main-agent-dist`, `cmd-test-package-build-dispatch-regressions`, `cmd-test-runtime-modules`, `cmd-test-helpers`, `cmd-test-eval-question-generate`, `cmd-test-check-score` | Package source, package dist, package tests, and scoring test artifacts named by G002 through G007 |
| ACC012 | `cmd-test-install-surface-regressions`, `cmd-run-install-matrix`, `cmd-validate-wave-3-11-evidence-running` | `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json`, install-matrix receipt JSON files, `safe-write-receipts.json` |

Artifact schemas:

- `preflight.json` MUST contain `waveId`, `startedAt`, `completedAt`, `gitStatusShortHash`, `sourceInventoryHash`, and `commands`. `gitStatusShortHash` MUST equal the preflight git status row `stdoutHash`; `sourceInventoryHash` MUST equal the promoted-file-byte hash of `source-inventory.json`.
- `source-inventory.json` MUST contain `waveId`, `generatedAt`, and `entries`. `entries` MUST contain exactly the thirteen D001 original paths, each with `originalPath`, `originalPathSha256`, `auditSemanticClassification`, `migrationStrategy`, `targetPaths`, `retainedRootPath: true`, and `deletionAllowed: false`. `originalPathSha256` is mandatory and is the lowercase `sha256:<64-hex>` hash of the UTF-8 bytes at G001 baseline time; the Wave 3.11 validator MUST fail any entry that omits it.
- `no-migration-internal.json` MUST contain `waveId`, `generatedAt`, and exactly two `entries`, each with `originalPath`, `currentClassification`, `reason`, `consumerReachable: false`, and `packageSurfaceConsumed: false`. If a `classification` alias is present, it MUST equal `currentClassification`; validator assertions consume `currentClassification`.
- `root-script-regression-proof.json` MUST contain `waveId`, `generatedAt`, `sourceInventoryRef`, and exactly thirteen `entries`, one per D001 original path. Each entry MUST include `originalPath`, `baselineSha256`, `currentSha256`, `worktreeStatus`, `contentChanged`, `behaviorProofStatus`, `acceptedCommandIds`, `evidenceRefs`, and `preservedBehavior`. `baselineSha256` MUST equal the matching `source-inventory.json` `originalPathSha256`; `contentChanged` is `true` only when `currentSha256` differs from `baselineSha256` or git worktree status reports a modification. The deterministic Wave 3.11 writer only accepts `contentChanged: false`; in that case `behaviorProofStatus` MUST be `unchanged` and `acceptedCommandIds` MAY be empty. If any original root script is changed, the writer MUST stop with `root_script_behavior_regression_proof_missing:<scriptPath>` unless the contract is explicitly amended with real per-script behavior-proof input. `cmd-git-status-baseline` is never accepted as behavior proof. No entry may use `unknown`, `manual_inspection`, or free-form proof status.
- `classification-evidence.json` MUST contain `waveId`, `generatedAt`, `refinesWaveId: main-agent-runtime-migration-wave-3.10`, `auditReportPath`, `registryPath`, and exactly thirteen `entries`. Each entry MUST include `originalPath`, `currentClassification`, `migrationStrategy`, `auditSemanticClassification`, `registryMigrationStrategy`, `status`, and `evidenceRefs`. `currentClassification` MUST equal `auditSemanticClassification`, and `migrationStrategy` MUST equal `registryMigrationStrategy`; validator assertions consume `currentClassification` and `migrationStrategy`. No entry may have `currentClassification` or `auditSemanticClassification` equal to `repo_internal_reclassify_possible`, `unknown_requires_followup`, `blocked_requires_followup`, or any recommendation-only state.
- `registry-evidence.json` MUST use the legacy registry evidence schema accepted by `tools/script-migration/validate-registry.cjs`: top-level `waveId`, `validatedAt`, and `entries`; each entry MUST include `entryId`, `originalPath`, `targetPaths`, `commands`, `installMatrixEvidence`, and `result`. Each `commands` row MUST include at least `command`, `exitCode`, `stdoutHash`, and `stderrHash`; `result` MUST be `passed` for entries whose registry `validationStatus` is `passed`, and no `passed` entry may contain a nonzero command row. Empty per-entry `commands` arrays are allowed by the legacy registry schema; G011/G012 command evidence remains in D010 `evidence.json` and MUST NOT be substituted into registry `evidenceRefs`.
- `evidence.json` MUST contain `waveId`, `status`, `startedAt`, `completedAt` or `null`, ordered `commandRows`, `acceptanceStatus` for ACC001 through ACC014, and `manualVerificationStatus` for MAN001 through MAN004. Each manual verification value MUST include `status`, `evidenceRefs`, `commandIds`, and `notes`; allowed manual verification status values are `passed`, `failed`, `blocked`, and `pending`. `status` is `running` until `--mark-awaiting-final-validator` executes. That command MUST set `status: awaiting_final_validator_self_receipt` before unsealed final packet generation, and this status MUST remain unchanged through `cmd-test-wave-3-11-contract-final` and the final full validator invocation. The final acceptance validator and final full validator MUST validate that pre-invocation state, including ACC013 and ACC014 still being `self_excluded`, and the final full validator MUST fail if `cmd-validate-wave-3-11-final` is already present in `commandRows`. After `cmd-validate-wave-3-11-final` exits `0`, the executor may append only that validator row, set `status: passed`, and set `completedAt`; those exact post-validator mutations are self-excluded from the final validator and from `safe-write-receipts.json` coverage, and MUST be reported in the final response with the post-validator `evidence.json` SHA256.
- `install-matrix.json` MUST contain D008 package metadata, D008 scoring proof fields, `prepackPrepCommands`, `cleanupCommands`, `modes`, and ordered row results for IM001 through IM004 in every applicable mode. Each mode result MUST include `mode`, `status`, `consumerRoot`, `probeRoot`, `requireProbeRoot`, `packageRoot`, `receiptPath`, `commands`, and `rows`. Each install-matrix per-mode receipt JSON MUST include the same `consumerRoot`, `probeRoot`, `requireProbeRoot`, and `packageRoot` values as its matching `install-matrix.json` mode result. Each row result MUST include `mode`, `rowId`, `status`, `command`, `cwd`, `exitCode`, `receiptPath`, `usedRootScript`, `usedTsx`, `usedTsNode`, `usedCompiledFallback`, and `assertions`.
- `final-evidence-packet.json` MUST support exactly two states. Before sealing, the unsealed draft MUST contain `waveId`, `status: running`, `sealed: false`, `generatedAt`, `sealedAt: null`, `sealHash: null`, `acceptanceStatus` for ACC001 through ACC014, `manualVerificationStatus` for MAN001 through MAN004, `sealedEvidenceJsonHash: null`, `installMatrixHash`, `summaryHash`, `finalEncodingCommandId: null`, `expectedFinalAcceptanceCommandId: "cmd-test-wave-3-11-contract-final"`, `expectedFinalValidatorCommandId: "cmd-validate-wave-3-11-final"`, and `residualRisks`. After sealing, the packet MUST contain the same field set with `status: sealed_snapshot`, `sealed: true`, non-null `sealedAt`, non-null `sealHash`, non-null `sealedEvidenceJsonHash`, and `finalEncodingCommandId: "cmd-encoding-final"`. `sealedEvidenceJsonHash` is the promoted-file-byte hash of `evidence.json` at the moment immediately before the packet is sealed, after `cmd-encoding-final` is recorded and before `cmd-test-wave-3-11-contract-final` runs; it MUST match a passed `safe-write-receipts.json` receipt for `evidence.json` whose `completedAt` is not later than `sealedAt`. In the sealed packet, ACC001 through ACC012 MUST be `passed` when directly proven; ACC013 MUST be `self_excluded` with `pendingCommandIds: ["cmd-test-wave-3-11-contract-final", "cmd-validate-wave-3-11-final"]`; ACC014 MUST be `self_excluded` with `pendingCommandIds: ["cmd-test-wave-3-11-contract-final", "cmd-validate-wave-3-11-final"]` and reason `sealed_packet_cannot_validate_future_final_commands`; MAN001 through MAN004 MUST be `passed` before sealing. When sealing, compute `sealHash` from the canonical UTF-8 JSON payload with `sealHash` omitted, then write the packet with `sealed: true` and the computed `sealHash`. No field in this packet may change after sealing.
- `safe-write-receipts.json` MUST contain `waveId`, `generatedAt`, ordered `receipts`, and `selfVerification`. Each receipt MUST include validator-compatible `targetPath`, `sha256`, and `status`, plus safe-write detail fields `artifactPath`, `operation`, `draftPath`, `backupPath` or `null`, `requiredChecks`, `hashKind`, `draftSha256`, `promotedSha256`, `postWriteSha256`, `byteLength`, `startedAt`, and `completedAt`. `hashKind` MUST be `promoted_file_bytes`. `requiredChecks` MUST be structured checks, including a `jsonParse` check for JSON artifacts and `topLevelKey` checks for each required top-level schema key. `targetPath` MUST equal `artifactPath` when both are present, and `sha256` MUST equal `postWriteSha256` when both are present. `selfVerification` MUST include `hashKind: canonical_json_without_selfVerification`, `payloadSha256`, `computedAt`, and `status: passed`; `payloadSha256` hashes canonical JSON for the receipt index with `selfVerification` omitted. `status` values are limited to `passed`, `failed`, or `blocked`. Historical passed receipts are an ordered audit trail and do not need to match the current file after later promotions of the same target; the latest passed receipt for each target is the receipt that MUST match the current promoted file bytes. Every artifact listed in Safe-write requirements MUST have at least one receipt with `status: passed` before it is accepted as evidence, except the latest `safe-write-receipts.json` self-write and the explicitly self-excluded final post-validator `evidence.json` mutation.

Safe-write requirements:

- `repo-governance/script-migration-registry.yaml`, `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json`, `preflight.json`, `source-inventory.json`, `no-migration-internal.json`, `root-script-regression-proof.json`, `classification-evidence.json`, `registry-evidence.json`, `evidence.json`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence-history/*.evidence.json`, `install-matrix.json`, every install-matrix receipt JSON, `summary.md`, `final-evidence-packet.json`, and `safe-write-receipts.json` MUST be promoted through same-directory draft/temp files.
- `safe-write-receipts.json` is the receipt index for every other safe-written artifact. It MUST itself be promoted safely and hash-verified, but it is exempt from requiring a receipt entry for its own latest write to avoid circular evidence. The only other receipt-coverage exemption is the final post-validator `evidence.json` mutation described in D009 and the `evidence.json` schema above; no other artifact may use this exemption.
- If the target artifact already exists, the writer MUST create a timestamped same-directory backup before replacement.
- Before promotion, JSON drafts MUST parse and contain the required top-level keys for their schema. Markdown drafts MUST contain their required heading and narrow-scope language.
- Before promotion, the writer MUST compute and record the draft SHA256. After promotion, the writer MUST read the target back and verify the promoted SHA256.
- Incremental appends to `evidence.json` are implemented as read-modify-write safe-write promotions after every command row, not as stream append or PowerShell redirection.

## Implementation Tasks

### G001 Preflight And Baseline Evidence

Purpose: Establish a clean execution baseline for Wave 3.11 without changing migration code.

Files:

- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/preflight.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/source-inventory.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/safe-write-receipts.json`

Steps:

- Run `git status --short --branch` from the repository root and record the resolved absolute `cwd` in the command row.
- Run `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` from the repository root and record the resolved absolute `cwd` in the command row.
- Read `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json`.
- Write `source-inventory.json` with the thirteen Wave 3.11 original paths and their selected strategies according to the D010 schema.
- Write `preflight.json` with `waveId`, `startedAt`, `completedAt`, `gitStatusShortHash`, `sourceInventoryHash`, and a `commands` array according to the D010 schema.
- The `commands` array MUST include the git status command row and the encoding gate command row.
- Each preflight command row MUST include `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, `startedAt`, `completedAt`, and `status`.
- Promote both JSON artifacts through D010 safe-write requirements and update `safe-write-receipts.json` with passed receipts before ACC001 evidence is accepted.

Validation:

- `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` MUST exit `0`.
- `Test-Path -LiteralPath 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/preflight.json'` MUST return `True`.
- `Test-Path -LiteralPath 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/source-inventory.json'` MUST return `True`.
- `source-inventory.json` MUST parse and contain exactly the thirteen D001 original paths with selected strategies matching the D001 semantic-to-registry mapping.

Acceptance: ACC001.

### G002 Migrate Runtime Modules To Package Source

Purpose: Move four acceptance-covered runtime contracts into package runtime source and dist output.

Files:

- `scripts/host-runtime-mode.ts`
- `scripts/supervised-worker-runtime.ts`
- `scripts/diagnose-bmad-state.ts`
- `scripts/parallel-mission-control.ts`
- `packages/bmad-speckit/src/main-agent/runtime/host-runtime-mode.js`
- `packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.js`
- `packages/bmad-speckit/src/main-agent/runtime/diagnose-bmad-state.js`
- `packages/bmad-speckit/src/main-agent/runtime/parallel-mission-control.js`
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`

Steps:

- Port the exported runtime behavior from each root TypeScript script into the matching CommonJS package runtime module.
- Implement the required CommonJS exports and minimum behavioral assertions from D006.
- Preserve input defaults, output shapes, exit-code semantics, and error names from the root TypeScript implementation.
- Update `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` so the four `runtime/*.js` files are copied to dist.
- Leave the four original root TypeScript scripts present.
- Do not make any package runtime module import root `scripts/*.ts`.

Validation:

- `npm run build:main-agent-dist` MUST exit `0`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/runtime/host-runtime-mode.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/runtime/supervised-worker-runtime.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/runtime/diagnose-bmad-state.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/runtime/parallel-mission-control.js'` MUST return `True`.

Acceptance: ACC002, ACC003, ACC011.

### G003 Add Runtime Module Package Tests And Caller Switches

Purpose: Prove the four migrated runtime modules are package-consumable without root TypeScript imports.

Files:

- `packages/bmad-speckit/tests/main-agent-wave-3-11-runtime-modules.test.js`
- `tests/acceptance/main-agent-host-runtime-mode.test.ts`
- `tests/acceptance/main-agent-supervised-worker-timeout.test.ts`
- `tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts`
- `tests/acceptance/main-agent-delivery-truth-gate.test.ts`
- `tests/acceptance/main-agent-pr-topology.test.ts`
- `tests/acceptance/main-agent-parallel-locking.test.ts`
- `tests/acceptance/parallel-mission-evidence-integration.test.ts`

Steps:

- Add a package JavaScript test that requires the four runtime modules from package source or package dist.
- Assert every D006 runtime export exists, including constants, and execute every pure or fixture-backed function export.
- Include negative/error-path assertions for runtime modules whose root source exposes an observable error marker, error name, structured failure result, or exit-code representation.
- Update listed acceptance tests so runtime-contract imports use package runtime modules instead of the four root TypeScript scripts.
- Do not switch retained root source callers unless their package equivalent is in the declared write scope.
- Preserve existing acceptance assertions.
- Do not add `tsx` or `ts-node` to package tests.

Validation:

- `npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-runtime-modules.test.js` MUST exit `0`.
- `npx vitest run tests/acceptance/main-agent-host-runtime-mode.test.ts tests/acceptance/main-agent-supervised-worker-timeout.test.ts tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts tests/acceptance/main-agent-delivery-truth-gate.test.ts tests/acceptance/main-agent-pr-topology.test.ts tests/acceptance/main-agent-parallel-locking.test.ts tests/acceptance/parallel-mission-evidence-integration.test.ts` MUST exit `0`.

Acceptance: ACC003, ACC004, ACC011.

### G004 Migrate Package Helper Closure

Purpose: Move five helper scripts into package-local helper modules and dist output.

Files:

- `scripts/bmad-state-reader.ts`
- `scripts/e2e-verify-paths.ts`
- `scripts/query-validate.ts`
- `scripts/runtime-step-state.ts`
- `scripts/verify-agent-files.ts`
- `packages/bmad-speckit/src/main-agent/helpers/bmad-state-reader.js`
- `packages/bmad-speckit/src/main-agent/helpers/e2e-verify-paths.js`
- `packages/bmad-speckit/src/main-agent/helpers/query-validate.js`
- `packages/bmad-speckit/src/main-agent/helpers/runtime-step-state.js`
- `packages/bmad-speckit/src/main-agent/helpers/verify-agent-files.js`
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`

Steps:

- Port helper behavior from each root TypeScript script into the matching CommonJS package helper module.
- Implement the required CommonJS exports and minimum behavioral assertions from D006.
- Use package-relative paths or caller-provided project paths in helper modules.
- Update `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` so the five `helpers/*.js` files are copied to dist.
- Leave the five original root TypeScript scripts present.

Validation:

- `npm run build:main-agent-dist` MUST exit `0`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/helpers/bmad-state-reader.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/helpers/e2e-verify-paths.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/helpers/query-validate.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/helpers/runtime-step-state.js'` MUST return `True`.
- `Test-Path -LiteralPath 'packages/bmad-speckit/dist/main-agent/helpers/verify-agent-files.js'` MUST return `True`.

Acceptance: ACC005, ACC011.

### G005 Add Helper Package Tests

Purpose: Prove the five migrated helpers are package-local and do not require root TypeScript scripts.

Files:

- `packages/bmad-speckit/tests/main-agent-wave-3-11-helpers.test.js`

Steps:

- Add package JavaScript tests that require all five helper modules from package source or package dist.
- Assert each helper module exposes a deterministic CommonJS API.
- Assert every D006 helper export exists, including constants, and execute every pure or fixture-backed function export.
- Include negative/error-path assertions for helper modules whose root source exposes an observable error marker, error name, structured failure result, or exit-code representation.
- Assert helper module source text contains no import or require of root `scripts/*.ts`.
- Assert helper module source text contains no `ts-node` and no `tsx` token.

Validation:

- `npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-helpers.test.js` MUST exit `0`.

Acceptance: ACC005, ACC011.

### G006 Migrate Eval Question Generation To Public CLI Package Action

Purpose: Replace source-root eval question generation with a package CLI command.

Files:

- `scripts/eval-question-generate.ts`
- `packages/bmad-speckit/src/commands/eval-question-generate.js`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/scoring/package.json`
- `packages/scoring/eval-questions/manifest-loader.ts`
- `packages/scoring/eval-questions/template-generator.ts`
- `packages/scoring/eval-questions/__tests__/template-generator.test.ts`
- `packages/scoring/eval-questions/__tests__/manifest-loader.test.ts`
- `packages/scoring/eval-questions/__tests__/run-core.test.ts`
- `packages/scoring/eval-questions/__tests__/cli-integration.test.ts`
- `packages/scoring/__tests__/e2e/eval-question-flow.test.ts`
- `packages/bmad-speckit/tests/eval-question-generate-command.test.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/fixtures/coach-report.json`

Steps:

- Add `packages/bmad-speckit/src/commands/eval-question-generate.js` as a CommonJS package command.
- Add a `bmad-speckit eval-question-generate` command in `packages/bmad-speckit/bin/bmad-speckit.js`.
- Preserve `--run-id`, `--input`, `--version`, `--outputDir`, and `--output-dir` CLI arguments.
- Implement `--input` mode without executing root `scripts/eval-question-generate.ts`.
- Implement `--run-id` as retained compatibility scope only. The package command test MUST prove `--run-id` does not execute root `scripts/eval-question-generate.ts`, does not require `tsx` or `ts-node`, and fails closed when package-supported scoring data cannot resolve the requested run. No Wave 3.11 summary, install matrix row, or completion packet may use `--run-id` as consumer proof.
- The package command test MUST run a controlled fail-closed `--run-id` case with `SCORING_DATA_PATH` set to an empty temporary directory, `--run-id wave-3-11-missing-run`, `--version v1`, and no `--input`. Expected result: nonzero exit code, stderr or structured error contains `EVAL_QUESTION_RUN_ID_UNRESOLVED`, no generated question files, no root `scripts/eval-question-generate.ts` execution, no `tsx`, and no `ts-node`.
- Add mandatory `packages/scoring/package.json` exports for `./eval-questions/template-generator` and `./eval-questions/manifest-loader`.
- Add package file coverage for the mandatory eval-question dist modules and required eval-question assets.
- Preserve `manifest.yaml` output semantics by using the scoring manifest loader/template generator contract; do not switch source-tree or installed eval output to `manifest.json`.
- Create `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/fixtures/coach-report.json` with weak-area and weakness-cluster fixture data.
- Keep `scripts/eval-question-generate.ts` present.

Validation:

- `npm run build:scoring` MUST exit `0`.
- `npx vitest run packages/scoring/eval-questions/__tests__/template-generator.test.ts packages/scoring/eval-questions/__tests__/manifest-loader.test.ts packages/scoring/eval-questions/__tests__/run-core.test.ts packages/scoring/eval-questions/__tests__/cli-integration.test.ts packages/scoring/__tests__/e2e/eval-question-flow.test.ts` MUST exit `0`.
- `npm run test --prefix packages/bmad-speckit -- eval-question-generate-command.test.js` MUST exit `0` and MUST cover `--input` success plus `--run-id` retained compatibility/fail-closed behavior.
- Do not run `cmd-smoke-eval-question-generate-source-tree` during G006; G010 creates the checked-in validator assertion that command depends on, and G011 runs the command after G010 is complete.
- G006 local validation MUST prove the package command test covers `--input` success, generated question files, generated `manifest.yaml` loaded through `loadManifest(versionDir)`, and `--run-id` retained compatibility/fail-closed behavior.

Acceptance: ACC006, ACC011, ACC012.

### G007 Close Existing Check-Score Package Action Legacy Root Entry

Purpose: Record `scripts/check-story-score-written.ts` as a retained legacy root path with existing package CLI replacement.

Files:

- `scripts/check-story-score-written.ts`
- `packages/bmad-speckit/src/commands/check-score.js`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/tests/check-score-command.test.js`

Steps:

- Verify `packages/bmad-speckit/bin/bmad-speckit.js` dispatches `check-score` to `../src/commands/check-score`.
- Add a package JavaScript test that proves `bmad-speckit check-score` loads the package command.
- Do not classify `scripts/check-story-score-written.ts` as true no-migration internal.
- Do not delete `scripts/check-story-score-written.ts`.

Validation:

- `npm run test --prefix packages/bmad-speckit -- check-score-command.test.js` MUST exit `0`.

Acceptance: ACC007, ACC011.

### G008 Record True No-Migration Internal Scripts

Purpose: Keep the two true no-migration scripts under narrow internal classifications.

Files:

- `scripts/create-second-story.ts`
- `scripts/verify-score-auto-scoped-bundle.cjs`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/no-migration-internal.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/safe-write-receipts.json`

Steps:

- Write `no-migration-internal.json` with exactly two entries.
- Set `scripts/create-second-story.ts` `currentClassification` to `repo_internal_test_seed_only` in the artifact.
- Set `scripts/verify-score-auto-scoped-bundle.cjs` `currentClassification` to `repo_internal_verification_harness` in the artifact.
- Assert no package CLI command, package runtime command, install surface, or generated command consumes either script.
- Do not include `scripts/check-story-score-written.ts` in this artifact.
- Promote `no-migration-internal.json` through D010 safe-write requirements and update `safe-write-receipts.json` with a passed receipt before ACC008 evidence is accepted.

Validation:

- Do not run `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert no-migration-internal-exact` during G008; G010 creates that validator subcommand, and G011 runs it after G010 is complete.
- Before G010 exists, G008 validation MUST prove `no-migration-internal.json` exists and contains exactly two entries with original paths `scripts/create-second-story.ts` and `scripts/verify-score-auto-scoped-bundle.cjs`.

Acceptance: ACC008, ACC010.

### G009 Update Registry And Consumer Closure Audit

Purpose: Make Wave 3.11 the registry-backed correction and migration record.

Files:

- `repo-governance/script-migration-registry.yaml`
- `tools/script-migration/audit-consumer-reachable-closure.cjs`
- `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/classification-evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/registry-evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/safe-write-receipts.json`

Steps:

- Add `main-agent-runtime-migration-wave-3.11` to `repo-governance/script-migration-registry.yaml`.
- Set `refinesWaveId: main-agent-runtime-migration-wave-3.10` on the Wave 3.11 registry wave.
- Add registry entries for all thirteen Wave 3.11 original paths.
- Set migration strategy to `package_runtime_module` for the four runtime module entries.
- Set migration strategy to `durable_helper_copy` for the five helper entries.
- Set migration strategy to `public_cli_de_surface` for `scripts/eval-question-generate.ts` and `scripts/check-story-score-written.ts`.
- Set migration strategy to `repo_internal_reclassify` for `scripts/create-second-story.ts` and `scripts/verify-score-auto-scoped-bundle.cjs`.
- Set the Wave 3.11 registry wave `status: blocked` while any package-runtime/package-helper/public-CLI entry lacks strict package source parity and passing command evidence; set those entries to `migrationStatus: blocked` and `validationStatus: partial`. Only true no-migration `repo_internal_reclassify` entries may be `validated/passed` at pre-evidence time.
- Set `deletionAllowed: false` and `deletionApprovalRef: null` for every Wave 3.11 entry.
- Update `tools/script-migration/audit-consumer-reachable-closure.cjs` so the current audit semantic classification for `scripts/eval-question-generate.ts` is promoted to `public_cli_package_action`, with no remaining `unknown_requires_followup`, `blocked_requires_followup`, `repo_internal_reclassify_possible`, or recommendation-only state for that entry.
- Update the `--write` path in `tools/script-migration/audit-consumer-reachable-closure.cjs` so `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json` is written through the D010 same-directory draft, backup, SHA256, atomic promote, and readback protocol, not direct overwrite.
- Run the audit tool with `--write --pretty --quiet`.
- Write `classification-evidence.json` according to the D010 schema after the registry and closure audit are updated. It MUST include exactly the thirteen D001 entries, their `currentClassification`, `auditSemanticClassification`, `migrationStrategy`, `registryMigrationStrategy`, and evidence refs that point to `registry-evidence.json`, `classification-evidence.json`, or pre-evidence validator proof paths; it MUST NOT use D010 `evidence.json` as a registry validator evidence-ref target.
- Write `registry-evidence.json` according to the D010 legacy registry evidence schema after `classification-evidence.json` is written. It MUST include exactly the thirteen D001 entries, `result: passed` for each entry, target paths matching the Wave 3.11 registry entries, and a `commands` array for each entry. Each `commands` array MAY be empty; if it contains rows, every row MUST satisfy the legacy registry evidence command-row schema. D010 command evidence remains in `evidence.json` and MUST NOT be copied into registry `evidenceRefs`.
- Promote `repo-governance/script-migration-registry.yaml`, `audit-report.json`, `classification-evidence.json`, `registry-evidence.json`, and `safe-write-receipts.json` through D010 safe-write requirements.

Validation:

- `node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet` MUST exit `0`.
- `node tools/script-migration/validate-registry.cjs` MUST exit `0`.
- `classification-evidence.json` MUST parse and contain exactly the thirteen D001 entries with no follow-up-only or `repo_internal_reclassify_possible` current state.
- `registry-evidence.json` MUST parse, satisfy the legacy registry evidence schema, and be accepted by `node tools/script-migration/validate-registry.cjs` through every Wave 3.11 registry `evidenceRefs` reference.
- The Wave 3.11 registry wave MUST validate as fail-closed: `status: blocked` while any strict package source parity evidence is missing; package/runtime entries MUST remain `migrationStatus: blocked` and `validationStatus: partial`, and true repo-internal no-migration entries MAY be `validated/passed`.

Acceptance: ACC009, ACC010, ACC013.

### G010 Add Wave 3.11 Validators, Acceptance Test, And Install Matrix Runner

Purpose: Create deterministic gates for Wave 3.11 completion.

Files:

- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs`
- `tools/script-migration/main-agent-wave-3-11-evidence-utils.cjs`
- `tools/script-migration/write-main-agent-wave-3-11-evidence.cjs`
- `tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs`
- `tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts`
- `packages/bmad-speckit/src/commands/check.js`
- `packages/bmad-speckit/src/services/sync-service.js`
- `packages/bmad-speckit/tests/sync-service.test.js`
- `packages/bmad-speckit/tests/main-agent-build-dist.test.js`
- `packages/bmad-speckit/tests/main-agent-no-root-ts-dispatch.test.js`
- `packages/bmad-speckit/tests/main-agent-dist-no-root-ts-dispatch.test.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/tmp/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/safe-write-receipts.json`
- `.tmp/main-agent-runtime-migration-wave-3.11/**`
- `packages/bmad-speckit/node_modules/@bmad-speckit/**`
- `packages/bmad-speckit/node_modules/@bmad-speckit.staging/**`
- `packages/bmad-speckit/node_modules/@bmad-speckit.old/**`
- `packages/bmad-speckit/node_modules/.pack-session-count.json`
- `packages/bmad-speckit/node_modules/.pack-session.lock/**`
- `packages/bmad-speckit/node_modules/.prepublish-sync.lock/**`
- `packages/bmad-speckit/_bmad/**`
- `packages/bmad-speckit/_bmad.staging/**`
- `packages/bmad-speckit/_bmad.old/**`

The `repo-governance/**/install-matrix/**`, `repo-governance/**/tmp/**`, `.tmp/main-agent-runtime-migration-wave-3.11/**`, and package staging paths listed above are generated evidence/temp or install-surface staging surfaces only. Package runtime code MUST NOT depend on them after install-matrix cleanup.

Steps:

- Add `validate-main-agent-runtime-migration-wave-3-11.cjs` with three evidence modes.
- Add `main-agent-wave-3-11-evidence-utils.cjs` for shared D010 safe-write, SHA256, canonical hash, receipt index, and command-row capture helpers.
- Add `write-main-agent-wave-3-11-evidence.cjs` as the required evidence writer/harness. It MUST support `--prepare-pre-evidence`, `--init-evidence`, `--start-repair-round <roundId>`, `--run-command <commandId>`, `--write-root-script-proof`, `--write-summary`, `--mark-awaiting-final-validator`, `--write-unsealed-final-packet`, `--seal-final-packet`, and `--append-final-validator-row`.
- Repair the Codex install-surface path used by D008 `init-sync-consumer`: `sync-service.js` MUST deploy `.codex/i18n` from configured `bmadPath` `_bmad/i18n`, MUST deploy `.codex/README.md` without copying a full consumer-root `_bmad`, and `check.js` MUST validate BMADS runtime `_config` files from configured `bmadPath` when present, falling back to consumer-root `_bmad/_config` only when no `bmadPath` is configured.
- Add `packages/bmad-speckit/tests/sync-service.test.js` regression coverage for Codex `bmadPath` mode proving `.codex/i18n`, `.codex/README.md`, no consumer-root `_bmad`, and `check.js` runtime `_config` validation from `bmadPath`.
- `--pre-evidence` mode MUST validate registry entries, including fail-closed Wave 3.11 `status: blocked` for package/runtime entries that lack strict parity and `validated/passed` only for true repo-internal no-migration entries; target source files; target dist files; no-deletion flags; D006 exports in source/dist; mandatory G001/G009 artifacts (`preflight.json`, `source-inventory.json`, `no-migration-internal.json`, `classification-evidence.json`, `registry-evidence.json`, `audit-report.json`, `repo-governance/script-migration-registry.yaml`, and `safe-write-receipts.json`); mandatory per-entry `originalPathSha256` in `source-inventory.json`; validator-compatible `currentClassification` / `migrationStrategy` fields in classification artifacts; detailed safe-write receipt fields and required target coverage for G001/G009 artifacts; no root TypeScript imports in Wave 3.11 covered package surfaces; no `tsx`/`ts-node` dependency in covered package command/runtime/helper surfaces or install-matrix probes; no compiled fallback; exact source inventory; exact classification evidence; exact registry evidence; exact no-migration internal artifact; and Required Test Command coverage. This validator MUST NOT require G011/G012 artifacts and MUST NOT fail solely because unrelated repository-root dev scripts or root `package.json` dependencies still reference `tsx` or `ts-node`.
- `--evidence-running` mode MUST validate everything from `--pre-evidence` plus G011 `evidence.json` command rows completed so far, `install-matrix.json`, install-matrix receipts, D010 command-row ordering, D010 install row schemas, and safe-write promoted artifact hashes including `safe-write-receipts.json`. It MUST NOT require G012 `summary.md` or `final-evidence-packet.json`.
- `--final-acceptance` mode MUST validate everything needed by `cmd-test-wave-3-11-contract-final` after the packet is sealed while excluding both future self-referential rows: `cmd-test-wave-3-11-contract-final` and `cmd-validate-wave-3-11-final`.
- Default full mode MUST validate everything from `--evidence-running` plus `summary.md`, sealed immutable `final-evidence-packet.json`, final command rows completed before the validator invocation, D010 final packet hash fields, and final no-overclaim language.
- The validator MUST statically assert that `tools/script-migration/audit-consumer-reachable-closure.cjs --write` promotes `audit-report.json` through the D010 safe-write/receipt path and does not use direct `fs.writeFileSync(args.out, ...)` overwrite for that default audit report target.
- The validator MUST statically assert that `write-main-agent-wave-3-11-evidence.cjs` contains deterministic `--write-summary`, `--write-unsealed-final-packet`, and D010 safe-write handling for the final post-validator `evidence.json` mutation, and MUST fail if the writer direct-writes `evidence.json` through `fs.writeFileSync(repoPath(EVIDENCE_PATH), ...)`.
- The validator MUST validate `evidence.json` command rows by both `commandId` order and command text fragments from the Required Test Commands list. A row with the correct `commandId` but the wrong command text MUST fail validation.
- The final full validator MUST require `evidence.json.acceptanceStatus.ACC001` through `ACC012` to be `passed` and MUST mirror `final-evidence-packet.json` acceptance rows against `evidence.json` for `status`, `commandIds`, `evidenceRefs`, `notes`, and any `pendingCommandIds` / `reason` fields.
- The validator MUST expose these deterministic assertion subcommands so Required Test Commands do not use inline `node -e` or long inline PowerShell assertions: `--assert no-migration-internal-exact`, `--assert root-scripts-not-deleted`, `--assert public-cli-dispatch`, `--assert closure-audit-exact-wave-3-11`, `--assert eval-question-source-smoke`, and `--assert final-closeout-language`.
- `--assert closure-audit-exact-wave-3-11` MUST parse audit entries by exact original script path and compare each entry against the D001 expected audit semantic classification table. It MUST ignore historical fields such as `correctedFrom` when deciding whether the current Wave 3.11 entry is still `repo_internal_reclassify_possible`.
- `--assert root-scripts-not-deleted` MUST assert all thirteen Wave 3.11 original root script paths still exist at their original paths, none has deleted or rename/delete worktree status, `root-script-regression-proof.json` exists and satisfies the D010 schema, and any modified original root script has a `covered` proof entry with accepted command IDs and all four `preservedBehavior` flags set to `true`; otherwise it MUST report `root_script_behavior_regression_proof_missing:<scriptPath>`.
- `--assert eval-question-source-smoke` MUST run `packages/bmad-speckit/bin/bmad-speckit.js eval-question-generate --input repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/fixtures/coach-report.json --outputDir <guid-scoped-tmp> --version v1`, assert at least one generated question file, load the generated `manifest.yaml` through `loadManifest(versionDir)` from `@bmad-speckit/scoring/eval-questions/manifest-loader`, assert every loaded question entry has `id`, `title`, `path`, and an existing generated question file, and assert the output path stays under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/tmp/`.
- `--assert final-closeout-language` MUST parse `summary.md` and assert it states Wave 3.11 covers only the thirteen declared entries, states no root script deletion was performed, and does not contain a repository-wide or consumer-wide claim that all source repository scripts are directly callable in consumer projects.
- Add `run-main-agent-wave-3-11-install-matrix.cjs` to execute the D008 package CLI and direct-require probes from consumer install fixtures.
- Ensure the install matrix performs D008 explicit pre-pack workspace bundle preparation, packs `packages/bmad-speckit`, never the root `bmad-speckit-sdd-flow` package, records package/tarball metadata required by D008, then runs D008 cleanup, records `cleanupCommands`, and fails if any allowed package staging, `.staging`, `.old`, or lock surface remains.
- Ensure the install matrix records D008 current workspace scoring proof and fails when installed `@bmad-speckit/scoring/eval-questions/*` resolves to a stale registry package, workspace link, or repo source path.
- Ensure the install matrix implements `init-sync-consumer` exactly as specified in D008, including the installed package `_bmad` path, generated `bmad-speckit.json` assertion, `bmad-speckit check --json --ignore-agent-tools` assertion, and probe resolution from the temp consumer install.
- Ensure the install matrix writes `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json` and per-mode receipts under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix/`.
- Add `cmd-test-install-surface-regressions` to the Required Test Commands before `cmd-run-install-matrix`; it MUST run `npm run test --prefix packages/bmad-speckit -- sync-service.test.js` and MUST be required for ACC012.
- Add an acceptance test that selects validator mode from `MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE=pre-evidence|final-closeout`. Before G011 final artifacts exist it MUST run in `pre-evidence` mode. After G012 seals `final-evidence-packet.json`, it MUST run in `final-closeout` mode by invoking `validate-main-agent-runtime-migration-wave-3-11.cjs --final-acceptance` and MUST NOT require either the final acceptance command row or the final validator command row to already exist.

Validation:

- `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --pre-evidence` MUST exit `0`.
- `pwsh.exe -NoLogo -NoProfile -Command '& { $env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "pre-evidence"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code }'` MUST exit `0` before G011 final evidence artifacts exist.
- `npm run test --prefix packages/bmad-speckit -- sync-service.test.js` MUST exit `0` and prove Codex `bmadPath` install-surface sync/check behavior before install matrix execution.
- `node tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs` MUST exit `0` and record D008 package/tarball plus current workspace scoring proof.
- G010 completion MUST NOT require `evidence.json`; `--evidence-running` validation belongs to G011 after `evidence.json` is initialized and command rows are recorded.

Acceptance: ACC012, ACC013.

### G011 Run Required Commands And Write Evidence Artifact

Purpose: Capture command evidence for every G011 acceptance item without requiring G012 final artifacts.

Files:

- `tools/script-migration/write-main-agent-wave-3-11-evidence.cjs`
- `tools/script-migration/main-agent-wave-3-11-evidence-utils.cjs`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence-history/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/root-script-regression-proof.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/tmp/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/safe-write-receipts.json`

Steps:

- Initialize `evidence.json` with `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --init-evidence`; the artifact MUST contain `waveId`, `status: running`, empty `commandRows`, ACC001 through ACC014 `acceptanceStatus` entries initialized to `pending`, and MAN001 through MAN004 `manualVerificationStatus` entries initialized to `pending`.
- Initialize and update `evidence.json` through the writer's D010 safe-write read-modify-write promotions.
- Run every command listed under `G011 Evidence-Capture Commands` in declared order through `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --run-command <commandId>`.
- Treat the raw PowerShell blocks under `Required Test Commands` as writer-internal command specs. Executors MUST NOT run those raw commands directly as evidence; executor-visible evidence commands are only `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --run-command <commandId>` and `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row`.
- Append one command row to `evidence.json` immediately after each command completes through the writer. The writer MUST own stdout/stderr hashing, timestamps, sequence, attempt, status, manual scenario IDs, acceptance/manual status refresh, and `safe-write-receipts.json` updates.
- Include `commandId`, `sequence`, `attempt`, `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, `startedAt`, `completedAt`, and `status` for every command row.
- Include `manualScenarioIds` on the command rows that satisfy MAN001 through MAN004, and update the corresponding `manualVerificationStatus` entry only when the mapped command exits `0`.
- Include `installMatrixEvidence` with `usedRootScript`, `usedTsx`, `usedTsNode`, and `usedCompiledFallback` for covered consumer commands.
- Before running `cmd-assert-root-scripts-not-deleted`, write `root-script-regression-proof.json` with `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --write-root-script-proof`. Use G001 baseline hashes plus current git worktree status to set `contentChanged`; if any original root script has changed, this writer MUST stop with `root_script_behavior_regression_proof_missing:<scriptPath>` rather than fabricating behavior proof.
- Do not mark an entry as `result: passed` when any command row for that entry has nonzero `exitCode`.
- Do not run the default full validator in G011. G011 validation ends with `--evidence-running` only.

Validation:

- `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --evidence-running` MUST exit `0` after `evidence.json` and `install-matrix.json` are written.

Acceptance: ACC001, ACC011, ACC012, ACC013.

### G012 Write Summary And Final Closeout Evidence

Purpose: Produce narrow final closeout language and final encoding evidence, then run the final full validator last.

Files:

- `tools/script-migration/write-main-agent-wave-3-11-evidence.cjs`
- `tools/script-migration/main-agent-wave-3-11-evidence-utils.cjs`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/summary.md`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/final-evidence-packet.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/safe-write-receipts.json`

Steps:

- Write `summary.md` with migrated entries, retained legacy entries, true no-migration entries within this contract inventory, recorded validation commands, planned final closeout commands that are still pending at summary seal time, and residual risks by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --write-summary`.
- State that Wave 3.11 covers only its thirteen declared entries.
- State that Wave 3.11 does not prove every source repository script is directly callable in a consumer project.
- State that no root script deletion was performed.
- Promote `summary.md` through D010 safe-write requirements.
- Run `cmd-assert-final-closeout-language` immediately after `summary.md` is promoted.
- Append the `cmd-assert-final-closeout-language` command row by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --run-command cmd-assert-final-closeout-language`; the writer MUST include `manualScenarioIds: ["MAN004"]` and set `manualVerificationStatus.MAN004` to `passed` only when that command exits `0`.
- Set `evidence.json` to `status: awaiting_final_validator_self_receipt` and set ACC013/ACC014 to `self_excluded` before any final packet is written by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --mark-awaiting-final-validator`.
- Write `final-evidence-packet.json` initially as an unsealed draft by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --write-unsealed-final-packet`; the unsealed packet MUST have `status: running`, `sealed: false`, `sealedAt: null`, `sealHash: null`, `sealedEvidenceJsonHash: null`, ACC001 through ACC014 `acceptanceStatus`, and MAN001 through MAN004 `manualVerificationStatus`.
- Promote the unsealed packet through D010 safe-write requirements.
- Run `cmd-encoding-final` first.
- Append the final encoding gate command row by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --run-command cmd-encoding-final`.
- Seal `final-evidence-packet.json` after the final encoding row is present by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --seal-final-packet`; the writer MUST compute D010 `sealHash`, set `sealed: true`, set `sealedAt`, and promote the sealed packet through D010 safe-write requirements.
- Run `cmd-test-wave-3-11-contract-final` after the packet is sealed. This command uses `MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE=final-closeout` and MUST NOT require the final validator command row.
- Append the final acceptance command row by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --run-command cmd-test-wave-3-11-contract-final`.
- Run and append `cmd-validate-wave-3-11-final` last by running `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row`. This writer command MUST execute the final validator exactly once, append the final validator row, set `status: passed` only when the validator exits `0`, and set `completedAt`. These are the only permitted post-validator mutations, MUST NOT update `safe-write-receipts.json`, MUST match the D010 self-exclusion contract, and MUST be reported with the post-validator `evidence.json` SHA256 in the final human response.
- Do not modify `final-evidence-packet.json` after it is sealed.

Validation:

- `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert final-closeout-language` MUST exit `0` after `summary.md` is promoted and before the unsealed packet is written.
- `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` MUST exit `0` before the packet is sealed.
- `pwsh.exe -NoLogo -NoProfile -Command '& { $env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "final-closeout"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code }'` MUST exit `0` after the packet is sealed and before the final full validator runs.
- The raw validator invocation executed internally by `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row` MUST exit `0` after the packet is sealed, the final acceptance row is recorded, and `evidence.json` is in `status: awaiting_final_validator_self_receipt`; executors MUST NOT run the raw validator as a separate validation step.

Acceptance: ACC013, ACC014.

## Strict Acceptance Checklist

Every checkbox must have direct command or artifact evidence before completion is claimed. ACC013 and ACC014 final self-reference evidence follows the D010 two-layer proof: sealed artifacts keep ACC013/ACC014 as `self_excluded`, while the final acceptance row, final validator row, and final human response prove final completion.

- [ ] ACC001: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/preflight.json` exists, records `waveId: main-agent-runtime-migration-wave-3.11`, records git status plus encoding gate command rows with `exitCode: 0`, and `source-inventory.json` contains exactly the thirteen D001 original paths with strategies matching the D001 semantic-to-registry mapping.
- [ ] ACC002: The four runtime module source files and four runtime module dist files listed in D002 exist after `npm run build:main-agent-dist` exits `0`.
- [ ] ACC003: `packages/bmad-speckit/tests/main-agent-wave-3-11-runtime-modules.test.js` passes, imports no root `scripts/*.ts` file, asserts every D006 runtime export exists, executes every pure or fixture-backed runtime function export, and includes required negative/error-path assertions.
- [ ] ACC004: The seven listed acceptance tests in G003 pass after their runtime-contract imports are switched to package runtime modules.
- [ ] ACC005: The five helper source files and five helper dist files listed in D003 exist, and `packages/bmad-speckit/tests/main-agent-wave-3-11-helpers.test.js` passes while asserting every D006 helper export exists, executing every pure or fixture-backed helper function export, and including required negative/error-path assertions.
- [ ] ACC006: `bmad-speckit eval-question-generate` exists as a package CLI command, loads `packages/bmad-speckit/src/commands/eval-question-generate.js`, creates eval question output from a fixture coach report in source-tree smoke, loads generated `manifest.yaml` through `loadManifest(versionDir)`, and creates eval question output plus a loadable `manifest.yaml` from an installed consumer fixture without executing `scripts/eval-question-generate.ts` while resolving current workspace-derived `@bmad-speckit/scoring/eval-questions/*`. This ACC006 installed consumer proof is limited to `--input`; `--run-id` is retained compatibility scope only and package-command fail-closed tests must prove the controlled `SCORING_DATA_PATH=<empty-dir> --run-id wave-3-11-missing-run` case exits nonzero with `EVAL_QUESTION_RUN_ID_UNRESOLVED`.
- [ ] ACC007: `bmad-speckit check-score` remains wired to `packages/bmad-speckit/src/commands/check-score.js`, and `scripts/check-story-score-written.ts` is recorded as retained legacy root public CLI replaced.
- [ ] ACC008: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/no-migration-internal.json` contains exactly `scripts/create-second-story.ts` and `scripts/verify-score-auto-scoped-bundle.cjs` with validator-compatible `currentClassification` values.
- [ ] ACC009: `repo-governance/script-migration-registry.yaml` contains a Wave 3.11 registry wave with exactly thirteen entries, `refinesWaveId: main-agent-runtime-migration-wave-3.10`, wave `status: blocked` while strict package parity is missing, package/runtime entry `migrationStatus: blocked`, package/runtime entry `validationStatus: partial`, true repo-internal no-migration entries `validated/passed`, `deletionAllowed: false`, and `deletionApprovalRef: null` on every entry; every Wave 3.11 entry references `registry-evidence.json`; `registry-evidence.json` satisfies the fail-closed registry evidence schema with the same thirteen entries; and `classification-evidence.json` records the same thirteen entries with D010 schema fields.
- [ ] ACC010: `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json` classifies all thirteen Wave 3.11 entries exactly according to the D001 expected audit semantic classification table, `classification-evidence.json` mirrors those current classifications, and no current Wave 3.11 entry remains classified as `repo_internal_reclassify_possible` or any follow-up-only state.
- [ ] ACC011: Package build and package tests pass through `npm run build:scoring`, the scoring eval-question regression command, `npm run build:main-agent-dist`, the existing package build/dispatch regression command, and the four Wave 3.11 package test commands.
- [ ] ACC012: `npm run test --prefix packages/bmad-speckit -- sync-service.test.js` exits `0` before the install matrix and proves Codex `bmadPath` install-surface sync/check behavior; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json` satisfies the D010 schema, contains every D008 required mode and row including the exact `init-sync-consumer` mode, records `prepackPrepCommands` and `cleanupCommands` with successful exit codes, proves every explicit package staging, `.staging`, `.old`, and lock surface is absent after cleanup, every applicable row records `usedRootScript: false`, `usedTsx: false`, `usedTsNode: false`, and `usedCompiledFallback: false`, and `IM003` records current workspace-derived scoring package resolution plus manifest-loader proof.
- [ ] ACC013: `node tools/script-migration/validate-registry.cjs`, `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --pre-evidence`, `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --evidence-running`, final `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row`, `node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet`, and both pre-evidence and final `npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts` runs exit `0`; the raw final validator command appears only as the command text recorded internally by `--append-final-validator-row`; sealed artifacts keep ACC013 as `self_excluded` and final completion is proven by the D010 two-layer proof.
- [ ] ACC014: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/summary.md` uses narrow Wave 3.11 language, states no root script deletion, does not claim that all source repository scripts are directly callable in consumer projects, `cmd-assert-final-closeout-language` exits `0`, and `final-evidence-packet.json` is D010-valid, sealed, hash-verified, and unmodified after sealing; sealed artifacts keep ACC014 as `self_excluded` and final completion is proven by the D010 two-layer proof.

## Acceptance Traceability Matrix

| Acceptance ID | Task IDs | Evidence Command Or Artifact | Pass Condition |
| --- | --- | --- | --- |
| ACC001 | G001, G011 | `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/preflight.json`; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/source-inventory.json`; `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` | Artifacts exist, D010 schemas pass, source inventory has exactly thirteen D001 entries, and git status plus encoding command rows exit `0`. |
| ACC002 | G002 | `npm run build:main-agent-dist`; runtime source and dist paths in D002 | Command exits `0` and all eight paths exist. |
| ACC003 | G003 | `npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-runtime-modules.test.js` | Command exits `0`, test source contains no root script import, every D006 runtime export is asserted, every pure or fixture-backed runtime function export is executed, and required negative/error-path assertions pass. |
| ACC004 | G003 | `npx vitest run tests/acceptance/main-agent-host-runtime-mode.test.ts tests/acceptance/main-agent-supervised-worker-timeout.test.ts tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts tests/acceptance/main-agent-delivery-truth-gate.test.ts tests/acceptance/main-agent-pr-topology.test.ts tests/acceptance/main-agent-parallel-locking.test.ts tests/acceptance/parallel-mission-evidence-integration.test.ts` | Command exits `0`. |
| ACC005 | G004, G005 | `npm run build:main-agent-dist`; `npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-helpers.test.js` | Commands exit `0`, all helper dist paths exist, every D006 helper export is asserted, every pure or fixture-backed helper function export is executed, and required negative/error-path assertions pass. |
| ACC006 | G006, G010, G011 | Scoring eval-question regression command; `npm run test --prefix packages/bmad-speckit -- eval-question-generate-command.test.js`; source-tree eval generation smoke; D008 install-matrix `IM003` | Commands exit `0`, generated eval question files exist, generated `manifest.yaml` loads through `loadManifest(versionDir)`, installed package row records all four false flags, installed scoring eval-question exports resolve from the current workspace-derived package, `--input` is the only installed consumer proof path, and the controlled `--run-id wave-3-11-missing-run` fail-closed assertion exits nonzero with `EVAL_QUESTION_RUN_ID_UNRESOLVED`. |
| ACC007 | G007, G009 | `npm run test --prefix packages/bmad-speckit -- check-score-command.test.js`; `repo-governance/script-migration-registry.yaml` | Test exits `0` and registry records retained legacy root public CLI replaced. |
| ACC008 | G008 | `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/no-migration-internal.json` | Artifact has exactly two entries with declared validator-compatible `currentClassification` values. |
| ACC009 | G009 | `node tools/script-migration/validate-registry.cjs`; `repo-governance/script-migration-registry.yaml`; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/registry-evidence.json`; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/classification-evidence.json` | Command exits `0`, Wave 3.11 has exactly thirteen entries with wave `status: blocked` while strict package parity is missing, package/runtime entries `migrationStatus: blocked` and `validationStatus: partial`, true repo-internal entries `validated/passed`, every Wave 3.11 entry references registry-compatible `registry-evidence.json`, registry evidence satisfies the fail-closed validator schema for the same thirteen entries, and classification evidence satisfies D010 schema for the same thirteen entries. |
| ACC010 | G009, G011 | `node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet`; `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json`; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/classification-evidence.json`; `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert closure-audit-exact-wave-3-11` | Commands exit `0`, all thirteen current audit semantic classifications match the D001 expected audit semantic classification table, classification evidence mirrors those classifications, and no entry has follow-up-only state. |
| ACC011 | G002, G003, G004, G005, G006, G007, G011 | Package build, scoring eval-question regression command, existing package build/dispatch regression command, and four Wave 3.11 package test commands in Required Test Commands | Commands exit `0`. |
| ACC012 | G006, G010, G011 | `npm run test --prefix packages/bmad-speckit -- sync-service.test.js`; `node tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs`; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json`; D008 rows | Sync-service regression command exits `0` and proves Codex `bmadPath` mode deploys `.codex/i18n`, deploys `.codex/README.md`, does not copy consumer-root `_bmad`, and validates runtime `_config` from `bmadPath`; install matrix command exits `0`, D010 install schema passes, every required mode/row exists including exact `init-sync-consumer`, `prepackPrepCommands` and `cleanupCommands` rows exit `0`, every explicit package staging, `.staging`, `.old`, and lock surface is absent after cleanup, every applicable row records all four false flags, IM003 records current workspace-derived scoring package resolution proof, and generated manifests load through installed `loadManifest(versionDir)`. |
| ACC013 | G009, G010, G011, G012 | Registry, closure audit, Wave 3.11 pre-evidence validator, evidence-running validator, final full validator, and pre-evidence/final acceptance commands in Required Test Commands | Commands exit `0`; sealed artifacts keep ACC013 as `self_excluded`; final completion is proven by the final acceptance command row, final validator command row, and final human response. |
| ACC014 | G012 | `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/summary.md`; `cmd-assert-final-closeout-language`; `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/final-evidence-packet.json`; final validator | Summary and packet exist, summary contains narrow Wave 3.11 completion language, assertion exits `0`, packet satisfies D010 sealed schema, final validator validates the sealed packet, packet remains unmodified after sealing, and sealed artifacts keep ACC014 as `self_excluded`. |

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment. The raw PowerShell blocks below are writer-internal command specs that define expected command text and pass conditions; they are not executor-visible evidence commands. To produce evidence, run the matching writer wrapper for each `commandId`.

### G011 Evidence-Capture Commands

G011 MUST run these command specs in this order through the writer and append a command row to `evidence.json` after each command. These writer-internal command specs are written for PowerShell 7. They use single-quoted outer `-Command '& { ... }'` blocks so variables are interpreted by the invoked PowerShell process, not by the caller shell.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { git status --short --branch; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-git-status-baseline`. Expected pass condition: command exits `0` and output is captured in `evidence.json`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-encoding-pre-implementation`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run build:scoring; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-build-scoring`. Expected pass condition: command exits `0` and produces required scoring dist exports for the mandatory eval-question modules.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npx vitest run packages/scoring/eval-questions/__tests__/template-generator.test.ts packages/scoring/eval-questions/__tests__/manifest-loader.test.ts packages/scoring/eval-questions/__tests__/run-core.test.ts packages/scoring/eval-questions/__tests__/cli-integration.test.ts packages/scoring/__tests__/e2e/eval-question-flow.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-scoring-eval-questions`. Expected pass condition: command exits `0` and covers the existing eval-question template generator, manifest loader, run core, CLI integration, and end-to-end scoring flow regressions.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run build:main-agent-dist; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-build-main-agent-dist`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- main-agent-build-dist.test.js main-agent-no-root-ts-dispatch.test.js main-agent-dist-no-root-ts-dispatch.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-package-build-dispatch-regressions`. Expected pass condition: command exits `0` and covers the existing main-agent dist build, package CLI no-root-TypeScript dispatch, and dist no-root-TypeScript dispatch regressions.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-runtime-modules.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-runtime-modules`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-helpers.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-helpers`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- eval-question-generate-command.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-eval-question-generate`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- check-score-command.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-check-score`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert eval-question-source-smoke; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-smoke-eval-question-generate-source-tree`. Expected pass condition: command exits `0` after the checked-in validator assertion creates a GUID-scoped output directory, runs the source-tree package CLI, asserts at least one generated question file, loads the generated `manifest.yaml` through `loadManifest(versionDir)`, and asserts every loaded question entry has `id`, `title`, `path`, and an existing generated question file under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/tmp/eval-questions-*/`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npx vitest run tests/acceptance/main-agent-host-runtime-mode.test.ts tests/acceptance/main-agent-supervised-worker-timeout.test.ts tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts tests/acceptance/main-agent-delivery-truth-gate.test.ts tests/acceptance/main-agent-pr-topology.test.ts tests/acceptance/main-agent-parallel-locking.test.ts tests/acceptance/parallel-mission-evidence-integration.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-runtime-acceptance-import-switches`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-closure-audit-write`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-registry.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-validate-registry`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert no-migration-internal-exact; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-assert-no-migration-internal-exact`. Expected pass condition: command exits `0` and `no-migration-internal.json` contains exactly the two D001 no-migration entries with exact semantic classifications.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert root-scripts-not-deleted; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-assert-root-scripts-not-deleted`. Expected pass condition: command exits `0`, all thirteen Wave 3.11 original root script paths still exist at their original paths, no original root script has deleted or rename/delete worktree status, `root-script-regression-proof.json` satisfies D010 schema, and any modified original root script has a `covered` proof entry with accepted command IDs plus `preservedBehavior.arguments`, `preservedBehavior.outputShape`, `preservedBehavior.exitCodeSemantics`, and `preservedBehavior.errorNames` all set to `true`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert public-cli-dispatch; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-assert-public-cli-dispatch`. Expected pass condition: command exits `0` and package CLI dispatch maps `eval-question-generate` and `check-score` to package command modules.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert closure-audit-exact-wave-3-11; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-assert-closure-audit-exact-wave-3-11`. Expected pass condition: command exits `0` and every current Wave 3.11 audit entry matches the D001 expected audit semantic classification table.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --pre-evidence; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-validate-wave-3-11-pre-evidence`. Expected pass condition: command exits `0`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { $env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "pre-evidence"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code }'
```

Command ID: `cmd-test-wave-3-11-contract-pre-evidence`. Expected pass condition: command exits `0` before G012 artifacts exist.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- sync-service.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-test-install-surface-regressions`. Expected pass condition: command exits `0` and proves Codex `bmadPath` mode deploys `.codex/i18n`, deploys `.codex/README.md`, does not copy consumer-root `_bmad`, and `check.js` validates BMADS runtime `_config` files from configured `bmadPath`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-run-install-matrix`. Expected pass condition: command exits `0`, writes `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json`, records `packageCwd: packages/bmad-speckit`, records current workspace-derived scoring proof for IM003, records successful D008 cleanup rows, proves every explicit package staging, `.staging`, `.old`, and lock surface is absent after cleanup, and every D008 applicable row records all four false flags.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --evidence-running; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-validate-wave-3-11-evidence-running`. Expected pass condition: command exits `0` while not requiring G012 `summary.md` or `final-evidence-packet.json`.

### G012 Final Closeout Commands

G012 MUST write and promote `summary.md` with `--write-summary` before these commands. It MUST run `cmd-assert-final-closeout-language` first, append that command row with `manualScenarioIds: ["MAN004"]`, run `--mark-awaiting-final-validator`, write and promote the unsealed `final-evidence-packet.json` with `--write-unsealed-final-packet`, run final encoding, append the final encoding row, seal the packet, run final acceptance against the sealed packet, append the final acceptance row, and run plus append the final validator row through `--append-final-validator-row` last.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert final-closeout-language; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-assert-final-closeout-language`. Expected pass condition: command exits `0`, `summary.md` states Wave 3.11 covers only the thirteen declared entries, states no root script deletion was performed, and contains no repository-wide or consumer-wide claim that all source repository scripts are directly callable in consumer projects. This row MUST include `manualScenarioIds: ["MAN004"]`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-encoding-final`. Expected pass condition: command exits `0`; append this row after `cmd-assert-final-closeout-language`, after the unsealed packet draft exists, before sealing `final-evidence-packet.json`, and before running `cmd-test-wave-3-11-contract-final`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { $env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "final-closeout"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code }'
```

Command ID: `cmd-test-wave-3-11-contract-final`. Expected pass condition: command exits `0` after the packet is sealed and before `cmd-validate-wave-3-11-final`; it MUST invoke `--final-acceptance` through the acceptance test and MUST NOT require the final acceptance command row or final validator command row to already exist.

```powershell
pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
```

Command ID: `cmd-validate-wave-3-11-final`. Expected evidence-row command text: the writer-internal direct validator command shown above. Expected pass condition: the direct validator exits `0` when invoked internally by `--append-final-validator-row`, validating `summary.md`, sealed `final-evidence-packet.json`, `evidence.json` in `status: awaiting_final_validator_self_receipt`, install-matrix receipts, final encoding evidence, final acceptance evidence, every command row completed before the validator invocation, and the D010 self-exclusion contract for appending this validator row after the invocation returns.

Executor-visible invocation: `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row`. Execution rule: do not run the raw validator as a separate shell step. The command row recorded in `evidence.json` MUST contain the raw validator command text `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs`; the writer wrapper is the only allowed executor command for appending `cmd-validate-wave-3-11-final`.

## Manual Verification Scenarios

Produce explicit command evidence for every scenario. MAN001 through MAN004 are mandatory evidence checks and MUST be recorded in `evidence.json` command rows and mirrored into `final-evidence-packet.json`. Prose-only inspection is not acceptable evidence.

- MAN001: Verified by `cmd-assert-root-scripts-not-deleted`. Pass condition is that the command exits `0`, all thirteen original paths exist, none has deleted or rename/delete worktree status, and every modified original root script is covered by `root-script-regression-proof.json` with accepted command IDs and all required preserved-behavior flags. The command row MUST include `manualScenarioIds: ["MAN001"]`.
- MAN002: Verified by `cmd-assert-public-cli-dispatch`. Pass condition is that the command exits `0`, `eval-question-generate` dispatches to `packages/bmad-speckit/src/commands/eval-question-generate.js`, and `check-score` dispatches to `packages/bmad-speckit/src/commands/check-score.js`. The command row MUST include `manualScenarioIds: ["MAN002"]`.
- MAN003: Verified by `cmd-assert-closure-audit-exact-wave-3-11`. Pass condition is that the command exits `0`, the thirteen current Wave 3.11 entries match the D001 expected audit semantic classification table, and no current entry remains `repo_internal_reclassify_possible` or follow-up-only. The command row MUST include `manualScenarioIds: ["MAN003"]`.
- MAN004: Verified by `cmd-assert-final-closeout-language`. Pass condition is that the command exits `0`, `summary.md` states Wave 3.11 covers only the thirteen declared entries, states no root script deletion, and contains no direct-consumer-execution overclaim. The command row MUST include `manualScenarioIds: ["MAN004"]` before `final-evidence-packet.json` is sealed.

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

- `EVD001`: Provide the absolute path to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/evidence.json`.
- `EVD002`: Provide the absolute path to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/summary.md`.
- `EVD003`: Provide the absolute path to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/install-matrix.json`.
- `EVD004`: Provide the absolute path to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.11/final-evidence-packet.json`.
- `EVD005`: Provide the command list with exit codes from `evidence.json`, including G011 evidence-capture commands and G012 final closeout commands.
- `EVD006`: Provide install-matrix rows with `usedRootScript: false`, `usedTsx: false`, `usedTsNode: false`, and `usedCompiledFallback: false`.
- `EVD007`: Provide registry validator exit code and closure audit exit code.
- `EVD008`: Provide package build and package test exit codes.
- `EVD009`: Provide acceptance test exit codes.
- `EVD010`: Provide final encoding gate exit code.
- `EVD011`: Provide no-deletion evidence for all thirteen original root paths.
- `EVD012`: Provide residual risks, or provide `none` when ACC001 through ACC012 pass with direct command evidence and ACC013 through ACC014 satisfy the D010 two-layer self-exclusion proof with final acceptance and final validator exit codes reported in the final human response.

## Stop Conditions

- Stop with `contract_amendment_required` when any section from `Contract Completeness Gate` is missing.
- Stop with `scope_amendment_required` when implementation requires writes outside the files or directories named in G001 through G012.
- Stop with `semantic_decision_required` when an original root script has behavior that cannot be ported without changing observable outputs.
- Stop with `validation_contract_required` when a required command cannot run and no earlier task in this contract creates that command.
- Stop with `shell_command_not_copy_paste_runnable` when a Required Test Command needs fragile nested quoting, inline `node -e`, or caller-shell variable expansion to work.
- Stop with `required_command_failed:<commandId>` when any Required Test Command fails twice or cannot be repaired within G001-G012 scope. After this stop, the active `evidence.json` is a blocked execution round; continuing requires `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --start-repair-round <roundId>` or an explicit contract amendment, and the executor MUST NOT append a third ordinary attempt for the same command in the same active `evidence.json`.
- Stop with `sealed_final_command_failed:<commandId>` when `cmd-test-wave-3-11-contract-final` or `cmd-validate-wave-3-11-final` fails after `final-evidence-packet.json` is sealed; append the failed command row to `evidence.json`, do not modify the sealed packet, and do not attempt same-run repair.
- Stop with `root_script_deletion_forbidden` when a task requires deleting, moving, or renaming any root `scripts/*` file.
- Stop with `consumer_root_ts_dependency_forbidden` when a covered package CLI, package runtime module, package helper, package test, or install-matrix command imports or executes root `scripts/*.ts`.
- Stop with `tsx_ts_node_dependency_forbidden` when a covered consumer command requires `tsx` or `ts-node`.
- Stop with `compiled_fallback_claim_forbidden` when a covered Wave 3.11 command uses compiled fallback and the implementation attempts to record `usedCompiledFallback: false`.
- Stop with `registry_validation_failed` when `node tools/script-migration/validate-registry.cjs` exits nonzero after one repair attempt.
- Stop with `closure_audit_validation_failed` when `node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet` exits nonzero after one repair attempt.
- Stop with `blocked_by_contract_ambiguity:scoring_eval_exports` when `packages/scoring/package.json` cannot expose the eval-question modules required by `packages/bmad-speckit/src/commands/eval-question-generate.js` without changing the scoring package build contract.
- Stop with `blocked_by_contract_ambiguity:install_matrix_command_surface` when the install matrix cannot execute any D008 required package CLI or package runtime row for a covered migrated entry.
- Stop with `install_matrix_wrong_package_source` when the install matrix packs or installs the root `bmad-speckit-sdd-flow` package instead of `packages/bmad-speckit` for Wave 3.11 consumer probes.
- Stop with `install_matrix_stale_scoring_dependency` when IM003 resolves `@bmad-speckit/scoring/eval-questions/*` from a stale registry package, repo source path, workspace link, or any installed package whose hashes do not match the current workspace scoring build.
- Stop with `safe_write_protocol_required` when a generated large text artifact cannot be promoted through the repository Large File Safe Write Protocol.
