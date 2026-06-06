# Goal Execution Contract

<!-- goal-slot:frontMatter required dynamic=frontMatter -->
---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:b67ad6fb7f8c3ea903f03c5b51331fd530252ece0d9b629bf8c11ee93d5c4b70
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md
sourcePlanHash: sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af
runtimeRecordId: main-agent-runtime-migration-wave-3.12
entryFlow: full_physical_script_closure_migration_wave_3_12
taskRange: G001-G012
acceptanceRange: ACC001-ACC014
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: execute_declared_tasks_only_and_stop_on_scope_semantic_or_validation_gap
stopPolicy: stop_on_contract_gap_scope_expansion_root_script_deletion_consumer_root_ts_dependency_tsx_ts_node_dependency_compiled_fallback_claim_registry_gap_or_unresolved_script_semantics
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-06T12:55:00+08:00
---
<!-- /goal-slot:frontMatter -->

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

<!-- goal-slot:goalEntry required dynamic=goalEntry -->
```text
/goal docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md
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
- `Non-Goals / Explicit Non-Claims`
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

- On Windows, use `pwsh.exe -NoLogo -NoProfile -Command` for shell commands that require a shell; package wrapper scripts MUST either spawn commands with argv arrays and `shell=false` or explicitly invoke `pwsh.exe -NoLogo -NoProfile -Command` instead of relying on Node's implicit Windows shell.
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

<!-- goal-slot:authorityModel required dynamic=authorityModel -->
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md` is the human summary source for this Wave 3.12 execution contract.
- `sourcePlanHash=sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af` binds this contract to the source summary content that declared 240 physical scripts, 129 new registrations, 102 planned pending migration records, and 27 validated non-migration records.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/full-physical-script-closure-audit.json` is the machine-readable audit input for the 102-item migration queue, category counts, target paths, and validated non-migration records.
- `repo-governance/script-migration-registry.yaml` is the machine-readable migration registry authority for original paths, migration strategies, target paths, caller switch status, validation status, evidence refs, deletion approval fields, and the Wave 3.12 `contractPath` after G010 finalization.
- The registry Wave 3.12 `contractPath` currently identifies the full physical closure audit contract; this document is the runtime migration execution contract, and G010 MUST set Wave 3.12 `contractPath` to `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md` before final completion.
- The previous audit contract path `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md` MUST remain recorded in `evidence.json.auditContractPath` and the Wave 3.12 summary after G010 and G011.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json` is the per-script execution ledger artifact that G001 MUST produce before migration edits.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/scope-baseline.json` is the dirty-worktree baseline artifact that G001 MUST capture before migration edits so scope validation can distinguish pre-existing unrelated changes from Wave 3.12 writes.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-command-evidence.json` is the package build/test wrapper evidence artifact that G007 MUST produce before G009 writes the final evidence packet.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json` is the command evidence artifact that G009 MUST create after build and install validation commands run and that G010 MUST append with registry-finalization evidence.
- `migration-ledger.json` and `evidence.json` MUST use `sourcePlanPath` and `sourcePlanHash` only for `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md` and `sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af`; they MUST use `executionContractPath` and `executionContractHash` for this frozen goal contract.
- `executionContractPath` MUST equal `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md`; `executionContractHash` MUST be calculated from the current bytes of that file after any approved contract-review repair and recorded before G003 starts.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md` is the human projection that G011 MUST update after registry and evidence updates.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json` is the large-document and governance-artifact write receipt authority for `repo-governance/script-migration-registry.yaml`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md`, and any large Markdown/YAML/JSON artifact promoted during this wave.
- `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` is the controlled writer surface that G001 MUST create or update before promoting `migration-ledger.json` or `scope-baseline.json`.
- `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs`, `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts`, `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs`, and the completed `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` are controlled validation and writer surfaces that G002 MUST create or verify before any G003-G012 task invokes them.
- `packages/bmad-speckit/src/main-agent/actions/**` is the package source authority for records whose migration strategy is `package_runtime_module`.
- `packages/bmad-speckit/src/main-agent/helpers/**` is the package source authority for records whose migration strategy is `durable_helper_copy` and whose target path is under `packages/bmad-speckit/src/main-agent/helpers/`.
- `packages/bmad-speckit/src/commands/**` and `packages/bmad-speckit/bin/bmad-speckit.js` are the package source authority for records whose migration strategy is `public_cli_de_surface`.
- A package target path outside `packages/bmad-speckit/**` is package source authority only for ledger rows whose `targetPaths` field names that path.
- `packages/bmad-speckit/dist/**` and workspace `dist/**` directories are consumer runtime outputs after build commands run.
- model_packet.json is the machine-readable execution authority only when a generated Main Agent execution packet exists for this contract.
- goal_execution.md is not execution authority; this Markdown document is the frozen `/goal` contract and must not be rewritten by `/goal` during execution.
- `/goal completion is not closeout proof`; closeout proof requires ledger rows for 102 queue entries, registry updates, evidence artifacts, package/runtime tests, install-surface proof, final encoding gate, and no root-script deletion evidence.
<!-- /goal-slot:authorityModel -->

## Root Cause To Fix

<!-- goal-slot:rootCause required dynamic=rootCause -->
Wave 3.12 closed the registry visibility gap for the physical `scripts/` universe. The audit established that `rg --files scripts` contains 240 files, that 129 physical scripts were previously unregistered, and that registry coverage is now 240 registered scripts with 0 unregistered scripts. The same audit did not complete runtime migration for the 102 records whose status remains `planned/pending`.

The remaining defect is the package-consumer execution gap for the 102 queue entries. Those entries are classified as `consumer_runtime_reachable`, `package_runtime_helper`, or `public_cli`, and each entry needs package source authority, consumer runtime output, caller-switch proof, registry validation, and evidence that the installed package does not dispatch to any original root `scripts/**` queue path. TypeScript root scripts, `tsx`, and `ts-node` are separate hazards that require explicit false evidence.

The 27 `validated/passed` records are frozen as non-queue records for this contract. The 9 Ralph entries are package runtime helper aliases, `scripts/bmad-speckit-cli.js` is a root package bin compatibility alias, the 4 i18n entries are source generation and bilingual Skill maintenance tooling, and 13 records are evidence-backed repo internal, fixture, documentation, or test harness records. This contract MUST NOT reinterpret those 27 records as completed runtime migrations.
<!-- /goal-slot:rootCause -->

## Non-Goals / Explicit Non-Claims

- This contract does not migrate the 27 validated non-queue records and does not reinterpret them as completed runtime migrations.
- This contract does not delete, move, rename, or deletion-approve any root `scripts/**` file.
- This contract does not claim that all 240 physical root scripts are directly executable from consumer projects.
- This contract does not claim that every source repository script is a public CLI, package runtime action, or package runtime helper.
- This contract does not allow compiled fallback, root TypeScript execution, `tsx`, or `ts-node` to prove completion for any covered Wave 3.12 queue entry.
- This contract treats the 4 source-generation i18n bilingual tooling records, the 9 Ralph compatibility aliases, and the 13 evidence-backed repo internal, fixture, documentation, and test harness records as frozen only for this execution contract.
- This contract does not allow `/goal` to migrate a frozen non-queue record, reclassify a frozen non-queue record, or claim a frozen non-queue record is consumer runtime migrated without a contract amendment.

## Domain-Specific Contract Addenda

Use this section to bind any domain-specific classifier, state machine, schema, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, or other machine contract.

<!-- goal-slot:domainAddenda required dynamic=domainAddenda -->
### D001 physical script universe addendum

- `rg --files scripts` MUST return exactly 240 paths before completion is claimed.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/full-physical-script-closure-audit.json` MUST report `physicalScriptsTotal` equal to `240`.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/full-physical-script-closure-audit.json` MUST report `currentRegistryCoverage.unregistered` equal to `0`.
- The Wave 3.12 queue hash MUST equal `sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea` for the 102 original paths unless this contract is amended.

### D002 queue classification addendum

- The execution queue MUST contain exactly 102 entries before migration edits begin.
- The execution queue MUST contain exactly 28 entries with `originalClassBeforeMigration=consumer_runtime_reachable`.
- The execution queue MUST contain exactly 65 entries with `originalClassBeforeMigration=package_runtime_helper`.
- The execution queue MUST contain exactly 9 entries with `originalClassBeforeMigration=public_cli`.
- Every queue entry MUST have `migrationStatus=planned` and `validationStatus=pending` before the task that migrates the entry starts.
- Every queue entry MUST have `deletionAllowed=false` before and after migration.
- Every queue entry MUST retain the original root script path unless a separate user-approved deletion contract is supplied.
- Every ledger entry MUST include `callerSwitchPlan`, `runnerApi`, `cliProbeCommand`, `buildCopyPlan`, `testPaths`, `workspacePackage`, `targetExistenceProof`, `rootScriptDependencyForbidden`, and `smokeProbe` before G003 starts.
- `callerSwitchPlan` MUST be an array. Each item MUST include non-empty `targetPath`, `action`, `status`, and `proofCommandIds` fields. Empty arrays are allowed only when `callerSwitchStatus=not_applicable` and `callerSwitchNotApplicableReason` is non-empty.
- `runnerApi` MUST be an object with non-empty `moduleFormat`, `exportName`, `cwdPolicy`, `argumentPolicy`, `stdoutPolicy`, `stderrPolicy`, and `exitCodePolicy` fields.
- `cliProbeCommand` MUST be `null` only for entries with no public or installed command probe. Non-null values MUST include `command`, `cwd`, `expectedExitCode`, and `provesCommandAvailability`.
- `buildCopyPlan` MUST be an array. Each item MUST include non-empty `sourcePath`, `targetPath`, and `copyCommandId` fields. Empty arrays are allowed only when the target workspace package has no build copy step and `buildCopyNotApplicableReason` is non-empty.
- `testPaths` MUST be a non-empty array unless `testNotApplicableReason` is non-empty and cites the package.json script inspection that proves no package-local test exists.
- `workspacePackage` MUST include non-empty `name`, `path`, `packageJsonPath`, `buildCommandId`, and `testCommandId` or `testNotApplicableReason`.
- `targetExistenceProof` MUST include `sourcePaths`, `distPaths`, and `proofCommandIds` arrays. Each migrated entry MUST have at least one source path; dist paths are required when that entry is part of consumer runtime or package dist output.
- `rootScriptDependencyForbidden` MUST include `originalPath`, `scanScopes`, `forbiddenDependencyForms`, and `proofCommandIds` arrays.
- `smokeProbe` MUST be an object with non-empty `probeId`, `probeType`, `commandId`, `cwd`, `inputFixture`, `expectedResult`, and `stderrPolicy` fields, an `argv` array, and an `expectedExitCode` field. `probeType` MUST be `package_import`, `package_cli`, or `installed_package_require`. The probe MUST include either non-empty `expectedStdout` or non-empty `expectedArtifactEffect`.
- A ledger entry without enough source or registry evidence to fill those fields MUST stop with `blocked_by_contract_ambiguity:ledger_original_path` before migration edits for that entry.

Queue groups:

```text
consumer_runtime_reachable (28)
  - scripts/analytics-sft-extract.ts
  - scripts/assert-implementation-entry.ts
  - scripts/bmad-config.ts
  - scripts/check-sprint-ready.ps1
  - scripts/check-sprint-ready.sh
  - scripts/dashboard-generate.ts
  - scripts/governance-execution-result-ingestor.ts
  - scripts/governance-hook-types.ts
  - scripts/governance-provider-adapter.ts
  - scripts/governance-runtime-queue.ts
  - scripts/governance-stage-event-emitter.ts
  - scripts/i18n/render-template.ts
  - scripts/ingest-architecture-confirmation.ts
  - scripts/mcp/consumer/install-consumer-mcp.ps1
  - scripts/mcp/consumer/install-consumer-mcp.sh
  - scripts/mcp/consumer/verify-consumer-mcp.ps1
  - scripts/mcp/consumer/verify-consumer-mcp.sh
  - scripts/model-governance-hint-resolver.ts
  - scripts/parse-and-write-score.ts
  - scripts/runtime-governance-registry.ts
  - scripts/runtime-governance-template-schema.ts
  - scripts/runtime-governance.ts
  - scripts/sft-extract.ts
  - scripts/user-story-mapping.ts
  - scripts/validate-consumer-governance.ps1
  - scripts/verify-hooks-no-ts-node.js
  - scripts/write-runtime-policy-snapshot-and-recovery-context.cjs
  - scripts/write-runtime-policy-snapshot-and-recovery-context.ts
package_runtime_helper (65)
  - scripts/analytics-cluster.ts
  - scripts/analytics-prompt-optimize.ts
  - scripts/analytics-rule-suggest.ts
  - scripts/architecture-confirmation-hash-recipe.ts
  - scripts/bmad-help-five-layer-progress-marker.ts
  - scripts/bmad-help-routing-state.ts
  - scripts/bmad-state.ts
  - scripts/bmad-sync-from-v6.ps1
  - scripts/bmad-sync-from-v6.sh
  - scripts/cleanup-packed-bmad.js
  - scripts/continue-state-contract.ts
  - scripts/control-event-log-rebaseline.ts
  - scripts/controlled-ingest-atomic-committer.ts
  - scripts/dashboard-projection-mapping.ts
  - scripts/deferred-gap-governance.cjs
  - scripts/ensure-runtime-dashboard-server.cjs
  - scripts/evidence-provenance.ts
  - scripts/execution-discipline-profiles.ts
  - scripts/execution-intent-schema.ts
  - scripts/execution-strategy-selection.ts
  - scripts/facilitator-registry.ts
  - scripts/facilitator-runtime-definition.ts
  - scripts/generate-codex-agents-from-claude.js
  - scripts/governance-transport-envelope.ts
  - scripts/i18n/agent-manifest.ts
  - scripts/i18n/detect-language.ts
  - scripts/i18n/field-meta-types.ts
  - scripts/i18n/language-policy.ts
  - scripts/i18n/materialize-facilitator-definition.ts
  - scripts/i18n/placeholder-types.ts
  - scripts/i18n/protected-token-check.ts
  - scripts/i18n/render-field-view.ts
  - scripts/i18n/resolve-for-session-cli.ts
  - scripts/i18n/resolve-for-session.ts
  - scripts/i18n/resolve-localized-markdown-path.ts
  - scripts/i18n/sync-party-mode-mirrors.ts
  - scripts/i18n/validate-template-manifest.ts
  - scripts/long-run-runtime-policy.ts
  - scripts/model-governance-hints-schema.ts
  - scripts/monitor-push.sh
  - scripts/prepublish-check.js
  - scripts/real-development-tick-worker.js
  - scripts/requirement-record-event-reducer.ts
  - scripts/reviewer-shared-core.ts
  - scripts/run-confirmed-final-required-commands.js
  - scripts/run-confirmed-trace-slice.js
  - scripts/run-required-commands-from-ai-tdd-manifest.ts
  - scripts/run-runtime-dashboard-forever.cjs
  - scripts/runtime-context-registry.ts
  - scripts/runtime-context.ts
  - scripts/runtime-dashboard-server-state.cjs
  - scripts/scores-summary.ts
  - scripts/sdd-artifact-manifest.ts
  - scripts/skill-semantic-features-config.ts
  - scripts/sprint-status-authorized-update.ts
  - scripts/stable-runtime-policy-json.ts
  - scripts/start-dashboard.ts
  - scripts/start-runtime-dashboard-server.cjs
  - scripts/strict-command-resolution-preflight.ts
  - scripts/subagent-current-attempt-revalidation.ts
  - scripts/subagent-surface-inventory.ts
  - scripts/trace-closure-matrix.ts
  - scripts/update-specify-passed.ts
  - scripts/verify-story-mode.ts
  - scripts/write-runtime-registry.js
public_cli (9)
  - scripts/architecture-drift-check.ts
  - scripts/coach-diagnose.ts
  - scripts/emit-runtime-policy.ts
  - scripts/init-to-root.js
  - scripts/live-smoke-speckit-workflow.ts
  - scripts/setup.ps1
  - scripts/setup.sh
  - scripts/speckit-cli.ts
  - scripts/validate-single-source-whitelist.ts
```

### D003 target surface addendum

- A `package_runtime_module` queue entry MUST produce package source under `packages/bmad-speckit/src/main-agent/actions/**` or another exact target path declared by the registry ledger.
- A `durable_helper_copy` queue entry MUST produce package source under the exact `targetPaths` declared by the registry ledger.
- A `public_cli_de_surface` queue entry MUST update `packages/bmad-speckit/bin/bmad-speckit.js` and MUST produce the exact command source path declared by the registry ledger.
- A target path outside `packages/bmad-speckit/**` MUST be validated by the workspace package build or test command listed in G007.
- No target path may be moved outside the ledger-declared package or workspace target without `scope_amendment_required:ledger_original_path`.
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` MUST copy every `packages/bmad-speckit/src/main-agent/actions/**` and `packages/bmad-speckit/src/main-agent/helpers/**` target declared by `migration-ledger.json` to the matching `packages/bmad-speckit/dist/main-agent/actions/**` or `packages/bmad-speckit/dist/main-agent/helpers/**` path. The build copy implementation MAY be ledger-derived or static, but CMD010 MUST fail when any ledger-declared bmad-speckit action or helper target is absent from dist after CMD018.
- Allowed write paths are the union of each ledger entry `targetPaths`, `callerSwitchPlan[].targetPath`, `buildCopyPlan[].targetPath`, `testPaths`, this wave directory, `repo-governance/script-migration-registry.yaml`, `package.json`, `packages/bmad-speckit/package.json`, `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`, `packages/bmad-speckit/tests/main-agent-wave-3-12-runtime-modules.test.js`, `packages/bmad-speckit/tests/main-agent-wave-3-12-durable-helpers.test.js`, `packages/bmad-speckit/tests/main-agent-wave-3-12-public-cli.test.js`, `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs`, `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs`, `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, and `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts`.
- A broad `packages/**` write grant does not exist in this contract.
- Large Markdown, YAML, CSV, TOML, README, AGENTS, registry, summary, or generated governance rewrites MUST be promoted through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`; small localized `apply_patch` edits are allowed only when the target remains present after every step and the edit is not a large rewrite.
- This D003 large-document rule is the controlling refinement of the template-level manual-edit rule for registry, summary, and generated governance artifacts.
- Safe-write promotion MUST create a timestamped backup when replacing an existing file, write a same-directory draft or temp file with UTF-8, validate required text or keys, record byte length and SHA256, promote atomically, read back the target, and append a passed receipt to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json`.
- Safe-write promotion for `migration-ledger.json` MUST validate top-level keys `sourcePlanPath`, `sourcePlanHash`, `sourceAuditPath`, `sourceRegistryPath`, `sourceSummaryPath`, `executionContractPath`, `executionContractHash`, `queueHash`, `counts`, `entries`, and `queueOrderProof` before promotion succeeds.
- Safe-write promotion for `evidence.json` MUST validate top-level keys `sourcePlanPath`, `sourcePlanHash`, `executionContractPath`, `executionContractHash`, `auditContractPath`, `queueHash`, `commands`, `entries`, `installMatrixEvidence`, `safeWriteReceiptRefs`, and `artifactHashes` before promotion succeeds.
- `safe-write-receipts.json` MUST be written with UTF-8 JSON, same-directory temp promotion, readback SHA256, and schema validation; it does not require a self-referential passed receipt row for `safe-write-receipts.json`.
- `migration-ledger.json`, `scope-baseline.json`, `package-command-evidence.json`, `install-matrix.json`, `evidence.json`, `summary.md`, and `repo-governance/script-migration-registry.yaml` MUST each have a passed safe-write receipt when created or replaced during this wave.

### D004 registry state addendum

- Every migrated queue entry MUST end with `migrationStatus=validated`.
- Every migrated queue entry MUST end with `validationStatus=passed`.
- Every migrated queue entry MUST include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json` in `evidenceRefs`.
- Every migrated queue entry MUST keep `deletionAllowed=false`.
- `callerSwitchStatus` MUST be `switched`, `compatibility_alias_retained`, or `not_applicable` only when direct evidence in `evidence.json` proves that state for the entry.

### D005 consumer runtime boundary addendum

- Forbidden root script dependency means importing, requiring, spawning, shelling out to, or otherwise dispatching any original root `scripts/**` queue path from package source, package dist, package bin, installed CLI probes, or installed helper probes.
- Package runtime and CLI dispatch for migrated entries MUST NOT import, require, spawn, shell out to, or otherwise dispatch any original root `scripts/**` queue path from `packages/bmad-speckit/src/**`, `packages/bmad-speckit/dist/**`, `packages/bmad-speckit/bin/**`, or installed package probes.
- Package runtime and CLI dispatch for migrated entries MUST NOT import root `scripts/*.ts`; this TypeScript-specific rule is a subset of the forbidden root script dependency rule.
- Package runtime and CLI dispatch for migrated entries MUST NOT require `tsx` in consumer runtime.
- Package runtime and CLI dispatch for migrated entries MUST NOT require `ts-node` in consumer runtime.
- Package runtime and CLI dispatch for migrated entries MUST NOT use compiled fallback as completion proof for covered behavior.
- The caller-switch, target-existence, install, evidence, and final validator phases MUST include package source paths, `targetExistenceProof.distPaths`, package bin paths, installed probe command evidence, and installed helper probe evidence in the no-root-script, no-`tsx`, no-`ts-node`, and no-compiled-fallback proof.
- The install matrix MUST prove package execution from an installed package context without a source repository checkout assumption.

### D006 settled non-queue boundary addendum

- The 27 validated non-migration records MUST remain outside the 102 migration queue unless this contract is amended.
- If execution finds direct consumer runtime reachability evidence for any of the 27 validated non-migration records, `/goal` MUST stop with `semantic_decision_required:validated_non_queue_record` and MUST NOT migrate, reclassify, or continue to describe that record as settled within this contract.
- The 4 records with `repo_source_generation_i18n_bilingual_tooling` MUST remain classified as source-generation and bilingual Skill maintenance tooling, not consumer runtime bilingual support.
- Runtime bilingual support MUST remain covered by the i18n package runtime helper queue and install-surface/runtime-emit closure records.
- The 13 evidence-backed repo internal, fixture, documentation, and test harness records MUST NOT be described as consumer runtime migrated entries.

Validated non-queue records:

| Original path | Class | Strategy | Validation |
| --- | --- | --- | --- |
| scripts/bmad-speckit-cli.js | public_cli_package_bin_compatibility_alias | compatibility_alias | passed |
| scripts/compare-bmad-help-upstream.js | repo_internal_test_harness | repo_internal_reclassify | passed |
| scripts/create-test-story.ts | repo_internal_test_seed_only | repo_internal_reclassify | passed |
| scripts/deferred-gap-governance.d.cts | repo_internal_type_declaration | repo_internal_reclassify | passed |
| scripts/ensure-governance-user-story-mapping-fixture.js | repo_internal_ci_release_or_source_fixture | repo_internal_reclassify | passed |
| scripts/extract-npm-pack-json.js | repo_internal_pack_fixture_extractor | repo_internal_reclassify | passed |
| scripts/i18n/bootstrap-skill-bilingual-files.mjs | repo_source_generation_i18n_bilingual_tooling | repo_internal_reclassify | passed |
| scripts/i18n/han-outside-fences.mjs | repo_source_generation_i18n_bilingual_tooling | repo_internal_reclassify | passed |
| scripts/i18n/phase3_translate_skill_en.py | repo_source_generation_i18n_bilingual_tooling | repo_internal_reclassify | passed |
| scripts/i18n/phase3-skill-en-transform.mjs | repo_source_generation_i18n_bilingual_tooling | repo_internal_reclassify | passed |
| scripts/normalize-pack-manifests.js | repo_internal_ci_release_or_source_fixture | repo_internal_reclassify | passed |
| scripts/ralph-method/pathing.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/progress-format.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/schema.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/speckit-implement.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/types.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/verify-pass-consistency.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/verify-ralph-compliance.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/verify-tdd-trace.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/ralph-method/write-tracking-files.ts | package_runtime_helper_existing_package_alias | compatibility_alias | passed |
| scripts/README.md | repo_internal_scripts_documentation | repo_internal_reclassify | passed |
| scripts/render-upstream-bmad-help-baseline.js | repo_internal_test_harness | repo_internal_reclassify | passed |
| scripts/run-fresh-regression-matrix.ts | repo_internal_ci_release_or_source_fixture | repo_internal_reclassify | passed |
| scripts/test-locks.ts | repo_internal_test_harness | repo_internal_reclassify | passed |
| scripts/test-story-flow.ts | repo_internal_test_harness | repo_internal_reclassify | passed |
| scripts/verify-skill-architecture.sh | repo_internal_test_harness | repo_internal_reclassify | passed |
| scripts/verify-speckit-mirror-sync.js | repo_internal_ci_release_or_source_fixture | repo_internal_reclassify | passed |

### D007 execution evidence order addendum

- Command IDs are stable evidence labels and MUST NOT be treated as numeric execution order.
- The executor MUST run command evidence in this dependency order: physical and registry baseline, ledger schema, bootstrap validation, implementation phase validators, ledger-aware package build and test commands, target-existence validation, caller-switch source/bin validation, install matrix, evidence validation, registry finalization, summary update and audit, final validator, final contract test, root-retention checks, scope validation, and encoding gate.
- Any command whose PASS condition permits `not_applicable` MUST be implemented as a ledger-aware wrapper command that exits 0 only after writing or printing the exact ledger query and package.json script evidence that proves the command is not applicable.
- Every queue entry MUST have one `smokeProbe` result recorded in `evidence.json.entries[]` before registry finalization. File existence, dist existence, and no-root-dispatch scans are necessary but not sufficient to prove the entry's migrated package behavior.
- The Wave 3.12 acceptance test MUST support `BMAD_WAVE_3_12_CONTRACT_TEST_PHASE=bootstrap` and `BMAD_WAVE_3_12_CONTRACT_TEST_PHASE=final`. Bootstrap mode MUST NOT require evidence.json, install-matrix.json, or finalized registry rows. Final mode MUST require evidence.json, install-matrix.json when G008 applies, safe-write receipts, and finalized registry rows.
<!-- /goal-slot:domainAddenda -->

## Implementation Tasks

<!-- goal-slot:implementationTasks required dynamic=traceSlices -->
### G001 Build the 102-entry migration ledger

Purpose: Freeze the exact queue entries, categories, target paths, owner class, and evidence obligations before implementation starts.

Files:
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/full-physical-script-closure-audit.json
- PATH repo-governance/script-migration-registry.yaml
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/scope-baseline.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md
- PATH tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs

Steps:
- STEP G001.01 Create or update `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` before writing any Wave 3.12 governance JSON artifact. The helper MUST support safe promotion for `migration-ledger.json`, `scope-baseline.json`, `package-command-evidence.json`, `install-matrix.json`, `evidence.json`, `summary.md`, and `repo-governance/script-migration-registry.yaml`.
- STEP G001.02 Write `scope-baseline.json` through the safe-write helper with the pre-migration `git status --short` rows, `capturedAt`, `allowedWritePolicy`, and the exact command used to capture the baseline.
- STEP G001.03 Read `consumerReachableMigrationQueue` from the Wave 3.12 audit JSON and verify it contains exactly 102 paths.
- STEP G001.04 For each queue path, read the matching Wave 3.12 registry entry and copy `originalPath`, `entryId`, `originalClassBeforeMigration`, `migrationStrategy`, `targetPaths`, `publicCommandsBeforeMigration`, `publicCommandsAfterMigration`, `callerSwitchStatus`, `migrationStatus`, `validationStatus`, `deletionAllowed`, and `evidenceRefs` into `migration-ledger.json`.
- STEP G001.05 For each queue path, derive `callerSwitchPlan`, `runnerApi`, `cliProbeCommand`, `buildCopyPlan`, `testPaths`, `workspacePackage`, `targetExistenceProof`, `rootScriptDependencyForbidden`, and `smokeProbe` from the registry entry, source script, package target path, existing package command surfaces, and deterministic package smoke path.
- STEP G001.06 Stop with `blocked_by_contract_ambiguity:ledger_original_path` when any required ledger field cannot be derived without inventing behavior.
- STEP G001.07 Write `migration-ledger.json` through the safe-write helper with top-level fields `schemaVersion`, `waveId`, `sourcePlanPath`, `sourcePlanHash`, `sourceAuditPath`, `sourceRegistryPath`, `sourceSummaryPath`, `executionContractPath`, `executionContractHash`, `queueHash`, `counts`, `entries`, `generatedAt`, and `queueOrderProof`.
- STEP G001.08 Set `queueHash` to `sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea` for the newline-joined original paths from the source summary order.
- STEP G001.09 Set `sourcePlanPath` and `sourcePlanHash` in the ledger to the Wave 3.12 summary path and hash from this contract, not to this goal contract path.
- STEP G001.10 Set `executionContractPath` to this goal contract path and `executionContractHash` to the SHA256 of the current goal contract file after any approved contract-review repair.
- STEP G001.11 Configure the safe-write helper ledger generator so it writes the summary `sourcePlanPath/sourcePlanHash` and current `executionContractPath/executionContractHash`; a generated ledger that writes this goal contract path into `sourcePlanPath` is invalid.
- STEP G001.12 Set each ledger entry `implementationState` to `pending` before any migration edits for that entry.

Validation:
- COMMAND node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty
- COMMAND node tools/script-migration/validate-registry.cjs
- COMMAND node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); const p='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json'; const contractPath='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md'; const expectedContractHash='sha256:'+crypto.createHash('sha256').update(fs.readFileSync(contractPath)).digest('hex'); const j=JSON.parse(fs.readFileSync(p,'utf8')); const required=['callerSwitchPlan','runnerApi','cliProbeCommand','buildCopyPlan','testPaths','workspacePackage','targetExistenceProof','rootScriptDependencyForbidden','smokeProbe']; const errors=[]; const obj=v=>v&&typeof v==='object'&&!Array.isArray(v); const arr=v=>Array.isArray(v); const nonEmpty=v=>typeof v==='string'&&v.length>0; if(!j||!Array.isArray(j.entries)) errors.push('entries_missing'); else if(j.entries.length!==102) errors.push('entry_count:'+j.entries.length); if(j.sourcePlanPath!=='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md') errors.push('sourcePlanPath:'+j.sourcePlanPath); if(j.sourcePlanHash!=='sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af') errors.push('sourcePlanHash:'+j.sourcePlanHash); if(j.executionContractPath!==contractPath) errors.push('executionContractPath:'+j.executionContractPath); if(j.executionContractHash!==expectedContractHash) errors.push('executionContractHash:'+j.executionContractHash); if(j.queueHash!=='sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea') errors.push('queue_hash:'+j.queueHash); for(const e of j.entries||[]){ const id=e.originalPath||'<unknown>'; for(const k of required){ if(!(k in e)) errors.push(id+':missing:'+k); } if(!Array.isArray(e.targetPaths)||e.targetPaths.length===0) errors.push(id+':targetPaths_empty'); if(!arr(e.callerSwitchPlan)) errors.push(id+':callerSwitchPlan_not_array'); else { if(e.callerSwitchPlan.length===0&&!(e.callerSwitchStatus==='not_applicable'&&nonEmpty(e.callerSwitchNotApplicableReason))) errors.push(id+':callerSwitchPlan_empty_without_reason'); for(const [i,plan] of e.callerSwitchPlan.entries()){ if(!obj(plan)||!nonEmpty(plan.targetPath)||!nonEmpty(plan.action)||!nonEmpty(plan.status)||!arr(plan.proofCommandIds)) errors.push(id+':callerSwitchPlan_shape:'+i); }} if(!obj(e.runnerApi)||!nonEmpty(e.runnerApi.moduleFormat)||!nonEmpty(e.runnerApi.exportName)||!nonEmpty(e.runnerApi.cwdPolicy)||!nonEmpty(e.runnerApi.argumentPolicy)||!nonEmpty(e.runnerApi.stdoutPolicy)||!nonEmpty(e.runnerApi.stderrPolicy)||!nonEmpty(e.runnerApi.exitCodePolicy)) errors.push(id+':runnerApi_shape'); if(e.cliProbeCommand!==null&&e.cliProbeCommand!==undefined&&(!obj(e.cliProbeCommand)||!nonEmpty(e.cliProbeCommand.command)||!nonEmpty(e.cliProbeCommand.cwd)||!('expectedExitCode' in e.cliProbeCommand)||!('provesCommandAvailability' in e.cliProbeCommand))) errors.push(id+':cliProbeCommand_shape'); if(!arr(e.buildCopyPlan)) errors.push(id+':buildCopyPlan_not_array'); else { if(e.buildCopyPlan.length===0&&!nonEmpty(e.buildCopyNotApplicableReason)) errors.push(id+':buildCopyPlan_empty_without_reason'); for(const [i,plan] of e.buildCopyPlan.entries()){ if(!obj(plan)||!nonEmpty(plan.sourcePath)||!nonEmpty(plan.targetPath)||!nonEmpty(plan.copyCommandId)) errors.push(id+':buildCopyPlan_shape:'+i); }} if(!arr(e.testPaths)) errors.push(id+':testPaths_not_array'); else if(e.testPaths.length===0&&!nonEmpty(e.testNotApplicableReason)) errors.push(id+':testPaths_empty_without_reason'); if(!obj(e.workspacePackage)||!nonEmpty(e.workspacePackage.name)||!nonEmpty(e.workspacePackage.path)||!nonEmpty(e.workspacePackage.packageJsonPath)||!nonEmpty(e.workspacePackage.buildCommandId)||!(nonEmpty(e.workspacePackage.testCommandId)||nonEmpty(e.workspacePackage.testNotApplicableReason))) errors.push(id+':workspacePackage_shape'); if(!obj(e.targetExistenceProof)||!arr(e.targetExistenceProof.sourcePaths)||e.targetExistenceProof.sourcePaths.length===0||!arr(e.targetExistenceProof.distPaths)||!arr(e.targetExistenceProof.proofCommandIds)) errors.push(id+':targetExistenceProof_shape'); if(!obj(e.rootScriptDependencyForbidden)||!nonEmpty(e.rootScriptDependencyForbidden.originalPath)||!arr(e.rootScriptDependencyForbidden.scanScopes)||!arr(e.rootScriptDependencyForbidden.forbiddenDependencyForms)||!arr(e.rootScriptDependencyForbidden.proofCommandIds)) errors.push(id+':rootScriptDependencyForbidden_shape'); if(!obj(e.smokeProbe)||!nonEmpty(e.smokeProbe.probeId)||!nonEmpty(e.smokeProbe.probeType)||!nonEmpty(e.smokeProbe.commandId)||!nonEmpty(e.smokeProbe.cwd)||!Array.isArray(e.smokeProbe.argv)||!nonEmpty(e.smokeProbe.inputFixture)||!('expectedExitCode' in e.smokeProbe)||!nonEmpty(e.smokeProbe.expectedResult)||!nonEmpty(e.smokeProbe.stderrPolicy)||!(nonEmpty(e.smokeProbe.expectedStdout)||nonEmpty(e.smokeProbe.expectedArtifactEffect))) errors.push(id+':smokeProbe_shape'); } if(errors.length){console.error(JSON.stringify({errors},null,2)); process.exit(1);} console.log(JSON.stringify({entries:j.entries.length,queueHash:j.queueHash,sourcePlanPath:j.sourcePlanPath,executionContractPath:j.executionContractPath,executionContractHash:j.executionContractHash,requiredFields:required.length,shape:'passed'}))"
- COMMAND node -e "const fs=require('node:fs'); const ledgerPath='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json'; const allowed=new Set(['package_import','package_cli','installed_package_require']); const j=JSON.parse(fs.readFileSync(ledgerPath,'utf8')); const invalid=(j.entries||[]).filter(e=>!e.smokeProbe||!allowed.has(e.smokeProbe.probeType)).map(e=>({originalPath:e.originalPath,probeType:e.smokeProbe&&e.smokeProbe.probeType})); if(invalid.length){console.error(JSON.stringify({invalidSmokeProbeTypes:invalid},null,2)); process.exit(1);} console.log(JSON.stringify({entries:(j.entries||[]).length,smokeProbeTypeEnum:[...allowed].sort(),shape:'passed'}))"

Acceptance:
- ACCEPTANCE ACC001
- ACCEPTANCE ACC002
- ACCEPTANCE ACC003

### G002 Create Wave 3.12 validation surfaces

Purpose: Create the Wave 3.12 validator, acceptance test, package-command wrapper, and install-matrix runner; verify the G001 safe-write helper before any migration task invokes these surfaces.

Files:
- PATH tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs
- PATH tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs
- PATH tools/script-migration/run-main-agent-wave-3-12-package-command.cjs
- PATH tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs
- PATH tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/scope-baseline.json

Steps:
- STEP G002.01 Create `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs` with phases `bootstrap`, `actions`, `helpers`, `public-cli`, `target-existence`, `caller-switch`, `builds`, `install`, `evidence`, `root-retention`, `scope`, and `final`.
- STEP G002.02 Create `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts` with `bootstrap` and `final` modes keyed by `BMAD_WAVE_3_12_CONTRACT_TEST_PHASE`.
- STEP G002.03 In bootstrap mode, the acceptance test MUST check only validation-surface existence, ledger schema, and root-retention/deletion-denial invariants that exist after G002.
- STEP G002.04 In final mode, the acceptance test MUST check target existence proof, forbidden root script dependency checks, evidence coverage, registry finalization, safe-write receipts, and no deletion approval.
- STEP G002.05 Create `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs` so it reads `migration-ledger.json`, packs the package under test, runs installed package probes only from isolated Wave 3.12 install sandboxes, records `categoryCoverage`, and writes `install-matrix.json`; source-tree CLI help probes and ledger target-existence probes are allowed as supplemental rows only and MUST NOT satisfy CMD023 or CMD024 without installed package sandbox probes.
- STEP G002.06 Create `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs` so each package build or test command inspects `migration-ledger.json`, runs the command when ledger targets touch its target prefix, or emits a validated `not_applicable` row when the ledger query proves the package is untouched or the package has no relevant script. On Windows, this wrapper MUST run package commands through argv arrays with `shell=false` or through explicit `pwsh.exe -NoLogo -NoProfile -Command`.
- STEP G002.07 Verify `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` exists and supports registry, summary, ledger, scope baseline, package command evidence, install matrix, evidence, safe-write receipt, and generated governance artifact writes through UTF-8 draft, backup, SHA256, required-marker, readback, and receipt validation.
- STEP G002.08 Make `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs` expose a concrete `scope` phase that accepts `node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase scope` and enforces the CMD032 allowed-write-union pass condition.
- STEP G002.09 Make `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs` enforce ledger and evidence source binding with `sourcePlanPath=repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md`, `sourcePlanHash=sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af`, `executionContractPath=docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md`, and `executionContractHash` equal to the current SHA256 of this goal contract file.
- STEP G002.10 Make the `bootstrap` validator phase pass after G002 only when all validation/writer surfaces exist, `migration-ledger.json` has the required schema fields and shapes from G001, the source summary binding and execution contract binding from G002.09 are valid, `scope-baseline.json` exists, and passed safe-write receipts exist for both `migration-ledger.json` and `scope-baseline.json`.
- STEP G002.11 Make the `actions`, `helpers`, and `public-cli` validator phases fail when a queue entry in that category lacks package source, a declared `smokeProbe` with the full D002 field set, a `smokeProbe.probeType` outside `package_import`, `package_cli`, or `installed_package_require`, or package tests that consume package source or package dist rather than original root `scripts/**`.
- STEP G002.12 Make the `evidence` validator phase fail unless every `evidence.json.entries[]` row has `evidenceCommandIds`, `result=passed`, `validationStatus=passed`, `smokeProbeResult`, `packageCommandEvidenceRefs` or `installMatrixProbeIds`, and `artifactHashRefs` for produced targets.
- STEP G002.13 Do not run `actions`, `helpers`, `public-cli`, `target-existence`, `caller-switch`, `builds`, `install`, `evidence`, `root-retention`, `scope`, or `final` phases until the task that produces the corresponding evidence has completed.

Validation:
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase bootstrap
- COMMAND pwsh.exe -NoLogo -NoProfile -Command "& { $env:BMAD_WAVE_3_12_CONTRACT_TEST_PHASE='bootstrap'; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts }"

Acceptance:
- ACCEPTANCE ACC002

### G003 Migrate consumer runtime reachable actions

Purpose: Move the 28 consumer runtime reachable entries into package runtime modules with consumer-safe CommonJS behavior and entry-specific tests.

Files:
- PATH packages/bmad-speckit/src/main-agent/actions/**
- PATH packages/bmad-speckit/src/main-agent/runtime.js
- PATH packages/bmad-speckit/scripts/build-main-agent-dist.cjs
- PATH packages/bmad-speckit/tests/main-agent-wave-3-12-runtime-modules.test.js
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json

Steps:
- STEP G003.01 For each ledger entry with `migrationStrategy=package_runtime_module`, create or update the exact package source file listed in `targetPaths`.
- STEP G003.02 Convert root script side effects into exported CommonJS runner functions with deterministic argument, cwd, stdout, stderr, and exit-code behavior.
- STEP G003.03 Update package runtime dispatch only for entries whose `callerSwitchPlan` identifies a consumer-visible Main Agent action command.
- STEP G003.04 Update `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` so every migrated runtime action is copied to `packages/bmad-speckit/dist/main-agent/actions/**`.
- STEP G003.05 Create package tests that import package source or dist modules and do not import, require, spawn, or execute any original root `scripts/**` queue path.
- STEP G003.06 Update each migrated ledger entry `implementationState` to `implemented` and store the package source path, dist path, and test path.

Validation:
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase actions

Acceptance:
- ACCEPTANCE ACC004
- ACCEPTANCE ACC005
- ACCEPTANCE ACC006
- ACCEPTANCE ACC007
- ACCEPTANCE ACC010

### G004 Migrate package runtime helpers

Purpose: Move the 65 package runtime helper entries into durable package helper surfaces or declared workspace package target paths.

Files:
- PATH migration-ledger entries[].targetPaths under packages/bmad-speckit/src/main-agent/helpers/**
- PATH migration-ledger entries[].targetPaths under packages/scoring/**
- PATH migration-ledger entries[].targetPaths under packages/runtime-context/**
- PATH packages/bmad-speckit/scripts/build-main-agent-dist.cjs
- PATH packages/bmad-speckit/tests/main-agent-wave-3-12-durable-helpers.test.js
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json

Steps:
- STEP G004.01 For each ledger entry with `migrationStrategy=durable_helper_copy`, implement the exact `targetPaths` listed in the ledger.
- STEP G004.02 For each helper target under `packages/bmad-speckit/src/main-agent/helpers/**`, export deterministic CommonJS APIs and avoid root repository path assumptions.
- STEP G004.03 For each helper target under `packages/scoring/**` or `packages/runtime-context/**`, preserve that package public API and package file inclusion rules.
- STEP G004.04 Do not write `packages/runtime-emit/**`, `packages/ralph-method/**`, or `packages/schema/**` from G004 unless a ledger entry target path names that exact package path and this contract is amended to include it.
- STEP G004.05 Update build scripts so helper targets required by consumer package runtime are copied to the corresponding dist directory.
- STEP G004.06 Create package tests for helper API behavior and import package helper files only from package source or dist paths.
- STEP G004.07 Run the ledger-aware package command wrapper for `packages/scoring` tests when `migration-ledger.json` contains a target path under `packages/scoring/**`; the wrapper may emit `not_applicable` only when its ledger query proves no scoring target path exists.
- STEP G004.08 Record `not_applicable` for `packages/runtime-context`, `packages/runtime-emit`, `packages/ralph-method`, or `packages/schema` package-local tests only through the ledger-aware package command wrapper, with package.json script inspection and touched-target query evidence.
- STEP G004.09 Update each migrated ledger entry `implementationState` to `implemented` and store the package source path, dist path, and test path.

Validation:
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase helpers

Acceptance:
- ACCEPTANCE ACC004
- ACCEPTANCE ACC005
- ACCEPTANCE ACC006
- ACCEPTANCE ACC007
- ACCEPTANCE ACC010

### G005 Migrate public CLI package actions

Purpose: Expose the 9 public CLI entries through installed package CLI commands without root script dispatch.

Files:
- PATH packages/bmad-speckit/bin/bmad-speckit.js
- PATH packages/bmad-speckit/src/commands/**
- PATH packages/bmad-speckit/tests/main-agent-wave-3-12-public-cli.test.js
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json

Steps:
- STEP G005.01 For each ledger entry with `migrationStrategy=public_cli_de_surface`, create or update the exact package command source file listed in `targetPaths`.
- STEP G005.02 Update `packages/bmad-speckit/bin/bmad-speckit.js` so each public CLI command loads package-local command code and does not dispatch to the original root script.
- STEP G005.03 Preserve documented root package bin compatibility aliases only through package CLI forwarding, not direct root TypeScript execution.
- STEP G005.04 Create package CLI tests that invoke `packages/bmad-speckit/bin/bmad-speckit.js` and prove command availability plus a deterministic smoke path for each public CLI entry.
- STEP G005.05 Update each migrated ledger entry `implementationState` to `implemented` and store the command source path, CLI command name, and test path.

Validation:
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase public-cli

Acceptance:
- ACCEPTANCE ACC004
- ACCEPTANCE ACC005
- ACCEPTANCE ACC006
- ACCEPTANCE ACC007
- ACCEPTANCE ACC010

### G006 Switch callers and preserve root script retention

Purpose: Switch package and consumer-facing callers to package surfaces while retaining original root scripts and deletion denial state.

Files:
- PATH package.json
- PATH packages/bmad-speckit/package.json
- PATH packages/bmad-speckit/bin/bmad-speckit.js
- PATH migration-ledger entries[].callerSwitchPlan[].targetPath
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json
- PATH repo-governance/script-migration-registry.yaml

Steps:
- STEP G006.01 For each migrated queue entry, update source-repository package scripts or package CLI callers only when the ledger identifies that caller as consumer-facing or install-surface-facing.
- STEP G006.02 Retain every original `scripts/**` file in the working tree.
- STEP G006.03 Keep every Wave 3.12 registry entry `deletionAllowed=false`.
- STEP G006.04 Record pre-evidence caller switch proof in `migration-ledger.json` fields only; do not set final registry `callerSwitchStatus` in G006.
- STEP G006.05 Prove package source and package bin files do not import, require, spawn, shell out to, or otherwise dispatch any original root `scripts/**` queue path. Dist and installed probe proof is produced later by G007, G008, G009, and G010.
- STEP G006.06 Do not describe root script retention as deletion-ready.

Validation:
- COMMAND node -e "const fs=require('node:fs'); const j=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json','utf8')); const missing=j.entries.map(e=>e.originalPath).filter(p=>!fs.existsSync(p)); if(missing.length){console.error(JSON.stringify({missing})); process.exit(1);} console.log(JSON.stringify({checked:j.entries.length}))"
- COMMAND git status --short -- scripts

Acceptance:
- ACCEPTANCE ACC005
- ACCEPTANCE ACC006
- ACCEPTANCE ACC008

### G007 Run package builds and targeted package tests

Purpose: Produce package source and dist proof for every migrated entry and every touched workspace package.

Files:
- PATH ledger buildCopyPlan[].targetPath under packages/bmad-speckit/dist/**
- PATH ledger buildCopyPlan[].targetPath under packages/scoring/dist/**
- PATH ledger buildCopyPlan[].targetPath under packages/runtime-context/dist/**
- PATH ledger-aware wrapper build outputs under packages/runtime-emit/dist/** only when wrapper ledger query proves touched targets
- PATH ledger-aware wrapper build outputs under packages/ralph-method/dist/** only when wrapper ledger query proves touched targets
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-command-evidence.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json

Steps:
- STEP G007.01 Run the ledger-aware build sequence in this order: scoring, runtime-context, runtime-emit, ralph-method, bmad-speckit main-agent dist.
- STEP G007.02 Run package tests after package source and dist outputs exist.
- STEP G007.03 Run the ledger-aware package command wrapper for every package build and test command. The wrapper MUST run the real command when ledger targets touch the target prefix and MUST emit `not_applicable` only with exact ledger query evidence when the package is untouched or with package.json evidence when the package has no relevant script.
- STEP G007.04 Record command, working directory, exit code, stdout hash, stderr hash, produced artifact hashes, and `not_applicable` proofs in `package-command-evidence.json` through the safe-write helper.
- STEP G007.05 If a workspace package is not touched by any ledger target path, record `not_applicable` for that workspace package in `package-command-evidence.json` with the exact ledger query that proves no target path touches it.
- STEP G007.06 Do not write the final `evidence.json` in G007. G009 is the only task that consolidates package command evidence, install matrix evidence, registry evidence, and per-entry evidence rows into `evidence.json`.

Validation:
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/scoring --target-prefix packages/scoring --command "npm run build --prefix packages/scoring"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/runtime-context --target-prefix packages/runtime-context --command "npm run build --prefix packages/runtime-context"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/runtime-emit --target-prefix packages/runtime-emit --command "npm run build --prefix packages/runtime-emit"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/ralph-method --target-prefix packages/ralph-method --command "npm run build --prefix packages/ralph-method"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/bmad-speckit --target-prefix packages/bmad-speckit --command "npm run build:main-agent-dist --prefix packages/bmad-speckit"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test --package packages/scoring --target-prefix packages/scoring --command "npm run test --prefix packages/scoring"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test --package packages/bmad-speckit --target-prefix packages/bmad-speckit --command "npm run test --prefix packages/bmad-speckit"
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test-not-applicable --package packages/runtime-context --target-prefix packages/runtime-context --package packages/runtime-emit --target-prefix packages/runtime-emit --package packages/ralph-method --target-prefix packages/ralph-method --package packages/schema --target-prefix packages/schema
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase builds

Acceptance:
- ACCEPTANCE ACC004
- ACCEPTANCE ACC007
- ACCEPTANCE ACC010

### G008 Run install matrix proof

Purpose: Prove installed package behavior for migrated queue entries from consumer-style install modes without source repository root script execution.

Files:
- PATH tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-under-test.tgz
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-sandbox/**
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json
- PATH packages/bmad-speckit/package.json

Steps:
- STEP G008.01 Create or update an install-matrix runner for Wave 3.12 that reads `migration-ledger.json`.
- STEP G008.02 Create `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-under-test.tgz` from the current package build before install probes run.
- STEP G008.03 Create isolated install sandboxes only as direct child directories under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-sandbox/<probe-id>/`. The runner MUST NOT run `npm install` from the repository root, MUST NOT modify root `package.json`, root lockfiles, or package workspace manifests, and MUST record sandbox paths in `install-matrix.json`.
- STEP G008.04 From each direct child sandbox CWD, resolve the wave-root tarball as `../../package-under-test.tgz`, verify that it resolves to `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-under-test.tgz`, record its SHA256, and use only that resolved tarball path for install and npx probes.
- STEP G008.05 Prove `npm install --save-dev ../../package-under-test.tgz` from an isolated direct child sandbox for one migrated action, one helper, and one CLI entry.
- STEP G008.06 Prove `npx --package ../../package-under-test.tgz bmad-speckit ...` from an isolated direct child sandbox for every public CLI entry that exposes an installed command.
- STEP G008.07 Prove `npm install --no-save ../../package-under-test.tgz` followed by `npx --no-install bmad-speckit ...` from an isolated direct child sandbox for every public CLI entry that exposes an installed command.
- STEP G008.08 Record `usedRootScript=false`, `usedTsx=false`, `usedTsNode=false`, and `usedCompiledFallback=false` for every covered installed-package probe.
- STEP G008.09 If a queue helper has no direct CLI command, prove installed package `require` resolution for its package target path from an isolated direct child sandbox and record the helper probe in `install-matrix.json`.
- STEP G008.10 Write `install-matrix.json` through the safe-write helper with `categoryCoverage` proving at least one installed package probe covers each queue category `consumer_runtime_reachable`, `package_runtime_helper`, and `public_cli`.

Validation:
- COMMAND node tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs --write
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase install

Acceptance:
- ACCEPTANCE ACC006
- ACCEPTANCE ACC007
- ACCEPTANCE ACC011

### G009 Write evidence packet

Purpose: Write the Wave 3.12 evidence artifact that binds command results, install-matrix proof, ledger state, registry state, and artifact hashes.

Files:
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-command-evidence.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json

Steps:
- STEP G009.01 Write `evidence.json` through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs` with top-level fields `waveId`, `sourcePlanPath`, `sourcePlanHash`, `executionContractPath`, `executionContractHash`, `auditContractPath`, `queueHash`, `validatedAt`, `commands`, `entries`, `installMatrixEvidence`, `safeWriteReceiptRefs`, `artifactHashes`, and `residualRisks`.
- STEP G009.02 For each queue entry, write one `entries[]` row with `entryId`, `originalPath`, `targetPaths`, `callerSwitchStatus`, `validationStatus`, `evidenceCommandIds`, `packageCommandEvidenceRefs`, `installMatrixProbeIds`, `smokeProbeResult`, `artifactHashRefs`, `provesAcceptanceIds`, and `result`.
- STEP G009.03 For every command row, write exact `command`, `cwd`, `exitCode`, `stdoutHash`, `stderrHash`, and `provesAcceptanceIds`.
- STEP G009.04 For every produced artifact, write exact relative path and SHA256 hash.
- STEP G009.05 Import package build/test rows from `package-command-evidence.json` and installed package probe rows from `install-matrix.json`; do not invent command results that are absent from those artifacts.
- STEP G009.06 Require `safe-write-receipts.json` to include passed receipts for `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-command-evidence.json`, and `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json` when those files are created or replaced; `evidence.json.safeWriteReceiptRefs` may cite receipt IDs or target paths and is validated after promotion, not before promotion.
- STEP G009.07 Set each queue entry evidence `validationStatus` to `passed` only after the commands proving that entry have exit code 0.
- STEP G009.08 Set `residualRisks` to an empty array only when every acceptance item has direct evidence.

Validation:
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase evidence
- COMMAND node -e "const fs=require('node:fs'); const e=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json','utf8')); if((e.entries||[]).length!==102) process.exit(1); if(e.queueHash!=='sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea') process.exit(2); if(e.sourcePlanPath!=='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md') process.exit(3); if(e.sourcePlanHash!=='sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af') process.exit(4); if(e.executionContractPath!=='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md') process.exit(5); if(typeof e.executionContractHash!=='string'||!e.executionContractHash.startsWith('sha256:')) process.exit(6); if(e.auditContractPath!=='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md') process.exit(7); console.log(JSON.stringify({entries:e.entries.length,queueHash:e.queueHash,sourcePlanPath:e.sourcePlanPath,executionContractPath:e.executionContractPath}))"

Acceptance:
- ACCEPTANCE ACC009
- ACCEPTANCE ACC010
- ACCEPTANCE ACC011
- ACCEPTANCE ACC012

### G010 Finalize registry Wave 3.12 entries

Purpose: Move all 102 queue entries from planned pending to validated passed only after implementation evidence exists.

Files:
- PATH repo-governance/script-migration-registry.yaml
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json

Steps:
- STEP G010.01 Promote the `repo-governance/script-migration-registry.yaml` update through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, with required-key checks for the Wave 3.12 record, backup path when replacing, byte length, target SHA256, readback SHA256, and a passed receipt in `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json`.
- STEP G010.02 Set Wave 3.12 `contractPath` in `repo-governance/script-migration-registry.yaml` to `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md` and preserve the previous audit contract path in `evidence.json.auditContractPath`.
- STEP G010.03 Set Wave 3.12 `title` in `repo-governance/script-migration-registry.yaml` to a runtime migration closeout title that includes `runtime migration` and does not leave `full physical script closure audit` as the final title after all 102 queue entries are validated.
- STEP G010.04 For each of the 102 queue entries, update `migrationStatus` to `validated` only after its package source, build output, caller switch, and tests are recorded in `migration-ledger.json` and `evidence.json`.
- STEP G010.05 For each of the 102 queue entries, update `validationStatus` to `passed` only after `evidence.json` contains passing command rows for that entry.
- STEP G010.06 For each of the 102 queue entries, set final registry `callerSwitchStatus` to `switched`, `compatibility_alias_retained`, or `not_applicable` only after `evidence.json.entries[]` contains the direct proof command IDs for that state.
- STEP G010.07 For each of the 102 queue entries, set `evidenceRefs` to include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json`.
- STEP G010.08 For each of the 102 queue entries, keep `deletionAllowed=false` and `deletionApprovalRef=null`.
- STEP G010.09 Do not change the 27 validated non-queue records except to correct evidence wording that remains within their existing classification.

Validation:
- COMMAND node tools/script-migration/validate-registry.cjs
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase final
- COMMAND pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/script-migration-registry-contract.test.ts tests/acceptance/script-migration-full-physical-closure.test.ts }"

Acceptance:
- ACCEPTANCE ACC003
- ACCEPTANCE ACC008
- ACCEPTANCE ACC009
- ACCEPTANCE ACC014

### G011 Update summary and human projection

Purpose: Update the Wave 3.12 summary so it reports completed migrations, remaining queue count, settled non-queue boundaries, audit contract path, execution contract path, evidence paths, and residual risks without overclaiming consumer direct script execution.

Files:
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json

Steps:
- STEP G011.01 Promote `summary.md` through `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, with required headings for queue counts, audit contract path, execution contract path, evidence paths, residual risks, backup path when replacing, byte length, target SHA256, readback SHA256, and a passed receipt in `safe-write-receipts.json`.
- STEP G011.02 Update `summary.md` so the queue section reports `completed` and `remaining` counts from `migration-ledger.json`.
- STEP G011.03 State that the Wave 3.12 audit contract path is `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md` and the runtime migration execution contract path is `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md`.
- STEP G011.04 Keep the validated non-migration grouping from the source summary unless direct amended evidence changes it.
- STEP G011.05 State that consumer reachable entries are migrated only when registry and evidence rows are validated.
- STEP G011.06 State that original root scripts are retained and not deletion-approved.
- STEP G011.07 State that root package `files` including `scripts/` remains a risk signal until a separate packaging cleanup contract changes it.

Validation:
- COMMAND node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty
- COMMAND node tools/script-migration/validate-registry.cjs
- COMMAND pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/script-migration-full-physical-closure.test.ts tests/acceptance/script-migration-registry-contract.test.ts }"

Acceptance:
- ACCEPTANCE ACC001
- ACCEPTANCE ACC003
- ACCEPTANCE ACC008
- ACCEPTANCE ACC012

### G012 Final verification and closeout

Purpose: Run final gates and produce the completion evidence packet without claiming unsupported runtime scope.

Files:
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md
- PATH repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/scope-baseline.json
- PATH repo-governance/script-migration-registry.yaml
- PATH docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md

Steps:
- STEP G012.01 Run all required commands in the dependency order defined by D007; command IDs are stable evidence labels and are not numeric execution order.
- STEP G012.02 Record final command results in `evidence.json` or cite their exact command IDs from `evidence.json`.
- STEP G012.03 Validate `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json` contains passed receipts for registry, evidence, install matrix when created, and summary promotions.
- STEP G012.04 Run the ledger root-retention command and `git status --short -- scripts` and prove no root script deletion occurred.
- STEP G012.05 Run the `scope` validator phase and prove every Wave 3.12 changed path is either in the ledger-derived allowed write union, in the explicit contract write union, or present in `scope-baseline.json` as pre-existing unrelated dirty worktree state.
- STEP G012.06 Run the encoding integrity gate after all Markdown, YAML, JSON, package, or generated-surface edits.
- STEP G012.07 Prepare final response with generated evidence paths, command summary, remaining risks, and exact scripts still pending if any ledger entry remains unvalidated.

Validation:
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase root-retention
- COMMAND node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase scope
- COMMAND git status --short -- scripts
- COMMAND git status --short -- repo-governance/script-migration-registry.yaml repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12
- COMMAND node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js

Acceptance:
- ACCEPTANCE ACC001
- ACCEPTANCE ACC002
- ACCEPTANCE ACC009
- ACCEPTANCE ACC012
- ACCEPTANCE ACC013
- ACCEPTANCE ACC014
<!-- /goal-slot:implementationTasks -->

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

<!-- goal-slot:strictAcceptanceChecklist required dynamic=traceEvidence -->
- [ ] ACC001 The physical script universe remains visible.: MUST prove `rg --files scripts` equals 240 and Wave 3.12 current unregistered count equals 0. Tasks=G001,G011,G012. Evidence=CMD001,CMD002,CMD030.
- [ ] ACC002 The 102-entry queue is frozen before edits.: MUST produce `migration-ledger.json` with 102 entries, required per-entry fields, required per-entry shapes, summary `sourcePlanPath/sourcePlanHash`, current `executionContractPath/executionContractHash`, and queue hash `sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea`. Tasks=G001,G002,G012. Evidence=CMD003,CMD005,CMD006,CMD026.
- [ ] ACC003 Registry state remains valid.: MUST keep registry schema valid and update Wave 3.12 entries only after direct evidence exists. Tasks=G001,G010,G011. Evidence=CMD002,CMD004,CMD027,CMD028,CMD029,CMD030.
- [ ] ACC004 Package source targets exist.: MUST produce every ledger-declared package source and dist target for migrated entries and prove existence directly from `migration-ledger.json`. Tasks=G003,G004,G005,G007. Evidence=CMD007,CMD008,CMD009,CMD010,CMD018,CMD020.
- [ ] ACC005 Forbidden root script dependency is removed for covered package runtime.: MUST prove package runtime, CLI files, dist files, and installed probes do not dispatch migrated entries through any original root `scripts/**` queue path. Tasks=G003,G004,G005,G006,G008. Evidence=CMD007,CMD008,CMD009,CMD011,CMD023,CMD024.
- [ ] ACC006 `tsx` and `ts-node` are absent from consumer runtime for covered entries.: MUST prove installed package probes and static guards report `usedTsx=false` and `usedTsNode=false`. Tasks=G002,G003,G004,G005,G006,G008. Evidence=CMD011,CMD023,CMD024.
- [ ] ACC007 Compiled fallback is not completion proof.: MUST prove covered installed-package probes report `usedCompiledFallback=false` and migrated package source plus dist output exist. Tasks=G003,G004,G005,G007,G008,G009. Evidence=CMD010,CMD023,CMD024,CMD025.
- [ ] ACC008 Root scripts are retained.: MUST prove every original queue `scripts/**` path remains present and all Wave 3.12 entries keep `deletionAllowed=false` and `deletionApprovalRef=null`. Tasks=G006,G010,G011,G012. Evidence=CMD012,CMD013,CMD027,CMD028.
- [ ] ACC009 Evidence file covers every queue entry.: MUST produce `evidence.json` with 102 entry rows and command evidence for every validated entry, plus safe-write receipt linkage for promoted governance artifacts. Tasks=G009,G010,G012. Evidence=CMD025,CMD026,CMD028,CMD029.
- [ ] ACC010 Package builds and tests pass.: MUST pass package builds and package tests for touched package surfaces through ledger-aware wrapper commands and record `not_applicable` only when wrapper evidence proves no touched target or no relevant package script. Tasks=G003,G004,G005,G007,G009. Evidence=CMD014,CMD015,CMD016,CMD017,CMD018,CMD019,CMD020,CMD021,CMD022,CMD025.
- [ ] ACC011 Install matrix passes.: MUST produce install-matrix proof for installed package CLI, runtime action, and helper probes. Tasks=G008,G009. Evidence=CMD023,CMD024,CMD026.
- [ ] ACC012 Summary projection is narrow and evidence-backed.: MUST update summary without claiming direct consumer execution for all source scripts and must distinguish the audit contract path from this execution contract path. Tasks=G009,G010,G011,G012. Evidence=CMD026,CMD029,CMD030.
- [ ] ACC013 Encoding integrity passes.: MUST run encoding gate after all text edits and record findings equal 0. Tasks=G012. Evidence=CMD031.
- [ ] ACC014 No forbidden scope expansion occurred.: MUST report no root script deletion, no registry deletion approval, no broad package write grant, no unamended queue membership changes, and no Wave 3.12 changed path outside the allowed write union after excluding pre-existing `scope-baseline.json` rows. Tasks=G006,G010,G012. Evidence=CMD010,CMD012,CMD013,CMD027,CMD028,CMD032.
<!-- /goal-slot:strictAcceptanceChecklist -->

## Acceptance Traceability Matrix

<!-- goal-slot:acceptanceTraceabilityMatrix required dynamic=traceEvidence -->
| Acceptance ID | Tasks | Evidence command IDs or artifact paths | Pass condition |
| --- | --- | --- | --- |
| ACC001 | G001,G011,G012 | CMD001,CMD002,CMD030 | MUST prove `rg --files scripts` equals 240 and Wave 3.12 current unregistered count equals 0. |
| ACC002 | G001,G002,G012 | CMD003,CMD005,CMD006,CMD026 | MUST produce `migration-ledger.json` with 102 entries, required per-entry fields, required per-entry shapes, summary `sourcePlanPath/sourcePlanHash`, current `executionContractPath/executionContractHash`, and queue hash `sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea`. |
| ACC003 | G001,G010,G011 | CMD002,CMD004,CMD027,CMD028,CMD029,CMD030 | MUST keep registry schema valid and update Wave 3.12 entries only after direct evidence exists. |
| ACC004 | G003,G004,G005,G007 | CMD007,CMD008,CMD009,CMD010,CMD018,CMD020 | MUST produce every ledger-declared package source and dist target for migrated entries and prove existence directly from `migration-ledger.json`. |
| ACC005 | G003,G004,G005,G006,G008 | CMD007,CMD008,CMD009,CMD011,CMD023,CMD024 | MUST prove package runtime, CLI files, dist files, and installed probes do not dispatch migrated entries through any original root `scripts/**` queue path. |
| ACC006 | G002,G003,G004,G005,G006,G008 | CMD011,CMD023,CMD024 | MUST prove installed package probes and static guards report `usedTsx=false` and `usedTsNode=false`. |
| ACC007 | G003,G004,G005,G007,G008,G009 | CMD010,CMD023,CMD024,CMD025 | MUST prove covered installed-package probes report `usedCompiledFallback=false` and migrated package source plus dist output exist. |
| ACC008 | G006,G010,G011,G012 | CMD012,CMD013,CMD027,CMD028 | MUST prove every original queue `scripts/**` path remains present and all Wave 3.12 entries keep `deletionAllowed=false` and `deletionApprovalRef=null`. |
| ACC009 | G009,G010,G012 | CMD025,CMD026,CMD028,CMD029 | MUST produce `evidence.json` with 102 entry rows and command evidence for every validated entry, plus safe-write receipt linkage for promoted governance artifacts. |
| ACC010 | G003,G004,G005,G007,G009 | CMD014,CMD015,CMD016,CMD017,CMD018,CMD019,CMD020,CMD021,CMD022,CMD025 | MUST pass package builds and package tests for touched package surfaces through ledger-aware wrapper commands and record `not_applicable` only when wrapper evidence proves no touched target or no relevant package script. |
| ACC011 | G008,G009 | CMD023,CMD024,CMD026 | MUST produce install-matrix proof for installed package CLI, runtime action, and helper probes. |
| ACC012 | G009,G010,G011,G012 | CMD026,CMD029,CMD030 | MUST update summary without claiming direct consumer execution for all source scripts and must distinguish the audit contract path from this execution contract path. |
| ACC013 | G012 | CMD031 | MUST run encoding gate after all text edits and record findings equal 0. |
| ACC014 | G006,G010,G012 | CMD010,CMD012,CMD013,CMD027,CMD028,CMD032 | MUST report no root script deletion, no registry deletion approval, no broad package write grant, no unamended queue membership changes, and no Wave 3.12 changed path outside the allowed write union after excluding pre-existing `scope-baseline.json` rows. |
<!-- /goal-slot:acceptanceTraceabilityMatrix -->

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

<!-- goal-slot:requiredTestCommands required dynamic=requiredCommands -->
#### CMD001

- COMMAND: pwsh.exe -NoLogo -NoProfile -Command "& { rg --files scripts | Measure-Object | Select-Object -ExpandProperty Count }"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: stdout integer equals 240
- ACCEPTANCE: ACC001

#### CMD002

- COMMAND: node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and JSON status equals passed
- ACCEPTANCE: ACC001,ACC003

#### CMD003

- COMMAND: node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); const ledgerPath='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json'; const contractPath='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md'; const j=JSON.parse(fs.readFileSync(ledgerPath,'utf8')); const expectedContractHash='sha256:'+crypto.createHash('sha256').update(fs.readFileSync(contractPath)).digest('hex'); const required=['callerSwitchPlan','runnerApi','cliProbeCommand','buildCopyPlan','testPaths','workspacePackage','targetExistenceProof','rootScriptDependencyForbidden','smokeProbe']; const errors=[]; const obj=v=>v&&typeof v==='object'&&!Array.isArray(v); const arr=Array.isArray; const str=v=>typeof v==='string'&&v.length>0; if(!arr(j.entries)||j.entries.length!==102) errors.push('entry_count'); if(j.sourcePlanPath!=='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md') errors.push('sourcePlanPath'); if(j.sourcePlanHash!=='sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af') errors.push('sourcePlanHash'); if(j.executionContractPath!==contractPath) errors.push('executionContractPath'); if(j.executionContractHash!==expectedContractHash) errors.push('executionContractHash'); if(j.queueHash!=='sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea') errors.push('queueHash'); for(const e of j.entries||[]){ const id=e.originalPath||'<unknown>'; for(const k of required) if(!(k in e)) errors.push(id+':missing:'+k); if(!arr(e.targetPaths)||e.targetPaths.length===0) errors.push(id+':targetPaths'); if(!obj(e.runnerApi)||!str(e.runnerApi.moduleFormat)||!str(e.runnerApi.exportName)||!str(e.runnerApi.cwdPolicy)||!str(e.runnerApi.argumentPolicy)||!str(e.runnerApi.stdoutPolicy)||!str(e.runnerApi.stderrPolicy)||!str(e.runnerApi.exitCodePolicy)) errors.push(id+':runnerApi'); if(!obj(e.workspacePackage)||!str(e.workspacePackage.name)||!str(e.workspacePackage.path)||!str(e.workspacePackage.packageJsonPath)||!str(e.workspacePackage.buildCommandId)||!(str(e.workspacePackage.testCommandId)||str(e.workspacePackage.testNotApplicableReason))) errors.push(id+':workspacePackage'); if(!obj(e.targetExistenceProof)||!arr(e.targetExistenceProof.sourcePaths)||e.targetExistenceProof.sourcePaths.length===0||!arr(e.targetExistenceProof.distPaths)||!arr(e.targetExistenceProof.proofCommandIds)) errors.push(id+':targetExistenceProof'); if(!obj(e.rootScriptDependencyForbidden)||!str(e.rootScriptDependencyForbidden.originalPath)||!arr(e.rootScriptDependencyForbidden.scanScopes)||!arr(e.rootScriptDependencyForbidden.forbiddenDependencyForms)||!arr(e.rootScriptDependencyForbidden.proofCommandIds)) errors.push(id+':rootScriptDependencyForbidden'); if(!obj(e.smokeProbe)||!str(e.smokeProbe.probeId)||!str(e.smokeProbe.probeType)||!str(e.smokeProbe.commandId)||!str(e.smokeProbe.cwd)||!arr(e.smokeProbe.argv)||!str(e.smokeProbe.inputFixture)||!('expectedExitCode' in e.smokeProbe)||!str(e.smokeProbe.expectedResult)||!str(e.smokeProbe.stderrPolicy)||!(str(e.smokeProbe.expectedStdout)||str(e.smokeProbe.expectedArtifactEffect))) errors.push(id+':smokeProbe'); } if(errors.length){console.error(JSON.stringify({errors},null,2)); process.exit(1);} console.log(JSON.stringify({entries:j.entries.length,queueHash:j.queueHash,sourcePlanPath:j.sourcePlanPath,executionContractPath:j.executionContractPath,executionContractHash:j.executionContractHash,requiredFields:required.length,shape:'passed'}))"
- COMMAND: node -e "const fs=require('node:fs'); const ledgerPath='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json'; const allowed=new Set(['package_import','package_cli','installed_package_require']); const j=JSON.parse(fs.readFileSync(ledgerPath,'utf8')); const invalid=(j.entries||[]).filter(e=>!e.smokeProbe||!allowed.has(e.smokeProbe.probeType)).map(e=>({originalPath:e.originalPath,probeType:e.smokeProbe&&e.smokeProbe.probeType})); if(invalid.length){console.error(JSON.stringify({invalidSmokeProbeTypes:invalid},null,2)); process.exit(1);} console.log(JSON.stringify({entries:(j.entries||[]).length,smokeProbeTypeEnum:[...allowed].sort(),shape:'passed'}))"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: both commands exit code 0 and stdout reports 102 entries, expected queueHash, expected summary source plan path/hash, current execution contract path/hash, all required per-entry ledger fields including `smokeProbe`, ledger field shapes passed, and every `smokeProbe.probeType` is one of `package_import`, `package_cli`, or `installed_package_require`
- ACCEPTANCE: ACC002

#### CMD004

- COMMAND: node tools/script-migration/validate-registry.cjs
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and JSON status equals passed
- ACCEPTANCE: ACC003

#### CMD005

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase bootstrap
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and bootstrap phase reports validation surfaces, ledger schema, scope baseline, and safe-write receipts for `migration-ledger.json` plus `scope-baseline.json` are present
- ACCEPTANCE: ACC002

#### CMD006

- COMMAND: pwsh.exe -NoLogo -NoProfile -Command "& { $env:BMAD_WAVE_3_12_CONTRACT_TEST_PHASE='bootstrap'; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts }"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 in bootstrap mode and test does not require evidence.json, install-matrix.json, or finalized registry rows
- ACCEPTANCE: ACC002

#### CMD007

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase actions
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and action phase reports 28 consumer runtime reachable entries implemented
- ACCEPTANCE: ACC004,ACC005

#### CMD008

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase helpers
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and helper phase reports 65 package runtime helper entries implemented
- ACCEPTANCE: ACC004,ACC005

#### CMD009

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase public-cli
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and public-cli phase reports 9 public CLI entries implemented
- ACCEPTANCE: ACC004,ACC005

#### CMD010

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase target-existence
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and every ledger-declared package source plus dist target exists
- ACCEPTANCE: ACC004,ACC007,ACC014

#### CMD011

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase caller-switch
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and package source plus package bin report no forbidden root script dependency, no tsx, and no ts-node before install proof exists
- ACCEPTANCE: ACC005,ACC006

#### CMD012

- COMMAND: node -e "const fs=require('node:fs'); const j=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json','utf8')); const missing=j.entries.map(e=>e.originalPath).filter(p=>!fs.existsSync(p)); if(missing.length){console.error(JSON.stringify({missing})); process.exit(1);} console.log(JSON.stringify({checked:j.entries.length}))"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and stdout reports 102 retained original root script paths
- ACCEPTANCE: ACC008,ACC014

#### CMD013

- COMMAND: git status --short -- scripts
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: stdout contains no deleted path marker for `scripts/**`
- ACCEPTANCE: ACC008,ACC014

#### CMD014

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/scoring --target-prefix packages/scoring --command "npm run build --prefix packages/scoring"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper either ran scoring build for touched `packages/scoring/**` targets or emitted validated not_applicable evidence with ledger query
- ACCEPTANCE: ACC010

#### CMD015

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/runtime-context --target-prefix packages/runtime-context --command "npm run build --prefix packages/runtime-context"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper either ran runtime-context build for touched `packages/runtime-context/**` targets or emitted validated not_applicable evidence with ledger query
- ACCEPTANCE: ACC010

#### CMD016

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/runtime-emit --target-prefix packages/runtime-emit --command "npm run build --prefix packages/runtime-emit"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper either ran runtime-emit build for touched `packages/runtime-emit/**` targets or emitted validated not_applicable evidence with ledger query
- ACCEPTANCE: ACC010

#### CMD017

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/ralph-method --target-prefix packages/ralph-method --command "npm run build --prefix packages/ralph-method"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper either ran ralph-method build for touched `packages/ralph-method/**` targets or emitted validated not_applicable evidence with ledger query
- ACCEPTANCE: ACC010

#### CMD018

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind build --package packages/bmad-speckit --target-prefix packages/bmad-speckit --command "npm run build:main-agent-dist --prefix packages/bmad-speckit"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper runs bmad-speckit main-agent dist build for touched package targets
- ACCEPTANCE: ACC004,ACC010

#### CMD019

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test --package packages/scoring --target-prefix packages/scoring --command "npm run test --prefix packages/scoring"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper either ran scoring tests for touched `packages/scoring/**` targets or emitted validated not_applicable evidence with ledger query
- ACCEPTANCE: ACC010

#### CMD020

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test --package packages/bmad-speckit --target-prefix packages/bmad-speckit --command "npm run test --prefix packages/bmad-speckit"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and wrapper runs bmad-speckit tests for touched package targets
- ACCEPTANCE: ACC004,ACC010

#### CMD021

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-package-command.cjs --kind test-not-applicable --package packages/runtime-context --target-prefix packages/runtime-context --package packages/runtime-emit --target-prefix packages/runtime-emit --package packages/ralph-method --target-prefix packages/ralph-method --package packages/schema --target-prefix packages/schema
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and stdout or evidence records package.json script inspection plus touched-target query evidence for workspace package test not_applicable rows
- ACCEPTANCE: ACC010

#### CMD022

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase builds
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and builds phase maps package build and test evidence to touched ledger targets
- ACCEPTANCE: ACC010

#### CMD023

- COMMAND: node tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs --write
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and install-matrix rows report usedRootScript=false usedTsx=false usedTsNode=false usedCompiledFallback=false, `categoryCoverage` covers `consumer_runtime_reachable`, `package_runtime_helper`, and `public_cli`, and every install sandbox path is under `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-sandbox/**`
- ACCEPTANCE: ACC005,ACC006,ACC007,ACC011

#### CMD024

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase install
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and install phase verifies installed CLI, action, and helper probes, install sandbox confinement, required `categoryCoverage`, and no root package or lockfile mutation from install proof
- ACCEPTANCE: ACC005,ACC006,ACC007,ACC011

#### CMD025

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase evidence
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and evidence phase reports every queue entry has `evidenceCommandIds`, `result=passed`, `validationStatus=passed`, a recorded `smokeProbe` result, package command or installed probe references, artifact hash references for produced targets, and safe-write receipt linkage for promoted artifacts
- ACCEPTANCE: ACC007,ACC009,ACC010

#### CMD026

- COMMAND: node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); const contractPath='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md'; const expectedContractHash='sha256:'+crypto.createHash('sha256').update(fs.readFileSync(contractPath)).digest('hex'); const e=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json','utf8')); const r=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/safe-write-receipts.json','utf8')); const m=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json','utf8')); if((e.entries||[]).length!==102) process.exit(1); if(e.queueHash!=='sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea') process.exit(2); if(e.sourcePlanPath!=='repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md') process.exit(3); if(e.sourcePlanHash!=='sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af') process.exit(4); if(e.executionContractPath!==contractPath) process.exit(5); if(e.executionContractHash!==expectedContractHash) process.exit(6); if(e.auditContractPath!=='docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md') process.exit(7); const coverage=m.categoryCoverage||{}; for(const k of ['consumer_runtime_reachable','package_runtime_helper','public_cli']){ if(!coverage[k]){ console.error(JSON.stringify({missingCategoryCoverage:k})); process.exit(8); }} const receipts=r.receipts||[]; for(const target of ['repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json','repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json','repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/package-command-evidence.json']){ if(!receipts.some(x=>x.targetPath===target&&x.status==='passed')){console.error(JSON.stringify({missingReceipt:target})); process.exit(9);} } console.log(JSON.stringify({entries:e.entries.length,queueHash:e.queueHash,sourcePlanPath:e.sourcePlanPath,executionContractPath:e.executionContractPath,executionContractHash:e.executionContractHash,auditContractPath:e.auditContractPath,safeWriteReceipts:receipts.length,categoryCoverage:Object.keys(coverage).sort()}))"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and evidence reports 102 entries, expected queueHash, expected source plan path/hash, current execution contract path/hash, audit contract path, install-matrix category coverage, and safe-write receipt linkage for evidence, install matrix, and package command evidence artifacts
- ACCEPTANCE: ACC002,ACC009,ACC011,ACC012

#### CMD027

- COMMAND: node tools/script-migration/validate-registry.cjs
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 after Wave 3.12 registry finalization
- ACCEPTANCE: ACC003,ACC008,ACC014

#### CMD028

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase final
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and final phase verifies registry finalization, Wave 3.12 registry `title` includes `runtime migration`, Wave 3.12 registry `title` no longer ends as `full physical script closure audit`, deletionAllowed=false, deletionApprovalRef=null, and no unamended queue membership changes
- ACCEPTANCE: ACC003,ACC008,ACC009,ACC014

#### CMD029

- COMMAND: pwsh.exe -NoLogo -NoProfile -Command "& { $env:BMAD_WAVE_3_12_CONTRACT_TEST_PHASE='final'; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts tests/acceptance/script-migration-full-physical-closure.test.ts tests/acceptance/script-migration-registry-contract.test.ts }"
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 in final mode and tests validate evidence coverage, registry finalization including the Wave 3.12 runtime migration title closeout, safe-write receipts, deletion denial, and full physical closure
- ACCEPTANCE: ACC003,ACC009,ACC012

#### CMD030

- COMMAND: node tools/script-migration/audit-full-physical-script-closure.cjs --check --pretty
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 after summary update
- ACCEPTANCE: ACC001,ACC003,ACC012

#### CMD031

- COMMAND: node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and stdout contains findings=0
- ACCEPTANCE: ACC013

#### CMD032

- COMMAND: node tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs --phase scope
- CWD: D:\Dev\BMAD-Speckit-SDD-Flow
- PASS: exit code 0 and scope phase reports every Wave 3.12 changed path is in the ledger-derived allowed write union, explicit contract write union, or pre-existing `scope-baseline.json` dirty-worktree baseline; no broad package write grant is accepted
- ACCEPTANCE: ACC014
<!-- /goal-slot:requiredTestCommands -->

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

<!-- goal-slot:manualVerificationScenarios required dynamic=manualScenarios -->
- MANUAL MS001: Inspect `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json` and verify that the first and last queue entries match the source summary queue order. Evidence artifact: `migration-ledger.json` field `queueOrderProof`.
- MANUAL MS002: Inspect `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md` and verify it states that Wave 3.12 does not claim all source repository scripts are directly executable in consumer projects. Evidence artifact: summary paragraph under `Residual Risk` or its closeout successor section.
- MANUAL MS003: Inspect `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json` and verify at least one installed package probe covers each queue category `consumer_runtime_reachable`, `package_runtime_helper`, and `public_cli`. Evidence artifact: `install-matrix.json` field `categoryCoverage`.
- MANUAL MS004: Inspect `git status --short -- scripts` output and verify no line begins with `D ` for a root script. Evidence command: CMD013.
<!-- /goal-slot:manualVerificationScenarios -->

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

<!-- goal-slot:completionEvidencePacket required dynamic=evidencePacket -->
- EVD001: Final response MUST include `sourcePlanPath=repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md` and `sourcePlanHash=sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af`.
- EVD002: Final response MUST include `queueHash=sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea`, `executionContractPath=docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md`, `executionContractHash`, and the final count of validated queue entries from `evidence.json`.
- EVD003: Final response MUST include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json` SHA256.
- EVD004: Final response MUST include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json` SHA256.
- EVD005: Final response MUST include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-matrix.json` SHA256 when G008 creates that file.
- EVD006: Final response MUST include `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md` SHA256.
- EVD007: Final response MUST list every required command ID, command line, exit code, and pass or fail state.
- EVD008: Final response MUST list remaining pending scripts when any ledger entry has `validationStatus` not equal to `passed`.
- EVD009: Final response MUST state `root script deletion approval: false for all Wave 3.12 entries` when registry validation proves it.
- EVD010: Final response MUST include encoding gate output summary from CMD031.
<!-- /goal-slot:completionEvidencePacket -->

## Stop Conditions

<!-- goal-slot:stopConditions required dynamic=stopConditions -->
- STOP `contract_amendment_required:queue_membership_changed` when the Wave 3.12 queue is not exactly the 102 paths from the source summary and queue hash `sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea`.
- STOP `blocked_by_contract_ambiguity:ledger_original_path` when a queue entry target path, public command, package owner, runner API, caller switch plan, build copy plan, test path, workspace package, or validation command cannot be derived from the registry entry, source script, and package target path.
- STOP `semantic_decision_required:validated_non_queue_record` when execution finds direct consumer runtime reachability evidence for any of the 27 validated non-migration records.
- STOP `scope_amendment_required:ledger_original_path` when a queue entry requires a write outside the union of ledger `targetPaths`, ledger `callerSwitchPlan[].targetPath`, ledger `buildCopyPlan[].targetPath`, ledger `testPaths`, `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/**`, `repo-governance/script-migration-registry.yaml`, `package.json`, `packages/bmad-speckit/package.json`, `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`, `packages/bmad-speckit/tests/main-agent-wave-3-12-runtime-modules.test.js`, `packages/bmad-speckit/tests/main-agent-wave-3-12-durable-helpers.test.js`, `packages/bmad-speckit/tests/main-agent-wave-3-12-public-cli.test.js`, `tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs`, `tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs`, `tools/script-migration/run-main-agent-wave-3-12-package-command.cjs`, `tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs`, and `tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts`.
- STOP `root_script_deletion_forbidden:ledger_original_path` before deleting, moving, renaming, or marking deletion-approved any file under `scripts/**`.
- STOP `consumer_runtime_root_script_dependency:ledger_original_path` when package runtime, package CLI, package dist, installed CLI probe, installed action probe, or installed helper probe imports, requires, spawns, shells out to, or otherwise dispatches any original root `scripts/**` queue path.
- STOP `consumer_runtime_root_ts_dependency:ledger_original_path` when package runtime for a migrated entry imports or executes root `scripts/*.ts`; this condition is a TypeScript-specific subset of `consumer_runtime_root_script_dependency`.
- STOP `consumer_runtime_tsx_dependency:ledger_original_path` when installed package proof requires `tsx`.
- STOP `consumer_runtime_ts_node_dependency:ledger_original_path` when installed package proof requires `ts-node`.
- STOP `compiled_fallback_completion_claim:ledger_original_path` when covered behavior is proven only by compiled fallback instead of migrated package source and dist output.
- STOP `registry_validation_failed` when `node tools/script-migration/validate-registry.cjs` exits non-zero.
- STOP `install_matrix_failed` when `node tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs --write` exits non-zero or omits required false flags.
- STOP `encoding_integrity_failed` when `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` exits non-zero or reports findings greater than 0.
- STOP `docs_plan_rewrite_forbidden` when `/goal` attempts to rewrite this contract instead of executing tasks.
<!-- /goal-slot:stopConditions -->
