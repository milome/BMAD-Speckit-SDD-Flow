# Goal Execution Contract

<!-- goal-slot:frontMatter required dynamic=frontMatter -->
---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:67e4ffbae2182adfcb8838e7a4345b8cdd0339898848203996266220187036e4
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json
sourcePlanHash: sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31
sourceBytes: 735064
sourceLines: 22288
coverageReceiptPath: docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json
generationReceiptPath: docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.generation-receipt.json
unmappedSourceObligations: 0
runtimeRecordId: main-agent-runtime-migration-wave-4.1
entryFlow: full_equivalent_no_fallback_runtime_migration_wave_4_1
taskRange: G001-G015
acceptanceRange: ACC001-ACC025
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: execute_declared_wave_4_1_tasks_and_automatic_rework_loop_until_strict_acceptance_passes
stopPolicy: stop_only_on_contract_gap_scope_expansion_hash_mismatch_or_unresolvable_semantic_decision
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-20T04:54:53.204+08:00
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
/goal docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.md
```
<!-- /goal-slot:goalEntry -->

The full execution contract is this document, not the command text.

## Contract Freeze Rules

- `/goal` must not rewrite this contract.
- `/goal` must not replace this contract with a different task list, acceptance matrix, completion gate, authority model.
- `/goal` must not convert this template into a JSON-generates-Markdown design.
- `/goal` must not convert a consumer compiler into a hardcoded local Markdown string that bypasses shared template slots.
- If this contract is incomplete, `/goal` must stop with `contract_amendment_required` and list the missing fields.
- If acceptance criteria are insufficient, `/goal` must stop with `contract_amendment_required`; it must not silently add stricter acceptance criteria while executing.
- If a task requires files outside its declared write scope, `/goal` must stop with `scope_amendment_required` unless this contract explicitly allows scope expansion.
- If a requirement semantic decision is missing, `/goal` must stop with `semantic_decision_required`.
- If a validation command is unavailable, ambiguous, and not produced by a declared earlier task and not produced by the current task in this contract, `/goal` must stop with `validation_contract_required`.

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
- `Source Coverage Matrix`
- `Required Test Commands`
- `Manual Verification Scenarios`
- `Completion Evidence Packet`
- `Stop Conditions`

Before editing files, verify the frozen front matter has no unresolved placeholders and that every required slot was rendered.

Source-plan contracts require front matter fields `sourcePlanHash`, `coverageReceiptPath`, and `unmappedSourceObligations: 0`.

Fail closed when any required section, field, task ID, acceptance ID, evidence command, matrix row, slot, invariant fragment is missing.

## Non-Negotiable Execution Rules

- Use the shell required by the host environment and repository rules.
- Use `apply_patch` for manual code and documentation edits.
- Run the project encoding gate before and after Markdown, JSON, skill, command, generated-surface edits when the repository provides one.
- Inspect `git status --short` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output and direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, audit prose alone.
- Do not weaken the declared authority model, machine-readable source bindings, or machine-readable evidence indexes.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, tests.

## Authority Model

<!-- goal-slot:authorityModel required dynamic=authorityModel -->
- `docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.md` is the frozen human-facing execution contract and model-consumable contract prose for Wave 4.1 implementation; it is not an executable JSON authority and is not an independent requirement source.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json` is the machine-readable Wave 4.1 full physical script universe source.
- `sourcePlanHash=sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31` binds this contract to the exact 240-script inventory bytes.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json` is the machine-readable Wave 4.1 backlog migration subset source for 206 rows.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json` is the machine-readable package source parity baseline.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json` is the machine-readable physical script inventory baseline.
- `repo-governance/script-migration-registry.yaml` is the registry authority for entry IDs, original paths, migration strategies, target paths, blockers, validation status, and evidence paths.
- `docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json` is source coverage evidence for this generated contract after it is written.
- `docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.generation-receipt.json` is generation evidence for this generated contract after it is written.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json` is the per-entry execution ledger that G001 MUST create from all 240 source inventory rows.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/evidence.json` is the current-attempt command evidence packet that G015 MUST write after every command passes.
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/summary.md` is the human completion summary that G012 MUST write after registry and evidence gates pass.
- `model_packet.json is the machine-readable execution authority` only when a req-trace execution packet exists for the same implementation run.
- `goal_execution.md is not an independent requirement source`; this Markdown contract binds the `/goal` run to the frozen human-facing execution contract while JSON receipts and generated packets provide machine-readable evidence indexes.
- `/goal completion is not closeout proof`; closeout proof requires ACC001 through ACC025 and CMD001 through CMD016 to pass with current-attempt evidence.
<!-- /goal-slot:authorityModel -->

## Root Cause To Fix

<!-- goal-slot:rootCause required dynamic=rootCause -->
Wave 4.0 rebaseline established that the root script universe has 240 physical scripts, 206 backlog migration entries, and 34 settled entries that were excluded from the backlog queue. The backlog entries remain blocked because package source authority, behavior parity, package dist output, installed consumer invocation, registry validation, and no-fallback proof are incomplete.

The defect to fix in Wave 4.1 is not registry visibility. The defect is that 206 backlog entries still depend on incomplete package source, descriptor-only helpers, report-only actions, missing source equivalents, size-delta parity gaps, or alias/runtime emission seams that do not prove full equivalent package behavior.

Wave 4.1 MUST give every one of the 240 frozen `scripts/**` rows from repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json a non-empty packageImplementationSet with one or more package-owned implementation paths, full equivalent behavior, byte and LOC size-delta evidence, dist output when runtime output is affected, installed package proof when consumer invocation is affected, and no root script fallback. The 206 backlog rows and 34 settled rows remain separate source classifications only; neither classification creates an exception to package equivalence, packageImplementationSet, size-delta, or no-fallback acceptance. Wave 4.1 MUST NOT claim completion from report-only package actions, descriptor-only helpers, compatibility aliases that call root scripts, generated receipts, registry status text, command exit code without behavior proof, documented size-delta waivers, or a no-fallback scan that covers fewer than 240 original script paths.
<!-- /goal-slot:rootCause -->

## Domain-Specific Contract Addenda

Use this section to bind any domain-specific classifier, state machine, schema, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, additional machine contract.

<!-- goal-slot:domainAddenda required dynamic=domainAddenda -->
### D001 Source Scope And Hash Contract

- D001.MUST.001: `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json` MUST have SHA256 `sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31` before G001 starts and before G015 completes.
- D001.MUST.002: `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json` MUST have SHA256 `sha256:3b3ccf1b1a88d9f7dd559413e4bcb502d0cdf7305b308b64e2b12f26ac42ddb5` before G001 starts and before G015 completes.
- D001.MUST.003: `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json` MUST have SHA256 `sha256:9d69564dc665ba50eb40fab76a955a8880602963dd57667f6b8d308074629dee` before G001 starts and before G015 completes.
- D001.MUST.004: `repo-governance/script-migration-registry.yaml` baseline hash `sha256:9c86cac253049e18b4c126994817c6786f7d115800884eac0348e4d18ad8cf33` MUST be recorded in `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/scope-baseline.json` before registry edits.
- D001.MUST.005: Full universe totals MUST equal `allScripts=240`, `backlog_migration=206`, `settled_revalidation=34`.
- D001.MUST.006: Backlog queue totals MUST equal `allScripts=240`, `backlog=206`, `blockerKinds=233`.
- D001.MUST.007: Backlog priority totals MUST equal `P1-real-package-source-required=107, P3-parity-evidence-and-size-ledger=18, P2-helper-and-functional-evidence=80, P0-core-source-authority=1`.
- D001.MUST.008: Backlog strategy totals MUST equal `package_runtime_module=96, durable_helper_copy=85, public_cli_de_surface=14, compatibility_alias=10, runtime_emit_cjs=1`.

### D002 Backlog State Machine Contract

- D002.MUST.001: Every queue row MUST start from its `latestRegistryState` in `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json`.
- D002.MUST.002: Every queue row MUST end with `migrationStatus=validated` in `repo-governance/script-migration-registry.yaml`.
- D002.MUST.003: Every queue row MUST end with `validationStatus=passed` in `repo-governance/script-migration-registry.yaml`.
- D002.MUST.004: Every queue row MUST end with an empty `migrationBlockers` array in `repo-governance/script-migration-registry.yaml`.
- D002.MUST.005: Every queue row MUST end with `deletionAllowed=false` in `repo-governance/script-migration-registry.yaml`.
- D002.MUST.006: Every queue row MUST end with at least one current-attempt evidence path under `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/`.
- D002.MUST.007: The Wave 4.1 registry wave record MUST have `waveId=main-agent-runtime-migration-wave-4.1`, `status=completed`, `refinesWaveId=main-agent-runtime-migration-wave-4.0-rebaseline`, and `contractPath=docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.md`.
- D002.MUST.008: Every settled revalidation row MUST remain `migrationStatus=validated` and `validationStatus=passed`.
- D002.MUST.009: Every settled revalidation row MUST receive Wave 4.1 current-attempt package equivalence evidence under `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/`.
- D002.MUST.010: No settled revalidation row may be used as fallback proof for a backlog migration row.
- D002.MUST.011: No settled revalidation row may bypass packageImplementationSet, size-delta decision, behavior proof, or full-inventory no-fallback proof.

### D003 Full Equivalence And No-Fallback Contract

- D003.MUST.001: Every one of the 240 frozen `scripts/**` rows MUST have a non-empty `packageImplementationSet` containing one or more package-owned implementation paths.
- D003.MUST.002: Each `packageImplementationSet` MUST contain at least one installed-package implementation path under `packages/bmad-speckit/src/**` or `packages/bmad-speckit/bin/**`; a package build script, dist path, generated receipt path, registry path, or test path alone MUST NOT satisfy this field.
- D003.MUST.003: Every `package_runtime_module` row MUST have package source under `packages/bmad-speckit/src/main-agent/actions/`, `packages/bmad-speckit/src/main-agent/helpers/`, `packages/bmad-speckit/src/main-agent/runtime/`, or another target path already listed for that row in `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json`.
- D003.MUST.004: Every `durable_helper_copy` row MUST have executable package helper source that preserves the observable behavior of the original root script.
- D003.MUST.005: Every `public_cli_de_surface` row MUST have a package CLI route under `packages/bmad-speckit/src/commands/` and a bin dispatch path under `packages/bmad-speckit/bin/bmad-speckit.js`.
- D003.MUST.006: Every `compatibility_alias` row MUST dispatch only to package source or package bin code and MUST NOT import, require, spawn, shell, or text-dispatch the original root script path.
- D003.MUST.007: The `runtime_emit_cjs` row MUST produce package runtime source and package dist output without treating generated CJS output as source authority.
- D003.MUST.008: No package source, dist file, bin file, test fixture, or installed consumer surface may call any of the 240 source-inventory original paths under `scripts/**`.
- D003.MUST.009: No Wave 4.1 success proof may use `tsx`, `ts-node`, root `scripts/**` execution, compiled fallback, descriptor-only helper text, report-only action text, or registry-only status.

### D004 Ledger Schema Contract

- D004.MUST.001: `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json` MUST contain exactly 240 `entries` rows.
- D004.MUST.002: Each ledger row MUST contain `originalPath`, `entryId`, `scopeClass`, `priority`, `migrationStrategy`, `preliminaryParityStatus`, `sourceSha256`, `targetPaths`, `packageImplementationSet`, `changedFiles`, `behaviorParityProof`, `packageSourceProof`, `distProof`, `installProof`, `registryProof`, `noFallbackProof`, `originalBytes`, `originalLoc`, `packageBytes`, `packageLoc`, `packageByteRatio`, `packageLocRatio`, `sizeDeltaThreshold`, `sizeDeltaDecision`, `sizeDeltaProof`, `reworkHistory`, and `acceptanceIds`.
- D004.MUST.003: `behaviorParityProof` MUST contain at least one behavior test path, CLI output assertion, source seam static assertion, or receipt field assertion for the row.
- D004.MUST.004: `packageSourceProof` MUST contain a source path under `packages/bmad-speckit/src/**` or a bin dispatch path under `packages/bmad-speckit/bin/**` and MUST match at least one path in `packageImplementationSet`.
- D004.MUST.005: `distProof` MUST contain a generated path under `packages/bmad-speckit/dist/**` when the row affects installed runtime output.
- D004.MUST.006: `installProof` MUST contain evidence IDs from no-save, save-dev, npx-package, and init-sync-consumer install matrix runs when the row affects consumer invocation.
- D004.MUST.007: `noFallbackProof` MUST contain a scan command ID and the scan result MUST state `scannedOriginalPathCount=240`, `scanCoverageRows=240`, and `forbiddenHitCount=0`.
- D004.MUST.008: `originalBytes` and `originalLoc` MUST be computed from the frozen row `originalPath` in `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json`.
- D004.MUST.009: `packageBytes` and `packageLoc` MUST be computed from the aggregate files listed in `packageImplementationSet`.
- D004.MUST.010: `packageByteRatio` MUST equal `packageBytes / originalBytes` rounded to four decimals when `originalBytes > 0`.
- D004.MUST.011: `packageLocRatio` MUST equal `packageLoc / originalLoc` rounded to four decimals when `originalLoc > 0`.
- D004.MUST.012: `sizeDeltaDecision` MUST equal `passed_within_strict_threshold` before the Wave 4.1 validator marks a row passed.
- D004.MUST.013: Any `packageByteRatio` or `packageLocRatio` outside 0.70 through 1.30 inclusive MUST immediately set the row validation result to `failed_strict_size_delta`, MUST set `reworkRequired=true`, and MUST NOT be converted into a waiver or documented pass.
- D004.MUST.014: CMD013 MUST fail closed when `originalBytes <= 0`, `originalLoc <= 0`, `packageBytes <= 0`, or `packageLoc <= 0`.

### D005 Validation Surface Contract

- D005.MUST.001: G002 MUST create or update `tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs`.
- D005.MUST.002: G002 MUST create or update `tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs`.
- D005.MUST.003: G002 MUST create or update `tools/script-migration/write-main-agent-wave-4-1-evidence.cjs`.
- D005.MUST.004: G002 MUST create or update `tests/acceptance/main-agent-runtime-migration-wave-4-1-contract.test.ts`.
- D005.MUST.005: The Wave 4.1 validator MUST fail closed with `reworkRequired=true` when any row uses report-only package source, descriptor-only helper source, root script dispatch, `tsx`, `ts-node`, compiled fallback, missing package source, missing packageImplementationSet, missing size-delta decision, size-delta threshold violation, missing dist output, missing install matrix proof, missing behavior proof, stale registry status, or no-fallback scan coverage below 240.

### D006 Priority And Strategy Cross Counts

| Priority and strategy | Count |
| --- | ---: |
| P0-core-source-authority \| package_runtime_module | 1 |
| P1-real-package-source-required \| compatibility_alias | 1 |
| P1-real-package-source-required \| durable_helper_copy | 2 |
| P1-real-package-source-required \| package_runtime_module | 91 |
| P1-real-package-source-required \| public_cli_de_surface | 12 |
| P1-real-package-source-required \| runtime_emit_cjs | 1 |
| P2-helper-and-functional-evidence \| durable_helper_copy | 74 |
| P2-helper-and-functional-evidence \| package_runtime_module | 4 |
| P2-helper-and-functional-evidence \| public_cli_de_surface | 2 |
| P3-parity-evidence-and-size-ledger \| compatibility_alias | 9 |
| P3-parity-evidence-and-size-ledger \| durable_helper_copy | 9 |

### D007 Full Script Universe Scope

| Scope row | Original path | Scope class | Priority | Strategy | Preliminary parity status | Ratio | Entry ID | Migration status | Validation status | Target path count | Blocker count |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | ---: | ---: |
| Q001 | scripts/main-agent-orchestration.ts | backlog_migration | P0-core-source-authority | package_runtime_module | package_source_size_below_70_percent | 0.0462 | main-agent-orchestration | blocked | partial | 14 | 1 |
| Q002 | scripts/bmad-speckit-cli.js | backlog_migration | P1-real-package-source-required | compatibility_alias | missing_package_source_equivalent | 0 | bmad-speckit-cli-js | blocked | blocked | 2 | 1 |
| Q003 | scripts/runtime-context-registry.ts | backlog_migration | P1-real-package-source-required | durable_helper_copy | package_source_size_below_70_percent | 0.5746 | runtime-context-registry-ts | blocked | blocked | 1 | 2 |
| Q004 | scripts/write-runtime-context.cjs | backlog_migration | P1-real-package-source-required | durable_helper_copy | missing_package_source_equivalent | 0 | write-runtime-context | blocked | blocked | 3 | 2 |
| Q005 | scripts/adaptive-intake-governance-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0237 | adaptive-intake-governance-gate | blocked | partial | 5 | 2 |
| Q006 | scripts/adaptive-intake-proof-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0604 | adaptive-intake-proof-gate | blocked | partial | 5 | 2 |
| Q007 | scripts/ai-tdd-contract-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0034 | ai-tdd-contract-gate | blocked | partial | 5 | 2 |
| Q008 | scripts/analytics-sft-extract.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.2809 | analytics-sft-extract-ts | blocked | partial | 1 | 1 |
| Q009 | scripts/assert-implementation-entry.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.149 | assert-implementation-entry-ts | blocked | partial | 1 | 1 |
| Q010 | scripts/audit-stage-routing.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0174 | audit-stage-routing | blocked | partial | 5 | 2 |
| Q011 | scripts/auditor-post-actions.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.2033 | auditor-post-actions | blocked | partial | 5 | 2 |
| Q012 | scripts/auditor-spec.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1171 | auditor-spec | blocked | partial | 5 | 2 |
| Q013 | scripts/bmad-config.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0131 | bmad-config-ts | blocked | partial | 1 | 1 |
| Q014 | scripts/bmad-runtime-worker.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0114 | bmad-runtime-worker | blocked | partial | 5 | 2 |
| Q015 | scripts/check-sprint-ready.ps1 | backlog_migration | P1-real-package-source-required | package_runtime_module | within_size_threshold_pending_evidence | 0.9966 | check-sprint-ready-ps1 | blocked | partial | 1 | 1 |
| Q016 | scripts/check-sprint-ready.sh | backlog_migration | P1-real-package-source-required | package_runtime_module | within_size_threshold_pending_evidence | 1.0545 | check-sprint-ready-sh | blocked | partial | 1 | 1 |
| Q017 | scripts/dashboard-generate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0415 | dashboard-generate-ts | blocked | partial | 1 | 1 |
| Q018 | scripts/e2e-dual-host-journey-runner.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | within_size_threshold_pending_evidence | 1.1806 | e2e-dual-host-journey-runner | blocked | partial | 5 | 2 |
| Q019 | scripts/e2e-host-matrix-journey-runner.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0158 | e2e-host-matrix-journey-runner | blocked | partial | 5 | 2 |
| Q020 | scripts/final-closeout-evidence-runner.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.062 | final-closeout-evidence-runner | blocked | partial | 5 | 2 |
| Q021 | scripts/governance-execution-result-ingestor.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0426 | governance-execution-result-ingestor-ts | blocked | partial | 1 | 1 |
| Q022 | scripts/governance-hook-types.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.08 | governance-hook-types-ts | blocked | partial | 1 | 1 |
| Q023 | scripts/governance-packet-dispatch-worker.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0477 | governance-packet-dispatch-worker | blocked | partial | 5 | 2 |
| Q024 | scripts/governance-provider-adapter.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.02 | governance-provider-adapter-ts | blocked | partial | 1 | 1 |
| Q025 | scripts/governance-runtime-queue.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.087 | governance-runtime-queue-ts | blocked | partial | 1 | 1 |
| Q026 | scripts/governance-stage-event-emitter.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1369 | governance-stage-event-emitter-ts | blocked | partial | 1 | 1 |
| Q027 | scripts/i18n/print-resolved-audit-prompt.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.4289 | print-resolved-audit-prompt | blocked | partial | 5 | 2 |
| Q028 | scripts/i18n/render-audit-block-cli.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1886 | render-audit-block-cli | blocked | partial | 5 | 2 |
| Q029 | scripts/i18n/render-template.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0996 | i18n-render-template-ts | blocked | partial | 1 | 1 |
| Q030 | scripts/ingest-architecture-confirmation.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0129 | ingest-architecture-confirmation-ts | blocked | partial | 1 | 1 |
| Q031 | scripts/ingest-implementation-evidence.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0072 | ingest-implementation-evidence | blocked | partial | 5 | 2 |
| Q032 | scripts/initialize-six-model-requirement-confirmation.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0546 | initialize-six-model-requirement-confirmation | blocked | partial | 5 | 2 |
| Q033 | scripts/live-smoke-main-agent-runtime.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.043 | live-smoke-main-agent-runtime | blocked | partial | 5 | 2 |
| Q034 | scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1477 | main-agent-ai-tdd-closeout-remediation-adapter | blocked | partial | 5 | 2 |
| Q035 | scripts/main-agent-audit-review-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0209 | main-agent-audit-review-gate | blocked | partial | 5 | 2 |
| Q036 | scripts/main-agent-bmad-artifact-hardcut.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0197 | main-agent-bmad-artifact-hardcut | blocked | partial | 5 | 2 |
| Q037 | scripts/main-agent-chaos-scenarios.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.2807 | main-agent-chaos-scenarios | blocked | partial | 4 | 2 |
| Q038 | scripts/main-agent-codex-worker-adapter.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.027 | main-agent-codex-worker-adapter | blocked | partial | 4 | 2 |
| Q039 | scripts/main-agent-compiled-prompt-runner.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1027 | main-agent-compiled-prompt-runner | blocked | partial | 4 | 2 |
| Q040 | scripts/main-agent-control-plane-isolation-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0337 | main-agent-control-plane-isolation-check | blocked | partial | 5 | 2 |
| Q041 | scripts/main-agent-data-governance-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.026 | main-agent-data-governance-gate | blocked | partial | 5 | 2 |
| Q042 | scripts/main-agent-dataset-release-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0108 | main-agent-dataset-release-gate | blocked | partial | 5 | 2 |
| Q043 | scripts/main-agent-decision-field-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0685 | main-agent-decision-field-check | blocked | partial | 5 | 2 |
| Q044 | scripts/main-agent-delivery-closeout-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0149 | main-agent-delivery-closeout-gate | blocked | partial | 4 | 2 |
| Q045 | scripts/main-agent-delivery-evidence-run.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.3059 | main-agent-delivery-evidence-run | blocked | partial | 4 | 2 |
| Q046 | scripts/main-agent-delivery-truth-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1021 | main-agent-delivery-truth-gate | blocked | blocked | 5 | 2 |
| Q047 | scripts/main-agent-development-journey-matrix.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0509 | main-agent-development-journey-matrix | blocked | partial | 5 | 2 |
| Q048 | scripts/main-agent-dual-host-pr-orchestrator.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_delta_exceeds_threshold | 5.1739 | main-agent-dual-host-pr-orchestrator | blocked | partial | 4 | 2 |
| Q049 | scripts/main-agent-entryflow-traceability-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.021 | main-agent-entryflow-traceability-check | blocked | partial | 5 | 2 |
| Q050 | scripts/main-agent-execution-closure-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0172 | main-agent-execution-closure-gate | blocked | partial | 5 | 2 |
| Q051 | scripts/main-agent-functional-resume-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0084 | main-agent-functional-resume-check | blocked | partial | 5 | 2 |
| Q052 | scripts/main-agent-governed-data-products.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0116 | main-agent-governed-data-products | blocked | partial | 5 | 2 |
| Q053 | scripts/main-agent-implementation-readiness-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.053 | main-agent-implementation-readiness-gate | blocked | partial | 4 | 2 |
| Q054 | scripts/main-agent-production-loop-ready-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0167 | main-agent-production-loop-ready-check | blocked | partial | 5 | 2 |
| Q055 | scripts/main-agent-quality-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1219 | main-agent-quality-gate | blocked | blocked | 5 | 2 |
| Q056 | scripts/main-agent-release-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0481 | main-agent-release-gate | blocked | blocked | 5 | 2 |
| Q057 | scripts/main-agent-runtime-policy-snapshot-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0279 | main-agent-runtime-policy-snapshot-check | blocked | partial | 5 | 2 |
| Q058 | scripts/main-agent-scoring-gates-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0216 | main-agent-scoring-gates-check | blocked | partial | 5 | 2 |
| Q059 | scripts/main-agent-soak-runner.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0599 | main-agent-soak-runner | blocked | partial | 4 | 2 |
| Q060 | scripts/main-agent-trace-status-policy-check.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0369 | main-agent-trace-status-policy-check | blocked | partial | 5 | 2 |
| Q061 | scripts/main-agent-unified-ingress.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0413 | main-agent-unified-ingress | blocked | partial | 4 | 2 |
| Q062 | scripts/mcp/consumer/install-consumer-mcp.ps1 | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1181 | mcp-consumer-install-consumer-mcp-ps1 | blocked | partial | 1 | 1 |
| Q063 | scripts/mcp/consumer/install-consumer-mcp.sh | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.2275 | mcp-consumer-install-consumer-mcp-sh | blocked | partial | 1 | 1 |
| Q064 | scripts/mcp/consumer/verify-consumer-mcp.ps1 | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.6312 | mcp-consumer-verify-consumer-mcp-ps1 | blocked | partial | 1 | 1 |
| Q065 | scripts/mcp/consumer/verify-consumer-mcp.sh | backlog_migration | P1-real-package-source-required | package_runtime_module | within_size_threshold_pending_evidence | 0.7442 | mcp-consumer-verify-consumer-mcp-sh | blocked | partial | 1 | 1 |
| Q066 | scripts/model-governance-hint-resolver.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.2065 | model-governance-hint-resolver-ts | blocked | partial | 1 | 1 |
| Q067 | scripts/orchestration-dispatch-contract.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0221 | orchestration-dispatch-contract | blocked | partial | 5 | 2 |
| Q068 | scripts/orchestration-governance-contract.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1436 | orchestration-governance-contract | blocked | partial | 5 | 2 |
| Q069 | scripts/orchestration-state.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0235 | orchestration-state | blocked | partial | 5 | 2 |
| Q070 | scripts/parse-and-write-score.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0531 | parse-and-write-score-ts | blocked | partial | 1 | 1 |
| Q071 | scripts/per-must-closure-evidence-index.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0229 | per-must-closure-evidence-index | blocked | partial | 5 | 2 |
| Q072 | scripts/pre-rerun-anti-false-positive-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0775 | pre-rerun-anti-false-positive-gate | blocked | partial | 5 | 2 |
| Q073 | scripts/reconfirmation-runtime.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.025 | reconfirmation-runtime | blocked | partial | 5 | 2 |
| Q074 | scripts/record-main-agent-inspect-readiness-closure.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0188 | record-main-agent-inspect-readiness-closure | blocked | partial | 5 | 2 |
| Q075 | scripts/requirement-record-control-store.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0088 | requirement-record-control-store | blocked | partial | 5 | 2 |
| Q076 | scripts/requirement-record-live-schema-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1388 | requirement-record-live-schema-gate | blocked | partial | 5 | 2 |
| Q077 | scripts/requirement-record-schema-evolution.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.6865 | requirement-record-schema-evolution | blocked | partial | 5 | 2 |
| Q078 | scripts/resolve-active-requirement.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.013 | resolve-active-requirement | blocked | partial | 5 | 2 |
| Q079 | scripts/runtime-governance-registry.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.483 | runtime-governance-registry-ts | blocked | partial | 1 | 1 |
| Q080 | scripts/runtime-governance-template-schema.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1906 | runtime-governance-template-schema-ts | blocked | partial | 1 | 1 |
| Q081 | scripts/runtime-governance.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0162 | runtime-governance-ts | blocked | partial | 1 | 1 |
| Q082 | scripts/runtime-scoring-data-path.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.6535 | runtime-scoring-data-path | blocked | partial | 5 | 2 |
| Q083 | scripts/sft-extract.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1704 | sft-extract-ts | blocked | partial | 1 | 1 |
| Q084 | scripts/six-model-runtime-decision.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0291 | six-model-runtime-decision | blocked | partial | 5 | 2 |
| Q085 | scripts/skill-orchestration-audit.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0343 | skill-orchestration-audit | blocked | partial | 5 | 2 |
| Q086 | scripts/strict-closeout-proof-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0137 | strict-closeout-proof-gate | blocked | partial | 5 | 2 |
| Q087 | scripts/target-artifact-realization-gate.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0061 | target-artifact-realization-gate | blocked | partial | 5 | 2 |
| Q088 | scripts/trace-040-evidence-packet-generator.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0432 | trace-040-evidence-packet-generator | blocked | partial | 5 | 2 |
| Q089 | scripts/update-runtime-audit-index.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.2252 | update-runtime-audit-index | blocked | partial | 5 | 2 |
| Q090 | scripts/user-story-mapping.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.031 | user-story-mapping-ts | blocked | partial | 1 | 1 |
| Q091 | scripts/validate-consumer-governance.ps1 | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0222 | validate-consumer-governance-ps1 | blocked | partial | 1 | 1 |
| Q092 | scripts/verify-cursor-audit-granularity.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1687 | verify-cursor-audit-granularity | blocked | partial | 5 | 2 |
| Q093 | scripts/verify-hooks-no-ts-node.js | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.1196 | verify-hooks-no-ts-node-js | blocked | partial | 1 | 1 |
| Q094 | scripts/write-runtime-policy-snapshot-and-recovery-context.cjs | backlog_migration | P1-real-package-source-required | package_runtime_module | within_size_threshold_pending_evidence | 0.9535 | write-runtime-policy-snapshot-and-recovery-context-cjs | blocked | partial | 1 | 1 |
| Q095 | scripts/write-runtime-policy-snapshot-and-recovery-context.ts | backlog_migration | P1-real-package-source-required | package_runtime_module | package_source_size_below_70_percent | 0.0452 | write-runtime-policy-snapshot-and-recovery-context-ts | blocked | partial | 1 | 1 |
| Q096 | scripts/architecture-drift-check.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.4497 | architecture-drift-check-ts | blocked | blocked | 2 | 2 |
| Q097 | scripts/coach-diagnose.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.1177 | coach-diagnose-ts | blocked | blocked | 2 | 2 |
| Q098 | scripts/emit-runtime-policy.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.0279 | emit-runtime-policy-ts | blocked | blocked | 2 | 2 |
| Q099 | scripts/eval-questions-cli.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | missing_package_source_equivalent | 0 | eval-questions | blocked | blocked | 1 | 1 |
| Q100 | scripts/init-to-root.js | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.0153 | init-to-root-js | blocked | blocked | 2 | 2 |
| Q101 | scripts/live-smoke-speckit-workflow.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.1184 | live-smoke-speckit-workflow-ts | blocked | blocked | 2 | 2 |
| Q102 | scripts/main-agent-bmad-help-five-layer-matrix.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | missing_package_source_equivalent | 0 | main-agent-bmad-help-five-layer-matrix | blocked | blocked | 1 | 1 |
| Q103 | scripts/main-agent-host-matrix-pr-orchestrator.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | missing_package_source_equivalent | 0 | main-agent-host-matrix-pr-orchestrate | blocked | blocked | 1 | 1 |
| Q104 | scripts/setup.ps1 | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.063 | setup-ps1 | blocked | blocked | 2 | 2 |
| Q105 | scripts/setup.sh | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.1251 | setup-sh | blocked | blocked | 2 | 2 |
| Q106 | scripts/speckit-cli.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.0355 | speckit-cli-ts | blocked | blocked | 2 | 2 |
| Q107 | scripts/validate-single-source-whitelist.ts | backlog_migration | P1-real-package-source-required | public_cli_de_surface | package_source_size_below_70_percent | 0.1507 | validate-single-source-whitelist-ts | blocked | blocked | 2 | 2 |
| Q108 | scripts/run-auditor-host.ts | backlog_migration | P1-real-package-source-required | runtime_emit_cjs | missing_package_source_equivalent | 0 | run-auditor-host | blocked | blocked | 3 | 2 |
| Q109 | scripts/architecture-confirmation-hash-recipe.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0847 | architecture-confirmation-hash-recipe-ts | blocked | partial | 1 | 1 |
| Q110 | scripts/bmad-help-five-layer-progress-marker.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0484 | bmad-help-five-layer-progress-marker-ts | blocked | partial | 1 | 1 |
| Q111 | scripts/bmad-help-routing-state.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0097 | bmad-help-routing-state-ts | blocked | partial | 1 | 1 |
| Q112 | scripts/bmad-state-reader.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_delta_exceeds_threshold | 0.7136 | bmad-state-reader | blocked | partial | 2 | 1 |
| Q113 | scripts/bmad-state.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0468 | bmad-state-ts | blocked | partial | 1 | 1 |
| Q114 | scripts/bmad-sync-from-v6.ps1 | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0234 | bmad-sync-from-v6-ps1 | blocked | partial | 1 | 1 |
| Q115 | scripts/bmad-sync-from-v6.sh | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0549 | bmad-sync-from-v6-sh | blocked | partial | 1 | 1 |
| Q116 | scripts/cleanup-packed-bmad.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.2029 | cleanup-packed-bmad-js | blocked | partial | 1 | 1 |
| Q117 | scripts/continue-state-contract.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.2444 | continue-state-contract-ts | blocked | partial | 1 | 1 |
| Q118 | scripts/control-event-log-rebaseline.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0916 | control-event-log-rebaseline-ts | blocked | partial | 1 | 1 |
| Q119 | scripts/controlled-ingest-atomic-committer.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 0.8091 | controlled-ingest-atomic-committer-ts | blocked | partial | 1 | 1 |
| Q120 | scripts/e2e-verify-paths.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 0.961 | e2e-verify-paths | blocked | partial | 2 | 1 |
| Q121 | scripts/ensure-runtime-dashboard-server.cjs | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.3041 | ensure-runtime-dashboard-server-cjs | blocked | partial | 1 | 1 |
| Q122 | scripts/evidence-provenance.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1769 | evidence-provenance-ts | blocked | partial | 1 | 1 |
| Q123 | scripts/execution-discipline-profiles.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.098 | execution-discipline-profiles-ts | blocked | partial | 1 | 1 |
| Q124 | scripts/execution-intent-schema.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0216 | execution-intent-schema-ts | blocked | partial | 1 | 1 |
| Q125 | scripts/execution-strategy-selection.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0316 | execution-strategy-selection-ts | blocked | partial | 1 | 1 |
| Q126 | scripts/facilitator-registry.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1213 | facilitator-registry-ts | blocked | partial | 1 | 1 |
| Q127 | scripts/facilitator-runtime-definition.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0444 | facilitator-runtime-definition-ts | blocked | partial | 1 | 1 |
| Q128 | scripts/generate-codex-agents-from-claude.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0231 | generate-codex-agents-from-claude-js | blocked | partial | 1 | 1 |
| Q129 | scripts/governance-packet-execution-store.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0539 | governance-packet-execution-store | blocked | partial | 2 | 2 |
| Q130 | scripts/governance-packet-reconciler.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0933 | governance-packet-reconciler | blocked | partial | 2 | 2 |
| Q131 | scripts/governance-remediation-artifact.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.014 | governance-remediation-artifact | blocked | partial | 2 | 2 |
| Q132 | scripts/governance-remediation-config.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0384 | governance-remediation-config | blocked | partial | 2 | 2 |
| Q133 | scripts/governance-remediation-runner.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.008 | governance-remediation-runner | blocked | partial | 2 | 2 |
| Q134 | scripts/governance-transport-envelope.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.017 | governance-transport-envelope-ts | blocked | partial | 1 | 1 |
| Q135 | scripts/i18n/agent-display-names.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0712 | agent-display-names | blocked | partial | 2 | 2 |
| Q136 | scripts/i18n/agent-manifest.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.181 | i18n-agent-manifest-ts | blocked | partial | 1 | 1 |
| Q137 | scripts/i18n/detect-language.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1201 | i18n-detect-language-ts | blocked | partial | 1 | 1 |
| Q138 | scripts/i18n/field-meta-types.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.2717 | i18n-field-meta-types-ts | blocked | partial | 1 | 1 |
| Q139 | scripts/i18n/language-policy.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0865 | i18n-language-policy-ts | blocked | partial | 1 | 1 |
| Q140 | scripts/i18n/load-manifest.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.4143 | load-manifest | blocked | partial | 2 | 2 |
| Q141 | scripts/i18n/materialize-facilitator-definition.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 2.0455 | i18n-materialize-facilitator-definition-ts | blocked | partial | 1 | 1 |
| Q142 | scripts/i18n/party-mode-runtime-assets.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1074 | party-mode-runtime-assets | blocked | partial | 2 | 2 |
| Q143 | scripts/i18n/placeholder-types.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 1.4332 | i18n-placeholder-types-ts | blocked | partial | 1 | 1 |
| Q144 | scripts/i18n/protected-token-check.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.3841 | i18n-protected-token-check-ts | blocked | partial | 1 | 1 |
| Q145 | scripts/i18n/render-field-view.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.067 | i18n-render-field-view-ts | blocked | partial | 1 | 1 |
| Q146 | scripts/i18n/resolve-for-session-cli.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1394 | i18n-resolve-for-session-cli-ts | blocked | partial | 1 | 1 |
| Q147 | scripts/i18n/resolve-for-session.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.5816 | i18n-resolve-for-session-ts | blocked | partial | 1 | 1 |
| Q148 | scripts/i18n/resolve-localized-markdown-path.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.219 | i18n-resolve-localized-markdown-path-ts | blocked | partial | 1 | 1 |
| Q149 | scripts/i18n/sync-party-mode-mirrors.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1491 | i18n-sync-party-mode-mirrors-ts | blocked | partial | 1 | 1 |
| Q150 | scripts/i18n/validate-template-manifest.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1288 | i18n-validate-template-manifest-ts | blocked | partial | 1 | 1 |
| Q151 | scripts/long-run-runtime-policy.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0708 | long-run-runtime-policy-ts | blocked | partial | 1 | 1 |
| Q152 | scripts/model-governance-hints-schema.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.048 | model-governance-hints-schema-ts | blocked | partial | 1 | 1 |
| Q153 | scripts/model-governance-policy-filter.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.064 | model-governance-policy-filter | blocked | partial | 2 | 2 |
| Q154 | scripts/monitor-push.sh | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1025 | monitor-push-sh | blocked | partial | 1 | 1 |
| Q155 | scripts/party-mode-runtime.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0066 | party-mode-runtime | blocked | partial | 2 | 2 |
| Q156 | scripts/prepublish-check.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0263 | prepublish-check-js | blocked | partial | 1 | 1 |
| Q157 | scripts/prompt-routing-governance.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0111 | prompt-routing-governance | blocked | partial | 2 | 2 |
| Q158 | scripts/prompt-routing-hints-schema.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0667 | prompt-routing-hints-schema | blocked | partial | 2 | 2 |
| Q159 | scripts/prompt-routing-hints.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0674 | prompt-routing-hints | blocked | partial | 2 | 2 |
| Q160 | scripts/query-validate.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 1.1644 | query-validate | blocked | partial | 2 | 1 |
| Q161 | scripts/real-development-tick-worker.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0239 | real-development-tick-worker-js | blocked | partial | 1 | 1 |
| Q162 | scripts/requirement-record-event-reducer.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 1.1034 | requirement-record-event-reducer-ts | blocked | partial | 1 | 1 |
| Q163 | scripts/reviewer-shared-core.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1042 | reviewer-shared-core-ts | blocked | partial | 1 | 1 |
| Q164 | scripts/run-confirmed-final-required-commands.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.6205 | run-confirmed-final-required-commands-js | blocked | partial | 1 | 1 |
| Q165 | scripts/run-confirmed-trace-slice.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0236 | run-confirmed-trace-slice-js | blocked | partial | 1 | 1 |
| Q166 | scripts/run-required-commands-from-ai-tdd-manifest.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0097 | run-required-commands-from-ai-tdd-manifest-ts | blocked | partial | 1 | 1 |
| Q167 | scripts/run-runtime-dashboard-forever.cjs | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.189 | run-runtime-dashboard-forever-cjs | blocked | partial | 1 | 1 |
| Q168 | scripts/runtime-dashboard-server-state.cjs | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.3114 | runtime-dashboard-server-state-cjs | blocked | partial | 1 | 1 |
| Q169 | scripts/runtime-step-state.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 1.2938 | runtime-step-state | blocked | partial | 2 | 1 |
| Q170 | scripts/sdd-artifact-manifest.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.037 | sdd-artifact-manifest-ts | blocked | partial | 1 | 1 |
| Q171 | scripts/skill-inventory-provider.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0521 | skill-inventory-provider | blocked | partial | 2 | 2 |
| Q172 | scripts/skill-semantic-features-config.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1286 | skill-semantic-features-config-ts | blocked | partial | 1 | 1 |
| Q173 | scripts/sprint-status-authorized-update.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0515 | sprint-status-authorized-update-ts | blocked | partial | 1 | 1 |
| Q174 | scripts/stable-runtime-policy-json.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 0.7546 | stable-runtime-policy-json-ts | blocked | partial | 1 | 1 |
| Q175 | scripts/strict-command-resolution-preflight.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0247 | strict-command-resolution-preflight-ts | blocked | partial | 1 | 1 |
| Q176 | scripts/subagent-current-attempt-revalidation.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0297 | subagent-current-attempt-revalidation-ts | blocked | partial | 1 | 1 |
| Q177 | scripts/subagent-surface-inventory.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0135 | subagent-surface-inventory-ts | blocked | partial | 1 | 1 |
| Q178 | scripts/trace-closure-matrix.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0489 | trace-closure-matrix-ts | blocked | partial | 1 | 1 |
| Q179 | scripts/update-specify-passed.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.5139 | update-specify-passed-ts | blocked | partial | 1 | 1 |
| Q180 | scripts/verify-agent-files.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | within_size_threshold_pending_evidence | 0.9964 | verify-agent-files | blocked | partial | 2 | 1 |
| Q181 | scripts/verify-story-mode.ts | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.0807 | verify-story-mode-ts | blocked | partial | 1 | 1 |
| Q182 | scripts/write-runtime-registry.js | backlog_migration | P2-helper-and-functional-evidence | durable_helper_copy | package_source_size_below_70_percent | 0.1295 | write-runtime-registry-js | blocked | partial | 1 | 1 |
| Q183 | scripts/diagnose-bmad-state.ts | backlog_migration | P2-helper-and-functional-evidence | package_runtime_module | package_source_size_delta_exceeds_threshold | 0.7582 | diagnose-bmad-state | blocked | partial | 2 | 1 |
| Q184 | scripts/host-runtime-mode.ts | backlog_migration | P2-helper-and-functional-evidence | package_runtime_module | package_source_size_delta_exceeds_threshold | 0.7155 | host-runtime-mode | blocked | partial | 2 | 1 |
| Q185 | scripts/parallel-mission-control.ts | backlog_migration | P2-helper-and-functional-evidence | package_runtime_module | package_source_size_delta_exceeds_threshold | 0.8177 | parallel-mission-control | blocked | partial | 2 | 1 |
| Q186 | scripts/supervised-worker-runtime.ts | backlog_migration | P2-helper-and-functional-evidence | package_runtime_module | package_source_size_delta_exceeds_threshold | 0.7702 | supervised-worker-runtime | blocked | partial | 2 | 1 |
| Q187 | scripts/check-story-score-written.ts | backlog_migration | P2-helper-and-functional-evidence | public_cli_de_surface | within_size_threshold_pending_evidence | 0.8387 | check-story-score-written | blocked | partial | 2 | 1 |
| Q188 | scripts/eval-question-generate.ts | backlog_migration | P2-helper-and-functional-evidence | public_cli_de_surface | within_size_threshold_pending_evidence | 1.1997 | eval-question-generate | blocked | partial | 2 | 1 |
| Q189 | scripts/ralph-method/pathing.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 24.4643 | ralph-method-pathing-ts | blocked | partial | 2 | 2 |
| Q190 | scripts/ralph-method/progress-format.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 85.6719 | ralph-method-progress-format-ts | blocked | partial | 2 | 2 |
| Q191 | scripts/ralph-method/schema.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 74.9455 | ralph-method-schema-ts | blocked | partial | 2 | 2 |
| Q192 | scripts/ralph-method/speckit-implement.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 125.3182 | ralph-method-speckit-implement-ts | blocked | partial | 2 | 2 |
| Q193 | scripts/ralph-method/types.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 73.1111 | ralph-method-types-ts | blocked | partial | 2 | 2 |
| Q194 | scripts/ralph-method/verify-pass-consistency.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 31.5833 | ralph-method-verify-pass-consistency-ts | blocked | partial | 2 | 2 |
| Q195 | scripts/ralph-method/verify-ralph-compliance.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 58.5139 | ralph-method-verify-ralph-compliance-ts | blocked | partial | 2 | 2 |
| Q196 | scripts/ralph-method/verify-tdd-trace.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 65.9231 | ralph-method-verify-tdd-trace-ts | blocked | partial | 2 | 2 |
| Q197 | scripts/ralph-method/write-tracking-files.ts | backlog_migration | P3-parity-evidence-and-size-ledger | compatibility_alias | package_source_size_delta_exceeds_threshold | 73.058 | ralph-method-write-tracking-files-ts | blocked | partial | 2 | 2 |
| Q198 | scripts/analytics-cluster.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 1.2046 | analytics-cluster-ts | blocked | partial | 1 | 1 |
| Q199 | scripts/analytics-prompt-optimize.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 1.0699 | analytics-prompt-optimize-ts | blocked | partial | 1 | 1 |
| Q200 | scripts/analytics-rule-suggest.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 1.2205 | analytics-rule-suggest-ts | blocked | partial | 1 | 1 |
| Q201 | scripts/dashboard-projection-mapping.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | package_source_size_delta_exceeds_threshold | 3.0774 | dashboard-projection-mapping-ts | blocked | partial | 2 | 2 |
| Q202 | scripts/deferred-gap-governance.cjs | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 9.2688 | deferred-gap-governance-cjs | blocked | partial | 1 | 1 |
| Q203 | scripts/runtime-context.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 1.003 | runtime-context-ts | blocked | partial | 1 | 1 |
| Q204 | scripts/scores-summary.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 1.2338 | scores-summary-ts | blocked | partial | 2 | 1 |
| Q205 | scripts/start-dashboard.ts | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | package_source_size_delta_exceeds_threshold | 8.5676 | start-dashboard-ts | blocked | partial | 1 | 2 |
| Q206 | scripts/start-runtime-dashboard-server.cjs | backlog_migration | P3-parity-evidence-and-size-ledger | durable_helper_copy | within_size_threshold_pending_evidence | 0.9431 | start-runtime-dashboard-server-cjs | blocked | partial | 1 | 1 |
| Q207 | scripts/party-mode-gate-check.ts | settled_revalidation | settled_revalidation | deprecated_no_migration | not_applicable | 0 | party-mode-gate-check | validated | passed | 1 | 0 |
| Q208 | scripts/run-ci-release-gate-fixture.js | settled_revalidation | settled_revalidation | deprecated_no_migration | not_applicable | 0 | run-ci-release-gate-fixture | validated | passed | 1 | 0 |
| Q209 | scripts/audit-scoring-convergence-policy.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | audit-scoring-convergence-policy | validated | passed | 1 | 0 |
| Q210 | scripts/audit-triad-orchestrator.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | audit-triad-orchestrator | validated | passed | 1 | 0 |
| Q211 | scripts/compare-bmad-help-upstream.js | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | compare-bmad-help-upstream-js | validated | passed | 1 | 0 |
| Q212 | scripts/controlled-readiness-audit-bridge.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | controlled-readiness-audit-bridge | validated | passed | 1 | 0 |
| Q213 | scripts/create-second-story.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | create-second-story | validated | passed | 1 | 0 |
| Q214 | scripts/create-test-story.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | create-test-story-ts | validated | passed | 1 | 0 |
| Q215 | scripts/critical-auditor-profile.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | critical-auditor-profile | validated | passed | 1 | 0 |
| Q216 | scripts/deferred-gap-governance.d.cts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | deferred-gap-governance-d-cts | validated | passed | 1 | 0 |
| Q217 | scripts/ensure-governance-user-story-mapping-fixture.js | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | ensure-governance-user-story-mapping-fixture-js | validated | passed | 1 | 0 |
| Q218 | scripts/extract-npm-pack-json.js | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | extract-npm-pack-json-js | validated | passed | 1 | 0 |
| Q219 | scripts/governance-host-dispatch-adapter.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | governance-host-dispatch-adapter | validated | passed | 1 | 0 |
| Q220 | scripts/i18n/bootstrap-skill-bilingual-files.mjs | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | i18n-bootstrap-skill-bilingual-files-mjs | validated | passed | 1 | 0 |
| Q221 | scripts/i18n/han-outside-fences.mjs | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | i18n-han-outside-fences-mjs | validated | passed | 1 | 0 |
| Q222 | scripts/i18n/phase3_translate_skill_en.py | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | i18n-phase3-translate-skill-en-py | validated | passed | 1 | 0 |
| Q223 | scripts/i18n/phase3-skill-en-transform.mjs | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | i18n-phase3-skill-en-transform-mjs | validated | passed | 1 | 0 |
| Q224 | scripts/i18n/resolve-audit-prompt-path.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | resolve-audit-prompt-path | validated | passed | 1 | 0 |
| Q225 | scripts/normalize-pack-manifests.js | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | normalize-pack-manifests-js | validated | passed | 1 | 0 |
| Q226 | scripts/parse-bmad-audit-result.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | parse-bmad-audit-result | validated | passed | 1 | 0 |
| Q227 | scripts/README.md | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | readme-md | validated | passed | 1 | 0 |
| Q228 | scripts/render-upstream-bmad-help-baseline.js | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | render-upstream-bmad-help-baseline-js | validated | passed | 1 | 0 |
| Q229 | scripts/reviewer-contract.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | reviewer-contract | validated | passed | 1 | 0 |
| Q230 | scripts/reviewer-registry.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | reviewer-registry | validated | passed | 1 | 0 |
| Q231 | scripts/reviewer-rollout-gate.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | reviewer-rollout-gate | validated | passed | 1 | 0 |
| Q232 | scripts/reviewer-runtime-definition.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | reviewer-runtime-definition | validated | passed | 1 | 0 |
| Q233 | scripts/reviewer-schema.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | reviewer-schema | validated | passed | 1 | 0 |
| Q234 | scripts/run-fresh-regression-matrix.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | run-fresh-regression-matrix-ts | validated | passed | 1 | 0 |
| Q235 | scripts/subagent-evidence-envelope.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | subagent-evidence-envelope | validated | passed | 1 | 0 |
| Q236 | scripts/test-locks.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | test-locks-ts | validated | passed | 1 | 0 |
| Q237 | scripts/test-story-flow.ts | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | test-story-flow-ts | validated | passed | 1 | 0 |
| Q238 | scripts/verify-score-auto-scoped-bundle.cjs | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | verify-score-auto-scoped-bundle | validated | passed | 1 | 0 |
| Q239 | scripts/verify-skill-architecture.sh | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | verify-skill-architecture-sh | validated | passed | 1 | 0 |
| Q240 | scripts/verify-speckit-mirror-sync.js | settled_revalidation | settled_revalidation | repo_internal_reclassify | not_applicable | 0 | verify-speckit-mirror-sync-js | validated | passed | 1 | 0 |

### D008 NOT DONE Rows

- NOT DONE ND001: Wave 4.1 MUST NOT delete any root `scripts/**` file because deletion approval is outside this migration contract.
- NOT DONE ND002: Wave 4.1 MUST NOT publish an npm release because package publication is outside this migration contract.
- NOT DONE ND003: Wave 4.1 MUST NOT add root `scripts/**` runtime helpers because package source authority must live under package source directories or declared tool validation paths.
- NOT DONE ND004: Wave 4.1 MUST NOT expand the backlog migration subset beyond the 206 queue rows because `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json` is the frozen backlog source.
- NOT DONE ND005: Wave 4.1 MUST NOT mark a row passed from coverage receipts, generated goal documents, registry prose, exit code alone, documented size-delta waiver, or settled revalidation status because each row requires direct behavior, packageImplementationSet, size-delta, and no-fallback evidence.

### D009 Universal Package Implementation And Size Delta Contract

- D009.MUST.001: Every one of the 240 ledger rows MUST have `packageImplementationSet.length >= 1` before CMD013 may pass.
- D009.MUST.002: Every path in `packageImplementationSet` MUST be under `packages/bmad-speckit/src/**` or `packages/bmad-speckit/bin/**`.
- D009.MUST.003: Every ledger row MUST record `originalBytes`, `originalLoc`, `packageBytes`, `packageLoc`, `packageByteRatio`, `packageLocRatio`, `sizeDeltaThreshold`, `sizeDeltaDecision`, and `sizeDeltaProof`.
- D009.MUST.004: `sizeDeltaThreshold.byteRatioMin` MUST equal `0.70` and `sizeDeltaThreshold.byteRatioMax` MUST equal `1.30`.
- D009.MUST.005: `sizeDeltaThreshold.locRatioMin` MUST equal `0.70` and `sizeDeltaThreshold.locRatioMax` MUST equal `1.30`.
- D009.MUST.006: CMD013 MUST fail closed when `packageByteRatio < 0.70`, `packageByteRatio > 1.30`, `packageLocRatio < 0.70`, or `packageLocRatio > 1.30`.
- D009.MUST.007: CMD013 MUST report `zeroSizeMetricCount=0` and `sizeDeltaViolationCount=0` before completion evidence may be written.
- D009.MUST.008: `passed_full_equivalence_with_documented_size_delta` MUST NOT pass Wave 4.1 when the documented size delta remains outside the strict threshold.

### D010 Automatic Rework Loop Contract

- D010.MUST.001: When CMD003, CMD004, CMD008, CMD013, or CMD014 reports `reworkRequired=true`, the /goal executor MUST write `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/rework-iterations.json`.
- D010.MUST.002: Each `rework-iterations.json` item MUST record `iterationId`, `failedCommandId`, `failedAcceptanceIds`, `originalPath`, `failureClass`, `rootCause`, `filesChanged`, `commandsRerun`, `result`, and `completedAt`.
- D010.MUST.003: For fixable failures, the /goal executor MUST modify package implementation, tests, validator logic, ledger evidence, or registry evidence within this contract scope and rerun the failed command plus CMD013.
- D010.MUST.004: The rework loop MUST continue until CMD013 reports `all240RowsPassed=true`, `all240RowsHavePackageImplementationSet=true`, `all240RowsHaveSizeDeltaDecision=true`, `zeroSizeMetricCount=0`, `sizeDeltaViolationCount=0`, `noFallbackScanCoverageRows=240`, `fallbackHitCount=0`, `reworkQueueLength=0`, `allAcceptancePassed=true`, and `residualRisks=none`.
- D010.MUST.005: The /goal executor MUST stop only when a stop condition identifies a source hash mismatch, scope expansion requirement, contract ambiguity, or unresolvable semantic decision that cannot be repaired from repository sources.
<!-- /goal-slot:domainAddenda -->

## Implementation Tasks

<!-- goal-slot:implementationTasks required dynamic=traceSlices -->
### G001 Freeze Wave 4.1 Scope And Seed Ledger

**Purpose:** Freeze Wave 4.1 Scope And Seed Ledger for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json`
- `repo-governance/script-migration-registry.yaml`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/scope-baseline.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- Create `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/`.
- Write `scope-baseline.json` with source hashes, registry baseline hash, dirty worktree snapshot, full universe totals, backlog queue totals, priority totals, strategy totals, and cross counts.
- Write `migration-ledger.json` with exactly 240 entries copied from the full source inventory and enriched with scopeClass, baseline target paths, migration status, validation status, blocker fields, packageImplementationSet, originalBytes, originalLoc, packageBytes, packageLoc, packageByteRatio, packageLocRatio, sizeDeltaThreshold, sizeDeltaDecision, sizeDeltaProof, and reworkHistory fields.
- Set all 206 backlog ledger rows `status` to `blocked_until_wave_4_1_implementation_proof_recorded` before code migration starts.
- Set all 34 settled ledger rows `status` to `blocked_until_wave_4_1_package_equivalence_revalidated` before closeout starts.
- Set all 240 ledger rows `packageImplementationSet=[]` and `sizeDeltaDecision=blocked_until_package_implementation_set_recorded` before migration work starts.

**Validation:**
- Run CMD002 and CMD003.

**Acceptance:**
- ACC001, ACC002, ACC018, ACC021, ACC022, ACC023

### G002 Create Wave 4.1 Validation And Evidence Surfaces

**Purpose:** Create Wave 4.1 Validation And Evidence Surfaces for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs`
- `tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs`
- `tools/script-migration/write-main-agent-wave-4-1-evidence.cjs`
- `tests/acceptance/main-agent-runtime-migration-wave-4-1-contract.test.ts`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/rework-iterations.json`

**Steps:**
- Implement validator phases `preflight`, `ledger`, `no-fallback`, `registry`, `parity`, `install-matrix`, `rework`, and `final`.
- Implement install matrix runner modes `no-save`, `save-dev`, `npx-package`, and `init-sync-consumer`.
- Implement evidence writer that records command ID, command line, cwd, exit code, stdout path, stderr path, startedAt, completedAt, artifact hashes, and acceptance IDs.
- Implement acceptance tests that fail on missing rows, report-only package source, descriptor-only helper source, root script dispatch, `tsx`, `ts-node`, compiled fallback, missing package source, missing packageImplementationSet, missing size-delta decision, size-delta threshold violation, missing dist output, missing install proof, missing behavior proof, stale registry status, no-fallback scan coverage below 240, and stale hashes.
- Implement rework output that writes failing originalPath rows, failureClass values, failed acceptance IDs, and required rerun command IDs.

**Validation:**
- Run CMD003 and CMD004.

**Acceptance:**
- ACC002, ACC003, ACC011, ACC018, ACC022, ACC023, ACC024, ACC025

### G003 Migrate P0 Core Source Authority

**Purpose:** Migrate P0 Core Source Authority for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `scripts/main-agent-orchestration.ts`
- `packages/bmad-speckit/src/main-agent/index.js`
- `packages/bmad-speckit/src/main-agent/runtime.js`
- `packages/bmad-speckit/src/main-agent/actions/inspect.js`
- `packages/bmad-speckit/src/main-agent/actions/confirm-scope.js`
- `packages/bmad-speckit/src/main-agent/actions/dispatch-plan.js`
- `packages/bmad-speckit/src/main-agent/actions/run-loop.js`
- `packages/bmad-speckit/dist/main-agent/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- Replace incomplete source authority for `scripts/main-agent-orchestration.ts` with package source that executes inspect, confirm-scope, dispatch-plan, run-loop, native goal dispatch, closeout, and evidence gates from package modules.
- Record behavior parity proof for the P0 row in the ledger.
- Record no-fallback scan proof for the P0 row in the ledger.

**Validation:**
- Run CMD004, CMD005, CMD006, CMD008, and CMD013.

**Acceptance:**
- ACC004, ACC012, ACC013, ACC016

### G004 Migrate P1 Package Runtime Module Rows

**Purpose:** Migrate P1 Package Runtime Module Rows for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/main-agent/actions/**`
- `packages/bmad-speckit/src/main-agent/helpers/**`
- `packages/bmad-speckit/src/main-agent/runtime.js`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- For all 91 rows where priority is `P1-real-package-source-required` and strategy is `package_runtime_module`, implement package source with behavior equivalent to the original root script.
- For each of the 91 rows, replace report-only action content with executable package behavior.
- For each of the 91 rows, add or update behavior tests, CLI output assertions, source seam static assertions, or receipt field assertions.
- For each of the 91 rows, record package source proof, behavior proof, dist proof, install proof, and no-fallback proof in the ledger.

**Validation:**
- Run CMD004, CMD005, CMD006, CMD008, CMD009, CMD010, CMD011, CMD012, and CMD013.

**Acceptance:**
- ACC005, ACC012, ACC013, ACC015, ACC016

### G005 Migrate P1 Public CLI Rows

**Purpose:** Migrate P1 Public CLI Rows for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/commands/**`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/dist/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- For all 12 rows where priority is `P1-real-package-source-required` and strategy is `public_cli_de_surface`, implement package CLI commands that preserve root script behavior.
- For each of the 12 rows, add command parser tests and CLI output assertions.
- For each of the 12 rows, prove installed package invocation through no-save, save-dev, npx-package, and init-sync-consumer matrix modes.
- For each of the 12 rows, record no-fallback proof that the command route does not call the original root script.

**Validation:**
- Run CMD004, CMD005, CMD006, CMD008, CMD009, CMD010, CMD011, CMD012, and CMD013.

**Acceptance:**
- ACC006, ACC012, ACC013, ACC015, ACC016

### G006 Eliminate P1 Alias CJS And Durable Helper Blockers

**Purpose:** Eliminate P1 Alias CJS And Durable Helper Blockers for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/main-agent/helpers/**`
- `packages/bmad-speckit/src/main-agent/actions/**`
- `packages/bmad-speckit/src/commands/**`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- For the 1 P1 `compatibility_alias` row, replace root script dependency with package source or package bin dispatch only.
- For the 1 P1 `runtime_emit_cjs` row, move source authority to package source and treat generated CJS as dist output only.
- For the 2 P1 `durable_helper_copy` rows, replace descriptor-only helper content with executable package helper behavior.
- Record behavior proof and no-fallback proof for all 4 rows.

**Validation:**
- Run CMD004, CMD005, CMD006, CMD008, and CMD013.

**Acceptance:**
- ACC007, ACC012, ACC013, ACC016

### G007 Complete P2 Durable Helper Functional Equivalence

**Purpose:** Complete P2 Durable Helper Functional Equivalence for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/main-agent/helpers/**`
- `packages/bmad-speckit/dist/main-agent/helpers/**`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- For all 74 rows where priority is `P2-helper-and-functional-evidence` and strategy is `durable_helper_copy`, replace descriptor-only helper content with executable package helper behavior.
- For each of the 74 rows, add helper tests, static seam assertions, or receipt field assertions that prove original behavior.
- For each of the 74 rows, record package source proof, behavior proof, dist proof, and no-fallback proof in the ledger.

**Validation:**
- Run CMD004, CMD005, CMD006, CMD008, and CMD013.

**Acceptance:**
- ACC008, ACC012, ACC013, ACC016

### G008 Complete P2 Public CLI And Package Runtime Residuals

**Purpose:** Complete P2 Public CLI And Package Runtime Residuals for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/commands/**`
- `packages/bmad-speckit/src/main-agent/actions/**`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- For the 2 P2 `public_cli_de_surface` rows, implement package CLI command behavior and installed command proof.
- For the 4 P2 `package_runtime_module` rows, implement package runtime module behavior and package import proof.
- Record package source proof, behavior proof, dist proof, install proof, and no-fallback proof for all 6 rows.

**Validation:**
- Run CMD004, CMD005, CMD006, CMD008, CMD009, CMD010, CMD011, CMD012, and CMD013.

**Acceptance:**
- ACC009, ACC012, ACC013, ACC015, ACC016

### G009 Close Universal Package Implementation And Size Ledger Rows

**Purpose:** Close Universal Package Implementation And Size Ledger Rows for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/**`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/package-source-parity-evidence.json`

**Steps:**
- For all 240 source inventory rows, record a non-empty packageImplementationSet with one or more installed-package implementation paths under `packages/bmad-speckit/src/**` or `packages/bmad-speckit/bin/**`.
- For all 240 source inventory rows, compute originalBytes and originalLoc from the frozen originalPath.
- For all 240 source inventory rows, compute packageBytes and packageLoc from the aggregate packageImplementationSet.
- For all 240 source inventory rows, compute packageByteRatio and packageLocRatio rounded to four decimals.
- For all 240 source inventory rows, set sizeDeltaDecision to `passed_within_strict_threshold` only when originalBytes, originalLoc, packageBytes, and packageLoc are greater than 0 and both ratios are between 0.70 and 1.30 inclusive.
- Write `package-source-parity-evidence.json` with per-row original bytes, original LOC, package bytes, package LOC, byte ratio, LOC ratio, sizeDeltaDecision, behavior proof IDs, packageImplementationSet, and no-fallback proof IDs.
- Set every row ledger status to `validated` only after behavior proof, packageImplementationSet, size-delta proof, and no-fallback proof exist.

**Validation:**
- Run CMD008, CMD013, and CMD014.

**Acceptance:**
- ACC010, ACC012, ACC016, ACC018, ACC022, ACC023, ACC025

### G010 Build Package Dist And Ban Manual Dist Authority

**Purpose:** Build Package Dist And Ban Manual Dist Authority for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `packages/bmad-speckit/src/**`
- `packages/bmad-speckit/dist/**`
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- Run package dist build from package source.
- Record dist output hash for every row that affects installed runtime output.
- Record build command evidence in every affected ledger row.
- Fail the ledger when a dist file was edited without matching source file change and build command evidence.

**Validation:**
- Run CMD005, CMD006, CMD008, and CMD013.

**Acceptance:**
- ACC013, ACC014, ACC016

### G011 Run Installed Consumer Matrix Without Root Scripts

**Purpose:** Run Installed Consumer Matrix Without Root Scripts for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/install-matrix/no-save.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/install-matrix/save-dev.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/install-matrix/npx-package.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/install-matrix/init-sync-consumer.json`

**Steps:**
- Run no-save install matrix mode.
- Run save-dev install matrix mode.
- Run npx-package install matrix mode.
- Run init-sync-consumer install matrix mode.
- For every matrix mode, assert installed consumer commands load package source or package dist and do not read any of the 240 source inventory original paths under `scripts/**`.

**Validation:**
- Run CMD009, CMD010, CMD011, CMD012, and CMD013.

**Acceptance:**
- ACC015, ACC016, ACC018, ACC025

### G012 Finalize Registry And Human Summary

**Purpose:** Finalize Registry And Human Summary for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `repo-governance/script-migration-registry.yaml`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/summary.md`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`

**Steps:**
- Add or update the Wave 4.1 registry wave record.
- Set all 206 backlog row registry states to `migrationStatus=validated` and `validationStatus=passed`.
- Keep all 34 settled row registry states at `migrationStatus=validated` and `validationStatus=passed`.
- Record packageImplementationSet and sizeDeltaDecision evidence paths for all 240 registry rows.
- Set Wave 4.1 `contractPath` to this Markdown path.
- Write `summary.md` with final counts, command IDs, artifact hashes, all240RowsHavePackageImplementationSet, all240RowsHaveSizeDeltaDecision, zeroSizeMetricCount, sizeDeltaViolationCount, noFallbackScanCoverageRows, fallbackHitCount, reworkQueueLength, and residual risk state.
- Keep deletion approval fields false or null for every root script row.

**Validation:**
- Run CMD007, CMD013, and CMD014.

**Acceptance:**
- ACC011, ACC017, ACC019, ACC021, ACC022, ACC023, ACC024, ACC025

### G013 Run Release Gates And Encoding Gates

**Purpose:** Run Release Gates And Encoding Gates for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `package.json`
- `packages/bmad-speckit/package.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/evidence.json`

**Steps:**
- Run repository encoding gate.
- Run root test suite.
- Run package prepublish gate.
- Run registry validation.
- Record command evidence and hashes in evidence.json.

**Validation:**
- Run CMD014, CMD015, CMD016, and CMD007.

**Acceptance:**
- ACC014, ACC018, ACC020

### G014 Run Automatic Rework Loop Until Strict Gates Pass

**Purpose:** Run Automatic Rework Loop Until Strict Gates Pass for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/rework-iterations.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/package-source-parity-evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/evidence.json`

**Steps:**
- Run CMD003, CMD008, CMD013, and CMD014 after every implementation cycle.
- When a command reports reworkRequired=true, write or append `rework-iterations.json` with failing originalPath rows, failed acceptance IDs, failureClass values, root causes, files changed, commands rerun, result, and completedAt.
- Modify package implementation, tests, validator logic, ledger evidence, or registry evidence within this contract scope for fixable failures.
- Repeat affected implementation tasks and rerun the failed command plus CMD013 until the rework queue is empty.
- Exit the rework loop only when CMD013 reports all240RowsPassed=true, all240RowsHavePackageImplementationSet=true, all240RowsHaveSizeDeltaDecision=true, zeroSizeMetricCount=0, sizeDeltaViolationCount=0, noFallbackScanCoverageRows=240, fallbackHitCount=0, reworkQueueLength=0, allAcceptancePassed=true, and residualRisks=none.

**Validation:**
- Run CMD003, CMD008, CMD013, and CMD014.

**Acceptance:**
- ACC003, ACC012, ACC016, ACC020, ACC022, ACC023, ACC024, ACC025

### G015 Write Completion Evidence Packet

**Purpose:** Write Completion Evidence Packet for `main-agent-runtime-migration-wave-4.1`.

**Files:**
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/final-evidence-packet.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/summary.md`

**Steps:**
- Write `final-evidence-packet.json` after all required commands pass.
- Record contract hash, source hashes, ledger hash, registry hash, install matrix hashes, package dist hash list, command evidence list, no-fallback scan result, packageImplementationSet result, size-delta result, rework iteration result, and acceptance result list.
- Set `completionDecision` to `pass` only when ACC001 through ACC025 are true and CMD001 through CMD016 have current-attempt passing evidence.
- Set `residualRisks` to `none` only when no stop condition remains active and reworkQueueLength equals 0.

**Validation:**
- Run CMD013 and CMD014 after final evidence packet write.

**Acceptance:**
- ACC018, ACC019, ACC020, ACC021, ACC022, ACC023, ACC024, ACC025
<!-- /goal-slot:implementationTasks -->

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

<!-- goal-slot:strictAcceptanceChecklist required dynamic=traceEvidence -->
- [ ] ACC001: Scope hashes. D001 hashes and source totals MUST match source files before implementation and before closeout. Evidence: CMD002; scope-baseline.json.
- [ ] ACC002: Ledger coverage. migration-ledger.json MUST contain exactly 240 rows, every row MUST map to one source inventory original path, 206 rows MUST have scopeClass `backlog_migration`, and 34 rows MUST have scopeClass `settled_revalidation`. Evidence: CMD003; migration-ledger.json.
- [ ] ACC003: No fallback validator. The Wave 4.1 validator MUST fail on report-only source, descriptor-only helper source, root script dispatch, tsx, ts-node, compiled fallback, missing package source, missing packageImplementationSet, missing size-delta decision, size-delta threshold violation, missing dist output, missing install proof, missing behavior proof, stale registry status, incomplete 240-path no-fallback scan coverage, and stale hashes. Evidence: CMD003; CMD004.
- [ ] ACC004: P0 core source authority. The single P0 row `scripts/main-agent-orchestration.ts` MUST have package source authority, behavior parity proof, dist proof, registry proof, and no-fallback proof. Evidence: CMD004; CMD005; CMD006; CMD008; CMD013.
- [ ] ACC005: P1 package runtime module rows. All 91 P1 package runtime module rows MUST have executable package source, behavior parity proof, package dist proof, installed invocation proof, and no-fallback proof. Evidence: CMD004; CMD005; CMD006; CMD008; CMD009; CMD010; CMD011; CMD012; CMD013.
- [ ] ACC006: P1 public CLI rows. All 12 P1 public CLI rows MUST have package command source, bin route proof, installed CLI proof, behavior parity proof, and no-fallback proof. Evidence: CMD004; CMD005; CMD006; CMD008; CMD009; CMD010; CMD011; CMD012; CMD013.
- [ ] ACC007: P1 alias CJS helper blockers. The 1 P1 compatibility alias row, 1 P1 runtime emit CJS row, and 2 P1 durable helper rows MUST have executable package authority and no root script dependency. Evidence: CMD004; CMD005; CMD006; CMD008; CMD013.
- [ ] ACC008: P2 durable helper rows. All 74 P2 durable helper rows MUST have executable package helper behavior, behavior parity proof, package source proof, dist proof, and no-fallback proof. Evidence: CMD004; CMD005; CMD006; CMD008; CMD013.
- [ ] ACC009: P2 residual public CLI and package runtime rows. The 2 P2 public CLI rows and 4 P2 package runtime module rows MUST have package behavior proof and installed consumer proof. Evidence: CMD004; CMD005; CMD006; CMD008; CMD009; CMD010; CMD011; CMD012; CMD013.
- [ ] ACC010: P3 parity rows. All 18 P3 rows MUST have parity evidence, size ledger evidence, behavior proof, and no-fallback proof. Evidence: CMD008; CMD013; package-source-parity-evidence.json.
- [ ] ACC011: Registry closure. The registry MUST record Wave 4.1 completed, all 206 backlog rows as migrationStatus validated, all 206 backlog rows as validationStatus passed, all 34 settled rows as validationStatus passed, empty blockers for every backlog row, and current Wave 4.1 packageImplementationSet, size-delta, behavior, and no-fallback evidence paths for all 240 rows. Evidence: CMD007; CMD013.
- [ ] ACC012: Package source parity. Every one of the 240 rows MUST have package source parity status `passed_full_equivalence` with behavior proof, packageImplementationSet proof, size-delta proof, and no-fallback proof. Evidence: CMD013; package-source-parity-evidence.json.
- [ ] ACC013: Dist provenance. Every affected package dist file MUST be produced by package build from package source and MUST NOT be manual source authority. Evidence: CMD005; CMD006; CMD013.
- [ ] ACC014: Build and package tests. Package build, package tests, root targeted tests, root full tests, and prepublish gate MUST pass in the same implementation attempt. Evidence: CMD005; CMD006; CMD014; CMD015; CMD016.
- [ ] ACC015: Install matrix. no-save, save-dev, npx-package, and init-sync-consumer install matrix modes MUST pass and MUST prove package invocation without root scripts. Evidence: CMD009; CMD010; CMD011; CMD012; CMD013.
- [ ] ACC016: Root script dependency ban. Package source, package dist, package bin, generated surfaces, and installed consumer surfaces MUST contain zero dependencies on the 240 source inventory original paths. Evidence: CMD008; CMD013.
- [ ] ACC017: No root script deletion. All root scripts in the frozen source inventory MUST remain present unless a separate deletion approval contract exists, and every Wave 4.1 row MUST keep deletionAllowed false. Evidence: CMD002; CMD013.
- [ ] ACC018: Evidence packet integrity. Evidence artifacts MUST record command IDs, command lines, cwd, exit codes, stdout paths, stderr paths, timestamps, artifact hashes, acceptance IDs, source hashes, contract hash, and ledger hash. Evidence: CMD013; final-evidence-packet.json.
- [ ] ACC019: Summary projection. summary.md MUST contain final counts, hashes, command evidence IDs, install matrix results, no-fallback scan result, packageImplementationSet result, zeroSizeMetricCount, sizeDeltaViolationCount, size-delta result, rework result, and residual risk state. Evidence: CMD013; summary.md.
- [ ] ACC020: Completion gate. CompletionDecision MUST equal pass only when ACC001 through ACC025 are true and every required command has current-attempt pass evidence. Evidence: CMD013; CMD014; final-evidence-packet.json.
- [ ] ACC021: Settled row package equivalence. All 34 settled revalidation rows MUST remain validated, passed, non-deleted, unused as fallback for any backlog migration row, and covered by packageImplementationSet, behavior proof, size-delta proof, and no-fallback proof. Evidence: CMD003; CMD007; CMD008; CMD013; migration-ledger.json.
- [ ] ACC022: Universal packageImplementationSet. All 240 ledger rows MUST have packageImplementationSet length greater than zero and every packageImplementationSet path MUST be under packages/bmad-speckit/src/** or packages/bmad-speckit/bin/**. Evidence: CMD003; CMD013; migration-ledger.json.
- [ ] ACC023: Strict byte and LOC size delta. All 240 ledger rows MUST record originalBytes, originalLoc, packageBytes, packageLoc, packageByteRatio, packageLocRatio, sizeDeltaThreshold, sizeDeltaDecision, and sizeDeltaProof; originalBytes, originalLoc, packageBytes, and packageLoc MUST be greater than 0; every byte and LOC ratio MUST be between 0.70 and 1.30 inclusive; zeroSizeMetricCount MUST equal 0; sizeDeltaViolationCount MUST equal 0. Evidence: CMD013; package-source-parity-evidence.json.
- [ ] ACC024: Automatic rework closure. The /goal execution MUST continue automatic rework iterations for every fixable failed strict gate until CMD013 reports reworkQueueLength=0 and residualRisks=none. Evidence: CMD013; rework-iterations.json.
- [ ] ACC025: Full inventory no-fallback scan. The no-fallback scanner MUST scan all 240 source inventory original paths and MUST report scannedOriginalPathCount=240, scanCoverageRows=240, and forbiddenHitCount=0. Evidence: CMD008; CMD013.
<!-- /goal-slot:strictAcceptanceChecklist -->

## Acceptance Traceability Matrix

<!-- goal-slot:acceptanceTraceabilityMatrix required dynamic=traceEvidence -->
| Acceptance ID | Task IDs | Evidence command and artifact | Pass condition |
| --- | --- | --- | --- |
| ACC001 | G001 | CMD002; scope-baseline.json | D001 hashes and source totals MUST match source files before implementation and before closeout. |
| ACC002 | G001, G002 | CMD003; migration-ledger.json | migration-ledger.json MUST contain exactly 240 rows, every row MUST map to one source inventory original path, 206 rows MUST have scopeClass `backlog_migration`, and 34 rows MUST have scopeClass `settled_revalidation`. |
| ACC003 | G002 | CMD003; CMD004 | The Wave 4.1 validator MUST fail on report-only source, descriptor-only helper source, root script dispatch, tsx, ts-node, compiled fallback, missing package source, missing packageImplementationSet, missing size-delta decision, size-delta threshold violation, missing dist output, missing install proof, missing behavior proof, stale registry status, incomplete 240-path no-fallback scan coverage, and stale hashes. |
| ACC004 | G003 | CMD004; CMD005; CMD006; CMD008; CMD013 | The single P0 row `scripts/main-agent-orchestration.ts` MUST have package source authority, behavior parity proof, dist proof, registry proof, and no-fallback proof. |
| ACC005 | G004 | CMD004; CMD005; CMD006; CMD008; CMD009; CMD010; CMD011; CMD012; CMD013 | All 91 P1 package runtime module rows MUST have executable package source, behavior parity proof, package dist proof, installed invocation proof, and no-fallback proof. |
| ACC006 | G005 | CMD004; CMD005; CMD006; CMD008; CMD009; CMD010; CMD011; CMD012; CMD013 | All 12 P1 public CLI rows MUST have package command source, bin route proof, installed CLI proof, behavior parity proof, and no-fallback proof. |
| ACC007 | G006 | CMD004; CMD005; CMD006; CMD008; CMD013 | The 1 P1 compatibility alias row, 1 P1 runtime emit CJS row, and 2 P1 durable helper rows MUST have executable package authority and no root script dependency. |
| ACC008 | G007 | CMD004; CMD005; CMD006; CMD008; CMD013 | All 74 P2 durable helper rows MUST have executable package helper behavior, behavior parity proof, package source proof, dist proof, and no-fallback proof. |
| ACC009 | G008 | CMD004; CMD005; CMD006; CMD008; CMD009; CMD010; CMD011; CMD012; CMD013 | The 2 P2 public CLI rows and 4 P2 package runtime module rows MUST have package behavior proof and installed consumer proof. |
| ACC010 | G009 | CMD008; CMD013; package-source-parity-evidence.json | All 18 P3 rows MUST have parity evidence, size ledger evidence, behavior proof, and no-fallback proof. |
| ACC011 | G012 | CMD007; CMD013 | The registry MUST record Wave 4.1 completed, all 206 backlog rows as migrationStatus validated, all 206 backlog rows as validationStatus passed, all 34 settled rows as validationStatus passed, empty blockers for every backlog row, and current Wave 4.1 packageImplementationSet, size-delta, behavior, and no-fallback evidence paths for all 240 rows. |
| ACC012 | G004, G005, G006, G007, G008, G009, G013 | CMD013; package-source-parity-evidence.json | Every one of the 240 rows MUST have package source parity status `passed_full_equivalence` with behavior proof, packageImplementationSet proof, size-delta proof, and no-fallback proof. |
| ACC013 | G010 | CMD005; CMD006; CMD013 | Every affected package dist file MUST be produced by package build from package source and MUST NOT be manual source authority. |
| ACC014 | G010, G013 | CMD005; CMD006; CMD014; CMD015; CMD016 | Package build, package tests, root targeted tests, root full tests, and prepublish gate MUST pass in the same implementation attempt. |
| ACC015 | G011 | CMD009; CMD010; CMD011; CMD012; CMD013 | no-save, save-dev, npx-package, and init-sync-consumer install matrix modes MUST pass and MUST prove package invocation without root scripts. |
| ACC016 | G003, G004, G005, G006, G007, G008, G009, G011 | CMD008; CMD013 | Package source, package dist, package bin, generated surfaces, and installed consumer surfaces MUST contain zero dependencies on the 240 source inventory original paths. |
| ACC017 | G012 | CMD002; CMD013 | All root scripts in the frozen source inventory MUST remain present unless a separate deletion approval contract exists, and every Wave 4.1 row MUST keep deletionAllowed false. |
| ACC018 | G001, G002, G011, G014, G015 | CMD013; final-evidence-packet.json | Evidence artifacts MUST record command IDs, command lines, cwd, exit codes, stdout paths, stderr paths, timestamps, artifact hashes, acceptance IDs, source hashes, contract hash, and ledger hash. |
| ACC019 | G012, G015 | CMD013; summary.md | summary.md MUST contain final counts, hashes, command evidence IDs, install matrix results, no-fallback scan result, packageImplementationSet result, zeroSizeMetricCount, sizeDeltaViolationCount, size-delta result, rework result, and residual risk state. |
| ACC020 | G013, G014, G015 | CMD013; CMD014; final-evidence-packet.json | CompletionDecision MUST equal pass only when ACC001 through ACC025 are true and every required command has current-attempt pass evidence. |
| ACC021 | G001, G009, G012, G015 | CMD003; CMD007; CMD008; CMD013; migration-ledger.json | All 34 settled revalidation rows MUST remain validated, passed, non-deleted, unused as fallback for any backlog migration row, and covered by packageImplementationSet, behavior proof, size-delta proof, and no-fallback proof. |
| ACC022 | G001, G002, G009, G014, G015 | CMD003; CMD013; migration-ledger.json | All 240 ledger rows MUST have packageImplementationSet length greater than zero and every packageImplementationSet path MUST be under packages/bmad-speckit/src/** or packages/bmad-speckit/bin/**. |
| ACC023 | G001, G002, G009, G014, G015 | CMD013; package-source-parity-evidence.json | All 240 ledger rows MUST record originalBytes, originalLoc, packageBytes, packageLoc, packageByteRatio, packageLocRatio, sizeDeltaThreshold, sizeDeltaDecision, and sizeDeltaProof; originalBytes, originalLoc, packageBytes, and packageLoc MUST be greater than 0; every byte and LOC ratio MUST be between 0.70 and 1.30 inclusive; zeroSizeMetricCount MUST equal 0; sizeDeltaViolationCount MUST equal 0. |
| ACC024 | G002, G014, G015 | CMD013; rework-iterations.json | The /goal execution MUST continue automatic rework iterations for every fixable failed strict gate until CMD013 reports reworkQueueLength=0 and residualRisks=none. |
| ACC025 | G002, G009, G011, G014, G015 | CMD008; CMD013 | The no-fallback scanner MUST scan all 240 source inventory original paths and MUST report scannedOriginalPathCount=240, scanCoverageRows=240, and forbiddenHitCount=0. |
<!-- /goal-slot:acceptanceTraceabilityMatrix -->

## Source Coverage Matrix

Every source obligation must map to at least one generated task, acceptance item, required command, and evidence item.

<!-- goal-slot:sourceCoverageMatrix required dynamic=sourceCoverageMatrix -->
| Source ID | Source Kind | Source path or statement | Goal Tasks | Acceptance | Commands | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| SRC001 | conversation_requirement | User request: wave4.1 full-scope complete equivalent no-fallback migration goal contract with all 240 scripts requiring packageImplementationSet, strict byte and LOC size-delta gates, 240-path no-fallback scan, and automatic /goal rework until strict acceptance passes | G001-G015 | ACC001-ACC025 | CMD001-CMD016 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.generation-receipt.json |
| SRC002 | full_inventory_scope | repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json; sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31 | G001, G009, G012, G014, G015 | ACC001, ACC002, ACC016, ACC017, ACC021, ACC022, ACC023, ACC025 | CMD002, CMD003, CMD008, CMD013 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json |
| SRC003 | queue_scope | repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json; sha256:3b3ccf1b1a88d9f7dd559413e4bcb502d0cdf7305b308b64e2b12f26ac42ddb5 | G001, G003-G012, G014, G015 | ACC001-ACC025 | CMD002, CMD003, CMD013 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json |
| SRC004 | parity_baseline | repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json; sha256:9d69564dc665ba50eb40fab76a955a8880602963dd57667f6b8d308074629dee | G001, G004-G010, G013-G015 | ACC003-ACC016, ACC021-ACC025 | CMD002, CMD008, CMD013 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json |
| SRC005 | registry_state | repo-governance/script-migration-registry.yaml; sha256:9c86cac253049e18b4c126994817c6786f7d115800884eac0348e4d18ad8cf33 | G001, G012, G014, G015 | ACC011, ACC017-ACC025 | CMD007, CMD013 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json |
| SRC006 | no_fallback_policy | No root script dispatch across all 240 source inventory original paths, no tsx, no ts-node, no compiled fallback, no descriptor-only helper, no report-only action | G002-G015 | ACC003-ACC025 | CMD003, CMD008, CMD013 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.coverage-receipt.json |
| SRC007 | strict_acceptance_policy | Every acceptance row requires direct behavior, packageImplementationSet, byte and LOC size-delta proof, source seam, receipt field, CLI output, registry, package build, install matrix, encoding proof, and automatic rework closure | G002-G015 | ACC003-ACC025 | CMD004-CMD016 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.generation-receipt.json |
| SRC008 | user_strict_addendum | All 240 scripts/** rows must have non-empty packageImplementationSet, original/package bytes and LOC ratios, strict threshold decision, 240-path no-fallback scan, and automatic goal rework until compliant | G001, G002, G009, G014, G015 | ACC022, ACC023, ACC024, ACC025 | CMD003, CMD008, CMD013, CMD014 | docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.generation-receipt.json |
<!-- /goal-slot:sourceCoverageMatrix -->

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

<!-- goal-slot:requiredTestCommands required dynamic=requiredCommands -->
### CMD001 Preflight dirty worktree and encoding gate

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short; node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"
```

Expected pass condition: Command exits 0 and encoding scan reports findings=0.

### CMD002 Verify frozen source hashes and queue counts

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { @'
const fs=require('fs');const crypto=require('crypto');const files=[{"path":"repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json","bytes":735064,"lines":22288,"sha256":"sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31"},{"path":"repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json","bytes":264685,"lines":5665,"sha256":"sha256:3b3ccf1b1a88d9f7dd559413e4bcb502d0cdf7305b308b64e2b12f26ac42ddb5"},{"path":"repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json","bytes":345123,"lines":7983,"sha256":"sha256:9d69564dc665ba50eb40fab76a955a8880602963dd57667f6b8d308074629dee"},{"path":"repo-governance/script-migration-registry.yaml","bytes":364823,"lines":7093,"sha256":"sha256:9c86cac253049e18b4c126994817c6786f7d115800884eac0348e4d18ad8cf33"}];for(const f of files){const b=fs.readFileSync(f.path);const h='sha256:'+crypto.createHash('sha256').update(b).digest('hex');if(h!==f.sha256) throw new Error(f.path+' hash mismatch '+h);}const q=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json','utf8'));const p=JSON.parse(fs.readFileSync('repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json','utf8'));const queueSet=new Set(Object.values(q.groups.byPriority).flat());const settled=(p.entries||[]).filter((entry)=>!queueSet.has(entry.originalPath));if((p.entries||[]).length!==240||queueSet.size!==206||settled.length!==34) throw new Error('full universe totals mismatch');if(q.totals.allScripts!==240||q.totals.backlog!==206||q.totals.blockerKinds!==233) throw new Error('queue totals mismatch');for(const [k,v] of Object.entries({"P1-real-package-source-required":107,"P3-parity-evidence-and-size-ledger":18,"P2-helper-and-functional-evidence":80,"P0-core-source-authority":1})){if(q.totals.byPriority[k]!==v) throw new Error(k+' priority mismatch');}for(const [k,v] of Object.entries({"package_runtime_module":96,"durable_helper_copy":85,"public_cli_de_surface":14,"compatibility_alias":10,"runtime_emit_cjs":1})){if(q.totals.byStrategy[k]!==v) throw new Error(k+' strategy mismatch');}
'@ | node - }"
```

Expected pass condition: Command exits 0 and proves inventory, queue, parity baseline, registry baseline hashes, and queue counts match this contract.

### CMD003 Run Wave 4.1 preflight and ledger validator

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs --phase preflight --json
```

Expected pass condition: Command exits 0 and JSON reports ledger row count 240, backlog_migration row count 206, settled_revalidation row count 34, no unmapped inventory rows, required ledger fields present for packageImplementationSet and size-delta evidence, and validation scope originalPath count 240.

### CMD004 Run Wave 4.1 acceptance tests

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
npx vitest run tests/acceptance/main-agent-runtime-migration-wave-4-rebaseline-contract.test.ts tests/acceptance/main-agent-runtime-migration-wave-4-1-contract.test.ts
```

Expected pass condition: Command exits 0 and tests prove validator fail-closed plus reworkRequired behavior for missing packageImplementationSet, missing size-delta fields, out-of-threshold ratios, incomplete 240-path no-fallback scans, and fallback hits.

### CMD005 Build package main-agent dist

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
npm run build:main-agent-dist --prefix packages/bmad-speckit
```

Expected pass condition: Command exits 0 and dist output hashes are recorded in migration-ledger.json.

### CMD006 Run package node tests

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
npm run test --prefix packages/bmad-speckit
```

Expected pass condition: Command exits 0 and package runtime tests pass.

### CMD007 Run registry and physical closure tests

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
npx vitest run tests/acceptance/script-migration-registry-contract.test.ts tests/acceptance/script-migration-full-physical-closure.test.ts tests/acceptance/main-agent-runtime-migration-wave-4-1-contract.test.ts
```

Expected pass condition: Command exits 0 and registry closure tests pass.

### CMD008 Run no-fallback scanner

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs --phase no-fallback --json
```

Expected pass condition: Command exits 0 and JSON reports scannedOriginalPathCount=240, scanCoverageRows=240, forbiddenHitCount=0, rootScriptDispatchHitCount=0, tsxHitCount=0, tsNodeHitCount=0, compiledFallbackHitCount=0, reportOnlySourceHitCount=0, and descriptorOnlyHelperHitCount=0.

### CMD009 Run no-save install matrix

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs --mode no-save --json
```

Expected pass condition: Command exits 0 and writes install-matrix/no-save.json with rootScriptDependencyCount=0.

### CMD010 Run save-dev install matrix

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs --mode save-dev --json
```

Expected pass condition: Command exits 0 and writes install-matrix/save-dev.json with rootScriptDependencyCount=0.

### CMD011 Run npx-package install matrix

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs --mode npx-package --json
```

Expected pass condition: Command exits 0 and writes install-matrix/npx-package.json with rootScriptDependencyCount=0.

### CMD012 Run init-sync-consumer install matrix

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/run-main-agent-wave-4-1-install-matrix.cjs --mode init-sync-consumer --json
```

Expected pass condition: Command exits 0 and writes install-matrix/init-sync-consumer.json with rootScriptDependencyCount=0.

### CMD013 Run final Wave 4.1 validator

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs --phase final --json
```

Expected pass condition: Command exits 0 and JSON reports all240RowsPassed=true, all240RowsHavePackageImplementationSet=true, all240RowsHaveSizeDeltaDecision=true, zeroSizeMetricCount=0, sizeDeltaViolationCount=0, scannedOriginalPathCount=240, noFallbackScanCoverageRows=240, fallbackHitCount=0, reworkQueueLength=0, allAcceptancePassed=true, and residualRisks=none.

### CMD014 Run final encoding gate

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Expected pass condition: Command exits 0 and reports findings=0.

### CMD015 Run root full test suite

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
npm run test
```

Expected pass condition: Command exits 0 and root test suite passes.

### CMD016 Run package prepublish gate

Working directory: `D:/Dev/BMAD-Speckit-SDD-Flow`.

```powershell
npm run prepublishOnly
```

Expected pass condition: Command exits 0 and package prepublish gate passes without root script runtime fallback.
<!-- /goal-slot:requiredTestCommands -->

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

<!-- goal-slot:manualVerificationScenarios required dynamic=manualScenarios -->
- MV001: Open `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json` and confirm `entries.length` equals `240`, `backlog_migration` row count equals `206`, and `settled_revalidation` row count equals `34`.
- MV002: Open each `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/install-matrix/*.json` file and confirm `rootScriptDependencyCount` equals `0`.
- MV003: Open `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/final-evidence-packet.json` and confirm `completionDecision` equals `pass`.
- MV004: Open `repo-governance/script-migration-registry.yaml` and confirm Wave 4.1 `status` equals `completed` and `contractPath` equals this contract path.
- MV005: Open `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/package-source-parity-evidence.json` and confirm it contains 240 rows, every row has non-empty packageImplementationSet, every originalBytes, originalLoc, packageBytes, and packageLoc value is greater than 0, every byte and LOC ratio is within 0.70 through 1.30 inclusive, and every row has sizeDeltaDecision `passed_within_strict_threshold`.
- MV006: Open `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/rework-iterations.json` and confirm every fixable failed strict gate was reworked to result `pass` before final evidence was written.
- MV007: Run a manual `rg -n` scan for the 240 source inventory original paths inside `packages/bmad-speckit/src`, `packages/bmad-speckit/dist`, `packages/bmad-speckit/bin`, `packages/bmad-speckit/scripts`, generated surfaces, and installed consumer fixtures; the scan output MUST contain zero runtime dispatch hits.
<!-- /goal-slot:manualVerificationScenarios -->

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

<!-- goal-slot:completionEvidencePacket required dynamic=evidencePacket -->
- EVD001: `contractPath` MUST equal `docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.md` and `contractHash` MUST equal the SHA256 of the final Markdown file.
- EVD002: `sourcePlanPath` MUST equal `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json` and `sourcePlanHash` MUST equal `sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31`.
- EVD003: `migrationLedgerPath` MUST equal `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/migration-ledger.json` and ledger row count MUST equal `240`.
- EVD004: `registryPath` MUST equal `repo-governance/script-migration-registry.yaml` and Wave 4.1 registry status MUST equal `completed`.
- EVD005: `commandEvidence` MUST contain CMD001 through CMD016 with command line, cwd, exit code, stdout path, stderr path, startedAt, completedAt, and acceptance IDs.
- EVD006: `installMatrix` MUST contain no-save, save-dev, npx-package, and init-sync-consumer result paths and hashes.
- EVD007: `noFallbackScan` MUST contain `scannedOriginalPathCount=240`, `scanCoverageRows=240`, `forbiddenHitCount=0`, and scan scopes for package source, package dist, package bin, package scripts, generated surfaces, and installed consumer fixtures.
- EVD008: `acceptanceResults` MUST contain ACC001 through ACC025 with `status=pass` and direct evidence IDs.
- EVD009: `packageImplementationSetSummary` MUST contain `all240RowsHavePackageImplementationSet=true` and `missingPackageImplementationSetCount=0`.
- EVD010: `sizeDeltaSummary` MUST contain `all240RowsHaveSizeDeltaDecision=true`, `zeroSizeMetricCount=0`, `sizeDeltaViolationCount=0`, `byteRatioRange=0.70..1.30`, and `locRatioRange=0.70..1.30`.
- EVD011: `reworkSummary` MUST contain `reworkQueueLength=0` and every fixable failed strict gate MUST have a rework iteration result `pass`.
- EVD012: `residualRisks` MUST equal `none` only when no stop condition remains active and `reworkQueueLength=0`.
<!-- /goal-slot:completionEvidencePacket -->

## Stop Conditions

<!-- goal-slot:stopConditions required dynamic=stopConditions -->
- REWORK001: If any ledger row lacks behavior parity proof, package source proof, packageImplementationSet, size-delta proof, dist proof required for installed runtime output, install proof required for consumer invocation, registry proof, or no-fallback proof, the /goal executor MUST write a rework iteration and repair the row before rerunning CMD013.
- REWORK002: If any packageImplementationSet is empty, outside `packages/bmad-speckit/`, or satisfied only by dist, receipt, registry, or test paths, the /goal executor MUST write a rework iteration and add package-owned executable implementation source before rerunning CMD003 and CMD013.
- REWORK003: If originalBytes, originalLoc, packageBytes, or packageLoc is not greater than 0, or if any packageByteRatio or packageLocRatio is outside 0.70 through 1.30 inclusive, the /goal executor MUST write a rework iteration and modify the packageImplementationSet or package implementation until all size metrics pass before rerunning CMD013.
- REWORK004: If CMD008 reports scannedOriginalPathCount below 240, scanCoverageRows below 240, forbiddenHitCount above 0, rootScriptDispatchHitCount above 0, tsxHitCount above 0, tsNodeHitCount above 0, compiledFallbackHitCount above 0, reportOnlySourceHitCount above 0, or descriptorOnlyHelperHitCount above 0, the /goal executor MUST write a rework iteration and remove the fallback or scan gap before rerunning CMD008 and CMD013.
- REWORK005: If CMD013 reports reworkQueueLength greater than 0, all240RowsPassed not true, all240RowsHavePackageImplementationSet not true, all240RowsHaveSizeDeltaDecision not true, zeroSizeMetricCount greater than 0, sizeDeltaViolationCount greater than 0, fallbackHitCount greater than 0, allAcceptancePassed not true, or residualRisks not none, the /goal executor MUST continue the automatic rework loop and MUST NOT write final completion evidence.
- STOP001: If `source-inventory.json` hash differs from front matter `sourcePlanHash`, stop with `contract_amendment_required:source_plan_hash_mismatch`.
- STOP002: If `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json` hash differs from `sha256:3b3ccf1b1a88d9f7dd559413e4bcb502d0cdf7305b308b64e2b12f26ac42ddb5`, stop with `contract_amendment_required:queue_hash_mismatch`.
- STOP003: If `repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json` hash differs from `sha256:9d69564dc665ba50eb40fab76a955a8880602963dd57667f6b8d308074629dee`, stop with `contract_amendment_required:parity_hash_mismatch`.
- STOP004: If full inventory row count differs from 240, stop with `scope_amendment_required:full_inventory_count_mismatch`.
- STOP005: If backlog row count differs from 206 or settled row count differs from 34, stop with `scope_amendment_required:scope_class_count_mismatch`.
- STOP006: If any inventory row lacks a ledger row, stop with `source_coverage_unmapped:inventory_row_missing_from_ledger`.
- STOP007: If a task needs files outside this contract scope, stop with `scope_amendment_required:undeclared_write_scope`.
- STOP008: If semantic equivalence for a row cannot be determined from original source and target behavior after repository source inspection, stop with `semantic_decision_required:original_path_equivalence` and name the exact original path.
- STOP009: If contract wording conflicts with the strict 240-row packageImplementationSet, size-delta, no-fallback, or automatic rework requirements, stop with `contract_amendment_required:strict_acceptance_conflict`.
<!-- /goal-slot:stopConditions -->
